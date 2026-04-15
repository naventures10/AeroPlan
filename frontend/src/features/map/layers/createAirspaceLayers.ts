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
  FIR: { fill: [255, 165, 0, 10], stroke: [255, 165, 0, 80] },
  DANGER: { fill: [255, 60, 60, 15], stroke: [255, 60, 60, 100] },
  PROHIBITED: { fill: [255, 0, 0, 15], stroke: [255, 0, 0, 120] },
  RESTRICTED: { fill: [255, 140, 0, 15], stroke: [255, 140, 0, 90] },
  TRA: { fill: [255, 200, 50, 15], stroke: [255, 200, 50, 90] },
  TSA: { fill: [200, 180, 50, 15], stroke: [200, 180, 50, 90] },
  ADIZ: { fill: [180, 80, 220, 15], stroke: [180, 80, 220, 100] },
  CTR: { fill: [50, 180, 255, 15], stroke: [50, 180, 255, 100] },
  CTA_LOWER: { fill: [80, 200, 220, 15], stroke: [80, 200, 220, 90] },
  CTA_UPPER: { fill: [60, 140, 200, 15], stroke: [60, 140, 200, 90] },
  UPR_ZONE: { fill: [100, 100, 220, 15], stroke: [100, 100, 220, 90] },
};

const DEFAULT_FILL: [number, number, number, number] = [128, 128, 128, 10];
const DEFAULT_STROKE: [number, number, number, number] = [128, 128, 128, 60];

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

        // Visibility checks based on activeLayers sub-toggles
        const { airspaceFIR, airspaceRegulated, airspaceControl, airspaceUpr } = ctx.activeLayers;
        if (type === 'FIR' && !airspaceFIR) return [0, 0, 0, 0];
        if (
          ['DANGER', 'PROHIBITED', 'RESTRICTED', 'TRA', 'TSA', 'ADIZ'].includes(type) &&
          !airspaceRegulated
        )
          return [0, 0, 0, 0];
        if (['CTR', 'CTA_LOWER', 'CTA_UPPER'].includes(type) && !airspaceControl)
          return [0, 0, 0, 0];
        if (type === 'UPR_ZONE' && !airspaceUpr) return [0, 0, 0, 0];

        const baseColor = AIRSPACE_COLORS[type]?.fill ?? DEFAULT_FILL;

        // Boost opacity dramatically if this specific airspace is highlighted
        const id = f.properties?.id ?? f.id;
        if (ctx.highlightedAirspaceId && String(id) === ctx.highlightedAirspaceId) {
          return [baseColor[0], baseColor[1], baseColor[2], 80]; // Highlight fill
        }
        return baseColor;
      },
      getLineColor: (f: any) => {
        const type: string = f.properties?.airspace_type ?? '';

        const { airspaceFIR, airspaceRegulated, airspaceControl, airspaceUpr } = ctx.activeLayers;
        if (type === 'FIR' && !airspaceFIR) return [0, 0, 0, 0];
        if (
          ['DANGER', 'PROHIBITED', 'RESTRICTED', 'TRA', 'TSA', 'ADIZ'].includes(type) &&
          !airspaceRegulated
        )
          return [0, 0, 0, 0];
        if (['CTR', 'CTA_LOWER', 'CTA_UPPER'].includes(type) && !airspaceControl)
          return [0, 0, 0, 0];
        if (type === 'UPR_ZONE' && !airspaceUpr) return [0, 0, 0, 0];

        const baseColor = AIRSPACE_COLORS[type]?.stroke ?? DEFAULT_STROKE;

        const id = f.properties?.id ?? f.id;
        if (ctx.highlightedAirspaceId && String(id) === ctx.highlightedAirspaceId) {
          return [baseColor[0], baseColor[1], baseColor[2], 255]; // Max outline opacity
        }

        return baseColor;
      },
      getLineWidth: 2,
      lineWidthMinPixels: 1,
      pickable: true,
      autoHighlight: false, // We handle highlighting purely via ID
      updateTriggers: {
        getFillColor: [ctx.viewMode, ctx.activeLayers, ctx.highlightedAirspaceId],
        getLineColor: [ctx.viewMode, ctx.activeLayers, ctx.highlightedAirspaceId],
      },
    }),

    new TextLayer({
      id: 'airspace-fir-labels-layer',
      data: FIR_LABEL_DATA,
      visible: ctx.viewMode === 'ENROUTE' && ctx.activeLayers.airspaceFIR,
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
