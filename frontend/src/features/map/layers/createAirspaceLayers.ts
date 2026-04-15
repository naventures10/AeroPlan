import { MVTLayer } from '@deck.gl/geo-layers';
import { CollisionFilterExtension } from '@deck.gl/extensions';
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
  DANGER: { fill: [255, 40, 40, 20], stroke: [255, 90, 90, 180] },
  PROHIBITED: { fill: [255, 0, 0, 15], stroke: [255, 0, 0, 120] },
  RESTRICTED: { fill: [255, 140, 0, 15], stroke: [255, 140, 0, 90] },
  TRA: { fill: [255, 200, 50, 15], stroke: [255, 200, 50, 90] },
  TSA: { fill: [200, 180, 50, 15], stroke: [200, 180, 50, 90] },
  ADIZ: { fill: [180, 80, 220, 15], stroke: [180, 80, 220, 100] },
  CTR: { fill: [50, 180, 255, 15], stroke: [50, 180, 255, 100] },
  CTA_LOWER: { fill: [80, 200, 220, 15], stroke: [80, 200, 220, 90] },
  CTA_UPPER: { fill: [60, 140, 200, 15], stroke: [60, 140, 200, 90] },
  UPR_ZONE: { fill: [190, 200, 255, 15], stroke: [190, 200, 255, 120] },
};

const DEFAULT_STROKE: [number, number, number, number] = [128, 128, 128, 60];

// ── Factory ──────────────────────────────────────────────────────────

export function createAirspaceLayers(ctx: LayerContext): any[] {
  const currentZoom = ctx.viewState?.zoom || 0;

  return [
    new MVTLayer({
      id: 'airspace-basemap-layer',
      data: `${window.location.origin}/tiles/airspaces_geometry/{z}/{x}/{y}`,
      visible: ctx.viewMode === 'ENROUTE',
      filled: false,
      stroked: true,
      pickable: false,
      getLineColor: (f: any) => {
        const type: string = (f.properties?.airspace_type || '').toString().trim().toUpperCase();
        const { airspaceFIR, airspaceRegulated, airspaceControl, airspaceUpr } = ctx.activeLayers;

        // Graduated progressive disclosure
        if (['FIR', 'ADIZ', 'UPR_ZONE'].includes(type)) {
          if (currentZoom < 2) return [0, 0, 0, 0];
        } else if (['CTA_UPPER', 'CTA_LOWER'].includes(type)) {
          if (currentZoom < 5.0) return [0, 0, 0, 0];
        } else {
          // Local/Granular sectors appear at close zoom
          if (currentZoom < 6.5) return [0, 0, 0, 0];
        }

        // Layer Toggle Logic
        if (type === 'FIR' && !airspaceFIR) return [0, 0, 0, 0];
        if (
          ['DANGER', 'PROHIBITED', 'RESTRICTED', 'TRA', 'TSA', 'ADIZ'].includes(type) &&
          !airspaceRegulated
        )
          return [0, 0, 0, 0];
        if (['CTR', 'CTA_LOWER', 'CTA_UPPER'].includes(type) && !airspaceControl)
          return [0, 0, 0, 0];
        if (type === 'UPR_ZONE' && !airspaceUpr) return [0, 0, 0, 0];

        // Draw standard non-interactive QGIS lines
        return AIRSPACE_COLORS[type]?.stroke ?? DEFAULT_STROKE;
      },
      getLineWidth: 2,
      lineWidthMinPixels: 1,
      updateTriggers: {
        getLineColor: [
          ctx.viewMode,
          ctx.activeLayers,
          currentZoom >= 2.0,
          currentZoom >= 5.0,
          currentZoom >= 5.5,
        ],
      },
    }),

    new MVTLayer({
      id: 'airspace-metadata-layer',
      data: `${window.location.origin}/tiles/airspaces_metadata/{z}/{x}/{y}`,
      visible: ctx.viewMode === 'ENROUTE',
      pickable: true,
      autoHighlight: false,
      pointType: 'text',
      extensions: [new CollisionFilterExtension()],
      collisionEnabled: true,
      collisionGroup: 'airspaces',
      getText: (f: any) => {
        const type: string = (f.properties?.airspace_type || '').toString().trim().toUpperCase();
        const { airspaceFIR, airspaceRegulated, airspaceControl, airspaceUpr } = ctx.activeLayers;

        // Aligned graduated progressive disclosure for labels
        if (['FIR', 'ADIZ', 'UPR_ZONE'].includes(type)) {
          if (currentZoom < 2) return '';
        } else if (['CTA_UPPER', 'CTA_LOWER'].includes(type)) {
          if (currentZoom < 5.0) return '';
        } else {
          if (currentZoom < 6.5) return '';
        }

        // Layer Toggle Logic
        if (type === 'FIR' && !airspaceFIR) return '';
        if (
          ['DANGER', 'PROHIBITED', 'RESTRICTED', 'TRA', 'TSA', 'ADIZ'].includes(type) &&
          !airspaceRegulated
        )
          return '';
        if (['CTR', 'CTA_LOWER', 'CTA_UPPER'].includes(type) && !airspaceControl) return '';
        if (type === 'UPR_ZONE' && !airspaceUpr) return '';

        const rawName = f.properties?.identification || f.properties?.name || 'Unknown';
        // Truncate long descriptive names
        const cleanName = rawName
          .split(/\||\n|I Area bounded/)[0]
          .trim()
          .substring(0, 30);
        return cleanName.length === 30 ? `${cleanName}...` : cleanName;
      },
      getTextSize: 12,
      getTextColor: (f: any) => {
        const id = f.properties?.id ?? f.id;
        if (ctx.highlightedAirspaceId && String(id) === ctx.highlightedAirspaceId) {
          return [0, 0, 0, 255]; // Black text on yellow background
        }
        const type: string = (f.properties?.airspace_type || '').toString().trim().toUpperCase();
        const baseColor = AIRSPACE_COLORS[type]?.stroke ?? DEFAULT_STROKE;
        // Match outline color but ensure full opacity for readability
        return [baseColor[0], baseColor[1], baseColor[2], 255];
      },
      textBackground: true,
      getTextBackgroundColor: (f: any) => {
        const id = f.properties?.id ?? f.id;
        if (ctx.highlightedAirspaceId && String(id) === ctx.highlightedAirspaceId) {
          return [255, 255, 0, 255]; // Opaque Yellow for highlight
        }
        // Faint 'glass' box with no fill look
        return [255, 255, 255, 15];
      },
      textBackgroundPadding: [4, 2] as [number, number],
      textOutlineWidth: 1.5,
      textOutlineColor: [0, 0, 0, 255],
      textFontSettings: { sdf: true },
      textFontFamily: 'Inter, sans-serif',
      updateTriggers: {
        getText: [ctx.activeLayers, currentZoom >= 2.0, currentZoom >= 5.0, currentZoom >= 6.5],
        getTextColor: [
          ctx.highlightedAirspaceId,
          currentZoom >= 2.0,
          currentZoom >= 5.0,
          currentZoom >= 6.5,
        ],
        getTextBackgroundColor: [
          ctx.highlightedAirspaceId,
          currentZoom >= 2.0,
          currentZoom >= 5.0,
          currentZoom >= 6.5,
        ],
      },
    }),
  ];
}
