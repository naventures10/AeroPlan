import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMapTooltip } from '../../features/map/tooltips/useMapTooltip';
import { useMapStore } from '../../store/useMapStore';

vi.mock('../../utils/sanitize', () => ({
  sanitizeHtml: (html: string) => html,
}));

const mockUseIsMobile = vi.fn(() => false);
vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

describe('useMapTooltip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
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
          communications: '[{"service_type":"TWR","frequency":"118.1"}]',
        },
      },
      layer: { id: 'aerodromes-layer' },
      x: 10,
      y: 10,
    });

    expect(tooltip).toBeDefined();
    expect(tooltip).toBeDefined();
    expect(tooltip!.html).toContain('aip-tooltip-wrapper');
    // Instead of exact html string, check for parts
    expect(tooltip!.html).toContain('VAAU');
    expect(tooltip!.html).toContain('TWR');
    expect(tooltip!.html).toContain('118.1');
  });

  it('handles aerodromes layer with metadata elevation and complex comms', () => {
    useMapStore.setState({
      activeAerodromeMetadata: {
        geographical_data: { elevation_reference_temp: '150.5 FT' },
      } as any,
      activeLayers: {} as any,
      selectedRouteIds: [],
    });
    const { result } = renderHook(() => useMapTooltip({ current: null }));

    const tooltip = result.current({
      object: {
        properties: {
          icao_code: 'VABB',
          communications: [
            { service_type: 'TWR', frequency: '118.1', call_sign: 'MUMBAI TOWER' },
            { service_type: 'APP', frequency: '127.9', call_sign: 'MUMBAI APPROACH' },
          ],
          magnetic_variation: '1W',
          remarks: 'Test Remarks',
        },
      },
      layer: { id: 'aerodromes-layer' },
    });

    expect(tooltip!.html).toContain('VABB');
    expect(tooltip!.html).toContain('150.5 FT');
    expect(tooltip!.html).toContain('TWR');
    expect(tooltip!.html).toContain('118.1 (MUMBAI TOWER)');
    expect(tooltip!.html).toContain('APP');
    expect(tooltip!.html).toContain('127.9 (MUMBAI APPROACH)');
    expect(tooltip!.html).toContain('MAG VAR');
    expect(tooltip!.html).toContain('1W');
    expect(tooltip!.html).not.toContain('REMARKS');
    expect(tooltip!.html).not.toContain('Test Remarks');
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
          track_magnetic: '090',
        },
      },
      layer: { id: 'atsRoutes-geom-layer-1' },
      x: 10,
      y: 10,
    });

    expect(tooltip).toBeDefined();
    expect(tooltip!.html).toContain('L333');
    expect(tooltip!.html).toContain('FL150');
    expect(tooltip!.html).toContain('FL400');
    expect(tooltip!.html).toContain('100 NM');
  });

  it('handles airspace metadata layer', () => {
    const { result } = renderHook(() => useMapTooltip({ current: null }));

    const tooltip = result.current({
      object: {
        properties: {
          name: 'MUMBAI TMA',
          airspace_type: 'CONTROL_AREA',
          lower_limit: 'FL070',
          upper_limit: 'FL245',
        },
      },
      layer: { id: 'airspace-metadata-layer' },
    });

    expect(tooltip).toBeNull();
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
      layer: { id: 'atsRoutes-waypoints-layer-1' },
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

  it('handles maplibre map hits for ARP and Obstacles', () => {
    const mockMetadata = {
      data: {
        obstacles: [
          {
            obstacle_type: 'TOWER',
            elevation: '450 FT',
            area_affected: 'RWY 09',
            marking_lgt: 'RED LGT',
            remarks: 'OBST REMARK',
          },
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
          queryRenderedFeatures: vi.fn(() => [
            {
              layer: { id: 'mvt-points' },
              properties: { category: 'ARP', name: 'ARP VABB' },
              geometry: { type: 'Point', coordinates: [72.8, 19.1] },
            },
            {
              layer: { id: 'mvt-points' },
              properties: { category: 'OBSTACLE', name: 'TOWER', height: 450 },
            },
          ]),
        })),
      },
    };

    const { result } = renderHook(() => useMapTooltip(mockMapRef as any));

    const tooltip = result.current({ object: null, layer: null, x: 10, y: 10 });

    expect(tooltip!.html).toContain('ARP VABB');
    expect(tooltip!.html).toContain('19.10000, 72.80000'); // Category display for ARP
    expect(tooltip!.html).toContain('TOWER');
    expect(tooltip!.html).toContain('OBST REMARK');
    expect(tooltip!.html).toContain('RED LGT');
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

  describe('mobile view tooltips', () => {
    beforeEach(() => {
      mockUseIsMobile.mockReturnValue(true);
    });

    it('suppresses tooltips for waypoints-layer on mobile', () => {
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

      expect(tooltip).toBeNull();
    });

    it('suppresses tooltips for navaids-layer on mobile', () => {
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

      expect(tooltip).toBeNull();
    });

    it('suppresses tooltips for atsRoutes-waypoints-layer on mobile', () => {
      useMapStore.setState({
        activeAerodromeMetadata: null,
        activeLayers: { atsRoutes: true } as any,
        selectedRouteIds: [],
      });
      const { result } = renderHook(() => useMapTooltip({ current: null }));

      const tooltip = result.current({
        object: { properties: { waypoint_name: 'FIX2', route_ids: 'L333' } },
        layer: { id: 'atsRoutes-waypoints-layer-1' },
        x: 10,
        y: 10,
      });

      expect(tooltip).toBeNull();
    });

    it('suppresses tooltips for atsRoutes-geom-layer on mobile', () => {
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
            track_magnetic: '090',
          },
        },
        layer: { id: 'atsRoutes-geom-layer-1' },
        x: 10,
        y: 10,
      });

      expect(tooltip).toBeNull();
    });
  });
});
