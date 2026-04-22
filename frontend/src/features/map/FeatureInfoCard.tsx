import { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody, Button, Divider } from '@heroui/react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMapStore } from '../../store/useMapStore';
import { fetchAtsRouteDetails, fetchNavaidDetails } from '../../api/client';
import type { AtsRouteDetails, NavAidDetails } from '../../api/client';

import { RouteDetailsPanel } from './components/RouteDetailsPanel';
import { NavaidDetailsPanel } from './components/NavaidDetailsPanel';
import { WaypointDetailsPanel } from './components/WaypointDetailsPanel';
import { AirspaceDetailsPanel } from './components/AirspaceDetailsPanel';

export function FeatureInfoCard() {
  const { selectedFeature, setSelectedFeature, viewMode, setHighlightedAirspaceId } = useMapStore();

  const isVisible = viewMode === 'ENROUTE' && selectedFeature !== null;
  const type = selectedFeature?.type || '';
  const data = selectedFeature?.data || {};

  // Route details state — fetched on demand when an ATS_ROUTE is selected
  const [routeDetails, setRouteDetails] = useState<AtsRouteDetails | null>(null);
  const [navaidDetails, setNavaidDetails] = useState<NavAidDetails | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isLoadingNavaid, setIsLoadingNavaid] = useState(false);

  // Fetch full route details when an ATS_ROUTE is selected
  useEffect(() => {
    if (type !== 'ATS_ROUTE' || !data.route_id) {
      setRouteDetails(null);
      setIsLoadingRoute(false);
      return;
    }

    let cancelled = false;
    setIsLoadingRoute(true);

    fetchAtsRouteDetails(data.route_id)
      .then((details) => {
        if (!cancelled) {
          setRouteDetails(details);
          setIsLoadingRoute(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoadingRoute(false);
      });

    return () => {
      cancelled = true;
    };
  }, [type, data.route_id]);

  // Fetch full Navaid details when a NAVAID is selected
  useEffect(() => {
    const ident = data.ident || data.id;
    if (type !== 'NAVAID' || !ident) {
      setNavaidDetails(null);
      setIsLoadingNavaid(false);
      return;
    }

    let cancelled = false;
    setIsLoadingNavaid(true);

    fetchNavaidDetails(ident)
      .then((details) => {
        if (!cancelled) {
          setNavaidDetails(details);
          setIsLoadingNavaid(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoadingNavaid(false);
      });

    return () => {
      cancelled = true;
    };
  }, [type, data.ident, data.id]);

  let title = 'Feature Details';
  if (type === 'AIRSPACE') {
    const p = data.properties || {};
    title = p.name || p.identification || 'Airspace Details';
  } else {
    title =
      data.route_designator ||
      data.route_id ||
      data.station_name ||
      data.waypoint_name ||
      'Feature Details';
  }

  // Use wider card for ATS routes to fit the table
  const isRoute = type === 'ATS_ROUTE';
  const cardWidth = isRoute ? 'w-[560px] max-w-[92vw]' : 'w-72';
  const cardPosition = 'top-6 right-6';

  const routeTypeBadge =
    isRoute && routeDetails?.route_type ? (
      <span
        className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider ${
          routeDetails.route_type === 'RNAV'
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
        }`}
      >
        {routeDetails.route_type}
      </span>
    ) : null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 50, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={`absolute ${cardPosition} z-50 ${cardWidth}`}
        >
          <Card className="bg-black/60 backdrop-blur-2xl backdrop-saturate-200 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)] max-h-[calc(100vh-180px)] flex flex-col">
            <CardHeader className="flex justify-between items-center pb-1.5 pt-3 px-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-primary-500 font-bold tracking-widest uppercase mb-0.5">
                    {type.replace('_', ' ')}
                  </span>
                  {routeTypeBadge}
                </div>
                <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onClick={() => {
                  setSelectedFeature(null);
                  if (type === 'AIRSPACE') {
                    setHighlightedAirspaceId(null);
                  }
                }}
                className="text-default-400 hover:text-white"
              >
                <X size={18} />
              </Button>
            </CardHeader>
            <Divider className="bg-white/10 mx-3 w-auto" />
            <CardBody className="px-3 py-2.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {type === 'ATS_ROUTE' && (
                <RouteDetailsPanel
                  isLoadingRoute={isLoadingRoute}
                  routeDetails={routeDetails}
                  data={data}
                />
              )}
              {type === 'NAVAID' && (
                <NavaidDetailsPanel
                  isLoadingNavaid={isLoadingNavaid}
                  navaidDetails={navaidDetails}
                  data={data}
                />
              )}
              {type === 'WAYPOINT' && <WaypointDetailsPanel data={data} />}
              {type === 'AIRSPACE' && <AirspaceDetailsPanel data={data} />}
            </CardBody>
          </Card>

          {/* Table + Scrollbar styling */}
          <style
            dangerouslySetInnerHTML={{
              __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
          height: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .route-th {
          padding: 4px 8px;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(161, 161, 170, 0.8);
          white-space: nowrap;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .route-td {
          padding: 4px 8px;
          white-space: nowrap;
          vertical-align: middle;
        }
      `,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
