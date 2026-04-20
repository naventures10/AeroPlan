import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LabelVal } from './SharedLabel';

export function AirspaceDetailsPanel({
  data,
  highlightedAirspaceId,
  setHighlightedAirspaceId,
}: {
  data: any;
  highlightedAirspaceId: string | null;
  setHighlightedAirspaceId: (id: string | null) => void;
}) {
  const features = Array.isArray(data) ? data : [];
  if (features.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {features.map((feat: any, idx: number) => {
        const p = feat.properties || {};
        const id = p.id ?? feat.id;
        const isExpanded = highlightedAirspaceId === String(id);
        const typeLabel = (p.airspace_type || 'UNKNOWN').replace('_', ' ');

        return (
          <div
            key={`${id}-${idx}`}
            className="rounded-lg border border-white/10 overflow-hidden bg-white/[0.02]"
          >
            <button
              onClick={() => setHighlightedAirspaceId(isExpanded ? null : String(id))}
              className={`w-full flex items-center justify-between px-3 py-2 transition-colors ${
                isExpanded ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold text-cyan-400 tracking-widest uppercase">
                  {typeLabel}
                </span>
                <span className="text-xs font-semibold text-white">
                  {p.name || 'Unnamed Airspace'}
                </span>
              </div>
              {isExpanded ? (
                <ChevronUp size={14} className="text-zinc-500" />
              ) : (
                <ChevronDown size={14} className="text-zinc-500" />
              )}
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 py-3 border-t border-white/[0.06] flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <LabelVal label="Identification" val={p.identification} />
                      <LabelVal label="Source" val={p.source_file?.split('/').pop()} />
                      <LabelVal label="Lower Limit" val={p.lower_limit} />
                      <LabelVal label="Upper Limit" val={p.upper_limit} />
                    </div>
                    <div className="col-span-2">
                      <LabelVal label="Remarks" val={p.remarks} />
                    </div>
                    <div className="col-span-2">
                      <LabelVal label="Lateral Limits" val={p.lateral_limits} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
