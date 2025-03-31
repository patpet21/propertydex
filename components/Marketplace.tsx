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
  Gift,
  Share2,
  FileText,
  Lock,
  GraduationCap,
} from 'lucide-react';
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
  signer: ethers.Signer | null;
}

interface ErrorModalProps {
  message: string;
  onClose: () => void;
}

async function getListings(signer: ethers.Signer) {
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
        console.log(`Metadati del listing ${i}:`, metadata);

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
          imageUrl: metadata.tokenImageUrl || 'https://placehold.co/150x150',
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
    const gasEstimate = await marketplace.claimRefund.estimateGas(listingId); // Correzione qui
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
    const gasEstimate = await marketplace.claimTokens.estimateGas(listingId);
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
    if (availableBalance === 0n) throw new Error('No payment tokens available to withdraw.');
    const amountRaw = availableBalance;

    toast.loading('Withdrawing payment tokens...', { id: `withdraw-payment-${listingId}` });
    const gasEstimate = await marketplace.withdrawPaymentTokens.estimateGas(basicDetails.paymentToken, amountRaw, await signer.getAddress());
    const tx = await marketplace.withdrawPaymentTokens(basicDetails.paymentToken, amountRaw, await signer.getAddress(), { gasLimit: gasEstimate * 120n / 100n });
    await tx.wait();
    toast.success('Payment tokens withdrawn successfully!', { id: `withdraw-payment-${listingId}` });
    return tx;
  } catch (error: any) {
    toast.error(error.message, { id: `withdraw-payment-${listingId}` });
    throw new Error(error.message);
  }
}

async function withdrawTokens(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const basicDetails = await marketplace.getListingBasicDetails(listingId);
    const token = new ethers.Contract(basicDetails.tokenAddress, TOKEN_ABI, signer);
    const availableBalance = await token.balanceOf(MARKETPLACE_ADDRESS);
    if (availableBalance === 0n) throw new Error('No tokens available to withdraw.');
    const amountRaw = availableBalance;

    toast.loading('Withdrawing tokens...', { id: `withdraw-tokens-${listingId}` });
    const gasEstimate = await marketplace.withdrawTokens.estimateGas(basicDetails.tokenAddress, amountRaw, await signer.getAddress());
    const tx = await marketplace.withdrawTokens(basicDetails.tokenAddress, amountRaw, await signer.getAddress(), { gasLimit: gasEstimate * 120n / 100n });
    await tx.wait();
    toast.success('Tokens withdrawn successfully!', { id: `withdraw-tokens-${listingId}` });
    return tx;
  } catch (error: any) {
    toast.error(error.message, { id: `withdraw-tokens-${listingId}` });
    throw new Error(error.message);
  }
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
      <div className="text-gray-200 text-sm">{message}</div>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClose}
        className="w-full bg-red-600 hover:bg-red-700 transition-colors rounded-lg py-2 text-white font-medium mt-4"
      >
        Close
      </motion.button>
    </motion.div>
  </motion.div>
);

