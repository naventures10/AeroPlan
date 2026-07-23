import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { useMapStore } from '../../../store/useMapStore';
import HoverTooltip from '../../../components/HoverTooltip';

const AUTO_MINIMIZE_DELAY_MS = 2500; // 2.5 seconds delay after map interaction

export default function MapDisclaimerBanner() {
  const [isMinimized, setIsMinimized] = useState(false);
  const isMobile = useIsMobile();
  const viewState = useMapStore((s) => s.viewState);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Function to schedule auto-minimization after delay
  const scheduleAutoMinimize = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setIsMinimized(true);
    }, AUTO_MINIMIZE_DELAY_MS);
  };

  // 1. Auto-minimize when map viewState changes (drag, pan, zoom, rotate)
  useEffect(() => {
    if (!isMinimized) {
      scheduleAutoMinimize();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [viewState.longitude, viewState.latitude, viewState.zoom, viewState.pitch, viewState.bearing]);

  // 2. Auto-minimize when user interacts via pointer / touch / wheel on the map
  useEffect(() => {
    const handleMapInteraction = () => {
      if (!isMinimized) {
        scheduleAutoMinimize();
      }
    };

    window.addEventListener('pointerdown', handleMapInteraction, { passive: true });
    window.addEventListener('wheel', handleMapInteraction, { passive: true });
    window.addEventListener('touchstart', handleMapInteraction, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleMapInteraction);
      window.removeEventListener('wheel', handleMapInteraction);
      window.removeEventListener('touchstart', handleMapInteraction);
    };
  }, [isMinimized]);

  return (
    <AnimatePresence mode="wait">
      {isMinimized ? (
        // Minimized Mode: Icon-only symbol button
        <HoverTooltip<HTMLButtonElement> key="minimized" content="Aeronautical Disclaimer">
          {({ ref, interestfor, className }) => (
            <motion.button
              ref={ref}
              interestfor={interestfor}
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={() => {
                setIsMinimized(false);
                scheduleAutoMinimize();
              }}
              className={`glass-morphism pointer-events-auto z-40 flex items-center justify-center p-2.5 rounded-xl text-accent-cyan hover:bg-surface-container-high transition-colors shadow-md ${className} ${
                isMobile ? 'fixed bottom-20 left-3' : 'absolute bottom-6 right-6'
              }`}
              aria-label="Expand aeronautical disclaimer"
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect
                  x="3.5"
                  y="3.5"
                  width="17"
                  height="17"
                  rx="3"
                  transform="rotate(45 12 12)"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2.2" />
                <circle cx="12" cy="15.5" r="1" fill="currentColor" />
              </svg>
            </motion.button>
          )}
        </HoverTooltip>
      ) : (
        // Expanded Mode: Full Disclaimer Banner Card
        <motion.div
          key="expanded"
          initial={{ opacity: 0, scale: 0.95, y: 5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 5 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`glass-morphism pointer-events-auto z-40 flex items-center gap-3 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl shadow-md text-on-surface ${
            isMobile
              ? 'fixed bottom-20 left-3 right-16 max-w-[calc(100vw-4.5rem)] text-xs'
              : 'absolute bottom-6 right-6 max-w-md text-xs sm:text-sm'
          }`}
          role="region"
          aria-label="Situational awareness disclaimer"
        >
          {/* Alert Diamond Icon */}
          <div className="shrink-0 flex items-center justify-center text-accent-cyan">
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect
                x="3.5"
                y="3.5"
                width="17"
                height="17"
                rx="3"
                transform="rotate(45 12 12)"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2.2" />
              <circle cx="12" cy="15.5" r="1" fill="currentColor" />
            </svg>
          </div>

          {/* Disclaimer Message */}
          <p className="leading-normal font-sans font-normal opacity-90 flex-1 pr-1 text-on-surface">
            Information on the map within{' '}
            <strong className="font-bold tracking-wide text-on-surface">AERO</strong> mode is solely
            intended to enhance situational awareness and should not be considered a suitable
            alternative for the aeronautical charts within eAIP India
          </p>

          {/* Minimize Button */}
          <button
            type="button"
            onClick={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
              setIsMinimized(true);
            }}
            className="shrink-0 p-1 -mr-1 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container-high transition-colors focus:outline-none"
            aria-label="Minimize disclaimer banner"
            title="Minimize disclaimer"
          >
            <ChevronRight size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
