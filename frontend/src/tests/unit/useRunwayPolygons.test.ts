import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRunwayPolygons } from '../../features/terminal/layers/terminal/useRunwayPolygons';
import { useMapStore } from '../../store/useMapStore';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useRunwayPolygons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMapStore.setState({
      activeAirport: 'VIDP',
      viewMode: 'TERMINAL',
    });
  });

  it('returns null if no airport or not in terminal mode', () => {
    useMapStore.setState({ activeAirport: null });
    const { result } = renderHook(() => useRunwayPolygons());
    expect(result.current).toBeNull();

    useMapStore.setState({ activeAirport: 'VIDP', viewMode: 'ENROUTE' });
    expect(result.current).toBeNull();
  });

  it('fetches runway data and builds polygons', async () => {
    const mockRunwayData = {
      data: [
        {
          designation: '10',
          coordinates: { decimal_lat: 28.56, decimal_lng: 77.08 },
          dimensions: '3810 x 45 M',
          thr_elevation: 'THR: 750FT',
        },
        {
          designation: '28',
          coordinates: { decimal_lat: 28.57, decimal_lng: 77.12 },
          dimensions: '3810 x 45 M',
          thr_elevation: 'THR: 760FT',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockRunwayData),
    });

    const { result } = renderHook(() => useRunwayPolygons());

    await waitFor(() => expect(result.current).not.toBeNull());

    const data = result.current!;
    expect(data.polygons.features.length).toBe(1);
    expect(data.labels.features.length).toBe(2);

    const feature = data.polygons.features[0];
    if (!feature) throw new Error('Expected feature');
    expect(feature.properties?.designation).toBe('10/28');
    const geom = feature.geometry;
    if (geom.type !== 'Polygon') throw new Error('Expected Polygon');

    const ring = geom.coordinates[0];
    if (!ring) throw new Error('Expected ring');

    expect(ring.length).toBeGreaterThan(5);
    expect(ring[0]).toEqual(ring[ring.length - 1]);

    // Check labels
    const label0 = data.labels.features[0];
    const label1 = data.labels.features[1];
    expect(label0?.properties?.label).toBe('10');
    expect(label1?.properties?.label).toBe('28');
  });

  it('handles reciprocal logic correctly (L/R swap)', async () => {
    const mockRunwayData = {
      data: [
        {
          designation: '09L',
          coordinates: { decimal_lat: 28.1, decimal_lng: 77.1 },
        },
        {
          designation: '27R',
          coordinates: { decimal_lat: 28.2, decimal_lng: 77.2 },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockRunwayData),
    });

    const { result } = renderHook(() => useRunwayPolygons());

    await waitFor(() => expect(result.current).not.toBeNull());
    const firstFeature = result.current?.polygons.features[0];
    expect(firstFeature?.properties?.designation).toBe('09L/27R');

    const firstLabel = result.current?.labels.features[0];
    expect(firstLabel?.properties?.label).toBe('09L');
  });

  it('returns null on fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Fetch failed'));
    const { result } = renderHook(() => useRunwayPolygons());

    await waitFor(() => {
      // Since error is caught and logged, result stays null
      expect(result.current).toBeNull();
    });
  });
});
