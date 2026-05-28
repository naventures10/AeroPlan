import { useState, useEffect, useRef } from 'react';

import { Plane, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AtsRouteDetails } from '../../../api/client';
import { LabelVal } from './SharedLabel';

export function RouteDetailsPanel({
  isLoadingRoute,
  routeDetails,
  data,
}: {
  isLoadingRoute: boolean;
  routeDetails: AtsRouteDetails | null;
  data: any;
}) {
  const [showRemarks, setShowRemarks] = useState(false);
  const remarksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showRemarks && remarksRef.current) {
      // Small delay to ensure the spacer is rendered and layout has updated
      const timer = setTimeout(() => {
        remarksRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showRemarks]);

  if (isLoadingRoute) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="w-8 h-8 border-2 border-outline-variant border-t-teal-500 dark:border-t-cyan-400 rounded-full animate-spin" />
        <span className="text-[11px] text-on-surface-variant tracking-wider uppercase">
          Loading route segments…
        </span>
      </div>
    );
  }

  if (!routeDetails) {
    // Fallback to single-segment display if API failed
    return <RouteFallback data={data} />;
  }

  const { segments, waypoints, total_distance_nm, remarks } = routeDetails;
  const lastWaypoint = waypoints[waypoints.length - 1];

  // Determine direction cruising levels from first segment
  const firstSeg = segments[0];
  const dirOdd = firstSeg?.direction_odd;
  const dirEven = firstSeg?.direction_even;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Route Summary Strip ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-outline-variant">
          <Plane size={12} className="text-teal-700 dark:text-cyan-400" />
          <span className="text-[11px] font-semibold text-on-surface-variant tracking-wide">
            {total_distance_nm} NM
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-outline-variant">
          <ArrowUpDown size={12} className="text-teal-700 dark:text-cyan-400" />
          <span className="text-[11px] font-semibold text-on-surface-variant tracking-wide">
            {waypoints.length} FIXES
          </span>
        </div>
        {firstSeg?.lateral_limits && (
          <div className="px-2.5 py-1 rounded-md border border-outline-variant">
            <span className="text-[11px] font-semibold text-on-surface-variant tracking-wide">
              {firstSeg.lateral_limits} WIDE
            </span>
          </div>
        )}
      </div>

      {/* ── Direction of Cruising Levels ── */}
      {(dirOdd || dirEven) && (
        <div className="rounded-lg border border-outline-variant px-3 py-2.5">
          <span className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase block mb-1.5">
            Direction of Cruising Levels
          </span>
          <div className="flex gap-4">
            {dirOdd && (
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-on-surface leading-none">{dirOdd}</span>
                <span className="text-[10px] font-medium text-on-surface-variant tracking-wide">
                  ODD FLs
                </span>
              </div>
            )}
            {dirEven && (
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-on-surface leading-none">{dirEven}</span>
                <span className="text-[10px] font-medium text-on-surface-variant tracking-wide">
                  EVEN FLs
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Segment Table ── */}
      <div className="rounded-lg border border-outline-variant overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="">
                <th className="route-th">Fix</th>
                <th className="route-th">Coordinates</th>
                <th className="route-th">Track</th>
                <th className="route-th text-right">Distance</th>
                <th className="route-th">Limits</th>
                <th className="route-th text-center">Class</th>
                <th className="route-th text-right">MOCA</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((seg, idx) => {
                const wp = waypoints[idx];
                return (
                  <tr
                    key={seg.sequence_number}
                    className={`border-t border-outline-variant ${idx % 2 === 0 ? '' : ''}`}
                  >
                    <td className="route-td font-semibold text-on-surface">
                      <div className="flex flex-col">
                        <span className="text-[11px] leading-tight">
                          {wp?.waypoint_name || seg.from_waypoint}
                        </span>
                        {wp?.navaid_info && (
                          <span className="text-[9px] text-teal-700 dark:text-cyan-400/80 font-normal">
                            {wp.navaid_info}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="route-td font-mono text-[10px] text-on-surface-variant">
                      {wp?.raw_coordinates || seg.from_coordinates || '—'}
                    </td>
                    <td className="route-td text-on-surface-variant text-[11px] font-mono">
                      {seg.track_magnetic || '—'}
                    </td>
                    <td className="route-td text-right text-on-surface-variant text-[11px] font-mono">
                      {seg.distance_nm ? `${seg.distance_nm}` : '—'}
                    </td>
                    <td className="route-td">
                      <div className="flex flex-col text-[10px]">
                        <span className="text-on-surface-variant">{seg.upper_limit || '—'}</span>
                        <span className="text-on-surface-variant">{seg.lower_limit || '—'}</span>
                      </div>
                    </td>
                    <td className="route-td text-center">
                      {seg.airspace_class ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan">
                          {seg.airspace_class}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="route-td text-right text-[10px] text-on-surface-variant">
                      {seg.moca || '—'}
                    </td>
                  </tr>
                );
              })}
              {/* ── Last Waypoint Row (COP/Terminal fix) ── */}
              {lastWaypoint && (
                <tr className="border-t border-outline-variant">
                  <td className="route-td font-semibold text-on-surface">
                    <div className="flex flex-col">
                      <span className="text-[11px] leading-tight">
                        {lastWaypoint.waypoint_name}
                      </span>
                      {lastWaypoint.navaid_info && (
                        <span className="text-[9px] text-teal-700 dark:text-cyan-400/80 font-normal">
                          {lastWaypoint.navaid_info}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="route-td font-mono text-[10px] text-on-surface-variant">
                    {lastWaypoint.raw_coordinates || '—'}
                  </td>
                  <td className="route-td text-on-surface-variant text-[11px]">
                    <span className="text-[10px] italic text-on-surface-variant">
                      COP / Terminal Fix
                    </span>
                  </td>
                  <td className="route-td"></td>
                  <td className="route-td"></td>
                  <td className="route-td"></td>
                  <td className="route-td"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Remarks (Collapsible) ── */}
      {remarks && (
        <div ref={remarksRef} className="rounded-lg border border-outline-variant overflow-hidden">
          <button
            onClick={() => setShowRemarks(!showRemarks)}
            className="w-full flex items-center justify-between px-3 py-2 hover: transition-colors"
          >
            <span className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase">
              Remarks
            </span>
            {showRemarks ? (
              <ChevronUp size={14} className="text-on-surface-variant" />
            ) : (
              <ChevronDown size={14} className="text-on-surface-variant" />
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
                <div className="px-3 py-2 border-t border-outline-variant">
                  <p className="text-[11px] text-on-surface-variant leading-relaxed whitespace-pre-line">
                    {remarks}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {/* ── Spacer for Remarks (Allows pushing table up) ── */}
      {showRemarks && <div className="h-[40vh]" />}
    </div>
  );
}

function RouteFallback({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <LabelVal label="Route Type" val={data.route_type} />
      <LabelVal
        label="Direction"
        val={
          data.direction_odd && data.direction_even
            ? 'Two-Way'
            : data.direction_odd
              ? `ODD ${data.direction_odd}`
              : data.direction_even
                ? `EVEN ${data.direction_even}`
                : null
        }
      />
      <LabelVal
        label="Magnetic Track"
        val={data.track_magnetic ? `${data.track_magnetic}°` : null}
      />
      <LabelVal label="Distance" val={data.distance_nm ? `${data.distance_nm} NM` : null} />
      <LabelVal label="MOCA" val={data.moca} />
      <LabelVal
        label="Flight Level"
        val={
          data.lower_limit && data.upper_limit ? `${data.lower_limit} - ${data.upper_limit}` : null
        }
      />
      <div className="col-span-2">
        <LabelVal label="Lateral Limits" val={data.lateral_limits} />
      </div>
      <div className="col-span-2">
        <LabelVal label="Remarks" val={data.remarks} />
      </div>
    </div>
  );
}
