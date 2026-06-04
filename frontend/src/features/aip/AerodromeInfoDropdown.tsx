import { useState, useRef, useEffect } from 'react';
import './AerodromeInfoDropdown.css';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, BookOpen } from 'lucide-react';

// Mirrors backend SECTION_MAP ordering (AD 2.2 → AD 2.24)
const AIP_SECTIONS = [
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
 * A compact dropdown button labeled"AERODROME INFORMATION".
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
        className={`aip-dropdown-trigger flex items-center gap-2.5 px-4 py-2.5 focus:outline-none ${
          isOpen ? 'active' : ''
        }`}
      >
        <BookOpen
          size={16}
          strokeWidth={2}
          className={isOpen ? 'text-teal-700 dark:text-cyan-400' : 'text-on-surface-variant '}
        />
        <span className="text-[11px] font-bold tracking-[0.15em] uppercase">
          AERODROME INFORMATION
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2.5}
          className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-teal-700 dark:text-cyan-400' : 'text-on-surface-variant '}`}
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
            className="aip-dropdown-menu mt-2 w-80 max-h-[60vh] aip-scrollbar"
          >
            <div className="py-1.5">
              {AIP_SECTIONS.map((section, idx) => (
                <button
                  key={section.id}
                  onClick={() => {
                    onSectionSelect(section.id);
                    setIsOpen(false);
                  }}
                  className={`aip-dropdown-item ${
                    idx !== AIP_SECTIONS.length - 1 ? 'border-b border-outline-variant ' : ''
                  }`}
                >
                  <span className="aip-dropdown-item-code">{section.code}</span>
                  <span className="aip-dropdown-item-title">{section.title}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
