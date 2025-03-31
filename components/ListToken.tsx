import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { X, Info } from 'lucide-react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import debounce from 'lodash/debounce';
import CreateToken from './CreateToken'; // Import the CreateToken component
import sha1 from 'js-sha1'; // For generating Cloudinary signature

interface ListingProps {
  onClose: () => void;
  signer: ethers.Signer | null; // Support for null signer
  onSuccess: () => void;
  initialTokenAddress?: string | null;
}

// Cloudinary credentials from environment variables
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = import.meta.env.VITE_CLOUDINARY_API_SECRET;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const PRESALE_MARKETPLACE_ADDRESS = '0x338a419639cD3c2089DB55aDEA4b9c47739596f0';
const PRDX_TOKEN_ADDRESS = '0x61Dd008F1582631Aa68645fF92a1a5ECAedBeD19';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const PRESALE_ABI = [
  "function listToken(address tokenAddress, uint256 amountRaw, uint256 pricePerShareRaw, address paymentToken, bool referralActive, uint256 referralPercent, (string projectWebsite, string socialMediaLink, string tokenImageUrl, string telegramUrl, string projectDescription) metadata, uint256 durationInSeconds) external",
  "function listingCount() external view returns (uint256)",
  "function getListingBasicDetails(uint256 listingId) external view returns (address seller, address tokenAddress, uint256 amount, uint256 pricePerShare, address paymentToken)",
  "function getListingAdditionalDetails(uint256 listingId) external view returns (bool active, bool referralActive, uint256 referralPercent, bytes32 referralCode, uint256 endTime)",
  "function getListingMetadata(uint256 listingId) external view returns (string projectWebsite, string socialMediaLink, string tokenImageUrl, string telegramUrl, string projectDescription)"
];

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

