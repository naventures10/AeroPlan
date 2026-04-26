import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { FeatureInfoCard } from '../../features/map/FeatureInfoCard';
import { useMapStore } from '../../store/useMapStore';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => children,
    motion: {
      div: ({ children, className }: any) => <div className={className}>{children}</div>,
    },
  };
});

describe('FeatureInfoCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when selectedFeature is null', () => {
    useMapStore.setState({ selectedFeature: null });
    let container: any;
    act(() => {
      const rendered = render(<FeatureInfoCard />);
      container = rendered.container;
    });
    // In jsdom, empty fragment gives firstChild null or empty
    expect(container.innerHTML).toBe('');
  });

  it('renders WAYPOINT data correctly', () => {
    useMapStore.setState({
      viewMode: 'ENROUTE',
      selectedFeature: {
        type: 'WAYPOINT',
        data: { name: 'FIX', waypoint_name: 'FIX', latitude: 10, longitude: 20 },
      } as any,
    });

    act(() => {
      render(<FeatureInfoCard />);
    });
    expect(screen.getAllByText(/WAYPOINT/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('FIX').length).toBeGreaterThan(0);
  });

  it('renders ATS_ROUTE data correctly', () => {
    useMapStore.setState({
      viewMode: 'ENROUTE',
      selectedFeature: {
        type: 'ATS_ROUTE',
        data: { route_id: 'L333' },
      } as any,
    });
    act(() => {
      render(<FeatureInfoCard />);
    });
    expect(screen.getAllByText(/ATS ROUTE/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('L333').length).toBeGreaterThan(0);
  });

  it('renders NAVAID data correctly', () => {
    useMapStore.setState({
      viewMode: 'ENROUTE',
      selectedFeature: {
        type: 'NAVAID',
        data: { station_name: 'TEST NAVAID' },
      } as any,
    });
    act(() => {
      render(<FeatureInfoCard />);
    });
    expect(screen.getAllByText(/NAVAID/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('TEST NAVAID').length).toBeGreaterThan(0);
  });

  it('renders AIRSPACE data correctly and handles close', () => {
    const setSelectedFeatureMock = vi.fn();
    const setHighlightedAirspaceIdMock = vi.fn();

    useMapStore.setState({
      viewMode: 'ENROUTE',
      setSelectedFeature: setSelectedFeatureMock,
      setHighlightedAirspaceId: setHighlightedAirspaceIdMock,
      selectedFeature: {
        type: 'AIRSPACE',
        data: { properties: { name: 'TEST AIRSPACE' } },
      } as any,
    });
    act(() => {
      render(<FeatureInfoCard />);
    });

    expect(screen.getAllByText(/AIRSPACE/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('TEST AIRSPACE').length).toBeGreaterThan(0);

    const closeBtn = screen.getByRole('button');
    act(() => {
      fireEvent.click(closeBtn);
    });

    expect(setSelectedFeatureMock).toHaveBeenCalledWith(null);
    expect(setHighlightedAirspaceIdMock).toHaveBeenCalledWith(null);
  });
});
