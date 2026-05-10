import { StatusBadge } from './StatusBadge';
import { AltitudeSlider } from './AltitudeSlider';
import { TimelineControl } from './TimelineControl';
import { VerticalWindLegend } from './VerticalWindLegend';
import { useWindLayer } from '../layers/useWindLayer';
import { useMapStore } from '../../../store/useMapStore';
import type { WindStatus } from '../layers/useWindLayer';

/**
 * Shared weather controls panel.
 *
 * Renders the altitude slider, timeline scrubber, and status badge
 * whenever *either* the wind or cloud layer is active. The vertical
 * wind legend is only shown when the wind layer is on.
 */
export function WeatherControls() {
  const { windStatus, forecastTimestamps } = useWindLayer();
  const { isWindMode, isCloudMode, cloudLoadingStatus } = useMapStore();

  // Show cloud status when only cloud is active, otherwise wind status
  const displayStatus: WindStatus =
    !isWindMode && isCloudMode ? (cloudLoadingStatus as WindStatus) : windStatus;

  return (
    <>
      <StatusBadge status={displayStatus} />
      <AltitudeSlider />
      {isWindMode && <VerticalWindLegend />}
      <TimelineControl timestamps={forecastTimestamps} />
    </>
  );
}
