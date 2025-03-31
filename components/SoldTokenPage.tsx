import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Building2,
  Check,
  Lock,
  FileText,
  DollarSign,
  GraduationCap,
  Clock,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  Info,
  Award,
  Gift,
  Share2,
  Clipboard,
  Globe,
  Twitter,
  MessageCircle,
} from 'lucide-react';
import { ethers } from 'ethers';

// Contract address and ABI
const MARKETPLACE_ADDRESS = '0x338a419639cD3c2089DB55aDEA4b9c47739596f0';

const MARKETPLACE_ABI = [
  "function listToken(address tokenAddress, uint256 amountRaw, uint256 pricePerShareRaw, address paymentToken, bool referralActive, uint256 referralPercent, (string projectWebsite, string socialMediaLink, string tokenImageUrl, string telegramUrl, string projectDescription) metadata, uint256 durationInSeconds) external",
  "function buyToken(uint256 listingId, uint256 amountRaw, bytes32 referralCode) external",
  "function cancelListing(uint256 listingId) external",
  "function listingCount() external view returns (uint256)",
  "function getListingBasicDetails(uint256 listingId) external view returns (address seller, address tokenAddress, uint256 amount, uint256 soldAmount, uint256 pricePerShare, address paymentToken)",
  "function getListingAdditionalDetails(uint256 listingId) external view returns (bool active, bool referralActive, uint256 referralPercent, bytes32 referralCode, uint256 endTime, uint256 initialAmount, uint256 referralReserve)",
  "function getListingMetadata(uint256 listingId) external view returns (string projectWebsite, string socialMediaLink, string tokenImageUrl, string telegramUrl, string projectDescription)",
  "function generateBuyerReferralCode(uint256 listingId) external returns (bytes32)",
  "event ReferralCodeGenerated(uint256 indexed listingId, bytes32 referralCode, address referralAddress)",
  "function withdrawUnsoldTokens(uint256 listingId) external",
  "function claimPoolFunds(uint256 listingId) external",
  "function claimTokens(uint256 listingId) external",
  "function claimRefund(uint256 listingId) external",
  "function withdrawUnclaimedFunds(uint256 listingId) external",
  "function withdrawPaymentTokens(address paymentToken, uint256 amountRaw, address to) external",
  "function withdrawTokens(address tokenAddress, uint256 amountRaw, address to) external",
  "function lockedTokens(uint256 listingId, address buyer) external view returns (uint256)",
  "function owner() external view returns (address)",
  "function getBuyerInfo(uint256 listingId, address buyer) external view returns (uint256 totalPaidRaw, bool refunded, uint256 timestamp)",
  "function getListingStatus(uint256 listingId) external view returns (string)",
];

const TOKEN_ABI = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function balanceOf(address account) external view returns (uint256)",
];

interface Listing {
  id: number;
  type: 'presale';
  seller: string;
  token: { 
    address: string; 
    name: string; 
    symbol: string; 
    amount: string; 
    soldAmount: string; 
    pricePerShare: string; 
    decimals: number;
    initialAmount: string;
  };
  paymentToken: string;
  paymentTokenSymbol: string;
  paymentDecimals: number;
  active: boolean;
  isOwner: boolean;
  imageUrl: string;
  projectWebsite: string;
  socialMediaLink: string;
  telegramUrl: string;
  projectDescription: string;
  endTime: number;
  initialAmount: string;
  referralReserve: string;
  lockedTokens?: string;
  status?: 'Active' | 'Sold Out' | 'Claimable' | 'Refundable';
  totalPaidRaw?: string;
  refunded?: boolean;
  referralActive?: boolean;
  referralPercent?: number;
  referralCode?: string;
}

// Helper Functions
const getConnected = async (signer: ethers.Signer): Promise<string> => {
  try {
    return (await signer.getAddress()).toLowerCase();
  } catch (error) {
    console.error('Error getting user address:', error);
    return '';
  }
};

