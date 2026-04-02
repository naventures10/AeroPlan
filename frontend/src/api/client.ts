/**
 * Centralised API client.
 *
 * Every backend `fetch()` call in the app should go through this module
 * so that base URL, error handling, and typing are consistent.
 */

import type { SearchResult, ChartItem, WeatherData, NotamData, DaylightRecord } from '../types';

const API_BASE = '/api';

// ── Generic helpers ─────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

async function getOrNull<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) return null;
  return res.json();
}

// ── Aerodromes ──────────────────────────────────────────────────────────

export async function fetchAerodromes(): Promise<any> {
  return get('/aerodromes');
}

export async function fetchAerodromeMetadata(icao: string): Promise<any | null> {
  const data = await getOrNull<any>(`/aerodromes/${icao}/metadata`);
  if (!data) return null;
  if (data.aip_document) return data.aip_document;
  if (data.data) return data;
  return null;
}

export async function fetchAerodromeSection(
  icao: string,
  sectionId: string,
): Promise<{ title: string; data_type: string; data: any }> {
  const res = await fetch(`${API_BASE}/aerodromes/${icao}/section/${sectionId}`);
  if (res.status === 404) {
    return { title: 'No Data for This Section', data_type: 'object', data: null };
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchCharts(icao: string): Promise<ChartItem[]> {
  try {
    const data = await get<ChartItem[] | any>(`/aerodromes/${icao}/charts`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ── Global Search ───────────────────────────────────────────────────────

export async function searchAll(query: string): Promise<SearchResult[]> {
  try {
    const data = await get<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`);
    return data || [];
  } catch {
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
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export async function fetchDaylight(
  icao: string,
  date: string,
): Promise<DaylightRecord | null> {
  const data = await getOrNull<any>(`/daylight/${icao}?date=${date}`);
  return data?.records?.[0] || null;
}
