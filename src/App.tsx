import React, { useState } from 'react';
import DeckGL from '@deck.gl/react';
import Map, { NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from './store/useMapStore';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const MAP_STYLE = `https://api.maptiler.com/maps/basic-v2-dark/style.json?key=${MAPTILER_KEY}`;

export default function App() {
  // Hook in our new activeAirport state and setter
  const { viewState, setViewState, toggle3DMode, flyToLocation, is3DMode, activeAirport, setActiveAirport, setIs3DMode } = useMapStore();
  const [searchInput, setSearchInput] = useState('');

  const layers: any[] = [];

  const handleSearch = () => {
    const code = searchInput.trim().toUpperCase();
    if (!code) return;

    if (code === 'VOMM') {
      flyToLocation(80.1636, 12.9822, 14, 45);
      setActiveAirport(code); // Tell the app VOMM is active
    } else if (code === 'VIDP') {
      flyToLocation(77.0878, 28.5562, 14, 45);
      setActiveAirport(code); // Tell the app VIDP is active
    } else {
      alert(`Simulation: Would fetch coordinates for ${code}.`);
      setActiveAirport(null); // Reset if not found
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-900 relative font-sans">

      <DeckGL
        initialViewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={({ viewState }: any) => {
          // THE FIX: If the user zooms out past level 10
          if (viewState.zoom < 10) {
            if (activeAirport) setActiveAirport(null); // Remove the bottom-right button

            if (viewState.pitch > 0) {
              viewState.pitch = 0; // Instantly flatten the camera to 2D
              setIs3DMode(false);  // Silently update the UI state
            }
          } else {
            // Auto-sync the UI if the user manually right-click-drags the pitch to flat
            if (viewState.pitch === 0 && is3DMode) setIs3DMode(false);
            if (viewState.pitch > 0 && !is3DMode) setIs3DMode(true);
          }

          setViewState(viewState);
        }}
      >
        <Map mapStyle={MAP_STYLE} reuseMaps>
          <NavigationControl position="top-right" />
        </Map>
      </DeckGL>

      {/* --- UI OVERLAYS --- */}

      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-lg border border-gray-200 flex items-center gap-4">
          <input
            type="text"
            placeholder="ENTER ICAO (e.g. VOMM)"
            className="bg-transparent border-none outline-none text-gray-800 font-semibold text-sm w-44 placeholder-gray-400 uppercase"
            maxLength={4}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button onClick={handleSearch} className="w-7 h-7 bg-blue-600 hover:bg-blue-700 transition-colors rounded-full flex items-center justify-center text-white shadow-md">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>
        </div>
      </div>

      {/* Left Aviation Toolbar - 3D Button Removed */}
      <div className="absolute top-1/2 left-6 transform -translate-y-1/2 z-10 bg-white/90 backdrop-blur-md rounded-full shadow-lg p-3 flex flex-col gap-4 border border-gray-200">
        <button className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex justify-center items-center shadow-sm" title="Waypoints">🔺</button>
        <button className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex justify-center items-center shadow-sm" title="VORs">⬢</button>
        <button className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex justify-center items-center shadow-sm" title="NDBs">⭕</button>
      </div>

      {/* Bottom Right Area (Dynamic 3D Button + Logo) */}
      <div className="absolute bottom-6 right-6 z-10 flex flex-col items-end gap-4">

        {/* CONDITIONAL RENDERING: Shows if an airport is active OR we are in 3D mode */}
        {(activeAirport || is3DMode) && (
          <button
            onClick={toggle3DMode}
            className={`px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg transition-all font-bold text-sm border ${is3DMode
              ? 'bg-white text-blue-600 border-white hover:bg-gray-50'
              : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              }`}
          >
            <span className="text-lg">{is3DMode ? '🗺️' : '🧊'}</span>
            {is3DMode ? 'BACK TO 2D OVERHEAD' : `VIEW ${activeAirport} 3D TERRAIN`}
          </button>
        )}

        <div className="flex flex-col items-end select-none pointer-events-none mt-2">
          <div className="text-blue-400 font-bold tracking-widest text-sm drop-shadow-md">AERO PLAN</div>
          <div className="text-gray-400 text-xs mt-1 drop-shadow-md">v0.1 Prototype</div>
        </div>
      </div>

    </div>
  );
}