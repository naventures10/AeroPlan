import { useEffect, useRef, useState } from 'react';
import { useMapStore } from '../../../store/useMapStore';
import type { ForecastTimestamp } from '../utils/windUtils';

// ---------------------------------------------------------------------------
// Frame index utilities
// ---------------------------------------------------------------------------

/**
 * Computes the two bracketing frame indices and interpolation weight
 * for the current animation time.
 */
export function getFrameIndices(timestamps: ForecastTimestamp[], animationTime: number) {
  const maxIndex = Math.max(0, timestamps.length - 1);
  const index1 = Math.min(Math.floor(Math.max(0, animationTime)), maxIndex);
  const index2 = Math.min(index1 + 1, maxIndex);
  const weight = animationTime - index1;
  return { maxIndex, index1, index2, weight };
}

/**
 * Computes prioritised and remaining frame indices for progressive loading.
 * The two frames closest to the current animation time are loaded first.
 */
function getPrioritisedIndices(totalFrames: number, currentAnimTime: number) {
  const maxIdx = totalFrames - 1;
  const startIndex1 = Math.min(Math.floor(Math.max(0, currentAnimTime)), maxIdx);
  const startIndex2 = Math.min(startIndex1 + 1, maxIdx);

  const prioritizedIndices = Array.from(new Set([startIndex1, startIndex2]));
  const remainingIndices = Array.from({ length: totalFrames }, (_, i) => i).filter(
    (i) => !prioritizedIndices.includes(i),
  );

  return { prioritizedIndices, remainingIndices };
}

// ---------------------------------------------------------------------------
// Generic frame loader hook
// ---------------------------------------------------------------------------

export interface FrameLoaderStatus {
  state: 'idle' | 'loading' | 'ready' | 'error';
  message?: string;
  validTime?: string;
}

interface UseWeatherFrameLoaderOptions<TFrame> {
  /** Whether this particular layer is currently active */
  isActive: boolean;
  /** Current altitude from the store */
  altitude: number;
  /** Shared forecast timestamps from the store */
  forecastTimestamps: ForecastTimestamp[];
  /** Store action to trigger a fresh manifest fetch */
  fetchWeatherManifest: (force?: boolean) => Promise<void>;

  /**
   * Hook-specific frame loader. Given a timestamp index, the level key,
   * and an AbortSignal, fetch the raw TIFF and return the processed frame
   * data for that index.
   */
  loadFrame: (
    index: number,
    levelKey: string,
    signal: AbortSignal,
    forecastTimestamps: ForecastTimestamp[],
  ) => Promise<{ index: number; data: TFrame }>;

  /** Label for console messages, e.g. 'useWindLayer' or 'useCloudLayer'. */
  logPrefix: string;
}

/**
 * Helper to determine if an error was caused by a request/decode abortion.
 * We check the name, the message, and the wrapped cause since library-level
 * decoders (e.g. geotiff.js/weatherlayers-gl) sometimes wrap standard AbortErrors.
 */
function isAbortError(err: any): boolean {
  if (!err) return false;
  return (
    err.name === 'AbortError' ||
    err.message?.includes('aborted') ||
    err.message?.includes('decoding aborted') ||
    err.cause?.name === 'AbortError'
  );
}

/**
 * Shared hook that orchestrates priority-based progressive loading of
 * weather forecast frames, with automatic stale-manifest recovery.
 *
 * Returns `{ frames, status }` where `frames` is a Record<number, TFrame>.
 */
export function useWeatherFrameLoader<TFrame>({
  isActive,
  altitude,
  forecastTimestamps,
  fetchWeatherManifest,
  loadFrame,
  logPrefix,
}: UseWeatherFrameLoaderOptions<TFrame>) {
  const [frames, setFrames] = useState<Record<number, TFrame>>({});
  const [status, setStatus] = useState<FrameLoaderStatus>({ state: 'idle' });
  const staleManifestAttemptedRef = useRef<Record<string, boolean>>({});

  // Trigger manifest load if active and timestamps aren't loaded yet
  useEffect(() => {
    if (isActive && forecastTimestamps.length === 0) {
      fetchWeatherManifest();
    }
  }, [isActive, forecastTimestamps.length, fetchWeatherManifest]);

  // Progressive frame loading with priority ordering
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const signal = controller.signal;

    // fallow-ignore-next-line complexity
    async function loadAll() {
      if (!isActive || forecastTimestamps.length === 0) return;

      setStatus({ state: 'loading', message: 'Pre-loading forecast frames…' });
      setFrames({});

      const levelKey = altitude === 0 ? 'surface' : String(altitude).padStart(3, '0');
      const totalFrames = forecastTimestamps.length;

      const currentAnimTime = useMapStore.getState().windAnimationTime;
      const { prioritizedIndices, remainingIndices } = getPrioritisedIndices(
        totalFrames,
        currentAnimTime,
      );

      try {
        // Step A: Load prioritised frames in parallel using Promise.allSettled to avoid unhandled rejections
        const prioritizedSettled = await Promise.allSettled(
          prioritizedIndices.map((idx) => loadFrame(idx, levelKey, signal, forecastTimestamps)),
        );
        if (!active) return;

        const frameMap: Record<number, TFrame> = {};
        let firstNonAbortError: any = null;

        for (const res of prioritizedSettled) {
          if (res.status === 'fulfilled') {
            frameMap[res.value.index] = res.value.data;
          } else {
            if (!isAbortError(res.reason)) {
              firstNonAbortError = res.reason;
            }
          }
        }

        setFrames((prev) => ({ ...prev, ...frameMap }));

        if (firstNonAbortError) {
          throw firstNonAbortError;
        }

        setStatus({ state: 'ready', message: 'Active frames ready' });

        // Step B: Load remaining frames sequentially in the background
        for (const idx of remainingIndices) {
          if (!active) return;
          try {
            const r = await loadFrame(idx, levelKey, signal, forecastTimestamps);
            if (!active) return;
            setFrames((prev) => ({ ...prev, [r.index]: r.data }));
          } catch (err: any) {
            if (isAbortError(err) || !active) return;
            console.error(`[${logPrefix}] Background load error for frame ${idx}:`, err);
          }
        }
      } catch (err: any) {
        if (isAbortError(err) || !active) return;
        console.error(`[${logPrefix}] Load error:`, err);

        // Stale manifest auto-heal
        if (err.message?.includes('File no longer exists')) {
          const forecastKey = `${forecastTimestamps.map((t) => t.validTime).join(',')}_${altitude}`;
          if (!staleManifestAttemptedRef.current[forecastKey]) {
            staleManifestAttemptedRef.current[forecastKey] = true;
            console.warn(
              `[${logPrefix}] Stale manifest detected. Auto-healing by fetching fresh manifest...`,
            );
            fetchWeatherManifest(true);
            return;
          } else {
            console.error(
              `[${logPrefix}] Stale manifest detected, but auto-heal was already attempted for this timestamp/altitude key.`,
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
  }, [isActive, altitude, forecastTimestamps, fetchWeatherManifest, loadFrame, logPrefix]);

  return { frames, status };
}
