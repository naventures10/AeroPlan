import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAerodromes, searchAll, fetchAtsRouteDetails, ApiError } from '../api/client';

describe('API Client Functions', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('should handle successful responses for searchAll', async () => {
    const mockData = [{ id: 'VOMF', text: 'Chennai' }];
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await searchAll('VOMF');
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith('/api/search?q=VOMF', expect.any(Object));
  });

  it('should throw ApiError automatically inside get() for failed aerodromes fetch', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server Error'),
    });

    await expect(fetchAerodromes()).rejects.toThrow(ApiError);
  });

  it('should fetch ATS route details and return correctly typed data', async () => {
    const mockDetails = {
      route_id: 'G333',
      route_designator: 'G333 (DPN-MERUN)',
      route_type: 'CONVENTIONAL',
      total_distance_nm: 257.5,
      waypoints: [{ sequence_number: 1, waypoint_name: 'DELHI DVOR' }],
      segments: [{ sequence_number: 1, moca: '2700 FT', distance_nm: 24.9 }],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDetails),
    });

    const result = await fetchAtsRouteDetails('G333');
    expect(result).toEqual(mockDetails);
    expect(global.fetch).toHaveBeenCalledWith('/api/ats-routes/G333/details');
  });

  it('should return null when fetchAtsRouteDetails 404s', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await fetchAtsRouteDetails('NONEXISTENT');
    expect(result).toBeNull();
  });
});
