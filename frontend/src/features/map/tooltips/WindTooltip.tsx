interface WindTooltipProps {
  x: number;
  y: number;
  speed: number;
  direction: number;
}

export function WindTooltip({ x, y, speed, direction }: WindTooltipProps) {
  return (
    <div
      className="absolute pointer-events-none z-30 px-3 py-2 flex flex-col gap-1 text-xs wind-panel -translate-x-1/2 -translate-y-[120%]"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-on-surface-variant">Speed</span>
        <span className="font-semibold text-primary">{Math.round(speed)} kt</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-on-surface-variant">Dir</span>
        <span className="font-semibold text-primary">{Math.round(direction)}°</span>
      </div>
    </div>
  );
}
