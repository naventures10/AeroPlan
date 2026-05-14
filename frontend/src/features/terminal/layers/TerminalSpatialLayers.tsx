import { useEffect } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/maplibre';
import type { FilterSpecification } from 'maplibre-gl';
import {
  POLYGON_PAINT,
  POINT_PAINT,
  POINT_LAYOUT,
  RUNWAY_FILL_PAINT,
  RUNWAY_OUTLINE_PAINT,
} from './terminalMapStyles';
import { TERMINAL_ICONS } from './terminalIcons';
import { useRunwayPolygons } from './useRunwayPolygons';

export const SPATIAL_TILES = [`${window.location.origin}/tiles/spatial_features/{z}/{x}/{y}`];
export const SPATIAL_POLYGON_FILTER: FilterSpecification = ['==', ['geometry-type'], 'Polygon'];
export const SPATIAL_POINT_FILTER: FilterSpecification = ['==', ['geometry-type'], 'Point'];

export const TERMINAL_INTERACTIVE_LAYERS = ['mvt-points', 'mvt-polygons'];

/** Empty GeoJSON to avoid MapLibre source errors when no data is available */
const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function TerminalSpatialLayers() {
  const { current: map } = useMap();
  const runwayGeojson = useRunwayPolygons();

  useEffect(() => {
    if (!map) return;

    Object.entries(TERMINAL_ICONS).forEach(([name, svg]) => {
      if (map.hasImage(name)) return;

      const img = new Image(64, 64);
      img.onload = () => map.addImage(name, img, { sdf: true });
      img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
    });
  }, [map]);

  return (
    <>
      {/* Runway strips — flat fill drapes on terrain, outline for definition */}
      <Source id="runway-polygons-source" type="geojson" data={runwayGeojson ?? EMPTY_FC}>
        <Layer id="runway-fill" type="fill" paint={RUNWAY_FILL_PAINT} />
        <Layer id="runway-outline" type="line" paint={RUNWAY_OUTLINE_PAINT} />
      </Source>

      {/* MVT spatial features (buildings, obstacles, points) */}
      <Source id="spatial-features-source" type="vector" tiles={SPATIAL_TILES}>
        <Layer
          id="mvt-polygons"
          type="fill-extrusion"
          source-layer="spatial_features"
          filter={SPATIAL_POLYGON_FILTER}
          paint={POLYGON_PAINT as any}
        />
        <Layer
          id="mvt-points"
          type="symbol"
          source-layer="spatial_features"
          filter={SPATIAL_POINT_FILTER}
          layout={POINT_LAYOUT as any}
          paint={POINT_PAINT as any}
        />
      </Source>
    </>
  );
}
