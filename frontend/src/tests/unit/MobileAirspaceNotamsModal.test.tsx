import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MobileAirspaceNotamsModal } from '../../features/aip/mobile/MobileAirspaceNotamsModal';
import * as clientApi from '../../api/client';
import { useMapStore } from '../../store/useMapStore';

// Mock the API
vi.mock('../../api/client', () => ({
  fetchAirspaceNotams: vi.fn(),
}));

// Mock the store
vi.mock('../../store/useMapStore', () => ({
  useMapStore: vi.fn(),
}));

describe('MobileAirspaceNotamsModal', () => {
  const mockSetOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default store mock
    (useMapStore as any).mockImplementation((selector: any) => {
      const state = {
        isAirspaceNotamsModalOpen: true,
        setAirspaceNotamsModalOpen: mockSetOpen,
        viewMode: 'ENROUTE',
        viewState: { pitch: 0 },
      };
      return selector(state);
    });
  });

  it('renders nothing if not open', () => {
    (useMapStore as any).mockImplementation((selector: any) => {
      const state = {
        isAirspaceNotamsModalOpen: false,
        setAirspaceNotamsModalOpen: mockSetOpen,
        viewMode: 'ENROUTE',
        viewState: { pitch: 0 },
      };
      return selector(state);
    });

    const { container } = render(<MobileAirspaceNotamsModal />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders loading state initially and then empty state if no data', async () => {
    (clientApi.fetchAirspaceNotams as any).mockResolvedValueOnce([]);

    render(<MobileAirspaceNotamsModal />);

    // Header should be present
    expect(screen.getByText('Enroute Notams')).toBeInTheDocument();

    // Wait for empty state
    await waitFor(() => {
      expect(screen.getByText('No matching NOTAMs found.')).toBeInTheDocument();
    });
  });

  it('fetches and renders NOTAMs successfully', async () => {
    const mockData = [
      {
        notam_id: 'A1234/26',
        fir: 'VOMF',
        valid_from: '2026-01-01T00:00:00Z',
        is_permanent: false,
        valid_to: '2026-01-31T23:59:00Z',
        description: 'TEST MOBILE EN-ROUTE NOTAM',
      },
    ];
    (clientApi.fetchAirspaceNotams as any).mockResolvedValueOnce(mockData);

    render(<MobileAirspaceNotamsModal />);

    await waitFor(() => {
      expect(screen.getByText('A1234/26')).toBeInTheDocument();
    });

    expect(screen.getByText('FIR: VOMF')).toBeInTheDocument();
    expect(screen.getByText('TEST MOBILE EN-ROUTE NOTAM')).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', () => {
    (clientApi.fetchAirspaceNotams as any).mockResolvedValueOnce([]);
    render(<MobileAirspaceNotamsModal />);

    const closeBtn = screen.getByLabelText('Close modal');
    fireEvent.click(closeBtn);

    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  it('filters NOTAMs by search query', async () => {
    const mockData = [
      {
        notam_id: 'A1111/26',
        fir: 'VOMF',
        valid_from: '2026-01-01T00:00:00Z',
        is_permanent: true,
        valid_to: null,
        description: 'RUNWAY CLOSED',
      },
      {
        notam_id: 'B2222/26',
        fir: 'VECF',
        valid_from: '2026-01-01T00:00:00Z',
        is_permanent: true,
        valid_to: null,
        description: 'OBSTACLE ERECTED',
      },
    ];
    (clientApi.fetchAirspaceNotams as any).mockResolvedValueOnce(mockData);

    render(<MobileAirspaceNotamsModal />);

    await waitFor(() => {
      expect(screen.getByText('A1111/26')).toBeInTheDocument();
    });
    expect(screen.getByText('B2222/26')).toBeInTheDocument();

    // Type 'runway' into search input
    const searchInput = screen.getByPlaceholderText('Search by ID, FIR, or keyword...');
    fireEvent.change(searchInput, { target: { value: 'runway' } });

    expect(screen.getByText('A1111/26')).toBeInTheDocument();
    expect(screen.queryByText('B2222/26')).not.toBeInTheDocument();
  });
});
