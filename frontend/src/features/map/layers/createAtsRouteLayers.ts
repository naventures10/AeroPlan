/**
 * ATS Route Layers
 *
 * The most complex layer group — renders:
 *  1. Route segment geometry (MVTLayer — lines)
 *  2. Radial trips animation overlay (TripsLayer)
 *  3. Route labels: background mask (IconLayer), hex outline (IconLayer), text (TextLayer)
 *  4. Route waypoints (MVTLayer — points with icon+text)
 */

import { TextLayer } from '@deck.gl/layers';
import { MVTLayer, TripsLayer } from '@deck.gl/geo-layers';
import { getDistanceNm } from '../utils/routeAnimation';
import {
  ZOOM_ATS_WAYPOINTS,
  parseRouteIds,
  ATS_ROUTE_LABEL_TEXT_MAX_PIXELS,
  getLayerPalette,
} from './constants';
import type { LayerContext } from './types';

// ── Label Glow Intensity Calculator ──────────────────────────────────

/**
 * Returns 0–1 glow intensity for a label feature based on how close the
 * animation wavefront (`currentTime` in NM) is to the label's distance
 * from the animation origin.
 */
// fallow-ignore-next-line complexity
function getLabelIntensity(
  d: any,
  ctx: LayerContext,
  tripOriginMap: Map<string, [number, number]>,
): number {
  const { selectedFeature, currentTime } = ctx;

  // Early exit — no selection means no glow
  if (!selectedFeature) return 0;

  let originCoord: [number, number] | null = null;

  if (selectedFeature.type === 'WAYPOINT' && selectedFeature.data.coordinates) {
    originCoord = selectedFeature.data.coordinates;
  } else if (selectedFeature.type === 'ATS_ROUTE') {
    originCoord = tripOriginMap.get(d.properties.route_id) ?? null;
  }

  if (!originCoord) return 0;

  const dist = getDistanceNm(
    originCoord[1],
    originCoord[0],
    d.geometry.coordinates[1],
    d.geometry.coordinates[0],
  );

  // Glow matches TripsLayer's 250 NM trail, with a 50 NM lead-in anticipation.
  // The trail head is at currentTime, and tail is 250 NM behind.
  if (currentTime >= dist - 50 && currentTime <= dist + 250) {
    const rawIntens =
      currentTime <= dist ? 1.0 - (dist - currentTime) / 50 : 1.0 - (currentTime - dist) / 250;
    // Prevent negative rawIntens from emitting NaN from Math.pow
    return Math.max(0, Math.pow(Math.max(0, rawIntens), 1.2));
  }
  return 0;
}

// ── Colour helpers ───────────────────────────────────────────────────

/** Returns the base RGB for a route type. */
function routeBaseRgb(routeType: string, palette: any): [number, number, number] {
  return routeType === 'RNAV' ? palette.rgbRnavGreen : palette.rgbAtsBlue;
}

/**
 * Interpolates from white (selected base) toward a glow target colour
 * at the given intensity (0–1).
 */
function glowColor(
  baseRgb: [number, number, number],
  intensity: number,
  selectedRouteType: string | null,
  palette: any,
): [number, number, number, number] {
  const targetGlow: [number, number, number] =
    selectedRouteType === 'WAYPOINT' ? palette.rgbPurple : baseRgb;

  return [
    targetGlow[0] + Math.round((palette.rgbWhite[0] - targetGlow[0]) * intensity),
    targetGlow[1] + Math.round((palette.rgbWhite[1] - targetGlow[1]) * intensity),
    targetGlow[2] + Math.round((palette.rgbWhite[2] - targetGlow[2]) * intensity),
    255,
  ];
}

// ── Pre-process Overlapping Labels ───────────────────────────────────

