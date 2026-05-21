import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ViewToggle from '../../features/map/controls/ViewToggle';
import { useMapStore } from '../../store/useMapStore';

describe('ViewToggle Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and toggles mode when activeAirport is present', () => {
    const setViewStateMock = vi.fn();
    useMapStore.setState({
      viewMode: 'ENROUTE',
      viewState: { pitch: 0 } as any,
      activeLayers: {} as any,
      setViewState: setViewStateMock,
      activeAirport: 'VAAU',
    });

    render(<ViewToggle />);

    // In Terminal/Active airport view, the 2D/3D toggle cube is visible
    expect(screen.getByText('2D')).toBeInTheDocument();

    const toggleButton = screen.getByTitle('Toggle View Mode');
    fireEvent.click(toggleButton);

    expect(setViewStateMock).toHaveBeenCalledWith(expect.objectContaining({ pitch: 60 }));
  });

  it('handles zoom operations correctly in enroute view', () => {
    const setViewStateMock = vi.fn();
    useMapStore.setState({
      viewMode: 'ENROUTE',
      viewState: { zoom: 10, bearing: 15 } as any,
      activeLayers: {} as any,
      setViewState: setViewStateMock,
      activeAirport: null,
    });

    render(<ViewToggle />);

    // Zoom In
    const zoomInBtn = screen.getByTitle('Zoom In');
    fireEvent.click(zoomInBtn);
    expect(setViewStateMock).toHaveBeenCalledWith(expect.objectContaining({ zoom: 11 }));

    // Zoom Out
    const zoomOutBtn = screen.getByTitle('Zoom Out');
    fireEvent.click(zoomOutBtn);
    expect(setViewStateMock).toHaveBeenCalledWith(expect.objectContaining({ zoom: 9 }));
  });

  it('handles compass bearing recentering correctly in enroute view', () => {
    const setViewStateMock = vi.fn();
    useMapStore.setState({
      viewMode: 'ENROUTE',
      viewState: { zoom: 10, bearing: 15 } as any,
      activeLayers: {} as any,
      setViewState: setViewStateMock,
      activeAirport: null,
    });

    render(<ViewToggle />);

    const recenterBtn = screen.getByTitle('Recenter to North');
    fireEvent.click(recenterBtn);
    expect(setViewStateMock).toHaveBeenCalledWith(
      expect.objectContaining({ bearing: 0, transitionType: 'LINEAR' }),
    );
  });

  it('handles base map style selection correctly through cycling', () => {
    const setMapStyleMock = vi.fn((style) => {
      useMapStore.setState({ mapStyle: style });
    });
    useMapStore.setState({
      viewMode: 'ENROUTE',
      viewState: { zoom: 10, bearing: 0 } as any,
      activeLayers: {} as any,
      mapStyle: 'dark',
      setMapStyle: setMapStyleMock,
      activeAirport: null,
    });

    render(<ViewToggle />);

    const baseMapCycleBtn = screen.getByTitle('Change Base Map');

    // Click to cycle (should cycle from dark to light)
    fireEvent.click(baseMapCycleBtn);
    expect(setMapStyleMock).toHaveBeenCalledWith('light');

    // Simulate store update
    useMapStore.setState({ mapStyle: 'light' });
    fireEvent.click(baseMapCycleBtn);
    expect(setMapStyleMock).toHaveBeenCalledWith('hybrid');

    // Simulate store update
    useMapStore.setState({ mapStyle: 'hybrid' });
    fireEvent.click(baseMapCycleBtn);
    expect(setMapStyleMock).toHaveBeenCalledWith('dark');
  });

  it('handles map overlay toggle', () => {
    const toggleLayerMock = vi.fn();
    useMapStore.setState({
      viewMode: 'ENROUTE',
      viewState: { zoom: 10, bearing: 0 } as any,
      activeLayers: { ercMap: false } as any,
      toggleLayer: toggleLayerMock,
      activeAirport: null,
    });

    render(<ViewToggle />);

    const ercBtn = screen.getByTitle('Toggle Enroute Chart');
    fireEvent.click(ercBtn);
    expect(toggleLayerMock).toHaveBeenCalledWith('ercMap');
  });

  it('updates the viewState zoom correctly via the range slider input', () => {
    const setViewStateMock = vi.fn();
    useMapStore.setState({
      viewMode: 'ENROUTE',
      viewState: { zoom: 10, bearing: 0 } as any,
      activeLayers: {} as any,
      setViewState: setViewStateMock,
      activeAirport: null,
    });

    render(<ViewToggle />);

    const slider = screen.getByLabelText('Zoom Level');
    fireEvent.change(slider, { target: { value: '15.5' } });

    expect(setViewStateMock).toHaveBeenCalledWith(
      expect.objectContaining({ zoom: 15.5, transitionDuration: 0 }),
    );
  });
});
