import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useWindLayer } from '../../features/map/layers/useWindLayer';
import { useMapStore } from '../../store/useMapStore';
import * as WeatherLayers from 'weatherlayers-gl';

// Mock weatherlayers-gl functions
vi.mock('weatherlayers-gl', () => ({
  loadTextureData: vi.fn(),
  ParticleLayer: vi.fn().mockImplementation(function () {
    return { id: 'mock-layer' };
  }),
}));

vi.mock('@deck.gl/extensions', () => ({
  ClipExtension: vi.fn().mockImplementation(function () {
    return { id: 'clip-extension' };
  }),
}));

describe('useWindLayer', () => {
  const mockManifest = {
    forecasts: [
      {
        valid_time: '2026-04-28T12:00:00Z',
        files: {
          surface: 'url-sfc-12',
          '050': 'url-050-12',
        },
      },
      {
        valid_time: '2026-04-28T15:00:00Z',
        files: {
          surface: 'url-sfc-15',
          '050': 'url-050-15',
        },
      },
    ],
  };

  const mockTextureData = {
    width: 2,
    height: 2,
    data: new Float32Array([10, 0, 10, 0, 10, 0, 10, 0]), // u=10, v=0
  };

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockManifest),
        }),
      ),
    );

    (WeatherLayers.loadTextureData as any).mockResolvedValue(mockTextureData);

    useMapStore.setState({
      isWeatherMode: true,
      isWindMode: true,
      viewMode: 'ENROUTE',
      windAltitude: 0,
      windAnimationTime: 0,
      windIsPlaying: false,
      forecastTimestamps: [],
      weatherStatus: { state: 'idle' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch manifest and set timestamps when wind is active', async () => {
    const { result } = renderHook(() => useWindLayer());

    await waitFor(
      () => {
        expect(result.current.forecastTimestamps.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );

    expect(result.current.forecastTimestamps[0]!.label).toContain('5:30');
    expect(result.current.windStatus.state).toBe('ready');
  });

  it('should handle fetch error gracefully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('API Error'))),
    );

    const { result } = renderHook(() => useWindLayer());

    await waitFor(
      () => {
        expect(result.current.windStatus.state).toBe('error');
      },
      { timeout: 3000 },
    );
    expect(result.current.windStatus.message).toBe('Failed to load weather manifest');
  });

  it('should load textures when altitude changes', async () => {
    const { result, rerender } = renderHook(() => useWindLayer());

    await waitFor(
      () => {
        expect(result.current.windStatus.state).toBe('ready');
      },
      { timeout: 3000 },
    );

    expect(WeatherLayers.loadTextureData).toHaveBeenCalledWith('url-sfc-12');

    act(() => {
      useMapStore.setState({ windAltitude: 50 });
    });

    rerender();

    await waitFor(
      () => {
        expect(WeatherLayers.loadTextureData).toHaveBeenCalledWith('url-050-12');
      },
      { timeout: 3000 },
    );
  });

  it('should calculate wind speed and direction correctly', async () => {
    const { result } = renderHook(() => useWindLayer());

    await waitFor(
      () => {
        expect(result.current.windStatus.state).toBe('ready');
      },
      { timeout: 3000 },
    );

    const wind = result.current.getWindAtLngLat(77, 28);

    expect(wind).not.toBeNull();
    if (wind) {
      expect(wind.speed).toBeCloseTo(19.4384, 1);
      expect(wind.direction).toBe(270);
    }
  });

  it('should not fetch or load if windlayer is inactive', async () => {
    useMapStore.setState({ isWeatherMode: false, isWindMode: false });
    const { result } = renderHook(() => useWindLayer());

    // Wait a bit to ensure useEffect didn't run
    await new Promise((r) => setTimeout(r, 200));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.forecastTimestamps.length).toBe(0);
  });
});
