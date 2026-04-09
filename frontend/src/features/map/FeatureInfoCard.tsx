import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody, Button, Divider, Spinner } from '@heroui/react';
import { X, ChevronDown, ChevronUp, Plane, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMapStore } from '../../store/useMapStore';
import { fetchAtsRouteDetails } from '../../api/client';
import type { AtsRouteDetails } from '../../api/client';

export function FeatureInfoCard() {
  const { selectedFeature, setSelectedFeature, viewMode } = useMapStore();

  const isVisible = viewMode === 'ENROUTE' && selectedFeature !== null;
  const type = selectedFeature?.type || '';
  const data = selectedFeature?.data || {};

  // Route details state — fetched on demand when an ATS_ROUTE is selected
  const [routeDetails, setRouteDetails] = useState<AtsRouteDetails | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [showRemarks, setShowRemarks] = useState(false);

  // Fetch full route details when an ATS_ROUTE is selected
  useEffect(() => {
    if (type !== 'ATS_ROUTE' || !data.route_id) {
      setRouteDetails(null);
      setIsLoadingRoute(false);
      return;
    }

    let cancelled = false;
    setIsLoadingRoute(true);
    setShowRemarks(false);

    fetchAtsRouteDetails(data.route_id).then((details) => {
      if (!cancelled) {
        setRouteDetails(details);
        setIsLoadingRoute(false);
      }
    }).catch(() => {
      if (!cancelled) setIsLoadingRoute(false);
    });

    return () => { cancelled = true; };
  }, [type, data.route_id]);

  // ── Shared label-value component ──
  const LabelVal = ({ label, val }: { label: string; val: React.ReactNode }) => {
    if (!val || val === 'None' || val === '{}') return null;
    return (
      <div className="flex flex-col mb-2">
        <span className="text-[10px] font-bold text-default-400 tracking-wider uppercase">
          {label}
        </span>
        <span className="text-xs font-medium text-white">{val}</span>
      </div>
    );
  };

  // ── ATS Route: Segment Table Design ──
  const renderRouteDetails = () => {
    if (isLoadingRoute) {
      return (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Spinner size="md" color="primary" />
          <span className="text-[11px] text-zinc-500 tracking-wider uppercase">Loading route segments…</span>
        </div>
      );
    }

    if (!routeDetails) {
      // Fallback to single-segment display if API failed
      return renderSingleSegmentFallback();
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
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
            <Plane size={12} className="text-cyan-400" />
            <span className="text-[11px] font-semibold text-zinc-300 tracking-wide">
              {total_distance_nm} NM
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
            <ArrowUpDown size={12} className="text-cyan-400" />
            <span className="text-[11px] font-semibold text-zinc-300 tracking-wide">
              {waypoints.length} FIXES
            </span>
          </div>
          {firstSeg?.lateral_limits && (
            <div className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
              <span className="text-[11px] font-semibold text-zinc-300 tracking-wide">
                {firstSeg.lateral_limits} WIDE
              </span>
            </div>
          )}
        </div>

        {/* ── Direction of Cruising Levels ── */}
        {(dirOdd || dirEven) && (
          <div className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2.5">
            <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase block mb-1.5">
              Direction of Cruising Levels
            </span>
            <div className="flex gap-4">
              {dirOdd && (
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{dirOdd}</span>
                  <span className="text-[11px] font-medium text-zinc-300">ODD FLs</span>
                </div>
              )}
              {dirEven && (
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{dirEven}</span>
                  <span className="text-[11px] font-medium text-zinc-300">EVEN FLs</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Segment Table ── */}
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-white/[0.06]">
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
                    <React.Fragment key={seg.sequence_number}>
                      {/* ── Waypoint Row (FROM) ── */}
                      <tr className={`border-t border-white/[0.06] ${idx % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                        <td className="route-td font-semibold text-white">
                          <div className="flex flex-col">
                            <span className="text-[11px] leading-tight">{wp?.waypoint_name || seg.from_waypoint}</span>
                            {wp?.navaid_info && (
                              <span className="text-[9px] text-cyan-400/80 font-normal">{wp.navaid_info}</span>
                            )}
                          </div>
                        </td>
                        <td className="route-td font-mono text-[10px] text-zinc-400">
                          {wp?.raw_coordinates || seg.from_coordinates || '—'}
                        </td>
                        <td className="route-td text-zinc-300 text-[11px] font-mono">
                          {seg.track_magnetic || '—'}
                        </td>
                        <td className="route-td text-right text-zinc-300 text-[11px] font-mono">
                          {seg.distance_nm ? `${seg.distance_nm}` : '—'}
                        </td>
                        <td className="route-td">
                          <div className="flex flex-col text-[10px]">
                            <span className="text-zinc-300">{seg.upper_limit || '—'}</span>
                            <span className="text-zinc-500">{seg.lower_limit || '—'}</span>
                          </div>
                        </td>
                        <td className="route-td text-center">
                          {seg.airspace_class ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold bg-white/10 text-cyan-300 border border-white/10">
                              {seg.airspace_class}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="route-td text-right text-[10px] text-zinc-400">
                          {seg.moca || '—'}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
                {/* ── Last Waypoint Row (terminal fix) ── */}
                {lastWaypoint && (
                  <tr className="border-t border-white/[0.06] bg-white/[0.02]">
                    <td className="route-td font-semibold text-white">
                      <div className="flex flex-col">
                        <span className="text-[11px] leading-tight">{lastWaypoint.waypoint_name}</span>
                        {lastWaypoint.navaid_info && (
                          <span className="text-[9px] text-cyan-400/80 font-normal">{lastWaypoint.navaid_info}</span>
                        )}
                      </div>
                    </td>
                    <td className="route-td font-mono text-[10px] text-zinc-400">
                      {lastWaypoint.raw_coordinates || '—'}
                    </td>
                    <td className="route-td text-zinc-500 text-[11px]" colSpan={5}>
                      <span className="text-[10px] italic text-zinc-600">Terminal Fix</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Remarks (Collapsible) ── */}
        {remarks && (
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => setShowRemarks(!showRemarks)}
              className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            >
              <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Remarks</span>
              {showRemarks ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
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
                    <p className="text-[11px] text-zinc-400 leading-relaxed whitespace-pre-line">{remarks}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  };

  // ── Fallback for when the API call fails ──
  const renderSingleSegmentFallback = () => (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <LabelVal label="Route Type" val={data.route_type} />
      <LabelVal
        label="Direction"
        val={data.direction_odd && data.direction_even ? 'Two-Way' : data.direction_odd ? `ODD ${data.direction_odd}` : data.direction_even ? `EVEN ${data.direction_even}` : null}
      />
      <LabelVal label="Magnetic Track" val={data.track_magnetic ? `${data.track_magnetic}°` : null} />
      <LabelVal label="Distance" val={data.distance_nm ? `${data.distance_nm} NM` : null} />
      <LabelVal label="MOCA" val={data.moca} />
      <LabelVal
        label="Flight Level"
        val={
          (data.lower_limit && data.upper_limit)
            ? `${data.lower_limit} - ${data.upper_limit}`
            : null
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

  const renderNavaidDetails = () => (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <LabelVal label="Identifier" val={data.ident} />
      <LabelVal label="Type" val={data.aid_type} />
      <LabelVal label="Frequency" val={data.frequency} />
      <LabelVal label="Elevation" val={data.elevation} />
      <div className="col-span-2">
        <LabelVal label="Coordinates" val={data.raw_coordinates} />
      </div>
      <div className="col-span-2">
        <LabelVal label="Operating Hours" val={data.hours_of_operation} />
      </div>
      <div className="col-span-2">
        <LabelVal label="Remarks" val={data.remarks} />
      </div>
    </div>
  );

  const renderWaypointDetails = () => (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <div className="col-span-2">
        <LabelVal label="Coordinates" val={data.raw_coordinates} />
      </div>
      <div className="col-span-2">
        <LabelVal label="Intersecting Routes" val={data.route_ids ? String(data.route_ids).replace(/[{"'}]/g, '') : data.routes ? String(data.routes).replace(/[{"'}]/g, '') : null} />
      </div>
      <div className="col-span-2">
        <LabelVal label="Remarks" val={data.remarks} />
      </div>
    </div>
  );

  // Dynamic titles based on standard properties
  const title = data.route_designator || data.route_id || data.station_name || data.waypoint_name || 'Feature Details';

  // Use wider card for ATS routes to fit the table
  const isRoute = type === 'ATS_ROUTE';
  const cardWidth = isRoute ? 'w-[680px] max-w-[92vw]' : 'w-80';
  const cardPosition = isRoute ? 'bottom-6 left-1/2 -translate-x-1/2' : 'bottom-6 left-24';

  const routeTypeBadge = isRoute && routeDetails?.route_type ? (
    <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider ${
      routeDetails.route_type === 'RNAV'
        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
        : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
    }`}>
      {routeDetails.route_type}
    </span>
  ) : null;
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={`absolute ${cardPosition} z-50 ${cardWidth}`}
        >
          <Card className="bg-black/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
        <CardHeader className="flex justify-between items-center pb-2 pt-4 px-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-primary-500 font-bold tracking-widest uppercase mb-1">
                {type.replace('_', ' ')}
              </span>
              {routeTypeBadge}
            </div>
            <h3 className="text-base font-bold text-white tracking-wide">
              {title}
            </h3>
          </div>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onClick={() => { setSelectedFeature(null); }}
            className="text-default-400 hover:text-white"
          >
            <X size={18} />
          </Button>
        </CardHeader>
        <Divider className="bg-white/10 mx-4 w-auto" />
        <CardBody className="px-4 py-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {type === 'ATS_ROUTE' && renderRouteDetails()}
          {type === 'NAVAID' && renderNavaidDetails()}
          {type === 'WAYPOINT' && renderWaypointDetails()}
          
        </CardBody>
      </Card>
      
      {/* Table + Scrollbar styling */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
        }
        .route-th {
          padding: 6px 10px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(161, 161, 170, 0.8);
          white-space: nowrap;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .route-td {
          padding: 6px 10px;
          white-space: nowrap;
          vertical-align: middle;
        }
      `}} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
