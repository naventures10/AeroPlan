import { create } from 'zustand';
import { formatIST, calculateNowIndex } from '../features/map/utils/windUtils';
import type { ForecastTimestamp } from '../features/map/utils/windUtils';

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
  mapStyle: 'dark' | 'light' | 'hybrid';
  setMapStyle: (style: 'dark' | 'light' | 'hybrid') => void;

  // Metadata for the active aerodrome
  activeAerodromeMetadata: any | null;
  setActiveAerodromeMetadata: (data: any) => void;

  searchQuery: string;
  activeLayers: {
    aerodromes: boolean;
    waypoints: boolean;
    navaids: boolean;
    atsRoutes: boolean;
    airspaces: boolean;
    airspaceFIR: boolean;
    airspaceRegulated: boolean;
    airspaceControl: boolean;
    airspaceUpr: boolean;
    ercMap: boolean;
    weather: boolean;
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

  forecastTimestamps: ForecastTimestamp[];
  weatherStatus: { state: 'idle' | 'loading' | 'ready' | 'error'; message?: string };
  fetchWeatherManifest: () => Promise<void>;

  isWeatherMode: boolean;
  setIsWeatherMode: (enabled: boolean) => void;

  isWindMode: boolean;
  setIsWindMode: (enabled: boolean) => void;

  isCloudMode: boolean;
  setIsCloudMode: (enabled: boolean) => void;

  cloudLoadingStatus: { state: string; message?: string };
  setCloudLoadingStatus: (status: { state: string; message?: string }) => void;

  // Terminal Spatial Filters
  terminalSpatialFilters: {
    buildings: boolean;
    infrastructure: boolean;
    natural: boolean;
    other: boolean;
    navaids: boolean;
  };
  toggleTerminalSpatialFilter: (category: keyof MapState['terminalSpatialFilters']) => void;
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
              // Automatically disable weather layer when entering Terminal mode
              isWeatherMode: false,
              activeLayers: { ...state.activeLayers, weather: false },
            }),
      };
    }),

  activeAerodromeMetadata: null,
  setActiveAerodromeMetadata: (data) => set({ activeAerodromeMetadata: data }),

  mapStyle: 'dark',
  setMapStyle: (style) => set({ mapStyle: style }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  activeLayers: {
    aerodromes: true,
    waypoints: false,
    navaids: false,
    atsRoutes: false,
    airspaces: false,
    airspaceFIR: false,
    airspaceRegulated: false,
    airspaceControl: false,
    airspaceUpr: false,
    ercMap: false,
    weather: false,
  },

  toggleLayer: (layer) =>
    set((state) => {
      const newActiveLayers = { ...state.activeLayers };

      // Prevent enabling weather if in TERMINAL mode or if map is tilted
      if (
        layer === 'weather' &&
        !newActiveLayers[layer] &&
        (state.viewMode === 'TERMINAL' || state.viewState.pitch > 0)
      ) {
        return state;
      }

      newActiveLayers[layer] = !newActiveLayers[layer];

      if (layer === 'weather') {
        const isWeatherNowOn = newActiveLayers.weather;
        // Turn on wind mode by default when weather is activated, if neither was on
        const nextWind = isWeatherNowOn
          ? !state.isWindMode && !state.isCloudMode
            ? true
            : state.isWindMode
          : state.isWindMode;

        return {
          activeLayers: newActiveLayers,
          isWeatherMode: isWeatherNowOn,
          isWindMode: nextWind,
        };
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
            isWeatherMode: false,
            activeLayers: { ...state.activeLayers, weather: false },
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
            viewMode: 'TERMINAL',
            isWeatherMode: false,
            activeLayers: { ...state.activeLayers, weather: false },
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

  forecastTimestamps: [],
  weatherStatus: { state: 'idle' },

  fetchWeatherManifest: async () => {
    const { forecastTimestamps, weatherStatus } = get();
    // Only fetch if not already loaded or in error state to prevent duplicate parallel fetches
    if (forecastTimestamps.length > 0 && weatherStatus.state === 'ready') return;
    if (weatherStatus.state === 'loading') return;

    set({ weatherStatus: { state: 'loading', message: 'Loading weather timeline…' } });

    try {
      const response = await fetch('/weather/weather_manifest.json');
      const manifestData = await response.json();
      if (manifestData && manifestData.forecasts) {
        const timestamps = manifestData.forecasts.map((f: any) => {
          const { label, date } = formatIST(f.valid_time);
          return {
            label,
            date,
            validTime: f.valid_time,
            files: f.files,
          };
        });

        set({
          forecastTimestamps: timestamps,
          weatherStatus: { state: 'ready' },
        });

        // Default windAnimationTime to 'Now' if not already set
        const currentAnimTime = get().windAnimationTime;
        if (currentAnimTime === 0) {
          const nowIdx = calculateNowIndex(timestamps);
          set({ windAnimationTime: nowIdx });
        }
      } else {
        throw new Error('Invalid manifest format');
      }
    } catch (err) {
      console.error('Failed to load weather manifest in store', err);
      set({
        weatherStatus: { state: 'error', message: 'Failed to load weather manifest' },
      });
    }
  },

  isWeatherMode: false,
  setIsWeatherMode: (enabled) =>
    set((state) => {
      if (enabled && (state.viewMode === 'TERMINAL' || state.viewState.pitch > 0)) {
        return state;
      }
      return {
        isWeatherMode: enabled,
        activeLayers: { ...state.activeLayers, weather: enabled },
        isWindMode: enabled
          ? !state.isWindMode && !state.isCloudMode
            ? true
            : state.isWindMode
          : state.isWindMode,
      };
    }),

  isWindMode: false,
  setIsWindMode: (enabled) => set({ isWindMode: enabled }),

  isCloudMode: false,
  setIsCloudMode: (enabled) => set({ isCloudMode: enabled }),

  cloudLoadingStatus: { state: 'idle' },
  setCloudLoadingStatus: (status) => set({ cloudLoadingStatus: status }),

  terminalSpatialFilters: {
    buildings: true,
    infrastructure: true,
    natural: true,
    other: true,
    navaids: true,
  },
  toggleTerminalSpatialFilter: (category) =>
    set((state) => ({
      terminalSpatialFilters: {
        ...state.terminalSpatialFilters,
        [category]: !state.terminalSpatialFilters[category],
      },
    })),

  // Basic Setters
  setViewState: (viewState) =>
    set((state) => {
      const nextPitch = viewState.pitch ?? state.viewState.pitch;
      const shouldDisableWeather = nextPitch > 0 && state.isWeatherMode;
      return {
        viewState,
        ...(shouldDisableWeather
          ? {
              isWeatherMode: false,
              activeLayers: {
                ...state.activeLayers,
                weather: false,
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
            // Automatically disable weather layer when entering Terminal mode
            isWeatherMode: false,
            activeLayers: { ...activeLayers, weather: false },
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
            isWeatherMode: false,
            activeLayers: { ...state.activeLayers, weather: false },
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
