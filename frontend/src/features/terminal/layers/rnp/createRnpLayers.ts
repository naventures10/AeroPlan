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
import { ScatterplotLayer, TextLayer, PathLayer, IconLayer } from '@deck.gl/layers';
import type {
  RnpPath3d,
  RnpApproachPath,
  RnpWaypointMarker,
  RnpLeg,
  RnpHoldPattern,
} from '../../../../types';
import { RNP_ICON_ATLAS_URL, RNP_ICON_MAPPING } from './icons';

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

  // ── 0. Compute Leg Annotations ─────────────────────────────────────────
  interface LegAnnotation {
    position: [number, number, number];
    text: string;
    color: [number, number, number, number];
  }
  const legAnnotations: LegAnnotation[] = [];

  const getWpt = (ident: string | null) =>
    ident ? pathData.waypoints.find((w) => w.name === ident) : null;

  const processLegs = (legs: RnpLeg[], color: [number, number, number, number]) => {
    let prevWpt: RnpWaypointMarker | null = null;
    for (const leg of legs) {
      const curWpt = getWpt(leg.waypoint_ident);
      if (prevWpt && curWpt && (leg.distance || leg.course)) {
        // 1. Calculate segment distance if available
        let distNum = NaN;
        if (leg.distance) {
          distNum = parseFloat(leg.distance);
        }

        // Hide entirely if less than 1.0 NM
        if (!isNaN(distNum) && distNum < 1.0) {
          prevWpt = curWpt || prevWpt;
          continue;
        }

        const midLon = (prevWpt.position[0] + curWpt.position[0]) / 2;
        const midLat = (prevWpt.position[1] + curWpt.position[1]) / 2;
        const midAlt = (prevWpt.position[2] + curWpt.position[2]) / 2;

        // 2. Construct text based on length threshold using standard ASCII/avionics characters
        let text = '';
        const isShort = !isNaN(distNum) && distNum < 2.2;

        if (isShort) {
          // Compact single-line formatting: "↑ 024° / ↔ 1.5 NM"
          const parts: string[] = [];
          if (leg.course) {
            const match = leg.course.match(/^([\d.]+)/);
            if (match && match[0]) {
              const courseNum = Math.round(parseFloat(match[0]));
              parts.push(`↑ ${courseNum.toString().padStart(3, '0')}°`);
            } else {
              parts.push(`↑ ${leg.course}`);
            }
          }
          if (leg.distance) {
            const isMin = leg.distance.toLowerCase().includes('min');
            if (!isNaN(distNum)) {
              parts.push(`↔ ${distNum.toFixed(1)} ${isMin ? 'MIN' : 'NM'}`);
            } else {
              parts.push(`↔ ${leg.distance}`);
            }
          }
          text = parts.join(' / ');
        } else {
          // Full multi-line formatting
          if (leg.course) {
            const match = leg.course.match(/^([\d.]+)/);
            if (match && match[0]) {
              const courseNum = Math.round(parseFloat(match[0]));
              text += `↑ ${courseNum.toString().padStart(3, '0')}°\n`;
            } else {
              text += `↑ ${leg.course}\n`;
            }
          }
          if (leg.distance) {
            const isMin = leg.distance.toLowerCase().includes('min');
            if (!isNaN(distNum)) {
              text += `↔ ${distNum.toFixed(1)} ${isMin ? 'MIN' : 'NM'}\n`;
            } else {
              text += `↔ ${leg.distance}\n`;
            }
          }
          if (leg.path_descriptor) {
            text += `[${leg.path_descriptor}]`;
          }
        }

        legAnnotations.push({
          position: [midLon, midLat, midAlt],
          text: text.trim(),
          color,
        });
      }
      prevWpt = curWpt || prevWpt;
    }
  };

  pathData.approach_paths.forEach((ap) => {
    const isSelected = ap.entry_waypoint === selectedRnpApproachId;
    const isHovered = ap.entry_waypoint === hoveredRnpApproachId;
    if (isSelected || isHovered) {
      processLegs(ap.legs || [], [255, 50, 255, 255]);
    }
  });
  if (selectedRnpApproachId && pathData.missed_approach_path?.legs) {
    processLegs(pathData.missed_approach_path.legs, [255, 100, 80, 255]);
  }

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
        // 2a. Static Gradient Line for the Selected Route
        const selectedSegments: any[] = [];
        const pathPoints = selectedTrip.path;
        for (let i = 0; i < pathPoints.length - 1; i++) {
          const pStart = pathPoints[i];
          const pEnd = pathPoints[i + 1];
          selectedSegments.push({
            path: [pStart, pEnd],
            index: i,
            total: Math.max(1, pathPoints.length - 1),
          });
        }

        if (selectedSegments.length > 0) {
          layers.push(
            new PathLayer({
              id: 'rnp-selected-approach-static-gradient-layer',
              data: selectedSegments,
              getPath: (d: any) => d.path,
              getColor: (d: any) => {
                const ratio = d.index / d.total;
                const alpha = Math.round(40 + ratio * 160); // Fades from 40 (dim) to 200 (bright)
                return [...RGB_APPROACH, alpha] as [number, number, number, number];
              },
              getWidth: 3, // slightly thicker than unselected paths (2)
              widthMinPixels: 3,
              billboard: true,
              parameters: {
                blend: true,
              },
              pickable: false,
            }),
          );
        }

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

    if (missedPath3d.length > 0) {
      layers.push(
        new IconLayer({
          id: 'rnp-mapt-transition-marker-layer',
          data: [missedPath3d[0]],
          iconAtlas: RNP_ICON_ATLAS_URL,
          iconMapping: RNP_ICON_MAPPING,
          getPosition: (p: [number, number, number]) => [p[0], p[1], p[2] + 1.0],
          getIcon: () => 'fly-over',
          getSize: 18,
          getColor: [255, 100, 80, 255], // Missed approach orange-red
          pickable: false,
          billboard: true,
          opacity: opacity ?? 1,
          parameters: { depthTest: true },
        }),
      );

      layers.push(
        new TextLayer({
          id: 'rnp-mapt-transition-label-layer',
          data: [missedPath3d[0]],
          getPosition: (p: [number, number, number]) => [p[0], p[1], p[2] + 1.5],
          getText: () => 'MPAt',
          getSize: 10,
          getColor: [255, 100, 80, 255], // Missed approach orange-red
          opacity: opacity ?? 1,
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'bottom',
          getPixelOffset: [0, -14], // Float directly above the MAPt icon
          parameters: { depthTest: true },
          characterSet: 'auto',
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
  }

  // ── 3.5 Hold patterns (Lime Green) ──────────────────────
  const holdPatternsTripData = (pathData.hold_patterns || []).map((hp: RnpHoldPattern) => ({
    waypoint_ident: hp.waypoint_ident,
    path: hp.path.map((p: [number, number, number]) => [
      p[0],
      p[1],
      minZ + (p[2] - minZ) * ALT_EXAGGERATION + 2.5,
    ]),
  }));

  if (holdPatternsTripData.length > 0) {
    layers.push(
      new PathLayer({
        id: 'rnp-hold-patterns-layer',
        data: holdPatternsTripData,
        getPath: (d: any) => d.path,
        getColor: [50, 220, 80, 220], // Harmonies premium lime green
        getWidth: 3,
        widthMinPixels: 2,
        billboard: true,
        parameters: {
          blend: true,
        },
        pickable: false,
        opacity: opacity ?? 1,
      }),
    );

    // Hold pattern annotations (red-orange, matching missed approach)
    const holdAnnotations = (pathData.hold_patterns || []).map((hp: RnpHoldPattern) => {
      const lines: string[] = [];

      // Inbound course
      if (hp.inbound_course != null) {
        const courseStr = Math.round(hp.inbound_course).toString().padStart(3, '0');
        lines.push(`↑ ${courseStr}°`);
      }

      // Turn direction
      if (hp.turn_direction) {
        lines.push(hp.turn_direction === 'L' ? '⟲ Left' : '⟳ Right');
      }

      // Altitude
      if (hp.altitude_ft != null) {
        lines.push(`MNM ALT ${Math.round(hp.altitude_ft)}`);
      }

      // Hold time/distance
      if (hp.original_distance_str) {
        const distUpper = hp.original_distance_str.toUpperCase();
        if (distUpper.includes('MIN')) {
          const val = parseFloat(distUpper.replace('MIN', '').trim());
          if (!isNaN(val)) lines.push(`${val.toFixed(0)} MIN`);
        } else {
          lines.push(`${hp.leg_distance_nm.toFixed(1)} NM`);
        }
      } else {
        lines.push(`${hp.leg_distance_nm.toFixed(1)} NM`);
      }

      // Speed limit
      if (hp.speed_limit_kt != null) {
        lines.push(`MAX ${Math.round(hp.speed_limit_kt)} KT`);
      }

      // Position somewhere along the pattern (halfway through the path array)
      const ptIndex = Math.floor((hp.path.length || 1) / 2);
      const posPt = hp.path[ptIndex] ?? [0, 0, 0];
      return {
        position: [posPt[0], posPt[1], minZ + (posPt[2] - minZ) * ALT_EXAGGERATION + 4] as [
          number,
          number,
          number,
        ],
        text: lines.join('\n'),
      };
    });

    if (holdAnnotations.length > 0) {
      layers.push(
        new TextLayer({
          id: 'rnp-hold-annotations-layer',
          data: holdAnnotations,
          getPosition: (d: { position: [number, number, number] }) => d.position,
          getText: (d: { text: string }) => d.text,
          getSize: 10,
          getColor: [50, 220, 80, 255], // Green (matches hold pattern line)
          opacity: opacity ?? 1,
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'center',
          getPixelOffset: [0, -20],
          parameters: { depthTest: true },
          characterSet: 'auto',
          fontFamily: 'Geist, sans-serif',
          fontWeight: 600,
          outlineWidth: 3,
          outlineColor: [0, 0, 0, 255],
          fontSettings: { sdf: true },
          billboard: true,
          pickable: false,
        }),
      );
    }

    // ── Hold pattern directional arrows on straight legs ──────────────────
    // Path structure (steps=16): [0..16]=outbound arc, [17]=outbound end,
    // [18..34]=inbound arc, [35]=fix. Straight legs are [16]→[17] and [34]→[35].
    //
    // deck.gl getAngle is CCW from east (+x axis), so:
    //   angle = (90 - bearing + 360) % 360
    const STEPS = 16;
    const holdChevrons: Array<{
      position: [number, number, number];
      angle: number;
      label: string;
    }> = [];

    (pathData.hold_patterns || []).forEach((hp: RnpHoldPattern) => {
      if (!hp.path || hp.path.length < STEPS * 2 + 4) return;
      const inboundBearing = hp.inbound_course ?? 0;
      const outboundBearing = (inboundBearing + 180) % 360;

      // Outbound straight: midpoint between path[STEPS] and path[STEPS+1]
      const outA = hp.path[STEPS] ?? [0, 0, 0];
      const outB = hp.path[STEPS + 1] ?? [0, 0, 0];
      const outMid: [number, number, number] = [
        (outA[0] + outB[0]) / 2,
        (outA[1] + outB[1]) / 2,
        minZ + (((outA[2] + outB[2]) / 2 - minZ) * ALT_EXAGGERATION + 4),
      ];
      holdChevrons.push({
        position: outMid,
        angle: (90 - outboundBearing + 360) % 360,
        label: `${Math.round(outboundBearing).toString().padStart(3, '0')}°`,
      });

      // Inbound straight: midpoint between path[STEPS*2+2] and path[STEPS*2+3]
      const inA = hp.path[STEPS * 2 + 2] ?? [0, 0, 0];
      const inB = hp.path[STEPS * 2 + 3] ?? [0, 0, 0];
      const inMid: [number, number, number] = [
        (inA[0] + inB[0]) / 2,
        (inA[1] + inB[1]) / 2,
        minZ + (((inA[2] + inB[2]) / 2 - minZ) * ALT_EXAGGERATION + 4),
      ];
      holdChevrons.push({
        position: inMid,
        angle: (90 - inboundBearing + 360) % 360,
        label: `${Math.round(inboundBearing).toString().padStart(3, '0')}°`,
      });
    });

    if (holdChevrons.length > 0) {
      // Arrow chevron glyph
      layers.push(
        new TextLayer({
          id: 'rnp-hold-chevrons-layer',
          data: holdChevrons,
          getPosition: (d: (typeof holdChevrons)[0]) => d.position,
          getText: () => '▶',
          getAngle: (d: (typeof holdChevrons)[0]) => d.angle,
          getSize: 14,
          getColor: [50, 220, 80, 230],
          opacity: opacity ?? 1,
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'center',
          parameters: { depthTest: true },
          characterSet: 'auto',
          fontFamily: 'Geist, sans-serif',
          fontWeight: 900,
          outlineWidth: 3,
          outlineColor: [0, 0, 0, 200],
          fontSettings: { sdf: true },
          billboard: true,
          pickable: false,
        }),
      );
      // Course label beside each arrow
      layers.push(
        new TextLayer({
          id: 'rnp-hold-chevron-labels-layer',
          data: holdChevrons,
          getPosition: (d: (typeof holdChevrons)[0]) => d.position,
          getText: (d: (typeof holdChevrons)[0]) => d.label,
          getSize: 10,
          getColor: [50, 220, 80, 200],
          opacity: opacity ?? 1,
          getTextAnchor: 'start',
          getAlignmentBaseline: 'center',
          getPixelOffset: [16, 0],
          parameters: { depthTest: true },
          characterSet: 'auto',
          fontFamily: 'Geist, sans-serif',
          fontWeight: 600,
          outlineWidth: 3,
          outlineColor: [0, 0, 0, 255],
          fontSettings: { sdf: true },
          billboard: true,
          pickable: false,
        }),
      );
    }
  }

  // ── 4. Waypoint markers ───────────────────────────────
  if (pathData.waypoints.length > 0) {
    const isMapt = (d: RnpWaypointMarker) => {
      const role = d.role?.toUpperCase() || '';
      return role.includes('MAPT');
    };

    const isRunway = (d: RnpWaypointMarker) => {
      const role = d.role?.toUpperCase() || '';
      const name = d.name?.toUpperCase() || '';
      return !isMapt(d) && (role.includes('RWY') || role.includes('RW') || name.startsWith('RW'));
    };

    const excludeMapt = selectedRnpApproachId !== null;

    const runwayWaypoints = pathData.waypoints.filter(isRunway);
    const flybyWaypoints = pathData.waypoints.filter(
      (d) => !isRunway(d) && !(excludeMapt && isMapt(d)),
    );
    const labelWaypoints = pathData.waypoints.filter(
      (d) => !isRunway(d) && !(excludeMapt && isMapt(d)),
    );

    // 4a. Runway markers (flat 3D scatter)
    if (runwayWaypoints.length > 0) {
      layers.push(
        new ScatterplotLayer({
          id: 'rnp-rwy-markers-layer',
          data: runwayWaypoints,
          getPosition: (d: RnpWaypointMarker) => [
            d.position[0],
            d.position[1],
            minZ + (d.position[2] - minZ) * ALT_EXAGGERATION + 2.1,
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
    }

    // 4b. Fly-by markers (billboarded SDF Icons)
    if (flybyWaypoints.length > 0) {
      layers.push(
        new IconLayer({
          id: 'rnp-flyby-markers-layer',
          data: flybyWaypoints,
          iconAtlas: RNP_ICON_ATLAS_URL,
          iconMapping: RNP_ICON_MAPPING,
          getPosition: (d: RnpWaypointMarker) => [
            d.position[0],
            d.position[1],
            minZ + (d.position[2] - minZ) * ALT_EXAGGERATION + 3,
          ],
          getIcon: () => 'fly-by',
          getSize: 16, // Base pixel size
          getColor: (d: RnpWaypointMarker) => roleColor(d.role),
          pickable: pickable ?? true,
          opacity: opacity ?? 1,
          billboard: true,
          parameters: { depthTest: true },
        }),
      );
    }

    // 4c. Waypoint name labels
    layers.push(
      new TextLayer({
        id: 'rnp-waypoint-labels-layer',
        data: labelWaypoints,
        getPosition: (d: RnpWaypointMarker) => [
          d.position[0],
          d.position[1],
          minZ + (d.position[2] - minZ) * ALT_EXAGGERATION + 3.5,
        ],
        getText: (d: RnpWaypointMarker) => {
          let text = d.name;
          if (d.role) {
            const roleUpper = d.role.toUpperCase();
            const invalidRoles = ['TF', 'DF', 'CF', 'RF', 'IF_LEG', 'NONE'];
            if (!invalidRoles.includes(roleUpper) && !roleUpper.includes('NONE')) {
              text += `\n(${d.role})`;
            }
          }
          const altFt = Math.round(d.position[2] * 3.28084);
          if (altFt > 0) text += `\n${altFt} ft`;
          return text;
        },
        getSize: 10,
        getColor: [255, 255, 255, 220],
        opacity: opacity ?? 1,
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'bottom',
        getPixelOffset: [0, -20],
        parameters: { depthTest: true },
        characterSet: 'auto',
        fontFamily: 'Geist, sans-serif',
        fontWeight: 600,
        outlineWidth: 2,
        outlineColor: [0, 0, 0, 200],
        fontSettings: { sdf: true },
        billboard: true,
        pickable: false,
      }),
    );

    // 4d. Leg annotations (distance, course, descriptor)
    if (legAnnotations.length > 0) {
      layers.push(
        new TextLayer({
          id: 'rnp-leg-annotations-layer',
          data: legAnnotations,
          getPosition: (d: LegAnnotation) => [
            d.position[0],
            d.position[1],
            minZ + (d.position[2] - minZ) * ALT_EXAGGERATION + 3.5,
          ],
          getText: (d: LegAnnotation) => d.text,
          getSize: 9,
          getColor: (d: LegAnnotation) => d.color,
          opacity: opacity ?? 1,
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'center',
          getPixelOffset: [0, -22],
          parameters: { depthTest: true },
          characterSet: 'auto',
          fontFamily: 'Geist, sans-serif',
          fontWeight: 600,
          outlineWidth: 3,
          outlineColor: [0, 0, 0, 255],
          fontSettings: { sdf: true },
          billboard: true,
          pickable: false,
        }),
      );
    }
  }

  return layers;
}
