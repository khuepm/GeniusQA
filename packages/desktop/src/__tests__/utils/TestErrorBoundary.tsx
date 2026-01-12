/**
 * Test Error Boundary
 * 
 * Provides error boundary for test scenarios to handle
 * component errors gracefully during property-based testing.
 */

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class TestErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Test Error Boundary caught an error:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div data-testid="error-boundary-fallback">
          <h2>Test Error Occurred</h2>
          <p>Component failed to render: {this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap components with error boundary
 */
export const withTestErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) => {
  return (props: P) => (
    <TestErrorBoundary fallback={fallback}>
      <Component {...props} />
    </TestErrorBoundary>
  );
};

/**
 * Test wrapper that includes error boundary and isolation
 */
export const TestWrapper: React.FC<{
  children: ReactNode;
  onError?: (error: Error) => void;
}> = ({ children, onError }) => {
  return (
    <TestErrorBoundary
      onError={(error) => {
        if (onError) {
          onError(error);
        }
      }}
      fallback={
        <div data-testid="test-error-fallback">
          Component failed to render during test
        </div>
      }
    >
      {children}
    </TestErrorBoundary>
  );
};
