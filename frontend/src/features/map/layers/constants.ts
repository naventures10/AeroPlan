/**
 * Shared constants for DeckGL layers.
 *
 * Centralises magic colors, zoom thresholds, and reusable extension
 * singletons so every layer factory draws from one palette.
 */

import { CollisionFilterExtension } from '@deck.gl/extensions';

// ── Color Palette (RGBA tuples) ──────────────────────────────────────

export const COLOR_WHITE: [number, number, number, number] = [255, 255, 255, 255];
export const COLOR_NEON_CYAN: [number, number, number, number] = [93, 248, 216, 255];
export const COLOR_EMERALD: [number, number, number, number] = [52, 211, 153, 255];
export const COLOR_NEON_PURPLE: [number, number, number, number] = [192, 132, 252, 255];
export const COLOR_RNAV_GREEN: [number, number, number, number] = [115, 236, 139, 255];
export const COLOR_ATS_BLUE: [number, number, number, number] = [68, 172, 255, 255];

// RGB-only variants (for colour math in label glow calculations)
export const RGB_NEON_PURPLE: [number, number, number] = [192, 132, 252];
export const RGB_RNAV_GREEN: [number, number, number] = [115, 236, 139];
export const RGB_ATS_BLUE: [number, number, number] = [68, 172, 255];
export const RGB_WHITE: [number, number, number] = [255, 255, 255];

// ── Theme-aware Palettes ─────────────────────────────────────────────

export interface LayerPalette {
  white: [number, number, number, number];
  cyan: [number, number, number, number];
  emerald: [number, number, number, number];
  purple: [number, number, number, number];
  rnavGreen: [number, number, number, number];
  atsBlue: [number, number, number, number];
  rgbPurple: [number, number, number];
  rgbRnavGreen: [number, number, number];
  rgbAtsBlue: [number, number, number];
  rgbWhite: [number, number, number];
}

export const DARK_PALETTE: LayerPalette = {
  white: [255, 255, 255, 255],
  cyan: [93, 248, 216, 255],
  emerald: [52, 211, 153, 255],
  purple: [192, 132, 252, 255],
  rnavGreen: [115, 236, 139, 255],
  atsBlue: [68, 172, 255, 255],
  rgbPurple: [192, 132, 252],
  rgbRnavGreen: [115, 236, 139],
  rgbAtsBlue: [68, 172, 255],
  rgbWhite: [255, 255, 255],
};

export const LIGHT_PALETTE: LayerPalette = {
  white: [92, 107, 138, 255], // slate blue — soft, mid-tone for waypoints/text
  cyan: [72, 139, 143, 255], // #488B8F accent — steel teal
  emerald: [38, 130, 100, 255], // muted teal-green — readable on map greens
  purple: [139, 90, 140, 255], // warm plum purple
  rnavGreen: [58, 134, 90, 255], // forest green — softer than bright green-600
  atsBlue: [66, 126, 188, 255], // steel blue — calm, mid-tone
  rgbPurple: [139, 90, 140],
  rgbRnavGreen: [58, 134, 90],
  rgbAtsBlue: [66, 126, 188],
  rgbWhite: [92, 107, 138], // slate blue for waypoints/text
};

/** Get the appropriate palette for the current theme */
export function getLayerPalette(isDarkMode: boolean): LayerPalette {
  return isDarkMode ? DARK_PALETTE : LIGHT_PALETTE;
}

// ── Zoom Thresholds ──────────────────────────────────────────────────

/** Zoom level above which standalone waypoint labels are visible */
export const ZOOM_WAYPOINTS = 7.0;

/** Zoom level above which ATS route waypoint labels are visible */
export const ZOOM_ATS_WAYPOINTS = 7.5;

/** Zoom level above which navaid text labels are visible */
export const ZOOM_NAVAIDS = 2.5;

// ── Label Size Constraints (Pixels) ──────────────────────────────────

export const ATS_ROUTE_LABEL_MAX_PIXELS = 24;
export const ATS_ROUTE_LABEL_TEXT_MAX_PIXELS = 18;

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
