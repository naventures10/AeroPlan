import { useState, useEffect } from 'react';
import { useMapStore } from '../../../store/useMapStore';
import type { FeatureCollection, Feature, Polygon, Point } from 'geojson';

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

export interface RunwaySpatialData {
  polygons: FeatureCollection<Polygon>;
  labels: FeatureCollection<Point>;
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

  // Edge c1→c2 (short end), c2→c3 (long, subdivided), c3→c4 (short end), c4→c1 (long, subdivided)
  ring.push(c2);

  for (let i = 1; i <= SUBDIVISIONS; i++) {
    const t = i / (SUBDIVISIONS + 1);
    ring.push([c2[0] + (c3[0] - c2[0]) * t, c2[1] + (c3[1] - c2[1]) * t]);
  }

  ring.push(c3);
  ring.push(c4);

  for (let i = 1; i <= SUBDIVISIONS; i++) {
    const t = i / (SUBDIVISIONS + 1);
    ring.push([c4[0] + (c1[0] - c4[0]) * t, c4[1] + (c1[1] - c4[1]) * t]);
  }

  ring.push(c1);
  return ring;
}

/**
 * Fetches runway physical characteristics for the active airport,
 * pairs reciprocal thresholds, and returns both polygons and label points.
 */
export function useRunwayPolygons(): RunwaySpatialData | null {
  const activeAirport = useMapStore((s) => s.activeAirport);
  const viewMode = useMapStore((s) => s.viewMode);
  const [data, setData] = useState<RunwaySpatialData | null>(null);

  useEffect(() => {
    if (!activeAirport || viewMode !== 'TERMINAL') {
      setData(null);
      return;
    }

    let cancelled = false;

    async function fetchAndBuild() {
      try {
        const res = await fetch(`/api/v1/aerodromes/${activeAirport}/section/AD_2_12`);
        if (!res.ok) {
          setData(null);
          return;
        }

        const json = await res.json();
        const runways: RunwayEntry[] = json.data ?? [];

        if (runways.length === 0) {
          setData(null);
          return;
        }

        const byDesignation = new Map<string, RunwayEntry>();
        for (const rwy of runways) {
          byDesignation.set(rwy.designation, rwy);
        }

        const paired = new Set<string>();
        const polygonFeatures: Feature<Polygon>[] = [];
        const labelFeatures: Feature<Point>[] = [];

        for (const rwy of runways) {
          if (paired.has(rwy.designation)) continue;

          const recipDesig = reciprocal(rwy.designation);
          const recipRwy = byDesignation.get(recipDesig);

          if (
            !recipRwy ||
            rwy.coordinates.decimal_lat === null ||
            rwy.coordinates.decimal_lng === null ||
            recipRwy.coordinates.decimal_lat === null ||
            recipRwy.coordinates.decimal_lng === null
          ) {
            continue;
          }

          paired.add(rwy.designation);
          paired.add(recipDesig);

          const widthM = parseWidthM(rwy.dimensions);
          const ring = buildRunwayRect(
            rwy.coordinates.decimal_lat,
            rwy.coordinates.decimal_lng,
            recipRwy.coordinates.decimal_lat,
            recipRwy.coordinates.decimal_lng,
            widthM,
          );

          // Calculate bearings for labels (0-360)
          const midLat = (rwy.coordinates.decimal_lat + recipRwy.coordinates.decimal_lat) / 2;
          const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(midLat * (Math.PI / 180));

          const dLat =
            (recipRwy.coordinates.decimal_lat - rwy.coordinates.decimal_lat) * METERS_PER_DEG_LAT;
          const dLng =
            (recipRwy.coordinates.decimal_lng - rwy.coordinates.decimal_lng) * metersPerDegLng;

          // Bearing from THR A to THR B
          const bearingAToB = (Math.atan2(dLng, dLat) * 180) / Math.PI;
          const bearingBToA = (bearingAToB + 180) % 360;

          polygonFeatures.push({
            type: 'Feature',
            properties: {
              designation: `${rwy.designation}/${recipDesig}`,
              width_m: widthM,
            },
            geometry: {
              type: 'Polygon',
              coordinates: [ring],
            },
          });

          // Add threshold points for labels
          labelFeatures.push({
            type: 'Feature',
            properties: {
              label: rwy.designation,
              bearing: bearingAToB,
            },
            geometry: {
              type: 'Point',
              coordinates: [rwy.coordinates.decimal_lng, rwy.coordinates.decimal_lat],
            },
          });

          labelFeatures.push({
            type: 'Feature',
            properties: {
              label: recipDesig,
              bearing: bearingBToA,
            },
            geometry: {
              type: 'Point',
              coordinates: [recipRwy.coordinates.decimal_lng, recipRwy.coordinates.decimal_lat],
            },
          });
        }

        if (!cancelled) {
          setData({
            polygons: { type: 'FeatureCollection', features: polygonFeatures },
            labels: { type: 'FeatureCollection', features: labelFeatures },
          });
        }
      } catch (err) {
        console.error('[useRunwayPolygons] Failed to fetch runway data:', err);
        if (!cancelled) setData(null);
      }
    }

    fetchAndBuild();
    return () => {
      cancelled = true;
    };
  }, [activeAirport, viewMode]);

  return data;
}
