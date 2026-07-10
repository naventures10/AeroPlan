import { useMemo } from 'react';
import { useMapStore } from '../../../store/useMapStore';
import { useRouteAnimation } from './useRouteAnimation';
import { createAirspaceLayers } from './createAirspaceLayers';
import { createAerodromeLayers } from './createAerodromeLayers';
import { createWaypointLayer } from './createWaypointLayer';
import { createNavaidLayer } from './createNavaidLayer';
import { createAtsRouteLayers, preProcessRouteLabels } from './createAtsRouteLayers';
import {
  createStaticRnpLayers,
  createDynamicRnpLayers,
} from '../../terminal/layers/rnp/createRnpLayers';
import { useRnpPath3d } from '../../terminal/layers/rnp/useRnpPath3d';
import { useRnpAnimation } from '../../terminal/layers/rnp/useRnpAnimation';
import { useWindLayer } from './useWindLayer';
import { useCloudLayer } from './useCloudLayer';

import { useIsMobile } from '../../../hooks/useIsMobile';
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
    isAtsGeometryLoaded,
    setAtsGeometryLoaded,
    atsRoutesToggleCounter,
    isAirspaceLoaded,
    setAirspaceLoaded,
  } = useMapStore();

  // Derive isDarkMode from the reactive mapStyle field (getter is not reactive)
  const isDarkMode = mapStyle !== 'light';
  const isMobile = useIsMobile();

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
  // Total loop covers only approach phase since missed approach is static
  const totalAnimDist = selectedApproach ? approachDist : null;

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

  // Pre-process overlapping ATS route labels only when raw labels change
  const processedRouteLabels = useMemo(() => {
    if (!atsRouteLabels) return null;
    return {
      type: 'FeatureCollection',
      features: preProcessRouteLabels(atsRouteLabels),
    };
  }, [atsRouteLabels]);

  // ── Shared Context Base ─────────────────────────────────────────────

  const baseCtx = {
    viewMode,
    activeLayers,
    selectedRouteIds,
    selectedRouteType,
    selectedFeature,
    zoom,
    isDarkMode,
    atsRouteLabels: processedRouteLabels,
    animatedTrips,
    setSelectedRouteIds,
    setSelectedFeature,
    isAtsGeometryLoaded,
    setAtsGeometryLoaded,
    atsRoutesToggleCounter,
    isAirspaceLoaded,
    setAirspaceLoaded,
    isMobile,
  };

  // ── 1. Static Map Layers Memo ──────────────────────────────────────

  const staticLayers = useMemo(() => {
    const staticCtx: LayerContext = { ...baseCtx, currentTime: 0 };
    return [
      ...createAirspaceLayers(staticCtx),
      ...createAerodromeLayers(staticCtx, aerodromes, textData, onAerodromeClick),
      ...createWaypointLayer(staticCtx),
      ...createNavaidLayer(staticCtx),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viewMode,
    activeLayers,
    selectedRouteIds,
    selectedRouteType,
    selectedFeature,
    zoom,
    isDarkMode,
    atsRouteLabels,
    animatedTrips,
    aerodromes,
    textData,
    onAerodromeClick,
    isAtsGeometryLoaded,
    setAtsGeometryLoaded,
    atsRoutesToggleCounter,
    isAirspaceLoaded,
    setAirspaceLoaded,
    isMobile,
  ]);

  // ── 2. ATS Route Layers Memo ───────────────────────────────────────

  const atsRouteLayers = useMemo(() => {
    if (!isAtsRendered) return [];
    const atsCtx: LayerContext = { ...baseCtx, currentTime };
    return createAtsRouteLayers(atsCtx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAtsRendered,
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
    isAtsGeometryLoaded,
    setAtsGeometryLoaded,
    atsRoutesToggleCounter,
    isMobile,
  ]);

  // ── 3. RNP Layers Memo ─────────────────────────────────────────────

  const staticRnpLayers = useMemo(() => {
    if (viewMode !== 'TERMINAL' || !rnpPathData) return [];
    return createStaticRnpLayers({
      pathData: rnpPathData,
      selectedRnpApproachId,
      hoveredRnpApproachId,
      setSelectedRnpApproachId,
      pickable: true,
      opacity: 1,
    });
  }, [
    viewMode,
    rnpPathData,
    selectedRnpApproachId,
    hoveredRnpApproachId,
    setSelectedRnpApproachId,
  ]);

  const dynamicRnpLayers = useMemo(() => {
    if (viewMode !== 'TERMINAL' || !rnpPathData || !selectedRnpApproachId) return [];
    return createDynamicRnpLayers({
      pathData: rnpPathData,
      selectedRnpApproachId,
      rnpCurrentTime,
      approachDist,
      opacity: 1,
    });
  }, [viewMode, rnpPathData, selectedRnpApproachId, rnpCurrentTime, approachDist]);

  // ── 4. Weather Layers Memo ─────────────────────────────────────────

  const weatherLayers = useMemo(() => {
    const overlaid: any[] = [];
    if (windLayer) {
      overlaid.push(windLayer);
    }
    if (cloudLayers.length > 0) {
      overlaid.push(...cloudLayers);
    }
    return overlaid;
  }, [windLayer, cloudLayers]);

  // ── 5. Composite Output Memo ───────────────────────────────────────

  return useMemo(() => {
    const rnpCombined = [...staticRnpLayers];
    if (dynamicRnpLayers.length > 0) {
      rnpCombined.splice(2, 0, ...dynamicRnpLayers);
    }
    return {
      overlaidLayers: [...staticLayers, ...atsRouteLayers, ...weatherLayers],
      interleavedLayers: rnpCombined,
    };
  }, [staticLayers, atsRouteLayers, weatherLayers, staticRnpLayers, dynamicRnpLayers]);
}