const fetchListingDetails = async (marketplace: ethers.Contract, signer: ethers.Signer, listingId: number, userAddress: string): Promise<Listing> => {
  const [basicDetails, additionalDetails, metadata, lockedTokens, status, buyerInfo] = await Promise.all([
    marketplace.getListingBasicDetails(listingId),
    marketplace.getListingAdditionalDetails(listingId),
    marketplace.getListingMetadata(listingId),
    marketplace.lockedTokens(listingId, userAddress),
    marketplace.getListingStatus(listingId),
    marketplace.getBuyerInfo(listingId, userAddress),
  ]);

  const token = new ethers.Contract(basicDetails.tokenAddress, TOKEN_ABI, signer);
  const paymentToken = new ethers.Contract(basicDetails.paymentToken, TOKEN_ABI, signer);
  const [tokenName, tokenSymbol, tokenDecimals, paymentTokenSymbol, paymentDecimals] = await Promise.all([
    token.name(), token.symbol(), token.decimals(), paymentToken.symbol(), paymentToken.decimals()
  ]);

  return {
    id: listingId,
    type: 'presale',
    seller: basicDetails.seller,
    token: {
      address: basicDetails.tokenAddress,
      name: tokenName,
      symbol: tokenSymbol,
      amount: ethers.formatUnits(basicDetails.amount, tokenDecimals),
      soldAmount: ethers.formatUnits(basicDetails.soldAmount, tokenDecimals),
      pricePerShare: ethers.formatUnits(basicDetails.pricePerShare, paymentDecimals),
      decimals: tokenDecimals,
      initialAmount: ethers.formatUnits(additionalDetails.initialAmount, tokenDecimals),
    },
    paymentToken: basicDetails.paymentToken,
    paymentTokenSymbol,
    paymentDecimals,
    active: additionalDetails.active,
    isOwner: basicDetails.seller.toLowerCase() === userAddress,
    imageUrl: metadata.tokenImageUrl || 'https://via.placeholder.com/150',
    projectWebsite: metadata.projectWebsite,
    socialMediaLink: metadata.socialMediaLink,
    telegramUrl: metadata.telegramUrl,
    projectDescription: metadata.projectDescription,
    endTime: Number(additionalDetails.endTime),
    initialAmount: ethers.formatUnits(additionalDetails.initialAmount, tokenDecimals),
    referralReserve: ethers.formatUnits(additionalDetails.referralReserve, tokenDecimals),
    lockedTokens: ethers.formatUnits(lockedTokens, tokenDecimals),
    status: status as Listing['status'],
    totalPaidRaw: ethers.formatUnits(buyerInfo.totalPaidRaw, paymentDecimals),
    refunded: buyerInfo.refunded,
    referralActive: additionalDetails.referralActive,
    referralPercent: Number(additionalDetails.referralPercent),
    referralCode: ethers.hexlify(additionalDetails.referralCode),
  };
};

const getListings = async (signer: ethers.Signer): Promise<Listing[]> => {
  if (!signer) {
    console.error('Signer is undefined in getListings');
    return [];
  }
  const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
  const userAddress = await getConnected(signer);
  if (!userAddress) {
    console.error('User address not retrieved');
    return [];
  }

  const presaleCount = Number(await marketplace.listingCount());
  const listings: Listing[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < presaleCount; i++) {
    try {
      const listing = await fetchListingDetails(marketplace, signer, i, userAddress);
      if ((!listing.active || listing.endTime < now) || listing.status === 'Sold Out') {
        listings.push(listing);
      }
    } catch (error) {
      console.error(`Error fetching listing ${i}:`, error);
    }
  }
  return listings;
};

const getSoldPercentage = (listing: Listing): number => {
  const initialAmount = Number(ethers.parseUnits(listing.initialAmount, listing.token.decimals));
  const referralReserve = Number(ethers.parseUnits(listing.referralReserve, listing.token.decimals));
  const soldAmount = Number(ethers.parseUnits(listing.token.soldAmount, listing.token.decimals));
  const availableInitialAmount = initialAmount - referralReserve;
  return availableInitialAmount <= 0 ? 0 : (soldAmount * 100) / availableInitialAmount;
};

const calculateCountdown = (endTime: number): string => {
  const now = Math.floor(Date.now() / 1000);
  const deadline = endTime + 30 * 24 * 60 * 60; // 30 days refund period
  const timeLeft = deadline - now;
  if (timeLeft <= 0) return "Expired";
  const days = Math.floor(timeLeft / (24 * 60 * 60));
  const hours = Math.floor((timeLeft % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((timeLeft % (60 * 60)) / 60);
  return `${days}d ${hours}h ${minutes}m`;
};

// Contract Interaction Functions
async function withdrawUnsoldTokens(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const gasEstimate = await marketplace.withdrawUnsoldTokens.estimateGas(listingId);
    const tx = await marketplace.withdrawUnsoldTokens(listingId, { gasLimit: gasEstimate * 120n / 100n });
    await tx.wait();
    return tx;
  } catch (error: any) {
    throw new Error(`Failed to withdraw unsold tokens: ${error.message}`);
  }
}

async function claimPoolFunds(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const gasEstimate = await marketplace.claimPoolFunds.estimateGas(listingId);
    const tx = await marketplace.claimPoolFunds(listingId, { gasLimit: gasEstimate * 120n / 100n });
    await tx.wait();
    return tx;
  } catch (error: any) {
    throw new Error(`Failed to claim pool funds: ${error.message}`);
  }
}

async function claimTokens(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const gasEstimate = await marketplace.claimTokens.estimateGas(listingId);
    const tx = await marketplace.claimTokens(listingId, { gasLimit: gasEstimate * 120n / 100n });
    await tx.wait();
    return tx;
  } catch (error: any) {
    throw new Error(`Failed to claim tokens: ${error.message}`);
  }
}

