import { Building2, Map as MapIcon, Layers } from 'lucide-react';
import { useMapStore } from '../../../store/useMapStore';

/**
 * Bottom-right controls:
 *  - WAC map layer toggle (enroute only)
 *  - 2D/3D cube toggle (terminal only)
 *  - Branding badge
 */
export default function ViewToggle() {
  const { viewMode, viewState, setViewState, activeAirport, activeLayers, toggleLayer } =
    useMapStore();

  return (
    <div className="absolute bottom-6 right-6 flex flex-col items-end gap-4 pointer-events-auto">
      {/* WAC Map Layer Toggle */}
      {viewMode === 'ENROUTE' && (
        <button
          onClick={() => {
            toggleLayer('wacMap');
            if (!activeLayers.wacMap && viewState.zoom < 7) {
              setViewState({ ...viewState, zoom: 7.5, transitionDuration: 1500 });
            }
          }}
          title="Toggle World Aeronautical Chart"
          className={`flex items-center justify-center w-12 h-12 rounded-full backdrop-blur-2xl shadow-xl transition-all duration-300 focus:outline-none ${
            activeLayers.wacMap
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
              : 'bg-zinc-950/40 border border-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 opacity-80'
          }`}
        >
          <Layers size={20} strokeWidth={2} />
        </button>
      )}

      {/* 2D/3D Toggle Cube */}
      {(activeAirport || viewMode === 'TERMINAL') && (
        <button
          onClick={() => {
            setViewState({
              ...viewState,
              pitch: viewState.pitch > 0 ? 0 : 60,
              transitionDuration: 1000,
            });
          }}
          className="relative w-12 h-12 group focus:outline-none"
          style={{ perspective: '1000px' }}
          title="Toggle View Mode"
        >
          <div
            className="w-full h-full transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
            style={{
              transformStyle: 'preserve-3d',
              transform: viewState.pitch > 0 ? 'rotateX(-90deg) scale(0.95)' : 'rotateX(0deg)',
            }}
          >
            {/* 2D Face (Front) */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 border border-zinc-700/80 shadow-xl"
              style={{ transform: 'translateZ(24px)' }}
            >
              <MapIcon
                className="text-zinc-200 group-hover:text-white transition-colors"
                size={20}
                strokeWidth={2}
              />
              <span className="text-[10px] font-bold text-zinc-500 tracking-widest mt-0.5">2D</span>
            </div>

            {/* 3D Face (Top) */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-600 border border-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
              style={{ transform: 'rotateX(90deg) translateZ(24px)' }}
            >
              <Building2
                className="text-white group-hover:scale-110 transition-transform"
                size={20}
                strokeWidth={2}
              />
              <span className="text-[10px] font-bold text-indigo-100 tracking-widest mt-0.5">
                3D
              </span>
            </div>

            {/* Cube Sides */}
            <div
              className="absolute inset-0 bg-zinc-950 border border-zinc-800/50"
              style={{ transform: 'rotateX(-90deg) translateZ(24px)' }}
            />
            <div
              className="absolute inset-0 bg-zinc-900 border border-zinc-800/50"
              style={{ transform: 'rotateY(90deg) translateZ(24px)' }}
            />
            <div
              className="absolute inset-0 bg-zinc-900 border border-zinc-800/50"
              style={{ transform: 'rotateY(-90deg) translateZ(24px)' }}
            />
            <div
              className="absolute inset-0 bg-zinc-950 border border-zinc-800/50"
              style={{ transform: 'rotateY(180deg) translateZ(24px)' }}
            />
          </div>
        </button>
      )}

      {/* Branding */}
      <div className="flex flex-col items-end select-none pointer-events-none mt-1">
        <div className="text-zinc-200 font-bold tracking-[0.4em] text-[10px] uppercase opacity-90">
          Aero Plan
        </div>
        <div className="text-zinc-500 tracking-[0.2em] text-[8px] mt-1 uppercase font-medium">
          v0.1.0-alpha
        </div>
      </div>
    </div>
  );
}
