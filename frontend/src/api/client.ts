/**
 * Centralised API client.
 *
 * Every backend `fetch()` call in the app should go through this module
 * so that base URL, error handling, and typing are consistent.
 *
 * All return types are derived from the auto-generated OpenAPI types.
 */

import type {
  SearchResult,
  ChartItem,
  WeatherData,
  NotamData,
  DaylightRecord,
  GeoJsonFeatureCollection,
  AerodromeSectionResponse,
  RnpProcedureApi,
  RnpPath3d,
} from '../types';

const API_BASE = '/api/v1';

// ── Error class ─────────────────────────────────────────────────────────

/**
 * Structured API error with status, path, and response body.
 * Replaces the generic `new Error(...)` pattern so callers can inspect
 * the failure reason without parsing a string.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly body?: string;

  constructor(status: number, path: string, body?: string) {
    super(`API ${status}: ${path}`);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

// ── Generic helpers ─────────────────────────────────────────────────────

let _fetchId = 0;

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const id = ++_fetchId;
  const markName = `api-${id}`;
  performance.mark(`${markName}-start`);

  const res = await fetch(`${API_BASE}${path}`, { signal });
  if (!res.ok) {
    const body = await res.text().catch(() => undefined);
    throw new ApiError(res.status, path, body);
  }
  const data = await res.json();

  performance.mark(`${markName}-end`);
  performance.measure(`API GET ${path}`, `${markName}-start`, `${markName}-end`);

  return data;
}

async function getOrNull<T>(path: string): Promise<T | null> {
  const id = ++_fetchId;
  const markName = `api-${id}`;
  performance.mark(`${markName}-start`);

  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) return null;
  const data = await res.json();

  performance.mark(`${markName}-end`);
  performance.measure(`API GET ${path}`, `${markName}-start`, `${markName}-end`);

  return data;
}

// ── Aerodromes ──────────────────────────────────────────────────────────

export async function fetchAerodromes(): Promise<GeoJsonFeatureCollection> {
  return get<GeoJsonFeatureCollection>('/aerodromes');
}

export async function fetchAerodromeMetadata(
  icao: string,
): Promise<Record<string, unknown> | null> {
  const data = await getOrNull<Record<string, unknown>>(`/aerodromes/${icao}/metadata`);
  if (!data) return null;
  if (data.aip_document) return data.aip_document as Record<string, unknown>;
  if (data.data) return data;
  return null;
}

export async function fetchAerodromeSection(
  icao: string,
  sectionId: string,
): Promise<AerodromeSectionResponse> {
  const res = await fetch(`${API_BASE}/aerodromes/${icao}/section/${sectionId}`);
  if (res.status === 404) {
    return {
      section_id: sectionId,
      title: 'No Data for This Section',
      data_type: 'object',
      data: null,
    };
  }
  if (!res.ok) throw new ApiError(res.status, `/aerodromes/${icao}/section/${sectionId}`);
  return res.json();
}

export async function fetchCharts(icao: string): Promise<ChartItem[]> {
  try {
    return await get<ChartItem[]>(`/aerodromes/${icao}/charts`);
  } catch (err) {
    if (err instanceof ApiError) {
      console.warn(`[API] fetchCharts failed for ${icao}:`, err.message);
    }
    return [];
  }
}

// ── Global Search ───────────────────────────────────────────────────────

export async function searchAll(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  try {
    const data = await get<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`, signal);
    return data || [];
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    if (err instanceof ApiError) {
      console.warn('[API] searchAll failed:', err.message);
    }
    return [];
  }
}

// ── Weather & NOTAMs ────────────────────────────────────────────────────

export async function fetchWeather(icao: string): Promise<WeatherData | null> {
  return getOrNull<WeatherData>(`/weather/${icao}`);
}

export async function fetchNotams(icao: string): Promise<NotamData[]> {
  try {
    const res = await fetch(`${API_BASE}/notams/${icao}?active_only=true`);
    if (!res.ok) {
      console.warn(`[API] fetchNotams failed for ${icao}: HTTP ${res.status}`);
      return [];
    }
    return await res.json();
  } catch (err) {
    console.warn('[API] fetchNotams network error:', err);
    return [];
  }
}

export async function fetchAirspaceNotams(): Promise<NotamData[]> {
  try {
    const res = await fetch(`${API_BASE}/notams/airspace?active_only=true`);
    if (!res.ok) {
      console.warn(`[API] fetchAirspaceNotams failed: HTTP ${res.status}`);
      return [];
    }
    return await res.json();
  } catch (err) {
    console.warn('[API] fetchAirspaceNotams network error:', err);
    return [];
  }
}

export async function fetchDaylight(icao: string, date: string): Promise<DaylightRecord | null> {
  const data = await getOrNull<{ records?: DaylightRecord[] }>(`/daylight/${icao}?date=${date}`);
  return data?.records?.[0] || null;
}

// ── AIP Supplements ─────────────────────────────────────────────────────

export async function fetchAipSupplements(): Promise<import('../types').AipSupplement[]> {
  try {
    const data = await get<import('../types').AipSupplement[]>('/aip-supplements/');
    return data || [];
  } catch (err) {
    console.warn('[API] fetchAipSupplements error:', err);
    return [];
  }
}

// ── System Metadata ─────────────────────────────────────────────────────

export interface SystemAiracResponse {
  effective_date: string;
  next_date: string;
}

export async function fetchSystemAirac(): Promise<SystemAiracResponse | null> {
  return getOrNull<SystemAiracResponse>('/system/airac');
}

// ── ATS Routes ──────────────────────────────────────────────────────────

export async function fetchAtsRouteLabels(): Promise<GeoJsonFeatureCollection> {
  return get<GeoJsonFeatureCollection>('/ats-route-labels');
}

export async function fetchAtsRouteDetails(routeId: string): Promise<AtsRouteDetails | null> {
  return getOrNull<AtsRouteDetails>(`/ats-routes/${encodeURIComponent(routeId)}/details`);
}

// ── Navaids ─────────────────────────────────────────────────────────────

export async function fetchNavaidDetails(ident: string): Promise<NavAidDetails | null> {
  return getOrNull<NavAidDetails>(`/navaids/${encodeURIComponent(ident)}`);
}

// ── RNP Procedures (Terminal) ───────────────────────────────────────────

export async function fetchRnpProcedures(icao: string): Promise<RnpProcedureApi[]> {
  return get<RnpProcedureApi[]>(`/aerodromes/${icao.toUpperCase()}/rnp-procedures`);
}

export async function fetchRnpPath3d(procedureId: number): Promise<RnpPath3d | null> {
  return getOrNull<RnpPath3d>(`/rnp-procedures/${procedureId}/path3d`);
}

// ── Utils ───────────────────────────────────────────────────────────────

export function getProxyPdfUrl(originalUrl: string): string {
  return `${API_BASE}/proxy-pdf?url=${encodeURIComponent(originalUrl)}`;
}

// ── ATS Route Detail Types ──────────────────────────────────────────────

export interface AtsRouteWaypoint {
  sequence_number: number;
  waypoint_name: string;
  raw_coordinates: string | null;
  navaid_info: string | null;
}

export interface AtsRouteSegment {
  sequence_number: number;
  from_waypoint: string;
  to_waypoint: string;
  from_coordinates: string | null;
  to_coordinates: string | null;
  track_magnetic: string | null;
  distance_nm: number | null;
  upper_limit: string | null;
  lower_limit: string | null;
  airspace_class: string | null;
  moca: string | null;
  lateral_limits: string | null;
  direction_odd: string | null;
  direction_even: string | null;
}

export interface AtsRouteDetails {
  route_id: string;
  route_designator: string | null;
  route_type: string;
  remarks: string | null;
  total_distance_nm: number;
  waypoints: AtsRouteWaypoint[];
  segments: AtsRouteSegment[];
}

export interface NavAidDetails {
  station_name: string;
  ident: string;
  aid_type: string | null;
  frequency: string | null;
  hours_of_operation: string | null;
  elevation: string | null;
  remarks: string | null;
  raw_coordinates: string | null;
}
