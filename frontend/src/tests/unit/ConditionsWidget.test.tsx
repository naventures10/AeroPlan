import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConditionsWidget } from '../../features/terminal/components/ConditionsWidget';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: {
      div: ({ children, className }: any) => <div className={className}>{children}</div>,
    },
  };
});

describe('ConditionsWidget', () => {
  const mockMetar = {
    windDir: '100',
    windSpeed: '10',
    windUnit: 'KT',
    visibility: '10000',
    clouds: ['FEW010', 'BKN020'],
    temp: 25,
    dew: 20,
    qnh: 1013,
    weather: ['RA'],
  };

  const mockDaylight = {
    sunrise: '06:00',
    sunset: '18:00',
    twilight_from: '05:30',
    twilight_to: '18:30',
    date: '2024-01-01',
  };

  it('renders correctly with full data', () => {
    render(
      <ConditionsWidget
        icaoCode="VAAU"
        parsedMetar={mockMetar as any}
        daylight={mockDaylight}
        todayStr="2024-01-01"
      />,
    );
    expect(screen.getByText('VAAU')).toBeInTheDocument();
    expect(screen.getByText('100°T 10 KT')).toBeInTheDocument();
    expect(screen.getByText('10000')).toBeInTheDocument();
    expect(screen.getByText('FEW010')).toBeInTheDocument();
    expect(screen.getByText('BKN020')).toBeInTheDocument();
    expect(screen.getByText('25°C')).toBeInTheDocument();
    expect(screen.getByText('20°C')).toBeInTheDocument();
    expect(screen.getByText('1013 hPa')).toBeInTheDocument();
    expect(screen.getByText('06:00')).toBeInTheDocument();
  });

  it('renders correctly with VRB wind', () => {
    const vrbMetar = { ...mockMetar, windDir: 'VRB' };
    render(
      <ConditionsWidget
        icaoCode="VAAU"
        parsedMetar={vrbMetar as any}
        daylight={mockDaylight}
        todayStr="2024-01-01"
      />,
    );
    expect(screen.getByText('VRB°T 10 KT')).toBeInTheDocument();
  });

  it('renders correctly with empty data', () => {
    const emptyMetar = {
      clouds: [],
      weather: [],
      temp: null,
      dew: null,
      qnh: null,
    };
    render(
      <ConditionsWidget
        icaoCode="VAAU"
        parsedMetar={emptyMetar as any}
        daylight={null}
        todayStr="2024-01-01"
      />,
    );
    expect(screen.getByText('VAAU')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0); // Multiple dash fallbacks
  });
});
