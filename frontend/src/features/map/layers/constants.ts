/**
 * Shared constants for DeckGL layers.
 *
 * Centralises magic colors, zoom thresholds, and reusable extension
 * singletons so every layer factory draws from one palette.
 */

import { CollisionFilterExtension } from '@deck.gl/extensions';

// ── Color Palette (RGBA tuples) ──────────────────────────────────────

export const COLOR_WHITE: [number, number, number, number] = [255, 255, 255, 255];
export const COLOR_NEON_CYAN: [number, number, number, number] = [0, 255, 255, 255];
export const COLOR_EMERALD: [number, number, number, number] = [52, 211, 153, 255];
export const COLOR_NEON_PURPLE: [number, number, number, number] = [192, 132, 252, 255];
export const COLOR_LIME_GREEN: [number, number, number, number] = [50, 205, 50, 255];
export const COLOR_ATS_CYAN: [number, number, number, number] = [34, 211, 238, 255];

// RGB-only variants (for colour math in label glow calculations)
export const RGB_NEON_PURPLE: [number, number, number] = [192, 132, 252];
export const RGB_LIME_GREEN: [number, number, number] = [50, 205, 50];
export const RGB_ATS_CYAN: [number, number, number] = [34, 211, 238];
export const RGB_WHITE: [number, number, number] = [255, 255, 255];

// ── Zoom Thresholds ──────────────────────────────────────────────────

/** Zoom level above which standalone waypoint labels are visible */
export const ZOOM_WAYPOINTS = 7.0;

/** Zoom level above which ATS route waypoint labels are visible */
export const ZOOM_ATS_WAYPOINTS = 7.5;

/** Zoom level above which navaid text labels are visible */
export const ZOOM_NAVAIDS = 2.5;

// ── Deck.gl Extensions (singleton instances) ─────────────────────────

const COLLISION_FILTER_EXTENSION = new CollisionFilterExtension();
export const EXTENSIONS = [COLLISION_FILTER_EXTENSION];

// ── Utilities ────────────────────────────────────────────────────────

/**
 * Parse the Postgres-array-style `route_ids` property from an MVT feature
 * into a clean string array.
 *
 * Example input: `"{W15,W17,W19}"` → `['W15', 'W17', 'W19']`
 */
export function parseRouteIds(raw: any): string[] {
  if (!raw) return [];
  return String(raw)
    .replace(/[{"'}]/g, '')
    .split(',')
    .filter(Boolean);
}
