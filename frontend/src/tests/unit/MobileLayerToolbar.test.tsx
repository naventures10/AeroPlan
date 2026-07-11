import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import MobileLayerToolbar from '../../features/map/controls/mobile/MobileLayerToolbar';
import { useMapStore } from '../../store/useMapStore';

describe('MobileLayerToolbar Component', () => {
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
      isWeatherMode: false,
    });
  });

  it('renders menu trigger and all layers dock buttons', () => {
    const { getByRole, getByTestId } = render(<MobileLayerToolbar />);

    expect(getByTestId('mobile-menu-trigger')).toBeInTheDocument();
    expect(getByRole('button', { name: 'Toggle Aerodromes' })).toBeInTheDocument();
    expect(getByRole('button', { name: 'Toggle Waypoints' })).toBeInTheDocument();
    expect(getByRole('button', { name: 'Toggle NavAids' })).toBeInTheDocument();
    expect(getByRole('button', { name: 'Toggle ATS Routes' })).toBeInTheDocument();
    expect(getByRole('button', { name: 'Toggle Airspaces' })).toBeInTheDocument();
    expect(getByRole('button', { name: 'Toggle Weather' })).toBeInTheDocument();
  });

  it('toggles map layers when buttons are clicked', () => {
    const { getByRole } = render(<MobileLayerToolbar />);
    const waypointsBtn = getByRole('button', { name: 'Toggle Waypoints' });

    expect(useMapStore.getState().activeLayers.waypoints).toBe(false);
    fireEvent.click(waypointsBtn);
    expect(useMapStore.getState().activeLayers.waypoints).toBe(true);
  });

  it('toggles weather mode when weather button is clicked', () => {
    const { getByRole } = render(<MobileLayerToolbar />);
    const weatherBtn = getByRole('button', { name: 'Toggle Weather' });

    expect(useMapStore.getState().isWeatherMode).toBe(false);
    fireEvent.click(weatherBtn);
    expect(useMapStore.getState().isWeatherMode).toBe(true);
  });

  it('toggles the menu drawer when menu trigger is clicked', () => {
    const { getByTestId } = render(<MobileLayerToolbar />);
    const menuTrigger = getByTestId('mobile-menu-trigger');

    expect(menuTrigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(menuTrigger);
    expect(menuTrigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(menuTrigger);
    expect(menuTrigger).toHaveAttribute('aria-expanded', 'false');
  });
});
