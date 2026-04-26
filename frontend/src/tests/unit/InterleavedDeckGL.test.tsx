import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { InterleavedDeckGL } from '../../features/map/InterleavedDeckGL';

vi.mock('react-map-gl/maplibre', () => ({
  useControl: vi.fn(() => ({
    setProps: vi.fn(),
  })),
}));

describe('InterleavedDeckGL Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<InterleavedDeckGL layers={[]} onOverlayCreated={vi.fn()} />);
    expect(container).toBeInTheDocument();
  });
});
