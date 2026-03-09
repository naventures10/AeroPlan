import { create } from 'zustand';
import { FlyToInterpolator, LinearInterpolator } from '@deck.gl/core';

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
        waypoints: boolean;
        vors: boolean;
        ndbs: boolean;
    };

    activeAirport: string | null;
    setActiveAirport: (code: string | null) => void;

    // Actions (Functions to change the state)
    setViewState: (viewState: any) => void;
    toggleViewMode: () => void;
    setSearchQuery: (query: string) => void;
    toggleLayer: (layer: keyof MapState['activeLayers']) => void;
    flyToLocation: (lng: number, lat: number, zoom?: number, pitch?: number) => void;
    returnToEnroute: () => void;
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
    activeLayers: {
        waypoints: true,
        vors: true,
        ndbs: false,
    },

    // 3. NEW: Active Airport State
    activeAirport: null,
    setActiveAirport: (code) => set({ activeAirport: code }),

    // Basic Setters
    setViewState: (viewState) => set({ viewState }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    toggleLayer: (layer) =>
        set((state) => ({
            activeLayers: { ...state.activeLayers, [layer]: !state.activeLayers[layer] }
        })),

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
            viewState: {
                ...DEFAULT_VIEW,
                transitionDuration: 2500,
                transitionInterpolator: new FlyToInterpolator(),
            }
        });
    },

    // The "Search & Fly" Logic
    flyToLocation: (lng, lat, zoom = 14, pitch = 45) => {
        set({
            viewMode: pitch > 0 ? 'TERMINAL' : 'ENROUTE',
            viewState: {
                longitude: lng,
                latitude: lat,
                zoom: zoom,
                pitch: pitch,
                bearing: 0,
                maxPitch: 85,
                transitionDuration: 2500, // 2.5 seconds for a long-distance flight
                transitionInterpolator: new FlyToInterpolator(),
            }
        });
    }
}));