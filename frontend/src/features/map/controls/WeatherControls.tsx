import { useEffect } from 'react';
import './WeatherControls.css';
import { StatusBadge } from './StatusBadge';
import { AltitudeSlider } from './AltitudeSlider';
import { TimelineControl } from './TimelineControl';
import { VerticalWindLegend } from './VerticalWindLegend';
import { useWindLayer } from '../layers/useWindLayer';
import { useMapStore } from '../../../store/useMapStore';
import type { WindStatus } from '../layers/useWindLayer';

import { Wind, Cloud } from 'lucide-react';

/**
 * Shared weather controls panel.
 *
 * Renders the altitude slider, timeline scrubber, and status badge
 * whenever *either* the wind or cloud layer is active. The vertical
 * wind legend is only shown when the wind layer is on.
 */
export function WeatherControls() {
  const { windStatus } = useWindLayer();
  const {
    isWindMode,
    setIsWindMode,
    isCloudMode,
    setIsCloudMode,
    cloudLoadingStatus,
    isWeatherMode,
    viewMode,
    windIsPlaying,
    setWindIsPlaying,
    setWindAnimationTime,
    forecastTimestamps,
    fetchWeatherManifest,
  } = useMapStore();

  // 1. Fetch manifest on mount if not already loaded
  useEffect(() => {
    fetchWeatherManifest();
  }, [fetchWeatherManifest]);

  // 2. Animation loop — drives the shared timeline for all weather layers
  useEffect(() => {
    const isAnyWeatherActive = isWeatherMode && viewMode === 'ENROUTE';
    if (!isAnyWeatherActive || !windIsPlaying || forecastTimestamps.length === 0) return;

    let lastTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Snappy and dynamic playback speed: 4 seconds per frame transition (1 / 4 = 0.25 units per second)
      const playbackSpeed = 0.25;

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
    isWeatherMode,
    viewMode,
    windIsPlaying,
    forecastTimestamps.length,
    setWindAnimationTime,
    setWindIsPlaying,
  ]);

  // Show cloud status when only cloud is active, otherwise wind status
  const displayStatus: WindStatus =
    !isWindMode && isCloudMode ? (cloudLoadingStatus as WindStatus) : windStatus;

  return (
    <>
      <div className="absolute top-6 right-20 flex gap-2 z-50 pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsWindMode(!isWindMode)}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-full backdrop-blur-xl transition-all ${
            isWindMode
              ? 'bg-blue-500/20 text-blue-600 border border-blue-500/30 shadow-[0_0_10px_color-mix(in_srgb,var(--route-ats)_30%,transparent)] dark:bg-blue-500/30 dark:text-blue-400 dark:border-blue-500/50'
              : 'bg-surface-bright/40 border border-outline text-on-surface-variant hover:text-on-surface     hover:bg-surface-container dark:hover:bg-zinc-900'
          }`}
        >
          <Wind size={14} />
          Wind
        </button>
        <button
          type="button"
          onClick={() => setIsCloudMode(!isCloudMode)}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-full backdrop-blur-xl transition-all ${
            isCloudMode
              ? 'bg-slate-300/40 text-on-surface-variant border border-outline/50 shadow-[0_0_10px_color-mix(in_srgb,var(--outline-variant)_30%,transparent)]   '
              : 'bg-surface-bright/40 border border-outline text-on-surface-variant hover:text-on-surface     hover:bg-surface-container dark:hover:bg-zinc-900'
          }`}
        >
          <Cloud size={14} />
          Cloud
        </button>
      </div>
      <StatusBadge status={displayStatus} />
      <AltitudeSlider />
      {isWindMode && <VerticalWindLegend />}
      <TimelineControl timestamps={forecastTimestamps} />
    </>
  );
}
