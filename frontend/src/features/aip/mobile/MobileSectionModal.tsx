import { createPortal } from 'react-dom';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';
import SectionRenderer from '../SectionRenderer';
import './MobileSectionModal.css';

interface MobileSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  sectionId: string;
  data: any;
  dataType: string;
  isLoading: boolean;
}

export default function MobileSectionModal({
  isOpen,
  onClose,
  title,
  sectionId,
  data,
  dataType,
  isLoading,
}: MobileSectionModalProps) {
  // ESC key handler
  useEscapeKey(isOpen, onClose);
  const dragControls = useDragControls();

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="mobile-section-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="aip-mobile-section-backdrop"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            key="mobile-section-drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.95 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 120 || info.velocity.y > 350) {
                onClose();
              }
            }}
            className="aip-mobile-section-drawer"
          >
            {/* Drag Handle Zone */}
            <div
              className="aip-mobile-section-drag-zone"
              onPointerDown={(e) => dragControls.start(e)}
              style={{ touchAction: 'none' }}
            >
              <div className="aip-mobile-section-drag-handle" />
            </div>

            {/* Header */}
            <div className="aip-mobile-section-header">
              <div className="flex items-center gap-2 min-w-0">
                <span className="aip-mobile-section-badge">{sectionId.replace(/_/g, ' ')}</span>
                <h2 className="text-on-surface font-semibold text-[13px] tracking-wide truncate uppercase">
                  {title}
                </h2>
              </div>
              <button onClick={onClose} className="aip-mobile-section-close-btn" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="aip-mobile-section-content aip-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 border-2 border-outline border-t-teal-500 rounded-full animate-spin" />
                  <span className="text-on-surface-variant text-[11px] font-medium tracking-widest uppercase">
                    Loading Section...
                  </span>
                </div>
              ) : (
                <SectionRenderer data={data} dataType={dataType} sectionId={sectionId} />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
