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
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#0f172a] text-slate-200 font-sans p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-slate-400 text-sm max-w-[420px] mb-6">
            An unexpected error occurred in the application. This has been logged for debugging.
          </p>
          {this.state.error && (
            <pre className="error-pre mb-6">
              {this.state.error.name}: {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            type="button"
            className="bg-blue-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors hover:bg-blue-600"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
