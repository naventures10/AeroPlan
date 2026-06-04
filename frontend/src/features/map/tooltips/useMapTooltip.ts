import { useCallback } from 'react';
import './MapTooltip.css';
import type { MapRef } from 'react-map-gl/maplibre';
import { useMapStore } from '../../../store/useMapStore';
import { sanitizeHtml } from '../../../utils/sanitize';

const buildTooltip = (content: string) =>
  sanitizeHtml(`<div class="aip-tooltip-wrapper">${content}</div>`);

// fallow-ignore-next-line complexity
function getAerodromeTooltip(p: any, activeAerodromeMetadata: any) {
  let enrouteElev = p.elevation;

  if (!enrouteElev && activeAerodromeMetadata) {
    const docs = activeAerodromeMetadata.data || activeAerodromeMetadata;
    const elevMatch =
      docs.geographical_data?.elevation_reference_temp?.match(/(\d+(?:\.\d+)?)\s*FT/i);
    if (elevMatch) enrouteElev = elevMatch[1];
  }

  const divider = '<div class="aip-tooltip-divider">';
  const row = (label: string, val: string) =>
    val
      ? `<span class="aip-tooltip-row">${label}: <span class="aip-tooltip-row-val">${val.replace(/\\n/g, '<br/>')}</span></span>`
      : '';

  const magVarStr = row('MAG VAR', p.magnetic_variation);

  let commsHtml = '';
  try {
    const comms =
      typeof p.communications === 'string' ? JSON.parse(p.communications) : p.communications;
    if (Array.isArray(comms)) {
      const twrComms = comms.filter(
        (c: any) => c.service_type?.includes('TWR') || c.service_type?.includes('APP'),
      );
      if (twrComms.length > 0) {
        commsHtml =
          '<div class="aip-tooltip-spacing-sm">' +
          twrComms
            .map((c: any) => row(c.service_type || 'FREQ', `${c.frequency} (${c.call_sign})`))
            .join('') +
          '</div>';
      }
    }
  } catch (e) {
    /* noop */
  }

  const extraInfo = magVarStr || commsHtml ? `${divider}${magVarStr}${commsHtml}</div>` : '';

  const notamCount = p.notam_count || 0;
  const notamStr =
    notamCount > 0
      ? `<div class="aip-tooltip-spacing-sm" style="display: flex; align-items: center; gap: 8px;">
         <span class="aip-tooltip-dot-warning"></span>
         <span class="aip-tooltip-notam-text">${notamCount} Active NOTAMs</span>
       </div>`
      : '';

  return {
    html: buildTooltip(`<div class="aip-tooltip-container aip-tooltip-max-300">
      <span class="aip-tooltip-title">${p.name || p.icao_code}</span>
      <span class="aip-tooltip-subtitle">
        ICAO: <span class="aip-tooltip-accent">${p.icao_code}</span> | Elev: <span class="aip-tooltip-accent">${enrouteElev ? enrouteElev + ' FT' : 'N/A'}</span>
      </span>
      ${notamStr}
      <span class="aip-tooltip-status">
        Click to enter Terminal View
      </span>
      ${extraInfo}
    </div>`),
  };
}

