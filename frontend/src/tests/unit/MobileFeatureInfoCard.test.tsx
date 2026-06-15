import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileFeatureInfoCard } from '../../features/map/components/mobile/MobileFeatureInfoCard';
import { useMapStore } from '../../store/useMapStore';

// Mock the store
vi.mock('../../store/useMapStore', () => ({
  useMapStore: vi.fn(),
}));

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
    });

    render(<MobileFeatureInfoCard />);
    expect(screen.queryByTestId('mobile-feature-info-card')).toBeNull();
  });

  it('should not render when no feature is selected', () => {
    render(<MobileFeatureInfoCard />);
    expect(screen.queryByTestId('mobile-feature-info-card')).toBeNull();
  });

  it('should not render when selected feature is ATS_ROUTE', () => {
    (useMapStore as any).mockReturnValue({
      selectedFeature: { type: 'ATS_ROUTE', data: { route_id: 'L333' } },
      setSelectedFeature,
      viewMode: 'ENROUTE',
      setSelectedRouteIds,
      navaidDetails: null,
      isLoadingNavaid: false,
    });

    render(<MobileFeatureInfoCard />);
    expect(screen.queryByTestId('mobile-feature-info-card')).toBeNull();
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
    });

    render(<MobileFeatureInfoCard />);
    expect(screen.getByTestId('mobile-feature-info-card')).toBeDefined();
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
      navaidDetails: null,
      isLoadingNavaid: false,
    });

    render(<MobileFeatureInfoCard />);
    const closeBtn = screen.getByTestId('close-mobile-feature-card');
    fireEvent.click(closeBtn);

    expect(setSelectedFeature).toHaveBeenCalledWith(null);
    expect(setSelectedRouteIds).toHaveBeenCalledWith([]);
  });
});
