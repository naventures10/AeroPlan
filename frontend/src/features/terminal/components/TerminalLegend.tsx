import { motion } from 'framer-motion';
import './TerminalLegend.css';
import { Building2, TowerControl, TreePine, Construction, Radio } from 'lucide-react';
import { useMapStore } from '../../../store/useMapStore';

/**
 * TerminalLegend Component
 *
 * A minimalist horizontal icon-bar for toggling spatial categories.
 * Designed to be placed below the Aerodrome Information dropdown.
 */
export default function TerminalLegend() {
  const { terminalSpatialFilters, toggleTerminalSpatialFilter } = useMapStore();

  const categories = [
    {
      id: 'buildings',
      label: 'Buildings',
      icon: Building2,
      color: 'text-blue-600 dark:text-blue-400',
      glow: 'shadow-blue-500/20',
    },
    {
      id: 'infrastructure',
      label: 'Infrastructure',
      icon: TowerControl,
      color: 'text-red-600 dark:text-red-400',
      glow: 'shadow-red-500/20',
    },
    {
      id: 'natural',
      label: 'Natural Hazards',
      icon: TreePine,
      color: 'text-green-600 dark:text-green-400',
      glow: 'shadow-green-500/20',
    },
    {
      id: 'navaids',
      label: 'NavAids',
      icon: Radio,
      color: 'text-purple-600 dark:text-purple-400',
      glow: 'shadow-purple-500/20',
    },
    {
      id: 'other',
      label: 'Other Hazards',
      icon: Construction,
      color: 'text-orange-600 dark:text-orange-400',
      glow: 'shadow-orange-500/20',
    },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="obstacle-legend-container flex items-center pointer-events-auto w-fit"
    >
      <div className="obstacle-legend-header mr-1">
        <span className="text-[9px] font-black tracking-[0.25em] text-on-surface-variant uppercase select-none">
          Obstacles
        </span>
      </div>

      <div className="flex items-center gap-0.5">
        {categories.map(({ id, label, icon: Icon, color, glow }) => {
          const isActive = terminalSpatialFilters ? terminalSpatialFilters[id] : false;
          return (
            <div key={id} className="relative group/tooltip flex justify-center">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => toggleTerminalSpatialFilter(id)}
                className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 cursor-pointer ${
                  isActive
                    ? `bg-surface-container-high  ${color} ${glow} shadow-lg`
                    : 'text-on-surface-variant hover:text-on-surface-variant hover:bg-surface-container-high   '
                }`}
              >
                <Icon size={15} strokeWidth={isActive ? 2.5 : 1.5} />

                {/* Active Indicator Dot */}
                {isActive && (
                  <motion.div
                    layoutId={`active-pill-dot-${id}`}
                    className={`absolute -bottom-0.5 w-1 h-1 rounded-full ${color.replace('text-', 'bg-')}`}
                  />
                )}
              </motion.button>

              {/* Custom Tooltip */}
              <div className="absolute top-full mt-2 pointer-events-none opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 z-50">
                <div className="relative">
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 border-l border-t border-[var(--glass-border-highlight)] bg-[var(--glass-bg-solid)] rotate-45" />
                  <div className="relative border border-[var(--glass-border-highlight)] bg-[var(--glass-bg-solid)] text-[var(--primary)] text-[10px] font-bold tracking-wider px-2 py-1 rounded-lg shadow-2xl backdrop-blur-md whitespace-nowrap">
                    {label}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
