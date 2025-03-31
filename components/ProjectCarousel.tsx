import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

interface Token {
  id: number;
  name: string;
  price: string;
  image: string;
  paymentTokenSymbol: string;
}

interface ProjectCarouselProps {
  signer: ethers.Signer | null;
  onProjectClick: (listingId: number) => void;
}

const TOKEN_ABI = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
];

const CONTRACT_ABI = [
  "function listingCount() external view returns (uint256)",
  "function getListingBasicDetails(uint256 listingId) external view returns (address seller, address tokenAddress, uint256 amount, uint256 soldAmount, uint256 pricePerShare, address paymentToken)",
  "function getListingAdditionalDetails(uint256 listingId) external view returns (bool active, bool referralActive, uint256 referralPercent, bytes32 referralCode, uint256 endTime, uint256 initialAmount, uint256 referralReserve)",
  "function getListingMetadata(uint256 listingId) external view returns (string projectWebsite, string socialMediaLink, string tokenImageUrl, string telegramUrl, string projectDescription)",
];

const CONTRACT_ADDRESS = '0x338a419639cD3c2089DB55aDEA4b9c47739596f0';
const BASE_PROVIDER_URL = "https://mainnet.base.org";
const FALLBACK_IMAGE = 'https://dummyimage.com/50x50/ccc/fff';

const fetchFeedPosts = async (signer: ethers.Signer | null): Promise<Token[]> => {
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

    const marketplace = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer || provider);
    const totalListings = Number(await marketplace.listingCount());
    const tokens: Token[] = [];

    for (let i = 0; i < totalListings; i++) {
      try {
        // Skip invalid listing IDs
        if (i < 0 || i >= totalListings) {
          console.warn(`Invalid listing ID: ${i}. Skipping.`);
          continue;
        }

        const [basicDetails, additionalDetails, metadata] = await Promise.all([
          marketplace.getListingBasicDetails(i).catch((error: any) => {
            console.error(`Error fetching basic details for listing ${i}:`, error);
            return null;
          }),
          marketplace.getListingAdditionalDetails(i).catch((error: any) => {
            console.error(`Error fetching additional details for listing ${i}:`, error);
            return null;
          }),
          marketplace.getListingMetadata(i).catch((error: any) => {
            console.error(`Error fetching metadata for listing ${i}:`, error);
            return null;
          })
        ]);

        // Skip if any of the required data is missing
        if (!basicDetails || !additionalDetails || !metadata) {
          console.warn(`Incomplete data for listing ${i}. Skipping.`);
          continue;
        }

        // Skip inactive listings
        if (!additionalDetails.active) {
          continue;
        }

        const tokenContract = new ethers.Contract(basicDetails.tokenAddress, TOKEN_ABI, signer || provider);
        const paymentTokenContract = new ethers.Contract(basicDetails.paymentToken, TOKEN_ABI, signer || provider);

        const [name, paymentSymbol] = await Promise.all([
          tokenContract.name().catch(() => 'Unknown Token'),
          paymentTokenContract.symbol().catch(() => 'UNKNOWN')
        ]);

        tokens.push({
          id: i,
          name: name,
          price: ethers.formatUnits(basicDetails.pricePerShare, await paymentTokenContract.decimals()),
          image: metadata.tokenImageUrl || FALLBACK_IMAGE,
          paymentTokenSymbol: paymentSymbol
        });
      } catch (error: any) {
        console.error(`Error processing listing ${i}:`, error);
        // Don't throw here, just log and continue with next listing
        continue;
      }
    }

    return tokens;
  } catch (error: any) {
    console.error("Error fetching feed posts:", error);
    toast.error(`Failed to load tokens: ${error.message}`);
    return [];
  }
};

export default function ProjectCarousel({ signer, onProjectClick }: ProjectCarouselProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const loadTokens = async () => {
      if (hasLoaded) return;
      setLoading(true);
      try {
        const feedData = await fetchFeedPosts(signer);
        setTokens(feedData);
        setHasLoaded(true);
      } catch (error: any) {
        console.error('Error loading tokens:', error);
        toast.error(error.message || 'Failed to load tokens');
        setTokens([]);
      } finally {
        setLoading(false);
      }
    };
    loadTokens();
  }, [signer, hasLoaded]);

  const handleDetailsClick = (tokenId: number) => {
    if (signer) {
      onProjectClick(tokenId);
    } else {
      toast.error('Please connect your wallet to view details!');
    }
  };

  if (loading) {
    return <div className="w-full h-16 flex items-center justify-center bg-gray-900 text-gray-400">Loading tokens...</div>;
  }

  if (tokens.length === 0) {
    return <div className="w-full h-16 flex items-center justify-center bg-gray-900 text-gray-400">No tokens available</div>;
  }

  const carouselStyle = {
    width: '100%',
    overflow: 'hidden' as const,
    position: 'relative',
    backgroundColor: '#1a202c',
    padding: '1rem 0',
  };

  const innerStyle = {
    display: 'flex',
    width: `${tokens.length * 160 * 2}px`,
  };

  return (
    <div style={carouselStyle} className="relative mb-6">
      <motion.div
        style={innerStyle}
        animate={{
          x: [0, -tokens.length * 160],
          transition: {
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: tokens.length * 2,
              ease: "linear",
            },
          },
        }}
      >
        {[...tokens, ...tokens].map((token, index) => (
          <div key={`${token.id}-${index}`} className="min-w-[160px] px-2 flex-shrink-0" style={{ width: '160px' }}>
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg p-4 text-center h-full flex flex-col justify-between">
              <div>
                <div className="w-16 h-16 mx-auto mb-2 overflow-hidden rounded-full bg-gray-800 flex items-center justify-center">
                  <img
                    src={token.image}
                    alt={`${token.name} logo`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK_IMAGE;
                      e.currentTarget.className = 'w-12 h-12 object-contain';
                    }}
                  />
                </div>
                <h4 className="text-lg font-bold text-white mb-1 line-clamp-2">{token.name}</h4>
                <p className="text-green-400 text-sm mb-2">{token.price} {token.paymentTokenSymbol}</p>
              </div>
              <button
                onClick={() => handleDetailsClick(token.id)}
                className="bg-primary-600 hover:bg-primary-700 text-white text-xs px-3 py-1 rounded-full transition-colors w-full mt-auto"
              >
                Details
              </button>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}