import { describe, it, expect } from 'vitest';
import {
  parseDMS,
  getDistanceNm,
  buildRouteAnimations,
} from '../../features/map/utils/routeAnimation';

describe('routeAnimation Utils', () => {
  describe('parseDMS', () => {
    it('should parse valid DMS coordinates correctly', () => {
      // VABB coordinates approx
      const dms = '190519N 0725205E';
      const [lng, lat] = parseDMS(dms);
      expect(lat).toBeCloseTo(19.0886, 4);
      expect(lng).toBeCloseTo(72.8681, 4);
    });

    it('should parse 7-digit longitude and 6-digit latitude correctly', () => {
      const dms = '200000N 1000000E';
      const [lng, lat] = parseDMS(dms);
      expect(lat).toBe(20.0);
      expect(lng).toBe(100.0);
    });

    it('should handle S and W directions', () => {
      const dms = '200000S 1000000W';
      const [lng, lat] = parseDMS(dms);
      expect(lat).toBe(-20.0);
      expect(lng).toBe(-100.0);
    });

    it('should return [0, 0] for invalid input', () => {
      expect(parseDMS('')).toEqual([0, 0]);
      expect(parseDMS('INVALID')).toEqual([0, 0]);
    });

    it('should handle short numStr using fallback parsing', () => {
      // numStr.length < 6 for lat or < 7 for lng
      const dms = '01N 01E';
      const [lng, lat] = parseDMS(dms);
      expect(lat).toBeCloseTo(0.0002777, 6); // 1 second
      expect(lng).toBeCloseTo(0.0002777, 6);
    });
  });

  describe('getDistanceNm', () => {
    it('should calculate distance correctly between two points', () => {
      // Distance between (0,0) and (1,0) should be 60nm approx
      const dist = getDistanceNm(0, 0, 1, 0);
      expect(dist).toBeCloseTo(60, 0);
    });
  });

  describe('buildRouteAnimations', () => {
    const mockRouteData = {
      route_id: 'J1',
      route_type: 'ATS',
      segments: [
        {
          from_waypoint: 'W1',
          to_waypoint: 'W2',
          from_coordinates: '100000N 0700000E',
          to_coordinates: '110000N 0710000E',
          distance_nm: 60,
        },
        {
          from_waypoint: 'W2',
          to_waypoint: 'W3',
          from_coordinates: '110000N 0710000E',
          to_coordinates: '120000N 0720000E',
          distance_nm: 60,
        },
      ],
    };

    it('should build full route animation by default', () => {
      const result = buildRouteAnimations(mockRouteData);
      expect(result.trips).toHaveLength(1);
      expect(result.trips[0]!.path).toHaveLength(3);
      expect(result.maxDistance).toBe(120);
    });

    it('should radiate from a clicked waypoint (middle)', () => {
      const result = buildRouteAnimations(mockRouteData, 'W2');
      expect(result.trips).toHaveLength(2); // One forward, one backward
      expect(result.trips[0]!.path).toHaveLength(2); // W2 to W3
      expect(result.trips[1]!.path).toHaveLength(2); // W2 to W1
      expect(result.maxDistance).toBe(60);
    });

    it('should radiate from a clicked waypoint (start)', () => {
      const result = buildRouteAnimations(mockRouteData, 'W1');
      expect(result.trips).toHaveLength(1); // Only forward
      expect(result.trips[0]!.path[0]![0]).toBeCloseTo(70, 0);
      expect(result.maxDistance).toBe(120);
    });

    it('should radiate from a clicked waypoint (end)', () => {
      const result = buildRouteAnimations(mockRouteData, 'W3');
      expect(result.trips).toHaveLength(1); // Only backward
      expect(result.trips[0]!.path).toHaveLength(3); // W3 to W1 via W2
      expect(result.maxDistance).toBe(120);
    });

    it('should return empty trips if no segments', () => {
      expect(buildRouteAnimations({ segments: [] })).toEqual({ trips: [], maxDistance: 0 });
    });
  });
});
