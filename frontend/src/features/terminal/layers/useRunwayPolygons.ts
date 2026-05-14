import { useState, useEffect } from 'react';
import { useMapStore } from '../../../store/useMapStore';
import type { FeatureCollection, Feature, Polygon } from 'geojson';

/** Default runway width in meters when dimensions data is unavailable */
const DEFAULT_WIDTH_M = 45;

/** Meters per degree of latitude (approximate) */
const METERS_PER_DEG_LAT = 111_320;

interface RunwayEntry {
  designation: string;
  coordinates: {
    decimal_lat: number | null;
    decimal_lng: number | null;
  };
  dimensions?: string;
  thr_elevation?: string;
}

/**
 * Parse the width in meters from a dimensions string like "1850 x 45 M".
 * Returns the second number (width). Falls back to DEFAULT_WIDTH_M.
 */
function parseWidthM(dimensions?: string): number {
  if (!dimensions) return DEFAULT_WIDTH_M;
  const match = dimensions.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
  return match ? Number(match[2]) : DEFAULT_WIDTH_M;
}

/**
 * Extract a numeric elevation (meters) from a threshold elevation string
 * like "THR: 1126.6FT\nTDZ:". Returns elevation in feet divided by 3.28084 to meters.
 */
function parseElevationM(thrElev?: string): number {
  if (!thrElev) return 0;
  const match = thrElev.match(/([\d.]+)\s*FT/i);
  return match ? Number(match[1]) / 3.28084 : 0;
}

/**
 * Compute the reciprocal runway designation.
 *   08  → 26    (number + 18, wrap at 36)
 *   09L → 27R   (L↔R swap)
 *   09C → 27C   (C stays)
 */
function reciprocal(designation: string): string {
  const match = designation.match(/^(\d{2})\s*([LCR])?$/);
  if (!match) return '';

  const num = parseInt(match[1]!, 10);
  const suffix = match[2] ?? '';

  let recipNum = num + 18;
  if (recipNum > 36) recipNum -= 36;

  const recipSuffix = suffix === 'L' ? 'R' : suffix === 'R' ? 'L' : suffix;
  return String(recipNum).padStart(2, '0') + recipSuffix;
}

/**
 * Build a rectangular polygon from two threshold coordinates and a width.
 *
 * The rectangle is constructed by offsetting each threshold point
 * perpendicular to the runway centreline by ±(width/2).
 *
 * Intermediate vertices are inserted along the long edges to prevent
 * jagged tessellation artifacts in MapLibre's fill-extrusion renderer.
 */
function buildRunwayRect(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  widthM: number,
): [number, number][] {
  const halfW = widthM / 2;

  // Convert degree deltas to metric space for correct bearing
  const midLat = (lat1 + lat2) / 2;
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(midLat * (Math.PI / 180));

  const dLatM = (lat2 - lat1) * METERS_PER_DEG_LAT;
  const dLngM = (lng2 - lng1) * metersPerDegLng;

  // Bearing angle of the centreline in metric space
  const angle = Math.atan2(dLngM, dLatM);

  // Perpendicular offset in degrees
  const perpAngle = angle + Math.PI / 2;
  const offsetLat = (halfW / METERS_PER_DEG_LAT) * Math.cos(perpAngle);
  const offsetLng = (halfW / metersPerDegLng) * Math.sin(perpAngle);

  // Corner points
  const c1: [number, number] = [lng1 - offsetLng, lat1 - offsetLat];
  const c2: [number, number] = [lng1 + offsetLng, lat1 + offsetLat];
  const c3: [number, number] = [lng2 + offsetLng, lat2 + offsetLat];
  const c4: [number, number] = [lng2 - offsetLng, lat2 - offsetLat];

  // Subdivide long edges for smoother fill-extrusion tessellation
  const SUBDIVISIONS = 8;
  const ring: [number, number][] = [c1];

  // Edge c1→c4 (left side)
  // Edge c2→c3 (right side) — we'll build right side separately
  // Build: c1 → c2 (short end), c2 → c3 (long, subdivided), c3 → c4 (short end), c4 → c1 (long, subdivided)

  ring.push(c2); // short end

  // c2 → c3 (long edge, subdivided)
  for (let i = 1; i <= SUBDIVISIONS; i++) {
    const t = i / (SUBDIVISIONS + 1);
    ring.push([c2[0] + (c3[0] - c2[0]) * t, c2[1] + (c3[1] - c2[1]) * t]);
  }

  ring.push(c3); // corner
  ring.push(c4); // short end

  // c4 → c1 (long edge, subdivided)
  for (let i = 1; i <= SUBDIVISIONS; i++) {
    const t = i / (SUBDIVISIONS + 1);
    ring.push([c4[0] + (c1[0] - c4[0]) * t, c4[1] + (c1[1] - c4[1]) * t]);
  }

  ring.push(c1); // close ring

  return ring;
}

