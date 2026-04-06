import React from 'react';
import { Card, CardHeader, CardBody, Button, Divider } from '@heroui/react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMapStore } from '../../store/useMapStore';

export function FeatureInfoCard() {
  const { selectedFeature, setSelectedFeature, viewMode } = useMapStore();

  const isVisible = viewMode === 'ENROUTE' && selectedFeature !== null;
  const type = selectedFeature?.type || '';
  const data = selectedFeature?.data || {};

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

  const renderRouteDetails = () => (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <LabelVal label="Route Type" val={data.route_type} />
      <LabelVal
        label="Direction"
        val={data.direction_odd === 'O' ? 'Odd Only' : data.direction_even === 'E' ? 'Even Only' : 'Two-Way'}
      />
      <LabelVal label="Magnetic Track" val={data.track_magnetic ? `${data.track_magnetic}°` : null} />
      <LabelVal label="Distance" val={data.distance_nm ? `${data.distance_nm} NM` : null} />
      <LabelVal label="MEA" val={data.mea} />
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
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="absolute bottom-6 left-24 z-50 w-80"
        >
          <Card className="bg-black/50 backdrop-blur-2xl backdrop-saturate-150 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
        <CardHeader className="flex justify-between items-center pb-2 pt-4 px-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-primary-500 font-bold tracking-widest uppercase mb-1">
              {type.replace('_', ' ')}
            </span>
            <h3 className="text-base font-bold text-white tracking-wide">
              {title}
            </h3>
          </div>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onClick={() => setSelectedFeature(null)}
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
      
      {/* Scrollbar styling for CardBody */}
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
      `}} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
