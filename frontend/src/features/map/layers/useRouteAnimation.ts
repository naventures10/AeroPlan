/**
 * Route Animation Hook
 *
 * Encapsulates the three side-effect hooks that were previously inlined
 * in useDeckLayers:
 *
 *  1. requestAnimationFrame ticker — drives `currentTime`
 *  2. Data fetcher — loads route details and builds trip geometry
 *  3. ATS render toggle — delays hide so exit-transitions finish
 *
 * Returns `{ isAtsRendered, currentTime }` for the layer compositor.
 */

import { useState, useEffect } from 'react';
import { useMapStore } from '../../../store/useMapStore';
import { buildRouteAnimations } from '../utils/routeAnimation';
import { fetchAtsRouteDetails } from '../../../api/client';

export function useRouteAnimation() {
  const {
    activeLayers,
    selectedRouteIds,
    selectedFeature,
    setAnimatedTrips,
    animationConfig,
    setAnimationConfig,
  } = useMapStore();

  const [isAtsRendered, setIsAtsRendered] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // ── 1. Animation Loop ──────────────────────────────────────────────

  useEffect(() => {
    let animationFrame: number;
    let lastTime = 0;

    const animate = (time: number) => {
      if (!lastTime) lastTime = time;
      const deltaTime = time - lastTime;

      if (animationConfig?.playing && animationConfig.duration > 0) {
        // Full sweep over 5000ms (5 seconds) for a slow, cinematic effect
        const speed = animationConfig.duration / 5000;
        setCurrentTime((prev) => {
          const next = prev + deltaTime * speed;
          // Add a 20% delay buffer after full sweep to let glow fade before looping
          return next % (animationConfig.duration * 1.2);
        });
      }
      lastTime = time;
      animationFrame = requestAnimationFrame(animate);
    };

    if (animationConfig?.playing) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      setCurrentTime(0);
    }

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [animationConfig]);

  // ── 2. Route Data Fetcher ──────────────────────────────────────────

  useEffect(() => {
    let isCancelled = false;

    if (
      (selectedFeature?.type === 'WAYPOINT' || selectedFeature?.type === 'ATS_ROUTE') &&
      selectedRouteIds.length > 0
    ) {
      const fetchRoutes = async () => {
        try {
          const promises = selectedRouteIds.map((id) => fetchAtsRouteDetails(id));
          const results = await Promise.all(promises);
          if (isCancelled) return;

          const allTrips: any[] = [];
          let globalMax = 0;

          results.forEach((routeData) => {
            if (!routeData || !routeData.segments) return;
            const { trips, maxDistance } = buildRouteAnimations(
              routeData,
              selectedFeature?.type === 'WAYPOINT' ? selectedFeature.data.waypoint_name : undefined,
            );
            allTrips.push(...trips);
            if (maxDistance > globalMax) globalMax = maxDistance;
          });

          setAnimatedTrips(allTrips);
          setAnimationConfig({ playing: true, duration: globalMax });
        } catch (e) {
          console.error('Failed to build ATS routes animation', e);
        }
      };
      // adding slight debounce so layer updates prioritize click event handling
      setTimeout(fetchRoutes, 50);
    } else {
      setAnimatedTrips([]);
      setAnimationConfig(null);
    }

    return () => {
      isCancelled = true;
    };
  }, [selectedFeature, selectedRouteIds, setAnimatedTrips, setAnimationConfig]);

  // ── 3. ATS Render Toggle (delayed hide for exit transitions) ───────

  useEffect(() => {
    if (activeLayers.atsRoutes || selectedRouteIds.length > 0) {
      setIsAtsRendered(true);
    } else {
      const timer = setTimeout(() => {
        setIsAtsRendered(false);
      }, 300);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [activeLayers.atsRoutes, selectedRouteIds.length]);

  return { isAtsRendered, currentTime };
}
