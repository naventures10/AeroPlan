import { useEffect } from 'react';
import './SectionModal.css';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import SectionRenderer from './SectionRenderer';

interface SectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  sectionId: string;
  data: any;
  dataType: string;
  isLoading: boolean;
}

/**
 * A centered 5XL modal with blurred backdrop for displaying AIP section data.
 * ESC key closes the modal.
 */
export default function SectionModal({
  isOpen,
  onClose,
  title,
  sectionId,
  data,
  dataType,
  isLoading,
}: SectionModalProps) {
  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal-content"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="aip-modal-container pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
              }}
              onWheel={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="aip-modal-header">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="aip-modal-badge">{sectionId.replace(/_/g, ' ')}</span>
                  <h2 className="text-on-surface font-semibold text-sm tracking-wide truncate uppercase">
                    {title}
                  </h2>
                </div>
                <button onClick={onClose} className="aip-modal-close-btn focus:outline-none">
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto overflow-x-auto aip-scrollbar">
                {isLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-outline border-t-teal-500 dark:border-t-indigo-400 rounded-full animate-spin" />
                      <span className="text-on-surface-variant text-xs font-medium tracking-widest uppercase">
                        Loading Section...
                      </span>
                    </div>
                  </div>
                ) : (
                  <SectionRenderer data={data} dataType={dataType} sectionId={sectionId} />
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
