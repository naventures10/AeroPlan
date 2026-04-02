import { useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import Map, { Source, Layer } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useMapStore } from '../../store/useMapStore';
import { useDeckLayers } from './layers/useDeckLayers';
import { useMapTooltip } from './tooltips/useMapTooltip';
import { POLYGON_PAINT, POINT_PAINT } from './layers/mapStyles';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const MAP_STYLE = `https://api.maptiler.com/maps/topo-v2-dark/style.json?key=${MAPTILER_KEY}`;

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
    ({ viewState: vs, interactionState }: any) => {
      if (
        (interactionState?.isZooming || interactionState?.isPanning) &&
        vs.zoom < 10
      ) {
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
    },
    [activeAirport, viewMode, setActiveAirport, setViewMode, setViewState],
  );

  return (
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
    </div>
  );
}
