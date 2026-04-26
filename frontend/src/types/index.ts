/**
 * Shared TypeScript interfaces used across the frontend application.
 *
 * API response types are auto-generated from the backend OpenAPI spec.
 * Frontend-only types (view state, parsed data) are defined here manually.
 *
 * To regenerate API types:  npm run generate:types
 */

import type { components } from './api.generated';

// ── Re-exported API Types (single source of truth from backend) ─────────

/** GeoJSON Feature Collection returned by spatial endpoints */
export type GeoJsonFeatureCollection = components['schemas']['GeoJsonFeatureCollection'];
export type GeoJsonFeature = components['schemas']['GeoJsonFeature'];

/** Search result from /api/search */
export type SearchResult = components['schemas']['SearchResultResponse'];

/** Chart item from /api/aerodromes/{icao}/charts */
export type ChartItem = components['schemas']['ChartResponse'];

/** Weather data from /api/weather/{icao} */
export type WeatherData = components['schemas']['WeatherResponse'];

/** NOTAM data from /api/notams/{icao} */
export type NotamData = components['schemas']['NotamResponse'];

/** Daylight record from /api/daylight/{icao} */
export type DaylightRecord = components['schemas']['DaylightRecord'];

/** Full daylight response envelope */
export type DaylightResponse = components['schemas']['DaylightResponse'];

/** Aerodrome section response from /api/aerodromes/{icao}/section/{id} */
export type AerodromeSectionResponse = components['schemas']['AerodromeSectionResponse'];

// ── Frontend-Only Types (not in the API contract) ───────────────────────

export type ViewMode = 'ENROUTE' | 'TERMINAL';

export interface ActiveLayers {
  aerodromes: boolean;
  waypoints: boolean;
  navaids: boolean;
  atsRoutes: boolean;
  wacMap: boolean;
}

export interface ParsedMetar {
  windDir: string | null;
  windSpeed: string | null;
  windUnit: string | null;
  visibility: string | null;
  clouds: string[];
  temp: number | null;
  dew: number | null;
  qnh: number | null;
}

// ── RNP Prodecures (Terminal) ───────────────────────────────────────────

export interface RnpProcedureApi {
  procedure_id: number;
  name: string;
  runway: string | null;
  procedure_type: string | null;
  chart_key: string;
  min_lng: number | null;
  min_lat: number | null;
  max_lng: number | null;
  max_lat: number | null;
}

export interface RnpWaypointMarker {
  name: string;
  position: [number, number, number]; // [lon, lat, alt_m]
  role: string | null;
}

export interface RnpApproachPath {
  label: string;
  entry_waypoint: string;
  path: [number, number, number][];
  timestamps: number[];
  total_distance_nm: number;
  segment_type: string;
}

export interface RnpMissedApproachPath {
  path: [number, number, number][];
  timestamps: number[];
  total_distance_nm: number;
}

export interface RnpPath3d {
  procedure_id: number;
  name: string;
  airport_id: string;
  runway: string;
  approach_paths: RnpApproachPath[];
  missed_approach_path: RnpMissedApproachPath | null;
  max_distance_nm: number;
  waypoints: RnpWaypointMarker[];
}
