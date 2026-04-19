/**
 * RNP Approach Path — 3D TripsLayer + Waypoint markers
 *
 * Renders the RNP procedure as animated 3D descent paths using DeckGL's
 * TripsLayer (for the glowing trails) plus a PathLayer for missed approach,
 * and ScatterplotLayer for waypoint markers at their 3D positions.
 */

import { TripsLayer } from '@deck.gl/geo-layers';
import { ScatterplotLayer, TextLayer, PathLayer } from '@deck.gl/layers';
import { PathStyleExtension } from '@deck.gl/extensions';
import type { RnpPath3d } from './useRnpPath3d';

/** Altitude exaggeration — makes the vertical offset visually prominent */
const ALT_EXAGGERATION = 3;

/** Distinct colour palette for parallel dynamic approaches */
const APPROACH_COLORS: [number, number, number][] = [
  [34, 211, 238], // Cyan
  [167, 139, 250], // Electric Purple
  [52, 211, 153], // Emerald
  [251, 146, 60], // Coral
  [244, 114, 182], // Pink
];

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
  if (!pathData) return [];

  const layers: any[] = [];

  // Find the lowest altitude (usually the runway / MAPt) to anchor the exaggeration
  // so the path touches the real MapLibre map plane at Z=0.
  const allZ: number[] = [];
  pathData.approach_paths.forEach((ap) => allZ.push(...ap.path.map((p) => p[2])));
  if (pathData.missed_approach_path) {
    allZ.push(...pathData.missed_approach_path.path.map((p) => p[2]));
  }
  const minZ = allZ.length > 0 ? Math.min(...allZ) : 0;

  // ── 1. Animated 3D Approach Trails ──────────────────────────────────
  if (pathData.approach_paths.length > 0) {
    const tripData = pathData.approach_paths.map((ap, idx) => ({
      path: ap.path.map((p) => [p[0], p[1], Math.max(0, (p[2] - minZ) * ALT_EXAGGERATION)]),
      timestamps: ap.timestamps,
      color: APPROACH_COLORS[idx % APPROACH_COLORS.length],
      total_dist: ap.total_distance_nm,
      max_dist: pathData.max_distance_nm,
    }));

    layers.push(
      new TripsLayer({
        id: 'rnp-approach-trips-layer',
        data: tripData,
        getPath: (d: any) => d.path,
        getTimestamps: (d: any) => d.timestamps,
        getColor: (d: any) => d.color,
        opacity: 1,
        widthMinPixels: 6,
        jointRounded: true,
        capRounded: true,
        billboard: true,
        trailLength: pathData.max_distance_nm * 0.4,
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
        getColor: (d: any) => [...d.color, 60] as [number, number, number, number],
        opacity: 0.3,
        widthMinPixels: 3,
        jointRounded: true,
        billboard: true,
        trailLength: pathData.max_distance_nm * 2,
        currentTime: pathData.max_distance_nm,
      }),
    );
  }

  // ── 3. Missed Approach Path (Dashed line) ──────────────────────────────
  if (pathData.missed_approach_path && pathData.missed_approach_path.path.length >= 2) {
    const missedData = [
      {
        path: pathData.missed_approach_path.path.map((p) => [
          p[0],
          p[1],
          Math.max(0, (p[2] - minZ) * ALT_EXAGGERATION),
        ]),
      },
    ];

    layers.push(
      new PathLayer({
        id: 'rnp-missed-approach-layer',
        data: missedData,
        getPath: (d: any) => d.path,
        getColor: [255, 100, 80, 200], // Red-orange dashed
        widthMinPixels: 4,
        getDashArray: [8, 4],
        dashJustified: true,
        extensions: [new PathStyleExtension({ dash: true })],
      }),
    );
  }

  // ── 4. Waypoint markers (3D scatter) ───────────────────────────────
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

    // 4b. Waypoint name labels
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
