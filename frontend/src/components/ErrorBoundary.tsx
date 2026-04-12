import { Component } from 'react';
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
 * In the future, this can be wired to Sentry or a telemetry endpoint.
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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            width: '100vw',
            backgroundColor: '#0f172a',
            color: '#e2e8f0',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Something went wrong
          </h1>
          <p
            style={{
              color: '#94a3b8',
              fontSize: '0.9rem',
              maxWidth: '420px',
              marginBottom: '1.5rem',
            }}
          >
            An unexpected error occurred in the application. This has been logged for debugging.
          </p>
          {this.state.error && (
            <pre
              style={{
                backgroundColor: '#1e293b',
                color: '#f87171',
                padding: '1rem',
                borderRadius: '0.5rem',
                fontSize: '0.75rem',
                maxWidth: '600px',
                overflow: 'auto',
                marginBottom: '1.5rem',
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.name}: {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            type="button"
            style={{
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              padding: '0.6rem 1.5rem',
              borderRadius: '0.4rem',
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = '#2563eb';
            }}
            onMouseOut={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = '#3b82f6';
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