export default function Marketplace({ onClose, signer }: MarketplaceProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [soldTokenListings, setSoldTokenListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'price' | 'name'>('price');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [copiedLinkId, setCopiedLinkId] = useState<number | null>(null);
  const [showReferralInfo, setShowReferralInfo] = useState<number | null>(null);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [selectedReferralListing, setSelectedReferralListing] = useState<Listing | null>(null);
  const [referralLink, setReferralLink] = useState('');
  const [isReferralPurchase, setIsReferralPurchase] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDetailsListing, setSelectedDetailsListing] = useState<Listing | null>(null);
  const [autoShowBuyModal, setAutoShowBuyModal] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [referralCodes, setReferralCodes] = useState<{ [listingId: number]: string }>({});
  const [showListTokenModal, setShowListTokenModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showGraduatedMasterInfo, setShowGraduatedMasterInfo] = useState<{
    visible: boolean;
    listingId: number;
    type: 'Graduated' | 'Master';
  }>({ visible: false, listingId: -1, type: 'Graduated' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showProjectDescriptionModal, setShowProjectDescriptionModal] = useState(false);
  const [selectedProjectDescription, setSelectedProjectDescription] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'soldtoken'>('active');

  const toggleBodyScroll = (enable: boolean) => {
    document.body.style.overflow = enable ? 'hidden' : 'auto';
  };
    useEffect(() => {
    if (signer) {
      const initialize = async () => {
        try {
          const addr = await signer.getAddress();
          setWalletAddress(addr.toLowerCase());
          const savedCodes = localStorage.getItem(`referralCodes_${addr.toLowerCase()}`);
          setReferralCodes(savedCodes ? JSON.parse(savedCodes) : {});
          await loadListings();

          const urlParams = new URLSearchParams(window.location.search);
          const listingId = urlParams.get('listingId');
          const referral = urlParams.get('referral');

          if (listingId && referral) {
            setReferralCode(referral);
            setIsReferralPurchase(true);
            setAutoShowBuyModal(true);
          }
        } catch (error) {
          setErrorMessage('Error initializing Marketplace');
        }
      };
      initialize();

      let isLoadingListings = false;
      const interval = setInterval(async () => {
        if (!isLoadingListings && !showDetailsModal && !selectedListing && !showReferralModal && !showProjectDescriptionModal && !showListTokenModal && !showInfoModal) {
          isLoadingListings = true;
          try {
            await loadListings();
          } catch (error: any) {
            setErrorMessage(`Failed to refresh listings: ${error.message}`);
          } finally {
            isLoadingListings = false;
          }
        }
      }, 240000);
      return () => clearInterval(interval);
    }
  }, [signer]);

  useEffect(() => {
    const isAnyModalOpen = showDetailsModal || selectedListing || showReferralModal || showProjectDescriptionModal || showListTokenModal || showInfoModal;
    if (isAnyModalOpen) {
      toggleBodyScroll(true);
      window.scrollTo(0, 0);
    } else {
      toggleBodyScroll(false);
    }
    return () => toggleBodyScroll(false);
  }, [showDetailsModal, selectedListing, showReferralModal, showProjectDescriptionModal, showListTokenModal, showInfoModal]);

  const loadListings = async () => {
    if (!signer) return;
    setLoading(true);
    try {
      const allListings = await getListings(signer);
      const currentTime = Math.floor(Date.now() / 1000);
      const activeListings = allListings.filter(
        (listing) => listing.active && listing.endTime > currentTime && parseFloat(listing.token.amount) > 0
      );
      const soldTokenListings = allListings.filter(
        (listing) => !listing.active || listing.endTime <= currentTime
      );
      setListings(activeListings);
      setSoldTokenListings(soldTokenListings);

      const urlParams = new URLSearchParams(window.location.search);
      const listingId = urlParams.get('listingId');
      if (listingId && autoShowBuyModal) {
        const listing = activeListings.find((l) => l.id === Number(listingId));
        if (listing) setSelectedListing(listing);
      }
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
      await buyTokens(listing.id, amountRaw, signer, referralCode);
      toast.success('Purchase completed successfully!');
      await loadListings();
      setSelectedListing(null);
      setBuyAmount('');
      setReferralCode('');
      setIsReferralPurchase(false);
      setAutoShowBuyModal(false);
    } catch (error: any) {
      setErrorMessage(`Purchase failed: ${error.message}${error.reason ? ` - ${error.reason}` : ''}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (listingId: number) => {
    if (!signer) {
      setErrorMessage('Connect your wallet to cancel the listing.');
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

  const handleWithdrawUnsoldTokens = async (listingId: number) => {
    if (!signer) {
      setErrorMessage('Connect your wallet to withdraw unsold tokens.');
      return;
    }
    try {
      setLoading(true);
      await withdrawUnsoldTokens(listingId, signer);
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

  const handleClaimPoolFunds = async (listingId: number) => {
    if (!signer) {
      setErrorMessage('Connect your wallet to claim pool funds.');
      return;
    }
    try {
      setLoading(true);
      await claimPoolFunds(listingId, signer);
      await loadListings();
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawPaymentTokens = async (listingId: number) => {
    if (!signer) {
      setErrorMessage('Connect your wallet to withdraw payment tokens.');
      return;
    }
    try {
      setLoading(true);
      await withdrawPaymentTokens(listingId, signer);
      await loadListings();
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawTokens = async (listingId: number) => {
    if (!signer) {
      setErrorMessage('Connect your wallet to withdraw tokens.');
      return;
    }
    try {
      setLoading(true);
      await withdrawTokens(listingId, signer);
      await loadListings();
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = async (listing: Listing) => {
    if (!signer) {
      setErrorMessage('Connect your wallet to copy the referral link.');
      return;
    }
    try {
      const baseUrl = window.location.origin;
      const link = `${baseUrl}?listingId=${listing.id}&referral=${listing.referralCode}`;
      await navigator.clipboard.writeText(link);
      setCopiedLinkId(listing.id);
      toast.success('Referral link copied!');
      setTimeout(() => setCopiedLinkId(null), 3000);
    } catch (error) {
      setErrorMessage('Error copying referral link');
    }
  };

  const generateAndShareReferral = async (listing: Listing) => {
    if (!signer || !walletAddress) {
      setErrorMessage('Connect your wallet to generate a referral link.');
      return;
    }
    try {
      let code = referralCodes[listing.id];
      if (!code) {
        toast.loading(`Generating referral code for listing ${listing.id}...`, { id: `ref-${listing.id}` });
        code = await generateBuyerReferralCode(listing.id, signer);
        const newReferralCodes = { ...referralCodes, [listing.id]: code };
        const limitedReferralCodes = Object.keys(newReferralCodes).slice(-50).reduce((acc, key) => {
          acc[key] = newReferralCodes[key];
          return acc;
        }, {});
        setReferralCodes(limitedReferralCodes);
        try {
          localStorage.setItem(`referralCodes_${walletAddress}`, JSON.stringify(limitedReferralCodes));
        } catch (storageError) {
          console.warn('Failed to save referral codes to localStorage:', storageError);
          toast.info('Referral code generated, but could not save to localStorage due to quota limits.');
        }
        toast.success(`Referral code generated!`, { id: `ref-${listing.id}` });
      }
      const baseUrl = window.location.origin;
      const link = `${baseUrl}?listingId=${listing.id}&referral=${code}`;
      setReferralLink(link);
      setSelectedReferralListing(listing);
      setShowReferralModal(true);
    } catch (error) {
      setErrorMessage('Error generating referral link');
    }
  };

  const toggleReferralInfo = (listingId: number) => {
    if (!signer) {
      setErrorMessage('Connect your wallet to view referral info.');
      return;
    }
    setShowReferralInfo(showReferralInfo === listingId ? null : listingId);
  };

  const copyToClipboard = async (text: string, message: string = 'Copied to clipboard!') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch (error) {
      setErrorMessage('Error copying to clipboard');
    }
  };

  const getTimeRemaining = (endTime: number) => {
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = endTime - now;
    if (timeLeft <= 0) {
      const refundDeadline = endTime + 30 * 24 * 3600;
      const refundTimeLeft = refundDeadline - now;
      return refundTimeLeft > 0 ? `${Math.floor(refundTimeLeft / (24 * 3600))}d ${Math.floor((refundTimeLeft % (24 * 3600)) / 3600)}h ${Math.floor((refundTimeLeft % 3600) / 60)}m` : "Expired";
    }
    const days = Math.floor(timeLeft / (24 * 3600));
    const hours = Math.floor((timeLeft % (24 * 3600)) / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const canWithdrawAfterDelay = (endTime: number) => {
    const delayInMinutes = 22;
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime > endTime + (delayInMinutes * 60);
  };

  const calculatePercentageSold = (listing: Listing) => {
    const available = parseFloat(listing.token.initialAmount) - parseFloat(listing.referralReserve);
    const sold = parseFloat(listing.token.soldAmount);
    return available > 0 ? Math.min((sold / available) * 100, 100) : 0;
  };

  const filteredListings = (activeTab === 'active' ? listings : soldTokenListings).filter((listing) => {
    const query = searchQuery.toLowerCase();
    return (
      listing.token.name.toLowerCase().includes(query) ||
      listing.token.address.toLowerCase().includes(query)
    );
  });

  const sortedListings = [...filteredListings].sort((a, b) => {
    if (sortBy === 'price') {
      const priceA = parseFloat(a.token.pricePerShare);
      const priceB = parseFloat(b.token.pricePerShare);
      return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
    } else {
      return sortOrder === 'asc'
        ? a.token.name.localeCompare(b.token.name)
        : b.token.name.localeCompare(a.token.name);
    }
  });

  const openProjectDescriptionModal = (description: string) => {
    setSelectedProjectDescription(description);
    setShowProjectDescriptionModal(true);
  };

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
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
  <h2 className="text-2xl font-bold text-center sm:text-left">Token Marketplace</h2>
  <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
    <select
      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm w-full sm:w-auto"
      value={sortBy}
      onChange={(e) => setSortBy(e.target.value as 'price' | 'name')}
    >
      <option value="price">Sort by Price</option>
      <option value="name">Sort by Name</option>
    </select>
    <input
      type="text"
      placeholder="Search by token name or address"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm w-full sm:w-64"
    />
    <button
      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm w-full sm:w-auto"
    >
      {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
    </button>
    <button
      onClick={() => setShowListTokenModal(true)}
      className="bg-primary-600 hover:bg-primary-700 transition-colors rounded-lg px-4 py-2 text-sm w-full sm:w-auto"
    >
      List New Token
    </button>
    <button onClick={onClose} className="text-gray-400 hover:text-white sm:absolute sm:top-4 sm:right-4">
      <X className="w-6 h-6" />
    </button>
  </div>
</div>

        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-lg ${activeTab === 'active' ? 'bg-primary-600 text-white' : 'bg-white/5 text-gray-400'} hover:bg-primary-700 transition-colors`}
          >
            Active Listings
          </button>
          <button
            onClick={() => setActiveTab('soldtoken')}
            className={`px-4 py-2 rounded-lg ${activeTab === 'soldtoken' ? 'bg-primary-600 text-white' : 'bg-white/5 text-gray-400'} hover:bg-primary-700 transition-colors`}
          >
            Sold/Expired Tokens
          </button>
        </div>

        {isReferralPurchase && signer && (
          <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg p-4 mb-6 shadow-lg">
            <div className="flex items-center">
              <Gift className="w-8 h-8 text-white mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-white">Using a Referral Link!</h3>
                <p className="text-purple-100">
                  You are about to purchase tokens via a referral link. The referrer will receive a reward upon completion.
                </p>
              </div>
            </div>
          </div>
        )}

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
            const isMaster = percentageSold === 100;
            const refundDeadline = listing.endTime + 30 * 24 * 3600;
            const isRefundable = !isMaster && isExpired && Math.floor(Date.now() / 1000) <= refundDeadline;
            const isClaimable = isExpired && (percentageSold >= 85 || percentageSold === 100);
            const isOwner = walletAddress.toLowerCase() === listing.seller.toLowerCase();
            const isMarketplaceOwner = walletAddress.toLowerCase() === '0x7fDECF16574bd21Fd5cce60B701D01A6F83826ab'.toLowerCase();
            const canOwnerWithdraw = isExpired && canWithdrawAfterDelay(listing.endTime) && isMarketplaceOwner;
        
            return (
              <div
                key={listing.id}
                className="bg-white/5 rounded-lg overflow-hidden group hover:bg-white/10 transition-all border border-white/10 hover:border-primary-500"
              >
                {listing.imageUrl && (
                  <div className="relative overflow-hidden">
                    {console.log(`Listing ${listing.id} imageUrl:`, listing.imageUrl)}
                    <img
                      src={listing.imageUrl}
                      alt={listing.token.name}
                      className="w-full h-24 sm:h-32 object-cover transform group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => (e.currentTarget.src = 'https://placehold.co/150x150')}
                      crossOrigin="anonymous"
                    />
                    <div className="absolute top-1 sm:top-2 left-1 sm:left-2 flex flex-col gap-1">
                      {isExpired && (
                        <span className="bg-red-600 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium shadow-md flex items-center">
                          Expired
                        </span>
                      )}
                      {percentageSold >= 85 && !isMaster && (
                        <div className="flex items-center">
                          <span className="bg-green-600 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium shadow-md flex items-center">
                            <GraduationCap className="w-2.5 sm:w-3 h-2.5 sm:h-3 mr-1" /> Graduated
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowGraduatedMasterInfo({ visible: true, listingId: listing.id, type: 'Graduated' });
                            }}
                            className="bg-green-700 text-white rounded-full p-0.5 ml-1 shadow-md hover:bg-green-500 transition-colors"
                          >
                            <Info className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                          </button>
                        </div>
                      )}
                      {isMaster && (
                        <div className="flex items-center">
                          <span className="bg-green-600 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium shadow-md flex items-center">
                            <GraduationCap className="w-2.5 sm:w-3 h-2.5 sm:h-3 mr-1" /> Master
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowGraduatedMasterInfo({ visible: true, listingId: listing.id, type: 'Master' });
                            }}
                            className="bg-green-700 text-white rounded-full p-0.5 ml-1 shadow-md hover:bg-green-500 transition-colors"
                          >
                            <Info className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                          </button>
                        </div>
                      )}
                      {listing.referralActive && signer && (
                        <div className="flex items-center">
                          <span className="bg-purple-600 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium shadow-md">
                            {listing.referralPercent}% Referral
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleReferralInfo(listing.id);
                            }}
                            className="bg-purple-700 text-white rounded-full p-0.5 ml-1 shadow-md hover:bg-purple-500 transition-colors"
                          >
                            <Info className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                          </button>
                        </div>
                      )}
                      {isOwner && signer && (
                        <span className="bg-primary-600 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium shadow-md">
                          Your Listing
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div className="p-2 sm:p-3 space-y-2 sm:space-y-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold">{listing.token.name}</h3>
                    <p className="text-[10px] sm:text-xs text-gray-400">{listing.token.symbol}</p>
                  </div>
        
                  {showReferralInfo === listing.id && listing.referralActive && signer && (
                    <div className="bg-purple-500/20 p-1.5 sm:p-2 rounded-md border border-purple-500/30">
                      <p className="text-[10px] sm:text-xs text-purple-300 mb-1">
                        <span className="font-semibold">Referral:</span> {listing.referralPercent}% of tokens
                      </p>
                      <button
                        onClick={() => generateAndShareReferral(listing)}
                        className="w-full bg-purple-600 hover:bg-purple-700 transition-colors rounded-md py-1 text-[10px] sm:text-xs"
                      >
                        Share Referral Link
                      </button>
                    </div>
                  )}
        
                  {listing.projectDescription && (
                    <div className="bg-white/5 p-1.5 sm:p-2 rounded-lg">
                      {listing.projectDescription.split('\n').slice(0, 2).join('\n').length > 0 ? (
                        <p className="text-[10px] sm:text-xs text-gray-300 line-clamp-2">
                          {listing.projectDescription.split('\n').slice(0, 2).join('\n')}
                          {listing.projectDescription.split('\n').length > 2 && (
                            <button
                              onClick={() => openProjectDescriptionModal(listing.projectDescription)}
                              className="text-primary-400 hover:text-primary-300 text-[10px] sm:text-xs ml-1"
                            >
                              ... Read More
                            </button>
                          )}
                        </p>
                      ) : (
                        <p className="text-[10px] sm:text-xs text-gray-300">No description provided.</p>
                      )}
                    </div>
                  )}
        
                  <div className="space-y-1 text-[10px] sm:text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Available:</span>
                      <span>{parseFloat(listing.token.amount).toFixed(2)} tokens</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 sm:h-2.5">
                      <div
                        className="bg-green-600 h-2 sm:h-2.5 rounded-full"
                        style={{ width: `${Math.min(percentageSold, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Sold:</span>
                      <span>{percentageSold.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Price:</span>
                      <span>{listing.token.pricePerShare} {listing.paymentTokenSymbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">End Time:</span>
                      <span>{new Date(listing.endTime * 1000).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Withdrawal Deadline:</span>
                      <span>{getTimeRemaining(listing.endTime)}</span>
                    </div>
                  </div>
        
                  <div className="flex flex-wrap gap-1">
                    {listing.websiteUrl && (
                      <a href={listing.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300">
                        <Globe className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                      </a>
                    )}
                    {listing.twitterUrl && (
                      <a href={listing.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300">
                        <Twitter className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                      </a>
                    )}
                    {listing.telegramUrl && (
                      <a href={listing.telegramUrl} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300">
                        <MessageCircle className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (!signer) {
                          setErrorMessage('Connect your wallet to view details.');
                          return;
                        }
                        setSelectedDetailsListing(listing);
                        setShowDetailsModal(true);
                      }}
                      className="bg-primary-600/30 hover:bg-primary-600/50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs"
                      disabled={!signer}
                    >
                      View Details
                    </button>
                  </div>
        
                  {signer && (
                    <div className="space-y-1 sm:space-y-2">
                      {isOwner && (
                        <>
                          {!isExpired && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleCancel(listing.id)}
                              className="w-full bg-red-600 hover:bg-red-700 transition-colors rounded-md py-1 sm:py-1.5 text-[10px] sm:text-xs"
                            >
                              Cancel Listing
                            </motion.button>
                          )}
                          {isExpired && percentageSold < 85 && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleWithdrawUnsoldTokens(listing.id)}
                              className="w-full bg-yellow-600 hover:bg-yellow-700 transition-colors rounded-md py-1 sm:py-1.5 text-[10px] sm:text-xs"
                            >
                              Withdraw Unsold Tokens
                            </motion.button>
                          )}
                          {isExpired && percentageSold >= 85 && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleClaimPoolFunds(listing.id)}
                              className="w-full bg-green-600 hover:bg-green-700 transition-colors rounded-md py-1 sm:py-1.5 text-[10px] sm:text-xs"
                            >
                              Claim Pool Funds
                            </motion.button>
                          )}
                          {listing.referralActive && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => generateAndShareReferral(listing)}
                              className="w-full bg-purple-600 hover:bg-purple-700 transition-colors rounded-md py-1 sm:py-1.5 text-[10px] sm:text-xs"
                            >
                              Share Referral Link
                            </motion.button>
                          )}
                        </>
                      )}
                      {!isOwner && (
                        <>
                          {!isExpired && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setSelectedListing(listing)}
                              className="w-full bg-primary-600 hover:bg-primary-700 transition-colors rounded-md py-1 sm:py-1.5 text-[10px] sm:text-xs"
                            >
                              Buy Tokens
                            </motion.button>
                          )}
                          {isRefundable && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleClaimRefund(listing.id)}
                              className="w-full bg-blue-600 hover:bg-blue-700 transition-colors rounded-md py-1 sm:py-1.5 text-[10px] sm:text-xs"
                            >
                              Claim Refund
                            </motion.button>
                          )}
                          {isClaimable && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleClaimTokens(listing.id)}
                              className="w-full bg-green-600 hover:bg-green-700 transition-colors rounded-md py-1 sm:py-1.5 text-[10px] sm:text-xs"
                            >
                              Claim Tokens
                            </motion.button>
                          )}
                          {listing.referralActive && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => generateAndShareReferral(listing)}
                              className="w-full bg-purple-600 hover:bg-purple-700 transition-colors rounded-md py-1 sm:py-1.5 text-[10px] sm:text-xs"
                            >
                              Share Referral Link
                            </motion.button>
                          )}
                        </>
                      )}
                      {isMarketplaceOwner && canOwnerWithdraw && (
                        <>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleWithdrawPaymentTokens(listing.id)}
                            className="w-full bg-purple-600 hover:bg-purple-700 transition-colors rounded-md py-1 sm:py-1.5 text-[10px] sm:text-xs"
                          >
                            Withdraw Payment Tokens
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleWithdrawTokens(listing.id)}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-md py-1 sm:py-1.5 text-[10px] sm:text-xs"
                          >
                            Withdraw Tokens
                          </motion.button>
                        </>
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
            <p>No {activeTab === 'active' ? 'active' : 'sold/expired'} listings available.</p>
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
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-60 overflow-hidden"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gradient-to-b from-gray-900 to-black rounded-xl p-6 max-w-md w-full border border-white/10 shadow-2xl h-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Buy {selectedListing.token.name} Tokens</h3>
                <button
                  onClick={() => {
                    setSelectedListing(null);
                    setBuyAmount('');
                    if (!isReferralPurchase) setReferralCode('');
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {isReferralPurchase && (
                <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-3 mb-4">
                  <div className="flex items-start">
                    <Gift className="w-5 h-5 text-purple-400 mt-0.5 mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-purple-300">Referral Purchase</p>
                      <p className="text-xs text-gray-300">
                        You are buying via a referral link. The referrer will receive {selectedListing.referralPercent}% of your tokens as a reward.
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
                    <span className="font-medium">{selectedListing.token.pricePerShare} {selectedListing.paymentTokenSymbol}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Available:</span>
                    <span className="font-medium">{parseFloat(selectedListing.token.amount).toFixed(6)} tokens</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-gray-400">Total Cost:</span>
                    <span className="font-medium text-primary-300">
                      {buyAmount
                        ? `${(parseFloat(buyAmount) * parseFloat(selectedListing.token.pricePerShare)).toString()} ${selectedListing.paymentTokenSymbol}`
                        : '-'}
                    </span>
                  </div>
                </div>

                {selectedListing.referralActive && !isReferralPurchase && (
                  <div className="bg-purple-500/10 p-3 rounded-lg border border-purple-500/30">
                    <p className="text-sm text-purple-300 mb-2 flex items-center">
                      <Gift className="w-4 h-4 mr-1" />
                      <span>This listing offers a {selectedListing.referralPercent}% referral reward!</span>
                    </p>
                    <div>
                      <label className="block text-xs text-gray-300 mb-1">Referral Code (optional)</label>
                      <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-white text-sm"
                        placeholder="Enter referral code"
                      />
                    </div>
                  </div>
                )}

                <div className="flex space-x-4 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-white/5 hover:bg-white/10 transition-colors rounded-lg py-2"
                    onClick={() => {
                      setSelectedListing(null);
                      setBuyAmount('');
                      if (!isReferralPurchase) setReferralCode('');
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

        {showReferralModal && selectedReferralListing && signer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-60 overflow-hidden"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gradient-to-b from-purple-900 to-gray-900 rounded-xl p-6 max-w-md w-full border border-purple-500/30 shadow-2xl h-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">Share Referral Link</h3>
                <button
                  onClick={() => {
                    setShowReferralModal(false);
                    setSelectedReferralListing(null);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-6">
                <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-4">
                  <div className="flex items-start">
                    <Gift className="w-6 h-6 text-purple-400 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <p className="text-base font-medium text-purple-300">Earn {selectedReferralListing.referralPercent}% Referral Rewards</p>
                      <p className="text-sm text-gray-300 mt-1">
                        Share this link with others. When they purchase tokens through your link, you'll receive {selectedReferralListing.referralPercent}% of the tokens!
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Your Unique Referral Link</label>
                  <div className="flex">
                    <input
                      type="text"
                      value={referralLink}
                      readOnly
                      className="flex-1 bg-white/5 border border-white/10 rounded-l-lg px-4 py-2 text-white text-sm"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => copyToClipboard(referralLink, 'Referral link copied!')}
                      className="bg-purple-600 hover:bg-purple-700 transition-colors rounded-r-lg px-4 py-2 flex items-center"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </motion.button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <a
                    href={`https://twitter.com/intent/tweet?text=Check%20out%20this%20token%20on%20Properties%20DEX!&url=${encodeURIComponent(referralLink)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 hover:bg-blue-700 transition-colors rounded-lg py-2 px-4 flex items-center justify-center"
                  >
                    <Twitter className="w-4 h-4 mr-2" />
                    Share on Twitter
                  </a>
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Check%20out%20this%20token%20on%20Properties%20DEX!`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-500 hover:bg-blue-600 transition-colors rounded-lg py-2 px-4 flex items-center justify-center"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Share on Telegram
                  </a>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-white mb-2">How Referrals Work</h4>
                  <ol className="text-xs text-gray-300 space-y-2 list-decimal pl-4">
                    <li>Share your unique referral link with potential buyers</li>
                    <li>When they click your link and purchase tokens, you're credited</li>
                    <li>You'll receive {selectedReferralListing.referralPercent}% of the tokens they purchase</li>
                    <li>Rewards are sent to your wallet after the purchase</li>
                  </ol>
                </div>
                <div className="flex justify-end">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowReferralModal(false);
                      setSelectedReferralListing(null);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 transition-colors rounded-lg py-2 px-6 flex items-center"
                  >
                    Done
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
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
          onClick={() => {
            setSelectedListing(null);
            setBuyAmount('');
            if (!isReferralPurchase) setReferralCode('');
          }}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {isReferralPurchase && (
        <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-start">
            <Gift className="w-5 h-5 text-purple-400 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-purple-300">Referral Purchase</p>
              <p className="text-xs text-gray-300">
                You are buying via a referral link. The referrer will receive {selectedListing.referralPercent}% of your tokens as a reward.
              </p>
            </div>
          </div>
        </div>
      )}

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

        {selectedListing.referralActive && !isReferralPurchase && (
          <div className="bg-purple-500/10 p-3 rounded-lg border border-purple-500/30">
            <p className="text-sm text-purple-300 mb-2 flex items-center">
              <Gift className="w-4 h-4 mr-1" />
              <span>This listing offers a {selectedListing.referralPercent}% referral reward!</span>
            </p>
            <div>
              <label className="block text-xs text-gray-300 mb-1">Referral Code (optional)</label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-white text-sm"
                placeholder="Enter referral code"
              />
            </div>
          </div>
        )}

        <div className="flex space-x-4 pt-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-1 bg-white/5 hover:bg-white/10 transition-colors rounded-lg py-2"
            onClick={() => {
              setSelectedListing(null);
              setBuyAmount('');
              if (!isReferralPurchase) setReferralCode('');
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

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setSelectedListing(null);
            openDetailsModal(selectedListing);
          }}
          className="w-full bg-white/5 hover:bg-white/10 transition-colors rounded-lg py-2 flex items-center justify-center mt-2"
        >
          <FileText className="w-4 h-4 mr-2" />
          View Project Details
        </motion.button>
      </div>
    </motion.div>
  </motion.div>
)}

{showReferralModal && selectedReferralListing && signer && (
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
      className="bg-gradient-to-b from-purple-900 to-gray-900 rounded-xl p-6 max-w-md w-full border border-purple-500/30 shadow-2xl"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-white">Share Referral Link</h3>
        <button
          onClick={() => {
            setShowReferralModal(false);
            setSelectedReferralListing(null);
          }}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="space-y-6">
        <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-4">
          <div className="flex items-start">
            <Gift className="w-6 h-6 text-purple-400 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <p className="text-base font-medium text-purple-300">Earn {selectedReferralListing.referralPercent}% Referral Reward</p>
              <p className="text-sm text-gray-300 mt-1">
                Share this link. When someone buys through it, you’ll receive {selectedReferralListing.referralPercent}% of the tokens!
              </p>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Your Unique Referral Link</label>
          <div className="flex">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="flex-1 bg-white/5 border border-white/10 rounded-l-lg px-4 py-2 text-white text-sm"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => copyToClipboard(referralLink, 'Referral link copied!')}
              className="bg-purple-600 hover:bg-purple-700 transition-colors rounded-r-lg px-4 py-2 flex items-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </motion.button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <a
            href={`https://twitter.com/intent/tweet?text=Check%20out%20this%20token%20on%20Properties%20DEX!&url=${encodeURIComponent(referralLink)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 hover:bg-blue-700 transition-colors rounded-lg py-2 px-4 flex items-center justify-center"
          >
            <Twitter className="w-4 h-4 mr-2" />
            Share on Twitter
          </a>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Check%20out%20this%20token%20on%20Properties%20DEX!`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-500 hover:bg-blue-600 transition-colors rounded-lg py-2 px-4 flex items-center justify-center"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Share on Telegram
          </a>
        </div>
        <div className="bg-white/5 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-2">How Referrals Work</h4>
          <ol className="text-xs text-gray-300 space-y-2 list-decimal pl-4">
            <li>Share your unique link with potential buyers</li>
            <li>When they click the link and buy, you get credited</li>
            <li>You’ll receive {selectedReferralListing.referralPercent}% of the purchased tokens</li>
            <li>Rewards are sent to your wallet after the purchase</li>
          </ol>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setShowReferralModal(false);
            openDetailsModal(selectedReferralListing);
          }}
          className="w-full bg-white/5 hover:bg-white/10 transition-colors rounded-lg py-2 flex items-center justify-center"
        >
          <FileText className="w-4 h-4 mr-2" />
          View Project Details
        </motion.button>
        <div className="flex justify-end">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setShowReferralModal(false);
              setSelectedReferralListing(null);
            }}
            className="bg-purple-600 hover:bg-purple-700 transition-colors rounded-lg py-2 px-6 flex items-center"
          >
            Done
          </motion.button>
        </div>
      </div>
    </motion.div>
  </motion.div>
)}

{showDetailsModal && selectedDetailsListing && signer && (
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
      className="bg-gradient-to-b from-gray-900 to-black rounded-xl p-6 max-w-2xl w-full border border-white/10 shadow-2xl"
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
                <span className="text-gray-400">Available:</span>
                <span>{parseFloat(selectedDetailsListing.token.amount).toFixed(6)} tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Price per Token:</span>
                <span>{parseFloat(selectedDetailsListing.token.pricePerShare).toFixed(8)} {selectedDetailsListing.paymentTokenSymbol || 'N/A'}</span>
              </div>
            </div>
          </div>
          <div className="bg-white/5 p-4 rounded-lg">
            <h4 className="text-lg font-medium mb-2">Contract Addresses</h4>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400 mb-1">Token Contract:</p>
                <div className="flex items-center">
                  <p className="text-xs text-primary-300 break-all mr-2">{selectedDetailsListing.token.address || 'N/A'}</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => copyToClipboard(selectedDetailsListing.token.address || '')}
                    className="text-gray-400 hover:text-white"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </motion.button>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Marketplace Contract:</p>
                <div className="flex items-center">
                  <p className="text-xs text-primary-300 break-all mr-2">{MARKETPLACE_ADDRESS || 'N/A'}</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => copyToClipboard(MARKETPLACE_ADDRESS || '')}
                    className="text-gray-400 hover:text-white"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </motion.button>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Seller Address:</p>
                <div className="flex items-center">
                  <p className="text-xs text-primary-300 break-all mr-2">{selectedDetailsListing.seller || 'N/A'}</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => copyToClipboard(selectedDetailsListing.seller || '')}
                    className="text-gray-400 hover:text-white"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white/5 p-4 rounded-lg">
            <h4 className="text-lg font-medium mb-2">Project Description</h4>
            <p className="text-gray-300 text-sm whitespace-pre-wrap">
              {selectedDetailsListing.projectDescription || 'No description provided.'}
            </p>
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
                  <Globe className="w-6 h-6" />
                </a>
              )}
              {selectedDetailsListing.twitterUrl && (
                <a
                  href={selectedDetailsListing.twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:text-primary-300"
                >
                  <Twitter className="w-6 h-6" />
                </a>
              )}
              {selectedDetailsListing.telegramUrl && (
                <a
                  href={selectedDetailsListing.telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:text-primary-300"
                >
                  <MessageCircle className="w-6 h-6" />
                </a>
              )}
            </div>
          </div>
          {selectedDetailsListing.referralActive && (
            <div className="bg-purple-500/20 p-4 rounded-lg border border-purple-500/30">
              <h4 className="text-lg font-medium mb-2 text-purple-300">Referral Program</h4>
              <p className="text-gray-300 text-sm mb-2">
                This listing offers a {selectedDetailsListing.referralPercent}% referral reward.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowDetailsModal(false);
                  generateAndShareReferral(selectedDetailsListing);
                }}
                className="bg-purple-600 hover:bg-purple-700 transition-colors rounded-lg py-2 px-4 w-full flex items-center justify-center"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share Referral Link
              </motion.button>
            </div>
          )}
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
                <Trash2 className="w-4 h-4 mr-2" />
                Cancel Listing
              </motion.button>
            )}
          </div>
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
    className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
  >
    <motion.div
      initial={{ scale: 0.95 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0.95 }}
      className="bg-gradient-to-b from-gray-900 to-black rounded-xl p-6 max-w-md w-full border border-white/10 shadow-2xl"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Graduation Information</h3>
        <button
          onClick={() => setShowInfoModal(false)}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="space-y-4 text-gray-300">
        <p className="text-sm">
          If a project reaches 85% or more of its tokens sold (excluding referral reserves), it is marked as <strong>"Graduated"</strong>.
        </p>
        <p className="text-sm">
          Once graduated, tokens and/or funds will be claimable in the <strong>"Delisting"</strong> section after the listing ends.
        </p>
        <p className="text-sm">
          Sellers can withdraw their funds, and buyers can claim their tokens, provided the conditions are met at the end of the listing period.
        </p>
      </div>
      <div className="flex justify-end mt-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowInfoModal(false)}
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