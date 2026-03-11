import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from "@heroui/react";
import { Search, Building2, Map as MapIcon, Navigation, Radio, Target, MapPin, X } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, TextLayer } from '@deck.gl/layers';
import { MVTLayer } from '@deck.gl/geo-layers';
import Map, { NavigationControl, Source, Layer } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from './store/useMapStore';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const MAP_STYLE = `https://api.maptiler.com/maps/topo-v2-dark/style.json?key=${MAPTILER_KEY}`;

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
  zIndex: '1000'
};

// --- OPTIMIZATION: Extracted static MapLibre paint objects outside the component ---
// This prevents React/MapLibre from deep-diffing these massive objects on every render.
const POLYGON_PAINT = {
  'fill-extrusion-color': [
    'let',
    's', ['upcase', ['concat', ['coalesce', ['get', 'name'], ['get', 'feature_name'], ''], ' ', ['coalesce', ['get', 'category'], ['get', 'feature_category'], '']]],
    [
      'case',
      ['>=', ['index-of', 'RUNWAY', ['var', 's']], 0], '#3f3f46',
      ['>=', ['index-of', 'TAXIWAY', ['var', 's']], 0], '#52525b',
      ['>=', ['index-of', 'APRON', ['var', 's']], 0], '#71717a',
      ['>=', ['index-of', 'BUILDING', ['var', 's']], 0], '#94a3b8',
      '#9ca3af'
    ]
  ],
  'fill-extrusion-height': ['/', ['coalesce', ['to-number', ['get', 'height']], ['to-number', ['get', 'elevation_m']], 65], 3.28084],
  'fill-extrusion-opacity': 0.8
};

const POINT_PAINT = {
  'circle-color': [
    'let',
    's', ['upcase', ['concat', ['coalesce', ['get', 'name'], ['get', 'feature_name'], ''], ' ', ['coalesce', ['get', 'category'], ['get', 'feature_category'], '']]],
    [
      'case',
      ['>=', ['index-of', 'ARP', ['var', 's']], 0], '#facc15',
      ['>=', ['index-of', 'HELIPAD', ['var', 's']], 0], '#0ea5e9',
      ['>=', ['index-of', 'NAV', ['var', 's']], 0], '#a855f7',
      ['>=', ['index-of', 'RADIO', ['var', 's']], 0], '#a855f7',
      ['>=', ['index-of', 'RUNWAY', ['var', 's']], 0], '#cbd5e1',
      ['>=', ['index-of', 'RWY', ['var', 's']], 0], '#cbd5e1',
      ['>=', ['index-of', 'TREE', ['var', 's']], 0], '#22c55e',
      ['>=', ['index-of', 'TOWER', ['var', 's']], 0], '#dc2626',
      ['>=', ['index-of', 'MAST', ['var', 's']], 0], '#eab308',
      ['>=', ['index-of', 'ANTENNA', ['var', 's']], 0], '#eab308',
      ['>=', ['index-of', 'POLE', ['var', 's']], 0], '#eab308',
      ['>=', ['index-of', 'BUILDING', ['var', 's']], 0], '#94a3b8',
      ['>=', ['index-of', 'ELECTRICAL', ['var', 's']], 0], '#a855f7',
      '#f97316'
    ]
  ],
  'circle-radius': [
    'let',
    's', ['upcase', ['concat', ['coalesce', ['get', 'name'], ['get', 'feature_name'], ''], ' ', ['coalesce', ['get', 'category'], ['get', 'feature_category'], '']]],
    [
      'case',
      ['>=', ['index-of', 'ARP', ['var', 's']], 0], 8,
      ['>=', ['index-of', 'HELIPAD', ['var', 's']], 0], 6,
      ['>=', ['index-of', 'NAV', ['var', 's']], 0], 5,
      ['>=', ['index-of', 'RADIO', ['var', 's']], 0], 5,
      ['>=', ['index-of', 'RUNWAY', ['var', 's']], 0], 6,
      ['>=', ['index-of', 'RWY', ['var', 's']], 0], 6,
      3
    ]
  ],
  'circle-stroke-width': 1,
  'circle-stroke-color': '#ffffff'
};


