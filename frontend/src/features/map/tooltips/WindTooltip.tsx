interface WindTooltipProps {
  x: number;
  y: number;
  speed: number;
  direction: number;
}

export function WindTooltip({ x, y, speed, direction }: WindTooltipProps) {
  return (
    <div className="wind-tooltip wind-panel" style={{ left: x, top: y }}>
      <div className="wind-tooltip__row">
        <span className="wind-tooltip__label">Speed</span>
        <span className="wind-tooltip__value">{Math.round(speed)} kt</span>
      </div>
      <div className="wind-tooltip__row">
        <span className="wind-tooltip__label">Dir</span>
        <span className="wind-tooltip__value">{Math.round(direction)}°</span>
      </div>
    </div>
  );
}
