import { useEffect, useState, useMemo } from 'react';
import * as WeatherLayers from 'weatherlayers-gl';
import { PointCloudLayer } from '@deck.gl/layers';
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
 * single PointCloudLayer — avoiding the visual noise that two
 * overlapping semi-transparent layers would produce.
 */
interface CloudFrameData {
  opacityMap: Uint8Array; // [width * height] — 0 = invisible, 1-255 = alpha
  width: number;
  height: number;
}

/**
 * Deterministic pseudo-random in [0, 1) seeded by pixel index.
 * Ensures the same grid cell always gets the same altitude scatter
 * across frames, eliminating position flicker during transitions.
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function useCloudLayer() {
  const {
    activeLayers,
    viewMode,
    windAltitude,
    windAnimationTime,
    setWindAnimationTime,
    setCloudLoadingStatus,
  } = useMapStore();

  const [frameData, setFrameData] = useState<Record<number, CloudFrameData>>({});
  const [forecastTimestamps, setForecastTimestamps] = useState<ForecastTimestamp[]>([]);

  const isCloudActive = activeLayers.cloudlayer && viewMode === 'ENROUTE';

  // 1. Fetch dynamic manifest
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

  // 2. Pre-load weather data → per-pixel opacity maps
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

  // 3. Build a single interpolated PointCloudLayer
  const maxIndex = Math.max(0, forecastTimestamps.length - 1);
  const index1 = Math.min(Math.floor(Math.max(0, windAnimationTime)), maxIndex);
  const index2 = Math.min(index1 + 1, maxIndex);
  const weight = windAnimationTime - index1;

  const isSurface = windAltitude === 0;
  const baseAltMeters = isSurface ? 1000 : windAltitude * 100 * 0.3048;

  const cloudLayers = useMemo(() => {
    const fA = frameData[index1];
    if (!isCloudActive || !fA) return [];

    const fB = frameData[index2];
    const [minLng, minLat, maxLng, maxLat] = WIND_BOUNDS;
    const { width, height } = fA;
    const numPixels = width * height;

    // Single pass: count valid pixels in the union of both frames
    let count = 0;
    for (let p = 0; p < numPixels; p++) {
      const a = fA.opacityMap[p] ?? 0;
      const b = fB?.opacityMap[p] ?? 0;
      if (a > 0 || b > 0) count++;
    }

    if (count === 0) return [];

    // Build interpolated arrays
    const positions = new Float32Array(count * 3);
    const colors = new Uint8Array(count * 4);
    let idx = 0;

    for (let p = 0; p < numPixels; p++) {
      const a = fA.opacityMap[p] ?? 0;
      const b = fB?.opacityMap[p] ?? 0;
      if (a === 0 && b === 0) continue;

      // Lerp opacity between frames
      const alpha = Math.round(a * (1 - weight) + b * weight);
      if (alpha <= 0) continue;

      const x = p % width;
      const y = Math.floor(p / width);
      const lng = minLng + (x / width) * (maxLng - minLng);
      const lat = maxLat - (y / height) * (maxLat - minLat);
      const alt = baseAltMeters + (seededRandom(p) - 0.5) * 500;

      positions[idx * 3] = lng;
      positions[idx * 3 + 1] = lat;
      positions[idx * 3 + 2] = alt;

      colors[idx * 4] = 255;
      colors[idx * 4 + 1] = 255;
      colors[idx * 4 + 2] = 255;
      colors[idx * 4 + 3] = alpha;

      idx++;
    }

    // Trim to actual count (some pixels may have been skipped after lerp → 0)
    const layer = new PointCloudLayer({
      id: 'cloud-particles',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        length: idx,
        attributes: {
          getPosition: { value: positions.subarray(0, idx * 3), size: 3 },
          getColor: { value: colors.subarray(0, idx * 4), size: 4, normalized: true },
        },
      } as any,
      pointSize: 4,
      sizeUnits: 'pixels',
      opacity: 0.8,
      pickable: false,
    });

    return [layer];
  }, [isCloudActive, frameData, index1, index2, weight, baseAltMeters]);

  return {
    cloudLayers,
    cloudStatus: useMapStore.getState().cloudLoadingStatus,
  };
}
