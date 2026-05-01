import { describe, it, expect } from 'vitest';
import { createAirspaceLayers } from '../../features/map/layers/createAirspaceLayers';

describe('createAirspaceLayers', () => {
  it('creates geometry and metadata MVT layers', () => {
    const ctx = {
      viewMode: 'ENROUTE',
      viewState: { zoom: 8 },
      activeLayers: {
        airspaces: true,
        airspaceFIR: true,
        airspaceRegulated: true,
        airspaceControl: true,
        airspaceUpr: true,
      },
      highlightedAirspaceId: null,
    };

    const layers = createAirspaceLayers(ctx as any);
    expect(layers.length).toBe(2);
    expect(layers[0].id).toBe('airspace-basemap-layer');
    expect(layers[1].id).toBe('airspace-metadata-layer');

    const geomLayer = layers[0];
    const metaLayer = layers[1];

    // Check line color logic
    const firFeature = { properties: { airspace_type: 'FIR' } };
    expect(geomLayer.props.getLineColor(firFeature)).toEqual([255, 165, 0, 80]); // FIR stroke

    // Check line color hierarchy zoom hiding
    const lowZoomCtx = { ...ctx, viewState: { zoom: 1 } };
    const lowZoomLayers = createAirspaceLayers(lowZoomCtx as any);
    expect(lowZoomLayers[0].props.getLineColor(firFeature)).toEqual([0, 0, 0, 0]);

    // Check text logic
    const ctaFeature = { properties: { airspace_type: 'CTA_LOWER', name: 'TEST CTA' } };
    expect(metaLayer.props.getText(ctaFeature)).toBe('TEST CTA');

    const longFeature = {
      properties: {
        airspace_type: 'CTA_LOWER',
        name: 'THIS IS A VERY LONG NAME THAT EXCEEDS LIMITS',
      },
    };
    expect(metaLayer.props.getText(longFeature)).toBe('THIS IS A VERY LONG ...');

    // Test inference
    const inferFeature = { properties: { identification: 'VAD123' } };
    expect(metaLayer.props.getText(inferFeature)).toBe('VAD123'); // Infers DANGER
    expect(metaLayer.props.getCollisionPriority(inferFeature)).toBe(10); // getCollisionPriority doesn't use inferAirspaceType, just airspace_type directly. It evaluates to 10

    // Missing identification and type
    const emptyFeature = { properties: {} };
    expect(metaLayer.props.getText(emptyFeature)).toBe('');

    // Check highlight logic
    const highlightCtx = { ...ctx, highlightedAirspaceId: '123' };
    const highlightLayers = createAirspaceLayers(highlightCtx as any);

    const highlightFeature = { properties: { id: '123', airspace_type: 'FIR', name: 'FIR' } };
    expect(highlightLayers[1].props.getTextColor(highlightFeature)).toEqual([0, 0, 0, 255]);
    expect(highlightLayers[1].props.getBackgroundColor(highlightFeature)).toEqual([
      255, 255, 0, 40,
    ]);
    expect(highlightLayers[1].props.getBorderColor(highlightFeature)).toEqual([255, 255, 0, 255]);

    // Check non-highlight borders
    expect(
      highlightLayers[1].props.getBorderColor({
        properties: { airspace_type: 'FIR', name: 'FIR' },
      }),
    ).toEqual([255, 165, 0, 255]);
    // Without name it's invisible
    expect(
      highlightLayers[1].props.getBorderColor({ properties: { airspace_type: 'FIR' } }),
    ).toEqual([0, 0, 0, 0]);

    expect(highlightLayers[1].props.getTextSize(highlightFeature)).toBe(12);
    expect(highlightLayers[1].props.getTextSize({ properties: { airspace_type: 'FIR' } })).toBe(0);
  });

  it('respects layer toggles for all types', () => {
    const ctx = {
      viewMode: 'ENROUTE',
      viewState: { zoom: 8 },
      activeLayers: {
        airspaces: true,
        airspaceFIR: false,
        airspaceRegulated: false,
        airspaceControl: false,
        airspaceUpr: false,
      },
    };

    const layers = createAirspaceLayers(ctx as any);

    const firFeature = { properties: { airspace_type: 'FIR', name: 'FIR' } };
    expect(layers[0].props.getLineColor(firFeature)).toEqual([0, 0, 0, 0]); // Transparent when hidden
    expect(layers[1].props.getText(firFeature)).toBe('');

    const dangerFeature = { properties: { airspace_type: 'DANGER', name: 'D' } };
    expect(layers[0].props.getLineColor(dangerFeature)).toEqual([0, 0, 0, 0]);

    const ctrFeature = { properties: { airspace_type: 'CTR', name: 'C' } };
    expect(layers[0].props.getLineColor(ctrFeature)).toEqual([0, 0, 0, 0]);

    const uprFeature = { properties: { airspace_type: 'UPR_ZONE', name: 'U' } };
    expect(layers[0].props.getLineColor(uprFeature)).toEqual([0, 0, 0, 0]);

    const unknownFeature = { properties: { airspace_type: 'XYZ', name: 'X' } };
    expect(layers[0].props.getLineColor(unknownFeature)).toEqual([128, 128, 128, 60]); // defaults
  });
});
