/**
 * Waypoint Layer
 *
 * Renders significant points as hollow waypoint icons with name labels
 * via a single MVTLayer (icon+text point type).
 */

import { MVTLayer } from '@deck.gl/geo-layers';
import { COLOR_NEON_CYAN, ZOOM_WAYPOINTS } from './constants';
import type { LayerContext } from './types';

export function createWaypointLayer(ctx: LayerContext): any[] {
  const { viewMode, activeLayers, selectedFeature, setSelectedFeature } = ctx;
  const isZoomWaypoints = ctx.zoom > ZOOM_WAYPOINTS;

  return [
    new MVTLayer({
      id: 'waypoints-layer',
      data: `${window.location.origin}/tiles/significant_points/{z}/{x}/{y}`,
      visible: viewMode === 'ENROUTE',
      // Disable picking when ATS routes are active to avoid selecting waypoints while viewing routes
      pickable: !activeLayers.atsRoutes,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      pointType: 'icon+text',
      iconAtlas: '/WAYPOINT_HOLLOW.svg',
      iconMapping: {
        waypoint: { x: 0, y: 0, width: 100, height: 100, anchorY: 50, mask: true },
      },
      getIcon: () => 'waypoint',
      getIconColor: (d: any) => {
        if (
          selectedFeature?.type === 'WAYPOINT' &&
          selectedFeature.data.waypoint_name === d.properties.waypoint_name
        ) {
          return COLOR_NEON_CYAN;
        }
        return [255, 255, 255, 255];
      },
      getIconSize: (d: any) => {
        if (
          selectedFeature?.type === 'WAYPOINT' &&
          selectedFeature.data.waypoint_name === d.properties.waypoint_name
        ) {
          return 16;
        }
        return 10;
      },
      getText: (d: any) => d.properties.waypoint_name || '',
      getTextSize: (d: any) => {
        if (!isZoomWaypoints) return 0;
        const hasRoutes =
          d.properties.routes && d.properties.routes !== 'None' && d.properties.routes !== '{}';

        if (activeLayers.atsRoutes && hasRoutes) return 0;
        return 11;
      },
      getTextColor: [220, 220, 220, 255],
      getTextPixelOffset: [0, -15],
      textFontFamily: 'Inter, sans-serif',
      textFontWeight: 600,
      onClick: (info: any) => {
        if (info.object && info.object.properties) {
          setSelectedFeature({ type: 'WAYPOINT', data: info.object.properties });
        }
      },
      updateTriggers: {
        getIconColor: [selectedFeature],
        getIconSize: [selectedFeature],
        getTextSize: [isZoomWaypoints, activeLayers.atsRoutes],
      },
      binary: false,
      transitions: {
        getIconColor: 300,
        getIconSize: 300,
        getTextColor: 300,
      },
    }),
  ];
}
