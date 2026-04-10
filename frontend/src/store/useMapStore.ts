import { create } from 'zustand';
import { FlyToInterpolator, LinearInterpolator, WebMercatorViewport } from '@deck.gl/core';

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
        transitionInterpolator?: any;
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
    setSelectedFeature: (feature: { type: 'ATS_ROUTE' | 'WAYPOINT' | 'NAVAID'; data: any } | null) => void;

    atsRouteLabels: any | null;
    setAtsRouteLabels: (data: any) => void;

    // Actions (Functions to change the state)
    setViewState: (viewState: any) => void;
    toggleViewMode: () => void;
    setSearchQuery: (query: string) => void;
    toggleLayer: (layer: keyof MapState['activeLayers']) => void;
    flyToLocation: (lng: number, lat: number, zoom?: number, pitch?: number, forceViewMode?: 'ENROUTE' | 'TERMINAL') => void;
    fitBounds: (bounds: [number, number, number, number]) => void;
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
    setViewMode: (mode) => { set({ viewMode: mode }); },

    activeAerodromeMetadata: null,
    setActiveAerodromeMetadata: (data) => { set({ activeAerodromeMetadata: data }); },

    searchQuery: '',
    activeLayers: {
        aerodromes: true,
        waypoints: false,
        navaids: false,
        atsRoutes: false,
        wacMap: false,
    },

    // 3. NEW: Active Airport State
    activeAirport: null,
    setActiveAirport: (code) => { set({ activeAirport: code }); },

    selectedRouteIds: [],
    selectedRouteType: null,
    setSelectedRouteIds: (routeIds, routeType = null) => { set({ selectedRouteIds: routeIds, selectedRouteType: routeType }); },

    selectedFeature: null,
    setSelectedFeature: (feature) => { set({ selectedFeature: feature }); },

    atsRouteLabels: null,
    setAtsRouteLabels: (data) => { set({ atsRouteLabels: data }); },

    terminalPivot: null,
    setTerminalPivot: (coords) => { set({ terminalPivot: coords }); },

    // Basic Setters
    setViewState: (viewState) => { set({ viewState }); },
    setSearchQuery: (query) => { set({ searchQuery: query }); },
    toggleLayer: (layer) =>
        { set((state) => ({
            activeLayers: { ...state.activeLayers, [layer]: !state.activeLayers[layer] }
        })); },

    // The Enroute <-> Terminal Toggle Logic
    toggleViewMode: () => {
        const { viewMode, viewState } = get();
        const newMode = viewMode === 'ENROUTE' ? 'TERMINAL' : 'ENROUTE';

        set({
            viewMode: newMode,
            viewState: {
                ...viewState,
                pitch: newMode === 'TERMINAL' ? 45 : 0, // Tilt to 45 if Terminal, 0 if Enroute
                transitionDuration: 1000,
                transitionInterpolator: new LinearInterpolator(['pitch']),
            }
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
                transitionInterpolator: new FlyToInterpolator(),
            }
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
                transitionDuration: 1200, // Cinematic 1.2s rapid movement
                transitionInterpolator: new FlyToInterpolator({ speed: 1.5 }),
            }
        });
    },

    fitBounds: (bounds) => {
        // bounds array [minX, minY, maxX, maxY]
        const { viewState } = get();
        try {
            // Using typical viewport dimensions, 100px padding to keep the airway fully visible
            const vp = new WebMercatorViewport({ width: window.innerWidth || 1024, height: window.innerHeight || 768 });
            const { longitude, latitude, zoom } = vp.fitBounds(
                [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
                { padding: 150 }
            );

            set({
                viewMode: 'ENROUTE', // Always lock to 2D Enroute map mode to see airway
                viewState: {
                    ...viewState,
                    longitude,
                    latitude,
                    zoom,
                    pitch: 0, // Request from user to reset tilt
                    bearing: 0,
                    transitionDuration: 1200,
                    transitionInterpolator: new FlyToInterpolator({ speed: 1.5 }),
                }
            });
        } catch (e) {
            console.error("Failed to calculate fitBounds", e);
        }
    }
}));