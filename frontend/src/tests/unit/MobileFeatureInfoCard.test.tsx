import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MobileFeatureInfoCard } from '../../features/map/components/mobile/MobileFeatureInfoCard';
import { useMapStore } from '../../store/useMapStore';

// Mock the store
vi.mock('../../store/useMapStore', () => {
  const stateRef = { current: {} as any };
  const mockStore = vi.fn((selector?: any) => {
    if (typeof selector === 'function') {
      return selector(stateRef.current);
    }
    return stateRef.current;
  });
  (mockStore as any).mockReturnValue = (val: any) => {
    stateRef.current = val;
    return mockStore;
  };
  return { useMapStore: mockStore };
});

// Mock useIsMobile hook
const mockUseIsMobile = vi.fn(() => true);
vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

describe('MobileFeatureInfoCard', () => {
  const setSelectedFeature = vi.fn();
  const setSelectedRouteIds = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(true);
    (useMapStore as any).mockReturnValue({
      selectedFeature: null,
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      navaidDetails: null,
      isLoadingNavaid: false,
      routeDetails: null,
      isLoadingRoute: false,
    });
  });

  it('should not render on desktop', () => {
    mockUseIsMobile.mockReturnValue(false);
    (useMapStore as any).mockReturnValue({
      selectedFeature: {
        type: 'WAYPOINT',
        data: { waypoint_name: 'DOSTI', raw_coordinates: '180000N 0720000E' },
      },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      navaidDetails: null,
      isLoadingNavaid: false,
      routeDetails: null,
      isLoadingRoute: false,
    });

    render(<MobileFeatureInfoCard />);
    expect(screen.queryByTestId('mobile-feature-info-card')).toBeNull();
  });

  it('should not render when no feature is selected', () => {
    render(<MobileFeatureInfoCard />);
    expect(screen.queryByTestId('mobile-feature-info-card')).toBeNull();
  });

  it('should render when selected feature is ATS_ROUTE', () => {
    (useMapStore as any).mockReturnValue({
      selectedFeature: { type: 'ATS_ROUTE', data: { route_id: 'L333' } },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      navaidDetails: null,
      isLoadingNavaid: false,
      routeDetails: {
        route_type: 'RNAV',
        total_distance_nm: 120,
        remarks: 'Sample remarks',
        waypoints: [
          { waypoint_name: 'WP1', raw_coordinates: '12N 34E' },
          { waypoint_name: 'WP2', raw_coordinates: '56N 78E' },
        ],
        segments: [
          {
            sequence_number: 1,
            from_waypoint: 'WP1',
            from_coordinates: '12N 34E',
            track_magnetic: '045',
            distance_nm: 120,
          },
        ],
      },
      isLoadingRoute: false,
    });

    render(<MobileFeatureInfoCard />);
    expect(screen.getByTestId('mobile-feature-info-card')).toBeDefined();
    expect(screen.getByText('L333')).toBeInTheDocument();
    expect(screen.getAllByText('120 NM').length).toBe(2);
    expect(screen.getByText('2 FIXES')).toBeInTheDocument();
  });

  it('should render Waypoint details on mobile', () => {
    (useMapStore as any).mockReturnValue({
      selectedFeature: {
        type: 'WAYPOINT',
        data: { waypoint_name: 'DOSTI', raw_coordinates: '180000N 0720000E' },
      },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      navaidDetails: null,
      isLoadingNavaid: false,
      routeDetails: null,
      isLoadingRoute: false,
    });

    render(<MobileFeatureInfoCard />);
    expect(screen.getByTestId('mobile-feature-info-card')).toBeDefined();
    expect(screen.getByText('DOSTI')).toBeDefined();
    expect(screen.getByText('180000N 0720000E')).toBeDefined();
  });

  it('should render Navaid details on mobile', async () => {
    const mockNavaidDetails = {
      ident: 'BBB',
      station_name: 'BOMBAY',
      aid_type: 'VOR/DME',
      frequency: '116.6',
    };

    (useMapStore as any).mockReturnValue({
      selectedFeature: { type: 'NAVAID', data: { ident: 'BBB', station_name: 'BOMBAY' } },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      navaidDetails: mockNavaidDetails,
      isLoadingNavaid: false,
      routeDetails: null,
      isLoadingRoute: false,
    });

    render(<MobileFeatureInfoCard />);
    expect(screen.getByTestId('mobile-feature-info-card')).toBeDefined();

    const title = await screen.findByText('BOMBAY');
    expect(title).toBeDefined();
  });

  it('should render Airspace details on mobile', () => {
    (useMapStore as any).mockReturnValue({
      selectedFeature: {
        type: 'AIRSPACE',
        data: {
          name: 'MUMBAI CTR',
          airspace_type: 'CTR',
          lower_limit: 'SFC',
          upper_limit: 'FL070',
        },
      },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      navaidDetails: null,
      isLoadingNavaid: false,
      routeDetails: null,
      isLoadingRoute: false,
    });

    render(<MobileFeatureInfoCard />);
    expect(screen.getByTestId('mobile-feature-info-card')).toBeDefined();
    const elements = screen.getAllByText('MUMBAI CTR');
    expect(elements.length).toBeGreaterThan(0);
    expect(screen.getByText('CTR')).toBeDefined();
  });

  it('should render the drag handle', () => {
    (useMapStore as any).mockReturnValue({
      selectedFeature: {
        type: 'WAYPOINT',
        data: { waypoint_name: 'DOSTI', raw_coordinates: '180000N 0720000E' },
      },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      navaidDetails: null,
      isLoadingNavaid: false,
      routeDetails: null,
      isLoadingRoute: false,
    });

    const { container } = render(<MobileFeatureInfoCard />);
    const dragHandle = container.querySelector('.aip-mobile-feature-drag-handle');
    expect(dragHandle).toBeInTheDocument();
  });

  it('should collapse when dragged down and expand when dragged up', () => {
    (useMapStore as any).mockReturnValue({
      selectedFeature: {
        type: 'WAYPOINT',
        data: { waypoint_name: 'DOSTI', raw_coordinates: '180000N 0720000E' },
      },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      navaidDetails: null,
      isLoadingNavaid: false,
      routeDetails: null,
      isLoadingRoute: false,
    });

    render(<MobileFeatureInfoCard />);
    const card = screen.getByTestId('mobile-feature-info-card');

    // The details panel should be visible initially (not collapsed)
    expect(screen.getByText('180000N 0720000E')).toBeInTheDocument();

    // Find the react props to trigger dragging handler
    const reactPropsKey = Object.keys(card).find((key) => key.startsWith('__reactProps$'));
    const props = reactPropsKey ? (card as any)[reactPropsKey] : null;
    expect(props).toBeDefined();

    // Trigger drag down to collapse
    if (props && props.onDragEnd) {
      act(() => {
        props.onDragEnd(null, { offset: { y: 100 }, velocity: { y: 400 } });
      });
    }

    // Since we mock state updates or rather state is component local, React should re-render
    // and details panel should be hidden because of isCollapsed=true.
    expect(screen.queryByText('180000N 0720000E')).toBeNull();

    // Trigger drag up to expand again
    if (props && props.onDragEnd) {
      act(() => {
        props.onDragEnd(null, { offset: { y: -100 }, velocity: { y: -400 } });
      });
    }
    expect(screen.getByText('180000N 0720000E')).toBeInTheDocument();
  });
});
