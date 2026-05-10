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
    ercMap: boolean;
    windlayer: boolean;
    cloudlayer: boolean;
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

  selectedRnpApproachId: string | null;
  setSelectedRnpApproachId: (id: string | null) => void;

  selectedFeature: {
    type: 'ATS_ROUTE' | 'WAYPOINT' | 'NAVAID' | 'AIRSPACE';
    data: any;
  } | null;
  setSelectedFeature: (
    feature: { type: 'ATS_ROUTE' | 'WAYPOINT' | 'NAVAID' | 'AIRSPACE'; data: any } | null,
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

  // Wind Layer Parameters
  windAltitude: number;
  setWindAltitude: (alt: number | ((prev: number) => number)) => void;
  windAnimationTime: number;
  setWindAnimationTime: (time: number | ((prev: number) => number)) => void;
  windIsPlaying: boolean;
  setWindIsPlaying: (playing: boolean | ((prev: boolean) => boolean)) => void;
  toggleWindPlayback: (maxTime: number) => void;

  isWindMode: boolean;
  setIsWindMode: (enabled: boolean) => void;

  isCloudMode: boolean;
  setIsCloudMode: (enabled: boolean) => void;

  cloudLoadingStatus: { state: string; message?: string };
  setCloudLoadingStatus: (status: { state: string; message?: string }) => void;
}

export const DEFAULT_VIEW = {
  longitude: 78.9629,
  latitude: 20.5937,
  zoom: 4.5,
  pitch: 0,
  bearing: 0,
  maxPitch: 60,
};

/**
 * Zoom level below which the map automatically exits TERMINAL mode
 * and flattens to ENROUTE view. Lowering this makes the terminal view
 * "relaxed" for viewing large procedures.
 */
export const TERMINAL_EXIT_ZOOM_THRESHOLD = 5.5;

