import React from 'react';
import { motion } from 'framer-motion';
import { X, ExternalLink, DollarSign, TrendingUp, BarChart3, Wallet, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

interface BuyPRDXProps {
  onClose: () => void;
}

export default function BuyPRDX({ onClose }: BuyPRDXProps) {
  const handleCopyAddress = () => {
    navigator.clipboard.writeText('0x61Dd008F1582631Aa68645fF92a1a5ECAedBeD19');
    toast.success('Address copied to clipboard!');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white/10 backdrop-blur rounded-xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Buy $PRDX Token</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 hover:bg-white/10 transition-all border border-white/10">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <DollarSign className="w-6 h-6 text-primary-400 mr-2" />
                Token Information
              </h3>

              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 mb-1">Token Name:</p>
                  <p className="font-medium">Properties DEX (PRDX)</p>
                </div>

                <div>
                  <p className="text-gray-400 mb-1">Token Address:</p>
                  <div className="flex items-center">
                    <p className="font-medium text-sm text-primary-300 break-all">0x61Dd008F1582631Aa68645fF92a1a5ECAedBeD19</p>
                    <button
                      onClick={handleCopyAddress}
                      className="ml-2 text-gray-400 hover:text-white"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-gray-400 mb-1">Network:</p>
                  <p className="font-medium">Base Network</p>
                </div>

                <div>
                  <p className="text-gray-400 mb-1">Decimals:</p>
                  <p className="font-medium">18</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 hover:bg-white/10 transition-all border border-white/10">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <TrendingUp className="w-6 h-6 text-primary-400 mr-2" />
                Why Buy PRDX?
              </h3>

              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <span className="inline-block w-4 h-4 bg-primary-500 rounded-full mr-2 mt-1 flex-shrink-0"></span>
                  <span>Access to the first decentralized exchange for tokenized real estate on Base</span>
                </li>
                <li className="flex items-start">
                  <span className="inline-block w-4 h-4 bg-primary-500 rounded-full mr-2 mt-1 flex-shrink-0"></span>
                  <span>Reduced fees for platform transactions</span>
                </li>
                <li className="flex items-start">
                  <span className="inline-block w-4 h-4 bg-primary-500 rounded-full mr-2 mt-1 flex-shrink-0"></span>
                  <span>Governance rights for future platform decisions</span>
                </li>
                <li className="flex items-start">
                  <span className="inline-block w-4 h-4 bg-primary-500 rounded-full mr-2 mt-1 flex-shrink-0"></span>
                  <span>Early access to new property token listings</span>
                </li>
                <li className="flex items-start">
                  <span className="inline-block w-4 h-4 bg-primary-500 rounded-full mr-2 mt-1 flex-shrink-0"></span>
                  <span>Staking rewards and passive income opportunities</span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-primary-600 to-secondary-600 rounded-lg p-6 border border-white/10 shadow-lg">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <Wallet className="w-6 h-6 text-white mr-2" />
                Buy PRDX Now
              </h3>

              <p className="text-white/80 mb-4">Get PRDX tokens directly through Uniswap with just a few clicks.</p>

              <a
                href="https://app.uniswap.org/#/swap?outputCurrency=0x61Dd008F1582631Aa68645fF92a1a5ECAedBeD19"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-white/20 hover:bg-white/30 transition-all px-6 py-3 rounded-lg text-center text-white font-semibold backdrop-blur-sm"
              >
                <div className="flex items-center justify-center">
                  <span>Buy on Uniswap</span>
                  <ExternalLink className="w-5 h-5 ml-2" />
                </div>
              </a>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 hover:bg-white/10 transition-all border border-white/10 h-[600px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold flex items-center">
                <BarChart3 className="w-6 h-6 text-primary-400 mr-2" />
                Live Chart
              </h3>
            </div>

            <div className="h-[calc(100%-40px)]">
              <iframe
                height="100%"
                width="100%"
                id="geckoterminal-embed"
                title="GeckoTerminal Embed"
                src="https://www.geckoterminal.com/base/pools/0x4cE23D2eF5951F80C82f099De7249BFCdDfb41EC?embed=1&info=1&swaps=1&grayscale=0&light_chart=0&chart_type=price&resolution=15m"
                frameBorder="0"
                allow="clipboard-write"
                allowFullScreen
                className="rounded-lg"
              ></iframe>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <img src="https://i.ibb.co/XxW8TLLs/PROPERTIesdex2.png" alt="Properties DEX" className="w-10 h-10 mr-3" />
              <div>
                <h3 className="font-bold text-lg">Properties DEX</h3>
                <p className="text-sm text-gray-400">The future of real estate investment</p>
              </div>
            </div>

            <div className="flex space-x-4">
              <a
                href="https://tokenization.metalandspaceapp.xyz/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Globe className="w-6 h-6" />
              </a>
              <a
                href="https://x.com/PreopertiesDex"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-x"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </a>
              <a
                href="https://t.me/PropertiesDex"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-send"
                >
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
              </a>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5">
            <p className="text-xs text-gray-500 text-center">
              Disclaimer: Properties DEX is a decentralized platform for tokenizing and trading real estate assets. 
              Users are responsible for conducting their own due diligence before investing. 
              Cryptocurrency and tokenized real estate investments involve significant risks including potential loss of principal. 
              Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}