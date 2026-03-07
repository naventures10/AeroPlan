import { create } from 'zustand';
import { FlyToInterpolator } from '@deck.gl/core';

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
    is3DMode: boolean;
    searchQuery: string;
    activeLayers: {
        waypoints: boolean;
        vors: boolean;
        ndbs: boolean;
    };

    activeAirport: string | null;
    setActiveAirport: (code: string | null) => void;
    setIs3DMode: (is3D: boolean) => void;

    // Actions (Functions to change the state)
    setViewState: (viewState: any) => void;
    toggle3DMode: () => void;
    setSearchQuery: (query: string) => void;
    toggleLayer: (layer: keyof MapState['activeLayers']) => void;
    flyToLocation: (lng: number, lat: number, zoom?: number, pitch?: number) => void;
}

// 2. Initialize the Store
export const useMapStore = create<MapState>((set, get) => ({
    // Default starting view (High-level India)
    viewState: {
        longitude: 78.9629,
        latitude: 20.5937,
        zoom: 4.5,
        pitch: 0,
        bearing: 0,
        maxPitch: 85,
    },

    is3DMode: false,
    searchQuery: '',
    activeLayers: {
        waypoints: true,
        vors: true,
        ndbs: false,
    },

    // 3. NEW: Active Airport State
    activeAirport: null,
    setActiveAirport: (code) => set({ activeAirport: code }),

    setIs3DMode: (is3D) => set({ is3DMode: is3D }),

    // Basic Setters
    setViewState: (viewState) => set({ viewState }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    toggleLayer: (layer) =>
        set((state) => ({
            activeLayers: { ...state.activeLayers, [layer]: !state.activeLayers[layer] }
        })),

    // The 2D <-> 3D Toggle Logic
    toggle3DMode: () => {
        const { is3DMode, viewState } = get();
        const newMode = !is3DMode;

        set({
            is3DMode: newMode,
            viewState: {
                ...viewState,
                pitch: newMode ? 45 : 0, // Tilt to 45 degrees if 3D, back to 0 if 2D
                transitionDuration: 1000, // 1 second smooth animation
                transitionInterpolator: new FlyToInterpolator(),
            }
        });
    },

    // The "Search & Fly" Logic
    flyToLocation: (lng, lat, zoom = 14, pitch = 45) => {
        set({
            is3DMode: pitch > 0, // Automatically enter 3D mode if pitch is requested
            viewState: {
                longitude: lng,
                latitude: lat,
                zoom: zoom,
                pitch: pitch,
                bearing: 0, // You could calculate runway alignment here later!
                maxPitch: 85,
                transitionDuration: 2500, // 2.5 seconds for a long-distance flight
                transitionInterpolator: new FlyToInterpolator(),
            }
        });
    }
}));