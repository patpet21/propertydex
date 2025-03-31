import React, { useState, ChangeEvent } from 'react';
import { ethers } from 'ethers';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { X, Info, AlertCircle } from 'lucide-react';
import sha1 from 'js-sha1'; // Per generare la firma di Cloudinary

interface CreateTokenProps {
  onClose: () => void;
  onSuccess: (tokenAddress: string) => void;
  signer: ethers.Signer;
}

// Credenziali Cloudinary da variabili d'ambiente
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = import.meta.env.VITE_CLOUDINARY_API_SECRET;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET; // Preset opzionale

// Funzione per generare la firma per Cloudinary
const generateSignature = (params: { [key: string]: string | number }) => {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  const stringToSign = `${sortedParams}${CLOUDINARY_API_SECRET}`;
  return sha1(stringToSign);
};

export default function CreateToken({ onClose, onSuccess, signer }: CreateTokenProps) {
  const [formData, setFormData] = useState({
    tokenName: '',
    tokenSymbol: '',
    initialSupply: '',
    imageFile: null as File | null,
    imageUrl: '', // URL dell'immagine caricata
    imagePreview: '', // URL temporaneo per l'anteprima
    projectDesc: '',
    websiteLink: '',
    twitterLink: '',
    telegramLink: '',
  });
  const [uploading, setUploading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file); // Genera URL per anteprima
      setFormData((prev) => ({ ...prev, imageFile: file, imagePreview: previewUrl }));
    }
  };

  const uploadImageToCloudinary = async (file: File): Promise<string> => {
    setUploading(true);
    try {
      const timestamp = Math.round(new Date().getTime() / 1000);
      const params = {
        timestamp,
        upload_preset: CLOUDINARY_UPLOAD_PRESET || 'unsigned_preset',
      };
      const signature = generateSignature(params);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('timestamp', timestamp.toString());
      formData.append('api_key', CLOUDINARY_API_KEY);
      formData.append('signature', signature);
      if (CLOUDINARY_UPLOAD_PRESET) {
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      }

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
      toast.error(`Image upload failed: ${error.message}`);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let imageUrl = formData.imageUrl;
      if (formData.imageFile && !formData.imageUrl) {
        imageUrl = await uploadImageToCloudinary(formData.imageFile);
        setFormData((prev) => ({ ...prev, imageUrl }));
      }

      if (!imageUrl) {
        toast.error('Please upload an image');
        return;
      }

      const factoryAddress = '0x01A3ad1acc738cb60d48E08ccadC769904De256c';
      const factoryABI = [
        "function createToken(string tokenName, string tokenSymbol, uint256 initialSupply, string imageLink, string projectDesc, string websiteLink, string twitterLink, string telegramLink) external returns (tuple(address tokenAddress, string name, string symbol, uint256 initialSupply, address creator, string imageUrl, string projectDescription, string websiteUrl, string twitterUrl, string telegramUrl))"
      ];

      const factory = new ethers.Contract(factoryAddress, factoryABI, signer);

      const tx = await factory.createToken(
        formData.tokenName,
        formData.tokenSymbol,
        formData.initialSupply,
        imageUrl,
        formData.projectDesc,
        formData.websiteLink,
        formData.twitterLink,
        formData.telegramLink
      );

      toast.loading('Creating token...', { id: 'create-token' });
      const receipt = await tx.wait();

      const tokenAddress = receipt.logs[0].address;

      if (!window.ethereum) {
        throw new Error('MetaMask is not installed or not available.');
      }

      try {
        const wasAdded = await window.ethereum.request({
          method: 'wallet_watchAsset',
          params: {
            type: 'ERC20',
            options: {
              address: tokenAddress,
              symbol: formData.tokenSymbol,
              decimals: 18,
              image: imageUrl,
            },
          },
        });

        if (wasAdded) {
          console.log('Token successfully added to MetaMask');
        } else {
          console.warn('User rejected the request to add token to MetaMask');
        }
      } catch (error) {
        console.error('Error adding token to MetaMask:', error);
        toast.warn('Failed to add token to MetaMask automatically. You can add it manually.', { id: 'metamask-error' });
      }

      toast.success('Token created successfully!', { id: 'create-token' });
      onClose();
      onSuccess(tokenAddress);
    } catch (error: any) {
      console.error('Error creating token:', error);
      toast.error(error.message || 'Failed to create token', { id: 'create-token' });
    }
  };

  // Pulizia dell'URL di anteprima quando il componente si smonta
  React.useEffect(() => {
    return () => {
      if (formData.imagePreview) {
        URL.revokeObjectURL(formData.imagePreview); // Libera la memoria
      }
    };
  }, [formData.imagePreview]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center p-6 z-50"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-gradient-to-br from-gray-900 to-black rounded-xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-primary-600"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-semibold text-primary-300 tracking-tight">Create Your ERC20 Token</h2>
          <button onClick={onClose} className="text-primary-400 hover:text-primary-200 transition-colors">
            <X className="w-7 h-7" />
          </button>
        </div>

        <div className="bg-primary-900/20 p-5 rounded-lg mb-8 border border-primary-700/50 shadow-inner">
          <div className="flex items-start space-x-4">
            <Info className="w-6 h-6 text-primary-400 mt-1 flex-shrink-0" />
            <div>
              <p className="text-primary-300 font-medium text-lg">Token Creation Details</p>
              <ul className="text-primary-200 text-sm mt-2 space-y-2">
                <li>Creates a standard ERC20 token with 18 decimals.</li>
                <li><span className="font-semibold">Creation Fee:</span> Less than $0.1 value in ETH.</li>
                <li><span className="font-semibold">Gas Fees:</span> Variable (typically 0.001-0.003 ETH). Ensure you have enough ETH in your wallet.</li>
                <li><span className="font-semibold">Platform Fee:</span> 0.1% of total token supply, deducted automatically.</li>
                <li>Your token will be automatically added to MetaMask upon creation (optional).</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-yellow-900/20 p-5 rounded-lg mb-8 border border-yellow-700/50 shadow-inner">
          <div className="flex items-start space-x-4">
            <AlertCircle className="w-6 h-6 text-yellow-400 mt-1 flex-shrink-0" />
            <div>
              <p className="text-yellow-300 font-medium text-lg">Important Notice</p>
              <p className="text-yellow-200 text-sm mt-2">
                Ensure you have sufficient ETH for gas fees in your wallet. Gas fees vary based on network congestion and are separate from the creation fee.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-primary-300 mb-2">
                Token Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="tokenName"
                value={formData.tokenName}
                onChange={handleChange}
                required
                className="w-full bg-gray-800 border border-primary-500/50 rounded-lg px-4 py-3 text-primary-200 placeholder-primary-400/70 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all"
                placeholder="e.g., Luxury Villa Token"
              />
              <p className="text-xs text-primary-400 mt-1">The full name of your token (max 32 characters recommended).</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-300 mb-2">
                Token Symbol <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="tokenSymbol"
                value={formData.tokenSymbol}
                onChange={handleChange}
                required
                className="w-full bg-gray-800 border border-primary-500/50 rounded-lg px-4 py-3 text-primary-200 placeholder-primary-400/70 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all"
                placeholder="e.g., LVT"
              />
              <p className="text-xs text-primary-400 mt-1">Short ticker symbol (e.g., ETH, BTC, 3-6 characters).</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-300 mb-2">
              Initial Supply <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              name="initialSupply"
              value={formData.initialSupply}
              onChange={handleChange}
              required
              min="1"
              step="1"
              className="w-full bg-gray-800 border border-primary-500/50 rounded-lg px-4 py-3 text-primary-200 placeholder-primary-400/70 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all"
              placeholder="e.g., 1000000"
            />
            <p className="text-xs text-primary-400 mt-1">Total supply in whole tokens (18 decimals will be applied, e.g., 1 = 1e18 wei).</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-300 mb-2">
              Property Image <span className="text-red-400">*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              required
              className="w-full bg-gray-800 border border-primary-500/50 rounded-lg px-4 py-3 text-primary-200 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-700 transition-all"
            />
            {formData.imagePreview && (
              <div className="mt-4">
                <p className="text-xs text-primary-400 mb-2">Image Preview:</p>
                <img
                  src={formData.imagePreview}
                  alt="Preview"
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
            <p className="text-xs text-primary-400 mt-1">Upload your token’s logo (recommended: 128x128 PNG).</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-300 mb-2">
              Project Description <span className="text-red-400">*</span>
            </label>
            <textarea
              name="projectDesc"
              value={formData.projectDesc}
              onChange={handleChange}
              required
              rows={4}
              className="w-full bg-gray-800 border border-primary-500/50 rounded-lg px-4 py-3 text-primary-200 placeholder-primary-400/70 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all"
              placeholder="Describe your property or project..."
            />
            <p className="text-xs text-primary-400 mt-1">A brief description of your token’s purpose or project (max 500 characters recommended).</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-primary-300 mb-2">
                Website URL
              </label>
              <input
                type="url"
                name="websiteLink"
                value={formData.websiteLink}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-primary-500/50 rounded-lg px-4 py-3 text-primary-200 placeholder-primary-400/70 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all"
                placeholder="https://example.com"
              />
              <p className="text-xs text-primary-400 mt-1">Official project website (optional).</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-300 mb-2">
                Twitter URL
              </label>
              <input
                type="url"
                name="twitterLink"
                value={formData.twitterLink}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-primary-500/50 rounded-lg px-4 py-3 text-primary-200 placeholder-primary-400/70 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all"
                placeholder="https://twitter.com/example"
              />
              <p className="text-xs text-primary-400 mt-1">Twitter profile for updates (optional).</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-300 mb-2">
              Telegram URL
            </label>
            <input
              type="url"
              name="telegramLink"
              value={formData.telegramLink}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-primary-500/50 rounded-lg px-4 py-3 text-primary-200 placeholder-primary-400/70 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all"
              placeholder="https://t.me/example"
            />
            <p className="text-xs text-primary-400 mt-1">Telegram group or channel (optional).</p>
          </div>

          <div className="flex justify-end space-x-4">
            <motion.button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-primary-200 font-medium transition-colors shadow-md"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Cancel
            </motion.button>
            <motion.button
              type="submit"
              disabled={uploading}
              className={`px-6 py-3 rounded-lg font-medium transition-colors shadow-md ${
                uploading ? 'bg-gray-500 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
              whileHover={{ scale: uploading ? 1 : 1.05 }}
              whileTap={{ scale: uploading ? 1 : 0.95 }}
            >
              {uploading ? 'Uploading Image...' : 'Create Token'}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}