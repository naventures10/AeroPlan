import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import MapView from '../features/map/MapView';
import { useMapStore, TERMINAL_EXIT_ZOOM_THRESHOLD } from '../store/useMapStore';

// Mock DeckGL and React Map GL
vi.mock('@deck.gl/react', () => ({
  default: ({ children, onViewStateChange, onClick, onHover }: any) => (
    <div
      data-testid="mock-deckgl"
      onClick={(e) => onClick?.({ x: 10, y: 10, layer: { id: 'test', props: { onClick: vi.fn() } }, object: { properties: { id: 1 } } }, e)}
      onMouseOver={(e) => onHover?.({ x: 10, y: 10 })}
    >
      <button data-testid="deckgl-vs-change" onClick={() => onViewStateChange?.({ viewState: { zoom: 2, pitch: 0 }, interactionState: { isZooming: true } })} />
      {children}
    </div>
  ),
  DeckGL: ({ children }: any) => <div data-testid="mock-deckgl">{children}</div>
}));

vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children, onLoad }: any) => (
    <div data-testid="mock-map">
      <button data-testid="map-load" onClick={() => onLoad({ target: { getStyle: () => ({ layers: [{ id: 'road', type: 'symbol' }] }), setLayerZoomRange: vi.fn() } })} />
      {children}
    </div>
  ),
  Source: ({ children }: any) => <div data-testid="mock-source">{children}</div>,
  Layer: ({ children }: any) => <div data-testid="mock-layer">{children}</div>,
}));

// Mock sub-components
vi.mock('../features/map/HoveredDeckGL', () => ({
  HoveredDeckGL: () => <div data-testid="mock-hovered-deckgl" />
}));

vi.mock('../features/map/InterleavedDeckGL', () => ({
  InterleavedDeckGL: ({ onOverlayCreated }: any) => (
    <div data-testid="mock-interleaved-deckgl">
      <button data-testid="overlay-create" onClick={() => onOverlayCreated({ pickObject: vi.fn(() => ({ layer: { props: { onClick: vi.fn() } }, object: { entry_waypoint: 'A1' } })) })} />
    </div>
  )
}));

vi.mock('../features/map/FeatureInfoCard', () => ({
  FeatureInfoCard: () => <div data-testid="mock-feature-info-card" />
}));

vi.mock('../features/map/tooltips/useMapTooltip', () => ({
  useMapTooltip: () => vi.fn()
}));

vi.mock('../features/map/layers/useDeckLayers', () => ({
  useDeckLayers: () => ({ overlaidLayers: [], interleavedLayers: [{ id: 'i1' }] })
}));

describe('MapView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMapStore.setState({
      viewState: { zoom: 10, longitude: 0, latitude: 0, pitch: 0, bearing: 0, maxPitch: 60 } as any,
      activeLayers: { wacMap: true, ercMap: true } as any,
      viewMode: 'ENROUTE',
      activeAirport: null,
      boundsToFit: null,
      setViewState: vi.fn(),
      setViewMode: vi.fn(),
      setActiveAirport: vi.fn(),
      setSelectedFeature: vi.fn(),
      setHighlightedAirspaceId: vi.fn(),
      fitBounds: vi.fn(),
    });
  });

  it('renders and handles map load', async () => {
    const { getByTestId } = render(
      <MapView aerodromes={[]} onAerodromeClick={vi.fn()} />
    );
    expect(getByTestId('mock-deckgl')).toBeInTheDocument();

    // Simulate map load
    act(() => {
      fireEvent.click(getByTestId('map-load'));
    });
  });

  it('handles view state change and zoom out logic', () => {
    const setViewModeMock = vi.fn();
    const setActiveAirportMock = vi.fn();
    const setViewStateMock = vi.fn();

    useMapStore.setState({
      viewMode: 'TERMINAL',
      activeAirport: 'VAAU',
      setViewMode: setViewModeMock,
      setActiveAirport: setActiveAirportMock,
      setViewState: setViewStateMock
    });

    const { getByTestId } = render(
      <MapView aerodromes={[]} onAerodromeClick={vi.fn()} />
    );

    // Simulate zoom out via DeckGL onViewStateChange with interactionState = isZooming
    act(() => {
      fireEvent.click(getByTestId('deckgl-vs-change'));
    });

    expect(setViewModeMock).toHaveBeenCalledWith('ENROUTE');
    expect(setActiveAirportMock).toHaveBeenCalledWith(null);
    expect(setViewStateMock).toHaveBeenCalledWith(expect.objectContaining({ zoom: 2, pitch: 0 }));
  });

  it('handles click events', () => {
    const setSelectedFeatureMock = vi.fn();
    const setHighlightedAirspaceIdMock = vi.fn();
    useMapStore.setState({
      setSelectedFeature: setSelectedFeatureMock,
      setHighlightedAirspaceId: setHighlightedAirspaceIdMock
    });

    const { getByTestId } = render(
      <MapView aerodromes={[]} onAerodromeClick={vi.fn()} />
    );

    act(() => {
      fireEvent.click(getByTestId('mock-deckgl'));
    });

    // The mock click triggers layer.props.onClick
  });

  it('handles overlay creation and hover', () => {
    const { getByTestId } = render(
      <MapView aerodromes={[]} onAerodromeClick={vi.fn()} />
    );

    // Interleaved layers passes onOverlayCreated
    act(() => {
      fireEvent.click(getByTestId('overlay-create'));
    });

    // Hover
    act(() => {
      fireEvent.mouseOver(getByTestId('mock-deckgl'));
    });
  });

  it('handles fitBounds', () => {
    useMapStore.setState({ boundsToFit: [0, 0, 10, 10] });

    render(<MapView aerodromes={[]} onAerodromeClick={vi.fn()} />);
    // WebMercatorViewport is mocked or fails in JSDOM often, but it's handled in try/catch in component
  });

  it('handles FLY transition', () => {
    useMapStore.setState({ viewState: { transitionType: 'FLY' } as any });
    render(<MapView aerodromes={[]} onAerodromeClick={vi.fn()} />);
  });

  it('handles TERMINAL mode rendering', () => {
    useMapStore.setState({ viewMode: 'TERMINAL' });
    render(<MapView aerodromes={[]} onAerodromeClick={vi.fn()} />);
    // Terminal mode renders spatial features
  });
});
