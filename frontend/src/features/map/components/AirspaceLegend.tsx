import { motion } from 'framer-motion';
import { useMapStore } from '../../../store/useMapStore';
import './AirspaceLegend.css';

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
  { id: 'airspace_TRA', label: 'TRA (Reserved Area)', colorClass: 'bg-[#8b5cf6]' },
  {
    id: 'airspace_TSA',
    label: 'TSA (Segregated Area)',
    colorClass: 'bg-[#55b085] dark:bg-[#84cc16]',
  },
  { id: 'airspace_CTR', label: 'CTR (Control Zone)', colorClass: 'bg-[#2563eb] dark:bg-[#32b4ff]' },
];

export default function AirspaceLegend() {
  const activeLayers = useMapStore((s) => s.activeLayers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="airspace-legend-card pointer-events-auto max-h-[380px] overflow-y-auto"
    >
      <div className="px-2 pb-1 sticky top-0 bg-transparent backdrop-blur-sm z-10">
        <span className="text-[9px] font-black tracking-[0.25em] text-on-surface-variant uppercase select-none">
          Airspaces
        </span>
      </div>

      <div className="airspace-legend-body">
        {legendItems.map(({ id, label, colorClass }) => {
          const isActive = activeLayers ? activeLayers[id] : false;
          return (
            <motion.button
              key={id}
              whileTap={{ scale: 0.97 }}
              onClick={() => toggleLayer(id)}
              className="airspace-legend-row w-full font-sans"
            >
              <span
                className={`airspace-legend-color-indicator ${isActive ? colorClass : 'bg-slate-500/20'}`}
              />
              <span
                className={`airspace-legend-label ${
                  isActive ? 'text-on-surface' : 'text-on-surface-variant opacity-50 line-through'
                }`}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
