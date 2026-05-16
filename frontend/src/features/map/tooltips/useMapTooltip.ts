import { useCallback } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { useMapStore } from '../../../store/useMapStore';
import { sanitizeHtml } from '../../../utils/sanitize';

/**
 * The massive tooltip callback for DeckGL + MapLibre features.
 *
 * Refactored to use global CSS classes from index.css instead of inline styles.
 */
export function useMapTooltip(mapRef: React.RefObject<MapRef | null>) {
  const { activeAerodromeMetadata, activeLayers, selectedRouteIds } = useMapStore();

  const getTooltip = useCallback(
    ({ object, layer, x, y }: any) => {
      if (object && layer?.id === 'aerodromes-layer') {
        const p = object.properties ?? {};
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
        const remarksStr = row('REMARKS', p.remarks && p.remarks !== 'None' ? p.remarks : '');

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
                '<div style="margin-top:4px;">' +
                twrComms
                  .map((c: any) => row(c.service_type || 'FREQ', `${c.frequency} (${c.call_sign})`))
                  .join('') +
                '</div>';
            }
          }
        } catch (e) {
          /* noop */
        }

        const extraInfo =
          magVarStr || commsHtml || remarksStr
            ? `${divider}${magVarStr}${commsHtml}${remarksStr}</div>`
            : '';

        return {
          html: sanitizeHtml(`<div class="aip-tooltip-container" style="max-width:300px;">
            <span class="aip-tooltip-title">${p.name || p.icao_code}</span>
            <span class="aip-tooltip-subtitle">
              ICAO: <span class="aip-tooltip-accent">${p.icao_code}</span> | ELEV: <span class="aip-tooltip-accent">${enrouteElev ? enrouteElev + ' FT' : 'N/A'}</span>
            </span>
            <span class="aip-tooltip-status">
              CLICK TO ENTER TERMINAL VIEW
            </span>
            ${extraInfo}
          </div>`),
        };
      } else if (object && layer?.id === 'waypoints-layer') {
        const p = object.properties ?? {};
        const routes = p.routes ? p.routes.replace(/[{"'}]/g, '').split(',') : [];
        const routesDisplay =
          routes.length > 0 && routes[0] !== ''
            ? `<div style="margin-top:6px;" class="aip-tooltip-subtitle">ROUTES: <span style="color:#d8b4fe; font-weight:600;">${routes.join(', ')}</span></div>`
            : '';

        return {
          html: sanitizeHtml(`<div class="aip-tooltip-container" style="max-width:250px;">
              <span class="aip-tooltip-title">${p.waypoint_name || 'WAYPOINT'}</span>
              <span class="aip-tooltip-subtitle" style="font-weight:600;letter-spacing:.1em;">SIGNIFICANT POINT</span>
              <span class="aip-tooltip-mono">${p.raw_coordinates?.replace(/\\\\n/g, '') || ''}</span>
              ${routesDisplay}
            </div>`),
        };
      } else if (object && layer?.id === 'navaids-layer') {
        const p = object.properties ?? {};
        const hours =
          p.hours_of_operation && p.hours_of_operation !== 'None'
            ? `<div class="aip-tooltip-mono" style="margin-top:4px;">HOURS: ${p.hours_of_operation}</div>`
            : '';
        const elev =
          p.elevation && p.elevation !== 'None'
            ? `<span class="aip-tooltip-mono" style="margin-left:8px;">ELEV: ${p.elevation.replace(/\\\\n/g, '')}</span>`
            : '';

        return {
          html: sanitizeHtml(`<div class="aip-tooltip-container" style="max-width:260px;">
              <span class="aip-tooltip-title">${p.station_name || ''} <span class="aip-tooltip-subtitle" style="font-size:inherit;">${p.aid_type || ''}</span></span>
              <div style="display:flex;align-items:center;margin-top:2px;">
                  <span class="aip-tooltip-badge">${p.ident || 'UNK'}</span>
                  <span style="color:#f4f4f5;font-size:11px;font-weight:700;">${p.frequency || ''}</span>
              </div>
              <span class="aip-tooltip-mono">${p.raw_coordinates?.replace(/\\\\n/g, '') || ''}${elev}</span>
              ${hours}
            </div>`),
        };
      } else if (object && layer?.id === 'atsRoutes-geom-layer') {
        const p = object.properties ?? {};
        if (!activeLayers.atsRoutes && !selectedRouteIds.includes(p.route_id)) return null;
        const isOneWay = p.direction_odd === 'O' || p.direction_even === 'E';
        const directionStr = isOneWay
          ? p.direction_odd === 'O'
            ? '→ ODD ONLY'
            : '← EVEN ONLY'
          : '↔ TWO-WAY';
        const meainfo =
          p.mea && p.mea !== 'None'
            ? `<span class="aip-tooltip-subtitle" style="font-weight:600;color:#22c55e;">MEA: <span class="aip-tooltip-row-val">${p.mea}</span></span>`
            : '';
        const limitStr =
          (p.upper_limit && p.upper_limit !== 'None') || (p.lower_limit && p.lower_limit !== 'None')
            ? `<span class="aip-tooltip-subtitle" style="margin-top:2px;">LIMITS: ${p.lower_limit || 'SFC'} - ${p.upper_limit || 'UNL'}</span>`
            : '';
        const trackStr =
          p.track_magnetic &&
          p.track_magnetic !== 'None' &&
          p.distance_nm &&
          p.distance_nm !== 'None'
            ? `<span class="aip-tooltip-subtitle">SEGMENT: ${p.distance_nm} NM | TR: ${p.track_magnetic}</span>`
            : '';

        return {
          html: sanitizeHtml(`<div class="aip-tooltip-container" style="max-width:250px;">
              <span class="aip-tooltip-title">ROUTE ${p.route_designator || p.route_id || 'UNKNOWN'}</span>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span class="aip-tooltip-subtitle" style="font-weight:600;letter-spacing:.1em;color:#22d3ee;">${p.route_type || 'AIRWAY'}</span>
                  <span class="aip-tooltip-subtitle" style="font-weight:700;">${directionStr}</span>
              </div>
              ${meainfo}
              ${limitStr}
              ${trackStr}
            </div>`),
        };
      } else if (object && layer?.id === 'atsRoutes-waypoints-layer') {
        const p = object.properties ?? {};
        const routes = p.route_ids
          ? String(p.route_ids)
              .replace(/[{"'}]/g, '')
              .split(',')
          : [];
        if (!activeLayers.atsRoutes && !routes.some((r: string) => selectedRouteIds.includes(r)))
          return null;
        return {
          html: sanitizeHtml(`<div class="aip-tooltip-container" style="max-width:250px;">
              <span class="aip-tooltip-title">${p.waypoint_name || 'WAYPOINT'}</span>
              <span class="aip-tooltip-subtitle" style="font-weight:600;letter-spacing:.1em;color:#22d3ee;">INTERSECTING: ${routes.join(', ')}</span>
            </div>`),
        };
      } else if (object && layer?.id === 'airspace-metadata-layer') {
        const p = object.properties ?? {};
        const type = p.airspace_type || 'AIRSPACE';
        const name = p.name || p.identification || 'UNNAMED';
        const limits = `${p.lower_limit || 'SFC'} - ${p.upper_limit || 'UNL'}`;

        return {
          html: sanitizeHtml(`<div class="aip-tooltip-container" style="max-width:250px;">
              <span class="aip-tooltip-title">${name}</span>
              <span class="aip-tooltip-subtitle" style="font-weight:600;letter-spacing:.1em;color:#fbbf24;">${type.replace(/_/g, ' ')}</span>
              <span class="aip-tooltip-subtitle" style="margin-top:2px;">LIMITS: <span class="aip-tooltip-row-val">${limits}</span></span>
            </div>`),
        };
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
            let htmlContent = '';
            const maxFeatures = Math.min(features.length, 3);

            for (let k = 0; k < maxFeatures; k++) {
              const feature = features[k];
              if (!feature) continue;
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
              // The DB now stores elevation_m in meters (converted by ETL)
              // We display it in FT to match aeronautical standards
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
                  const geom = feature.geometry as any;
                  if (geom?.type === 'Point' && geom.coordinates) {
                    categoryDisplay = `${category} | ${geom.coordinates[1].toFixed(5)}, ${geom.coordinates[0].toFixed(5)}`;
                  }
                } else if (category === 'OBSTACLE' && Array.isArray(docs.obstacles)) {
                  let bestObs = null;
                  if (elev != null) {
                    const targetElevM = parseFloat(elev);
                    bestObs = docs.obstacles.find((o: any) => {
                      const nameMatch = o.obstacle_type === name || name.includes(o.obstacle_type);
                      if (!nameMatch || !o.elevation) return false;

                      // Extract elevation from JSON and convert to Meters for comparison
                      const docElevMatch = o.elevation.match(/(\d+(?:\.\d+)?)/);
                      if (docElevMatch) {
                        const docElevRaw = parseFloat(docElevMatch[1]);
                        const docElevM = o.elevation.toUpperCase().includes('FT')
                          ? docElevRaw / 3.28084
                          : docElevRaw;

                        return Math.abs(docElevM - targetElevM) < 2.0; // 2m tolerance
                      }
                      return false;
                    });
                  }
                  const obs =
                    bestObs ||
                    docs.obstacles.find(
                      (o: any) => o.obstacle_type === name || name.includes(o.obstacle_type),
                    );
                  if (obs)
                    extraInfo = `${divider}${row('AREA AFFECTED', obs.area_affected)}${row('LGT/MARKING', obs.marking_lgt)}${row('REMARKS', obs.remarks)}</div>`;
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
                    extraInfo = `${divider}${row('FREQ', nav.frequency_channel)}${row('HOURS', nav.hours_of_operation)}${row('REMARKS', nav.remarks)}</div>`;
                } else if (
                  (category === 'RUNWAY_THRESHOLD' || category === 'RUNWAY') &&
                  Array.isArray(docs.runway_physical_characteristics)
                ) {
                  const rwyNum = name.replace(/[^0-9]/g, '');
                  const rwy = docs.runway_physical_characteristics.find(
                    (r: any) => r.designation === rwyNum || r.designation?.includes(rwyNum),
                  );
                  if (rwy)
                    extraInfo = `${divider}${row('DIMENSIONS', rwy.dimensions)}${row('SURFACE/STRENGTH', rwy.strength_and_surface)}</div>`;
                }
              }

              const separator =
                k > 0
                  ? 'margin-top: 12px; border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 12px;'
                  : '';
              htmlContent += `<div style="${separator}" class="aip-tooltip-container">
                <span class="aip-tooltip-title">${name}</span>
                <span class="aip-tooltip-subtitle">ELEVATION: <span class="aip-tooltip-accent">${elevStr}</span></span>
                <span class="aip-tooltip-status">${categoryDisplay}</span>
                ${extraInfo}
              </div>`;
            }

            return {
              html: sanitizeHtml(
                `<div class="aip-scrollbar" style="max-height: 400px; overflow-y: auto; max-width:300px; padding-right: 8px;">${htmlContent}</div>`,
              ),
            };
          }
        } catch (e) {
          /* Map not fully loaded */
        }
      }
      return null;
    },
    [activeAerodromeMetadata, activeLayers, selectedRouteIds, mapRef],
  );

  return getTooltip;
}
