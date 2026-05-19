import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import LayerToolbar from '../../features/map/controls/LayerToolbar';
import { useMapStore } from '../../store/useMapStore';

describe('LayerToolbar Component', () => {
  beforeEach(() => {
    useMapStore.setState({
      activeLayers: {
        aerodromes: true,
        waypoints: false,
        navaids: false,
        atsRoutes: false,
        airspaces: false,
        weather: false,
      } as any,
    });
  });

  it('renders all toggle buttons with correct titles', () => {
    const { getByRole } = render(<LayerToolbar />);

    expect(getByRole('button', { name: 'Toggle Aerodromes' })).toBeInTheDocument();
    expect(getByRole('button', { name: 'Toggle Waypoints' })).toBeInTheDocument();
    expect(getByRole('button', { name: 'Toggle NavAids' })).toBeInTheDocument();
    expect(getByRole('button', { name: 'Toggle ATS Routes' })).toBeInTheDocument();
    expect(getByRole('button', { name: 'Toggle Airspaces' })).toBeInTheDocument();
    expect(getByRole('button', { name: 'Toggle Weather' })).toBeInTheDocument();
  });

  it('toggles a layer when clicked', () => {
    const { getByRole } = render(<LayerToolbar />);
    const button = getByRole('button', { name: 'Toggle Waypoints' });

    fireEvent.click(button);

    expect(useMapStore.getState().activeLayers.waypoints).toBe(true);
  });

  it('renders the menu button and invokes onMenuClick when clicked', () => {
    const onMenuClick = vi.fn();
    const { container } = render(<LayerToolbar onMenuClick={onMenuClick} />);
    const menuButton = container.querySelector('.aip-icon-menu')?.closest('button');

    expect(menuButton).toBeInTheDocument();
    if (menuButton) {
      fireEvent.click(menuButton);
    }
    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });
});
