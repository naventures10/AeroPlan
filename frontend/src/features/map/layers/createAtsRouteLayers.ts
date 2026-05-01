/**
 * ATS Route Layers
 *
 * The most complex layer group — renders:
 *  1. Route segment geometry (MVTLayer — lines)
 *  2. Radial trips animation overlay (TripsLayer)
 *  3. Route labels: background mask (IconLayer), hex outline (IconLayer), text (TextLayer)
 *  4. Route waypoints (MVTLayer — points with icon+text)
 */

import { TextLayer, IconLayer } from '@deck.gl/layers';
import { MVTLayer, TripsLayer } from '@deck.gl/geo-layers';
import { getDistanceNm } from '../utils/routeAnimation';
import {
  EXTENSIONS,
  ZOOM_ATS_WAYPOINTS,
  COLOR_NEON_CYAN,
  COLOR_NEON_PURPLE,
  COLOR_LIME_GREEN,
  RGB_NEON_PURPLE,
  RGB_LIME_GREEN,
  RGB_ATS_CYAN,
  RGB_WHITE,
  parseRouteIds,
  ATS_ROUTE_LABEL_MAX_PIXELS,
  ATS_ROUTE_LABEL_TEXT_MAX_PIXELS,
} from './constants';
import type { LayerContext } from './types';

// ── Label Glow Intensity Calculator ──────────────────────────────────

/**
 * Returns 0–1 glow intensity for a label feature based on how close the
 * animation wavefront (`currentTime` in NM) is to the label's distance
 * from the animation origin.
 */