// Function to validate URLs
const isValidUrl = (url: string): boolean => {
  if (!url) return true;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Function to normalize decimal values
const normalizeDecimal = (value: string): string => {
  try {
    const cleanedValue = value.replace(',', '.').replace(/[^0-9.e-]/g, '');
    const num = Number(cleanedValue);
    if (isNaN(num)) throw new Error('Invalid number');
    return num.toFixed(18).replace(/\.?0+$/, '');
  } catch (error) {
    console.error('Error normalizing decimal:', error);
    return '0';
  }
};

// Function to generate Cloudinary signature
const generateSignature = (params: { [key: string]: string | number }) => {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  const stringToSign = `${sortedParams}${CLOUDINARY_API_SECRET}`;
  console.log('String to sign:', stringToSign); // Debug log
  return sha1(stringToSign);
};

// Function to upload image to Cloudinary
const uploadImageToCloudinary = async (file: File): Promise<string> => {
  try {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error('Missing Cloudinary credentials');
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const uploadPreset = CLOUDINARY_UPLOAD_PRESET || 'default_preset'; // Ensure a default preset
    const params = {
      timestamp,
      upload_preset: uploadPreset,
    };
    const signature = generateSignature(params);
    console.log('Generated signature:', signature); // Debug log

    const formData = new FormData();
    formData.append('file', file);
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', CLOUDINARY_API_KEY);
    formData.append('signature', signature);
    formData.append('upload_preset', uploadPreset);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Upload failed');
    return data.secure_url;
  } catch (error: any) {
    console.error('Upload error:', error);
    toast.error(`Image upload failed: ${error.message}`);
    throw error;
  }
};

// Function to list a token on the marketplace
async function listToken(
  tokenAddress: string,
  amount: string,
  pricePerShare: string,
  useUSDC: boolean,
  projectWebsite: string,
  socialMediaLink: string,
  imageUrl: string,
  telegramUrl: string,
  projectDescription: string,
  signer: ethers.Signer | null,
  useReferral: boolean = false,
  referralPercent: number = 0,
  durationInSeconds: number = 2592000
) {
  try {
    console.log('listToken called with:', { tokenAddress, amount, pricePerShare });

    if (!signer) throw new Error('Signer not available');
    if (!ethers.isAddress(tokenAddress)) throw new Error('Invalid token address');
    if (tokenAddress.toLowerCase() === PRDX_TOKEN_ADDRESS.toLowerCase()) throw new Error('Cannot list PRDX token');

    const token = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);
    const tokenDecimals = await token.decimals();
    const normalizedAmount = normalizeDecimal(amount);
    const amountFloat = parseFloat(normalizedAmount);
    if (isNaN(amountFloat) || amountFloat <= 0) throw new Error('Amount must be a positive number');
    const amountRaw = ethers.parseUnits(normalizedAmount, tokenDecimals);

    const userAddress = await signer.getAddress();
    const balanceRaw = await token.balanceOf(userAddress);
    if (balanceRaw < amountRaw) {
      const balanceHuman = ethers.formatUnits(balanceRaw, tokenDecimals);
      throw new Error(`Insufficient balance: you have ${balanceHuman} tokens, but tried to list ${amount}`);
    }

    const paymentTokenAddress = useUSDC ? USDC_ADDRESS : PRDX_TOKEN_ADDRESS;
    const paymentToken = new ethers.Contract(paymentTokenAddress, TOKEN_ABI, signer);
    const paymentDecimals = await paymentToken.decimals();

    const marketplaceAddress = PRESALE_MARKETPLACE_ADDRESS;
    const marketplace = new ethers.Contract(marketplaceAddress, PRESALE_ABI, signer);
    const allowance = await token.allowance(userAddress, marketplaceAddress);
    if (allowance < amountRaw) {
      toast.loading('Approving token transfer...', { id: 'approve-token' });
      const approveTx = await token.approve(marketplaceAddress, ethers.MaxUint256);
      await approveTx.wait();
      toast.success('Token approved!', { id: 'approve-token' });
    }

    const normalizedPrice = normalizeDecimal(pricePerShare);
    const pricePerShareFloat = parseFloat(normalizedPrice);
    if (isNaN(pricePerShareFloat) || pricePerShareFloat <= 0) throw new Error(`Price must be greater than 0. You entered: ${pricePerShare}`);
    const pricePerShareRaw = ethers.parseUnits(normalizedPrice, paymentDecimals);

    const metadata = {
      projectWebsite: projectWebsite || '',
      socialMediaLink: socialMediaLink || '',
      tokenImageUrl: imageUrl || '',
      telegramUrl: telegramUrl || '',
      projectDescription: projectDescription || '',
    };

    const tx = await marketplace.listToken(
      tokenAddress,
      amountRaw,
      pricePerShareRaw,
      paymentTokenAddress,
      useReferral,
      referralPercent,
      metadata,
      durationInSeconds
    );

    const receipt = await tx.wait();
    const listingCount = await marketplace.listingCount();
    const newListingId = Number(listingCount) - 1;

    const [basicDetails] = await Promise.all([
      marketplace.getListingBasicDetails(newListingId),
    ]);

    const listedAmount = ethers.formatUnits(basicDetails.amount, tokenDecimals);
    const listedPrice = ethers.formatUnits(basicDetails.pricePerShare, paymentDecimals);
    console.log(`New presale listing confirmed: ${listedAmount} tokens at ${listedPrice} ${useUSDC ? 'USDC' : 'PRDX'}`);

    return { receipt, listingId: newListingId };
  } catch (error: any) {
    console.error('Error in listToken:', error);
    const errorMessage = error.reason
      ? `Transaction failed: ${error.reason}`
      : error.message.includes('user rejected')
      ? 'Transaction rejected by user'
      : error.message.includes('insufficient')
      ? error.message
      : `An unexpected error occurred while listing the token: ${error.message}`;
    throw new Error(errorMessage);
  }
}

