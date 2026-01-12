/**
 * ErrorBoundary Component
 * React error boundary for graceful error handling and recovery
 * Requirements: Error handling strategy, Enhanced error recovery (Task 18.2)
 */

import React, { Component, ReactNode } from 'react';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
  retryAttempts?: number;
  retryDelay?: number;
  enableAutoRecovery?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string;
  retryCount: number;
  isRetrying: boolean;
  lastErrorTime: number;
  errorType: 'critical' | 'recoverable' | 'network' | 'ipc' | 'unknown';
}

/**
 * Enhanced ErrorBoundary Component
 * Catches JavaScript errors anywhere in the child component tree with improved recovery
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;
  private retryTimeoutId: number | null = null;
  private maxRetryAttempts: number;
  private retryDelay: number;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.maxRetryAttempts = props.retryAttempts || 3;
    this.retryDelay = props.retryDelay || 2000;

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
      isRetrying: false,
      lastErrorTime: 0,
      errorType: 'unknown'
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorType = ErrorBoundary.classifyError(error);

    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lastErrorTime: Date.now(),
      errorType
    };
  }

  static classifyError(error: Error): 'critical' | 'recoverable' | 'network' | 'ipc' | 'unknown' {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Critical errors that should not be auto-recovered
    if (name.includes('syntaxerror') ||
      name.includes('referenceerror') ||
      message.includes('cannot read property') ||
      message.includes('is not a function')) {
      return 'critical';
    }

    // Network-related errors
    if (message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('timeout')) {
      return 'network';
    }

    // IPC communication errors
    if (message.includes('ipc') ||
      message.includes('tauri') ||
      message.includes('invoke') ||
      message.includes('backend')) {
      return 'ipc';
    }

    // Recoverable errors (UI state, temporary issues)
    if (message.includes('state') ||
      message.includes('render') ||
      message.includes('component')) {
      return 'recoverable';
    }

    return 'unknown';
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Enhanced error logging with context
    const errorContext = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errorType: this.state.errorType,
      retryCount: this.state.retryCount,
      props: this.props.resetKeys
    };

    console.error('ErrorBoundary caught an error:', errorContext);

    this.setState({
      error,
      errorInfo
    });

    // Call optional error handler with enhanced context
    this.props.onError?.(error, errorInfo);

    // Send error to monitoring service (if available)
    this.reportErrorToMonitoring(errorContext);

    // Attempt automatic recovery based on error type
    if (this.props.enableAutoRecovery !== false) {
      this.attemptAutoRecovery();
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error state when resetKeys change
    if (hasError && resetOnPropsChange && resetKeys) {
      const prevResetKeys = prevProps.resetKeys || [];
      const hasResetKeyChanged = resetKeys.some((key, index) => key !== prevResetKeys[index]);

      if (hasResetKeyChanged) {
        this.handleReset();
      }
    }
  }

  componentWillUnmount() {
    this.clearTimeouts();
  }

  private clearTimeouts() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  private reportErrorToMonitoring(errorContext: any) {
    // In production, this would send to error monitoring service
    // For now, we'll store in localStorage for debugging
    try {
      const existingErrors = JSON.parse(localStorage.getItem('geniusqa_errors') || '[]');
      existingErrors.push(errorContext);

      // Keep only last 10 errors to prevent storage bloat
      if (existingErrors.length > 10) {
        existingErrors.splice(0, existingErrors.length - 10);
      }

      localStorage.setItem('geniusqa_errors', JSON.stringify(existingErrors));
    } catch (e) {
      console.warn('Failed to store error for monitoring:', e);
    }
  }

  private attemptAutoRecovery() {
    const { errorType, retryCount } = this.state;

    // Don't auto-recover critical errors
    if (errorType === 'critical') {
      return;
    }

    // Don't retry if we've exceeded max attempts
    if (retryCount >= this.maxRetryAttempts) {
      console.warn('Max retry attempts reached, manual intervention required');
      return;
    }

    // Calculate delay with exponential backoff
    const delay = this.retryDelay * Math.pow(2, retryCount);

    console.log(`Attempting auto-recovery in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetryAttempts})`);

    this.setState({ isRetrying: true });

    this.retryTimeoutId = window.setTimeout(() => {
      this.handleRetry();
    }, delay);
  }

  private handleReset = () => {
    this.clearTimeouts();

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
      isRetrying: false,
      lastErrorTime: 0,
      errorType: 'unknown'
    });
  };

  private handleRetry = () => {
    this.setState(prevState => ({
      retryCount: prevState.retryCount + 1,
      isRetrying: false
    }));

    // Reset the error state to trigger re-render
    this.handleReset();
  };

  private handleManualRetry = () => {
    // Reset retry count for manual retries
    this.setState({ retryCount: 0 });
    this.handleRetry();
  };

  private handleReportError = () => {
    const { error, errorInfo, errorType, retryCount } = this.state;

    // Create comprehensive error report
    const errorReport = {
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        type: errorType
      },
      errorInfo: {
        componentStack: errorInfo?.componentStack
      },
      context: {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        retryCount,
        props: this.props.resetKeys
      },
      recovery: {
        maxRetryAttempts: this.maxRetryAttempts,
        retryDelay: this.retryDelay,
        autoRecoveryEnabled: this.props.enableAutoRecovery !== false
      }
    };

    // Log comprehensive error report
    console.error('Comprehensive Error Report:', errorReport);

    // Copy to clipboard for user to report
    navigator.clipboard?.writeText(JSON.stringify(errorReport, null, 2))
      .then(() => {
        this.showUserFeedback('Error details copied to clipboard. Please report this issue.');
      })
      .catch(() => {
        this.showUserFeedback('Error details logged to console. Please check developer tools.');
      });
  };

  private showUserFeedback(message: string) {
    // Simple user feedback - in production, this could be a toast notification
    const feedback = document.createElement('div');
    feedback.textContent = message;
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4caf50;
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;

    document.body.appendChild(feedback);

    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 3000);
  }

  private getErrorSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    const { errorType, retryCount } = this.state;

    if (errorType === 'critical') return 'critical';
    if (retryCount >= this.maxRetryAttempts) return 'high';
    if (errorType === 'network' || errorType === 'ipc') return 'medium';
    return 'low';
  }

  private getRecoveryInstructions(): string {
    const { errorType } = this.state;

    switch (errorType) {
      case 'network':
        return 'Check your internet connection and try again.';
      case 'ipc':
        return 'The application backend may be unavailable. Try restarting the application.';
      case 'recoverable':
        return 'This appears to be a temporary issue. Retrying should resolve it.';
      case 'critical':
        return 'This is a critical error that requires application restart.';
      default:
        return 'An unexpected error occurred. Try refreshing or restarting the application.';
    }
  }

  render() {
    const { hasError, error, isRetrying, retryCount, errorType } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Custom fallback UI
      if (fallback) {
        return fallback;
      }

      const severity = this.getErrorSeverity();
      const canRetry = retryCount < this.maxRetryAttempts && errorType !== 'critical';

      // Enhanced error UI with better user feedback
      return (
        <div className={`error-boundary error-boundary-${severity}`}>
          <div className="error-boundary-content">
            <div className="error-boundary-header">
              <div className="error-boundary-icon">
                {severity === 'critical' ? '🚨' :
                  severity === 'high' ? '⚠️' :
                    severity === 'medium' ? '⚡' : '💡'}
              </div>
              <div className="error-boundary-title-section">
                <h2 className="error-boundary-title">
                  {severity === 'critical' ? 'Critical Error' :
                    severity === 'high' ? 'Persistent Error' :
                      severity === 'medium' ? 'Connection Error' : 'Something went wrong'}
                </h2>
                <div className="error-boundary-subtitle">
                  Error Type: {errorType} | Severity: {severity}
                  {retryCount > 0 && ` | Retry ${retryCount}/${this.maxRetryAttempts}`}
                </div>
              </div>
            </div>

            <p className="error-boundary-message">
              {error?.message || 'An unexpected error occurred'}
            </p>

            <div className="error-boundary-instructions">
              {this.getRecoveryInstructions()}
            </div>

            {isRetrying && (
              <div className="error-boundary-retry-status">
                <div className="retry-spinner"></div>
                <span>Attempting automatic recovery...</span>
              </div>
            )}

            <div className="error-boundary-actions">
              {canRetry && !isRetrying && (
                <button
                  className="error-boundary-button primary"
                  onClick={this.handleManualRetry}
                >
                  Try Again
                </button>
              )}

              <button
                className="error-boundary-button secondary"
                onClick={this.handleReportError}
              >
                Report Error
              </button>

              {severity === 'critical' && (
                <button
                  className="error-boundary-button danger"
                  onClick={() => window.location.reload()}
                >
                  Restart Application
                </button>
              )}
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className="error-boundary-details">
                <summary>Error Details (Development)</summary>
                <div className="error-details-content">
                  <div className="error-detail-section">
                    <strong>Error Type:</strong> {errorType}
                  </div>
                  <div className="error-detail-section">
                    <strong>Retry Count:</strong> {retryCount}/{this.maxRetryAttempts}
                  </div>
                  <div className="error-detail-section">
                    <strong>Stack Trace:</strong>
                    <pre className="error-boundary-stack">{error?.stack}</pre>
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

export default ErrorBoundary;
