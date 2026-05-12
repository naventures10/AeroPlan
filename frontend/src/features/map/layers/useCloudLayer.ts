import { useEffect, useState, useMemo, useRef } from 'react';
import * as WeatherLayers from 'weatherlayers-gl';
import { IconLayer } from '@deck.gl/layers';
import { WebMercatorViewport } from '@deck.gl/core';
import { useMapStore } from '../../../store/useMapStore';
import { formatIST, calculateNowIndex, WIND_BOUNDS } from '../utils/windUtils';
import type { ForecastTimestamp } from '../utils/windUtils';

export interface CloudStatus {
  state: 'idle' | 'loading' | 'ready' | 'error';
  message?: string;
}

/**
 * Per-frame data: a flat opacity map indexed by pixel position.
 * Storing opacity per pixel (rather than packed GPU arrays) lets us
 * interpolate smoothly between two frames on the CPU and emit a
 * single layer — avoiding the visual noise that two
 * overlapping semi-transparent layers would produce.
 */
interface CloudFrameData {
  opacityMap: Uint8Array; // [width * height] — 0 = invisible, 1-255 = alpha
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Hard cap on the total number of cloud particles to prevent GPU stall. */
const MAX_PARTICLES = 50_000;

/** Blob texture size in pixels. */
const BLOB_SIZE = 64;

/** PRNG half-range — the blob centre is always at BLOB_SIZE / 2 */
const BLOB_HALF = BLOB_SIZE / 2;

// ---------------------------------------------------------------------------
// Deterministic pseudo-random helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic pseudo-random in [0, 1) seeded by an integer.
 * Ensures the same grid cell always gets the same altitude scatter
 * across frames, eliminating position flicker during transitions.
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Second independent PRNG channel — used for opacity noise so it
 * doesn't correlate with the position scatter.
 */
function seededRandom2(seed: number): number {
  const x = Math.sin(seed * 63.7264 + 10.873) * 27461.1231;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// Procedural blob texture (generated once, cached)
// ---------------------------------------------------------------------------

let cachedBlobUrl: string | null = null;

/**
 * Create a 64×64 radial-gradient blob with soft edges.
 * The centre is white and fully opaque; opacity falls off with a
 * quadratic curve to produce a natural "puff" shape.
 */
/** Minimal 1×1 transparent PNG used as fallback when canvas 2d is unavailable (e.g. tests). */
const FALLBACK_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAAxJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=';

function getOrCreateBlobTexture(): string {
  if (cachedBlobUrl) return cachedBlobUrl;

  if (typeof document === 'undefined') {
    cachedBlobUrl = FALLBACK_DATA_URL;
    return cachedBlobUrl;
  }

  const canvas = document.createElement('canvas');
  canvas.width = BLOB_SIZE;
  canvas.height = BLOB_SIZE;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    cachedBlobUrl = FALLBACK_DATA_URL;
    return cachedBlobUrl;
  }

  // Softer "misty" puff
  const drawPuff = (x: number, y: number, r: number, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.4, `rgba(255,255,255,${alpha * 0.3})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // 1. Central core
  drawPuff(BLOB_HALF, BLOB_HALF, BLOB_HALF * 0.8, 0.7);

  // 2. Subtle outer wisps (less aggressive than before to maintain mist feel)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const dist = BLOB_HALF * 0.4 * seededRandom(i * 13);
    const px = BLOB_HALF + Math.cos(angle) * dist;
    const py = BLOB_HALF + Math.sin(angle) * dist;
    const pr = BLOB_HALF * (0.5 + seededRandom(i * 17) * 0.4);
    drawPuff(px, py, pr, 0.3);
  }

  cachedBlobUrl = canvas.toDataURL();
  return cachedBlobUrl;
}

// ---------------------------------------------------------------------------
// Zoom-dependent density table
// ---------------------------------------------------------------------------

/**
 * Returns the number of sub-particles to scatter within each 0.25° cell
 * based on the current map zoom level.
 */
function getSubdivisionCount(zoom: number): number {
  if (zoom <= 5) return 1;
  if (zoom <= 6) return 4;
  if (zoom <= 7) return 9;
  if (zoom <= 8) return 16;
  if (zoom <= 9) return 25;
  if (zoom <= 10) return 36;
  if (zoom <= 11) return 49;
  return 64; // zoom 12+
}

/**
 * Returns the size of each cloud blob in **meters** based on the current
 * zoom level.  At low zoom the blobs are large so they overlap into a
 * continuous mass; at high zoom they shrink so individual puffs are visible.
 */
function getBlobSizeMeters(zoom: number): number {
  if (zoom <= 5) return 60_000;
  if (zoom <= 7) return 35_000;
  if (zoom <= 9) return 20_000;
  if (zoom <= 11) return 10_000;
  return 6_000;
}

/**
 * Returns the vertical scatter half-range in metres.
 * At low zoom a thin sheet looks fine; at high zoom we spread points
 * over a thicker volume so the clouds have visible 3-D depth.
 */
function getVerticalScatter(zoom: number): number {
  if (zoom <= 5) return 250;
  if (zoom <= 8) return 500;
  if (zoom <= 10) return 750;
  return 1000;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCloudLayer() {
  const {
    isWeatherMode,
    isCloudMode,
    viewMode,
    windAltitude,
    windAnimationTime,
    setWindAnimationTime,
    setCloudLoadingStatus,
    viewState,
  } = useMapStore();

  const [frameData, setFrameData] = useState<Record<number, CloudFrameData>>({});
  const [forecastTimestamps, setForecastTimestamps] = useState<ForecastTimestamp[]>([]);

  const isCloudActive = isWeatherMode && isCloudMode && viewMode === 'ENROUTE';

  // Ensure the blob texture is created once (harmless if called during SSR — it
  // would just skip because `document` would be undefined, but we're client-only).
  const blobUrl = useRef<string | null>(null);
  if (typeof document !== 'undefined' && !blobUrl.current) {
    blobUrl.current = getOrCreateBlobTexture();
  }

  // ---------------------------------------------------------------------------
  // 1. Fetch dynamic manifest
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isCloudActive) return;

    async function fetchManifest() {
      try {
        const response = await fetch('/weather/weather_manifest.json');
        const manifestData = await response.json();
        if (manifestData && manifestData.forecasts) {
          const timestamps = manifestData.forecasts.map((f: any) => {
            const { label, date } = formatIST(f.valid_time);
            return { label, date, validTime: f.valid_time, files: f.files };
          });
          setForecastTimestamps(timestamps);

          if (windAnimationTime === 0) {
            const nowIdx = calculateNowIndex(timestamps);
            setWindAnimationTime(nowIdx);
          }
        }
      } catch (err) {
        console.error('Failed to load weather manifest for clouds', err);
        setCloudLoadingStatus({ state: 'error', message: 'Failed to load weather manifest' });
      }
    }
    fetchManifest();
  }, [isCloudActive, setWindAnimationTime, windAnimationTime, setCloudLoadingStatus]);

  // ---------------------------------------------------------------------------
  // 2. Pre-load weather data → per-pixel opacity maps
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let active = true;

    async function loadAll() {
      if (!isCloudActive || forecastTimestamps.length === 0) return;

      setCloudLoadingStatus({ state: 'loading', message: 'Generating cloud geometry…' });
      setFrameData({});

      const isSurface = windAltitude === 0;
      const levelKey = isSurface ? 'surface' : String(windAltitude).padStart(3, '0');

      const loadPromises = forecastTimestamps.map((t) => {
        const url = t.files[levelKey];
        if (!url) throw new Error(`Missing URL for level ${levelKey}`);
        return WeatherLayers.loadTextureData(url);
      });

      try {
        const results = await Promise.all(loadPromises);
        if (!active) return;

        const targetBand = isSurface ? 6 : 3;
        const dataMap: Record<number, CloudFrameData> = {};

        results.forEach((img, i) => {
          const components = img.data.length / (img.width * img.height);
          const numPixels = img.width * img.height;
          const opacityMap = new Uint8Array(numPixels);

          for (let p = 0; p < numPixels; p++) {
            const val = img.data[p * components + targetBand] ?? 0;

            if (isSurface && val > 0.1) {
              opacityMap[p] = Math.max(1, Math.min(255, Math.floor((val / 1.0) * 255)));
            } else if (!isSurface && val > 80) {
              opacityMap[p] = Math.max(1, Math.min(255, Math.floor(((val - 80) / 20) * 255)));
            }
            // else stays 0 (invisible)
          }

          dataMap[i] = { opacityMap, width: img.width, height: img.height };
        });

        setFrameData(dataMap);
        setCloudLoadingStatus({ state: 'ready', message: 'All cloud frames ready' });
      } catch (err) {
        if (!active) return;
        console.error('[useCloudLayer] Load error:', err);
        setCloudLoadingStatus({ state: 'error', message: 'Failed to pre-load cloud frames' });
      }
    }

    loadAll();
    return () => {
      active = false;
    };
  }, [isCloudActive, windAltitude, forecastTimestamps, setCloudLoadingStatus]);

  // ---------------------------------------------------------------------------
  // 3. Build a dynamic volumetric IconLayer with viewport culling
  // ---------------------------------------------------------------------------
  const maxIndex = Math.max(0, forecastTimestamps.length - 1);
  const index1 = Math.min(Math.floor(Math.max(0, windAnimationTime)), maxIndex);
  const index2 = Math.min(index1 + 1, maxIndex);
  const weight = windAnimationTime - index1;

  const isSurface = windAltitude === 0;
  const baseAltMeters = isSurface ? 1000 : windAltitude * 100 * 0.3048;

  const zoom = viewState.zoom;
  const lng = viewState.longitude;
  const lat = viewState.latitude;

  const cloudLayers = useMemo(() => {
    const fA = frameData[index1];
    if (!isCloudActive || !fA) return [];

    const fB = frameData[index2];
    const [minLng, minLat, maxLng, maxLat] = WIND_BOUNDS;
    const { width, height } = fA;

    // -----------------------------------------------------------------------
    // Viewport culling — compute the pixel range that is visible on screen
    // -----------------------------------------------------------------------
    let vpMinLng = minLng;
    let vpMaxLng = maxLng;
    let vpMinLat = minLat;
    let vpMaxLat = maxLat;

    try {
      const vp = new WebMercatorViewport({
        width: window.innerWidth || 1024,
        height: window.innerHeight || 768,
        longitude: lng,
        latitude: lat,
        zoom,
      });
      const [west, south, east, north] = vp.getBounds();
      vpMinLng = Math.max(minLng, west);
      vpMinLat = Math.max(minLat, south);
      vpMaxLng = Math.min(maxLng, east);
      vpMaxLat = Math.min(maxLat, north);
    } catch {
      // Fallback to full bounds if viewport calculation fails
    }

    // Convert geo bounds → pixel range in the TIFF grid
    const colStart = Math.max(0, Math.floor(((vpMinLng - minLng) / (maxLng - minLng)) * width));
    const colEnd = Math.min(
      width - 1,
      Math.ceil(((vpMaxLng - minLng) / (maxLng - minLng)) * width),
    );
    const rowStart = Math.max(0, Math.floor(((maxLat - vpMaxLat) / (maxLat - minLat)) * height));
    const rowEnd = Math.min(
      height - 1,
      Math.ceil(((maxLat - vpMinLat) / (maxLat - minLat)) * height),
    );

    // -----------------------------------------------------------------------
    // Zoom-dependent parameters
    // -----------------------------------------------------------------------
    const subCount = getSubdivisionCount(zoom);
    const blobSize = getBlobSizeMeters(zoom);
    const verticalScatter = getVerticalScatter(zoom);

    // Cell dimensions in degrees
    const cellW = (maxLng - minLng) / width;
    const cellH = (maxLat - minLat) / height;

    // Pre-allocate arrays at the MAX_PARTICLES limit
    const positions = new Float64Array(MAX_PARTICLES * 3);
    const colors = new Uint8Array(MAX_PARTICLES * 4);
    const sizes = new Float32Array(MAX_PARTICLES);
    let idx = 0;

    for (let row = rowStart; row <= rowEnd && idx < MAX_PARTICLES; row++) {
      for (let col = colStart; col <= colEnd && idx < MAX_PARTICLES; col++) {
        const p = row * width + col;
        const a = fA.opacityMap[p] ?? 0;
        const b = fB?.opacityMap[p] ?? 0;
        if (a === 0 && b === 0) continue;

        // Lerp base opacity between frames
        const baseAlpha = Math.round(a * (1 - weight) + b * weight);
        if (baseAlpha <= 0) continue;

        // Cell origin in geo coords (top-left corner of the cell)
        const cellLng = minLng + col * cellW;
        const cellLat = maxLat - row * cellH;

        // Scatter sub-particles within this cell
        for (let s = 0; s < subCount && idx < MAX_PARTICLES; s++) {
          const seed = p * 67 + s;

          // Position jitter within the cell
          const jx = seededRandom(seed);
          const jy = seededRandom(seed + 7919);
          const jz = seededRandom(seed + 15731);

          const ptLng = cellLng + jx * cellW;
          const ptLat = cellLat - jy * cellH;
          const ptAlt = baseAltMeters + (jz - 0.5) * 2 * verticalScatter;

          // Opacity noise — vary between 40% and 100% of the base alpha
          const noiseFactor = 0.4 + 0.6 * seededRandom2(seed);
          const alpha = Math.round(baseAlpha * noiseFactor);
          if (alpha <= 0) continue;

          // Size noise — vary each blob ±30% for organic irregularity
          const sizeFactor = 0.7 + 0.6 * seededRandom2(seed + 3571);

          positions[idx * 3] = ptLng;
          positions[idx * 3 + 1] = ptLat;
          positions[idx * 3 + 2] = ptAlt;

          colors[idx * 4] = 255;
          colors[idx * 4 + 1] = 255;
          colors[idx * 4 + 2] = 255;
          colors[idx * 4 + 3] = alpha;

          sizes[idx] = blobSize * sizeFactor;

          idx++;
        }
      }
    }

    if (idx === 0) return [];

    const layer = new IconLayer({
      id: 'cloud-volume',
      data: {
        length: idx,
        attributes: {
          getPosition: { value: positions.subarray(0, idx * 3), size: 3 },
          getColor: { value: colors.subarray(0, idx * 4), size: 4 },
          getSize: { value: sizes.subarray(0, idx), size: 1 },
        },
      },
      iconAtlas: blobUrl.current || getOrCreateBlobTexture(),
      iconMapping: {
        blob: { x: 0, y: 0, width: BLOB_SIZE, height: BLOB_SIZE, mask: false },
      },
      getIcon: () => 'blob',
      sizeUnits: 'meters',
      sizeScale: 1,
      billboard: true,
      alphaCutoff: 0,
      pickable: false,
      parameters: {
        depthWriteEnabled: false,
      },
    });

    return [layer];
  }, [isCloudActive, frameData, index1, index2, weight, baseAltMeters, zoom, lng, lat]);

  return {
    cloudLayers,
    cloudStatus: useMapStore.getState().cloudLoadingStatus,
  };
}
