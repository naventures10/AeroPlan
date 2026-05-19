import { useEffect, useState, useMemo, useCallback } from 'react';
import * as WeatherLayers from 'weatherlayers-gl';
import { IconLayer } from '@deck.gl/layers';
import { WebMercatorViewport } from '@deck.gl/core';
import { useMapStore } from '../../../store/useMapStore';
import { WIND_BOUNDS } from '../utils/windUtils';

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
    setCloudLoadingStatus,
    viewState,
    forecastTimestamps,
    windIsPlaying,
    fetchWeatherManifest,
    weatherStatus,
  } = useMapStore();

  const [frameData, setFrameData] = useState<Record<number, CloudFrameData>>({});

  const isCloudActive = isWeatherMode && isCloudMode && viewMode === 'ENROUTE';

  // Trigger manifest load if active and timestamps aren't loaded yet
  useEffect(() => {
    if (isCloudActive && forecastTimestamps.length === 0) {
      fetchWeatherManifest();
    }
  }, [isCloudActive, forecastTimestamps.length, fetchWeatherManifest]);

  // Synchronize store's weatherStatus (manifest fetch status) into cloudLoadingStatus
  useEffect(() => {
    if (weatherStatus.state === 'error') {
      setCloudLoadingStatus({
        state: 'error',
        message: weatherStatus.message || 'Failed to load weather manifest',
      });
    } else if (weatherStatus.state === 'loading') {
      setCloudLoadingStatus({
        state: 'loading',
        message: 'Loading weather timeline…',
      });
    }
  }, [weatherStatus, setCloudLoadingStatus]);

  // ---------------------------------------------------------------------------
  // 1. Weather data pre-loading is driven by shared forecastTimestamps from the store.
  // ---------------------------------------------------------------------------

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

  const rawWeight = windAnimationTime - index1;

  const isSurface = windAltitude === 0;
  const baseAltMeters = isSurface ? 1000 : windAltitude * 100 * 0.3048;

  const zoom = viewState.zoom;
  const lng = viewState.longitude;
  const lat = viewState.latitude;

  // 3. Helper to generate cloud particle geometry for a single frame
  const generateCloudGeometry = useCallback(
    (frame: CloudFrameData | undefined) => {
      if (!isCloudActive || !frame) return null;

      const [minLng, minLat, maxLng, maxLat] = WIND_BOUNDS;
      const { width, height } = frame;

      // Viewport culling — compute the pixel range that is visible on screen
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

      // Zoom-dependent parameters
      const baseSubCount = getSubdivisionCount(zoom);
      const subCount = windIsPlaying ? Math.min(4, baseSubCount) : baseSubCount;
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
          const alphaVal = frame.opacityMap[p] ?? 0;
          if (alphaVal <= 0) continue;

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
            const alpha = Math.round(alphaVal * noiseFactor);
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

      if (idx === 0) return null;

      return {
        positions: positions.subarray(0, idx * 3),
        colors: colors.subarray(0, idx * 4),
        sizes: sizes.subarray(0, idx),
        length: idx,
      };
    },
    [isCloudActive, baseAltMeters, zoom, lng, lat, windIsPlaying],
  );

  // Memoize geometries for frame A and frame B independently.
  // They only regenerate when the underlying frames or viewport parameters change,
  // NOT on continuous interpolation weight ticks!
  const geometryA = useMemo(() => {
    return generateCloudGeometry(frameData[index1]);
  }, [generateCloudGeometry, frameData, index1]);

  const geometryB = useMemo(() => {
    return generateCloudGeometry(frameData[index2]);
  }, [generateCloudGeometry, frameData, index2]);

  // Build the Deck.gl layers. Changing rawWeight only modifies the layers' opacity
  // uniform on the GPU, taking 0ms on the CPU and keeping transitions silky-smooth.
  const cloudLayers = useMemo(() => {
    const layers: IconLayer[] = [];

    if (geometryA) {
      layers.push(
        new IconLayer({
          id: `cloud-volume-a-${index1}`,
          data: {
            length: geometryA.length,
            attributes: {
              getPosition: { value: geometryA.positions, size: 3 },
              getColor: { value: geometryA.colors, size: 4 },
              getSize: { value: geometryA.sizes, size: 1 },
            },
          },
          opacity: 1 - rawWeight,
          iconAtlas: getOrCreateBlobTexture(),
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
        }),
      );
    }

    if (geometryB && index2 !== index1) {
      layers.push(
        new IconLayer({
          id: `cloud-volume-b-${index2}`,
          data: {
            length: geometryB.length,
            attributes: {
              getPosition: { value: geometryB.positions, size: 3 },
              getColor: { value: geometryB.colors, size: 4 },
              getSize: { value: geometryB.sizes, size: 1 },
            },
          },
          opacity: rawWeight,
          iconAtlas: getOrCreateBlobTexture(),
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
        }),
      );
    }

    return layers;
  }, [geometryA, geometryB, index1, index2, rawWeight]);

  return {
    cloudLayers,
    cloudStatus: useMapStore.getState().cloudLoadingStatus,
  };
}
