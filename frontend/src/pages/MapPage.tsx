import { useMapStore } from '../store/useMapStore';
import { useSearch } from '../hooks/useSearch';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useAerodromeData } from '../hooks/useAerodromeData';
import { useIsMobile } from '../hooks/useIsMobile';
import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
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
const MobileAerodromeInfoDropdown = lazy(
  () => import('../features/aip/mobile/MobileAerodromeInfoDropdown'),
);
const MobileAerodromeChartViewer = lazy(
  () => import('../features/aip/mobile/MobileAerodromeChartViewer'),
);
const MobileSectionModal = lazy(() => import('../features/aip/mobile/MobileSectionModal'));
const TerminalDashboard = lazy(() => import('../features/terminal/TerminalDashboard'));
const MobileTerminalDashboard = lazy(() =>
  import('../features/terminal/mobile/MobileTerminalDashboard').then((module) => ({
    default: module.default,
  })),
);
const TerminalLegend = lazy(() => import('../features/terminal/components/TerminalLegend'));
const MobileTerminalLegend = lazy(() =>
  import('../features/terminal/mobile/components/MobileTerminalLegend').then((module) => ({
    default: module.default,
  })),
);
const AipSupplementsModal = lazy(() => import('../features/aip/AipSupplementsModal'));
const MobileAipSupplementsModal = lazy(() =>
  import('../features/aip/mobile/MobileAipSupplementsModal').then((module) => ({
    default: module.MobileAipSupplementsModal,
  })),
);
const AirspaceNotamsModal = lazy(() =>
  import('../features/aip/AirspaceNotamsModal').then((module) => ({
    default: module.AirspaceNotamsModal,
  })),
);
const MobileAirspaceNotamsModal = lazy(() =>
  import('../features/aip/mobile/MobileAirspaceNotamsModal').then((module) => ({
    default: module.MobileAirspaceNotamsModal,
  })),
);
const MobileFeatureInfoCard = lazy(() =>
  import('../features/map/components/mobile/MobileFeatureInfoCard').then((m) => ({
    default: m.MobileFeatureInfoCard,
  })),
);

// fallow-ignore-next-line complexity
export default function MapPage() {
  const viewMode = useMapStore((s) => s.viewMode);
  const activeAirport = useMapStore((s) => s.activeAirport);
  const pitch = useMapStore((s) => s.viewState.pitch);
  const isWeatherMode = useMapStore((s) => s.isWeatherMode);
  const returnToEnroute = useMapStore((s) => s.returnToEnroute);
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
      {!aerodromes && <GlobalLoader />}
      {/* Map (Primary Chunk) */}
      <Suspense fallback={aerodromes ? <GlobalLoader /> : null}>
        <MapView aerodromes={aerodromes} onAerodromeClick={handleAerodromeClick} />
      </Suspense>

      {/* Overlay Layer (Secondary Chunks) */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Parallel UI Crossfade Architecture */}
        <motion.div
          key="primary-ui"
          initial={false}
          animate={!isWeatherMode || pitch > 0 ? 'visible' : 'hidden'}
          variants={{
            visible: { opacity: 1, display: 'block' },
            hidden: { opacity: 0, transitionEnd: { display: 'none' } },
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="absolute inset-0 pointer-events-none"
        >
          <div
            className={`absolute top-6 flex ${isMobile ? 'flex-row items-center gap-2' : 'flex-col gap-3'} pointer-events-auto ${search.isSearchFocused ? 'z-[250]' : 'z-50'} ${viewMode === 'TERMINAL' ? 'left-6' : isMobile ? 'left-[4.75rem]' : 'left-[4.5rem]'}`}
          >
            {viewMode === 'ENROUTE' && pitch === 0 && (
              <Suspense fallback={null}>
                {isMobile ? <MobileSearchBar {...search} /> : <SearchBar {...search} />}
              </Suspense>
            )}

            {!isMobile && (activeAirport || viewMode === 'TERMINAL') && (
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

          {isMobile && (activeAirport || viewMode === 'TERMINAL') && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-row items-center gap-2 pointer-events-auto z-50">
              {/* Exit Terminal Button */}
              <button
                type="button"
                onClick={() => returnToEnroute(true)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 active:scale-95 transition-all duration-200 backdrop-blur-xl shadow-lg focus:outline-none shrink-0"
                aria-label="Exit Terminal View"
              >
                <LogOut size={16} strokeWidth={2.5} className="rotate-180" />
              </button>

              <Suspense fallback={null}>
                <MobileAerodromeInfoDropdown
                  onSectionSelect={handleSectionSelect}
                  activeAirport={activeAirport}
                />
              </Suspense>
              {activeAirport && (
                <Suspense fallback={null}>
                  <MobileAerodromeChartViewer icaoCode={activeAirport} />
                </Suspense>
              )}
            </div>
          )}

          {activeAirport && (viewMode === 'TERMINAL' || pitch > 0) && !isMobile && (
            <div className="absolute top-32 lg:top-6 right-6 pointer-events-auto z-40">
              <Suspense fallback={null}>
                <TerminalDashboard icaoCode={activeAirport} />
              </Suspense>
            </div>
          )}

          {viewMode === 'TERMINAL' && !isMobile && (
            <div className="absolute bottom-6 left-6 pointer-events-auto z-40">
              <Suspense fallback={null}>
                <TerminalLegend />
              </Suspense>
            </div>
          )}

          {viewMode === 'TERMINAL' && isMobile && (
            <Suspense fallback={null}>
              <MobileTerminalLegend />
            </Suspense>
          )}

          {/* Removed LayerToolbar from here to prevent weather layer hijacking */}
          <Suspense fallback={null}>{isMobile ? <MobileViewToggle /> : <ViewToggle />}</Suspense>
        </motion.div>

        <motion.div
          key="weather-ui"
          initial={false}
          animate={isWeatherMode && pitch === 0 ? 'visible' : 'hidden'}
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
        {viewMode === 'ENROUTE' && pitch === 0 && (
          <Suspense fallback={null}>
            {isMobile ? <MobileLayerToolbar /> : <LayerToolbar />}
          </Suspense>
        )}

        {/* Mobile Feature Info Card — rendered outside MapView/DeckGL to avoid event conflicts */}
        {isMobile && (
          <Suspense fallback={null}>
            <MobileFeatureInfoCard />
          </Suspense>
        )}
      </div>

      <Suspense fallback={null}>
        {isMobile ? (
          <MobileSectionModal
            isOpen={sectionModalOpen}
            onClose={closeSectionModal}
            title={sectionTitle}
            sectionId={sectionId}
            data={sectionData}
            dataType={sectionDataType}
            isLoading={sectionLoading}
          />
        ) : (
          <SectionModal
            isOpen={sectionModalOpen}
            onClose={closeSectionModal}
            title={sectionTitle}
            sectionId={sectionId}
            data={sectionData}
            dataType={sectionDataType}
            isLoading={sectionLoading}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {isMobile ? <MobileAipSupplementsModal /> : <AipSupplementsModal />}
        {isMobile ? <MobileAirspaceNotamsModal /> : <AirspaceNotamsModal />}
        {isMobile && activeAirport && (viewMode === 'TERMINAL' || pitch > 0) && (
          <MobileTerminalDashboard icaoCode={activeAirport} />
        )}
      </Suspense>
    </div>
  );
}
