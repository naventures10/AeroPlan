import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSearch } from '../hooks/useSearch';

// Mock ApiClient functions and map store
vi.mock('../api/client', () => {
  return {
    searchAll: vi.fn(),
    fetchAerodromeMetadata: vi.fn(),
  };
});

vi.mock('../store/useMapStore', () => ({
  useMapStore: vi.fn(() => ({
    flyToLocation: vi.fn(),
    fitBounds: vi.fn(),
    activeLayers: {},
    toggleLayer: vi.fn(),
    setActiveAirport: vi.fn(),
    setActiveAerodromeMetadata: vi.fn(),
    setSelectedRouteIds: vi.fn(),
    setSelectedFeature: vi.fn(),
  })),
}));

describe('useSearch hook', () => {
  it('should initialize with default states', () => {
    const { result } = renderHook(() => useSearch());
    expect(result.current.searchInput).toBe('');
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
