/**
 * Custom SVG Icons for the "Glowing Minimalist" terminal view.
 *
 * Designed as high-resolution shapes for MapLibre SDF (Signed Distance Field)
 * generation. Uses a 64×64 canvas with generous padding so the SDF halo
 * doesn't clip at the edges.
 *
 * SDF rules:
 *  - Black pixels → opaque (MapLibre recolors via icon-color)
 *  - Transparent pixels → invisible
 *  - The SDF algorithm infers smooth edges from the alpha boundary
 */

const S = 64; // Canvas size — larger = sharper SDF at all zoom levels

/**
 * Aerodrome Reference Point (ARP) / Helipad
 *
 * Standard ICAO-inspired symbol: a circle with four extending tick marks
 * radiating outward at cardinal directions, creating a crosshair effect.
 */
const AIRPORT_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">

  <circle cx="32" cy="32" r="10" fill="none" stroke="black" stroke-width="3.5"/>
  <circle cx="32" cy="32" r="3" fill="black"/>
  <line x1="32" y1="8" x2="32" y2="19" stroke="black" stroke-width="3" stroke-linecap="round"/>
  <line x1="32" y1="45" x2="32" y2="56" stroke="black" stroke-width="3" stroke-linecap="round"/>
  <line x1="8" y1="32" x2="19" y2="32" stroke="black" stroke-width="3" stroke-linecap="round"/>
  <line x1="45" y1="32" x2="56" y2="32" stroke="black" stroke-width="3" stroke-linecap="round"/>
</svg>
`.trim();

/**
 * VOR / NDB / Radio Navaid
 *
 * Hexagonal compass rose: a regular hexagon with a filled center dot
 * and six short radiating tick marks from each vertex outward.
 */
const NAVAID_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">

  <polygon points="32,12 49,22 49,42 32,52 15,42 15,22" fill="none" stroke="black" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="32" cy="32" r="4" fill="black"/>
  <line x1="32" y1="12" x2="32" y2="6" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="49" y1="22" x2="54" y2="19" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="49" y1="42" x2="54" y2="45" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="32" y1="52" x2="32" y2="58" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="15" y1="42" x2="10" y2="45" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="15" y1="22" x2="10" y2="19" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
</svg>
`.trim();

/**
 * Obstacle (Tower / Mast / Antenna / Pole / Electrical / Tree)
 *
 * Standard ICAO obstacle symbol: a vertical line (the structure) topped
 * with a small filled triangle (the hazard marker).
 */
const OBSTACLE_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">

  <line x1="32" y1="56" x2="32" y2="26" stroke="black" stroke-width="3.5" stroke-linecap="round"/>
  <polygon points="32,10 42,26 22,26" fill="black" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
</svg>
`.trim();

/**
 * Building / Structure
 *
 * A filled rounded square with a smaller inset square creating a
 * "window" or "floor plan" effect — reads clearly at all sizes.
 */
const BUILDING_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="12" width="40" height="40" rx="4" fill="none" stroke="black" stroke-width="3.5"/>
  <rect x="22" y="22" width="20" height="20" rx="2" fill="black"/>
</svg>
`.trim();

export const TERMINAL_ICONS: Record<string, string> = {
  'airport-icon': AIRPORT_SVG,
  'navaid-icon': NAVAID_SVG,
  'obstacle-icon': OBSTACLE_SVG,
  'building-icon': BUILDING_SVG,
};
