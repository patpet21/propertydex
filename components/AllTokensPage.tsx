import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Wallet, ShoppingCart, FileText, X, AlertCircle } from 'lucide-react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import ListToken from './ListToken';

const MARKETPLACE_ADDRESS = '0x338a419639cD3c2089DB55aDEA4b9c47739596f0';
const PRDX_TOKEN_ADDRESS = '0x61Dd008F1582631Aa68645fF92a1a5ECAedBeD19';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

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
  "function claimRefund(uint256 listingId) external",
  "function withdrawUnsoldTokens(uint256 listingId) external",
  "function claimPoolFunds(uint256 listingId) external",
  "function withdrawPaymentTokens(address paymentToken, uint256 amountRaw, address to) external",
  "function withdrawTokens(address tokenAddress, uint256 amountRaw, address to) external",
  "function claimTokens(uint256 listingId) external",
];

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function totalSupply() external view returns (uint256)",
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
    amount: string;
    amountRaw: bigint;
    pricePerShare: string;
    pricePerShareRaw: bigint;
    decimals: number;
    initialAmount: string;
    soldAmount: string;
    soldAmountRaw: bigint;
  };
  paymentToken: string;
  paymentTokenSymbol: string;
  paymentDecimals: number;
  active: boolean;
  isOwner: boolean;
  projectWebsite: string;
  socialMediaLink: string;
  imageUrl: string;
  websiteUrl: string;
  twitterUrl: string;
  telegramUrl: string;
  projectDescription: string;
  referralActive?: boolean;
  referralPercent?: number;
  referralCode?: string;
  endTime: number;
  initialAmountRaw: bigint;
  referralReserve: string;
}

interface MarketplaceProps {
  onClose: () => void;
}

