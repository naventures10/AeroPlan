import { useCallback } from 'react';
import './MapTooltip.css';
import type { MapRef } from 'react-map-gl/maplibre';
import { useMapStore } from '../../../store/useMapStore';
import { sanitizeHtml } from '../../../utils/sanitize';

const buildTooltip = (content: string) =>
  sanitizeHtml(`<div class="aip-tooltip-wrapper">${content}</div>`);

// ── Types and Interfaces for Indexed Metadata ──────────────────────────────

interface IndexedObstacle {
  obstacle_type: string;
  elevation: string;
  elevationM: number | null;
  marking_lgt: string;
  area_affected: string;
  remarks: string;
}

interface IndexedMetadata {
  icao: string;
  elevation: string | null;
  elevationM: number | null;
  obstaclesByType: Map<string, IndexedObstacle[]>;
  navaidsByIdent: Map<string, any[]>;
  runwaysByDesignator: Map<string, any>;
}

// ── Cache for Indexed Metadata and Hover States ─────────────────────────────

let lastMetadataRaw: any = null;
let lastIndexedMetadata: IndexedMetadata | null = null;

let lastHoveredKey = '';
let lastHoveredTooltip: { html: string } | null = null;

// fallow-ignore-next-line complexity
function indexObstacles(docs: any): Map<string, IndexedObstacle[]> {
  const obstaclesByType = new Map<string, IndexedObstacle[]>();
  if (!Array.isArray(docs.obstacles)) return obstaclesByType;
  for (const o of docs.obstacles) {
    const type = (o.obstacle_type || '').toLowerCase().trim();
    const elevStr = o.elevation || '';
    let elevM: number | null = null;
    const docElevMatch = elevStr.match(/(\d+(?:\.\d+)?)/);
    if (docElevMatch) {
      const docElevRaw = parseFloat(docElevMatch[1]);
      elevM = elevStr.toUpperCase().includes('FT') ? docElevRaw / 3.28084 : docElevRaw;
    }

    const indexedObs: IndexedObstacle = {
      obstacle_type: o.obstacle_type || '',
      elevation: elevStr,
      elevationM: elevM,
      marking_lgt: o.marking_lgt || 'NIL',
      area_affected: o.area_affected || '',
      remarks: o.remarks || '',
    };

    let list = obstaclesByType.get(type);
    if (!list) {
      list = [];
      obstaclesByType.set(type, list);
    }
    list.push(indexedObs);
  }
  return obstaclesByType;
}

function indexNavaids(docs: any): Map<string, any[]> {
  const navaidsByIdent = new Map<string, any[]>();
  if (!Array.isArray(docs.radio_navigation_and_landing_aids)) return navaidsByIdent;
  for (const n of docs.radio_navigation_and_landing_aids) {
    const ident = (n.identification || '').trim().toUpperCase();
    if (ident) {
      let list = navaidsByIdent.get(ident);
      if (!list) {
        list = [];
        navaidsByIdent.set(ident, list);
      }
      list.push(n);
    }
  }
  return navaidsByIdent;
}

function indexRunways(docs: any): Map<string, any> {
  const runwaysByDesignator = new Map<string, any>();
  if (!Array.isArray(docs.runway_physical_characteristics)) return runwaysByDesignator;
  for (const r of docs.runway_physical_characteristics) {
    const designation = (r.designation || '').trim();
    if (designation) {
      runwaysByDesignator.set(designation, r);
      const parts = designation.split('/');
      for (const p of parts) {
        const trimmedPart = p.trim();
        if (trimmedPart) runwaysByDesignator.set(trimmedPart, r);
      }
    }
  }
  return runwaysByDesignator;
}

/**
 * Pre-processes and indexes active aerodrome metadata on-load/change
 * to optimize O(1) matching during map hover events.
 */
function getOrCreateIndexedMetadata(metadata: any): IndexedMetadata | null {
  if (!metadata) return null;

  if (metadata === lastMetadataRaw) {
    return lastIndexedMetadata;
  }

  // Clear hover cache when active metadata changes
  lastHoveredKey = '';
  lastHoveredTooltip = null;

  const docs = metadata.data || metadata;

  // Extract geographical elevation
  let elevation: string | null = null;
  let elevationM: number | null = null;
  const rawElev = docs.geographical_data?.elevation_reference_temp;
  if (rawElev) {
    const match = rawElev.match(/(\d+(?:\.\d+)?)\s*FT/i);
    if (match) {
      elevation = match[1];
      elevationM = parseFloat(match[1]) / 3.28084;
    }
  }

  lastMetadataRaw = metadata;
  lastIndexedMetadata = {
    icao: metadata.icao || '',
    elevation,
    elevationM,
    obstaclesByType: indexObstacles(docs),
    navaidsByIdent: indexNavaids(docs),
    runwaysByDesignator: indexRunways(docs),
  };
  return lastIndexedMetadata;
}