function getWaypointTooltip(p: any) {
  const routes = p.routes ? p.routes.replace(/[{"'}]/g, '').split(',') : [];
  const routesDisplay =
    routes.length > 0 && routes[0] !== ''
      ? `<div class="aip-tooltip-subtitle aip-tooltip-spacing-md">Routes: <span class="aip-tooltip-route-list">${routes.join(', ')}</span></div>`
      : '';

  return {
    html: buildTooltip(`<div class="aip-tooltip-container aip-tooltip-max-250">
        <span class="aip-tooltip-title">${p.waypoint_name || 'Waypoint'}</span>
        <span class="aip-tooltip-subtitle aip-tooltip-sig-point">Significant Point</span>
        <span class="aip-tooltip-mono">${p.raw_coordinates?.replace(/\\\\n/g, '') || ''}</span>
        ${routesDisplay}
      </div>`),
  };
}

// fallow-ignore-next-line complexity
function getNavaidTooltip(p: any) {
  const hours =
    p.hours_of_operation && p.hours_of_operation !== 'None'
      ? `<div class="aip-tooltip-mono aip-tooltip-spacing-sm">Hours: ${p.hours_of_operation}</div>`
      : '';
  const elev =
    p.elevation && p.elevation !== 'None'
      ? `<span class="aip-tooltip-mono aip-tooltip-spacing-left-sm">Elev: ${p.elevation.replace(/\\\\n/g, '')}</span>`
      : '';

  return {
    html: buildTooltip(`<div class="aip-tooltip-container aip-tooltip-max-260">
        <span class="aip-tooltip-title">${p.station_name || ''} <span class="aip-tooltip-subtitle">${p.aid_type || ''}</span></span>
        <div class="aip-tooltip-badge-row">
            <span class="aip-tooltip-badge">${p.ident || 'UNK'}</span>
            <span class="aip-tooltip-badge-val">${p.frequency || ''}</span>
        </div>
        <span class="aip-tooltip-mono">${p.raw_coordinates?.replace(/\\\\n/g, '') || ''}${elev}</span>
        ${hours}
      </div>`),
  };
}

// fallow-ignore-next-line complexity
function getAtsRouteGeomTooltip(p: any, activeLayers: any, selectedRouteIds: any) {
  if (!activeLayers.atsRoutes && !selectedRouteIds.includes(p.route_id)) return null;
  const isOneWay = p.direction_odd === 'O' || p.direction_even === 'E';
  const directionStr = isOneWay
    ? p.direction_odd === 'O'
      ? '→ Odd Only'
      : '← Even Only'
    : '↔ Two-Way';
  const meainfo =
    p.mea && p.mea !== 'None'
      ? `<span class="aip-tooltip-subtitle aip-tooltip-route-type">MEA: <span class="aip-tooltip-row-val">${p.mea}</span></span>`
      : '';
  const limitStr =
    (p.upper_limit && p.upper_limit !== 'None') || (p.lower_limit && p.lower_limit !== 'None')
      ? `<span class="aip-tooltip-subtitle aip-tooltip-spacing-sm">Limits: ${p.lower_limit || 'SFC'} - ${p.upper_limit || 'UNL'}</span>`
      : '';
  const trackStr =
    p.track_magnetic && p.track_magnetic !== 'None' && p.distance_nm && p.distance_nm !== 'None'
      ? `<span class="aip-tooltip-subtitle">Segment: ${p.distance_nm} NM | Tr: ${p.track_magnetic}</span>`
      : '';

  const routeTypeClass =
    p.route_type === 'RNAV'
      ? 'aip-tooltip-subtitle aip-tooltip-route-type aip-tooltip-route-rnav'
      : 'aip-tooltip-subtitle aip-tooltip-route-type';

  return {
    html: buildTooltip(`<div class="aip-tooltip-container aip-tooltip-max-250">
        <span class="aip-tooltip-title">Route ${p.route_designator || p.route_id || 'Unknown'}</span>
        <div class="aip-tooltip-flex-between">
            <span class="${routeTypeClass}">${p.route_type || 'Airway'}</span>
            <span class="aip-tooltip-subtitle aip-tooltip-bold">${directionStr}</span>
        </div>
        ${meainfo}
        ${limitStr}
        ${trackStr}
      </div>`),
  };
}

function getAtsRouteWaypointTooltip(p: any, activeLayers: any, selectedRouteIds: any) {
  const routes = p.route_ids
    ? String(p.route_ids)
        .replace(/[{"'}]/g, '')
        .split(',')
    : [];
  if (!activeLayers.atsRoutes && !routes.some((r: string) => selectedRouteIds.includes(r)))
    return null;
  return {
    html: buildTooltip(`<div class="aip-tooltip-container aip-tooltip-max-250">
        <span class="aip-tooltip-title">${p.waypoint_name || 'Waypoint'}</span>
        <span class="aip-tooltip-subtitle aip-tooltip-waypoint-accent">Intersecting: ${routes.join(', ')}</span>
      </div>`),
  };
}

// fallow-ignore-next-line complexity
function buildMapLibreFeatureTooltip(
  feature: any,
  activeAerodromeMetadata: any,
  isFirst: boolean,
): string {
  const p = feature.properties ?? {};
  const name = p.name || p.feature_name || 'FEATURE';
  const category = p.category || p.feature_category || 'UNKNOWN';

  let elev = p.height ?? p.elevation_m ?? p.elevation ?? null;

  if (elev == null && category === 'ARP' && activeAerodromeMetadata) {
    const docs = activeAerodromeMetadata.data || activeAerodromeMetadata;
    const elevMatch =
      docs.geographical_data?.elevation_reference_temp?.match(/(\d+(?:\.\d+)?)\s*FT/i);
    if (elevMatch) elev = elevMatch[1];
  }
  const elevFt = elev != null ? Number(elev) * 3.28084 : null;
  const elevStr = elevFt != null ? elevFt.toFixed(1) + ' FT' : 'N/A';

  let extraInfo = '';
  let categoryDisplay = category;

  if (activeAerodromeMetadata) {
    const docs = activeAerodromeMetadata.data || activeAerodromeMetadata;
    const divider = '<div class="aip-tooltip-divider">';
    const row = (label: string, val: string) =>
      val
        ? `<span class="aip-tooltip-row">${label}: <span class="aip-tooltip-row-val">${val.replace(/\\\\n/g, '<br/>')}</span></span>`
        : '';

    if (category === 'ARP') {
      const geom = feature.geometry;
      if (geom?.type === 'Point' && geom.coordinates) {
        categoryDisplay = `${category} | ${geom.coordinates[1].toFixed(5)}, ${geom.coordinates[0].toFixed(5)}`;
      }
    } else if (category === 'OBSTACLE' && Array.isArray(docs.obstacles)) {
      let bestObs = null;
      if (elev != null) {
        const targetElevM = parseFloat(elev);
        let minDiff = 2.0;

        for (const o of docs.obstacles) {
          const nameMatch = o.obstacle_type === name || name.includes(o.obstacle_type);
          if (!nameMatch || !o.elevation) continue;

          const docElevMatch = o.elevation.match(/(\d+(?:\.\d+)?)/);
          if (docElevMatch) {
            const docElevRaw = parseFloat(docElevMatch[1]);
            const docElevM = o.elevation.toUpperCase().includes('FT')
              ? docElevRaw / 3.28084
              : docElevRaw;

            const diff = Math.abs(docElevM - targetElevM);
            const featureLgt = p.marking_lgt;
            const docLgt = o.marking_lgt;
            const lgtMatch =
              featureLgt && docLgt
                ? (featureLgt === 'LGTD' && docLgt === 'LGTD') ||
                  (featureLgt === 'NO' && docLgt === 'NO')
                : true;

            const adjustedDiff = lgtMatch ? diff : diff + 0.5;

            if (adjustedDiff < minDiff) {
              minDiff = adjustedDiff;
              bestObs = o;
            }
          }
        }
      }
      const obs =
        bestObs ||
        docs.obstacles.find((o: any) => o.obstacle_type === name || name.includes(o.obstacle_type));
      if (obs)
        extraInfo = `${divider}${row('Area Affected', obs.area_affected)}${row('Lgt/Marking', obs.marking_lgt)}${row('Remarks', obs.remarks)}</div>`;
    } else if (
      (category === 'NAVAID' || category === 'NAV') &&
      Array.isArray(docs.radio_navigation_and_landing_aids)
    ) {
      let bestMatch = null;
      let highestScore = 0;
      const nameParts = name.split(/\s+/);

      for (const n of docs.radio_navigation_and_landing_aids) {
        const ident = n.identification?.trim().toUpperCase();
        const typeStr = n.type_of_aid?.split('\n')[0]?.trim().toUpperCase();

        let score = 0;
        if (ident && nameParts.includes(ident)) score += 2;
        if (typeStr) {
          const typeParts = typeStr.split(/\s+/);
          let matchCount = 0;
          for (const tp of typeParts) {
            if (nameParts.includes(tp)) matchCount++;
          }
          score += matchCount / Math.max(typeParts.length, 1);
        }
        const combined = `${ident || ''} ${typeStr || ''}`.trim().toUpperCase();
        if (score === 0 && combined && combined.includes(name)) {
          score += 0.5;
        }
        if (score > highestScore) {
          highestScore = score;
          bestMatch = n;
        }
      }
      const nav = highestScore >= 1 ? bestMatch : null;
      if (nav)
        extraInfo = `${divider}${row('Freq', nav.frequency_channel)}${row('Hours', nav.hours_of_operation)}${row('Remarks', nav.remarks)}</div>`;
    } else if (
      (category === 'RUNWAY_THRESHOLD' || category === 'RUNWAY') &&
      Array.isArray(docs.runway_physical_characteristics)
    ) {
      const rwyNum = name.replace(/[^0-9]/g, '');
      const rwy = docs.runway_physical_characteristics.find(
        (r: any) => r.designation === rwyNum || r.designation?.includes(rwyNum),
      );
      if (rwy)
        extraInfo = `${divider}${row('Dimensions', rwy.dimensions)}${row('Surface/Strength', rwy.strength_and_surface)}</div>`;
    }
  }

  const separatorClass = !isFirst ? 'aip-tooltip-multi-separator' : '';
  return `<div class="${separatorClass} aip-tooltip-container">
    <span class="aip-tooltip-title">${name}</span>
    <span class="aip-tooltip-subtitle">Elevation: <span class="aip-tooltip-accent">${elevStr}</span></span>
    <span class="aip-tooltip-status">${categoryDisplay}</span>
    ${extraInfo}
  </div>`;
}

function getMapLibreTooltip(features: any[], activeAerodromeMetadata: any) {
  let htmlContent = '';
  const maxFeatures = Math.min(features.length, 3);

  for (let k = 0; k < maxFeatures; k++) {
    const feature = features[k];
    if (!feature) continue;
    htmlContent += buildMapLibreFeatureTooltip(feature, activeAerodromeMetadata, k === 0);
  }

  return {
    html: buildTooltip(
      `<div class="aip-scrollbar aip-tooltip-scroll-container">${htmlContent}</div>`,
    ),
  };
}

export function useMapTooltip(mapRef: React.RefObject<MapRef | null>) {
  const getTooltip = useCallback(
    // fallow-ignore-next-line complexity
    ({ object, layer, x, y }: any) => {
      const { activeAerodromeMetadata, activeLayers, selectedRouteIds } = useMapStore.getState();

      if (activeLayers.weather) return null;

      if (object && layer?.id === 'aerodromes-layer') {
        return getAerodromeTooltip(object.properties ?? {}, activeAerodromeMetadata);
      } else if (object && layer?.id === 'waypoints-layer') {
        return getWaypointTooltip(object.properties ?? {});
      } else if (object && layer?.id === 'navaids-layer') {
        return getNavaidTooltip(object.properties ?? {});
      } else if (object && layer?.id && String(layer.id).startsWith('atsRoutes-geom-layer')) {
        return getAtsRouteGeomTooltip(object.properties ?? {}, activeLayers, selectedRouteIds);
      } else if (object && layer?.id && String(layer.id).startsWith('atsRoutes-waypoints-layer')) {
        return getAtsRouteWaypointTooltip(object.properties ?? {}, activeLayers, selectedRouteIds);
      }

      // Fallback: query MapLibre rendered features (terminal 3D view)
      const map = mapRef.current?.getMap();
      if (map && x !== undefined && y !== undefined) {
        try {
          const currentLayers = map.getStyle()?.layers?.map((l: any) => l.id) || [];
          const safeLayers = ['mvt-points', 'mvt-polygons'].filter((l) =>
            currentLayers.includes(l),
          );

          if (safeLayers.length === 0) return null;

          const features = map.queryRenderedFeatures([x, y], {
            layers: safeLayers,
          });
          if (features && features.length > 0) {
            return getMapLibreTooltip(features, activeAerodromeMetadata);
          }
        } catch (e) {
          /* Map not fully loaded */
        }
      }
      return null;
    },
    [mapRef],
  );

  return getTooltip;
}
