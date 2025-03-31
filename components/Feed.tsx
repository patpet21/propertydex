import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, MessageSquare, Lock, Wallet, Globe, Twitter, MessageCircle, Copy } from 'lucide-react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

const MARKETPLACE_ADDRESS = '0x338a419639cD3c2089DB55aDEA4b9c47739596f0';
const MARKETPLACE_ABI = [
  "function listingCount() external view returns (uint256)",
  "function getListingBasicDetails(uint256 listingId) external view returns (address seller, address tokenAddress, uint256 amount, uint256 soldAmount, uint256 pricePerShare, address paymentToken)",
  "function getListingAdditionalDetails(uint256 listingId) external view returns (bool active, bool referralActive, uint256 referralPercent, bytes32 referralCode, uint256 endTime, uint256 initialAmount, uint256 referralReserve)",
  "function getListingMetadata(uint256 listingId) external view returns (string projectWebsite, string socialMediaLink, string tokenImageUrl, string telegramUrl, string projectDescription)",
];

const BASE_PROVIDER_URL = "https://mainnet.base.org";

interface Post {
  id: number;
  seller: string;
  tokensSold: string;
  target: string;
  pricePerShare: string;
  tokenImageUrl: string;
  projectWebsite: string;
  socialMediaLink: string;
  telegramUrl: string;
  projectDescription: string;
  active: boolean;
  endTime: number;
  timestamp: string;
  feedback: { wallet: string; feedback: string; timestamp: string }[];
}

interface FeedProps {
  onClose: () => void;
  signer: ethers.Signer | null;
}

const fetchFeedPosts = async (signer: ethers.Signer | null): Promise<Post[]> => {
  try {
    let provider;
    if (!signer && typeof window !== 'undefined' && window.ethereum) {
      provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      signer = await provider.getSigner();
    } else if (!signer) {
      provider = new ethers.JsonRpcProvider(BASE_PROVIDER_URL);
      signer = null;
    } else {
      provider = signer.provider;
    }

    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer || provider);
    const totalListings = Number(await marketplace.listingCount());
    const posts: Post[] = [];

    const feedbackList = JSON.parse(localStorage.getItem('feedback') || '[]');

    for (let i = 0; i < totalListings; i++) {
      const [seller, , amount, soldAmount, pricePerShare] = await marketplace.getListingBasicDetails(i);
      const [active, , , , endTime, initialAmount] = await marketplace.getListingAdditionalDetails(i);
      const metadata = await marketplace.getListingMetadata(i);
      const currentTime = Math.floor(Date.now() / 1000);

      const endTimeNumber = Number(endTime);

      if (
        (endTimeNumber > currentTime || (endTimeNumber < currentTime && active)) &&
        metadata.tokenImageUrl &&
        metadata.tokenImageUrl.trim() !== ""
      ) {
        const projectFeedback = feedbackList.filter((fb: any) => fb.wallet.toLowerCase() === seller.toLowerCase());

        posts.push({
          id: i,
          seller,
          tokensSold: ethers.formatUnits(soldAmount, 18),
          target: ethers.formatUnits(initialAmount, 18),
          pricePerShare: ethers.formatUnits(pricePerShare, 18),
          tokenImageUrl: metadata.tokenImageUrl,
          projectWebsite: metadata.projectWebsite || '',
          socialMediaLink: metadata.socialMediaLink || '',
          telegramUrl: metadata.telegramUrl || '',
          projectDescription: metadata.projectDescription || '',
          active,
          endTime: endTimeNumber,
          timestamp: new Date(endTimeNumber * 1000).toISOString(),
          feedback: projectFeedback,
        });
      }
    }

    return posts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error: any) {
    console.error("Error fetching feed posts:", error);
    toast.error(`Failed to load feed: ${error.message}`);
    return [];
  }
};

