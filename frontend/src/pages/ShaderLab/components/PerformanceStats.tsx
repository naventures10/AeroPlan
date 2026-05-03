import { Activity, Cpu, BarChart3, X, Layout, LayoutGrid } from 'lucide-react';
import type { GPUInfo, GPUMetrics, PresentationSize } from '../types';

interface PerformanceStatsProps {
  show: boolean;
  status: string;
  gpuInfo: GPUInfo;
  metrics: GPUMetrics;
  size: PresentationSize;
  onToggle: () => void;
  onClose: () => void;
  showUI: boolean;
  onToggleUI: () => void;
}

export const PerformanceStats = ({
  show,
  status,
  gpuInfo,
  metrics,
  size,
  onToggle,
  onClose,
  showUI,
  onToggleUI,
}: PerformanceStatsProps) => (
  <div className="flex flex-col items-end gap-3">
    <div className="flex items-center gap-2 pointer-events-auto">
      <button
        type="button"
        onClick={onToggleUI}
        className={`flex items-center justify-center h-10 w-10 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl transition [transition-property:backdrop-filter,-webkit-backdrop-filter] hover:bg-white/5 active:scale-95 ${!showUI ? 'text-cyan-400 ring-2 ring-cyan-500/20' : 'text-white/40'}`}
      >
        {showUI ? <Layout className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
      </button>

      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center justify-center h-10 w-10 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl transition [transition-property:backdrop-filter,-webkit-backdrop-filter] hover:bg-white/5 active:scale-95 ${show ? 'text-cyan-400 ring-2 ring-cyan-500/20' : 'text-white/40'}`}
      >
        <Activity className={`h-4 w-4 ${show ? 'text-cyan-400' : 'text-white/40'}`} />
      </button>

      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-3.5 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/60">
          <Cpu className="h-3.5 w-3.5" />
          {status === 'ready' ? (
            <span className="flex items-center gap-1.5">
              WebGPU{' '}
              <span className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            </span>
          ) : (
            'Status: ' + status
          )}
        </div>
      </div>
    </div>

    {show && (
      <div className="pointer-events-auto w-64 rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in duration-200 [transition-property:backdrop-filter,-webkit-backdrop-filter]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
            <BarChart3 className="h-3.5 w-3.5" />
            Workload Monitor
          </div>
          <button onClick={onClose} className="text-white/20 transition hover:text-white/60">
            <X className="h-3 w-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/30">FPS</p>
            <p className="font-mono text-xl font-bold text-emerald-400">{metrics.fps}</p>
          </div>
          <div className="space-y-0.5 text-right">
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/30">Latency</p>
            <p className="font-mono text-xl font-bold text-cyan-400">
              {metrics.frameTime.toFixed(1)}
              <span className="ml-0.5 text-[10px] opacity-50">ms</span>
            </p>
          </div>
        </div>

        <div className="mt-4 flex h-12 items-end gap-[1px]">
          {metrics.history.map((frameTime, index) => (
            <div
              key={index}
              className="flex-1 rounded-t-[1px] bg-cyan-500/30"
              style={{ height: `${Math.min(100, (frameTime / 33) * 100)}%` }}
            />
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t border-white/5 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">GPU</span>
            <span className="max-w-[140px] truncate font-mono text-[10px] text-white/70">
              {gpuInfo.device}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">
              Arch
            </span>
            <span className="font-mono text-[10px] text-white/70">{gpuInfo.architecture}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">
              View
            </span>
            <span className="font-mono text-[10px] text-white/70">
              {size.width}x{size.height}
            </span>
          </div>
        </div>
      </div>
    )}
  </div>
);