// 2. Initialize the Store
export const useMapStore = create<MapState>((set, get) => ({
  // Default starting view (High-level India)
  viewState: DEFAULT_VIEW,

  terminalPivot: null,

  viewMode: 'ENROUTE',
  setViewMode: (mode) =>
    set((state) => {
      return {
        viewMode: mode,
        ...(mode === 'ENROUTE'
          ? {
              selectedRnpProcedureId: null,
              selectedRnpChartKey: null,
              selectedRnpBounds: null,
              selectedRnpApproachId: null,
            }
          : {
              // Automatically disable wind/cloud layer when entering Terminal mode
              isWindMode: false,
              isCloudMode: false,
              activeLayers: { ...state.activeLayers, windlayer: false, cloudlayer: false },
            }),
      };
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
    airspaceFIR: false,
    airspaceRegulated: false,
    airspaceControl: false,
    airspaceUpr: false,
    ercMap: false,
    windlayer: false,
    cloudlayer: false,
  },

  toggleLayer: (layer) =>
    set((state) => {
      const newActiveLayers = { ...state.activeLayers };

      // Prevent enabling windlayer/cloudlayer if in TERMINAL mode or if map is tilted
      if (
        (layer === 'windlayer' || layer === 'cloudlayer') &&
        !newActiveLayers[layer] &&
        (state.viewMode === 'TERMINAL' || state.viewState.pitch > 0)
      ) {
        return state;
      }

      newActiveLayers[layer] = !newActiveLayers[layer];

      if (layer === 'windlayer') {
        return { activeLayers: newActiveLayers, isWindMode: newActiveLayers.windlayer };
      }
      if (layer === 'cloudlayer') {
        return { activeLayers: newActiveLayers, isCloudMode: newActiveLayers.cloudlayer };
      }

      if (layer === 'wacMap' && newActiveLayers.wacMap) {
        newActiveLayers.ercMap = false;
      }
      if (layer === 'ercMap' && newActiveLayers.ercMap) {
        newActiveLayers.wacMap = false;
      }
      if (layer === 'airspaces' && newActiveLayers.airspaces) {
        newActiveLayers.airspaceFIR = true;
        newActiveLayers.airspaceRegulated = true;
        newActiveLayers.airspaceControl = true;
        newActiveLayers.airspaceUpr = true;
      }

      return { activeLayers: newActiveLayers };
    }),

  selectedRouteIds: [],
  selectedRouteType: null,
  setSelectedRouteIds: (routeIds, routeType = null) =>
    set({
      selectedRouteIds: routeIds,
      selectedRouteType: routeType,
    }),

  activeAirport: null,
  setActiveAirport: (code) =>
    set((state) => ({
      activeAirport: code,
      selectedRnpProcedureId: null,
      selectedRnpChartKey: null,
      selectedRnpBounds: null,
      selectedRnpApproachId: null,
      // Selecting an airport implies moving towards Terminal view/details
      ...(code
        ? {
            viewMode: 'TERMINAL',
            isWindMode: false,
            isCloudMode: false,
            activeLayers: { ...state.activeLayers, windlayer: false, cloudlayer: false },
          }
        : {}),
    })),

  selectedRnpProcedureId: null,
  selectedRnpChartKey: null,
  selectedRnpBounds: null,
  selectedRnpApproachId: null,
  setSelectedRnpApproachId: (id) => set({ selectedRnpApproachId: id }),

  setSelectedRnpProcedure: (payload) =>
    set((state) =>
      payload
        ? {
            selectedRnpProcedureId: payload.procedureId,
            selectedRnpChartKey: payload.chartKey,
            selectedRnpBounds: payload.bounds,
            selectedRnpApproachId: null, // Reset approach ID on new procedure
            // RNP procedures are Terminal-only
            viewMode: 'TERMINAL',
            isWindMode: false,
            isCloudMode: false,
            activeLayers: { ...state.activeLayers, windlayer: false, cloudlayer: false },
          }
        : {
            selectedRnpProcedureId: null,
            selectedRnpChartKey: null,
            selectedRnpBounds: null,
            selectedRnpApproachId: null,
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

  setTerminalPivot: (coords) => {
    set({ terminalPivot: coords });
  },

  // Wind Layer Actions
  windAltitude: 0,
  setWindAltitude: (alt) =>
    set((state) => ({ windAltitude: typeof alt === 'function' ? alt(state.windAltitude) : alt })),
  windAnimationTime: 0,
  setWindAnimationTime: (time) =>
    set((state) => ({
      windAnimationTime: typeof time === 'function' ? time(state.windAnimationTime) : time,
    })),
  windIsPlaying: false,
  setWindIsPlaying: (playing) =>
    set((state) => ({
      windIsPlaying: typeof playing === 'function' ? playing(state.windIsPlaying) : playing,
    })),

  toggleWindPlayback: (maxTime) =>
    set((state) => {
      const isAtEnd = state.windAnimationTime >= maxTime;
      return {
        windAnimationTime: isAtEnd ? 0 : state.windAnimationTime,
        windIsPlaying: !state.windIsPlaying,
      };
    }),

  isWindMode: false,
  setIsWindMode: (enabled) =>
    set((state) => {
      // Prevent enabling if in TERMINAL mode or if map is tilted
      if (enabled && (state.viewMode === 'TERMINAL' || state.viewState.pitch > 0)) {
        return state;
      }
      return {
        isWindMode: enabled,
        activeLayers: { ...state.activeLayers, windlayer: enabled },
      };
    }),

  isCloudMode: false,
  setIsCloudMode: (enabled) =>
    set((state) => {
      // Prevent enabling if in TERMINAL mode or if map is tilted
      if (enabled && (state.viewMode === 'TERMINAL' || state.viewState.pitch > 0)) {
        return state;
      }
      return {
        isCloudMode: enabled,
        activeLayers: { ...state.activeLayers, cloudlayer: enabled },
      };
    }),

  cloudLoadingStatus: { state: 'idle' },
  setCloudLoadingStatus: (status) => set({ cloudLoadingStatus: status }),

  // Basic Setters
  setViewState: (viewState) =>
    set((state) => {
      const nextPitch = viewState.pitch ?? state.viewState.pitch;
      const shouldDisableWind = nextPitch > 0 && state.isWindMode;
      const shouldDisableCloud = nextPitch > 0 && state.isCloudMode;
      return {
        viewState,
        ...(shouldDisableWind || shouldDisableCloud
          ? {
              isWindMode: shouldDisableWind ? false : state.isWindMode,
              isCloudMode: shouldDisableCloud ? false : state.isCloudMode,
              activeLayers: {
                ...state.activeLayers,
                ...(shouldDisableWind ? { windlayer: false } : {}),
                ...(shouldDisableCloud ? { cloudlayer: false } : {}),
              },
            }
          : {}),
      };
    }),

  toggleViewMode: () => {
    const { viewMode, viewState, activeLayers } = get();
    const newMode = viewMode === 'ENROUTE' ? 'TERMINAL' : 'ENROUTE';
    set({
      viewMode: newMode,
      ...(newMode === 'ENROUTE'
        ? {
            selectedRnpProcedureId: null,
            selectedRnpChartKey: null,
            selectedRnpBounds: null,
            selectedRnpApproachId: null,
          }
        : {
            // Automatically disable wind layer when entering Terminal mode
            isWindMode: false,
            isCloudMode: false,
            activeLayers: { ...activeLayers, windlayer: false, cloudlayer: false },
          }),
      viewState: {
        ...viewState,
        pitch: newMode === 'TERMINAL' ? 45 : 0,
        transitionDuration: 1000,
        transitionType: 'LINEAR',
      },
    });
  },

  returnToEnroute: () => {
    const { viewState } = get();
    set({
      viewMode: 'ENROUTE',
      activeAirport: null,
      selectedRnpProcedureId: null,
      selectedRnpChartKey: null,
      selectedRnpBounds: null,
      selectedRnpApproachId: null,
      selectedFeature: null,
      terminalPivot: null,
      viewState: {
        ...viewState,
        pitch: 0,
        bearing: 0,
        transitionDuration: 1500,
        transitionType: 'FLY',
      },
    });
  },

  // The "Search & Fly" Logic
  flyToLocation: (lng, lat, zoom = 14, pitch = 0, forceViewMode) => {
    const targetMode = forceViewMode || (pitch > 0 ? 'TERMINAL' : 'ENROUTE');
    set((state) => ({
      viewMode: targetMode,
      ...(targetMode === 'TERMINAL'
        ? {
            isWindMode: false,
            isCloudMode: false,
            activeLayers: { ...state.activeLayers, windlayer: false, cloudlayer: false },
          }
        : {}),
      viewState: {
        longitude: lng,
        latitude: lat,
        zoom: zoom,
        pitch: pitch,
        bearing: 0,
        maxPitch: 60,
        transitionDuration: 1200,
        transitionType: 'FLY',
      },
    }));
  },
}));
