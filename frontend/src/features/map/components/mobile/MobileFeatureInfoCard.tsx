import { useState, useEffect, memo } from 'react';
import './MobileFeatureInfoCard.css';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useMapStore } from '../../../../store/useMapStore';
import { useIsMobile } from '../../../../hooks/useIsMobile';

import { MobileWaypointDetailsPanel } from './MobileWaypointDetailsPanel';
import { MobileNavaidDetailsPanel } from './MobileNavaidDetailsPanel';
import { MobileRouteDetailsPanel } from './MobileRouteDetailsPanel';
import { AirspaceDetailsPanel } from '../AirspaceDetailsPanel';

export const MobileFeatureInfoCard = memo(function MobileFeatureInfoCard() {
  const selectedFeature = useMapStore((state) => state.selectedFeature);
  const viewMode = useMapStore((state) => state.viewMode);
  const navaidDetails = useMapStore((state) => state.navaidDetails);
  const isLoadingNavaid = useMapStore((state) => state.isLoadingNavaid);
  const routeDetails = useMapStore((state) => state.routeDetails);
  const isLoadingRoute = useMapStore((state) => state.isLoadingRoute);
  const [isPanelHidden, setIsPanelHidden] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const dragControls = useDragControls();

  useEffect(() => {
    setIsPanelHidden(false);
    setIsCollapsed(false);
  }, [selectedFeature]);

  const isMobile = useIsMobile();
  const type = selectedFeature?.type || '';
  const isVisible = viewMode === 'ENROUTE' && selectedFeature !== null && isMobile;

  const rawData = selectedFeature?.data || {};
  const data = rawData.properties || rawData;

  const isRoute = type === 'ATS_ROUTE';

  let title = 'Feature Details';
  if (type === 'AIRSPACE') {
    const rawName = data.name || data.identification || 'Airspace Details';
    title = rawName.split('|')[0].trim();
  } else {
    title =
      data.route_designator ||
      data.route_id ||
      data.station_name ||
      data.waypoint_name ||
      'Feature Details';
  }

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
          key="mobile-feature-info-card"
          data-testid="mobile-feature-info-card"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.1, bottom: 0.8 }}
          onDragEnd={(_e, info) => {
            if (info.offset.y > 60 || info.velocity.y > 300) {
              setIsCollapsed(true);
            } else if (info.offset.y < -60 || info.velocity.y < -300) {
              setIsCollapsed(false);
            }
          }}
          className={`aip-mobile-feature-card pointer-events-auto ${isRoute ? 'is-route' : ''} ${
            isCollapsed ? 'collapsed' : ''
          }`}
        >
          {/* Drag Zone containing Handle and Header */}
          <div
            className="aip-mobile-feature-drag-zone"
            onPointerDown={(e) => dragControls.start(e)}
            style={{ touchAction: 'none' }}
          >
            <div className="aip-mobile-feature-drag-handle" />
            <div className="aip-mobile-feature-header">
              <div className="aip-mobile-feature-badge-title">
                <div className="flex items-center gap-1">
                  <span
                    className={`aip-mobile-feature-badge ${
                      type === 'WAYPOINT' ? 'aip-mobile-feature-badge-waypoint' : ''
                    }`}
                  >
                    {type.replace('_', ' ')}
                  </span>
                  {routeTypeBadge}
                </div>
                <h3 className="aip-mobile-feature-title">{title}</h3>
              </div>
            </div>
          </div>

          {!isCollapsed && (
            <div className="aip-mobile-feature-body custom-scrollbar">
              {type === 'NAVAID' && (
                <MobileNavaidDetailsPanel
                  isLoadingNavaid={isLoadingNavaid}
                  navaidDetails={navaidDetails}
                  data={data}
                />
              )}
              {type === 'WAYPOINT' && <MobileWaypointDetailsPanel data={data} />}
              {type === 'AIRSPACE' && <AirspaceDetailsPanel data={data} />}
              {type === 'ATS_ROUTE' && (
                <MobileRouteDetailsPanel
                  isLoadingRoute={isLoadingRoute}
                  routeDetails={routeDetails}
                  data={data}
                />
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
});
