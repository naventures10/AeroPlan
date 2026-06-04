import { useEffect } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/maplibre';
import type { FilterSpecification } from 'maplibre-gl';
import {
  getPolygonPaint,
  getPointPaint,
  POINT_LAYOUT,
  RUNWAY_FILL_PAINT,
  RUNWAY_OUTLINE_PAINT,
} from './styles';
import { TERMINAL_ICONS } from './icons';
import { useRunwayPolygons } from './useRunwayPolygons';

const SPATIAL_TILES = [`${window.location.origin}/tiles/spatial_features/{z}/{x}/{y}`];
/**
 * Expression to get a normalized search string for filtering.
 * Similar to GET_SEARCH_STRING but usable in FilterSpecification.
 */
const SEARCH_EXPR = [
  'upcase',
  [
    'concat',
    ['coalesce', ['get', 'name'], ['get', 'feature_name'], ''],
    ' ',
    ['coalesce', ['get', 'category'], ['get', 'feature_category'], ''],
  ],
];

export const TERMINAL_INTERACTIVE_LAYERS = ['mvt-points', 'mvt-polygons'];

import { useMapStore } from '../../../../store/useMapStore';

/** Empty GeoJSON to avoid MapLibre source errors when no data is available */
const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function TerminalSpatialLayers() {
  const { current: map } = useMap();
  const runwayData = useRunwayPolygons();
  const terminalSpatialFilters = useMapStore((state) => state.terminalSpatialFilters);
  const activeAirport = useMapStore((state) => state.activeAirport);
  const isDarkMode = useMapStore((state) => state.mapStyle !== 'light');

  useEffect(() => {
    if (!map) return;

    const activeImages: HTMLImageElement[] = [];

    Object.entries(TERMINAL_ICONS).forEach(([name, svg]) => {
      if (map.hasImage(name)) return;

      const img = new Image(64, 64);
      img.onload = () => {
        if (map && !map.hasImage(name)) {
          map.addImage(name, img, { sdf: true });
        }
      };
      // UTF-8 safe base64 encoding
      img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
      activeImages.push(img);
    });

    return () => {
      activeImages.forEach((img) => {
        img.onload = null;
      });
    };
  }, [map]);

  const pointFilter: FilterSpecification = [
    'all',
    ['==', ['upcase', ['coalesce', ['get', 'icao_code'], '']], (activeAirport || '').toUpperCase()],
    ['==', ['geometry-type'], 'Point'],
    ['!', ['>=', ['index-of', 'RUNWAY', SEARCH_EXPR], 0]],
    [
      'any',
      // Always show ARP/Helipads
      [
        'any',
        ['==', ['get', 'feature_category'], 'ARP'],
        ['==', ['get', 'feature_category'], 'HELIPAD'],
      ],
      // Toggleable categories
      ...(terminalSpatialFilters.buildings
        ? [
            [
              'any',
              ['>=', ['index-of', 'BUILDING', SEARCH_EXPR], 0],
              ['>=', ['index-of', 'HOUSE', SEARCH_EXPR], 0],
              ['>=', ['index-of', 'SCHOOL', SEARCH_EXPR], 0],
            ],
          ]
        : []),
      ...(terminalSpatialFilters.infrastructure
        ? [
            [
              'any',
              ['>=', ['index-of', 'TOWER', SEARCH_EXPR], 0],
              ['>=', ['index-of', 'MAST', SEARCH_EXPR], 0],
              ['>=', ['index-of', 'ANTENNA', SEARCH_EXPR], 0],
              ['>=', ['index-of', 'POLE', SEARCH_EXPR], 0],
              ['>=', ['index-of', 'CRANE', SEARCH_EXPR], 0],
            ],
          ]
        : []),
      ...(terminalSpatialFilters.natural
        ? [
            [
              'any',
              ['>=', ['index-of', 'TREE', SEARCH_EXPR], 0],
              ['>=', ['index-of', 'NATURAL', SEARCH_EXPR], 0],
            ],
          ]
        : []),
      ...(terminalSpatialFilters.navaids
        ? [
            [
              'any',
              ['>=', ['index-of', 'NAV', SEARCH_EXPR], 0],
              ['>=', ['index-of', 'RADIO', SEARCH_EXPR], 0],
            ],
          ]
        : []),
      ...(terminalSpatialFilters.other
        ? [
            [
              'all',
              ['==', ['get', 'feature_category'], 'OBSTACLE'],
              [
                '!',
                [
                  'any',
                  ['>=', ['index-of', 'BUILDING', SEARCH_EXPR], 0],
                  ['>=', ['index-of', 'HOUSE', SEARCH_EXPR], 0],
                  ['>=', ['index-of', 'SCHOOL', SEARCH_EXPR], 0],
                  ['>=', ['index-of', 'TOWER', SEARCH_EXPR], 0],
                  ['>=', ['index-of', 'MAST', SEARCH_EXPR], 0],
                  ['>=', ['index-of', 'ANTENNA', SEARCH_EXPR], 0],
                  ['>=', ['index-of', 'POLE', SEARCH_EXPR], 0],
                  ['>=', ['index-of', 'CRANE', SEARCH_EXPR], 0],
                  ['>=', ['index-of', 'TREE', SEARCH_EXPR], 0],
                  ['>=', ['index-of', 'NATURAL', SEARCH_EXPR], 0],
                ],
              ],
            ],
          ]
        : []),
    ],
  ] as any;

  const polygonFilter: FilterSpecification = [
    'all',
    ['==', ['upcase', ['coalesce', ['get', 'icao_code'], '']], (activeAirport || '').toUpperCase()],
    ['==', ['geometry-type'], 'Polygon'],
    ['!', ['>=', ['index-of', 'RUNWAY', SEARCH_EXPR], 0]],
    terminalSpatialFilters.buildings
      ? ['literal', true]
      : ['!', ['>=', ['index-of', 'BUILDING', SEARCH_EXPR], 0]],
  ] as any;

  return (
    <>
      {/* Runway strips — flat fill drapes on terrain, outline for definition */}
      <Source id="runway-polygons-source" type="geojson" data={runwayData?.polygons ?? EMPTY_FC}>
        <Layer id="runway-fill" type="fill" paint={RUNWAY_FILL_PAINT} />
        <Layer id="runway-outline" type="line" paint={RUNWAY_OUTLINE_PAINT} />
      </Source>

      {/* Runway threshold designators (labels) */}
      <Source id="runway-labels-source" type="geojson" data={runwayData?.labels ?? EMPTY_FC}>
        <Layer
          id="runway-threshold-labels"
          type="symbol"
          layout={{
            'text-field': ['get', 'label'],
            'text-size': 18,
            'text-font': ['Inter Bold', 'Arial Unicode MS Regular'],
            'text-offset': [0, 1.5],
            'text-rotate': ['get', 'bearing'],
            'text-rotation-alignment': 'map',
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          }}
          paint={{
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0,0,0,0.8)',
            'text-halo-width': 1.5,
          }}
        />
      </Source>

      {/* MVT spatial features (buildings, obstacles, points) */}
      <Source id="spatial-features-source" type="vector" tiles={SPATIAL_TILES} maxzoom={14}>
        <Layer
          id="mvt-polygons"
          type="fill-extrusion"
          source-layer="spatial_features"
          filter={polygonFilter}
          paint={getPolygonPaint(isDarkMode) as any}
        />
        <Layer
          id="mvt-points"
          type="symbol"
          source-layer="spatial_features"
          filter={pointFilter}
          layout={POINT_LAYOUT as any}
          paint={getPointPaint(isDarkMode) as any}
        />
      </Source>
    </>
  );
}
