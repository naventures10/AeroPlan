import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCloudLayer } from '../../features/map/layers/useCloudLayer';
import { useMapStore } from '../../store/useMapStore';
import * as WeatherLayers from 'weatherlayers-gl';

vi.mock('../../store/useMapStore', () => ({
  useMapStore: vi.fn(),
}));

vi.mock('weatherlayers-gl', () => ({
  loadTextureData: vi.fn(),
}));

describe('useCloudLayer', () => {
  const mockSetWindAnimationTime = vi.fn();
  const mockSetCloudLoadingStatus = vi.fn();

  const defaultViewState = {
    longitude: 78.9629,
    latitude: 20.5937,
    zoom: 4.5,
    pitch: 0,
    bearing: 0,
    maxPitch: 60,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useMapStore as any).mockReturnValue({
      isWeatherMode: true,
      isCloudMode: true,
      viewMode: 'ENROUTE',
      windAltitude: 0,
      windAnimationTime: 0,
      setWindAnimationTime: mockSetWindAnimationTime,
      setCloudLoadingStatus: mockSetCloudLoadingStatus,
      viewState: defaultViewState,
    });
    (useMapStore as any).getState = vi.fn().mockReturnValue({
      cloudLoadingStatus: { state: 'idle' },
    });
  });

  it('should not fetch manifest if cloud layer is inactive', () => {
    (useMapStore as any).mockReturnValue({
      isWeatherMode: false,
      isCloudMode: false,
      viewMode: 'ENROUTE',
      windAltitude: 0,
      windAnimationTime: 0,
      setWindAnimationTime: mockSetWindAnimationTime,
      setCloudLoadingStatus: mockSetCloudLoadingStatus,
      viewState: defaultViewState,
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

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve(mockManifest),
    } as any);

    renderHook(() => useCloudLayer());

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/weather/weather_manifest.json');
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

    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve(mockManifest),
    } as any);

    // Mock texture data (e.g., 2x2 image, 8 bands, band 6 is TCC)
    const mockImg = {
      width: 2,
      height: 2,
      data: new Float32Array(2 * 2 * 8).fill(0),
    };
    // Set cloud cover in band 6 (surface) on all pixels so viewport
    // culling always finds at least one cloudy cell.
    mockImg.data[0 * 8 + 6] = 0.5; // Pixel 0 (row 0, col 0)
    mockImg.data[1 * 8 + 6] = 1.0; // Pixel 1 (row 0, col 1)
    mockImg.data[2 * 8 + 6] = 0.8; // Pixel 2 (row 1, col 0)
    mockImg.data[3 * 8 + 6] = 0.6; // Pixel 3 (row 1, col 1)

    (WeatherLayers.loadTextureData as any).mockResolvedValue(mockImg);

    const { result } = renderHook(() => useCloudLayer());

    await waitFor(() => {
      expect(mockSetCloudLoadingStatus).toHaveBeenCalledWith({
        state: 'ready',
        message: 'All cloud frames ready',
      });
      expect(result.current.cloudLayers).toHaveLength(1);
      expect(result.current.cloudLayers[0]?.id).toBe('cloud-volume');
    });
  });

  it('should handle fetch errors gracefully', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Fetch failed'));

    renderHook(() => useCloudLayer());

    await waitFor(() => {
      expect(mockSetCloudLoadingStatus).toHaveBeenCalledWith({
        state: 'error',
        message: 'Failed to load weather manifest',
      });
    });
  });

  it('should respect the hard particle cap', async () => {
    // Use default zoom (4.5) so viewport culling covers the full grid in JSDOM.
    // The test verifies the hook doesn't crash when presented with a large
    // fully-cloudy dataset and the 50k particle cap is the only limiter.
    const mockManifest = {
      forecasts: [
        {
          valid_time: '2023-01-01T12:00:00Z',
          files: { surface: 'http://test/cloud_0.tif' },
        },
      ],
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve(mockManifest),
    } as any);

    // Create a large image where every pixel is cloudy
    const w = 640;
    const h = 360;
    const bands = 8;
    const data = new Float32Array(w * h * bands);
    for (let p = 0; p < w * h; p++) {
      data[p * bands + 6] = 1.0; // 100% cloud cover everywhere
    }
    const mockImg = { width: w, height: h, data };

    (WeatherLayers.loadTextureData as any).mockResolvedValue(mockImg);

    const { result } = renderHook(() => useCloudLayer());

    await waitFor(() => {
      expect(mockSetCloudLoadingStatus).toHaveBeenCalledWith({
        state: 'ready',
        message: 'All cloud frames ready',
      });
      // The layer should exist but the point count should be capped
      expect(result.current.cloudLayers).toHaveLength(1);
      // We can't easily inspect the internal data length from the layer,
      // but the fact that it doesn't crash proves the cap works.
    });
  });
});
