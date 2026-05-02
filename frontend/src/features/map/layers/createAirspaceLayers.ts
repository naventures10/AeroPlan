import { MVTLayer } from '@deck.gl/geo-layers';
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
  if (identStr.indexOf('VD') !== -1) type = 'DANGER';
  else if (identStr.indexOf('VP') !== -1) type = 'PROHIBITED';
  else if (identStr.indexOf('VR') !== -1) type = 'RESTRICTED';
  else if (identStr.indexOf('TSA') !== -1) type = 'TSA';
  else if (identStr.indexOf('TRA') !== -1) type = 'TRA';

  // Limit cache size to prevent memory leaks
  if (TYPE_CACHE.size < 2000) {
    TYPE_CACHE.set(identStr, type);
  }

  return type;
}

// Fast string cache for labels
const LABEL_CACHE = new Map<string, string>();

function getTextForFeature(f: any, zoom: number, layers: any): string {
  const props = f.properties;
  if (!props) return '';

  const type = inferAirspaceType(f);
  const h = getHierarchy(type);

  // Progressive disclosure check
  if (zoom < h.minZoom) return '';

  // Layer Toggle Logic - early exit before expensive string work
  const { airspaceFIR, airspaceRegulated, airspaceControl, airspaceUpr } = layers;
  if (type === 'FIR' && !airspaceFIR) return '';
  if (
    ['DANGER', 'PROHIBITED', 'RESTRICTED', 'TRA', 'TSA', 'ADIZ'].includes(type) &&
    !airspaceRegulated
  )
    return '';
  if (['CTR', 'CTA_LOWER', 'CTA_UPPER'].includes(type) && !airspaceControl) return '';
  if (type === 'UPR_ZONE' && !airspaceUpr) return '';

  const rawName = props.identification || props.name || '';
  if (!rawName) return '';
  const nameStr = String(rawName);

  if (LABEL_CACHE.has(nameStr)) return LABEL_CACHE.get(nameStr)!;

  // Faster truncation
  let processedName = nameStr;
  const splitIdx = nameStr.search(/\||\n|I Area/);
  if (splitIdx !== -1) {
    processedName = nameStr.substring(0, splitIdx).trim();
  } else {
    processedName = nameStr.trim();
  }

  if (processedName.length > 20) {
    processedName = processedName.substring(0, 20) + '...';
  }

  if (LABEL_CACHE.size < 5000) {
    LABEL_CACHE.set(nameStr, processedName);
  }

  return processedName;
}

// ── Factory ──────────────────────────────────────────────────────────

