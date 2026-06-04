import { MVTLayer } from '@deck.gl/geo-layers';
import type { LayerContext } from './types';
import { getAirspaceColors, getDefaultStroke } from './constants';

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

// ── Helpers ──────────────────────────────────────────────────────────

function getHierarchy(type: string) {
  return AIRSPACE_HIERARCHY[type] || DEFAULT_HIERARCHY;
}

// Small cache for identification-based type inference to avoid regex overhead on every feature
const TYPE_CACHE = new Map<string, string>();

function inferAirspaceType(feature: any): string {
  const props = feature.properties;
  if (!props) return '';

  const ident = props.identification;
  const identStr = ident ? String(ident).toUpperCase() : '';

  if (identStr) {
    if (TYPE_CACHE.has(identStr)) return TYPE_CACHE.get(identStr)!;

    // Explicit overrides for obvious misclassifications in DB
    if (/\bTSA\d*/.test(identStr)) {
      TYPE_CACHE.set(identStr, 'TSA');
      return 'TSA';
    }
    if (/\bTRA\d*/.test(identStr)) {
      TYPE_CACHE.set(identStr, 'TRA');
      return 'TRA';
    }
  }

  const rawType = props.airspace_type;
  if (rawType) return String(rawType).toUpperCase();

  if (identStr) {
    let type = '';
    if (identStr.indexOf('VD') !== -1) type = 'DANGER';
    else if (identStr.indexOf('VP') !== -1) type = 'PROHIBITED';
    else if (identStr.indexOf('VR') !== -1) type = 'RESTRICTED';

    if (type && TYPE_CACHE.size < 2000) {
      TYPE_CACHE.set(identStr, type);
    }
    if (type) return type;
  }

  return '';
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
  const isLayerActive = ctx.activeLayers.airspaces;
  const colors = getAirspaceColors(ctx.isDarkMode);
  const defStroke = getDefaultStroke(ctx.isDarkMode);
  const { isAirspaceLoaded, setAirspaceLoaded } = ctx;

  return [
    new MVTLayer({
      id: 'airspace-basemap-layer',
      data: `${window.location.origin}/tiles/airspaces_geometry/{z}/{x}/{y}`,
      visible: ctx.viewMode === 'ENROUTE',
      pickable: false,
      autoHighlight: false,
      getFillColor: (f: any) => {
        if (!isLayerActive || !isAirspaceLoaded) return [0, 0, 0, 0];
        const props = f.properties || {};
        const type = (props.airspace_type || '').toString().toUpperCase();

        const hierarchy = getHierarchy(type);
        if (effectiveZoom < hierarchy.minZoom) return [0, 0, 0, 0];

        return [0, 0, 0, 0];
      },
      getLineColor: (f: any) => {
        if (!isLayerActive || !isAirspaceLoaded) return [0, 0, 0, 0];
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

        return colors[type]?.stroke ?? defStroke;
      },
      getLineWidth: 2,
      onViewportLoad: () => setAirspaceLoaded(true),
      lineWidthUnits: 'pixels',
      lineWidthMinPixels: 1,
      minZoom: 2,
      updateTriggers: {
        getFillColor: [
          ctx.viewMode,
          ctx.activeLayers,
          effectiveZoom,
          isLayerActive,
          ctx.isDarkMode,
          isAirspaceLoaded,
        ],
        getLineColor: [
          ctx.viewMode,
          ctx.activeLayers,
          effectiveZoom,
          isLayerActive,
          ctx.isDarkMode,
          isAirspaceLoaded,
        ],
        getLineWidth: [],
      },
      binary: true,
      transitions: {
        getFillColor: 300,
        getLineColor: 300,
      },
    }),

    new MVTLayer({
      id: 'airspace-metadata-layer',
      data: `${window.location.origin}/tiles/airspaces_metadata/{z}/{x}/{y}`,
      visible: ctx.viewMode === 'ENROUTE',
      pickable: isLayerActive,
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
        if (!isLayerActive || !isAirspaceLoaded) return [0, 0, 0, 0];
        const type = inferAirspaceType(f);
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

        const typeUpper = inferAirspaceType(f);

        const baseColor = colors[typeUpper]?.stroke ?? defStroke;
        return [baseColor[0], baseColor[1], baseColor[2], 255];
      },
      background: true,
      getBackgroundColor: [0, 0, 0, 0],
      getBorderWidth: 2,
      getBorderColor: (f: any) => {
        if (!isLayerActive || !isAirspaceLoaded) return [0, 0, 0, 0];
        const type = inferAirspaceType(f);
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

        if (effectiveZoom < getHierarchy(type).minZoom) return [0, 0, 0, 0];

        const props = f.properties || {};
        if (!(props.name || props.identification)) return [0, 0, 0, 0];

        const airspaceColor = colors[type] || { stroke: defStroke };
        const baseColor = airspaceColor.stroke || defStroke;
        return [baseColor[0], baseColor[1], baseColor[2], 255];
      },
      backgroundPadding: [4, 2],
      fontWeight: 600,
      fontStyle: 'italic',
      textFontSettings: { sdf: false },
      textFontFamily: 'Geist, sans-serif',
      minZoom: 2,
      updateTriggers: {
        getText: [ctx.activeLayers, effectiveZoom],
        getTextSize: [ctx.activeLayers, effectiveZoom],
        getTextColor: [
          effectiveZoom,
          ctx.activeLayers,
          isLayerActive,
          ctx.isDarkMode,
          isAirspaceLoaded,
        ],
        getBackgroundColor: [
          effectiveZoom,
          ctx.activeLayers,
          isLayerActive,
          ctx.isDarkMode,
          isAirspaceLoaded,
        ],
        getBorderColor: [
          effectiveZoom,
          ctx.activeLayers,
          isLayerActive,
          ctx.isDarkMode,
          isAirspaceLoaded,
        ],
      },
      binary: false,
      transitions: {
        getTextColor: 300,
        getBackgroundColor: 300,
        getBorderColor: 300,
      },
    }),
  ];
}
