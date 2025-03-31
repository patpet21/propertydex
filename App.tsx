import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { 
  Building2, 
  Wallet, 
  Plus, 
  ShoppingBag, 
  ExternalLink, 
  Globe, 
  DollarSign, 
  TrendingUp, 
  BarChart3, 
  Lock, 
  LogOut, 
  Trash2, 
  Check, 
  Clock,
  LineChart,
  Info, 
  List, 
  CheckCircle, 
  TrendingUp as TradingIcon, 
  User, 
  MessageSquare, 
  Award, 
  ShoppingCart 
} from 'lucide-react';
import { connectWallet, getWalletBalances } from './lib/web3Utils';
import CreateToken from './components/CreateToken';
import ListToken from './components/ListToken';
import Marketplace from './components/Marketplace';
import BuyPRDX from './components/BuyPRDX';
import SoldTokenPage from './components/SoldTokenPage';
import TokenDetailsPage from './components/TokenDetailsPage';
import AllTokensPage from './components/AllTokensPage';
import BondingCurveMarketplace from './components/BondingCurveMarketplace';
import BondingCurve from './components/BondingCurve';
import AddLiquidityPage from './components/AddLiquidityPage';
import Sidebar from './components/Sidebar';
import ProjectCarousel from './components/ProjectCarousel';
import Profile from './components/Profile';
import Feed from './components/Feed';
import Leaderboard from './components/Leaderboard';
import BondingCurvePage from './components/BondingCurvePage';
import NEWPresaleBondingCurve from './components/NEWPresaleBondingCurve';

// Interactive background style
const blockchainBackgroundStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'radial-gradient(circle, rgba(0,0,50,0.8), rgba(0,0,20,1))',
  zIndex: -1,
  overflow: 'hidden',
};

