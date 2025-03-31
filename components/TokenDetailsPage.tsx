import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, ShoppingCart, Trash2, Copy, Wallet, Globe, Twitter, MessageCircle, Gift } from 'lucide-react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, TimeScale, Title, Tooltip, Legend } from 'chart.js';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import 'chartjs-adapter-date-fns';
import { Chart } from 'react-chartjs-2';

const MARKETPLACE_ADDRESS = '0x338a419639cD3c2089DB55aDEA4b9c47739596f0';
const PRDX_TOKEN_ADDRESS = '0x61Dd008F1582631Aa68645fF92a1a5ECAedBeD19';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const MARKETPLACE_ABI = [
  "function listToken(address tokenAddress, uint256 amountHuman, uint256 pricePerShareHuman, address paymentToken, bool referralActive, uint256 referralPercent, (string projectWebsite, string socialMediaLink, string tokenImageUrl, string telegramUrl, string projectDescription) metadata, uint256 durationInSeconds) external",
  "function buyToken(uint256 listingId, uint256 amountHuman, bytes32 referralCode) external",
  "function cancelListing(uint256 listingId) external",
  "function listingCount() external view returns (uint256)",
  "function getListingMainDetails(uint256 listingId) external view returns (address seller, address tokenAddress, uint256 amount, uint256 pricePerShare, address paymentToken, bool active, bool referralActive, uint256 referralPercent, bytes32 referralCode, uint256 endTime)",
  "function getListingMetadata(uint256 listingId) external view returns (string projectWebsite, string socialMediaLink, string tokenImageUrl, string telegramUrl, string projectDescription)",
  "function generateBuyerReferralCode(uint256 listingId) external returns (bytes32)"
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
  "function allowance(address owner, address spender) external view returns (uint256)"
];

// Registra i componenti di Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  CandlestickController,
  CandlestickElement
);

interface TokenDetailsPageProps {
  onClose: () => void;
  signer: ethers.Signer | null;
  handleConnectWallet: () => Promise<void>;
}

interface Listing {
  id: number;
  seller: string;
  token: { address: string; name: string; symbol: string; amount: string; pricePerShare: string; decimals: number };
  paymentToken: string;
  paymentTokenSymbol: string;
  paymentDecimals: number;
  active: boolean;
  projectWebsite: string;
  socialMediaLink: string;
  imageUrl: string;
  websiteUrl: string;
  twitterUrl: string;
  telegramUrl: string;
  projectDescription: string;
  referralActive: boolean;
  referralPercent: number;
  referralCode: string;
  endTime: number;
}

async function getListings(provider: ethers.Provider): Promise<Listing[]> {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, provider);
    const listingCount = await marketplace.listingCount();
    const listings: Listing[] = [];

    for (let i = 0; i < Number(listingCount); i++) {
      try {
        const [mainDetails, metadata] = await Promise.all([
          marketplace.getListingMainDetails(i),
          marketplace.getListingMetadata(i)
        ]);

        const token = new ethers.Contract(mainDetails.tokenAddress, TOKEN_ABI, provider);
        const [name, symbol, decimals] = await Promise.all([token.name(), token.symbol(), token.decimals()]);

        const paymentToken = new ethers.Contract(mainDetails.paymentToken, TOKEN_ABI, provider);
        const [paymentTokenSymbol, paymentDecimals] = await Promise.all([paymentToken.symbol(), paymentToken.decimals()]);

        listings.push({
          id: i,
          seller: mainDetails.seller,
          token: {
            address: mainDetails.tokenAddress,
            name,
            symbol,
            amount: mainDetails.amount.toString(),
            pricePerShare: mainDetails.pricePerShare.toString(),
            decimals: Number(decimals),
          },
          paymentToken: mainDetails.paymentToken,
          paymentTokenSymbol,
          paymentDecimals: Number(paymentDecimals),
          active: mainDetails.active,
          projectWebsite: metadata.projectWebsite,
          socialMediaLink: metadata.socialMediaLink,
          imageUrl: metadata.tokenImageUrl,
          websiteUrl: metadata.projectWebsite,
          twitterUrl: metadata.socialMediaLink,
          telegramUrl: metadata.telegramUrl,
          projectDescription: metadata.projectDescription,
          referralActive: mainDetails.referralActive,
          referralPercent: Number(mainDetails.referralPercent),
          referralCode: ethers.decodeBytes32String(mainDetails.referralCode),
          endTime: Number(mainDetails.endTime),
        });
      } catch (error) {
        console.error(`Error processing listing ${i}:`, error);
      }
    }

    return listings;
  } catch (error: any) {
    console.error('Error getting listings:', error);
    throw new Error(`Failed to get listings: ${error.message}`);
  }
}