interface ErrorModalProps {
  message: string;
  onClose: () => void;
}
async function getListings(signer: ethers.Signer): Promise<Listing[]> {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const listingCount = Number(await marketplace.listingCount());
    const listings: Listing[] = [];
    const userAddress = await signer.getAddress();

    for (let i = 0; i < listingCount; i++) {
      try {
        const [basicDetails, additionalDetails, metadata] = await Promise.all([
          marketplace.getListingBasicDetails(i),
          marketplace.getListingAdditionalDetails(i),
          marketplace.getListingMetadata(i),
        ]);

        const token = new ethers.Contract(basicDetails.tokenAddress, TOKEN_ABI, signer);
        const paymentToken = new ethers.Contract(basicDetails.paymentToken, TOKEN_ABI, signer);
        const [tokenDecimals, paymentDecimals] = await Promise.all([token.decimals(), paymentToken.decimals()]);

        const referralReserve = additionalDetails.referralActive
          ? ethers.formatUnits((additionalDetails.initialAmount * BigInt(additionalDetails.referralPercent)) / BigInt(100), tokenDecimals)
          : '0';

        listings.push({
          id: i,
          seller: basicDetails.seller,
          token: {
            address: basicDetails.tokenAddress,
            name: await token.name(),
            symbol: await token.symbol(),
            amount: ethers.formatUnits(basicDetails.amount, tokenDecimals),
            amountRaw: basicDetails.amount,
            pricePerShare: ethers.formatUnits(basicDetails.pricePerShare, paymentDecimals),
            pricePerShareRaw: basicDetails.pricePerShare,
            decimals: tokenDecimals,
            initialAmount: ethers.formatUnits(additionalDetails.initialAmount, tokenDecimals),
            soldAmount: ethers.formatUnits(basicDetails.soldAmount, tokenDecimals),
            soldAmountRaw: basicDetails.soldAmount,
          },
          paymentToken: basicDetails.paymentToken,
          paymentTokenSymbol: await paymentToken.symbol(),
          paymentDecimals,
          active: additionalDetails.active,
          isOwner: basicDetails.seller.toLowerCase() === userAddress.toLowerCase(),
          projectWebsite: metadata.projectWebsite,
          socialMediaLink: metadata.socialMediaLink,
          imageUrl: metadata.tokenImageUrl || 'https://via.placeholder.com/150',
          websiteUrl: metadata.projectWebsite,
          twitterUrl: metadata.socialMediaLink,
          telegramUrl: metadata.telegramUrl,
          projectDescription: metadata.projectDescription,
          referralActive: additionalDetails.referralActive,
          referralPercent: Number(additionalDetails.referralPercent),
          referralCode: ethers.hexlify(additionalDetails.referralCode),
          endTime: Number(additionalDetails.endTime),
          initialAmountRaw: additionalDetails.initialAmount,
          referralReserve,
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

async function buyTokens(listingId: number, amountRaw: bigint, signer: ethers.Signer, referralCode?: string) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const basicDetails = await marketplace.getListingBasicDetails(listingId);
    const additionalDetails = await marketplace.getListingAdditionalDetails(listingId);

    const paymentToken = new ethers.Contract(basicDetails.paymentToken, TOKEN_ABI, signer);
    const paymentDecimals = await paymentToken.decimals();
    const totalCostRaw = (BigInt(amountRaw) * BigInt(basicDetails.pricePerShare)) / BigInt(10 ** 18);

    const userAddress = await signer.getAddress();
    const paymentBalance = await paymentToken.balanceOf(userAddress);
    if (paymentBalance < totalCostRaw) throw new Error('Insufficient payment token balance');

    const allowance = await paymentToken.allowance(userAddress, MARKETPLACE_ADDRESS);
    if (allowance < totalCostRaw) {
      toast.loading('Approving payment token...', { id: 'approve' });
      const approveTx = await paymentToken.approve(MARKETPLACE_ADDRESS, ethers.MaxUint256);
      await approveTx.wait();
      toast.success('Approval completed!', { id: 'approve' });
    }

    const referralCodeBytes32 = referralCode
      ? referralCode.startsWith('0x')
        ? referralCode
        : ethers.formatBytes32String(referralCode)
      : ethers.ZeroHash;

    const gasEstimate = await marketplace.buyToken.estimateGas(listingId, amountRaw, referralCodeBytes32);
    const tx = await marketplace.buyToken(listingId, amountRaw, referralCodeBytes32, { gasLimit: gasEstimate * 120n / 100n });
    const receipt = await tx.wait();
    return receipt;
  } catch (error: any) {
    throw new Error(`Purchase failed: ${error.message}${error.reason ? ` - ${error.reason}` : ''}`);
  }
}

async function cancelListing(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const gasEstimate = await marketplace.cancelListing.estimateGas(listingId);
    const tx = await marketplace.cancelListing(listingId, { gasLimit: gasEstimate * 120n / 100n });
    return await tx.wait();
  } catch (error: any) {
    throw new Error(`Failed to cancel listing: ${error.message}`);
  }
}

async function generateBuyerReferralCode(listingId: number, signer: ethers.Signer): Promise<string> {
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
}

async function withdrawUnsoldTokens(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const gasEstimate = await marketplace.withdrawUnsoldTokens.estimateGas(listingId);
    const tx = await marketplace.withdrawUnsoldTokens(listingId, { gasLimit: gasEstimate * 120n / 100n });
    const receipt = await tx.wait();
    toast.success('Unsold tokens withdrawn successfully!');
    return receipt;
  } catch (error: any) {
    throw error;
  }
}

async function claimRefund(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const userAddress = await signer.getAddress();
    console.log(`Attempting claimRefund for listingId: ${listingId}, user: ${userAddress}`);
    const gasEstimate = await marketplace.claimRefund.estimateGas(listingId).catch((error: any) => {
      console.error('Gas estimation failed:', error);
      throw error;
    });
    const tx = await marketplace.claimRefund(listingId, { gasLimit: gasEstimate * 120n / 100n });
    const receipt = await tx.wait();
    toast.success('Refund claimed successfully!');
    return receipt;
  } catch (error: any) {
    throw error;
  }
}

async function claimTokens(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const userAddress = await signer.getAddress();
    console.log(`Attempting claimTokens for listingId: ${listingId}, user: ${userAddress}`);
    const gasEstimate = await marketplace.claimTokens.estimateGas(listingId).catch((error: any) => {
      console.error('Gas estimation failed:', error);
      throw error;
    });
    const tx = await marketplace.claimTokens(listingId, { gasLimit: gasEstimate * 120n / 100n });
    const receipt = await tx.wait();
    toast.success('Tokens claimed successfully!');
    return receipt;
  } catch (error: any) {
    throw error;
  }
}

