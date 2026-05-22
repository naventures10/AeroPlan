import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AirspaceNotamsModal } from '../../features/notams/AirspaceNotamsModal';
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

describe('AirspaceNotamsModal', () => {
  const mockSetOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default store mock
    (useMapStore as any).mockImplementation((selector: any) => {
      const state = {
        isAirspaceNotamsModalOpen: true,
        setAirspaceNotamsModalOpen: mockSetOpen,
      };
      return selector(state);
    });
  });

  it('renders nothing if not open', () => {
    (useMapStore as any).mockImplementation((selector: any) => {
      const state = {
        isAirspaceNotamsModalOpen: false,
        setAirspaceNotamsModalOpen: mockSetOpen,
      };
      return selector(state);
    });

    const { container } = render(<AirspaceNotamsModal />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders loading state initially and then empty state if no data', async () => {
    (clientApi.fetchAirspaceNotams as any).mockResolvedValueOnce([]);

    render(<AirspaceNotamsModal />);

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
        description: 'TEST EN-ROUTE NOTAM',
      },
    ];
    (clientApi.fetchAirspaceNotams as any).mockResolvedValueOnce(mockData);

    render(<AirspaceNotamsModal />);

    await waitFor(() => {
      expect(screen.getByText('A1234/26')).toBeInTheDocument();
    });

    expect(screen.getByText('FIR: VOMF')).toBeInTheDocument();
    expect(screen.getByText('TEST EN-ROUTE NOTAM')).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', () => {
    (clientApi.fetchAirspaceNotams as any).mockResolvedValueOnce([]);
    render(<AirspaceNotamsModal />);

    const closeBtn = screen.getByLabelText('Close modal');
    fireEvent.click(closeBtn);

    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });
});
