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

export const getPolygonPaint = (isDarkMode: boolean) => ({
  'fill-extrusion-color': [
    'let',
    's',
    GET_SEARCH_STRING,
    [
      'case',
      ['>=', ['index-of', 'TAXIWAY', ['var', 's']], 0],
      isDarkMode ? '#52525b' : '#d6d3d1',
      ['>=', ['index-of', 'APRON', ['var', 's']], 0],
      isDarkMode ? '#71717a' : '#e7e5e4',
      ['>=', ['index-of', 'BUILDING', ['var', 's']], 0],
      isDarkMode ? '#94a3b8' : '#cbd5e1',
      isDarkMode ? '#9ca3af' : '#a8a29e',
    ],
  ],
  'fill-extrusion-height': [
    'coalesce',
    ['to-number', ['get', 'height_m']],
    ['to-number', ['get', 'elevation_m']],
    15,
  ],
  'fill-extrusion-opacity': 0.8,
});

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
        [
          'any',
          ['>=', ['index-of', 'BUILDING', ['var', 's']], 0],
          ['>=', ['index-of', 'HOUSE', ['var', 's']], 0],
          ['>=', ['index-of', 'SCHOOL', ['var', 's']], 0],
        ],
        'obstacle-icon',
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
      0.7,
      ['>=', ['index-of', 'HELIPAD', ['var', 's']], 0],
      0.6,
      [
        'any',
        ['>=', ['index-of', 'NAV', ['var', 's']], 0],
        ['>=', ['index-of', 'RADIO', ['var', 's']], 0],
      ],
      0.55,
      [
        'interpolate',
        ['linear'],
        ['coalesce', ['to-number', ['get', 'height_m']], 0],
        0,
        0.35,
        30,
        0.48,
        120,
        0.68,
      ],
    ],
  ],
  'icon-allow-overlap': true,
  'icon-anchor': 'center' as const,
  'text-field': [
    'let',
    's',
    GET_SEARCH_STRING,
    [
      'case',
      [
        'any',
        ['>=', ['index-of', 'ARP', ['var', 's']], 0],
        ['>=', ['index-of', 'HELIPAD', ['var', 's']], 0],
        ['>=', ['index-of', 'NAV', ['var', 's']], 0],
        ['>=', ['index-of', 'RADIO', ['var', 's']], 0],
      ],
      '',
      [
        'let',
        'elev',
        ['coalesce', ['to-number', ['get', 'elevation_m']], 0],
        [
          'case',
          ['>', ['var', 'elev'], 0],
          ['to-string', ['round', ['*', ['var', 'elev'], 3.28084]]],
          '',
        ],
      ],
    ],
  ],
  'text-font': ['Inter SemiBold', 'Arial Unicode MS Regular'],
  'text-size': 11,
  'text-anchor': 'bottom' as const,
  'text-offset': [0, -1.2] as [number, number],
  'text-optional': true,
};

const getPointColor = (isDarkMode: boolean) => [
  'let',
  's',
  GET_SEARCH_STRING,
  [
    'case',
    ['>=', ['index-of', 'ARP', ['var', 's']], 0],
    isDarkMode ? '#c084fc' : '#8b5a8c',
    ['>=', ['index-of', 'HELIPAD', ['var', 's']], 0],
    isDarkMode ? '#0ea5e9' : '#427ab5',
    [
      'any',
      ['>=', ['index-of', 'NAV', ['var', 's']], 0],
      ['>=', ['index-of', 'RADIO', ['var', 's']], 0],
    ],
    isDarkMode ? '#34d399' : '#219b9d',
    [
      'any',
      ['>=', ['index-of', 'TREE', ['var', 's']], 0],
      ['>=', ['index-of', 'NATURAL', ['var', 's']], 0],
    ],
    isDarkMode ? '#22c55e' : '#0a7c6e',
    [
      'any',
      ['>=', ['index-of', 'TOWER', ['var', 's']], 0],
      ['>=', ['index-of', 'MAST', ['var', 's']], 0],
      ['>=', ['index-of', 'ANTENNA', ['var', 's']], 0],
      ['>=', ['index-of', 'POLE', ['var', 's']], 0],
      ['>=', ['index-of', 'CRANE', ['var', 's']], 0],
    ],
    isDarkMode ? '#dc2626' : '#c45b4b',
    [
      'any',
      ['>=', ['index-of', 'BUILDING', ['var', 's']], 0],
      ['>=', ['index-of', 'HOUSE', ['var', 's']], 0],
      ['>=', ['index-of', 'SCHOOL', ['var', 's']], 0],
    ],
    isDarkMode ? '#3b82f6' : '#64748b',
    isDarkMode ? '#f97316' : '#d97706',
  ],
];

export const getPointPaint = (isDarkMode: boolean) => ({
  'icon-color': getPointColor(isDarkMode),
  'icon-halo-color': isDarkMode ? '#000000' : '#ffffff',
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
      1.5,
    ],
  ],
  'icon-halo-blur': 0,
  'text-color': isDarkMode ? '#f8fafc' : '#0f172a',
  'text-halo-color': isDarkMode ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)',
  'text-halo-width': 1.5,
});

export const RUNWAY_FILL_PAINT = {
  'fill-color': '#3f3f46',
  'fill-opacity': 0.85,
};

export const RUNWAY_OUTLINE_PAINT = {
  'line-color': '#52525b',
  'line-width': 1.5,
};