export function preProcessRouteLabels(atsRouteLabels: any): any[] {
  if (!atsRouteLabels || !atsRouteLabels.features) return [];

  const labelFeatures = atsRouteLabels.features.map((f: any) => ({
    ...f,
    geometry: { ...f.geometry, coordinates: [...f.geometry.coordinates] },
    properties: { ...f.properties },
  }));

  const SLIDE_ALONG_M = 10000;
  const PERP_STEP_M = 4000;
  const coordsMap = new Map<string, any[]>();
  for (const f of labelFeatures) {
    if (f.geometry?.coordinates) {
      const coordKey = f.geometry.coordinates.map((c: number) => c.toFixed(6)).join(',');
      if (!coordsMap.has(coordKey)) {
        coordsMap.set(coordKey, []);
      }
      coordsMap.get(coordKey)!.push(f);
    }
  }

  for (const group of coordsMap.values()) {
    if (group.length <= 1) continue;
    const n = group.length;

    const refBearing = group[0].properties.bearing;
    const allCollinear = group.every((f: any) => {
      let diff = Math.abs(f.properties.bearing - refBearing) % 360;
      if (diff > 180) diff = 360 - diff;
      return diff < 20 || 180 - diff < 20;
    });

    for (let i = 0; i < n; i++) {
      const factor = i - (n - 1) / 2;
      const [lon, lat] = group[i].geometry.coordinates;
      const latRad = (lat * Math.PI) / 180;

      if (allCollinear) {
        const perpRad = (refBearing * Math.PI) / 180 + Math.PI / 2;
        const offsetM = factor * PERP_STEP_M;
        group[i].geometry.coordinates = [
          lon + (offsetM * Math.sin(perpRad)) / (111320 * Math.cos(latRad)),
          lat + (offsetM * Math.cos(perpRad)) / 111320,
        ];
      } else {
        const bearingRad = (group[i].properties.bearing * Math.PI) / 180;
        const offsetM = factor * SLIDE_ALONG_M;
        group[i].geometry.coordinates = [
          lon + (offsetM * Math.sin(bearingRad)) / (111320 * Math.cos(latRad)),
          lat + (offsetM * Math.cos(bearingRad)) / 111320,
        ];
      }
    }
  }

  return labelFeatures;
}

// ── Main Factory ─────────────────────────────────────────────────────

