/**
 * Hook to fetch and cache the 3D path data for a selected RNP procedure.
 *
 * Returns the path, timestamps, and waypoints needed by TripsLayer, or null
 * if no procedure is selected / still loading.
 */

import { useState, useEffect, useRef } from 'react';

export interface RnpWaypointMarker {
  name: string;
  position: [number, number, number]; // [lon, lat, alt_m]
  role: string | null;
}

export interface RnpPath3d {
  procedure_id: number;
  name: string;
  airport_id: string;
  runway: string;
  path: [number, number, number][]; // [lon, lat, alt_m][]
  timestamps: number[]; // cumulative NM
  total_distance_nm: number;
  waypoints: RnpWaypointMarker[];
}

export function useRnpPath3d(procedureId: number | null): RnpPath3d | null {
  const [data, setData] = useState<RnpPath3d | null>(null);
  const cache = useRef<Map<number, RnpPath3d>>(new Map());

  useEffect(() => {
    if (procedureId == null) {
      setData(null);
      return;
    }

    // Check cache first
    const cached = cache.current.get(procedureId);
    if (cached) {
      setData(cached);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/rnp-procedures/${procedureId}/path3d`);
        if (!res.ok) {
          console.error(`RNP path3d fetch failed: ${res.status}`);
          setData(null);
          return;
        }
        const json: RnpPath3d = await res.json();
        if (!cancelled) {
          cache.current.set(procedureId, json);
          setData(json);
        }
      } catch (err) {
        console.error('RNP path3d fetch error', err);
        if (!cancelled) setData(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [procedureId]);

  return data;
}
