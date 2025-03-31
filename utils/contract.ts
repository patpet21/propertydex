import Web3 from 'web3';
import BondingCurveDEXABI from '../abis/BondingCurveDEX.json';

// Indirizzo del contratto deployato (sostituisci con il tuo indirizzo)
const MARKETPLACE_ADDRESS = 'INSERISCI_INDIRIZZO_CONTRATTO'; // Es. '0x1234...'

// ABI del token ERC20 (base per paymentToken e tokenAddress)
const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function totalSupply() external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

export interface Listing {
  id: number;
  seller: string;
  token: {
    address: string;
    name: string;
    symbol: string;
    amount: string;
    amountRaw: string;
    initialPrice: string;
    priceIncrement: string;
    currentPrice: string;
    decimals: number;
  };
  paymentToken: string;
  paymentTokenSymbol: string;
  paymentDecimals: number;
  active: boolean;
  projectWebsite: string;
  socialMediaLink: string;
  imageUrl: string;
  telegramUrl: string;
  projectDescription: string;
  endTime: number;
}

export async function getListings(web3: Web3, account: string): Promise<Listing[]> {
  try {
    const networkId = await web3.eth.net.getId();
    if (networkId !== 8453) { // Base Mainnet chainId
      throw new Error(`Wrong network! Please switch to Base Mainnet (chainId 8453). Current: ${networkId}`);
    }
    const marketplace = new web3.eth.Contract(BondingCurveDEXABI as any, MARKETPLACE_ADDRESS);
    const listingCount = await marketplace.methods.listingCount().call();
    const listings: Listing[] = [];

    for (let i = 0; i < Number(listingCount); i++) {
      try {
        const [mainDetails, metadata] = await Promise.all([
          marketplace.methods.getListingMainDetails(i).call(),
          marketplace.methods.getListingMetadata(i).call()
        ]);
        const token = new web3.eth.Contract(TOKEN_ABI as any, mainDetails.tokenAddress);
        let name = metadata.name || 'Unknown';
        let symbol = metadata.symbol || 'UNK';
        const tokenDecimals = await token.methods.decimals().call();
        const paymentToken = new web3.eth.Contract(TOKEN_ABI as any, mainDetails.paymentToken);
        const paymentTokenSymbol = await paymentToken.methods.symbol().call();
        const paymentDecimals = await marketplace.methods.getPaymentTokenDecimals(i).call();

        const amountHuman = web3.utils.fromWei(mainDetails.amount, 'ether');
        const initialPriceHuman = web3.utils.fromWei(mainDetails.initialPrice, 'ether');
        const priceIncrementHuman = web3.utils.fromWei(mainDetails.priceIncrement, 'ether');
        const currentPrice = await marketplace.methods.getCurrentPrice(i).call();
        const currentPriceHuman = web3.utils.fromWei(currentPrice, 'ether');

        listings.push({
          id: i,
          seller: mainDetails.seller,
          token: {
            address: mainDetails.tokenAddress,
            name,
            symbol,
            amount: amountHuman,
            amountRaw: mainDetails.amount,
            initialPrice: initialPriceHuman,
            priceIncrement: priceIncrementHuman,
            currentPrice: currentPriceHuman,
            decimals: Number(tokenDecimals),
          },
          paymentToken: mainDetails.paymentToken,
          paymentTokenSymbol,
          paymentDecimals: Number(paymentDecimals),
          active: mainDetails.active,
          projectWebsite: metadata.projectWebsite,
          socialMediaLink: metadata.socialMediaLink,
          imageUrl: metadata.tokenImageUrl || 'https://via.placeholder.com/150',
          telegramUrl: metadata.telegramUrl,
          projectDescription: metadata.projectDescription,
          endTime: Number(mainDetails.endTime),
        });
      } catch (error) {
        console.error(`Error processing listing ${i}:`, error);
      }
    }
    return listings;
  } catch (error: any) {
    console.error('Error getting listings:', error);
    throw new Error(`Failed to get listings: ${error.message}`);
  }
}

export async function buyTokens(listingId: number, amount: string, web3: Web3, account: string): Promise<any> {
  try {
    const marketplace = new web3.eth.Contract(BondingCurveDEXABI as any, MARKETPLACE_ADDRESS);
    const mainDetails = await marketplace.methods.getListingMainDetails(listingId).call();
    const token = new web3.eth.Contract(TOKEN_ABI as any, mainDetails.tokenAddress);
    const tokenDecimals = await token.methods.decimals().call();
    const amountRaw = web3.utils.toWei(amount, 'ether'); // Assumiamo 18 decimals per semplicità
    const paymentToken = new web3.eth.Contract(TOKEN_ABI as any, mainDetails.paymentToken);

    const totalCostRaw = await marketplace.methods.calculateBuyCost(listingId, amountRaw).call();
    const paymentBalance = await paymentToken.methods.balanceOf(account).call();
    if (paymentBalance < totalCostRaw) throw new Error('Insufficient payment token balance');

    const allowance = await paymentToken.methods.allowance(account, MARKETPLACE_ADDRESS).call();
    if (allowance < totalCostRaw) {
      await paymentToken.methods.approve(MARKETPLACE_ADDRESS, web3.utils.toWei('115792089237316195423570985008687907853269984665640564039457584007913129639935', 'wei')).send({ from: account });
    }

    const tx = await marketplace.methods.buyToken(listingId, amountRaw).send({ from: account });
    return tx;
  } catch (error: any) {
    console.error('Error in buyTokens:', error);
    throw new Error(`Failed to buy tokens: ${error.message}`);
  }
}

export async function sellTokens(listingId: number, amount: string, web3: Web3, account: string): Promise<any> {
  try {
    const marketplace = new web3.eth.Contract(BondingCurveDEXABI as any, MARKETPLACE_ADDRESS);
    const mainDetails = await marketplace.methods.getListingMainDetails(listingId).call();
    const token = new web3.eth.Contract(TOKEN_ABI as any, mainDetails.tokenAddress);
    const tokenDecimals = await token.methods.decimals().call();
    const amountRaw = web3.utils.toWei(amount, 'ether');

    const userBalance = await token.methods.balanceOf(account).call();
    if (userBalance < amountRaw) throw new Error('Insufficient token balance');

    const allowance = await token.methods.allowance(account, MARKETPLACE_ADDRESS).call();
    if (allowance < amountRaw) {
      await token.methods.approve(MARKETPLACE_ADDRESS, web3.utils.toWei('115792089237316195423570985008687907853269984665640564039457584007913129639935', 'wei')).send({ from: account });
    }

    const tx = await marketplace.methods.sellToken(listingId, amountRaw).send({ from: account });
    return tx;
  } catch (error: any) {
    console.error('Error in sellTokens:', error);
    throw new Error(`Failed to sell tokens: ${error.message}`);
  }
}

export async function cancelListing(listingId: number, web3: Web3, account: string): Promise<any> {
  try {
    const marketplace = new web3.eth.Contract(BondingCurveDEXABI as any, MARKETPLACE_ADDRESS);
    const tx = await marketplace.methods.cancelListing(listingId).send({ from: account });
    return tx;
  } catch (error: any) {
    throw new Error(`Failed to cancel listing: ${error.message}`);
  }
}