function getMapLibreHoverKey(
  mapRef: React.RefObject<MapRef | null>,
  x?: number,
  y?: number,
): string {
  const map = mapRef.current?.getMap();
  if (!map || x === undefined || y === undefined) return '';
  try {
    const currentLayers = map.getStyle()?.layers?.map((l: any) => l.id) || [];
    const safeLayers = ['mvt-points', 'mvt-polygons'].filter((l) => currentLayers.includes(l));
    if (safeLayers.length > 0) {
      const features = map.queryRenderedFeatures([x, y], { layers: safeLayers });
      if (features && features.length > 0) {
        return `ml-${features.map((f) => f.properties?.feature_id || f.id || f.properties?.name || f.properties?.feature_name || '').join('_')}`;
      }
    }
  } catch {
    /* ignore */
  }
  return '';
}

/**
 * Computes a unique hover key based on the layer and feature properties under the cursor.
 */
// fallow-ignore-next-line complexity
function getHoverKey(info: any, mapRef: React.RefObject<MapRef | null>): string {
  const { object, layer, x, y } = info;
  if (object && layer?.id) {
    const p = object.properties ?? {};
    if (layer.id === 'aerodromes-layer') return `deck-aero-${p.icao_code}`;
    if (layer.id === 'waypoints-layer') return `deck-wp-${p.waypoint_name}`;
    if (layer.id === 'navaids-layer') return `deck-nav-${p.ident}`;
    if (layer.id.startsWith('atsRoutes-geom-layer'))
      return `deck-ats-geom-${p.route_id}-${p.sequence_number}`;
    if (layer.id.startsWith('atsRoutes-waypoints-layer')) return `deck-ats-wp-${p.waypoint_name}`;
    return `deck-obj-${layer.id}-${object.id || JSON.stringify(p)}`;
  }
  return getMapLibreHoverKey(mapRef, x, y);
}

// ── Tooltip Builders ────────────────────────────────────────────────────────

