import { useState, useRef, useEffect } from 'react';
import { Building2, Map as MapIcon, Layers, MapPin, Navigation } from 'lucide-react';
import { useMapStore } from '../../../store/useMapStore';

/**
 * Bottom-right controls:
 *  - Map layer toggle menu (WAC / ERC)
 *  - 2D/3D cube toggle (terminal only)
 *  - Branding badge
 */
export default function ViewToggle() {
  const { viewMode, viewState, setViewState, activeAirport, activeLayers, toggleLayer } =
    useMapStore();

  const [isMapMenuOpen, setIsMapMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMapMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="absolute bottom-6 right-6 flex flex-col items-end gap-4 pointer-events-auto">
      {/* Map Layer Menu */}
      {viewMode === 'ENROUTE' && (
        <div className="relative flex flex-col items-end" ref={menuRef}>
          {/* Popover Menu */}
          <div
            className={`absolute bottom-16 right-0 flex flex-col gap-2 transition duration-300 origin-bottom-right ${
              isMapMenuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
            }`}
          >
            {/* WAC Option */}
            <button
              onClick={() => {
                toggleLayer('wacMap');
                if (!activeLayers.wacMap && viewState.zoom < 7) {
                  setViewState({ ...viewState, zoom: 7.5, transitionDuration: 1500 });
                }
              }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-xl shadow-xl transition duration-300 whitespace-nowrap border ${
                activeLayers.wacMap
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-[var(--glass-bg-heavy)] text-zinc-400 border-[var(--glass-border)] hover:bg-white/[0.04] hover:text-zinc-200'
              }`}
            >
              <MapPin size={16} />
              <span className="text-xs font-semibold tracking-wide">World Aeronautical Chart</span>
            </button>

            {/* ERC Option */}
            <button
              onClick={() => {
                toggleLayer('ercMap');
                if (!activeLayers.ercMap && viewState.zoom < 7) {
                  setViewState({ ...viewState, zoom: 7.5, transitionDuration: 1500 });
                }
              }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-xl shadow-xl transition duration-300 whitespace-nowrap border ${
                activeLayers.ercMap
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-[var(--glass-bg-heavy)] text-zinc-400 border-[var(--glass-border)] hover:bg-white/[0.04] hover:text-zinc-200'
              }`}
            >
              <Navigation size={16} />
              <span className="text-xs font-semibold tracking-wide">Enroute Chart</span>
            </button>
          </div>

          {/* Trigger Button */}
          <button
            onClick={() => setIsMapMenuOpen(!isMapMenuOpen)}
            title="Map Overlays"
            className={`flex items-center justify-center w-12 h-12 rounded-full backdrop-blur-xl shadow-xl transition duration-300 focus:outline-none border ${
              activeLayers.wacMap || activeLayers.ercMap
                ? 'bg-[var(--accent-cyan-glow)] text-[var(--accent-cyan)] border-[var(--accent-cyan)] shadow-[0_0_15px_var(--accent-cyan-glow)]'
                : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] opacity-90'
            }`}
          >
            <Layers size={20} strokeWidth={2} />
          </button>
        </div>
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
          className="relative w-12 h-12 group focus:outline-none transition-transform hover:scale-105 duration-200"
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
              className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--glass-bg-heavy)] backdrop-blur-xl border border-[var(--glass-border)] rounded-xl shadow-xl transition-all duration-300 group-hover:border-[var(--glass-border-highlight)]"
              style={{ transform: 'translateZ(24px)' }}
            >
              <MapIcon
                className="text-zinc-300 group-hover:text-white transition-colors"
                size={20}
                strokeWidth={2}
              />
              <span className="text-[9px] font-bold text-zinc-500 tracking-widest mt-0.5">2D</span>
            </div>

            {/* 3D Face (Top) */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--glass-bg-heavy)] backdrop-blur-xl border border-[var(--accent-cyan)] rounded-xl transition-all duration-300 shadow-[var(--glass-shadow)]"
              style={{
                transform: 'rotateX(90deg) translateZ(24px)',
                backgroundColor: 'rgba(34, 211, 238, 0.08)',
              }}
            >
              <Building2
                className="text-[var(--accent-cyan)] group-hover:scale-110 transition-transform duration-300"
                size={20}
                strokeWidth={2}
              />
              <span className="text-[9px] font-bold text-cyan-200 tracking-widest mt-0.5">3D</span>
            </div>

            {/* Cube Sides (Hollow Glass Panels) */}
            <div
              className="absolute inset-0 bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] rounded-xl opacity-30"
              style={{ transform: 'rotateX(-90deg) translateZ(24px)' }}
            />
            <div
              className="absolute inset-0 bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] rounded-xl opacity-30"
              style={{ transform: 'rotateY(90deg) translateZ(24px)' }}
            />
            <div
              className="absolute inset-0 bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] rounded-xl opacity-30"
              style={{ transform: 'rotateY(-90deg) translateZ(24px)' }}
            />
            <div
              className="absolute inset-0 bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] rounded-xl opacity-30"
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
