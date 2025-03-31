import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Award, RefreshCw, Lock, Wallet, Globe, Twitter, MessageCircle, Copy } from 'lucide-react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

const MARKETPLACE_ADDRESS = '0x338a419639cD3c2089DB55aDEA4b9c47739596f0';
const MARKETPLACE_ABI = [
  "function listingCount() external view returns (uint256)",
  "function getListingBasicDetails(uint256 listingId) external view returns (address seller, address tokenAddress, uint256 amount, uint256 soldAmount, uint256 pricePerShare, address paymentToken)",
  "function getListingAdditionalDetails(uint256 listingId) external view returns (bool active, bool referralActive, uint256 referralPercent, bytes32 referralCode, uint256 endTime, uint256 initialAmount, uint256 referralReserve)",
  "function getListingMetadata(uint256 listingId) external view returns (string projectWebsite, string socialMediaLink, string tokenImageUrl, string telegramUrl, string projectDescription)",
];

// Fallback provider URL for Base Mainnet
const BASE_PROVIDER_URL = "https://mainnet.base.org";

interface Leader {
  address: string;
  totalTokensSold: number;
  projectCount: number;
  socialMedia: {
    website: string;
    socialMediaLink: string;
    telegram: string;
  };
}

interface LeaderboardProps {
  onClose: () => void;
  signer: ethers.Signer | null;
}

const fetchLeaderboard = async (signer: ethers.Signer | null): Promise<Leader[]> => {
  try {
    let provider;
    console.log("Checking window.ethereum:", typeof window !== 'undefined' ? window.ethereum : 'undefined');
    if (!signer && typeof window !== 'undefined' && window.ethereum) {
      provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      signer = await provider.getSigner();
    } else if (!signer) {
      provider = new ethers.JsonRpcProvider(BASE_PROVIDER_URL);
      signer = null; // Use read-only for fallback
    } else {
      provider = signer.provider;
    }

    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer || provider);
    const totalListings = Number(await marketplace.listingCount());
    const creatorStats = new Map<string, { totalTokensSold: number, projectCount: number, socialMedia: { website: string, socialMediaLink: string, telegram: string } }>();

    for (let i = 0; i < totalListings; i++) {
      const [seller, , , soldAmount] = await marketplace.getListingBasicDetails(i);
      const [, , , , endTime, initialAmount] = await marketplace.getListingAdditionalDetails(i);
      const metadata = await marketplace.getListingMetadata(i);

      const sold = parseFloat(ethers.formatUnits(soldAmount, 18));
      const currentTime = Math.floor(Date.now() / 1000);

      if (creatorStats.has(seller)) {
        const existing = creatorStats.get(seller)!;
        creatorStats.set(seller, {
          totalTokensSold: existing.totalTokensSold + sold,
          projectCount: existing.projectCount + 1,
          socialMedia: {
            website: metadata.projectWebsite || existing.socialMedia.website,
            socialMediaLink: metadata.socialMediaLink || existing.socialMedia.socialMediaLink,
            telegram: metadata.telegramUrl || existing.socialMedia.telegram,
          },
        });
      } else {
        creatorStats.set(seller, {
          totalTokensSold: sold,
          projectCount: 1,
          socialMedia: {
            website: metadata.projectWebsite || '',
            socialMediaLink: metadata.socialMediaLink || '',
            telegram: metadata.telegramUrl || '',
          },
        });
      }
    }

    return Array.from(creatorStats.entries())
      .sort((a, b) => b[1].totalTokensSold - a[1].totalTokensSold)
      .slice(0, 5)
      .map(([address, stats]) => ({
        address,
        totalTokensSold: Math.round(stats.totalTokensSold),
        projectCount: stats.projectCount,
        socialMedia: stats.socialMedia,
      }));
  } catch (error: any) {
    console.error("Error fetching leaderboard:", error);
    toast.error(`Failed to load leaderboard: ${error.message}`);
    return [];
  }
};

