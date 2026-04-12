import { useMapStore } from './store/useMapStore';
import { useSearch } from './hooks/useSearch';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAerodromeData } from './hooks/useAerodromeData';

import { lazy, Suspense } from 'react';
import GlobalLoader from './components/GlobalLoader';

const MapView = lazy(() => import('./features/map/MapView'));
const SearchBar = lazy(() => import('./features/map/controls/SearchBar'));
const LayerToolbar = lazy(() => import('./features/map/controls/LayerToolbar'));
const ViewToggle = lazy(() => import('./features/map/controls/ViewToggle'));

const AerodromeInfoDropdown = lazy(() => import('./features/aip/AerodromeInfoDropdown'));
const AerodromeChartViewer = lazy(() => import('./features/aip/AerodromeChartViewer'));
const SectionModal = lazy(() => import('./features/aip/SectionModal'));
const TerminalDashboard = lazy(() => import('./features/terminal/TerminalDashboard'));


/**
 * Root application shell.
 *
 * All domain logic has been extracted into custom hooks and feature
 * components. This component is a pure composition layer.
 */
export default function App() {
  const { viewMode, activeAirport, viewState } = useMapStore();

  // ── Hooks ──────────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-900 relative font-sans">
      {/* Map (Primary Chunk) */}
      <Suspense fallback={<GlobalLoader />}>
        <MapView
          aerodromes={aerodromes}
          onAerodromeClick={handleAerodromeClick}
        />
      </Suspense>

      {/* Overlay Layer (Secondary Chunks) */}
      <Suspense fallback={null}>
        <div className="absolute inset-0 pointer-events-none z-10">
        {/* AIP Section Dropdown — TERMINAL view only */}
        {(activeAirport || viewMode === 'TERMINAL') && (
          <div className="absolute top-6 left-6 pointer-events-auto z-50">
            <AerodromeInfoDropdown
              onSectionSelect={handleSectionSelect}
              activeAirport={activeAirport}
            />
          </div>
        )}

        {/* Terminal Dashboard — TERMINAL view only */}
        {activeAirport && (viewMode === 'TERMINAL' || viewState.pitch > 0) && (
          <div className="absolute top-6 right-6 pointer-events-none z-40">
            <TerminalDashboard icaoCode={activeAirport} />
          </div>
        )}

        {/* Aerodrome Charts Carousel — visible when airport active */}
        {activeAirport && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-auto z-40 scale-110 origin-bottom">
            <AerodromeChartViewer icaoCode={activeAirport} />
          </div>
        )}

        {/* Search Bar — ENROUTE view only */}
        {viewMode === 'ENROUTE' && <SearchBar {...search} />}

        {/* Layer Toolbar — ENROUTE view only */}
        {viewMode === 'ENROUTE' && <LayerToolbar />}

          {/* View Toggle + Branding */}
          <ViewToggle />
        </div>
      </Suspense>

      {/* AIP Section Modal (Isolated Chunk) */}
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