export function createStaticAtsRouteLayers(ctx: LayerContext): any[] {
  const {
    viewMode,
    activeLayers,
    selectedRouteIds,
    selectedRouteType,
    setSelectedRouteIds,
    setSelectedFeature,
    isAtsGeometryLoaded,
    setAtsGeometryLoaded,
  } = ctx;

  const isZoomAtsWaypoints = ctx.zoom > ZOOM_ATS_WAYPOINTS;
  const isLayerActive = activeLayers.atsRoutes;
  const palette = getLayerPalette(ctx.isDarkMode);
  const layers: any[] = [];

  const selectedSet = new Set(selectedRouteIds);

  const rnavSelectedColor: [number, number, number, number] = [
    palette.rgbRnavGreen[0],
    palette.rgbRnavGreen[1],
    palette.rgbRnavGreen[2],
    120,
  ];
  const atsSelectedColor: [number, number, number, number] = [
    palette.rgbAtsBlue[0],
    palette.rgbAtsBlue[1],
    palette.rgbAtsBlue[2],
    120,
  ];
  const purpleSelectedColor: [number, number, number, number] = [
    palette.rgbPurple[0],
    palette.rgbPurple[1],
    palette.rgbPurple[2],
    120,
  ];

  const rnavUnselectedColor: [number, number, number, number] = [
    palette.rgbRnavGreen[0],
    palette.rgbRnavGreen[1],
    palette.rgbRnavGreen[2],
    60,
  ];
  const atsUnselectedColor: [number, number, number, number] = [
    palette.rgbAtsBlue[0],
    palette.rgbAtsBlue[1],
    palette.rgbAtsBlue[2],
    60,
  ];

  const transparentColor: [number, number, number, number] = [0, 0, 0, 0];

  const wpActiveUnselectedDark: [number, number, number, number] = [150, 150, 150, 80];
  const wpActiveUnselectedLight: [number, number, number, number] = [
    ...palette.rgbWhite,
    120,
  ] as any;
  const wpActiveTextUnselectedDark: [number, number, number, number] = [150, 150, 150, 150];
  const wpActiveTextUnselectedLight: [number, number, number, number] = [
    ...palette.rgbWhite,
    255,
  ] as any;

  // ── 1. Route Segment Geometry ──────────────────────────────────────

  layers.push(
    new MVTLayer({
      id: `atsRoutes-geom-layer-${ctx.atsRoutesToggleCounter}`,
      data: `${window.location.origin}/tiles/ats_route_segments/{z}/{x}/{y}`,
      visible: viewMode === 'ENROUTE',
      pickable: (isLayerActive || selectedSet.size > 0) && !activeLayers.weather,
      autoHighlight: true,
      highlightColor: isLayerActive
        ? ctx.isDarkMode
          ? [255, 255, 255, 150]
          : [0, 0, 0, 80]
        : [0, 0, 0, 0],
      getLineColor: (d: any) => {
        const isSelected = selectedSet.has(d.properties.route_id);
        if (isSelected) {
          return selectedRouteType === 'WAYPOINT'
            ? purpleSelectedColor
            : d.properties.route_type === 'RNAV'
              ? rnavSelectedColor
              : atsSelectedColor;
        }
        if (!isLayerActive) return transparentColor;
        return d.properties.route_type === 'RNAV' ? rnavUnselectedColor : atsUnselectedColor;
      },
      getLineWidth: (d: any) => {
        const isSelected = selectedSet.has(d.properties.route_id);
        if (!isLayerActive && !isSelected) return 0;
        const limit = parseInt(d.properties.lateral_limits) || 10;
        const width = Math.max(1.5, limit / 4);
        return isSelected ? width + 2 : width;
      },
      lineWidthMinPixels: 1,
      onViewportLoad: () => {
        if (!isAtsGeometryLoaded) {
          setAtsGeometryLoaded(true);
        }
      },
      onClick: (info: any) => {
        if (info.object && info.object.properties.route_id) {
          const rId = info.object.properties.route_id;
          if (!isLayerActive && !selectedSet.has(rId)) return;
          const rType = info.object.properties.route_type;
          const isAlreadySelected = selectedSet.has(rId);
          if (isAlreadySelected) {
            setSelectedRouteIds([], null);
            setSelectedFeature(null);
          } else {
            setSelectedRouteIds([rId], rType);
            setSelectedFeature({ type: 'ATS_ROUTE', data: info.object.properties });
          }
        } else {
          setSelectedRouteIds([], null);
          setSelectedFeature(null);
        }
      },
      updateTriggers: {
        getLineColor: [selectedRouteIds, selectedRouteType, isLayerActive, ctx.isDarkMode],
        getLineWidth: [selectedRouteIds, isLayerActive],
      },
      binary: true,
      transitions: ctx.isMobile
        ? undefined
        : {
            getLineColor: 300,
            getLineWidth: 300,
          },
    }),
  );

  // ── 2. Route Waypoints ─────────────────────────────────────────────

  layers.push(
    new MVTLayer({
      id: `atsRoutes-waypoints-layer-${ctx.atsRoutesToggleCounter}`,
      data: `${window.location.origin}/tiles/ats_route_waypoints/{z}/{x}/{y}`,
      visible: viewMode === 'ENROUTE',
      pickable: (isLayerActive || selectedSet.size > 0) && !activeLayers.weather,
      autoHighlight: true,
      highlightColor: ctx.isDarkMode ? [255, 255, 255, 60] : [0, 0, 0, 40],
      pointType: 'icon+text',
      iconAtlas: '/WAYPOINT.svg',
      iconMapping: {
        waypoint: { x: 0, y: 0, width: 100, height: 100, anchorY: 50, mask: true },
      },
      getIcon: 'waypoint',
      getIconColor: (d: any) => {
        if (d._parsedRouteIds === undefined) {
          d._parsedRouteIds = parseRouteIds(d.properties.route_ids);
        }
        const routes = d._parsedRouteIds;
        const isSelected = routes.some((r: string) => selectedSet.has(r));
        if (isSelected) {
          if (selectedRouteType === 'WAYPOINT') return palette.purple;
          return selectedRouteType === 'RNAV' ? palette.rnavGreen : palette.atsBlue;
        }
        return isLayerActive
          ? ctx.isDarkMode
            ? wpActiveUnselectedDark
            : wpActiveUnselectedLight
          : transparentColor;
      },
      getIconSize: (d: any) => {
        if (d._parsedRouteIds === undefined) {
          d._parsedRouteIds = parseRouteIds(d.properties.route_ids);
        }
        const routes = d._parsedRouteIds;
        if (routes.some((r: string) => selectedSet.has(r))) return 16;
        if (!isLayerActive) return 0;
        return 6;
      },
      getText: (d: any) => d.properties.waypoint_name || '',
      getTextSize: (d: any) => {
        if (d._parsedRouteIds === undefined) {
          d._parsedRouteIds = parseRouteIds(d.properties.route_ids);
        }
        const routes = d._parsedRouteIds;
        if (routes.some((r: string) => selectedSet.has(r))) return 10;
        if (!isLayerActive) return 0;
        return isZoomAtsWaypoints ? 8 : 0;
      },
      getTextColor: (d: any) => {
        if (d._parsedRouteIds === undefined) {
          d._parsedRouteIds = parseRouteIds(d.properties.route_ids);
        }
        const routes = d._parsedRouteIds;
        const isSelected = routes.some((r: string) => selectedSet.has(r));
        if (isSelected) {
          if (selectedRouteType === 'WAYPOINT') return palette.purple;
          return selectedRouteType === 'RNAV' ? palette.rnavGreen : palette.atsBlue;
        }
        return isLayerActive
          ? ctx.isDarkMode
            ? wpActiveTextUnselectedDark
            : wpActiveTextUnselectedLight
          : transparentColor;
      },
      getTextPixelOffset: [0, -18],
      textFontFamily: 'Geist, sans-serif',
      textFontWeight: 600,
      onClick: (info: any) => {
        if (info.object && info.object.properties.route_ids) {
          if (info.object._parsedRouteIds === undefined) {
            info.object._parsedRouteIds = parseRouteIds(info.object.properties.route_ids);
          }
          const routes = info.object._parsedRouteIds;
          const isAlreadySelected =
            routes.length > 0 &&
            routes.length === selectedSet.size &&
            routes.every((r: string) => selectedSet.has(r));
          if (!isLayerActive && !routes.some((r: string) => selectedSet.has(r))) return;
          if (isAlreadySelected) {
            setSelectedRouteIds([]);
            setSelectedFeature(null);
          } else if (routes.length > 0) {
            setSelectedRouteIds(routes, 'WAYPOINT');
            setSelectedFeature({
              type: 'WAYPOINT',
              data: {
                ...info.object.properties,
                coordinates: info.object.geometry.coordinates,
              },
            });
          }
        } else {
          setSelectedRouteIds([]);
          setSelectedFeature(null);
        }
      },
      updateTriggers: {
        getIconColor: [selectedRouteIds, selectedRouteType, isLayerActive, ctx.isDarkMode],
        getIconSize: [selectedRouteIds, isLayerActive],
        getTextColor: [selectedRouteIds, selectedRouteType, isLayerActive, ctx.isDarkMode],
        getTextSize: [isZoomAtsWaypoints, selectedRouteIds, isLayerActive],
      },
      binary: false,
      transitions: ctx.isMobile
        ? undefined
        : {
            getIconColor: 300,
            getIconSize: 300,
            getTextColor: 300,
          },
    }),
  );

  return layers;
}

