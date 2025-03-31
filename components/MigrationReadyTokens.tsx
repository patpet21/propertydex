// src/components/MigrationReadyTokens.tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';
import { X, Globe, Twitter, MessageCircle } from 'lucide-react';
import { getListings, migrateTokens } from './BondingCurveMarketplace';
import ErrorModal from './ErrorModal'; // Importazione corretta

const formatTokenAmount = (value, decimals, display = false) => {
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  if (display) {
    return num.toLocaleString('en-US', { maximumFractionDigits: decimals });
  }
  return num.toString();
};

const formatBalance = (value) => {
  const num = parseFloat(value);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function MigrationReadyTokens({ onClose, signer }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [migrationListing, setMigrationListing] = useState(null);

  useEffect(() => {
    if (signer) {
      const initialize = async () => {
        try {
          await loadListings();
        } catch (error) {
          setErrorMessage('Error initializing Migration Ready Tokens');
        }
      };
      initialize();

      const interval = setInterval(loadListings, 60000);
      return () => clearInterval(interval);
    }
  }, [signer]);

  const loadListings = async () => {
    if (!signer) return;
    setLoading(true);
    try {
      const allListings = await getListings(signer);
      setListings(allListings);
    } catch (error) {
      setErrorMessage(`Failed to load listings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async (listing) => {
    if (!signer) {
      setErrorMessage('Connect your wallet to migrate tokens.');
      return;
    }
    try {
      setLoading(true);
      await migrateTokens(listing.id, signer);
      await loadListings();
      setMigrationListing(null);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentageSold = (listing) => {
    const sold = parseFloat(listing.token.soldAmount);
    const tradable = parseFloat(listing.token.tradableAmount);
    return tradable > 0 ? (sold / tradable) * 100 : 0;
  };

  const migrationReadyListings = listings.filter((listing) => {
    const percentageSold = calculatePercentageSold(listing);
    const isReadyToMigrate = percentageSold >= 99.9 && listing.active && (Date.now() - (listing.migrationReadyTime || 0) >= 10 * 60 * 1000);
    return isReadyToMigrate;
  });

  const renderMigrationListing = (listing) => {
    const percentageSold = calculatePercentageSold(listing);

    return (
      <div
        key={listing.id}
        className="bg-white/5 rounded-lg overflow-hidden group hover:bg-white/10 transition-all border border-white/10 hover:border-yellow-500 w-full max-w-xs"
      >
        {listing.imageUrl && (
          <div className="relative overflow-hidden">
            <img
              src={listing.imageUrl}
              alt={listing.token.name}
              className="w-full h-24 object-cover transform group-hover:scale-105 transition-transform duration-300"
              onError={(e) => (e.currentTarget.src = 'https://placehold.co/150x150')}
            />
            <div className="absolute top-2 left-2">
              <span className="bg-yellow-600 text-white text-xs px-1.5 py-0.5 rounded-md font-medium">
                Ready to Migrate
              </span>
            </div>
          </div>
        )}
        <div className="p-2 space-y-2">
          <div>
            <h3 className="text-sm font-semibold">{listing.token.name}</h3>
            <p className="text-xs text-gray-400">{listing.token.symbol}</p>
          </div>

          {listing.projectDescription && (
            <div className="bg-white/5 p-1 rounded-lg">
              <p className="text-xs text-gray-300 line-clamp-2">{listing.projectDescription}</p>
            </div>
          )}

          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Sold:</span>
              <span>{percentageSold.toFixed(2)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${Math.min(percentageSold, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Token Address:</span>
              <span className="truncate w-24 text-right">{listing.token.address}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Payment Token:</span>
              <span>{listing.paymentTokenSymbol}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {listing.projectWebsite && (
              <a href={listing.projectWebsite} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300">
                <Globe className="w-3 h-3" />
              </a>
            )}
            {listing.socialMediaLink && (
              <a href={listing.socialMediaLink} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300">
                <Twitter className="w-3 h-3" />
              </a>
            )}
            {listing.telegramUrl && (
              <a href={listing.telegramUrl} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300">
                <MessageCircle className="w-3 h-3" />
              </a>
            )}
          </div>

          {signer && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMigrationListing(listing)}
              className="w-full bg-yellow-600 hover:bg-yellow-700 transition-colors rounded-md py-1 text-xs"
            >
              Start Migration
            </motion.button>
          )}
        </div>
      </div>
    );
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
        className="bg-white/10 backdrop-blur rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Tokens Ready for Migration</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading migration-ready tokens...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {migrationReadyListings.length > 0 ? (
              migrationReadyListings.map(renderMigrationListing)
            ) : (
              <p className="text-gray-400 col-span-full text-center">No tokens ready for migration.</p>
            )}
          </div>
        )}

        {migrationListing && signer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-gradient-to-b from-gray-900 to-black rounded-xl p-6 max-w-md w-full border border-white/10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Migrate {migrationListing.token.name}</h3>
                <button onClick={() => setMigrationListing(null)} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="bg-white/5 p-3 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Listing ID:</span>
                    <span>{migrationListing.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Token Address:</span>
                    <span>{migrationListing.token.address}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Payment Token:</span>
                    <span>{migrationListing.paymentTokenSymbol}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Reserved Amount:</span>
                    <span>{formatTokenAmount(migrationListing.token.reservedAmount, 10, true)} {migrationListing.token.symbol}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Payment Amount:</span>
                    <span>{formatBalance((parseFloat(migrationListing.poolBalance) * 0.9).toString())} {migrationListing.paymentTokenSymbol}</span>
                  </div>
                  <p className="text-xs text-yellow-400 mt-2">
                    Be the first to call the migration to receive a 0.1% reward in {migrationListing.paymentTokenSymbol}.
                  </p>
                </div>
                <div className="flex space-x-4 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-white/5 hover:bg-white/10 transition-colors rounded-lg py-2"
                    onClick={() => setMigrationListing(null)}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 transition-colors rounded-lg py-2 flex items-center justify-center"
                    onClick={() => handleMigrate(migrationListing)}
                  >
                    Confirm Migration
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {errorMessage && (
          <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />
        )}
      </motion.div>
    </motion.div>
  );
}