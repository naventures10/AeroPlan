import { describe, it, expect, vi } from 'vitest';
import { createWaypointLayer } from '../../features/map/layers/createWaypointLayer';

describe('createWaypointLayer', () => {
  it('creates MVT waypoint layer with proper styling', () => {
    const ctx = {
      viewMode: 'ENROUTE',
      activeLayers: { atsRoutes: false, waypoints: true }, // if false, waypoints pickable
      zoom: 8,
      selectedFeature: null,
      setSelectedFeature: vi.fn(),
    };

    const layers = createWaypointLayer(ctx as any);
    expect(layers.length).toBe(1);

    const layer = layers[0];

    expect(layer.props.getIcon()).toBe('waypoint');
    expect(layer.props.getIconColor({})).toEqual([255, 255, 255, 255]);
    expect(layer.props.getIconSize({})).toBe(10);
    expect(layer.props.getText({ properties: { waypoint_name: 'WPT' } })).toBe('WPT');

    // Selected feature highlight
    const highlightCtx = {
      ...ctx,
      selectedFeature: { type: 'WAYPOINT', data: { waypoint_name: 'TEST' } },
    };
    const highlightLayers = createWaypointLayer(highlightCtx as any);
    expect(
      highlightLayers[0].props.getIconColor({ properties: { waypoint_name: 'TEST' } }),
    ).toEqual([93, 248, 216, 255]);
    expect(highlightLayers[0].props.getIconSize({ properties: { waypoint_name: 'TEST' } })).toBe(
      16,
    );

    // Text size logic
    const layerProps = highlightLayers[0].props;
    expect(layerProps.getTextSize({ properties: {} })).toBe(11);

    // if ATS routes active and has routes, text size 0
    const atsCtx = { ...ctx, activeLayers: { atsRoutes: true, waypoints: true } };
    const atsLayers = createWaypointLayer(atsCtx as any);
    expect(atsLayers[0].props.getTextSize({ properties: { routes: 'A1' } })).toBe(0);

    // Click handling
    layer.props.onClick({ object: { properties: { waypoint_name: 'W1' } } });
    expect(ctx.setSelectedFeature).toHaveBeenCalledWith({
      type: 'WAYPOINT',
      data: { waypoint_name: 'W1' },
    });
  });

  it('hides layers when viewMode is TERMINAL', () => {
    const ctx = {
      viewMode: 'TERMINAL',
      activeLayers: { atsRoutes: false, waypoints: false },
      zoom: 8,
    };
    const layers = createWaypointLayer(ctx as any);
    expect(layers[0].props.visible).toBe(false);
  });
});
