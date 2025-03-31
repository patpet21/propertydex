import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { motion } from 'framer-motion';
import { X, ArrowUpCircle, ArrowDownCircle, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';

// Interfaces (rimangono invariati)
interface Listing {
  id: number;
  creator: string;
  token: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    price: string;
    amount: string;
  };
  paymentToken: string;
  paymentTokenSymbol: string;
  paymentDecimals: number;
  soldAmount: string;
  initialAmount: string;
  isActive: boolean;
  graduated: boolean;
}

interface PricePoint {
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume: string;
  timestamp: number;
}

interface Transaction {
  user: string;
  isBuy: boolean;
  amount: string;
  totalCost: string;
  price: string;
  timestamp: number;
}

interface MarketStats {
  currentPrice: string;
  high24h: string;
  low24h: string;
  historicalHigh: string;
  historicalLow: string;
  priceChange24hPercent: string;
}

// Contract addresses (assumo che siano gli stessi del tuo codice originale)
const TOKEN_LISTING_PLATFORM_ADDRESS = ethers.getAddress('0xF6d44c2Ad34C52eFBE88E9B691e4Ce85AFC94D4E');
const PRDX_TOKEN_ADDRESS = ethers.getAddress('0x61Dd008F1582631Aa68645fF92a1a5ECAedBeD19');
const USDC_ADDRESS = ethers.getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

// TokenListingPlatform ABI (assumo che sia lo stesso del tuo codice originale)
const TOKEN_LISTING_ABI = [
  {"inputs":[{"internalType":"address","name":"_customPaymentToken","type":"address"},{"internalType":"address","name":"_usdcPaymentToken","type":"address"},{"internalType":"address","name":"_feeRecipient","type":"address"},{"internalType":"address","name":"_aerodromeRouter","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"},{"internalType":"uint256","name":"amountRaw","type":"uint256"}],"name":"buyToken","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"},{"internalType":"uint256","name":"soldAmount","type":"uint256"}],"name":"calculateCurrentPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"},{"internalType":"uint256","name":"amountRaw","type":"uint256"}],"name":"calculateBuyCost","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"},{"internalType":"uint256","name":"amountRaw","type":"uint256"}],"name":"calculateSellReturn","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"getListingDetails","outputs":[{"internalType":"address","name":"creator","type":"address"},{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"address","name":"bondingCurveX","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"soldAmount","type":"uint256"},{"internalType":"uint256","name":"priceInitial","type":"uint256"},{"internalType":"uint256","name":"realPaymentReserves","type":"uint256"},{"internalType":"address","name":"paymentToken","type":"address"},{"internalType":"bool","name":"isActive","type":"bool"},{"internalType":"uint256","name":"initialAmount","type":"uint256"},{"internalType":"uint256","name":"migrationStartTimestamp","type":"uint256"},{"internalType":"uint256","name":"paymentDecimals","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"},{"internalType":"uint256","name":"tokenAmount","type":"uint256"}],"name":"sellToken","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"},{"internalType":"uint256","name":"interval","type":"uint256"},{"internalType":"uint256","name":"limit","type":"uint256"}],"name":"getPriceHistoryByInterval","outputs":[{"components":[{"internalType":"uint256","name":"openPrice","type":"uint256"},{"internalType":"uint256","name":"highPrice","type":"uint256"},{"internalType":"uint256","name":"lowPrice","type":"uint256"},{"internalType":"uint256","name":"closePrice","type":"uint256"},{"internalType":"uint256","name":"volume","type":"uint256"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"internalType":"struct TokenListingPlatform.PricePoint[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"},{"internalType":"uint256","name":"limit","type":"uint256"}],"name":"getRecentTransactions","outputs":[{"components":[{"internalType":"address","name":"user","type":"address"},{"internalType":"bool","name":"isBuy","type":"bool"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"totalCost","type":"uint256"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"internalType":"struct TokenListingPlatform.Transaction[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"getMarketStats","outputs":[{"internalType":"uint256","name":"currentPrice","type":"uint256"},{"internalType":"uint256","name":"high24h","type":"uint256"},{"internalType":"uint256","name":"low24h","type":"uint256"},{"internalType":"uint256","name":"historicalHighPrice","type":"uint256"},{"internalType":"uint256","name":"historicalLowPrice","type":"uint256"},{"internalType":"int256","name":"priceChange24hPercent","type":"int256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"totalVolume","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"listingCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"listingId","type":"uint256"}],"name":"graduated","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"}
];

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function totalSupply() external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

// Funzioni helper (assumo che siano le stesse del tuo codice originale)
async function getListings(signer: ethers.Signer): Promise<Listing[]> {
  const contract = new ethers.Contract(TOKEN_LISTING_PLATFORM_ADDRESS, TOKEN_LISTING_ABI, signer);
  let listingCount;
  try {
    listingCount = Number(await contract.listingCount());
    console.log(`Total listingCount: ${listingCount}`);
  } catch (error) {
    console.error('Error fetching listingCount:', error);
    return [];
  }

  const listings: Listing[] = [];
  let activeListings = 0;

  for (let listingId = 0; listingId < listingCount; listingId++) {
    try {
      const listingDetails = await contract.getListingDetails(listingId);
      const graduated = await contract.graduated(listingId);
      const [
        creator,
        tokenAddress,
        ,
        amount,
        soldAmount,
        priceInitial,
        ,
        paymentToken,
        isActive,
        initialAmount,
        ,
        paymentDecimals
      ] = listingDetails;

      console.log(`Listing ${listingId} - isActive: ${isActive}, Graduated: ${graduated}, Sold: ${ethers.formatUnits(soldAmount, paymentDecimals)}, Total: ${ethers.formatUnits(initialAmount, paymentDecimals)}, PriceInitial: ${ethers.formatUnits(priceInitial, paymentDecimals)}`);

      if (!isActive) continue;

      activeListings++;

      const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, signer);
      const paymentContract = new ethers.Contract(paymentToken, TOKEN_ABI, signer);

      let tokenName = 'Unknown Token';
      let tokenSymbol = 'UNKNOWN';
      let tokenDecimals = 18;
      let paymentSymbol = paymentToken === PRDX_TOKEN_ADDRESS ? 'PRDX' : 'USDC';

      try {
        [tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
          tokenContract.name(),
          tokenContract.symbol(),
          tokenContract.decimals()
        ]);
      } catch (error) {
        console.error(`Error fetching token details for ${tokenAddress} (Listing ${listingId}):`, error);
      }

      try {
        paymentSymbol = await paymentContract.symbol();
      } catch (error) {
        console.error(`Error fetching payment token symbol for ${paymentToken} (Listing ${listingId}):`, error);
      }

      const currentPriceRaw = await contract.calculateCurrentPrice(listingId, soldAmount);
      const formattedPrice = ethers.formatUnits(currentPriceRaw, paymentDecimals);

      listings.push({
        id: listingId,
        creator,
        token: {
          address: tokenAddress,
          name: tokenName,
          symbol: tokenSymbol,
          decimals: tokenDecimals,
          price: formattedPrice,
          amount: ethers.formatUnits(amount, tokenDecimals),
        },
        paymentToken,
        paymentTokenSymbol: paymentSymbol,
        paymentDecimals: Number(paymentDecimals),
        soldAmount: ethers.formatUnits(soldAmount, tokenDecimals),
        initialAmount: ethers.formatUnits(initialAmount, tokenDecimals),
        isActive,
        graduated
      });
    } catch (error) {
      console.error(`Error fetching listing ${listingId}:`, error);
    }
  }

  console.log(`Found ${listings.length} listings, ${activeListings} active`);
  return listings;
}

