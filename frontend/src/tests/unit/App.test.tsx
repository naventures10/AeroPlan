import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../../App';

// Mock the global hideLoader
(window as any).hideLoader = vi.fn();

// Mock LandingPage and MapPage to avoid complex logic/WebGPU in App tests
vi.mock('../../pages/LandingPage', () => ({
  default: () => <div data-testid="landing-page-mock" />,
}));
vi.mock('../../pages/MapPage', () => ({
  default: () => <div data-testid="map-page-mock" />,
}));

describe('App Component Shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders landing page by default', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('landing-page-mock')).toBeInTheDocument();
    });
    expect((window as any).hideLoader).toHaveBeenCalled();
  });
});