export function createDynamicAtsRouteLayers(ctx: LayerContext): any[] {
  const {
    viewMode,
    activeLayers,
    selectedRouteIds,
    selectedRouteType,
    selectedFeature,
    animatedTrips,
    currentTime,
    atsRouteLabels,
    isAtsGeometryLoaded,
  } = ctx;

  const isLayerActive = activeLayers.atsRoutes;
  const palette = getLayerPalette(ctx.isDarkMode);
  const layers: any[] = [];

  const selectedSet = new Set(selectedRouteIds);
  const transparentColor: [number, number, number, number] = [0, 0, 0, 0];

  // Pre-compute trip origin coords for O(1) lookup in label glow calculation
  const tripOriginMap = new Map<string, [number, number]>();
  if (animatedTrips) {
    for (const trip of animatedTrips) {
      if (trip.path.length > 0) {
        tripOriginMap.set(trip.route_id, [trip.path[0][0], trip.path[0][1]]);
      }
    }
  }

  // ── 1. Radial Trips Animation Overlay ──────────────────────────────

  if (animatedTrips && animatedTrips.length > 0) {
    layers.push(
      new TripsLayer({
        id: 'atsRoutes-trips-layer',
        data: animatedTrips,
        getPath: (d: any) => d.path2d || d.path.map((p: any) => [p[0], p[1]]),
        getTimestamps: (d: any) => d.timestamps || d.path.map((p: any) => p[2]),
        getColor: (d: any) => {
          if (selectedRouteType === 'WAYPOINT') return palette.rgbPurple;
          return d.route_type === 'RNAV' ? palette.rgbRnavGreen : palette.rgbAtsBlue;
        },
        opacity: 1,
        widthMinPixels: 4,
        trailLength: 250,
        currentTime: currentTime,
      }),
    );
  }

  // ── 2. Route Labels (Text only) ───────────────────────────────────

  if (atsRouteLabels?.features) {
    layers.push(
      new TextLayer({
        id: 'ats-route-labels-text-layer',
        data: atsRouteLabels.features,
        visible: viewMode === 'ENROUTE',
        getPosition: (d: any) => d.geometry.coordinates,
        getText: (d: any) => d.properties.route_id,
        getAngle: (d: any) => {
          const ang = (90 - d.properties.bearing + 360) % 360;
          return ang > 90 && ang < 270 ? (ang + 180) % 360 : ang;
        },
        getSize: 4000,
        sizeUnits: 'meters',
        sizeMaxPixels: ATS_ROUTE_LABEL_TEXT_MAX_PIXELS,
        getColor: (d: any): [number, number, number, number] => {
          const isSelected = selectedSet.has(d.properties.route_id);
          const isActive = (isLayerActive && isAtsGeometryLoaded) || isSelected;
          if (!isActive) return transparentColor;

          const baseRgb = routeBaseRgb(d.properties.route_type, palette);

          if (!isSelected) {
            return [baseRgb[0], baseRgb[1], baseRgb[2], ctx.isDarkMode ? 140 : 255];
          }
          return glowColor(
            baseRgb,
            getLabelIntensity(d, ctx, tripOriginMap),
            selectedRouteType,
            palette,
          );
        },
        fontFamily: 'Geist, sans-serif',
        fontWeight: 700,
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'bottom',
        characterSet: 'auto',
        fontSettings: { sdf: false },
        updateTriggers: {
          getColor: [
            selectedRouteIds,
            currentTime,
            selectedFeature,
            isLayerActive,
            isAtsGeometryLoaded,
          ],
        },
        parameters: { depthTest: false },
        transitions: ctx.isMobile
          ? undefined
          : {
              getColor: 300,
            },
      }),
    );
  }

  return layers;
}

export function createAtsRouteLayers(ctx: LayerContext): any[] {
  const staticLayers = createStaticAtsRouteLayers(ctx);
  const dynamicLayers = createDynamicAtsRouteLayers(ctx);
  const layers: any[] = [];

  const segments = staticLayers.find((l) => l.id.startsWith('atsRoutes-geom-layer'));
  if (segments) layers.push(segments);

  const trips = dynamicLayers.find((l) => l.id === 'atsRoutes-trips-layer');
  if (trips) layers.push(trips);

  const labels = dynamicLayers.find((l) => l.id === 'ats-route-labels-text-layer');
  if (labels) layers.push(labels);

  const waypoints = staticLayers.find((l) => l.id.startsWith('atsRoutes-waypoints-layer'));
  if (waypoints) layers.push(waypoints);

  return layers;
}
