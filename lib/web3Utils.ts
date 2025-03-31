import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';

// Hardcoded addresses with correct checksum
const PRESALE_MARKETPLACE_ADDRESS = '0x338a419639cD3c2089DB55aDEA4b9c47739596f0';
const BONDING_CURVE_DEX_ADDRESS = '0x398f0b8ffcb7126c0f8b12621381bcefdc793436';

const PRDX_TOKEN_ADDRESS = '0x61Dd008F1582631Aa68645fF92a1a5ECAedBeD19';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Token Creator addresses for Presale and Bonding Curve sections
const LISTING_TOKEN_CREATOR_ADDRESS = '0x01A3ad1acc738cb60d48E08ccadC769904De256c'; // For Presale section
const BONDING_TOKEN_CREATOR_ADDRESS = '0x516c86da2e47e64f10f4a235ba82372b7eab8578'; // For Bonding Curve section

const PRESALE_MARKETPLACE_ABI = [
  "function listToken(address tokenAddress, uint256 amountRaw, uint256 pricePerShareRaw, address paymentToken, bool referralActive, uint256 referralPercent, (string projectWebsite, string socialMediaLink, string tokenImageUrl, string telegramUrl, string projectDescription) metadata, uint256 durationInSeconds) external",
  "function buyToken(uint256 listingId, uint256 amountRaw, bytes32 referralCode) external",
  "function cancelListing(uint256 listingId) external",
  "function claimRefund(uint256 listingId) external",
  "function claimPoolFunds(uint256 listingId) external",
  "function listingCount() external view returns (uint256)",
  "function getListingBasicDetails(uint256 listingId) external view returns (address seller, address tokenAddress, uint256 amount, uint256 soldAmount, uint256 pricePerShare, address paymentToken)",
  "function getListingAdditionalDetails(uint256 listingId) external view returns (bool active, bool referralActive, uint256 referralPercent, bytes32 referralCode, uint256 endTime, uint256 initialAmount, uint256 referralReserve)",
  "function getListingMetadata(uint256 listingId) external view returns (string projectWebsite, string socialMediaLink, string tokenImageUrl, string telegramUrl, string projectDescription)",
  "function withdrawUnsoldTokens(uint256 listingId) external",
  "function claimTokens(uint256 listingId) external",
  "function withdrawUnclaimedFunds(uint256 listingId) external",
  "function poolBalances(uint256 listingId) external view returns (uint256)",
  "function lockedTokens(uint256 listingId, address buyer) external view returns (uint256)",
  "function owner() external view returns (address)",
  "function getBuyerInfo(uint256 listingId, address buyer) external view returns (uint256 totalPaidRaw, bool refunded, uint256 timestamp)"
];

const BONDING_CURVE_DEX_ABI = [
  "function listToken(address tokenAddress, uint256 amount, uint256 initialPrice, uint256 curvature) external",
  "function buyToken(uint256 listingId, uint256 amount) external",
  "function cancelListing(uint256 listingId) external",
  "function listingCount() external view returns (uint256)",
  "function listings(uint256 listingId) external view returns (address seller, address tokenAddress, uint256 amount, uint256 price, bool active, uint256 totalSold)",
  "function getListingMainDetails(uint256 listingId) external view returns (address seller, address tokenAddress, uint256 amount, uint256 initialAmount, uint256 initialPrice, uint256 priceIncrement, address paymentToken, bool active, uint256 endTime)",
  "function getListingMetadata(uint256 listingId) external view returns (string projectWebsite, string socialMediaLink, string tokenImageUrl, string telegramUrl, string projectDescription, string name, string symbol)",
  "function getCurrentPrice(uint256 listingId) external view returns (uint256)"
];

const TOKEN_CREATOR_ABI = [
  "function createToken((string tokenName, string tokenSymbol, uint256 initialSupply, string imageLink, string projectDesc, string websiteLink, string twitterLink, string telegramLink)) external returns ((address tokenAddress, string name, string symbol, uint256 initialSupply, address creator, string imageUrl, string projectDescription, string websiteUrl, string twitterUrl, string telegramUrl))",
  "function createToken((string tokenName, string tokenSymbol, uint256 initialSupply, string imageLink, string projectDesc, string websiteLink, string twitterLink, string telegramLink), uint256 initialPrice, uint256 priceIncrement) external returns ((address tokenAddress, string name, string symbol, uint256 initialSupply, address creator, string imageUrl, string projectDescription, string websiteUrl, string twitterUrl, string telegramUrl))",
  "function paymentTokenA() public view returns (address)",
  "function paymentTokenB() public view returns (address)",
];

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function totalSupply() external view returns (uint256)"
];

