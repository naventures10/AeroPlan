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
} from '../types';

const API_BASE = '/api';

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

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal });
  if (!res.ok) {
    const body = await res.text().catch(() => undefined);
    throw new ApiError(res.status, path, body);
  }
  return res.json();
}

async function getOrNull<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) return null;
  return res.json();
}

// ── Aerodromes ──────────────────────────────────────────────────────────

export async function fetchAerodromes(): Promise<GeoJsonFeatureCollection> {
  return get<GeoJsonFeatureCollection>('/aerodromes');
}

export async function fetchAerodromeMetadata(icao: string): Promise<Record<string, unknown> | null> {
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
    return { section_id: sectionId, title: 'No Data for This Section', data_type: 'object', data: null };
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

export async function fetchDaylight(
  icao: string,
  date: string,
): Promise<DaylightRecord | null> {
  const data = await getOrNull<{ records?: DaylightRecord[] }>(`/daylight/${icao}?date=${date}`);
  return data?.records?.[0] || null;
}

// ── ATS Routes ──────────────────────────────────────────────────────────

export async function fetchAtsRouteLabels(): Promise<GeoJsonFeatureCollection> {
  return get<GeoJsonFeatureCollection>('/ats-route-labels');
}
