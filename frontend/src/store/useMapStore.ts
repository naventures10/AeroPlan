import { create } from 'zustand';

// 1. Define the TypeScript Blueprint
interface MapState {
  // Camera State
  viewState: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch: number;
    bearing: number;
    maxPitch: number;
    transitionDuration?: number | 'auto';
    transitionType?: 'FLY' | 'LINEAR';
  };

  // UI & App State
  viewMode: 'ENROUTE' | 'TERMINAL';
  setViewMode: (mode: 'ENROUTE' | 'TERMINAL') => void;

  // Metadata for the active aerodrome
  activeAerodromeMetadata: any | null;
  setActiveAerodromeMetadata: (data: any) => void;

  searchQuery: string;
  activeLayers: {
    aerodromes: boolean;
    waypoints: boolean;
    navaids: boolean;
    atsRoutes: boolean;
    wacMap: boolean;
    airspaces: boolean;
    airspaceFIR: boolean;
    airspaceRegulated: boolean;
    airspaceControl: boolean;
    airspaceUpr: boolean;
  };

  selectedRouteIds: string[];
  selectedRouteType: string | null;
  setSelectedRouteIds: (routeIds: string[], routeType?: string | null) => void;

  activeAirport: string | null;
  setActiveAirport: (code: string | null) => void;

  /** Terminal RNP: selected procedure from chart modal → 3D MVT layer */
  selectedRnpProcedureId: number | null;
  selectedRnpChartKey: string | null;
  selectedRnpBounds: [number, number, number, number] | null;
  setSelectedRnpProcedure: (
    payload: {
      procedureId: number;
      chartKey: string;
      bounds: [number, number, number, number] | null;
    } | null,
  ) => void;

  selectedFeature: {
    type: 'ATS_ROUTE' | 'WAYPOINT' | 'NAVAID' | 'AIRSPACE_STACK';
    data: any;
  } | null;
  setSelectedFeature: (
    feature: { type: 'ATS_ROUTE' | 'WAYPOINT' | 'NAVAID' | 'AIRSPACE_STACK'; data: any } | null,
  ) => void;

  highlightedAirspaceId: string | null;
  setHighlightedAirspaceId: (id: string | null) => void;

  atsRouteLabels: any | null;
  setAtsRouteLabels: (data: any) => void;

  boundsToFit: [number, number, number, number] | null;
  fitBounds: (bounds: [number, number, number, number] | null) => void;

  animatedTrips: any[];
  setAnimatedTrips: (trips: any[]) => void;
  animatedLabels: any[];
  setAnimatedLabels: (labels: any[]) => void;
  animationConfig: { playing: boolean; duration: number } | null;
  setAnimationConfig: (config: { playing: boolean; duration: number } | null) => void;

  // Actions (Functions to change the state)
  setViewState: (viewState: any) => void;
  toggleViewMode: () => void;
  setSearchQuery: (query: string) => void;
  toggleLayer: (layer: keyof MapState['activeLayers']) => void;
  flyToLocation: (
    lng: number,
    lat: number,
    zoom?: number,
    pitch?: number,
    forceViewMode?: 'ENROUTE' | 'TERMINAL',
  ) => void;
  returnToEnroute: () => void;

  terminalPivot: [number, number] | null;
  setTerminalPivot: (coords: [number, number] | null) => void;
}

export const DEFAULT_VIEW = {
  longitude: 78.9629,
  latitude: 20.5937,
  zoom: 4.5,
  pitch: 0,
  bearing: 0,
  maxPitch: 85,
};

