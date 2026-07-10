import { useEffect, useRef, useState } from 'react';
import { useMapStore } from '../../../../store/useMapStore';
import { useWindLayer } from '../../layers/useWindLayer';
import { calculateNowIndex } from '../../utils/windUtils';
import type { WindStatus } from '../../layers/useWindLayer';
import { Wind, Cloud, ChevronDown, ChevronUp } from 'lucide-react';
import './MobileWeatherControls.css';

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

export function MobileWeatherControls() {
  const { windStatus } = useWindLayer();
  const isWindMode = useMapStore((s) => s.isWindMode);
  const setIsWindMode = useMapStore((s) => s.setIsWindMode);
  const isCloudMode = useMapStore((s) => s.isCloudMode);
  const setIsCloudMode = useMapStore((s) => s.setIsCloudMode);
  const cloudLoadingStatus = useMapStore((s) => s.cloudLoadingStatus);
  const isWeatherMode = useMapStore((s) => s.isWeatherMode);
  const viewMode = useMapStore((s) => s.viewMode);
  const windIsPlaying = useMapStore((s) => s.windIsPlaying);
  const setWindIsPlaying = useMapStore((s) => s.setWindIsPlaying);
  const setWindAnimationTime = useMapStore((s) => s.setWindAnimationTime);
  const forecastTimestamps = useMapStore((s) => s.forecastTimestamps);
  const fetchWeatherManifest = useMapStore((s) => s.fetchWeatherManifest);
  const windAltitude = useMapStore((s) => s.windAltitude);
  const setWindAltitude = useMapStore((s) => s.setWindAltitude);
  const toggleWindPlayback = useMapStore((s) => s.toggleWindPlayback);
  const windAnimationTime = useMapStore((s) => s.windAnimationTime);

  const altitudeScrollContainerRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  // 3. Auto-scroll active altitude chip into view
  useEffect(() => {
    if (isCollapsed || !altitudeScrollContainerRef.current) return;
    const activeBtn = altitudeScrollContainerRef.current.querySelector(
      '.aip-mobile-alt-chip.active',
    );
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [windAltitude, isCollapsed]);

  const displayStatus: WindStatus =
    !isWindMode && isCloudMode ? (cloudLoadingStatus as WindStatus) : windStatus;

  let stateClass = 'status--idle';
  switch (displayStatus.state) {
    case 'loading':
      stateClass = 'status--loading';
      break;
    case 'ready':
      stateClass = 'status--ready';
      break;
    case 'error':
      stateClass = 'status--error';
      break;
    default:
      stateClass = 'status--idle';
  }

  // Timeline variables
  const nowIndex = calculateNowIndex(forecastTimestamps);
  const currentIndex = Math.min(
    Math.floor(Math.max(0, windAnimationTime)),
    Math.max(0, forecastTimestamps.length - 1),
  );
  const activeTime = forecastTimestamps[currentIndex];

  const totalSteps = Math.max(1, forecastTimestamps.length - 1);
  const nowPercent = (nowIndex / totalSteps) * 100;
  const currentPercent = (windAnimationTime / totalSteps) * 100;

  const onPlayToggle = () => {
    toggleWindPlayback(forecastTimestamps.length - 1);
  };

  return (
    <div
      className={`aip-mobile-weather-panel pointer-events-auto ${isCollapsed ? 'collapsed' : ''}`}
      data-testid="mobile-weather-controls"
    >
      {/* Top Header: Mode Selector & Status & Collapse/Expand & Close */}
      <div className="aip-mobile-weather-header">
        <div className="aip-mobile-weather-modes">
          <button
            type="button"
            data-testid="mobile-wind-toggle"
            onClick={() => setIsWindMode(!isWindMode)}
            className={`aip-mobile-mode-btn ${isWindMode ? 'active-wind' : ''}`}
          >
            <Wind size={15} />
            <span>Wind</span>
          </button>
          <button
            type="button"
            data-testid="mobile-cloud-toggle"
            onClick={() => setIsCloudMode(!isCloudMode)}
            className={`aip-mobile-mode-btn ${isCloudMode ? 'active-cloud' : ''}`}
          >
            <Cloud size={15} />
            <span>Cloud</span>
          </button>
        </div>

        <div className={`aip-mobile-weather-status ${stateClass}`}>
          <span className="aip-mobile-weather-status-dot" />
          <span className="aip-mobile-weather-status-text">
            {displayStatus.state === 'loading' && '⟳ '}
            {displayStatus.message || displayStatus.state}
          </span>
        </div>

        <div className="aip-mobile-header-actions">
          <button
            type="button"
            data-testid="mobile-weather-collapse"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="aip-mobile-weather-collapse-btn"
            aria-label={isCollapsed ? 'Expand weather controls' : 'Collapse weather controls'}
          >
            {isCollapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Altitude Scrollable Chips */}
          <div className="aip-mobile-alt-section">
            <span className="aip-mobile-section-label">ALTITUDE</span>
            <div className="aip-mobile-alt-chips-container" ref={altitudeScrollContainerRef}>
              {ALTITUDE_LEVELS.map((level) => {
                const isActive = level.value === windAltitude;
                return (
                  <button
                    key={level.value}
                    type="button"
                    data-testid={`mobile-alt-chip-${level.value}`}
                    onClick={() => setWindAltitude(level.value)}
                    className={`aip-mobile-alt-chip ${isActive ? 'active' : ''}`}
                  >
                    <span className="aip-mobile-alt-chip-label">{level.label}</span>
                    <span className="aip-mobile-alt-chip-sublabel">{level.sublabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wind speed color bar inline (Only shown when Wind is active) */}
          {isWindMode && (
            <div className="aip-mobile-legend-section">
              <div className="aip-mobile-legend-bar" />
              <div className="aip-mobile-legend-labels">
                <span>0 kt</span>
                <span>40 kt</span>
                <span>80 kt</span>
                <span>120 kt</span>
              </div>
            </div>
          )}

          {/* Timeline Scrubber */}
          {activeTime && (
            <div className="aip-mobile-timeline-section">
              <div className="aip-mobile-timeline-header">
                <button
                  type="button"
                  data-testid="mobile-play-toggle"
                  className="aip-mobile-play-btn"
                  onClick={onPlayToggle}
                  aria-label={windIsPlaying ? 'Pause forecast' : 'Play forecast'}
                >
                  {windIsPlaying ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                <div className="aip-mobile-timeline-info">
                  <span className="aip-mobile-timeline-title">WEATHER FORECAST</span>
                  <span className="aip-mobile-timeline-date">{activeTime.date}</span>
                </div>
              </div>

              <div className="aip-mobile-timeline-track-container">
                <div className="aip-mobile-timeline-track-base">
                  <div
                    className="aip-mobile-timeline-track-fill"
                    style={{ width: `${currentPercent}%` }}
                  />
                  <div
                    className="aip-mobile-timeline-now-pointer"
                    style={{ left: `${nowPercent}%` }}
                  />
                </div>

                <input
                  type="range"
                  data-testid="mobile-timeline-slider"
                  className="aip-mobile-timeline-slider"
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

              <div className="aip-mobile-timeline-labels">
                {forecastTimestamps.map((t, i) => (
                  <span
                    key={i}
                    className={`aip-mobile-timeline-label ${i === currentIndex ? 'active' : ''}`}
                  >
                    {t.label}
                  </span>
                ))}
              </div>

              <div className="aip-mobile-timeline-now-row">
                <div className="aip-mobile-timeline-now-label" style={{ left: `${nowPercent}%` }}>
                  <div className="aip-mobile-timeline-now-diamond" />
                  <span>NOW</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
