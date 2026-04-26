import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ViewToggle from '../../features/map/controls/ViewToggle';
import { useMapStore } from '../../store/useMapStore';

describe('ViewToggle Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and toggles mode', () => {
    const setViewStateMock = vi.fn();
    useMapStore.setState({
      viewMode: 'ENROUTE',
      viewState: { pitch: 0 } as any,
      activeLayers: {} as any,
      setViewState: setViewStateMock,
      activeAirport: 'VAAU',
    });

    render(<ViewToggle />);

    // In Terminal/Active airport view, a cube with "2D" and "3D" is visible
    expect(screen.getByText('2D')).toBeInTheDocument();

    const toggleButton = screen.getByTitle('Toggle View Mode');
    fireEvent.click(toggleButton);

    expect(setViewStateMock).toHaveBeenCalledWith(expect.objectContaining({ pitch: 60 }));
  });

  it('handles map layers menu correctly', () => {
    const toggleLayerMock = vi.fn();
    useMapStore.setState({
      viewMode: 'ENROUTE',
      viewState: { pitch: 0, zoom: 5 } as any,
      activeLayers: { wacMap: false, ercMap: false } as any,
      toggleLayer: toggleLayerMock,
      activeAirport: null,
    });

    render(<ViewToggle />);

    const toggleButton = screen.getByTitle('Map Overlays');
    act(() => {
      fireEvent.click(toggleButton);
    });

    expect(screen.getByText('World Aeronautical Chart')).toBeInTheDocument();

    const wacButton = screen.getByText('World Aeronautical Chart').closest('button');
    act(() => {
      fireEvent.click(wacButton!);
    });

    expect(toggleLayerMock).toHaveBeenCalledWith('wacMap');
  });

  it('closes menu when clicking outside', () => {
    useMapStore.setState({
      viewMode: 'ENROUTE',
      viewState: { pitch: 0, zoom: 5 } as any,
      activeLayers: { wacMap: false, ercMap: false } as any,
      activeAirport: null,
    });

    render(<ViewToggle />);

    const toggleButton = screen.getByTitle('Map Overlays');
    act(() => {
      fireEvent.click(toggleButton);
    });

    // Verify menu is open
    expect(screen.getByText('World Aeronautical Chart').closest('.absolute')).toHaveClass(
      'opacity-100',
    );

    act(() => {
      fireEvent.mouseDown(document.body);
    });

    // Verify menu is closed (hidden via opacity)
    expect(screen.getByText('World Aeronautical Chart').closest('.absolute')).toHaveClass(
      'opacity-0',
    );
  });
});
