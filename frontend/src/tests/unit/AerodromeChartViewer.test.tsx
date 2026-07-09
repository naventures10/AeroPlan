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

    // Open the dropdown first
    await waitFor(() => {
      expect(screen.getByText('AERODROME CHARTS')).toBeInTheDocument();
    });
    act(() => {
      fireEvent.click(screen.getByText('AERODROME CHARTS'));
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

  it('does not show the "View in 3D space" button for secondary charts like coding tables', async () => {
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

    // Open the dropdown first
    await waitFor(() => {
      expect(screen.getByText('AERODROME CHARTS')).toBeInTheDocument();
    });
    act(() => {
      fireEvent.click(screen.getByText('AERODROME CHARTS'));
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

  it('shows the "View in 3D space" button for RNP charts with category suffixes', async () => {
    useMapStore.setState({
      activeAirport: 'VOGB',
      activeAerodromeMetadata: { id: 'VOGB' },
      viewMode: 'TERMINAL',
    });

    (client.fetchCharts as any).mockResolvedValue([
      {
        chart_id: '1',
        chart_title: 'VOGB-RNP-Y-RWY-27-CAT-A-B-C.pdf',
        chart_url: 'u',
        chart_index: 'i',
      },
    ]);
    (client.fetchRnpProcedures as any).mockResolvedValue([
      { procedure_id: 1, chart_key: 'VOGB-RNP-Y-RWY-27' },
    ]);

    act(() => {
      render(<AerodromeChartViewer icaoCode="VOGB" />);
    });

    // Open the dropdown first
    await waitFor(() => {
      expect(screen.getByText('AERODROME CHARTS')).toBeInTheDocument();
    });
    act(() => {
      fireEvent.click(screen.getByText('AERODROME CHARTS'));
    });

    await waitFor(() => {
      expect(screen.getByText('VOGB-RNP-Y-RWY-27-CAT-A-B-C.pdf')).toBeInTheDocument();
    });

    const button = screen.getByText('VOGB-RNP-Y-RWY-27-CAT-A-B-C.pdf').closest('button');
    act(() => {
      fireEvent.click(button!);
    });

    expect(screen.getByTestId('mock-pdf-doc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view in 3d/i })).toBeInTheDocument();
  });

  it('sorts charts in the dropdown correctly', async () => {
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

    // Open the dropdown first
    await waitFor(() => {
      expect(screen.getByText('AERODROME CHARTS')).toBeInTheDocument();
    });
    act(() => {
      fireEvent.click(screen.getByText('AERODROME CHARTS'));
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

  it('shows the "View in 3D space" button when chart has category suffix but procedure does not', async () => {
    useMapStore.setState({
      activeAirport: 'VOCI',
      activeAerodromeMetadata: { id: 'VOCI' },
      viewMode: 'TERMINAL',
    });

    (client.fetchCharts as any).mockResolvedValue([
      {
        chart_id: '10',
        chart_title: 'VOCI-RNP-Y-RWY-09.pdf',
        chart_url: 'u',
        chart_index: 'i',
      },
    ]);
    (client.fetchRnpProcedures as any).mockResolvedValue([
      { procedure_id: 94, chart_key: 'VOCI-RNP-RWY-09' },
    ]);

    act(() => {
      render(<AerodromeChartViewer icaoCode="VOCI" />);
    });

    await waitFor(() => {
      expect(screen.getByText('AERODROME CHARTS')).toBeInTheDocument();
    });
    act(() => {
      fireEvent.click(screen.getByText('AERODROME CHARTS'));
    });

    await waitFor(() => {
      expect(screen.getByText('VOCI-RNP-Y-RWY-09.pdf')).toBeInTheDocument();
    });

    const button = screen.getByText('VOCI-RNP-Y-RWY-09.pdf').closest('button');
    act(() => {
      fireEvent.click(button!);
    });

    expect(screen.getByTestId('mock-pdf-doc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view in 3d/i })).toBeInTheDocument();
  });

  it('shows the "View in 3D space" button when procedure has category suffix but chart does not', async () => {
    useMapStore.setState({
      activeAirport: 'VABB',
      activeAerodromeMetadata: { id: 'VABB' },
      viewMode: 'TERMINAL',
    });

    (client.fetchCharts as any).mockResolvedValue([
      {
        chart_id: '20',
        chart_title: 'VABB-RNP-RWY-09.pdf',
        chart_url: 'u',
        chart_index: 'i',
      },
    ]);
    (client.fetchRnpProcedures as any).mockResolvedValue([
      { procedure_id: 5, chart_key: 'VABB-RNP-Y-RWY-09' },
    ]);

    act(() => {
      render(<AerodromeChartViewer icaoCode="VABB" />);
    });

    await waitFor(() => {
      expect(screen.getByText('AERODROME CHARTS')).toBeInTheDocument();
    });
    act(() => {
      fireEvent.click(screen.getByText('AERODROME CHARTS'));
    });

    await waitFor(() => {
      expect(screen.getByText('VABB-RNP-RWY-09.pdf')).toBeInTheDocument();
    });

    const button = screen.getByText('VABB-RNP-RWY-09.pdf').closest('button');
    act(() => {
      fireEvent.click(button!);
    });

    expect(screen.getByTestId('mock-pdf-doc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view in 3d/i })).toBeInTheDocument();
  });

  it('prefers exact match over fallback match when multiple suffixed procedures exist', async () => {
    useMapStore.setState({
      activeAirport: 'VIKG',
      activeAerodromeMetadata: { id: 'VIKG' },
      viewMode: 'TERMINAL',
    });

    (client.fetchCharts as any).mockResolvedValue([
      {
        chart_id: '30',
        chart_title: 'VIKG-RNP-Z-RWY-05.pdf',
        chart_url: 'u',
        chart_index: 'i',
      },
    ]);
    const mockProcedures = [
      { procedure_id: 101, name: 'VIKG-RNP-Y-RWY-05', chart_key: 'VIKG-RNP-Y-RWY-05' },
      { procedure_id: 102, name: 'VIKG-RNP-Z-RWY-05', chart_key: 'VIKG-RNP-Z-RWY-05' },
    ];
    (client.fetchRnpProcedures as any).mockResolvedValue(mockProcedures);

    act(() => {
      render(<AerodromeChartViewer icaoCode="VIKG" />);
    });

    await waitFor(() => {
      expect(screen.getByText('AERODROME CHARTS')).toBeInTheDocument();
    });
    act(() => {
      fireEvent.click(screen.getByText('AERODROME CHARTS'));
    });

    await waitFor(() => {
      expect(screen.getByText('VIKG-RNP-Z-RWY-05.pdf')).toBeInTheDocument();
    });

    const button = screen.getByText('VIKG-RNP-Z-RWY-05.pdf').closest('button');
    act(() => {
      fireEvent.click(button!);
    });

    expect(screen.getByTestId('mock-pdf-doc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view in 3d/i })).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /view in 3d/i }));
    });
    expect(useMapStore.getState().selectedRnpProcedureId).toEqual(102);
  });
});
