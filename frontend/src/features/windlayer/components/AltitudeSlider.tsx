import { useMapStore } from '../../../store/useMapStore';

export function AltitudeSlider() {
  const { windAltitude, setWindAltitude } = useMapStore();

  const formatAltitude = (alt: number) => {
    if (alt === 0) return 'Surface';
    if (alt < 5) return `${alt * 1000} ft`;
    return `FL${String(alt * 10).padStart(3, '0')}`;
  };

  return (
    <div className="wind-altitude wind-panel">
      <div className="wind-altitude__title">Altitude</div>
      <div className="wind-altitude__display">{formatAltitude(windAltitude)}</div>
      <div className="wind-altitude__slider-wrapper">
        <input
          type="range"
          min={0}
          max={39}
          step={1}
          value={windAltitude}
          onChange={(e) => setWindAltitude(Number(e.target.value))}
          className="wind-altitude__input"
        />
      </div>
    </div>
  );
}
