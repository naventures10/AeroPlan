import { describe, it, expect, vi } from 'vitest';
import { createAtsRouteLayers } from '../../features/map/layers/createAtsRouteLayers';

describe('createAtsRouteLayers', () => {
  it('creates layers with correct logic', () => {
    const ctx = {
      isDarkMode: true,
      viewMode: 'ENROUTE',
      zoom: 8,
      activeLayers: {
        atsRoutes: true,
      },
      selectedRouteIds: ['A1'],
      selectedFeature: null,
      selectedRouteType: 'RNAV',
      isAtsGeometryLoaded: true,
      setAtsGeometryLoaded: vi.fn(),
      atsRoutesToggleCounter: 1,
      animatedTrips: [
        {
          path: [
            [0, 0, 1],
            [1, 1, 2],
          ],
        },
      ],
      currentTime: 1.5,
      atsRouteLabels: {
        features: [
          {
            geometry: { coordinates: [0, 0] },
            properties: { route_id: 'A1', bearing: 90, route_type: 'RNAV' },
          },
          {
            geometry: { coordinates: [1, 1] },
            properties: { route_id: 'B2', bearing: 90, route_type: 'CONV' },
          },
        ],
      },
      setSelectedRouteIds: vi.fn(),
      setSelectedFeature: vi.fn(),
    };

    const layers = createAtsRouteLayers(ctx as any);

    // MVT routes, trips, label-text, MVT waypoints
    expect(layers.length).toBe(4);

    const mvtRoutes = layers[0];

    const routeFeature = {
      properties: { route_id: 'A1', route_type: 'RNAV', lateral_limits: '10' },
    };
    expect(mvtRoutes.props.getLineColor(routeFeature)).toEqual([115, 236, 139, 120]); // selected RNAV
    expect(mvtRoutes.props.getLineWidth(routeFeature)).toBeGreaterThan(0);

    const unselectedFeature = { properties: { route_id: 'B2', route_type: 'CONV' } };
    expect(mvtRoutes.props.getLineColor(unselectedFeature)).toEqual([68, 172, 255, 60]); // unselected

    // Testing missing lateral limits default
    const noLimitFeature = { properties: { route_id: 'C3', route_type: 'RNAV' } };
    expect(mvtRoutes.props.getLineWidth(noLimitFeature)).toBe(2.5); // 10 / 4 = 2.5

    mvtRoutes.props.onClick({ object: { properties: { route_id: 'B2', route_type: 'CONV' } } });
    expect(ctx.setSelectedRouteIds).toHaveBeenCalledWith(['B2'], 'CONV');
    expect(ctx.setSelectedFeature).toHaveBeenCalledWith({
      type: 'ATS_ROUTE',
      data: { route_id: 'B2', route_type: 'CONV' },
    });

    // Click to deselect
    mvtRoutes.props.onClick({ object: { properties: { route_id: 'A1', route_type: 'RNAV' } } });
    expect(ctx.setSelectedRouteIds).toHaveBeenCalledWith([], null);

    const tripsLayer = layers[1];
    expect(tripsLayer.id).toBe('atsRoutes-trips-layer');
    expect(tripsLayer.props.getPath({ path: [[0, 0, 1]] })).toEqual([[0, 0]]);
    expect(tripsLayer.props.getTimestamps({ path: [[0, 0, 1]] })).toEqual([1]);
    expect(tripsLayer.props.getColor({ route_type: 'RNAV' })).toEqual([115, 236, 139]);
    expect(tripsLayer.props.getColor({ route_type: 'CONV' })).toEqual([68, 172, 255]);

    const mvtWaypoints = layers[3];
    expect(mvtWaypoints.id).toBe('atsRoutes-waypoints-layer-1');

    const wpFeature = { properties: { route_ids: '{"A1","B2"}', waypoint_name: 'FIX' } };
    expect(mvtWaypoints.props.getIconColor(wpFeature)).toEqual([115, 236, 139, 255]); // Mint for selected RNAV
    expect(mvtWaypoints.props.getTextColor(wpFeature)).toEqual([115, 236, 139, 255]);
    expect(mvtWaypoints.props.getTextSize(wpFeature)).toBe(10);

    // Test conventional route waypoints highlight in cyan
    const convCtx = { ...ctx, selectedRouteIds: ['B2'], selectedRouteType: 'CONV' };
    const convLayers = createAtsRouteLayers(convCtx as any);
    expect(convLayers[3].props.getIconColor(wpFeature)).toEqual([68, 172, 255, 255]); // Blue for selected CONV route waypoints
    expect(convLayers[3].props.getTextColor(wpFeature)).toEqual([68, 172, 255, 255]);

    mvtWaypoints.props.onClick({
      object: { geometry: { coordinates: [0, 0] }, properties: wpFeature.properties },
    });
    expect(ctx.setSelectedRouteIds).toHaveBeenCalledWith(['A1', 'B2'], 'WAYPOINT');

    // Test clicking a waypoint that's already selected
    const selectedCtx = { ...ctx, selectedRouteIds: ['A1', 'B2'] };
    const selectedLayers = createAtsRouteLayers(selectedCtx as any);
    selectedLayers[3].props.onClick({
      object: { geometry: { coordinates: [0, 0] }, properties: wpFeature.properties },
    });
    expect(ctx.setSelectedRouteIds).toHaveBeenCalledWith([]);

    // click empty
    mvtWaypoints.props.onClick({});
    expect(ctx.setSelectedRouteIds).toHaveBeenCalledWith([]);

    // Testing label layer logic
    const labelTextLayer = layers[2]; // ats-route-labels-text-layer
    // selected label is base color when not glowing (Option B)
    expect(
      labelTextLayer.props.getColor({ properties: { route_id: 'A1', route_type: 'RNAV' } }),
    ).toEqual([115, 236, 139, 255]);
  });

  it('handles hidden layer state and unselected logic', () => {
    const ctx = {
      isDarkMode: true,
      viewMode: 'ENROUTE',
      zoom: 8,
      activeLayers: {
        atsRoutes: false,
      },
      selectedRouteIds: [],
      selectedFeature: null,
      selectedRouteType: null,
      isAtsGeometryLoaded: false,
      setAtsGeometryLoaded: vi.fn(),
      atsRoutesToggleCounter: 2,
      animatedTrips: [],
      currentTime: 0,
      atsRouteLabels: null,
      setSelectedRouteIds: vi.fn(),
      setSelectedFeature: vi.fn(),
    };

    const layers = createAtsRouteLayers(ctx as any);
    // only MVT routes and MVT waypoints
    expect(layers.length).toBe(2);

    const mvtRoutes = layers[0];
    const mvtWaypoints = layers[1];

    const feature = { properties: { route_id: 'A1', route_type: 'RNAV' } };
    expect(mvtRoutes.props.getLineColor(feature)).toEqual([0, 0, 0, 0]);
    expect(mvtRoutes.props.getLineWidth(feature)).toBe(0);

    // Should not select if clicking when hidden
    mvtRoutes.props.onClick({ object: { properties: { route_id: 'A1' } } });
    expect(ctx.setSelectedRouteIds).not.toHaveBeenCalled();

    const wpFeature = { properties: { route_ids: '{"A1"}' } };
    expect(mvtWaypoints.props.getIconColor(wpFeature)).toEqual([0, 0, 0, 0]);
    expect(mvtWaypoints.props.getTextColor(wpFeature)).toEqual([0, 0, 0, 0]);
    expect(mvtWaypoints.props.getTextSize(wpFeature)).toBe(0);

    // Should not select if clicking when hidden
    mvtWaypoints.props.onClick({ object: { properties: wpFeature.properties } });
    expect(ctx.setSelectedRouteIds).not.toHaveBeenCalled();
  });

  it('handles selected route when layer is inactive', () => {
    const ctx = {
      isDarkMode: true,
      viewMode: 'ENROUTE',
      zoom: 8,
      activeLayers: {
        atsRoutes: false,
      },
      selectedRouteIds: ['A1'],
      selectedFeature: { type: 'ATS_ROUTE', data: { route_id: 'A1' } },
      selectedRouteType: 'RNAV',
      isAtsGeometryLoaded: true,
      setAtsGeometryLoaded: vi.fn(),
      atsRoutesToggleCounter: 3,
      animatedTrips: [],
      currentTime: 0,
      atsRouteLabels: null,
      setSelectedRouteIds: vi.fn(),
      setSelectedFeature: vi.fn(),
    };

    const layers = createAtsRouteLayers(ctx as any);
    const mvtRoutes = layers[0];
    const feature = { properties: { route_id: 'A1', route_type: 'RNAV' } };
    expect(mvtRoutes.props.getLineColor(feature)).toEqual([115, 236, 139, 120]); // selected even when inactive
    expect(mvtRoutes.props.getLineWidth(feature)).toBeGreaterThan(0);
  });

  it('handles selected waypoints in trip colors and icon color', () => {
    const ctx = {
      isDarkMode: true,
      viewMode: 'ENROUTE',
      zoom: 8,
      activeLayers: { atsRoutes: true },
      selectedRouteIds: ['A1'],
      selectedFeature: null,
      selectedRouteType: 'WAYPOINT', // testing the waypoint override logic
      isAtsGeometryLoaded: true,
      setAtsGeometryLoaded: vi.fn(),
      atsRoutesToggleCounter: 4,
      animatedTrips: [{ path: [[0, 0, 1]] }],
      currentTime: 1.5,
      atsRouteLabels: null,
      setSelectedRouteIds: vi.fn(),
      setSelectedFeature: vi.fn(),
    };

    const layers = createAtsRouteLayers(ctx as any);

    // Routes line color matches neon purple under waypoint selection
    const feature = { properties: { route_id: 'A1', route_type: 'RNAV' } };
    expect(layers[0].props.getLineColor(feature)).toEqual([192, 132, 252, 120]);

    // Trips
    expect(layers[1].props.getColor({})).toEqual([192, 132, 252]);

    // Waypoints
    const wpFeature = { properties: { route_ids: '{"A1"}' } };
    expect(layers[2].props.getIconColor(wpFeature)).toEqual([192, 132, 252, 255]); // COLOR_NEON_PURPLE
    expect(layers[2].props.getTextColor(wpFeature)).toEqual([192, 132, 252, 255]); // COLOR_NEON_PURPLE
  });

  it('hides labels when ats route geometry is not loaded', () => {
    const ctx = {
      isDarkMode: true,
      viewMode: 'ENROUTE',
      zoom: 8,
      activeLayers: {
        atsRoutes: true,
      },
      selectedRouteIds: [],
      selectedFeature: null,
      selectedRouteType: null,
      animatedTrips: [],
      currentTime: 1.5,
      isAtsGeometryLoaded: false,
      atsRouteLabels: {
        features: [
          {
            geometry: { coordinates: [0, 0] },
            properties: { route_id: 'A1', bearing: 90, route_type: 'RNAV' },
          },
        ],
      },
      setSelectedRouteIds: vi.fn(),
      setSelectedFeature: vi.fn(),
      setAtsGeometryLoaded: vi.fn(),
      atsRoutesToggleCounter: 5,
    };

    const layers = createAtsRouteLayers(ctx as any);
    const labelTextLayer = layers[1]; // ats-route-labels-text-layer

    // When not loaded and not selected, alpha is 0
    expect(
      labelTextLayer.props.getColor({ properties: { route_id: 'A1', route_type: 'RNAV' } }),
    ).toEqual([0, 0, 0, 0]);
  });

  it('handles overlapping labels by sliding positions along bearing', () => {
    const ctx = {
      isDarkMode: true,
      viewMode: 'ENROUTE',
      zoom: 8,
      activeLayers: {
        atsRoutes: true,
      },
      selectedRouteIds: [],
      selectedFeature: null,
      selectedRouteType: null,
      isAtsGeometryLoaded: true,
      setAtsGeometryLoaded: vi.fn(),
      atsRoutesToggleCounter: 1,
      animatedTrips: [],
      currentTime: 0,
      atsRouteLabels: {
        features: [
          {
            geometry: { coordinates: [80.123456, 13.123456] },
            properties: { route_id: 'W111', bearing: 45, route_type: 'CONV' },
          },
          {
            geometry: { coordinates: [80.123456, 13.123456] },
            properties: { route_id: 'G272', bearing: 90, route_type: 'RNAV' },
          },
        ],
      },
      setSelectedRouteIds: vi.fn(),
      setSelectedFeature: vi.fn(),
    };

    const layers = createAtsRouteLayers(ctx as any);
    const labelTextLayer = layers[1]; // ats-route-labels-text-layer

    const data = labelTextLayer.props.data;
    expect(data.length).toBe(2);

    // Overlapping labels should have their coordinates modified (no longer identical)
    const [lon0] = data[0].geometry.coordinates;
    const [lon1] = data[1].geometry.coordinates;
    expect(lon0).not.toBeCloseTo(lon1, 4);

    // Original coordinates should not be mutated
    expect(ctx.atsRouteLabels.features[0]!.geometry.coordinates[0]).toBe(80.123456);
    expect(ctx.atsRouteLabels.features[0]!.geometry.coordinates[1]).toBe(13.123456);
  });
});
