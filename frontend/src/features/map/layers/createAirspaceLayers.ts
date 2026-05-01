import { MVTLayer } from '@deck.gl/geo-layers';
import { EXTENSIONS } from './constants';
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

const AIRSPACE_HIERARCHY: Record<string, { minZoom: number; priority: number }> = {
  FIR: { minZoom: 2.0, priority: 100 },
  ADIZ: { minZoom: 2.5, priority: 90 },
  CTA_UPPER: { minZoom: 4.0, priority: 80 },
  UPR_ZONE: { minZoom: 4.5, priority: 75 },
  DANGER: { minZoom: 7.0, priority: 70 },
  PROHIBITED: { minZoom: 7.0, priority: 70 },
  RESTRICTED: { minZoom: 7.0, priority: 65 },
  CTA_LOWER: { minZoom: 6.0, priority: 60 },
  TRA: { minZoom: 6.5, priority: 50 },
  TSA: { minZoom: 6.5, priority: 50 },
  CTR: { minZoom: 7.0, priority: 40 },
};

const DEFAULT_HIERARCHY = { minZoom: 7.5, priority: 10 };

const ZOOM_THRESHOLDS = [2.0, 2.5, 4.0, 4.5, 6.0, 6.5, 7.0, 7.5];

const DEFAULT_STROKE: [number, number, number, number] = [128, 128, 128, 60];

// ── Helpers ──────────────────────────────────────────────────────────

function getHierarchy(type: string) {
  return AIRSPACE_HIERARCHY[type] || DEFAULT_HIERARCHY;
}

// Small cache for identification-based type inference to avoid regex overhead on every feature
const TYPE_CACHE = new Map<string, string>();

function inferAirspaceType(feature: any): string {
  const props = feature.properties;
  if (!props) return '';

  const rawType = props.airspace_type;
  if (rawType) return String(rawType).toUpperCase();

  const ident = props.identification;
  if (!ident) return '';

  const identStr = String(ident).toUpperCase();
  if (TYPE_CACHE.has(identStr)) return TYPE_CACHE.get(identStr)!;

  let type = '';
  if (identStr.match(/\bV[AEOI]D\b/)) type = 'DANGER';
  else if (identStr.match(/\bV[AEOI]P\b/)) type = 'PROHIBITED';
  else if (identStr.match(/\bV[AEOI]R\b/)) type = 'RESTRICTED';
  else if (identStr.includes('TSA')) type = 'TSA';
  else if (identStr.includes('TRA')) type = 'TRA';

  // Limit cache size to prevent memory leaks if idents are unique/infinite
  if (TYPE_CACHE.size < 1000) {
    TYPE_CACHE.set(identStr, type);
  }

  return type;
}

function getTextForFeature(f: any, zoom: number, layers: any): string {
  const props = f.properties;
  if (!props) return '';

  const type = inferAirspaceType(f);
  const h = getHierarchy(type);

  // Progressive disclosure check
  if (zoom < h.minZoom) return '';

  // Layer Toggle Logic - early exit before expensive string work
  const { airspaceFIR, airspaceRegulated, airspaceControl, airspaceUpr } = layers;
  if (type === 'FIR') {
    if (!airspaceFIR) return '';
  } else if (['DANGER', 'PROHIBITED', 'RESTRICTED', 'TRA', 'TSA', 'ADIZ'].includes(type)) {
    if (!airspaceRegulated) return '';
  } else if (['CTR', 'CTA_LOWER', 'CTA_UPPER'].includes(type)) {
    if (!airspaceControl) return '';
  } else if (type === 'UPR_ZONE') {
    if (!airspaceUpr) return '';
  }

  const rawName = props.identification || props.name || '';
  if (!rawName) return '';

  const nameStr = String(rawName);
  // Faster truncation without heavy regex if possible
  let processedName = nameStr;
  const splitIdx = nameStr.search(/\||\n|I Area/);
  if (splitIdx !== -1) {
    processedName = nameStr.substring(0, splitIdx).trim();
  } else {
    processedName = nameStr.trim();
  }

  if (processedName.length > 20) {
    return processedName.substring(0, 20) + '...';
  }
  return processedName;
}

// ── Factory ──────────────────────────────────────────────────────────

