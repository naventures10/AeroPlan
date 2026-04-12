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
  };

  selectedRouteIds: string[];
  selectedRouteType: string | null;
  setSelectedRouteIds: (routeIds: string[], routeType?: string | null) => void;

  activeAirport: string | null;
  setActiveAirport: (code: string | null) => void;

  selectedFeature: { type: 'ATS_ROUTE' | 'WAYPOINT' | 'NAVAID'; data: any } | null;
  setSelectedFeature: (
    feature: { type: 'ATS_ROUTE' | 'WAYPOINT' | 'NAVAID'; data: any } | null,
  ) => void;

  atsRouteLabels: any | null;
  setAtsRouteLabels: (data: any) => void;

  boundsToFit: [number, number, number, number] | null;
  fitBounds: (bounds: [number, number, number, number] | null) => void;

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
  setViewMode: (mode) => set({ viewMode: mode }),

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
  setActiveAirport: (code) => set({ activeAirport: code }),

  selectedFeature: null,
  setSelectedFeature: (feature) => set({ selectedFeature: feature }),

  atsRouteLabels: null,
  setAtsRouteLabels: (data) => {
    set({ atsRouteLabels: data });
  },

  boundsToFit: null,
  fitBounds: (bounds) => {
    set({ boundsToFit: bounds });
  },

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
