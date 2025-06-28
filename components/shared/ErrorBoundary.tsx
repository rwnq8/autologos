

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true, error: _, errorInfo: null }; // Keep errorInfo null initially
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleResetAttempt = () => {
    // Attempt to reload the page as a simple recovery mechanism
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 rounded-md text-red-700 dark:text-red-200 shadow-lg">
          <h2 className="text-xl font-semibold mb-2">Something went wrong.</h2>
          <p className="mb-1">An unexpected error occurred in this part of the application.</p>
          <p className="mb-3">Please try refreshing the page. If the problem persists, you may need to reset the application or report this issue.</p>
          
          <details className="mb-4 text-sm bg-red-50 dark:bg-red-800/60 p-2 rounded border border-red-300 dark:border-red-500/70">
            <summary className="cursor-pointer font-medium hover:underline">Error Details</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words text-xs">
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </details>

          <button
            onClick={this.handleResetAttempt}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-md transition-colors"
          >
            Attempt to Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;