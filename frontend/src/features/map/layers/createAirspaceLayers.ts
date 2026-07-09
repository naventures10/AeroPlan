import { MVTLayer } from '@deck.gl/geo-layers';
import { GeoJsonLayer } from '@deck.gl/layers';
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
  const currentZoom = ctx.zoom || 0;
  const effectiveZoom =
    ZOOM_THRESHOLDS.slice()
      .reverse()
      .find((z) => currentZoom >= z) || 0;
  const isLayerActive = ctx.activeLayers.airspaces;
  const colors = getAirspaceColors(ctx.isDarkMode);
  const defStroke = getDefaultStroke(ctx.isDarkMode);
  const { isAirspaceLoaded, setAirspaceLoaded } = ctx;

  const typeVisibilityMap = new Map<string, boolean>();
  for (const type of Object.keys(AIRSPACE_HIERARCHY)) {
    const h = AIRSPACE_HIERARCHY[type];
    if (!h) continue;
    const zoomVisible = effectiveZoom >= h.minZoom;
    let layerActive = true;

    if (type === 'FIR') {
      layerActive = ctx.activeLayers.airspaceFIR;
    } else if (type === 'UPR_ZONE') {
      layerActive = ctx.activeLayers.airspaceUpr;
    } else if (type === 'CTR' || type === 'CTA_LOWER' || type === 'CTA_UPPER') {
      layerActive = ctx.activeLayers.airspaceControl;
    } else if (
      type === 'DANGER' ||
      type === 'PROHIBITED' ||
      type === 'RESTRICTED' ||
      type === 'TRA' ||
      type === 'TSA' ||
      type === 'ADIZ'
    ) {
      layerActive = ctx.activeLayers.airspaceRegulated;
    }

    typeVisibilityMap.set(type, zoomVisible && layerActive);
  }

  const isTypeVisible = (type: string): boolean => {
    const visible = typeVisibilityMap.get(type);
    if (visible !== undefined) return visible;
    // Fallback for types not in explicit hierarchy
    return effectiveZoom >= DEFAULT_HIERARCHY.minZoom;
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
          effectiveZoom,
          isLayerActive,
          ctx.isDarkMode,
          isAirspaceLoaded,
          ctx.activeLayers.airspaceFIR,
          ctx.activeLayers.airspaceRegulated,
          ctx.activeLayers.airspaceControl,
          ctx.activeLayers.airspaceUpr,
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
          effectiveZoom,
          ctx.activeLayers.airspaceFIR,
          ctx.activeLayers.airspaceRegulated,
          ctx.activeLayers.airspaceControl,
          ctx.activeLayers.airspaceUpr,
        ],
        getTextSize: [
          effectiveZoom,
          ctx.activeLayers.airspaceFIR,
          ctx.activeLayers.airspaceRegulated,
          ctx.activeLayers.airspaceControl,
          ctx.activeLayers.airspaceUpr,
        ],
        getTextColor: [
          effectiveZoom,
          isLayerActive,
          ctx.isDarkMode,
          isAirspaceLoaded,
          ctx.activeLayers.airspaceFIR,
          ctx.activeLayers.airspaceRegulated,
          ctx.activeLayers.airspaceControl,
          ctx.activeLayers.airspaceUpr,
        ],
        getBorderColor: [
          effectiveZoom,
          isLayerActive,
          ctx.isDarkMode,
          isAirspaceLoaded,
          ctx.activeLayers.airspaceFIR,
          ctx.activeLayers.airspaceRegulated,
          ctx.activeLayers.airspaceControl,
          ctx.activeLayers.airspaceUpr,
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
