import { motion } from 'framer-motion';
import { AlertTriangle, Info } from 'lucide-react';
import type { NotamData } from '../../../../types';
import { sanitizeNotamDescription } from '../../../../utils/sanitize';

interface MobileNotamWidgetProps {
  notams: NotamData[];
}

export function MobileNotamWidget({ notams }: MobileNotamWidgetProps) {
  return (
    <motion.div
      key="mobile-notam"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-3"
    >
      <h3 className="text-base font-black text-on-surface tracking-wider mb-2 flex items-center gap-1.5">
        <AlertTriangle className="text-amber-500" size={18} /> Active NOTAMs
        <span className="bg-surface-container-high text-[10px] px-2.5 py-0.5 rounded-full ml-auto">
          {notams.length} Total
        </span>
      </h3>
      <div className="flex flex-col gap-3 max-h-[45vh] overflow-y-auto pb-4 aip-scrollbar pr-1">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-2.5 text-xs text-on-surface-variant">
          <Info className="text-amber-500 shrink-0 mt-0.5" size={16} />
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider text-[10px]">
              Notice
            </span>
            <span className="leading-normal">
              Compiled from current NOTAM summary. For new releases, check Preflight Information
              Bulletin (PIB).
            </span>
          </div>
        </div>

        {notams.length > 0 ? (
          notams.map((n) => (
            <div
              key={n.notam_id}
              className="bg-surface p-4 rounded-2xl border border-outline-variant hover:border-outline transition"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-amber-600 dark:text-amber-400 font-bold tracking-wider text-xs flex items-center gap-1.5">
                  {n.notam_id}
                  {n.scope && (
                    <span className="text-[8px] bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1 py-0.2 rounded font-semibold">
                      {n.scope}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1.5">
                  {n.is_estimated && (
                    <span className="text-[9px] text-slate-500 font-mono">EST</span>
                  )}
                  <span className="text-[9px] text-on-surface-variant font-mono tracking-wider">
                    SERIES {n.series}
                  </span>
                </div>
              </div>
              <p className="text-on-surface-variant text-xs whitespace-pre-wrap leading-normal font-mono break-words bg-surface-container/30 p-2.5 rounded-lg border border-outline-variant/30">
                {sanitizeNotamDescription(n.description)}
              </p>
              <div className="mt-3 pt-2.5 border-t border-outline-variant flex flex-col gap-0.5 text-[9px] text-on-surface-variant font-mono tracking-wider">
                <div>
                  FROM:{' '}
                  <span className="text-on-surface">
                    {n.valid_from
                      ? new Date(n.valid_from).toISOString().replace('.000Z', 'Z')
                      : 'UNKNOWN'}
                  </span>
                </div>
                <div>
                  TO:{' '}
                  <span className="text-on-surface">
                    {n.is_permanent
                      ? 'PERM'
                      : n.valid_to
                        ? new Date(n.valid_to).toISOString().replace('.000Z', 'Z')
                        : 'UNKNOWN'}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-surface-container p-4 rounded-2xl border border-outline-variant text-center">
            <p className="text-on-surface-variant italic text-xs">No active NOTAMs found.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
