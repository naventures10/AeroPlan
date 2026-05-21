import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AirspaceDetailsPanel } from '../../features/map/components/AirspaceDetailsPanel';

describe('AirspaceDetailsPanel', () => {
  it('renders airspace type and name', () => {
    render(
      <AirspaceDetailsPanel
        data={{
          name: 'MUMBAI TMA',
          airspace_type: 'CONTROL_AREA',
          lower_limit: 'FL070',
          upper_limit: 'FL245',
        }}
      />,
    );

    expect(screen.getByText('CONTROL AREA')).toBeDefined();
    expect(screen.getByText('MUMBAI TMA')).toBeDefined();
    expect(screen.getByText('FL070 — FL245')).toBeDefined();
  });

  it('renders identification and remarks when provided', () => {
    render(
      <AirspaceDetailsPanel
        data={{
          name: 'DELHI CTR',
          airspace_type: 'CTR',
          identification: 'VIDF',
          lower_limit: 'SFC',
          upper_limit: 'FL070',
          remarks: 'Active H24',
        }}
      />,
    );

    expect(screen.getByText('VIDF')).toBeDefined();
    expect(screen.getByText('Active H24')).toBeDefined();
  });

  it('returns null when data is null', () => {
    const { container } = render(<AirspaceDetailsPanel data={null} />);
    expect(container.innerHTML).toBe('');
  });
});
