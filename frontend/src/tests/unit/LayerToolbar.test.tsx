import { describe, it, expect, beforeEach } from 'vitest';
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

  it('renders the menu button and toggles the drawer on click', () => {
    const { container } = render(<LayerToolbar />);
    const menuButton = container.querySelector('#aip-menu-toggle-btn');

    expect(menuButton).toBeInTheDocument();
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    if (menuButton) fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    if (menuButton) fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });
});