async function claimPoolFunds(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const gasEstimate = await marketplace.claimPoolFunds.estimateGas(listingId);
    const tx = await marketplace.claimPoolFunds(listingId, { gasLimit: gasEstimate * 120n / 100n });
    const receipt = await tx.wait();
    toast.success('Pool funds claimed successfully!');
    return receipt;
  } catch (error: any) {
    throw error;
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

    toast.loading('Withdrawing payment tokens...', { id: `withdraw-payment-${listingId}` });
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
    toast.success('Payment tokens withdrawn successfully!', { id: `withdraw-payment-${listingId}` });
    return tx;
  } catch (error: any) {
    let errorMsg = error.message;
    if (error.message.includes('Invalid amount or insufficient balance')) {
      errorMsg = 'Failed to withdraw payment tokens: Insufficient balance or invalid amount.';
    } else if (error.message.includes('Cannot withdraw funds during owner withdraw period')) {
      errorMsg = 'Failed to withdraw payment tokens: Owner withdraw period not yet elapsed.';
    }
    toast.error(errorMsg, { id: `withdraw-payment-${listingId}` });
    throw new Error(errorMsg);
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

    toast.loading('Withdrawing tokens...', { id: `withdraw-tokens-${listingId}` });
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
    toast.success('Tokens withdrawn successfully!', { id: `withdraw-tokens-${listingId}` });
    return tx;
  } catch (error: any) {
    let errorMsg = error.message;
    if (error.message.includes('Invalid amount or insufficient balance')) {
      errorMsg = 'Failed to withdraw tokens: Insufficient balance or invalid amount.';
    } else if (error.message.includes('Cannot withdraw tokens during owner withdraw period')) {
      errorMsg = 'Failed to withdraw tokens: Owner withdraw period not yet elapsed.';
    }
    toast.error(errorMsg, { id: `withdraw-tokens-${listingId}` });
    throw new Error(errorMsg);
  }
}
const ErrorModal: React.FC<ErrorModalProps> = ({ message, onClose }) => {
  // Estrai il messaggio rilevante dall'errore
  const extractErrorMessage = (error: string) => {
    const match = error.match(/"message":"([^"]+)"/);
    if (match && match[1]) {
      if (match[1].includes("Listing has expired")) {
        return "This listing has expired. Please select an active listing to proceed.";
      }
      return match[1];
    }
    return error.includes("Listing has expired")
      ? "This listing has expired. Please select an active listing to proceed."
      : error;
  };

  const displayMessage = extractErrorMessage(message);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-gradient-to-b from-gray-900 to-black rounded-xl p-6 max-w-sm w-full border border-red-500/30 shadow-lg"
      >
        <div className="flex items-center mb-4">
          <AlertCircle className="w-6 h-6 text-red-400 mr-2" />
          <h3 className="text-lg font-semibold text-white">Error</h3>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="text-gray-300 text-sm mb-4">{displayMessage}</div>
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
};

