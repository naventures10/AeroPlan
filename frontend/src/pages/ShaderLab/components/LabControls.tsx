import type { NdbIconConfig } from '../types';

interface LabControlsProps {
  shaderId: string;
  config: NdbIconConfig;
  onChange: (config: NdbIconConfig) => void;
}

export const LabControls = ({ shaderId, config, onChange }: LabControlsProps) => {
  if (shaderId !== 'ndb-icon' && shaderId !== 'dvor-icon') return null;

  return (
    <div className="pointer-events-auto absolute left-6 top-1/2 -translate-y-1/2 w-64 space-y-6 rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-left-4 duration-500 [transition-property:backdrop-filter,-webkit-backdrop-filter]">
      {shaderId === 'ndb-icon' && (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Rings
              </label>
              <span className="font-mono text-[11px] text-cyan-400">{config.ringCount}</span>
            </div>
            <input
              type="range"
              min="1"
              max="4"
              step="1"
              value={config.ringCount}
              onChange={(e) => onChange({ ...config, ringCount: parseInt(e.target.value) })}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Spacing
              </label>
              <span className="font-mono text-[11px] text-cyan-400">
                {config.ringSpacing.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.15"
              max="0.8"
              step="0.01"
              value={config.ringSpacing}
              onChange={(e) => onChange({ ...config, ringSpacing: parseFloat(e.target.value) })}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
            Rotation
          </label>
          <span className="font-mono text-[11px] text-cyan-400">
            {(config.rotation * (180 / Math.PI)).toFixed(0)}°
          </span>
        </div>
        <input
          type="range"
          min="0"
          max={6.28}
          step="0.01"
          value={config.rotation}
          onChange={(e) => onChange({ ...config, rotation: parseFloat(e.target.value) })}
          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />
      </div>

      {shaderId === 'dvor-icon' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Circle Radius
            </label>
            <span className="font-mono text-[11px] text-cyan-400">
              {config.circleRadius.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.45"
            max="0.9"
            step="0.01"
            value={config.circleRadius}
            onChange={(e) => onChange({ ...config, circleRadius: parseFloat(e.target.value) })}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      )}

      {shaderId === 'dvor-icon' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Line Length
            </label>
            <span className="font-mono text-[11px] text-cyan-400">
              {config.lineLength.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.02"
            max="0.3"
            step="0.01"
            value={config.lineLength}
            onChange={(e) => onChange({ ...config, lineLength: parseFloat(e.target.value) })}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      )}

      {shaderId === 'dvor-icon' && (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Tick Count
              </label>
              <span className="font-mono text-[11px] text-cyan-400">{config.tickCount}</span>
            </div>
            <input
              type="range"
              min="0"
              max="72"
              step="4"
              value={config.tickCount}
              onChange={(e) => onChange({ ...config, tickCount: parseInt(e.target.value) })}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Tick Length
              </label>
              <span className="font-mono text-[11px] text-cyan-400">
                {config.tickLength.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.2"
              step="0.01"
              value={config.tickLength}
              onChange={(e) => onChange({ ...config, tickLength: parseFloat(e.target.value) })}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </>
      )}

      {shaderId === 'ndb-icon' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Dot Density
            </label>
            <span className="font-mono text-[11px] text-cyan-400">
              {(config.dotDensity * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.2"
            max="2.0"
            step="0.05"
            value={config.dotDensity}
            onChange={(e) => onChange({ ...config, dotDensity: parseFloat(e.target.value) })}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      )}
    </div>
  );
};
