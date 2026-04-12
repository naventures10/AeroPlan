import { useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { MapController } from '@deck.gl/core';
import Map, { Source, Layer } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useMapStore } from '../../store/useMapStore';
import { useDeckLayers } from './layers/useDeckLayers';
import { useMapTooltip } from './tooltips/useMapTooltip';
import { POLYGON_PAINT, POINT_PAINT } from './layers/mapStyles';
import { FeatureInfoCard } from './FeatureInfoCard';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const MAP_STYLE = `https://api.maptiler.com/maps/topo-v2-dark/style.json?key=${MAPTILER_KEY}`;

/**
 * Custom Map Controller to:
 * 1. Disable Right-Click rotation (allows native browser context menu)
 * 2. Bind Middle-Mouse button to Rotation/Tilt
 */
class CustomMapController extends MapController {
  /**
   * Override rotation detection to swap Right-Click for Middle-Click.
   */
  _isRotationEvent(event: any) {
    const { srcEvent } = event;
    const isMiddle = event.middleButton || 
                     (srcEvent && (srcEvent.button === 1 || srcEvent.which === 2 || (srcEvent.buttons & 4)));

    if (isMiddle) return true;
    
    // Disable Right-Click rotation
    if (event.rightButton || (srcEvent && (srcEvent.button === 2 || srcEvent.which === 3))) return false;
    
    // @ts-expect-error - Internal DeckGL method
    return super._isRotationEvent(event);
  }

  handleEvent(event: any) {
    const { srcEvent } = event;
    const isMiddle = event.middleButton || 
                     (srcEvent && (srcEvent.button === 1 || srcEvent.which === 2 || (srcEvent.buttons & 4)));

    // Suppress Right-Click drags so they don't fall back to panning
    const isRight = event.rightButton || (srcEvent && (srcEvent.button === 2 || srcEvent.which === 3));
    if (isRight && event.type && String(event.type).includes('drag')) {
      return false;
    }

    if (isMiddle) {
      event.rightButton = true;
      // Prevent browser autoscroll
      if (['mousedown', 'pointerdown', 'touchstart'].includes(String(event.type))) {
        if (srcEvent && srcEvent.preventDefault) srcEvent.preventDefault();
      }
    }

    return super.handleEvent(event);
  }
}

interface MapViewProps {
  aerodromes: any;
  onAerodromeClick: (icao: string, coords: [number, number]) => void;
}

/**
 * The core DeckGL + MapLibre map container.
 *
 * Manages:
 *  - View state transitions (zoom out → exit terminal)
 *  - Layer composition via useDeckLayers hook
 *  - Tooltip rendering via useMapTooltip hook
 *  - MapLibre raster/vector sources (WAC, spatial features)
 */
export default function MapView({ aerodromes, onAerodromeClick }: MapViewProps) {
  const {
    viewState,
    setViewState,
    viewMode,
    setViewMode,
    activeAirport,
    setActiveAirport,
    activeLayers,
  } = useMapStore();

  const mapRef = useRef<MapRef>(null);

  const deckLayers = useDeckLayers({ aerodromes, onAerodromeClick });
  const getTooltip = useMapTooltip(mapRef);

  const onViewStateChange = useCallback(
    ({ viewState: vs, interactionState }: { viewState: any; interactionState?: any }) => {
      let nextVs = vs;

      // 1. Zoom-out logic to exit terminal
      if (
        (interactionState?.isZooming || interactionState?.isPanning) &&
        nextVs.zoom < 10
      ) {
        if (activeAirport) setActiveAirport(null);
        if (viewMode === 'TERMINAL' || nextVs.pitch > 0) {
          setViewMode('ENROUTE');
          nextVs = { ...nextVs, pitch: 0 };
          setViewState(nextVs);
          return nextVs;
        }
      }
      setViewState(nextVs);
      return nextVs;
    },
    [activeAirport, viewMode, setActiveAirport, setViewMode, setViewState],
  );

  return (
    <div className="absolute inset-0 z-0">
      <DeckGL
        viewState={viewState}
        controller={{
          type: CustomMapController,
          dragRotate: true,
          touchRotate: true
        }}
        layers={deckLayers}
        onViewStateChange={onViewStateChange}
        getTooltip={getTooltip}
        pickingRadius={20}
      >
        <Map
          ref={mapRef}
          mapStyle={MAP_STYLE}
          reuseMaps
          terrain={
            viewMode === 'TERMINAL'
              ? { source: 'maptiler-terrain', exaggeration: 1 }
              : undefined
          }
          interactiveLayerIds={
            viewMode === 'TERMINAL' ? ['mvt-points', 'mvt-polygons'] : []
          }
        >
          <Source
            id="maptiler-terrain"
            type="raster-dem"
            url={`https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`}
          />

          {viewMode === 'ENROUTE' && activeLayers.wacMap && (
            <Source
              id="wac-source"
              type="raster"
              tiles={[
                `${window.location.origin}/tiles/wac_india/{z}/{x}/{y}`,
              ]}
              tileSize={256}
              minzoom={7}
              maxzoom={12}
            >
              <Layer
                id="wac-layer"
                type="raster"
                paint={{
                  'raster-opacity': 0.7,
                  'raster-resampling': 'linear',
                }}
              />
            </Source>
          )}

          {viewMode === 'TERMINAL' && (
            <Source
              id="spatial-features-source"
              type="vector"
              tiles={[
                `${window.location.origin}/tiles/spatial_features/{z}/{x}/{y}`,
              ]}
            >
              <Layer
                id="mvt-polygons"
                type="fill-extrusion"
                source-layer="spatial_features"
                filter={['==', ['geometry-type'], 'Polygon']}
                paint={POLYGON_PAINT as any}
              />
              <Layer
                id="mvt-points"
                type="circle"
                source-layer="spatial_features"
                filter={['==', ['geometry-type'], 'Point']}
                paint={POINT_PAINT as any}
              />
            </Source>
          )}
        </Map>
      </DeckGL>
      <FeatureInfoCard />
    </div>
  );
}
