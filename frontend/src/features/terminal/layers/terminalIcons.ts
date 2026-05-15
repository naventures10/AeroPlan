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
 * Obstacle (Standard ICAO)
 * A triangle without a base and a dot inside.
 */
const OBSTACLE_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <path d="M 32 12 L 14 52 M 32 12 L 50 52" stroke="black" stroke-width="4" stroke-linecap="round" fill="none" stroke-linejoin="round"/>
  <circle cx="32" cy="42" r="3.5" fill="black"/>
</svg>
`.trim();

/**
 * Lighted Obstacle (Standard ICAO)
 */
const OBSTACLE_LGT_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <path d="M 32 24 L 14 54 M 32 24 L 50 54" stroke="black" stroke-width="4" stroke-linecap="round" fill="none" stroke-linejoin="round"/>
  <circle cx="32" cy="44" r="3.5" fill="black"/>
  <line x1="32" y1="4" x2="32" y2="14" stroke="black" stroke-width="3" stroke-linecap="round"/>
  <line x1="22" y1="12" x2="28" y2="18" stroke="black" stroke-width="3" stroke-linecap="round"/>
  <line x1="42" y1="12" x2="36" y2="18" stroke="black" stroke-width="3" stroke-linecap="round"/>
</svg>
`.trim();

/**
 * Group Obstacles (Standard ICAO)
 */
const OBSTACLE_GROUP_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <path d="M 24 18 L 8 50 M 24 18 L 36 50" stroke="black" stroke-width="3.5" stroke-linecap="round" fill="none" stroke-linejoin="round"/>
  <circle cx="24" cy="40" r="3" fill="black"/>
  <path d="M 40 18 L 28 50 M 40 18 L 56 50" stroke="black" stroke-width="3.5" stroke-linecap="round" fill="none" stroke-linejoin="round"/>
  <circle cx="40" cy="40" r="3" fill="black"/>
</svg>
`.trim();

/**
 * Lighted Group Obstacles (Standard ICAO)
 */
const OBSTACLE_GROUP_LGT_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <path d="M 24 28 L 8 56 M 24 28 L 36 56" stroke="black" stroke-width="3.5" stroke-linecap="round" fill="none" stroke-linejoin="round"/>
  <circle cx="24" cy="46" r="3" fill="black"/>
  <path d="M 40 28 L 28 56 M 40 28 L 56 56" stroke="black" stroke-width="3.5" stroke-linecap="round" fill="none" stroke-linejoin="round"/>
  <circle cx="40" cy="46" r="3" fill="black"/>
  <line x1="32" y1="4" x2="32" y2="14" stroke="black" stroke-width="3" stroke-linecap="round"/>
  <line x1="22" y1="10" x2="28" y2="18" stroke="black" stroke-width="3" stroke-linecap="round"/>
  <line x1="42" y1="10" x2="36" y2="18" stroke="black" stroke-width="3" stroke-linecap="round"/>
</svg>
`.trim();

/**
 * Exceptionally High Lighted Obstacle (Standard ICAO)
 */
const OBSTACLE_HIGH_LGT_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <path d="M 32 24 L 32 44 M 32 44 Q 32 52 22 52 M 32 44 Q 32 52 42 52" stroke="black" stroke-width="4" stroke-linecap="round" fill="none" stroke-linejoin="round"/>
  <circle cx="32" cy="52" r="3.5" fill="black"/>
  <line x1="32" y1="4" x2="32" y2="14" stroke="black" stroke-width="3" stroke-linecap="round"/>
  <line x1="22" y1="10" x2="28" y2="18" stroke="black" stroke-width="3" stroke-linecap="round"/>
  <line x1="42" y1="10" x2="36" y2="18" stroke="black" stroke-width="3" stroke-linecap="round"/>
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
  'obstacle-lgt-icon': OBSTACLE_LGT_SVG,
  'obstacle-group-icon': OBSTACLE_GROUP_SVG,
  'obstacle-group-lgt-icon': OBSTACLE_GROUP_LGT_SVG,
  'obstacle-high-lgt-icon': OBSTACLE_HIGH_LGT_SVG,
  'building-icon': BUILDING_SVG,
};
