import { useMapStore } from '../store/useMapStore';
import { useSearch } from '../hooks/useSearch';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useAerodromeData } from '../hooks/useAerodromeData';
import { useIsMobile } from '../hooks/useIsMobile';
import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import GlobalLoader from '../components/GlobalLoader';

const MapView = lazy(() => import('../features/map/MapView'));
const SearchBar = lazy(() => import('../features/map/controls/SearchBar'));
const MobileSearchBar = lazy(() => import('../features/map/controls/mobile/MobileSearchBar'));
const LayerToolbar = lazy(() => import('../features/map/controls/LayerToolbar'));
const MobileLayerToolbar = lazy(() => import('../features/map/controls/mobile/MobileLayerToolbar'));
const ViewToggle = lazy(() => import('../features/map/controls/ViewToggle'));
const MobileViewToggle = lazy(() => import('../features/map/controls/mobile/MobileViewToggle'));
const WeatherControls = lazy(() =>
  import('../features/map/controls/WeatherControls').then((m) => ({
    default: m.WeatherControls,
  })),
);
const MobileWeatherControls = lazy(() =>
  import('../features/map/controls/mobile/MobileWeatherControls').then((m) => ({
    default: m.MobileWeatherControls,
  })),
);

const AerodromeInfoDropdown = lazy(() => import('../features/aip/AerodromeInfoDropdown'));
const AerodromeChartViewer = lazy(() => import('../features/aip/AerodromeChartViewer'));
const SectionModal = lazy(() => import('../features/aip/SectionModal'));
const TerminalDashboard = lazy(() => import('../features/terminal/TerminalDashboard'));
const TerminalLegend = lazy(() => import('../features/terminal/components/TerminalLegend'));
const AipSupplementsModal = lazy(() => import('../features/aip/AipSupplementsModal'));
const AirspaceNotamsModal = lazy(() =>
  import('../features/aip/AirspaceNotamsModal').then((module) => ({
    default: module.AirspaceNotamsModal,
  })),
);
const UserProfileModal = lazy(() => import('../features/user/UserProfileModal'));

// fallow-ignore-next-line complexity
export default function MapPage() {
  const { viewMode, activeAirport, viewState, isWeatherMode } = useMapStore();
  const search = useSearch();
  const isMobile = useIsMobile();

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
    <div className="w-screen h-[100dvh] overflow-hidden bg-surface relative font-sans">
      {/* Map (Primary Chunk) */}
      <Suspense fallback={<GlobalLoader />}>
        <MapView aerodromes={aerodromes} onAerodromeClick={handleAerodromeClick} />
      </Suspense>

      {/* Overlay Layer (Secondary Chunks) */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Parallel UI Crossfade Architecture */}
        <motion.div
          key="primary-ui"
          initial={false}
          animate={!isWeatherMode || viewState.pitch > 0 ? 'visible' : 'hidden'}
          variants={{
            visible: { opacity: 1, display: 'block' },
            hidden: { opacity: 0, transitionEnd: { display: 'none' } },
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="absolute inset-0 pointer-events-none"
        >
          <div
            className={`absolute top-6 flex flex-col gap-3 pointer-events-auto ${search.isSearchFocused ? 'z-[250]' : 'z-50'} ${viewMode === 'TERMINAL' ? 'left-6' : isMobile ? 'left-[4.75rem]' : 'left-[4.5rem]'}`}
          >
            {viewMode === 'ENROUTE' && viewState.pitch === 0 && (
              <Suspense fallback={null}>
                {isMobile ? <MobileSearchBar {...search} /> : <SearchBar {...search} />}
              </Suspense>
            )}

            {(activeAirport || viewMode === 'TERMINAL') && (
              <>
                <Suspense fallback={null}>
                  <AerodromeInfoDropdown
                    onSectionSelect={handleSectionSelect}
                    activeAirport={activeAirport}
                  />
                </Suspense>
                {activeAirport && (
                  <Suspense fallback={null}>
                    <AerodromeChartViewer icaoCode={activeAirport} />
                  </Suspense>
                )}
              </>
            )}
          </div>

          {activeAirport && (viewMode === 'TERMINAL' || viewState.pitch > 0) && (
            <div className="absolute top-6 right-6 pointer-events-auto z-40">
              <Suspense fallback={null}>
                <TerminalDashboard icaoCode={activeAirport} />
              </Suspense>
            </div>
          )}

          {viewMode === 'TERMINAL' && (
            <div className="absolute bottom-6 left-6 pointer-events-auto z-40">
              <Suspense fallback={null}>
                <TerminalLegend />
              </Suspense>
            </div>
          )}

          {/* Removed LayerToolbar from here to prevent weather layer hijacking */}
          <Suspense fallback={null}>{isMobile ? <MobileViewToggle /> : <ViewToggle />}</Suspense>
        </motion.div>

        <motion.div
          key="weather-ui"
          initial={false}
          animate={isWeatherMode && viewState.pitch === 0 ? 'visible' : 'hidden'}
          variants={{
            visible: { opacity: 1, display: 'block' },
            hidden: { opacity: 0, transitionEnd: { display: 'none' } },
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="absolute inset-0 pointer-events-none"
        >
          <Suspense fallback={null}>
            {isMobile ? <MobileWeatherControls /> : <WeatherControls />}
          </Suspense>
        </motion.div>

        {/* Persistently render LayerToolbar outside the crossfade in 2D ENROUTE view */}
        {viewMode === 'ENROUTE' && viewState.pitch === 0 && (
          <Suspense fallback={null}>
            {isMobile ? <MobileLayerToolbar /> : <LayerToolbar />}
          </Suspense>
        )}
      </div>

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

      <Suspense fallback={null}>
        <AipSupplementsModal />
        <AirspaceNotamsModal />
        <UserProfileModal />
      </Suspense>
    </div>
  );
}
