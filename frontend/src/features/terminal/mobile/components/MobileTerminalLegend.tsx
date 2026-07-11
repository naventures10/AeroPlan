import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  TowerControl,
  TreePine,
  Construction,
  Radio,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useMapStore } from '../../../../store/useMapStore';
import './MobileTerminalLegend.css';

const categories = [
  {
    id: 'buildings',
    label: 'Buildings',
    icon: Building2,
    color: 'text-slate-500 dark:text-blue-400',
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    icon: TowerControl,
    color: 'text-[#c45b4b] dark:text-red-400',
  },
  {
    id: 'natural',
    label: 'Natural Hazards',
    icon: TreePine,
    color: 'text-[#0a7c6e] dark:text-green-400',
  },
  {
    id: 'navaids',
    label: 'NavAids',
    icon: Radio,
    color: 'text-[#8b5a8c] dark:text-purple-400',
  },
  {
    id: 'other',
    label: 'Other Hazards',
    icon: Construction,
    color: 'text-amber-600 dark:text-orange-400',
  },
] as const;

export default function MobileTerminalLegend() {
  const terminalSpatialFilters = useMapStore((s) => s.terminalSpatialFilters);
  const toggleTerminalSpatialFilter = useMapStore((s) => s.toggleTerminalSpatialFilter);
  const [isExpanded, setIsExpanded] = useState(false);

  // Count active filters
  const activeCount = categories.filter((c) =>
    terminalSpatialFilters ? terminalSpatialFilters[c.id] : false,
  ).length;

  return (
    <div className="mobile-terminal-legend-container pointer-events-none">
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
            className="mobile-legend-fab pointer-events-auto"
            aria-label="Toggle obstacle legend"
          >
            <AlertTriangle size={18} />
            {activeCount > 0 && <span className="mobile-legend-badge">{activeCount}</span>}
          </motion.button>
        ) : (
          /* Expanded Legend Menu Card */
          <motion.div
            key="expanded-card"
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mobile-legend-card pointer-events-auto"
          >
            {/* Header with Title and Close button */}
            <div className="mobile-legend-header">
              <span className="mobile-legend-title">Obstacles</span>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="mobile-legend-close-btn"
                aria-label="Collapse legend"
              >
                <X size={14} />
              </button>
            </div>

            {/* Vertically Stacked Toggle Row buttons */}
            <div className="mobile-legend-body">
              {categories.map(({ id, label, icon: Icon, color }) => {
                const isActive = terminalSpatialFilters ? terminalSpatialFilters[id] : false;
                return (
                  <motion.button
                    key={id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggleTerminalSpatialFilter(id)}
                    className="mobile-legend-row"
                  >
                    <Icon
                      size={14}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      className={`shrink-0 transition-colors duration-200 ${
                        isActive ? color : 'text-on-surface-variant'
                      }`}
                    />
                    <span
                      className={`mobile-legend-label ${
                        isActive ? color : 'text-on-surface-variant'
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