// Animated particles component
const Particles = () => {
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
  }));

  return (
    <div style={blockchainBackgroundStyle}>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          style={{
            position: 'absolute',
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            background: 'rgba(100, 150, 255, 0.5)',
            borderRadius: '50%',
          }}
          animate={{
            x: [0, Math.random() * 50 - 25],
            y: [0, Math.random() * 50 - 25],
            opacity: [0.2, 0.8, 0.2],
          }}
          transition={{
            duration: Math.random() * 5 + 5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};

// CrowdsaleTokenHubV4 contract ABI
const abi = [
  {"inputs":[{"internalType":"address","name":"_customPaymentToken","type":"address"},{"internalType":"address","name":"_usdcPaymentToken","type":"address"},{"internalType":"address","name":"_feeRecipient","type":"address"},{"internalType":"address","name":"_tokenCreator","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"},{"indexed":true,"internalType":"address","name":"buyer","type":"address"}],"name":"BuyerAdded","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"},{"indexed":true,"internalType":"address","name":"buyer","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"FundsRefunded","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"},{"indexed":true,"internalType":"address","name":"seller","type":"address"}],"name":"ListingCancelled","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"},{"indexed":false,"internalType":"string","name":"status","type":"string"}],"name":"ListingStatusUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"},{"indexed":false,"internalType":"string","name":"projectWebsite","type":"string"},{"indexed":false,"internalType":"string","name":"socialMediaLink","type":"string"},{"indexed":false,"internalType":"string","name":"tokenImageUrl","type":"string"},{"indexed":false,"internalType":"string","name":"telegramUrl","type":"string"},{"indexed":false,"internalType":"string","name":"projectDescription","type":"string"}],"name":"MetadataUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"},{"indexed":true,"internalType":"address","name":"newContract","type":"address"}],"name":"MigratedToNewContract","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"}],"name":"Paused","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"oldToken","type":"address"},{"indexed":true,"internalType":"address","name":"newToken","type":"address"},{"indexed":false,"internalType":"bool","name":"isCustom","type":"bool"}],"name":"PaymentTokenUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"},{"indexed":true,"internalType":"address","name":"seller","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"PoolFundsClaimed","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"},{"indexed":false,"internalType":"bytes32","name":"referralCode","type":"bytes32"},{"indexed":false,"internalType":"address","name":"referralAddress","type":"address"}],"name":"ReferralCodeGenerated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newRefundWindow","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"newSellerWithdrawWindow","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"newOwnerWithdrawWindow","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"newClaimWindow","type":"uint256"}],"name":"TimeWindowsUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"},{"indexed":true,"internalType":"address","name":"seller","type":"address"},{"indexed":false,"internalType":"address","name":"tokenAddress","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"TokenListed","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"},{"indexed":true,"internalType":"address","name":"buyer","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"totalCost","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"referralReward","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"TokenPurchased","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"TokenSold","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"},{"indexed":true,"internalType":"address","name":"buyer","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"TokensClaimed","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"tokenAddress","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"TokensWithdrawn","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"listingId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"UnclaimedFundsWithdrawn","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"}],"name":"Unpaused","type":"event"},
  {"inputs":[],"name":"MIN_SELL_PERCENTAGE","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"},{"internalType":"uint256","name":"amountRaw","type":"uint256"},{"internalType":"bytes32","name":"referralCode","type":"bytes32"}],"name":"buyToken","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"address","name":"","type":"address"}],"name":"buyerInfo","outputs":[{"internalType":"uint256","name":"totalPaidRaw","type":"uint256"},{"internalType":"bool","name":"refunded","type":"bool"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"buyers","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"paymentToken","type":"address"}],"name":"canOwnerWithdrawPool","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"tokenAddress","type":"address"}],"name":"canOwnerWithdrawTokens","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"claimPoolFunds","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"claimRefund","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"claimTokens","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"customPaymentToken","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"feePercent","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"feeRecipient","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"generateBuyerReferralCode","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"},{"internalType":"address","name":"buyer","type":"address"}],"name":"getBuyerInfo","outputs":[{"internalType":"uint256","name":"totalPaidRaw","type":"uint256"},{"internalType":"bool","name":"refunded","type":"bool"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"getListingAdditionalDetails","outputs":[{"internalType":"bool","name":"active","type":"bool"},{"internalType":"bool","name":"referralActive","type":"bool"},{"internalType":"uint256","name":"referralPercent","type":"uint256"},{"internalType":"bytes32","name":"referralCode","type":"bytes32"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"uint256","name":"initialAmount","type":"uint256"},{"internalType":"uint256","name":"referralReserve","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"getListingBasicDetails","outputs":[{"internalType":"address","name":"seller","type":"address"},{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"soldAmount","type":"uint256"},{"internalType":"uint256","name":"pricePerShare","type":"uint256"},{"internalType":"address","name":"paymentToken","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"getListingMetadata","outputs":[{"internalType":"string","name":"projectWebsite","type":"string"},{"internalType":"string","name":"socialMediaLink","type":"string"},{"internalType":"string","name":"tokenImageUrl","type":"string"},{"internalType":"string","name":"telegramUrl","type":"string"},{"internalType":"string","name":"projectDescription","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"getListingStatus","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"isListingExpired","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"isListingSoldOut","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"uint256","name":"amountRaw","type":"uint256"},{"internalType":"uint256","name":"pricePerShareRaw","type":"uint256"},{"internalType":"address","name":"paymentToken","type":"address"},{"internalType":"bool","name":"referralActive","type":"bool"},{"internalType":"uint256","name":"referralPercent","type":"uint256"},{"components":[{"internalType":"string","name":"projectWebsite","type":"string"},{"internalType":"string","name":"socialMediaLink","type":"string"},{"internalType":"string","name":"tokenImageUrl","type":"string"},{"internalType":"string","name":"telegramUrl","type":"string"},{"internalType":"string","name":"projectDescription","type":"string"}],"internalType":"struct CrowdsaleTokenHubV4.Metadata","name":"metadata","type":"tuple"},{"internalType":"uint256","name":"durationInSeconds","type":"uint256"}],"name":"listToken","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"listingCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"listings","outputs":[{"internalType":"address","name":"seller","type":"address"},{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"soldAmount","type":"uint256"},{"internalType":"uint256","name":"pricePerShare","type":"uint256"},{"internalType":"address","name":"paymentToken","type":"address"},{"internalType":"bool","name":"active","type":"bool"},{"internalType":"bool","name":"referralActive","type":"bool"},{"internalType":"uint256","name":"referralPercent","type":"uint256"},{"internalType":"bytes32","name":"referralCode","type":"bytes32"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"uint256","name":"initialAmount","type":"uint256"},{"internalType":"uint256","name":"referralReserve","type":"uint256"},{"components":[{"internalType":"string","name":"projectWebsite","type":"string"},{"internalType":"string","name":"socialMediaLink","type":"string"},{"internalType":"string","name":"tokenImageUrl","type":"string"},{"internalType":"string","name":"telegramUrl","type":"string"},{"internalType":"string","name":"projectDescription","type":"string"}],"internalType":"struct CrowdsaleTokenHubV4.Metadata","name":"metadata","type":"tuple"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"address","name":"","type":"address"}],"name":"lockedTokens","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"newContract","type":"address"},{"internalType":"uint256","name":"startId","type":"uint256"},{"internalType":"uint256","name":"endId","type":"uint256"}],"name":"migrateAllActiveListings","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"newContract","type":"address"},{"internalType":"uint256[]","name":"listingIds","type":"uint256[]"}],"name":"migrateToNewContract","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"pause","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"platformReferralCode","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"poolBalances","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"timeWindows","outputs":[{"internalType":"uint256","name":"refundWindow","type":"uint256"},{"internalType":"uint256","name":"sellerWithdrawWindow","type":"uint256"},{"internalType":"uint256","name":"ownerWithdrawWindow","type":"uint256"},{"internalType":"uint256","name":"claimWindow","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"tokenCreator","outputs":[{"internalType":"contract ITokenCreatorPRDX","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"unpause","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"newClaimWindow","type":"uint256"}],"name":"updateClaimWindow","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"newCustomPaymentToken","type":"address"}],"name":"updateCustomPaymentToken","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"newFeePercent","type":"uint256"}],"name":"updateFeePercent","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"newFeeRecipient","type":"address"}],"name":"updateFeeRecipient","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"newOwnerWithdrawWindow","type":"uint256"}],"name":"updateOwnerWithdrawWindow","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"newRefundWindow","type":"uint256"}],"name":"updateRefundWindow","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"newSellerWithdrawWindow","type":"uint256"}],"name":"updateSellerWithdrawWindow","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"newTokenCreator","type":"address"}],"name":"updateTokenCreator","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"newUsdcPaymentToken","type":"address"}],"name":"updateUsdcPaymentToken","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"usdcPaymentToken","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"walletReferralCodes","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"withdrawExpiredFundsAndTokens","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"paymentToken","type":"address"},{"internalType":"uint256","name":"amountRaw","type":"uint256"},{"internalType":"address","name":"to","type":"address"}],"name":"withdrawPaymentTokens","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"uint256","name":"amountRaw","type":"uint256"},{"internalType":"address","name":"to","type":"address"}],"name":"withdrawTokens","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"withdrawUnclaimedFunds","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"withdrawUnsoldTokens","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

