import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { TerminalSpatialLayers } from '../../features/terminal/layers/terminal/TerminalSpatialLayers';
import { useMap } from 'react-map-gl/maplibre';
import { useRunwayPolygons } from '../../features/terminal/layers/terminal/useRunwayPolygons';
import { TERMINAL_ICONS } from '../../features/terminal/layers/terminal/icons';

// Mock react-map-gl/maplibre
vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ children, id }: any) => <div data-testid={`source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`layer-${id}`} />,
  useMap: vi.fn(() => ({ current: null })),
}));

// Mock useRunwayPolygons
vi.mock('../../features/terminal/layers/terminal/useRunwayPolygons', () => ({
  useRunwayPolygons: vi.fn(() => ({
    polygons: { type: 'FeatureCollection', features: [] },
    labels: { type: 'FeatureCollection', features: [] },
  })),
}));

describe('TerminalSpatialLayers Component', () => {
  const mockMap = {
    hasImage: vi.fn().mockReturnValue(false),
    addImage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMap).mockReturnValue({ current: mockMap } as any);
    vi.mocked(useRunwayPolygons).mockReturnValue({
      polygons: { type: 'FeatureCollection', features: [] },
      labels: { type: 'FeatureCollection', features: [] },
    });
  });

  it('renders runway and spatial sources', () => {
    const { getByTestId } = render(<TerminalSpatialLayers />);

    expect(getByTestId('source-runway-polygons-source')).toBeInTheDocument();
    expect(getByTestId('source-runway-labels-source')).toBeInTheDocument();
    expect(getByTestId('source-spatial-features-source')).toBeInTheDocument();

    expect(getByTestId('layer-runway-fill')).toBeInTheDocument();
    expect(getByTestId('layer-runway-threshold-labels')).toBeInTheDocument();
    expect(getByTestId('layer-mvt-polygons')).toBeInTheDocument();
    expect(getByTestId('layer-mvt-points')).toBeInTheDocument();
  });

  it('loads icons into map on mount', () => {
    // We need to trigger onload on the images created in useEffect
    const originalImage = global.Image;
    const mockImages: any[] = [];

    global.Image = class {
      onload: any;
      src: string = '';
      constructor() {
        mockImages.push(this);
      }
    } as any;

    render(<TerminalSpatialLayers />);

    // Trigger onload for all created images
    mockImages.forEach((img) => img.onload());

    expect(mockMap.addImage).toHaveBeenCalledTimes(Object.keys(TERMINAL_ICONS).length);

    global.Image = originalImage;
  });

  it('skips loading existing icons', () => {
    mockMap.hasImage.mockReturnValue(true);
    render(<TerminalSpatialLayers />);

    expect(mockMap.addImage).not.toHaveBeenCalled();
  });
});
