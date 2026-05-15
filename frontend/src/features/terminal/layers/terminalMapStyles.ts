/**
 * Static MapLibre paint objects for the 3D terminal view.
 *
 * Extracted outside React so they are referentially stable — MapLibre
 * won't deep-diff them on every render.
 */

/**
 * Helper expression to get a normalized search string from feature properties.
 */
const GET_SEARCH_STRING = [
  'upcase',
  [
    'concat',
    ['coalesce', ['get', 'name'], ['get', 'feature_name'], ''],
    ' ',
    ['coalesce', ['get', 'category'], ['get', 'feature_category'], ''],
  ],
];

export const POLYGON_PAINT = {
  'fill-extrusion-color': [
    'let',
    's',
    GET_SEARCH_STRING,
    [
      'case',
      ['>=', ['index-of', 'TAXIWAY', ['var', 's']], 0],
      '#52525b',
      ['>=', ['index-of', 'APRON', ['var', 's']], 0],
      '#71717a',
      ['>=', ['index-of', 'BUILDING', ['var', 's']], 0],
      '#94a3b8',
      '#9ca3af',
    ],
  ],
  'fill-extrusion-height': [
    'coalesce',
    ['to-number', ['get', 'height_m']],
    ['to-number', ['get', 'elevation_m']],
    15,
  ],
  'fill-extrusion-opacity': 0.8,
};

export const POINT_LAYOUT = {
  'icon-image': [
    'let',
    's',
    GET_SEARCH_STRING,
    [
      'case',
      [
        'any',
        ['>=', ['index-of', 'ARP', ['var', 's']], 0],
        ['>=', ['index-of', 'HELIPAD', ['var', 's']], 0],
      ],
      'airport-icon',
      [
        'any',
        ['>=', ['index-of', 'NAV', ['var', 's']], 0],
        ['>=', ['index-of', 'RADIO', ['var', 's']], 0],
      ],
      'navaid-icon',
      [
        'any',
        ['>=', ['index-of', 'BUILDING', ['var', 's']], 0],
        ['>=', ['index-of', 'HOUSE', ['var', 's']], 0],
        ['>=', ['index-of', 'SCHOOL', ['var', 's']], 0],
      ],
      'building-icon',
      [
        'case',
        [
          'all',
          ['>', ['to-number', ['get', 'height_m']], 120],
          ['==', ['get', 'marking_lgt'], 'LGTD'],
        ],
        'obstacle-high-lgt-icon',
        ['all', ['==', ['get', 'is_grouped'], true], ['==', ['get', 'marking_lgt'], 'LGTD']],
        'obstacle-group-lgt-icon',
        ['==', ['get', 'is_grouped'], true],
        'obstacle-group-icon',
        ['==', ['get', 'marking_lgt'], 'LGTD'],
        'obstacle-lgt-icon',
        'obstacle-icon',
      ],
    ],
  ],
  'icon-size': [
    'let',
    's',
    GET_SEARCH_STRING,
    [
      'case',
      ['>=', ['index-of', 'ARP', ['var', 's']], 0],
      0.8,
      ['>=', ['index-of', 'HELIPAD', ['var', 's']], 0],
      0.6,
      0.5,
    ],
  ],
  'icon-allow-overlap': true,
  'icon-anchor': 'center' as const,
};

export const POINT_PAINT = {
  'icon-color': [
    'let',
    's',
    GET_SEARCH_STRING,
    [
      'case',
      ['>=', ['index-of', 'ARP', ['var', 's']], 0],
      '#facc15',
      ['>=', ['index-of', 'HELIPAD', ['var', 's']], 0],
      '#0ea5e9',
      [
        'any',
        ['>=', ['index-of', 'NAV', ['var', 's']], 0],
        ['>=', ['index-of', 'RADIO', ['var', 's']], 0],
      ],
      '#a855f7',
      [
        'any',
        ['>=', ['index-of', 'TREE', ['var', 's']], 0],
        ['>=', ['index-of', 'NATURAL', ['var', 's']], 0],
      ],
      '#22c55e',
      [
        'any',
        ['>=', ['index-of', 'TOWER', ['var', 's']], 0],
        ['>=', ['index-of', 'MAST', ['var', 's']], 0],
        ['>=', ['index-of', 'ANTENNA', ['var', 's']], 0],
        ['>=', ['index-of', 'POLE', ['var', 's']], 0],
        ['>=', ['index-of', 'CRANE', ['var', 's']], 0],
      ],
      '#dc2626',
      [
        'any',
        ['>=', ['index-of', 'BUILDING', ['var', 's']], 0],
        ['>=', ['index-of', 'HOUSE', ['var', 's']], 0],
        ['>=', ['index-of', 'SCHOOL', ['var', 's']], 0],
      ],
      '#3b82f6',
      '#f97316',
    ],
  ],
  'icon-halo-color': [
    'let',
    's',
    GET_SEARCH_STRING,
    [
      'case',
      ['>=', ['index-of', 'ARP', ['var', 's']], 0],
      'rgba(250, 204, 21, 0.4)',
      ['>=', ['index-of', 'HELIPAD', ['var', 's']], 0],
      'rgba(14, 165, 233, 0.4)',
      [
        'any',
        ['>=', ['index-of', 'NAV', ['var', 's']], 0],
        ['>=', ['index-of', 'RADIO', ['var', 's']], 0],
      ],
      'rgba(168, 85, 247, 0.4)',
      'rgba(249, 115, 22, 0.4)',
    ],
  ],
  'icon-halo-width': [
    'let',
    's',
    GET_SEARCH_STRING,
    [
      'case',
      [
        'any',
        ['>=', ['index-of', 'ARP', ['var', 's']], 0],
        ['>=', ['index-of', 'HELIPAD', ['var', 's']], 0],
      ],
      2,
      0, // Disable halo for other icons — SDF buffer can't encode their small centred shapes
    ],
  ],
  'icon-halo-blur': [
    'let',
    's',
    GET_SEARCH_STRING,
    [
      'case',
      [
        'any',
        ['>=', ['index-of', 'ARP', ['var', 's']], 0],
        ['>=', ['index-of', 'HELIPAD', ['var', 's']], 0],
      ],
      2,
      0,
    ],
  ],
};

export const RUNWAY_FILL_PAINT = {
  'fill-color': '#3f3f46',
  'fill-opacity': 0.85,
};

export const RUNWAY_OUTLINE_PAINT = {
  'line-color': '#52525b',
  'line-width': 1.5,
};
