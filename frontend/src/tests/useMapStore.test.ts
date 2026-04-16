import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore, DEFAULT_VIEW } from '../store/useMapStore';

describe('useMapStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useMapStore.setState({
      viewState: DEFAULT_VIEW,
      viewMode: 'ENROUTE',
      activeAerodromeMetadata: null,
      searchQuery: '',
      activeLayers: {
        aerodromes: true,
        waypoints: false,
        navaids: false,
        atsRoutes: false,
        wacMap: false,
        airspaces: false,
        airspaceFIR: true,
        airspaceRegulated: true,
        airspaceControl: true,
        airspaceUpr: true,
      },
      selectedRouteIds: [],
      selectedRouteType: null,
      activeAirport: null,
      selectedFeature: null,
      atsRouteLabels: null,
      boundsToFit: null,
      animatedTrips: [],
      animatedLabels: [],
      animationConfig: null,
      terminalPivot: null,
    });
  });

  it('should have expected state after reset', () => {
    const state = useMapStore.getState();
    expect(state.viewMode).toBe('ENROUTE');

    // Verify default active layers
    expect(state.activeLayers.aerodromes).toBe(true);
    expect(state.activeLayers.waypoints).toBe(false);
    expect(state.activeLayers.airspaces).toBe(false);
  });

  it('should toggle an existing map layer successfully', () => {
    let state = useMapStore.getState();
    expect(state.activeLayers.airspaces).toBe(false);

    // Toggle airspaces ON
    state.toggleLayer('airspaces');
    state = useMapStore.getState();
    expect(state.activeLayers.airspaces).toBe(true);

    // Toggle airspaces OFF
    state.toggleLayer('airspaces');
    state = useMapStore.getState();
    expect(state.activeLayers.airspaces).toBe(false);
  });

  it('should toggle view modes properly between ENROUTE and TERMINAL', () => {
    let state = useMapStore.getState();
    expect(state.viewMode).toBe('ENROUTE');
    expect(state.viewState.pitch).toBe(0);

    state.toggleViewMode();
    state = useMapStore.getState();

    expect(state.viewMode).toBe('TERMINAL');
    expect(state.viewState.pitch).toBe(45);

    // Test returnToEnroute helper
    state.returnToEnroute();
    state = useMapStore.getState();
    expect(state.viewMode).toBe('ENROUTE');
    expect(state.viewState.pitch).toBe(0);
  });
});
