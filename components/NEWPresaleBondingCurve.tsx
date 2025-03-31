import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Lock, Globe, FileText, ShoppingCart } from 'lucide-react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import debounce from 'lodash/debounce';

interface BondingCurvePageProps {
  signer: ethers.Signer | null;
  onClose: () => void; // Nuova prop per gestire la chiusura
}

const TOKEN_LAUNCHPAD_ADDRESS = '0x975cf7cb3b414d22d3e208ce5f058fc1b456d6bc';
const TOKEN_FACTORY_ADDRESS = '0x9E23a21de48e3b9200779f012086Acf3989bE50F';
const PRDX_TOKEN_ADDRESS = '0x61Dd008F1582631Aa68645fF92a1a5ECAedBeD19';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const FACTORY_ABI = [
  "function createToken(string tokenName, string tokenSymbol, uint256 initialSupply, string imageLink, string twitterLink) external returns ((address tokenAddress, string name, string symbol, uint256 initialSupply, address creator, string imageUrl, string twitterUrl))",
  "function approvePlatformHub(address tokenAddress, address platformHub, uint256 amount) external",
  "function transferToPlatformHub(address tokenAddress, address platformHub, uint256 amount) external",
  "function getTokenDetails(address tokenAddress) external view returns (address, string, string, uint256, address, string, string)"
];

const LAUNCHPAD_ABI = [
  "function listTokenFromDeposit(address tokenAddress, uint256 amountRaw, uint256 priceInitialRaw, address paymentToken, uint256 durationInSeconds, (string projectWebsite, string socialMediaLink, string tokenImageUrl, string telegramUrl, string projectDescription) metadata) external",
  "function listTokenFromSource(address tokenAddress, uint256 amountRaw, uint256 priceInitialRaw, address paymentToken, uint256 durationInSeconds, address sourceAddress, (string projectWebsite, string socialMediaLink, string tokenImageUrl, string telegramUrl, string projectDescription) metadata) external",
  "function listingCount() external view returns (uint256)",
  "function getTokenBalance(address tokenAddress) external view returns (uint256)",
  "function getAllowance(address tokenAddress, address tokenOwner, address spender) external view returns (uint256)"
];

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

const isValidUrl = (url: string): boolean => {
  if (!url) return true;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const normalizeDecimal = (value: string): string => {
  try {
    const cleanedValue = value.replace(',', '.').replace(/[^0-9.e-]/g, '');
    const num = Number(cleanedValue);
    if (isNaN(num)) throw new Error('Invalid number');
    return num.toFixed(18).replace(/\.?0+$/, '');
  } catch {
    return '0';
  }
};

const formatBalance = (balance: string): string => {
  if (!balance) return '0';
  const num = parseFloat(balance);
  if (isNaN(num)) return '0';
  if (Math.abs(num) < 0.000001) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 18 });
  }
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 18 }).replace(/\.?0+$/, '');
};

async function createToken(
  tokenName: string,
  tokenSymbol: string,
  initialSupply: string,
  imageLink: string,
  twitterLink: string,
  signer: ethers.Signer
) {
  const factory = new ethers.Contract(TOKEN_FACTORY_ADDRESS, FACTORY_ABI, signer);
  const supplyFloat = parseFloat(initialSupply);
  if (isNaN(supplyFloat) || supplyFloat <= 0) throw new Error('Supply must be positive');

  toast.loading('Creating token...', { id: 'create-token' });
  const tx = await factory.createToken(tokenName, tokenSymbol, ethers.parseUnits(supplyFloat.toString(), 18), imageLink, twitterLink);
  const receipt = await tx.wait();
  const tokenDetails = await factory.getTokenDetails(receipt.logs[0].address);
  toast.success(`Token ${tokenName} created! Address: ${tokenDetails[0]}`, { id: 'create-token' });
  return tokenDetails[0];
}

async function approveAndTransferFromFactory(
  tokenAddress: string,
  amount: string,
  signer: ethers.Signer
) {
  const factory = new ethers.Contract(TOKEN_FACTORY_ADDRESS, FACTORY_ABI, signer);
  const token = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);
  const decimals = await token.decimals();
  const amountRaw = ethers.parseUnits(normalizeDecimal(amount), decimals);

  toast.loading('Approving launchpad...', { id: 'approve-launchpad' });
  const approveTx = await factory.approvePlatformHub(tokenAddress, TOKEN_LAUNCHPAD_ADDRESS, amountRaw);
  await approveTx.wait();
  toast.success('Launchpad approved!', { id: 'approve-launchpad' });

  toast.loading('Transferring to launchpad...', { id: 'transfer-launchpad' });
  const transferTx = await factory.transferToPlatformHub(tokenAddress, TOKEN_LAUNCHPAD_ADDRESS, amountRaw);
  await transferTx.wait();
  toast.success('Tokens transferred to launchpad!', { id: 'transfer-launchpad' });
}

