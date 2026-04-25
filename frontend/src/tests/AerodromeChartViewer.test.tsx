import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import AerodromeChartViewer from '../features/aip/AerodromeChartViewer';
import { useMapStore } from '../store/useMapStore';
import * as client from '../api/client';

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
  Document: ({ children }: any) => <div data-testid="mock-pdf-doc">{children}</div>,
  Page: () => <div data-testid="mock-pdf-page">Page</div>
}));

vi.mock('../api/client', () => ({
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
      button: ({ children, className, onClick }: any) => <button className={className} onClick={onClick}>{children}</button>
    }
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
      viewMode: 'TERMINAL'
    });

    (client.fetchCharts as any).mockResolvedValue([{ chart_id: '1', chart_title: 'ChartTitle', chart_url: 'u', chart_index: 'i' }]);
    (client.fetchRnpProcedures as any).mockResolvedValue([{ procedure_id: 1, chart_key: 'CHARTTITLE' }]);

    await act(async () => {
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
  });
});
