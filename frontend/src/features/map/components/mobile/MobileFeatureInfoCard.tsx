import { useState, useEffect, memo } from 'react';
import './MobileFeatureInfoCard.css';
import { motion, AnimatePresence } from 'framer-motion';
import { useMapStore } from '../../../../store/useMapStore';
import { useIsMobile } from '../../../../hooks/useIsMobile';

import { MobileWaypointDetailsPanel } from './MobileWaypointDetailsPanel';
import { MobileNavaidDetailsPanel } from './MobileNavaidDetailsPanel';
import { AirspaceDetailsPanel } from '../AirspaceDetailsPanel';

export const MobileFeatureInfoCard = memo(function MobileFeatureInfoCard() {
  const selectedFeature = useMapStore((state) => state.selectedFeature);
  const viewMode = useMapStore((state) => state.viewMode);
  const navaidDetails = useMapStore((state) => state.navaidDetails);
  const isLoadingNavaid = useMapStore((state) => state.isLoadingNavaid);
  const [isPanelHidden, setIsPanelHidden] = useState(false);

  useEffect(() => {
    setIsPanelHidden(false);
  }, [selectedFeature]);

  const isMobile = useIsMobile();
  const type = selectedFeature?.type || '';
  const isVisible =
    viewMode === 'ENROUTE' && selectedFeature !== null && isMobile && type !== 'ATS_ROUTE';

  const rawData = selectedFeature?.data || {};
  const data = rawData.properties || rawData;

  let title = 'Feature Details';
  if (type === 'AIRSPACE') {
    const rawName = data.name || data.identification || 'Airspace Details';
    title = rawName.split('|')[0].trim();
  } else {
    title = data.station_name || data.waypoint_name || 'Feature Details';
  }

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
          className="aip-mobile-feature-card pointer-events-auto"
        >
          <div className="aip-mobile-feature-header">
            <div className="aip-mobile-feature-badge-title">
              <span
                className={`aip-mobile-feature-badge ${
                  type === 'WAYPOINT' ? 'aip-mobile-feature-badge-waypoint' : ''
                }`}
              >
                {type.replace('_', ' ')}
              </span>
              <h3 className="aip-mobile-feature-title">{title}</h3>
            </div>
          </div>

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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
