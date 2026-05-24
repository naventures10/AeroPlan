import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AipSupplementsModal from '../../features/aip/AipSupplementsModal';
import * as clientApi from '../../api/client';
import { useMapStore } from '../../store/useMapStore';

// Mock framer-motion
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => children,
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
    // Automatically trigger onLoadSuccess with 2 pages when rendered
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

describe('AipSupplementsModal', () => {
  const mockSetOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default store state: modal is OPEN
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
    const { container } = render(<AipSupplementsModal />);
    expect(container.innerHTML).toBe('');
  });

  it('renders loading state initially and then empty state if no data', async () => {
    (clientApi.fetchAipSupplements as any).mockResolvedValueOnce([]);

    render(<AipSupplementsModal />);

    // Header should be present
    expect(screen.getByText('AIP Supplements')).toBeInTheDocument();

    // Wait for the empty state
    await waitFor(() => {
      expect(screen.getByText('No AIP supplements found.')).toBeInTheDocument();
    });
  });

  it('renders table data when data is returned', async () => {
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

    render(<AipSupplementsModal />);

    await waitFor(() => {
      expect(screen.getByText('10/2026')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Supplement')).toBeInTheDocument();
    expect(screen.getByText('01 Jan 2026')).toBeInTheDocument();
    expect(screen.getByText('Test remark')).toBeInTheDocument();
    expect(screen.getByText('View PDF')).toBeInTheDocument();
  });

  it('switches to PDF viewer when View PDF is clicked', async () => {
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

    render(<AipSupplementsModal />);

    await waitFor(() => {
      expect(screen.getByText('View PDF')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('View PDF'));
    // Document component should be rendered
    expect(screen.getByTestId('pdf-document')).toBeInTheDocument();
  });
});