// fallow-ignore-next-line complexity
function getAerodromeTooltip(p: any, indexedMetadata: IndexedMetadata | null) {
  let enrouteElev = p.elevation;

  if (!enrouteElev && indexedMetadata && indexedMetadata.elevation != null) {
    enrouteElev = indexedMetadata.elevation;
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
  indexedMetadata: IndexedMetadata | null,
  isFirst: boolean,
): string {
  const p = feature.properties ?? {};
  const name = p.name || p.feature_name || 'FEATURE';
  const category = p.category || p.feature_category || 'UNKNOWN';

  let elev = p.height ?? p.elevation_m ?? p.elevation ?? null;

  if (elev == null && category === 'ARP' && indexedMetadata && indexedMetadata.elevationM != null) {
    elev = indexedMetadata.elevationM;
  }
  const elevFt = elev != null ? Number(elev) * 3.28084 : null;
  const elevStr = elevFt != null ? elevFt.toFixed(1) + ' FT' : 'N/A';

  let extraInfo = '';
  let categoryDisplay = category;

  if (indexedMetadata) {
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
    } else if (category === 'OBSTACLE') {
      let bestObs = null;
      const list: IndexedObstacle[] = [];
      const lowerName = name.toLowerCase().trim();
      for (const [typeKey, obsList] of indexedMetadata.obstaclesByType.entries()) {
        if (lowerName.includes(typeKey) || typeKey.includes(lowerName)) {
          list.push(...obsList);
        }
      }

      if (list.length > 0) {
        if (elev != null) {
          const targetElevM = parseFloat(elev);
          let minDiff = 2.0;

          for (const o of list) {
            if (o.elevationM == null) continue;
            const diff = Math.abs(o.elevationM - targetElevM);
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
        if (!bestObs) {
          bestObs = list[0];
        }
      }
      if (bestObs) {
        extraInfo = `${divider}${row('Area Affected', bestObs.area_affected)}${row('Lgt/Marking', bestObs.marking_lgt)}${row('Remarks', bestObs.remarks)}</div>`;
      }
    } else if (category === 'NAVAID' || category === 'NAV') {
      let bestMatch = null;
      const nameParts = name.toUpperCase().split(/\s+/);
      for (const part of nameParts) {
        const list = indexedMetadata.navaidsByIdent.get(part);
        if (list && list.length > 0) {
          let highestScore = 0;
          for (const n of list) {
            const typeStr = n.type_of_aid?.split('\n')[0]?.trim().toUpperCase();
            let score = 2;
            if (typeStr) {
              const typeParts = typeStr.split(/\s+/);
              let matchCount = 0;
              for (const tp of typeParts) {
                if (nameParts.includes(tp)) matchCount++;
              }
              score += matchCount / Math.max(typeParts.length, 1);
            }
            if (score > highestScore) {
              highestScore = score;
              bestMatch = n;
            }
          }
          if (bestMatch) break;
        }
      }
      if (!bestMatch) {
        let highestScore = 0;
        for (const [ident, list] of indexedMetadata.navaidsByIdent.entries()) {
          for (const n of list) {
            const typeStr = n.type_of_aid?.split('\n')[0]?.trim().toUpperCase();
            const combined = `${ident} ${typeStr || ''}`.trim().toUpperCase();
            if (combined.includes(name.toUpperCase())) {
              const score = 0.5;
              if (score > highestScore) {
                highestScore = score;
                bestMatch = n;
              }
            }
          }
        }
      }
      if (bestMatch) {
        extraInfo = `${divider}${row('Freq', bestMatch.frequency_channel)}${row('Hours', bestMatch.hours_of_operation)}${row('Remarks', bestMatch.remarks)}</div>`;
      }
    } else if (category === 'RUNWAY_THRESHOLD' || category === 'RUNWAY') {
      const rwyNum = name.replace(/[^0-9]/g, '');
      const rwy = indexedMetadata.runwaysByDesignator.get(rwyNum);
      if (rwy) {
        extraInfo = `${divider}${row('Dimensions', rwy.dimensions)}${row('Surface/Strength', rwy.strength_and_surface)}</div>`;
      }
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

function getMapLibreTooltip(features: any[], indexedMetadata: IndexedMetadata | null) {
  let htmlContent = '';
  const maxFeatures = Math.min(features.length, 3);

  for (let k = 0; k < maxFeatures; k++) {
    const feature = features[k];
    if (!feature) continue;
    htmlContent += buildMapLibreFeatureTooltip(feature, indexedMetadata, k === 0);
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
    (info: any) => {
      const { object, layer, x, y } = info;
      const { activeAerodromeMetadata, activeLayers, selectedRouteIds } = useMapStore.getState();

      if (activeLayers.weather) return null;

      // 1. Check hover cache to avoid redundant work on micro-movements
      const hoverKey = getHoverKey(info, mapRef);
      if (hoverKey && hoverKey === lastHoveredKey) {
        return lastHoveredTooltip;
      }

      // If hoverKey is empty or changing to empty space, clear cache
      if (!hoverKey) {
        lastHoveredKey = '';
        lastHoveredTooltip = null;
        return null;
      }

      const indexedMetadata = getOrCreateIndexedMetadata(activeAerodromeMetadata);

      let tooltipResult: { html: string } | null = null;

      if (object && layer?.id === 'aerodromes-layer') {
        tooltipResult = getAerodromeTooltip(object.properties ?? {}, indexedMetadata);
      } else if (object && layer?.id === 'waypoints-layer') {
        tooltipResult = getWaypointTooltip(object.properties ?? {});
      } else if (object && layer?.id === 'navaids-layer') {
        tooltipResult = getNavaidTooltip(object.properties ?? {});
      } else if (object && layer?.id && String(layer.id).startsWith('atsRoutes-geom-layer')) {
        tooltipResult = getAtsRouteGeomTooltip(
          object.properties ?? {},
          activeLayers,
          selectedRouteIds,
        );
      } else if (object && layer?.id && String(layer.id).startsWith('atsRoutes-waypoints-layer')) {
        tooltipResult = getAtsRouteWaypointTooltip(
          object.properties ?? {},
          activeLayers,
          selectedRouteIds,
        );
      } else {
        // Fallback: query MapLibre rendered features (terminal 3D view)
        const map = mapRef.current?.getMap();
        if (map && x !== undefined && y !== undefined) {
          try {
            const currentLayers = map.getStyle()?.layers?.map((l: any) => l.id) || [];
            const safeLayers = ['mvt-points', 'mvt-polygons'].filter((l) =>
              currentLayers.includes(l),
            );

            if (safeLayers.length > 0) {
              const features = map.queryRenderedFeatures([x, y], {
                layers: safeLayers,
              });
              if (features && features.length > 0) {
                tooltipResult = getMapLibreTooltip(features, indexedMetadata);
              }
            }
          } catch (e) {
            /* Map not fully loaded */
          }
        }
      }

      // Update cache
      lastHoveredKey = hoverKey;
      lastHoveredTooltip = tooltipResult;
      return tooltipResult;
    },
    [mapRef],
  );

  return getTooltip;
}
