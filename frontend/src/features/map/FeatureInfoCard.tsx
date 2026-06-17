import { useState, useEffect, memo } from 'react';
import './FeatureInfoCard.css';

import { X, EyeOff, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMapStore } from '../../store/useMapStore';
import { useIsMobile } from '../../hooks/useIsMobile';

import { RouteDetailsPanel } from './components/RouteDetailsPanel';
import { NavaidDetailsPanel } from './components/NavaidDetailsPanel';
import { WaypointDetailsPanel } from './components/WaypointDetailsPanel';
import { AirspaceDetailsPanel } from './components/AirspaceDetailsPanel';

// fallow-ignore-next-line complexity
export const FeatureInfoCard = memo(function FeatureInfoCard() {
  const selectedFeature = useMapStore((state) => state.selectedFeature);
  const setSelectedFeature = useMapStore((state) => state.setSelectedFeature);
  const viewMode = useMapStore((state) => state.viewMode);
  const setSelectedRouteIds = useMapStore((state) => state.setSelectedRouteIds);
  const routeDetails = useMapStore((state) => state.routeDetails);
  const isLoadingRoute = useMapStore((state) => state.isLoadingRoute);
  const navaidDetails = useMapStore((state) => state.navaidDetails);
  const isLoadingNavaid = useMapStore((state) => state.isLoadingNavaid);
  const [isPanelHidden, setIsPanelHidden] = useState(false);

  useEffect(() => {
    setIsPanelHidden(false);
  }, [selectedFeature]);

  const isMobile = useIsMobile();
  const type = selectedFeature?.type || '';
  const isVisible =
    viewMode === 'ENROUTE' && selectedFeature !== null && (!isMobile || type === 'ATS_ROUTE');
  const rawData = selectedFeature?.data || {};
  // Normalize data: if it has a 'properties' key (like MVT features), use that.
  // Otherwise use it directly (like search results).
  const data = rawData.properties || rawData;

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
      {isVisible && !isPanelHidden && (
        <motion.div
          key="feature-info-card"
          data-testid="feature-info-card"
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 50, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={`aip-feature-card-wrapper ${isRoute ? 'is-route' : ''}`}
        >
          <div className="aip-feature-card flex flex-col relative w-full h-full rounded-xl overflow-hidden shadow-xl border border-outline-variant">
            <div
              className={
                type === 'AIRSPACE'
                  ? 'absolute top-1 right-1 z-10 !p-1 flex items-center gap-1'
                  : 'aip-feature-card-header flex p-4 pb-3'
              }
            >
              {type !== 'AIRSPACE' ? (
                <div className="flex flex-col gap-1.5 w-full">
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
              ) : null}

              <div
                className={
                  type === 'AIRSPACE'
                    ? 'flex items-center gap-1'
                    : 'flex items-center gap-1.5 ml-auto flex-shrink-0 self-start'
                }
              >
                <button
                  type="button"
                  onClick={() => setIsPanelHidden(true)}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant hover:text-primary cursor-pointer"
                  title="Hide details"
                  aria-label="Hide details"
                >
                  <EyeOff size={18} />
                </button>
                <button
                  type="button"
                  data-testid="close-feature-card"
                  onClick={() => {
                    setSelectedFeature(null);
                    setSelectedRouteIds([]);
                  }}
                  className="aip-feature-card-close p-2 hover:bg-surface-container-high rounded-full transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            {type !== 'AIRSPACE' && (
              <hr className="aip-feature-card-divider m-0 border-t border-outline-variant" />
            )}
            <div
              className={`aip-feature-card-body custom-scrollbar p-4 flex-1 overflow-y-auto ${
                type === 'AIRSPACE' ? '!pt-4 !px-5 !pb-5' : ''
              }`}
            >
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
            </div>
          </div>
        </motion.div>
      )}

      {isVisible && isPanelHidden && (
        <motion.div
          key="feature-info-card-hidden"
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 50, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="absolute top-6 right-6 z-50 pointer-events-auto flex items-center gap-1.5 p-1 bg-surface-container rounded-xl border border-outline-variant shadow-lg backdrop-blur-md"
        >
          <button
            onClick={() => setIsPanelHidden(false)}
            className="flex items-center gap-2 py-1.5 pl-3 pr-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-primary transition-all cursor-pointer"
          >
            <ChevronLeft size={14} className="text-teal-700 dark:text-cyan-400" />
            <span className="text-[9px] font-black tracking-[0.15em] uppercase">Show Details</span>
          </button>
          <div className="w-[1px] h-4 bg-outline-variant" />
          <button
            onClick={() => {
              setSelectedFeature(null);
              setSelectedRouteIds([]);
            }}
            className="p-1.5 hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
