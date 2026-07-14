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

  it('correctly parses and renders combined vertical limits', () => {
    // 1. 2000 FT AMSL/ GND -> GND — 2000 FT AMSL
    const { rerender } = render(
      <AirspaceDetailsPanel
        data={{
          name: 'COCHIN CTR',
          airspace_type: 'CTR',
          lower_limit: null,
          upper_limit: '2000 FT AMSL/ GND',
        }}
      />,
    );
    expect(screen.getByText('GND — 2000 FT AMSL')).toBeDefined();

    // 2. FL 145 / 7500FT AMSL -> 7500FT AMSL — FL 145
    rerender(
      <AirspaceDetailsPanel
        data={{
          name: 'CALICUT CTA',
          airspace_type: 'CTA_LOWER',
          lower_limit: null,
          upper_limit: 'FL 145 / 7500FT AMSL',
        }}
      />,
    );
    expect(screen.getByText('7500FT AMSL — FL 145')).toBeDefined();

    // 3. FL 460 / FL 255 -> FL 255 — FL 460
    rerender(
      <AirspaceDetailsPanel
        data={{
          name: 'CHENNAI CTA',
          airspace_type: 'CTA_UPPER',
          lower_limit: null,
          upper_limit: 'FL 460 / FL 255',
        }}
      />,
    );
    expect(screen.getByText('FL 255 — FL 460')).toBeDefined();

    // 4. SFC — 194800N 0600000E UNL/SFC a) Airspace... -> SFC — UNL
    rerender(
      <AirspaceDetailsPanel
        data={{
          name: 'CHENNAI CTA SECTION UPPER',
          airspace_type: 'CTA_UPPER',
          lower_limit: null,
          upper_limit:
            'SFC — 194800N 0600000E UNL/SFC a) Airspace within controlled airspace is classified as ‘D’.',
        }}
      />,
    );
    expect(screen.getByText('SFC — UNL')).toBeDefined();

    // 5. SFC — * FL145/1000 FT AMSL upto 25NM... -> 1000 FT AMSL — FL145
    rerender(
      <AirspaceDetailsPanel
        data={{
          name: 'TRIVANDRUM CTA LOWER',
          airspace_type: 'CTA_LOWER',
          lower_limit: null,
          upper_limit:
            'SFC — * FL145/1000 FT AMSL upto 25NM, excluding the airspace contained within Thiruvananthapuram CTR.',
        }}
      />,
    );
    expect(screen.getByText('1000 FT AMSL — FL145')).toBeDefined();

    // 6. SFC — • 5500 FT AMSL / 2000 FT AMSL. -> 2000 FT AMSL — 5500 FT AMSL
    rerender(
      <AirspaceDetailsPanel
        data={{
          name: 'MADURAI CTA LOWER',
          airspace_type: 'CTA_LOWER',
          lower_limit: null,
          upper_limit: 'SFC — • 5500 FT AMSL / 2000 FT AMSL.',
        }}
      />,
    );
    expect(screen.getByText('2000 FT AMSL — 5500 FT AMSL')).toBeDefined();

    // 7. SFC — • FL145 / 5500 FT AMSL. -> 5500 FT AMSL — FL145
    rerender(
      <AirspaceDetailsPanel
        data={{
          name: 'COCHIN CTA LOWER B',
          airspace_type: 'CTA_LOWER',
          lower_limit: null,
          upper_limit: 'SFC — • FL145 / 5500 FT AMSL.',
        }}
      />,
    );
    expect(screen.getByText('5500 FT AMSL — FL145')).toBeDefined();

    // 8. SFC — controlled airspace is classified as ‘G’. UNL/GND -> GND — UNL
    rerender(
      <AirspaceDetailsPanel
        data={{
          name: 'KOLKATA FIR',
          airspace_type: 'FIR',
          lower_limit: null,
          upper_limit: 'SFC — controlled airspace is classified as ‘G’. UNL/GND',
        }}
      />,
    );
    expect(screen.getByText('GND — UNL')).toBeDefined();
  });

  it('returns null when data is null', () => {
    const { container } = render(<AirspaceDetailsPanel data={null} />);
    expect(container.innerHTML).toBe('');
  });
});
