import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore, DEFAULT_VIEW } from '../../store/useMapStore';

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
        windlayer: false,
      },
      selectedRouteIds: [],
      selectedRouteType: null,
      activeAirport: null,
      selectedFeature: null,
      highlightedAirspaceId: null,
      atsRouteLabels: null,
      boundsToFit: null,
      animatedTrips: [],
      animatedLabels: [],
      animationConfig: null,
      terminalPivot: null,
      selectedRnpProcedureId: null,
      selectedRnpChartKey: null,
      selectedRnpBounds: null,
      selectedRnpApproachId: null,
      windAltitude: 0,
      windAnimationTime: 0,
      windIsPlaying: false,
      isWindMode: false,
    });
  });

  it('should have initial state', () => {
    const state = useMapStore.getState();
    expect(state.activeAirport).toBeNull();
    expect(state.viewMode).toBe('ENROUTE');
  });

  it('should toggle map layers accurately', () => {
    let state = useMapStore.getState();
    expect(state.activeLayers.wacMap).toBe(false);
    expect(state.activeLayers.ercMap).toBe(false);

    // Turn wacMap ON, should turn ercMap OFF
    state.toggleLayer('wacMap');
    state = useMapStore.getState();
    expect(state.activeLayers.wacMap).toBe(true);
    expect(state.activeLayers.ercMap).toBe(false);

    // Turn ercMap ON, should turn wacMap OFF
    state.toggleLayer('ercMap');
    state = useMapStore.getState();
    expect(state.activeLayers.wacMap).toBe(false);
    expect(state.activeLayers.ercMap).toBe(true);
  });

  it('should test remaining actions correctly', () => {
    const state = useMapStore.getState();

    state.setViewMode('TERMINAL');
    expect(useMapStore.getState().viewMode).toBe('TERMINAL');

    state.setViewMode('ENROUTE');
    expect(useMapStore.getState().viewMode).toBe('ENROUTE');

    state.setActiveAerodromeMetadata({ name: 'Test' } as any);
    expect(useMapStore.getState().activeAerodromeMetadata).toEqual({ name: 'Test' });

    state.setSearchQuery('test');
    expect(useMapStore.getState().searchQuery).toBe('test');

    state.setSelectedRouteIds(['A1', 'A2'], 'ATS_ROUTE');
    expect(useMapStore.getState().selectedRouteIds).toEqual(['A1', 'A2']);
    expect(useMapStore.getState().selectedRouteType).toBe('ATS_ROUTE');

    state.setActiveAirport('KJFK');
    expect(useMapStore.getState().activeAirport).toBe('KJFK');
    expect(useMapStore.getState().selectedRnpProcedureId).toBeNull();

    state.setSelectedRnpApproachId('app1');
    expect(useMapStore.getState().selectedRnpApproachId).toBe('app1');

    state.setSelectedRnpProcedure({ procedureId: 1, chartKey: 'chart1', bounds: [0, 0, 1, 1] });
    expect(useMapStore.getState().selectedRnpApproachId).toBeNull(); // it sets approachId to null

    state.setSelectedFeature({ type: 'WAYPOINT', data: { name: 'FIX' } });
    expect(useMapStore.getState().selectedFeature).toEqual({
      type: 'WAYPOINT',
      data: { name: 'FIX' },
    });

    state.setHighlightedAirspaceId('air1');
    expect(useMapStore.getState().highlightedAirspaceId).toBe('air1');

    state.setAtsRouteLabels({ labels: 'test' } as any);
    expect(useMapStore.getState().atsRouteLabels).toEqual({ labels: 'test' });

    state.fitBounds([0, 0, 10, 10]);
    expect(useMapStore.getState().boundsToFit).toEqual([0, 0, 10, 10]);

    state.setAnimatedTrips([{ trip: 1 }] as any);
    expect(useMapStore.getState().animatedTrips).toEqual([{ trip: 1 }]);

    state.setAnimatedLabels([{ label: 1 }] as any);
    expect(useMapStore.getState().animatedLabels).toEqual([{ label: 1 }]);

    state.setAnimationConfig({ playing: true, duration: 100 } as any);
    expect(useMapStore.getState().animationConfig).toEqual({ playing: true, duration: 100 });

    state.setTerminalPivot([5, 5]);
    expect(useMapStore.getState().terminalPivot).toEqual([5, 5]);

    state.setViewState({ zoom: 10 });
    expect(useMapStore.getState().viewState.zoom).toBe(10);
  });

  describe('Weather Layer State Management', () => {
    it('should allow enabling wind layer in ENROUTE mode', () => {
      const state = useMapStore.getState();
      expect(state.viewMode).toBe('ENROUTE');

      state.setIsWindMode(true);
      expect(useMapStore.getState().isWindMode).toBe(true);
      expect(useMapStore.getState().activeLayers.windlayer).toBe(true);
    });

    it('should disable wind layer when switching to TERMINAL mode via setViewMode', () => {
      useMapStore.getState().setIsWindMode(true);
      useMapStore.getState().setViewMode('TERMINAL');
      expect(useMapStore.getState().viewMode).toBe('TERMINAL');
      expect(useMapStore.getState().isWindMode).toBe(false);
      expect(useMapStore.getState().activeLayers.windlayer).toBe(false);
    });

    it('should disable wind layer when switching to TERMINAL mode via toggleViewMode', () => {
      useMapStore.getState().setIsWindMode(true);
      useMapStore.getState().toggleViewMode();
      expect(useMapStore.getState().viewMode).toBe('TERMINAL');
      expect(useMapStore.getState().isWindMode).toBe(false);
    });

    it('should disable wind layer when pitch becomes > 0 via setViewState', () => {
      useMapStore.getState().setIsWindMode(true);
      useMapStore.getState().setViewState({ ...DEFAULT_VIEW, pitch: 30 });
      expect(useMapStore.getState().isWindMode).toBe(false);
    });

    it('should prevent enabling wind layer if already in TERMINAL mode', () => {
      useMapStore.getState().setViewMode('TERMINAL');
      useMapStore.getState().setIsWindMode(true);
      expect(useMapStore.getState().isWindMode).toBe(false);
    });

    it('should prevent enabling wind layer if map is tilted', () => {
      useMapStore.getState().setViewState({ ...DEFAULT_VIEW, pitch: 10 });
      useMapStore.getState().setIsWindMode(true);
      expect(useMapStore.getState().isWindMode).toBe(false);
    });

    it('should disable wind layer when selecting an airport', () => {
      useMapStore.getState().setIsWindMode(true);
      useMapStore.getState().setActiveAirport('VOMM');
      expect(useMapStore.getState().isWindMode).toBe(false);
      expect(useMapStore.getState().viewMode).toBe('TERMINAL');
    });
  });

  it('should toggle view mode with specific pitch mapping', () => {
    const state = useMapStore.getState();
    state.toggleViewMode();
    expect(useMapStore.getState().viewMode).toBe('TERMINAL');
    expect(useMapStore.getState().viewState.pitch).toBe(45);
  });

  it('flyToLocation should set properties properly', () => {
    useMapStore.getState().flyToLocation(10, 20, 10, 45, 'TERMINAL');
    const state = useMapStore.getState();
    expect(state.viewMode).toBe('TERMINAL');
    expect(state.viewState.longitude).toBe(10);
    expect(state.viewState.latitude).toBe(20);
    expect(state.viewState.zoom).toBe(10);
    expect(state.viewState.pitch).toBe(45);
  });

  it('flyToLocation with no forceViewMode should detect TERMINAL via pitch', () => {
    useMapStore.getState().flyToLocation(10, 20, 10, 45);
    expect(useMapStore.getState().viewMode).toBe('TERMINAL');
  });

  it('flyToLocation with no forceViewMode should detect ENROUTE via pitch=0', () => {
    useMapStore.getState().flyToLocation(10, 20, 10, 0);
    expect(useMapStore.getState().viewMode).toBe('ENROUTE');
  });

  it('returnToEnroute should cleanup everything', () => {
    useMapStore.setState({
      activeAirport: 'KLAX',
      selectedRnpProcedureId: 1,
      selectedRnpChartKey: 'X',
      selectedRnpBounds: [0, 0, 0, 0],
      selectedRnpApproachId: 'id',
      selectedFeature: { type: 'NAVAID', data: {} } as any,
      terminalPivot: [0, 0],
    });
    useMapStore.getState().returnToEnroute();
    const state = useMapStore.getState();
    expect(state.activeAirport).toBeNull();
    expect(state.selectedRnpProcedureId).toBeNull();
    expect(state.selectedRnpChartKey).toBeNull();
    expect(state.selectedRnpBounds).toBeNull();
    expect(state.selectedRnpApproachId).toBeNull();
    expect(state.selectedFeature).toBeNull();
    expect(state.terminalPivot).toBeNull();
    expect(state.viewMode).toBe('ENROUTE');
  });
});
