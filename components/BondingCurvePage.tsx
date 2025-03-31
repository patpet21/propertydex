import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Globe,
  Twitter,
  MessageCircle,
  Trash2,
  ShoppingCart,
  Info,
  FileText,
  Lock,
  GraduationCap,
} from 'lucide-react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import ListToken from './ListToken';

const MARKETPLACE_ADDRESS = '0x975cf7cb3b414d22d3e208ce5f058fc1b456d6bc'; // Replace with actual deployed address
const PRDX_TOKEN_ADDRESS = '0x61Dd008F1582631Aa68645fF92a1a5ECAedBeD19'; // PRDX on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';     // USDC on Base

const MARKETPLACE_ABI = [
  "function listToken(address tokenAddress, uint256 amountRaw, uint256 priceInitialRaw, address paymentToken, uint256 durationInSeconds, (string projectWebsite, string socialMediaLink, string tokenImageUrl, string telegramUrl, string projectDescription) metadata) external",
  "function buyToken(uint256 listingId, uint256 amountRaw) external",
  "function claimTokens(uint256 listingId) external",
  "function claimRefund(uint256 listingId) external",
  "function withdrawExpiredFundsAndTokens(uint256 listingId) external",
  "function listingCount() external view returns (uint256)",
  "function listings(uint256) external view returns (address seller, address tokenAddress, uint256 initialAmountRaw, uint256 reservedAmountRaw, uint256 tradableAmountRaw, uint256 soldAmountRaw, uint256 priceInitialRaw, address paymentToken, uint8 paymentDecimals, bool active, uint256 endTime, (string projectWebsite, string socialMediaLink, string tokenImageUrl, string telegramUrl, string projectDescription) metadata)",
  "function getListingDetails(uint256 listingId) external view returns (address seller, address tokenAddress, uint256 tradableAmountRaw, uint256 soldAmountRaw, uint256 priceInitialRaw, uint256 currentPriceRaw, uint256 fdmcRaw, uint256 marketCapRaw, address paymentToken, bool active, uint256 endTime)",
  "function getListingStatus(uint256 listingId) external view returns (string)",
  "function getBuyerInfo(uint256 listingId, address buyer) external view returns (uint256 totalPaidRaw, bool refunded, uint256 timestamp)",
  "function lockedTokens(uint256 listingId, address buyer) external view returns (uint256)",
  "event TokenListed(uint256 indexed listingId, address indexed seller, address tokenAddress, uint256 tradableAmount)",
  "event TokenPurchased(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 totalCost, uint256 timestamp)",
  "event TokenMigrated(uint256 indexed listingId, uint256 tokenAmount, uint256 paymentAmount)",
  "event TokensClaimed(uint256 indexed listingId, address indexed buyer, uint256 amount)",
  "event FundsRefunded(uint256 indexed listingId, address indexed buyer, uint256 amount)",
];

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

interface Listing {
  id: number;
  seller: string;
  token: {
    address: string;
    name: string;
    symbol: string;
    initialAmount: string;
    reservedAmount: string;
    tradableAmount: string;
    soldAmount: string;
    priceInitial: string;
    currentPrice: string;
    decimals: number;
    fdmc: string;
    marketCap: string;
  };
  paymentToken: string;
  paymentTokenSymbol: string;
  paymentDecimals: number;
  active: boolean;
  isOwner: boolean;
  endTime: number;
  projectWebsite: string;
  socialMediaLink: string;
  imageUrl: string;
  telegramUrl: string;
  projectDescription: string;
}