export default function App() {
  const {
    flyToLocation,
    viewMode,
    setViewMode,
    activeAirport,
    setActiveAirport,
    returnToEnroute,
    activeAerodromeMetadata,
    setActiveAerodromeMetadata,
    viewState,
    setViewState,
    activeLayers,
    toggleLayer
  } = useMapStore();

  const [aerodromes, setAerodromes] = useState<any>(null);
  const [searchInput, setSearchInput] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<MapRef>(null);

  // === KEYBOARD SHORTCUTS ===
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

  // === VIEW CHANGE HANDLER ===
  const onViewStateChange = useCallback(({ viewState: vs, interactionState }: any) => {
    if ((interactionState?.isZooming || interactionState?.isPanning) && vs.zoom < 10) {
      if (activeAirport) setActiveAirport(null);
      if (viewMode === 'TERMINAL' || vs.pitch > 0) {
        setViewMode('ENROUTE');
        const nextVs = { ...vs, pitch: 0 };
        setViewState(nextVs);
        return nextVs;
      }
    }
    setViewState(vs);
    return vs;
  }, [activeAirport, viewMode, setActiveAirport, setViewMode, setViewState]);

  // === DATA FETCHING ===
  useEffect(() => {
    fetch('/api/aerodromes')
      .then(res => res.json())
      .then(data => setAerodromes(data))
      .catch(err => console.error("Failed to fetch aerodromes", err));
  }, []);

  const handleAerodromeClick = useCallback((icao: string, coords: [number, number]) => {
    setActiveAirport(icao);
    flyToLocation(coords[0], coords[1], 15, 60);

    fetch(`/api/aerodromes/${icao}/metadata`)
      .then(res => res.json())
      .then(data => {
        if (data?.aip_document) setActiveAerodromeMetadata(data.aip_document);
        else if (data?.data) setActiveAerodromeMetadata(data);
        else setActiveAerodromeMetadata(null);
      })
      .catch(err => console.error("Failed to fetch metadata", err));
  }, [flyToLocation, setActiveAirport, setActiveAerodromeMetadata]);

  // === SEARCH LOGIC ===
  const suggestions = useMemo(() => {
    if (!searchInput.trim() || !aerodromes?.features) return [];
    const query = searchInput.trim().toUpperCase();
    return aerodromes.features
      .filter((f: any) => {
        const p = f.properties;
        return p.name?.toUpperCase().includes(query) || p.icao_code?.toUpperCase().includes(query);
      })
      .slice(0, 5);
  }, [searchInput, aerodromes]);

  useEffect(() => setSearchSelectedIndex(-1), [searchInput]);

  // OPTIMIZATION: DRY helper for search reset
  const resetSearchState = useCallback(() => {
    setIsSearchFocused(false);
    setSearchInput('');
    searchInputRef.current?.blur();
  }, []);

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
        resetSearchState();
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
      resetSearchState();
    }
  }, [searchInput, aerodromes, handleAerodromeClick, resetSearchState]);

  // === DECK.GL LAYERS ===
  const textData = useMemo(() => {
    if (!aerodromes?.features) return [];
    return aerodromes.features.map((f: any) => ({
      position: f.geometry.coordinates,
      text: f.properties.icao_code || 'UNKNOWN'
    }));
  }, [aerodromes]);

  // OPTIMIZATION: Memoizing the layer array stops DeckGL from re-evaluating new layer objects constantly
  const deckLayers = useMemo(() => {
    const layers: any[] = [];
    
    if (activeLayers.aerodromes) {
      layers.push(
        new GeoJsonLayer({
          id: 'aerodromes-layer',
          data: aerodromes,
          visible: viewMode === 'ENROUTE',
          pickable: true,
          pointType: 'icon',
          getIcon: () => ({ url: '/ARP.svg', width: 339, height: 324, anchorY: 162, mask: false }),
          getIconSize: 20,
          iconSizeUnits: 'pixels',
          onClick: (info: any) => {
            if (info.object) handleAerodromeClick(info.object.properties.icao_code, info.object.geometry.coordinates);
          }
        }),
        new TextLayer({
          id: 'aerodrome-text-layer',
          data: textData,
          visible: viewMode === 'ENROUTE',
          pickable: false,
          getPosition: (d: any) => d.position,
          getText: (d: any) => d.text,
          getSize: 12,
          sizeUnits: 'pixels',
          getColor: [255, 255, 255, 230],
          getPixelOffset: [0, 20],
          fontFamily: 'Inter, sans-serif',
          fontWeight: 700,
          outlineWidth: 2,
          outlineColor: [0, 0, 0, 180]
        })
      );
    }
    
    if (activeLayers.waypoints) {
      layers.push(
        new MVTLayer({
          id: 'waypoints-layer',
          data: `${window.location.origin}/tiles/significant_points/{z}/{x}/{y}`,
          visible: viewMode === 'ENROUTE',
          pickable: true,
          pointType: 'circle',
          getFillColor: [167, 139, 250, 200], // Violet-400
          getLineColor: [255, 255, 255, 220],
          getLineWidth: 1,
          lineWidthMinPixels: 1,
          getPointRadius: 3,
          pointRadiusMinPixels: 2.5,
        })
      );
    }
    
    if (activeLayers.navaids) {
      layers.push(
        new MVTLayer({
          id: 'navaids-layer',
          data: `${window.location.origin}/tiles/radio_nav_aids/{z}/{x}/{y}`,
          visible: viewMode === 'ENROUTE',
          pickable: true,
          pointType: 'circle',
          getFillColor: [52, 211, 153, 220], // Emerald-400
          getLineColor: [255, 255, 255, 220],
          getLineWidth: 1,
          lineWidthMinPixels: 1,
          getPointRadius: 4,
          pointRadiusMinPixels: 3.5,
        })
      );
    }

    return layers;
  }, [aerodromes, viewMode, textData, handleAerodromeClick, activeLayers]);


  // === TOOLTIP ===
  const getTooltip = useCallback(({ object, layer, x, y }: any) => {
    if (object && layer?.id === 'aerodromes-layer') {
      const p = object.properties ?? {};
      let enrouteElev = p.elevation;

      if (!enrouteElev && activeAerodromeMetadata) {
        const docs = activeAerodromeMetadata.data || activeAerodromeMetadata;
        const elevMatch = docs.geographical_data?.elevation_reference_temp?.match(/(\d+(?:\.\d+)?)\s*FT/i);
        if (elevMatch) enrouteElev = elevMatch[1];
      }

      const divider = '<div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">';
      const row = (label: string, val: string) => val ? `<span style="color:#a1a1aa;font-size:10px;font-weight:500;display:block;white-space:normal;">${label}: <span style="color:#f4f4f5;">${val.replace(/\n/g, '<br/>')}</span></span>` : '';

      const magVarStr = row('MAG VAR', p.magnetic_variation);
      const remarksStr = row('REMARKS', p.remarks && p.remarks !== 'None' ? p.remarks : '');

      let commsHtml = '';
      try {
        const comms = typeof p.communications === 'string' ? JSON.parse(p.communications) : p.communications;
        if (Array.isArray(comms)) {
          const twrComms = comms.filter((c: any) => c.service_type?.includes('TWR') || c.service_type?.includes('APP'));
          if (twrComms.length > 0) {
            commsHtml = '<div style="margin-top:4px;">' + twrComms.map((c: any) => row(c.service_type || 'FREQ', `${c.frequency} (${c.call_sign})`)).join('') + '</div>';
          }
        }
      } catch (e) { }

      const extraInfo = (magVarStr || commsHtml || remarksStr) ? `${divider}${magVarStr}${commsHtml}${remarksStr}</div>` : '';

      return {
        html: `<div style="display:flex;flex-direction:column;gap:4px;max-width:300px;">
          <span style="font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#f4f4f5;">${p.name || p.icao_code}</span>
          <span style="color:#a1a1aa;font-size:10px;font-weight:500;">
            ICAO: <span style="color:#6366f1;font-weight:700;">${p.icao_code}</span> | ELEV: <span style="color:#6366f1;font-weight:700;">${enrouteElev ? enrouteElev + ' FT' : 'N/A'}</span>
          </span>
          <span style="color:#a1a1aa;font-size:9px;text-transform:uppercase;font-weight:600;letter-spacing:.2em;margin-top:2px;color:#10b981;">
            CLICK TO ENTER TERMINAL VIEW
          </span>
          ${extraInfo}
        </div>`,
        style: tooltipStyle
      };
    } else if (object && layer?.id === 'waypoints-layer') {
        const p = object.properties ?? {};
        // Clean array string syntax typical of Postgres arrays "{"route1","route2"}"
        const routes = p.routes ? p.routes.replace(/[{"}]/g, '').split(',') : [];
        const routesDisplay = routes.length > 0 && routes[0] !== "" ? `<div style="margin-top:6px; font-size:10px; color:#a1a1aa;">ROUTES: <span style="color:#d8b4fe; font-weight:600;">${routes.join(', ')}</span></div>` : '';
        
        return {
           html: `<div style="display:flex;flex-direction:column;gap:4px;max-width:250px;">
             <span style="font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#f4f4f5;">${p.waypoint_name || 'WAYPOINT'}</span>
             <span style="color:#a1a1aa;font-size:10px;font-weight:600;letter-spacing:.1em;">SIGNIFICANT POINT</span>
             <span style="color:#a1a1aa;font-size:9px;font-family:monospace;margin-top:2px;">${p.raw_coordinates?.replace(/\\n/g, '') || ''}</span>
             ${routesDisplay}
           </div>`,
           style: tooltipStyle
        };
    } else if (object && layer?.id === 'navaids-layer') {
        const p = object.properties ?? {};
        const hours = p.hours_of_operation && p.hours_of_operation !== 'None' ? `<div style="color:#a1a1aa;font-size:9px;margin-top:4px;">HOURS: ${p.hours_of_operation}</div>` : '';
        const elev = p.elevation && p.elevation !== 'None' ? `<span style="color:#a1a1aa;font-size:9px;margin-left:8px;">ELEV: ${p.elevation.replace(/\\n/g, '')}</span>` : '';
        
        return {
           html: `<div style="display:flex;flex-direction:column;gap:4px;max-width:260px;">
             <span style="font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#f4f4f5;">${p.station_name || ''} <span style="color:#a1a1aa;">${p.aid_type || ''}</span></span>
             <div style="display:flex;align-items:center;margin-top:2px;">
                 <span style="color:#a1a1aa;font-size:10px;font-weight:600;background:#065f46;color:#6ee7b7;padding:2px 6px;border-radius:4px;margin-right:8px;">${p.ident || 'UNK'}</span> 
                 <span style="color:#f4f4f5;font-size:11px;font-weight:700;">${p.frequency || ''}</span>
             </div>
             <span style="color:#a1a1aa;font-size:9px;font-family:monospace;margin-top:2px;">${p.raw_coordinates?.replace(/\\n/g, '') || ''}${elev}</span>
             ${hours}
           </div>`,
           style: tooltipStyle
        };
    }

    const map = mapRef.current?.getMap();
    if (map && x !== undefined && y !== undefined) {
      try {
        const features = map.queryRenderedFeatures([x, y], { layers: ['mvt-points', 'mvt-polygons'] });
        if (features && features.length > 0) {
          let htmlContent = '';
          const maxFeatures = Math.min(features.length, 3); // Max 3 overlapping tools

          for (let k = 0; k < maxFeatures; k++) {
            const feature = features[k];
            const p = feature.properties ?? {};
            const name = p.name || p.feature_name || 'FEATURE';
            const category = p.category || p.feature_category || 'UNKNOWN';

            let elev = p.height ?? p.elevation_m ?? p.elevation ?? null;

            if (elev == null && category === 'ARP' && activeAerodromeMetadata) {
              const docs = activeAerodromeMetadata.data || activeAerodromeMetadata;
              const elevMatch = docs.geographical_data?.elevation_reference_temp?.match(/(\d+(?:\.\d+)?)\s*FT/i);
              if (elevMatch) elev = elevMatch[1];
            }
            const elevStr = elev != null ? Number(elev).toFixed(1) + ' FT' : 'N/A';

            let extraInfo = '';
            let categoryDisplay = category;

            if (activeAerodromeMetadata) {
              const docs = activeAerodromeMetadata.data || activeAerodromeMetadata;
              const divider = '<div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">';
              const row = (label: string, val: string) => val ? `<span style="color:#a1a1aa;font-size:10px;font-weight:500;display:block;white-space:normal;">${label}: <span style="color:#f4f4f5;">${val.replace(/\\n/g, '<br/>')}</span></span>` : '';

              if (category === 'ARP') {
                const geom = feature.geometry as any;
                if (geom?.type === 'Point' && geom.coordinates) {
                  categoryDisplay = `${category} | ${geom.coordinates[1].toFixed(5)}, ${geom.coordinates[0].toFixed(5)}`;
                }
              } else if (category === 'OBSTACLE' && Array.isArray(docs.obstacles)) {
              let bestObs = null;
              
              // 1. Try strict matching using Name AND Elevation to uniquely identify identical generic types
              if (elev != null) {
                const targetElev = parseFloat(elev);
                bestObs = docs.obstacles.find((o: any) => {
                  const nameMatch = o.obstacle_type === name || name.includes(o.obstacle_type);
                  if (!nameMatch || !o.elevation) return false;
                  
                  const docElevMatch = o.elevation.match(/(\d+(?:\.\d+)?)/);
                  if (docElevMatch) {
                    // Float comparison (within 1.0 margin of error since tiles may snap decimals)
                    return Math.abs(parseFloat(docElevMatch[1]) - targetElev) < 1.0;
                  }
                  return false;
                });
              }

              // 2. Fallback to name-only matching if elevation is missing or didn't strict-match
              const obs = bestObs || docs.obstacles.find((o: any) => o.obstacle_type === name || name.includes(o.obstacle_type));
              
              if (obs) extraInfo = `${divider}${row('AREA AFFECTED', obs.area_affected)}${row('LGT/MARKING', obs.marking_lgt)}${row('REMARKS', obs.remarks)}</div>`;
            } else if ((category === 'NAVAID' || category === 'NAV') && Array.isArray(docs.radio_navigation_and_landing_aids)) {
                let bestMatch = null;
                let highestScore = 0;
                const nameParts = name.split(/\s+/);

                for (const n of docs.radio_navigation_and_landing_aids) {
                  const ident = n.identification?.trim().toUpperCase();
                  const typeStr = n.type_of_aid?.split('\n')[0]?.trim().toUpperCase();

                  let score = 0;

                  // 1. Exact word match for identifier gets strong points
                  if (ident && nameParts.includes(ident)) {
                    score += 2;
                  }

                  // 2. Type/Category matching (e.g. 'DME ILS RWY 36' vs 'LOC RWY 36')
                  if (typeStr) {
                    const typeParts = typeStr.split(/\s+/);
                    let matchCount = 0;
                    for (const p of typeParts) {
                      if (nameParts.includes(p)) matchCount++;
                    }
                    // Add fractional score based on percentage of type keywords matched
                    score += matchCount / Math.max(typeParts.length, 1);
                  }

                  // 3. Fallback: string inclusion for very messy names
                  const combined = `${ident || ''} ${typeStr || ''}`.trim().toUpperCase();
                  if (score === 0 && combined && combined.includes(name)) {
                    score += 0.5;
                  }

                  if (score > highestScore) {
                    highestScore = score;
                    bestMatch = n;
                  }
                }

                const nav = highestScore >= 1 ? bestMatch : null;

                if (nav) extraInfo = `${divider}${row('FREQ', nav.frequency_channel)}${row('HOURS', nav.hours_of_operation)}${row('REMARKS', nav.remarks)}</div>`;
              } else if ((category === 'RUNWAY_THRESHOLD' || category === 'RUNWAY') && Array.isArray(docs.runway_physical_characteristics)) {
                const rwyNum = name.replace(/[^0-9]/g, '');
                const rwy = docs.runway_physical_characteristics.find((r: any) => r.designation === rwyNum || r.designation?.includes(rwyNum));
                if (rwy) extraInfo = `${divider}${row('DIMENSIONS', rwy.dimensions)}${row('SURFACE/STRENGTH', rwy.strength_and_surface)}</div>`;
              }
            }

            const separator = k > 0 ? 'margin-top: 12px; border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 12px;' : '';
            htmlContent += `<div style="${separator} display:flex;flex-direction:column;gap:4px;">
              <span style="font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#f4f4f5;">${name}</span>
              <span style="color:#a1a1aa;font-size:10px;font-weight:500;">ELEVATION: <span style="color:#6366f1;font-weight:700;">${elevStr}</span></span>
              <span style="color:#a1a1aa;font-size:9px;text-transform:uppercase;font-weight:600;letter-spacing:.2em;margin-top:2px;">${categoryDisplay}</span>
              ${extraInfo}
            </div>`;
          } // End of loop over overlapping features

          return {
            html: `<div style="max-height: 400px; overflow-y: auto; max-width:300px; padding-right: 4px;">${htmlContent}</div>`,
            style: tooltipStyle,
          };
        }
      } catch (e) { } // Map not fully loaded
    }
    return null;
  }, [activeAerodromeMetadata]);

  // === RENDER ===
  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-900 relative font-sans">
      <div className="absolute inset-0 z-0">
        <DeckGL
          viewState={viewState}
          controller={true}
          layers={deckLayers}
          onViewStateChange={onViewStateChange}
          getTooltip={getTooltip}
        >
          <Map
            ref={mapRef}
            mapStyle={MAP_STYLE}
            reuseMaps
            terrain={viewMode === 'TERMINAL' ? { source: 'maptiler-terrain', exaggeration: 1 } : undefined}
            interactiveLayerIds={viewMode === 'TERMINAL' ? ['mvt-points', 'mvt-polygons'] : []}
          >
            <Source id="maptiler-terrain" type="raster-dem" url={`https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`} />

            {viewMode === 'TERMINAL' && (
              <Source id="spatial-features-source" type="vector" tiles={[`${window.location.origin}/tiles/spatial_features/{z}/{x}/{y}`]}>
                <Layer id="mvt-polygons" type="fill-extrusion" source-layer="spatial_features" filter={['==', ['geometry-type'], 'Polygon']} paint={POLYGON_PAINT as any} />
                <Layer id="mvt-points" type="circle" source-layer="spatial_features" filter={['==', ['geometry-type'], 'Point']} paint={POINT_PAINT as any} />
              </Source>
            )}
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
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                onKeyDown={handleSearchKeyDown}
              />
              <AnimatePresence>
                {searchInput && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center">
                    <Button isIconOnly size="sm" variant="light" radius="full" onPress={() => setSearchInput('')} className="text-zinc-400 hover:text-zinc-200"><X size={16} /></Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Autocomplete Dropdown */}
            <AnimatePresence>
              {isSearchFocused && searchInput.trim().length > 0 && (
                <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} transition={{ duration: 0.15 }} className="absolute top-full left-0 right-0 mt-2 glass-morphism-heavy rounded-2xl overflow-hidden shadow-2xl border border-zinc-800/60">
                  {suggestions.length > 0 ? (
                    <div className="py-2">
                      {suggestions.map((item: any, index: number) => (
                        <div key={item.properties.icao_code} className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-colors ${index === searchSelectedIndex ? 'bg-indigo-500/20' : 'hover:bg-zinc-800/50'}`}
                          onClick={() => { handleAerodromeClick(item.properties.icao_code, item.geometry.coordinates); resetSearchState(); }}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex items-center justify-center"><MapPin size={14} className="text-indigo-400" /></div>
                            <div className="flex flex-col">
                              <span className="text-zinc-100 font-semibold text-sm tracking-wide">{item.properties.name || 'UNKNOWN AERODROME'}</span>
                              <span className="text-zinc-500 text-xs tracking-[0.1em]">{item.properties.type || 'AERODROME'}</span>
                            </div>
                          </div>
                          <div className="px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20">
                            <span className="text-indigo-400 font-bold text-xs tracking-widest">{item.properties.icao_code}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-zinc-500 text-sm font-medium tracking-wide">NO MATCHING AERODROMES FOUND</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Left toolbar */}
        <div className="absolute top-1/2 left-6 -translate-y-1/2 flex flex-col gap-3 pointer-events-auto">
          {(() => {
            const toggleButtons = [
              { icon: Target, id: 'aerodromes' as const, color: 'text-indigo-400', border: 'border-indigo-500/50', bg: 'bg-indigo-500/20' },
              { icon: Navigation, id: 'waypoints' as const, color: 'text-violet-400', border: 'border-violet-500/50', bg: 'bg-violet-500/20' },
              { icon: Radio, id: 'navaids' as const, color: 'text-emerald-400', border: 'border-emerald-500/50', bg: 'bg-emerald-500/20' }
            ];
            
            return toggleButtons.map(({ icon: Icon, id, color, border, bg }) => {
              const isActive = activeLayers[id];
              return (
                <Button 
                  key={id} 
                  isIconOnly 
                  radius="full" 
                  variant="flat" 
                  onPress={() => toggleLayer(id)}
                  title={`Toggle ${id}`}
                  className={`backdrop-blur-2xl shadow-xl transition-all duration-300 ${
                    isActive 
                      ? `${bg} ${color} border ${border} shadow-[0_0_15px_rgba(0,0,0,0.2)]` 
                      : 'bg-zinc-950/40 border border-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 opacity-80'
                  }`}
                >
                  <Icon size={18} />
                </Button>
              );
            });
          })()}
        </div>

        {/* 3D toggle + logo */}
        <div className="absolute bottom-6 right-6 flex flex-col items-end gap-4 pointer-events-auto">
          {(activeAirport || viewMode === 'TERMINAL') && (
            <button
              onClick={() => {
                setViewState({ ...viewState, pitch: viewState.pitch > 0 ? 0 : 60, transitionDuration: 1000 });
              }}
              className="relative w-12 h-12 group focus:outline-none"
              style={{ perspective: '1000px' }}
              title="Toggle View Mode"
            >
              <div
                className="w-full h-full transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: viewState.pitch > 0 
                    ? 'rotateX(-90deg) scale(0.95)' 
                    : 'rotateX(0deg)',
                }}
              >
                {/* 2D Face (Front) */}
                <div 
                  className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 border border-zinc-700/80 shadow-xl"
                  style={{ transform: 'translateZ(24px)' }}
                >
                  <MapIcon className="text-zinc-200 group-hover:text-white transition-colors" size={20} strokeWidth={2} />
                  <span className="text-[10px] font-bold text-zinc-500 tracking-widest mt-0.5">2D</span>
                </div>
                
                {/* 3D Face (Top) */}
                <div 
                  className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-600 border border-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                  style={{ transform: 'rotateX(90deg) translateZ(24px)' }}
                >
                  <Building2 className="text-white group-hover:scale-110 transition-transform" size={20} strokeWidth={2} />
                  <span className="text-[10px] font-bold text-indigo-100 tracking-widest mt-0.5">3D</span>
                </div>
                
                {/* Cube Sides (Darker flat planes with borders to complete the solid, seamless shape) */}
                <div className="absolute inset-0 bg-zinc-950 border border-zinc-800/50" style={{ transform: 'rotateX(-90deg) translateZ(24px)' }} />
                <div className="absolute inset-0 bg-zinc-900 border border-zinc-800/50" style={{ transform: 'rotateY(90deg) translateZ(24px)' }} />
                <div className="absolute inset-0 bg-zinc-900 border border-zinc-800/50" style={{ transform: 'rotateY(-90deg) translateZ(24px)' }} />
                <div className="absolute inset-0 bg-zinc-950 border border-zinc-800/50" style={{ transform: 'rotateY(180deg) translateZ(24px)' }} />
              </div>
            </button>
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