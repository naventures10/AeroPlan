import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeatureInfoCard } from '../../features/map/FeatureInfoCard';
import { useMapStore } from '../../store/useMapStore';
import * as api from '../../api/client';

// Mock the store
vi.mock('../../store/useMapStore', () => ({
  useMapStore: vi.fn(),
}));

// Mock the API
vi.mock('../../api/client', () => ({
  fetchAtsRouteDetails: vi.fn(),
  fetchNavaidDetails: vi.fn(),
}));

describe('FeatureInfoCard', () => {
  const setSelectedFeature = vi.fn();
  const setHighlightedAirspaceId = vi.fn();
  const setSelectedRouteIds = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMapStore as any).mockReturnValue({
      selectedFeature: null,
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setHighlightedAirspaceId,
      setSelectedRouteIds,
    });
  });

  it('should not render when no feature is selected', () => {
    render(<FeatureInfoCard />);
    expect(screen.queryByTestId('feature-info-card')).toBeNull();
  });

  it('should render ATS route details and fetch data', async () => {
    const mockRouteDetails = {
      route_id: 'L333',
      route_designator: 'L333',
      route_type: 'RNAV',
      segments: [],
      waypoints: [],
      total_distance_nm: 120,
    };
    (api.fetchAtsRouteDetails as any).mockResolvedValue(mockRouteDetails);

    (useMapStore as any).mockReturnValue({
      selectedFeature: { type: 'ATS_ROUTE', data: { route_id: 'L333' } },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setHighlightedAirspaceId,
      setSelectedRouteIds,
    });

    render(<FeatureInfoCard />);

    expect(screen.getByTestId('feature-info-card')).toBeDefined();
    expect(screen.getByText('L333')).toBeDefined();

    // Wait for the data to be rendered
    const distanceBadge = await screen.findByText('120 NM');
    expect(distanceBadge).toBeDefined();

    expect(api.fetchAtsRouteDetails).toHaveBeenCalledWith('L333');
  });

  it('should render Navaid details and fetch data', async () => {
    const mockNavaidDetails = {
      ident: 'BBB',
      station_name: 'BOMBAY',
      aid_type: 'VOR/DME',
      frequency: '116.6',
    };
    (api.fetchNavaidDetails as any).mockResolvedValue(mockNavaidDetails);

    (useMapStore as any).mockReturnValue({
      selectedFeature: { type: 'NAVAID', data: { ident: 'BBB', station_name: 'BOMBAY' } },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setHighlightedAirspaceId,
      setSelectedRouteIds,
    });

    render(<FeatureInfoCard />);

    const title = await screen.findByText('BOMBAY');
    expect(title).toBeDefined();

    expect(api.fetchNavaidDetails).toHaveBeenCalledWith('BBB');
  });

  it('should render Waypoint details', () => {
    (useMapStore as any).mockReturnValue({
      selectedFeature: {
        type: 'WAYPOINT',
        data: { waypoint_name: 'DOSTI', raw_coordinates: '180000N 0720000E' },
      },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setHighlightedAirspaceId,
      setSelectedRouteIds,
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
      setHighlightedAirspaceId,
      setSelectedRouteIds,
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
      setHighlightedAirspaceId,
      setSelectedRouteIds,
    });

    render(<FeatureInfoCard />);
    const closeBtn = screen.getByTestId('close-feature-card');
    fireEvent.click(closeBtn);

    expect(setSelectedFeature).toHaveBeenCalledWith(null);
    expect(setSelectedRouteIds).toHaveBeenCalledWith([]);
  });
});