export function createAirspaceLayers(ctx: LayerContext): any[] {
  const currentZoom = ctx.zoom || 0;
  const effectiveZoom =
    ZOOM_THRESHOLDS.slice()
      .reverse()
      .find((z) => currentZoom >= z) || 0;

  return [
    new MVTLayer({
      id: 'airspace-basemap-layer',
      data: `${window.location.origin}/tiles/airspaces_geometry/{z}/{x}/{y}`,
      visible: ctx.viewMode === 'ENROUTE',
      pickable: true,
      autoHighlight: false,
      getFillColor: (f: any) => {
        const props = f.properties || {};
        const type = (props.airspace_type || '').toString().toUpperCase();

        const hierarchy = getHierarchy(type);
        if (effectiveZoom < hierarchy.minZoom) return [0, 0, 0, 0];

        const id = props.id ?? f.id;
        if (ctx.highlightedAirspaceId && String(id) === ctx.highlightedAirspaceId) {
          return [255, 255, 0, 40]; // Yellow highlight fill
        }

        return [0, 0, 0, 0];
      },
      getLineColor: (f: any) => {
        const type = inferAirspaceType(f);
        const { airspaceFIR, airspaceRegulated, airspaceControl, airspaceUpr } = ctx.activeLayers;
        const h = getHierarchy(type);

        if (effectiveZoom < h.minZoom) return [0, 0, 0, 0];

        if (type === 'FIR' && !airspaceFIR) return [0, 0, 0, 0];
        if (
          ['DANGER', 'PROHIBITED', 'RESTRICTED', 'TRA', 'TSA', 'ADIZ'].includes(type) &&
          !airspaceRegulated
        )
          return [0, 0, 0, 0];
        if (['CTR', 'CTA_LOWER', 'CTA_UPPER'].includes(type) && !airspaceControl)
          return [0, 0, 0, 0];
        if (type === 'UPR_ZONE' && !airspaceUpr) return [0, 0, 0, 0];

        const props = f.properties || {};
        const id = props.id ?? f.id;
        if (ctx.highlightedAirspaceId && String(id) === ctx.highlightedAirspaceId) {
          return [255, 255, 0, 255]; // Yellow highlight outline
        }

        return AIRSPACE_COLORS[type]?.stroke ?? DEFAULT_STROKE;
      },
      getLineWidth: (f: any) => {
        const props = f.properties || {};
        const id = props.id ?? f.id;
        if (ctx.highlightedAirspaceId && String(id) === ctx.highlightedAirspaceId) {
          return 3;
        }
        return 2;
      },
      lineWidthMinPixels: 1,
      minZoom: 2,
      updateTriggers: {
        getFillColor: [ctx.viewMode, ctx.activeLayers, effectiveZoom, ctx.highlightedAirspaceId],
        getLineColor: [ctx.viewMode, ctx.activeLayers, effectiveZoom, ctx.highlightedAirspaceId],
        getLineWidth: [ctx.highlightedAirspaceId],
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
      // extensions: EXTENSIONS,
      // collisionEnabled: true,
      // collisionGroup: 'airspaces',
      getCollisionPriority: (f: any) => {
        const type = inferAirspaceType(f);
        return getHierarchy(type).priority;
      },
      getText: (f: any) => getTextForFeature(f, effectiveZoom, ctx.activeLayers),
      getTextSize: (f: any) => {
        const type = inferAirspaceType(f);
        if (effectiveZoom < getHierarchy(type).minZoom) return 0;
        const props = f.properties || {};
        if (!(props.name || props.identification)) return 0;
        return 12;
      },
      getTextColor: (f: any) => {
        const id = f.properties?.id ?? f.id;
        if (ctx.highlightedAirspaceId && String(id) === ctx.highlightedAirspaceId) {
          return [255, 255, 0, 255]; // Bright yellow text for selection
        }
        const type = inferAirspaceType(f);

        const baseColor = AIRSPACE_COLORS[type]?.stroke ?? DEFAULT_STROKE;
        return [baseColor[0], baseColor[1], baseColor[2], 255];
      },
      background: true,
      getBackgroundColor: (f: any) => {
        // Fast path check to avoid full string processing
        const type = inferAirspaceType(f);
        if (effectiveZoom < getHierarchy(type).minZoom) return [0, 0, 0, 0];

        const id = f.properties?.id ?? f.id;
        if (ctx.highlightedAirspaceId && String(id) === ctx.highlightedAirspaceId) {
          return [0, 0, 0, 180]; // Semi-transparent black background for contrast
        }
        return [0, 0, 0, 0]; // No fill
      },
      getBorderWidth: 2,
      getBorderColor: (f: any) => {
        // Fast path check
        const type = inferAirspaceType(f);
        if (effectiveZoom < getHierarchy(type).minZoom) return [0, 0, 0, 0];

        const id = f.properties?.id ?? f.id;
        if (ctx.highlightedAirspaceId && String(id) === ctx.highlightedAirspaceId) {
          return [255, 255, 0, 255]; // Yellow border for highlight
        }

        const props = f.properties || {};
        if (!(props.name || props.identification)) return [0, 0, 0, 0];

        const colors = AIRSPACE_COLORS[type] || { stroke: DEFAULT_STROKE };
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