async function getListings(signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const listingCount = Number(await marketplace.listingCount());
    const listings: Listing[] = [];
    const userAddress = await signer.getAddress();

    for (let i = 0; i < listingCount; i++) {
      try {
        const listingData = await marketplace.listings(i);
        const details = await marketplace.getListingDetails(i);
        const token = new ethers.Contract(listingData.tokenAddress, TOKEN_ABI, signer);
        const paymentToken = new ethers.Contract(listingData.paymentToken, TOKEN_ABI, signer);
        const [tokenDecimals, paymentDecimals] = await Promise.all([token.decimals(), paymentToken.decimals()]);

        listings.push({
          id: i,
          seller: listingData.seller,
          token: {
            address: listingData.tokenAddress,
            name: await token.name(),
            symbol: await token.symbol(),
            initialAmount: ethers.formatUnits(listingData.initialAmountRaw, tokenDecimals),
            reservedAmount: ethers.formatUnits(listingData.reservedAmountRaw, tokenDecimals),
            tradableAmount: ethers.formatUnits(listingData.tradableAmountRaw, tokenDecimals),
            soldAmount: ethers.formatUnits(listingData.soldAmountRaw, tokenDecimals),
            priceInitial: ethers.formatUnits(listingData.priceInitialRaw, paymentDecimals),
            currentPrice: ethers.formatUnits(details.currentPriceRaw, paymentDecimals),
            decimals: tokenDecimals,
            fdmc: ethers.formatUnits(details.fdmcRaw, paymentDecimals),
            marketCap: ethers.formatUnits(details.marketCapRaw, paymentDecimals),
          },
          paymentToken: listingData.paymentToken,
          paymentTokenSymbol: await paymentToken.symbol(),
          paymentDecimals,
          active: listingData.active,
          isOwner: listingData.seller.toLowerCase() === userAddress.toLowerCase(),
          endTime: Number(listingData.endTime),
          projectWebsite: listingData.metadata.projectWebsite,
          socialMediaLink: listingData.metadata.socialMediaLink,
          imageUrl: listingData.metadata.tokenImageUrl || 'https://via.placeholder.com/150',
          telegramUrl: listingData.metadata.telegramUrl,
          projectDescription: listingData.metadata.projectDescription,
        });
      } catch (error) {
        console.error(`Error loading listing ${i}:`, error);
      }
    }
    return listings;
  } catch (error: any) {
    throw new Error(`Failed to load listings: ${error.message}`);
  }
}

async function buyTokens(listingId: number, amountRaw: bigint, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const listingData = await marketplace.listings(listingId);
    const details = await marketplace.getListingDetails(listingId);
    const paymentToken = new ethers.Contract(listingData.paymentToken, TOKEN_ABI, signer);
    const paymentDecimals = await paymentToken.decimals();
    const totalCostRaw = (BigInt(details.currentPriceRaw) * BigInt(amountRaw)) / BigInt(10 ** 18);
    const adjustedTotalCostRaw = paymentDecimals === 6 ? totalCostRaw / BigInt(10 ** 12) : totalCostRaw;

    const userAddress = await signer.getAddress();
    const paymentBalance = await paymentToken.balanceOf(userAddress);
    if (paymentBalance < adjustedTotalCostRaw) throw new Error('Insufficient payment token balance');

    const allowance = await paymentToken.allowance(userAddress, MARKETPLACE_ADDRESS);
    if (allowance < adjustedTotalCostRaw) {
      toast.loading('Approving payment token...', { id: 'approve' });
      const approveTx = await paymentToken.approve(MARKETPLACE_ADDRESS, ethers.MaxUint256);
      await approveTx.wait();
      toast.success('Approval completed!', { id: 'approve' });
    }

    const gasEstimate = await marketplace.buyToken.estimateGas(listingId, amountRaw);
    const tx = await marketplace.buyToken(listingId, amountRaw, { gasLimit: gasEstimate * 120n / 100n });
    const receipt = await tx.wait();
    return receipt;
  } catch (error: any) {
    throw new Error(`Purchase failed: ${error.message}${error.reason ? ` - ${error.reason}` : ''}`);
  }
}

async function claimTokens(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const gasEstimate = await marketplace.claimTokens.estimateGas(listingId);
    const tx = await marketplace.claimTokens(listingId, { gasLimit: gasEstimate * 120n / 100n });
    const receipt = await tx.wait();
    toast.success('Tokens claimed successfully!');
    return receipt;
  } catch (error: any) {
    throw new Error(`Failed to claim tokens: ${error.message}`);
  }
}

