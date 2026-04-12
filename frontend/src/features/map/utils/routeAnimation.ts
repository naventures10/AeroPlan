export function parseDMS(dms: string): [number, number] {
  if (!dms) return [0, 0];
  const parts = dms.trim().split(/\s+/);
  if (parts.length !== 2) return [0, 0];

  const parsePart = (part: string) => {
    const dir = part.slice(-1).toUpperCase();
    const isLng = dir === 'E' || dir === 'W';
    const numStr = part.slice(0, -1);
    let d = 0,
      m = 0,
      s = 0;

    if (numStr.length === 6 && !isLng) {
      d = parseInt(numStr.substring(0, 2), 10);
      m = parseInt(numStr.substring(2, 4), 10);
      s = parseInt(numStr.substring(4, 6), 10);
    } else if (numStr.length === 7 && isLng) {
      d = parseInt(numStr.substring(0, 3), 10);
      m = parseInt(numStr.substring(3, 5), 10);
      s = parseInt(numStr.substring(5, 7), 10);
    } else {
      s = parseInt(numStr.slice(-2), 10) || 0;
      m = parseInt(numStr.slice(-4, -2), 10) || 0;
      d = parseInt(numStr.slice(0, -4), 10) || 0;
    }
    let dec = d + m / 60 + s / 3600;
    if (dir === 'S' || dir === 'W') dec = -dec;
    return dec;
  };

  return [parsePart(parts[1] || ''), parsePart(parts[0] || '')]; // [lng, lat]
}

export function getDistanceNm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3440.065; // Radius of the Earth in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function buildRouteAnimations(routeData: any, clickedWaypointName?: string) {
  const { segments } = routeData;
  if (!segments || segments.length === 0) return { trips: [], maxDistance: 0 };

  // If a specific waypoint was clicked, radiate outwards from it
  if (clickedWaypointName) {
    let clickedIndex = -1;
    let clickedIsFrom = true;

    for (let i = 0; i < segments.length; i++) {
      if (segments[i].from_waypoint === clickedWaypointName) {
        clickedIndex = i;
        clickedIsFrom = true;
        break;
      }
      if (segments[i].to_waypoint === clickedWaypointName) {
        clickedIndex = i;
        clickedIsFrom = false;
        break;
      }
    }

    if (clickedIndex !== -1) {
      const trips = [];
      let maxDistance = 0;

      // Trip 1: Forward from clicked waypoint
      const forwardPath = [];
      let currentForwardDistance = 0;

      const startForwSeg = segments[clickedIndex];
      const startForwCoords = clickedIsFrom
        ? startForwSeg.from_coordinates
        : startForwSeg.to_coordinates;
      forwardPath.push([...parseDMS(startForwCoords), 0]);

      const forwardStartIdx = clickedIsFrom ? clickedIndex : clickedIndex + 1;
      for (let i = forwardStartIdx; i < segments.length; i++) {
        const seg = segments[i];
        const dist = seg.distance_nm || 0;
        currentForwardDistance += dist;
        forwardPath.push([...parseDMS(seg.to_coordinates), currentForwardDistance]);
      }

      if (forwardPath.length > 1) {
        trips.push({
          route_id: routeData.route_id,
          route_type: routeData.route_type,
          path: forwardPath,
        });
        maxDistance = Math.max(maxDistance, currentForwardDistance);
      }

      // Trip 2: Backward from clicked waypoint
      const backwardPath = [];
      let currentBackwardDistance = 0;

      const startBackCoords = clickedIsFrom
        ? startForwSeg.from_coordinates
        : startForwSeg.to_coordinates;
      backwardPath.push([...parseDMS(startBackCoords), 0]);

      const backwardStartIdx = clickedIsFrom ? clickedIndex - 1 : clickedIndex;
      for (let i = backwardStartIdx; i >= 0; i--) {
        const seg = segments[i];
        const dist = seg.distance_nm || 0;
        currentBackwardDistance += dist;
        backwardPath.push([...parseDMS(seg.from_coordinates), currentBackwardDistance]);
      }

      if (backwardPath.length > 1) {
        trips.push({
          route_id: routeData.route_id,
          route_type: routeData.route_type,
          path: backwardPath,
        });
        maxDistance = Math.max(maxDistance, currentBackwardDistance);
      }

      return { trips, maxDistance };
    }
  }

  // Fallback / ATS Route clicked: Animate the full route from start to end
  const trips = [];
  let currentForwardDistance = 0;
  const forwardPath = [];

  forwardPath.push([...parseDMS(segments[0].from_coordinates), 0]);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const dist = seg.distance_nm || 0;
    currentForwardDistance += dist;
    forwardPath.push([...parseDMS(seg.to_coordinates), currentForwardDistance]);
  }

  trips.push({
    route_id: routeData.route_id,
    route_type: routeData.route_type,
    path: forwardPath,
  });

  return { trips, maxDistance: currentForwardDistance };
}
