import { useMemo } from 'react';
import { useMapStore } from '../../../store/useMapStore';
import { useRouteAnimation } from './useRouteAnimation';
import { createAirspaceLayers } from './createAirspaceLayers';
import { createAerodromeLayers } from './createAerodromeLayers';
import { createWaypointLayer } from './createWaypointLayer';
import { createNavaidLayer } from './createNavaidLayer';
import { createAtsRouteLayers } from './createAtsRouteLayers';
import { createRnpLayers } from './createRnpLayers';
import { useRnpPath3d } from './useRnpPath3d';
import { useRnpAnimation } from './useRnpAnimation';
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
    highlightedAirspaceId,
    selectedRnpProcedureId,
  } = useMapStore();

  // RNP 3D approach path — fetch data + drive animation
  const rnpPathData = useRnpPath3d(selectedRnpProcedureId);
  const rnpCurrentTime = useRnpAnimation(rnpPathData?.max_distance_nm ?? null);

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
    highlightedAirspaceId,
    setSelectedRouteIds,
    setSelectedFeature,
  };

  const deckLayers = useMemo(() => {
    const layers: any[] = [];

    if (activeLayers.airspaces) {
      layers.push(...createAirspaceLayers(ctx));
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

    // RNP 3D approach path (TERMINAL mode only)
    if (viewMode === 'TERMINAL' && rnpPathData) {
      layers.push(...createRnpLayers(rnpPathData, rnpCurrentTime));
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
    highlightedAirspaceId,
    rnpPathData,
    rnpCurrentTime,
  ]);

  return deckLayers;
}
