import { ArrowLeft } from 'lucide-react';
import type { LoadedShaderDefinition } from '../types';

interface ShaderHeaderProps {
  shader: LoadedShaderDefinition;
  show: boolean;
  onBack: () => void;
}

export const ShaderHeader = ({ shader, show, onBack }: ShaderHeaderProps) => (
  <div
    className={`pointer-events-auto flex max-w-md items-start gap-5 rounded-[32px] border border-white/8 bg-black/40 p-5 backdrop-blur-xl shadow-2xl transition duration-700 ease-out [transition-property:opacity,transform,backdrop-filter,-webkit-backdrop-filter] ${
      show ? 'translate-y-0 opacity-100' : '-translate-y-12 opacity-0'
    }`}
  >
    <button
      onClick={onBack}
      className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/5 bg-white/5 transition hover:bg-white/10 active:scale-95"
    >
      <ArrowLeft className="h-4 w-4 text-white/40 transition-colors group-hover:text-white" />
    </button>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-3">
        <div
          className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ${shader.accent} p-[1px] shadow-lg shadow-cyan-500/10`}
        >
          <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-black/40 backdrop-blur-sm">
            <div className={`h-4 w-4 rounded-full bg-gradient-to-br ${shader.accent} opacity-80`} />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">
            <span>ShaderLab</span>
            <span className="text-white/10">/</span>
            <span>WGSL</span>
          </div>
          <h1 className="truncate text-xl font-black tracking-tight text-white/95 leading-tight">
            {shader.label}
          </h1>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <p className="text-[12.5px] leading-relaxed text-white/50 line-clamp-2">{shader.summary}</p>
        <p className="text-[11px] leading-relaxed text-white/30 border-t border-white/5 pt-3">
          {shader.detail}
        </p>
      </div>
      {shader.interactionHint && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-cyan-400/5 px-3 py-2 border border-cyan-400/10">
          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <p className="text-[10px] font-medium text-cyan-300/60 uppercase tracking-wider">
            {shader.interactionHint}
          </p>
        </div>
      )}
    </div>
  </div>
);
