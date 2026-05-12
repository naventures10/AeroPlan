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
  const { windStatus, forecastTimestamps } = useWindLayer();
  const { isWindMode, setIsWindMode, isCloudMode, setIsCloudMode, cloudLoadingStatus } =
    useMapStore();

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
