import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSearch } from '../../hooks/useSearch';
import { useMapStore } from '../../store/useMapStore';
import * as client from '../../api/client';

vi.mock('../../api/client', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    searchAll: vi.fn(),
    fetchAerodromeMetadata: vi.fn(),
  };
});

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useMapStore.setState({
      flyToLocation: vi.fn(),
      fitBounds: vi.fn(),
      activeLayers: {
        aerodromes: false,
        waypoints: false,
        navaids: false,
        atsRoutes: false,
        airspaces: false,
      } as any,
      toggleLayer: vi.fn(),
      setActiveAirport: vi.fn(),
      setActiveAerodromeMetadata: vi.fn(),
      setSelectedRouteIds: vi.fn(),
      setSelectedFeature: vi.fn(),
      setHighlightedAirspaceId: vi.fn(),
      searchQuery: '',
      setSearchQuery: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default states', () => {
    const { result } = renderHook(() => useSearch());
    expect(result.current.searchInput).toBe('');
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should perform search and update suggestions', async () => {
    (client.searchAll as any).mockResolvedValue([{ id: '1', name: 'Test', type: 'AERODROME' }]);
    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setSearchInput('test');
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.suggestions.length).toBe(1);
    });

    expect(client.searchAll).toHaveBeenCalledWith('test', expect.any(AbortSignal));
    expect(result.current.suggestions[0]?.name).toBe('Test');
  });

  it('should handle search errors gracefully', async () => {
    (client.searchAll as any).mockRejectedValue(new Error('Network Error'));
    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setSearchInput('error_test');
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.suggestions).toEqual([]);
  });

  it('should handle clearing the search input (empty string)', () => {
    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setSearchInput('');
    });

    expect(result.current.searchInput).toBe('');
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should select an aerodrome feature correctly', async () => {
    const storeState = useMapStore.getState();
    const flyToSpy = vi.spyOn(storeState, 'flyToLocation');
    const toggleLayerSpy = vi.spyOn(storeState, 'toggleLayer');
    const setActiveAirportSpy = vi.spyOn(storeState, 'setActiveAirport');
    const setActiveAerodromeMetadataSpy = vi.spyOn(storeState, 'setActiveAerodromeMetadata');

    (client.fetchAerodromeMetadata as any).mockResolvedValue({ info: 'data' });

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.handleGlobalSearchSelect({
        id: 'VAAU',
        name: 'VAAU',
        type: 'AERODROME',
        center: [70, 20],
      });
    });

    expect(toggleLayerSpy).toHaveBeenCalledWith('aerodromes');
    expect(flyToSpy).toHaveBeenCalledWith(70, 20, 15, 60, 'TERMINAL');
    expect(setActiveAirportSpy).toHaveBeenCalledWith('VAAU');

    await waitFor(() => {
      expect(client.fetchAerodromeMetadata).toHaveBeenCalledWith('VAAU');
      expect(setActiveAerodromeMetadataSpy).toHaveBeenCalledWith({ info: 'data' });
    });
  });

  it('should handle selection without geometry/center', () => {
    const { result } = renderHook(() => useSearch());
    act(() => {
      result.current.handleGlobalSearchSelect({
        id: 'VAAU',
        name: 'VAAU',
        type: 'AERODROME',
      });
    });
    // Should pass without throwing error
  });

  it('should handle ATS_ROUTE selection', () => {
    const storeState = useMapStore.getState();
    const fitBoundsSpy = vi.spyOn(storeState, 'fitBounds');
    const setSelectedRouteIdsSpy = vi.spyOn(storeState, 'setSelectedRouteIds');

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.handleGlobalSearchSelect({
        id: 'L333',
        name: 'L333',
        type: 'ATS_ROUTE',
        bounds: [1, 2, 3, 4],
        properties: { name: 'L333' },
      });
    });

    expect(fitBoundsSpy).toHaveBeenCalledWith([1, 2, 3, 4]);

    act(() => {
      vi.advanceTimersByTime(1300); // the selectionTimer is 1200ms
    });

    expect(setSelectedRouteIdsSpy).toHaveBeenCalledWith(['L333'], undefined);
  });

  it('should handle WAYPOINT selection', () => {
    const storeState = useMapStore.getState();
    const flyToSpy = vi.spyOn(storeState, 'flyToLocation');
    const toggleLayerSpy = vi.spyOn(storeState, 'toggleLayer');
    const setSelectedFeatureSpy = vi.spyOn(storeState, 'setSelectedFeature');

    const feature = {
      id: 'FIX',
      name: 'FIX',
      type: 'WAYPOINT',
      center: [10, 20],
      properties: { name: 'FIX' },
    };

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.handleGlobalSearchSelect(feature);
    });

    expect(flyToSpy).toHaveBeenCalledWith(10, 20, 15, 0, 'ENROUTE');

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(toggleLayerSpy).toHaveBeenCalledWith('waypoints');
    expect(setSelectedFeatureSpy).toHaveBeenCalledWith({
      type: 'WAYPOINT',
      data: feature.properties,
    });
  });

  it('should handle AIRSPACE selection', () => {
    const storeState = useMapStore.getState();
    const flyToSpy = vi.spyOn(storeState, 'flyToLocation');
    const toggleLayerSpy = vi.spyOn(storeState, 'toggleLayer');
    const setHighlightedAirspaceIdSpy = vi.spyOn(storeState, 'setHighlightedAirspaceId');
    const setSelectedFeatureSpy = vi.spyOn(storeState, 'setSelectedFeature');

    const feature = {
      id: 'VABF',
      name: 'MUMBAI FIR',
      type: 'AIRSPACE',
      center: [72.8, 19.1],
      properties: { name: 'MUMBAI FIR', airspace_type: 'FIR' },
    };

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.handleGlobalSearchSelect(feature);
    });

    // Verify immediate camera animation
    expect(flyToSpy).toHaveBeenCalledWith(72.8, 19.1, 15, 0, 'ENROUTE');

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    // Verify deferred state updates
    expect(toggleLayerSpy).toHaveBeenCalledWith('airspaces');
    expect(setHighlightedAirspaceIdSpy).toHaveBeenCalledWith('VABF');
    expect(setSelectedFeatureSpy).toHaveBeenCalledWith({
      type: 'AIRSPACE',
      data: feature.properties,
    });
  });

  it('should handle keyboard navigation', () => {
    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.handleSearchKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as any);
    });
    expect(result.current.searchSelectedIndex).toBe(-1); // suggestions are empty

    act(() => {
      result.current.handleSearchKeyDown({ key: 'Escape', preventDefault: vi.fn() } as any);
    });
    expect(result.current.isSearchFocused).toBe(false);
  });
});
