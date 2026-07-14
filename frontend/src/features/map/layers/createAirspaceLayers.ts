import { MVTLayer } from '@deck.gl/geo-layers';
import { GeoJsonLayer } from '@deck.gl/layers';
import type { LayerContext } from './types';
import { getAirspaceColors, getDefaultStroke } from './constants';

const AIRSPACE_HIERARCHY: Record<string, { priority: number }> = {
  FIR: { priority: 100 },
  ADIZ: { priority: 90 },
  CTA_UPPER: { priority: 80 },
  UPR_ZONE: { priority: 75 },
  DANGER: { priority: 70 },
  PROHIBITED: { priority: 70 },
  RESTRICTED: { priority: 65 },
  CTA_LOWER: { priority: 60 },
  TRA: { priority: 50 },
  TSA: { priority: 50 },
  CTR: { priority: 40 },
};

const DEFAULT_HIERARCHY = { priority: 10 };

// ── Helpers ──────────────────────────────────────────────────────────

function getHierarchy(type: string) {
  return AIRSPACE_HIERARCHY[type] || DEFAULT_HIERARCHY;
}

// Small cache for identification-based type inference to avoid regex overhead on every feature
const TYPE_CACHE = new Map<string, string>();

// fallow-ignore-next-line complexity
function computeAirspaceType(feature: any): string {
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

function inferAirspaceType(feature: any): string {
  if (!feature) return '';
  if (feature._inferredType !== undefined) return feature._inferredType;
  const type = computeAirspaceType(feature);
  feature._inferredType = type;
  return type;
}

// Fast string cache for labels
const LABEL_CACHE = new Map<string, string>();

function getTextForFeature(f: any, isTypeVisible: (type: string) => boolean): string {
  const props = f.properties;
  if (!props) return '';

  const type = inferAirspaceType(f);

  // Early exit if the sublayer is not visible at the current zoom
  if (!isTypeVisible(type)) return '';

  if (f._processedLabel !== undefined) return f._processedLabel;

  const rawName = props.identification || props.name || '';
  if (!rawName) {
    f._processedLabel = '';
    return '';
  }
  const nameStr = String(rawName);

  if (LABEL_CACHE.has(nameStr)) {
    const val = LABEL_CACHE.get(nameStr)!;
    f._processedLabel = val;
    return val;
  }

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

  f._processedLabel = processedName;
  return processedName;
}

// ── Factory ──────────────────────────────────────────────────────────

export function createAirspaceLayers(ctx: LayerContext): any[] {
  const isLayerActive = ctx.activeLayers.airspaces;
  const colors = getAirspaceColors(ctx.isDarkMode);
  const defStroke = getDefaultStroke(ctx.isDarkMode);
  const { isAirspaceLoaded, setAirspaceLoaded } = ctx;

  const typeVisibilityMap = new Map<string, boolean>([
    ['FIR', ctx.activeLayers.airspace_FIR],
    ['ADIZ', ctx.activeLayers.airspace_ADIZ],
    ['CTA_UPPER', ctx.activeLayers.airspace_CTA_UPPER],
    ['UPR_ZONE', ctx.activeLayers.airspace_UPR_ZONE],
    ['DANGER', ctx.activeLayers.airspace_DANGER],
    ['PROHIBITED', ctx.activeLayers.airspace_PROHIBITED],
    ['RESTRICTED', ctx.activeLayers.airspace_RESTRICTED],
    ['CTA_LOWER', ctx.activeLayers.airspace_CTA_LOWER],
    ['TRA', ctx.activeLayers.airspace_TRA],
    ['TSA', ctx.activeLayers.airspace_TSA],
    ['CTR', ctx.activeLayers.airspace_CTR],
  ]);

  const isTypeVisible = (type: string): boolean => {
    const visible = typeVisibilityMap.get(type);
    if (visible !== undefined) return visible;
    // Fallback for types not in explicit hierarchy
    return true;
  };

  return [
    new MVTLayer({
      id: 'airspace-basemap-layer',
      data: `${window.location.origin}/tiles/get_airspaces_geometry/{z}/{x}/{y}`,
      visible: ctx.viewMode === 'ENROUTE' && isLayerActive,
      filled: false,
      pickable: false,
      autoHighlight: false,
      renderSubLayers: (props: any) => {
        const { data } = props;
        if (!data || !Array.isArray(data)) return null;
        const filteredData = data.filter((f: any) => {
          const type = inferAirspaceType(f);
          return isTypeVisible(type);
        });
        if (filteredData.length === 0) return null;
        return new GeoJsonLayer({
          ...props,
          id: props.id,
          data: filteredData,
        });
      },
      // fallow-ignore-next-line complexity
      getLineColor: (f: any) => {
        if (!isLayerActive || !isAirspaceLoaded) return [0, 0, 0, 0];
        const type = inferAirspaceType(f);
        if (!isTypeVisible(type)) return [0, 0, 0, 0];

        return colors[type]?.stroke ?? defStroke;
      },
      getLineWidth: 2,
      onViewportLoad: () => setAirspaceLoaded(true),
      lineWidthUnits: 'pixels',
      lineWidthMinPixels: 1,
      minZoom: 2,
      updateTriggers: {
        getLineColor: [
          ctx.viewMode,
          isLayerActive,
          ctx.isDarkMode,
          isAirspaceLoaded,
          ctx.activeLayers.airspace_FIR,
          ctx.activeLayers.airspace_ADIZ,
          ctx.activeLayers.airspace_CTA_UPPER,
          ctx.activeLayers.airspace_UPR_ZONE,
          ctx.activeLayers.airspace_DANGER,
          ctx.activeLayers.airspace_PROHIBITED,
          ctx.activeLayers.airspace_RESTRICTED,
          ctx.activeLayers.airspace_CTA_LOWER,
          ctx.activeLayers.airspace_TRA,
          ctx.activeLayers.airspace_TSA,
          ctx.activeLayers.airspace_CTR,
        ],
        getLineWidth: [],
      },
      binary: false,
      parameters: { depthTest: false },
      transitions: ctx.isMobile
        ? undefined
        : {
            getLineColor: 300,
          },
    }),

    new MVTLayer({
      id: 'airspace-metadata-layer',
      data: `${window.location.origin}/tiles/get_airspaces_metadata/{z}/{x}/{y}`,
      visible: ctx.viewMode === 'ENROUTE' && isLayerActive,
      pickable: isLayerActive && !ctx.activeLayers.weather,
      autoHighlight: false,
      pointType: 'text',
      renderSubLayers: (props: any) => {
        const { data } = props;
        if (!data || !Array.isArray(data)) return null;
        const filteredData = data.filter((f: any) => {
          const type = inferAirspaceType(f);
          return isTypeVisible(type);
        });
        if (filteredData.length === 0) return null;
        return new GeoJsonLayer({
          ...props,
          id: props.id,
          data: filteredData,
        });
      },
      // extensions: EXTENSIONS,
      // collisionEnabled: true,
      // collisionGroup: 'airspaces',
      getCollisionPriority: (f: any) => {
        const type = inferAirspaceType(f);
        return getHierarchy(type).priority;
      },
      getText: (f: any) => getTextForFeature(f, isTypeVisible),
      getTextSize: (f: any) => {
        const type = inferAirspaceType(f);
        if (!isTypeVisible(type)) return 0;
        const props = f.properties || {};
        if (!(props.name || props.identification)) return 0;
        return 12;
      },
      // fallow-ignore-next-line complexity
      getTextColor: (f: any) => {
        if (!isLayerActive || !isAirspaceLoaded) return [0, 0, 0, 0];
        const type = inferAirspaceType(f);
        if (!isTypeVisible(type)) return [0, 0, 0, 0];

        const baseColor = colors[type]?.stroke ?? defStroke;
        return [baseColor[0], baseColor[1], baseColor[2], 255];
      },
      background: true,
      getBackgroundColor: [0, 0, 0, 0],
      getBorderWidth: 2,
      // fallow-ignore-next-line complexity
      getBorderColor: (f: any) => {
        if (!isLayerActive || !isAirspaceLoaded) return [0, 0, 0, 0];
        const type = inferAirspaceType(f);
        if (!isTypeVisible(type)) return [0, 0, 0, 0];

        const props = f.properties || {};
        if (!(props.name || props.identification)) return [0, 0, 0, 0];

        const baseColor = colors[type]?.stroke ?? defStroke;
        return [baseColor[0], baseColor[1], baseColor[2], 255];
      },
      backgroundPadding: [4, 2],
      fontWeight: 600,
      fontStyle: 'italic',
      textFontSettings: { sdf: false },
      textFontFamily: 'Geist, sans-serif',
      minZoom: 2,
      updateTriggers: {
        getText: [
          ctx.activeLayers.airspace_FIR,
          ctx.activeLayers.airspace_ADIZ,
          ctx.activeLayers.airspace_CTA_UPPER,
          ctx.activeLayers.airspace_UPR_ZONE,
          ctx.activeLayers.airspace_DANGER,
          ctx.activeLayers.airspace_PROHIBITED,
          ctx.activeLayers.airspace_RESTRICTED,
          ctx.activeLayers.airspace_CTA_LOWER,
          ctx.activeLayers.airspace_TRA,
          ctx.activeLayers.airspace_TSA,
          ctx.activeLayers.airspace_CTR,
        ],
        getTextSize: [
          ctx.activeLayers.airspace_FIR,
          ctx.activeLayers.airspace_ADIZ,
          ctx.activeLayers.airspace_CTA_UPPER,
          ctx.activeLayers.airspace_UPR_ZONE,
          ctx.activeLayers.airspace_DANGER,
          ctx.activeLayers.airspace_PROHIBITED,
          ctx.activeLayers.airspace_RESTRICTED,
          ctx.activeLayers.airspace_CTA_LOWER,
          ctx.activeLayers.airspace_TRA,
          ctx.activeLayers.airspace_TSA,
          ctx.activeLayers.airspace_CTR,
        ],
        getTextColor: [
          isLayerActive,
          ctx.isDarkMode,
          isAirspaceLoaded,
          ctx.activeLayers.airspace_FIR,
          ctx.activeLayers.airspace_ADIZ,
          ctx.activeLayers.airspace_CTA_UPPER,
          ctx.activeLayers.airspace_UPR_ZONE,
          ctx.activeLayers.airspace_DANGER,
          ctx.activeLayers.airspace_PROHIBITED,
          ctx.activeLayers.airspace_RESTRICTED,
          ctx.activeLayers.airspace_CTA_LOWER,
          ctx.activeLayers.airspace_TRA,
          ctx.activeLayers.airspace_TSA,
          ctx.activeLayers.airspace_CTR,
        ],
        getBorderColor: [
          isLayerActive,
          ctx.isDarkMode,
          isAirspaceLoaded,
          ctx.activeLayers.airspace_FIR,
          ctx.activeLayers.airspace_ADIZ,
          ctx.activeLayers.airspace_CTA_UPPER,
          ctx.activeLayers.airspace_UPR_ZONE,
          ctx.activeLayers.airspace_DANGER,
          ctx.activeLayers.airspace_PROHIBITED,
          ctx.activeLayers.airspace_RESTRICTED,
          ctx.activeLayers.airspace_CTA_LOWER,
          ctx.activeLayers.airspace_TRA,
          ctx.activeLayers.airspace_TSA,
          ctx.activeLayers.airspace_CTR,
        ],
      },
      binary: false,
      parameters: { depthTest: false },
      transitions: ctx.isMobile
        ? undefined
        : {
            getTextColor: 300,
            getBorderColor: 300,
          },
    }),
  ];
}
