import { describe, it, expect, vi } from 'vitest';
import { createNavaidLayer } from '../../features/map/layers/createNavaidLayer';

describe('createNavaidLayer', () => {
  it('creates MVT navaid layer with proper styling', () => {
    const ctx = {
      viewMode: 'ENROUTE',
      activeLayers: { navaids: true },
      zoom: 8,
      selectedFeature: null,
      setSelectedFeature: vi.fn(),
    };

    const layers = createNavaidLayer(ctx as any);
    expect(layers.length).toBe(1);

    const layer = layers[0];

    // Check icon mapping logic
    expect(layer.props.getIcon({ properties: { aid_type: 'VOR' } }).url).toBe('/VOR.svg');

    // Default icon color (Emerald)
    expect(layer.props.getIconColor({ properties: { ident: 'V1' } })).toEqual([52, 211, 153, 255]);

    // Check size logic based on zoom
    expect(layer.props.getIconSize({})).toBeGreaterThan(0);
    expect(layer.props.getTextSize).toBeGreaterThan(0); // It's just a number

    // Selected feature highlight
    const highlightCtx = {
      ...ctx,
      selectedFeature: { type: 'NAVAID', data: { ident: 'TEST' } },
    };
    const highlightLayers = createNavaidLayer(highlightCtx as any);
    // Highlighted icon color (Neon Cyan -> [0, 255, 255, 255])
    expect(highlightLayers[0].props.getIconColor({ properties: { ident: 'TEST' } })).toEqual([
      0, 255, 255, 255,
    ]);
    expect(highlightLayers[0].props.getIconColor({ properties: { ident: 'OTHER' } })).toEqual([
      52, 211, 153, 255,
    ]);

    // Click handling
    layer.props.onClick({ object: { properties: { ident: 'V1' } } });
    expect(ctx.setSelectedFeature).toHaveBeenCalledWith({ type: 'NAVAID', data: { ident: 'V1' } });
  });

  it('hides layers when viewMode is TERMINAL', () => {
    const ctx = {
      viewMode: 'TERMINAL',
      activeLayers: { navaids: true },
      zoom: 8,
    };
    const layers = createNavaidLayer(ctx as any);
    expect(layers[0].props.visible).toBe(false);
  });
});