async function buyTokens(listingId: number, amount: string, signer: ethers.Signer, referralCode?: string) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const mainDetails = await marketplace.getListingMainDetails(listingId);

    const paymentToken = new ethers.Contract(mainDetails.paymentToken, TOKEN_ABI, signer);
    const paymentDecimals = await paymentToken.decimals();
    const totalCostRaw = ethers.parseUnits(
      (parseFloat(amount) * parseFloat(ethers.formatUnits(mainDetails.pricePerShare, paymentDecimals))).toString(),
      paymentDecimals
    );

    const userAddress = await signer.getAddress();
    const paymentBalance = await paymentToken.balanceOf(userAddress);
    if (paymentBalance < totalCostRaw) throw new Error('Insufficient payment token balance');

    const allowance = await paymentToken.allowance(userAddress, MARKETPLACE_ADDRESS);
    if (allowance < totalCostRaw) {
      console.log('Approving payment token...');
      const approveTx = await paymentToken.approve(MARKETPLACE_ADDRESS, ethers.MaxUint256);
      await approveTx.wait();
      console.log('Payment token approval confirmed');
    }

    const defaultReferralCode = ethers.encodeBytes32String('default_to_fee_recipient');
    const referralCodeBytes32 = referralCode ? ethers.encodeBytes32String(referralCode) : defaultReferralCode;

    console.log('Executing buyToken...');
    const amountRaw = ethers.parseUnits(amount, await new ethers.Contract(mainDetails.tokenAddress, TOKEN_ABI, signer).decimals());
    const tx = await marketplace.buyToken(listingId, amountRaw, referralCodeBytes32);
    const receipt = await tx.wait();
    console.log('Purchase confirmed:', receipt.hash);
    return receipt;
  } catch (error: any) {
    console.error('Detailed error in buyTokens:', error);
    throw new Error(`Failed to buy tokens: ${error.message}${error.reason ? ` - ${error.reason}` : ''}`);
  }
}

async function cancelListing(listingId: number, signer: ethers.Signer) {
  try {
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);
    const tx = await marketplace.cancelListing(listingId);
    return await tx.wait();
  } catch (error: any) {
    throw new Error(`Failed to cancel listing: ${error.message}`);
  }
}

const normalizeDecimal = (value: string): string => {
  return value.replace(',', '.').replace(/[^0-9.]/g, '');
};

