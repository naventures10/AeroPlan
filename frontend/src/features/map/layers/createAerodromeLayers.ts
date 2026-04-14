/**
 * Aerodrome Layers
 *
 * Renders aerodrome reference point (ARP) icons from GeoJSON and their
 * ICAO code text labels underneath.
 */

import { GeoJsonLayer, TextLayer } from '@deck.gl/layers';
import type { LayerContext } from './types';

export function createAerodromeLayers(
  ctx: LayerContext,
  aerodromes: any,
  textData: { position: number[]; text: string }[],
  onAerodromeClick: (icao: string, coords: [number, number]) => void,
): any[] {
  return [
    new GeoJsonLayer({
      id: 'aerodromes-layer',
      data: aerodromes,
      visible: ctx.viewMode === 'ENROUTE',
      pickable: true,
      pointType: 'icon',
      getIcon: () => ({
        url: '/ARP.svg',
        width: 339,
        height: 324,
        anchorY: 162,
        mask: false,
      }),
      getIconSize: 20,
      iconSizeUnits: 'pixels',
      onClick: (info: any) => {
        if (info.object)
          onAerodromeClick(info.object.properties.icao_code, info.object.geometry.coordinates);
      },
    }),
    new TextLayer({
      id: 'aerodrome-text-layer',
      data: textData,
      visible: ctx.viewMode === 'ENROUTE',
      pickable: false,
      getPosition: (d: any) => d.position,
      getText: (d: any) => d.text,
      getSize: 12,
      sizeUnits: 'pixels',
      getColor: [255, 255, 255, 230],
      getPixelOffset: [0, 20],
      fontFamily: 'Inter, sans-serif',
      fontWeight: 700,
      outlineWidth: 2,
      outlineColor: [0, 0, 0, 180],
      fontSettings: { sdf: true },
    }),
  ];
}
