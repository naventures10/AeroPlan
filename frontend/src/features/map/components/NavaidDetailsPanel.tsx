import { useState } from 'react';
import { Spinner } from '@heroui/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { NavAidDetails } from '../../../api/client';
import { LabelVal } from './SharedLabel';

export function NavaidDetailsPanel({
  isLoadingNavaid,
  navaidDetails,
  data,
}: {
  isLoadingNavaid: boolean;
  navaidDetails: NavAidDetails | null;
  data: any;
}) {
  const [showRemarks, setShowRemarks] = useState(false);

  const displayData = navaidDetails || data;
  const remarks = displayData.remarks;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <LabelVal label="Identifier" val={displayData.ident} />
        <LabelVal label="Type" val={displayData.aid_type} />
        <LabelVal label="Frequency" val={displayData.frequency} />
        <LabelVal label="Elevation" val={displayData.elevation} />
        <div className="col-span-2">
          <LabelVal label="Coordinates" val={displayData.raw_coordinates} />
        </div>
        <div className="col-span-2">
          <LabelVal label="Operating Hours" val={displayData.hours_of_operation} />
        </div>
      </div>

      {/* ── Remarks (Collapsible) ── */}
      {remarks && (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <button
            onClick={() => setShowRemarks(!showRemarks)}
            className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
          >
            <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">
              Remarks
            </span>
            {showRemarks ? (
              <ChevronUp size={14} className="text-zinc-500" />
            ) : (
              <ChevronDown size={14} className="text-zinc-500" />
            )}
          </button>
          <AnimatePresence>
            {showRemarks && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-3 py-2 border-t border-white/[0.06]">
                  <p className="text-[11px] text-zinc-400 leading-relaxed whitespace-pre-line">
                    {remarks}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {isLoadingNavaid && !navaidDetails && (
        <div className="flex justify-center py-2">
          <Spinner size="sm" color="primary" />
        </div>
      )}
    </div>
  );
}