export default function Leaderboard({ onClose, signer: propSigner }: LeaderboardProps) {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [signer, setSigner] = useState<ethers.Signer | null>(propSigner);

  useEffect(() => {
    if (signer || (typeof window !== 'undefined' && window.ethereum)) {
      const loadLeaderboard = async () => {
        setLoading(true);
        const leaderboardData = await fetchLeaderboard(signer);
        setLeaders(leaderboardData);
        setLoading(false);
      };
      loadLeaderboard();
      const interval = setInterval(loadLeaderboard, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [signer]);

  const handleRefresh = () => {
    if (signer || (typeof window !== 'undefined' && window.ethereum)) {
      toast.success("Refreshing leaderboard...");
      const loadLeaderboard = async () => {
        const leaderboardData = await fetchLeaderboard(signer);
        setLeaders(leaderboardData);
      };
      loadLeaderboard();
    }
  };

  const handleCopyWallet = (walletAddress: string) => {
    navigator.clipboard.writeText(walletAddress).then(() => {
      toast.success("Wallet address copied to clipboard!");
    }).catch((err) => {
      toast.error("Failed to copy address");
      console.error("Copy failed:", err);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gray-900/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-gray-800/90 backdrop-blur-lg rounded-2xl p-6 max-w-3xl w-full border border-gray-700 shadow-lg"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-semibold text-yellow-100 flex items-center">
            <Award className="w-8 h-8 mr-3 text-yellow-300" /> Leaderboard
          </h2>
          <div className="flex items-center space-x-6">
            <button
              onClick={handleRefresh}
              className="bg-gray-700 hover:bg-gray-600 text-yellow-300 p-3 rounded-xl transition-colors flex items-center"
              aria-label="Refresh"
            >
              <RefreshCw className="w-6 h-6" />
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-yellow-200">
              <X className="w-8 h-8" />
            </button>
          </div>
        </div>

        {!signer && typeof window !== 'undefined' && window.ethereum ? (
          <div className="text-center py-16">
            <Lock className="w-24 h-24 text-yellow-300 mx-auto mb-6 animate-pulse" />
            <p className="text-xl text-yellow-100 mb-6">Connect your wallet to view leaderboard</p>
            <button
              onClick={handleConnectWallet}
              className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-3 rounded-xl flex items-center justify-center font-medium transition-colors"
            >
              <Wallet className="w-6 h-6 mr-2" /> Connect Wallet
            </button>
          </div>
        ) : loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-yellow-300 mx-auto"></div>
            <p className="mt-6 text-yellow-100 text-lg">Loading leaderboard...</p>
          </div>
        ) : leaders.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">No data available.</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 gap-6 max-h-[65vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            {leaders.map((leader, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.03, boxShadow: "0 8px 20px rgba(0, 0, 0, 0.3)" }}
                className="rounded-xl p-6 transition-all flex items-center justify-between"
                style={{
                  border: "2px solid",
                  borderImage: index === 0
                    ? "linear-gradient(to right, #facc15, #eab308) 1"
                    : index === 1
                    ? "linear-gradient(to right, #d1d5db, #9ca3af) 1"
                    : index === 2
                    ? "linear-gradient(to right, #f97316, #ea580c) 1"
                    : "linear-gradient(to right, #6b7280, #4b5563) 1",
                  background: "linear-gradient(135deg, #1f2937 0%, #111827 100%)",
                }}
              >
                <div className="flex items-center space-x-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-700">
                    {index === 0 && <Award className="w-8 h-8 text-yellow-300" />}
                    {index === 1 && <Award className="w-8 h-8 text-gray-400" />}
                    {index === 2 && <Award className="w-8 h-8 text-orange-400" />}
                    {index > 2 && <span className="text-xl font-bold text-yellow-300">{index + 1}</span>}
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-lg font-medium text-gray-200">
                      {leader.address.slice(0, 6)}...{leader.address.slice(-4)}
                    </span>
                    <button
                      onClick={() => handleCopyWallet(leader.address)}
                      className="text-gray-400 hover:text-yellow-200 ml-2"
                      title="Copy wallet address"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex flex-col ml-6">
                    <div className="flex space-x-3">
                      {leader.socialMedia.website && (
                        <a href={leader.socialMedia.website} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-200">
                          <Globe className="w-5 h-5" />
                        </a>
                      )}
                      {leader.socialMedia.socialMediaLink && (
                        <a href={leader.socialMedia.socialMediaLink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-200">
                          <Twitter className="w-5 h-5" />
                        </a>
                      )}
                      {leader.socialMedia.telegram && (
                        <a href={leader.socialMedia.telegram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-200">
                          <MessageCircle className="w-5 h-5" />
                        </a>
                      )}
                    </div>
                    <span className="text-sm text-gray-400 mt-1">Projects: {leader.projectCount}</span>
                  </div>
                </div>
                <span className="text-xl font-semibold text-gray-100">{leader.totalTokensSold} Tokens</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );

  async function handleConnectWallet() {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const newSigner = await provider.getSigner();
      setSigner(newSigner);
    } catch (error) {
      toast.error("Failed to connect wallet");
    }
  }
}