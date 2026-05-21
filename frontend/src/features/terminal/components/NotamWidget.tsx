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
      <h3 className="text-xl font-black text-on-surface tracking-widest mb-4 flex items-center gap-2">
        <AlertTriangle className="text-amber-500" /> Active NOTAMs
        <span className="bg-surface-container-high text-xs px-3 py-1 rounded-full ml-auto">
          {notams.length} Total
        </span>
      </h3>
      <div className="flex flex-col gap-4 overflow-y-auto pb-6 custom-scrollbar pr-2">
        {notams.length > 0 ? (
          notams.map((n) => (
            <div
              key={n.notam_id}
              className="bg-surface ] p-5 rounded-2xl border border-outline-variant ] hover:border-outline dark:hover:border-white/10 transition"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-amber-600 dark:text-amber-400 font-bold tracking-widest text-sm flex items-center gap-2">
                  {n.notam_id}
                  {n.scope && (
                    <span className="text-[9px] bg-amber-100 text-amber-700 dark:text-amber-500 px-1.5 py-0.5 rounded">
                      {n.scope}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {n.is_estimated && (
                    <span className="text-[10px] text-slate-500 font-mono">EST</span>
                  )}
                  <span className="text-xs text-on-surface-variant font-mono tracking-widest">
                    SERIES {n.series}
                  </span>
                </div>
              </div>
              <p className="text-on-surface-variant text-sm whitespace-pre-wrap leading-relaxed">
                {n.description}
              </p>
              <div className="mt-4 pt-3 border-t border-outline-variant flex justify-between text-[10px] text-on-surface-variant font-mono tracking-widest">
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
          <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant ] ] text-center">
            <p className="text-on-surface-variant italic">No active NOTAMs found.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
