import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import LayerToolbar from '../../features/map/controls/LayerToolbar';
import { useMapStore } from '../../store/useMapStore';

describe('LayerToolbar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and toggles layers', () => {
    const toggleLayerMock = vi.fn();
    useMapStore.setState({
      activeLayers: {
        aerodromes: true,
        waypoints: false,
        navaids: false,
        atsRoutes: false,
        airspaces: false,
      } as any,
      toggleLayer: toggleLayerMock,
    });

    render(<LayerToolbar />);

    const button = screen.getByTitle('Toggle aerodromes');
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(toggleLayerMock).toHaveBeenCalledWith('aerodromes');
  });
});
