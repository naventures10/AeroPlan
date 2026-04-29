import { useMapStore } from '../store/useMapStore';
import { useSearch } from '../hooks/useSearch';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useAerodromeData } from '../hooks/useAerodromeData';
import { lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlobalLoader from '../components/GlobalLoader';

const MapView = lazy(() => import('../features/map/MapView'));
const SearchBar = lazy(() => import('../features/map/controls/SearchBar'));
const LayerToolbar = lazy(() => import('../features/map/controls/LayerToolbar'));
const ViewToggle = lazy(() => import('../features/map/controls/ViewToggle'));
const WindControls = lazy(() =>
  import('../features/map/controls/WindControls').then((m) => ({ default: m.WindControls })),
);

const AerodromeInfoDropdown = lazy(() => import('../features/aip/AerodromeInfoDropdown'));
const AerodromeChartViewer = lazy(() => import('../features/aip/AerodromeChartViewer'));
const SectionModal = lazy(() => import('../features/aip/SectionModal'));
const TerminalDashboard = lazy(() => import('../features/terminal/TerminalDashboard'));

export default function MapPage() {
  const { viewMode, activeAirport, viewState, isWindMode } = useMapStore();
  const search = useSearch();

  const {
    aerodromes,
    handleAerodromeClick,
    sectionModalOpen,
    closeSectionModal,
    sectionData,
    sectionTitle,
    sectionId,
    sectionDataType,
    sectionLoading,
    handleSectionSelect,
  } = useAerodromeData();

  useKeyboardShortcuts({
    sectionModalOpen,
    onCloseSectionModal: closeSectionModal,
    cancelPendingSelection: search.cancelPendingSelection,
  });

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-900 relative font-sans">
      {/* Map (Primary Chunk) */}
      <Suspense fallback={<GlobalLoader />}>
        <MapView aerodromes={aerodromes} onAerodromeClick={handleAerodromeClick} />
      </Suspense>

      {/* Overlay Layer (Secondary Chunks) */}
      <Suspense fallback={null}>
        <div className="absolute inset-0 pointer-events-none z-10">
          <AnimatePresence>
            {!isWindMode || viewState.pitch > 0 ? (
              <motion.div
                key="primary-ui"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 pointer-events-none"
              >
                {(activeAirport || viewMode === 'TERMINAL') && (
                  <div className="absolute top-6 left-6 pointer-events-auto z-50">
                    <AerodromeInfoDropdown
                      onSectionSelect={handleSectionSelect}
                      activeAirport={activeAirport}
                    />
                  </div>
                )}

                {activeAirport && (viewMode === 'TERMINAL' || viewState.pitch > 0) && (
                  <div className="absolute top-6 right-6 pointer-events-auto z-40">
                    <TerminalDashboard icaoCode={activeAirport} />
                  </div>
                )}

                {activeAirport && (
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-auto z-40 scale-110 origin-bottom">
                    <AerodromeChartViewer icaoCode={activeAirport} />
                  </div>
                )}

                {viewMode === 'ENROUTE' && <SearchBar {...search} />}
                {viewMode === 'ENROUTE' && <LayerToolbar />}
                <ViewToggle />
              </motion.div>
            ) : (
              <motion.div
                key="wind-ui"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 pointer-events-none"
              >
                <WindControls />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Suspense>

      <Suspense fallback={null}>
        <SectionModal
          isOpen={sectionModalOpen}
          onClose={closeSectionModal}
          title={sectionTitle}
          sectionId={sectionId}
          data={sectionData}
          dataType={sectionDataType}
          isLoading={sectionLoading}
        />
      </Suspense>
    </div>
  );
}
