import {
  Building2,
  Map as MapIcon,
  Layers,
  Compass,
  Plus,
  Minus,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useMapStore } from '../../../store/useMapStore';

/**
 * Right-center controls:
 *  - Seamless Floating Vertical Pill Map Controller (visible in enroute 2D view only)
 *  - 2D/3D toggle cube (terminal/active airport view only)
 *  - Branding badge
 */
export default function ViewToggle() {
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
      className={`absolute pointer-events-auto transition-all duration-500 ${
        isEnroute2D ? 'top-1/2 right-6 -translate-y-1/2' : 'bottom-6 right-6'
      }`}
    >
      {/* Seamless Floating Vertical Pill Map Controller */}
      {isEnroute2D && (
        <div
          className={`flex flex-col items-center view-toggle-pill-container p-2 shadow-2xl gap-4 w-12 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            selectedFeature
              ? 'translate-x-[200%] opacity-0 pointer-events-none'
              : 'translate-x-0 opacity-100'
          }`}
        >
          {/* Top Cap */}
          <div className="text-slate-400 dark:text-zinc-500/50 pt-1 pb-2">
            <ChevronUp size={16} strokeWidth={3} />
          </div>

          {/* Base Map Thumbnail Cycle Button */}
          <div className="relative group">
            <button
              type="button"
              onClick={cycleMapStyle}
              title="Change Base Map"
              style={getMapThumbnailStyle()}
              className={`w-9 h-9 rounded-[10px] border-2 border-[var(--accent-cyan)] overflow-hidden relative shadow-md hover:scale-105 transition-transform focus:outline-none flex items-center justify-center ${getStyleBg()}`}
            />
          </div>

          {/* ERC Raster Chart Overlay Toggle */}
          <button
            type="button"
            onClick={() => {
              toggleLayer('ercMap');
              if (!activeLayers.ercMap && viewState.zoom < 7) {
                setViewState({ ...viewState, zoom: 7.5, transitionDuration: 1500 });
              }
            }}
            title="Toggle Enroute Chart"
            className={`flex items-center justify-center w-9 h-9 rounded-full transition duration-300 focus:outline-none ${
              activeLayers.ercMap
                ? 'bg-emerald-500/20 text-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.2)] dark:text-emerald-400'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-900/[0.08] dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.08]'
            }`}
          >
            <MapIcon size={18} strokeWidth={2} />
          </button>

          {/* Compass / Recenter to North */}
          <button
            type="button"
            onClick={() =>
              setViewState({
                ...viewState,
                bearing: 0,
                transitionDuration: 500,
                transitionType: 'LINEAR',
              })
            }
            title="Recenter to North"
            className="flex items-center justify-center w-9 h-9 rounded-full text-slate-500 dark:text-zinc-400 hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan-opacity-10)] transition duration-300 focus:outline-none"
          >
            <Compass
              size={20}
              strokeWidth={2}
              style={{ '--bearing': `${-viewState.bearing}deg` } as React.CSSProperties}
              className="transition-transform duration-300 ease-out view-toggle-compass"
            />
          </button>

          {/* Divider */}
          <div className="w-6 h-[1px] bg-slate-300 dark:bg-zinc-600/30 my-1" />

          {/* Zoom Section */}
          <div className="flex flex-col items-center gap-2">
            {/* Zoom In */}
            <button
              type="button"
              onClick={() =>
                setViewState({
                  ...viewState,
                  zoom: Math.min(viewState.zoom + 1, 20),
                  transitionDuration: 300,
                  transitionType: 'LINEAR',
                })
              }
              title="Zoom In"
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-500 dark:text-zinc-400 hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan-opacity-10)] transition duration-300 focus:outline-none"
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>

            {/* Vertical Smooth Zoom Slider */}
            <div className="relative w-8 h-32 flex items-center justify-center py-2">
              <input
                type="range"
                min="1"
                max="20"
                step="0.01"
                aria-label="Zoom Level"
                value={viewState.zoom}
                onChange={(e) =>
                  setViewState({
                    ...viewState,
                    zoom: parseFloat(e.target.value),
                    transitionDuration: 0,
                  })
                }
                className="absolute w-28 h-1.5 bg-slate-300 dark:bg-zinc-600/50 rounded-full appearance-none cursor-pointer outline-none hover:bg-slate-400 dark:hover:bg-zinc-500/50 transition-colors [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[var(--accent-cyan)] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:hover:scale-125 [&::-webkit-slider-thumb]:transition-transform view-toggle-zoom-slider"
              />
            </div>

            {/* Zoom Out */}
            <button
              type="button"
              onClick={() =>
                setViewState({
                  ...viewState,
                  zoom: Math.max(viewState.zoom - 1, 1),
                  transitionDuration: 300,
                  transitionType: 'LINEAR',
                })
              }
              title="Zoom Out"
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-500 dark:text-zinc-400 hover:text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan-opacity-10)] transition duration-300 focus:outline-none"
            >
              <Minus size={18} strokeWidth={2.5} />
            </button>
          </div>

          {/* Bottom Cap */}
          <div className="text-slate-400 dark:text-zinc-500/50 pt-2 pb-1">
            <ChevronDown size={16} strokeWidth={3} />
          </div>
        </div>
      )}

      {/* 2D/3D Toggle Cube (only appears in 3D terminal view) */}
      {(activeAirport || viewMode === 'TERMINAL') && (
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => {
              setViewState({
                ...viewState,
                pitch: viewState.pitch > 0 ? 0 : 60,
                transitionDuration: 1000,
              });
            }}
            className="relative w-12 h-12 group focus:outline-none transition-transform hover:scale-105 duration-200 view-toggle-cube-container"
            title="Toggle View Mode"
          >
            <div
              className={`w-full h-full view-toggle-cube ${viewState.pitch > 0 ? 'pitch-active' : ''}`}
            >
              {/* 2D Face (Front) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--glass-bg-heavy)] backdrop-blur-xl border border-[var(--glass-border)] rounded-xl shadow-xl transition-all duration-300 group-hover:border-[var(--glass-border-highlight)] view-toggle-face-2d">
                <Layers
                  className="text-slate-600 group-hover:text-slate-900 dark:text-zinc-300 dark:group-hover:text-white transition-colors"
                  size={20}
                  strokeWidth={2}
                />
                <span className="text-[9px] font-bold text-slate-500 dark:text-zinc-500 tracking-widest mt-0.5">
                  2D
                </span>
              </div>

              {/* 3D Face (Top) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--glass-bg-heavy)] backdrop-blur-xl border border-[var(--accent-cyan)] rounded-xl transition-all duration-300 shadow-[var(--glass-shadow)] view-toggle-face-3d">
                <Building2
                  className="text-[var(--accent-cyan)] group-hover:scale-110 transition-transform duration-300"
                  size={20}
                  strokeWidth={2}
                />
                <span className="text-[9px] font-bold text-teal-700 dark:text-cyan-200 tracking-widest mt-0.5">
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
          <div className="flex flex-col items-end select-none pointer-events-none mt-1">
            <div className="text-slate-800 dark:text-zinc-200 font-bold tracking-[0.4em] text-[10px] uppercase opacity-90">
              Aero Plan
            </div>
            <div className="text-slate-500 dark:text-zinc-500 tracking-[0.2em] text-[8px] mt-1 uppercase font-medium">
              v0.1.0-alpha
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
