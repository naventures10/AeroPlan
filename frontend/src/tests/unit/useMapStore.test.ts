import { describe, it, expect, beforeEach, vi } from 'vitest';
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
        airspaces: false,
        airspaceFIR: true,
        airspaceRegulated: true,
        airspaceControl: true,
        airspaceUpr: true,
        ercMap: false,
        weather: false,
      },
      isWeatherMode: false,
      isCloudMode: false,
      cloudLoadingStatus: { state: 'idle' },
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
      selectedRnpApproachId: null,
      windAltitude: 0,
      windAnimationTime: 0,
      windIsPlaying: false,
      isWindMode: false,
      mapStyle: 'dark',
      isDarkMode: true,
      isAtsGeometryLoaded: false,
    });
  });

  it('should have initial state', () => {
    const state = useMapStore.getState();
    expect(state.activeAirport).toBeNull();
    expect(state.viewMode).toBe('ENROUTE');
  });

  it('should toggle terminal spatial filters', () => {
    const state = useMapStore.getState();
    expect(state.terminalSpatialFilters.buildings).toBe(true);

    state.toggleTerminalSpatialFilter('buildings');
    expect(useMapStore.getState().terminalSpatialFilters.buildings).toBe(false);

    state.toggleTerminalSpatialFilter('buildings');
    expect(useMapStore.getState().terminalSpatialFilters.buildings).toBe(true);
  });

  it('should toggle map layers accurately', () => {
    let state = useMapStore.getState();
    expect(state.activeLayers.ercMap).toBe(false);

    // Turn ercMap ON
    state.toggleLayer('ercMap');
    state = useMapStore.getState();
    expect(state.activeLayers.ercMap).toBe(true);

    // Turn ercMap OFF
    state.toggleLayer('ercMap');
    state = useMapStore.getState();
    expect(state.activeLayers.ercMap).toBe(false);
  });

  it('should reset isAtsGeometryLoaded and increment toggle counter when atsRoutes layer is toggled on, then resolve via fallback', () => {
    vi.useFakeTimers();
    let state = useMapStore.getState();
    const initialCounter = state.atsRoutesToggleCounter;
    state.setAtsGeometryLoaded(true);
    expect(useMapStore.getState().isAtsGeometryLoaded).toBe(true);

    // Toggle ATS routes layer ON
    state.toggleLayer('atsRoutes');
    state = useMapStore.getState();
    expect(state.isAtsGeometryLoaded).toBe(false);
    expect(state.atsRoutesToggleCounter).toBe(initialCounter + 1);

    // Advance fake timers by 200ms
    vi.advanceTimersByTime(200);
    expect(useMapStore.getState().isAtsGeometryLoaded).toBe(true);
    vi.useRealTimers();
  });

  it('should reset isAirspaceLoaded when airspaces layer is toggled on, then resolve via fallback', () => {
    vi.useFakeTimers();
    const state = useMapStore.getState();
    state.setAirspaceLoaded(true);
    expect(useMapStore.getState().isAirspaceLoaded).toBe(true);

    // Toggle airspaces layer ON
    state.toggleLayer('airspaces');
    expect(useMapStore.getState().isAirspaceLoaded).toBe(false);

    // Advance fake timers by 200ms
    vi.advanceTimersByTime(200);
    expect(useMapStore.getState().isAirspaceLoaded).toBe(true);
    vi.useRealTimers();
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

    state.setAtsRouteLabels({ labels: 'test' } as any);
    expect(useMapStore.getState().atsRouteLabels).toEqual({ labels: 'test' });

    state.fitBounds([0, 0, 10, 10]);
    expect(useMapStore.getState().boundsToFit).toEqual([0, 0, 10, 10]);

    state.setAnimatedTrips([{ trip: 1 }] as any);
    expect(useMapStore.getState().animatedTrips).toEqual([{ trip: 1 }]);

    state.setAnimatedLabels([{ label: 1 }] as any);
    expect(useMapStore.getState().animatedLabels).toEqual([{ label: 1 }]);

    state.setAnimationConfig({ playing: true, duration: 100 });
    expect(useMapStore.getState().animationConfig).toEqual({ playing: true, duration: 100 });

    state.setTerminalPivot([5, 5]);
    expect(useMapStore.getState().terminalPivot).toEqual([5, 5]);

    state.setViewState({ zoom: 10 });
    expect(useMapStore.getState().viewState.zoom).toBe(10);
  });

  describe('Weather Layer State Management', () => {
    it('should allow enabling weather layer in ENROUTE mode', () => {
      const state = useMapStore.getState();
      expect(state.viewMode).toBe('ENROUTE');

      state.setIsWeatherMode(true);
      expect(useMapStore.getState().isWeatherMode).toBe(true);
      expect(useMapStore.getState().activeLayers.weather).toBe(true);
    });

    it('should disable weather layer when switching to TERMINAL mode via setViewMode', () => {
      useMapStore.getState().setIsWeatherMode(true);
      useMapStore.getState().setViewMode('TERMINAL');
      expect(useMapStore.getState().viewMode).toBe('TERMINAL');
      expect(useMapStore.getState().isWeatherMode).toBe(false);
      expect(useMapStore.getState().activeLayers.weather).toBe(false);
    });

    it('should disable weather layer when switching to TERMINAL mode via toggleViewMode', () => {
      useMapStore.getState().setIsWeatherMode(true);
      useMapStore.getState().toggleViewMode();
      expect(useMapStore.getState().viewMode).toBe('TERMINAL');
      expect(useMapStore.getState().isWeatherMode).toBe(false);
    });

    it('should disable weather layer when pitch becomes > 0 via setViewState', () => {
      useMapStore.getState().setIsWeatherMode(true);
      useMapStore.getState().setViewState({ ...DEFAULT_VIEW, pitch: 30 });
      expect(useMapStore.getState().isWeatherMode).toBe(false);
    });

    it('should prevent enabling weather layer if already in TERMINAL mode', () => {
      useMapStore.getState().setViewMode('TERMINAL');
      useMapStore.getState().setIsWeatherMode(true);
      expect(useMapStore.getState().isWeatherMode).toBe(false);
    });

    it('should prevent enabling weather layer if map is tilted', () => {
      useMapStore.getState().setViewState({ ...DEFAULT_VIEW, pitch: 10 });
      useMapStore.getState().setIsWeatherMode(true);
      expect(useMapStore.getState().isWeatherMode).toBe(false);
    });

    it('should disable weather layer when selecting an airport', () => {
      useMapStore.getState().setIsWeatherMode(true);
      useMapStore.getState().setActiveAirport('VOMM');
      expect(useMapStore.getState().isWeatherMode).toBe(false);
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

  it('should update map style via setMapStyle', () => {
    expect(useMapStore.getState().mapStyle).toBe('dark');
    useMapStore.getState().setMapStyle('light');
    expect(useMapStore.getState().mapStyle).toBe('light');
  });

  it('should update isDarkMode reactively when mapStyle changes (getter bug regression)', () => {
    // Initial state is dark
    expect(useMapStore.getState().isDarkMode).toBe(true);

    let subscribedIsDarkMode = useMapStore.getState().isDarkMode;
    const unsubscribe = useMapStore.subscribe((state) => {
      subscribedIsDarkMode = state.isDarkMode;
    });

    useMapStore.getState().setMapStyle('light');

    // If isDarkMode is a getter, Object.assign copies it as a static true value
    // before the new state is fully formed, causing this to stay true.
    expect(useMapStore.getState().isDarkMode).toBe(false);
    expect(subscribedIsDarkMode).toBe(false);

    unsubscribe();
  });
});
