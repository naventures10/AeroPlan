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

  beforeEach(() => {
    vi.clearAllMocks();
    (useMapStore as any).mockReturnValue({
      activeLayers: { cloudlayer: true },
      viewMode: 'ENROUTE',
      windAltitude: 0,
      windAnimationTime: 0,
      setWindAnimationTime: mockSetWindAnimationTime,
      setCloudLoadingStatus: mockSetCloudLoadingStatus,
    });
    (useMapStore as any).getState = vi.fn().mockReturnValue({
      cloudLoadingStatus: { state: 'idle' },
    });
  });

  it('should not fetch manifest if cloud layer is inactive', () => {
    (useMapStore as any).mockReturnValue({
      activeLayers: { cloudlayer: false },
      viewMode: 'ENROUTE',
      windAltitude: 0,
      windAnimationTime: 0,
      setWindAnimationTime: mockSetWindAnimationTime,
      setCloudLoadingStatus: mockSetCloudLoadingStatus,
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
    // Set some cloud cover in band 6 (surface)
    mockImg.data[0 * 8 + 6] = 0.5; // Pixel 0 has 50% clouds
    mockImg.data[1 * 8 + 6] = 1.0; // Pixel 1 has 100% clouds

    (WeatherLayers.loadTextureData as any).mockResolvedValue(mockImg);

    const { result } = renderHook(() => useCloudLayer());

    await waitFor(() => {
      expect(mockSetCloudLoadingStatus).toHaveBeenCalledWith({
        state: 'ready',
        message: 'All cloud frames ready',
      });
    });

    expect(result.current.cloudLayers).toHaveLength(1);
    expect(result.current.cloudLayers[0]?.id).toBe('cloud-particles');
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
});
