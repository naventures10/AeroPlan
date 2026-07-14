import { describe, it, expect } from 'vitest';
import { createAirspaceLayers } from '../../features/map/layers/createAirspaceLayers';

describe('createAirspaceLayers', () => {
  it('creates geometry and metadata MVT layers', () => {
    const ctx = {
      isDarkMode: true,
      viewMode: 'ENROUTE',
      zoom: 8,
      isAirspaceLoaded: true,
      setAirspaceLoaded: () => {},
      activeLayers: {
        airspaces: true,
        airspace_FIR: true,
        airspace_ADIZ: true,
        airspace_CTA_UPPER: true,
        airspace_UPR_ZONE: true,
        airspace_DANGER: true,
        airspace_PROHIBITED: true,
        airspace_RESTRICTED: true,
        airspace_CTA_LOWER: true,
        airspace_TRA: true,
        airspace_TSA: true,
        airspace_CTR: true,
      },
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

    // Check line color hierarchy zoom hiding (should remain visible as minZoom limits were removed)
    const lowZoomCtx = { ...ctx, zoom: 1 };
    const lowZoomLayers = createAirspaceLayers(lowZoomCtx as any);
    expect(lowZoomLayers[0].props.getLineColor(firFeature)).toEqual([255, 165, 0, 80]);

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

    // Check borders
    expect(
      layers[1].props.getBorderColor({
        properties: { airspace_type: 'FIR', name: 'FIR' },
      }),
    ).toEqual([255, 165, 0, 255]);
    // Without name it's invisible
    expect(layers[1].props.getBorderColor({ properties: { airspace_type: 'FIR' } })).toEqual([
      0, 0, 0, 0,
    ]);

    const someFeature = { properties: { airspace_type: 'FIR', name: 'FIR' } };
    expect(layers[1].props.getTextSize(someFeature)).toBe(12);
    expect(layers[1].props.getTextSize({ properties: { airspace_type: 'FIR' } })).toBe(0);
  });

  it('makes airspace metadata labels not pickable when airspaces layer is toggled off', () => {
    const ctx = {
      isDarkMode: true,
      viewMode: 'ENROUTE',
      zoom: 8,
      activeLayers: {
        airspaces: false,
      },
    };

    const layersOff = createAirspaceLayers(ctx as any);
    expect(layersOff[1].props.pickable).toBe(false);

    const ctxOn = {
      ...ctx,
      activeLayers: { ...ctx.activeLayers, airspaces: true },
    };
    const layersOn = createAirspaceLayers(ctxOn as any);
    expect(layersOn[1].props.pickable).toBe(true);
  });

  it('respects layer toggles for all types', () => {
    const ctx = {
      isDarkMode: true,
      viewMode: 'ENROUTE',
      zoom: 8,
      isAirspaceLoaded: true,
      setAirspaceLoaded: () => {},
      activeLayers: {
        airspaces: true,
        airspace_FIR: false,
        airspace_ADIZ: false,
        airspace_CTA_UPPER: false,
        airspace_UPR_ZONE: false,
        airspace_DANGER: false,
        airspace_PROHIBITED: false,
        airspace_RESTRICTED: false,
        airspace_CTA_LOWER: false,
        airspace_TRA: false,
        airspace_TSA: false,
        airspace_CTR: false,
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

  it('has static transitions', () => {
    const ctx = {
      isDarkMode: true,
      viewMode: 'ENROUTE',
      zoom: 8,
      isAirspaceLoaded: true,
      setAirspaceLoaded: () => {},
      activeLayers: {
        airspaces: true,
        airspace_FIR: true,
        airspace_ADIZ: true,
        airspace_CTA_UPPER: true,
        airspace_UPR_ZONE: true,
        airspace_DANGER: true,
        airspace_PROHIBITED: true,
        airspace_RESTRICTED: true,
        airspace_CTA_LOWER: true,
        airspace_TRA: true,
        airspace_TSA: true,
        airspace_CTR: true,
      },
    };

    const layers = createAirspaceLayers(ctx as any);
    expect(layers[0].props.transitions.getLineColor).toBe(300);
    expect(layers[1].props.transitions.getTextColor).toBe(300);
    expect(layers[1].props.transitions.getBorderColor).toBe(300);
  });
});
