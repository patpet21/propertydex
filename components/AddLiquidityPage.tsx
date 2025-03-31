import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import { ethers, Contract, Signer, parseUnits, formatUnits } from 'ethers';
import { Toaster, toast } from 'react-hot-toast';

// ABI of the TokenLaunchHubCustom contract (simplified for relevant functions)
const listingAbi = [
  'function listingCount() public view returns (uint256)',
  'function getListingDetails(uint256 listingId) external view returns (address seller, address tokenAddress, uint256 tradableAmountRaw, uint256 soldAmountRaw, uint256 priceInitialRaw, uint256 currentPriceRaw, uint256 fdmcRaw, uint256 marketCapRaw, address paymentToken, bool active, uint256 endTime)',
  'function getTokenBalance(address tokenAddress) external view returns (uint256)',
  'function migrateListingPublic(uint256 listingId) external',
];

// ABI of the Aerodrome Router
const routerAbi = [
  'function addLiquidity(address tokenA, address tokenB, bool stable, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external returns (uint256 amountA, uint256 amountB, uint256 liquidity)',
  'function weth() external view returns (address)',
];

// ERC-20 ABI
const erc20Abi = [
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function decimals() public view returns (uint8)',
  'function balanceOf(address account) public view returns (uint256)',
];

interface AddLiquidityPageProps {
  onClose: () => void;
  signer: Signer | null;
  initialListingId?: number;
}

