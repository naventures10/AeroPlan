import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { TerminalSpatialLayers } from '../../features/terminal/layers/TerminalSpatialLayers';
import { useMap } from 'react-map-gl/maplibre';
import { useRunwayPolygons } from '../../features/terminal/layers/useRunwayPolygons';

// Mock react-map-gl/maplibre
vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ children, id }: any) => <div data-testid={`source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`layer-${id}`} />,
  useMap: vi.fn(() => ({ current: null })),
}));

// Mock useRunwayPolygons
vi.mock('../../features/terminal/layers/useRunwayPolygons', () => ({
  useRunwayPolygons: vi.fn(() => ({ type: 'FeatureCollection', features: [] })),
}));

describe('TerminalSpatialLayers Component', () => {
  const mockMap = {
    hasImage: vi.fn().mockReturnValue(false),
    addImage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMap).mockReturnValue({ current: mockMap } as any);
    vi.mocked(useRunwayPolygons).mockReturnValue({ type: 'FeatureCollection', features: [] });
  });

  it('renders runway and spatial sources', () => {
    const { getByTestId } = render(<TerminalSpatialLayers />);

    expect(getByTestId('source-runway-polygons-source')).toBeInTheDocument();
    expect(getByTestId('source-spatial-features-source')).toBeInTheDocument();

    expect(getByTestId('layer-runway-fill')).toBeInTheDocument();
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

    expect(mockMap.addImage).toHaveBeenCalled();

    global.Image = originalImage;
  });

  it('skips loading existing icons', () => {
    mockMap.hasImage.mockReturnValue(true);
    render(<TerminalSpatialLayers />);

    expect(mockMap.addImage).not.toHaveBeenCalled();
  });
});
