import { useEffect, useState, useCallback, useMemo } from 'react';
import * as WeatherLayers from 'weatherlayers-gl';
import { ClipExtension } from '@deck.gl/extensions';
import { useMapStore } from '../../../store/useMapStore';
import {
  formatIST,
  calculateNowIndex,
  WIND_BOUNDS,
  CLIP_BOUNDS,
  WIND_PALETTE,
} from '../utils/windUtils';
import type { ForecastTimestamp } from '../utils/windUtils';

export interface WindStatus {
  state: 'idle' | 'loading' | 'ready' | 'error';
  message?: string;
  validTime?: string;
}

export function useWindLayer() {
  const {
    isWeatherMode,
    isWindMode,
    viewMode,
    windAltitude,
    windAnimationTime,
    setWindAnimationTime,
    windIsPlaying,
    setWindIsPlaying,
  } = useMapStore();

  const [loadedImages, setLoadedImages] = useState<Record<number, WeatherLayers.TextureData>>({});
  const [renderImages, setRenderImages] = useState<Record<number, WeatherLayers.TextureData>>({});
  const [status, setStatus] = useState<WindStatus>({ state: 'idle' });
  const [forecastTimestamps, setForecastTimestamps] = useState<ForecastTimestamp[]>([]);

  const isWindActive = isWeatherMode && isWindMode && viewMode === 'ENROUTE';

  // Either weather layer being active should trigger manifest loading
  // so the shared controls (timeline, altitude) have timestamps available.
  const isAnyWeatherActive = isWeatherMode && viewMode === 'ENROUTE';

  // 1. Fetch dynamic manifest
  useEffect(() => {
    if (!isAnyWeatherActive) return;

    async function fetchManifest() {
      try {
        const response = await fetch('/weather/weather_manifest.json');
        const manifestData = await response.json();
        if (manifestData && manifestData.forecasts) {
          const timestamps = manifestData.forecasts.map((f: any) => {
            const { label, date } = formatIST(f.valid_time);
            return {
              label,
              date,
              validTime: f.valid_time,
              files: f.files,
            };
          });
          setForecastTimestamps(timestamps);

          // Default animationTime to 'Now' if not already set
          if (windAnimationTime === 0) {
            const nowIdx = calculateNowIndex(timestamps);
            setWindAnimationTime(nowIdx);
          }
        }
      } catch (err) {
        console.error('Failed to load weather manifest', err);
        setStatus({ state: 'error', message: 'Failed to load weather manifest' });
      }
    }
    fetchManifest();
  }, [isAnyWeatherActive, setWindAnimationTime]);

  // 2. Pre-load weather data for current altitude
  useEffect(() => {
    let active = true;

    async function loadAll() {
      if (!isWindActive || forecastTimestamps.length === 0) return;

      setStatus({ state: 'loading', message: 'Pre-loading forecast frames…' });
      setLoadedImages({});
      setRenderImages({});

      const levelKey = windAltitude === 0 ? 'surface' : String(windAltitude).padStart(3, '0');

      const loadPromises = forecastTimestamps.map((t) => {
        const url = t.files[levelKey];
        if (!url) throw new Error(`Missing URL for level ${levelKey}`);
        return WeatherLayers.loadTextureData(url);
      });

      try {
        const results = await Promise.all(loadPromises);
        if (!active) return;

        const imageMap: Record<number, WeatherLayers.TextureData> = {};
        const renderMap: Record<number, WeatherLayers.TextureData> = {};

        results.forEach((img, i) => {
          imageMap[i] = img;

          const components = img.data.length / (img.width * img.height);
          if (components >= 2) {
            // WebGL ParticleLayer expects exactly 2 channels for U and V.
            const numPixels = img.width * img.height;
            const renderData = new Float32Array(numPixels * 2);
            for (let p = 0; p < numPixels; p++) {
              renderData[p * 2] = img.data[p * components] ?? 0;
              renderData[p * 2 + 1] = img.data[p * components + 1] ?? 0;
            }
            renderMap[i] = { width: img.width, height: img.height, data: renderData };
          } else {
            renderMap[i] = img;
          }
        });

        setLoadedImages(imageMap);
        setRenderImages(renderMap);
        setStatus({ state: 'ready', message: 'All frames ready' });
      } catch (err) {
        if (!active) return;
        console.error('[useWindLayer] Load error:', err);
        setStatus({ state: 'error', message: 'Failed to pre-load some frames' });
      }
    }

    loadAll();
    return () => {
      active = false;
    };
  }, [isWindActive, windAltitude, forecastTimestamps]);

  // 3. Animation Loop — drives the shared timeline for any weather layer
  useEffect(() => {
    if (!isAnyWeatherActive || !windIsPlaying || forecastTimestamps.length === 0) return;

    let lastTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Speed: 10 seconds per frame transition (1 / 10 = 0.1 units per second)
      const playbackSpeed = 0.1;

      setWindAnimationTime((prev: number) => {
        let next = prev + dt * playbackSpeed;
        if (next >= forecastTimestamps.length - 1) {
          next = forecastTimestamps.length - 1;
          setWindIsPlaying(false);
        }
        return next;
      });

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [
    isAnyWeatherActive,
    windIsPlaying,
    forecastTimestamps.length,
    setWindAnimationTime,
    setWindIsPlaying,
  ]);

  // 4. Calculate Layer
  const maxIndex = Math.max(0, forecastTimestamps.length - 1);
  const index1 = Math.min(Math.floor(Math.max(0, windAnimationTime)), maxIndex);
  const index2 = Math.min(index1 + 1, maxIndex);
  const interpolationWeight = windAnimationTime - index1;

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

  // 5. Tooltip Helper
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
    windStatus: status,
    forecastTimestamps,
    getWindAtLngLat,
  };
}
