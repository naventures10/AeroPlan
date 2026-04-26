import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAerodromeData } from '../../hooks/useAerodromeData';
import { useMapStore } from '../../store/useMapStore';
import * as client from '../../api/client';

vi.mock('../../api/client', () => ({
  fetchAerodromes: vi.fn(),
  fetchAerodromeMetadata: vi.fn(),
  fetchAerodromeSection: vi.fn(),
  fetchAtsRouteLabels: vi.fn(),
}));

describe('useAerodromeData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMapStore.setState({
      activeAirport: null,
      activeLayers: { atsRoutes: false } as any,
      selectedRouteIds: [],
      flyToLocation: vi.fn(),
      setActiveAirport: vi.fn(),
      setActiveAerodromeMetadata: vi.fn(),
      setAtsRouteLabels: vi.fn(),
      setTerminalPivot: vi.fn(),
    });
  });

  it('should return initial state and fetch aerodromes on mount', async () => {
    (client.fetchAerodromes as any).mockResolvedValue([{ id: 'test' }]);

    let result: any;
    act(() => {
      const rendered = renderHook(() => useAerodromeData());
      result = rendered.result;
    });

    await waitFor(() => {
      expect(result.current.aerodromes).toEqual([{ id: 'test' }]);
    });
  });

  it('should log error when fetch aerodromes fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (client.fetchAerodromes as any).mockRejectedValue(new Error('fail'));

    act(() => {
      renderHook(() => useAerodromeData());
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch aerodromes', expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  it('should handle aerodrome click properly', async () => {
    (client.fetchAerodromes as any).mockResolvedValue([]);
    (client.fetchAerodromeMetadata as any).mockResolvedValue({ info: 'test' });

    const storeState = useMapStore.getState();
    const flyToSpy = vi.spyOn(storeState, 'flyToLocation');
    const setActiveAirportSpy = vi.spyOn(storeState, 'setActiveAirport');
    const setPivotSpy = vi.spyOn(storeState, 'setTerminalPivot');
    const setMetadataSpy = vi.spyOn(storeState, 'setActiveAerodromeMetadata');

    let result: any;
    act(() => {
      const rendered = renderHook(() => useAerodromeData());
      result = rendered.result;
    });

    act(() => {
      result.current.handleAerodromeClick('VAAU', [70, 20]);
    });

    expect(setActiveAirportSpy).toHaveBeenCalledWith('VAAU');
    expect(setPivotSpy).toHaveBeenCalledWith([70, 20]);
    expect(flyToSpy).toHaveBeenCalledWith(70, 20, 15, 60);

    await waitFor(() => {
      expect(setMetadataSpy).toHaveBeenCalledWith({ info: 'test' });
    });
  });

  it('should handle aerodrome click metadata error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (client.fetchAerodromes as any).mockResolvedValue([]);
    (client.fetchAerodromeMetadata as any).mockRejectedValue(new Error('fail'));

    let result: any;
    act(() => {
      const rendered = renderHook(() => useAerodromeData());
      result = rendered.result;
    });

    act(() => {
      result.current.handleAerodromeClick('VAAU', [70, 20]);
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch metadata', expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  it('should lazy load ATS routes when layer turns on', async () => {
    (client.fetchAerodromes as any).mockResolvedValue([]);
    (client.fetchAtsRouteLabels as any).mockResolvedValue({ label: 1 });

    const storeState = useMapStore.getState();
    const setAtsSpy = vi.spyOn(storeState, 'setAtsRouteLabels');

    act(() => {
      renderHook(() => useAerodromeData());
    });

    // Layer is off initially, so not called
    expect(client.fetchAtsRouteLabels).not.toHaveBeenCalled();

    // Turn layer on
    act(() => {
      useMapStore.setState({ activeLayers: { atsRoutes: true } as any });
    });

    await waitFor(() => {
      expect(client.fetchAtsRouteLabels).toHaveBeenCalled();
      expect(setAtsSpy).toHaveBeenCalledWith({ label: 1 });
    });
  });

  it('should handle ATS routes load error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (client.fetchAerodromes as any).mockResolvedValue([]);
    (client.fetchAtsRouteLabels as any).mockRejectedValue(new Error('fail'));

    act(() => {
      renderHook(() => useAerodromeData());
    });

    act(() => {
      useMapStore.setState({ activeLayers: { atsRoutes: true } as any });
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch ATS labels', expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  it('should handle section selection correctly', async () => {
    (client.fetchAerodromes as any).mockResolvedValue([]);
    (client.fetchAerodromeSection as any).mockResolvedValue({
      title: 'T',
      data_type: 'txt',
      data: 'd',
    });

    useMapStore.setState({ activeAirport: 'VAAU' });

    let result: any;
    act(() => {
      const rendered = renderHook(() => useAerodromeData());
      result = rendered.result;
    });

    act(() => {
      result.current.handleSectionSelect('AD 2.1');
    });

    expect(result.current.sectionModalOpen).toBe(true);

    await waitFor(() => {
      expect(result.current.sectionLoading).toBe(false);
      expect(result.current.sectionData).toBe('d');
      expect(result.current.sectionTitle).toBe('T');
      expect(result.current.sectionDataType).toBe('txt');
    });

    act(() => {
      result.current.closeSectionModal();
    });

    expect(result.current.sectionModalOpen).toBe(false);
  });

  it('should handle section selection error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (client.fetchAerodromes as any).mockResolvedValue([]);
    (client.fetchAerodromeSection as any).mockRejectedValue(new Error('fail'));

    useMapStore.setState({ activeAirport: 'VAAU' });

    let result: any;
    act(() => {
      const rendered = renderHook(() => useAerodromeData());
      result = rendered.result;
    });

    act(() => {
      result.current.handleSectionSelect('AD 2.1');
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch section:', expect.any(Error));
      expect(result.current.sectionTitle).toBe('Error loading section');
      expect(result.current.sectionData).toBeNull();
      expect(result.current.sectionLoading).toBe(false);
    });
    consoleSpy.mockRestore();
  });

  it('should do nothing on section selection if activeAirport is null', () => {
    (client.fetchAerodromes as any).mockResolvedValue([]);
    let result: any;
    act(() => {
      const rendered = renderHook(() => useAerodromeData());
      result = rendered.result;
    });

    act(() => {
      result.current.handleSectionSelect('AD 2.1');
    });

    expect(client.fetchAerodromeSection).not.toHaveBeenCalled();
  });
});
