// src/components/ErrorModal.tsx
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const ErrorModal = ({ message, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-60"
  >
    <motion.div
      initial={{ scale: 0.95 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0.95 }}
      className="bg-gradient-to-br from-red-900 to-gray-900 rounded-xl p-6 max-w-md w-full border border-red-500/50 shadow-2xl"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-red-300">Error</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="text-gray-200 text-sm mb-4">{message}</div>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClose}
        className="w-full bg-red-600 hover:bg-red-700 transition-colors rounded-lg py-2 text-white font-medium"
      >
        Close
      </motion.button>
    </motion.div>
  </motion.div>
);

export default ErrorModal;