function getLabelIntensity(d: any, ctx: LayerContext): number {
  const { selectedFeature, animatedTrips, currentTime } = ctx;
  let originCoord: [number, number] | null = null;

  if (selectedFeature?.type === 'WAYPOINT' && selectedFeature.data.coordinates) {
    originCoord = selectedFeature.data.coordinates;
  } else if (selectedFeature?.type === 'ATS_ROUTE' && animatedTrips) {
    const trip = animatedTrips.find((t: any) => t.route_id === d.properties.route_id);
    if (trip && trip.path.length > 0) {
      originCoord = [trip.path[0][0], trip.path[0][1]];
    }
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

/** Returns the base RGB for a route type (RNAV → lime, conventional → cyan). */
function routeBaseRgb(routeType: string): [number, number, number] {
  return routeType === 'RNAV' ? RGB_LIME_GREEN : RGB_ATS_CYAN;
}

/**
 * Interpolates from white (selected base) toward a glow target colour
 * at the given intensity (0–1).
 */
function glowColor(
  baseRgb: [number, number, number],
  intensity: number,
  selectedRouteType: string | null,
): [number, number, number, number] {
  const targetGlow: [number, number, number] =
    selectedRouteType === 'WAYPOINT' ? RGB_NEON_PURPLE : baseRgb;

  return [
    RGB_WHITE[0] + Math.round((targetGlow[0] - RGB_WHITE[0]) * intensity),
    RGB_WHITE[1] + Math.round((targetGlow[1] - RGB_WHITE[1]) * intensity),
    RGB_WHITE[2] + Math.round((targetGlow[2] - RGB_WHITE[2]) * intensity),
    255,
  ];
}

// ── Main Factory ─────────────────────────────────────────────────────

export function createAtsRouteLayers(ctx: LayerContext): any[] {
  const {
    viewMode,
    activeLayers,
    selectedRouteIds,
    selectedRouteType,
    selectedFeature,
    animatedTrips,
    currentTime,
    atsRouteLabels,
    setSelectedRouteIds,
    setSelectedFeature,
  } = ctx;

  const isZoomAtsWaypoints = ctx.viewState.zoom > ZOOM_ATS_WAYPOINTS;
  const layers: any[] = [];

  // ── 1. Route Segment Geometry ──────────────────────────────────────

  layers.push(
    new MVTLayer({
      id: 'atsRoutes-geom-layer',
      data: `${window.location.origin}/tiles/ats_route_segments/{z}/{x}/{y}`,
      visible: viewMode === 'ENROUTE',
      pickable: true,
      autoHighlight: true,
      highlightColor: activeLayers.atsRoutes ? [255, 255, 255, 150] : [0, 0, 0, 0],
      getLineColor: (d: any) => {
        if (selectedRouteIds.includes(d.properties.route_id)) return [255, 255, 255, 255];
        if (!activeLayers.atsRoutes) return [0, 0, 0, 0];
        return d.properties.route_type === 'RNAV' ? [50, 205, 50, 60] : [34, 211, 238, 60];
      },
      getLineWidth: (d: any) => {
        if (!activeLayers.atsRoutes && !selectedRouteIds.includes(d.properties.route_id)) return 0;
        const limit = parseInt(d.properties.lateral_limits) || 10;
        const width = Math.max(1.5, limit / 4);
        return selectedRouteIds.includes(d.properties.route_id) ? width + 2 : width;
      },
      lineWidthMinPixels: 1,
      onClick: (info: any) => {
        if (info.object && info.object.properties.route_id) {
          const rId = info.object.properties.route_id;
          if (!activeLayers.atsRoutes && !selectedRouteIds.includes(rId)) return;
          const rType = info.object.properties.route_type;
          setSelectedRouteIds(
            selectedRouteIds.includes(rId) ? [] : [rId],
            selectedRouteIds.includes(rId) ? null : rType,
          );
          setSelectedFeature({ type: 'ATS_ROUTE', data: info.object.properties });
        } else {
          setSelectedRouteIds([]);
          setSelectedFeature(null);
        }
      },
      updateTriggers: {
        getLineColor: [selectedRouteIds, activeLayers.atsRoutes],
        getLineWidth: [selectedRouteIds, activeLayers.atsRoutes],
      },
      binary: true,
      transitions: {
        getLineColor: 300,
        getLineWidth: 300,
      },
    }),
  );

  // ── 2. Radial Trips Animation Overlay ──────────────────────────────

  if (animatedTrips && animatedTrips.length > 0) {
    layers.push(
      new TripsLayer({
        id: 'atsRoutes-trips-layer',
        data: animatedTrips,
        getPath: (d: any) => d.path.map((p: any) => [p[0], p[1]]),
        getTimestamps: (d: any) => d.path.map((p: any) => p[2]),
        getColor: (d: any) => {
          if (selectedRouteType === 'WAYPOINT') return [192, 132, 252];
          return d.route_type === 'RNAV' ? [50, 205, 50] : [0, 255, 255];
        },
        opacity: 1,
        widthMinPixels: 4,
        trailLength: 250, // 250 NM trail length to leave a long glowing trail
        currentTime: currentTime,
      }),
    );
  }

  // ── 3. Route Labels (Background + Hex + Text) ─────────────────────

  if (atsRouteLabels?.features) {
    const labelFeatures = atsRouteLabels.features.filter((f: any) => {
      const isSelected = selectedRouteIds.includes(f.properties.route_id);
      return activeLayers.atsRoutes || isSelected;
    });

    // 3a. Background mask — punches a transparent hole behind the label
    layers.push(
      new IconLayer({
        id: 'ats-route-labels-bg-layer',
        data: labelFeatures,
        visible: viewMode === 'ENROUTE',
        iconAtlas: '/ROUTE_HEXAGON_FILL.svg',
        iconMapping: {
          hex: { x: 0, y: 0, width: 140, height: 50, anchorY: 25, mask: true },
        },
        getIcon: () => 'hex',
        getPosition: (d: any) => d.geometry.coordinates,
        getAngle: (d: any) => d.properties.bearing,
        getSize: (d: any) => {
          const isSelected = selectedRouteIds.includes(d.properties.route_id);
          return isSelected ? 5000 + getLabelIntensity(d, ctx) * 1500 : 5000;
        },
        getColor: (): [number, number, number, number] => [0, 0, 0, 255],
        sizeUnits: 'meters',
        sizeMaxPixels: ATS_ROUTE_LABEL_MAX_PIXELS,
        extensions: EXTENSIONS,
        collisionGroup: 'ats-labels',
        collisionPriority: (d: any) => (selectedRouteIds.includes(d.properties.route_id) ? 2 : 1),
        updateTriggers: {
          getSize: [selectedRouteIds, currentTime, selectedFeature],
        },
        parameters: {
          depthTest: false,
          blend: true,
          blendFunc: [0, 771], // [GL.ZERO, GL.ONE_MINUS_SRC_ALPHA]
        },
      }),
    );

    // 3b. Hex outline icon
    layers.push(
      new IconLayer({
        id: 'ats-route-labels-hex-layer',
        data: labelFeatures,
        visible: viewMode === 'ENROUTE',
        iconAtlas: '/ROUTE_HEXAGON.svg',
        iconMapping: {
          hex: { x: 0, y: 0, width: 140, height: 50, anchorY: 25, mask: true },
        },
        getIcon: () => 'hex',
        getPosition: (d: any) => d.geometry.coordinates,
        getAngle: (d: any) => d.properties.bearing,
        getSize: 5000,
        getColor: (d: any): [number, number, number, number] => {
          const isSelected = selectedRouteIds.includes(d.properties.route_id);
          const baseRgb = routeBaseRgb(d.properties.route_type);

          if (!isSelected) {
            return [baseRgb[0], baseRgb[1], baseRgb[2], 140];
          }
          return glowColor(baseRgb, getLabelIntensity(d, ctx), selectedRouteType);
        },
        sizeUnits: 'meters',
        sizeMaxPixels: ATS_ROUTE_LABEL_MAX_PIXELS,
        extensions: EXTENSIONS,
        collisionGroup: 'ats-labels',
        collisionPriority: (d: any) => (selectedRouteIds.includes(d.properties.route_id) ? 2 : 1),
        updateTriggers: {
          getColor: [selectedRouteIds, currentTime, selectedFeature],
        },
        parameters: { depthTest: false },
      }),
    );

    // 3c. Text label
    layers.push(
      new TextLayer({
        id: 'ats-route-labels-text-layer',
        data: labelFeatures,
        visible: viewMode === 'ENROUTE',
        getPosition: (d: any) => d.geometry.coordinates,
        getText: (d: any) => d.properties.route_id,
        getAngle: (d: any) => d.properties.bearing,
        getSize: 4000,
        sizeUnits: 'meters',
        sizeMaxPixels: ATS_ROUTE_LABEL_TEXT_MAX_PIXELS,
        getColor: (d: any) => {
          const isSelected = selectedRouteIds.includes(d.properties.route_id);
          const baseRgb = routeBaseRgb(d.properties.route_type);

          if (!isSelected) {
            return [baseRgb[0], baseRgb[1], baseRgb[2], 140];
          }
          return glowColor(baseRgb, getLabelIntensity(d, ctx), selectedRouteType);
        },
        fontFamily: 'Inter, sans-serif',
        fontWeight: 700,
        extensions: EXTENSIONS,
        collisionGroup: 'ats-labels',
        collisionPriority: (d: any) => (selectedRouteIds.includes(d.properties.route_id) ? 2 : 1),
        updateTriggers: {
          getColor: [selectedRouteIds, currentTime, selectedFeature],
        },
        parameters: { depthTest: false },
      }),
    );
  }

  // ── 4. Route Waypoints ─────────────────────────────────────────────

  layers.push(
    new MVTLayer({
      id: 'atsRoutes-waypoints-layer',
      data: `${window.location.origin}/tiles/ats_route_waypoints/{z}/{x}/{y}`,
      visible: viewMode === 'ENROUTE',
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      pointType: 'icon+text',
      iconAtlas: '/WAYPOINT.svg',
      iconMapping: {
        waypoint: { x: 0, y: 0, width: 100, height: 100, anchorY: 50, mask: true },
      },
      getIcon: () => 'waypoint',
      getIconColor: (d: any) => {
        const routes = parseRouteIds(d.properties.route_ids);
        if (routes.some((r: string) => selectedRouteIds.includes(r))) {
          if (selectedRouteType === 'WAYPOINT') return COLOR_NEON_PURPLE;
          return selectedRouteType === 'RNAV' ? COLOR_LIME_GREEN : COLOR_NEON_CYAN;
        }
        if (!activeLayers.atsRoutes) return [0, 0, 0, 0];
        return [150, 150, 150, 80];
      },
      getIconSize: (d: any) => {
        const routes = parseRouteIds(d.properties.route_ids);
        if (routes.some((r: string) => selectedRouteIds.includes(r))) return 16;
        if (!activeLayers.atsRoutes) return 0;
        return 6;
      },
      getText: (d: any) => d.properties.waypoint_name || '',
      getTextSize: (d: any) => {
        const routes = parseRouteIds(d.properties.route_ids);
        if (routes.some((r: string) => selectedRouteIds.includes(r))) return 12;
        if (!activeLayers.atsRoutes) return 0;
        return isZoomAtsWaypoints ? 10 : 0;
      },
      getTextColor: (d: any) => {
        const routes = parseRouteIds(d.properties.route_ids);
        if (routes.some((r: string) => selectedRouteIds.includes(r))) {
          if (selectedRouteType === 'WAYPOINT') return COLOR_NEON_PURPLE;
          return selectedRouteType === 'RNAV' ? COLOR_LIME_GREEN : COLOR_NEON_CYAN;
        }
        if (!activeLayers.atsRoutes) return [0, 0, 0, 0];
        return [150, 150, 150, 150];
      },
      getTextPixelOffset: [0, -18],
      textFontFamily: 'Inter, sans-serif',
      textFontWeight: 600,
      onClick: (info: any) => {
        if (info.object && info.object.properties.route_ids) {
          const routes = parseRouteIds(info.object.properties.route_ids);
          const isAlreadySelected =
            routes.length > 0 &&
            selectedRouteIds.length === routes.length &&
            routes.every((r: string) => selectedRouteIds.includes(r));
          if (!activeLayers.atsRoutes && !routes.some((r: string) => selectedRouteIds.includes(r)))
            return;
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
        getIconColor: [selectedRouteIds, selectedRouteType, activeLayers.atsRoutes],
        getIconSize: [selectedRouteIds, activeLayers.atsRoutes],
        getTextColor: [selectedRouteIds, selectedRouteType, activeLayers.atsRoutes],
        getTextSize: [isZoomAtsWaypoints, selectedRouteIds, activeLayers.atsRoutes],
      },
      binary: false,
      transitions: {
        getIconColor: 300,
        getIconSize: 300,
        getTextColor: 300,
      },
    }),
  );

  return layers;
}
