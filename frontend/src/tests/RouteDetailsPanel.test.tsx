import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouteDetailsPanel } from '../features/map/components/RouteDetailsPanel';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => children,
    motion: {
      div: ({ children, className }: any) => <div className={className}>{children}</div>
    }
  };
});

describe('RouteDetailsPanel', () => {
  const mockData = { route_id: 'L333', route_type: 'RNAV' };

  it('renders loading spinner when loading', () => {
    render(<RouteDetailsPanel isLoadingRoute={true} routeDetails={null} data={mockData} />);
    expect(screen.getByText('Loading route segments…')).toBeInTheDocument();
  });

  it('renders fallback when details not available but not loading', () => {
    const fallbackData = { ...mockData, direction_odd: 'E', direction_even: 'W', track_magnetic: '90', distance_nm: '10', moca: '4000', lower_limit: 'FL100', upper_limit: 'FL200', lateral_limits: '10NM', remarks: 'Fallback remarks' };
    render(<RouteDetailsPanel isLoadingRoute={false} routeDetails={null} data={fallbackData} />);

    expect(screen.getByText('Two-Way')).toBeInTheDocument();
    expect(screen.getByText('90°')).toBeInTheDocument();
    expect(screen.getByText('10 NM')).toBeInTheDocument();
    expect(screen.getByText('4000')).toBeInTheDocument();
    expect(screen.getByText('FL100 - FL200')).toBeInTheDocument();
    expect(screen.getByText('Fallback remarks')).toBeInTheDocument();
  });

  it('renders fallback with partial data correctly', () => {
    const fallbackData = { ...mockData, direction_odd: 'E', direction_even: null, track_magnetic: null, distance_nm: null, lower_limit: 'FL100', upper_limit: null };
    render(<RouteDetailsPanel isLoadingRoute={false} routeDetails={null} data={fallbackData} />);

    expect(screen.getByText('ODD E')).toBeInTheDocument();
    // testing one way direction logic
  });

  it('renders fallback with EVEN direction only', () => {
    const fallbackData = { ...mockData, direction_odd: null, direction_even: 'W' };
    render(<RouteDetailsPanel isLoadingRoute={false} routeDetails={null} data={fallbackData} />);
    expect(screen.getByText('EVEN W')).toBeInTheDocument();
  });

  it('renders full route details correctly', () => {
    const mockDetails = {
      total_distance_nm: 100,
      remarks: 'Test route remarks',
      waypoints: [
        { waypoint_name: 'START', navaid_info: 'V1', raw_coordinates: '10N 020E' },
        { waypoint_name: 'END', navaid_info: null, raw_coordinates: '20N 030E' }
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
          lateral_limits: '10'
        }
      ]
    };

    render(<RouteDetailsPanel isLoadingRoute={false} routeDetails={mockDetails as any} data={mockData} />);

    expect(screen.getByText('100 NM')).toBeInTheDocument();
    expect(screen.getByText('2 FIXES')).toBeInTheDocument();
    expect(screen.getByText('10 WIDE')).toBeInTheDocument();
    expect(screen.getByText('Direction of Cruising Levels')).toBeInTheDocument();
    expect(screen.getByText('START')).toBeInTheDocument();
    expect(screen.getByText('V1')).toBeInTheDocument();
    expect(screen.getByText('090')).toBeInTheDocument();
    expect(screen.getByText('FL400')).toBeInTheDocument();
    expect(screen.getByText('FL150')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('4000')).toBeInTheDocument();

    // Check last waypoint
    expect(screen.getByText('END')).toBeInTheDocument();
    expect(screen.getByText('COP / Terminal Fix')).toBeInTheDocument();

    // Check remarks toggle
    const remarkToggle = screen.getByText('Remarks').closest('button');
    fireEvent.click(remarkToggle!);
    expect(screen.getByText('Test route remarks')).toBeInTheDocument();

    fireEvent.click(remarkToggle!);
    expect(screen.queryByText('Test route remarks')).not.toBeInTheDocument();
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
          from_coordinates: '10N 020E'
        }
      ]
    };
    render(<RouteDetailsPanel isLoadingRoute={false} routeDetails={mockDetails as any} data={mockData} />);
    expect(screen.getByText('START')).toBeInTheDocument();
    expect(screen.getByText('10N 020E')).toBeInTheDocument();
  });
});
