import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GlobalLoader from '../../components/GlobalLoader';

describe('GlobalLoader', () => {
  it('should render the loading message and spinner', () => {
    render(<GlobalLoader />);
    expect(screen.getByText(/Initializing AeroInfo Systems.../i)).toBeInTheDocument();
  });
});
