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
  wacMap: boolean;
  airspaces: boolean;
  airspaceFIR: boolean;
  airspaceRegulated: boolean;
  airspaceControl: boolean;
  airspaceUpr: boolean;
}

export interface SelectedFeature {
  type: 'ATS_ROUTE' | 'WAYPOINT' | 'NAVAID' | 'AIRSPACE_STACK';
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

  /** Current camera state — used for zoom-dependent rendering */
  viewState: { zoom: number; [key: string]: any };

  /** GeoJSON FeatureCollection of ATS route label midpoints */
  atsRouteLabels: any | null;

  /** Pre-built trip animation data for the TripsLayer */
  animatedTrips: any[];

  /** Current animation timestamp (NM from origin) */
  currentTime: number;

  /** The ID of the specific overlapping airspace the user currently expanded in the UI stack */
  highlightedAirspaceId?: string | null;

  // ── Callbacks ──

  setSelectedRouteIds: (ids: string[], type?: string | null) => void;
  setSelectedFeature: (feature: SelectedFeature | null) => void;
}
