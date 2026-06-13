import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import MobileViewToggle from '../../features/map/controls/MobileViewToggle';
import { useMapStore } from '../../store/useMapStore';

describe('MobileViewToggle Component', () => {
  beforeEach(() => {
    useMapStore.setState({
      viewMode: 'ENROUTE',
      viewState: {
        zoom: 6,
        bearing: 45,
        pitch: 0,
        latitude: 0,
        longitude: 0,
        maxPitch: 85,
      },
      activeAirport: null,
      activeLayers: {
        ercMap: false,
      } as any,
      mapStyle: 'dark',
      selectedFeature: null,
    });
  });

  it('renders enroute controls in 2D enroute view mode', () => {
    const { getByTestId, queryByTestId } = render(<MobileViewToggle />);

    expect(getByTestId('mobile-view-toggle-pill')).toBeInTheDocument();
    expect(getByTestId('mobile-map-style-toggle')).toBeInTheDocument();
    expect(getByTestId('mobile-layer-toggle-ercMap')).toBeInTheDocument();
    expect(getByTestId('mobile-compass-toggle')).toBeInTheDocument();
    expect(getByTestId('mobile-zoom-in')).toBeInTheDocument();
    expect(getByTestId('mobile-zoom-out')).toBeInTheDocument();
    expect(queryByTestId('mobile-view-toggle-terminal')).not.toBeInTheDocument();
  });

  it('toggles map style cycle', () => {
    const { getByTestId } = render(<MobileViewToggle />);
    const styleToggleBtn = getByTestId('mobile-map-style-toggle');

    expect(useMapStore.getState().mapStyle).toBe('dark');
    fireEvent.click(styleToggleBtn);
    expect(useMapStore.getState().mapStyle).toBe('light');
    fireEvent.click(styleToggleBtn);
    expect(useMapStore.getState().mapStyle).toBe('hybrid');
    fireEvent.click(styleToggleBtn);
    expect(useMapStore.getState().mapStyle).toBe('dark');
  });

  it('toggles enroute chart (ercMap)', () => {
    const { getByTestId } = render(<MobileViewToggle />);
    const ercToggleBtn = getByTestId('mobile-layer-toggle-ercMap');

    expect(useMapStore.getState().activeLayers.ercMap).toBe(false);
    fireEvent.click(ercToggleBtn);
    expect(useMapStore.getState().activeLayers.ercMap).toBe(true);
    // Also tests Zoom transition if zoom is < 7
    expect(useMapStore.getState().viewState.zoom).toBe(7.5);
  });

  it('recenters compass to north (bearing 0)', () => {
    const { getByTestId } = render(<MobileViewToggle />);
    const compassBtn = getByTestId('mobile-compass-toggle');

    expect(useMapStore.getState().viewState.bearing).toBe(45);
    fireEvent.click(compassBtn);
    expect(useMapStore.getState().viewState.bearing).toBe(0);
  });

  it('zooms in and out using buttons', () => {
    const { getByTestId } = render(<MobileViewToggle />);
    const zoomInBtn = getByTestId('mobile-zoom-in');
    const zoomOutBtn = getByTestId('mobile-zoom-out');

    expect(useMapStore.getState().viewState.zoom).toBe(6);
    fireEvent.click(zoomInBtn);
    expect(useMapStore.getState().viewState.zoom).toBe(7);

    fireEvent.click(zoomOutBtn);
    expect(useMapStore.getState().viewState.zoom).toBe(6);
  });

  it('renders 2D/3D Cube in terminal mode', () => {
    useMapStore.setState({
      viewMode: 'TERMINAL',
      activeAirport: 'VIDD',
    });

    const { getByTestId, queryByTestId } = render(<MobileViewToggle />);

    expect(queryByTestId('mobile-view-toggle-pill')).not.toBeInTheDocument();
    expect(getByTestId('mobile-view-toggle-terminal')).toBeInTheDocument();
    expect(getByTestId('mobile-pitch-toggle')).toBeInTheDocument();
  });

  it('toggles map pitch when 2D/3D cube is clicked', () => {
    useMapStore.setState({
      viewMode: 'TERMINAL',
      activeAirport: 'VIDD',
      viewState: { pitch: 0 } as any,
    });

    const { getByTestId } = render(<MobileViewToggle />);
    const pitchBtn = getByTestId('mobile-pitch-toggle');

    expect(useMapStore.getState().viewState.pitch).toBe(0);
    fireEvent.click(pitchBtn);
    expect(useMapStore.getState().viewState.pitch).toBe(60);
    fireEvent.click(pitchBtn);
    expect(useMapStore.getState().viewState.pitch).toBe(0);
  });
});
