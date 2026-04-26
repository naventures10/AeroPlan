import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import TerminalDashboard from '../../features/terminal/TerminalDashboard';
import * as client from '../../api/client';
import * as metarParser from '../../utils/metarParser';

vi.mock('../../api/client', () => ({
  fetchWeather: vi.fn(),
  fetchNotams: vi.fn(),
  fetchDaylight: vi.fn(),
}));

vi.mock('../../utils/metarParser', () => ({
  parseMetar: vi.fn(),
}));

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => children,
    motion: {
      div: ({ children, className }: any) => <div className={className}>{children}</div>,
      button: ({ children, className, onClick }: any) => (
        <button className={className} onClick={onClick}>
          {children}
        </button>
      ),
    },
  };
});

describe('TerminalDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with data and switches tabs', async () => {
    (client.fetchWeather as any).mockResolvedValue({ metar: 'METAR', taf: [['TAF-LINE1']] });
    (client.fetchNotams as any).mockResolvedValue([{ notam_id: '1', message: 'N1' }]);
    (client.fetchDaylight as any).mockResolvedValue({ sunrise: '06:00', sunset: '18:00' });
    (metarParser.parseMetar as any).mockReturnValue({
      temp: 25,
      windDir: '100',
      windSpeed: '10',
      windUnit: 'KT',
      visibility: '10000',
      altimeter: '29.92',
      weather: [],
      clouds: [],
    });

    act(() => {
      render(<TerminalDashboard icaoCode="VAAU" />);
    });

    await waitFor(() => {
      expect(screen.getByText('VAAU')).toBeInTheDocument();
    });

    // Switch to METAR tab
    const metarTab = screen.getByText('METAR').closest('div');
    act(() => {
      if (metarTab) fireEvent.click(metarTab);
    });

    expect(screen.getByText('LATEST METAR')).toBeInTheDocument();

    // Switch to TAF tab
    const tafTab = screen.getByText('TAF').closest('div');
    act(() => {
      if (tafTab) fireEvent.click(tafTab);
    });
    expect(screen.getByText('LATEST TAF')).toBeInTheDocument();

    // Switch to NOTAM tab
    const notamTab = screen.getByText('NOTAM').closest('div');
    act(() => {
      if (notamTab) fireEvent.click(notamTab);
    });
    expect(screen.getByText('ACTIVE NOTAMS')).toBeInTheDocument();

    // Test collapse functionality via Escape key
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
  });

  it('handles empty data gracefully', async () => {
    (client.fetchWeather as any).mockResolvedValue(null);
    (client.fetchNotams as any).mockResolvedValue([]);
    (client.fetchDaylight as any).mockResolvedValue(null);
    (metarParser.parseMetar as any).mockReturnValue({
      temp: null,
      windDir: null,
      windSpeed: null,
      visibility: '',
      altimeter: null,
      weather: [],
      clouds: [],
    });

    act(() => {
      render(<TerminalDashboard icaoCode="VAAU" />);
    });

    await waitFor(() => {
      expect(screen.getByText('METAR')).toBeInTheDocument();
    });
  });

  it('renders nothing when no icaoCode is provided', () => {
    const { container } = render(<TerminalDashboard icaoCode="" />);
    expect(client.fetchWeather).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
});
