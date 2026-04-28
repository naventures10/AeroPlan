import { useMapStore } from './store/useMapStore';
import { useSearch } from './hooks/useSearch';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAerodromeData } from './hooks/useAerodromeData';
import { useLayoutEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlobalLoader from './components/GlobalLoader';

import TerminalDashboard from './features/terminal/TerminalDashboard';
import SearchBar from './features/map/controls/SearchBar';
import LayerToolbar from './features/map/controls/LayerToolbar';
import ViewToggle from './features/map/controls/ViewToggle';
import AerodromeInfoDropdown from './features/aip/AerodromeInfoDropdown';
import AerodromeChartViewer from './features/aip/AerodromeChartViewer';
import SectionModal from './features/aip/SectionModal';

const MapView = lazy(() => import('./features/map/MapView'));
const WindControls = lazy(() =>
  import('./features/map/controls/WindControls').then((m) => ({ default: m.WindControls })),
);

/**
 * Decoupled content layer to prevent hooks from blocking initial paint.
 */
function AppContent() {
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
    <>
      {/* Map (Primary Chunk) */}
      <Suspense fallback={<GlobalLoader />}>
        <MapView aerodromes={aerodromes} onAerodromeClick={handleAerodromeClick} />
      </Suspense>

      {/* Overlay Layer (Secondary Chunks) */}
      <Suspense fallback={null}>
        <div className="absolute inset-0 pointer-events-none z-10">
          <AnimatePresence>
            {!isWindMode ? (
              <motion.div
                key="primary-ui"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
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
                  <div className="absolute top-6 right-6 pointer-events-none z-40">
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
    </>
  );
}

/**
 * Root application shell.
 */
export default function App() {
  useLayoutEffect(() => {
    // @ts-expect-error - native global from index.html
    if (window.hideLoader) window.hideLoader();
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-900 relative font-sans">
      <AppContent />
    </div>
  );
}
