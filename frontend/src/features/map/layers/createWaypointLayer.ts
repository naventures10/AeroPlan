/**
 * Waypoint Layer
 *
 * Renders significant points as hollow waypoint icons with name labels
 * via a single MVTLayer (icon+text point type).
 */

import { MVTLayer } from '@deck.gl/geo-layers';
import { ZOOM_WAYPOINTS, getLayerPalette } from './constants';
import type { LayerContext } from './types';

export function createWaypointLayer(ctx: LayerContext): any[] {
  const { viewMode, activeLayers, selectedFeature, setSelectedFeature } = ctx;
  const isZoomWaypoints = ctx.zoom > ZOOM_WAYPOINTS;
  const isLayerActive = activeLayers.waypoints;
  const isSelected = selectedFeature?.type === 'WAYPOINT';
  const palette = getLayerPalette(ctx.isDarkMode);

  const transparentColor: [number, number, number, number] = [0, 0, 0, 0];
  const transparentCyan: [number, number, number, number] = [
    palette.cyan[0],
    palette.cyan[1],
    palette.cyan[2],
    0,
  ];
  const transparentWhite: [number, number, number, number] = [
    palette.white[0],
    palette.white[1],
    palette.white[2],
    0,
  ];
  const textColor: [number, number, number, number] = [
    palette.rgbWhite[0],
    palette.rgbWhite[1],
    palette.rgbWhite[2],
    230,
  ];

  return [
    new MVTLayer({
      id: 'waypoints-layer',
      data: `${window.location.origin}/tiles/significant_points/{z}/{x}/{y}`,
      visible: viewMode === 'ENROUTE' && (isLayerActive || isSelected),
      // Disable picking when ATS routes are active to avoid selecting waypoints while viewing routes
      pickable: !activeLayers.atsRoutes && isLayerActive && !activeLayers.weather,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      pointType: 'icon+text',
      iconAtlas: '/WAYPOINT_HOLLOW.svg',
      iconMapping: {
        waypoint: { x: 0, y: 0, width: 100, height: 100, anchorY: 50, mask: true },
      },
      getIcon: 'waypoint',
      getIconColor: (d: any) => {
        const isSelected =
          selectedFeature?.type === 'WAYPOINT' &&
          selectedFeature.data.waypoint_name === d.properties.waypoint_name;
        if (isSelected) {
          return isLayerActive ? palette.cyan : transparentCyan;
        }
        return isLayerActive ? palette.white : transparentWhite;
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
      getTextColor: isLayerActive ? textColor : transparentColor,
      getTextPixelOffset: [0, -15],
      textFontFamily: 'Geist, sans-serif',
      textFontWeight: 600,
      onClick: (info: any) => {
        if (info.object && info.object.properties) {
          setSelectedFeature({ type: 'WAYPOINT', data: info.object.properties });
        }
      },
      updateTriggers: {
        getIconColor: [selectedFeature, isLayerActive, ctx.isDarkMode],
        getIconSize: [selectedFeature],
        getTextSize: [isZoomWaypoints, activeLayers.atsRoutes],
        getTextColor: [isLayerActive, ctx.isDarkMode],
      },
      binary: false,
      transitions: ctx.isMobile
        ? undefined
        : {
            getIconColor: 300,
            getIconSize: 300,
            getTextColor: 300,
          },
    }),
  ];
}
