import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileRouteDetailsPanel } from '../../features/map/components/mobile/MobileRouteDetailsPanel';

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

describe('MobileRouteDetailsPanel', () => {
  const mockData = { route_id: 'L333', route_type: 'RNAV' };

  it('renders loading spinner when loading', () => {
    render(<MobileRouteDetailsPanel isLoadingRoute={true} routeDetails={null} data={mockData} />);
    expect(screen.getByText('Loading route segments…')).toBeInTheDocument();
  });

  it('renders fallback when details not available but not loading', () => {
    const fallbackData = {
      ...mockData,
      direction_odd: 'E',
      direction_even: 'W',
      track_magnetic: '90',
      distance_nm: '10',
      moca: '4000',
      lower_limit: 'FL100',
      upper_limit: 'FL200',
      lateral_limits: '10NM',
      remarks: 'Fallback remarks',
    };
    render(
      <MobileRouteDetailsPanel isLoadingRoute={false} routeDetails={null} data={fallbackData} />,
    );

    expect(screen.getByText('Two-Way')).toBeInTheDocument();
    expect(screen.getByText('90°')).toBeInTheDocument();
    expect(screen.getByText('10 NM')).toBeInTheDocument();
    expect(screen.getByText('4000')).toBeInTheDocument();
    expect(screen.getByText('FL100 - FL200')).toBeInTheDocument();
    expect(screen.getByText('Fallback remarks')).toBeInTheDocument();
  });

  it('renders full route details correctly and handles expansion', () => {
    const mockDetails = {
      total_distance_nm: 100,
      remarks: 'Test route remarks',
      waypoints: [
        { waypoint_name: 'START', navaid_info: 'V1', raw_coordinates: '10N 020E' },
        { waypoint_name: 'END', navaid_info: null, raw_coordinates: '20N 030E' },
      ],
      segments: [
        {
          sequence_number: 1,
          direction_odd: 'E',
          direction_even: 'W',
          from_waypoint: 'START',
          from_coordinates: '10N 020E',
          track_magnetic: '090',
          distance_nm: 100,
          upper_limit: 'FL400',
          lower_limit: 'FL150',
          airspace_class: 'A',
          moca: '4000',
          lateral_limits: '10',
        },
      ],
    };

    render(
      <MobileRouteDetailsPanel
        isLoadingRoute={false}
        routeDetails={mockDetails as any}
        data={mockData}
      />,
    );

    // Summary strip
    expect(screen.getAllByText('100 NM').length).toBe(2);
    expect(screen.getByText('2 FIXES')).toBeInTheDocument();
    expect(screen.getByText('10 WIDE')).toBeInTheDocument();

    // Cruising levels
    expect(screen.getByText('Cruising Levels')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();

    // Segment Waypoint
    expect(screen.getByText('START')).toBeInTheDocument();
    expect(screen.getByText('V1')).toBeInTheDocument();
    expect(screen.getByText('090°')).toBeInTheDocument();

    // Last Waypoint
    expect(screen.getByText('END')).toBeInTheDocument();
    expect(screen.getByText('COP / Terminal Fix')).toBeInTheDocument();

    // Verification of expand/collapse:
    // Details are initially hidden
    expect(screen.queryByText('Coordinates')).toBeNull();

    // Tap on segment header to expand
    const segmentHeader = screen.getByText('START').closest('.cursor-pointer');
    fireEvent.click(segmentHeader!);

    // Now details should be visible
    expect(screen.getByText('10N 020E')).toBeInTheDocument();
    expect(screen.getByText('4000')).toBeInTheDocument();
    expect(screen.getByText('FL150 - FL400')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();

    // Tap again to collapse
    fireEvent.click(segmentHeader!);
    expect(screen.queryByText('10N 020E')).toBeNull();
  });

  it('handles segments missing waypoints gracefully', () => {
    const mockDetails = {
      total_distance_nm: 100,
      remarks: null,
      waypoints: [],
      segments: [
        {
          sequence_number: 1,
          from_waypoint: 'START',
          from_coordinates: '10N 020E',
        },
      ],
    };
    render(
      <MobileRouteDetailsPanel
        isLoadingRoute={false}
        routeDetails={mockDetails as any}
        data={mockData}
      />,
    );
    expect(screen.getByText('START')).toBeInTheDocument();
  });
});
