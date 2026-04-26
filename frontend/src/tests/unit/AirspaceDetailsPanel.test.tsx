import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AirspaceDetailsPanel } from '../../features/map/components/AirspaceDetailsPanel';

describe('AirspaceDetailsPanel', () => {
  it('renders correctly with data', () => {
    const data = {
      properties: {
        airspace_type: 'FIR',
        name: 'TEST FIR',
        identification: 'VABF',
        lower_limit: 'FL100',
        upper_limit: 'FL200',
        remarks: 'TEST REMARKS',
        lateral_limits: '123456N 0123456E -then 123456N 0123456E',
      },
    };
    render(<AirspaceDetailsPanel data={data} />);
    expect(screen.getByText('FIR')).toBeInTheDocument();
    expect(screen.getByText('TEST FIR')).toBeInTheDocument();
    expect(screen.getByText('VABF')).toBeInTheDocument();
    expect(screen.getByText('FL100 — FL200')).toBeInTheDocument();
    expect(screen.getByText('TEST REMARKS')).toBeInTheDocument();
    expect(screen.getAllByText('123456N 0123456E').length).toBe(2);
    expect(screen.getByText('-then')).toBeInTheDocument();
  });

  it('renders default text when missing data', () => {
    const data = {};
    render(<AirspaceDetailsPanel data={data} />);
    expect(screen.getByText('AIRSPACE')).toBeInTheDocument();
    expect(screen.getByText('Unnamed Airspace')).toBeInTheDocument();
    expect(screen.getByText('SFC — UNL')).toBeInTheDocument();
  });

  it('returns null when data is empty', () => {
    const { container } = render(<AirspaceDetailsPanel data={null} />);
    expect(container.firstChild).toBeNull();
  });
});
