import { Clock3 } from 'lucide-react';
import type { LoadedShaderDefinition } from '../types';

interface ShaderSourceInfoProps {
  shader: LoadedShaderDefinition;
  show: boolean;
}

export const ShaderSourceInfo = ({ shader, show }: ShaderSourceInfoProps) => (
  <div
    className={`pointer-events-auto rounded-3xl border border-white/8 bg-black/40 p-4 backdrop-blur-3xl shadow-2xl lg:max-w-[280px] transition-all duration-500 ${show ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
  >
    {show && (
      <>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
          <Clock3 className="h-3 w-3" />
          Source
        </div>
        <p className="truncate font-mono text-[10px] text-cyan-300/60">
          {shader.sourceLabel ?? shader.shaderPath}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-white/35">
          Fullscreen presets share cursor and timing uniforms via bind groups.
        </p>
      </>
    )}
  </div>
);