export interface TokenInput {
  tokenName: string;
  tokenSymbol: string;
  initialSupply: string;
  imageLink: string;
  projectDesc: string;
  websiteLink: string;
  twitterLink: string;
  telegramLink: string;
}

export interface TokenDetails {
  tokenAddress: string;
  name: string;
  symbol: string;
  initialSupply: string;
  creator: string;
  imageUrl: string;
  projectDescription: string;
  websiteUrl: string;
  twitterUrl: string;
  telegramUrl: string;
}

export interface Listing {
  id: number;
  type: 'presale' | 'bonding';
  seller: string;
  token: { address: string; name: string; symbol: string; amount: string; price: string; decimals: number; initialAmount?: string; soldAmount?: string };
  paymentToken: string;
  paymentTokenSymbol: string;
  paymentDecimals: number;
  active: boolean;
  isOwner: boolean;
  imageUrl: string;
  endTime: number;
  referralActive?: boolean;
  referralPercent?: number;
  referralCode?: string;
  referralReserve?: string;
  projectWebsite?: string;
  socialMediaLink?: string;
  telegramUrl?: string;
  projectDescription?: string;
  initialAmount?: string;
}

// Track wallet connection state to prevent redundant notifications
let isWalletConnected = false;
let currentSignerAddress: string | null = null;

// Cache to avoid repeated calls
let cachedBalances: { eth: string; prdx: string; usdc: string } | null = null;
let cachedListings: Listing[] | null = null;

// Store listener callbacks to allow removal
let accountsChangedListener: ((accounts: string[]) => void) | null = null;
let chainChangedListener: ((chainId: string) => void) | null = null;

async function checkContractExists(signer: ethers.Signer, address: string): Promise<boolean> {
  try {
    const provider = signer.provider;
    const code = await provider.getCode(address);
    const exists = code !== '0x';
    console.log(`Checking if contract at address ${address} exists: ${exists}`);
    return exists;
  } catch (error) {
    console.error(`Error checking contract at address ${address}:`, error);
    return false;
  }
}

