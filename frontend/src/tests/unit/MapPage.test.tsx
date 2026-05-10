import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapPage from '../../pages/MapPage';

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
vi.mock('../../features/map/controls/WeatherControls', () => ({
  WeatherControls: () => <div data-testid="weather-controls-mock" />,
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

describe('MapPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useMapStore as any).mockReturnValue({
      viewMode: 'ENROUTE',
      activeAirport: null,
      viewState: { pitch: 0 },
      isWindMode: false,
      isCloudMode: false,
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
  });

  it('renders global loader implicitly during suspense', async () => {
    act(() => {
      render(<MapPage />);
    });
    // Check for loader during suspense
    expect(screen.getByTestId('global-loader-mock')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('map-view-mock')).toBeInTheDocument();
    });
  });

  it('renders map view correctly', async () => {
    act(() => {
      render(<MapPage />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('map-view-mock')).toBeInTheDocument();
      expect(screen.getByTestId('search-bar-mock')).toBeInTheDocument();
      expect(screen.getByTestId('layer-toolbar-mock')).toBeInTheDocument();
      expect(screen.getByTestId('view-toggle-mock')).toBeInTheDocument();
    });
  });

  it('renders terminal dashboard and charts when aerodrome selected in terminal mode', async () => {
    (useMapStore as any).mockReturnValue({
      viewMode: 'TERMINAL',
      activeAirport: 'VOBM',
      viewState: { pitch: 60 },
      isWindMode: false,
      isCloudMode: false,
    });

    act(() => {
      render(<MapPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('terminal-dashboard-mock')).toBeInTheDocument();
      expect(screen.getByTestId('aerodrome-chart-mock')).toBeInTheDocument();
      expect(screen.getByTestId('aerodrome-dropdown-mock')).toBeInTheDocument();
    });
  });

  it('renders terminal view elements correctly when pitch > 0 but viewMode is ENROUTE', async () => {
    (useMapStore as any).mockReturnValue({
      viewMode: 'ENROUTE',
      activeAirport: 'VOBM',
      viewState: { pitch: 60 },
      isWindMode: false,
      isCloudMode: false,
    });

    act(() => {
      render(<MapPage />);
    });

    await waitFor(() => {
      // Aerodrome is active so dropdown appears
      expect(screen.getByTestId('aerodrome-dropdown-mock')).toBeInTheDocument();
      // Pitch > 0 and activeAirport exists, so dashboard appears
      expect(screen.getByTestId('terminal-dashboard-mock')).toBeInTheDocument();
    });
  });

  it('renders section modal', async () => {
    const defaultData = {
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
    };
    (useAerodromeData as any).mockReturnValue({
      ...defaultData,
      sectionModalOpen: true,
    });

    act(() => {
      render(<MapPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('section-modal-mock')).toBeInTheDocument();
    });
  });

  it('renders weather controls when in wind mode', async () => {
    (useMapStore as any).mockReturnValue({
      viewMode: 'ENROUTE',
      activeAirport: null,
      viewState: { pitch: 0 },
      isWindMode: true,
      isCloudMode: false,
    });

    act(() => {
      render(<MapPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('weather-controls-mock')).toBeInTheDocument();
    });
  });
});
