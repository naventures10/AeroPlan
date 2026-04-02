/**
 * Static MapLibre paint objects for the 3D terminal view.
 *
 * Extracted outside React so they are referentially stable — MapLibre
 * won't deep-diff them on every render.
 */

export const POLYGON_PAINT = {
  'fill-extrusion-color': [
    'let',
    's', ['upcase', ['concat', ['coalesce', ['get', 'name'], ['get', 'feature_name'], ''], ' ', ['coalesce', ['get', 'category'], ['get', 'feature_category'], '']]],
    [
      'case',
      ['>=', ['index-of', 'RUNWAY', ['var', 's']], 0], '#3f3f46',
      ['>=', ['index-of', 'TAXIWAY', ['var', 's']], 0], '#52525b',
      ['>=', ['index-of', 'APRON', ['var', 's']], 0], '#71717a',
      ['>=', ['index-of', 'BUILDING', ['var', 's']], 0], '#94a3b8',
      '#9ca3af'
    ]
  ],
  'fill-extrusion-height': ['/', ['coalesce', ['to-number', ['get', 'height']], ['to-number', ['get', 'elevation_m']], 65], 3.28084],
  'fill-extrusion-opacity': 0.8
};

export const POINT_PAINT = {
  'circle-color': [
    'let',
    's', ['upcase', ['concat', ['coalesce', ['get', 'name'], ['get', 'feature_name'], ''], ' ', ['coalesce', ['get', 'category'], ['get', 'feature_category'], '']]],
    [
      'case',
      ['>=', ['index-of', 'ARP', ['var', 's']], 0], '#facc15',
      ['>=', ['index-of', 'HELIPAD', ['var', 's']], 0], '#0ea5e9',
      ['>=', ['index-of', 'NAV', ['var', 's']], 0], '#a855f7',
      ['>=', ['index-of', 'RADIO', ['var', 's']], 0], '#a855f7',
      ['>=', ['index-of', 'RUNWAY', ['var', 's']], 0], '#cbd5e1',
      ['>=', ['index-of', 'RWY', ['var', 's']], 0], '#cbd5e1',
      ['>=', ['index-of', 'TREE', ['var', 's']], 0], '#22c55e',
      ['>=', ['index-of', 'TOWER', ['var', 's']], 0], '#dc2626',
      ['>=', ['index-of', 'MAST', ['var', 's']], 0], '#eab308',
      ['>=', ['index-of', 'ANTENNA', ['var', 's']], 0], '#eab308',
      ['>=', ['index-of', 'POLE', ['var', 's']], 0], '#eab308',
      ['>=', ['index-of', 'BUILDING', ['var', 's']], 0], '#94a3b8',
      ['>=', ['index-of', 'ELECTRICAL', ['var', 's']], 0], '#a855f7',
      '#f97316'
    ]
  ],
  'circle-radius': [
    'let',
    's', ['upcase', ['concat', ['coalesce', ['get', 'name'], ['get', 'feature_name'], ''], ' ', ['coalesce', ['get', 'category'], ['get', 'feature_category'], '']]],
    [
      'case',
      ['>=', ['index-of', 'ARP', ['var', 's']], 0], 8,
      ['>=', ['index-of', 'HELIPAD', ['var', 's']], 0], 6,
      ['>=', ['index-of', 'NAV', ['var', 's']], 0], 5,
      ['>=', ['index-of', 'RADIO', ['var', 's']], 0], 5,
      ['>=', ['index-of', 'RUNWAY', ['var', 's']], 0], 6,
      ['>=', ['index-of', 'RWY', ['var', 's']], 0], 6,
      3
    ]
  ],
  'circle-stroke-width': 1,
  'circle-stroke-color': '#ffffff'
};