export default function TokenDetailsPage({ onClose, signer, handleConnectWallet }: TokenDetailsPageProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyPrompt, setBuyPrompt] = useState<{
    visible: boolean;
    listing: Listing | null;
    amount: string;
    referralCode: string;
    amountError: string | null;
  }>({
    visible: false,
    listing: null,
    amount: '',
    referralCode: '',
    amountError: null,
  });
  const [connectPrompt, setConnectPrompt] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const chartRefs = useRef<Map<number, ChartJS>>(new Map());

  useEffect(() => {
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    loadListings(provider);
    if (signer) {
      const interval = setInterval(() => loadListings(provider), 60000);
      return () => {
        clearInterval(interval);
        chartRefs.current.forEach((chart) => chart.destroy());
        chartRefs.current.clear();
      };
    }
  }, [signer]);

  useEffect(() => {
    const fetchUserAddress = async () => {
      if (signer) {
        try {
          const address = await signer.getAddress();
          setUserAddress(address.toLowerCase());
        } catch (error) {
          console.error('Error retrieving user address:', error);
        }
      } else {
        setUserAddress(null);
      }
    };
    fetchUserAddress();
  }, [signer]);

  const loadListings = async (provider: ethers.Provider) => {
    try {
      setLoading(true);
      const allListings = await getListings(provider);
      const currentTime = Math.floor(Date.now() / 1000);
      const activeListings = allListings.filter(
        (listing) => listing.active && listing.endTime > currentTime && parseFloat(listing.token.amount) > 0
      );
      setListings(activeListings);
      console.log('Loaded listings:', activeListings);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load token details.');
    } finally {
      setLoading(false);
    }
  };

  const generateChartData = (listing: Listing) => {
    if (!listing) return null;

    const dataPoints = [];
    const currentTime = Math.floor(Date.now() / 1000);
    const timeWindow = 24 * 3600; // 24 ore
    const steps = 24; // Un punto per ora
    const stepSize = timeWindow / steps;

    for (let i = 0; i <= steps; i++) {
      const time = currentTime - (timeWindow - i * stepSize);
      const basePrice = parseFloat(ethers.formatUnits(listing.token.pricePerShare, listing.paymentDecimals));
      const open = basePrice * (1 - Math.random() * 0.02);
      const close = basePrice * (1 + Math.random() * 0.02);
      const high = Math.max(open, close) * 1.01;
      const low = Math.min(open, close) * 0.99;
      dataPoints.push({
        x: new Date(time * 1000),
        o: open,
        h: high,
        l: low,
        c: close,
      });
    }

    return {
      datasets: [
        {
          label: `Price (${listing.paymentTokenSymbol})`,
          data: dataPoints,
          type: 'candlestick' as const,
          borderColor: 'rgba(0, 255, 234, 1)',
          backgroundColor: 'rgba(0, 255, 234, 0.2)',
          borderWidth: 1,
        },
      ],
    };
  };

  const handleBuy = (listing: Listing) => {
    if (!signer) {
      setConnectPrompt(true);
      return;
    }
    setBuyPrompt({ visible: true, listing, amount: '', referralCode: '', amountError: null });
  };

  const handleCancel = async (listingId: number) => {
    if (!signer) {
      setConnectPrompt(true);
      return;
    }
    try {
      setLoading(true);
      await cancelListing(listingId, signer);
      toast.success('Listing cancelled successfully!');
      loadListings(new ethers.JsonRpcProvider('https://mainnet.base.org'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDetails = (listing: Listing) => {
    setSelectedListing(listing);
    setShowDetails(true);
  };

  const handleCancelBuy = () => {
    setBuyPrompt({ visible: false, listing: null, amount: '', referralCode: '', amountError: null });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = normalizeDecimal(e.target.value);
    const maxAmount = parseFloat(ethers.formatUnits(buyPrompt.listing?.token.amount || '0', buyPrompt.listing?.token.decimals || 18));
    setBuyPrompt((prev) => ({ ...prev, amount: value }));

    if (value === '') {
      setBuyPrompt((prev) => ({ ...prev, amountError: null }));
      return;
    }

    const amountFloat = parseFloat(value);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      setBuyPrompt((prev) => ({ ...prev, amountError: 'Amount must be greater than 0' }));
    } else if (amountFloat > maxAmount) {
      setBuyPrompt((prev) => ({ ...prev, amountError: `Amount cannot exceed ${maxAmount.toFixed(6)}` }));
    } else {
      setBuyPrompt((prev) => ({ ...prev, amountError: null }));
    }
  };

  const handleReferralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBuyPrompt((prev) => ({ ...prev, referralCode: e.target.value }));
  };

  const handleConfirmPurchase = async () => {
    const { listing, amount, referralCode, amountError } = buyPrompt;
    if (!listing || !amount || parseFloat(amount) <= 0 || amountError) {
      toast.error(amountError || 'Please enter a valid amount');
      return;
    }
    if (!signer) {
      setConnectPrompt(true);
      return;
    }
    try {
      setLoading(true);
      await buyTokens(listing.id, amount, signer, referralCode || undefined);
      toast.success('Purchase successful!');
      setBuyPrompt({ visible: false, listing: null, amount: '', referralCode: '', amountError: null });
      loadListings(new ethers.JsonRpcProvider('https://mainnet.base.org'));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
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

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const, labels: { color: '#00ffea' } },
      title: { display: true, text: 'Price Trend (24h)', color: '#00ffea' },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: { unit: 'hour' as const },
        title: { display: true, text: 'Time', color: '#00ffea' },
        ticks: { color: '#00ffea' },
      },
      y: {
        title: { display: true, text: 'Price', color: '#00ffea' },
        ticks: { color: '#00ffea' },
      },
    },
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      >
        <div className="bg-gray-800 backdrop-blur-sm rounded-xl p-6 shadow-lg max-w-md w-full">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading token details...</p>
          </div>
        </div>
      </motion.div>
    );
  }

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
        className="bg-gradient-to-b from-gray-900 to-black rounded-xl p-6 max-w-4xl w-full border border-white/10 shadow-2xl"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Token Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {listings.length === 0 ? (
          <p className="text-gray-400 text-center">No active listings available.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => {
              const chartData = generateChartData(listing);
              const price = ethers.formatUnits(listing.token.pricePerShare, listing.paymentDecimals);

              return (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-primary-500"
                >
                  <div className="flex items-center mb-2">
                    <img
                      src={listing.imageUrl || 'https://via.placeholder.com/50'}
                      alt={listing.token.name}
                      className="w-12 h-12 rounded-full mr-3"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/50';
                      }}
                    />
                    <div>
                      <h3 className="text-sm font-semibold text-primary-300">{listing.token.name}</h3>
                      <p className="text-xs text-gray-400 break-all">
                        Token Address:{' '}
                        {listing.token.address ? `${listing.token.address.slice(0, 6)}...${listing.token.address.slice(-4)}` : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="mb-2">
                    <p className="text-xs text-gray-400">Status:</p>
                    <p className="text-xs text-green-400">{getTimeRemaining(listing.endTime)} Active</p>
                    {userAddress && listing.seller.toLowerCase() === userAddress && (
                      <span className="text-xs text-yellow-400 ml-2">Your Listing</span>
                    )}
                    {listing.referralActive && (
                      <span className="text-xs text-purple-400 ml-2">Referral {listing.referralPercent}%</span>
                    )}
                  </div>
                  <div className="mb-2">
                    <p className="text-xs text-gray-400">Price:</p>
                    <p className="text-sm text-white">{parseFloat(price).toFixed(6)} {listing.paymentTokenSymbol}</p>
                  </div>
                  <div className="h-32 mb-2">
                    {chartData ? (
                      <Chart
                        type="candlestick"
                        data={chartData}
                        options={options}
                        ref={(chartInstance) => {
                          if (chartInstance) {
                            chartRefs.current.set(listing.id, chartInstance.chartInstance);
                          }
                        }}
                      />
                    ) : (
                      <p className="text-gray-400 text-center">No chart data</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {userAddress && listing.seller.toLowerCase() !== userAddress && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleBuy(listing)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2 py-1 text-xs"
                      >
                        Buy
                      </motion.button>
                    )}
                    {userAddress && listing.seller.toLowerCase() === userAddress && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCancel(listing.id)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-2 py-1 text-xs"
                      >
                        Cancel
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDetails(listing)}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white rounded-lg px-2 py-1 text-xs"
                    >
                      Details
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {buyPrompt.visible && buyPrompt.listing && (
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
                <h3 className="text-xl font-semibold text-white">Buy {buyPrompt.listing.token.name} Tokens</h3>
                <button onClick={handleCancelBuy} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {buyPrompt.listing.referralActive && (
                <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-3 mb-4">
                  <div className="flex items-start">
                    <Gift className="w-5 h-5 text-purple-400 mt-0.5 mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-purple-300">Referral Purchase</p>
                      <p className="text-xs text-gray-300">
                        This listing has a {buyPrompt.listing.referralPercent}% referral reward!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Amount to Buy</label>
                  <input
                    type="text"
                    value={buyPrompt.amount}
                    onChange={handleAmountChange}
                    placeholder="Enter amount"
                    className={`w-full bg-white/5 border ${
                      buyPrompt.amountError ? 'border-red-500' : 'border-white/10'
                    } rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500`}
                  />
                  {buyPrompt.amountError && <p className="text-sm text-red-400 mt-1">{buyPrompt.amountError}</p>}
                </div>
                <div className="bg-white/5 p-3 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Available:</span>
                    <span className="text-white">
                      {parseFloat(ethers.formatUnits(buyPrompt.listing.token.amount, buyPrompt.listing.token.decimals)).toFixed(
                        6
                      )}{' '}
                      tokens
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Price per token:</span>
                    <span className="font-medium">
                      {parseFloat(
                        ethers.formatUnits(buyPrompt.listing.token.pricePerShare, buyPrompt.listing.paymentDecimals)
                      ).toFixed(6)}{' '}
                      {buyPrompt.listing.paymentTokenSymbol}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-gray-400">Total Cost:</span>
                    <span className="font-medium text-primary-300">
                      {buyPrompt.amount && !buyPrompt.amountError
                        ? `${(
                            parseFloat(buyPrompt.amount) *
                            parseFloat(
                              ethers.formatUnits(buyPrompt.listing.token.pricePerShare, buyPrompt.listing.paymentDecimals)
                            )
                          ).toFixed(6)} ${buyPrompt.listing.paymentTokenSymbol}`
                        : '-'}
                    </span>
                  </div>
                </div>

                {buyPrompt.listing.referralActive && (
                  <div className="bg-purple-500/10 p-3 rounded-lg border border-purple-500/30">
                    <p className="text-sm text-purple-300 mb-2 flex items-center">
                      <Gift className="w-4 h-4 mr-1" />
                      <span>This listing has a {buyPrompt.listing.referralPercent}% referral reward!</span>
                    </p>
                    <div>
                      <label className="block text-xs text-gray-300 mb-1">Referral Code (optional)</label>
                      <input
                        type="text"
                        value={buyPrompt.referralCode}
                        onChange={handleReferralChange}
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
                    onClick={handleCancelBuy}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-primary-600 hover:bg-primary-700 transition-colors rounded-lg py-2 flex items-center justify-center"
                    onClick={handleConfirmPurchase}
                    disabled={!!buyPrompt.amountError || !buyPrompt.amount}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Confirm Purchase
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {connectPrompt && !signer && (
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
              className="bg-gradient-to-b from-gray-900 to-black rounded-xl p-6 max-w-sm w-full border border-white/10 shadow-2xl"
            >
              <div className="text-center">
                <Wallet className="w-12 h-12 text-primary-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h3>
                <p className="text-gray-300 mb-6">
                  Please connect your wallet to buy tokens or manage listings.
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={async () => {
                    try {
                      await handleConnectWallet();
                      setConnectPrompt(false);
                    } catch (error) {
                      toast.error('Failed to connect wallet');
                    }
                  }}
                  className="bg-primary-600 hover:bg-primary-700 transition-colors px-6 py-2 rounded-lg flex items-center mx-auto"
                >
                  <Wallet className="w-5 h-5 mr-2" />
                  Connect Wallet
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setConnectPrompt(false)}
                  className="mt-4 text-sm text-gray-400 hover:text-white"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showDetails && selectedListing && (
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
                <h3 className="text-xl font-semibold text-white">{selectedListing.token.name} Details</h3>
                <button onClick={() => setShowDetails(false)} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400">Token Address:</p>
                  <div className="flex items-center">
                    <p className="text-sm text-primary-300 break-all mr-2">{selectedListing.token.address}</p>
                    <button onClick={() => copyToClipboard(selectedListing.token.address)} className="text-gray-400 hover:text-white">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Price:</p>
                  <p className="text-sm text-white">
                    {parseFloat(ethers.formatUnits(selectedListing.token.pricePerShare, selectedListing.paymentDecimals)).toFixed(
                      6
                    )}{' '}
                    {selectedListing.paymentTokenSymbol}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Available:</p>
                  <p className="text-sm text-white">
                    {parseFloat(ethers.formatUnits(selectedListing.token.amount, selectedListing.token.decimals)).toFixed(6)}{' '}
                    {selectedListing.token.symbol}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Time Remaining:</p>
                  <p className="text-sm text-gray-300">{getTimeRemaining(selectedListing.endTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Project Description:</p>
                  <p className="text-sm text-gray-300">{selectedListing.projectDescription || 'No description provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Links:</p>
                  <div className="space-y-2">
                    {selectedListing.websiteUrl && (
                      <a
                        href={selectedListing.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-primary-400 hover:text-primary-300 text-sm"
                      >
                        <Globe className="w-4 h-4 mr-1" />
                        Website
                      </a>
                    )}
                    {selectedListing.twitterUrl && (
                      <a
                        href={selectedListing.twitterUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-primary-400 hover:text-primary-300 text-sm"
                      >
                        <Twitter className="w-4 h-4 mr-1" />
                        Twitter
                      </a>
                    )}
                    {selectedListing.telegramUrl && (
                      <a
                        href={selectedListing.telegramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-primary-400 hover:text-primary-300 text-sm"
                      >
                        <MessageCircle className="w-4 h-4 mr-1" />
                        Telegram
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}