async function buyTokens(listingId: number, amount: string, signer: ethers.Signer, maxSlippagePercent: number) {
  const contract = new ethers.Contract(TOKEN_LISTING_PLATFORM_ADDRESS, TOKEN_LISTING_ABI, signer);
  const listings = await getListings(signer);
  const listing = listings.find(l => l.id === listingId);
  if (!listing) throw new Error('Listing not found');
  if (!listing.isActive) throw new Error('This listing is inactive');

  const amountRaw = ethers.parseUnits(amount, listing.token.decimals);
  let expectedCostRaw;
  try {
    expectedCostRaw = await contract.calculateBuyCost(listingId, amountRaw);
    console.log(`Calculated buy cost for ${amount} ${listing.token.symbol} (raw: ${amountRaw.toString()}): ${ethers.formatUnits(expectedCostRaw, listing.paymentDecimals)} ${listing.paymentTokenSymbol}`);
  } catch (error) {
    console.error(`Error calculating buy cost for listing ${listingId} and amount ${amount}:`, error);
    throw new Error('Failed to calculate buy cost. Check console for details.');
  }

  const currentPriceRaw = await contract.calculateCurrentPrice(listingId, ethers.parseUnits(listing.soldAmount, listing.token.decimals));
  const formattedCurrentPrice = ethers.formatUnits(currentPriceRaw, listing.paymentDecimals);

  const paymentTokenContract = new ethers.Contract(listing.paymentToken, TOKEN_ABI, signer);
  const userAddress = await signer.getAddress();
  const userBalanceRaw = await paymentTokenContract.balanceOf(userAddress);
  const userBalance = ethers.formatUnits(userBalanceRaw, listing.paymentDecimals);
  const allowanceRaw = await paymentTokenContract.allowance(userAddress, TOKEN_LISTING_PLATFORM_ADDRESS);
  const allowance = ethers.formatUnits(allowanceRaw, listing.paymentDecimals);

  console.log(`Attempting to buy ${amount} ${listing.token.symbol} - Cost: ${ethers.formatUnits(expectedCostRaw, listing.paymentDecimals)} ${listing.paymentTokenSymbol}, Current Price: ${formattedCurrentPrice} ${listing.paymentTokenSymbol}, User Balance: ${userBalance} ${listing.paymentTokenSymbol}, Allowance: ${allowance} ${listing.paymentTokenSymbol}`);

  if (BigInt(userBalanceRaw) < BigInt(expectedCostRaw)) throw new Error(`Insufficient ${listing.paymentTokenSymbol} balance. You have ${userBalance}, need ${ethers.formatUnits(expectedCostRaw, listing.paymentDecimals)}`);
  if (BigInt(allowanceRaw) < BigInt(expectedCostRaw)) {
    toast.loading(`Approving ${listing.paymentTokenSymbol}...`);
    const approveTx = await paymentTokenContract.approve(TOKEN_LISTING_PLATFORM_ADDRESS, ethers.MaxUint256);
    await approveTx.wait();
    toast.success('Approval completed');
    const newAllowanceRaw = await paymentTokenContract.allowance(userAddress, TOKEN_LISTING_PLATFORM_ADDRESS);
    console.log(`New allowance after approval: ${ethers.formatUnits(newAllowanceRaw, listing.paymentDecimals)} ${listing.paymentTokenSymbol}`);
  }

  const availableAmount = ethers.parseUnits(listing.token.amount, listing.token.decimals);
  if (BigInt(amountRaw) > BigInt(availableAmount)) throw new Error(`Not enough tokens available. Requested: ${amount}, Available: ${listing.token.amount}`);

  const tx = await contract.buyToken(listingId, amountRaw, { gasLimit: 300000 });
  const receipt = await tx.wait();
  const newPriceRaw = await contract.calculateCurrentPrice(listingId, ethers.parseUnits((parseFloat(listing.soldAmount) + parseFloat(amount)).toString(), listing.token.decimals));
  const slippage = ((BigInt(newPriceRaw) - BigInt(currentPriceRaw)) * 10000n) / BigInt(currentPriceRaw);
  if (slippage > BigInt(maxSlippagePercent * 100)) {
    throw new Error(`Slippage (${Number(slippage) / 100}%) exceeds max allowed (${maxSlippagePercent}%)`);
  }
  console.log(`Buy transaction successful. New price: ${ethers.formatUnits(newPriceRaw, listing.paymentDecimals)} ${listing.paymentTokenSymbol}`);
  return receipt;
}