export default function Listing({ onClose, signer, onSuccess, initialTokenAddress }: ListingProps) {
  const [formData, setFormData] = useState({
    tokenAddress: initialTokenAddress || '',
    amount: '',
    amountPercentage: 0,
    pricePerShare: '',
    useUSDC: false,
    projectWebsite: '',
    socialMediaLink: '',
    imageFile: null as File | null,
    imagePreview: '',
    imageUrl: '',
    telegramUrl: '',
    projectDescription: '',
    useReferral: false,
    referralPercent: 5,
    duration: 2592000,
  });
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [paymentTokenBalance, setPaymentTokenBalance] = useState<string | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState<string>('TOKEN');
  const [paymentTokenSymbol, setPaymentTokenSymbol] = useState<string>('PRDX');
  const [loadingBalances, setLoadingBalances] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [currentUserAddress, setCurrentUserAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{ imageUrl?: string }>({});
  const [showCreateTokenModal, setShowCreateTokenModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Load token and payment balances
  const loadBalances = useCallback(
    debounce(async (signer: ethers.Signer | null, tokenAddress: string, useUSDC: boolean) => {
      if (!signer) {
        console.log('Signer not available, skipping loadBalances');
        return;
      }
      setLoadingBalances(true);
      try {
        const userAddress = await signer.getAddress();
        setCurrentUserAddress(userAddress);

        if (ethers.isAddress(tokenAddress)) {
          const token = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);
          const decimals = await token.decimals();
          const balanceRaw = await token.balanceOf(userAddress);
          const balance = ethers.formatUnits(balanceRaw, decimals);
          setTokenBalance(balance);
          const symbol = await token.symbol();
          setTokenSymbol(symbol);
        } else {
          setTokenBalance(null);
          setTokenSymbol('TOKEN');
        }

        const paymentTokenAddress = useUSDC ? USDC_ADDRESS : PRDX_TOKEN_ADDRESS;
        const paymentToken = new ethers.Contract(paymentTokenAddress, TOKEN_ABI, signer);
        const paymentDecimals = await paymentToken.decimals();
        const paymentBalanceRaw = await paymentToken.balanceOf(userAddress);
        const paymentBalance = ethers.formatUnits(paymentBalanceRaw, paymentDecimals);
        setPaymentTokenBalance(paymentBalance);
        const paymentSymbol = await paymentToken.symbol();
        setPaymentTokenSymbol(paymentSymbol);
      } catch (error) {
        console.error('Error loading balances:', error);
        toast.error('Failed to load balances');
      } finally {
        setLoadingBalances(false);
      }
    }, 500),
    []
  );

  useEffect(() => {
    loadBalances(signer, formData.tokenAddress, formData.useUSDC);
  }, [signer, formData.tokenAddress, formData.useUSDC, loadBalances]);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (formData.imagePreview) {
        URL.revokeObjectURL(formData.imagePreview);
      }
    };
  }, [formData.imagePreview]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'amount') {
      const normalizedValue = normalizeDecimal(value);
      const amountFloat = parseFloat(normalizedValue) || 0;
      if (amountFloat < 0) return;
      const balanceFloat = parseFloat(tokenBalance || '0');
      const percentage = balanceFloat > 0 ? (amountFloat / balanceFloat) * 100 : 0;
      setFormData((prev) => ({
        ...prev,
        amount: value,
        amountPercentage: Math.min(100, Math.max(0, percentage)),
      }));
    } else if (name === 'pricePerShare') {
      const normalizedValue = normalizeDecimal(value);
      const floatValue = parseFloat(normalizedValue) || 0;
      if (floatValue < 0) return;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setFormData((prev) => ({ ...prev, imageFile: file, imagePreview: previewUrl, imageUrl: '' }));
      setFormErrors((prev) => ({ ...prev, imageUrl: undefined }));
    }
  };

  const handleAmountPercentageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percentage = parseInt(e.target.value, 10) || 0;
    const balanceFloat = parseFloat(tokenBalance || '0');
    const amount = balanceFloat > 0 ? ((percentage / 100) * balanceFloat).toFixed(6) : '0';
    setFormData((prev) => ({
      ...prev,
      amountPercentage: percentage,
      amount,
    }));
  };

  const handleSetMinAmount = () => {
    setFormData((prev) => ({
      ...prev,
      amount: '0',
      amountPercentage: 0,
    }));
  };

  const handleSetMaxAmount = () => {
    const balanceFloat = parseFloat(tokenBalance || '0');
    const maxAmount = balanceFloat.toFixed(6);
    setFormData((prev) => ({
      ...prev,
      amount: maxAmount,
      amountPercentage: 100,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleReferralPercentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) || 0;
    if (value < 1 || value > 100) return;
    setFormData((prev) => ({
      ...prev,
      referralPercent: value,
    }));
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) || 0;
    if (value < 600) return;
    setFormData((prev) => ({
      ...prev,
      duration: value,
    }));
  };

  const handleCreateTokenClick = () => {
    setShowCreateTokenModal(true);
  };

  const handleTokenCreated = (tokenAddress: string) => {
    setFormData((prev) => ({ ...prev, tokenAddress }));
    setShowCreateTokenModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer) {
      toast.error('Please connect your wallet');
      return;
    }

    console.log('Form data before validation:', formData);

    const newErrors: { imageUrl?: string } = {};
    if (!formData.imageFile && !formData.imageUrl) {
      newErrors.imageUrl = 'Token image is required';
      setFormErrors(newErrors);
      toast.error('Please upload a token image');
      return;
    }

    try {
      setIsSubmitting(true);
      let imageUrl = formData.imageUrl;
      if (formData.imageFile && !formData.imageUrl) {
        setUploading(true);
        console.log('Uploading image to Cloudinary...');
        imageUrl = await uploadImageToCloudinary(formData.imageFile);
        console.log('Image uploaded successfully:', imageUrl);
        setFormData((prev) => ({ ...prev, imageUrl }));
        setUploading(false);
      }

      if (!ethers.isAddress(formData.tokenAddress)) throw new Error('Invalid token address');
      const normalizedAmount = normalizeDecimal(formData.amount);
      const amountFloat = parseFloat(normalizedAmount);
      if (isNaN(amountFloat) || amountFloat <= 0) throw new Error('Amount must be greater than 0');
      const normalizedPrice = normalizeDecimal(formData.pricePerShare);
      const priceFloat = parseFloat(normalizedPrice);
      if (isNaN(priceFloat) || priceFloat <= 0) throw new Error(`Price must be greater than 0. You entered: ${formData.pricePerShare}`);
      if (formData.useReferral && (formData.referralPercent < 1 || formData.referralPercent > 100)) {
        throw new Error('Referral percentage must be between 1 and 100');
      }
      if (formData.projectWebsite && !isValidUrl(formData.projectWebsite)) throw new Error('Invalid Project Website URL');
      if (formData.socialMediaLink && !isValidUrl(formData.socialMediaLink)) throw new Error('Invalid Social Media URL');
      if (formData.telegramUrl && !isValidUrl(formData.telegramUrl)) throw new Error('Invalid Telegram URL');
      if (formData.duration < 600) throw new Error('Duration must be at least 10 minutes (600 seconds)');

      const currentAddress = await signer.getAddress();
      if (currentUserAddress && currentAddress !== currentUserAddress) {
        throw new Error('Wallet address changed. Please reload and try again.');
      }

      toast.loading('Listing token...', { id: 'list-token' });

      const result = await listToken(
        formData.tokenAddress,
        formData.amount,
        formData.pricePerShare,
        formData.useUSDC,
        formData.projectWebsite,
        formData.socialMediaLink,
        imageUrl,
        formData.telegramUrl,
        formData.projectDescription,
        signer,
        formData.useReferral,
        formData.referralPercent,
        formData.duration
      );

      toast.success(`Token listed successfully! Listing ID: ${result.listingId}`, { id: 'list-token' });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      const errorMessage = error.reason
        ? `Transaction failed: ${error.reason}`
        : error.message.includes('user rejected')
        ? 'Transaction rejected by user'
        : error.message.includes('insufficient')
        ? error.message
        : `An unexpected error occurred while listing the token: ${error.message}`;
      setError(errorMessage);
      toast.error(errorMessage, { id: 'list-token' });
    } finally {
      setIsSubmitting(false);
      setUploading(false);
    }
  };

  // Error fallback component
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
      >
        <div className="bg-red-900 rounded-xl p-6 text-white max-w-md">
          <h2 className="text-xl font-bold mb-4">Error</h2>
          <p>{error}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-red-700 rounded hover:bg-red-800"
          >
            Close
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-gradient-to-br from-gray-900 to-black rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg border border-primary-500"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-primary-300">Create Presale Listing</h2>
          <button onClick={onClose} className="text-primary-400 hover:text-primary-300" disabled={isSubmitting}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-blue-500/20 p-4 rounded-lg mb-6 border border-blue-500/30">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-300 mt-1 flex-shrink-0" />
            <div>
              <p className="text-blue-200 font-medium">No Token to List Yet?</p>
              <p className="text-blue-100 text-sm">
                Create your own token in just 2 easy steps at nearly zero cost! Get started now and launch your project.
              </p>
              <motion.button
                onClick={handleCreateTokenClick}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                CREATE TOKEN NOW!
              </motion.button>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-primary-300 mb-2">Token Contract</h3>
          <input
            type="text"
            name="tokenAddress"
            value={formData.tokenAddress}
            onChange={handleChange}
            required
            disabled={isSubmitting || !!initialTokenAddress}
            className="w-full bg-gray-700 border border-primary-500 rounded-lg px-4 py-2 text-primary-200 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
            placeholder="Enter token contract address (e.g., 0x...)"
          />
          {formData.tokenAddress && ethers.isAddress(formData.tokenAddress) && (
            <p className="text-sm text-primary-300 mt-2 break-all">
              Full Contract Address: {formData.tokenAddress}
            </p>
          )}
        </div>

        <div className="bg-yellow-500/20 p-4 rounded-lg mb-6 border border-yellow-500/30">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-yellow-300 mt-1 flex-shrink-0" />
            <div>
              <p className="text-yellow-200 font-medium">Minimum Values</p>
              <p className="text-yellow-100 text-sm">
                Price per token must be at least 0.0000001 {formData.useUSDC ? 'USDC' : 'PRDX'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-primary-300 mb-4">Your Balances</h3>
          {loadingBalances ? (
            <p className="text-primary-400">Loading balances...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-primary-300">
                  Token Balance (<span className="text-primary-300">{tokenSymbol}</span>):{' '}
                  {tokenBalance ? `${parseFloat(tokenBalance).toFixed(6)} ${tokenSymbol}` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-primary-300">
                  Payment Balance (<span className="text-primary-300">{paymentTokenSymbol}</span>):{' '}
                  {paymentTokenBalance ? `${parseFloat(paymentTokenBalance).toFixed(6)} ${paymentTokenSymbol}` : 'N/A'}
                </p>
              </div>
            </div>
          )}
          <div className="mt-4">
            <p className="text-sm text-primary-400">Marketplace Contract Address:</p>
            <p className="text-xs text-primary-300 break-all">{PRESALE_MARKETPLACE_ADDRESS}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-primary-300 mb-4">Listing Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-primary-300 mb-2">Amount to List</label>
                <div className="flex items-center space-x-2">
                  <motion.button
                    type="button"
                    onClick={handleSetMinAmount}
                    disabled={isSubmitting}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50"
                    whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
                  >
                    Min
                  </motion.button>
                  <input
                    type="text"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    required
                    placeholder="e.g., 1256.2369"
                    disabled={isSubmitting}
                    className="w-full bg-gray-700 border border-primary-500 rounded-lg px-4 py-2 text-primary-200 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                  />
                  <motion.button
                    type="button"
                    onClick={handleSetMaxAmount}
                    disabled={isSubmitting || !tokenBalance}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50"
                    whileHover={{ scale: isSubmitting || !tokenBalance ? 1 : 1.05 }}
                    whileTap={{ scale: isSubmitting || !tokenBalance ? 1 : 0.95 }}
                  >
                    Max
                  </motion.button>
                </div>
                {tokenBalance && (
                  <>
                    <motion.input
                      type="range"
                      name="amountPercentage"
                      value={formData.amountPercentage}
                      onChange={handleAmountPercentageChange}
                      min={0}
                      max={100}
                      step={1}
                      disabled={isSubmitting}
                      className="w-full mt-2 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                      style={{
                        background: `linear-gradient(to right, #00ffea ${formData.amountPercentage}%, #1e3a8a ${formData.amountPercentage}%)`,
                      }}
                      whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
                    />
                    <p className="text-sm text-primary-400 mt-2">
                      {formData.amountPercentage}% (<span className="text-primary-300">{tokenSymbol}</span>)
                    </p>
                  </>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-300 mb-2">Price per Token</label>
                <input
                  type="text"
                  name="pricePerShare"
                  value={formData.pricePerShare}
                  onChange={handleChange}
                  required
                  placeholder="e.g., 0.0000001"
                  disabled={isSubmitting}
                  className="w-full bg-gray-700 border border-primary-500 rounded-lg px-4 py-2 text-primary-200 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                />
                <p className="text-sm text-primary-400 mt-2">
                  {formData.pricePerShare} {formData.useUSDC ? 'USDC' : 'PRDX'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-300 mb-2">Payment Token</label>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="useUSDC"
                      checked={!formData.useUSDC}
                      onChange={() => setFormData((prev) => ({ ...prev, useUSDC: false }))}
                      disabled={isSubmitting}
                      className="w-5 h-5 text-primary-500 focus:ring-primary-500 disabled:opacity-50"
                    />
                    <span className="text-primary-300">PRDX</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="useUSDC"
                      checked={formData.useUSDC}
                      onChange={() => setFormData((prev) => ({ ...prev, useUSDC: true }))}
                      disabled={isSubmitting}
                      className="w-5 h-5 text-primary-500 focus:ring-primary-500 disabled:opacity-50"
                    />
                    <span className="text-primary-300">USDC</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-300 mb-2">Listing Duration</label>
                <motion.input
                  type="range"
                  name="duration"
                  value={formData.duration}
                  onChange={handleDurationChange}
                  min={600}
                  max={5184000}
                  step={600}
                  disabled={isSubmitting}
                  className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  style={{
                    background: `linear-gradient(to right, #00ffea ${(formData.duration - 600) / (5184000 - 600) * 100}%, #1e3a8a ${(formData.duration - 600) / (5184000 - 600) * 100}%)`,
                  }}
                  whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
                />
                <p className="text-sm text-primary-400 mt-2">
                  {formData.duration / 86400} days ({formData.duration} seconds)
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-primary-300 mb-4">Referral System</h3>
            <div className="flex items-center space-x-4 mb-4">
              <label className="text-sm font-medium text-primary-300">Enable Referral</label>
              <motion.input
                type="checkbox"
                name="useReferral"
                checked={formData.useReferral}
                onChange={handleCheckboxChange}
                disabled={isSubmitting}
                className="w-5 h-5 bg-gray-600 border-gray-500 rounded text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                whileHover={{ scale: isSubmitting ? 1 : 1.1 }}
              />
            </div>
            {formData.useReferral && (
              <div>
                <label className="block text-sm font-medium text-primary-300 mb-2">Referral Percentage</label>
                <motion.input
                  type="range"
                  name="referralPercent"
                  value={formData.referralPercent}
                  onChange={handleReferralPercentChange}
                  min={1}
                  max={100}
                  step={1}
                  disabled={isSubmitting}
                  className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  style={{
                    background: `linear-gradient(to right, #ff00ff ${formData.referralPercent}%, #1e3a8a ${formData.referralPercent}%)`,
                  }}
                  whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
                />
                <p className="text-sm text-primary-400 mt-2">{formData.referralPercent}%</p>
              </div>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-primary-300 mb-4">Token Metadata</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-primary-300 mb-2">Project Website</label>
                <input
                  type="url"
                  name="projectWebsite"
                  value={formData.projectWebsite}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className="w-full bg-gray-700 border border-primary-500 rounded-lg px-4 py-2 text-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-300 mb-2">Social Media Link</label>
                <input
                  type="url"
                  name="socialMediaLink"
                  value={formData.socialMediaLink}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className="w-full bg-gray-700 border border-primary-500 rounded-lg px-4 py-2 text-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                  placeholder="https://twitter.com/..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-300 mb-2">Token Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  required={!formData.imageUrl}
                  disabled={isSubmitting}
                  className="w-full bg-gray-700 border border-primary-500 rounded-lg px-4 py-2 text-primary-200 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-700 transition-all disabled:opacity-50"
                />
                {formData.imagePreview && (
                  <div className="mt-4">
                    <p className="text-xs text-primary-400 mb-2">Image Preview:</p>
                    <img
                      src={formData.imagePreview}
                      alt="Token Image Preview"
                      className="max-w-[128px] max-h-[128px] object-contain rounded-lg border border-primary-500/50"
                    />
                  </div>
                )}
                {formData.imageFile && (
                  <p className="text-xs text-primary-400 mt-1">Selected: {formData.imageFile.name}</p>
                )}
                {formData.imageUrl && (
                  <p className="text-xs text-primary-400 mt-1">
                    Uploaded: <a href={formData.imageUrl} target="_blank" rel="noopener noreferrer" className="underline">View Image</a>
                  </p>
                )}
                <p className="text-xs text-primary-400 mt-2">
                  Suggested size: 128x128 pixels (square logo)
                </p>
                {formErrors.imageUrl && (
                  <p className="text-sm text-red-400 mt-2">{formErrors.imageUrl}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-300 mb-2">Telegram URL</label>
                <input
                  type="url"
                  name="telegramUrl"
                  value={formData.telegramUrl}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className="w-full bg-gray-700 border border-primary-500 rounded-lg px-4 py-2 text-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                  placeholder="https://t.me/..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-primary-300 mb-2">Project Description</label>
                <textarea
                  name="projectDescription"
                  value={formData.projectDescription}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className="w-full bg-gray-700 border border-primary-500 rounded-lg px-4 py-2 text-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                  placeholder="Describe your token..."
                  rows={4}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-6">
            <motion.button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || uploading}
              className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
              whileHover={{ scale: (isSubmitting || uploading) ? 1 : 1.05 }}
              whileTap={{ scale: (isSubmitting || uploading) ? 1 : 0.95 }}
            >
              Cancel
            </motion.button>
            <motion.button
              type="submit"
              disabled={isSubmitting || uploading}
              className="px-6 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50 flex items-center"
              whileHover={{ scale: (isSubmitting || uploading) ? 1 : 1.05 }}
              whileTap={{ scale: (isSubmitting || uploading) ? 1 : 0.95 }}
            >
              {isSubmitting || uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {uploading ? 'Uploading...' : 'Listing...'}
                </>
              ) : (
                'Create Listing'
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>

      {showCreateTokenModal && signer && (
        <CreateToken
          onClose={() => setShowCreateTokenModal(false)}
          onSuccess={handleTokenCreated}
          signer={signer}
        />
      )}
    </motion.div>
  );
}