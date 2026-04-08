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