async function sellTokens(listingId: number, amount: string, signer: ethers.Signer, maxSlippagePercent: number) {
  const contract = new ethers.Contract(TOKEN_LISTING_PLATFORM_ADDRESS, TOKEN_LISTING_ABI, signer);
  const listings = await getListings(signer);
  const listing = listings.find(l => l.id === listingId);
  if (!listing) throw new Error('Listing not found');
  if (!listing.isActive) throw new Error('This listing is inactive');

  const amountRaw = ethers.parseUnits(amount, listing.token.decimals);
  let expectedReturnRaw;
  try {
    expectedReturnRaw = await contract.calculateSellReturn(listingId, amountRaw);
    console.log(`Calculated sell return for ${amount} ${listing.token.symbol} (raw: ${amountRaw.toString()}): ${ethers.formatUnits(expectedReturnRaw, listing.paymentDecimals)} ${listing.paymentTokenSymbol}`);
  } catch (error) {
    console.error(`Error calculating sell return for listing ${listingId} and amount ${amount}:`, error);
    throw new Error('Failed to calculate sell return. Check console for details.');
  }

  const currentPriceRaw = await contract.calculateCurrentPrice(listingId, ethers.parseUnits(listing.soldAmount, listing.token.decimals));
  const formattedCurrentPrice = ethers.formatUnits(currentPriceRaw, listing.paymentDecimals);

  const tokenContract = new ethers.Contract(listing.token.address, TOKEN_ABI, signer);
  const userAddress = await signer.getAddress();
  const userBalanceRaw = await tokenContract.balanceOf(userAddress);
  const userBalance = ethers.formatUnits(userBalanceRaw, listing.token.decimals);
  const allowanceRaw = await tokenContract.allowance(userAddress, TOKEN_LISTING_PLATFORM_ADDRESS);
  const allowance = ethers.formatUnits(allowanceRaw, listing.token.decimals);

  console.log(`Attempting to sell ${amount} ${listing.token.symbol} - Return: ${ethers.formatUnits(expectedReturnRaw, listing.paymentDecimals)} ${listing.paymentTokenSymbol}, Current Price: ${formattedCurrentPrice} ${listing.paymentTokenSymbol}, User Balance: ${userBalance} ${listing.token.symbol}, Allowance: ${allowance} ${listing.token.symbol}`);

  if (BigInt(userBalanceRaw) < BigInt(amountRaw)) throw new Error(`Insufficient ${listing.token.symbol} balance. You have ${userBalance}, need ${amount}`);
  if (BigInt(allowanceRaw) < BigInt(amountRaw)) {
    toast.loading(`Approving ${listing.token.symbol}...`);
    const approveTx = await tokenContract.approve(TOKEN_LISTING_PLATFORM_ADDRESS, ethers.MaxUint256);
    await approveTx.wait();
    toast.success('Approval completed');
    const newAllowanceRaw = await tokenContract.allowance(userAddress, TOKEN_LISTING_PLATFORM_ADDRESS);
    console.log(`New allowance after approval: ${ethers.formatUnits(newAllowanceRaw, listing.token.decimals)} ${listing.token.symbol}`);
  }

  const tx = await contract.sellToken(listingId, amountRaw, { gasLimit: 300000 });
  const receipt = await tx.wait();
  const newPriceRaw = await contract.calculateCurrentPrice(listingId, ethers.parseUnits((parseFloat(listing.soldAmount) - parseFloat(amount)).toString(), listing.token.decimals));
  const slippage = ((BigInt(currentPriceRaw) - BigInt(newPriceRaw)) * 10000n) / BigInt(currentPriceRaw);
  if (slippage > BigInt(maxSlippagePercent * 100)) {
    throw new Error(`Slippage (${Number(slippage) / 100}%) exceeds max allowed (${maxSlippagePercent}%)`);
  }
  console.log(`Sell transaction successful. New price: ${ethers.formatUnits(newPriceRaw, listing.paymentDecimals)} ${listing.paymentTokenSymbol}`);
  return receipt;
}

