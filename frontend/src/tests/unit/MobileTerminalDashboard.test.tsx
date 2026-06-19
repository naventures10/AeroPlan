import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import MobileTerminalDashboard from '../../features/terminal/mobile/MobileTerminalDashboard';
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
      div: ({ children, className, onClick }: any) => (
        <div className={className} onClick={onClick}>
          {children}
        </div>
      ),
      button: ({ children, className, onClick }: any) => (
        <button className={className} onClick={onClick}>
          {children}
        </button>
      ),
    },
    useDragControls: () => ({
      start: vi.fn(),
    }),
  };
});

describe('MobileTerminalDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with data, expands, and switches tabs', async () => {
    (client.fetchWeather as any).mockResolvedValue({
      metar: 'METAR TEST DATA',
      taf: [['TAF-LINE-TEST']],
    });
    (client.fetchNotams as any).mockResolvedValue([{ notam_id: 'NOTAM123', message: 'N1' }]);
    (client.fetchDaylight as any).mockResolvedValue({ sunrise: '06:00', sunset: '18:00' });
    (metarParser.parseMetar as any).mockReturnValue({
      temp: 28,
      windDir: '090',
      windSpeed: '12',
      windUnit: 'KT',
      visibility: '9999',
      altimeter: '1010',
      weather: [],
      clouds: ['SCT020'],
    });

    act(() => {
      render(<MobileTerminalDashboard icaoCode="VAAU" />);
    });

    // Wait for the main text and data fetch
    await waitFor(() => {
      expect(screen.getByText('VAAU')).toBeInTheDocument();
    });

    // Verify conditions display
    expect(screen.getByText('Wind')).toBeInTheDocument();
    expect(screen.getByText('Visibility')).toBeInTheDocument();

    // Switch to METAR tab
    const metarTab = screen.getByText('METAR').closest('button');
    act(() => {
      if (metarTab) fireEvent.click(metarTab);
    });
    expect(screen.getByText('METAR TEST DATA')).toBeInTheDocument();

    // Switch to TAF tab
    const tafTab = screen.getByText('TAF').closest('button');
    act(() => {
      if (tafTab) fireEvent.click(tafTab);
    });
    expect(screen.getByText('TAF-LINE-TEST')).toBeInTheDocument();

    // Switch to NOTAM tab
    const notamTab = screen.getByText('NOTAM').closest('button');
    act(() => {
      if (notamTab) fireEvent.click(notamTab);
    });
    expect(screen.getByText('NOTAM123')).toBeInTheDocument();

    // Test Collapse / Expand
    const headerToggle = screen.getByText('VAAU').closest('div');
    expect(headerToggle).toBeInTheDocument();

    act(() => {
      if (headerToggle) fireEvent.click(headerToggle);
    });

    // Verify it is collapsed (tabs no longer visible)
    expect(screen.queryByText('METAR')).not.toBeInTheDocument();
  });

  it('renders nothing when no icaoCode is provided', () => {
    const { container } = render(<MobileTerminalDashboard icaoCode="" />);
    expect(client.fetchWeather).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
});