export async function connectWallet(): Promise<ethers.Signer> {
  if (!window.ethereum) throw new Error('No Ethereum provider found. Please install MetaMask.');
  if (typeof window.ethereum === 'undefined') {
    throw new Error('Ethereum provider not detected. Ensure MetaMask is installed and enabled.');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  const address = await signer.getAddress();

  if (Number(network.chainId) !== 8453) {
    throw new Error(`Please switch to Base Mainnet (chainId 8453). Current: ${network.chainId}`);
  }

  if (!isWalletConnected || currentSignerAddress !== address) {
    console.log('Wallet connected successfully. Signer:', signer);
    toast.success('Wallet connected successfully!');
    isWalletConnected = true;
    currentSignerAddress = address;
  }

  // Remove existing listeners if they exist
  if (accountsChangedListener) {
    window.ethereum.removeListener('accountsChanged', accountsChangedListener);
  }
  if (chainChangedListener) {
    window.ethereum.removeListener('chainChanged', chainChangedListener);
  }

  // Define the accountsChanged listener
  accountsChangedListener = async (accounts: string[]) => {
    if (accounts.length === 0) {
      isWalletConnected = false;
      currentSignerAddress = null;
      cachedBalances = null; // Reset cache
      cachedListings = null; // Reset cache
      toast.error('Wallet disconnected.');
    } else {
      const newAddress = accounts[0];
      if (newAddress !== currentSignerAddress) {
        isWalletConnected = false;
        currentSignerAddress = newAddress;
        cachedBalances = null; // Reset cache
        cachedListings = null; // Reset cache
        const newSigner = await provider.getSigner();
        console.log('Account changed. New signer:', newSigner);
        toast.success('Wallet account changed.');
      }
    }
  };

  // Define the chainChanged listener
  chainChangedListener = (chainId: string) => {
    const newChainId = Number(chainId);
    if (newChainId !== 8453) {
      isWalletConnected = false;
      currentSignerAddress = null;
      cachedBalances = null; // Reset cache
      cachedListings = null; // Reset cache
      toast.error('Network changed. Please switch to Base Mainnet (chainId 8453).');
    }
  };

  // Add the new listeners
  window.ethereum.on('accountsChanged', accountsChangedListener);
  window.ethereum.on('chainChanged', chainChangedListener);

  return signer;
}

export async function getWalletBalances(signer: ethers.Signer): Promise<{ eth: string; prdx: string; usdc: string }> {
  if (!signer) {
    console.error('Signer is undefined in getWalletBalances');
    throw new Error('Signer is undefined');
  }

  // Use cache if available
  if (cachedBalances) {
    console.log('Returning cached balances:', cachedBalances);
    return cachedBalances;
  }

  const provider = signer.provider;
  const address = await signer.getAddress();

  console.log(`Fetching balances for address: ${address}`);
  const ethBalance = ethers.formatEther(await provider.getBalance(address));
  const prdxToken = new ethers.Contract(PRDX_TOKEN_ADDRESS, TOKEN_ABI, signer);
  const usdcToken = new ethers.Contract(USDC_ADDRESS, TOKEN_ABI, signer);

  const prdxBalanceRaw = await prdxToken.balanceOf(address);
  const usdcBalanceRaw = await usdcToken.balanceOf(address);
  const prdxDecimals = await prdxToken.decimals();
  const usdcDecimals = await usdcToken.decimals();

  const prdxBalance = ethers.formatUnits(prdxBalanceRaw, prdxDecimals);
  const usdcBalance = ethers.formatUnits(usdcBalanceRaw, usdcDecimals);

  cachedBalances = { eth: ethBalance, prdx: prdxBalance, usdc: usdcBalance };
  console.log('Balances fetched:', cachedBalances);
  return cachedBalances;
}

export async function getListings(signer: ethers.Signer, filter: 'all' | 'sold' | 'active' | 'expired' | 'refundable' = 'all'): Promise<Listing[]> {
  if (!signer) {
    console.error('Signer is undefined in getListings');
    throw new Error('Signer is undefined');
  }

  // Use cache if available
  if (cachedListings) {
    console.log('Returning cached listings:', cachedListings);
    return cachedListings;
  }

  const presaleContractExists = await checkContractExists(signer, PRESALE_MARKETPLACE_ADDRESS);
  if (!presaleContractExists) {
    console.error(`No contract found at PRESALE_MARKETPLACE_ADDRESS: ${PRESALE_MARKETPLACE_ADDRESS}`);
    throw new Error('Presale Marketplace contract not found at the specified address');
  }

  const bondingContractExists = await checkContractExists(signer, BONDING_CURVE_DEX_ADDRESS);
  if (!bondingContractExists) {
    console.error(`No contract found at BONDING_CURVE_DEX_ADDRESS: ${BONDING_CURVE_DEX_ADDRESS}`);
    throw new Error('Bonding Curve DEX contract not found at the specified address');
  }

  const userAddress = await signer.getAddress();
  const presaleMarketplace = new ethers.Contract(PRESALE_MARKETPLACE_ADDRESS, PRESALE_MARKETPLACE_ABI, signer);
  const bondingCurveDex = new ethers.Contract(BONDING_CURVE_DEX_ADDRESS, BONDING_CURVE_DEX_ABI, signer);

  const presaleCount = Number(await presaleMarketplace.listingCount());
  const bondingCount = Number(await bondingCurveDex.listingCount());
  const currentTime = Math.floor(Date.now() / 1000);
  const listings: Listing[] = [];

  console.log(`Fetching listings: Presale Count=${presaleCount}, Bonding Count=${bondingCount}, Filter=${filter}`);

  for (let i = 0; i < presaleCount; i++) {
    try {
      const [basicDetails, additionalDetails, metadata] = await Promise.all([
        presaleMarketplace.getListingBasicDetails(i),
        presaleMarketplace.getListingAdditionalDetails(i),
        presaleMarketplace.getListingMetadata(i)
      ]);
      console.log(`Basic details for Presale listing ${i}:`, basicDetails);
      console.log(`Additional details for Presale listing ${i}:`, additionalDetails);

      const token = new ethers.Contract(basicDetails.tokenAddress, TOKEN_ABI, signer);
      const [name, symbol, decimals] = await Promise.all([token.name(), token.symbol(), token.decimals()]);
      const paymentToken = new ethers.Contract(basicDetails.paymentToken, TOKEN_ABI, signer);
      const [paymentTokenSymbol, paymentDecimals] = await Promise.all([paymentToken.symbol(), paymentToken.decimals()]);

      const amount = ethers.formatUnits(basicDetails.amount, decimals);
      const soldAmount = ethers.formatUnits(basicDetails.soldAmount, decimals);
      const price = ethers.formatUnits(basicDetails.pricePerShare, paymentDecimals);
      const isOwner = basicDetails.seller.toLowerCase() === userAddress.toLowerCase();

      const listing: Listing = {
        id: i,
        type: 'presale',
        seller: basicDetails.seller,
        token: { address: basicDetails.tokenAddress, name, symbol, amount, soldAmount, price, decimals },
        paymentToken: basicDetails.paymentToken,
        paymentTokenSymbol,
        paymentDecimals,
        active: additionalDetails.active,
        isOwner,
        imageUrl: metadata.tokenImageUrl || 'https://via.placeholder.com/150',
        endTime: Number(additionalDetails.endTime),
        referralActive: additionalDetails.referralActive,
        referralPercent: Number(additionalDetails.referralPercent),
        referralCode: ethers.hexlify(additionalDetails.referralCode),
        referralReserve: ethers.formatUnits(additionalDetails.referralReserve, decimals),
        projectWebsite: metadata.projectWebsite,
        socialMediaLink: metadata.socialMediaLink,
        telegramUrl: metadata.telegramUrl,
        projectDescription: metadata.projectDescription,
        initialAmount: ethers.formatUnits(additionalDetails.initialAmount, decimals),
      };

      if (filter === 'all' ||
          (filter === 'sold' && parseFloat(listing.token.amount) === 0) ||
          (filter === 'active' && listing.active && parseFloat(listing.token.amount) > 0 && listing.endTime > currentTime) ||
          (filter === 'expired' && listing.endTime <= currentTime && parseFloat(listing.token.amount) > 0) ||
          (filter === 'refundable' && parseFloat(listing.token.amount) > 0 && listing.endTime <= currentTime)) {
        listings.push(listing);
      }
    } catch (error) {
      console.error(`Error fetching Presale listing ${i}:`, error);
    }
  }

  for (let i = 0; i < bondingCount; i++) {
    try {
      const details = await bondingCurveDex.getListingMainDetails(i);
      const metadata = await bondingCurveDex.getListingMetadata(i);
      const currentPriceRaw = await bondingCurveDex.getCurrentPrice(i);
      console.log(`Main details for Bonding listing ${i}:`, details);
      const token = new ethers.Contract(details.tokenAddress, TOKEN_ABI, signer);
      const [name, symbol, decimals] = await Promise.all([token.name(), token.symbol(), token.decimals()]);
      const paymentToken = new ethers.Contract(details.paymentToken || USDC_ADDRESS, TOKEN_ABI, signer);
      const [paymentTokenSymbol, paymentDecimals] = await Promise.all([paymentToken.symbol(), paymentToken.decimals()]);
      const amount = ethers.formatUnits(details.amount, decimals);
      const price = ethers.formatUnits(currentPriceRaw, paymentDecimals);
      const isOwner = details.seller.toLowerCase() === userAddress.toLowerCase();

      const listing: Listing = {
        id: i,
        type: 'bonding',
        seller: details.seller,
        token: { address: details.tokenAddress, name, symbol, amount, price, decimals },
        paymentToken: details.paymentToken || USDC_ADDRESS,
        paymentTokenSymbol,
        paymentDecimals,
        active: details.active,
        isOwner,
        imageUrl: metadata.tokenImageUrl || 'https://via置きholder.com/150',
        endTime: Number(details.endTime || currentTime + 3600 * 24 * 30),
        projectWebsite: metadata.projectWebsite,
        socialMediaLink: metadata.socialMediaLink,
        telegramUrl: metadata.telegramUrl,
        projectDescription: metadata.projectDescription,
        initialAmount: ethers.formatUnits(details.initialAmount, decimals),
      };

      if (filter === 'all' ||
          (filter === 'sold' && parseFloat(listing.token.amount) === 0) ||
          (filter === 'active' && listing.active && parseFloat(listing.token.amount) > 0) ||
          (filter === 'expired' && listing.endTime <= currentTime && parseFloat(listing.token.amount) > 0)) {
        listings.push(listing);
      }
    } catch (error) {
      console.error(`Error fetching Bonding listing ${i}:`, error);
    }
  }

  cachedListings = listings; // Save to cache
  console.log('Listings fetched:', listings);
  return listings;
}

export async function createPresaleToken(
  signer: ethers.Signer,
  tokenInput: TokenInput
): Promise<TokenDetails> {
  if (!signer) {
    console.error('Signer is undefined in createPresaleToken');
    throw new Error('Signer is undefined');
  }
  const tokenCreator = new ethers.Contract(LISTING_TOKEN_CREATOR_ADDRESS, TOKEN_CREATOR_ABI, signer);

  const tokenData = [
    tokenInput.tokenName,
    tokenInput.tokenSymbol,
    ethers.parseUnits(tokenInput.initialSupply, 18),
    tokenInput.imageLink,
    tokenInput.projectDesc,
    tokenInput.websiteLink,
    tokenInput.twitterLink,
    tokenInput.telegramLink
  ];

  console.log(`Creating Presale token with data:`, tokenData);
  const tx = await tokenCreator.createToken(tokenData);
  const receipt = await tx.wait();
  console.log('Token creation transaction confirmed:', receipt.transactionHash);

  const tokenDetails = await tokenCreator.queryFilter("TokenCreated", receipt.blockNumber);
  if (!tokenDetails.length) throw new Error("TokenCreated event not found");

  const event = tokenDetails[0].args;
  const token = new ethers.Contract(event.tokenAddress, TOKEN_ABI, signer);
  const decimals = await token.decimals();
  const result = {
    tokenAddress: event.tokenAddress,
    name: event.name,
    symbol: event.symbol,
    initialSupply: ethers.formatUnits(event.initialSupply, decimals),
    creator: event.creator,
    imageUrl: event.imageUrl,
    projectDescription: event.projectDescription,
    websiteUrl: event.websiteUrl,
    twitterUrl: event.twitterLink,
    telegramUrl: event.telegramUrl
  };
  console.log('Presale token created:', result);
  return result;
}

export async function createBondingCurveToken(
  signer: ethers.Signer,
  tokenInput: TokenInput,
  initialPrice: string,
  priceIncrement: string
): Promise<TokenDetails> {
  if (!signer) {
    console.error('Signer is undefined in createBondingCurveToken');
    throw new Error('Signer is undefined');
  }
  const tokenCreator = new ethers.Contract(BONDING_TOKEN_CREATOR_ADDRESS, TOKEN_CREATOR_ABI, signer);

  const tokenData = [
    tokenInput.tokenName,
    tokenInput.tokenSymbol,
    ethers.parseUnits(tokenInput.initialSupply, 18),
    tokenInput.imageLink,
    tokenInput.projectDesc,
    tokenInput.websiteLink,
    tokenInput.twitterLink,
    tokenInput.telegramLink
  ];

  const initialPriceRaw = ethers.parseUnits(initialPrice, 18);
  const priceIncrementRaw = ethers.parseUnits(priceIncrement, 18);

  console.log(`Creating Bonding Curve token with data:`, { tokenData, initialPrice, priceIncrement });
  const tx = await tokenCreator.createToken(tokenData, initialPriceRaw, priceIncrementRaw);
  const receipt = await tx.wait();
  console.log('Token creation transaction confirmed:', receipt.transactionHash);

  const tokenDetails = await tokenCreator.queryFilter("TokenCreated", receipt.blockNumber);
  if (!tokenDetails.length) throw new Error("TokenCreated event not found");

  const event = tokenDetails[0].args;
  const token = new ethers.Contract(event.tokenAddress, TOKEN_ABI, signer);
  const decimals = await token.decimals();
  const result = {
    tokenAddress: event.tokenAddress,
    name: event.name,
    symbol: event.symbol,
    initialSupply: ethers.formatUnits(event.initialSupply, decimals),
    creator: event.creator,
    imageUrl: event.imageUrl,
    projectDescription: event.projectDescription,
    websiteUrl: event.websiteUrl,
    twitterUrl: event.twitterLink,
    telegramUrl: event.telegramUrl
  };
  console.log('Bonding Curve token created:', result);
  return result;
}

export async function buyToken(listingId: number, amount: string, signer: ethers.Signer, type: 'presale' | 'bonding', referralCode?: string) {
  if (!signer) {
    console.error('Signer is undefined in buyToken');
    throw new Error('Signer is undefined');
  }
  const marketplace = new ethers.Contract(
    type === 'presale' ? PRESALE_MARKETPLACE_ADDRESS : BONDING_CURVE_DEX_ADDRESS,
    type === 'presale' ? PRESALE_MARKETPLACE_ABI : BONDING_CURVE_DEX_ABI,
    signer
  );
  const listing = (await getListings(signer)).find(l => l.id === listingId && l.type === type);
  if (!listing) throw new Error('Listing not found');

  const token = new ethers.Contract(listing.token.address, TOKEN_ABI, signer);
  const amountRaw = ethers.parseUnits(amount, listing.token.decimals);
  const paymentToken = new ethers.Contract(listing.paymentToken, TOKEN_ABI, signer);
  const totalCostRaw = BigInt(Math.floor(parseFloat(amount) * parseFloat(listing.token.price) * 10 ** listing.paymentDecimals));

  const userAddress = await signer.getAddress();
  const paymentBalance = await paymentToken.balanceOf(userAddress);
  if (paymentBalance < totalCostRaw) throw new Error('Insufficient payment token balance');

  const allowance = await paymentToken.allowance(userAddress, type === 'presale' ? PRESALE_MARKETPLACE_ADDRESS : BONDING_CURVE_DEX_ADDRESS);
  if (allowance < totalCostRaw) {
    console.log('Approving payment token for the marketplace...');
    const approveTx = await paymentToken.approve(type === 'presale' ? PRESALE_MARKETPLACE_ADDRESS : BONDING_CURVE_DEX_ADDRESS, ethers.MaxUint256);
    await approveTx.wait();
    console.log('Approval transaction confirmed:', approveTx.hash);
  }

  console.log(`Buying token: listingId=${listingId}, amount=${amount}, type=${type}, referralCode=${referralCode}`);
  if (type === 'presale') {
    const referralCodeBytes32 = referralCode ? ethers.formatBytes32String(referralCode) : ethers.ZeroHash;
    const tx = await marketplace.buyToken(listingId, amountRaw, referralCodeBytes32);
    const receipt = await tx.wait();
    console.log('Purchase transaction confirmed:', receipt.transactionHash);
    return receipt;
  } else {
    const tx = await marketplace.buyToken(listingId, amountRaw);
    const receipt = await tx.wait();
    console.log('Purchase transaction confirmed:', receipt.transactionHash);
    return receipt;
  }
}

export async function cancelListing(listingId: number, signer: ethers.Signer, type: 'presale' | 'bonding') {
  if (!signer) {
    console.error('Signer is undefined in cancelListing');
    throw new Error('Signer is undefined');
  }
  console.log(`Canceling listing ${listingId} with type: ${type}`);
  const marketplace = new ethers.Contract(
    type === 'presale' ? PRESALE_MARKETPLACE_ADDRESS : BONDING_CURVE_DEX_ADDRESS,
    type === 'presale' ? PRESALE_MARKETPLACE_ABI : BONDING_CURVE_DEX_ABI,
    signer
  );
  console.log(`Using contract address: ${marketplace.target}`);

  if (typeof marketplace.cancelListing !== 'function') {
    console.error('cancelListing method is not available on the contract. Possible issues: incorrect ABI or contract does not have this method.');
    throw new Error('cancelListing method not available on the contract. Check ABI and contract address.');
  }

  try {
    const gasEstimate = await marketplace.estimateGas.cancelListing(listingId).catch((err) => {
      console.error('Gas estimation failed for cancelListing:', err);
      throw new Error(`Failed to estimate gas for cancelListing: ${err.message}`);
    });
    console.log('Gas estimate for cancelListing:', gasEstimate.toString());
    const tx = await marketplace.cancelListing(listingId, { gasLimit: gasEstimate * 120n / 100n });
    console.log('Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt.transactionHash);
    return receipt;
  } catch (error) {
    console.error(`Error in cancelListing for listing ${listingId}:`, error);
    throw new Error(`Failed to cancel listing: ${error.message}`);
  }
}

export async function claimRefund(listingId: number, signer: ethers.Signer, type: 'presale' | 'bonding') {
  if (!signer) {
    console.error('Signer is undefined in claimRefund');
    throw new Error('Signer is undefined');
  }
  console.log(`Requesting refund for listing ${listingId} with type: ${type}`);
  const marketplace = new ethers.Contract(
    type === 'presale' ? PRESALE_MARKETPLACE_ADDRESS : BONDING_CURVE_DEX_ADDRESS,
    type === 'presale' ? PRESALE_MARKETPLACE_ABI : BONDING_CURVE_DEX_ABI,
    signer
  );
  console.log(`Using contract address: ${marketplace.target}`);

  if (typeof marketplace.claimRefund !== 'function') {
    console.error('claimRefund method is not available on the contract. Possible issues: incorrect ABI or contract does not have this method.');
    throw new Error('claimRefund method not available on the contract. Check ABI and contract address.');
  }

  try {
    const gasEstimate = await marketplace.estimateGas.claimRefund(listingId).catch((err) => {
      console.error('Gas estimation failed for claimRefund:', err);
      throw new Error(`Failed to estimate gas for claimRefund: ${err.message}`);
    });
    console.log('Gas estimate for claimRefund:', gasEstimate.toString());
    const tx = await marketplace.claimRefund(listingId, { gasLimit: gasEstimate * 120n / 100n });
    console.log('Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt.transactionHash);
    return receipt;
  } catch (error) {
    console.error(`Error in claimRefund for listing ${listingId}:`, error);
    throw new Error(`Failed to claim refund: ${error.message}`);
  }
}

export async function claimPoolFunds(listingId: number, signer: ethers.Signer, type: 'presale' | 'bonding') {
  if (!signer) {
    console.error('Signer is undefined in claimPoolFunds');
    throw new Error('Signer is undefined');
  }
  console.log(`Requesting pool funds for listing ${listingId} with type: ${type}`);
  const marketplace = new ethers.Contract(
    type === 'presale' ? PRESALE_MARKETPLACE_ADDRESS : BONDING_CURVE_DEX_ADDRESS,
    type === 'presale' ? PRESALE_MARKETPLACE_ABI : BONDING_CURVE_DEX_ABI,
    signer
  );
  console.log(`Using contract address: ${marketplace.target}`);

  if (typeof marketplace.claimPoolFunds !== 'function') {
    console.error('claimPoolFunds method is not available on the contract. Possible issues: incorrect ABI or contract does not have this method.');
    throw new Error('claimPoolFunds method not available on the contract. Check ABI and contract address.');
  }

  try {
    const gasEstimate = await marketplace.estimateGas.claimPoolFunds(listingId).catch((err) => {
      console.error('Gas estimation failed for claimPoolFunds:', err);
      throw new Error(`Failed to estimate gas for claimPoolFunds: ${err.message}`);
    });
    console.log('Gas estimate for claimPoolFunds:', gasEstimate.toString());
    const tx = await marketplace.claimPoolFunds(listingId, { gasLimit: gasEstimate * 120n / 100n });
    console.log('Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt.transactionHash);
    return receipt;
  } catch (error) {
    console.error(`Error in claimPoolFunds for listing ${listingId}:`, error);
    throw new Error(`Failed to claim pool funds: ${error.message}`);
  }
}

export async function withdrawUnsoldTokens(listingId: number, signer: ethers.Signer, type: 'presale' | 'bonding' = 'presale') {
  if (!signer) {
    console.error('Signer is undefined in withdrawUnsoldTokens');
    throw new Error('Signer is undefined');
  }
  console.log(`Withdrawing unsold tokens for listing ${listingId} with type: ${type}`);
  const marketplace = new ethers.Contract(
    type === 'presale' ? PRESALE_MARKETPLACE_ADDRESS : BONDING_CURVE_DEX_ADDRESS,
    type === 'presale' ? PRESALE_MARKETPLACE_ABI : BONDING_CURVE_DEX_ABI,
    signer
  );
  console.log(`Using contract address: ${marketplace.target}`);

  if (typeof marketplace.withdrawUnsoldTokens !== 'function') {
    console.error('withdrawUnsoldTokens method is not available on the contract. Possible issues: incorrect ABI or contract does not have this method.');
    throw new Error('withdrawUnsoldTokens method not available on the contract. Check ABI and contract address.');
  }

  try {
    const gasEstimate = await marketplace.estimateGas.withdrawUnsoldTokens(listingId).catch((err) => {
      console.error('Gas estimation failed for withdrawUnsoldTokens:', err);
      throw new Error(`Failed to estimate gas for withdrawUnsoldTokens: ${err.message}`);
    });
    console.log('Gas estimate for withdrawUnsoldTokens:', gasEstimate.toString());
    const tx = await marketplace.withdrawUnsoldTokens(listingId, { gasLimit: gasEstimate * 120n / 100n });
    console.log('Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt.transactionHash);
    return receipt;
  } catch (error) {
    console.error(`Error in withdrawUnsoldTokens for listing ${listingId}:`, error);
    throw new Error(`Failed to withdraw unsold tokens: ${error.message}`);
  }
}

export async function claimTokens(listingId: number, signer: ethers.Signer, type: 'presale' | 'bonding' = 'presale') {
  if (!signer) {
    console.error('Signer is undefined in claimTokens');
    throw new Error('Signer is undefined');
  }
  console.log(`Claiming tokens for listing ${listingId} with type: ${type}`);
  const marketplace = new ethers.Contract(
    type === 'presale' ? PRESALE_MARKETPLACE_ADDRESS : BONDING_CURVE_DEX_ADDRESS,
    type === 'presale' ? PRESALE_MARKETPLACE_ABI : BONDING_CURVE_DEX_ABI,
    signer
  );
  console.log(`Using contract address: ${marketplace.target}`);

  if (typeof marketplace.claimTokens !== 'function') {
    console.error('claimTokens method is not available on the contract. Possible issues: incorrect ABI or contract does not have this method.');
    throw new Error('claimTokens method not available on the contract. Check ABI and contract address.');
  }

  try {
    const gasEstimate = await marketplace.estimateGas.claimTokens(listingId).catch((err) => {
      console.error('Gas estimation failed for claimTokens:', err);
      throw new Error(`Failed to estimate gas for claimTokens: ${err.message}`);
    });
    console.log('Gas estimate for claimTokens:', gasEstimate.toString());
    const tx = await marketplace.claimTokens(listingId, { gasLimit: gasEstimate * 120n / 100n });
    console.log('Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt.transactionHash);
    return receipt;
  } catch (error) {
    console.error(`Error in claimTokens for listing ${listingId}:`, error);
    throw new Error(`Failed to claim tokens: ${error.message}`);
  }
}

export async function withdrawUnclaimedFunds(listingId: number, signer: ethers.Signer, type: 'presale' | 'bonding' = 'presale') {
  if (!signer) {
    console.error('Signer is undefined in withdrawUnclaimedFunds');
    throw new Error('Signer is undefined');
  }
  console.log(`Withdrawing unclaimed funds for listing ${listingId} with type: ${type}`);
  const marketplace = new ethers.Contract(
    type === 'presale' ? PRESALE_MARKETPLACE_ADDRESS : BONDING_CURVE_DEX_ADDRESS,
    type === 'presale' ? PRESALE_MARKETPLACE_ABI : BONDING_CURVE_DEX_ABI,
    signer
  );
  console.log(`Using contract address: ${marketplace.target}`);

  if (typeof marketplace.withdrawUnclaimedFunds !== 'function') {
    console.error('withdrawUnclaimedFunds method is not available on the contract. Possible issues: incorrect ABI or contract does not have this method.');
    throw new Error('withdrawUnclaimedFunds method not available on the contract. Check ABI and contract address.');
  }

  try {
    const gasEstimate = await marketplace.estimateGas.withdrawUnclaimedFunds(listingId).catch((err) => {
      console.error('Gas estimation failed for withdrawUnclaimedFunds:', err);
      throw new Error(`Failed to estimate gas for withdrawUnclaimedFunds: ${err.message}`);
    });
    console.log('Gas estimate for withdrawUnclaimedFunds:', gasEstimate.toString());
    const tx = await marketplace.withdrawUnclaimedFunds(listingId, { gasLimit: gasEstimate * 120n / 100n });
    console.log('Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt.transactionHash);
    return receipt;
  } catch (error) {
    console.error(`Error in withdrawUnclaimedFunds for listing ${listingId}:`, error);
    throw new Error(`Failed to withdraw unclaimed funds: ${error.message}`);
  }
}