import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, X } from 'lucide-react';
import { useMapStore } from '../../../../store/useMapStore';
import './MobileAirspaceLegend.css';

interface LegendItem {
  id:
    | 'airspace_FIR'
    | 'airspace_ADIZ'
    | 'airspace_CTA_UPPER'
    | 'airspace_UPR_ZONE'
    | 'airspace_DANGER'
    | 'airspace_PROHIBITED'
    | 'airspace_RESTRICTED'
    | 'airspace_CTA_LOWER'
    | 'airspace_TRA'
    | 'airspace_TSA'
    | 'airspace_CTR';
  label: string;
  colorClass: string;
}

const legendItems: LegendItem[] = [
  { id: 'airspace_FIR', label: 'FIR (Info Region)', colorClass: 'bg-[#ffa500]' },
  { id: 'airspace_ADIZ', label: 'ADIZ (Defense)', colorClass: 'bg-[#7e22ce] dark:bg-[#b450dc]' },
  { id: 'airspace_CTA_UPPER', label: 'Upper CTA', colorClass: 'bg-[#0ea5e9] dark:bg-[#50c8dc]' },
  {
    id: 'airspace_UPR_ZONE',
    label: 'Upper Control (UPR)',
    colorClass: 'bg-[#4f46e5] dark:bg-[#bec8ff]',
  },
  { id: 'airspace_DANGER', label: 'Danger Area', colorClass: 'bg-[#dc2626] dark:bg-[#ff2828]' },
  {
    id: 'airspace_PROHIBITED',
    label: 'Prohibited Area',
    colorClass: 'bg-[#b91c1c] dark:bg-[#ff0000]',
  },
  {
    id: 'airspace_RESTRICTED',
    label: 'Restricted Area',
    colorClass: 'bg-[#c27803] dark:bg-[#ff8c00]',
  },
  { id: 'airspace_CTA_LOWER', label: 'Lower CTA', colorClass: 'bg-[#0ea5e9] dark:bg-[#50c8dc]' },
  { id: 'airspace_TRA', label: 'TRA (Reserved)', colorClass: 'bg-[#8b5cf6]' },
  { id: 'airspace_TSA', label: 'TSA (Segregated)', colorClass: 'bg-[#55b085] dark:bg-[#84cc16]' },
  { id: 'airspace_CTR', label: 'CTR (Control Zone)', colorClass: 'bg-[#2563eb] dark:bg-[#32b4ff]' },
];

export default function MobileAirspaceLegend() {
  const activeLayers = useMapStore((s) => s.activeLayers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);
  const [isExpanded, setIsExpanded] = useState(false);

  // Count active airspace sublayers
  const activeCount = legendItems.filter((item) =>
    activeLayers ? activeLayers[item.id] : false,
  ).length;

  return (
    <div className="mobile-airspace-legend-container pointer-events-none">
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          /* Collapsed FAB Toggle Button */
          <motion.button
            key="collapsed-fab"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsExpanded(true)}
            className="mobile-airspace-legend-fab pointer-events-auto"
            aria-label="Toggle airspace legend"
          >
            <Layers size={18} />
            {activeCount > 0 && <span className="mobile-airspace-legend-badge">{activeCount}</span>}
          </motion.button>
        ) : (
          /* Expanded Legend Menu Card */
          <motion.div
            key="expanded-card"
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mobile-airspace-legend-card pointer-events-auto"
          >
            {/* Header with Title and Close button */}
            <div className="mobile-airspace-legend-header">
              <span className="mobile-airspace-legend-title">Airspaces</span>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="mobile-airspace-legend-close-btn"
                aria-label="Collapse legend"
              >
                <X size={14} />
              </button>
            </div>

            {/* Vertically Stacked Toggle Row buttons */}
            <div className="mobile-airspace-legend-body max-h-[280px] overflow-y-auto">
              {legendItems.map(({ id, label, colorClass }) => {
                const isActive = activeLayers ? activeLayers[id] : false;
                return (
                  <motion.button
                    key={id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggleLayer(id)}
                    className="mobile-airspace-legend-row font-sans w-full"
                  >
                    <span
                      className={`mobile-airspace-legend-color-indicator ${isActive ? colorClass : 'bg-slate-500/20'}`}
                    />
                    <span
                      className={`mobile-airspace-legend-label ${
                        isActive
                          ? 'text-on-surface'
                          : 'text-on-surface-variant opacity-50 line-through'
                      }`}
                    >
                      {label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
