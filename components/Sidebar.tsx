import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  Menu, 
  Home, 
  Building2, 
  Plus, 
  ShoppingBag, 
  DollarSign, 
  FileText, 
  BarChart3, 
  Clock, 
  Wallet,
  LogOut,
  ChevronRight,
  TrendingUp, // Aggiunto
  LineChart  // Aggiunto
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SidebarProps {
  signer: ethers.Signer | null;
  handleConnectWallet: (autoOpenMarketplace?: boolean) => Promise<void>;
  handleDisconnectWallet: () => void;
  setShowCreateToken: (value: boolean) => void;
  setShowListToken: (value: boolean) => void;
  setShowMarketplace: (value: boolean) => void;
  setShowBuyPRDX: (value: boolean) => void;
  setShowSoldTokenPage: (value: boolean) => void;
  setShowTokenDetails: (value: boolean) => void;
  setShowAllTokens: (value: boolean) => void;
  setShowTradingPage: (value: boolean) => void;
  openTradingPage: (listingId: number) => void;
  setShowProfile: (value: boolean) => void;
  setShowFeed: (value: boolean) => void;
  setShowLeaderboard: (value: boolean) => void;
}

export default function Sidebar({
  signer,
  handleConnectWallet,
  handleDisconnectWallet,
  setShowCreateToken,
  setShowListToken,
  setShowMarketplace,
  setShowBuyPRDX,
  setShowSoldTokenPage,
  setShowMigrationReadyTokens,
  setShowAllTokens,
  setShowAddLiquidityPage,
  openTradingPage,
  setShowProfile,
  setShowFeed,
  setShowLeaderboard,
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const pages = [
    { name: 'Home', icon: Home, action: () => {
      setShowCreateToken(false);
      setShowListToken(false);
      setShowMarketplace(false);
      setShowBuyPRDX(false);
      setShowSoldTokenPage(false);
      setShowMigrationReady(false);
      setShowAllTokens(false);
      setShowAddLiquiddityPage(false);
      setShowProfile(false);
      setShowFeed(false);
      setShowLeaderboard(false);
    } },
    { name: 'Marketplace', icon: Building2, action: () => setShowMarketplace(true), requiresWallet: true },
    { name: 'Create Token', icon: Plus, action: () => setShowCreateToken(true), requiresWallet: true },
    { name: 'List Token', icon: ShoppingBag, action: () => setShowListToken(true), requiresWallet: true },
    { name: 'Buy PRDX', icon: DollarSign, action: () => setShowBuyPRDX(true) },
    { name: 'Token Details', icon: FileText, action: () => setShowTokenDetails(true) },
    { name: 'All Tokens', icon: BarChart3, action: () => setShowAllTokens(true) },
    { name: 'Sold Tokens', icon: Clock, action: () => setShowSoldTokenPage(true), requiresWallet: true },
    { name: 'Trading', icon: BarChart3, action: () => openTradingPage(0), requiresWallet: true },
    { name: 'Creator Profile', icon: BarChart3, action: () => setShowProfile(true), requiresWallet: true },
    { name: 'Community Feed', icon: TrendingUp, action: () => setShowFeed(true), requiresWallet: true },
    { name: 'Creator Leaderboard', icon: LineChart, action: () => setShowLeaderboard(true), requiresWallet: true },
  ];

  const handleNavigation = (action: () => void, requiresWallet: boolean = false) => {
    if (requiresWallet && !signer) {
      toast.error('Please connect your wallet first');
      return;
    }
    action();
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed ${isOpen ? 'left-64' : 'left-4'} top-4 z-50 p-2 rounded-full bg-primary-500 hover:bg-primary-600 transition-all duration-300 text-white`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: isOpen ? '0%' : '-100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-gray-900 to-black border-r border-white/10 shadow-2xl"
      >
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-center py-4">
            <img src="https://i.ibb.co/LDt6yJpn/erasebg-transformed.png" alt="Properties DEX Logo" className="w-12 h-12" />
            <h1 className="text-lg font-bold ml-2">Properties DEX</h1>
          </div>

          {!signer ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleConnectWallet()}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-lg py-2 px-4 flex items-center justify-center space-x-2"
            >
              <Wallet className="w-5 h-5" />
              <span className="text-sm">Connect Wallet</span>
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleDisconnectWallet}
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 px-4 flex items-center justify-center space-x-2"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm">Disconnect Wallet</span>
            </motion.button>
          )}

          <nav className="space-y-1">
            {pages.map((page) => (
              <motion.button
                key={page.name}
                whileHover={{ scale: 1.05, x: 5 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleNavigation(page.action, page.requiresWallet)}
                className={`w-full flex items-center space-x-3 px-4 py-1.5 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm ${
                  page.requiresWallet && !signer ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={page.requiresWallet && !signer}
              >
                <page.icon className="w-5 h-5" />
                <span>{page.name}</span>
                <ChevronRight className="w-4 h-4 ml-auto" />
              </motion.button>
            ))}
          </nav>
        </div>
      </motion.div>
    </>
  );
}