/**
 * Navaid Layer
 *
 * Renders radio navigation aids (VOR, DME, NDB, etc.) as dynamically-
 * loaded SVG icons with ident text labels.
 */

import { MVTLayer } from '@deck.gl/geo-layers';
import { ZOOM_NAVAIDS, getLayerPalette } from './constants';
import type { LayerContext } from './types';

/** Module-level cache for navaid icon definitions — avoids per-feature allocation. */
const NAVAID_ICON_CACHE = new Map<
  string,
  { url: string; width: number; height: number; anchorY: number; mask: boolean }
>();

function getNavaidIcon(d: any) {
  let type = d.properties.aid_type || 'UNKNOWN';
  type = type.trim().replace(/\//g, '_');

  const cached = NAVAID_ICON_CACHE.get(type);
  if (cached) return cached;

  const icon = {
    url: `/${type}.svg`,
    width: 100,
    height: 100,
    anchorY: 50,
    mask: true,
  };
  NAVAID_ICON_CACHE.set(type, icon);
  return icon;
}

export function createNavaidLayer(ctx: LayerContext): any[] {
  const { viewMode, activeLayers, selectedFeature, setSelectedFeature } = ctx;
  const isZoomNavaids = ctx.zoom > ZOOM_NAVAIDS;
  const isLayerActive = activeLayers.navaids;
  const isSelected = selectedFeature?.type === 'NAVAID';
  const palette = getLayerPalette(ctx.isDarkMode);

  return [
    new MVTLayer({
      id: 'navaids-layer',
      data: `${window.location.origin}/tiles/radio_nav_aids/{z}/{x}/{y}`,
      visible: viewMode === 'ENROUTE' && (isLayerActive || isSelected),
      pickable: isLayerActive && !activeLayers.weather,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      pointType: 'icon+text',
      getIcon: getNavaidIcon,
      getIconSize: (d: any) => {
        if (selectedFeature?.type === 'NAVAID' && selectedFeature.data.ident === d.properties.ident)
          return 30;
        return 20;
      },
      getIconColor: (d: any) => {
        const isSelected =
          selectedFeature?.type === 'NAVAID' && selectedFeature.data.ident === d.properties.ident;
        if (isSelected) {
          return isLayerActive
            ? palette.cyan
            : [palette.cyan[0], palette.cyan[1], palette.cyan[2], 0];
        }
        return isLayerActive
          ? palette.emerald
          : [palette.emerald[0], palette.emerald[1], palette.emerald[2], 0];
      },
      getText: (d: any) => d.properties.ident || '',
      getTextSize: isZoomNavaids ? 12 : 0,
      getTextColor: isLayerActive
        ? ([palette.emerald[0], palette.emerald[1], palette.emerald[2], 255] as [
            number,
            number,
            number,
            number,
          ])
        : [0, 0, 0, 0],
      getTextPixelOffset: [0, 20],
      textFontFamily: 'Geist, sans-serif',
      textFontWeight: 600,
      onClick: (info: any) => {
        if (info.object && info.object.properties) {
          setSelectedFeature({ type: 'NAVAID', data: info.object.properties });
        }
      },
      updateTriggers: {
        getIconColor: [selectedFeature, isLayerActive, ctx.isDarkMode],
        getIconSize: [selectedFeature],
        getTextSize: [isZoomNavaids],
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
