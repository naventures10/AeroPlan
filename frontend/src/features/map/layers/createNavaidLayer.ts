/**
 * Navaid Layer
 *
 * Renders radio navigation aids (VOR, DME, NDB, etc.) as dynamically-
 * loaded SVG icons with ident text labels.
 */

import { MVTLayer } from '@deck.gl/geo-layers';
import { COLOR_NEON_CYAN, COLOR_EMERALD, ZOOM_NAVAIDS } from './constants';
import type { LayerContext } from './types';

export function createNavaidLayer(ctx: LayerContext): any[] {
  const { viewMode, selectedFeature, setSelectedFeature } = ctx;
  const isZoomNavaids = ctx.viewState.zoom > ZOOM_NAVAIDS;

  return [
    new MVTLayer({
      id: 'navaids-layer',
      data: `${window.location.origin}/tiles/radio_nav_aids/{z}/{x}/{y}`,
      visible: viewMode === 'ENROUTE',
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      pointType: 'icon+text',
      getIcon: (d: any) => {
        let type = d.properties.aid_type || 'UNKNOWN';
        type = type.trim().replace(/\//g, '_');
        return {
          url: `/${type}.svg`,
          width: 100,
          height: 100,
          anchorY: 50,
          mask: true,
        };
      },
      getIconSize: (d: any) => {
        if (selectedFeature?.type === 'NAVAID' && selectedFeature.data.ident === d.properties.ident)
          return 30;
        return 20;
      },
      getIconColor: (d: any) => {
        if (selectedFeature?.type === 'NAVAID' && selectedFeature.data.ident === d.properties.ident)
          return COLOR_NEON_CYAN;
        return COLOR_EMERALD;
      },
      getText: (d: any) => d.properties.ident || '',
      getTextSize: isZoomNavaids ? 12 : 0,
      getTextColor: [52, 211, 153, 255],
      getTextPixelOffset: [0, 20],
      textFontFamily: 'Inter, sans-serif',
      textFontWeight: 600,
      onClick: (info: any) => {
        if (info.object && info.object.properties) {
          setSelectedFeature({ type: 'NAVAID', data: info.object.properties });
        }
      },
      updateTriggers: {
        getIconColor: [selectedFeature],
        getIconSize: [selectedFeature],
        getTextSize: [isZoomNavaids],
      },
      transitions: {
        getIconColor: 300,
        getIconSize: 300,
        getTextColor: 300,
      },
    }),
  ];
}
