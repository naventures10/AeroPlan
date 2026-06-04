import { useState, useCallback, useMemo } from 'react';
import * as WeatherLayers from 'weatherlayers-gl';
import * as geotiff from 'geotiff';
import { ClipExtension } from '@deck.gl/extensions';
import { useMapStore } from '../../../store/useMapStore';
import { WIND_BOUNDS, CLIP_BOUNDS, WIND_PALETTE } from '../utils/windUtils';
import {
  useWeatherFrameLoader,
  getFrameIndices,
  type FrameLoaderStatus,
} from './useWeatherFrameLoader';
import type { ForecastTimestamp } from '../utils/windUtils';

// Provide geotiff library to weatherlayers-gl to fix Vite's dynamic import resolution
WeatherLayers.setLibrary('geotiff', geotiff);

export type WindStatus = FrameLoaderStatus;

/** A single loaded wind frame: the raw multi-band image + a 2-band render slice. */
interface WindFrameData {
  img: WeatherLayers.TextureData;
  renderData: WeatherLayers.TextureData;
}

/**
 * Fetch a single TIFF frame and extract the first two bands (U, V)
 * into a compact Float32Array suitable for the particle renderer.
 */
async function loadWindFrame(
  index: number,
  levelKey: string,
  signal: AbortSignal,
  forecastTimestamps: ForecastTimestamp[],
): Promise<{ index: number; data: WindFrameData }> {
  const t = forecastTimestamps[index];
  if (!t) throw new Error(`Missing timestamp for index ${index}`);
  const url = t.files[levelKey];
  if (!url) throw new Error(`Missing URL for level ${levelKey}`);

  const img = await WeatherLayers.loadTextureData(url, { signal });

  let renderData: WeatherLayers.TextureData;
  const components = img.data.length / (img.width * img.height);
  if (components >= 2) {
    const numPixels = img.width * img.height;
    const rData = new Float32Array(numPixels * 2);
    for (let p = 0; p < numPixels; p++) {
      rData[p * 2] = img.data[p * components] ?? 0;
      rData[p * 2 + 1] = img.data[p * components + 1] ?? 0;
    }
    renderData = { width: img.width, height: img.height, data: rData };
  } else {
    renderData = img;
  }

  return { index, data: { img, renderData } };
}

export function useWindLayer() {
  const {
    isWeatherMode,
    isWindMode,
    viewMode,
    windAltitude,
    windAnimationTime,
    forecastTimestamps,
    fetchWeatherManifest,
    weatherStatus,
  } = useMapStore();

  const isWindActive = isWeatherMode && isWindMode && viewMode === 'ENROUTE';

  // Stable reference for the frame loader callback
  const [loadFrame] = useState(() => loadWindFrame);

  // Shared progressive loading with stale-manifest recovery
  const { frames, status } = useWeatherFrameLoader<WindFrameData>({
    isActive: isWindActive,
    altitude: windAltitude,
    forecastTimestamps,
    fetchWeatherManifest,
    loadFrame,
    logPrefix: 'useWindLayer',
  });

  // Derive render-ready images and raw images from frame data
  const renderImages = useMemo(() => {
    const map: Record<number, WeatherLayers.TextureData> = {};
    for (const [k, v] of Object.entries(frames)) {
      map[Number(k)] = v.renderData;
    }
    return map;
  }, [frames]);

  const loadedImages = useMemo(() => {
    const map: Record<number, WeatherLayers.TextureData> = {};
    for (const [k, v] of Object.entries(frames)) {
      map[Number(k)] = v.img;
    }
    return map;
  }, [frames]);

  const windStatus: WindStatus = useMemo(() => {
    if (weatherStatus.state === 'loading') return weatherStatus;
    if (weatherStatus.state === 'error') return weatherStatus;
    return status;
  }, [weatherStatus, status]);

  // Frame indices
  const {
    index1,
    index2,
    weight: interpolationWeight,
  } = getFrameIndices(forecastTimestamps, windAnimationTime);

  // Build particle layer
  const windLayer = useMemo(() => {
    if (!isWindActive || !renderImages[index1]) return null;

    return new WeatherLayers.ParticleLayer({
      id: 'wind-particles',
      image: renderImages[index1],
      image2: renderImages[index2] || null,
      imageWeight: interpolationWeight,
      bounds: WIND_BOUNDS,
      numParticles: 1000,
      maxAge: 100,
      speedFactor: 5,
      width: 2,
      palette: WIND_PALETTE,
      extensions: [new ClipExtension()],
      clipBounds: CLIP_BOUNDS,
    });
  }, [isWindActive, renderImages, index1, index2, interpolationWeight]);

  // Tooltip helper
  const getWindAtLngLat = useCallback(
    (lng: number, lat: number) => {
      const img1 = loadedImages[index1];
      const img2 = loadedImages[index2];
      if (!img1) return null;

      const [minLng, minLat, maxLng, maxLat] = WIND_BOUNDS;
      if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return null;

      const x = Math.floor(((lng - minLng) / (maxLng - minLng)) * img1.width);
      const y = Math.floor(((maxLat - lat) / (maxLat - minLat)) * img1.height);

      const components = img1.data.length / (img1.width * img1.height);
      const idx = (y * img1.width + x) * components;

      // Ensure we extract U and V exactly from the first two bands of the master array
      const u1 = Number(img1.data[idx]);
      const v1 = Number(img1.data[idx + 1]);

      let u = u1;
      let v = v1;

      if (img2) {
        const u2 = Number(img2.data[idx]);
        const v2 = Number(img2.data[idx + 1]);
        u = u1 * (1 - interpolationWeight) + u2 * interpolationWeight;
        v = v1 * (1 - interpolationWeight) + v2 * interpolationWeight;
      }

      if (isNaN(u) || isNaN(v) || (u === 0 && v === 0)) return null;

      const speedMS = Math.sqrt(u * u + v * v);
      const speedKnots = speedMS * 1.94384;

      let dir = Math.atan2(-u, -v) * (180 / Math.PI);
      if (dir < 0) dir += 360;

      return { speed: speedKnots, direction: dir };
    },
    [loadedImages, index1, index2, interpolationWeight],
  );

  return {
    windLayer,
    windStatus,
    forecastTimestamps,
    getWindAtLngLat,
  };
}