const AddLiquidityPage: React.FC<AddLiquidityPageProps> = ({
  onClose,
  signer,
  initialListingId,
}) => {
  const [mode, setMode] = useState<'wallet' | 'contract'>('wallet');
  const [listingId, setListingId] = useState<string>(
    initialListingId?.toString() || ''
  );
  const [tokenA, setTokenA] = useState<string>('');
  const [tokenB, setTokenB] = useState<string>('');
  const [tokenADecimals, setTokenADecimals] = useState<number>(18);
  const [tokenBDecimals, setTokenBDecimals] = useState<number>(18);
  const [tokenAContractBalance, setTokenAContractBalance] =
    useState<string>('0');
  const [tokenBContractBalance, setTokenBContractBalance] =
    useState<string>('0');
  const [tokenABalance, setTokenABalance] = useState<string>('0');
  const [tokenBBalance, setTokenBBalance] = useState<string>('0');
  const [amountADesired, setAmountADesired] = useState<string>('');
  const [amountBDesired, setAmountBDesired] = useState<string>('');
  const [amountAMin, setAmountAMin] = useState<string>('');
  const [amountBMin, setAmountBMin] = useState<string>('');
  const [stable, setStable] = useState<boolean>(false);
  const [deadline, setDeadline] = useState<number>(
    Math.floor(Date.now() / 1000) + 60 * 20
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [tokenAApproved, setTokenAApproved] = useState<boolean>(false);
  const [tokenBApproved, setTokenBApproved] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const LISTING_CONTRACT_ADDRESS = '0xdc29080e1af36330f54e541a0b7b162a0f571546'; // Replace with the actual address
  const ROUTER_CONTRACT_ADDRESS = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43';

  // Fetch tokens from the listing
  const fetchTokensFromListing = async (id: string) => {
    if (!signer || !id) {
      setErrorMessage('Please enter a valid listing ID and connect the signer');
      toast.error('Please enter a valid listing ID and connect the signer');
      return;
    }

    try {
      const listingContract = new Contract(
        LISTING_CONTRACT_ADDRESS,
        listingAbi,
        signer
      );
      const parsedId = parseInt(id);
      const totalListings = Number(await listingContract.listingCount());

      if (isNaN(parsedId) || parsedId >= totalListings || parsedId < 0) {
        throw new Error(
          `Invalid listing ID: ${id}. Total listings available: ${totalListings}`
        );
      }

      const listingDetails = await listingContract.getListingDetails(parsedId);
      const tokenAddress = listingDetails.tokenAddress;
      const paymentToken = listingDetails.paymentToken;

      if (!ethers.isAddress(tokenAddress))
        throw new Error('Invalid Token A address');
      if (!ethers.isAddress(paymentToken))
        throw new Error('Invalid Token B address');

      setTokenA(tokenAddress);
      setTokenB(paymentToken);

      const userAddress = await signer.getAddress();
      const tokenAContract = new Contract(tokenAddress, erc20Abi, signer);
      const tokenBContract = new Contract(paymentToken, erc20Abi, signer);
      const decimalsA = await tokenAContract.decimals();
      const decimalsB = await tokenBContract.decimals();
      const contractBalanceA = await listingContract.getTokenBalance(
        tokenAddress
      );
      const contractBalanceB = await listingContract.getTokenBalance(
        paymentToken
      );
      const userBalanceA = await tokenAContract.balanceOf(userAddress);
      const userBalanceB = await tokenBContract.balanceOf(userAddress);

      setTokenADecimals(Number(decimalsA));
      setTokenBDecimals(Number(decimalsB));
      setTokenAContractBalance(formatUnits(contractBalanceA, decimalsA));
      setTokenBContractBalance(formatUnits(contractBalanceB, decimalsB));
      setTokenABalance(formatUnits(userBalanceA, decimalsA));
      setTokenBBalance(formatUnits(userBalanceB, decimalsB));
      setAmountADesired(
        formatUnits(listingDetails.reservedAmountRaw, decimalsA)
      );
      setAmountBDesired(
        formatUnits((contractBalanceB * 90n) / 100n, decimalsB)
      ); // 90% for Aerodrome

      setErrorMessage(null);
      toast.success('Listing data loaded successfully!');
    } catch (error: any) {
      console.error('Error loading tokens:', error);
      setErrorMessage(error.message || 'Error loading listing data');
      toast.error(error.message || 'Error loading listing data');
    }
  };

  // Fetch token details from wallet
  const fetchTokenDetailsFromWallet = async (
    tokenAddress: string,
    isTokenA: boolean
  ) => {
    if (!signer || !ethers.isAddress(tokenAddress)) {
      setErrorMessage('Invalid token address');
      toast.error('Invalid token address');
      return;
    }

    try {
      const tokenContract = new Contract(tokenAddress, erc20Abi, signer);
      const userAddress = await signer.getAddress();
      const decimals = await tokenContract.decimals();
      const balance = await tokenContract.balanceOf(userAddress);

      if (isTokenA) {
        setTokenADecimals(Number(decimals));
        setTokenABalance(formatUnits(balance, decimals));
      } else {
        setTokenBDecimals(Number(decimals));
        setTokenBBalance(formatUnits(balance, decimals));
      }

      setErrorMessage(null);
    } catch (error: any) {
      console.error('Error loading token:', error);
      setErrorMessage(error.message || 'Error loading token');
      toast.error(error.message || 'Error loading token');
    }
  };

  useEffect(() => {
    if (mode === 'contract' && initialListingId !== undefined) {
      fetchTokensFromListing(initialListingId.toString());
    }
  }, [signer, initialListingId, mode]);

  const handleSetMaxA = () => {
    setAmountADesired(tokenABalance);
    setAmountAMin((Number(tokenABalance) * 0.99).toString());
  };

  const handleSetMaxB = () => {
    setAmountBDesired(tokenBBalance);
    setAmountBMin((Number(tokenBBalance) * 0.99).toString());
  };

  const checkAndApproveToken = async (
    tokenAddress: string,
    amount: string,
    decimals: number,
    setApproved: (value: boolean) => void
  ) => {
    if (!signer || !tokenAddress || !amount) return;

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsApproving(true);
    try {
      const tokenContract = new Contract(tokenAddress, erc20Abi, signer);
      const userAddress = await signer.getAddress();
      const allowance = await tokenContract.allowance(
        userAddress,
        ROUTER_CONTRACT_ADDRESS
      );
      const amountInUnits = parseUnits(amount, decimals);

      if (allowance < amountInUnits) {
        const tx = await tokenContract.approve(
          ROUTER_CONTRACT_ADDRESS,
          amountInUnits
        );
        await tx.wait();
        toast.success(
          `Token ${tokenAddress.slice(0, 6)}... approved successfully!`
        );
      }
      setApproved(true);
    } catch (error: any) {
      console.error('Error during approval:', error);
      toast.error(error.message || 'Error approving token');
    } finally {
      setIsApproving(false);
    }
  };

  const handleApproveTokenA = async () => {
    await checkAndApproveToken(
      tokenA,
      amountADesired,
      tokenADecimals,
      setTokenAApproved
    );
  };

  const handleApproveTokenB = async () => {
    await checkAndApproveToken(
      tokenB,
      amountBDesired,
      tokenBDecimals,
      setTokenBApproved
    );
  };

  const handleAddLiquidityFromWallet = async () => {
    if (
      !signer ||
      !tokenA ||
      !tokenB ||
      !amountADesired ||
      !amountBDesired ||
      !amountAMin ||
      !amountBMin
    ) {
      toast.error('Please fill in all fields');
      return;
    }

    const amounts = [amountADesired, amountBDesired, amountAMin, amountBMin];
    for (const amount of amounts) {
      if (isNaN(Number(amount)) || Number(amount) <= 0) {
        toast.error('Please enter valid amounts');
        return;
      }
    }

    setIsLoading(true);
    try {
      const routerContract = new Contract(
        ROUTER_CONTRACT_ADDRESS,
        routerAbi,
        signer
      );
      const userAddress = await signer.getAddress();

      const amountAInUnits = parseUnits(amountADesired, tokenADecimals);
      const amountBInUnits = parseUnits(amountBDesired, tokenBDecimals);
      const amountAMinInUnits = parseUnits(amountAMin, tokenADecimals);
      const amountBMinInUnits = parseUnits(amountBMin, tokenBDecimals);

      const tokenAContract = new Contract(tokenA, erc20Abi, signer);
      const tokenBContract = new Contract(tokenB, erc20Abi, signer);
      const balanceA = await tokenAContract.balanceOf(userAddress);
      const balanceB = await tokenBContract.balanceOf(userAddress);

      if (balanceA < amountAInUnits)
        throw new Error(
          `Insufficient funds for Token A: ${formatUnits(
            balanceA,
            tokenADecimals
          )}`
        );
      if (balanceB < amountBInUnits)
        throw new Error(
          `Insufficient funds for Token B: ${formatUnits(
            balanceB,
            tokenBDecimals
          )}`
        );

      const tx = await routerContract.addLiquidity(
        tokenA,
        tokenB,
        stable,
        amountAInUnits,
        amountBInUnits,
        amountAMinInUnits,
        amountBMinInUnits,
        userAddress,
        deadline
      );

      await tx.wait();
      toast.success('Liquidity added successfully!', {
        icon: <CheckCircle className="w-5 h-5 text-green-500" />,
      });
      onClose();
    } catch (error: any) {
      console.error('Error adding liquidity:', error);
      toast.error(error.reason || error.message || 'Error adding liquidity');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMigrateLiquidityFromContract = async () => {
    if (!signer || !listingId) {
      toast.error('Please connect your wallet and enter a listing ID');
      return;
    }

    setIsLoading(true);
    try {
      const listingContract = new Contract(
        LISTING_CONTRACT_ADDRESS,
        listingAbi,
        signer
      );
      const parsedId = parseInt(listingId);

      const tx = await listingContract.migrateListingPublic(parsedId);
      await tx.wait();

      toast.success('Liquidity migrated successfully!', {
        icon: <CheckCircle className="w-5 h-5 text-green-500" />,
      });
      onClose();
    } catch (error: any) {
      console.error('Error migrating liquidity:', error);
      toast.error(error.reason || error.message || 'Error migrating liquidity');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-gradient-to-br from-gray-900 to-black rounded-xl p-4 py-4 w-full max-w-md max-h-[70vh] overflow-y-auto border border-white/10 shadow-2xl relative"
    >
      <Toaster position="top-right" />
      <div className="flex justify-end space-x-2 absolute top-4 right-4">
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors px-3 py-1 rounded-lg border border-gray-500 hover:border-white"
        >
          Close
        </button>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="flex items-center mb-4">
        <DollarSign className="w-6 h-6 text-primary-400 mr-2" />
        <h2 className="text-2xl font-bold text-white">Add Liquidity</h2>
      </div>

      {/* Mode Selection */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-300 mb-1">
          Mode
        </label>
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setMode('wallet');
              setListingId('');
              setTokenA('');
              setTokenB('');
              setTokenABalance('0');
              setTokenBBalance('0');
              setAmountADesired('');
              setAmountBDesired('');
              setAmountAMin('');
              setAmountBMin('');
              setTokenAApproved(false);
              setTokenBApproved(false);
              setErrorMessage(null);
            }}
            className={`px-3 py-1 rounded-lg text-sm ${
              mode === 'wallet'
                ? 'bg-primary-600 text-white'
                : 'bg-white/5 text-gray-400'
            }`}
          >
            From Wallet
          </button>
          <button
            onClick={() => {
              setMode('contract');
              setTokenA('');
              setTokenB('');
              setTokenABalance('0');
              setTokenBBalance('0');
              setAmountADesired('');
              setAmountBDesired('');
              setAmountAMin('');
              setAmountBMin('');
              setTokenAApproved(false);
              setTokenBApproved(false);
              setErrorMessage(null);
            }}
            className={`px-3 py-1 rounded-lg text-sm ${
              mode === 'contract'
                ? 'bg-primary-600 text-white'
                : 'bg-white/5 text-gray-400'
            }`}
          >
            From Contract
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-500/20 text-red-300 rounded-lg text-sm">
          {errorMessage}
        </div>
      )}

      {mode === 'contract' && (
        <>
          {/* Listing ID Input */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Listing ID
            </label>
            <input
              type="text"
              value={listingId}
              onChange={(e) => {
                setListingId(e.target.value);
                fetchTokensFromListing(e.target.value);
              }}
              placeholder="Enter the listing ID"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Token A */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Token A Address
            </label>
            <input
              type="text"
              value={tokenA || 'Loading...'}
              readOnly
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none cursor-not-allowed"
            />
            {tokenA && signer && (
              <div className="text-xs text-gray-400 mt-1">
                Contract Balance: {tokenAContractBalance} | Wallet Balance:{' '}
                {tokenABalance}
              </div>
            )}
          </div>

          {/* Token B */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Token B Address
            </label>
            <input
              type="text"
              value={tokenB || 'Loading...'}
              readOnly
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none cursor-not-allowed"
            />
            {tokenB && signer && (
              <div className="text-xs text-gray-400 mt-1">
                Contract Balance: {tokenBContractBalance} | Wallet Balance:{' '}
                {tokenBBalance}
              </div>
            )}
          </div>

          {/* Amount A Desired (Readonly) */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Token A Amount (Reserved)
            </label>
            <input
              type="text"
              value={amountADesired || 'Loading...'}
              readOnly
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none cursor-not-allowed"
            />
          </div>

          {/* Amount B Desired (Readonly) */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Token B Amount (90% Pool)
            </label>
            <input
              type="text"
              value={amountBDesired || 'Loading...'}
              readOnly
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none cursor-not-allowed"
            />
          </div>

          {/* Migrate Liquidity Button */}
          <button
            onClick={handleMigrateLiquidityFromContract}
            disabled={isLoading || !tokenA || !tokenB || !listingId}
            className={`w-full flex items-center justify-center px-4 py-2 rounded-lg transition-colors text-sm ${
              isLoading || !tokenA || !tokenB || !listingId
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-700 hover:to-secondary-700'
            }`}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : null}
            {isLoading ? 'Migrating...' : 'Migrate Liquidity (From Contract)'}
          </button>
        </>
      )}

      {mode === 'wallet' && (
        <>
          {/* Token A */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Token A Address
            </label>
            <input
              type="text"
              value={tokenA}
              onChange={(e) => {
                setTokenA(e.target.value);
                fetchTokenDetailsFromWallet(e.target.value, true);
              }}
              placeholder="Enter Token A address"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {tokenA && signer && (
              <div className="text-xs text-gray-400 mt-1">
                Wallet Balance: {tokenABalance}
              </div>
            )}
          </div>

          {/* Token B */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Token B Address
            </label>
            <input
              type="text"
              value={tokenB}
              onChange={(e) => {
                setTokenB(e.target.value);
                fetchTokenDetailsFromWallet(e.target.value, false);
              }}
              placeholder="Enter Token B address"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {tokenB && signer && (
              <div className="text-xs text-gray-400 mt-1">
                Wallet Balance: {tokenBBalance}
              </div>
            )}
          </div>

          {/* Amount A Desired */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Desired Token A Amount
            </label>
            <div className="relative mb-2">
              <input
                type="text"
                value={amountADesired}
                onChange={(e) => setAmountADesired(e.target.value)}
                placeholder="0.0"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={handleSetMaxA}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-primary-400 hover:text-primary-300"
              >
                Max
              </button>
            </div>
            <input
              type="range"
              min="0"
              max={tokenABalance}
              step="0.01"
              value={amountADesired || 0}
              onChange={(e) => setAmountADesired(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Amount B Desired */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Desired Token B Amount
            </label>
            <div className="relative mb-2">
              <input
                type="text"
                value={amountBDesired}
                onChange={(e) => setAmountBDesired(e.target.value)}
                placeholder="0.0"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={handleSetMaxB}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-primary-400 hover:text-primary-300"
              >
                Max
              </button>
            </div>
            <input
              type="range"
              min="0"
              max={tokenBBalance}
              step="0.01"
              value={amountBDesired || 0}
              onChange={(e) => setAmountBDesired(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Amount A Minimum */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Minimum Token A Amount
            </label>
            <div className="relative mb-2">
              <input
                type="text"
                value={amountAMin}
                onChange={(e) => setAmountAMin(e.target.value)}
                placeholder="0.0"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={() => setAmountAMin(tokenABalance)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-primary-400 hover:text-primary-300"
              >
                Max
              </button>
            </div>
            <input
              type="range"
              min="0"
              max={tokenABalance}
              step="0.01"
              value={amountAMin || 0}
              onChange={(e) => setAmountAMin(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Amount B Minimum */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Minimum Token B Amount
            </label>
            <div className="relative mb-2">
              <input
                type="text"
                value={amountBMin}
                onChange={(e) => setAmountBMin(e.target.value)}
                placeholder="0.0"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={() => setAmountBMin(tokenBBalance)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-primary-400 hover:text-primary-300"
              >
                Max
              </button>
            </div>
            <input
              type="range"
              min="0"
              max={tokenBBalance}
              step="0.01"
              value={amountBMin || 0}
              onChange={(e) => setAmountBMin(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Stable Pool */}
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              checked={stable}
              onChange={(e) => setStable(e.target.checked)}
              className="w-4 h-4 text-primary-500 bg-white/5 border-white/10 rounded focus:ring-primary-500"
            />
            <label className="ml-2 text-xs font-medium text-gray-300">
              Stable Pool
            </label>
          </div>

          {/* Deadline */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Deadline (Unix Timestamp)
            </label>
            <input
              type="number"
              value={deadline}
              onChange={(e) => setDeadline(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Approval Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={handleApproveTokenA}
              disabled={
                isApproving || tokenAApproved || !tokenA || !amountADesired
              }
              className={`flex items-center justify-center px-3 py-1.5 rounded-lg transition-colors text-sm ${
                tokenAApproved
                  ? 'bg-green-500/20 text-green-300 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700'
              } ${isApproving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isApproving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : tokenAApproved ? (
                <CheckCircle className="w-4 h-4 mr-1" />
              ) : null}
              {tokenAApproved ? 'Token A Approved' : 'Approve Token A'}
            </button>
            <button
              onClick={handleApproveTokenB}
              disabled={
                isApproving || tokenBApproved || !tokenB || !amountBDesired
              }
              className={`flex items-center justify-center px-3 py-1.5 rounded-lg transition-colors text-sm ${
                tokenBApproved
                  ? 'bg-green-500/20 text-green-300 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700'
              } ${isApproving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isApproving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : tokenBApproved ? (
                <CheckCircle className="w-4 h-4 mr-1" />
              ) : null}
              {tokenBApproved ? 'Token B Approved' : 'Approve Token B'}
            </button>
          </div>

          {/* Add Liquidity Button */}
          <button
            onClick={handleAddLiquidityFromWallet}
            disabled={isLoading || !tokenAApproved || !tokenBApproved}
            className={`w-full flex items-center justify-center px-4 py-2 rounded-lg transition-colors text-sm ${
              isLoading || !tokenAApproved || !tokenBApproved
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-700 hover:to-secondary-700'
            }`}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : null}
            {isLoading ? 'Adding Liquidity...' : 'Add Liquidity (From Wallet)'}
          </button>
        </>
      )}
    </motion.div>
  );
};

export default AddLiquidityPage;
