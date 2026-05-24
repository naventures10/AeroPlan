import { describe, it, expect, vi } from 'vitest';
import { createAerodromeLayers } from '../../features/map/layers/createAerodromeLayers';

describe('createAerodromeLayers', () => {
  it('creates layers with proper props and handles click', () => {
    const mockOnClick = vi.fn();
    const ctx = { viewMode: 'ENROUTE', activeLayers: { aerodromes: true } };
    const layers = createAerodromeLayers(ctx as any, {}, [], mockOnClick);

    expect(layers.length).toBe(3);
    expect(layers[0].id).toBe('aerodromes-compass-layer');
    expect(layers[1].id).toBe('aerodromes-layer');
    expect(layers[2].id).toBe('aerodrome-text-layer');

    const compassLayer = layers[0];
    const geoJsonLayer = layers[1];
    const textLayer = layers[2];

    expect(compassLayer.props.visible).toBe(true);
    expect(geoJsonLayer.props.visible).toBe(true);

    const mockInfo = {
      object: { properties: { icao_code: 'VAAU' }, geometry: { coordinates: [1, 2] } },
    };
    geoJsonLayer.props.onClick(mockInfo);
    expect(mockOnClick).toHaveBeenCalledWith('VAAU', [1, 2]);

    expect(compassLayer.props.getIcon()).toBeDefined();
    expect(geoJsonLayer.props.getIcon()).toBeDefined();

    expect(textLayer.props.getPosition({ position: [1, 2] })).toEqual([1, 2]);
    expect(textLayer.props.getText({ text: 'TXT' })).toEqual('TXT');
  });

  it('layers are hidden when not in ENROUTE', () => {
    const ctx = { viewMode: 'TERMINAL', activeLayers: { aerodromes: false } };
    const layers = createAerodromeLayers(ctx as any, {}, [], vi.fn());

    expect(layers[0].props.visible).toBe(false);
    expect(layers[1].props.visible).toBe(false);
    expect(layers[2].props.visible).toBe(false);
  });
});
