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
  emerald: [33, 155, 157, 255], // #219B9D — custom teal-green
  purple: [139, 90, 140, 255], // warm plum purple
  rnavGreen: [10, 124, 110, 255], // #0A7C6E
  atsBlue: [66, 122, 181, 255], // #427AB5
  rgbPurple: [139, 90, 140],
  rgbRnavGreen: [10, 124, 110],
  rgbAtsBlue: [66, 122, 181],
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

// ── Airspace Colors ──────────────────────────────────────────────────

export const AIRSPACE_COLORS: Record<
  string,
  {
    fill: [number, number, number, number];
    stroke: [number, number, number, number];
  }
> = {
  FIR: { fill: [255, 165, 0, 10], stroke: [255, 165, 0, 80] },
  DANGER: { fill: [255, 40, 40, 20], stroke: [255, 90, 90, 180] },
  PROHIBITED: { fill: [255, 0, 0, 15], stroke: [255, 0, 0, 120] },
  RESTRICTED: { fill: [255, 140, 0, 15], stroke: [255, 140, 0, 90] },
  TRA: { fill: [139, 92, 246, 15], stroke: [139, 92, 246, 100] }, // Violet
  TSA: { fill: [132, 204, 22, 15], stroke: [132, 204, 22, 100] }, // Vivid Lime
  ADIZ: { fill: [180, 80, 220, 15], stroke: [180, 80, 220, 100] },
  CTR: { fill: [50, 180, 255, 15], stroke: [50, 180, 255, 100] },
  CTA_LOWER: { fill: [80, 200, 220, 15], stroke: [80, 200, 220, 90] },
  CTA_UPPER: { fill: [60, 140, 200, 15], stroke: [60, 140, 200, 90] },
  UPR_ZONE: { fill: [190, 200, 255, 15], stroke: [190, 200, 255, 120] },
};

export const AIRSPACE_COLORS_LIGHT: Record<
  string,
  {
    fill: [number, number, number, number];
    stroke: [number, number, number, number];
  }
> = {
  FIR: { fill: [217, 119, 6, 18], stroke: [217, 119, 6, 140] },
  DANGER: { fill: [220, 38, 38, 30], stroke: [220, 38, 38, 200] },
  PROHIBITED: { fill: [185, 28, 28, 25], stroke: [185, 28, 28, 180] },
  RESTRICTED: { fill: [194, 120, 3, 25], stroke: [194, 120, 3, 150] },
  TRA: { fill: [139, 92, 246, 20], stroke: [139, 92, 246, 150] }, // Violet
  TSA: { fill: [132, 204, 22, 20], stroke: [132, 204, 22, 150] }, // Vivid Lime
  ADIZ: { fill: [126, 34, 206, 20], stroke: [126, 34, 206, 150] },
  CTR: { fill: [37, 99, 235, 20], stroke: [37, 99, 235, 150] },
  CTA_LOWER: { fill: [14, 165, 180, 20], stroke: [14, 165, 180, 140] },
  CTA_UPPER: { fill: [29, 78, 216, 20], stroke: [29, 78, 216, 140] },
  UPR_ZONE: { fill: [79, 70, 229, 20], stroke: [79, 70, 229, 160] },
};

export function getAirspaceColors(isDarkMode: boolean) {
  return isDarkMode ? AIRSPACE_COLORS : AIRSPACE_COLORS_LIGHT;
}

export const DEFAULT_STROKE: [number, number, number, number] = [128, 128, 128, 60];
export const DEFAULT_STROKE_LIGHT: [number, number, number, number] = [100, 116, 139, 120];

export function getDefaultStroke(isDarkMode: boolean) {
  return isDarkMode ? DEFAULT_STROKE : DEFAULT_STROKE_LIGHT;
}
