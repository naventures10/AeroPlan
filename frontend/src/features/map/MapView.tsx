import { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import {
  MapController,
  FlyToInterpolator,
  LinearInterpolator,
  WebMercatorViewport,
} from '@deck.gl/core';
import Map, { Source, Layer } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useMapStore, TERMINAL_EXIT_ZOOM_THRESHOLD } from '../../store/useMapStore';
import type { MapboxOverlay } from '@deck.gl/mapbox';
import { useDeckLayers } from './layers/useDeckLayers';
import { InterleavedDeckGL } from './InterleavedDeckGL';
import { useMapTooltip } from './tooltips/useMapTooltip';
import { FeatureInfoCard } from './FeatureInfoCard';
import {
  TerminalSpatialLayers,
  TERMINAL_INTERACTIVE_LAYERS,
} from '../terminal/layers/TerminalSpatialLayers';
import { WindTooltip } from './tooltips/WindTooltip';
import { useWindTooltip } from './tooltips/useWindTooltip';

const EMPTY_INTERACTIVE_LAYERS: string[] = [];

const ERC_TILES = [`${window.location.origin}/tiles/erc_india/{z}/{x}/{y}`];
const RASTER_PAINT = {
  'raster-opacity': 1,
  'raster-resampling': 'linear' as const,
};

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const IS_E2E = import.meta.env.VITE_E2E === 'true';

const BASE_MAP_LABEL_ZOOM_THRESHOLD = 12;

// Mock style for E2E tests to save MapTiler quota
const MOCK_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background' as const,
      paint: { 'background-color': '#0a0f1e' },
    },
  ],
};

const getMapStyleUrl = (style: 'dark' | 'light' | 'hybrid', maptilerKey: string) => {
  if (IS_E2E || !maptilerKey) return MOCK_STYLE as any;
  switch (style) {
    case 'light':
      return `https://api.maptiler.com/maps/landscape-v4/style.json?key=${maptilerKey}`;
    case 'hybrid':
      return `https://api.maptiler.com/maps/hybrid-v4/style.json?key=${maptilerKey}`;
    case 'dark':
    default:
      return `https://api.maptiler.com/maps/landscape-v4-dark/style.json?key=${maptilerKey}`;
  }
};

