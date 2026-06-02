/**
 * SDF Icon Sprite Atlas for RNP waypoints
 *
 * Contains fly-by (4-pointed star with a hollow circle in the center),
 * circle icon, and fly-over (4-pointed star enclosed by a circle with a center dot)
 * side-by-side in a 192x64 SVG.
 */

const RNP_SPRITE_SVG = `
<svg width="192" height="64" viewBox="0 0 192 64" xmlns="http://www.w3.org/2000/svg">
  <!-- fly-by (x: 0 to 64) -->
  <g transform="translate(0, 0)" fill="none" stroke="black" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="32" cy="32" r="14" />
    <path d="M 22 22 L 32 4 L 42 22" />
    <path d="M 22 42 L 32 60 L 42 42" />
    <path d="M 22 22 L 4 32 L 22 42" />
    <path d="M 42 22 L 60 32 L 42 42" />
  </g>
  <!-- circle (x: 64 to 128) -->
  <g transform="translate(64, 0)">
    <circle cx="32" cy="32" r="18" fill="black" />
  </g>
  <!-- fly-over (x: 128 to 192) -->
  <g transform="translate(128, 0)" fill="none" stroke="black" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="32" cy="32" r="28" />
    <path d="M 22 22 L 32 4 L 42 22 Z" fill="black" />
    <path d="M 22 42 L 32 60 L 42 42 Z" fill="black" />
    <path d="M 22 22 L 4 32 L 22 42 Z" fill="black" />
    <path d="M 42 22 L 60 32 L 42 42 Z" fill="black" />
    <circle cx="32" cy="32" r="3" fill="black" />
  </g>
</svg>
`.trim();

// Encode as Base64 Data URL for Deck.gl IconLayer
export const RNP_ICON_ATLAS_URL = `data:image/svg+xml;base64,${btoa(RNP_SPRITE_SVG)}`;

export const RNP_ICON_MAPPING = {
  'fly-by': { x: 0, y: 0, width: 64, height: 64, mask: true },
  circle: { x: 64, y: 0, width: 64, height: 64, mask: true },
  'fly-over': { x: 128, y: 0, width: 64, height: 64, mask: true },
};
