/**
 * FIR Airspace Layers
 *
 * Renders Flight Information Region boundaries (MVT polygons) and
 * static text labels at each FIR centroid.
 */

import { TextLayer } from '@deck.gl/layers';
import { MVTLayer } from '@deck.gl/geo-layers';
import type { LayerContext } from './types';

const FIR_LABEL_DATA = [
  { name: 'Delhi FIR', coordinates: [77.0, 26.5] },
  { name: 'Mumbai FIR', coordinates: [69.0, 18.5] },
  { name: 'Chennai FIR', coordinates: [82.0, 11.5] },
  { name: 'Kolkata FIR', coordinates: [87.5, 20.5] },
  { name: 'Guwahati SUB-FIR', coordinates: [92.5, 26.5] },
];

export function createFirLayers(ctx: LayerContext): any[] {
  return [
    new MVTLayer({
      id: 'fir-airspace-layer',
      data: `${window.location.origin}/tiles/fir_airspaces/{z}/{x}/{y}`,
      visible: ctx.viewMode === 'ENROUTE',
      filled: true,
      stroked: true,
      getFillColor: [255, 165, 0, 40],
      getLineColor: [255, 165, 0, 200],
      getLineWidth: 2,
      lineWidthMinPixels: 2,
      pickable: false, // Ensures it never traps clicks
    }),
    new TextLayer({
      id: 'fir-airspace-labels-layer',
      data: FIR_LABEL_DATA,
      visible: ctx.viewMode === 'ENROUTE',
      getPosition: (d: any) => d.coordinates,
      getText: (d: any) => d.name,
      getSize: 16,
      sizeUnits: 'pixels',
      getColor: [255, 165, 0, 255],
      fontFamily: 'Inter, sans-serif',
      fontWeight: 800,
      outlineWidth: 3,
      outlineColor: [0, 0, 0, 200],
      fontSettings: { sdf: true },
    }),
  ];
}