const TERRAIN_SOURCE_URL =
  IS_E2E || !MAPTILER_KEY
    ? ''
    : `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`;

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
    const isMiddle =
      event.middleButton ||
      (srcEvent && (srcEvent.button === 1 || srcEvent.which === 2 || srcEvent.buttons & 4));

    if (isMiddle) return true;

    // Disable Right-Click rotation
    if (event.rightButton || (srcEvent && (srcEvent.button === 2 || srcEvent.which === 3)))
      return false;

    // @ts-expect-error - Internal DeckGL method
    return super._isRotationEvent(event);
  }

  handleEvent(event: any) {
    const { srcEvent } = event;
    const isMiddle =
      event.middleButton ||
      (srcEvent && (srcEvent.button === 1 || srcEvent.which === 2 || srcEvent.buttons & 4));

    // Suppress Right-Click drags so they don't fall back to panning
    const isRight =
      event.rightButton || (srcEvent && (srcEvent.button === 2 || srcEvent.which === 3));
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

const DECK_CONTROLLER = {
  type: CustomMapController,
  dragRotate: true,
  touchRotate: true,
};

interface MapViewProps {
  aerodromes: any;
  onAerodromeClick: (icao: string, coords: [number, number]) => void;
}

/**
 * The core DeckGL + MapLibre map container.
 *
 * Manages:
 * - View state transitions (zoom out → exit terminal)
 * - Layer composition via useDeckLayers hook
 * - Tooltip rendering via useMapTooltip hook
 * - MapLibre raster/vector sources (WAC, spatial features)
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
    boundsToFit,
    fitBounds,
    setSelectedFeature,
    setSelectedRouteIds,
    mapStyle,
  } = useMapStore();

  const mapRef = useRef<MapRef>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const hoveredRnpApproachIdRef = useRef<string | null>(null);
  const [hoveredRnpApproachId, setHoveredRnpApproachId] = useState<string | null>(null);
  const { windHoverInfo, handleWindHover } = useWindTooltip();

  const { overlaidLayers, interleavedLayers } = useDeckLayers({
    aerodromes,
    onAerodromeClick,
    hoveredRnpApproachId,
  });
  const hasInterleavedLayers = interleavedLayers.length > 0;
  const getTooltip = useMapTooltip(mapRef);

  const onViewStateChange = useCallback(
    ({ viewState: vs, interactionState }: { viewState: any; interactionState?: any }) => {
      let nextVs = vs;

      // 1. Zoom-out logic to exit terminal
      if (
        (interactionState?.isZooming || interactionState?.isPanning) &&
        nextVs.zoom < TERMINAL_EXIT_ZOOM_THRESHOLD
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

  // 2. Logic to map transitionType (string) to Actual DeckGL Interpolator objects
  const processedViewState = useMemo(() => {
    const { transitionType, ...rest } = viewState;
    if (!transitionType) return rest;

    return {
      ...rest,
      transitionInterpolator:
        transitionType === 'FLY'
          ? new FlyToInterpolator({ speed: 1.5 })
          : new LinearInterpolator(['pitch']),
    };
  }, [viewState]);

  // 3. fitBounds watcher (triggered by intent in global store)
  useEffect(() => {
    if (boundsToFit && boundsToFit.length === 4) {
      try {
        const vp = new WebMercatorViewport({
          width: window.innerWidth || 1024,
          height: window.innerHeight || 768,
        });
        const { longitude, latitude, zoom } = vp.fitBounds(
          [
            [boundsToFit[0], boundsToFit[1]],
            [boundsToFit[2], boundsToFit[3]],
          ],
          { padding: 150 },
        );

        setViewState({
          ...viewState,
          longitude,
          latitude,
          zoom,
          pitch: viewMode === 'TERMINAL' ? 45 : 0,
          bearing: 0,
          transitionDuration: 1200,
          transitionType: 'FLY',
        });

        // Reset the intent so it doesn't re-trigger
        fitBounds(null);
      } catch (e) {
        console.error('Failed to calculate fitBounds', e);
      }
    }
  }, [boundsToFit, setViewState, viewState, fitBounds, viewMode]);

  // 4. Hide base map labels/roads below zoom 8
  const onMapLoad = useCallback((e: any) => {
    const map = e.target;
    const layers = map.getStyle()?.layers;
    if (layers) {
      layers.forEach((layer: any) => {
        // Only target base map layers, exclude our custom terminal layers
        if (layer.id.startsWith('mvt-') || layer.id.startsWith('runway-')) {
          return;
        }

        if (
          layer.type === 'symbol' ||
          layer.id.includes('road') ||
          layer.id.includes('place') ||
          layer.id.includes('label')
        ) {
          try {
            map.setLayerZoomRange(layer.id, BASE_MAP_LABEL_ZOOM_THRESHOLD, 24);
          } catch (err) {
            // Some layers might not support zoom range or be removed
            console.warn(`Failed to set zoom range for ${layer.id}`, err);
          }
        }
      });
    }
  }, []);

  const handleDeckClick = useCallback(
    (info: any, event: any) => {
      if (info.layer?.props?.onClick) {
        info.layer.props.onClick(info, event);
        return;
      }

      // 1. If we hit an airspace metadata label, open the info card
      if (info.layer?.id === 'airspace-metadata-layer' && info.object) {
        setSelectedFeature({ type: 'AIRSPACE', data: info.object });
        return;
      }

      // 2. If nothing overlaid was hit, pass the click down to the MapboxOverlay
      if (overlayRef.current) {
        // DeckGL info.x and info.y are CSS pixels, same as what pickObject expects
        const picked = overlayRef.current.pickObject({ x: info.x, y: info.y, radius: 5 });
        if (picked && picked.layer && picked.layer.props.onClick) {
          // Manually invoke the layer's onClick handler
          picked.layer.props.onClick(picked, event);
          return; // Stop here, we hit something interleaved!
        }
      }

      // 3. If we clicked empty space in BOTH contexts, clear selection
      setSelectedFeature(null);
      setSelectedRouteIds([]);
    },
    [setSelectedFeature, setSelectedRouteIds],
  );

  const handleDeckHover = useCallback(
    (info: any) => {
      // 1. Wind Hover Logic
      handleWindHover(info);

      // 2. RNP Hover Logic
      if (!overlayRef.current) return;

      const picked = overlayRef.current.pickObject({ x: info.x, y: info.y, radius: 5 });
      const pickedId = picked?.object?.entry_waypoint ?? null;

      if (hoveredRnpApproachIdRef.current === pickedId) return;

      hoveredRnpApproachIdRef.current = pickedId;
      setHoveredRnpApproachId(pickedId);
    },
    [handleWindHover],
  );

  const onOverlayCreated = useCallback((o: MapboxOverlay | null) => {
    overlayRef.current = o;
  }, []);

  return (
    <div className="absolute inset-0 z-0">
      <DeckGL
        viewState={processedViewState}
        controller={DECK_CONTROLLER}
        layers={overlaidLayers}
        onViewStateChange={onViewStateChange}
        getTooltip={getTooltip}
        getCursor={({ isHovering, isDragging }) =>
          isHovering ? 'pointer' : isDragging ? 'grabbing' : 'grab'
        }
        pickingRadius={15}
        useDevicePixels={Math.min(window.devicePixelRatio, 1.5)}
        onClick={handleDeckClick}
        onHover={handleDeckHover}
      >
        <Map
          ref={mapRef}
          mapStyle={getMapStyleUrl(mapStyle, MAPTILER_KEY)}
          onLoad={onMapLoad}
          onStyleData={onMapLoad}
          reuseMaps
          terrain={
            viewMode === 'TERMINAL' ? { source: 'maptiler-terrain', exaggeration: 1 } : undefined
          }
          interactiveLayerIds={
            viewMode === 'TERMINAL' ? TERMINAL_INTERACTIVE_LAYERS : EMPTY_INTERACTIVE_LAYERS
          }
        >
          {TERRAIN_SOURCE_URL && (
            <Source id="maptiler-terrain" type="raster-dem" url={TERRAIN_SOURCE_URL} />
          )}

          {hasInterleavedLayers && (
            <InterleavedDeckGL layers={interleavedLayers} onOverlayCreated={onOverlayCreated} />
          )}

          {viewMode === 'ENROUTE' && activeLayers.ercMap && (
            <Source
              id="erc-source"
              type="raster"
              tiles={ERC_TILES}
              tileSize={256}
              minzoom={4}
              maxzoom={12}
            >
              <Layer id="erc-layer" type="raster" paint={RASTER_PAINT} />
            </Source>
          )}

          {viewMode === 'TERMINAL' && <TerminalSpatialLayers />}
        </Map>
      </DeckGL>
      <FeatureInfoCard />
      {windHoverInfo && <WindTooltip {...windHoverInfo} />}
    </div>
  );
}