async function approveFromSource(
  tokenAddress: string,
  sourceAddress: string,
  amount: string,
  signer: ethers.Signer
) {
  const token = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);
  const decimals = await token.decimals();
  const amountRaw = ethers.parseUnits(normalizeDecimal(amount), decimals);

  toast.loading('Approving launchpad...', { id: 'approve-source' });
  const approveTx = await token.approve(TOKEN_LAUNCHPAD_ADDRESS, amountRaw);
  await approveTx.wait();
  toast.success('Launchpad approved!', { id: 'approve-source' });
}

async function listTokenFromDeposit(
  tokenAddress: string,
  amount: string,
  pricePerShare: string,
  useUSDC: boolean,
  projectWebsite: string,
  socialMediaLink: string,
  imageUrl: string,
  telegramUrl: string,
  projectDescription: string,
  signer: ethers.Signer,
  durationInSeconds: number
) {
  if (!ethers.isAddress(tokenAddress)) throw new Error('Invalid token address');
  const token = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);
  const decimals = await token.decimals();
  const amountRaw = ethers.parseUnits(normalizeDecimal(amount), decimals);

  const paymentTokenAddress = useUSDC ? USDC_ADDRESS : PRDX_TOKEN_ADDRESS;
  const paymentToken = new ethers.Contract(paymentTokenAddress, TOKEN_ABI, signer);
  const paymentDecimals = await paymentToken.decimals();
  const pricePerShareRaw = ethers.parseUnits(normalizeDecimal(pricePerShare), paymentDecimals);

  const launchpad = new ethers.Contract(TOKEN_LAUNCHPAD_ADDRESS, LAUNCHPAD_ABI, signer);
  const metadata = { projectWebsite, socialMediaLink, tokenImageUrl: imageUrl, telegramUrl, projectDescription };

  toast.loading('Listing token from deposit...', { id: 'list-token' });
  const tx = await launchpad.listTokenFromDeposit(
    tokenAddress,
    amountRaw,
    pricePerShareRaw,
    paymentTokenAddress,
    durationInSeconds,
    metadata
  );
  await tx.wait();
  toast.success('Token listed successfully!', { id: 'list-token' });
}

async function listTokenFromSource(
  tokenAddress: string,
  amount: string,
  pricePerShare: string,
  useUSDC: boolean,
  sourceAddress: string,
  projectWebsite: string,
  socialMediaLink: string,
  imageUrl: string,
  telegramUrl: string,
  projectDescription: string,
  signer: ethers.Signer,
  durationInSeconds: number
) {
  if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(sourceAddress)) throw new Error('Invalid address');
  const token = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);
  const decimals = await token.decimals();
  const amountRaw = ethers.parseUnits(normalizeDecimal(amount), decimals);

  const paymentTokenAddress = useUSDC ? USDC_ADDRESS : PRDX_TOKEN_ADDRESS;
  const paymentToken = new ethers.Contract(paymentTokenAddress, TOKEN_ABI, signer);
  const paymentDecimals = await paymentToken.decimals();
  const pricePerShareRaw = ethers.parseUnits(normalizeDecimal(pricePerShare), paymentDecimals);

  const launchpad = new ethers.Contract(TOKEN_LAUNCHPAD_ADDRESS, LAUNCHPAD_ABI, signer);
  const metadata = { projectWebsite, socialMediaLink, tokenImageUrl: imageUrl, telegramUrl, projectDescription };

  toast.loading('Listing token from source...', { id: 'list-token' });
  const tx = await launchpad.listTokenFromSource(
    tokenAddress,
    amountRaw,
    pricePerShareRaw,
    paymentTokenAddress,
    durationInSeconds,
    sourceAddress,
    metadata
  );
  await tx.wait();
  toast.success('Token listed successfully!', { id: 'list-token' });
}

