import { useState, useCallback } from 'react';
import { useMapStore } from '../../../store/useMapStore';
import { useWindLayer } from '../layers/useWindLayer';

export function useWindTooltip() {
  const isWeatherMode = useMapStore((s) => s.isWeatherMode);
  const isWindMode = useMapStore((s) => s.isWindMode);
  const viewMode = useMapStore((s) => s.viewMode);
  const { getWindAtLngLat } = useWindLayer();
  const [windHoverInfo, setWindHoverInfo] = useState<{
    x: number;
    y: number;
    speed: number;
    direction: number;
  } | null>(null);

  const handleWindHover = useCallback(
    (info: any) => {
      if (info.coordinate && isWeatherMode && isWindMode && viewMode === 'ENROUTE') {
        const windData = getWindAtLngLat(info.coordinate[0], info.coordinate[1]);
        if (windData) {
          setWindHoverInfo({
            x: info.x,
            y: info.y,
            speed: windData.speed,
            direction: windData.direction,
          });
          return;
        }
      }
      setWindHoverInfo(null);
    },
    [isWeatherMode, isWindMode, viewMode, getWindAtLngLat],
  );

  return { windHoverInfo, handleWindHover };
}
