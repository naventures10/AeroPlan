import { useState, useRef, useEffect } from 'react';
import { Plane, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import type { AtsRouteDetails } from '../../../../api/client';
import { LabelVal } from '../SharedLabel';
import { CollapsibleRemarks } from '../CollapsibleRemarks';

export function MobileRouteDetailsPanel({
  isLoadingRoute,
  routeDetails,
  data,
}: {
  isLoadingRoute: boolean;
  routeDetails: AtsRouteDetails | null;
  data: any;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showRemarks, setShowRemarks] = useState(false);
  const remarksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showRemarks && remarksRef.current) {
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
      <div className="flex flex-col items-center justify-center py-6 gap-2">
        <div className="w-6 h-6 border-2 border-outline-variant border-t-teal-500 dark:border-t-cyan-400 rounded-full animate-spin" />
        <span className="text-[10px] text-on-surface-variant tracking-wider uppercase">
          Loading route segments…
        </span>
      </div>
    );
  }

  if (!routeDetails) {
    return <MobileRouteFallback data={data} />;
  }

  const { segments, waypoints, total_distance_nm, remarks } = routeDetails;
  const lastWaypoint = waypoints[waypoints.length - 1];

  const firstSeg = segments[0];
  const dirOdd = firstSeg?.direction_odd;
  const dirEven = firstSeg?.direction_even;

  const toggleExpand = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ── Route Summary Strip ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-outline-variant">
          <Plane size={10} className="text-teal-700 dark:text-cyan-400" />
          <span className="text-[10px] font-semibold text-on-surface-variant">
            {total_distance_nm} NM
          </span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-outline-variant">
          <ArrowUpDown size={10} className="text-teal-700 dark:text-cyan-400" />
          <span className="text-[10px] font-semibold text-on-surface-variant">
            {waypoints.length} FIXES
          </span>
        </div>
        {firstSeg?.lateral_limits && (
          <div className="px-2 py-0.5 rounded-md border border-outline-variant">
            <span className="text-[10px] font-semibold text-on-surface-variant">
              {firstSeg.lateral_limits} WIDE
            </span>
          </div>
        )}
      </div>

      {/* ── Direction of Cruising Levels ── */}
      {(dirOdd || dirEven) && (
        <div className="rounded-lg border border-outline-variant px-2.5 py-1.5 bg-surface-container/30">
          <span className="text-[9px] font-bold text-on-surface-variant tracking-wider uppercase block mb-1">
            Cruising Levels
          </span>
          <div className="flex gap-4">
            {dirOdd && (
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-on-surface">{dirOdd}</span>
                <span className="text-[9px] text-on-surface-variant">ODD FLs</span>
              </div>
            )}
            {dirEven && (
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-on-surface">{dirEven}</span>
                <span className="text-[9px] text-on-surface-variant">EVEN FLs</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Segments Timeline / Cards ── */}
      <div className="flex flex-col gap-1.5">
        {segments.map((seg, idx) => {
          const wp = waypoints[idx];
          const isExpanded = expandedIndex === idx;
          return (
            <div
              key={seg.sequence_number || idx}
              className={`rounded-lg border border-outline-variant overflow-hidden transition-colors ${
                isExpanded ? 'bg-surface-container-high/40' : 'bg-surface-container-low/20'
              }`}
            >
              {/* Header */}
              <div
                onClick={() => toggleExpand(idx)}
                className="flex items-center justify-between p-2.5 cursor-pointer select-none active:bg-surface-container-high/60"
              >
                <div className="flex items-center gap-2">
                  {/* Timeline Dot / Indicator */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-teal-500 dark:bg-cyan-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-on-surface">
                      {wp?.waypoint_name || seg.from_waypoint}
                    </span>
                    {wp?.navaid_info && (
                      <span className="text-[9px] text-teal-700 dark:text-cyan-400/80">
                        {wp.navaid_info}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[9px] text-on-surface-variant font-mono">
                      {seg.track_magnetic ? `${seg.track_magnetic}°` : '—'}
                    </div>
                    <div className="text-[9px] text-on-surface-variant font-mono">
                      {seg.distance_nm ? `${seg.distance_nm} NM` : '—'}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={14} className="text-on-surface-variant" />
                  ) : (
                    <ChevronDown size={14} className="text-on-surface-variant" />
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-outline-variant bg-surface-container-lowest/30 grid grid-cols-2 gap-2 text-[10px]">
                  <LabelVal label="Coordinates" val={wp?.raw_coordinates || seg.from_coordinates} />
                  <LabelVal label="MOCA" val={seg.moca} />
                  <LabelVal
                    label="Vertical Limits"
                    val={
                      seg.upper_limit && seg.lower_limit
                        ? `${seg.lower_limit} - ${seg.upper_limit}`
                        : seg.lower_limit || seg.upper_limit || null
                    }
                  />
                  <LabelVal label="Airspace Class" val={seg.airspace_class} />
                </div>
              )}
            </div>
          );
        })}

        {/* ── Last Waypoint (Destination/COP) ── */}
        {lastWaypoint && (
          <div className="rounded-lg border border-outline-variant bg-surface-container-low/10 overflow-hidden">
            <div className="flex items-center justify-between p-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full border border-teal-500 dark:border-cyan-400 bg-transparent" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-on-surface">
                    {lastWaypoint.waypoint_name}
                  </span>
                  {lastWaypoint.navaid_info && (
                    <span className="text-[9px] text-teal-700 dark:text-cyan-400/80">
                      {lastWaypoint.navaid_info}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[9px] italic text-on-surface-variant">COP / Terminal Fix</span>
            </div>
          </div>
        )}
      </div>

      <CollapsibleRemarks
        remarks={remarks}
        isOpen={showRemarks}
        onToggle={setShowRemarks}
        ref={remarksRef}
      />
    </div>
  );
}

function MobileRouteFallback({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
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
