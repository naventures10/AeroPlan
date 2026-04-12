import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, BookOpen } from 'lucide-react';

// Mirrors backend SECTION_MAP ordering (AD 2.2 → AD 2.24)
export const AIP_SECTIONS = [
  { id: 'AD_2_2', code: 'AD 2.2', title: 'Geographical & Administrative Data' },
  { id: 'AD_2_3', code: 'AD 2.3', title: 'Operational Hours' },
  { id: 'AD_2_4', code: 'AD 2.4', title: 'Handling Services & Facilities' },
  { id: 'AD_2_5', code: 'AD 2.5', title: 'Passenger Facilities' },
  { id: 'AD_2_6', code: 'AD 2.6', title: 'Rescue & Fire Fighting' },
  { id: 'AD_2_7', code: 'AD 2.7', title: 'Seasonal Availability — Clearing' },
  { id: 'AD_2_8', code: 'AD 2.8', title: 'Aprons, Taxiways & Check Locations' },
  { id: 'AD_2_9', code: 'AD 2.9', title: 'Surface Movement & Markings' },
  { id: 'AD_2_10', code: 'AD 2.10', title: 'Aerodrome Obstacles' },
  { id: 'AD_2_11', code: 'AD 2.11', title: 'Meteorological Information' },
  { id: 'AD_2_12', code: 'AD 2.12', title: 'Runway Physical Characteristics' },
  { id: 'AD_2_13', code: 'AD 2.13', title: 'Declared Distances' },
  { id: 'AD_2_14', code: 'AD 2.14', title: 'Approach & Runway Lighting' },
  { id: 'AD_2_15', code: 'AD 2.15', title: 'Other Lighting & Power Supply' },
  { id: 'AD_2_16', code: 'AD 2.16', title: 'Helicopter Landing Area' },
  { id: 'AD_2_17', code: 'AD 2.17', title: 'ATS Airspace' },
  { id: 'AD_2_18', code: 'AD 2.18', title: 'ATS Communication Facilities' },
  { id: 'AD_2_19', code: 'AD 2.19', title: 'Radio Navigation & Landing Aids' },
  { id: 'AD_2_20', code: 'AD 2.20', title: 'Local Aerodrome Regulations' },
  { id: 'AD_2_21', code: 'AD 2.21', title: 'Noise Abatement Procedures' },
  { id: 'AD_2_22', code: 'AD 2.22', title: 'Flight Procedures' },
  { id: 'AD_2_23', code: 'AD 2.23', title: 'Additional Information' },
  { id: 'AD_2_24', code: 'AD 2.24', title: 'Charts Related to Aerodrome' },
];

interface AerodromeInfoDropdownProps {
  onSectionSelect: (sectionId: string) => void;
  activeAirport: string | null;
}

/**
 * A compact dropdown button labeled "AERODROME INFORMATION".
 * Clicking it reveals a scrollable list of AIP section links.
 * Positioned in the TERMINAL view top-left.
 */
export default function AerodromeInfoDropdown({
  onSectionSelect,
  activeAirport,
}: AerodromeInfoDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!activeAirport) return null;

  return (
    <div ref={dropdownRef} className="relative z-50">
      {/* Trigger Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl backdrop-blur-2xl shadow-xl transition-all duration-300 focus:outline-none border ${
          isOpen
            ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
            : 'bg-zinc-950/50 border-zinc-800/60 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900/60 hover:border-zinc-700/60'
        }`}
      >
        <BookOpen
          size={16}
          strokeWidth={2}
          className={isOpen ? 'text-indigo-400' : 'text-zinc-500'}
        />
        <span className="text-[11px] font-bold tracking-[0.15em] uppercase">
          AERODROME INFORMATION
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2.5}
          className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-400' : 'text-zinc-500'}`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full left-0 mt-2 w-80 max-h-[60vh] overflow-y-auto rounded-xl border border-zinc-700/50 shadow-2xl aip-scrollbar"
            style={{
              background: 'rgba(9, 9, 11, 0.92)',
              backdropFilter: 'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
            }}
          >
            <div className="py-1.5">
              {AIP_SECTIONS.map((section, idx) => (
                <button
                  key={section.id}
                  onClick={() => {
                    onSectionSelect(section.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors hover:bg-zinc-800/50 group ${
                    idx !== AIP_SECTIONS.length - 1 ? 'border-b border-zinc-800/30' : ''
                  }`}
                >
                  <span className="shrink-0 mt-0.5 text-[10px] font-mono font-bold tracking-wider text-zinc-500 group-hover:text-indigo-400 transition-colors w-14">
                    {section.code}
                  </span>
                  <span className="text-[12px] font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors leading-snug">
                    {section.title}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
