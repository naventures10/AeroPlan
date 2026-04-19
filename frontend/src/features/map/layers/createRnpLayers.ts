/**
 * RNP Approach Path — 3D TripsLayer + Waypoint markers
 *
 * Renders the RNP procedure as an animated 3D descent path using DeckGL's
 * TripsLayer (for the glowing trail) plus a ScatterplotLayer (for waypoint
 * markers at their 3D positions).
 */

import { TripsLayer } from '@deck.gl/geo-layers';
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { RnpPath3d } from './useRnpPath3d';

/** Altitude exaggeration — makes the vertical offset visually prominent */
const ALT_EXAGGERATION = 3;

/** Neon cyan trail colour */
const COLOR_RNP_TRAIL: [number, number, number] = [34, 211, 238];

/** Waypoint marker colour — warm amber to contrast the cyan trail */
const COLOR_WAYPOINT: [number, number, number, number] = [255, 191, 0, 220];

/** IAF / FAF marker — brighter magenta */
const COLOR_KEY_WAYPOINT: [number, number, number, number] = [255, 100, 200, 255];

function roleColor(role: string | null): [number, number, number, number] {
  if (!role) return COLOR_WAYPOINT;
  const r = role.toUpperCase();
  if (r.includes('IAF') || r.includes('FAF') || r.includes('MAPT')) {
    return COLOR_KEY_WAYPOINT;
  }
  return COLOR_WAYPOINT;
}

/**
 * Build DeckGL layers for the active RNP procedure.
 *
 * @param pathData  – The fetched 3D path data (null = nothing to render)
 * @param currentTime – Animation progress in NM (drives trail head position)
 */
export function createRnpLayers(pathData: RnpPath3d | null, currentTime: number): any[] {
  if (!pathData || pathData.path.length < 2) return [];

  const layers: any[] = [];

  // Find the lowest altitude (usually the runway / MAPt) to anchor the exaggeration
  // so the path touches the real MapLibre map plane at Z=0.
  const minZ = Math.min(...pathData.path.map((p) => p[2]));

  // ── 1. Animated 3D Approach Trail ──────────────────────────────────
  const tripData = [
    {
      path: pathData.path.map((p) => [p[0], p[1], Math.max(0, (p[2] - minZ) * ALT_EXAGGERATION)]),
      timestamps: pathData.timestamps,
    },
  ];

  layers.push(
    new TripsLayer({
      id: 'rnp-approach-trips-layer',
      data: tripData,
      getPath: (d: any) => d.path,
      getTimestamps: (d: any) => d.timestamps,
      getColor: COLOR_RNP_TRAIL,
      opacity: 1,
      widthMinPixels: 6,
      jointRounded: true,
      capRounded: true,
      trailLength: pathData.total_distance_nm * 0.4,
      currentTime,
    }),
  );

  // ── 2. Static full-path glow (faint backdrop so shape is always visible)
  layers.push(
    new TripsLayer({
      id: 'rnp-approach-static-layer',
      data: tripData,
      getPath: (d: any) => d.path,
      getTimestamps: (d: any) => d.timestamps,
      getColor: [34, 211, 238, 60] as [number, number, number, number],
      opacity: 0.3,
      widthMinPixels: 3,
      jointRounded: true,
      trailLength: pathData.total_distance_nm * 2, // very long = always fully visible
      currentTime: pathData.total_distance_nm, // parked at end = whole path
    }),
  );

  // ── 3. Waypoint markers (3D scatter) ───────────────────────────────
  if (pathData.waypoints.length > 0) {
    layers.push(
      new ScatterplotLayer({
        id: 'rnp-waypoint-markers-layer',
        data: pathData.waypoints,
        getPosition: (d: any) => [
          d.position[0],
          d.position[1],
          Math.max(0, (d.position[2] - minZ) * ALT_EXAGGERATION),
        ],
        getRadius: 80,
        radiusUnits: 'meters',
        getFillColor: (d: any) => roleColor(d.role),
        getLineColor: [255, 255, 255, 180],
        lineWidthMinPixels: 1,
        stroked: true,
        filled: true,
        pickable: true,
      }),
    );

    // 3b. Waypoint name labels
    layers.push(
      new TextLayer({
        id: 'rnp-waypoint-labels-layer',
        data: pathData.waypoints,
        getPosition: (d: any) => [
          d.position[0],
          d.position[1],
          Math.max(0, (d.position[2] - minZ) * ALT_EXAGGERATION),
        ],
        getText: (d: any) => d.name,
        getSize: 13,
        getColor: [255, 255, 255, 220],
        getTextAnchor: 'start',
        getAlignmentBaseline: 'center',
        getPixelOffset: [12, 0],
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        outlineWidth: 2,
        outlineColor: [0, 0, 0, 200],
        billboard: true,
      }),
    );
  }

  return layers;
}