async function claimRefund(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const gasEstimate = await marketplace.claimRefund.estimateGas(listingId);
    const tx = await marketplace.claimRefund(listingId, { gasLimit: gasEstimate * 120n / 100n });
    await tx.wait();
    return tx;
  } catch (error: any) {
    throw new Error(`Failed to claim refund: ${error.message}`);
  }
}

async function withdrawUnclaimedFunds(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const gasEstimate = await marketplace.withdrawUnclaimedFunds.estimateGas(listingId);
    const tx = await marketplace.withdrawUnclaimedFunds(listingId, { gasLimit: gasEstimate * 120n / 100n });
    await tx.wait();
    return tx;
  } catch (error: any) {
    throw new Error(`Failed to withdraw unclaimed funds: ${error.message}`);
  }
}

async function withdrawPaymentTokens(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const basicDetails = await marketplace.getListingBasicDetails(listingId);
    const paymentToken = new ethers.Contract(basicDetails.paymentToken, TOKEN_ABI, signer);
    const availableBalance = await paymentToken.balanceOf(MARKETPLACE_ADDRESS);
    if (availableBalance === 0n) {
      throw new Error('No payment tokens available to withdraw.');
    }
    const amountRaw = availableBalance;
    const gasEstimate = await marketplace.withdrawPaymentTokens.estimateGas(
      basicDetails.paymentToken,
      amountRaw,
      await signer.getAddress()
    );
    const tx = await marketplace.withdrawPaymentTokens(
      basicDetails.paymentToken,
      amountRaw,
      await signer.getAddress(),
      { gasLimit: gasEstimate * 120n / 100n }
    );
    await tx.wait();
    return tx;
  } catch (error: any) {
    throw new Error(`Failed to withdraw payment tokens: ${error.message}`);
  }
}

async function withdrawTokens(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const basicDetails = await marketplace.getListingBasicDetails(listingId);
    const token = new ethers.Contract(basicDetails.tokenAddress, TOKEN_ABI, signer);
    const availableBalance = await token.balanceOf(MARKETPLACE_ADDRESS);
    if (availableBalance === 0n) {
      throw new Error('No tokens available to withdraw.');
    }
    const amountRaw = availableBalance;
    const gasEstimate = await marketplace.withdrawTokens.estimateGas(
      basicDetails.tokenAddress,
      amountRaw,
      await signer.getAddress()
    );
    const tx = await marketplace.withdrawTokens(
      basicDetails.tokenAddress,
      amountRaw,
      await signer.getAddress(),
      { gasLimit: gasEstimate * 120n / 100n }
    );
    await tx.wait();
    return tx;
  } catch (error: any) {
    throw new Error(`Failed to withdraw tokens: ${error.message}`);
  }
}

const generateBuyerReferralCode = async (listingId: number, signer: ethers.Signer): Promise<string> => {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const tx = await marketplace.generateBuyerReferralCode(listingId);
    const receipt = await tx.wait();
    const referralCode = receipt.logs
      .filter((log) => log.topics[0] === ethers.id("ReferralCodeGenerated(uint256,bytes32,address)"))
      .map((log) => marketplace.interface.parseLog(log))
      .map((parsedLog) => parsedLog.args[1])[0];
    return ethers.hexlify(referralCode);
  } catch (error: any) {
    throw new Error(`Failed to generate referral code: ${error.message}`);
  }
};
// Popup Component
interface PopupProps {
  type: 'success' | 'error' | 'info';
  message: string | JSX.Element;
  onClose: () => void;
}

const Popup: React.FC<PopupProps> = ({ type, message, onClose }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="fixed inset-0 flex items-center justify-center min-h-screen z-50 p-4"
  >
    <div className={`bg-gradient-to-r ${type === 'success' ? 'from-green-600 to-green-800' : type === 'error' ? 'from-red-600 to-red-800' : 'from-purple-600 to-purple-800'} rounded-lg p-6 shadow-lg border ${type === 'success' ? 'border-green-400' : type === 'error' ? 'border-red-400' : 'border-purple-400'} text-white max-w-md w-full relative`}>
      <div className="flex items-start space-x-3 overflow-auto max-h-64">
        {type === 'success' ? <Check className="w-6 h-6 flex-shrink-0" /> : type === 'error' ? <X className="w-6 h-6 flex-shrink-0" /> : <Info className="w-6 h-6 flex-shrink-0" />}
        <div className="flex-1 break-words">
          {typeof message === 'string' ? <p className="text-sm">{message}</p> : message}
        </div>
      </div>
      <button onClick={onClose} className="absolute top-3 right-3 text-white hover:text-gray-200">
        <X className="w-5 h-5" />
      </button>
    </div>
  </motion.div>
);

interface SoldTokenPageProps {
  onClose: () => void;
  signer: ethers.Signer | null;
}