// Contract address
const contractAddress = '0x338a419639cD3c2089DB55aDEA4b9c47739596f0';

function App() {
  const [signer, setSigner] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [balances, setBalances] = useState(null);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [showListToken, setShowListToken] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showBuyPRDX, setShowBuyPRDX] = useState(false);
  const [showSoldTokenPage, setShowSoldTokenPage] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [newTokenAddress, setNewTokenAddress] = useState(null);
  const [showTokenDetailsPage, setShowTokenDetailsPage] = useState(false);
  const [showAllTokens, setShowAllTokens] = useState(false);
  const [showAddLiquidityPage, setShowAddLiquidityPage] = useState(false);
  const [showBondingCurveMarketplace, setShowBondingCurveMarketplace] = useState(false);
  const [showBondingCurvePage, setShowBondingCurvePage] = useState(false);
  const [showNewPresaleBondingCurve, setShowNewPresaleBondingCurve] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('listingId') && urlParams.has('referral')) {
      handleConnectWallet();
    }
    if (signer) {
      const interval = setInterval(() => updateBalances(), 30000);
      return () => clearInterval(interval);
    }
  }, [signer]);

  const handleConnectWallet = async () => {
    try {
      setIsConnecting(true);
      const newSigner = await connectWallet();
      setSigner(newSigner);
      const address = await newSigner.getAddress();
      setWalletAddress(address);
      const userBalances = await getWalletBalances(newSigner);
      setBalances(userBalances);
      toast.success('Wallet connected successfully!');
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast.error(error.message || 'Failed to connect wallet');
      setSigner(null);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = () => {
    setSigner(null);
    setWalletAddress('');
    setBalances(null);
    setShowCreateToken(false);
    setShowListToken(false);
    setShowMarketplace(false);
    setShowSoldTokenPage(false);
    setShowBuyPRDX(false);
    setNewTokenAddress(null);
    setShowTokenDetailsPage(false);
    setShowAllTokens(false);
    setShowAddLiquidityPage(false);
    setShowBondingCurveMarketplace(false);
    setShowBondingCurvePage(false);
    setShowNewPresaleBondingCurve(false);
    setShowProfile(false);
    setShowFeed(false);
    setShowLeaderboard(false);
    setSelectedListingId(null);
    toast('Wallet disconnected');
  };

  const updateBalances = async () => {
    if (signer) {
      try {
        const newBalances = await getWalletBalances(signer);
        setBalances(newBalances);
      } catch (error) {
        console.error('Error updating balances:', error);
      }
    }
  };

  const handleCreateTokenSuccess = (tokenAddress) => {
    setShowCreateToken(false);
    setNewTokenAddress(tokenAddress);
    setShowListToken(true);
    updateBalances();
  };

  const handleListTokenSuccess = () => {
    setShowListToken(false);
    setShowMarketplace(true);
    setNewTokenAddress(null);
    updateBalances();
  };

  const openAddLiquidityPage = (listingId) => {
    if (signer) {
      setSelectedListingId(listingId);
      setShowAddLiquidityPage(true);
    } else {
      toast.error('Please connect your wallet first!');
    }
  };

  const handleMarketplaceWithToken = (tokenId) => {
    if (signer) {
      setSelectedListingId(tokenId);
      setShowMarketplace(true);
    } else {
      toast.error('Please connect your wallet first!');
    }
  };

  return (
    <div className="min-h-screen text-white relative">
      <Particles />
      <Toaster position="top-right" />
      <Sidebar
        signer={signer}
        handleConnectWallet={handleConnectWallet}
        handleDisconnectWallet={handleDisconnectWallet}
        setShowCreateToken={setShowCreateToken}
        setShowListToken={setShowListToken}
        setShowMarketplace={setShowMarketplace}
        setShowBuyPRDX={setShowBuyPRDX}
        setShowSoldTokenPage={setShowSoldTokenPage}
        setShowTokenDetailsPage={setShowTokenDetailsPage}
        setShowAllTokens={setShowAllTokens}
        setShowAddLiquidityPage={setShowAddLiquidityPage}
        openAddLiquidityPage={openAddLiquidityPage}
        setShowProfile={setShowProfile}
        setShowFeed={setShowFeed}
        setShowLeaderboard={setShowLeaderboard}
      />
      <header className="border-b border-white/10 backdrop-blur-sm bg-black/20 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <img src="https://i.ibb.co/LDt6yJpn/erasebg-transformed.png" alt="PropertyDEX Logo" className="w-12 h-12 md:w-16 md:h-16 mr-2" />
            <h1 className="text-2xl md:text-3xl font-bold">PropertyDEX</h1>
          </div>

          <div className="flex flex-col space-y-3 w-full md:w-auto">
            {!signer ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleConnectWallet}
                disabled={isConnecting}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-center hover:bg-white/10 transition-colors flex items-center justify-center w-full"
              >
                {isConnecting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    <span className="text-sm md:text-base">Connecting...</span>
                  </>
                ) : (
                  <>
                    <Wallet className="w-5 h-5 mr-2 text-purple-300" />
                    <span className="text-sm md:text-base text-purple-300">Connect Wallet</span>
                  </>
                )}
              </motion.button>
            ) : (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 w-full">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary-300">
                    Wallet: {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleDisconnectWallet}
                    className="text-gray-400 hover:text-white bg-white/10 rounded-full p-1"
                    title="Disconnect wallet"
                  >
                    <LogOut className="w-4 h-4" />
                  </motion.button>
                </div>
                {balances && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white/5 rounded px-2 py-1 text-center">
                      <span className="text-xs text-gray-400 block">ETH</span>
                      <span className="text-sm font-bold text-white">{parseFloat(balances.eth).toFixed(4)}</span>
                    </div>
                    <div className="bg-white/5 rounded px-2 py-1 text-center">
                      <span className="text-xs text-gray-400 block">PRDX</span>
                      <span className="text-sm font-bold text-primary-300">{parseFloat(balances.prdx).toFixed(2)}</span>
                    </div>
                    <div className="bg-white/5 rounded px-2 py-1 text-center">
                      <span className="text-xs text-gray-400 block">USDC</span>
                      <span className="text-sm font-bold text-green-300">{parseFloat(balances.usdc).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Buy $PRDX Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowBuyPRDX(true)}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-center hover:bg-white/10 transition-colors flex items-center justify-center w-full"
            >
              <DollarSign className="w-5 h-5 mr-2 text-blue-300" />
              <span className="text-sm md:text-base text-blue-300">Buy $PRDX</span>
              <ExternalLink className="w-4 h-4 ml-2 text-blue-300" />
            </motion.button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 relative z-10">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="space-y-12"
          >
            <div className="text-center mb-8">
              <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg px-4 py-3 my-2">
                <div className="animate-marquee whitespace-nowrap">
                  <span className="text-white text-sm font-medium">
                    {"\uD83D\uDE80 CREATE YOUR TOKEN ON BASE WITH TOKENCREATOR & LAUNCH YOUR PRESALE TODAY \u2756 "}
                    {"\u23F3 PRESALE FEATURES: REFUND (<85% SOLD, 72 HOURS), CLAIM (30 DAYS), WITHDRAWALS \u2756 "}
                    {"\uD83D\uDD17 REAL ESTATE TOKENIZATION IN DEVELOPMENT \u2756 "}
                    {"\u2B50 MORE WALLETS COMING SOON \u2756 "}
                    {"\uD83C\uDF81 REFERRAL SYSTEM ACTIVE - EARN REWARDS! \u00A0 \u00A0"}
                    {"\uD83D\uDE80 CREATE YOUR TOKEN ON BASE WITH TOKENCREATOR & LAUNCH YOUR PRESALE TODAY \u2756 "}
                    {"\u23F3 PRESALE FEATURES: REFUND (<85% SOLD, 72 HOURS MIN), CLAIM (30 DAYS), WITHDRAWALS \u2756 "}
                    {"\uD83D\uDD17 REAL ESTATE TOKENIZATION IN DEVELOPMENT \u2756 "}
                    {"\u2B50 MORE WALLETS COMING SOON \u2756 "}
                    {"\uD83C\uDF81 REFERRAL SYSTEM ACTIVE - EARN REWARDS!"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-center space-x-4">
                <img src="https://i.ibb.co/LDt6yJpn/erasebg-transformed.png" alt="PropertyDEX Logo" className="w-16 h-16 mr-2" />
                <h1 className="text-3xl font-bold">PropertyDEX</h1>
                <span className="text-3xl font-extrabold italic text-primary-300" style={{ textShadow: '0 0 5px rgba(255, 255, 255, 0.5)' }}>
                  $PDRX
                </span>
              </div>
              <p className="text-sm md:text-base text-gray-300 max-w-4xl mx-auto whitespace-nowrap flex flex-col md:flex-row items-center justify-center space-y-2 md:space-y-0 md:space-x-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
  <span className="text-sm md:text-base">Build your Token with Presale or Bonding Curve.</span> 
  <span className="text-sm md:text-base font-bold text-yellow-400 animate-pulse">COMING SOON:</span> 
  <span className="text-sm md:text-base">Decentralized Real Estate Tokenization on Base Network</span>
</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 mb-12">
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center">
                  <h3 className="text-md font-semibold mb-2">Token Details</h3>
                  <p className="text-xs text-gray-400 mb-1">$PRDX Token Address:</p>
                  <p className="text-xs text-primary-300 break-all">
                    0x61Dd008F1582631Aa68645fF92a1a5ECAedBeD19
                  </p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center">
                  <h3 className="text-md font-semibold mb-2">Platform Fee</h3>
                  <p className="text-lg font-bold text-primary-300 mb-1">0.3%</p>
                  <p className="text-xs text-gray-400">on transactions</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center">
                  <h3 className="text-md font-semibold mb-2">Network</h3>
                  <p className="text-lg font-bold text-primary-300 mb-1">Base Network</p>
                  <p className="text-xs text-gray-400">Fast & low-cost transactions</p>
                </div>
              </div>

              <ProjectCarousel 
                signer={signer} 
                onProjectClick={handleMarketplaceWithToken} 
                contractAddress={contractAddress} 
                abi={abi} 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 relative group">
                <div className="flex items-center justify-between mb-2">
                  <Building2 className="w-6 h-6 text-purple-400 group-hover:text-purple-300 transition-colors" />
                  <div className="bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded-full">
                    Marketplace
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold mb-1 text-purple-300">Token Marketplace</h3>
                  <p className="text-xs text-gray-400 mb-2">Coming Soon - Property Token</p>
                  <p className="text-xs text-gray-300 mb-2">
                    Browse and buy property tokens from the marketplace. Invest in real estate with fractional ownership.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 p-2 rounded-lg">
                    <div className="flex items-start">
                      <DollarSign className="w-4 h-4 text-purple-300 mt-0.5 mr-1 flex-shrink-0" />
                      <p className="text-xs text-gray-400">
                        Pay with PRDX or USDC tokens.
                      </p>
                    </div>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg">
                    <div className="flex items-start">
                      <TrendingUp className="w-4 h-4 text-purple-300 mt-0.5 mr-1 flex-shrink-0" />
                      <p className="text-xs text-gray-400">
                        Earn referral rewards.
                      </p>
                    </div>
                  </div>
                </div>
                {!signer ? (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl">
                    <Lock className="w-8 h-8 text-purple-400 mb-2" />
                    <p className="text-sm font-medium text-white mb-2">Connect wallet to unlock</p>
                    <button
                      onClick={handleConnectWallet}
                      disabled={isConnecting}
                      className="bg-purple-600 hover:bg-purple-700 transition-colors px-4 py-1 rounded text-sm flex items-center"
                    >
                      {isConnecting ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Wallet className="w-4 h-4 mr-1" />
                          Connect Wallet
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowMarketplace(true)}
                    className="absolute inset-0 w-full h-full cursor-pointer z-10 opacity-0"
                    aria-label="Open Marketplace"
                  />
                )}
              </div>

              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 relative group">
                <div className="flex items-center justify-between mb-2">
                  <Plus className="w-6 h-6 text-blue-400 group-hover:text-blue-300 transition-colors" />
                  <div className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded-full">
                    Create
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold mb-1 text-blue-300">Create Token</h3>
                  <p className="text-xs text-gray-400 mb-2">Coming Soon - Property Token</p>
                  <p className="text-xs text-gray-300 mb-2">
                    Tokenize your real estate property by creating a new token. Define your token's name, symbol, and supply.
                  </p>
                </div>
                <div className="bg-white/5 p-2 rounded-lg">
                  <div className="flex items-start">
                    <TrendingUp className="w-4 h-4 text-blue-300 mt-0.5 mr-1 flex-shrink-0" />
                    <p className="text-xs text-gray-400">
                      Create ERC-20 tokens representing fractional ownership of your property with just a few clicks.
                    </p>
                  </div>
                </div>
                {!signer ? (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl">
                    <Lock className="w-8 h-8 text-blue-400 mb-2" />
                    <p className="text-sm font-medium text-white mb-2">Connect wallet to unlock</p>
                    <button
                      onClick={handleConnectWallet}
                      disabled={isConnecting}
                      className="bg-blue-600 hover:bg-blue-700 transition-colors px-4 py-1 rounded text-sm flex items-center"
                    >
                      {isConnecting ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Wallet className="w-4 h-4 mr-1" />
                          Connect Wallet
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreateToken(true)}
                    className="absolute inset-0 w-full h-full cursor-pointer z-10 opacity-0"
                    aria-label="Create Token"
                  />
                )}
              </div>

              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 relative group">
                <div className="flex items-center justify-between mb-2">
                  <ShoppingBag className="w-6 h-6 text-green-400 group-hover:text-green-300 transition-colors" />
                  <div className="bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded-full">
                    List
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold mb-1 text-green-300">List Token</h3>
                  <p className="text-xs text-gray-400 mb-2">Coming Soon - Property Token</p>
                  <p className="text-xs text-gray-300 mb-2">
                    List your property tokens on the marketplace. Set your price and start selling shares of your property.
                  </p>
                </div>
                <div className="bg-white/5 p-2 rounded-lg">
                  <div className="flex items-start">
                    <BarChart3 className="w-4 h-4 text-green-300 mt-0.5 mr-1 flex-shrink-0" />
                    <p className="text-xs text-gray-400">
                      Enable referral rewards to incentivize others to promote your property tokens.
                    </p>
                  </div>
                </div>
                {!signer ? (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl">
                    <Lock className="w-8 h-8 text-green-400 mb-2" />
                    <p className="text-sm font-medium text-white mb-2">Connect wallet to unlock</p>
                    <button
                      onClick={handleConnectWallet}
                      disabled={isConnecting}
                      className="bg-green-600 hover:bg-green-700 transition-colors px-4 py-1 rounded text-sm flex items-center"
                    >
                      {isConnecting ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Wallet className="w-4 h-4 mr-1" />
                          Connect Wallet
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowListToken(true)}
                    className="absolute inset-0 w-full h-full cursor-pointer z-10 opacity-0"
                    aria-label="List Token"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
              {/* MigrationReadyToken - Disabled */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-center opacity-50 cursor-not-allowed flex items-center justify-center">
                <Info className="w-4 h-4 text-purple-300 mr-2" />
                <span className="text-sm font-medium text-purple-300">MigrationReady</span>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAllTokens(true)}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-center hover:bg-white/10 transition-colors flex items-center justify-center"
              >
                <List className="w-4 h-4 text-blue-300 mr-2" />
                <span className="text-sm font-medium text-blue-300">All Tokens</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => signer ? setShowSoldTokenPage(true) : toast.error('Please connect your wallet first!')}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-center hover:bg-white/10 transition-colors flex items-center justify-center"
              >
                <CheckCircle className="w-4 h-4 text-green-300 mr-2" />
                <span className="text-sm font-medium text-green-300">Sold Tokens</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => openAddLiquidityPage(0)}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-center hover:bg-white/10 transition-colors flex items-center justify-center"
              >
                <TradingIcon className="w-4 h-4 text-purple-300 mr-2" />
                <span className="text-sm font-medium text-purple-300">AddLiquidityPage</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => signer ? setShowProfile(true) : toast.error('Please connect your wallet first!')}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-center hover:bg-white/10 transition-colors flex items-center justify-center"
              >
                <User className="w-4 h-4 text-blue-300 mr-2" />
                <span className="text-sm font-medium text-blue-300">Creator Profile</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => signer ? setShowFeed(true) : toast.error('Please connect your wallet first!')}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-center hover:bg-white/10 transition-colors flex items-center justify-center"
              >
                <MessageSquare className="w-4 h-4 text-green-300 mr-2" />
                <span className="text-sm font-medium text-green-300">Community Feed</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => signer ? setShowLeaderboard(true) : toast.error('Please connect your wallet first!')}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-center hover:bg-white/10 transition-colors flex items-center justify-center"
              >
                <Award className="w-4 h-4 text-purple-300 mr-2" />
                <span className="text-sm font-medium text-purple-300">Creator Leaderboard</span>
              </motion.button>

              {/* BondingCurveMarketplace - Disabled */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-center opacity-50 cursor-not-allowed flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-blue-300 mr-2" />
                <span className="text-sm font-medium text-blue-300">Bonding Curve Marketplace</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bonding Curve Listing - Disabled */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 relative group opacity-50 cursor-not-allowed">
                <div className="flex items-center justify-between mb-2">
                  <LineChart className="w-6 h-6 text-blue-400" />
                  <div className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded-full">
                    Bonding Curve - COMING SOON!!!
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold mb-1 text-yellow-300">Bonding Curve Listing</h3>
                  <p className="text-xs text-gray-300 mb-2">
                    Create and list property tokens using a bonding curve for dynamic pricing.
                  </p>
                </div>
                <div className="bg-white/5 p-2 rounded-lg">
                  <div className="flex items-start">
                    <BarChart3 className="w-4 h-4 text-blue-300 mt-0.5 mr-1 flex-shrink-0" />
                    <p className="text-xs text-gray-400">
                      Adjust prices automatically based on supply and demand.
                    </p>
                  </div>
                </div>
              </div>

              {/* New Presale Bonding Curve - Disabled */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 relative group opacity-50 cursor-not-allowed">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-6 h-6 text-red-400" />
                  <div className="bg-red-500/20 text-red-300 text-xs px-2 py-1 rounded-full">
                    COMING SOON!
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold mb-1 text-red-300">
                    <span className="text-red-500 animate-pulse">NEW</span> Presale Bonding Curve
                  </h3>
                  <p className="text-xs text-gray-300 mb-2">
                    Set up a presale with a bonding curve to protect buyers before the market listing.
                  </p>
                  <p className="text-xs text-gray-300 mb-2">
                    COMING SOON STAY TUNED!!!
                  </p>
                </div>
                <div className="bg-white/5 p-2 rounded-lg">
                  <div className="flex items-start">
                    <Clock className="w-4 h-4 text-red-300 mt-0.5 mr-1 flex-shrink-0" />
                    <p className="text-xs text-gray-400">
                      Launch a secure presale with dynamic pricing for early investors.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-8">
              <p className="text-sm text-yellow-200 text-center">
                <strong>Disclaimer:</strong> PropertyDEX is a decentralized platform for tokenizing and trading real estate assets. 
                Users are responsible for conducting their own due diligence before investing. 
                Cryptocurrency and tokenized real estate investments involve significant risks including potential loss of principal. 
                Past performance is not indicative of future results.
              </p>
            </div>
          </motion.div>
        </div>
      </main>

      {showCreateToken && signer && (
        <CreateToken
          onClose={() => setShowCreateToken(false)}
          onSuccess={handleCreateTokenSuccess}
          signer={signer}
        />
      )}

      {showListToken && signer && (
        <ListToken
          onClose={() => setShowListToken(false)}
          onSuccess={handleListTokenSuccess}
          signer={signer}
          initialTokenAddress={newTokenAddress}
        />
      )}

      {showMarketplace && signer && (
        <Marketplace
          onClose={() => setShowMarketplace(false)}
          signer={signer}
          key={showMarketplace ? 'marketplace-mounted' : 'marketplace-unmounted'}
          selectedListingId={selectedListingId}
        />
      )}

      {showBuyPRDX && (
        <BuyPRDX onClose={() => setShowBuyPRDX(false)} />
      )}

      {showSoldTokenPage && signer && (
        <SoldTokenPage onClose={() => setShowSoldTokenPage(false)} signer={signer} />
      )}

      {showTokenDetailsPage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <TokenDetailsPage
            onClose={() => setShowTokenDetailsPage(false)}
            signer={signer}
            userAddress={walletAddress}
            handleConnectWallet={handleConnectWallet}
          />
        </motion.div>
      )}

      {showAllTokens && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <AllTokensPage
            onClose={() => setShowAllTokens(false)}
            signer={signer}
            userAddress={walletAddress}
            handleConnectWallet={handleConnectWallet}
          />
        </motion.div>
      )}

      {showAddLiquidityPage && signer && selectedListingId !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <AddLiquidityPage
            listingId={selectedListingId}
            onClose={() => {
              setShowAddLiquidityPage(false);
              setSelectedListingId(null);
            }}
            signer={signer}
          />
        </motion.div>
      )}

      {showProfile && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={(e) => {
            e.stopPropagation();
            setShowProfile(false);
          }}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              console.log("Container click intercepted:", e.target);
            }}
          >
            <Profile
              onClose={() => setShowProfile(false)}
              signer={signer}
              userAddress={walletAddress}
            />
          </div>
        </motion.div>
      )}

      {showFeed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <Feed
            onClose={() => setShowFeed(false)}
            signer={signer}
          />
        </motion.div>
      )}

      {showLeaderboard && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <Leaderboard
            onClose={() => setShowLeaderboard(false)}
            signer={signer}
          />
        </motion.div>
      )}