export default function Feed({ onClose, signer: propSigner }: FeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [signer, setSigner] = useState<ethers.Signer | null>(propSigner);

  useEffect(() => {
    if (signer || (typeof window !== 'undefined' && window.ethereum)) {
      const loadFeed = async () => {
        setLoading(true);
        const feedData = await fetchFeedPosts(signer);
        setPosts(feedData);
        setLoading(false);
      };
      loadFeed();
    }
  }, [signer]);

  useEffect(() => {
    const handleStorageChange = () => {
      const loadFeed = async () => {
        const feedData = await fetchFeedPosts(signer);
        setPosts(feedData);
      };
      loadFeed();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [signer]);

  const handleConnectWallet = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const newSigner = await provider.getSigner();
      setSigner(newSigner);
    } catch (error) {
      toast.error("Failed to connect wallet");
    }
  };

  const handleCopyWallet = (wallet: string) => {
    navigator.clipboard.writeText(wallet).then(() => {
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
      className="fixed inset-0 bg-gray-900/80 backdrop-blur-lg flex items-center justify-center p-6 z-50"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-gray-800/95 backdrop-blur-xl rounded-3xl p-8 max-w-4xl w-full border border-gray-600 shadow-2xl"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-4xl font-bold text-green-300 flex items-center">
            <MessageSquare className="w-10 h-10 mr-4" /> Feed
          </h2>
          <button onClick={onClose} className="text-gray-300 hover:text-green-200 transition-colors">
            <X className="w-10 h-10" />
          </button>
        </div>

        {!signer && typeof window !== 'undefined' && window.ethereum ? (
          <div className="text-center py-20">
            <Lock className="w-28 h-28 text-green-400 mx-auto mb-8 animate-pulse" />
            <p className="text-2xl text-green-200 mb-8">Connect your wallet to view feed</p>
            <button
              onClick={handleConnectWallet}
              className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-xl flex items-center justify-center font-semibold transition-colors shadow-md"
            >
              <Wallet className="w-6 h-6 mr-3" /> Connect Wallet
            </button>
          </div>
        ) : loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-green-400 mx-auto"></div>
            <p className="mt-8 text-green-300 text-xl">Loading feed...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-gray-300">
            <p className="text-xl">No posts available.</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 gap-8 max-h-[70vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-700"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            {posts.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.05, boxShadow: "0 12px 30px rgba(0, 0, 0, 0.4)" }}
                className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-6 transition-all duration-300"
                style={{
                  border: "2px solid",
                  borderImage: "linear-gradient(to right, #34d399, #059669) 1",
                }}
              >
                <div className="flex items-center space-x-6">
                  <img
                    src={post.tokenImageUrl || "https://via.placeholder.com/50"}
                    alt={`Project ${post.id}`}
                    className="w-16 h-16 rounded-full object-cover shadow-md"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xl font-semibold text-gray-100">Project #{post.id}</p>
                        <div className="flex items-center space-x-3">
                          <p className="text-sm text-gray-400">
                            Created by: {post.seller.slice(0, 6)}...{post.seller.slice(-4)}
                          </p>
                          <button
                            onClick={() => handleCopyWallet(post.seller)}
                            className="text-gray-400 hover:text-green-400 transition-colors"
                            title="Copy wallet address"
                          >
                            <Copy className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 mb-1">
                      Sold: {post.tokensSold} / {post.target} | Price per Share: {post.pricePerShare} USDC
                    </p>
                    <p className="text-sm text-gray-300 mb-3">
                      Status: {post.active ? "Active" : "Inactive"} | Ends: {new Date(post.endTime * 1000).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-100 mb-4 italic">{post.projectDescription || "No description available."}</p>
                    <div className="flex space-x-4">
                      {post.projectWebsite && (
                        <a
                          href={post.projectWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#34d399] hover:text-[#2ea77f] transition-colors"
                          title="Visit project website"
                        >
                          <Globe className="w-6 h-6" />
                        </a>
                      )}
                      {post.socialMediaLink && (
                        <a
                          href={post.socialMediaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#1DA1F2] hover:text-[#0d8bdc] transition-colors"
                          title="Visit Twitter"
                        >
                          <Twitter className="w-6 h-6" />
                        </a>
                      )}
                      {post.telegramUrl && (
                        <a
                          href={post.telegramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0088cc] hover:text-[#006b9e] transition-colors"
                          title="Join Telegram"
                        >
                          <MessageCircle className="w-6 h-6" />
                        </a>
                      )}
                    </div>
                    {post.feedback && post.feedback.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-green-300 mb-2">Feedback:</h4>
                        <ul className="text-sm text-gray-300 space-y-3">
                          {post.feedback.map((fb, idx) => (
                            <li key={idx} className="bg-gray-600/30 p-3 rounded-lg shadow-sm">
                              <p className="text-gray-100">{fb.feedback}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                By {fb.wallet.slice(0, 6)}...{fb.wallet.slice(-4)} on {new Date(fb.timestamp).toLocaleString()}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}