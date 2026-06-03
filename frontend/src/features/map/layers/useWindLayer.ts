import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import * as WeatherLayers from 'weatherlayers-gl';
import { ClipExtension } from '@deck.gl/extensions';
import { useMapStore } from '../../../store/useMapStore';
import { WIND_BOUNDS, CLIP_BOUNDS, WIND_PALETTE } from '../utils/windUtils';

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
    forecastTimestamps,
    fetchWeatherManifest,
    weatherStatus,
  } = useMapStore();

  const [loadedImages, setLoadedImages] = useState<Record<number, WeatherLayers.TextureData>>({});
  const [renderImages, setRenderImages] = useState<Record<number, WeatherLayers.TextureData>>({});
  const [status, setStatus] = useState<WindStatus>({ state: 'idle' });
  const staleManifestAttemptedRef = useRef<Record<string, boolean>>({});

  const windStatus: WindStatus = useMemo(() => {
    if (weatherStatus.state === 'loading') return weatherStatus;
    if (weatherStatus.state === 'error') return weatherStatus;
    return status;
  }, [weatherStatus, status]);

  const isWindActive = isWeatherMode && isWindMode && viewMode === 'ENROUTE';

  // Trigger manifest load if active and timestamps aren't loaded yet
  useEffect(() => {
    if (isWindActive && forecastTimestamps.length === 0) {
      fetchWeatherManifest();
    }
  }, [isWindActive, forecastTimestamps.length, fetchWeatherManifest]);

  // 1. Pre-load weather data for current altitude
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const signal = controller.signal;

    async function loadAll() {
      if (!isWindActive || forecastTimestamps.length === 0) return;

      setStatus({ state: 'loading', message: 'Pre-loading forecast frames…' });
      setLoadedImages({});
      setRenderImages({});

      const levelKey = windAltitude === 0 ? 'surface' : String(windAltitude).padStart(3, '0');
      const totalFrames = forecastTimestamps.length;

      // Determine active indices at the time loading starts
      const currentAnimTime = useMapStore.getState().windAnimationTime;
      const maxIdx = totalFrames - 1;
      const startIndex1 = Math.min(Math.floor(Math.max(0, currentAnimTime)), maxIdx);
      const startIndex2 = Math.min(startIndex1 + 1, maxIdx);

      const prioritizedIndices = Array.from(new Set([startIndex1, startIndex2]));
      const remainingIndices = Array.from({ length: totalFrames }, (_, i) => i).filter(
        (i) => !prioritizedIndices.includes(i),
      );

      // Helper to fetch, parse, and return a single frame
      async function loadFrame(index: number) {
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

        return { index, img, renderData };
      }

      try {
        // Step A: Load active/prioritized frames first in parallel
        const prioritizedResults = await Promise.all(
          prioritizedIndices.map((idx) => loadFrame(idx)),
        );
        if (!active) return;

        // Apply prioritized frames immediately
        const imageMap: Record<number, WeatherLayers.TextureData> = {};
        const renderMap: Record<number, WeatherLayers.TextureData> = {};
        prioritizedResults.forEach((r) => {
          imageMap[r.index] = r.img;
          renderMap[r.index] = r.renderData;
        });

        setLoadedImages((prev) => ({ ...prev, ...imageMap }));
        setRenderImages((prev) => ({ ...prev, ...renderMap }));
        setStatus({ state: 'ready', message: 'Active frames ready' });

        // Step B: Load remaining frames sequentially in the background
        for (const idx of remainingIndices) {
          if (!active) return;
          try {
            const r = await loadFrame(idx);
            if (!active) return;
            setLoadedImages((prev) => ({ ...prev, [r.index]: r.img }));
            setRenderImages((prev) => ({ ...prev, [r.index]: r.renderData }));
          } catch (err: any) {
            if (err.name === 'AbortError' || !active) return;
            console.error(`[useWindLayer] Background load error for frame ${idx}:`, err);
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || !active) return;
        console.error('[useWindLayer] Load error:', err);

        if (err.message?.includes('File no longer exists')) {
          const forecastKey = `${forecastTimestamps.map((t) => t.validTime).join(',')}_${windAltitude}`;
          if (!staleManifestAttemptedRef.current[forecastKey]) {
            staleManifestAttemptedRef.current[forecastKey] = true;
            console.warn(
              '[useWindLayer] Stale manifest detected. Auto-healing by fetching fresh manifest...',
            );
            fetchWeatherManifest(true);
            return;
          } else {
            console.error(
              '[useWindLayer] Stale manifest detected, but auto-heal was already attempted for this timestamp/altitude key.',
            );
          }
        }

        setStatus({ state: 'error', message: 'Failed to pre-load some frames' });
      }
    }

    loadAll();
    return () => {
      active = false;
      controller.abort();
    };
  }, [isWindActive, windAltitude, forecastTimestamps, fetchWeatherManifest]);

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
    windStatus,
    forecastTimestamps,
    getWindAtLngLat,
  };
}
