import { motion } from 'framer-motion';
import { Building2, TowerControl, TreePine, Construction, Radio } from 'lucide-react';
import { useMapStore } from '../../../store/useMapStore';
import { Tooltip } from '@heroui/react';

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
      color: 'text-blue-400',
      glow: 'shadow-blue-500/20',
    },
    {
      id: 'infrastructure',
      label: 'Infrastructure',
      icon: TowerControl,
      color: 'text-red-400',
      glow: 'shadow-red-500/20',
    },
    {
      id: 'natural',
      label: 'Natural Hazards',
      icon: TreePine,
      color: 'text-green-400',
      glow: 'shadow-green-500/20',
    },
    {
      id: 'navaids',
      label: 'NavAids',
      icon: Radio,
      color: 'text-purple-400',
      glow: 'shadow-purple-500/20',
    },
    {
      id: 'other',
      label: 'Other Hazards',
      icon: Construction,
      color: 'text-orange-400',
      glow: 'shadow-orange-500/20',
    },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center bg-zinc-950/80 backdrop-blur-xl border border-white/[0.06] rounded-full p-1 shadow-2xl pointer-events-auto w-fit"
    >
      <div className="px-3 py-1 flex items-center gap-1 border-r border-white/5 mr-1">
        <span className="text-[9px] font-black tracking-[0.25em] text-zinc-500 uppercase select-none">
          Obstacles
        </span>
      </div>

      <div className="flex items-center gap-0.5">
        {categories.map(({ id, label, icon: Icon, color, glow }) => {
          const isActive = terminalSpatialFilters ? terminalSpatialFilters[id] : false;
          return (
            <Tooltip
              key={id}
              content={label}
              placement="bottom"
              showArrow
              delay={400}
              classNames={{
                content:
                  'bg-zinc-950 border border-white/10 text-zinc-300 text-[10px] font-bold tracking-wider px-2 py-1 rounded-lg shadow-2xl backdrop-blur-md',
              }}
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => toggleTerminalSpatialFilter(id)}
                className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 group cursor-pointer ${
                  isActive
                    ? `bg-white/10 ${color} ${glow} shadow-lg`
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
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
            </Tooltip>
          );
        })}
      </div>
    </motion.div>
  );
}
