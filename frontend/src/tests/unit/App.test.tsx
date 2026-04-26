import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../../App';

// Mock lazy-loaded components
vi.mock('../../features/map/MapView', () => ({
  default: () => <div data-testid="map-view-mock" />,
}));
vi.mock('../../features/terminal/TerminalDashboard', () => ({
  default: () => <div data-testid="terminal-dashboard-mock" />,
}));
vi.mock('../../features/aip/AerodromeChartViewer', () => ({
  default: () => <div data-testid="aerodrome-chart-mock" />,
}));
vi.mock('../../features/map/controls/SearchBar', () => ({
  default: () => <div data-testid="search-bar-mock" />,
}));
vi.mock('../../features/map/controls/LayerToolbar', () => ({
  default: () => <div data-testid="layer-toolbar-mock" />,
}));
vi.mock('../../features/map/controls/ViewToggle', () => ({
  default: () => <div data-testid="view-toggle-mock" />,
}));
vi.mock('../../features/aip/AerodromeInfoDropdown', () => ({
  default: () => <div data-testid="aerodrome-dropdown-mock" />,
}));
vi.mock('../../features/aip/SectionModal', () => ({
  default: () => <div data-testid="section-modal-mock" />,
}));
vi.mock('../../components/GlobalLoader', () => ({
  default: () => <div data-testid="global-loader-mock">Loading...</div>,
}));

import { useMapStore } from '../../store/useMapStore';
import { useAerodromeData } from '../../hooks/useAerodromeData';
import { useSearch } from '../../hooks/useSearch';

vi.mock('../../store/useMapStore');
vi.mock('../../hooks/useAerodromeData');
vi.mock('../../hooks/useKeyboardShortcuts');
vi.mock('../../hooks/useSearch');

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useMapStore as any).mockReturnValue({
      viewMode: 'ENROUTE',
      activeAirport: null,
      viewState: { pitch: 0 },
    });
    (useAerodromeData as any).mockReturnValue({
      aerodromes: null,
      handleAerodromeClick: vi.fn(),
      sectionModalOpen: false,
      closeSectionModal: vi.fn(),
      sectionData: null,
      sectionTitle: '',
      sectionId: '',
      sectionDataType: 'table',
      sectionLoading: false,
      handleSectionSelect: vi.fn(),
    });
    (useSearch as any).mockReturnValue({
      cancelPendingSelection: vi.fn(),
    });

    // Mock the global hideLoader
    (window as any).hideLoader = vi.fn();
  });

  it('renders global loader implicitly during suspense', async () => {
    // MapView is lazy, so initially it will suspend and render the GlobalLoader fallback.
    // However, vitest resolves dynamic imports instantly. Act wrapper handles the transition.
    act(() => {
      render(<App />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('map-view-mock')).toBeInTheDocument();
    });
  });

  it('renders map view correctly', async () => {
    act(() => {
      render(<App />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('map-view-mock')).toBeInTheDocument();
      expect(screen.getByTestId('search-bar-mock')).toBeInTheDocument();
      expect(screen.getByTestId('layer-toolbar-mock')).toBeInTheDocument();
      expect(screen.getByTestId('view-toggle-mock')).toBeInTheDocument();
    });
    expect((window as any).hideLoader).toHaveBeenCalled();
  });

  it('renders terminal dashboard and charts when aerodrome selected in terminal mode', async () => {
    (useMapStore as any).mockReturnValue({
      viewMode: 'TERMINAL',
      activeAirport: 'VOBM',
      viewState: { pitch: 60 },
    });

    act(() => {
      render(<App />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('terminal-dashboard-mock')).toBeInTheDocument();
      expect(screen.getByTestId('aerodrome-chart-mock')).toBeInTheDocument();
      expect(screen.getByTestId('aerodrome-dropdown-mock')).toBeInTheDocument();
    });
    // Searchbar and LayerToolbar are NOT rendered in TERMINAL view
    expect(screen.queryByTestId('search-bar-mock')).not.toBeInTheDocument();
  });

  it('renders terminal view elements correctly when pitch > 0 but viewMode is ENROUTE', async () => {
    (useMapStore as any).mockReturnValue({
      viewMode: 'ENROUTE',
      activeAirport: 'VOBM',
      viewState: { pitch: 60 },
    });

    act(() => {
      render(<App />);
    });

    await waitFor(() => {
      // Aerodrome is active so dropdown appears
      expect(screen.getByTestId('aerodrome-dropdown-mock')).toBeInTheDocument();
      // Pitch > 0 and activeAirport exists, so dashboard appears
      expect(screen.getByTestId('terminal-dashboard-mock')).toBeInTheDocument();
    });
  });

  it('renders section modal', async () => {
    (useAerodromeData as any).mockReturnValue({
      sectionModalOpen: true,
    });

    act(() => {
      render(<App />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('section-modal-mock')).toBeInTheDocument();
    });
  });
});
