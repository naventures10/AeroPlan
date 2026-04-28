import { StatusBadge } from './StatusBadge';
import { AltitudeSlider } from './AltitudeSlider';
import { TimelineControl } from './TimelineControl';
import { VerticalWindLegend } from './VerticalWindLegend';
import { useWindLayer } from '../layers/useWindLayer';

export function WindControls() {
  const { windStatus, forecastTimestamps } = useWindLayer();

  return (
    <>
      <StatusBadge status={windStatus} />
      <AltitudeSlider />
      <VerticalWindLegend />
      <TimelineControl timestamps={forecastTimestamps} />
    </>
  );
}
