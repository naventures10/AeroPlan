import { useMemo, useState, useEffect } from 'react';
import { GeoJsonLayer, TextLayer, IconLayer } from '@deck.gl/layers';
import { MVTLayer } from '@deck.gl/geo-layers';
import { CollisionFilterExtension } from '@deck.gl/extensions';
import { useMapStore } from '../../../store/useMapStore';

const COLLISION_FILTER_EXTENSION = new CollisionFilterExtension();
const EXTENSIONS = [COLLISION_FILTER_EXTENSION];

/**
 * Builds the memoised DeckGL layer array.
 *
 * Accepts the data payloads and callbacks from the parent; reads layer
 * visibility / view mode from Zustand directly.
 */
export function useDeckLayers({
  aerodromes,
  onAerodromeClick,
}: {
  aerodromes: any;
  onAerodromeClick: (icao: string, coords: [number, number]) => void;
}) {
  const { viewMode, activeLayers, selectedRouteIds, selectedRouteType, setSelectedRouteIds, selectedFeature, setSelectedFeature, viewState, atsRouteLabels } =
    useMapStore();

  const [isAtsRendered, setIsAtsRendered] = useState(false);

  useEffect(() => {
    if (activeLayers.atsRoutes || selectedRouteIds.length > 0) {
      setIsAtsRendered(true);
    } else {
      const timer = setTimeout(() => { setIsAtsRendered(false); }, 300);
      return () => { clearTimeout(timer); };
    }
  }, [activeLayers.atsRoutes, selectedRouteIds.length]);

  const textData = useMemo(() => {
    if (!aerodromes?.features) return [];
    return aerodromes.features.map((f: any) => ({
      position: f.geometry.coordinates,
      text: f.properties.icao_code || 'UNKNOWN',
    }));
  }, [aerodromes]);

  const isZoomWaypoints = viewState.zoom > 7.0;
  const isZoomAtsWaypoints = viewState.zoom > 7.5;
  const isZoomNavaids = viewState.zoom > 2.5;

  const deckLayers = useMemo(() => {
    const layers: any[] = [];

    if (activeLayers.aerodromes) {
      layers.push(
        new GeoJsonLayer({
          id: 'aerodromes-layer',
          data: aerodromes,
          visible: viewMode === 'ENROUTE',
          pickable: true,
          pointType: 'icon',
          getIcon: () => ({
            url: '/ARP.svg',
            width: 339,
            height: 324,
            anchorY: 162,
            mask: false,
          }),
          getIconSize: 20,
          iconSizeUnits: 'pixels',
          onClick: (info: any) => {
            if (info.object)
              onAerodromeClick(
                info.object.properties.icao_code,
                info.object.geometry.coordinates,
              );
          },
        }),
        new TextLayer({
          id: 'aerodrome-text-layer',
          data: textData,
          visible: viewMode === 'ENROUTE',
          pickable: false,
          getPosition: (d: any) => d.position,
          getText: (d: any) => d.text,
          getSize: 12,
          sizeUnits: 'pixels',
          getColor: [255, 255, 255, 230],
          getPixelOffset: [0, 20],
          fontFamily: 'Inter, sans-serif',
          fontWeight: 700,
          outlineWidth: 2,
          outlineColor: [0, 0, 0, 180],
          fontSettings: { sdf: true },
        }),
      );
    }

    if (activeLayers.waypoints) {
      layers.push(
        new MVTLayer({
          id: 'waypoints-layer',
          data: `${window.location.origin}/tiles/significant_points/{z}/{x}/{y}`,
          visible: viewMode === 'ENROUTE',
          // Disable picking when ATS routes are active to avoid selecting waypoints while viewing routes
          pickable: !activeLayers.atsRoutes,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 60],
          pointType: 'icon+text',
          iconAtlas: '/WAYPOINT_HOLLOW.svg',
          iconMapping: {
            waypoint: { x: 0, y: 0, width: 100, height: 100, anchorY: 50, mask: true }
          },
          getIcon: () => 'waypoint',
          getIconColor: (d: any) => {
            if (selectedFeature?.type === 'WAYPOINT' && selectedFeature.data.waypoint_name === d.properties.waypoint_name) {
              return [0, 255, 255, 255]; // Neon Cyan
            }
            return [255, 255, 255, 255]; // Normal White
          },
          getIconSize: (d: any) => {
            if (selectedFeature?.type === 'WAYPOINT' && selectedFeature.data.waypoint_name === d.properties.waypoint_name) {
              return 16;
            }
            return 10;
          },
          getText: (d: any) => d.properties.waypoint_name || '',
          getTextSize: (d: any) => {
            if (!isZoomWaypoints) return 0;
            const hasRoutes = d.properties.routes && d.properties.routes !== 'None' && d.properties.routes !== '{}';
            if (activeLayers.atsRoutes && hasRoutes) return 0;
            return 11;
          },
          getTextColor: [220, 220, 220, 255],
          getTextPixelOffset: [0, -15],
          textFontFamily: 'Inter, sans-serif',
          textFontWeight: 600,
          onClick: (info: any) => {
            if (info.object && info.object.properties) {
              setSelectedFeature({ type: 'WAYPOINT', data: info.object.properties });
            }
          },
          updateTriggers: {
            getIconColor: [selectedFeature],
            getIconSize: [selectedFeature],
            getTextSize: [isZoomWaypoints, activeLayers.atsRoutes],
          },
          transitions: {
            getIconColor: 300,
            getIconSize: 300,
            getTextColor: 300,
          },
        }),
      );
    }

    if (activeLayers.navaids) {
      layers.push(
        new MVTLayer({
          id: 'navaids-layer',
          data: `${window.location.origin}/tiles/radio_nav_aids/{z}/{x}/{y}`,
          visible: viewMode === 'ENROUTE',
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 60],
          pointType: 'icon+text',
          getIcon: (d: any) => {
            let type = d.properties.aid_type || 'UNKNOWN';
            type = type.trim().replace(/\//g, '_');
            return {
              url: `/${type}.svg`,
              width: 100,
              height: 100,
              anchorY: 50,
              mask: true
            };
          },
          getIconSize: (d: any) => {
            if (selectedFeature?.type === 'NAVAID' && selectedFeature.data.ident === d.properties.ident) return 30;
            return 20;
          },
          getIconColor: (d: any) => {
            if (selectedFeature?.type === 'NAVAID' && selectedFeature.data.ident === d.properties.ident) return [0, 255, 255, 255]; // Neon Cyan
            return [52, 211, 153, 255]; // Emerald Green
          },
          getText: (d: any) => d.properties.ident || '',
          getTextSize: isZoomNavaids ? 12 : 0,
          getTextColor: [52, 211, 153, 255],
          getTextPixelOffset: [0, 20],
          textFontFamily: 'Inter, sans-serif',
          textFontWeight: 600,
          onClick: (info: any) => {
            if (info.object && info.object.properties) {
              setSelectedFeature({ type: 'NAVAID', data: info.object.properties });
            }
          },
          updateTriggers: {
            getIconColor: [selectedFeature],
            getIconSize: [selectedFeature],
            getTextSize: [isZoomNavaids],
          },
          transitions: {
            getIconColor: 300,
            getIconSize: 300,
            getTextColor: 300,
          },
        }),
      );
    }

    const shouldShowAtsRoutes = isAtsRendered;
    if (shouldShowAtsRoutes) {
      layers.push(
        new MVTLayer({
          id: 'atsRoutes-geom-layer',
          data: `${window.location.origin}/tiles/ats_route_segments/{z}/{x}/{y}`,
          visible: viewMode === 'ENROUTE',
          pickable: true,
          autoHighlight: true,
          highlightColor: activeLayers.atsRoutes ? [255, 255, 255, 150] : [0, 0, 0, 0],
          getLineColor: (d: any) => {
            if (selectedRouteIds.includes(d.properties.route_id)) return [255, 255, 255, 255]; // Selected: White
            if (!activeLayers.atsRoutes) return [0, 0, 0, 0];
            return d.properties.route_type === 'RNAV' ? [50, 205, 50, 60] : [34, 211, 238, 60]; // Dim unselected
          },
          getLineWidth: (d: any) => {
            if (!activeLayers.atsRoutes && !selectedRouteIds.includes(d.properties.route_id)) return 0;
            const limit = parseInt(d.properties.lateral_limits) || 10;
            const width = Math.max(1.5, limit / 4); // Scale actual airway boundaries to visual thickness
            return selectedRouteIds.includes(d.properties.route_id) ? width + 2 : width;
          },
          lineWidthMinPixels: 1,
          onClick: (info: any) => {
            if (info.object && info.object.properties.route_id) {
              const rId = info.object.properties.route_id;
              if (!activeLayers.atsRoutes && !selectedRouteIds.includes(rId)) return;
              const rType = info.object.properties.route_type;
              setSelectedRouteIds(
                selectedRouteIds.includes(rId) ? [] : [rId],
                selectedRouteIds.includes(rId) ? null : rType
              );
              setSelectedFeature({ type: 'ATS_ROUTE', data: info.object.properties });
            } else {
              setSelectedRouteIds([]);
              setSelectedFeature(null);
            }
          },
          updateTriggers: {
            getLineColor: [selectedRouteIds, activeLayers.atsRoutes],
            getLineWidth: [selectedRouteIds, activeLayers.atsRoutes],
          },
          transitions: {
            getLineColor: 300,
            getLineWidth: 300,
          },
        }),
      );

      // ── ATS Route Segment Labels (Stable Midpoints from Backend) ──
      if (atsRouteLabels?.features) {
        const labelFeatures = atsRouteLabels.features.filter((f: any) => {
          const isSelected = selectedRouteIds.includes(f.properties.route_id);
          return activeLayers.atsRoutes || isSelected;
        });

        layers.push(
          new IconLayer({
            id: 'ats-route-labels-bg-layer',
            data: labelFeatures,
            visible: viewMode === 'ENROUTE',
            iconAtlas: '/ROUTE_HEXAGON_FILL.svg',
            iconMapping: {
              hex: { x: 0, y: 0, width: 140, height: 50, anchorY: 25, mask: true }
            },
            getIcon: () => 'hex',
            getPosition: (d: any) => d.geometry.coordinates,
            getAngle: (d: any) => d.properties.bearing, // Parallel to route
            getSize: 5000,
            getColor: (): [number, number, number, number] => [0, 0, 0, 255], // Fully opaque mask
            sizeUnits: 'meters',
            extensions: EXTENSIONS,
            collisionGroup: 'ats-labels',
            collisionPriority: (d: any) => (selectedRouteIds.includes(d.properties.route_id) ? 2 : 1),
            updateTriggers: {
              getSize: [selectedRouteIds],
            },
            parameters: {
              depthTest: false,
              blend: true,
              blendFunc: [0, 771] // [GL.ZERO, GL.ONE_MINUS_SRC_ALPHA] punches a transparent hole
            },
          }),
          new IconLayer({
            id: 'ats-route-labels-hex-layer',
            data: labelFeatures,
            visible: viewMode === 'ENROUTE',
            iconAtlas: '/ROUTE_HEXAGON.svg',
            iconMapping: {
              hex: { x: 0, y: 0, width: 140, height: 50, anchorY: 25, mask: true }
            },
            getIcon: () => 'hex',
            getPosition: (d: any) => d.geometry.coordinates,
            getAngle: (d: any) => d.properties.bearing, // Parallel to route
            getSize: 5000,
            getColor: (d: any): [number, number, number, number] => {
              const isSelected = selectedRouteIds.includes(d.properties.route_id);
              const color = (d.properties.route_type === 'RNAV' ? [50, 205, 50] : [34, 211, 238]) as [number, number, number];
              return [color[0], color[1], color[2], isSelected ? 255 : 140];
            },
            sizeUnits: 'meters',
            extensions: EXTENSIONS,
            collisionGroup: 'ats-labels',
            collisionPriority: (d: any) => (selectedRouteIds.includes(d.properties.route_id) ? 2 : 1),
            updateTriggers: {
              getSize: [selectedRouteIds],
              getColor: [selectedRouteIds],
            },
            parameters: { depthTest: false },
          }),
          new TextLayer({
            id: 'ats-route-labels-text-layer',
            data: labelFeatures,
            visible: viewMode === 'ENROUTE',
            getPosition: (d: any) => d.geometry.coordinates,
            getText: (d: any) => d.properties.route_id,
            getAngle: (d: any) => d.properties.bearing, // Parallel to route
            getSize: 4000,
            sizeUnits: 'meters',
            getColor: (d: any) => {
              const isSelected = selectedRouteIds.includes(d.properties.route_id);
              if (isSelected) return [255, 255, 255, 255];
              return d.properties.route_type === 'RNAV' ? [50, 205, 50, 140] : [34, 211, 238, 140];
            },
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            extensions: EXTENSIONS,
            collisionGroup: 'ats-labels',
            collisionPriority: (d: any) => (selectedRouteIds.includes(d.properties.route_id) ? 2 : 1),
            updateTriggers: {
              getSize: [selectedRouteIds],
              getColor: [selectedRouteIds],
            },
            parameters: { depthTest: false },
          }),
        );
      }

      layers.push(
        new MVTLayer({
          id: 'atsRoutes-waypoints-layer',
          data: `${window.location.origin}/tiles/ats_route_waypoints/{z}/{x}/{y}`,
          visible: viewMode === 'ENROUTE',
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 60],
          pointType: 'icon+text',
          iconAtlas: '/WAYPOINT.svg',
          iconMapping: {
            waypoint: { x: 0, y: 0, width: 100, height: 100, anchorY: 50, mask: true }
          },
          getIcon: () => 'waypoint',
          getIconColor: (d: any) => {
            const routes = d.properties.route_ids ? String(d.properties.route_ids).replace(/[{"'}]/g, '').split(',') : [];
            if (routes.some((r: string) => selectedRouteIds.includes(r))) {
              if (selectedRouteType === 'WAYPOINT') return [192, 132, 252, 255]; // Soft Neon Purple
              return selectedRouteType === 'RNAV' ? [50, 205, 50, 255] : [0, 255, 255, 255]; // Lime Green for RNAV, Cyan for Conventional
            }
            if (!activeLayers.atsRoutes) return [0, 0, 0, 0];
            return [150, 150, 150, 80]; // Dim unselected
          },
          getIconSize: (d: any) => {
            const routes = d.properties.route_ids ? String(d.properties.route_ids).replace(/[{"'}]/g, '').split(',') : [];
            if (routes.some((r: string) => selectedRouteIds.includes(r))) return 16;
            if (!activeLayers.atsRoutes) return 0;
            return 6;
          },
          getText: (d: any) => d.properties.waypoint_name || '',
          getTextSize: (d: any) => {
            const routes = d.properties.route_ids ? String(d.properties.route_ids).replace(/[{"'}]/g, '').split(',') : [];
            if (routes.some((r: string) => selectedRouteIds.includes(r))) return 12; // Always visible if selected
            if (!activeLayers.atsRoutes) return 0;
            return isZoomAtsWaypoints ? 10 : 0; // Relaxed from 8.5 to 7.5
          },
          getTextColor: (d: any) => {
            const routes = d.properties.route_ids ? String(d.properties.route_ids).replace(/[{"'}]/g, '').split(',') : [];
            if (routes.some((r: string) => selectedRouteIds.includes(r))) {
              if (selectedRouteType === 'WAYPOINT') return [192, 132, 252, 255];
              return selectedRouteType === 'RNAV' ? [50, 205, 50, 255] : [0, 255, 255, 255];
            }
            if (!activeLayers.atsRoutes) return [0, 0, 0, 0];
            return [150, 150, 150, 150]; // Dimmer text for unselected
          },
          getTextPixelOffset: [0, -18],
          textFontFamily: 'Inter, sans-serif',
          textFontWeight: 600,
          onClick: (info: any) => {
            if (info.object && info.object.properties.route_ids) {
              const routes = String(info.object.properties.route_ids).replace(/[{"'}]/g, '').split(',');
              const isAlreadySelected = routes.length > 0 && selectedRouteIds.length === routes.length && routes.every((r: string) => selectedRouteIds.includes(r));
              if (!activeLayers.atsRoutes && !routes.some((r: string) => selectedRouteIds.includes(r))) return;
              if (isAlreadySelected) {
                setSelectedRouteIds([]);
                setSelectedFeature(null);
              } else if (routes.length > 0) {
                setSelectedRouteIds(routes, 'WAYPOINT');
                setSelectedFeature({ type: 'WAYPOINT', data: info.object.properties });
              }
            } else {
              setSelectedRouteIds([]);
              setSelectedFeature(null);
            }
          },
          updateTriggers: {
            getIconColor: [selectedRouteIds, selectedRouteType, activeLayers.atsRoutes],
            getIconSize: [selectedRouteIds, activeLayers.atsRoutes],
            getTextColor: [selectedRouteIds, selectedRouteType, activeLayers.atsRoutes],
            getTextSize: [isZoomAtsWaypoints, selectedRouteIds, activeLayers.atsRoutes],
          },
          transitions: {
            getIconColor: 300,
            getIconSize: 300,
            getTextColor: 300,
          },
        }),
      );
    }

    return layers;
  }, [
    aerodromes,
    viewMode,
    textData,
    onAerodromeClick,
    activeLayers,
    selectedRouteIds,
    selectedRouteType,
    setSelectedRouteIds,
    setSelectedFeature,
    selectedFeature,
    isZoomWaypoints,
    isZoomNavaids,
    isZoomAtsWaypoints,
    isAtsRendered,
    atsRouteLabels,
  ]);

  return deckLayers;
}