export default function SoldTokenPage({ onClose, signer }: SoldTokenPageProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDetailsListing, setSelectedDetailsListing] = useState<Listing | null>(null);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [contractOwner, setContractOwner] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<{ [key: number]: string }>({});
  const [showInfoModal, setShowInfoModal] = useState<string | null>(null);
  const [buttonLoading, setButtonLoading] = useState<{ [key: string]: boolean }>({});
  const [popup, setPopup] = useState<{ type: 'success' | 'error' | 'info'; message: string | JSX.Element } | null>(null);
  const [referralCodes, setReferralCodes] = useState<{ [listingId: number]: string }>({});
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const initialize = async () => {
      if (!signer) {
        setPopup({ type: 'error', message: 'Wallet not connected. Please connect your wallet to proceed.' });
        setLoading(false);
        return;
      }
      try {
        const address = await getConnected(signer);
        if (!address) throw new Error('Unable to retrieve user address');
        setUserAddress(address);

        const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
        const owner = await marketplace.owner();
        console.log('Contract Owner:', owner.toLowerCase());
        setContractOwner(owner.toLowerCase());

        await loadListings();
      } catch (error: any) {
        setPopup({ type: 'error', message: `Initialization failed: ${error.message}` });
      } finally {
        setLoading(false);
      }
    };
    initialize();
  }, [signer]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredListings(listings);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = listings.filter(
        (listing) =>
          listing.token.name.toLowerCase().includes(query) ||
          listing.token.address.toLowerCase().includes(query)
      );
      setFilteredListings(filtered);
    }
  }, [searchQuery, listings]);

  const loadListings = async () => {
    if (!signer) {
      setPopup({ type: 'error', message: 'Wallet not connected. Please connect your wallet to load listings.' });
      return;
    }
    setLoading(true);
    try {
      const allListings = await getListings(signer);
      const validListings = allListings.filter(
        (listing) => listing.imageUrl && listing.imageUrl !== '' && listing.imageUrl !== 'https://via.placeholder.com/150'
      );
      setListings(validListings);
      setFilteredListings(validListings);
      const newCountdown: { [key: number]: string } = {};
      validListings.forEach((listing) => {
        const soldPercentage = getSoldPercentage(listing);
        if (soldPercentage >= 85 || listing.status === 'Sold Out' || listing.status === 'Refundable') {
          if (listing.endTime > 0) newCountdown[listing.id] = calculateCountdown(listing.endTime);
        }
      });
      setCountdown(newCountdown);
    } catch (error: any) {
      setPopup({ type: 'error', message: `Failed to load listings: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const canWithdrawAfterDelay = (endTime: number) => {
    const delayInMinutes = 22;
    const currentTimeInSeconds = Math.floor(Date.now() / 1000);
    const endTimeInSeconds = endTime;
    const canWithdraw = currentTimeInSeconds > endTimeInSeconds + (delayInMinutes * 60);
    console.log(`Can Owner Withdraw for endTime ${endTime}:`, {
      currentTimeInSeconds,
      endTimeInSeconds,
      delayInMinutes,
      canWithdraw
    });
    return canWithdraw;
  };

  const handleAction = async (action: () => Promise<any>, key: string, successMessage: string, errorPrefix: string) => {
    if (!signer || !userAddress) {
      setPopup({ type: 'error', message: 'Please connect your wallet.' });
      return;
    }
    setButtonLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await action();
      setPopup({ type: 'success', message: successMessage });
      await loadListings();
    } catch (error: any) {
      let errorMessage = errorPrefix;
      if (error.message.includes('Claim period expired')) {
        errorMessage = 'Claim period has expired.';
      } else if (error.message.includes('Refund period expired')) {
        errorMessage = 'Refund period has expired.';
      } else {
        errorMessage = `${errorPrefix}: ${error.reason || error.message || 'Unknown error'}`;
      }
      setPopup({ type: 'error', message: errorMessage });
    } finally {
      setButtonLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleWithdrawUnsoldTokens = (listingId: number) =>
    handleAction(
      () => withdrawUnsoldTokens(listingId, signer!),
      `withdraw-${listingId}`,
      'Unsold tokens withdrawn successfully!',
      'Error withdrawing unsold tokens'
    );

  const handleClaimPoolFunds = (listingId: number) =>
    handleAction(
      () => claimPoolFunds(listingId, signer!),
      `claimFunds-${listingId}`,
      'Pool funds claimed successfully!',
      'Error claiming pool funds'
    );

  const handleClaimTokens = (listingId: number) =>
    handleAction(
      () => claimTokens(listingId, signer!),
      `claimTokens-${listingId}`,
      'Tokens claimed successfully!',
      'Error claiming tokens'
    );

  const handleClaimRefund = (listingId: number) =>
    handleAction(
      () => claimRefund(listingId, signer!),
      `refund-${listingId}`,
      'Refund claimed successfully!',
      'Error claiming refund'
    );

  const handleWithdrawUnclaimedFunds = (listingId: number) =>
    handleAction(
      () => withdrawUnclaimedFunds(listingId, signer!),
      `withdrawUnclaimed-${listingId}`,
      'Unclaimed funds withdrawn successfully!',
      'Error withdrawing unclaimed funds'
    );

  const handleWithdrawPaymentTokens = (listingId: number) =>
    handleAction(
      () => withdrawPaymentTokens(listingId, signer!),
      `withdrawPayment-${listingId}`,
      'Payment tokens withdrawn successfully!',
      'Error withdrawing payment tokens'
    );

  const handleWithdrawTokens = (listingId: number) =>
    handleAction(
      () => withdrawTokens(listingId, signer!),
      `withdrawTokens-${listingId}`,
      'Tokens withdrawn successfully!',
      'Error withdrawing tokens'
    );

  const generateAndShareReferral = async (listing: Listing) => {
    if (!signer || !userAddress) {
      setPopup({ type: 'error', message: 'Connect your wallet to generate a referral link.' });
      return;
    }
    try {
      let code = referralCodes[listing.id];
      if (!code) {
        code = await generateBuyerReferralCode(listing.id, signer!);
        const newReferralCodes = { ...referralCodes, [listing.id]: code };
        const limitedReferralCodes = Object.keys(newReferralCodes).slice(-50).reduce((acc, key) => {
          acc[key] = newReferralCodes[key];
          return acc;
        }, {});
        setReferralCodes(limitedReferralCodes);
        try {
          localStorage.setItem(`referralCodes_${userAddress}`, JSON.stringify(limitedReferralCodes));
        } catch (storageError) {
          console.warn('Failed to save referral codes to localStorage:', storageError);
          setPopup({ type: 'info', message: 'Unable to save referral code locally due to storage limits. You can still use the link.' });
        }
      }
      const baseUrl = window.location.origin;
      const link = `${baseUrl}?listingId=${listing.id}&referral=${code}`;
      setPopup({
        type: 'info',
        message: (
          <div>
            <p>Your referral link: <span className="font-mono">{link}</span></p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(link);
                setPopup({ type: 'success', message: 'Referral link copied to clipboard!' });
              }}
              className="mt-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-1 rounded"
            >
              Copy Link
            </button>
          </div>
        ),
        onClose: () => setPopup(null),
      });
    } catch (error: any) {
      setPopup({ type: 'error', message: `Error generating referral link: ${error.message}` });
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gradient-to-b from-black/80 to-gray-900/80 backdrop-blur-lg flex items-center justify-center p-6 z-50"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-primary-500/30"
      >
        <div className="flex flex-wrap items-center justify-between mb-8 gap-4">
          <h2 className="text-4xl font-bold text-primary-300 tracking-tight">Properties DEX - Sold Token Listings</h2>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search by token name or contract address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-800 text-white placeholder-gray-400 rounded-lg px-4 py-2 border border-primary-500/30 focus:outline-none focus:border-primary-500"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={loadListings}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg px-4 py-2 flex items-center space-x-2 text-white transition-all"
              disabled={loading}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9H4m16 0a8 8 0 01-8 8 8 8 0 01-8-8m8 8V4"></path>
                </svg>
              )}
              <span>Refresh Listings</span>
            </motion.button>
            <button onClick={onClose} className="text-primary-400 hover:text-primary-300 transition-all">
              <X className="w-8 h-8" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary-500 mx-auto"></div>
            <p className="mt-6 text-primary-400 text-lg">Loading listings...</p>
          </div>
        ) : !signer ? (
          <div className="text-center py-12">
            <Lock className="w-16 h-16 text-primary-400 mx-auto mb-4" />
            <p className="text-xl font-medium text-primary-200 mb-4">Connect wallet to view listings</p>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-primary-400 mx-auto mb-4" />
            <p className="text-xl font-medium text-primary-200 mb-2">No listings available</p>
            <p className="text-primary-400">Listings will appear here as they are created or after filtering.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredListings.map((listing) => {
              const soldPercentage = getSoldPercentage(listing);
              const isGraduated = soldPercentage >= 85;
              const isSoldOut = listing.status === 'Sold Out';
              const isExpired = listing.endTime < Math.floor(Date.now() / 1000);
              const countdownValue = countdown[listing.id] || 'Calculating...';
              const isBuyer = Number(listing.totalPaidRaw || '0') > 0 || Number(listing.lockedTokens || '0') > 0;
              const isRegistered = listing.isOwner || isBuyer;
              const isMarketplaceOwner = contractOwner === userAddress;
              const canOwnerWithdraw = isExpired && canWithdrawAfterDelay(listing.endTime);

              return (
                <div
                  key={`${listing.type}-${listing.id}`}
                  className={`bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl overflow-hidden group hover:shadow-2xl transition-all border ${isSoldOut ? 'border-green-500/50' : isGraduated ? 'border-yellow-500/50' : isExpired ? 'border-red-500/50' : 'border-primary-500/30 hover:border-primary-500/60'}`}
                >
                  {listing.imageUrl && (
                    <div className="relative overflow-hidden">
                      <img
                        src={listing.imageUrl}
                        alt={listing.token.name}
                        className="w-full h-48 object-cover transform group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150')}
                      />
                      {listing.referralActive && (
                        <div className="absolute top-3 left-3 flex items-center">
                          <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-md font-medium shadow-md">
                            {listing.referralPercent}% Referral
                          </span>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="bg-purple-700 text-white rounded-full p-0.5 ml-1 shadow-md hover:bg-purple-500 transition-colors"
                          >
                            <Info className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                      {listing.status === 'Sold Out' && (
                        <div className="absolute top-3 right-3 bg-green-600 text-white text-xs px-2 py-1 rounded-full font-medium shadow-md">Sold Out</div>
                      )}
                      {isExpired && !isSoldOut && !isGraduated && (
                        <div className="absolute top-3 right-3 bg-red-600 text-white text-xs px-2 py-1 rounded-full font-medium shadow-md">Expired</div>
                      )}
                    </div>
                  )}
                  <div className="p-5 space-y-4">
                    <div>
                      <h3 className="text-xl font-semibold text-primary-200 flex items-center">
                        {listing.token.name}
                        {isSoldOut && <span className="ml-2 text-green-400 flex items-center"><Award className="w-5 h-5 mr-1" /> Master</span>}
                        {isGraduated && !isSoldOut && <span className="ml-2 text-yellow-400 flex items-center"><GraduationCap className="w-5 h-5 mr-1" /> Graduated</span>}
                        {(isGraduated || isSoldOut) && (
                          <button onClick={() => setShowInfoModal(isSoldOut ? 'Master' : 'Graduated')} className="ml-2 text-primary-400 hover:text-primary-300">
                            <Info className="w-4 h-4" />
                          </button>
                        )}
                      </h3>
                      <p className="text-sm text-primary-400">{listing.token.symbol}</p>
                    </div>
                    <div className="space-y-3 text-sm text-primary-200">
                      <div className="flex justify-between">
                        <span className="text-primary-400">Available:</span>
                        <span className={isSoldOut ? 'text-green-400' : ''}>{isSoldOut ? '0 tokens (Sold Out)' : `${listing.token.amount} tokens`}</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div className="bg-gradient-to-r from-green-500 to-green-700 h-3 rounded-full transition-all duration-500" style={{ width: `${Math.min(soldPercentage, 100)}%` }}></div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-primary-400">Sold:</span>
                        <span>{isNaN(soldPercentage) ? '0%' : `${soldPercentage.toFixed(2)}%`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-primary-400">Price per token:</span>
                        <span>{listing.token.pricePerShare} {listing.paymentTokenSymbol}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-primary-400">End Time:</span>
                        <span>{new Date(listing.endTime * 1000).toLocaleString()}</span>
                      </div>
                      {listing.lockedTokens && isBuyer && (
                        <div className="flex justify-between">
                          <span className="text-primary-400">Locked Tokens:</span>
                          <span>{listing.lockedTokens} {listing.token.symbol}</span>
                        </div>
                      )}
                      {(isGraduated || listing.status === 'Claimable' || listing.status === 'Refundable') && (
                        <div className="flex justify-between">
                          <span className="text-primary-400 flex items-center"><Clock className="w-4 h-4 mr-1" /> Withdrawal Deadline:</span>
                          <span>{countdownValue}</span>
                        </div>
                      )}
                      {listing.status && (
                        <div className="flex justify-between">
                          <span className="text-primary-400">Status:</span>
                          <span className={listing.status === 'Claimable' ? 'text-green-400' : listing.status === 'Refundable' ? 'text-yellow-400' : 'text-primary-200'}>
                            {listing.status} {isExpired && '(Expired)'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { setShowDetailsModal(true); setSelectedDetailsListing(listing); }}
                        className="w-full bg-gradient-to-r from-primary-600/40 to-primary-700/40 hover:from-primary-600/60 hover:to-primary-700/60 rounded-lg py-2 flex items-center justify-center space-x-2 text-white transition-all"
                        disabled={!signer}
                      >
                        <FileText className="w-4 h-4" />
                        <span>View Details</span>
                      </motion.button>
                      {signer && isRegistered && (
                        <>
                          {listing.isOwner && isExpired && soldPercentage < 85 && Number(listing.token.amount) > 0 && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleWithdrawUnsoldTokens(listing.id)}
                              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-lg py-2 flex items-center justify-center space-x-2 text-white transition-all"
                              disabled={buttonLoading[`withdraw-${listing.id}`]}
                            >
                              {buttonLoading[`withdraw-${listing.id}`] ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> : <Trash2 className="w-4 h-4" />}
                              <span>Withdraw Unsold Tokens</span>
                            </motion.button>
                          )}
                          {listing.isOwner && isExpired && soldPercentage >= 85 && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleClaimPoolFunds(listing.id)}
                              className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg py-2 flex items-center justify-center space-x-2 text-white transition-all"
                              disabled={buttonLoading[`claimFunds-${listing.id}`]}
                            >
                              {buttonLoading[`claimFunds-${listing.id}`] ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> : <DollarSign className="w-4 h-4" />}
                              <span>Claim Pool Funds</span>
                            </motion.button>
                          )}
                          {isBuyer && isExpired && soldPercentage < 85 && Number(listing.lockedTokens) > 0 && !listing.refunded && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleClaimRefund(listing.id)}
                              className="w-full bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 rounded-lg py-2 flex items-center justify-center space-x-2 text-white transition-all"
                              disabled={buttonLoading[`refund-${listing.id}`]}
                            >
                              {buttonLoading[`refund-${listing.id}`] ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> : <ArrowDownCircle className="w-4 h-4" />}
                              <span>Claim Refund</span>
                            </motion.button>
                          )}
                          {isBuyer && isExpired && soldPercentage >= 85 && Number(listing.lockedTokens) > 0 && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleClaimTokens(listing.id)}
                              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg py-2 flex items-center justify-center space-x-2 text-white transition-all"
                              disabled={buttonLoading[`claimTokens-${listing.id}`]}
                            >
                              {buttonLoading[`claimTokens-${listing.id}`] ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> : <Check className="w-4 h-4" />}
                              <span>Claim Tokens</span>
                            </motion.button>
                          )}
                          {isMarketplaceOwner && canOwnerWithdraw && (
                            <>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleWithdrawUnclaimedFunds(listing.id)}
                                className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 rounded-lg py-2 flex items-center justify-center space-x-2 text-white transition-all"
                                disabled={buttonLoading[`withdrawUnclaimed-${listing.id}`]}
                              >
                                {buttonLoading[`withdrawUnclaimed-${listing.id}`] ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> : <ArrowUpCircle className="w-4 h-4" />}
                                <span>Withdraw Unclaimed Funds</span>
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleWithdrawPaymentTokens(listing.id)}
                                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg py-2 flex items-center justify-center space-x-2 text-white transition-all"
                                disabled={buttonLoading[`withdrawPayment-${listing.id}`]}
                              >
                                {buttonLoading[`withdrawPayment-${listing.id}`] ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> : <ArrowUpCircle className="w-4 h-4" />}
                                <span>Withdraw Payment Tokens</span>
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleWithdrawTokens(listing.id)}
                                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-lg py-2 flex items-center justify-center space-x-2 text-white transition-all"
                                disabled={buttonLoading[`withdrawTokens-${listing.id}`]}
                              >
                                {buttonLoading[`withdrawTokens-${listing.id}`] ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> : <ArrowUpCircle className="w-4 h-4" />}
                                <span>Withdraw Tokens</span>
                              </motion.button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
                {showDetailsModal && selectedDetailsListing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gradient-to-b from-gray-900 to-black rounded-xl p-4 max-w-md w-full max-h-[70vh] overflow-y-auto border border-white/10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-semibold text-primary-300">{selectedDetailsListing.token.name} Details</h3>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedDetailsListing(null);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex space-x-3">
                  <div className="flex-shrink-0">
                    {selectedDetailsListing.imageUrl && (
                      <img
                        src={selectedDetailsListing.imageUrl}
                        alt={selectedDetailsListing.token.name}
                        className="w-24 h-24 object-contain rounded-lg"
                        onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150')}
                      />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <h4 className="text-xs font-medium text-primary-200 mb-1">Social Links</h4>
                    <div className="flex space-x-2">
                      {selectedDetailsListing.projectWebsite && (
                        <a
                          href={selectedDetailsListing.projectWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-400 hover:text-primary-300"
                        >
                          <Globe className="w-4 h-4" />
                        </a>
                      )}
                      {selectedDetailsListing.socialMediaLink && (
                        <a
                          href={selectedDetailsListing.socialMediaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-400 hover:text-primary-300"
                        >
                          <Twitter className="w-4 h-4" />
                        </a>
                      )}
                      {selectedDetailsListing.telegramUrl && (
                        <a
                          href={selectedDetailsListing.telegramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-400 hover:text-primary-300"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 p-2 rounded-lg">
                  <h4 className="text-xs font-medium text-primary-200 mb-1">Token Information</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Name:</span>
                      <span className="text-primary-300">{selectedDetailsListing.token.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Symbol:</span>
                      <span className="text-primary-300">{selectedDetailsListing.token.symbol || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Available:</span>
                      <span className="text-primary-300">{parseFloat(selectedDetailsListing.token.amount).toFixed(2)} tokens</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Sold:</span>
                      <span className="text-primary-300">{parseFloat(selectedDetailsListing.token.soldAmount).toFixed(2)} tokens</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Initial Amount:</span>
                      <span className="text-primary-300">{parseFloat(selectedDetailsListing.initialAmount).toFixed(2)} {selectedDetailsListing.token.symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Price per Token:</span>
                      <span className="text-primary-300">{Number(selectedDetailsListing.token.pricePerShare).toFixed(8)} {selectedDetailsListing.paymentTokenSymbol || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">End Time:</span>
                      <span className="text-primary-300">{new Date(selectedDetailsListing.endTime * 1000).toLocaleString()}</span>
                    </div>
                    {selectedDetailsListing.lockedTokens && Number(selectedDetailsListing.lockedTokens) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Locked Tokens:</span>
                        <span className="text-primary-300">{parseFloat(selectedDetailsListing.lockedTokens).toFixed(2)} {selectedDetailsListing.token.symbol}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-white/5 p-2 rounded-lg">
                  <h4 className="text-xs font-medium text-primary-200 mb-1">Contract Addresses</h4>
                  <div className="space-y-1 text-xs">
                    <div>
                      <p className="text-[10px] text-gray-400 mb-0.5">Token Contract:</p>
                      <div className="flex items-center">
                        <p className="text-[10px] text-primary-300 truncate mr-1">{selectedDetailsListing.token.address || 'N/A'}</p>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => navigator.clipboard.writeText(selectedDetailsListing.token.address || '')}
                          className="text-gray-400 hover:text-white"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </motion.button>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-0.5">Marketplace Contract:</p>
                      <div className="flex items-center">
                        <p className="text-[10px] text-primary-300 truncate mr-1">{MARKETPLACE_ADDRESS || 'N/A'}</p>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => navigator.clipboard.writeText(MARKETPLACE_ADDRESS || '')}
                          className="text-gray-400 hover:text-white"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </motion.button>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-0.5">Seller Address:</p>
                      <div className="flex items-center">
                        <p className="text-[10px] text-primary-300 truncate mr-1">{selectedDetailsListing.seller || 'N/A'}</p>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => navigator.clipboard.writeText(selectedDetailsListing.seller || '')}
                          className="text-gray-400 hover:text-white"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 p-2 rounded-lg">
                  <h4 className="text-xs font-medium text-primary-200 mb-1">Project Description</h4>
                  <p className="text-gray-300 text-[10px] whitespace-pre-wrap max-h-20 overflow-y-auto">
                    {selectedDetailsListing.projectDescription || 'No description provided.'}
                  </p>
                </div>
                {selectedDetailsListing.referralActive && (
                  <div className="bg-purple-500/20 p-2 rounded-lg border border-purple-500/30">
                    <h4 className="text-xs font-medium text-purple-300 mb-1">Referral Program</h4>
                    <p className="text-gray-300 text-[10px] mb-1">
                      This listing offers a {selectedDetailsListing.referralPercent}% referral reward.
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setShowDetailsModal(false);
                        generateAndShareReferral(selectedDetailsListing);
                      }}
                      className="bg-purple-600 hover:bg-purple-700 transition-colors rounded-lg py-1 px-2 w-full flex items-center justify-center text-xs"
                    >
                      <Share2 className="w-3 h-3 mr-1" />
                      Share Referral Link
                    </motion.button>
                  </div>
                )}
                <div className="flex space-x-2 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-white/5 hover:bg-white/10 transition-colors rounded-lg py-1 text-xs"
                    onClick={() => {
                      setShowDetailsModal(false);
                      setSelectedDetailsListing(null);
                    }}
                  >
                    Close
                  </motion.button>
                  {selectedDetailsListing.isOwner && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setShowDetailsModal(false);
                        handleWithdrawUnsoldTokens(selectedDetailsListing.id);
                      }}
                      className="flex-1 bg-red-600 hover:bg-red-700 transition-colors rounded-lg py-1 flex items-center justify-center text-xs"
                      disabled={buttonLoading[`withdraw-${selectedDetailsListing.id}`] || getSoldPercentage(selectedDetailsListing) >= 85}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Withdraw Unsold Tokens
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showInfoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50"
            onClick={() => setShowInfoModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-8 max-w-md w-full shadow-2xl border border-primary-500/30"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-primary-300">{showInfoModal} Status</h3>
                <button onClick={() => setShowInfoModal(null)} className="text-primary-400 hover:text-primary-300">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-primary-200">
                {showInfoModal === 'Master'
                  ? 'This listing is fully sold out.'
                  : 'This listing has sold 85% or more of its tokens.'}
              </p>
            </motion.div>
          </motion.div>
        )}
        {popup && (
          <Popup
            type={popup.type}
            message={popup.message}
            onClose={() => setPopup(null)}
          />
        )}
      </motion.div>
    </motion.div>
  );
}