<footer className="border-t border-white/10 py-8 mt-12 bg-black/20 relative z-10">
  <div className="container mx-auto px-4">
    <div className="flex flex-col md:flex-row justify-between items-center">
      <div className="flex items-center mb-4 md:mb-0">
        <img 
          src="https://i.ibb.co/LDt6yJpn/erasebg-transformed.png" 
          alt="PropertyDEX Logo" 
          className="w-12 h-12 md:w-16 md:h-16 mr-2" 
        />
        <span className="font-bold">PropertyDEX</span>
      </div>
            <div className="flex space-x-4 mb-4 md:mb-0">
              <a 
                href="https://tokenization.metalandspaceapp.xyz/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Globe className="w-6 h-6" />
              </a>
              <a 
                href="https://x.com/PreopertiesDex" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </a>
              <a 
                href="https://t.me/PropertiesDex" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-send">
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
              </a>
            </div>
            <div className="text-sm text-gray-400">
              © 2025 PropertyDEX. All rights reserved.
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-gray-500 text-center">
              Disclaimer: PropertyDEX is a decentralized platform for tokenizing and trading real estate assets. 
              Users are responsible for conducting their own due diligence before investing. 
              Cryptocurrency and tokenized real estate investments involve significant risks including potential loss of principal. 
              Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;