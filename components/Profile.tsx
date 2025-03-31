import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, BarChart3, Lock, Wallet, Globe, Twitter, MessageCircle, ExternalLink, ChevronDown, ChevronUp, Send, Copy, TrendingUp, DollarSign } from 'lucide-react';
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
const ETHERSCAN_BASE_URL = "https://basescan.org";

const mockTransactions = (projectId: number) => [
  { id: 1, buyer: `0x${projectId}123...abcd`, amount: "10.5", price: "1.2 USDC", timestamp: new Date().toLocaleString() },
  { id: 2, buyer: `0x${projectId}456...efgh`, amount: "5.0", price: "1.1 USDC", timestamp: new Date(Date.now() - 3600000).toLocaleString() },
  { id: 3, buyer: `0x${projectId}789...ijkl`, amount: "8.0", price: "1.3 USDC", timestamp: new Date(Date.now() - 7200000).toLocaleString() },
];

interface Project {
  id: string;
  seller: string;
  tokenAddress: string;
  tokenImageUrl: string;
  projectWebsite: string;
  socialMediaLink: string;
  telegramUrl: string;
  projectDescription: string;
  amount: string;
  soldAmount: string;
  pricePerShare: string;
  active: boolean;
  endTime: string;
}

interface ProfileData {
  projects: number;
  successRate: string;
  tier: string;
  projectDetails: Project[];
  socialMedia: {
    website: string;
    socialMediaLink: string;
    telegram: string;
  };
}

interface ProfileProps {
  onClose: () => void;
  signer: ethers.Signer | null;
  userAddress: string;
}

const fetchProfileData = async (signer: ethers.Signer | null, walletAddress: string, includeExpired = true): Promise<ProfileData> => {
  try {
    let provider;
    if (typeof window !== 'undefined' && window.ethereum) {
      provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== 8453) {
        throw new Error("Please connect to Base Mainnet (Chain ID: 8453)");
      }
    } else {
      provider = new ethers.JsonRpcProvider(BASE_PROVIDER_URL);
    }
    const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer || provider);

    let totalProjects = 0;
    let totalSold = 0;
    let totalTarget = 0;
    const projectDetails: Project[] = [];
    const socialMedia = { website: '', socialMediaLink: '', telegram: '' };

    const totalListings = Number(await marketplace.listingCount());
    if (totalListings === 0) {
      totalProjects = 1;
      projectDetails.push({
        id: "0",
        seller: walletAddress,
        tokenAddress: "0xMockTokenAddress",
        tokenImageUrl: "https://via.placeholder.com/40",
        projectWebsite: "https://example.com",
        socialMediaLink: "https://twitter.com/example",
        telegramUrl: "https://t.me/example",
        projectDescription: "This is a mock project for testing purposes.",
        amount: "1000",
        soldAmount: "500",
        pricePerShare: "1.0",
        active: true,
        endTime: (Math.floor(Date.now() / 1000) + 86400).toString(),
      });
      totalSold = 500;
      totalTarget = 1000;
    } else {
      for (let i = 0; i < totalListings; i++) {
        const [seller, tokenAddress, amount, soldAmount, pricePerShare] = await marketplace.getListingBasicDetails(i);
        const [active, , , , endTime, initialAmount] = await marketplace.getListingAdditionalDetails(i);
        const metadata = await marketplace.getListingMetadata(i);
        const currentTime = Math.floor(Date.now() / 1000);

        if (
          seller.toLowerCase() === walletAddress.toLowerCase() &&
          (includeExpired || (Number(endTime) > currentTime && initialAmount > 0)) &&
          metadata.tokenImageUrl // Aggiunto filtro per progetti con immagine
        ) {
          totalProjects++;
          totalSold += parseFloat(ethers.formatUnits(soldAmount, 18));
          totalTarget += parseFloat(ethers.formatUnits(initialAmount, 18));

          if (!socialMedia.website && metadata.projectWebsite) socialMedia.website = metadata.projectWebsite;
          if (!socialMedia.socialMediaLink && metadata.socialMediaLink) socialMedia.socialMediaLink = metadata.socialMediaLink;
          if (!socialMedia.telegram && metadata.telegramUrl) socialMedia.telegram = metadata.telegramUrl;

          projectDetails.push({
            id: i.toString(),
            seller,
            tokenAddress,
            tokenImageUrl: metadata.tokenImageUrl || '',
            projectWebsite: metadata.projectWebsite || '',
            socialMediaLink: metadata.socialMediaLink || '',
            telegramUrl: metadata.telegramUrl || '',
            projectDescription: metadata.projectDescription || '',
            amount: ethers.formatUnits(amount, 18),
            soldAmount: ethers.formatUnits(soldAmount, 18),
            pricePerShare: ethers.formatUnits(pricePerShare, 18),
            active,
            endTime: endTime.toString(),
          });
        }
      }
    }

    const successRate = totalTarget > 0 ? (totalSold / totalTarget) * 100 : 0;
    const tier = successRate >= 100 ? "Master" : successRate >= 85 ? "Graduated" : "Base";

    return { projects: totalProjects, successRate: successRate.toFixed(2), tier, projectDetails, socialMedia };
  } catch (error: any) {
    console.error("Error in fetchProfileData:", error);
    toast.error(`Failed to load profile: ${error.message}`);
    return { projects: 0, successRate: "0", tier: "Base", projectDetails: [], socialMedia: { website: '', socialMediaLink: '', telegram: '' } };
  }
};

