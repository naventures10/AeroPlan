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
    const mockWeather = { icao: 'VAAU', metar: 'VAAU 010203Z 10010KT...' };
    render(
      <ConditionsWidget
        icaoCode="VAAU"
        weather={mockWeather as any}
        parsedMetar={mockMetar as any}
        daylight={mockDaylight}
        todayStr="2024-01-01"
      />,
    );
    expect(screen.getByText('VAAU')).toBeInTheDocument();
    expect(screen.getByText('100°T')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('KT')).toBeInTheDocument();
    expect(screen.getByText('10000')).toBeInTheDocument();
    expect(screen.getByText('FEW010')).toBeInTheDocument();
    expect(screen.getByText('BKN020')).toBeInTheDocument();
    expect(screen.getByText('25°C')).toBeInTheDocument();
    expect(screen.getByText('20°C')).toBeInTheDocument();
    expect(screen.getByText('1013')).toBeInTheDocument();
    expect(screen.getByText('hPa')).toBeInTheDocument();
    expect(screen.getByText('06:00')).toBeInTheDocument();
  });

  it('renders correctly with VRB wind', () => {
    const vrbMetar = { ...mockMetar, windDir: 'VRB' };
    const mockWeather = { icao: 'VAAU', metar: 'VAAU 010203Z VRB10KT...' };
    render(
      <ConditionsWidget
        icaoCode="VAAU"
        weather={mockWeather as any}
        parsedMetar={vrbMetar as any}
        daylight={mockDaylight}
        todayStr="2024-01-01"
      />,
    );
    expect(screen.getAllByText('VRB').length).toBeGreaterThan(0);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders Weather Data Unavailable when weather data is missing', () => {
    render(
      <ConditionsWidget
        icaoCode="VAAU"
        weather={null}
        parsedMetar={{
          windDir: null,
          windSpeed: null,
          windUnit: null,
          visibility: null,
          clouds: [],
          temp: null,
          dew: null,
          qnh: null,
        }}
        daylight={mockDaylight}
        todayStr="2024-01-01"
      />,
    );
    expect(screen.getAllByText('VAAU').length).toBeGreaterThan(0);
    expect(screen.getByText('Weather Data Unavailable')).toBeInTheDocument();
    expect(
      screen.getByText(/No live METAR or observations are currently reported/i),
    ).toBeInTheDocument();
    // Daylight is still rendered
    expect(screen.getByText('06:00')).toBeInTheDocument();
  });
});
