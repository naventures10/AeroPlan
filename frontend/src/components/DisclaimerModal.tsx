import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X } from 'lucide-react';

interface DisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DisclaimerModal({ isOpen, onClose }: DisclaimerModalProps) {
  const navigate = useNavigate();

  const handleProceed = () => {
    onClose();
    navigate('/app');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="glass-morphism relative w-full max-w-md sm:max-w-lg p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-2xl border border-outline/20 text-on-surface bg-surface-container/95 flex flex-col gap-3.5 sm:gap-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="disclaimer-title"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 p-1.5 text-on-surface-variant hover:text-on-surface rounded-xl hover:bg-surface-container-high transition-colors focus:outline-none"
              aria-label="Close disclaimer modal"
            >
              <X size={18} className="sm:w-5 sm:h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2.5 sm:gap-3 pr-7">
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-accent-cyan/15 text-accent-cyan shrink-0">
                <ShieldAlert className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <div>
                <h2
                  id="disclaimer-title"
                  className="font-display text-base sm:text-xl font-bold text-on-background leading-snug"
                >
                  Non-Operational Use Disclaimer
                </h2>
              </div>
            </div>

            {/* Body Content */}
            <div className="font-ui text-xs sm:text-base text-on-surface-variant leading-relaxed flex flex-col gap-2.5 sm:gap-3">
              <div className="p-2.5 sm:p-3.5 rounded-xl bg-surface-container-high/60 border border-outline/10 text-xs sm:text-sm leading-relaxed">
                <strong className="text-on-surface font-semibold block mb-0.5 sm:mb-1">
                  Important Requirement:
                </strong>
                This platform and its data layers are{' '}
                <span className="font-semibold text-on-surface underline">NOT</span> certified for
                real-world flight navigation or operational flight planning. Pilots and flight
                personnel must rely exclusively on official Aeronautical Information Publications.
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-row items-center justify-end gap-2.5 sm:gap-3 mt-1 sm:mt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 sm:w-auto px-4 py-2 sm:py-2.5 rounded-xl border border-outline/30 text-on-surface hover:bg-surface-container-high text-xs sm:text-sm font-semibold transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceed}
                className="w-1/2 sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-primary text-on-primary hover:bg-opacity-95 text-xs sm:text-sm font-semibold transition-all shadow-md active:scale-[0.98] cursor-pointer text-center"
              >
                I Understand & Proceed
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
