/**
 * RNP Approach Path — 3D TripsLayer + Waypoint markers
 *
 * Renders the RNP procedure as animated 3D descent paths using DeckGL's
 * TripsLayer (for the glowing trails) plus a PathLayer for missed approach,
 * and ScatterplotLayer for waypoint markers at their 3D positions.
 *
 * Now uses static clickable paths for approach, showing animation only for the selected one.
 */

import { TripsLayer } from '@deck.gl/geo-layers';
import { ScatterplotLayer, TextLayer, PathLayer } from '@deck.gl/layers';
import type { RnpPath3d, RnpApproachPath, RnpWaypointMarker } from '../../../types';

/** Altitude exaggeration — makes the vertical offset visually prominent */
const ALT_EXAGGERATION = 3;

/** Base magenta color for RNP approach paths */
const RGB_APPROACH: [number, number, number] = [255, 0, 255]; // Magenta

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

// ── Missed Approach Dash Geometry Helpers ───────────────────────────────────

/** Dash length along the path (NM) */
const MISSED_DASH_NM = 0.35;
/** Gap length between dashes (NM) */
const MISSED_GAP_NM = 0.18;

/**
 * Linearly interpolates a 3D position along `path` at cumulative distance `t` NM.
 * Uses the `timestamps` array (cumulative NM per vertex) for fast lookup.
 */
function pathPosAt(path: number[][], timestamps: number[], t: number): number[] {
  const firstTs = timestamps[0] as number;
  const lastTs = timestamps[timestamps.length - 1] as number;
  if (t <= firstTs) return [...(path[0] ?? [])];
  if (t >= lastTs) return [...(path[path.length - 1] ?? [])];
  for (let i = 1; i < timestamps.length; i++) {
    const tCurr = timestamps[i] as number;
    const tPrev = timestamps[i - 1] as number;
    if (tCurr >= t) {
      // Guard against divide by zero if two points have identical coordinates
      if (tCurr === tPrev) return [...(path[i] ?? [])];

      const frac = (t - tPrev) / (tCurr - tPrev);
      const a = path[i - 1] as number[];
      const b = path[i] as number[];
      return [
        (a[0] as number) + frac * ((b[0] as number) - (a[0] as number)),
        (a[1] as number) + frac * ((b[1] as number) - (a[1] as number)),
        (a[2] as number) + frac * ((b[2] as number) - (a[2] as number)),
      ];
    }
  }
  return [...(path[path.length - 1] ?? [])];
}

/**
 * Pre-computes dash sub-paths along a 3D path up to `upToNm` NM.
 *
 * Each dash is a small array of 3D coordinates following the curved path.
 * Intermediate vertices between the dash start/end are included so the dash
 * hugs curves correctly. Every dash is exactly MISSED_DASH_NM long (or shorter
 * at the very end) — no per-segment compression artifacts.
 */
function computeMissedDashes(
  path: number[][],
  timestamps: number[],
  totalNm: number,
  upToNm: number,
): number[][][] {
  const period = MISSED_DASH_NM + MISSED_GAP_NM;
  const dashes: number[][][] = [];
  let t = 0;

  while (t < upToNm && t < totalNm) {
    const start = t;
    const end = Math.min(t + MISSED_DASH_NM, totalNm, upToNm);

    if (end > start) {
      // Build this dash's polygon: interpolated start, interior vertices, interpolated end
      const pts: number[][] = [pathPosAt(path, timestamps, start)];
      for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i] as number;
        if (ts > start + 1e-6 && ts < end - 1e-6) {
          pts.push([...(path[i] as number[])]);
        }
      }
      pts.push(pathPosAt(path, timestamps, end));
      dashes.push(pts);
    }

    t += period;
  }

  return dashes;
}