export function createAirspaceLayers(ctx: LayerContext): any[] {
  const currentZoom = ctx.viewState?.zoom || 0;
  const effectiveZoom =
    ZOOM_THRESHOLDS.slice()
      .reverse()
      .find((z) => currentZoom >= z) || 0;

  return [
    new MVTLayer({
      id: 'airspace-basemap-layer',
      data: `${window.location.origin}/tiles/airspaces_geometry/{z}/{x}/{y}`,
      visible: ctx.viewMode === 'ENROUTE',
      filled: false,
      stroked: true,
      pickable: false,
      getLineColor: (f: any) => {
        const type = inferAirspaceType(f);
        const { airspaceFIR, airspaceRegulated, airspaceControl, airspaceUpr } = ctx.activeLayers;
        const h = getHierarchy(type);

        // Hierarchical progressive disclosure for lines
        if (effectiveZoom < h.minZoom) return [0, 0, 0, 0];

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
      minZoom: 2,
      updateTriggers: {
        getLineColor: [ctx.viewMode, ctx.activeLayers, effectiveZoom],
      },
      binary: true,
    }),

    new MVTLayer({
      id: 'airspace-metadata-layer',
      data: `${window.location.origin}/tiles/airspaces_metadata/{z}/{x}/{y}`,
      visible: ctx.viewMode === 'ENROUTE',
      pickable: true,
      autoHighlight: false,
      pointType: 'text',
      extensions: EXTENSIONS,
      collisionEnabled: true,
      collisionGroup: 'airspaces',
      getCollisionPriority: (f: any) => {
        const type = inferAirspaceType(f);
        return getHierarchy(type).priority;
      },
      getText: (f: any) => getTextForFeature(f, effectiveZoom, ctx.activeLayers),
      getTextSize: (f: any) => {
        const text = getTextForFeature(f, effectiveZoom, ctx.activeLayers);
        return text ? 12 : 0;
      },
      getTextColor: (f: any) => {
        const id = f.properties?.id ?? f.id;
        if (ctx.highlightedAirspaceId && String(id) === ctx.highlightedAirspaceId) {
          return [0, 0, 0, 255]; // Black text on yellow background
        }
        const type = inferAirspaceType(f);

        const baseColor = AIRSPACE_COLORS[type]?.stroke ?? DEFAULT_STROKE;
        return [baseColor[0], baseColor[1], baseColor[2], 255];
      },
      background: true,
      getBackgroundColor: (f: any) => {
        const text = getTextForFeature(f, effectiveZoom, ctx.activeLayers);
        if (!text) return [0, 0, 0, 0];

        const id = f.properties?.id ?? f.id;
        if (ctx.highlightedAirspaceId && String(id) === ctx.highlightedAirspaceId) {
          return [255, 255, 0, 40]; // Very subtle yellow fill for highlight
        }
        return [0, 0, 0, 0]; // No fill
      },
      getBorderWidth: 2,
      getBorderColor: (f: any) => {
        const text = getTextForFeature(f, effectiveZoom, ctx.activeLayers);
        if (!text) return [0, 0, 0, 0];

        const id = f.properties?.id ?? f.id;
        if (ctx.highlightedAirspaceId && String(id) === ctx.highlightedAirspaceId) {
          return [255, 255, 0, 255]; // Yellow border for highlight
        }

        const type = (f.properties?.airspace_type || '').toString().toUpperCase();
        const colors = AIRSPACE_COLORS[type as keyof typeof AIRSPACE_COLORS] || {
          stroke: DEFAULT_STROKE,
        };
        const baseColor = colors.stroke || DEFAULT_STROKE;
        return [baseColor[0], baseColor[1], baseColor[2], 255];
      },
      backgroundPadding: [4, 2],
      fontWeight: 600,
      fontStyle: 'italic',
      textFontSettings: { sdf: false },
      textFontFamily: 'Inter, sans-serif',
      minZoom: 2,
      updateTriggers: {
        getText: [ctx.activeLayers, effectiveZoom],
        getTextSize: [ctx.activeLayers, effectiveZoom],
        getTextColor: [ctx.highlightedAirspaceId, effectiveZoom],
        getBackgroundColor: [ctx.highlightedAirspaceId, effectiveZoom],
        getBorderColor: [ctx.highlightedAirspaceId, effectiveZoom],
      },
      binary: false,
    }),
  ];
}
