import { useMemo } from 'react';
import { useMapStore } from '../../../store/useMapStore';
import { useRouteAnimation } from './useRouteAnimation';
import { createAirspaceLayers } from './createAirspaceLayers';
import { createAerodromeLayers } from './createAerodromeLayers';
import { createWaypointLayer } from './createWaypointLayer';
import { createNavaidLayer } from './createNavaidLayer';
import { createAtsRouteLayers } from './createAtsRouteLayers';
import { createRnpLayers } from '../../terminal/layers/createRnpLayers';
import { useRnpPath3d } from '../../terminal/layers/useRnpPath3d';
import { useRnpAnimation } from '../../terminal/layers/useRnpAnimation';
import { useWindLayer } from './useWindLayer';
import { useCloudLayer } from './useCloudLayer';
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
  hoveredRnpApproachId,
}: {
  aerodromes: any;
  onAerodromeClick: (icao: string, coords: [number, number]) => void;
  hoveredRnpApproachId?: string | null;
}) {
  'use no memo';
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
    selectedRnpProcedureId,
    selectedRnpApproachId,
    setSelectedRnpApproachId,
    mapStyle,
  } = useMapStore();

  // Derive isDarkMode from the reactive mapStyle field (getter is not reactive)
  const isDarkMode = mapStyle !== 'light';

  const { isAtsRendered, currentTime } = useRouteAnimation();

  // RNP 3D approach path — fetch data + drive animation only for selected approach
  const rnpPathData = useRnpPath3d(selectedRnpProcedureId);
  const selectedApproach = useMemo(() => {
    if (!rnpPathData || !selectedRnpApproachId) return null;
    return (
      rnpPathData.approach_paths.find((a) => a.entry_waypoint === selectedRnpApproachId) || null
    );
  }, [rnpPathData, selectedRnpApproachId]);

  // Approach distance (NM) — animation boundary between approach and missed approach phases
  const approachDist = selectedApproach?.total_distance_nm ?? 0;
  // Missed approach distance — extends the animation loop beyond the RW waypoint
  const missedDist = rnpPathData?.missed_approach_path?.total_distance_nm ?? 0;
  // Total loop covers approach + missed approach so both phases play sequentially
  const totalAnimDist = selectedApproach ? approachDist + missedDist : null;

  const rnpCurrentTime = useRnpAnimation(totalAnimDist);

  const { windLayer } = useWindLayer();
  const { cloudLayers } = useCloudLayer();

  // Pre-compute aerodrome text data
  const textData = useMemo(() => {
    if (!aerodromes?.features) return [];
    return aerodromes.features.map((f: any) => ({
      position: f.geometry.coordinates,
      text: f.properties.icao_code || 'UNKNOWN',
    }));
  }, [aerodromes]);

  const zoom = viewState.zoom;

  // Build the shared context passed to every layer factory
  const ctx: LayerContext = {
    viewMode,
    activeLayers,
    selectedRouteIds,
    selectedRouteType,
    selectedFeature,
    zoom,
    isDarkMode,
    atsRouteLabels,
    animatedTrips,
    currentTime,
    setSelectedRouteIds,
    setSelectedFeature,
  };

  const layers = useMemo(() => {
    const overlaidLayers: any[] = [];
    const interleavedLayers: any[] = [];

    overlaidLayers.push(...createAirspaceLayers(ctx));

    overlaidLayers.push(...createAerodromeLayers(ctx, aerodromes, textData, onAerodromeClick));

    overlaidLayers.push(...createWaypointLayer(ctx));
    overlaidLayers.push(...createNavaidLayer(ctx));

    if (isAtsRendered) {
      overlaidLayers.push(...createAtsRouteLayers(ctx));
    }

    // RNP 3D approach path (TERMINAL mode only)
    if (viewMode === 'TERMINAL' && rnpPathData) {
      interleavedLayers.push(
        ...createRnpLayers({
          pathData: rnpPathData,
          selectedRnpApproachId,
          hoveredRnpApproachId,
          setSelectedRnpApproachId,
          rnpCurrentTime,
          approachDist,
          pickable: true,
          opacity: 1,
        }),
      );
    }

    if (windLayer) {
      overlaidLayers.push(windLayer);
    }

    if (cloudLayers.length > 0) {
      overlaidLayers.push(...cloudLayers);
    }

    return { overlaidLayers, interleavedLayers };
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
    zoom,
    hoveredRnpApproachId,
    isAtsRendered,
    atsRouteLabels,
    animatedTrips,
    currentTime,
    rnpPathData,
    selectedRnpApproachId,
    setSelectedRnpApproachId,
    rnpCurrentTime,
    approachDist,
    missedDist,
    windLayer,
    cloudLayers,
    isDarkMode,
    mapStyle,
  ]);

  return layers;
}
