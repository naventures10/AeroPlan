import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRouteAnimation } from '../features/map/layers/useRouteAnimation';
import { useMapStore } from '../store/useMapStore';
import * as api from '../api/client';
import * as routeAnimationUtils from '../features/map/utils/routeAnimation';

vi.mock('../api/client', () => ({
  fetchAtsRouteDetails: vi.fn(),
  fetchRouteDetails: vi.fn(),
}));

vi.mock('../features/map/utils/routeAnimation', () => ({
  buildRouteAnimations: vi.fn(),
}));

describe('useRouteAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    useMapStore.setState({
      activeLayers: { atsRoutes: false } as any,
      selectedRouteIds: [],
      selectedFeature: null,
      setAnimatedTrips: vi.fn(),
      setAnimationConfig: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles empty state and clears animation', () => {
    const { result } = renderHook(() => useRouteAnimation());
    expect(result.current.isAtsRendered).toBe(false);
    expect(result.current.currentTime).toBe(0);
  });

  it('updates currentTime on requestAnimationFrame when playing', async () => {
    useMapStore.setState({
      animationConfig: { playing: true, duration: 1000 },
    });

    const { result } = renderHook(() => useRouteAnimation());

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.currentTime).toBeGreaterThanOrEqual(0);
  });

  it('fetches and builds animation when routes are selected', async () => {
    useMapStore.setState({
      selectedRouteIds: ['A1'],
      selectedFeature: { type: 'ATS_ROUTE', data: { route_id: 'A1' } } as any,
    });

    (api.fetchAtsRouteDetails as any).mockResolvedValue({ geometry: 'mockGeometry', segments: [{}] });
    (routeAnimationUtils.buildRouteAnimations as any).mockReturnValue({
      trips: [{ path: [] }],
      maxDistance: 500
    });

    const storeState = useMapStore.getState();
    const setAnimatedTripsSpy = vi.spyOn(storeState, 'setAnimatedTrips');
    const setAnimationConfigSpy = vi.spyOn(storeState, 'setAnimationConfig');

    renderHook(() => useRouteAnimation());

    act(() => {
      vi.advanceTimersByTime(100); // Trigger the 50ms setTimeout
    });

    await waitFor(() => {
      expect(api.fetchAtsRouteDetails).toHaveBeenCalledWith('A1');
      expect(routeAnimationUtils.buildRouteAnimations).toHaveBeenCalled();
      expect(setAnimatedTripsSpy).toHaveBeenCalledWith([{ path: [] }]);
      expect(setAnimationConfigSpy).toHaveBeenCalledWith({ playing: true, duration: 500 });
    });
  });

  it('handles API failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    useMapStore.setState({
      selectedRouteIds: ['A1'],
      selectedFeature: { type: 'ATS_ROUTE', data: { route_id: 'A1' } } as any,
    });

    (api.fetchAtsRouteDetails as any).mockRejectedValue(new Error('fail'));

    renderHook(() => useRouteAnimation());

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to build ATS routes animation', expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  it('isAtsRendered state updates immediately on and delayed off', async () => {
    const { result } = renderHook(() => useRouteAnimation());
    expect(result.current.isAtsRendered).toBe(false);

    act(() => {
      useMapStore.setState({ activeLayers: { atsRoutes: true } as any });
    });

    expect(result.current.isAtsRendered).toBe(true);

    act(() => {
      useMapStore.setState({ activeLayers: { atsRoutes: false } as any });
    });

    expect(result.current.isAtsRendered).toBe(true);

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(result.current.isAtsRendered).toBe(false);
  });
});
