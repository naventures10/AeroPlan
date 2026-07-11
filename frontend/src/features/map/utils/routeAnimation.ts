// fallow-ignore-next-line complexity
function parsePart(part: string): number {
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
}

export function parseDMS(dms: string): [number, number] {
  if (!dms) return [0, 0];
  const parts = dms.trim().split(/\s+/);
  if (parts.length !== 2) return [0, 0];

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

function findClickedWaypointIndex(
  segments: any[],
  name: string,
): { index: number; isFrom: boolean } {
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].from_waypoint === name) return { index: i, isFrom: true };
    if (segments[i].to_waypoint === name) return { index: i, isFrom: false };
  }
  return { index: -1, isFrom: true };
}

function buildForwardTrip(segments: any[], routeData: any, clickedIndex: number, isFrom: boolean) {
  const forwardPath: [number, number, number][] = [];
  let distance = 0;
  const startSeg = segments[clickedIndex];
  const startCoords = isFrom ? startSeg.from_coordinates : startSeg.to_coordinates;
  forwardPath.push([...parseDMS(startCoords), 0]);

  const startIdx = isFrom ? clickedIndex : clickedIndex + 1;
  for (let i = startIdx; i < segments.length; i++) {
    const seg = segments[i];
    distance += seg.distance_nm || 0;
    forwardPath.push([...parseDMS(seg.to_coordinates), distance]);
  }

  if (forwardPath.length <= 1) return null;
  return {
    trip: {
      route_id: routeData.route_id,
      route_type: routeData.route_type,
      path: forwardPath,
      path2d: forwardPath.map((p) => [p[0], p[1]] as [number, number]),
      timestamps: forwardPath.map((p) => p[2]),
    },
    distance,
  };
}

function buildBackwardTrip(segments: any[], routeData: any, clickedIndex: number, isFrom: boolean) {
  const backwardPath: [number, number, number][] = [];
  let distance = 0;
  const startSeg = segments[clickedIndex];
  const startCoords = isFrom ? startSeg.from_coordinates : startSeg.to_coordinates;
  backwardPath.push([...parseDMS(startCoords), 0]);

  const startIdx = isFrom ? clickedIndex - 1 : clickedIndex;
  for (let i = startIdx; i >= 0; i--) {
    const seg = segments[i];
    distance += seg.distance_nm || 0;
    backwardPath.push([...parseDMS(seg.from_coordinates), distance]);
  }

  if (backwardPath.length <= 1) return null;
  return {
    trip: {
      route_id: routeData.route_id,
      route_type: routeData.route_type,
      path: backwardPath,
      path2d: backwardPath.map((p) => [p[0], p[1]] as [number, number]),
      timestamps: backwardPath.map((p) => p[2]),
    },
    distance,
  };
}

function buildFullTrip(segments: any[], routeData: any) {
  let distance = 0;
  const path: [number, number, number][] = [];
  path.push([...parseDMS(segments[0].from_coordinates), 0]);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    distance += seg.distance_nm || 0;
    path.push([...parseDMS(seg.to_coordinates), distance]);
  }
  return {
    trips: [
      {
        route_id: routeData.route_id,
        route_type: routeData.route_type,
        path,
        path2d: path.map((p) => [p[0], p[1]] as [number, number]),
        timestamps: path.map((p) => p[2]),
      },
    ],
    maxDistance: distance,
  };
}

export function buildRouteAnimations(routeData: any, clickedWaypointName?: string) {
  const { segments } = routeData;
  if (!segments || segments.length === 0) return { trips: [], maxDistance: 0 };

  if (clickedWaypointName) {
    const { index, isFrom } = findClickedWaypointIndex(segments, clickedWaypointName);
    if (index !== -1) {
      const trips = [];
      let maxDistance = 0;

      const fwd = buildForwardTrip(segments, routeData, index, isFrom);
      if (fwd) {
        trips.push(fwd.trip);
        maxDistance = Math.max(maxDistance, fwd.distance);
      }

      const bwd = buildBackwardTrip(segments, routeData, index, isFrom);
      if (bwd) {
        trips.push(bwd.trip);
        maxDistance = Math.max(maxDistance, bwd.distance);
      }

      return { trips, maxDistance };
    }
  }

  return buildFullTrip(segments, routeData);
}