const BondingCurvePage: React.FC<BondingCurvePageProps> = ({ signer, onClose }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [createdTokenAddress, setCreatedTokenAddress] = useState<string | null>(null);
  const [isCardVisible, setIsCardVisible] = useState(true);
  const [createForm, setCreateForm] = useState({
    tokenName: '',
    tokenSymbol: '',
    initialSupply: '',
    imageLink: '',
    twitterLink: '',
  });
  const [listForm, setListForm] = useState({
    tokenAddress: '',
    amount: '',
    pricePerShare: '',
    useUSDC: false,
    sourceOption: 'factory' as 'factory' | 'custom',
    sourceAddress: TOKEN_FACTORY_ADDRESS,
    projectWebsite: '',
    socialMediaLink: '',
    imageUrl: '',
    telegramUrl: '',
    projectDescription: '',
    duration: 2592000,
  });
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [paymentTokenBalance, setPaymentTokenBalance] = useState<string | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState('TOKEN');
  const [paymentTokenSymbol, setPaymentTokenSymbol] = useState('PRDX');
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBalances = useCallback(
    debounce(async (signer: ethers.Signer | null, tokenAddress: string, useUSDC: boolean, sourceAddress: string) => {
      if (!signer) return;
      setLoadingBalances(true);
      try {
        const userAddress = await signer.getAddress();
        if (ethers.isAddress(tokenAddress)) {
          const token = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);
          const decimals = await token.decimals();
          const balanceRaw = await token.balanceOf(sourceAddress || userAddress);
          setTokenBalance(ethers.formatUnits(balanceRaw, decimals));
          setTokenSymbol(await token.symbol());
        }
        const paymentTokenAddress = useUSDC ? USDC_ADDRESS : PRDX_TOKEN_ADDRESS;
        const paymentToken = new ethers.Contract(paymentTokenAddress, TOKEN_ABI, signer);
        const paymentDecimals = await paymentToken.decimals();
        const paymentBalanceRaw = await paymentToken.balanceOf(userAddress);
        setPaymentTokenBalance(ethers.formatUnits(paymentBalanceRaw, paymentDecimals));
        setPaymentTokenSymbol(await paymentToken.symbol());
      } catch (err) {
        toast.error('Failed to load balances');
        console.error('Errore nel caricamento dei bilanci:', err);
      } finally {
        setLoadingBalances(false);
      }
    }, 500),
    []
  );

  useEffect(() => {
    loadBalances(signer, listForm.tokenAddress || createdTokenAddress || '', listForm.useUSDC, listForm.sourceAddress);
  }, [signer, listForm.tokenAddress, createdTokenAddress, listForm.useUSDC, listForm.sourceAddress, loadBalances]);

  const handleCreateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCreateForm({ ...createForm, [e.target.name]: e.target.value });
  };

  const handleListChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'amount' || name === 'pricePerShare') {
      const normalizedValue = normalizeDecimal(value);
      if (parseFloat(normalizedValue) < 0) return;
      setListForm({ ...listForm, [name]: value });
    } else if (name === 'sourceAddress') {
      setListForm({ ...listForm, [name]: value, sourceOption: 'custom' });
    } else {
      setListForm({ ...listForm, [name]: value });
    }
  };

  const handleSourceOptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sourceOption = e.target.value as 'factory' | 'custom';
    setListForm({
      ...listForm,
      sourceOption,
      sourceAddress: sourceOption === 'factory' ? TOKEN_FACTORY_ADDRESS : ''
    });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setListForm({ ...listForm, useUSDC: e.target.checked });
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) || 600;
    setListForm({ ...listForm, duration: Math.max(600, value) });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer) {
      toast.error('Please connect your wallet');
      return;
    }
    try {
      setIsSubmitting(true);
      const tokenAddress = await createToken(
        createForm.tokenName,
        createForm.tokenSymbol,
        createForm.initialSupply,
        createForm.imageLink,
        createForm.twitterLink,
        signer
      );
      setCreatedTokenAddress(tokenAddress);
      setListForm({ ...listForm, tokenAddress });
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleListSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer) {
      toast.error('Please connect your wallet');
      return;
    }
    try {
      setIsSubmitting(true);
      const {
        tokenAddress,
        amount,
        pricePerShare,
        useUSDC,
        sourceOption,
        sourceAddress,
        projectWebsite,
        socialMediaLink,
        imageUrl,
        telegramUrl,
        projectDescription,
        duration
      } = listForm;

      if (sourceOption === 'factory') {
        await approveAndTransferFromFactory(tokenAddress, amount, signer);
        await listTokenFromDeposit(
          tokenAddress,
          amount,
          pricePerShare,
          useUSDC,
          projectWebsite,
          socialMediaLink,
          imageUrl,
          telegramUrl,
          projectDescription,
          signer,
          duration
        );
      } else {
        await approveFromSource(tokenAddress, sourceAddress, amount, signer);
        await listTokenFromSource(
          tokenAddress,
          amount,
          pricePerShare,
          useUSDC,
          sourceAddress,
          projectWebsite,
          socialMediaLink,
          imageUrl,
          telegramUrl,
          projectDescription,
          signer,
          duration
        );
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseCard = () => {
    setIsCardVisible(false); // Nasconde la card
    onClose(); // Chiama la funzione passata dal genitore per gestire la chiusura
  };

  return (
    <div className="p-6 flex flex-col items-center">
      {isCardVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="bg-gradient-to-br from-primary-900 to-gray-900 rounded-xl p-6 w-full max-w-lg border border-primary-500/50 shadow-xl mb-8 relative"
        >
          <button
            onClick={handleCloseCard}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold text-white mb-6">Bonding Curve Token Creator</h1>
          <h2 className="text-xl font-bold text-primary-300 mb-4">
            Bonding Curve Token Creator
          </h2>
          <h3 className="text-lg font-semibold text-white mb-3">
            Create & List Token
          </h3>
          <p className="text-sm text-gray-300 mb-4">
            Launch your own token on our innovative bonding curve platform and list it for sale. 
            Benefit from automated price discovery and liquidity provision through our smart contract system.
          </p>
          <ul className="text-sm text-gray-400 space-y-2 mb-6">
            <li className="flex items-center">
              <Lock className="w-4 h-4 mr-2 text-primary-400" />
              Secure token creation with audited contracts
            </li>
            <li className="flex items-center">
              <Globe className="w-4 h-4 mr-2 text-primary-400" />
              Global accessibility on Base network
            </li>
            <li className="flex items-center">
              <FileText className="w-4 h-4 mr-2 text-primary-400" />
              Customizable token parameters
            </li>
            <li className="flex items-center">
              <ShoppingCart className="w-4 h-4 mr-2 text-primary-400" />
              Instant presale listing
            </li>
          </ul>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-primary-600 hover:bg-primary-700 transition-colors rounded-lg py-3 text-white font-medium flex items-center justify-center"
          >
            Start Your Bonding Curve Presale Now
          </motion.button>
        </motion.div>
      )}

      {isModalOpen && (
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
            className="bg-gradient-to-br from-gray-900 to-black rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg border border-primary-500 relative"
          >
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-primary-300 hover:text-primary-200 transition-colors"
              disabled={isSubmitting}
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-2xl font-bold text-primary-300 mb-6">
              {step === 1 ? 'Create New Token' : 'List Token'}
            </h2>

            {step === 1 ? (
              <form onSubmit={handleCreateSubmit} className="space-y-6">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-primary-300 mb-4">Token Creation</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">Token Name</label>
                      <input
                        type="text"
                        name="tokenName"
                        value={createForm.tokenName}
                        onChange={handleCreateChange}
                        required
                        disabled={isSubmitting}
                        className="w-full bg-gray-700 border border-primary-500 rounded-lg px-4 py-2 text-primary-200 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                        placeholder="e.g., PeterCoin"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">Token Symbol</label>
                      <input
                        type="text"
                        name="tokenSymbol"
                        value={createForm.tokenSymbol}
                        onChange={handleCreateChange}
                        required
                        disabled={isSubmitting}
                        className="w-full bg-gray-700 border border-primary-500 rounded-lg px-4 py-2 text-primary-200 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                        placeholder="e.g., PTR"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">Initial Supply</label>
                      <input
                        type="text"
                        name="initialSupply"
                        value={createForm.initialSupply}
                        onChange={handleCreateChange}
                        required
                        disabled={isSubmitting}
                        className="w-full bg-gray-700 border border-primary-500 rounded-lg px-4 py-2 text-primary-200 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                        placeholder="e.g., 1000000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">Image Link</label>
                      <input
                        type="url"
                        name="imageLink"
                        value={createForm.imageLink}
                        onChange={handleCreateChange}
                        disabled={isSubmitting}
                        className="w-full bg-gray-700 border border-primary-500 rounded-lg px-4 py-2 text-primary-200 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">Twitter Link</label>
                      <input
                        type="url"
                        name="twitterLink"
                        value={createForm.twitterLink}
                        onChange={handleCreateChange}
                        disabled={isSubmitting}
                        className="w-full bg-gray-700 border border-primary-500 rounded-lg px-4 py-2 text-primary-200 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                        placeholder="https://twitter.com/..."
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-4">
                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50 flex items-center"
                    whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      'Create Token'
                    )}
                  </motion.button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleListSubmit} className="space-y-6">
                {/* ... Il resto del form per il listing (lo lasciamo invariato per brevità) ... */}
              </form>
            )}
          </motion.div>
        </motion.div>
      )}

      {error && (
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
            className="bg-red-900 rounded-xl p-6 text-white max-w-md relative"
          >
            <button
              onClick={() => setError(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold mb-4">Error</h2>
            <p>{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-4 px-4 py-2 bg-red-700 rounded hover:bg-red-800"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default BondingCurvePage;