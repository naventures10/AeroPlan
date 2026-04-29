import { useMapStore } from '../../../store/useMapStore';
import { calculateNowIndex } from '../utils/windUtils';
import type { ForecastTimestamp } from '../utils/windUtils';

interface TimelineControlProps {
  timestamps: ForecastTimestamp[];
}

export function TimelineControl({ timestamps }: TimelineControlProps) {
  const {
    windAnimationTime,
    setWindAnimationTime,
    windIsPlaying,
    setWindIsPlaying,
    toggleWindPlayback,
  } = useMapStore();

  const nowIndex = calculateNowIndex(timestamps);
  const currentIndex = Math.min(
    Math.floor(Math.max(0, windAnimationTime)),
    Math.max(0, timestamps.length - 1),
  );
  const activeTime = timestamps[currentIndex];

  if (!activeTime) return null;

  const totalSteps = Math.max(1, timestamps.length - 1);
  const nowPercent = (nowIndex / totalSteps) * 100;
  const currentPercent = (windAnimationTime / totalSteps) * 100;

  const onPlayToggle = () => {
    toggleWindPlayback(timestamps.length - 1);
  };

  return (
    <div className="wind-timeline wind-panel">
      <div className="wind-timeline__header">
        <button className="wind-timeline__play-circle" onClick={onPlayToggle}>
          {windIsPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="wind-timeline__info-center">
          <span className="wind-timeline__title-main">WIND FORECAST</span>
          <span className="wind-timeline__date-main">{activeTime.date}</span>
        </div>

        <div className="wind-timeline__header-right" />
      </div>

      {/* Slider track area */}
      <div className="wind-timeline__interactive-track">
        <div className="wind-timeline__track-base">
          <div className="wind-timeline__track-fill" style={{ width: `${currentPercent}%` }} />
          {/* Now marker — thin line on the track itself */}
          <div className="wind-timeline__now-pointer" style={{ left: `${nowPercent}%` }} />
        </div>

        <input
          type="range"
          className="wind-timeline__range-overlay"
          min={0}
          max={totalSteps}
          step={0.01}
          value={windAnimationTime}
          onChange={(e) => {
            setWindAnimationTime(parseFloat(e.target.value));
            setWindIsPlaying(false);
          }}
        />
      </div>

      {/* Time labels row — separate from the track */}
      <div className="wind-timeline__ticks-labels">
        {timestamps.map((t, i) => (
          <div key={i} className="wind-timeline__tick-wrapper">
            <span className={`wind-timeline__tick-text ${i === currentIndex ? 'active' : ''}`}>
              {t.label}
            </span>
          </div>
        ))}
      </div>

      {/* NOW label — completely below everything, using absolute left % */}
      <div className="wind-timeline__now-row">
        <div className="wind-timeline__now-label-container" style={{ left: `${nowPercent}%` }}>
          <div className="wind-timeline__now-diamond" />
          <span className="wind-timeline__now-text">NOW</span>
        </div>
      </div>
    </div>
  );
}
