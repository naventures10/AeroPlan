import { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody, Divider } from '@heroui/react';
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
  const { selectedFeature, setSelectedFeature, viewMode, setSelectedRouteIds } = useMapStore();

  const isVisible = viewMode === 'ENROUTE' && selectedFeature !== null;
  const type = selectedFeature?.type || '';
  const rawData = selectedFeature?.data || {};
  // Normalize data: if it has a 'properties' key (like MVT features), use that.
  // Otherwise use it directly (like search results).
  const data = rawData.properties || rawData;

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
    const rawName = data.name || data.identification || 'Airspace Details';
    // Strip coordinate junk after pipe separator
    title = rawName.split('|')[0].trim();
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

  const routeTypeBadge =
    isRoute && routeDetails?.route_type ? (
      <span
        className={`aip-route-badge ${
          routeDetails.route_type === 'RNAV' ? 'aip-route-badge-rnav' : 'aip-route-badge-ats'
        }`}
      >
        {routeDetails.route_type}
      </span>
    ) : null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="feature-info-card"
          data-testid="feature-info-card"
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 50, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={`aip-feature-card-wrapper ${isRoute ? 'is-route' : ''}`}
        >
          <Card className="aip-feature-card">
            <CardHeader className="aip-feature-card-header">
              {type !== 'AIRSPACE' && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1">
                    <span
                      className={`aip-feature-card-type ${
                        type === 'WAYPOINT' ? 'aip-feature-card-type-waypoint' : ''
                      }`}
                    >
                      {type.replace('_', ' ')}
                    </span>
                    {routeTypeBadge}
                  </div>
                  <h3 className="aip-feature-card-title">{title}</h3>
                </div>
              )}
              <button
                type="button"
                data-testid="close-feature-card"
                onClick={() => {
                  setSelectedFeature(null);
                  setSelectedRouteIds([]);
                }}
                className="aip-feature-card-close p-2 hover:bg-slate-200 dark:hover:bg-white/5 rounded-full transition-colors ml-auto"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </CardHeader>
            {type !== 'AIRSPACE' && <Divider className="aip-feature-card-divider" />}
            <CardBody className="aip-feature-card-body custom-scrollbar">
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
