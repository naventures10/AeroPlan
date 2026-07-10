/**
 * Aerodrome Layers
 *
 * Renders aerodrome reference point (ARP) icons from GeoJSON and their
 * ICAO code text labels underneath.
 */

import { GeoJsonLayer, TextLayer } from '@deck.gl/layers';
import { getLayerPalette } from './constants';
import type { LayerContext } from './types';

/** Hoisted icon definitions — avoids allocating new objects per feature. */
const COMPASS_ROSE_ICON = {
  url: '/CompassRose.svg',
  width: 800,
  height: 800,
  anchorY: 400,
  mask: true,
} as const;

const ARP_ICON = {
  url: '/ARP.svg',
  width: 100,
  height: 100,
  anchorY: 50,
  mask: true,
} as const;

export function createAerodromeLayers(
  ctx: LayerContext,
  aerodromes: any,
  textData: { position: number[]; text: string }[],
  onAerodromeClick: (icao: string, coords: [number, number]) => void,
): any[] {
  const isLayerActive = ctx.activeLayers.aerodromes;
  const palette = getLayerPalette(ctx.isDarkMode);

  const transparentColor: [number, number, number, number] = [0, 0, 0, 0];
  const transparentPurple: [number, number, number, number] = [192, 132, 252, 0];

  const textColor: [number, number, number, number] = isLayerActive
    ? ctx.isDarkMode
      ? [palette.rgbWhite[0], palette.rgbWhite[1], palette.rgbWhite[2], 230]
      : [palette.rgbPurple[0], palette.rgbPurple[1], palette.rgbPurple[2], 255]
    : transparentColor;

  const outlineColor: [number, number, number, number] = isLayerActive
    ? ctx.isDarkMode
      ? [0, 0, 0, 180]
      : [250, 249, 249, 180]
    : transparentColor;

  return [
    new GeoJsonLayer({
      id: 'aerodromes-compass-layer',
      data: aerodromes,
      visible: ctx.viewMode === 'ENROUTE',
      pickable: false,
      pointType: 'icon',
      getIcon: () => COMPASS_ROSE_ICON,
      // Set to 40,000 meters so it represents roughly a ~10-12 NM radius in physical space, scaling seamlessly.
      getIconSize: 40000,
      iconSizeUnits: 'meters',
      // Using full opacity (255) for the compass rose.
      // If you'd like it semi-transparent, you can change 255 to a lower value (e.g., 150).
      getIconColor: isLayerActive ? palette.purple : transparentPurple,
      updateTriggers: {
        getIconColor: [isLayerActive, ctx.isDarkMode],
      },
      transitions: {
        getIconColor: 300,
      },
    }),
    new GeoJsonLayer({
      id: 'aerodromes-layer',
      data: aerodromes,
      visible: ctx.viewMode === 'ENROUTE',
      pickable: isLayerActive && !ctx.activeLayers.weather,
      pointType: 'icon',
      getIcon: () => ARP_ICON,
      getIconSize: 24,
      iconSizeUnits: 'pixels',
      getIconColor: isLayerActive ? palette.purple : transparentPurple,
      onClick: (info: any) => {
        if (info.object)
          onAerodromeClick(info.object.properties.icao_code, info.object.geometry.coordinates);
      },
      updateTriggers: {
        getIconColor: [isLayerActive, ctx.isDarkMode],
      },
      transitions: {
        getIconColor: 300,
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
      getColor: textColor,
      getPixelOffset: [0, 20],
      fontFamily: 'Geist, sans-serif',
      fontWeight: 700,
      outlineWidth: 2,
      outlineColor: outlineColor,
      fontSettings: { sdf: true },
      updateTriggers: {
        getColor: [isLayerActive, ctx.isDarkMode],
        outlineColor: [isLayerActive, ctx.isDarkMode],
      },
      transitions: {
        getColor: 300,
        outlineColor: 300,
      },
    }),
  ];
}
