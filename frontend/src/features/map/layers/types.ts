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
  airspace_FIR: boolean;
  airspace_ADIZ: boolean;
  airspace_CTA_UPPER: boolean;
  airspace_UPR_ZONE: boolean;
  airspace_DANGER: boolean;
  airspace_PROHIBITED: boolean;
  airspace_RESTRICTED: boolean;
  airspace_CTA_LOWER: boolean;
  airspace_TRA: boolean;
  airspace_TSA: boolean;
  airspace_CTR: boolean;
  weather?: boolean;
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
  atsRoutesToggleCounter: number;

  /** Tracks if MVT tiles for airspace geometry have loaded in the current viewport */
  isAirspaceLoaded: boolean;
  setAirspaceLoaded: (loaded: boolean) => void;

  /** Dynamic mobile viewport status */
  isMobile?: boolean;
}
