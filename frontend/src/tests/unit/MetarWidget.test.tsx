import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetarWidget } from '../../features/terminal/components/MetarWidget';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: {
      div: ({ children, className }: any) => <div className={className}>{children}</div>,
    },
  };
});

describe('MetarWidget', () => {
  it('renders correctly with weather data', () => {
    const mockWeather = {
      metar: 'METAR DATA STRING',
      fetched_at: '2024-01-01T00:00:00Z',
    };
    render(<MetarWidget weather={mockWeather as any} />);
    expect(screen.getByText('METAR DATA STRING')).toBeInTheDocument();
    expect(screen.getByText(/Fetched \(UTC\):/)).toBeInTheDocument();
  });

  it('renders correctly without weather data', () => {
    render(<MetarWidget weather={null} />);
    expect(screen.getByText('No METAR data available.')).toBeInTheDocument();
  });
});
