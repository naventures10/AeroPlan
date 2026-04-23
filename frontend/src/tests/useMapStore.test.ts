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
        ercMap: false,
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
      selectedRnpProcedureId: null,
      selectedRnpChartKey: null,
      selectedRnpBounds: null,
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

  it('should set and clear RNP procedure selection', () => {
    let state = useMapStore.getState();
    state.setSelectedRnpProcedure({
      procedureId: 42,
      chartKey: 'VAAU-RNP-Y-RWY-27',
      bounds: [78.0, 10.0, 79.0, 11.0],
    });
    state = useMapStore.getState();
    expect(state.selectedRnpProcedureId).toBe(42);
    expect(state.selectedRnpChartKey).toBe('VAAU-RNP-Y-RWY-27');
    expect(state.selectedRnpBounds).toEqual([78.0, 10.0, 79.0, 11.0]);

    state.setSelectedRnpProcedure(null);
    state = useMapStore.getState();
    expect(state.selectedRnpProcedureId).toBeNull();
    expect(state.selectedRnpChartKey).toBeNull();
    expect(state.selectedRnpBounds).toBeNull();
  });

  it('should clear RNP when switching to ENROUTE', () => {
    useMapStore.setState({ viewMode: 'TERMINAL' });
    useMapStore.getState().setSelectedRnpProcedure({
      procedureId: 1,
      chartKey: 'KEY',
      bounds: null,
    });
    useMapStore.getState().setViewMode('ENROUTE');
    const state = useMapStore.getState();
    expect(state.selectedRnpProcedureId).toBeNull();
  });

  it('should clear RNP when changing active airport', () => {
    useMapStore.getState().setActiveAirport('VAAU');
    useMapStore.getState().setSelectedRnpProcedure({
      procedureId: 99,
      chartKey: 'X',
      bounds: null,
    });
    useMapStore.getState().setActiveAirport('VOBL');
    expect(useMapStore.getState().selectedRnpProcedureId).toBeNull();
  });
});