async function claimRefund(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const gasEstimate = await marketplace.claimRefund.estimateGas(listingId);
    const tx = await marketplace.claimRefund(listingId, { gasLimit: gasEstimate * 120n / 100n });
    const receipt = await tx.wait();
    toast.success('Refund claimed successfully!');
    return receipt;
  } catch (error: any) {
    throw new Error(`Failed to claim refund: ${error.message}`);
  }
}

async function withdrawExpiredFundsAndTokens(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const gasEstimate = await marketplace.withdrawExpiredFundsAndTokens.estimateGas(listingId);
    const tx = await marketplace.withdrawExpiredFundsAndTokens(listingId, { gasLimit: gasEstimate * 120n / 100n });
    const receipt = await tx.wait();
    toast.success('Expired funds and tokens withdrawn successfully!');
    return receipt;
  } catch (error: any) {
    throw new Error(`Failed to withdraw: ${error.message}`);
  }
}

interface MarketplaceProps {
  onClose: () => void;
  signer: ethers.Signer | null;
}

interface ErrorModalProps {
  message: string;
  onClose: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ message, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-60"
  >
    <motion.div
      initial={{ scale: 0.95 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0.95 }}
      className="bg-gradient-to-br from-red-900 to-gray-900 rounded-xl p-6 max-w-md w-full border border-red-500/50 shadow-2xl"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-red-300">Error</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="text-gray-200 text-sm mb-4">{message}</div>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClose}
        className="w-full bg-red-600 hover:bg-red-700 transition-colors rounded-lg py-2 text-white font-medium"
      >
        Close
      </motion.button>
    </motion.div>
  </motion.div>
);

