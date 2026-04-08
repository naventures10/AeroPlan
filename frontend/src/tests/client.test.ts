import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAerodromes, searchAll, ApiError } from '../api/client';

describe('API Client Functions', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('should handle successful responses for searchAll', async () => {
    const mockData = [{ id: 'VOMF', text: 'Chennai' }];
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await searchAll('VOMF');
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith('/api/search?q=VOMF', expect.any(Object));
  });

  it('should throw ApiError automatically inside get() for failed aerodromes fetch', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server Error'),
    });

    await expect(fetchAerodromes()).rejects.toThrow(ApiError);
  });
});
