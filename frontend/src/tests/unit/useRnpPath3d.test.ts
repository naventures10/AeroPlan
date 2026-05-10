import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRnpPath3d } from '../../features/terminal/layers/useRnpPath3d';
import * as api from '../../api/client';

vi.mock('../../api/client', () => ({
  fetchRnpPath3d: vi.fn(),
}));

describe('useRnpPath3d', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles null procedureId', () => {
    const { result } = renderHook(() => useRnpPath3d(null));
    expect(result.current).toBeNull();
    expect(api.fetchRnpPath3d).not.toHaveBeenCalled();
  });

  it('fetches path when procedureId provided', async () => {
    const mockData = { path: [1, 2, 3], timestamps: [1, 2, 3], waypoints: [] };
    (api.fetchRnpPath3d as any).mockResolvedValue(mockData);

    const { result } = renderHook(() => useRnpPath3d(1));

    await waitFor(() => {
      expect(api.fetchRnpPath3d).toHaveBeenCalledWith(1);
      expect(result.current).toEqual(mockData);
    });
  });

  it('uses cached data on subsequent calls', async () => {
    const mockData = { path: [1], timestamps: [1], waypoints: [] };
    (api.fetchRnpPath3d as any).mockResolvedValue(mockData);

    const initialProps: { id: number | null } = { id: 2 };
    const { result, rerender } = renderHook(({ id }) => useRnpPath3d(id), {
      initialProps,
    });

    await waitFor(() => {
      expect(result.current).toEqual(mockData);
    });

    expect(api.fetchRnpPath3d).toHaveBeenCalledTimes(1);

    // change ID
    rerender({ id: null });
    expect(result.current).toBeNull();

    // change back to 2, should not fetch again
    rerender({ id: 2 });
    expect(result.current).toEqual(mockData);
    expect(api.fetchRnpPath3d).toHaveBeenCalledTimes(1);
  });

  it('handles API failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (api.fetchRnpPath3d as any).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useRnpPath3d(3));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('RNP path3d fetch error', expect.any(Error));
      expect(result.current).toBeNull();
    });
    consoleSpy.mockRestore();
  });

  it('handles empty API response', async () => {
    (api.fetchRnpPath3d as any).mockResolvedValue(0 as any);

    const { result } = renderHook(() => useRnpPath3d(4));

    await waitFor(() => {
      expect(result.current).toBeNull();
    });
  });
});