const TradingPage = ({ listingId, onClose, signer }: { listingId: number; onClose: () => void; signer: ethers.Signer | null }) => {
  const [selectedToken, setSelectedToken] = useState<Listing | null>(null);
  const [allTokens, setAllTokens] = useState<Listing[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  // Aggiungiamo stati per il costo e il ritorno desiderati
  const [desiredCost, setDesiredCost] = useState('');
  const [desiredReturn, setDesiredReturn] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState('0');
  const [totalCost, setTotalCost] = useState('0');
  const [feeCost, setFeeCost] = useState('0');
  const [totalReturn, setTotalReturn] = useState('0');
  const [userBalance, setUserBalance] = useState('0');
  const [userAllowance, setUserAllowance] = useState('0');
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
  const [totalVolume, setTotalVolume] = useState('0');
  const [maxSlippage, setMaxSlippage] = useState(1); // Default 1%
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!signer) {
        console.log('No signer provided');
        return;
      }
      setLoading(true);
      try {
        const tokens = await getListings(signer);
        console.log('Tokens fetched:', tokens);
        setAllTokens(tokens);
        const selected = tokens.find(t => t.id === listingId) || tokens[0];
        if (selected) {
          setSelectedToken(selected);
          const contract = new ethers.Contract(TOKEN_LISTING_PLATFORM_ADDRESS, TOKEN_LISTING_ABI, signer);
          const currentPriceRaw = await contract.calculateCurrentPrice(selected.id, ethers.parseUnits(selected.soldAmount, selected.token.decimals));
          setCurrentPrice(ethers.formatUnits(currentPriceRaw, selected.paymentDecimals));

          const paymentTokenContract = new ethers.Contract(selected.paymentToken, TOKEN_ABI, signer);
          const userAddress = await signer.getAddress();
          const userBalanceRaw = await paymentTokenContract.balanceOf(userAddress);
          setUserBalance(ethers.formatUnits(userBalanceRaw, selected.paymentDecimals));
          const userAllowanceRaw = await paymentTokenContract.allowance(userAddress, TOKEN_LISTING_PLATFORM_ADDRESS);
          setUserAllowance(ethers.formatUnits(userAllowanceRaw, selected.paymentDecimals));

          const priceHistoryRaw = await contract.getPriceHistoryByInterval(selected.id, 3600, 24).catch(err => {
            console.error('Error fetching price history:', err);
            return [];
          });
          setPriceHistory(priceHistoryRaw.map((point: any) => ({
            openPrice: ethers.formatUnits(point.openPrice, selected.paymentDecimals),
            highPrice: ethers.formatUnits(point.highPrice, selected.paymentDecimals),
            lowPrice: ethers.formatUnits(point.lowPrice, selected.paymentDecimals),
            closePrice: ethers.formatUnits(point.closePrice, selected.paymentDecimals),
            volume: ethers.formatUnits(point.volume, selected.paymentDecimals),
            timestamp: Number(point.timestamp)
          })));

          const transactionsRaw = await contract.getRecentTransactions(selected.id, 50).catch(err => {
            console.error('Error fetching transactions:', err);
            return [];
          });
          setRecentTransactions(transactionsRaw.map((tx: any) => ({
            user: tx.user,
            isBuy: tx.isBuy,
            amount: ethers.formatUnits(tx.amount, selected.token.decimals),
            totalCost: ethers.formatUnits(tx.totalCost, selected.paymentDecimals),
            price: ethers.formatUnits(tx.price, selected.paymentDecimals),
            timestamp: Number(tx.timestamp)
          })));

          const marketStatsRaw = await contract.getMarketStats(selected.id).catch(err => {
            console.error('Error fetching market stats:', err);
            return null;
          });
          if (marketStatsRaw) {
            setMarketStats({
              currentPrice: ethers.formatUnits(marketStatsRaw.currentPrice, selected.paymentDecimals),
              high24h: ethers.formatUnits(marketStatsRaw.high24h, selected.paymentDecimals),
              low24h: ethers.formatUnits(marketStatsRaw.low24h, selected.paymentDecimals),
              historicalHigh: ethers.formatUnits(marketStatsRaw.historicalHighPrice, selected.paymentDecimals),
              historicalLow: ethers.formatUnits(marketStatsRaw.historicalLowPrice, selected.paymentDecimals),
              priceChange24hPercent: (Number(marketStatsRaw.priceChange24hPercent) / 100).toFixed(2)
            });
          }

          const totalVolumeRaw = await contract.totalVolume(selected.id).catch(err => {
            console.error('Error fetching total volume:', err);
            return 0n;
          });
          setTotalVolume(ethers.formatUnits(totalVolumeRaw, selected.paymentDecimals));
        } else {
          console.log('No active token selected');
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [signer, listingId]);

  // Modifica useEffect per gestire i costi/ritorni piccoli
  useEffect(() => {
    const updateCosts = async () => {
      if (!signer || !selectedToken) return;
      const contract = new ethers.Contract(TOKEN_LISTING_PLATFORM_ADDRESS, TOKEN_LISTING_ABI, signer);

      if (buyAmount) {
        try {
          const amountRaw = ethers.parseUnits(buyAmount, selectedToken.token.decimals);
          const maxAmount = ethers.parseUnits('1000000000', selectedToken.token.decimals);
          if (BigInt(amountRaw) > BigInt(maxAmount)) {
            setTotalCost('0');
            setFeeCost('0');
            toast.error('Buy amount exceeds maximum limit of 1 billion tokens.');
            return;
          }
          let costRaw = await contract.calculateBuyCost(selectedToken.id, amountRaw);
          let costFormatted = ethers.formatUnits(costRaw, selectedToken.paymentDecimals);
          let feeRaw, feeFormatted;

          // Se il costo è 0 o troppo piccolo, calcoliamo un costo approssimativo
          if (costRaw === 0n || parseFloat(costFormatted) < 1e-18) {
            const currentPriceRaw = await contract.calculateCurrentPrice(selectedToken.id, ethers.parseUnits(selectedToken.soldAmount, selected.token.decimals));
            const currentPrice = parseFloat(ethers.formatUnits(currentPriceRaw, selectedToken.paymentDecimals));
            const approximateCost = parseFloat(buyAmount) * currentPrice;
            costFormatted = approximateCost.toString();
            toast.warn(`The calculated cost is very small (< 0.000000000000000001 ${selectedToken.paymentTokenSymbol}). Using approximate cost: ${approximateCost.toFixed(6)} ${selectedToken.paymentTokenSymbol}. You can still proceed with the transaction.`);
          }

          feeRaw = (BigInt(Math.round(parseFloat(costFormatted) * 1e18)) * 20n) / 10000n; // 0.2% fee
          feeFormatted = ethers.formatUnits(feeRaw, selectedToken.paymentDecimals);

          setTotalCost(parseFloat(costFormatted) < 1e-6 ? costFormatted : parseFloat(costFormatted).toFixed(6));
          setFeeCost(parseFloat(feeFormatted) < 1e-6 ? feeFormatted : parseFloat(feeFormatted).toFixed(6));
        } catch (error) {
          console.error('Error calculating buy cost:', error);
          setTotalCost('0');
          setFeeCost('0');
          toast.error(`Failed to calculate buy cost: ${error.message || 'Check console for details'}`);
        }
      } else {
        setTotalCost('0');
        setFeeCost('0');
      }

      if (sellAmount) {
        try {
          const amountRaw = ethers.parseUnits(sellAmount, selectedToken.token.decimals);
          let returnRaw = await contract.calculateSellReturn(selectedToken.id, amountRaw);
          let returnFormatted = ethers.formatUnits(returnRaw, selectedToken.paymentDecimals);

          // Se il ritorno è 0 o troppo piccolo, calcoliamo un ritorno approssimativo
          if (returnRaw === 0n || parseFloat(returnFormatted) < 1e-18) {
            const currentPriceRaw = await contract.calculateCurrentPrice(selectedToken.id, ethers.parseUnits(selectedToken.soldAmount, selected.token.decimals));
            const currentPrice = parseFloat(ethers.formatUnits(currentPriceRaw, selectedToken.paymentDecimals));
            const approximateReturn = parseFloat(sellAmount) * currentPrice;
            returnFormatted = approximateReturn.toString();
            toast.warn(`The calculated return is very small (< 0.000000000000000001 ${selectedToken.paymentTokenSymbol}). Using approximate return: ${approximateReturn.toFixed(6)} ${selectedToken.paymentTokenSymbol}. You can still proceed with the transaction.`);
          }

          setTotalReturn(parseFloat(returnFormatted) < 1e-6 ? returnFormatted : parseFloat(returnFormatted).toFixed(6));
        } catch (error) {
          console.error('Error calculating sell return:', error);
          setTotalReturn('0');
          toast.error(`Failed to calculate sell return: ${error.message || 'Check console for details'}`);
        }
      } else {
        setTotalReturn('0');
      }
    };
    updateCosts();
  }, [buyAmount, sellAmount, selectedToken, signer]);

  useEffect(() => {
    if (chartContainerRef.current && selectedToken && priceHistory.length > 0) {
      const chart = createChart(chartContainerRef.current, {
        layout: { background: { type: ColorType.Solid, color: '#1a1b1e' }, textColor: '#d1d4dc' },
        grid: { vertLines: { color: '#2a2b2e' }, horzLines: { color: '#2a2b2e' } },
        width: chartContainerRef.current.clientWidth,
        height: 300,
        timeScale: { timeVisible: true },
      });

      let series;
      if (priceHistory.length < 5) {
        series = chart.addLineSeries({ color: '#26a69a', lineWidth: 2 });
        lineSeriesRef.current = series;
        const lineData = priceHistory.map(point => ({
          time: point.timestamp,
          value: parseFloat(point.closePrice)
        }));
        series.setData(lineData);
      } else {
        series = chart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        });
        candlestickSeriesRef.current = series;
        const chartData = priceHistory.map(point => ({
          time: point.timestamp,
          open: parseFloat(point.openPrice),
          high: parseFloat(point.highPrice),
          low: parseFloat(point.lowPrice),
          close: parseFloat(point.closePrice),
        }));
        series.setData(chartData);
      }

      chartRef.current = chart;
      const handleResize = () => chart.applyOptions({ width: chartContainerRef.current!.clientWidth });
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
      };
    }
  }, [chartContainerRef, selectedToken, priceHistory]);

  const handleBuy = async () => {
    if (!signer || !buyAmount || !selectedToken || loading) return;
    setLoading(true);
    try {
      const amountRaw = ethers.parseUnits(buyAmount, selectedToken.token.decimals);
      const contract = new ethers.Contract(TOKEN_LISTING_PLATFORM_ADDRESS, TOKEN_LISTING_ABI, signer);
      let costRaw = await contract.calculateBuyCost(selectedToken.id, amountRaw);
      let costFormatted = ethers.formatUnits(costRaw, selectedToken.paymentDecimals);

      // Se il costo è 0 o troppo piccolo, usiamo un costo approssimativo per i controlli
      if (costRaw === 0n || parseFloat(costFormatted) < 1e-18) {
        const currentPriceRaw = await contract.calculateCurrentPrice(selectedToken.id, ethers.parseUnits(selectedToken.soldAmount, selected.token.decimals));
        const currentPrice = parseFloat(ethers.formatUnits(currentPriceRaw, selectedToken.paymentDecimals));
        const approximateCost = parseFloat(buyAmount) * currentPrice;
        costFormatted = approximateCost.toString();
        costRaw = ethers.parseUnits(approximateCost.toFixed(18), selectedToken.paymentDecimals);
      }

      const paymentTokenContract = new ethers.Contract(selectedToken.paymentToken, TOKEN_ABI, signer);
      const userAddress = await signer.getAddress();
      const userBalanceRaw = await paymentTokenContract.balanceOf(userAddress);
      if (BigInt(userBalanceRaw) < BigInt(costRaw)) {
        throw new Error(`Insufficient ${selectedToken.paymentTokenSymbol} balance. You have ${ethers.formatUnits(userBalanceRaw, selectedToken.paymentDecimals)}, need ${costFormatted}`);
      }

      const allowanceRaw = await paymentTokenContract.allowance(userAddress, TOKEN_LISTING_PLATFORM_ADDRESS);
      if (BigInt(allowanceRaw) < BigInt(costRaw)) {
        toast.loading(`Approving ${selectedToken.paymentTokenSymbol}...`);
        const approveTx = await paymentTokenContract.approve(TOKEN_LISTING_PLATFORM_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
        toast.success('Approval completed');
      }

      const receipt = await buyTokens(selectedToken.id, buyAmount, signer, maxSlippage);
      toast.success('Purchase successful');

      const listingDetails = await contract.getListingDetails(selectedToken.id);
      const newPriceRaw = await contract.calculateCurrentPrice(selectedToken.id, listingDetails.soldAmount);
      setCurrentPrice(ethers.formatUnits(newPriceRaw, selectedToken.paymentDecimals));

      const userBalanceRawUpdated = await paymentTokenContract.balanceOf(userAddress);
      setUserBalance(ethers.formatUnits(userBalanceRawUpdated, selectedToken.paymentDecimals));
      const userAllowanceRawUpdated = await paymentTokenContract.allowance(userAddress, TOKEN_LISTING_PLATFORM_ADDRESS);
      setUserAllowance(ethers.formatUnits(userAllowanceRawUpdated, selectedToken.paymentDecimals));

      setSelectedToken({
        ...selectedToken,
        soldAmount: ethers.formatUnits(listingDetails.soldAmount, selectedToken.token.decimals),
        token: {
          ...selectedToken.token,
          amount: ethers.formatUnits(listingDetails.amount, selectedToken.token.decimals),
        }
      });

      const transactionsRaw = await contract.getRecentTransactions(selectedToken.id, 50);
      setRecentTransactions(transactionsRaw.map((tx: any) => ({
        user: tx.user,
        isBuy: tx.isBuy,
        amount: ethers.formatUnits(tx.amount, selectedToken.token.decimals),
        totalCost: ethers.formatUnits(tx.totalCost, selectedToken.paymentDecimals),
        price: ethers.formatUnits(tx.price, selectedToken.paymentDecimals),
        timestamp: Number(tx.timestamp)
      })));
    } catch (error: any) {
      console.error('Buy error:', error);
      toast.error(error.message || 'Buy failed');
    }
    setLoading(false);
  };

  const handleSell = async () => {
    if (!signer || !sellAmount || !selectedToken || loading) return;
    setLoading(true);
    try {
      const amountRaw = ethers.parseUnits(sellAmount, selectedToken.token.decimals);
      const contract = new ethers.Contract(TOKEN_LISTING_PLATFORM_ADDRESS, TOKEN_LISTING_ABI, signer);
      let returnRaw = await contract.calculateSellReturn(selectedToken.id, amountRaw);
      let returnFormatted = ethers.formatUnits(returnRaw, selectedToken.paymentDecimals);

      if (returnRaw === 0n || parseFloat(returnFormatted) < 1e-18) {
        const currentPriceRaw = await contract.calculateCurrentPrice(selectedToken.id, ethers.parseUnits(selectedToken.soldAmount, selected.token.decimals));
        const currentPrice = parseFloat(ethers.formatUnits(currentPriceRaw, selectedToken.paymentDecimals));
        const approximateReturn = parseFloat(sellAmount) * currentPrice;
        returnFormatted = approximateReturn.toString();
        returnRaw = ethers.parseUnits(approximateReturn.toFixed(18), selectedToken.paymentDecimals);
      }

      const tokenContract = new ethers.Contract(selectedToken.token.address, TOKEN_ABI, signer);
      const userAddress = await signer.getAddress();
      const userBalanceRaw = await tokenContract.balanceOf(userAddress);
      if (BigInt(userBalanceRaw) < BigInt(amountRaw)) {
        throw new Error(`Insufficient ${selectedToken.token.symbol} balance. You have ${ethers.formatUnits(userBalanceRaw, selectedToken.token.decimals)}, need ${sellAmount}`);
      }

      const allowanceRaw = await tokenContract.allowance(userAddress, TOKEN_LISTING_PLATFORM_ADDRESS);
      if (BigInt(allowanceRaw) < BigInt(amountRaw)) {
        toast.loading(`Approving ${selectedToken.token.symbol}...`);
        const approveTx = await tokenContract.approve(TOKEN_LISTING_PLATFORM_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
        toast.success('Approval completed');
      }

      const receipt = await sellTokens(selectedToken.id, sellAmount, signer, maxSlippage);
      toast.success('Sell successful');

      const listingDetails = await contract.getListingDetails(selectedToken.id);
      const newPriceRaw = await contract.calculateCurrentPrice(selectedToken.id, listingDetails.soldAmount);
      setCurrentPrice(ethers.formatUnits(newPriceRaw, selectedToken.paymentDecimals));

      const paymentTokenContract = new ethers.Contract(selectedToken.paymentToken, TOKEN_ABI, signer);
      const userBalanceRawUpdated = await paymentTokenContract.balanceOf(userAddress);
      setUserBalance(ethers.formatUnits(userBalanceRawUpdated, selectedToken.paymentDecimals));
      const userAllowanceRawUpdated = await paymentTokenContract.allowance(userAddress, TOKEN_LISTING_PLATFORM_ADDRESS);
      setUserAllowance(ethers.formatUnits(userAllowanceRawUpdated, selectedToken.paymentDecimals));

      setSelectedToken({
        ...selectedToken,
        soldAmount: ethers.formatUnits(listingDetails.soldAmount, selectedToken.token.decimals),
        token: {
          ...selectedToken.token,
          amount: ethers.formatUnits(listingDetails.amount, selectedToken.token.decimals),
        }
      });

      const transactionsRaw = await contract.getRecentTransactions(selectedToken.id, 50);
      setRecentTransactions(transactionsRaw.map((tx: any) => ({
        user: tx.user,
        isBuy: tx.isBuy,
        amount: ethers.formatUnits(tx.amount, selectedToken.token.decimals),
        totalCost: ethers.formatUnits(tx.totalCost, selectedToken.paymentDecimals),
        price: ethers.formatUnits(tx.price, selectedToken.paymentDecimals),
        timestamp: Number(tx.timestamp)
      })));
    } catch (error: any) {
      console.error('Sell error:', error);
      toast.error(error.message || 'Sell failed');
    }
    setLoading(false);
  };

  if (!signer) {
    return <div className="text-white">Please connect your wallet</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#1a1b1e]/90 backdrop-blur-sm flex z-50"
    >
      <div className="w-64 bg-[#1a1b1e] border-r border-[#2a2b2e] overflow-y-auto">
        <div className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#2a2b2e] rounded-lg pl-10 pr-4 py-2 text-sm text-white"
            />
          </div>
          {allTokens.length === 0 ? (
            <p className="text-gray-400">No active tokens found. Check console for details or create a new listing.</p>
          ) : (
            allTokens
              .filter(t => t.token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || t.token.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(token => (
                <div
                  key={token.id}
                  onClick={() => setSelectedToken(token)}
                  className={`p-3 rounded-lg cursor-pointer ${selectedToken?.id === token.id ? 'bg-blue-500/20' : 'hover:bg-[#2a2b2e]'}`}
                >
                  <h3 className="text-sm font-medium text-white">{token.token.symbol}</h3>
                  <p className="text-xs text-gray-400">${token.token.price}</p>
                </div>
              ))
          )}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex justify-between mb-6">
          <div className="flex items-center space-x-4">
            {selectedToken && (
              <>
                <h2 className="text-2xl font-bold text-white">{selectedToken.token.name} ({selectedToken.token.symbol})</h2>
                <span className="text-blue-400">${currentPrice}</span>              </>
            )}
          </div>
          <button onClick={onClose}><X className="w-6 h-6 text-gray-400" /></button>
        </div>

        {selectedToken ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-6">
              {selectedToken.isActive ? (
                <>
                  <div className="bg-[#2a2b2e]/20 rounded-xl p-6">
                    <div ref={chartContainerRef} className="w-full h-72" />
                    {priceHistory.length === 0 && <p className="text-gray-400 text-center">No price history available</p>}
                  </div>

                  <div className="bg-[#2a2b2e]/20 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Token Info</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-400">Current Price</p>
                        <p className="text-lg font-medium">${currentPrice}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Available</p>
                        <p className="text-lg font-medium">{parseFloat(selectedToken.token.amount).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Sold</p>
                        <p className="text-lg font-medium">{parseFloat(selectedToken.soldAmount).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Your Balance</p>
                        <p className="text-lg font-medium">{parseFloat(userBalance).toFixed(2)} {selectedToken.paymentTokenSymbol}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Allowance</p>
                        <p className="text-lg font-medium">{parseFloat(userAllowance).toFixed(2)} {selectedToken.paymentTokenSymbol}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Total Volume</p>
                        <p className="text-lg font-medium">${parseFloat(totalVolume).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {marketStats && (
                    <div className="bg-[#2a2b2e]/20 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Market Stats</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-400">24h High</p>
                          <p className="text-lg font-medium">${marketStats.high24h}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">24h Low</p>
                          <p className="text-lg font-medium">${marketStats.low24h}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">24h Change</p>
                          <p className={`text-lg font-medium ${parseFloat(marketStats.priceChange24hPercent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {parseFloat(marketStats.priceChange24hPercent).toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Historical High</p>
                          <p className="text-lg font-medium">${marketStats.historicalHigh}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Historical Low</p>
                          <p className="text-lg font-medium">${marketStats.historicalLow}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-400">This listing is inactive or has graduated.</p>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-[#2a2b2e]/20 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Buy {selectedToken.token.symbol}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Amount ({selectedToken.token.symbol})</label>
                    <input
                      type="number"
                      value={buyAmount}
                      onChange={(e) => {
                        setBuyAmount(e.target.value);
                        setDesiredCost(''); // Resetta il costo desiderato quando l'utente modifica la quantità
                      }}
                      placeholder="Enter amount"
                      className="w-full bg-[#1a1b1e] rounded-lg p-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Desired Cost ({selectedToken.paymentTokenSymbol})</label>
                    <input
                      type="number"
                      value={desiredCost}
                      onChange={(e) => {
                        const cost = e.target.value;
                        setDesiredCost(cost);
                        if (cost && parseFloat(currentPrice) > 0) {
                          const amount = parseFloat(cost) / parseFloat(currentPrice);
                          setBuyAmount(amount.toString());
                        } else {
                          setBuyAmount('');
                        }
                      }}
                      placeholder="Enter desired cost"
                      className="w-full bg-[#1a1b1e] rounded-lg p-2 text-white"
                    />
                  </div>

                  <div>
  <p className="text-sm text-gray-400">Cost: {totalCost} {selectedToken.paymentTokenSymbol}</p>
  <p className="text-sm text-gray-400">Fee: {feeCost} {selectedToken.paymentTokenSymbol}</p>
</div>

                  <button
                    onClick={handleBuy}
                    disabled={loading || !buyAmount}
                    className="w-full bg-blue-500 text-white rounded-lg py-2 disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Buy'}
                  </button>
                </div>
              </div>

              <div className="bg-[#2a2b2e]/20 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Sell {selectedToken.token.symbol}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Amount ({selectedToken.token.symbol})</label>
                    <input
                      type="number"
                      value={sellAmount}
                      onChange={(e) => {
                        setSellAmount(e.target.value);
                        setDesiredReturn(''); // Resetta il ritorno desiderato quando l'utente modifica la quantità
                      }}
                      placeholder="Enter amount"
                      className="w-full bg-[#1a1b1e] rounded-lg p-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Desired Return ({selectedToken.paymentTokenSymbol})</label>
                    <input
                      type="number"
                      value={desiredReturn}
                      onChange={(e) => {
                        const returnValue = e.target.value;
                        setDesiredReturn(returnValue);
                        if (returnValue && parseFloat(currentPrice) > 0) {
                          const amount = parseFloat(returnValue) / parseFloat(currentPrice);
                          setSellAmount(amount.toString());
                        } else {
                          setSellAmount('');
                        }
                      }}
                      placeholder="Enter desired return"
                      className="w-full bg-[#1a1b1e] rounded-lg p-2 text-white"
                    />
                  </div>

                  <div>
                    <p className="text-sm text-gray-400">Return: {totalReturn} {selectedToken.paymentTokenSymbol}</p>
                  </div>

                  <button
                    onClick={handleSell}
                    disabled={loading || !sellAmount}
                    className="w-full bg-red-500 text-white rounded-lg py-2 disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Sell'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-400">No token selected. Please select a token from the list.</p>
        )}
      </div>
    </motion.div>
  );
};

export default TradingPage;