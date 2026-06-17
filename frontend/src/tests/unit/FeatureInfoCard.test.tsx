import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeatureInfoCard } from '../../features/map/FeatureInfoCard';
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
const mockUseIsMobile = vi.fn(() => false);
vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

describe('FeatureInfoCard', () => {
  const setSelectedFeature = vi.fn();
  const setSelectedRouteIds = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
    (useMapStore as any).mockReturnValue({
      selectedFeature: null,
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      routeDetails: null,
      isLoadingRoute: false,
      navaidDetails: null,
      isLoadingNavaid: false,
    });
  });

  it('should not render when no feature is selected', () => {
    render(<FeatureInfoCard />);
    expect(screen.queryByTestId('feature-info-card')).toBeNull();
  });

  it('should render ATS route details', async () => {
    const mockRouteDetails = {
      route_id: 'L333',
      route_designator: 'L333',
      route_type: 'RNAV',
      segments: [],
      waypoints: [],
      total_distance_nm: 120,
    };

    (useMapStore as any).mockReturnValue({
      selectedFeature: { type: 'ATS_ROUTE', data: { route_id: 'L333' } },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      routeDetails: mockRouteDetails,
      isLoadingRoute: false,
      navaidDetails: null,
      isLoadingNavaid: false,
    });

    render(<FeatureInfoCard />);

    expect(screen.getByTestId('feature-info-card')).toBeDefined();
    expect(screen.getByText('L333')).toBeDefined();

    const distanceBadge = await screen.findByText('120 NM');
    expect(distanceBadge).toBeDefined();
  });

  it('should render Navaid details', async () => {
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
      routeDetails: null,
      isLoadingRoute: false,
      navaidDetails: mockNavaidDetails,
      isLoadingNavaid: false,
    });

    render(<FeatureInfoCard />);

    const title = await screen.findByText('BOMBAY');
    expect(title).toBeDefined();
  });

  it('should render Waypoint details', () => {
    (useMapStore as any).mockReturnValue({
      selectedFeature: {
        type: 'WAYPOINT',
        data: { waypoint_name: 'DOSTI', raw_coordinates: '180000N 0720000E' },
      },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      routeDetails: null,
      isLoadingRoute: false,
      navaidDetails: null,
      isLoadingNavaid: false,
    });

    render(<FeatureInfoCard />);
    expect(screen.getByText('DOSTI')).toBeDefined();
    expect(screen.getByText('180000N 0720000E')).toBeDefined();
  });

  it('should render Airspace details', () => {
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
      routeDetails: null,
      isLoadingRoute: false,
      navaidDetails: null,
      isLoadingNavaid: false,
    });

    render(<FeatureInfoCard />);
    const elements = screen.getAllByText('MUMBAI CTR');
    expect(elements.length).toBeGreaterThan(0);
    expect(screen.getByText('CTR')).toBeDefined();
  });

  it('should close the card when close button is clicked', () => {
    (useMapStore as any).mockReturnValue({
      selectedFeature: { type: 'WAYPOINT', data: { waypoint_name: 'FIX' } },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      routeDetails: null,
      isLoadingRoute: false,
      navaidDetails: null,
      isLoadingNavaid: false,
    });

    render(<FeatureInfoCard />);
    const closeBtn = screen.getByTestId('close-feature-card');
    fireEvent.click(closeBtn);

    expect(setSelectedFeature).toHaveBeenCalledWith(null);
    expect(setSelectedRouteIds).toHaveBeenCalledWith([]);
  });

  it('should not render Waypoint details on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    (useMapStore as any).mockReturnValue({
      selectedFeature: {
        type: 'WAYPOINT',
        data: { waypoint_name: 'DOSTI', raw_coordinates: '180000N 0720000E' },
      },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      routeDetails: null,
      isLoadingRoute: false,
      navaidDetails: null,
      isLoadingNavaid: false,
    });

    render(<FeatureInfoCard />);
    expect(screen.queryByTestId('feature-info-card')).toBeNull();
  });

  it('should not render Navaid details on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    (useMapStore as any).mockReturnValue({
      selectedFeature: { type: 'NAVAID', data: { ident: 'BBB', station_name: 'BOMBAY' } },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      routeDetails: null,
      isLoadingRoute: false,
      navaidDetails: null,
      isLoadingNavaid: false,
    });

    render(<FeatureInfoCard />);
    expect(screen.queryByTestId('feature-info-card')).toBeNull();
  });

  it('should not render Airspace details on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    (useMapStore as any).mockReturnValue({
      selectedFeature: {
        type: 'AIRSPACE',
        data: { name: 'MUMBAI CTR', airspace_type: 'CTR' },
      },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      routeDetails: null,
      isLoadingRoute: false,
      navaidDetails: null,
      isLoadingNavaid: false,
    });

    render(<FeatureInfoCard />);
    expect(screen.queryByTestId('feature-info-card')).toBeNull();
  });

  it('should render ATS Route details on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    const mockRouteDetails = {
      route_id: 'L333',
      route_designator: 'L333',
      route_type: 'RNAV',
      segments: [],
      waypoints: [],
      total_distance_nm: 120,
    };

    (useMapStore as any).mockReturnValue({
      selectedFeature: { type: 'ATS_ROUTE', data: { route_id: 'L333' } },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      routeDetails: mockRouteDetails,
      isLoadingRoute: false,
      navaidDetails: null,
      isLoadingNavaid: false,
    });

    render(<FeatureInfoCard />);
    expect(screen.getByTestId('feature-info-card')).toBeDefined();
  });
});
