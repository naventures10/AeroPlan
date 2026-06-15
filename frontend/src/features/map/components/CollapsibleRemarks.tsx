import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleRemarksProps {
  remarks?: string | null;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

export const CollapsibleRemarks = React.forwardRef<HTMLDivElement, CollapsibleRemarksProps>(
  ({ remarks, isOpen: controlledIsOpen, onToggle }, ref) => {
    const [localIsOpen, setLocalIsOpen] = useState(false);
    const isControlled = controlledIsOpen !== undefined;
    const isOpen = isControlled ? controlledIsOpen : localIsOpen;

    if (!remarks || remarks === 'None') return null;

    const handleToggle = () => {
      if (isControlled) {
        onToggle?.(!isOpen);
      } else {
        setLocalIsOpen(!localIsOpen);
        onToggle?.(!localIsOpen);
      }
    };

    return (
      <div ref={ref} className="rounded-lg border border-outline-variant overflow-hidden">
        <button
          onClick={handleToggle}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-container-high transition-colors"
        >
          <span className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase">
            Remarks
          </span>
          {isOpen ? (
            <ChevronUp size={14} className="text-on-surface-variant" />
          ) : (
            <ChevronDown size={14} className="text-on-surface-variant" />
          )}
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 py-2 border-t border-outline-variant">
                <p className="text-[11px] text-on-surface-variant leading-relaxed whitespace-pre-line">
                  {remarks}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

CollapsibleRemarks.displayName = 'CollapsibleRemarks';