export interface RnpContext {
  pathData: RnpPath3d | null;
  selectedRnpApproachId: string | null;
  hoveredRnpApproachId?: string | null;
  setSelectedRnpApproachId: (id: string | null) => void;
  rnpCurrentTime: number;
  /** Cumulative NM at which the approach animation reaches the RW waypoint.
   *  After this point the missed approach phase begins. */
  approachDist: number;
  pickable?: boolean;
  opacity?: number;
}

/**
 * Build DeckGL layers for the active RNP procedure.
 */
export function createRnpLayers({
  pathData,
  selectedRnpApproachId,
  hoveredRnpApproachId,
  setSelectedRnpApproachId,
  rnpCurrentTime,
  approachDist,
  pickable,
  opacity,
}: RnpContext): any[] {
  if (!pathData) return [];

  const layers: any[] = [];

  // Find the lowest altitude (usually the runway / MAPt) to anchor the exaggeration
  // so the path touches the real MapLibre map plane at Z=0.
  let minZ = Infinity;
  pathData.approach_paths.forEach((ap: RnpApproachPath) => {
    ap.path.forEach((p: [number, number, number]) => {
      if (p[2] < minZ) minZ = p[2];
    });
  });
  if (pathData.missed_approach_path) {
    pathData.missed_approach_path.path.forEach((p: [number, number, number]) => {
      if (p[2] < minZ) minZ = p[2];
    });
  }
  if (minZ === Infinity) minZ = 0;

  // Transform approach paths by adding exaggeration
  const approachTripData = pathData.approach_paths.map((ap: RnpApproachPath) => ({
    entry_waypoint: ap.entry_waypoint,
    path: ap.path.map((p: [number, number, number]) => [
      p[0],
      p[1],
      minZ + (p[2] - minZ) * ALT_EXAGGERATION + 2,
    ]),
    timestamps: ap.timestamps,
    total_dist: ap.total_distance_nm,
  }));

  if (approachTripData.length > 0) {
    // ── 1. Static 3D Approach Linestrings (Clickable) ───────────────────
    layers.push(
      new PathLayer({
        id: 'rnp-approach-linestrings-layer',
        data: approachTripData.filter((d) => d.entry_waypoint !== selectedRnpApproachId),
        getPath: (d: any) => d.path,
        getColor: (d: any) => {
          const isHovered = d.entry_waypoint === hoveredRnpApproachId;

          if (isHovered) {
            return [255, 255, 255, 255]; // Full bright white on hover
          }

          if (selectedRnpApproachId === null) {
            // Nothing selected: show all magenta paths
            return [...RGB_APPROACH, 160] as [number, number, number, number];
          }

          // Others: dimmed magenta
          return [...RGB_APPROACH, 30] as [number, number, number, number];
        },
        getWidth: (d: any) => (d.entry_waypoint === hoveredRnpApproachId ? 6 : 2),
        widthMinPixels: 2,
        billboard: true, // Harmonize with TripsLayer to prevent 3D offset
        parameters: {
          blend: true,
        },
        pickable: pickable ?? true,
        opacity: opacity ?? 1,
        onClick: (info: any) => {
          if (info.object && info.object.entry_waypoint) {
            const entry = info.object.entry_waypoint;
            setSelectedRnpApproachId(selectedRnpApproachId === entry ? null : entry);
          } else {
            setSelectedRnpApproachId(null);
          }
        },
        visible: true,
        updateTriggers: {
          getColor: [selectedRnpApproachId, hoveredRnpApproachId],
          getWidth: [selectedRnpApproachId, hoveredRnpApproachId],
        },
      }),
    );

    // ── 2. Animated 3D Approach Trail (Only for Selected) ───────────────
    if (selectedRnpApproachId) {
      const selectedTrip = approachTripData.find((t) => t.entry_waypoint === selectedRnpApproachId);

      if (selectedTrip) {
        // Clamp the approach head to approachDist so it freezes at the RW waypoint
        // once the missed approach phase begins (rnpCurrentTime > approachDist).
        const approachTime = Math.min(
          rnpCurrentTime,
          approachDist > 0 ? approachDist : rnpCurrentTime,
        );

        layers.push(
          new TripsLayer({
            id: 'rnp-approach-trips-layer',
            data: [selectedTrip],
            getPath: (d: any) => d.path.map((p: any) => [p[0], p[1], p[2] + 0.5]), // Tiny lift above static paths
            getTimestamps: (d: any) => d.timestamps,
            getColor: RGB_APPROACH,
            opacity: opacity ?? 1,
            widthMinPixels: 4,
            pickable: false, // TripsLayer is usually not pickable for procedure selection
            jointRounded: true,
            capRounded: true,
            billboard: true,
            trailLength: Math.min(selectedTrip.total_dist * 0.4, 250),
            currentTime: approachTime,
          }),
        );
      }
    }
  }

  // ── 3. Missed Approach — static dashed path ──────────────────────
  // We walk the 3D path in NM-space and slice it into fixed-length dash segments.
  // Each dash is a real path geometry so they follow curves and
  // are always the same NM length.
  if (
    selectedRnpApproachId &&
    pathData.missed_approach_path &&
    pathData.missed_approach_path.path.length >= 2
  ) {
    const missedDist = pathData.missed_approach_path.total_distance_nm;
    const missedTimestamps = pathData.missed_approach_path.timestamps;

    const missedPath3d = pathData.missed_approach_path.path.map((p: [number, number, number]) => [
      p[0],
      p[1],
      minZ + (p[2] - minZ) * ALT_EXAGGERATION + 2,
    ]);

    // All dashes along the full route
    const allDashes = computeMissedDashes(missedPath3d, missedTimestamps, missedDist, missedDist);

    if (allDashes.length > 0) {
      layers.push(
        new PathLayer({
          id: 'rnp-missed-approach-static-layer',
          data: allDashes.map((seg) => ({ path: seg.map((p: any) => [p[0], p[1], p[2] + 0.1]) })),
          getPath: (d: any) => d.path,
          getColor: [255, 100, 80, 200],
          opacity: opacity ?? 1,
          getWidth: 4,
          widthMinPixels: 2,
          pickable: false,
          billboard: true,
          capRounded: true,
          jointRounded: true,
        }),
      );
    }
  }

  // ── 4. Waypoint markers (3D scatter) ───────────────────────────────
  if (pathData.waypoints.length > 0) {
    layers.push(
      new ScatterplotLayer({
        id: 'rnp-waypoint-markers-layer',
        data: pathData.waypoints,
        getPosition: (d: RnpWaypointMarker) => [
          d.position[0],
          d.position[1],
          minZ + (d.position[2] - minZ) * ALT_EXAGGERATION + 2,
        ],
        getRadius: 80,
        radiusUnits: 'meters',
        getFillColor: (d: RnpWaypointMarker) => roleColor(d.role),
        getLineColor: [255, 255, 255, 180],
        lineWidthMinPixels: 1,
        stroked: true,
        filled: true,
        pickable: pickable ?? true,
        opacity: opacity ?? 1,
      }),
    );

    // 4b. Waypoint name labels
    layers.push(
      new TextLayer({
        id: 'rnp-waypoint-labels-layer',
        data: pathData.waypoints,
        getPosition: (d: RnpWaypointMarker) => [
          d.position[0],
          d.position[1],
          minZ + (d.position[2] - minZ) * ALT_EXAGGERATION + 2,
        ],
        getText: (d: RnpWaypointMarker) => d.name,
        getSize: 13,
        getColor: [255, 255, 255, 220],
        opacity: opacity ?? 1,
        getTextAnchor: 'start',
        getAlignmentBaseline: 'center',
        getPixelOffset: [12, 0],
        fontFamily: 'Geist, sans-serif',
        fontWeight: 600,
        outlineWidth: 2,
        outlineColor: [0, 0, 0, 200],
        fontSettings: { sdf: true },
        billboard: true,
        pickable: false,
      }),
    );
  }

  return layers;
}
