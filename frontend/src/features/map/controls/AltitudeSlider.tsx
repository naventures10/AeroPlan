import { useMapStore } from '../../../store/useMapStore';
import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Generate altitude levels from Surface to FL390 in 1000ft increments.
 */
const ALTITUDE_LEVELS = Array.from({ length: 40 }, (_, i) => {
  if (i === 0) return { value: 0, label: 'SFC', sublabel: 'Surface' };
  const ft = i * 1000;
  if (ft < 5000) return { value: i, label: `${ft}`, sublabel: 'ft' };
  return {
    value: i,
    label: `FL${String(i).padStart(2, '0')}0`,
    sublabel: `${ft.toLocaleString()} ft`,
  };
});

export function AltitudeSlider() {
  const { windAltitude, setWindAltitude } = useMapStore();

  // Find the current index within our levels
  const currentIdx = ALTITUDE_LEVELS.findIndex((l) => l.value === windAltitude);
  const activeIdx = currentIdx >= 0 ? currentIdx : 0;
  const active = ALTITUDE_LEVELS[activeIdx] ?? ALTITUDE_LEVELS[0]!;

  const canGoUp = activeIdx < ALTITUDE_LEVELS.length - 1;
  const canGoDown = activeIdx > 0;

  const stepUp = () => {
    if (canGoUp) setWindAltitude(ALTITUDE_LEVELS[activeIdx + 1]!.value);
  };

  const stepDown = () => {
    if (canGoDown) setWindAltitude(ALTITUDE_LEVELS[activeIdx - 1]!.value);
  };

  return (
    <div className="wind-altitude wind-panel" data-testid="wind-altitude">
      <div className="wind-altitude__title">ALT</div>

      <button
        className={`wind-altitude__step-btn ${!canGoUp ? 'disabled' : ''}`}
        onClick={stepUp}
        disabled={!canGoUp}
        aria-label="Increase altitude"
        data-testid="altitude-up"
      >
        <ChevronUp size={20} strokeWidth={2.5} />
      </button>

      <div className="wind-altitude__display" data-testid="wind-altitude-display">
        <span className="wind-altitude__value">{active.label}</span>
        <span className="wind-altitude__sublabel">{active.sublabel}</span>
      </div>

      {/* Level dots — visual indicator of position. 
 Reversed so higher altitude is at the top. */}
      <div className="wind-altitude__dots">
        {[...ALTITUDE_LEVELS].reverse().map((level) => (
          <button
            key={level.value}
            className={`wind-altitude__dot ${level.value === active.value ? 'active' : ''}`}
            onClick={() => setWindAltitude(level.value)}
            aria-label={`Set altitude to ${level.label}`}
          />
        ))}
      </div>

      <button
        className={`wind-altitude__step-btn ${!canGoDown ? 'disabled' : ''}`}
        onClick={stepDown}
        disabled={!canGoDown}
        aria-label="Decrease altitude"
        data-testid="altitude-down"
      >
        <ChevronDown size={20} strokeWidth={2.5} />
      </button>
    </div>
  );
}
