/**
 * Drives the TripsLayer animation for the RNP approach path.
 *
 * Returns a continuously incrementing `currentTime` (in NM) that loops
 * from 0 → totalDistanceNm, creating the animated descent effect.
 */

import { useState, useEffect, useRef } from 'react';

const SPEED_NM_PER_SEC = 2.5; // animation speed — NM per second of wall time

export function useRnpAnimation(totalDistanceNm: number | null): number {
  const [currentTime, setCurrentTime] = useState(0);
  const rafRef = useRef<number | null>(null);
  const prevTs = useRef<number | null>(null);

  useEffect(() => {
    if (totalDistanceNm == null || totalDistanceNm <= 0) {
      setCurrentTime(0);
      prevTs.current = null;
      return;
    }

    let cancelled = false;
    prevTs.current = null;

    const animate = (ts: number) => {
      if (cancelled) return;

      if (prevTs.current != null) {
        const dt = (ts - prevTs.current) / 1000; // seconds
        setCurrentTime((prev) => {
          const next = prev + dt * SPEED_NM_PER_SEC;
          return next > totalDistanceNm ? 0 : next; // loop
        });
      }
      prevTs.current = ts;
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [totalDistanceNm]);

  return currentTime;
}
