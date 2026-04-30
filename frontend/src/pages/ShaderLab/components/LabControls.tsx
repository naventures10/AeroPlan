import type { NavIconConfig } from '../types';

interface LabControlsProps {
  shaderId: string;
  config: NavIconConfig;
  onChange: (config: NavIconConfig) => void;
}

export const LabControls = ({ shaderId, config, onChange }: LabControlsProps) => {
  if (shaderId !== 'radio-nav-icons') return null;

  return (
    <div className="pointer-events-auto absolute left-6 top-1/2 -translate-y-1/2 w-64 space-y-6 rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur-3xl shadow-2xl animate-in fade-in slide-in-from-left-4 duration-500">
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
    </div>
  );
};
