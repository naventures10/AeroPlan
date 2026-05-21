import { Component } from 'react';
import './ErrorBoundary.css';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches render-time crashes and displays
 * a user-friendly fallback instead of a white screen.
 *
 * Logs the error details and component stack to the console.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught render error:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-icon">⚠️</div>
          <h1 className="error-boundary-title">Something went wrong</h1>
          <p className="error-boundary-desc">
            An unexpected error occurred in the application. This has been logged for debugging.
          </p>
          {this.state.error && (
            <pre className="error-pre mb-6">
              {this.state.error.name}: {this.state.error.message}
            </pre>
          )}
          <button onClick={this.handleReload} type="button" className="error-boundary-button">
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
