/**
 * Airspace Layers
 *
 * Renders all airspace types from the `airspaces` Martin tile source.
 * Each airspace_type gets a distinct color so the pilot can visually
 * distinguish FIR boundaries from Danger Areas, CTRs, etc.
 */

import { MVTLayer } from '@deck.gl/geo-layers';
import { TextLayer } from '@deck.gl/layers';
import type { LayerContext } from './types';

// ── Per-type RGBA theming ────────────────────────────────────────────

const AIRSPACE_COLORS: Record<
  string,
  {
    fill: [number, number, number, number];
    stroke: [number, number, number, number];
  }
> = {
  FIR: { fill: [255, 165, 0, 30], stroke: [255, 165, 0, 180] },
  DANGER: { fill: [255, 60, 60, 35], stroke: [255, 60, 60, 200] },
  PROHIBITED: { fill: [255, 0, 0, 40], stroke: [255, 0, 0, 220] },
  RESTRICTED: { fill: [255, 140, 0, 30], stroke: [255, 140, 0, 160] },
  TRA: { fill: [255, 200, 50, 25], stroke: [255, 200, 50, 150] },
  TSA: { fill: [200, 180, 50, 25], stroke: [200, 180, 50, 150] },
  ADIZ: { fill: [180, 80, 220, 30], stroke: [180, 80, 220, 170] },
  CTR: { fill: [50, 180, 255, 35], stroke: [50, 180, 255, 190] },
  CTA_LOWER: { fill: [80, 200, 220, 25], stroke: [80, 200, 220, 160] },
  CTA_UPPER: { fill: [60, 140, 200, 25], stroke: [60, 140, 200, 160] },
  UPR_ZONE: { fill: [100, 100, 220, 25], stroke: [100, 100, 220, 150] },
};

const DEFAULT_FILL: [number, number, number, number] = [128, 128, 128, 20];
const DEFAULT_STROKE: [number, number, number, number] = [128, 128, 128, 120];

// ── Static FIR label centroids ───────────────────────────────────────

const FIR_LABEL_DATA = [
  { name: 'Delhi FIR', coordinates: [77.0, 26.5] },
  { name: 'Mumbai FIR', coordinates: [69.0, 18.5] },
  { name: 'Chennai FIR', coordinates: [82.0, 11.5] },
  { name: 'Kolkata FIR', coordinates: [87.5, 20.5] },
  { name: 'Guwahati SUB-FIR', coordinates: [92.5, 26.5] },
];

// ── Factory ──────────────────────────────────────────────────────────

export function createAirspaceLayers(ctx: LayerContext): any[] {
  return [
    new MVTLayer({
      id: 'airspace-fill-layer',
      data: `${window.location.origin}/tiles/airspaces/{z}/{x}/{y}`,
      visible: ctx.viewMode === 'ENROUTE',
      filled: true,
      stroked: true,
      getFillColor: (f: any) => {
        const type: string = f.properties?.airspace_type ?? '';
        return AIRSPACE_COLORS[type]?.fill ?? DEFAULT_FILL;
      },
      getLineColor: (f: any) => {
        const type: string = f.properties?.airspace_type ?? '';
        return AIRSPACE_COLORS[type]?.stroke ?? DEFAULT_STROKE;
      },
      getLineWidth: 2,
      lineWidthMinPixels: 1,
      pickable: false,
      updateTriggers: {
        getFillColor: [ctx.viewMode],
        getLineColor: [ctx.viewMode],
      },
    }),

    new TextLayer({
      id: 'airspace-fir-labels-layer',
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
