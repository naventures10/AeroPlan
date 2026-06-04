/**
 * Aerodrome Layers
 *
 * Renders aerodrome reference point (ARP) icons from GeoJSON and their
 * ICAO code text labels underneath.
 */

import { GeoJsonLayer, TextLayer } from '@deck.gl/layers';
import { getLayerPalette } from './constants';
import type { LayerContext } from './types';

export function createAerodromeLayers(
  ctx: LayerContext,
  aerodromes: any,
  textData: { position: number[]; text: string }[],
  onAerodromeClick: (icao: string, coords: [number, number]) => void,
): any[] {
  const isLayerActive = ctx.activeLayers.aerodromes;
  const palette = getLayerPalette(ctx.isDarkMode);

  return [
    new GeoJsonLayer({
      id: 'aerodromes-compass-layer',
      data: aerodromes,
      visible: ctx.viewMode === 'ENROUTE',
      pickable: false,
      pointType: 'icon',
      getIcon: () => ({
        url: '/CompassRose.svg',
        width: 800,
        height: 800,
        anchorY: 400,
        mask: true,
      }),
      // Set to 40,000 meters so it represents roughly a ~10-12 NM radius in physical space, scaling seamlessly.
      getIconSize: 40000,
      iconSizeUnits: 'meters',
      // Using full opacity (255) for the compass rose.
      // If you'd like it semi-transparent, you can change 255 to a lower value (e.g., 150).
      getIconColor: isLayerActive
        ? [palette.purple[0], palette.purple[1], palette.purple[2], 255]
        : [192, 132, 252, 0],
      updateTriggers: {
        getIconColor: [isLayerActive, ctx.isDarkMode],
      },
      transitions: {
        getIconColor: {
          duration: 300,
          enter: (value: number[]) => [value[0], value[1], value[2], 0],
        },
      },
    }),
    new GeoJsonLayer({
      id: 'aerodromes-layer',
      data: aerodromes,
      visible: ctx.viewMode === 'ENROUTE',
      pickable: isLayerActive && !ctx.activeLayers.weather,
      pointType: 'icon',
      getIcon: () => ({
        url: '/ARP.svg',
        width: 100,
        height: 100,
        anchorY: 50,
        mask: true,
      }),
      getIconSize: 24,
      iconSizeUnits: 'pixels',
      getIconColor: isLayerActive ? palette.purple : [192, 132, 252, 0],
      onClick: (info: any) => {
        if (info.object)
          onAerodromeClick(info.object.properties.icao_code, info.object.geometry.coordinates);
      },
      updateTriggers: {
        getIconColor: [isLayerActive, ctx.isDarkMode],
      },
      transitions: {
        getIconColor: {
          duration: 300,
          enter: (value: number[]) => [value[0], value[1], value[2], 0],
        },
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
      getColor: isLayerActive
        ? ctx.isDarkMode
          ? ([...palette.rgbWhite, 230] as any)
          : ([...palette.rgbPurple, 255] as any)
        : [0, 0, 0, 0],
      getPixelOffset: [0, 20],
      fontFamily: 'Geist, sans-serif',
      fontWeight: 700,
      outlineWidth: 2,
      outlineColor: isLayerActive
        ? ctx.isDarkMode
          ? [0, 0, 0, 180]
          : [250, 249, 249, 180] // soft warm-white outline, not opaque
        : [0, 0, 0, 0],
      fontSettings: { sdf: true },
      updateTriggers: {
        getColor: [isLayerActive, ctx.isDarkMode],
        outlineColor: [isLayerActive, ctx.isDarkMode],
      },
      transitions: {
        getColor: {
          duration: 300,
          enter: (value: number[]) => [value[0], value[1], value[2], 0],
        },
        outlineColor: {
          duration: 300,
          enter: (value: number[]) => [value[0], value[1], value[2], 0],
        },
      },
    }),
  ];
}
