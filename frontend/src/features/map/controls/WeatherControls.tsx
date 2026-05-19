import { useEffect } from 'react';
import { StatusBadge } from './StatusBadge';
import { AltitudeSlider } from './AltitudeSlider';
import { TimelineControl } from './TimelineControl';
import { VerticalWindLegend } from './VerticalWindLegend';
import { useWindLayer } from '../layers/useWindLayer';
import { useMapStore } from '../../../store/useMapStore';
import type { WindStatus } from '../layers/useWindLayer';
import { Button } from '@heroui/react';
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
        <Button
          size="sm"
          radius="full"
          variant="flat"
          onPress={() => setIsWindMode(!isWindMode)}
          className={`backdrop-blur-xl transition-all ${
            isWindMode
              ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
              : 'bg-zinc-950/40 border border-zinc-800/60 text-zinc-500 hover:text-zinc-300'
          }`}
          startContent={<Wind size={14} />}
        >
          Wind
        </Button>
        <Button
          size="sm"
          radius="full"
          variant="flat"
          onPress={() => setIsCloudMode(!isCloudMode)}
          className={`backdrop-blur-xl transition-all ${
            isCloudMode
              ? 'bg-slate-300/30 text-slate-200 border border-slate-300/50 shadow-[0_0_10px_rgba(203,213,225,0.3)]'
              : 'bg-zinc-950/40 border border-zinc-800/60 text-zinc-500 hover:text-zinc-300'
          }`}
          startContent={<Cloud size={14} />}
        >
          Cloud
        </Button>
      </div>
      <StatusBadge status={displayStatus} />
      <AltitudeSlider />
      {isWindMode && <VerticalWindLegend />}
      <TimelineControl timestamps={forecastTimestamps} />
    </>
  );
}
