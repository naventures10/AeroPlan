import { Building2, Map as MapIcon, Layers, Compass, Plus, Minus } from 'lucide-react';
import { useMapStore } from '../../../../store/useMapStore';
import './MobileViewToggle.css';

/**
 * Mobile-specific View Toggle Controls:
 * - Floating vertical control panel (visible in enroute 2D view only, without zoom slider)
 * - 2D/3D toggle cube (terminal/active airport view only)
 * - Compact branding badge
 */
export default function MobileViewToggle() {
  const {
    viewMode,
    viewState,
    setViewState,
    activeAirport,
    activeLayers,
    toggleLayer,
    mapStyle,
    setMapStyle,
    selectedFeature,
  } = useMapStore();

  const isEnroute2D = viewMode === 'ENROUTE' && !activeAirport;

  // Cycle through map styles
  const cycleMapStyle = () => {
    if (mapStyle === 'dark') setMapStyle('light');
    else if (mapStyle === 'light') setMapStyle('hybrid');
    else setMapStyle('dark');
  };

  const getStyleBg = () => {
    if (mapStyle === 'dark') return 'bg-zinc-800';
    if (mapStyle === 'light') return 'bg-zinc-100';
    return 'bg-[#0f172a]';
  };

  // Get public base map tile texture preview to bypass API key restrictions
  const getMapThumbnailStyle = () => {
    const isE2E = import.meta.env.VITE_E2E === 'true';

    if (isE2E) {
      return {}; // Empty style for E2E tests
    }

    let url = 'https://basemaps.cartocdn.com/dark_all/3/4/3.png'; // Dark Matter
    if (mapStyle === 'light') {
      url = 'https://basemaps.cartocdn.com/rastertiles/voyager/3/4/3.png'; // Voyager Light
    } else if (mapStyle === 'hybrid') {
      url =
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/3/4'; // ESRI Satellite
    }

    return {
      backgroundImage: `url(${url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  };

  return (
    <div
      className={`aip-mobile-view-toggle-container pointer-events-auto transition-all duration-500 ${
        isEnroute2D ? 'enroute-layout' : 'terminal-layout'
      }`}
    >
      {/* Floating Control Cluster for 2D Enroute Mode */}
      {isEnroute2D && (
        <div
          data-testid="mobile-view-toggle-pill"
          className={`aip-mobile-view-toggle-pill w-11 p-1 shadow-2xl gap-2.5 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            selectedFeature
              ? 'translate-x-[200%] opacity-0 pointer-events-none'
              : 'translate-x-0 opacity-100'
          }`}
        >
          {/* Base Map Thumbnail Cycle Button */}
          <button
            type="button"
            data-testid="mobile-map-style-toggle"
            onClick={cycleMapStyle}
            title="Change Base Map"
            style={getMapThumbnailStyle()}
            className={`w-9 h-9 rounded-[10px] border-2 border-[var(--accent-cyan)] overflow-hidden relative shadow-md hover:scale-105 active:scale-95 transition-transform focus:outline-none flex items-center justify-center ${getStyleBg()}`}
          />

          {/* ERC Raster Chart Overlay Toggle */}
          <button
            type="button"
            data-testid="mobile-layer-toggle-ercMap"
            onClick={() => {
              toggleLayer('ercMap');
              if (!activeLayers.ercMap && viewState.zoom < 7) {
                setViewState({ ...viewState, zoom: 7.5, transitionDuration: 1500 });
              }
            }}
            title="Toggle Enroute Chart"
            className={`flex items-center justify-center w-9 h-9 rounded-full transition duration-300 focus:outline-none active:scale-90 ${
              activeLayers.ercMap
                ? 'bg-emerald-500/20 text-emerald-600 shadow-[0_0_12px_color-mix(in_srgb,var(--status-success)_20%,transparent)] dark:text-emerald-400'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-slate-900/[0.08]'
            }`}
          >
            <MapIcon size={18} strokeWidth={2} />
          </button>

          {/* Compass / Recenter to North */}
          <button
            type="button"
            data-testid="mobile-compass-toggle"
            onClick={() =>
              setViewState({
                ...viewState,
                bearing: 0,
                transitionDuration: 500,
                transitionType: 'LINEAR',
              })
            }
            title="Recenter to North"
            className="flex items-center justify-center w-9 h-9 rounded-full text-on-surface-variant hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan-opacity-10)] active:scale-90 transition duration-300 focus:outline-none"
          >
            <Compass
              size={20}
              strokeWidth={2}
              style={{ '--bearing': `${-viewState.bearing}deg` } as React.CSSProperties}
              className="transition-transform duration-300 ease-out view-toggle-compass"
            />
          </button>

          {/* Divider */}
          <div className="w-6 h-[1px] bg-outline-variant/50 my-0.5" />

          {/* Zoom Section (Buttons only) */}
          <div className="flex flex-col items-center gap-2">
            {/* Zoom In */}
            <button
              type="button"
              data-testid="mobile-zoom-in"
              onClick={() =>
                setViewState({
                  ...viewState,
                  zoom: Math.min(viewState.zoom + 1, 20),
                  transitionDuration: 300,
                  transitionType: 'LINEAR',
                })
              }
              title="Zoom In"
              className="flex items-center justify-center w-8 h-8 rounded-full text-on-surface-variant hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan-opacity-10)] active:scale-90 transition duration-300 focus:outline-none"
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>

            {/* Zoom Out */}
            <button
              type="button"
              data-testid="mobile-zoom-out"
              onClick={() =>
                setViewState({
                  ...viewState,
                  zoom: Math.max(viewState.zoom - 1, 1),
                  transitionDuration: 300,
                  transitionType: 'LINEAR',
                })
              }
              title="Zoom Out"
              className="flex items-center justify-center w-8 h-8 rounded-full text-on-surface-variant hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan-opacity-10)] active:scale-90 transition duration-300 focus:outline-none"
            >
              <Minus size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      {/* 2D/3D Toggle Cube (only appears in Terminal/Active Airport view) */}
      {(activeAirport || viewMode === 'TERMINAL') && (
        <div className="flex flex-col items-end gap-3" data-testid="mobile-view-toggle-terminal">
          <button
            type="button"
            data-testid="mobile-pitch-toggle"
            onClick={() => {
              setViewState({
                ...viewState,
                pitch: viewState.pitch > 0 ? 0 : 60,
                transitionDuration: 1000,
              });
            }}
            className="relative w-10 h-10 group focus:outline-none transition-transform active:scale-95 duration-200 view-toggle-cube-container"
            title="Toggle View Mode"
          >
            <div
              className={`w-full h-full view-toggle-cube ${viewState.pitch > 0 ? 'pitch-active' : ''}`}
            >
              {/* 2D Face (Front) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--glass-bg-heavy)] backdrop-blur-xl border border-[var(--glass-border)] rounded-xl shadow-xl transition-all duration-300 group-hover:border-[var(--glass-border-highlight)] view-toggle-face-2d">
                <Layers
                  className="text-on-surface-variant group-hover:text-on-surface dark:group-hover:text-white transition-colors"
                  size={18}
                  strokeWidth={2}
                />
                <span className="text-[8px] font-bold text-on-surface-variant tracking-widest mt-0.5">
                  2D
                </span>
              </div>

              {/* 3D Face (Top) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--glass-bg-heavy)] backdrop-blur-xl border border-[var(--accent-cyan)] rounded-xl transition-all duration-300 shadow-[var(--glass-shadow)] view-toggle-face-3d">
                <Building2
                  className="text-[var(--accent-cyan)] group-hover:scale-110 transition-transform duration-300"
                  size={18}
                  strokeWidth={2}
                />
                <span className="text-[8px] font-bold text-teal-800 dark:text-cyan-200 tracking-widest mt-0.5">
                  3D
                </span>
              </div>

              {/* Cube Sides (Hollow Glass Panels) */}
              <div className="absolute inset-0 bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] rounded-xl opacity-30 view-toggle-side-top" />
              <div className="absolute inset-0 bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] rounded-xl opacity-30 view-toggle-side-right" />
              <div className="absolute inset-0 bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] rounded-xl opacity-30 view-toggle-side-left" />
              <div className="absolute inset-0 bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] rounded-xl opacity-30 view-toggle-side-back" />
            </div>
          </button>

          {/* Branding */}
          <div className="flex flex-col items-end select-none pointer-events-none mt-0.5">
            <div className="text-on-surface font-bold tracking-[0.4em] text-[10px] uppercase opacity-90">
              Aero Plan
            </div>
            <div className="text-on-surface-variant tracking-[0.2em] text-[8px] mt-1 uppercase font-medium">
              v0.1.0-alpha
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
