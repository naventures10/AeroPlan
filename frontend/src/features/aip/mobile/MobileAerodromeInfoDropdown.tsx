import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { ChevronDown, BookOpen, X } from 'lucide-react';
import './MobileAerodromeInfoDropdown.css';

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

interface MobileAerodromeInfoDropdownProps {
  onSectionSelect: (sectionId: string) => void;
  activeAirport: string | null;
}

export default function MobileAerodromeInfoDropdown({
  onSectionSelect,
  activeAirport,
}: MobileAerodromeInfoDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dragControls = useDragControls();

  if (!activeAirport) return null;

  const handleClose = () => setIsOpen(false);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="aip-mobile-trigger flex items-center gap-2 px-3.5 py-1.5 focus:outline-none"
      >
        <BookOpen size={14} strokeWidth={2.5} className="text-on-surface-variant shrink-0" />
        <span className="text-[11px] font-black tracking-[0.12em] uppercase whitespace-nowrap">
          AERO INFO
        </span>
        <ChevronDown size={12} strokeWidth={2.5} className="text-on-surface-variant shrink-0" />
      </button>

      {/* Bottom Sheet Drawer */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                key="mobile-info-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleClose}
                className="aip-mobile-info-backdrop"
              />

              {/* Drawer */}
              <motion.div
                key="mobile-info-drawer"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                drag="y"
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0.05, bottom: 0.95 }}
                onDragEnd={(_e, info) => {
                  if (info.offset.y > 100 || info.velocity.y > 300) {
                    handleClose();
                  }
                }}
                className="aip-mobile-info-drawer"
              >
                {/* Drag handle */}
                <div
                  className="aip-mobile-info-drag-zone"
                  onPointerDown={(e) => dragControls.start(e)}
                  style={{ touchAction: 'none' }}
                >
                  <div className="aip-mobile-info-drag-handle" />
                </div>

                {/* Header */}
                <div className="aip-mobile-info-header">
                  <div className="flex items-center gap-2">
                    <BookOpen size={18} className="text-accent-cyan" />
                    <h2 className="text-lg font-bold text-on-surface">Aerodrome Info</h2>
                  </div>
                  <button
                    onClick={handleClose}
                    className="aip-mobile-info-close-btn"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Scrollable list of sections */}
                <div className="aip-mobile-info-content aip-scrollbar">
                  <div className="aip-mobile-info-grid">
                    {AIP_SECTIONS.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => {
                          onSectionSelect(section.id);
                          handleClose();
                        }}
                        className="aip-mobile-info-item"
                      >
                        <span className="aip-mobile-info-item-code">{section.code}</span>
                        <span className="aip-mobile-info-item-title">{section.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
