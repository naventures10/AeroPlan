import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCloudLayer } from '../../features/map/layers/useCloudLayer';
import { useMapStore } from '../../store/useMapStore';
import * as WeatherLayers from 'weatherlayers-gl';

vi.mock('weatherlayers-gl', () => ({
  setLibrary: vi.fn(),
  loadTextureData: vi.fn(),
}));

describe('useCloudLayer', () => {
  const defaultViewState = {
    longitude: 78.9629,
    latitude: 20.5937,
    zoom: 4.5,
    pitch: 0,
    bearing: 0,
    maxPitch: 60,
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    useMapStore.setState({
      isWeatherMode: true,
      isCloudMode: true,
      viewMode: 'ENROUTE',
      windAltitude: 0,
      windAnimationTime: 0,
      viewState: defaultViewState,
      forecastTimestamps: [],
      weatherStatus: { state: 'idle' },
      cloudLoadingStatus: { state: 'idle' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not fetch manifest if cloud layer is inactive', () => {
    useMapStore.setState({
      isWeatherMode: false,
      isCloudMode: false,
      forecastTimestamps: [],
    });

    const fetchSpy = vi.spyOn(global, 'fetch');
    renderHook(() => useCloudLayer());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should fetch manifest and set timestamps when active', async () => {
    const mockManifest = {
      forecasts: [
        {
          valid_time: '2023-01-01T12:00:00Z',
          files: { surface: 'http://test/cloud_0.tif' },
        },
      ],
    };

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (typeof url === 'string' && url.endsWith('.tif')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'image/tiff' },
        } as any);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockManifest),
      } as any);
    });

    renderHook(() => useCloudLayer());

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/weather/weather_manifest.json'),
      );
    });
  });

  it('should load texture data and generate cloud layers', async () => {
    const mockManifest = {
      forecasts: [
        {
          valid_time: '2023-01-01T12:00:00Z',
          files: { surface: 'http://test/cloud_0.tif' },
        },
        {
          valid_time: '2023-01-01T15:00:00Z',
          files: { surface: 'http://test/cloud_3.tif' },
        },
      ],
    };

    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (typeof url === 'string' && url.endsWith('.tif')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'image/tiff' },
        } as any);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockManifest),
      } as any);
    });

    // Mock texture data (e.g., 2x2 image, 8 bands, band 6 is TCC)
    const mockImg = {
      width: 2,
      height: 2,
      data: new Float32Array(2 * 2 * 8).fill(0),
    };
    mockImg.data[0 * 8 + 6] = 0.5; // Pixel 0
    mockImg.data[1 * 8 + 6] = 1.0; // Pixel 1
    mockImg.data[2 * 8 + 6] = 0.8; // Pixel 2
    mockImg.data[3 * 8 + 6] = 0.6; // Pixel 3

    (WeatherLayers.loadTextureData as any).mockResolvedValue(mockImg);

    const { result } = renderHook(() => useCloudLayer());

    await waitFor(() => {
      expect(useMapStore.getState().cloudLoadingStatus.state).toBe('ready');
      expect(result.current.cloudLayers).toHaveLength(1);
      const activeIdx = Math.floor(useMapStore.getState().windAnimationTime);
      expect(result.current.cloudLayers[0]?.id).toBe(`cloud-volume-a-${activeIdx}`);
    });
  });

  it('should handle fetch errors gracefully', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Fetch failed'));

    renderHook(() => useCloudLayer());

    await waitFor(() => {
      expect(useMapStore.getState().cloudLoadingStatus.state).toBe('error');
    });
  });

  it('should respect the hard particle cap', async () => {
    const mockManifest = {
      forecasts: [
        {
          valid_time: '2023-01-01T12:00:00Z',
          files: { surface: 'http://test/cloud_0.tif' },
        },
      ],
    };

    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (typeof url === 'string' && url.endsWith('.tif')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'image/tiff' },
        } as any);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockManifest),
      } as any);
    });

    const w = 640;
    const h = 360;
    const bands = 8;
    const data = new Float32Array(w * h * bands);
    for (let p = 0; p < w * h; p++) {
      data[p * bands + 6] = 1.0; // 100% cloud cover
    }
    const mockImg = { width: w, height: h, data };

    (WeatherLayers.loadTextureData as any).mockResolvedValue(mockImg);

    const { result } = renderHook(() => useCloudLayer());

    await waitFor(() => {
      expect(useMapStore.getState().cloudLoadingStatus.state).toBe('ready');
      expect(result.current.cloudLayers).toHaveLength(1);
    });
  });
});
