import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRnpAnimation } from '../../features/terminal/layers/useRnpAnimation';

describe('useRnpAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles null distance', () => {
    const { result } = renderHook(() => useRnpAnimation(null));
    expect(result.current).toBe(0);
  });

  it('handles negative distance', () => {
    const { result } = renderHook(() => useRnpAnimation(-5));
    expect(result.current).toBe(0);
  });

  it('animates current time when distance provided', () => {
    const { result } = renderHook(() => useRnpAnimation(10));
    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBeGreaterThan(0);

    // speed is 2.5 nm per sec
    expect(result.current).toBeCloseTo(2.5, 0);

    // Loop at 10
    act(() => {
      vi.advanceTimersByTime(4000); // 10 / 2.5 = 4 secs to complete. So it should wrap around
    });

    expect(result.current).toBeGreaterThanOrEqual(0);
    expect(result.current).toBeLessThan(10);
  });
});
