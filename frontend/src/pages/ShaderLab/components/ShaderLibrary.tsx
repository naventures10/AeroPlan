import { Library, Layers, Waves, FlaskConical } from 'lucide-react';
import type { LoadedShaderDefinition } from '../types';

interface ShaderLibraryProps {
  shaders: LoadedShaderDefinition[];
  activeShaderId: string;
  show: boolean;
  onSelect: (id: string) => void;
}

export const ShaderLibrary = ({ shaders, activeShaderId, show, onSelect }: ShaderLibraryProps) => (
  <div
    className={`pointer-events-auto max-w-5xl rounded-3xl border border-white/8 bg-black/40 p-3 backdrop-blur-3xl shadow-2xl overflow-hidden transition-all duration-500 ${show ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
  >
    {show && (
      <>
        <div className="mb-3 flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
          <Library className="h-3 w-3" />
          Shader Library
        </div>

        <div className="flex flex-col gap-6 max-h-[40vh] overflow-y-auto px-1 custom-scrollbar">
          {(['Airway Network', 'Examples', 'Lab'] as const).map((category) => {
            const categoryShaders = shaders.filter((s) => s.category === category);
            if (categoryShaders.length === 0) return null;

            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2 px-2">
                  {category === 'Airway Network' && <Layers className="h-3 w-3 text-sky-400/60" />}
                  {category === 'Examples' && <Waves className="h-3 w-3 text-emerald-400/60" />}
                  {category === 'Lab' && <FlaskConical className="h-3 w-3 text-orange-400/60" />}
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">
                    {category}
                  </span>
                  <div className="h-px flex-1 bg-white/5" />
                </div>

                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {categoryShaders.map((shader) => {
                    const isActive = shader.id === activeShaderId;
                    return (
                      <button
                        key={shader.id}
                        type="button"
                        onClick={() => onSelect(shader.id)}
                        className={`group rounded-2xl border px-3.5 py-3 text-left transition ${
                          isActive
                            ? 'border-white/20 bg-white/10 shadow-lg'
                            : 'border-white/5 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.05]'
                        }`}
                      >
                        <div
                          className={`mb-2.5 h-1 w-12 origin-left rounded-full bg-gradient-to-r ${shader.accent} transition-transform group-hover:scale-x-110`}
                        />
                        <div className="text-[13px] font-bold tracking-tight text-white/90">
                          {shader.label}
                        </div>
                        <div className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-white/40 transition-colors group-hover:text-white/60">
                          {shader.summary}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {shader.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-white/5 bg-white/[0.03] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/30"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </>
    )}
  </div>
);
