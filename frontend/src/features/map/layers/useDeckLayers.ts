import { useMemo } from 'react';
import { GeoJsonLayer, TextLayer } from '@deck.gl/layers';
import { MVTLayer } from '@deck.gl/geo-layers';
import { useMapStore } from '../../../store/useMapStore';

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
  const { viewMode, activeLayers, selectedRouteIds, selectedRouteType, setSelectedRouteIds, viewState } =
    useMapStore();

  const textData = useMemo(() => {
    if (!aerodromes?.features) return [];
    return aerodromes.features.map((f: any) => ({
      position: f.geometry.coordinates,
      text: f.properties.icao_code || 'UNKNOWN',
    }));
  }, [aerodromes]);

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
        }),
      );
    }

    if (activeLayers.waypoints) {
      layers.push(
        new MVTLayer({
          id: 'waypoints-layer',
          data: `${window.location.origin}/tiles/significant_points/{z}/{x}/{y}`,
          visible: viewMode === 'ENROUTE',
          pickable: true,
          pointType: 'icon+text',
          iconAtlas: '/WAYPOINT_HOLLOW.svg',
          iconMapping: {
            waypoint: { x: 0, y: 0, width: 100, height: 100, anchorY: 50, mask: true }
          },
          getIcon: () => 'waypoint',
          getIconColor: [255, 255, 255, 255],
          getIconSize: 10,
          getText: (d: any) => d.properties.waypoint_name || '',
          getTextSize: (d: any) => {
            if (viewState.zoom <= 7.5) return 0;
            const hasRoutes = d.properties.routes && d.properties.routes !== 'None' && d.properties.routes !== '{}';
            if (activeLayers.atsRoutes && hasRoutes) return 0;
            return 11;
          },
          getTextColor: [220, 220, 220, 255],
          getTextPixelOffset: [0, -15],
          textFontFamily: 'Inter, sans-serif',
          textFontWeight: 600,
          updateTriggers: {
            getTextSize: [viewState.zoom > 7.5, activeLayers.atsRoutes],
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
          pointType: 'circle',
          getFillColor: [52, 211, 153, 220],
          getLineColor: [255, 255, 255, 220],
          getLineWidth: 1,
          lineWidthMinPixels: 1,
          getPointRadius: 4,
          pointRadiusMinPixels: 3.5,
        }),
      );
    }

    if (activeLayers.atsRoutes) {
      layers.push(
        new MVTLayer({
          id: 'atsRoutes-geom-layer',
          data: `${window.location.origin}/tiles/ats_route_segments/{z}/{x}/{y}`,
          visible: viewMode === 'ENROUTE',
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 150],
          getLineColor: (d: any) => {
            if (selectedRouteIds.includes(d.properties.route_id)) return [255, 255, 255, 255]; // Selected: White
            return d.properties.route_type === 'RNAV' ? [50, 205, 50, 220] : [34, 211, 238, 150]; // Lime Green vs Cyan
          },
          getLineWidth: (d: any) =>
            selectedRouteIds.includes(d.properties.route_id) ? 4 : 2,
          lineWidthMinPixels: 1.5,
          onClick: (info: any) => {
            if (info.object && info.object.properties.route_id) {
              const rId = info.object.properties.route_id;
              const rType = info.object.properties.route_type;
              setSelectedRouteIds(
                selectedRouteIds.includes(rId) ? [] : [rId],
                selectedRouteIds.includes(rId) ? null : rType
              );
            } else {
              setSelectedRouteIds([]);
            }
          },
          updateTriggers: {
            getLineColor: [selectedRouteIds],
            getLineWidth: [selectedRouteIds],
          },
        }),
        new MVTLayer({
          id: 'atsRoutes-waypoints-layer',
          data: `${window.location.origin}/tiles/ats_route_waypoints/{z}/{x}/{y}`,
          visible: viewMode === 'ENROUTE',
          pickable: true,
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
            return [255, 255, 255, 220];
          },
          getIconSize: (d: any) => {
            const routes = d.properties.route_ids ? String(d.properties.route_ids).replace(/[{"'}]/g, '').split(',') : [];
            return routes.some((r: string) => selectedRouteIds.includes(r)) ? 15 : 12;
          },
          getText: (d: any) => d.properties.waypoint_name || '',
          getTextSize: viewState.zoom > 7.5 ? 12 : 0,
          getTextColor: (d: any) => {
            const routes = d.properties.route_ids ? String(d.properties.route_ids).replace(/[{"'}]/g, '').split(',') : [];
            if (routes.some((r: string) => selectedRouteIds.includes(r))) {
              if (selectedRouteType === 'WAYPOINT') return [192, 132, 252, 255];
              return selectedRouteType === 'RNAV' ? [50, 205, 50, 255] : [0, 255, 255, 255];
            }
            return [200, 200, 200, 255];
          },
          getTextPixelOffset: [0, -18],
          textFontFamily: 'Inter, sans-serif',
          textFontWeight: 600,
          onClick: (info: any) => {
            if (info.object && info.object.properties.route_ids) {
              const routes = String(info.object.properties.route_ids).replace(/[{"'}]/g, '').split(',');
              const isAlreadySelected = routes.length > 0 && selectedRouteIds.length === routes.length && routes.every((r: string) => selectedRouteIds.includes(r));
              if (isAlreadySelected) setSelectedRouteIds([]);
              else if (routes.length > 0) setSelectedRouteIds(routes, 'WAYPOINT');
            } else {
              setSelectedRouteIds([]);
            }
          },
          updateTriggers: {
            getIconColor: [selectedRouteIds, selectedRouteType],
            getIconSize: [selectedRouteIds],
            getTextColor: [selectedRouteIds, selectedRouteType],
            getTextSize: [viewState.zoom > 7.5, selectedRouteIds],
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
    viewState.zoom,
  ]);

  return deckLayers;
}
