import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import AerodromeChartViewer from '../../features/aip/AerodromeChartViewer';
import { useMapStore } from '../../store/useMapStore';
import * as client from '../../api/client';

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
  Document: ({ children }: any) => <div data-testid="mock-pdf-doc">{children}</div>,
  Page: () => <div data-testid="mock-pdf-page">Page</div>,
}));

vi.mock('../../api/client', () => ({
  fetchCharts: vi.fn(),
  fetchRnpProcedures: vi.fn(),
  getProxyPdfUrl: vi.fn((url) => 'test-url-' + url),
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

describe('AerodromeChartViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with data and handles chart click', async () => {
    useMapStore.setState({
      activeAirport: 'VAAU',
      activeAerodromeMetadata: { id: 'VAAU' },
      viewMode: 'TERMINAL',
    });

    (client.fetchCharts as any).mockResolvedValue([
      { chart_id: '1', chart_title: 'ChartTitle', chart_url: 'u', chart_index: 'i' },
    ]);
    (client.fetchRnpProcedures as any).mockResolvedValue([
      { procedure_id: 1, chart_key: 'CHARTTITLE' },
    ]);

    act(() => {
      render(<AerodromeChartViewer icaoCode="VAAU" />);
    });

    await waitFor(() => {
      expect(screen.getByText('ChartTitle')).toBeInTheDocument();
    });

    const button = screen.getByText('ChartTitle').closest('button');
    act(() => {
      fireEvent.click(button!);
    });

    expect(screen.getByTestId('mock-pdf-doc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view in 3d/i })).toBeInTheDocument();
  });

  it('does not show the "View in 3D space" button for non-RNP charts like coding tables', async () => {
    useMapStore.setState({
      activeAirport: 'VAAU',
      activeAerodromeMetadata: { id: 'VAAU' },
      viewMode: 'TERMINAL',
    });

    (client.fetchCharts as any).mockResolvedValue([
      { chart_id: '1', chart_title: 'RNP RWY 27-CODING', chart_url: 'u', chart_index: 'i' },
    ]);
    (client.fetchRnpProcedures as any).mockResolvedValue([
      { procedure_id: 1, chart_key: 'RNP-RWY-27' },
    ]);

    act(() => {
      render(<AerodromeChartViewer icaoCode="VAAU" />);
    });

    await waitFor(() => {
      expect(screen.getByText('RNP RWY 27-CODING')).toBeInTheDocument();
    });

    const button = screen.getByText('RNP RWY 27-CODING').closest('button');
    act(() => {
      fireEvent.click(button!);
    });

    expect(screen.getByTestId('mock-pdf-doc')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view in 3d/i })).not.toBeInTheDocument();
  });

  it('sorts charts in the carousel correctly', async () => {
    useMapStore.setState({
      activeAirport: 'VAAU',
      activeAerodromeMetadata: { id: 'VAAU' },
      viewMode: 'TERMINAL',
    });

    const unsortedCharts = [
      {
        chart_id: '1',
        chart_title: 'VAAU-RNP-Y-RWY-27-CODING-TABLE',
        chart_index: 'AD 2.VAAU-RNP-27',
      },
      { chart_id: '2', chart_title: 'VAAU-RNP-Y-RWY-27', chart_index: 'AD 2.VAAU-RNP-27' },
      { chart_id: '3', chart_title: 'VAAU-AERODROME-CHART', chart_index: 'AD 2.VAAU-1' },
      { chart_id: '4', chart_title: 'VAAU-RNP-Y-RWY-09', chart_index: 'AD 2.VAAU-RNP-09' },
    ];

    (client.fetchCharts as any).mockResolvedValue(unsortedCharts);
    (client.fetchRnpProcedures as any).mockResolvedValue([]);

    act(() => {
      render(<AerodromeChartViewer icaoCode="VAAU" />);
    });

    await waitFor(() => {
      expect(screen.getByText('VAAU-AERODROME-CHART')).toBeInTheDocument();
    });

    const chartElements = screen
      .getAllByRole('button')
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    const chartLabels = chartElements.filter((text) => text && text.startsWith('VAAU-'));
    expect(chartLabels).toEqual([
      'VAAU-AERODROME-CHART',
      'VAAU-RNP-Y-RWY-09',
      'VAAU-RNP-Y-RWY-27',
      'VAAU-RNP-Y-RWY-27-CODING-TABLE',
    ]);
  });
});