// 2. Initialize the Store
export const useMapStore = create<MapState>((set, get) => ({
  // Default starting view (High-level India)
  viewState: DEFAULT_VIEW,

  viewMode: 'ENROUTE',
  setViewMode: (mode) =>
    set({
      viewMode: mode,
      ...(mode === 'ENROUTE'
        ? {
            selectedRnpProcedureId: null,
            selectedRnpChartKey: null,
            selectedRnpBounds: null,
          }
        : {}),
    }),

  activeAerodromeMetadata: null,
  setActiveAerodromeMetadata: (data) => set({ activeAerodromeMetadata: data }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

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

  toggleLayer: (layer) =>
    set((state) => ({
      activeLayers: {
        ...state.activeLayers,
        [layer]: !state.activeLayers[layer],
      },
    })),

  selectedRouteIds: [],
  selectedRouteType: null,
  setSelectedRouteIds: (routeIds, routeType = null) =>
    set({
      selectedRouteIds: routeIds,
      selectedRouteType: routeType,
    }),

  activeAirport: null,
  setActiveAirport: (code) =>
    set({
      activeAirport: code,
      selectedRnpProcedureId: null,
      selectedRnpChartKey: null,
      selectedRnpBounds: null,
    }),

  selectedRnpProcedureId: null,
  selectedRnpChartKey: null,
  selectedRnpBounds: null,
  setSelectedRnpProcedure: (payload) =>
    set(
      payload
        ? {
            selectedRnpProcedureId: payload.procedureId,
            selectedRnpChartKey: payload.chartKey,
            selectedRnpBounds: payload.bounds,
          }
        : {
            selectedRnpProcedureId: null,
            selectedRnpChartKey: null,
            selectedRnpBounds: null,
          },
    ),

  selectedFeature: null,
  setSelectedFeature: (feature) => set({ selectedFeature: feature }),

  highlightedAirspaceId: null,
  setHighlightedAirspaceId: (id) => set({ highlightedAirspaceId: id }),

  atsRouteLabels: null,
  setAtsRouteLabels: (data) => {
    set({ atsRouteLabels: data });
  },

  boundsToFit: null,
  fitBounds: (bounds) => {
    set({ boundsToFit: bounds });
  },

  animatedTrips: [],
  setAnimatedTrips: (trips) => set({ animatedTrips: trips }),
  animatedLabels: [],
  setAnimatedLabels: (labels) => set({ animatedLabels: labels }),
  animationConfig: null,
  setAnimationConfig: (config) => set({ animationConfig: config }),

  terminalPivot: null,
  setTerminalPivot: (coords) => {
    set({ terminalPivot: coords });
  },

  // Basic Setters
  setViewState: (viewState) => set({ viewState }),

  toggleViewMode: () => {
    const { viewMode, viewState } = get();
    const newMode = viewMode === 'ENROUTE' ? 'TERMINAL' : 'ENROUTE';
    set({
      viewMode: newMode,
      ...(newMode === 'ENROUTE'
        ? {
            selectedRnpProcedureId: null,
            selectedRnpChartKey: null,
            selectedRnpBounds: null,
          }
        : {}),
      viewState: {
        ...viewState,
        pitch: newMode === 'TERMINAL' ? 45 : 0,
        transitionDuration: 1000,
        transitionType: 'LINEAR',
      },
    });
  },

  returnToEnroute: () => {
    set({
      viewMode: 'ENROUTE',
      activeAirport: null,
      selectedRnpProcedureId: null,
      selectedRnpChartKey: null,
      selectedRnpBounds: null,
      selectedFeature: null,
      terminalPivot: null,
      viewState: {
        ...DEFAULT_VIEW,
        transitionDuration: 2500,
        transitionType: 'FLY',
      },
    });
  },

  // The "Search & Fly" Logic
  flyToLocation: (lng, lat, zoom = 14, pitch = 0, forceViewMode) => {
    set({
      viewMode: forceViewMode || (pitch > 0 ? 'TERMINAL' : 'ENROUTE'),
      viewState: {
        longitude: lng,
        latitude: lat,
        zoom: zoom,
        pitch: pitch,
        bearing: 0,
        maxPitch: 85,
        transitionDuration: 1200,
        transitionType: 'FLY',
      },
    });
  },
}));
