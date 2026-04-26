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
  fetchAerodromeMetadata,
  fetchAerodromeSection,
  fetchWeather,
  fetchNotams,
  fetchDaylight,
  fetchAtsRouteLabels,
  fetchNavaidDetails,
} from '../../api/client';

describe('API Client Functions', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  // --- ApiError ---
  it('should throw ApiError with correct properties on failed get()', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not Found Body'),
    });

    await expect(fetchAerodromes()).rejects.toMatchObject({
      status: 404,
      path: '/aerodromes',
      body: 'Not Found Body',
    });
  });

  // --- SearchAll ---
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

  it('should handle API errors for searchAll and return []', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server Error'),
    });

    const result = await searchAll('VOMF');
    expect(result).toEqual([]);
  });

  it('should bubble up AbortError in searchAll', async () => {
    const abortError = new Error('Abort');
    abortError.name = 'AbortError';
    (global.fetch as any).mockRejectedValueOnce(abortError);

    await expect(searchAll('VOMF')).rejects.toThrow('Abort');
  });

  // --- Aerodromes ---
  it('should fetchAerodromeMetadata and handle missing aip_document', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { some: 'value' } }),
    });
    const result = await fetchAerodromeMetadata('VOBM');
    expect(result).toEqual({ data: { some: 'value' } });
  });

  it('should fetchAerodromeMetadata and return aip_document', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ aip_document: { doc: 'value' } }),
    });
    const result = await fetchAerodromeMetadata('VOBM');
    expect(result).toEqual({ doc: 'value' });
  });

  it('should fetchAerodromeMetadata and return null on 404', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await fetchAerodromeMetadata('VOBM');
    expect(result).toBeNull();
  });

  it('should fetchAerodromeMetadata and return null on empty data', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    const result = await fetchAerodromeMetadata('VOBM');
    expect(result).toBeNull();
  });

  // --- fetchAerodromeSection ---
  it('should fetchAerodromeSection correctly', async () => {
    const mockSection = { section_id: 'AD 2.1', title: 'Location', data_type: 'table', data: [] };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSection),
    });

    const result = await fetchAerodromeSection('VOBM', 'AD 2.1');
    expect(result).toEqual(mockSection);
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/aerodromes/VOBM/section/AD 2.1');
  });

  it('should return default object on 404 for fetchAerodromeSection', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await fetchAerodromeSection('VOBM', 'AD 2.1');
    expect(result).toEqual({
      section_id: 'AD 2.1',
      title: 'No Data for This Section',
      data_type: 'object',
      data: null,
    });
  });

  it('should throw ApiError on 500 for fetchAerodromeSection', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(fetchAerodromeSection('VOBM', 'AD 2.1')).rejects.toThrow(ApiError);
  });

  // --- Charts ---
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

  it('should return [] on chart fetch failure', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve(''),
    });
    const result = await fetchCharts('VOBM');
    expect(result).toEqual([]);
  });

  // --- Weather & Notams ---
  it('should fetchWeather returning data', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ metar: 'METAR ...' }),
    });
    const res = await fetchWeather('VOBM');
    expect(res).toEqual({ metar: 'METAR ...' });
  });

  it('should fetchNotams returning data', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ notam_id: 'A123' }]),
    });
    const res = await fetchNotams('VOBM');
    expect(res).toEqual([{ notam_id: 'A123' }]);
  });

  it('should fetchNotams returning [] on non-ok', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 400 });
    const res = await fetchNotams('VOBM');
    expect(res).toEqual([]);
  });

  it('should fetchNotams returning [] on network error', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network Error'));
    const res = await fetchNotams('VOBM');
    expect(res).toEqual([]);
  });

  it('should fetchDaylight returning record', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ records: [{ sunrise: '06:00' }] }),
    });
    const res = await fetchDaylight('VOBM', '2023-10-10');
    expect(res).toEqual({ sunrise: '06:00' });
  });

  it('should fetchDaylight returning null on missing records', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    const res = await fetchDaylight('VOBM', '2023-10-10');
    expect(res).toBeNull();
  });

  // --- ATS Routes ---
  it('should fetchAtsRouteLabels returning data', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ type: 'FeatureCollection' }),
    });
    const res = await fetchAtsRouteLabels();
    expect(res).toEqual({ type: 'FeatureCollection' });
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

  // --- Navaids ---
  it('should fetchNavaidDetails returning data', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ident: 'BIA' }),
    });
    const res = await fetchNavaidDetails('BIA');
    expect(res).toEqual({ ident: 'BIA' });
  });

  // --- RNP Procedures ---
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

  // --- Proxy PDF ---
  it('should generate proxy PDF URL with correct v1 prefix', () => {
    const originalUrl = 'https://example.com/chart.pdf';
    const proxyUrl = getProxyPdfUrl(originalUrl);
    expect(proxyUrl).toBe(`/api/v1/proxy-pdf?url=${encodeURIComponent(originalUrl)}`);
  });
});

describe('Regressions', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('should throw ApiError automatically inside get() for failed aerodromes fetch', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not Found'),
    });

    await expect(fetchAerodromes()).rejects.toThrow(ApiError);
  });
});
