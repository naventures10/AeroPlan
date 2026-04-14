import { useMemo } from 'react';
import { useMapStore } from '../../../store/useMapStore';
import { useRouteAnimation } from './useRouteAnimation';
import { createFirLayers } from './createFirLayers';
import { createAerodromeLayers } from './createAerodromeLayers';
import { createWaypointLayer } from './createWaypointLayer';
import { createNavaidLayer } from './createNavaidLayer';
import { createAtsRouteLayers } from './createAtsRouteLayers';
import type { LayerContext } from './types';

/**
 * Builds the memoised DeckGL layer array.
 *
 * This is a thin orchestrator — each layer type is built by its own
 * factory module.  Reads layer visibility / view mode from Zustand
 * directly and delegates all rendering logic to the individual factories.
 */
export function useDeckLayers({
  aerodromes,
  onAerodromeClick,
}: {
  aerodromes: any;
  onAerodromeClick: (icao: string, coords: [number, number]) => void;
}) {
  const {
    viewMode,
    activeLayers,
    selectedRouteIds,
    selectedRouteType,
    setSelectedRouteIds,
    selectedFeature,
    setSelectedFeature,
    viewState,
    atsRouteLabels,
    animatedTrips,
  } = useMapStore();

  const { isAtsRendered, currentTime } = useRouteAnimation();

  // Pre-compute aerodrome text data
  const textData = useMemo(() => {
    if (!aerodromes?.features) return [];
    return aerodromes.features.map((f: any) => ({
      position: f.geometry.coordinates,
      text: f.properties.icao_code || 'UNKNOWN',
    }));
  }, [aerodromes]);

  // Build the shared context passed to every layer factory
  const ctx: LayerContext = {
    viewMode,
    activeLayers,
    selectedRouteIds,
    selectedRouteType,
    selectedFeature,
    viewState,
    atsRouteLabels,
    animatedTrips,
    currentTime,
    setSelectedRouteIds,
    setSelectedFeature,
  };

  const deckLayers = useMemo(() => {
    const layers: any[] = [];

    if (activeLayers.firAirspace) {
      layers.push(...createFirLayers(ctx));
    }

    if (activeLayers.aerodromes) {
      layers.push(...createAerodromeLayers(ctx, aerodromes, textData, onAerodromeClick));
    }

    if (activeLayers.waypoints) {
      layers.push(...createWaypointLayer(ctx));
    }

    if (activeLayers.navaids) {
      layers.push(...createNavaidLayer(ctx));
    }

    if (isAtsRendered) {
      layers.push(...createAtsRouteLayers(ctx));
    }

    return layers;
  }, [
    aerodromes,
    viewMode,
    textData,
    onAerodromeClick,
    activeLayers,
    selectedRouteIds,
    selectedRouteType,
    setSelectedRouteIds,
    setSelectedFeature,
    selectedFeature,
    viewState,
    isAtsRendered,
    atsRouteLabels,
    animatedTrips,
    currentTime,
  ]);

  return deckLayers;
}
