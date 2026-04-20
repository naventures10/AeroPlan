/**
 * Hook to fetch and cache the 3D path data for a selected RNP procedure.
 *
 * Returns the path, timestamps, and waypoints needed by TripsLayer, or null
 * if no procedure is selected / still loading.
 */

import { useState, useEffect, useRef } from 'react';
import { fetchRnpPath3d } from '../../../api/client';
import type { RnpPath3d } from '../../../types';

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
        const json = await fetchRnpPath3d(procedureId);
        if (!json) {
          if (!cancelled) setData(null);
          return;
        }
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
