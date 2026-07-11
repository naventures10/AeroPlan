import { motion } from 'framer-motion';
import './TerminalLegend.css';
import { Building2, TowerControl, TreePine, Construction, Radio } from 'lucide-react';
import { useMapStore } from '../../../store/useMapStore';

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

/**
 * TerminalLegend Component
 *
 * A compact card with vertically stacked icon + label rows
 * for toggling spatial obstacle categories.
 * Positioned at bottom-left of the map in TERMINAL view.
 */
export default function TerminalLegend() {
  const terminalSpatialFilters = useMapStore((s) => s.terminalSpatialFilters);
  const toggleTerminalSpatialFilter = useMapStore((s) => s.toggleTerminalSpatialFilter);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="obstacle-legend-card pointer-events-auto"
    >
      <div className="px-2 pb-1">
        <span className="text-[9px] font-black tracking-[0.25em] text-on-surface-variant uppercase select-none">
          Obstacles
        </span>
      </div>

      {categories.map(({ id, label, icon: Icon, color }) => {
        const isActive = terminalSpatialFilters ? terminalSpatialFilters[id] : false;
        return (
          <motion.button
            key={id}
            whileTap={{ scale: 0.97 }}
            onClick={() => toggleTerminalSpatialFilter(id)}
            className="obstacle-legend-row w-full"
          >
            <Icon
              size={14}
              strokeWidth={isActive ? 2.5 : 1.5}
              className={`shrink-0 transition-colors duration-200 ${
                isActive ? color : 'text-on-surface-variant'
              }`}
            />
            <span
              className={`obstacle-legend-label ${isActive ? color : 'text-on-surface-variant'}`}
            >
              {label}
            </span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
