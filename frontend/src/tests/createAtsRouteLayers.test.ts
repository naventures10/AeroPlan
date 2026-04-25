import { describe, it, expect, vi } from 'vitest';
import { createAtsRouteLayers } from '../features/map/layers/createAtsRouteLayers';

describe('createAtsRouteLayers', () => {
  it('creates layers with correct logic', () => {
    const ctx = {
      viewMode: 'ENROUTE',
      viewState: { zoom: 8 },
      activeLayers: {
        atsRoutes: true,
      },
      selectedRouteIds: ['A1'],
      selectedFeature: null,
      selectedRouteType: 'RNAV',
      animatedTrips: [{ path: [[0, 0, 1], [1, 1, 2]] }],
      currentTime: 1.5,
      atsRouteLabels: { features: [
        { geometry: { coordinates: [0, 0] }, properties: { route_id: 'A1', bearing: 90, route_type: 'RNAV' } },
        { geometry: { coordinates: [1, 1] }, properties: { route_id: 'B2', bearing: 90, route_type: 'CONV' } }
      ]},
      setSelectedRouteIds: vi.fn(),
      setSelectedFeature: vi.fn()
    };

    const layers = createAtsRouteLayers(ctx as any);

    // MVT routes, trips, label-bg, label-hex, label-text, MVT waypoints
    expect(layers.length).toBe(6);

    const mvtRoutes = layers[0];

    const routeFeature = { properties: { route_id: 'A1', route_type: 'RNAV', lateral_limits: '10' } };
    expect(mvtRoutes.props.getLineColor(routeFeature)).toEqual([255, 255, 255, 255]); // selected
    expect(mvtRoutes.props.getLineWidth(routeFeature)).toBeGreaterThan(0);

    const unselectedFeature = { properties: { route_id: 'B2', route_type: 'CONV' } };
    expect(mvtRoutes.props.getLineColor(unselectedFeature)).toEqual([34, 211, 238, 60]); // unselected

    // Testing missing lateral limits default
    const noLimitFeature = { properties: { route_id: 'C3', route_type: 'RNAV' } };
    expect(mvtRoutes.props.getLineWidth(noLimitFeature)).toBe(2.5); // 10 / 4 = 2.5

    mvtRoutes.props.onClick({ object: { properties: { route_id: 'B2', route_type: 'CONV' } } });
    expect(ctx.setSelectedRouteIds).toHaveBeenCalledWith(['B2'], 'CONV');
    expect(ctx.setSelectedFeature).toHaveBeenCalledWith({ type: 'ATS_ROUTE', data: { route_id: 'B2', route_type: 'CONV' } });

    // Click to deselect
    mvtRoutes.props.onClick({ object: { properties: { route_id: 'A1', route_type: 'RNAV' } } });
    expect(ctx.setSelectedRouteIds).toHaveBeenCalledWith([], null);

    const tripsLayer = layers[1];
    expect(tripsLayer.id).toBe('atsRoutes-trips-layer');
    expect(tripsLayer.props.getPath({ path: [[0,0,1]] })).toEqual([[0,0]]);
    expect(tripsLayer.props.getTimestamps({ path: [[0,0,1]] })).toEqual([1]);
    expect(tripsLayer.props.getColor({ route_type: 'RNAV' })).toEqual([50, 205, 50]);
    expect(tripsLayer.props.getColor({ route_type: 'CONV' })).toEqual([0, 255, 255]);

    const mvtWaypoints = layers[5];
    expect(mvtWaypoints.id).toBe('atsRoutes-waypoints-layer');

    const wpFeature = { properties: { route_ids: '{"A1","B2"}', waypoint_name: 'FIX' } };
    expect(mvtWaypoints.props.getIconColor(wpFeature)).toEqual([50, 205, 50, 255]); // Lime green for selected RNAV
    expect(mvtWaypoints.props.getTextColor(wpFeature)).toEqual([50, 205, 50, 255]);
    expect(mvtWaypoints.props.getTextSize(wpFeature)).toBe(12);

    mvtWaypoints.props.onClick({ object: { geometry: { coordinates: [0, 0] }, properties: wpFeature.properties } });
    expect(ctx.setSelectedRouteIds).toHaveBeenCalledWith(['A1', 'B2'], 'WAYPOINT');

    // Test clicking a waypoint that's already selected
    const selectedCtx = { ...ctx, selectedRouteIds: ['A1', 'B2'] };
    const selectedLayers = createAtsRouteLayers(selectedCtx as any);
    selectedLayers[5].props.onClick({ object: { geometry: { coordinates: [0, 0] }, properties: wpFeature.properties } });
    expect(ctx.setSelectedRouteIds).toHaveBeenCalledWith([]);

    // click empty
    mvtWaypoints.props.onClick({});
    expect(ctx.setSelectedRouteIds).toHaveBeenCalledWith([]);

    // Testing label layer logic
    const labelBgLayer = layers[2]; // ats-route-labels-bg-layer
    expect(labelBgLayer.props.getSize({ properties: { route_id: 'A1' } })).toBeGreaterThan(0);
    const labelHexLayer = layers[3]; // ats-route-labels-hex-layer
    expect(labelHexLayer.props.getColor({ properties: { route_id: 'B2', route_type: 'CONV' } })).toEqual([34, 211, 238, 140]);
  });

  it('handles hidden layer state and unselected logic', () => {
    const ctx = {
      viewMode: 'ENROUTE',
      viewState: { zoom: 8 },
      activeLayers: {
        atsRoutes: false,
      },
      selectedRouteIds: [],
      selectedFeature: null,
      selectedRouteType: null,
      animatedTrips: [],
      currentTime: 0,
      atsRouteLabels: null,
      setSelectedRouteIds: vi.fn(),
      setSelectedFeature: vi.fn()
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

  it('handles selected waypoints in trip colors and icon color', () => {
    const ctx = {
      viewMode: 'ENROUTE',
      viewState: { zoom: 8 },
      activeLayers: { atsRoutes: true },
      selectedRouteIds: ['A1'],
      selectedFeature: null,
      selectedRouteType: 'WAYPOINT', // testing the waypoint override logic
      animatedTrips: [{ path: [[0, 0, 1]] }],
      currentTime: 1.5,
      atsRouteLabels: null,
      setSelectedRouteIds: vi.fn(),
      setSelectedFeature: vi.fn()
    };

    const layers = createAtsRouteLayers(ctx as any);

    // Trips
    expect(layers[1].props.getColor({})).toEqual([192, 132, 252]);

    // Waypoints
    const wpFeature = { properties: { route_ids: '{"A1"}' } };
    expect(layers[2].props.getIconColor(wpFeature)).toEqual([192, 132, 252, 255]); // COLOR_NEON_PURPLE
    expect(layers[2].props.getTextColor(wpFeature)).toEqual([192, 132, 252, 255]); // COLOR_NEON_PURPLE
  });
});
