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
import { useIsMobile } from '../../hooks/useIsMobile';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useMapStore, TERMINAL_EXIT_ZOOM_THRESHOLD } from '../../store/useMapStore';
import type { MapboxOverlay } from '@deck.gl/mapbox';
import { useDeckLayers } from './layers/useDeckLayers';
import { InterleavedDeckGL } from './InterleavedDeckGL';
import { useMapTooltip } from './tooltips/useMapTooltip';
import { FeatureInfoCard } from './FeatureInfoCard';
import PerformanceOverlay from './components/PerformanceOverlay';
import {
  TerminalSpatialLayers,
  TERMINAL_INTERACTIVE_LAYERS,
} from '../terminal/layers/terminal/TerminalSpatialLayers';
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
  _myStartPinchRotation = 0;
  _myPinchRotationUnlocked = false;

  /**
   * Override rotation detection to swap Right-Click for Middle-Click.
   */
  // fallow-ignore-next-line complexity
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

  // fallow-ignore-next-line complexity
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

  _onPinchStart(event: any) {
    this._myStartPinchRotation = event.rotation || 0;
    this._myPinchRotationUnlocked = false;
    return super._onPinchStart(event);
  }

  _onPinch(event: any) {
    const delta = Math.abs((event.rotation || 0) - this._myStartPinchRotation);

    if (this.touchRotate && !this._myPinchRotationUnlocked) {
      if (delta > 20) {
        this._myPinchRotationUnlocked = true;
      } else {
        // Lock rotation by passing a cloned event where rotation matches the start rotation
        return super._onPinch({ ...event, rotation: this._myStartPinchRotation });
      }
    }

    return super._onPinch(event);
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
  const isMobile = useIsMobile();
  const baseMapZoomThreshold = isMobile ? 14 : 12;
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
    isWeatherMode,
  } = useMapStore();

  const mapRef = useRef<MapRef>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const deckRef = useRef<any>(null);
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
      // Clear wind tooltip during interaction/transitions
      handleWindHover({ coordinate: null });

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
    [activeAirport, viewMode, setActiveAirport, setViewMode, setViewState, handleWindHover],
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

  const terrainConfig = useMemo(() => {
    return viewMode === 'TERMINAL' ? { source: 'maptiler-terrain', exaggeration: 1 } : undefined;
  }, [viewMode]);

  // 3. fitBounds watcher (triggered by intent in global store)
  useEffect(() => {
    if (boundsToFit && boundsToFit.length === 4) {
      try {
        const width = window.innerWidth || 1024;
        const height = window.innerHeight || 768;
        // Limit padding dynamically to a safe percentage (e.g., 20%) of the smallest viewport dimension
        const safePadding = Math.min(150, Math.floor(Math.min(width, height) * 0.2));

        const vp = new WebMercatorViewport({
          width,
          height,
        });
        const { longitude, latitude, zoom } = vp.fitBounds(
          [
            [boundsToFit[0], boundsToFit[1]],
            [boundsToFit[2], boundsToFit[3]],
          ],
          { padding: safePadding },
        );

        if (Number.isFinite(longitude) && Number.isFinite(latitude) && Number.isFinite(zoom)) {
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
        } else {
          console.warn('fitBounds produced invalid coordinates or zoom:', {
            longitude,
            latitude,
            zoom,
          });
        }

        // Reset the intent so it doesn't re-trigger
        fitBounds(null);
      } catch (e) {
        console.error('Failed to calculate fitBounds', e);
      }
    }
  }, [boundsToFit, setViewState, viewState, fitBounds, viewMode]);

  // Ref so the stable onMapLoad callback can read current viewMode
  const viewModeRef = useRef(viewMode);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  /**
   * Applies zoom-range thresholds and TERMINAL visibility to base map
   * symbol / label / road layers.  Skips our own terminal layers
   * (mvt-*, runway-*) so they remain under react-map-gl control.
   */
  const configureBaseMap = useCallback(
    (map: any, isTerminal: boolean) => {
      const layers = map.getStyle()?.layers;
      if (!layers) return;

      const targetVisibility = isTerminal ? 'none' : 'visible';

      layers.forEach((layer: any) => {
        if (layer.id.startsWith('mvt-') || layer.id.startsWith('runway-')) return;

        if (
          layer.type === 'symbol' ||
          layer.id.includes('road') ||
          layer.id.includes('place') ||
          layer.id.includes('label')
        ) {
          try {
            map.setLayerZoomRange(layer.id, baseMapZoomThreshold, 24);
            map.setLayoutProperty(layer.id, 'visibility', targetVisibility);
          } catch {
            // Layer may not exist yet or was removed during a style rebuild
          }
        }
      });
    },
    [baseMapZoomThreshold],
  );

  // 4. Initial load: configure base map layers
  const onMapLoad = useCallback(
    (e: any) => {
      configureBaseMap(e.target, viewModeRef.current === 'TERMINAL');
    },
    [configureBaseMap],
  );

  /**
   * 5. Performance: Toggle base map symbol/label/road visibility.
   *
   * Runs when viewMode changes OR when the base map style is switched.
   * After a style switch MapLibre rebuilds all layers from scratch (all
   * visible by default), so we must re-apply the TERMINAL hide.  We
   * schedule a one-shot `idle` listener to ensure the new style has
   * fully loaded and react-map-gl has re-added its declarative layers
   * before we touch anything.
   */
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const isTerminal = viewMode === 'TERMINAL';

    const apply = () => {
      if (map.isStyleLoaded()) {
        configureBaseMap(map, isTerminal);
      }
    };

    // Apply immediately if the style is already loaded
    apply();
    // Also apply after the map next idles (covers async style rebuilds)
    map.once('idle', apply);
    return () => {
      map.off('idle', apply);
    };
  }, [viewMode, mapStyle, configureBaseMap]);

  const handleDeckClick = useCallback(
    // fallow-ignore-next-line complexity
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
        let picked;
        try {
          picked = overlayRef.current.pickObject({ x: info.x, y: info.y, radius: 5 });
        } catch {
          // Overlay may be in a stale state after a MapLibre style rebuild — skip this frame
        }
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

      let picked;
      try {
        picked = overlayRef.current.pickObject({ x: info.x, y: info.y, radius: 5 });
      } catch {
        // Overlay may be in a stale state after a MapLibre style rebuild — skip this frame
        return;
      }
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
        ref={deckRef}
        viewState={processedViewState}
        controller={DECK_CONTROLLER}
        layers={overlaidLayers}
        onViewStateChange={onViewStateChange}
        onDragStart={() => handleWindHover({ coordinate: null })}
        getTooltip={getTooltip}
        getCursor={({ isHovering, isDragging }) => {
          if (isWeatherMode) {
            return isDragging ? 'grabbing' : 'crosshair';
          }
          return isHovering ? 'pointer' : isDragging ? 'grabbing' : 'grab';
        }}
        pickingRadius={15}
        useDevicePixels={Math.min(window.devicePixelRatio, 1.5)}
        _typedArrayManagerProps={isMobile ? { overAlloc: 1, poolSize: 0 } : undefined}
        onClick={handleDeckClick}
        onHover={handleDeckHover}
      >
        <Map
          ref={mapRef}
          mapStyle={getMapStyleUrl(mapStyle, MAPTILER_KEY)}
          onLoad={onMapLoad}
          reuseMaps
          terrain={terrainConfig}
          interactiveLayerIds={
            viewMode === 'TERMINAL' ? TERMINAL_INTERACTIVE_LAYERS : EMPTY_INTERACTIVE_LAYERS
          }
        >
          {TERRAIN_SOURCE_URL && (
            <Source id="maptiler-terrain" type="raster-dem" url={TERRAIN_SOURCE_URL} maxzoom={12} />
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

          <TerminalSpatialLayers />
        </Map>
      </DeckGL>
      <FeatureInfoCard />
      {windHoverInfo && <WindTooltip {...windHoverInfo} />}
      <PerformanceOverlay deckRef={deckRef} overlayRef={overlayRef} />
    </div>
  );
}
