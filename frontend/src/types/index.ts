/**
 * Shared TypeScript interfaces used across the frontend application.
 * Centralised here to avoid duplicating type definitions in individual components.
 */

// ── View / Map types ────────────────────────────────────────────────────

export type ViewMode = 'ENROUTE' | 'TERMINAL';

export interface ActiveLayers {
  aerodromes: boolean;
  waypoints: boolean;
  navaids: boolean;
  atsRoutes: boolean;
  wacMap: boolean;
}

// ── Global Search ───────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  name: string;
  type: 'AERODROME' | 'NAVAID' | 'WAYPOINT' | 'ATS_ROUTE';
  center: [number, number] | null;
  bounds: [number, number, number, number] | null;
  route_type?: string;
  properties?: Record<string, any>;
}

// ── Aerodrome Charts ────────────────────────────────────────────────────

export interface ChartItem {
  chart_id: number;
  chart_title: string;
  chart_index: string;
  chart_url: string;
}

// ── Terminal Dashboard — Weather ────────────────────────────────────────

export interface WeatherData {
  icao: string;
  metar: string | null;
  taf: string[][];
  source: string;
  fetched_at: string;
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

// ── Terminal Dashboard — NOTAMs ─────────────────────────────────────────

export interface NotamData {
  notam_id: string;
  source_file: string;
  series: string;
  scope: string;
  fir: string;
  combined_fir: string | null;
  airport_icao: string | null;
  valid_from: string | null;
  valid_to: string | null;
  is_permanent: boolean;
  is_estimated: boolean;
  duration_category: string;
  description: string;
}

// ── Terminal Dashboard — Daylight ───────────────────────────────────────

export interface DaylightRecord {
  date: string;
  twilight_from: string; // MCT
  sunrise: string;
  sunset: string;
  twilight_to: string;   // ECT
}