export default function Marketplace({ onClose, signer }: MarketplaceProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'price' | 'name'>('price');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [showListTokenModal, setShowListTokenModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (signer) {
      const initialize = async () => {
        try {
          const addr = await signer.getAddress();
          setWalletAddress(addr.toLowerCase());
          await loadListings();
        } catch (error) {
          setErrorMessage('Error initializing Marketplace');
        }
      };
      initialize();

      const interval = setInterval(loadListings, 60000);
      return () => clearInterval(interval);
    }
  }, [signer]);

  const loadListings = async () => {
    if (!signer) return;
    setLoading(true);
    try {
      const allListings = await getListings(signer);
      const currentTime = Math.floor(Date.now() / 1000);
      const activeListings = allListings.filter(
        (listing) => listing.active && listing.endTime > currentTime && parseFloat(listing.token.tradableAmount) > parseFloat(listing.token.soldAmount)
      );
      const expiredListings = allListings.filter(
        (listing) => !listing.active || listing.endTime <= currentTime
      );
      setListings([...activeListings, ...expiredListings]);
    } catch (error: any) {
      setErrorMessage(`Failed to load listings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = async () => {
    setShowListTokenModal(false);
    await loadListings();
    toast.success('Token listed successfully!');
  };

  const handleBuy = async (listing: Listing) => {
    if (!signer) {
      setErrorMessage('Connect your wallet to purchase tokens.');
      return;
    }
    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      setErrorMessage('Enter a valid amount');
      return;
    }
    try {
      setLoading(true);
      const amountRaw = ethers.parseUnits(buyAmount, listing.token.decimals);
      await buyTokens(listing.id, amountRaw, signer);
      toast.success('Purchase completed successfully!');
      await loadListings();
      setSelectedListing(null);
      setBuyAmount('');
    } catch (error: any) {
      setErrorMessage(`Purchase failed: ${error.message}${error.reason ? ` - ${error.reason}` : ''}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimTokens = async (listingId: number) => {
    if (!signer) {
      setErrorMessage('Connect your wallet to claim tokens.');
      return;
    }
    try {
      setLoading(true);
      await claimTokens(listingId, signer);
      await loadListings();
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimRefund = async (listingId: number) => {
    if (!signer) {
      setErrorMessage('Connect your wallet to claim refund.');
      return;
    }
    try {
      setLoading(true);
      await claimRefund(listingId, signer);
      await loadListings();
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawExpired = async (listingId: number) => {
    if (!signer) {
      setErrorMessage('Connect your wallet to withdraw expired funds and tokens.');
      return;
    }
    try {
      setLoading(true);
      await withdrawExpiredFundsAndTokens(listingId, signer);
      await loadListings();
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getTimeRemaining = (endTime: number) => {
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = endTime - now;
    if (timeLeft <= 0) return 'Expired';
    const days = Math.floor(timeLeft / (24 * 3600));
    const hours = Math.floor((timeLeft % (24 * 3600)) / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const calculatePercentageSold = (listing: Listing) => {
    const sold = parseFloat(listing.token.soldAmount);
    const tradable = parseFloat(listing.token.tradableAmount);
    return tradable > 0 ? (sold / tradable) * 100 : 0;
  };

  const sortedListings = [...listings].sort((a, b) => {
    if (sortBy === 'price') {
      const priceA = parseFloat(a.token.currentPrice);
      const priceB = parseFloat(b.token.currentPrice);
      return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
    } else {
      return sortOrder === 'asc'
        ? a.token.name.localeCompare(b.token.name)
        : b.token.name.localeCompare(a.token.name);
    }
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white/10 backdrop-blur rounded-xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Token Launchpad</h2>
          <div className="flex items-center space-x-4">
            <select
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'price' | 'name')}
            >
              <option value="price">Sort by Price</option>
              <option value="name">Sort by Name</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
            >
              {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
            </button>
            <button
              onClick={() => setShowListTokenModal(true)}
              className="bg-primary-600 hover:bg-primary-700 transition-colors rounded-lg px-4 py-2 text-sm"
            >
              List New Token
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading listings...</p>
          </div>
        ) : sortedListings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sortedListings.map((listing) => {
              const percentageSold = calculatePercentageSold(listing);
              const isExpired = Math.floor(Date.now() / 1000) > listing.endTime;
              const isMigrated = percentageSold >= 98.5 || !listing.active;
              const isRefundable = isExpired && percentageSold < 98.5;
              const isClaimable = isExpired && percentageSold >= 98.5;
              const isOwner = walletAddress.toLowerCase() === listing.seller.toLowerCase();
              const isContractOwner = walletAddress.toLowerCase() === 'YOUR_CONTRACT_OWNER_ADDRESS'.toLowerCase(); // Replace with actual owner address

              return (
                <div
                  key={listing.id}
                  className="bg-white/5 rounded-lg overflow-hidden group hover:bg-white/10 transition-all border border-white/10 hover:border-primary-500"
                >
                  {listing.imageUrl && (
                    <div className="relative overflow-hidden">
                      <img
                        src={listing.imageUrl}
                        alt={listing.token.name}
                        className="w-full h-32 object-cover transform group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150')}
                      />
                      {isOwner && signer && (
                        <div className="absolute top-2 right-2">
                          <span className="bg-primary-600 text-white text-xs px-1.5 py-0.5 rounded-md font-medium shadow-md">
                            Your Listing
                          </span>
                        </div>
                      )}
                      {isExpired && (
                        <div className="absolute top-2 left-2">
                          <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-md font-medium shadow-md">
                            Expired
                          </span>
                        </div>
                      )}
                      {isMigrated && (
                        <div className="absolute top-2 left-2">
                          <span className="bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-md font-medium flex items-center">
                            <GraduationCap className="w-3 h-3 mr-1" /> Migrated
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-3 space-y-3">
                    <div>
                      <h3 className="text-base font-semibold">
                        {listing.token.name}
                        {isMigrated && (
                          <span className="ml-2 text-green-400 flex items-center">
                            <GraduationCap className="w-5 h-5 mr-1" /> Migrated
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-400">{listing.token.symbol}</p>
                    </div>

                    {listing.projectDescription && (
                      <div className="bg-white/5 p-2 rounded-lg">
                        <p className="text-xs text-gray-300 line-clamp-2">{listing.projectDescription}</p>
                      </div>
                    )}

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Available:</span>
                        <span>{(parseFloat(listing.token.tradableAmount) - parseFloat(listing.token.soldAmount)).toFixed(2)} tokens</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div
                          className="bg-green-600 h-2.5 rounded-full"
                          style={{ width: `${Math.min(percentageSold, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Sold:</span>
                        <span>{percentageSold.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Current Price:</span>
                        <span>{parseFloat(listing.token.currentPrice).toFixed(6)} {listing.paymentTokenSymbol}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">FDMC:</span>
                        <span>{parseFloat(listing.token.fdmc).toFixed(2)} {listing.paymentTokenSymbol}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Market Cap:</span>
                        <span>{parseFloat(listing.token.marketCap).toFixed(2)} {listing.paymentTokenSymbol}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">End Time:</span>
                        <span>{getTimeRemaining(listing.endTime)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {listing.projectWebsite && (
                        <a href={listing.projectWebsite} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300">
                          <Globe className="w-3 h-3" />
                        </a>
                      )}
                      {listing.socialMediaLink && (
                        <a href={listing.socialMediaLink} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300">
                          <Twitter className="w-3 h-3" />
                        </a>
                      )}
                      {listing.telegramUrl && (
                        <a href={listing.telegramUrl} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300">
                          <MessageCircle className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {signer && (
                      <div className="space-y-2">
                        {!isExpired && listing.active && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setSelectedListing(listing)}
                            className="w-full bg-primary-600 hover:bg-primary-700 transition-colors rounded-md py-1.5 text-xs"
                          >
                            Buy Tokens
                          </motion.button>
                        )}
                        {isClaimable && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleClaimTokens(listing.id)}
                            className="w-full bg-green-600 hover:bg-green-700 transition-colors rounded-md py-1.5 text-xs"
                          >
                            Claim Tokens
                          </motion.button>
                        )}
                        {isRefundable && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleClaimRefund(listing.id)}
                            className="w-full bg-blue-600 hover:bg-blue-700 transition-colors rounded-md py-1.5 text-xs"
                          >
                            Claim Refund
                          </motion.button>
                        )}
                        {isContractOwner && isExpired && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleWithdrawExpired(listing.id)}
                            className="w-full bg-yellow-600 hover:bg-yellow-700 transition-colors rounded-md py-1.5 text-xs"
                          >
                            Withdraw Expired
                          </motion.button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>No active listings available.</p>
          </div>
        )}

        {showListTokenModal && signer && (
          <ListToken
            onClose={() => setShowListTokenModal(false)}
            signer={signer}
            onSuccess={handleSuccess}
          />
        )}

        {selectedListing && signer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gradient-to-b from-gray-900 to-black rounded-xl p-6 max-w-md w-full border border-white/10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Buy {selectedListing.token.name} Tokens</h3>
                <button
                  onClick={() => setSelectedListing(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Amount to Buy</label>
                  <input
                    type="number"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    min="0.00001"
                    step="0.00001"
                    max={parseFloat(selectedListing.token.tradableAmount) - parseFloat(selectedListing.token.soldAmount)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    placeholder="Enter amount"
                  />
                </div>
                <div className="bg-white/5 p-3 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Current Price:</span>
                    <span className="font-medium">{parseFloat(selectedListing.token.currentPrice).toFixed(8)} {selectedListing.paymentTokenSymbol}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Available:</span>
                    <span className="font-medium">{(parseFloat(selectedListing.token.tradableAmount) - parseFloat(selectedListing.token.soldAmount)).toFixed(6)} tokens</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-gray-400">Total Cost:</span>
                    <span className="font-medium text-primary-300">
                      {buyAmount
                        ? `${(parseFloat(buyAmount) * parseFloat(selectedListing.token.currentPrice)).toFixed(8)} ${selectedListing.paymentTokenSymbol}`
                        : '-'}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-4 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-white/5 hover:bg-white/10 transition-colors rounded-lg py-2"
                    onClick={() => setSelectedListing(null)}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-primary-600 hover:bg-primary-700 transition-colors rounded-lg py-2 flex items-center justify-center"
                    onClick={() => handleBuy(selectedListing)}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Confirm Purchase
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {errorMessage && (
          <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />
        )}
      </motion.div>
    </motion.div>
  );
}

