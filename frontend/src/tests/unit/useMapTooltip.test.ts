import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMapTooltip } from '../../features/map/tooltips/useMapTooltip';
import { useMapStore } from '../../store/useMapStore';

vi.mock('../../../utils/sanitize', () => ({
  sanitizeHtml: (html: string) => html,
}));

describe('useMapTooltip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles aerodromes layer', () => {
    useMapStore.setState({
      activeAerodromeMetadata: null,
      activeLayers: {} as any,
      selectedRouteIds: [],
    });
    const { result } = renderHook(() => useMapTooltip({ current: null }));

    const tooltip = result.current({
      object: {
        properties: {
          icao_code: 'VAAU',
          aerodrome_name: 'Test',
          elevation: '100',
          communications: '[{"service":"TWR","frequency":"118.1"}]',
        },
      },
      layer: { id: 'aerodromes-layer' },
      x: 10,
      y: 10,
    });

    expect(tooltip).toBeDefined();
    // Instead of exact html string, check contains
    expect(tooltip!.html).toContain('VAAU');
  });

  it('handles navaids layer', () => {
    useMapStore.setState({
      activeAerodromeMetadata: null,
      activeLayers: {} as any,
      selectedRouteIds: [],
    });
    const { result } = renderHook(() => useMapTooltip({ current: null }));

    const tooltip = result.current({
      object: { properties: { ident: 'V1', aid_type: 'VOR', frequency: '112.5' } },
      layer: { id: 'navaids-layer' },
      x: 10,
      y: 10,
    });

    expect(tooltip).toBeDefined();
    expect(tooltip!.html).toContain('VOR');
    expect(tooltip!.html).toContain('112.5');
  });

  it('handles waypoints layer', () => {
    useMapStore.setState({
      activeAerodromeMetadata: null,
      activeLayers: {} as any,
      selectedRouteIds: [],
    });
    const { result } = renderHook(() => useMapTooltip({ current: null }));

    const tooltip = result.current({
      object: { properties: { waypoint_name: 'FIX', raw_coordinates: '10N 020E' } },
      layer: { id: 'waypoints-layer' },
      x: 10,
      y: 10,
    });

    expect(tooltip).toBeDefined();
    expect(tooltip!.html).toContain('FIX');
    expect(tooltip!.html).toContain('10N 020E');
  });

  it('handles ats routes layer (geom layer)', () => {
    useMapStore.setState({
      activeAerodromeMetadata: null,
      activeLayers: { atsRoutes: true } as any,
      selectedRouteIds: [],
    });
    const { result } = renderHook(() => useMapTooltip({ current: null }));

    const tooltip = result.current({
      object: {
        properties: {
          route_id: 'L333',
          route_type: 'RNAV',
          lower_limit: 'FL150',
          upper_limit: 'FL400',
          distance_nm: '100',
        },
      },
      layer: { id: 'atsRoutes-geom-layer' },
      x: 10,
      y: 10,
    });

    expect(tooltip).toBeDefined();
    expect(tooltip!.html).toContain('L333');
    expect(tooltip!.html).toContain('FL150');
    expect(tooltip!.html).toContain('FL400');
  });

  it('handles ats route waypoints layer', () => {
    useMapStore.setState({
      activeAerodromeMetadata: null,
      activeLayers: { atsRoutes: true } as any,
      selectedRouteIds: [],
    });
    const { result } = renderHook(() => useMapTooltip({ current: null }));

    const tooltip = result.current({
      object: { properties: { waypoint_name: 'FIX2', route_ids: 'L333' } },
      layer: { id: 'atsRoutes-waypoints-layer' },
      x: 10,
      y: 10,
    });

    expect(tooltip).toBeDefined();
    expect(tooltip!.html).toContain('FIX2');
  });

  it('handles maplibre map hits', () => {
    useMapStore.setState({
      activeAerodromeMetadata: null,
      activeLayers: {} as any,
      selectedRouteIds: [],
    });
    const mockMapRef = {
      current: {
        getMap: vi.fn(() => ({
          getStyle: vi.fn(() => ({
            layers: [{ id: 'mvt-polygons' }],
          })),
          queryRenderedFeatures: vi.fn((_point, options) => {
            if (options.layers?.includes('mvt-polygons')) {
              return [
                {
                  layer: { id: 'mvt-polygons' },
                  properties: { type: 'FIR', name: 'TEST FIR', class: 'C', limits: 'SFC-UNL' },
                },
              ];
            }
            return [];
          }),
        })),
      },
    };

    const { result } = renderHook(() => useMapTooltip(mockMapRef as any));

    const tooltip = result.current({
      object: null,
      layer: null,
      x: 10,
      y: 10,
    });

    expect(tooltip).toBeDefined();
    expect(tooltip!.html).toContain('TEST FIR');
  });

  it('handles maplibre map hits for restricted areas', () => {
    useMapStore.setState({
      activeAerodromeMetadata: null,
      activeLayers: {} as any,
      selectedRouteIds: [],
    });
    const mockMapRef = {
      current: {
        getMap: vi.fn(() => ({
          getStyle: vi.fn(() => ({
            layers: [{ id: 'mvt-polygons' }],
          })),
          queryRenderedFeatures: vi.fn((_point, options) => {
            if (options.layers?.includes('mvt-polygons')) {
              return [
                {
                  layer: { id: 'mvt-polygons' },
                  properties: {
                    feature_type: 'RESTRICTED',
                    name: 'R1',
                    class: '',
                    lower_limit: 'SFC',
                    upper_limit: 'FL100',
                    remarks: 'test',
                    type: 'RESTRICTED',
                  },
                },
              ];
            }
            return [];
          }),
        })),
      },
    };

    const { result } = renderHook(() => useMapTooltip(mockMapRef as any));

    const tooltip = result.current({
      object: null,
      layer: null,
      x: 10,
      y: 10,
    });

    expect(tooltip).toBeDefined();
    expect(tooltip!.html).toContain('R1');
  });

  it('handles maplibre map hits for aerodrome features with metadata', () => {
    const mockMetadata = {
      data: {
        radio_navigation_and_landing_aids: [
          { type_of_aid: 'ILS', identification: 'IABC', frequency_channel: '110.1' },
        ],
        runway_physical_characteristics: [
          { designation: '09', dimensions: '3000x45', strength_and_surface: 'PCN 80' },
        ],
      },
    };

    useMapStore.setState({
      activeAerodromeMetadata: mockMetadata as any,
      activeLayers: {} as any,
      selectedRouteIds: [],
    });
    const mockMapRef = {
      current: {
        getMap: vi.fn(() => ({
          getStyle: vi.fn(() => ({
            layers: [{ id: 'mvt-points' }],
          })),
          queryRenderedFeatures: vi.fn((_point, options) => {
            if (options.layers?.includes('mvt-points')) {
              return [
                {
                  layer: { id: 'mvt-points' },
                  properties: { feature_type: 'NAVAID', name: 'IABC', type: 'NAVAID' }, // category logic looks at type string inside feature property
                },
                {
                  layer: { id: 'mvt-points' },
                  properties: {
                    feature_type: 'RUNWAY_THRESHOLD',
                    name: '09',
                    type: 'RUNWAY_THRESHOLD',
                  }, // category
                },
              ];
            }
            return [];
          }),
        })),
      },
    };

    const { result } = renderHook(() => useMapTooltip(mockMapRef as any));

    const tooltip = result.current({
      object: null,
      layer: null,
      x: 10,
      y: 10,
    });

    expect(tooltip).toBeDefined();
    // The tooltip will render at least the names and types based on how it's structured
    expect(tooltip!.html).toContain('IABC');
    expect(tooltip!.html).toContain('09');
  });

  it('returns null when nothing picked', () => {
    useMapStore.setState({
      activeAerodromeMetadata: null,
      activeLayers: {} as any,
      selectedRouteIds: [],
    });
    const mockMapRef = {
      current: {
        getMap: vi.fn(() => ({
          getStyle: vi.fn(() => ({ layers: [] })),
          queryRenderedFeatures: vi.fn(() => []),
        })),
      },
    };
    const { result } = renderHook(() => useMapTooltip(mockMapRef as any));

    const tooltip = result.current({
      object: null,
      layer: null,
      x: 10,
      y: 10,
    });

    expect(tooltip).toBeNull();
  });
});