/**
 * Fetches runway physical characteristics for the active airport,
 * pairs reciprocal thresholds, and returns a GeoJSON FeatureCollection
 * of rectangular runway polygons.
 */
export function useRunwayPolygons(): FeatureCollection<Polygon> | null {
  const activeAirport = useMapStore((s) => s.activeAirport);
  const viewMode = useMapStore((s) => s.viewMode);
  const [geojson, setGeojson] = useState<FeatureCollection<Polygon> | null>(null);

  useEffect(() => {
    if (!activeAirport || viewMode !== 'TERMINAL') {
      setGeojson(null);
      return;
    }

    let cancelled = false;

    async function fetchAndBuild() {
      try {
        const res = await fetch(`/api/v1/aerodromes/${activeAirport}/section/AD_2_12`);
        if (!res.ok) {
          setGeojson(null);
          return;
        }

        const json = await res.json();
        const runways: RunwayEntry[] = json.data ?? [];

        if (runways.length === 0) {
          setGeojson(null);
          return;
        }

        // Index by designation for fast lookup
        const byDesignation = new Map<string, RunwayEntry>();
        for (const rwy of runways) {
          byDesignation.set(rwy.designation, rwy);
        }

        const paired = new Set<string>();
        const features: Feature<Polygon>[] = [];

        for (const rwy of runways) {
          if (paired.has(rwy.designation)) continue;

          const recipDesig = reciprocal(rwy.designation);
          const recipRwy = byDesignation.get(recipDesig);

          if (
            !recipRwy ||
            !rwy.coordinates.decimal_lat ||
            !rwy.coordinates.decimal_lng ||
            !recipRwy.coordinates.decimal_lat ||
            !recipRwy.coordinates.decimal_lng
          ) {
            continue;
          }

          paired.add(rwy.designation);
          paired.add(recipDesig);

          const widthM = parseWidthM(rwy.dimensions);
          const elevA = parseElevationM(rwy.thr_elevation);
          const elevB = parseElevationM(recipRwy.thr_elevation);
          const avgElevM = (elevA + elevB) / 2;

          const ring = buildRunwayRect(
            rwy.coordinates.decimal_lat,
            rwy.coordinates.decimal_lng,
            recipRwy.coordinates.decimal_lat,
            recipRwy.coordinates.decimal_lng,
            widthM,
          );

          features.push({
            type: 'Feature',
            properties: {
              designation: `${rwy.designation}/${recipDesig}`,
              width_m: widthM,
              elevation_m: avgElevM,
            },
            geometry: {
              type: 'Polygon',
              coordinates: [ring],
            },
          });
        }

        if (!cancelled) {
          setGeojson({
            type: 'FeatureCollection',
            features,
          });
        }
      } catch (err) {
        console.error('[useRunwayPolygons] Failed to fetch runway data:', err);
        if (!cancelled) setGeojson(null);
      }
    }

    fetchAndBuild();
    return () => {
      cancelled = true;
    };
  }, [activeAirport, viewMode]);

  return geojson;
}
