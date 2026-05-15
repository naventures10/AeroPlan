import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import type { NotamData } from '../../../types';

interface NotamWidgetProps {
  notams: NotamData[];
}

export function NotamWidget({ notams }: NotamWidgetProps) {
  return (
    <motion.div
      key="notam"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full gap-4"
    >
      <h3 className="text-xl font-black text-white tracking-widest mb-4 flex items-center gap-2">
        <AlertTriangle className="text-amber-500" /> Active NOTAMs
        <span className="bg-zinc-800 text-xs px-3 py-1 rounded-full ml-auto">
          {notams.length} Total
        </span>
      </h3>
      <div className="flex flex-col gap-4 overflow-y-auto pb-6 custom-scrollbar pr-2">
        {notams.length > 0 ? (
          notams.map((n) => (
            <div
              key={n.notam_id}
              className="bg-white/[0.03] p-5 rounded-2xl border border-white/[0.05] hover:border-white/10 transition"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-amber-400 font-bold tracking-widest text-sm flex items-center gap-2">
                  {n.notam_id}
                  {n.scope && (
                    <span className="text-[9px] bg-zinc-800 text-amber-500 px-1.5 py-0.5 rounded">
                      {n.scope}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {n.is_estimated && (
                    <span className="text-[10px] text-zinc-400 font-mono">EST</span>
                  )}
                  <span className="text-xs text-zinc-500 font-mono tracking-widest">
                    SERIES {n.series}
                  </span>
                </div>
              </div>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">
                {n.description}
              </p>
              <div className="mt-4 pt-3 border-t border-zinc-800/50 flex justify-between text-[10px] text-zinc-500 font-mono tracking-widest">
                <span>
                  FROM:{' '}
                  {n.valid_from
                    ? new Date(n.valid_from).toISOString().replace('.000Z', 'Z')
                    : 'UNKNOWN'}
                </span>
                <span>
                  TO:{' '}
                  {n.is_permanent
                    ? 'PERM'
                    : n.valid_to
                      ? new Date(n.valid_to).toISOString().replace('.000Z', 'Z')
                      : 'UNKNOWN'}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white/[0.03] p-6 rounded-2xl border border-white/[0.05] text-center">
            <p className="text-zinc-500 italic">No active NOTAMs found.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
