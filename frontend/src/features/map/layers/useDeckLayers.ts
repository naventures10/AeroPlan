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
  const { viewMode, activeLayers, selectedRouteIds, setSelectedRouteIds } =
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
          pointType: 'circle',
          getFillColor: [167, 139, 250, 200],
          getLineColor: [255, 255, 255, 220],
          getLineWidth: 1,
          lineWidthMinPixels: 1,
          getPointRadius: 3,
          pointRadiusMinPixels: 2.5,
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
          data: `${window.location.origin}/tiles/ats_routes_geom/{z}/{x}/{y}`,
          visible: viewMode === 'ENROUTE',
          pickable: true,
          getLineColor: (d: any) =>
            selectedRouteIds.includes(d.properties.route_id)
              ? [34, 197, 94, 255]
              : [34, 211, 238, 100],
          getLineWidth: (d: any) =>
            selectedRouteIds.includes(d.properties.route_id) ? 4 : 2,
          lineWidthMinPixels: 1.5,
          onClick: (info: any) => {
            if (info.object && info.object.properties.route_id) {
              const rId = info.object.properties.route_id;
              setSelectedRouteIds(
                selectedRouteIds.includes(rId) ? [] : [rId],
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
          pointType: 'circle',
          getFillColor: [255, 255, 255, 255],
          getLineColor: (d: any) => {
            const routes = d.properties.route_ids
              ? String(d.properties.route_ids)
                  .replace(/[{"'}]/g, '')
                  .split(',')
              : [];
            return routes.some((r: string) => selectedRouteIds.includes(r))
              ? [34, 197, 94, 255]
              : [34, 211, 238, 200];
          },
          getLineWidth: (d: any) => {
            const routes = d.properties.route_ids
              ? String(d.properties.route_ids)
                  .replace(/[{"'}]/g, '')
                  .split(',')
              : [];
            return routes.some((r: string) => selectedRouteIds.includes(r))
              ? 2
              : 1;
          },
          lineWidthMinPixels: 1,
          getPointRadius: (d: any) => {
            const routes = d.properties.route_ids
              ? String(d.properties.route_ids)
                  .replace(/[{"'}]/g, '')
                  .split(',')
              : [];
            return routes.some((r: string) => selectedRouteIds.includes(r))
              ? 3
              : 2;
          },
          pointRadiusMinPixels: 1.5,
          onClick: (info: any) => {
            if (info.object && info.object.properties.route_ids) {
              const routes = String(info.object.properties.route_ids)
                .replace(/[{"'}]/g, '')
                .split(',');
              const isAlreadySelected =
                routes.length > 0 &&
                selectedRouteIds.length === routes.length &&
                routes.every((r: string) => selectedRouteIds.includes(r));
              if (isAlreadySelected) {
                setSelectedRouteIds([]);
              } else if (routes.length > 0) {
                setSelectedRouteIds(routes);
              }
            } else {
              setSelectedRouteIds([]);
            }
          },
          updateTriggers: {
            getLineColor: [selectedRouteIds],
            getLineWidth: [selectedRouteIds],
            getPointRadius: [selectedRouteIds],
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
    setSelectedRouteIds,
  ]);

  return deckLayers;
}
