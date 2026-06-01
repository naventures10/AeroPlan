/**
 * Shared types for DeckGL layer factories.
 *
 * Every `create*Layer(ctx)` function receives a `LayerContext` so it can
 * read map state without importing the Zustand store directly.
 */

export interface ActiveLayers {
  aerodromes: boolean;
  waypoints: boolean;
  navaids: boolean;
  atsRoutes: boolean;
  airspaces: boolean;
  airspaceFIR: boolean;
  airspaceRegulated: boolean;
  airspaceControl: boolean;
  airspaceUpr: boolean;
}

export interface SelectedFeature {
  type: 'ATS_ROUTE' | 'WAYPOINT' | 'NAVAID' | 'AIRSPACE';
  data: any;
}

export interface LayerContext {
  /** Current map view mode */
  viewMode: 'ENROUTE' | 'TERMINAL';

  /** Which overlay layers are toggled on */
  activeLayers: ActiveLayers;

  /** Currently highlighted ATS route IDs */
  selectedRouteIds: string[];

  /** How the route was selected — affects color theming */
  selectedRouteType: string | null;

  /** Currently selected map feature (waypoint / navaid / route) */
  selectedFeature: SelectedFeature | null;

  /** Current camera zoom — used for zoom-dependent rendering */
  zoom: number;

  /** Whether the UI is in dark mode (mapStyle !== 'light') */
  isDarkMode: boolean;

  /** GeoJSON FeatureCollection of ATS route label midpoints */
  atsRouteLabels: any | null;

  /** Pre-built trip animation data for the TripsLayer */
  animatedTrips: any[];

  /** Current animation timestamp (NM from origin) */
  currentTime: number;

  // ── Callbacks ──

  setSelectedRouteIds: (ids: string[], type?: string | null) => void;
  setSelectedFeature: (feature: SelectedFeature | null) => void;

  /** Tracks if MVT tiles for route lines have loaded */
  isAtsGeometryLoaded: boolean;
  setAtsGeometryLoaded: (loaded: boolean) => void;
}
