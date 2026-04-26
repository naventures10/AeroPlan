import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WaypointDetailsPanel } from '../../features/map/components/WaypointDetailsPanel';

describe('WaypointDetailsPanel', () => {
  it('renders correctly with data', () => {
    const data = {
      waypoint_name: 'WP1',
      type: 'RNAV',
      raw_coordinates: '10N 020E',
      route_ids: '{"A1","B2"}',
      remarks: 'TEST',
    };
    render(<WaypointDetailsPanel data={data} />);
    expect(screen.getByText('10N 020E')).toBeInTheDocument();
    expect(screen.getByText('A1,B2')).toBeInTheDocument();
    expect(screen.getByText('TEST')).toBeInTheDocument();
  });

  it('renders correctly with alternative routes property', () => {
    const data = {
      routes: 'A1,B2',
    };
    render(<WaypointDetailsPanel data={data} />);
    expect(screen.getByText('A1,B2')).toBeInTheDocument();
  });

  it('handles empty data', () => {
    const data = {};
    const { container } = render(<WaypointDetailsPanel data={data} />);
    // Just an empty grid because LabelVal returns null if value is empty
    expect(container.firstChild).toBeInTheDocument();
  });
});