export default function Profile({ onClose, signer, userAddress }: ProfileProps) {
  const [profile, setProfile] = useState<ProfileData>({ projects: 0, successRate: "0", tier: "Base", projectDetails: [], socialMedia: { website: '', socialMediaLink: '', telegram: '' } });
  const [loading, setLoading] = useState(true);
  const [targetWallet, setTargetWallet] = useState<string>("");
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [showInsightsModal, setShowInsightsModal] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        let effectiveSigner = signer;
        if (!signer && typeof window !== 'undefined' && window.ethereum) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          await provider.send("eth_requestAccounts", []);
          effectiveSigner = await provider.getSigner();
        }
        const profileData = await fetchProfileData(effectiveSigner, targetWallet || userAddress, true);
        setProfile(profileData);
      } catch (error) {
        console.error("Error in useEffect:", error);
        toast.error("Error loading profile data");
      } finally {
        setLoading(false);
      }
    };
    initialize();
  }, [targetWallet, signer]); // Rimosso userAddress per evitare refresh non necessari

  const handleCheckWallet = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTargetWallet(e.target.value);
  };

  const handleCopyWallet = () => {
    navigator.clipboard.writeText(targetWallet || userAddress).then(() => {
      toast.success("Wallet address copied to clipboard!");
    }).catch((err) => {
      toast.error("Failed to copy address");
      console.error("Copy failed:", err);
    });
  };

  const handleSubmitFeedback = () => {
    if (!feedback.trim()) {
      toast.error("Please enter feedback before submitting.");
      return;
    }
    const existingFeedback = JSON.parse(localStorage.getItem('feedback') || '[]');
    const newFeedback = {
      wallet: targetWallet || userAddress,
      feedback,
      timestamp: new Date().toISOString(),
    };
    const updatedFeedback = [newFeedback, ...existingFeedback].slice(0, 50);
    localStorage.setItem('feedback', JSON.stringify(updatedFeedback));
    toast.success("Feedback submitted successfully!");
    setFeedback("");
  };

  const openInsightsModal = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowInsightsModal(projectId);
  };

  const closeInsightsModal = () => {
    setShowInsightsModal(null);
  };

  const toggleProjectDetails = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedProject(expandedProject === projectId ? null : projectId);
  };

  const calculateSalePercentage = (soldAmount: string, totalAmount: string): number => {
    const sold = parseFloat(soldAmount);
    const total = parseFloat(totalAmount);
    if (total === 0 || isNaN(sold) || isNaN(total)) {
      return 0;
    }
    const percentage = (sold / total) * 100;
    return Math.min(percentage, 100);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-gray-800/90 backdrop-blur-lg rounded-2xl p-6 max-w-lg w-full border border-gray-700 shadow-lg overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center items-center mb-6">
          <h2 className="text-3xl font-semibold text-blue-300 flex items-center">
            <BarChart3 className="w-8 h-8 mr-3" /> Creator Profile
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-blue-200 absolute right-6">
            <X className="w-8 h-8" />
          </button>
        </div>

        {!signer && typeof window !== 'undefined' && window.ethereum ? (
          <div className="text-center py-16">
            <Lock className="w-24 h-24 text-blue-400 mx-auto mb-6 animate-pulse" />
            <p className="text-xl text-blue-200 mb-6">Connect your wallet to view profile</p>
            <button
              onClick={async () => {
                try {
                  const provider = new ethers.BrowserProvider(window.ethereum);
                  await provider.send("eth_requestAccounts", []);
                  const newSigner = await provider.getSigner();
                  setProfile(await fetchProfileData(newSigner, targetWallet || userAddress, true));
                } catch (error) {
                  toast.error("Failed to connect wallet");
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center justify-center font-medium transition-colors"
            >
              <Wallet className="w-6 h-6 mr-2" /> Connect Wallet
            </button>
          </div>
        ) : loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-blue-500 mx-auto"></div>
            <p className="mt-6 text-blue-400 text-lg">Loading profile...</p>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-medium text-blue-300 mb-2">Search for a Creator</h3>
              <p className="text-sm text-gray-300 mb-4">
                Enter the wallet address of the creator you want to explore. You can copy the address from the leaderboard by clicking the <Copy className="w-4 h-4 inline mx-1" /> icon next to their name, then paste it below to view their stats and projects.
              </p>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={targetWallet}
                  onChange={handleCheckWallet}
                  placeholder="Enter creator wallet address"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleCopyWallet}
                  className="text-gray-400 hover:text-blue-400"
                  title="Copy current wallet address"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 text-blue-200 mb-6">
              <div className="space-y-4">
                <div className="flex flex-col">
                  <span className="text-blue-400 text-sm">Address:</span>
                  <span className="text-lg">{(targetWallet || userAddress).slice(0, 6)}...{(targetWallet || userAddress).slice(-4)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-blue-400 text-sm">Projects:</span>
                  <span className="text-lg font-bold">{profile.projects}</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex flex-col">
                  <span className="text-blue-400 text-sm">Success Rate:</span>
                  <span className="text-lg font-bold">{profile.successRate}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-blue-400 text-sm">Tier:</span>
                  <span
                    className={`text-lg font-bold ${
                      profile.tier === "Master" ? "text-green-400" : profile.tier === "Graduated" ? "text-yellow-400" : "text-blue-200"
                    }`}
                  >
                    {profile.tier}
                  </span>
                </div>
              </div>
              <div className="col-span-2 mt-4">
                <div className="w-full bg-gray-700 rounded-full h-4">
                  <div
                    className="bg-blue-500 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(parseFloat(profile.successRate), 100)}%` }}
                  ></div>
                </div>
                <p className="text-sm text-blue-400 mt-2">Progress to Master Tier</p>
              </div>
            </div>

            {(profile.socialMedia.website || profile.socialMedia.socialMediaLink || profile.socialMedia.telegram) && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-blue-300 mb-2">Creator Social Links</h3>
                <div className="flex space-x-4">
                  {profile.socialMedia.website && (
                    <a href={profile.socialMedia.website} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400">
                      <Globe className="w-6 h-6" />
                    </a>
                  )}
                  {profile.socialMedia.socialMediaLink && (
                    <a href={profile.socialMedia.socialMediaLink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400">
                      <Twitter className="w-6 h-6" />
                    </a>
                  )}
                  {profile.socialMedia.telegram && (
                    <a href={profile.socialMedia.telegram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400">
                      <MessageCircle className="w-6 h-6" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {profile.projectDetails.length > 0 ? (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-blue-300 mb-4">Creator Projects</h3>
                <div className="space-y-4">
                  {profile.projectDetails.map((project) => {
                    const salePercentage = calculateSalePercentage(project.soldAmount, project.amount);
                    return (
                      <div key={project.id} className="bg-gray-700/50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <img
                              src={project.tokenImageUrl || "https://via.placeholder.com/40"}
                              alt={`Project ${project.id}`}
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/40")}
                            />
                            <div>
                              <p className="text-gray-200 font-medium">Project #{project.id}</p>
                              <p className="text-sm text-gray-400">Sold: {project.soldAmount} / {project.amount}</p>
                            </div>
                          </div>
                          <div className="flex space-x-3">
                            <button
                              onClick={(e) => toggleProjectDetails(project.id, e)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg flex items-center transition-colors"
                              type="button"
                            >
                              Details
                              {expandedProject === project.id ? <ChevronUp className="w-5 h-5 ml-1" /> : <ChevronDown className="w-5 h-5 ml-1" />}
                            </button>
                            <button
                              onClick={(e) => openInsightsModal(project.id, e)}
                              className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg flex items-center transition-colors"
                              type="button"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {expandedProject === project.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 bg-gray-600/50 rounded-lg p-4 text-gray-200"
                          >
                            <p className="text-sm mb-2"><strong>Description:</strong> {project.projectDescription || "No description available."}</p>
                            <p className="text-sm mb-2"><strong>Price per Share:</strong> {project.pricePerShare} USDC</p>
                            <p className="text-sm mb-2"><strong>Status:</strong> {project.active ? "Active" : "Inactive"}</p>
                            <p className="text-sm mb-2"><strong>End Time:</strong> {new Date(Number(project.endTime) * 1000).toLocaleString()}</p>
                            <div className="mt-4">
                              <h4 className="text-sm font-medium text-blue-300 mb-2">Sale Progress</h4>
                              <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                                <div
                                  className="bg-green-500 h-4 rounded-full"
                                  style={{ width: `${salePercentage}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                {salePercentage.toFixed(2)}% Sold
                              </p>
                            </div>
                            <div className="mt-4">
                              <h4 className="text-sm font-medium text-blue-300 mb-2">Token Stats</h4>
                              <p className="text-sm mb-1"><strong>Total Volume:</strong> {(parseFloat(project.soldAmount) * parseFloat(project.pricePerShare)).toFixed(2)} USDC</p>
                              <p className="text-sm mb-1"><strong>Unique Buyers:</strong> {mockTransactions(Number(project.id)).length}</p>
                              <p className="text-sm mb-1"><strong>Average Sale Price:</strong> {mockTransactions(Number(project.id)).reduce((sum, tx) => sum + parseFloat(tx.price), 0) / mockTransactions(Number(project.id)).length} USDC</p>
                            </div>
                            <div className="mt-4">
                              <h4 className="text-sm font-medium text-blue-300 mb-2">Recent Transactions</h4>
                              <div className="space-y-2">
                                {mockTransactions(Number(project.id)).map((tx) => (
                                  <div key={tx.id} className="bg-gray-800 p-2 rounded-lg text-sm">
                                    <p><strong>Buyer:</strong> {tx.buyer}</p>
                                    <p><strong>Amount:</strong> {tx.amount} tokens</p>
                                    <p><strong>Price:</strong> {tx.price}</p>
                                    <p><strong>Time:</strong> {tx.timestamp}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {(project.projectWebsite || project.socialMediaLink || project.telegramUrl) && (
                              <div className="flex space-x-3 mt-4">
                                {project.projectWebsite && (
                                  <a href={project.projectWebsite} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400">
                                    <Globe className="w-5 h-5" />
                                  </a>
                                )}
                                {project.socialMediaLink && (
                                  <a href={project.socialMediaLink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400">
                                    <Twitter className="w-5 h-5" />
                                  </a>
                                )}
                                {project.telegramUrl && (
                                  <a href={project.telegramUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400">
                                    <MessageCircle className="w-5 h-5" />
                                  </a>
                                )}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-center mb-6">No projects found for this creator.</p>
            )}

            <div className="mt-6">
              <h3 className="text-lg font-medium text-blue-300 mb-2">Leave Feedback</h3>
              <p className="text-sm text-gray-300 mb-4">
                Share your thoughts about this creator. Your feedback will be visible in the Feed section.
              </p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Write your feedback here..."
                className="w-full h-24 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <button
                onClick={handleSubmitFeedback}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors"
              >
                <Send className="w-5 h-5 mr-2" /> Submit Feedback
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {showInsightsModal !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center p-4 z-60"
          onClick={closeInsightsModal}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="bg-gray-800/90 backdrop-blur-lg rounded-2xl p-6 max-w-md w-full border border-gray-700 shadow-lg overflow-y-auto max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-blue-300 flex items-center">
                <TrendingUp className="w-6 h-6 mr-2" /> Project Insights #{showInsightsModal}
              </h2>
              <button onClick={closeInsightsModal} className="text-gray-400 hover:text-blue-200">
                <X className="w-6 h-6" />
              </button>
            </div>
            {profile.projectDetails
              .filter((project) => project.id === showInsightsModal)
              .map((project) => (
                <div key={project.id}>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-blue-300 mb-2">Market Analysis</h3>
                    <p className="text-sm text-gray-200 mb-2"><strong>Current Price:</strong> {project.pricePerShare} USDC</p>
                    <p className="text-sm text-gray-200 mb-2"><strong>Price Change (24h):</strong> +5.2% <span className="text-green-400">↑</span></p>
                    <p className="text-sm text-gray-200 mb-2"><strong>Total Market Cap:</strong> {(parseFloat(project.amount) * parseFloat(project.pricePerShare)).toFixed(2)} USDC</p>
                  </div>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-blue-300 mb-2">Creator Stats</h3>
                    <p className="text-sm text-gray-200 mb-2"><strong>Active Since:</strong> January 2024</p>
                    <p className="text-sm text-gray-200 mb-2"><strong>Total Projects:</strong> {profile.projects}</p>
                    <p className="text-sm text-gray-200 mb-2"><strong>Success Rate:</strong> {profile.successRate}%</p>
                  </div>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-blue-300 mb-2">Explore on Blockchain</h3>
                    <div className="flex space-x-3">
                      <a
                        href={`${ETHERSCAN_BASE_URL}/token/${project.tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-blue-400 flex items-center"
                      >
                        <Globe className="w-5 h-5 mr-1" /> View on Basescan
                      </a>
                      <a
                        href={`${ETHERSCAN_BASE_URL}/address/${project.seller}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-blue-400 flex items-center"
                      >
                        <Wallet className="w-5 h-5 mr-1" /> Creator Transactions
                      </a>
                    </div>
                  </div>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-blue-300 mb-2">Price History (Last 7 Days)</h3>
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <div className="flex justify-between text-sm text-gray-400 mb-2">
                        <span>Day 1</span><span>Day 2</span><span>Day 3</span><span>Day 4</span><span>Day 5</span><span>Day 6</span><span>Day 7</span>
                      </div>
                      <div className="flex items-end h-24">
                        {[1.0, 1.1, 1.05, 1.15, 1.2, 1.18, 1.22].map((price, idx) => (
                          <div key={idx} className="flex-1 h-full flex items-end">
                            <div
                              className="bg-blue-500 w-4 rounded-t"
                              style={{ height: `${(price / 1.3) * 100}%` }}
                            ></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}