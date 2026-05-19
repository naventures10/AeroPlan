import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from '../../components/ErrorBoundary';

const Bomb = () => {
  throw new Error('Boom!');
};

describe('ErrorBoundary', () => {
  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Safe Child</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Safe Child')).toBeInTheDocument();
  });

  it('should catch error and display fallback UI', () => {
    const originalConsoleError = console.error;
    console.error = vi.fn(); // Suppress expected error logs
    const originalLocation = window.location;

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Error: Boom!')).toBeInTheDocument();

    // Verify reload functionality
    const reloadObj = { reload: vi.fn() };
    Object.defineProperty(window, 'location', {
      value: reloadObj,
      writable: true,
      configurable: true,
    });

    const button = screen.getByRole('button', { name: /Reload Application/i });
    fireEvent.click(button);
    expect(reloadObj.reload).toHaveBeenCalled();

    // Verify standard stylesheet class name
    expect(button.className).toContain('error-boundary-button');

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
    });
    console.error = originalConsoleError;
  });
});
