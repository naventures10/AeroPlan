import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDeckLayers } from '../../features/map/layers/useDeckLayers';
import { useMapStore } from '../../store/useMapStore';
import * as aRoutes from '../../features/map/layers/createAtsRouteLayers';
import * as aAirspaces from '../../features/map/layers/createAirspaceLayers';
import * as aTerminal from '../../features/terminal/layers/rnp/createRnpLayers';

vi.mock('../../api/client', () => ({
  fetchRnpPath3d: vi.fn(),
}));

vi.mock('../../features/map/layers/createAerodromeLayers', () => ({
  createAerodromeLayers: vi.fn(() => [{ id: 'aero1', type: 'overlaid' }]),
}));

vi.mock('../../features/map/layers/createWaypointLayer', () => ({
  createWaypointLayer: vi.fn(() => [{ id: 'wp', type: 'overlaid' }]),
}));

vi.mock('../../features/map/layers/createNavaidLayer', () => ({
  createNavaidLayer: vi.fn(() => [{ id: 'nav', type: 'overlaid' }]),
}));

vi.mock('../../features/map/layers/createAtsRouteLayers', () => ({
  createAtsRouteLayers: vi.fn(() => [{ id: 'ats1' }]),
}));

vi.mock('../../features/map/layers/createAirspaceLayers', () => ({
  createAirspaceLayers: vi.fn(() => [{ id: 'air1' }]),
}));

vi.mock('../../features/terminal/layers/rnp/createRnpLayers', () => ({
  createStaticRnpLayers: vi.fn(() => [{ id: 'rnp1' }]),
  createDynamicRnpLayers: vi.fn(() => []),
  createRnpLayers: vi.fn(() => [{ id: 'rnp1' }]),
}));

vi.mock('../../features/map/layers/useRouteAnimation', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useState, useEffect } = require('react');
  return {
    useRouteAnimation: () => {
      const active = useMapStore((state: any) => state.activeLayers.atsRoutes);
      const selected = useMapStore((state: any) => state.selectedRouteIds.length > 0);
      const [isAtsRendered, setIsAtsRendered] = useState(active || selected);

      useEffect(() => {
        if (active || selected) {
          setIsAtsRendered(true);
        } else {
          const timer = setTimeout(() => {
            setIsAtsRendered(false);
          }, 300);
          return () => clearTimeout(timer);
        }
      }, [active, selected]);

      return { isAtsRendered, currentTime: 10 };
    },
  };
});

vi.mock('../../features/terminal/layers/rnp/useRnpPath3d', () => ({
  useRnpPath3d: vi.fn(() => ({ path: [1, 2], timestamps: [1, 2], waypoints: [] })),
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
      atsRouteLabels: null,
      terminalPivot: null,
      animatedTrips: [],
      animatedLabels: [],
      selectedRnpProcedureId: 1, // ensure rnp layers are called
      selectedRnpChartKey: null,
      selectedRnpApproachId: null,
      setSelectedFeature: vi.fn(),
      setSelectedRnpApproachId: vi.fn(),
    });
  });

  it('aggregates layers based on state', () => {
    (aRoutes.createAtsRouteLayers as any).mockReturnValue([{ id: 'ats1' }]);
    (aAirspaces.createAirspaceLayers as any).mockReturnValue([{ id: 'air1' }]);
    (aTerminal.createStaticRnpLayers as any).mockReturnValue([{ id: 'rnp2' }]);

    const props = {
      aerodromes: {},
      onAerodromeClick: vi.fn(),
      hoveredRnpApproachId: null,
    };

    const { result } = renderHook(() => useDeckLayers(props as any));

    const { overlaidLayers, interleavedLayers } = result.current;

    expect(overlaidLayers.map((l: any) => l?.id).filter(Boolean)).toEqual(
      expect.arrayContaining(['aero1', 'wp', 'nav', 'ats1', 'air1']),
    );

    expect(interleavedLayers.map((l: any) => l?.id).filter(Boolean)).toEqual(
      expect.arrayContaining(['rnp2']),
    );
  });

  it('delays unmounting of atsRoutes by 300ms when toggled off, while keeping other layers mounted', () => {
    vi.useFakeTimers();
    (aRoutes.createAtsRouteLayers as any).mockReturnValue([{ id: 'ats1' }]);
    (aAirspaces.createAirspaceLayers as any).mockReturnValue([{ id: 'air1' }]);

    const props = {
      aerodromes: {},
      onAerodromeClick: vi.fn(),
      hoveredRnpApproachId: null,
    };

    const { result, rerender } = renderHook(() => useDeckLayers(props as any));

    // Initially all layers should be present
    expect(result.current.overlaidLayers.map((l: any) => l?.id)).toContain('ats1');
    expect(result.current.overlaidLayers.map((l: any) => l?.id)).toContain('aero1');
    expect(result.current.overlaidLayers.map((l: any) => l?.id)).toContain('wp');
    expect(result.current.overlaidLayers.map((l: any) => l?.id)).toContain('nav');
    expect(result.current.overlaidLayers.map((l: any) => l?.id)).toContain('air1');

    // Toggle off all layers
    useMapStore.setState((state: any) => ({
      activeLayers: {
        ...state.activeLayers,
        atsRoutes: false,
        aerodromes: false,
        waypoints: false,
        navaids: false,
        airspaces: false,
      },
    }));
    rerender();

    // Immediately after toggle, they should all still be mounted
    expect(result.current.overlaidLayers.map((l: any) => l?.id)).toContain('ats1');
    expect(result.current.overlaidLayers.map((l: any) => l?.id)).toContain('aero1');

    // Advance time by 299ms
    vi.advanceTimersByTime(299);
    rerender();
    expect(result.current.overlaidLayers.map((l: any) => l?.id)).toContain('ats1');
    expect(result.current.overlaidLayers.map((l: any) => l?.id)).toContain('aero1');

    // Advance time to 300ms
    vi.advanceTimersByTime(1);
    rerender();

    // Now ats1 should be completely unmounted, but others remain mounted
    expect(result.current.overlaidLayers.map((l: any) => l?.id)).not.toContain('ats1');
    expect(result.current.overlaidLayers.map((l: any) => l?.id)).toContain('aero1');
    expect(result.current.overlaidLayers.map((l: any) => l?.id)).toContain('wp');
    expect(result.current.overlaidLayers.map((l: any) => l?.id)).toContain('nav');
    expect(result.current.overlaidLayers.map((l: any) => l?.id)).toContain('air1');

    vi.useRealTimers();
  });
});
