import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchAerodromes,
  searchAll,
  fetchAtsRouteDetails,
  fetchCharts,
  fetchRnpProcedures,
  fetchRnpPath3d,
  getProxyPdfUrl,
  ApiError,
} from '../api/client';

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
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/search?q=VOMF', expect.any(Object));
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
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/ats-routes/G333/details');
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

describe('New API Client Methods (Regressions)', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('should fetch charts with correct v1 prefix', async () => {
    const mockCharts = [{ chart_id: 1, chart_title: 'ADC' }];
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCharts),
    });

    const result = await fetchCharts('VOBM');
    expect(result).toEqual(mockCharts);
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/aerodromes/VOBM/charts', expect.any(Object));
  });

  it('should fetch RNP procedures with correct v1 prefix', async () => {
    const mockProcs = [{ procedure_id: 1, name: 'RNP Y RWY 09' }];
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProcs),
    });

    const result = await fetchRnpProcedures('VOBM');
    expect(result).toEqual(mockProcs);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/aerodromes/VOBM/rnp-procedures',
      expect.any(Object),
    );
  });

  it('should fetch RNP Path 3D with correct v1 prefix', async () => {
    const mockPath = { procedure_id: 1, name: 'Path' };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPath),
    });

    const result = await fetchRnpPath3d(123);
    expect(result).toEqual(mockPath);
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/rnp-procedures/123/path3d');
  });

  it('should generate proxy PDF URL with correct v1 prefix', () => {
    const originalUrl = 'https://example.com/chart.pdf';
    const proxyUrl = getProxyPdfUrl(originalUrl);
    expect(proxyUrl).toBe(`/api/v1/proxy-pdf?url=${encodeURIComponent(originalUrl)}`);
  });
});
