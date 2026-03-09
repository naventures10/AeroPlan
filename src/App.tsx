import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from "@heroui/react";
import { Search, Building2, Map as MapIcon, Navigation, Radio, Target, MapPin, X } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import DeckGL from '@deck.gl/react';
import { MVTLayer } from '@deck.gl/geo-layers';
import { GeoJsonLayer } from '@deck.gl/layers';
import { AmbientLight, DirectionalLight, LightingEffect } from '@deck.gl/core';
import Map, { NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from './store/useMapStore';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const MAP_STYLE = `https://api.maptiler.com/maps/basic-v2-dark/style.json?key=${MAPTILER_KEY}`;

const tooltipStyle = {
  backgroundColor: 'rgba(9,9,11,0.65)',
  border: '1px solid rgba(39,39,42,0.7)',
  color: 'white',
  borderRadius: '16px',
  padding: '12px 16px',
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  fontFamily: 'system-ui, sans-serif',
};

const ambientLight = new AmbientLight({ color: [255, 255, 255], intensity: 0.8 });
const dirLight = new DirectionalLight({ color: [255, 255, 255], intensity: 2.0, direction: [-3, -4, -1] });
const lightingEffect = new LightingEffect({ ambientLight, dirLight });

const OBSTACLE_NAMES = ['TREE', 'BUILDING', 'MAST', 'POLE', 'TOWER', 'ANTENNA', 'ELECTRICAL', 'OBSTACLE', 'OTHER'];

const getFeatureColor = (name: string, category: string): [number, number, number] => {
  const s = `${name} ${category}`.toUpperCase();
  if (s.includes('TREE')) return [34, 197, 94];
  if (s.includes('TOWER')) return [220, 38, 38];
  if (s.includes('MAST') || s.includes('ANTENNA') || s.includes('POLE')) return [234, 179, 8];
  if (s.includes('BUILDING')) return [148, 163, 184];
  if (s.includes('ELECTRICAL')) return [168, 85, 247];
  return [249, 115, 22];
};

const checkObstacle = (name: string, cat: string) =>
  OBSTACLE_NAMES.some(c => `${name} ${cat}`.toUpperCase().includes(c));

export default function App() {
  const {
    flyToLocation,
    viewMode,
    setViewMode,
    activeAirport,
    setActiveAirport,
    toggleViewMode,
    returnToEnroute,
    activeAerodromeMetadata,
    setActiveAerodromeMetadata
  } = useMapStore();

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape' && (viewMode === 'TERMINAL' || activeAirport)) {
        returnToEnroute();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [viewMode, activeAirport, returnToEnroute]);

  // === FLY-TO TARGET & VIEW STATE ===
  // We use a completely controlled viewState approach now.
  const { viewState, setViewState } = useMapStore();

  // === VIEW CHANGE HANDLER ===
  const onViewStateChange = useCallback(({ viewState: vs, interactionState }: any) => {
    // If the user manually zooms out past level 10, snap back to 2D Enroute.
    // interactionState.isZooming is true when the user is scrolling the mouse wheel or pinching.
    // This prevents our automated flyToLocation from being cancelled mid-flight.
    if ((interactionState?.isZooming || interactionState?.isPanning) && vs.zoom < 10) {
      if (activeAirport) setActiveAirport(null);
      if (viewMode === 'TERMINAL' || vs.pitch > 0) {
        setViewMode('ENROUTE');
        const nextVs = { ...vs, pitch: 0 };
        setViewState(nextVs);
        return nextVs;
      }
    } else {
      setTimeout(() => {
        if (vs.pitch === 0 && viewMode === 'TERMINAL') setViewMode('ENROUTE');
        if (vs.pitch > 0 && viewMode === 'ENROUTE') setViewMode('TERMINAL');
      }, 0);
    }

    setViewState(vs);
    return vs;
  }, [activeAirport, viewMode, setActiveAirport, setViewMode, setViewState]);

  // === DATA FETCHING ===
  const [aerodromes, setAerodromes] = useState<any>(null);
  const [searchInput, setSearchInput] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/aerodromes')
      .then(res => res.json())
      .then(data => setAerodromes(data))
      .catch(err => console.error("Failed to fetch aerodromes", err));
  }, []);

  const handleAerodromeClick = useCallback((icao: string, coords: [number, number]) => {
    setActiveAirport(icao);
    flyToLocation(coords[0], coords[1], 15, 60);

    // Fetch AIP metadata for tooltip
    fetch(`/api/aerodromes/${icao}/metadata`)
      .then(res => res.json())
      .then(data => {
        if (data && data.aip_document) {
          setActiveAerodromeMetadata(data.aip_document);
        } else if (data && data.data) {
          setActiveAerodromeMetadata(data);
        } else {
          setActiveAerodromeMetadata(null);
        }
      })
      .catch(err => console.error("Failed to fetch metadata", err));
  }, [flyToLocation, setActiveAirport, setActiveAerodromeMetadata]);

  // Derived suggestions
  const suggestions = useMemo(() => {
    if (!searchInput.trim() || !aerodromes?.features) return [];
    const query = searchInput.trim().toUpperCase();
    return aerodromes.features
      .filter((f: any) => {
        const p = f.properties;
        const nameMatch = p.name?.toUpperCase().includes(query);
        const icaoMatch = p.icao_code?.toUpperCase().includes(query);
        return nameMatch || icaoMatch;
      })
      .slice(0, 5); // top 5 suggestions
  }, [searchInput, aerodromes]);

  useEffect(() => {
    setSearchSelectedIndex(-1);
  }, [searchInput]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchSelectedIndex >= 0 && searchSelectedIndex < suggestions.length) {
        const item = suggestions[searchSelectedIndex];
        handleAerodromeClick(item.properties.icao_code, item.geometry.coordinates);
        setIsSearchFocused(false);
        setSearchInput('');
        searchInputRef.current?.blur();
      } else {
        handleSearchSubmit();
      }
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
      searchInputRef.current?.blur();
    }
  };

  const handleSearchSubmit = useCallback(() => {
    const code = searchInput.trim().toUpperCase();
    if (!code || !aerodromes) return;
    const feature = aerodromes.features.find((f: any) => f.properties.icao_code === code);
    if (feature) {
      handleAerodromeClick(code, feature.geometry.coordinates);
      setIsSearchFocused(false);
      setSearchInput('');
      searchInputRef.current?.blur();
    }
  }, [searchInput, aerodromes, handleAerodromeClick]);

  // === LAYERS ===
  const aerodromesLayer = new GeoJsonLayer({
    id: 'aerodromes-layer',
    data: aerodromes,
    visible: viewMode === 'ENROUTE',
    pickable: true,
    pointType: 'circle',
    getPointRadius: 8000, // Large enough to see when zoomed out
    getFillColor: [99, 102, 241, 230],
    getLineColor: [255, 255, 255, 255],
    lineWidthMinPixels: 2,
    onClick: (info: any) => {
      if (info.object) {
        handleAerodromeClick(info.object.properties.icao_code, info.object.geometry.coordinates);
      }
    }
  });

  const obstacleLayer = new MVTLayer({
    id: 'spatial-features',
    data: '/tiles/spatial_features/{z}/{x}/{y}',
    visible: viewMode === 'TERMINAL',
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 120],
    extruded: viewMode === 'TERMINAL',
    wireframe: viewMode === 'TERMINAL',
    pointType: 'circle',
    getElevation: (f: any) => {
      if (viewMode !== 'TERMINAL') return 0;
      const h = parseFloat(f.properties?.height || f.properties?.elevation_m);
      return !isNaN(h) && h > 0 ? h : 20;
    },
    getFillColor: (f: any) => {
      const name = f.properties?.name || f.properties?.feature_name || '';
      const cat = (f.properties?.category || f.properties?.feature_category || '').toUpperCase();

      if (cat.includes('ARP')) return [250, 204, 21, 255]; // Bright Yellow
      if (cat.includes('HELIPAD')) return [14, 165, 233, 220]; // Sky Blue
      if (cat.includes('NAV') || cat.includes('RADIO')) return [168, 85, 247, 220]; // Purple
      if (cat.includes('PARKING') || cat.includes('TAXIWAY') || cat.includes('RUNWAY')) return [156, 163, 175, 200]; // Gray

      if (checkObstacle(name, cat)) return getFeatureColor(name, cat);

      return [99, 102, 241, 200]; // Default Indigo
    },
    getPointRadius: (f: any) => {
      const name = f.properties?.name || f.properties?.feature_name || '';
      const cat = (f.properties?.category || f.properties?.feature_category || '').toUpperCase();

      if (cat.includes('ARP')) return 80;
      if (cat.includes('HELIPAD')) return 50;
      if (cat.includes('NAV')) return 40;

      return checkObstacle(name, cat) ? 30 : 60;
    },
    pointRadiusUnits: 'meters',
    getLineColor: [255, 255, 255, 60] as [number, number, number, number],
    lineWidthMinPixels: 1,
    transitions: { getElevation: 800 },
  });

  // === TOOLTIP ===
  const getTooltip = useCallback(({ object, layer }: any) => {
    if (!object) return null;

    if (layer?.id === 'aerodromes-layer') {
      const p = object.properties ?? {};
      return {
        html: `<div style="display:flex;flex-direction:column;gap:4px;">
          <span style="font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#f4f4f5;">${p.name || p.icao_code}</span>
          <span style="color:#a1a1aa;font-size:10px;font-weight:500;">
            ICAO: <span style="color:#6366f1;font-weight:700;">${p.icao_code}</span> | ELEV: <span style="color:#6366f1;font-weight:700;">${p.elevation ?? 'N/A'}M</span>
          </span>
          <span style="color:#a1a1aa;font-size:9px;text-transform:uppercase;font-weight:600;letter-spacing:.2em;margin-top:2px;color:#10b981;">
            CLICK TO ENTER TERMINAL VIEW
          </span>
        </div>`,
        style: tooltipStyle
      };
    }

    const p = object.properties ?? {};
    const name = p.name || p.feature_name || 'FEATURE';
    const elev = p.height ?? p.elevation_m ?? p.elevation ?? null;
    const elevStr = elev != null ? Number(elev).toFixed(1) + 'M' : 'N/A';
    const category = p.category || p.feature_category || 'UNKNOWN';

    // Add minimalistic AIP document metadata if hovering over the ARP (category === 'ARP') 
    // or if we want to show generic aerodrome info when hovering over any terminal feature
    let extraInfo = '';
    if (activeAerodromeMetadata && category === 'ARP') {
      const docs = activeAerodromeMetadata.data || activeAerodromeMetadata;
      const remarks = docs.remarks || docs.remarks_and_operational_requirements || 'None';
      extraInfo = `
         <div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
           <span style="color:#a1a1aa;font-size:10px;font-weight:500;">TYPE: <span style="color:#f4f4f5;">${docs.type || 'Aerodrome'}</span></span><br/>
           <span style="color:#a1a1aa;font-size:10px;font-weight:500;max-width:200px;display:block;white-space:normal;">REMARKS: <span style="color:#f4f4f5;">${remarks}</span></span>
         </div>
       `;
    }

    return {
      html: `<div style="display:flex;flex-direction:column;gap:4px;">
        <span style="font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#f4f4f5;">${name}</span>
        <span style="color:#a1a1aa;font-size:10px;font-weight:500;">
          ELEVATION: <span style="color:#6366f1;font-weight:700;">${elevStr}</span>
        </span>
        <span style="color:#a1a1aa;font-size:9px;text-transform:uppercase;font-weight:600;letter-spacing:.2em;margin-top:2px;">
          ${category}
        </span>
        ${extraInfo}
      </div>`,
      style: tooltipStyle,
    };
  }, [activeAerodromeMetadata]);

  // === RENDER ===
  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-900 relative font-sans">
      <div className="absolute inset-0 z-0">
        <DeckGL
          viewState={viewState}
          controller={true}
          layers={[aerodromesLayer, obstacleLayer]}
          effects={[lightingEffect]}
          onViewStateChange={onViewStateChange}
          getTooltip={getTooltip}
        >
          <Map mapStyle={MAP_STYLE} reuseMaps>
            <NavigationControl position="top-right" />
          </Map>
        </DeckGL>
      </div>

      <div className="absolute inset-0 pointer-events-none z-10">

        {/* Search */}
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-[28rem] max-w-[90vw] pointer-events-auto z-50">
          <div className="relative rounded-full shadow-2xl">
            <div className="flex items-center w-full glass-morphism h-14 px-4 bg-zinc-950/40 hover:bg-zinc-950/60 focus-within:!bg-zinc-950/40 border-zinc-800/60 rounded-full transition-colors duration-300">
              <Search size={18} strokeWidth={2} className="text-zinc-400 shrink-0" />
              <input
                ref={searchInputRef}
                className="flex-1 bg-transparent border-none outline-none shadow-none text-zinc-100 font-semibold text-sm placeholder-zinc-500 uppercase tracking-[0.1em] px-3 h-full w-full"
                placeholder="SEARCH AIRPORT OR ICAO..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => {
                  // Delay blur to allow clicking suggestions
                  setTimeout(() => setIsSearchFocused(false), 200);
                }}
                onKeyDown={handleSearchKeyDown}
              />
              <AnimatePresence>
                {searchInput && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center"
                  >
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      radius="full"
                      onPress={() => setSearchInput('')}
                      className="text-zinc-400 hover:text-zinc-200"
                    >
                      <X size={16} />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Autocomplete Dropdown */}
            <AnimatePresence>
              {isSearchFocused && searchInput.trim().length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 right-0 mt-2 glass-morphism-heavy rounded-2xl overflow-hidden shadow-2xl border border-zinc-800/60"
                >
                  {suggestions.length > 0 ? (
                    <div className="py-2">
                      {suggestions.map((item: any, index: number) => (
                        <div
                          key={item.properties.icao_code}
                          className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-colors
                            ${index === searchSelectedIndex ? 'bg-indigo-500/20' : 'hover:bg-zinc-800/50'}`}
                          onClick={() => {
                            handleAerodromeClick(item.properties.icao_code, item.geometry.coordinates);
                            setSearchInput('');
                            setIsSearchFocused(false);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex items-center justify-center">
                              <MapPin size={14} className="text-indigo-400" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-zinc-100 font-semibold text-sm tracking-wide">
                                {item.properties.name || 'UNKNOWN AERODROME'}
                              </span>
                              <span className="text-zinc-500 text-xs tracking-[0.1em]">
                                {item.properties.type || 'AERODROME'}
                              </span>
                            </div>
                          </div>
                          <div className="px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20">
                            <span className="text-indigo-400 font-bold text-xs tracking-widest">
                              {item.properties.icao_code}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-zinc-500 text-sm font-medium tracking-wide">
                      NO MATCHING AERODROMES FOUND
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Left toolbar */}
        <div className="absolute top-1/2 left-6 -translate-y-1/2 flex flex-col gap-3 pointer-events-auto">
          {[Navigation, Target, Radio].map((Icon, i) => (
            <Button key={i} isIconOnly radius="full" variant="flat"
              className="bg-zinc-950/40 backdrop-blur-2xl border border-zinc-800/60 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 shadow-xl">
              <Icon size={18} />
            </Button>
          ))}
        </div>

        {/* 3D toggle + logo */}
        <div className="absolute bottom-6 right-6 flex flex-col items-end gap-4 pointer-events-auto">
          {(activeAirport || viewMode === 'TERMINAL') && (
            <Button radius="full" variant="solid" onPress={viewMode === 'TERMINAL' ? returnToEnroute : toggleViewMode}
              startContent={viewMode === 'TERMINAL' ? <MapIcon size={16} /> : <Building2 size={16} />}
              className={`shadow-2xl font-semibold tracking-[0.1em] text-[11px] h-12 px-6 backdrop-blur-xl transition-all ${viewMode === 'TERMINAL'
                ? 'bg-zinc-900/70 text-zinc-100 border border-zinc-700/50 hover:bg-zinc-800/80'
                : 'bg-indigo-500 text-white hover:bg-indigo-400'
                }`}>
              {viewMode === 'TERMINAL' ? 'RETURN TO ENROUTE' : `EXPLORE ${activeAirport} 3D`}
            </Button>
          )}
          <div className="flex flex-col items-end select-none pointer-events-none mt-1">
            <div className="text-zinc-200 font-bold tracking-[0.4em] text-[10px] uppercase opacity-90">Aero Plan</div>
            <div className="text-zinc-500 tracking-[0.2em] text-[8px] mt-1 uppercase font-medium">v0.1.0-alpha</div>
          </div>
        </div>

      </div>
    </div>
  );
}