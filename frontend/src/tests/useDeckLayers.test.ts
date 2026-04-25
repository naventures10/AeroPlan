import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDeckLayers } from '../features/map/layers/useDeckLayers';
import { useMapStore } from '../store/useMapStore';
import * as aRoutes from '../features/map/layers/createAtsRouteLayers';
import * as aAirspaces from '../features/map/layers/createAirspaceLayers';
import * as aTerminal from '../features/terminal/layers/createRnpLayers';
import * as aRnpPath3d from '../features/terminal/layers/useRnpPath3d';
import * as aAero from '../features/map/layers/createAerodromeLayers';
import * as api from '../api/client';

vi.mock('../api/client', () => ({
  fetchRnpPath3d: vi.fn(),
}));

vi.mock('../features/map/layers/createAerodromeLayers', () => ({
  createAerodromeLayers: vi.fn(() => [{ id: 'aero1', type: 'overlaid' }])
}));

vi.mock('../features/map/layers/createWaypointLayer', () => ({
  createWaypointLayer: vi.fn(() => [{ id: 'wp', type: 'overlaid' }])
}));

vi.mock('../features/map/layers/createNavaidLayer', () => ({
  createNavaidLayer: vi.fn(() => [{ id: 'nav', type: 'overlaid' }])
}));

vi.mock('../features/map/layers/createAtsRouteLayers', () => ({
  createAtsRouteLayers: vi.fn(() => [{ id: 'ats1' }])
}));

vi.mock('../features/map/layers/createAirspaceLayers', () => ({
  createAirspaceLayers: vi.fn(() => [{ id: 'air1' }])
}));

vi.mock('../features/terminal/layers/createRnpLayers', () => ({
  createRnpLayers: vi.fn(() => [{ id: 'rnp1' }])
}));

vi.mock('../features/map/layers/useRouteAnimation', () => ({
  useRouteAnimation: () => ({ isAtsRendered: true, currentTime: 10 })
}));

vi.mock('../features/terminal/layers/useRnpPath3d', () => ({
  useRnpPath3d: vi.fn(() => ({ path: [1, 2], timestamps: [1, 2], waypoints: [] }))
}));

describe('useDeckLayers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMapStore.setState({
      activeLayers: {
        aerodromes: true,
        waypoints: true,
        navaids: true,
        atsRoutes: true,
        airspaces: true,
        airspaceFIR: true,
        airspaceRegulated: true,
        airspaceControl: true,
        airspaceUpr: true,
      } as any,
      activeAirport: 'VAAU',
      viewMode: 'TERMINAL',
      selectedRouteIds: [],
      selectedFeature: null,
      highlightedAirspaceId: null,
      atsRouteLabels: null,
      terminalPivot: null,
      animatedTrips: [],
      animatedLabels: [],
      selectedRnpProcedureId: 1, // ensure rnp layers are called
      selectedRnpChartKey: null,
      selectedRnpApproachId: null,
      setSelectedFeature: vi.fn(),
      setHighlightedAirspaceId: vi.fn(),
      setSelectedRnpApproachId: vi.fn()
    });
  });

  it('aggregates layers based on state', () => {
    (aRoutes.createAtsRouteLayers as any).mockReturnValue([{ id: 'ats1' }]);
    (aAirspaces.createAirspaceLayers as any).mockReturnValue([{ id: 'air1' }]);
    (aTerminal.createRnpLayers as any).mockReturnValue([{ id: 'rnp2' }]);

    const props = {
      aerodromes: {},
      onAerodromeClick: vi.fn(),
      hoveredRnpApproachId: null
    };

    const { result } = renderHook(() => useDeckLayers(props as any));

    const { overlaidLayers, interleavedLayers } = result.current;

    expect(overlaidLayers.map((l: any) => l?.id).filter(Boolean)).toEqual(
      expect.arrayContaining(['aero1', 'wp', 'nav', 'ats1', 'air1'])
    );

    expect(interleavedLayers.map((l: any) => l?.id).filter(Boolean)).toEqual(
      expect.arrayContaining(['rnp2'])
    );
  });
});
