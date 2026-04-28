import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
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
        windlayer: false,
      } as any,
    });
  });

  it('renders all toggle buttons with correct titles', () => {
    const { getByTitle } = render(<LayerToolbar />);

    expect(getByTitle('Toggle aerodromes')).toBeInTheDocument();
    expect(getByTitle('Toggle waypoints')).toBeInTheDocument();
    expect(getByTitle('Toggle navaids')).toBeInTheDocument();
    expect(getByTitle('Toggle atsRoutes')).toBeInTheDocument();
    expect(getByTitle('Toggle airspaces')).toBeInTheDocument();
    expect(getByTitle('Toggle windlayer')).toBeInTheDocument();
  });
});
