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
 * Modern Data-Viz: Thick ring with bold pill-shaped ticks for maximum
 * legibility when rendered as an SDF.
 */
const AIRPORT_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="14" fill="none" stroke="black" stroke-width="5"/>
  <circle cx="32" cy="32" r="5" fill="black"/>
  <rect x="30" y="4" width="4" height="10" rx="2" fill="black"/>
  <rect x="30" y="50" width="4" height="10" rx="2" fill="black"/>
  <rect x="4" y="30" width="10" height="4" rx="2" fill="black"/>
  <rect x="50" y="30" width="10" height="4" rx="2" fill="black"/>
</svg>
`.trim();

/**
 * VOR / NDB / Radio Navaid
 *
 * Modern Data-Viz: Bold hexagon with beautifully rounded joints and
 * thick rounded radiating ticks.
 */
const NAVAID_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <polygon points="32,10 51,21 51,43 32,54 13,43 13,21" fill="none" stroke="black" stroke-width="5" stroke-linejoin="round"/>
  <circle cx="32" cy="32" r="5" fill="black"/>
  <line x1="32" y1="10" x2="32" y2="4" stroke="black" stroke-width="4" stroke-linecap="round"/>
  <line x1="51" y1="21" x2="56" y2="18" stroke="black" stroke-width="4" stroke-linecap="round"/>
  <line x1="51" y1="43" x2="56" y2="46" stroke="black" stroke-width="4" stroke-linecap="round"/>
  <line x1="32" y1="54" x2="32" y2="60" stroke="black" stroke-width="4" stroke-linecap="round"/>
  <line x1="13" y1="43" x2="8" y2="46" stroke="black" stroke-width="4" stroke-linecap="round"/>
  <line x1="13" y1="21" x2="8" y2="18" stroke="black" stroke-width="4" stroke-linecap="round"/>
</svg>
`.trim();

/**
 * Obstacle (Standard ICAO)
 *
 * Modern Data-Viz: Thick 5px stroke open triangle with a large inner dot.
 */
const OBSTACLE_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <path d="M 14 52 L 32 16 L 50 52" fill="none" stroke="black" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="32" cy="40" r="5" fill="black"/>
</svg>
`.trim();

/**
 * Lighted Obstacle (Standard ICAO)
 */
const OBSTACLE_LGT_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <path d="M 14 54 L 32 20 L 50 54" fill="none" stroke="black" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="32" cy="42" r="5" fill="black"/>
  <line x1="32" y1="4" x2="32" y2="12" stroke="black" stroke-width="4" stroke-linecap="round"/>
  <line x1="20" y1="10" x2="26" y2="16" stroke="black" stroke-width="4" stroke-linecap="round"/>
  <line x1="44" y1="10" x2="38" y2="16" stroke="black" stroke-width="4" stroke-linecap="round"/>
</svg>
`.trim();

/**
 * Group Obstacles (Standard ICAO)
 */
const OBSTACLE_GROUP_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <path d="M 10 50 L 24 22 L 38 50" fill="none" stroke="black" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="24" cy="42" r="4.5" fill="black"/>
  <path d="M 26 50 L 40 22 L 54 50" fill="none" stroke="black" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="40" cy="42" r="4.5" fill="black"/>
</svg>
`.trim();

/**
 * Lighted Group Obstacles (Standard ICAO)
 */
const OBSTACLE_GROUP_LGT_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <path d="M 10 54 L 24 26 L 38 54" fill="none" stroke="black" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="24" cy="46" r="4.5" fill="black"/>
  <path d="M 26 54 L 40 26 L 54 54" fill="none" stroke="black" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="40" cy="46" r="4.5" fill="black"/>
  <line x1="32" y1="4" x2="32" y2="12" stroke="black" stroke-width="4" stroke-linecap="round"/>
  <line x1="20" y1="10" x2="26" y2="16" stroke="black" stroke-width="4" stroke-linecap="round"/>
  <line x1="44" y1="10" x2="38" y2="16" stroke="black" stroke-width="4" stroke-linecap="round"/>
</svg>
`.trim();

/**
 * Exceptionally High Lighted Obstacle (Standard ICAO)
 *
 * Modern Data-Viz: Strong solid mast with a crossbeam instead of thin curving lines.
 */
const OBSTACLE_HIGH_LGT_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <path d="M 32 20 L 32 46" fill="none" stroke="black" stroke-width="5" stroke-linecap="round"/>
  <path d="M 20 54 C 26 54 32 50 32 46 C 32 50 38 54 44 54" fill="none" stroke="black" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="24" y1="36" x2="40" y2="36" stroke="black" stroke-width="4" stroke-linecap="round"/>
  <circle cx="32" cy="54" r="5" fill="black"/>
  <line x1="32" y1="4" x2="32" y2="12" stroke="black" stroke-width="4" stroke-linecap="round"/>
  <line x1="20" y1="10" x2="26" y2="16" stroke="black" stroke-width="4" stroke-linecap="round"/>
  <line x1="44" y1="10" x2="38" y2="16" stroke="black" stroke-width="4" stroke-linecap="round"/>
</svg>
`.trim();

/**
 * Building / Structure
 *
 * Modern Data-Viz: A clean, instantly recognizable city skyline silhouette.
 * Features three solid vertical columns of varying heights aligned at the base.
 */
const BUILDING_SVG = `
<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <rect x="9" y="28" width="12" height="26" rx="3" fill="black"/>
  <rect x="25" y="10" width="14" height="44" rx="3" fill="black"/>
  <rect x="43" y="20" width="12" height="34" rx="3" fill="black"/>
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