const ConnectWalletModal: React.FC<{ onClose: () => void; onConnect: () => Promise<void> }> = ({ onClose, onConnect }) => {
  const handleConnect = async () => {
    try {
      if (window.ethereum) {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        await onConnect();
        toast.success('Wallet connected successfully!');
        onClose();
      } else {
        toast.error('Metamask not detected. Please install Metamask to continue.');
      }
    } catch (error: any) {
      toast.error(`Failed to connect wallet: ${error.message}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-gradient-to-b from-gray-900 to-black rounded-xl p-6 max-w-sm w-full border border-white/10 shadow-lg"
      >
        <div className="text-center">
          <Wallet className="w-12 h-12 text-primary-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h3>
          <p className="text-gray-300 mb-6">Connect your wallet to view listings and interact with the contract.</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleConnect}
            className="bg-primary-600 hover:bg-primary-700 transition-colors px-6 py-2 rounded-lg flex items-center mx-auto"
          >
            <Wallet className="w-5 h-5 mr-2" />
            Connect Wallet
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="mt-4 text-sm text-gray-400 hover:text-white"
          >
            Close
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function Marketplace({ onClose }: MarketplaceProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [showConnectWalletModal, setShowConnectWalletModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDetailsListing, setSelectedDetailsListing] = useState<Listing | null>(null);
  const [showListTokenModal, setShowListTokenModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showProjectDescriptionModal, setShowProjectDescriptionModal] = useState(false);
  const [selectedProjectDescription, setSelectedProjectDescription] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const initializeWallet = useCallback(async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.BrowserProvider(window.ethereum);
        const newSigner = await provider.getSigner();
        setSigner(newSigner);
        setIsInitialized(true);
      } catch (error) {
        setShowConnectWalletModal(true);
        setIsInitialized(true);
      }
    } else {
      setShowConnectWalletModal(true);
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) {
      initializeWallet();
    }
  }, [isInitialized, initializeWallet]);

  useEffect(() => {
    if (signer && isInitialized) {
      loadListings();
      const interval = setInterval(loadListings, 60000);
      return () => clearInterval(interval);
    }
  }, [signer, isInitialized]);

  useEffect(() => {
    const filtered = listings.filter(
      (listing) =>
        listing.token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listing.token.address.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredListings(filtered);
  }, [searchTerm, listings]);

  const loadListings = async () => {
    if (!signer) return;
    setLoading(true);
    try {
      const allListings = await getListings(signer);
      const currentTime = Math.floor(Date.now() / 1000);
      const activeListings = allListings.filter(
        (listing) => listing.active && listing.endTime > currentTime && parseFloat(listing.token.amount) > 0
      );
      const expiredListings = allListings.filter(
        (listing) => !listing.active || (listing.endTime <= currentTime && parseFloat(listing.token.amount) >= 0)
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
      setShowConnectWalletModal(true);
      return;
    }
    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      setErrorMessage('Enter a valid amount');
      return;
    }

    // Controllo se il listing è scaduto
    const currentTime = Math.floor(Date.now() / 1000);
    if (!listing.active || listing.endTime <= currentTime) {
      setErrorMessage('Listing has expired');
      return;
    }

    // Controllo se ci sono abbastanza token disponibili
    const amountToBuy = parseFloat(buyAmount);
    const availableAmount = parseFloat(listing.token.amount);
    if (amountToBuy > availableAmount) {
      setErrorMessage('Not enough tokens available for purchase.');
      return;
    }

    try {
      setLoading(true);
      const amountRaw = ethers.parseUnits(buyAmount, listing.token.decimals);
      await buyTokens(listing.id, amountRaw, signer, referralCode);
      toast.success('Purchase completed successfully!');
      await loadListings();
      setSelectedListing(null);
      setBuyAmount('');
      setReferralCode('');
    } catch (error: any) {
      setErrorMessage(`Purchase failed: ${error.message}${error.reason ? ` - ${error.reason}` : ''}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (listingId: number) => {
    if (!signer) {
      setErrorMessage('Connect your wallet to cancel the listing.');
      setShowConnectWalletModal(true);
      return;
    }
    try {
      setLoading(true);
      await cancelListing(listingId, signer);
      toast.success('Listing canceled successfully!');
      await loadListings();
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const openDetailsModal = (listing: Listing) => {
    if (!signer) {
      setErrorMessage('Connect your wallet to view details.');
      setShowConnectWalletModal(true);
      return;
    }
    setSelectedDetailsListing(listing);
    setShowDetailsModal(true);
  };

  const openProjectDescriptionModal = (description: string) => {
    setSelectedProjectDescription(description);
    setShowProjectDescriptionModal(true);
  };

  const calculatePercentageSold = (listing: Listing) => {
    const available = parseFloat(listing.token.initialAmount) - parseFloat(listing.referralReserve);
    const sold = parseFloat(listing.token.soldAmount);
    return available > 0 ? Math.min((sold / available) * 100, 100) : 0;
  };

  const calculateFundsRaised = (listing: Listing) => {
    const soldAmount = parseFloat(listing.token.soldAmount);
    const pricePerShare = parseFloat(listing.token.pricePerShare);
    return (soldAmount * pricePerShare).toFixed(6);
  };

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getWithdrawalDeadline = (endTime: number) => {
    const withdrawalPeriod = 30 * 24 * 3600; // 30 days in seconds
    const currentTime = Math.floor(Date.now() / 1000);
    const deadline = endTime + withdrawalPeriod;
    const timeLeft = deadline - currentTime;
    if (timeLeft <= 0) return "Expired";
    const days = Math.floor(timeLeft / (24 * 3600));
    const hours = Math.floor((timeLeft % (24 * 3600)) / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (!isInitialized) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-gray-400">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-gray-800 rounded-xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Token Listings</h2>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-lg text-sm transition-colors duration-200"
          >
            Close
          </motion.button>
        </div>

        <div className="mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by token name or contract address"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {showConnectWalletModal && !signer && (
          <ConnectWalletModal
            onClose={() => setShowConnectWalletModal(false)}
            onConnect={async () => {
              const provider = new ethers.BrowserProvider(window.ethereum);
              const newSigner = await provider.getSigner();
              setSigner(newSigner);
              await loadListings();
            }}
          />
        )}

        {loading && signer ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading tokens...</p>
          </div>
        ) : !signer ? (
          <div className="text-center py-8">
            <p className="text-gray-400">Please connect your wallet to view listings.</p>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-semibold text-white mb-4">Active Listings</h3>
            {filteredListings.length === 0 ? (
              <p className="text-gray-400 text-center mb-6">No listings match your search</p>
            ) : (
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm text-white">
                  <thead>
                    <tr className="bg-gray-900">
                      <th className="px-4 py-2 text-left">Token</th>
                      <th className="px-4 py-2 text-right">Sold (%)</th>
                      <th className="px-4 py-2 text-right">Tokens Sold</th>
                      <th className="px-4 py-2 text-right">Funds Raised</th>
                      <th className="px-4 py-2 text-right">Price</th>
                      <th className="px-4 py-2 text-right">End Time</th>
                      <th className="px-4 py-2 text-right">Withdrawal Deadline</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredListings.map((listing) => (
                      <tr key={listing.id} className="border-b border-gray-700 hover:bg-gray-700">
                        <td className="px-4 py-2 flex items-center">
                          <img src={listing.imageUrl} alt={listing.token.name} className="w-6 h-6 rounded-full mr-2" />
                          <span>{listing.token.name} ({listing.token.symbol})</span>
                        </td>
                        <td className="px-4 py-2 text-right">{calculatePercentageSold(listing).toFixed(2)}%</td>
                        <td className="px-4 py-2 text-right">{parseFloat(listing.token.soldAmount).toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">{calculateFundsRaised(listing)} {listing.paymentTokenSymbol}</td>
                        <td className="px-4 py-2 text-right">{parseFloat(listing.token.pricePerShare).toFixed(6)} {listing.paymentTokenSymbol}</td>
                        <td className="px-4 py-2 text-right">{formatDateTime(listing.endTime)}</td>
                        <td className="px-4 py-2 text-right">{getWithdrawalDeadline(listing.endTime)}</td>
                        <td className="px-4 py-2 text-right flex space-x-2 justify-end">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setSelectedListing(listing)}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-2 py-1 rounded"
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => openDetailsModal(listing)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
                          >
                            <FileText className="w-4 h-4" />
                          </motion.button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {showListTokenModal && signer && (
          <ListToken
            onClose={() => setShowListTokenModal(false)}
            signer={signer}
            onSuccess={handleSuccess}
          />
        )}

        {selectedListing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gradient-to-b from-gray-900 to-black rounded-xl p-6 max-w-md w-full border border-white/10 shadow-lg"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Buy {selectedListing.token.name} Tokens</h3>
                <button
                  onClick={() => {
                    setSelectedListing(null);
                    setBuyAmount('');
                  }}
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
                    max={parseFloat(selectedListing.token.amount)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    placeholder="Enter amount"
                  />
                </div>
                <div className="bg-white/5 p-3 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Price per Token:</span>
                    <span className="font-medium">{parseFloat(selectedListing.token.pricePerShare).toFixed(8)} {selectedListing.paymentTokenSymbol}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Available:</span>
                    <span className="font-medium">{parseFloat(selectedListing.token.amount).toFixed(6)} tokens</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-gray-400">Total Cost:</span>
                    <span className="font-medium text-primary-300">
                      {buyAmount
                        ? `${(parseFloat(buyAmount) * parseFloat(selectedListing.token.pricePerShare)).toFixed(8)} ${selectedListing.paymentTokenSymbol}`
                        : '-'}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-4 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-white/5 hover:bg-white/10 transition-colors rounded-lg py-2"
                    onClick={() => {
                      setSelectedListing(null);
                      setBuyAmount('');
                    }}
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

        {showDetailsModal && selectedDetailsListing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gradient-to-b from-gray-900 to-black rounded-xl p-6 max-w-2xl w-full border border-white/10 shadow-lg"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">{selectedDetailsListing.token.name} Details</h3>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedDetailsListing(null);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  {selectedDetailsListing.imageUrl && (
                    <img
                      src={selectedDetailsListing.imageUrl}
                      alt={selectedDetailsListing.token.name}
                      className="w-full h-48 object-cover rounded-lg mb-4"
                      onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150')}
                    />
                  )}
                  <div className="bg-white/5 p-4 rounded-lg mb-4">
                    <h4 className="text-lg font-medium mb-2">Token Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Name:</span>
                        <span>{selectedDetailsListing.token.name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Symbol:</span>
                        <span>{selectedDetailsListing.token.symbol || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Initial Amount:</span>
                        <span>{parseFloat(selectedDetailsListing.token.initialAmount).toFixed(2)} tokens</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Tokens Sold:</span>
                        <span>{parseFloat(selectedDetailsListing.token.soldAmount).toFixed(2)} tokens</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Remaining Tokens:</span>
                        <span>{parseFloat(selectedDetailsListing.token.amount).toFixed(2)} tokens</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Funds Raised:</span>
                        <span>{calculateFundsRaised(selectedDetailsListing)} {selectedDetailsListing.paymentTokenSymbol}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Price per Token:</span>
                        <span>{parseFloat(selectedDetailsListing.token.pricePerShare).toFixed(8)} {selectedDetailsListing.paymentTokenSymbol || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-lg">
                    <h4 className="text-lg font-medium mb-2">Project Description</h4>
                    {selectedDetailsListing.projectDescription.split('\n').slice(0, 2).join('\n').length > 0 ? (
                      <p className="text-gray-300 text-sm whitespace-pre-wrap">
                        {selectedDetailsListing.projectDescription.split('\n').slice(0, 2).join('\n')}
                        {selectedDetailsListing.projectDescription.split('\n').length > 2 && (
                          <button
                            onClick={() => openProjectDescriptionModal(selectedDetailsListing.projectDescription)}
                            className="text-primary-400 hover:text-primary-300 text-xs ml-1"
                          >
                            ... Read More
                          </button>
                        )}
                      </p>
                    ) : (
                      <p className="text-gray-300 text-sm whitespace-pre-wrap">No description provided.</p>
                    )}
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg">
                    <h4 className="text-lg font-medium mb-2">Links</h4>
                    <div className="flex space-x-4">
                      {selectedDetailsListing.websiteUrl && (
                        <a
                          href={selectedDetailsListing.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-400 hover:text-primary-300"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </a>
                      )}
                      {selectedDetailsListing.twitterUrl && (
                        <a
                          href={selectedDetailsListing.twitterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-400 hover:text-primary-300"
                        >
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482A13.87 13.87 0 011.67 3.899a4.924 4.924 0 001.518 6.573 4.903 4.903 0 01-2.228-.616v.061a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.868 9.868 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                          </svg>
                        </a>
                      )}
                      {selectedDetailsListing.telegramUrl && (
                        <a
                          href={selectedDetailsListing.telegramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-400 hover:text-primary-300"
                        >
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0011.944-12A12 12 0 0012 0h-.056zm4.913 6.455l-7.43 12.123a.807.807 0 01-1.21.393L6.056 15.85l-2.297-1.06a.807.807 0 01-.26-1.21l13.313-10.1a.803.803 0 011.21.262l1.79 3.754z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-4 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 bg-white/5 hover:bg-white/10 transition-colors rounded-lg py-2"
                      onClick={() => {
                        setShowDetailsModal(false);
                        setSelectedDetailsListing(null);
                      }}
                    >
                      Close
                    </motion.button>
                    {!selectedDetailsListing.isOwner && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 bg-primary-600 hover:bg-primary-700 transition-colors rounded-lg py-2 flex items-center justify-center"
                        onClick={() => {
                          setShowDetailsModal(false);
                          setSelectedListing(selectedDetailsListing);
                        }}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Buy Tokens
                      </motion.button>
                    )}
                    {selectedDetailsListing.isOwner && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setShowDetailsModal(false);
                          handleCancel(selectedDetailsListing.id);
                        }}
                        className="flex-1 bg-red-600 hover:bg-red-700 transition-colors rounded-md py-2 flex items-center justify-center"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel Listing
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showProjectDescriptionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gradient-to-b from-gray-900 to-black rounded-xl p-6 max-w-md w-full h-[80vh] border border-white/10 shadow-lg overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Project Description</h3>
                <button
                  onClick={() => setShowProjectDescriptionModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4 text-gray-300">
                <p className="text-sm whitespace-pre-wrap">
                  {selectedProjectDescription || 'No description provided.'}
                </p>
              </div>
              <div className="flex justify-end mt-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowProjectDescriptionModal(false)}
                  className="bg-primary-600 hover:bg-primary-700 transition-colors rounded-lg py-2 px-6"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showListTokenModal && signer && (
          <ListToken
            onClose={() => setShowListTokenModal(false)}
            signer={signer}
            onSuccess={handleSuccess}
          />
        )}

        {errorMessage && (
          <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />
        )}
      </motion.div>
    </motion.div>
  );
}