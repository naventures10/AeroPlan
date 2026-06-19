import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MobileAipSupplementsModal } from '../../features/aip/mobile/MobileAipSupplementsModal';
import * as clientApi from '../../api/client';
import { useMapStore } from '../../store/useMapStore';

// Mock framer-motion
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => children,
    useDragControls: () => ({
      start: vi.fn(),
    }),
    motion: {
      div: ({ children, className, style, onClick }: any) => (
        <div className={className} style={style} onClick={onClick} data-testid="motion-div">
          {children}
        </div>
      ),
    },
  };
});

// Mock react-pdf
vi.mock('react-pdf', () => ({
  Document: ({ children, onLoadSuccess }: any) => {
    setTimeout(() => onLoadSuccess?.({ numPages: 2 }), 0);
    return <div data-testid="pdf-document">{children}</div>;
  },
  Page: () => <div data-testid="pdf-page" />,
  pdfjs: {
    GlobalWorkerOptions: { workerSrc: '' },
  },
}));

// Mock the API
vi.mock('../../api/client', () => ({
  fetchAipSupplements: vi.fn(),
  getProxyPdfUrl: (url: string) => `/proxy?url=${encodeURIComponent(url)}`,
}));

// Mock the store
vi.mock('../../store/useMapStore', () => ({
  useMapStore: vi.fn(),
}));

describe('MobileAipSupplementsModal', () => {
  const mockSetOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMapStore as any).mockImplementation((selector: any) => {
      const state = {
        isAipSupplementsModalOpen: true,
        setAipSupplementsModalOpen: mockSetOpen,
      };
      return selector(state);
    });
  });

  it('does not render when closed', () => {
    (useMapStore as any).mockImplementation((selector: any) => {
      const state = {
        isAipSupplementsModalOpen: false,
        setAipSupplementsModalOpen: mockSetOpen,
      };
      return selector(state);
    });
    const { container } = render(<MobileAipSupplementsModal />);
    expect(container.innerHTML).toBe('');
  });

  it('renders loading state initially and then empty state if no data', async () => {
    (clientApi.fetchAipSupplements as any).mockResolvedValueOnce([]);

    render(<MobileAipSupplementsModal />);

    expect(screen.getByText('AIP Supplements')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('No AIP supplements found.')).toBeInTheDocument();
    });
  });

  it('renders card items when supplements are fetched', async () => {
    const mockData = [
      {
        supplement_number: '10/2026',
        title: 'Test Supplement',
        pdf_link: 'http://example.com/test.pdf',
        effective_date: '01 Jan 2026',
        remarks: 'Test remark',
      },
    ];
    (clientApi.fetchAipSupplements as any).mockResolvedValueOnce(mockData);

    render(<MobileAipSupplementsModal />);

    await waitFor(() => {
      expect(screen.getByText('10/2026')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Supplement')).toBeInTheDocument();
    expect(screen.getByText('01 Jan 2026')).toBeInTheDocument();
    expect(screen.getByText('Test remark')).toBeInTheDocument();
    expect(screen.getByText('View PDF')).toBeInTheDocument();
  });

  it('switches to PDF viewer and allows going back to the list', async () => {
    const mockData = [
      {
        supplement_number: '11/2026',
        title: 'PDF Supplement',
        pdf_link: 'http://example.com/doc.pdf',
        effective_date: '15 Feb 2026',
        remarks: '',
      },
    ];
    (clientApi.fetchAipSupplements as any).mockResolvedValueOnce(mockData);

    render(<MobileAipSupplementsModal />);

    await waitFor(() => {
      expect(screen.getByText('View PDF')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('View PDF'));

    await waitFor(() => {
      expect(screen.getByTestId('pdf-document')).toBeInTheDocument();
    });

    expect(screen.getByText('Supplement Document')).toBeInTheDocument();

    // Click back button
    const backBtn = screen.getByLabelText('Back to supplements list');
    fireEvent.click(backBtn);

    // List view should be active again
    expect(screen.queryByTestId('pdf-document')).not.toBeInTheDocument();
    expect(screen.getByText('AIP Supplements')).toBeInTheDocument();
  });
});
