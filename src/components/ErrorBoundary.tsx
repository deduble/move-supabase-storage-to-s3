import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });

    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error reporting service
      console.error('Production error:', { error, errorInfo, timestamp: new Date() });
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="card" style={{ margin: '2em', textAlign: 'center' }}>
          <h2 style={{ color: '#ef4444' }}>⚠️ Something went wrong</h2>
          <p style={{ marginBottom: '2em', opacity: 0.9 }}>
            The application encountered an unexpected error. This has been logged for debugging.
          </p>

          <div style={{ display: 'flex', gap: '1em', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={this.handleReset}>
              Try Again
            </button>
            <button className="btn" onClick={this.handleReload}>
              Reload Application
            </button>
          </div>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ marginTop: '2em', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                Error Details (Development)
              </summary>
              <pre style={{
                fontSize: '0.8em',
                background: '#333',
                padding: '1em',
                borderRadius: '4px',
                marginTop: '1em',
                overflow: 'auto',
                maxHeight: '300px'
              }}>
                <strong>Error:</strong> {this.state.error.message}
                {'\n\n'}
                <strong>Stack:</strong> {this.state.error.stack}
                {this.state.errorInfo && (
                  <>
                    {'\n\n'}
                    <strong>Component Stack:</strong> {this.state.errorInfo.componentStack}
                  </>
                )}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;