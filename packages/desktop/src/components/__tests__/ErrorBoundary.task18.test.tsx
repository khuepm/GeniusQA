/**
 * Task 18.2 Enhanced Error Recovery Tests
 * Tests for the enhanced ErrorBoundary with improved error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorBoundary } from '../ErrorBoundary';

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean; errorType?: string }> = ({
  shouldThrow = false,
  errorType = 'generic'
}) => {
  if (shouldThrow) {
    if (errorType === 'network') {
      throw new Error('Network connection failed');
    } else if (errorType === 'ipc') {
      throw new Error('IPC communication error');
    } else if (errorType === 'critical') {
      throw new Error('Cannot read property of undefined');
    }
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary - Task 18.2 Enhanced Error Recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.error to avoid noise in test output
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Error Classification', () => {
    it('should classify network errors correctly', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="network" />
        </ErrorBoundary>
      );

      expect(screen.getByText(/connection error/i)).toBeInTheDocument();
      expect(screen.getByText(/network/i)).toBeInTheDocument();
    });

    it('should classify IPC errors correctly', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="ipc" />
        </ErrorBoundary>
      );

      expect(screen.getByText(/communication error/i)).toBeInTheDocument();
      expect(screen.getByText(/ipc/i)).toBeInTheDocument();
    });

    it('should classify critical errors correctly', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="critical" />
        </ErrorBoundary>
      );

      expect(screen.getByText(/critical error/i)).toBeInTheDocument();
      expect(screen.getByText(/critical/i)).toBeInTheDocument();
    });
  });

  describe('Enhanced Error UI', () => {
    it('should display error severity and type information', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="network" />
        </ErrorBoundary>
      );

      expect(screen.getByText(/error type: network/i)).toBeInTheDocument();
      expect(screen.getByText(/severity: medium/i)).toBeInTheDocument();
    });

    it('should show retry count when retries are attempted', async () => {
      render(
        <ErrorBoundary retryAttempts={2} enableAutoRecovery={true}>
          <ThrowError shouldThrow={true} errorType="network" />
        </ErrorBoundary>
      );

      // Should show retry information
      expect(screen.getByText(/retry: 0\/2/i)).toBeInTheDocument();
    });

    it('should display recovery instructions based on error type', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="network" />
        </ErrorBoundary>
      );

      expect(screen.getByText(/check your internet connection/i)).toBeInTheDocument();
    });
  });

  describe('Retry Mechanisms', () => {
    it('should show try again button for recoverable errors', () => {
      render(
        <ErrorBoundary retryAttempts={3}>
          <ThrowError shouldThrow={true} errorType="network" />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should not show try again button for critical errors', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="critical" />
        </ErrorBoundary>
      );

      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /restart application/i })).toBeInTheDocument();
    });

    it('should handle manual retry attempts', () => {
      const { rerender } = render(
        <ErrorBoundary retryAttempts={3}>
          <ThrowError shouldThrow={true} errorType="network" />
        </ErrorBoundary>
      );

      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(tryAgainButton);

      // After retry, should attempt to render children again
      rerender(
        <ErrorBoundary retryAttempts={3}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });
  });

  describe('Auto-Recovery', () => {
    it('should attempt auto-recovery for network errors', async () => {
      jest.useFakeTimers();

      const { rerender } = render(
        <ErrorBoundary enableAutoRecovery={true} retryDelay={1000}>
          <ThrowError shouldThrow={true} errorType="network" />
        </ErrorBoundary>
      );

      expect(screen.getByText(/attempting automatic recovery/i)).toBeInTheDocument();

      // Fast-forward time to trigger auto-recovery
      jest.advanceTimersByTime(1000);

      // Simulate successful recovery
      rerender(
        <ErrorBoundary enableAutoRecovery={true} retryDelay={1000}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('No error')).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it('should not attempt auto-recovery for critical errors', () => {
      jest.useFakeTimers();

      render(
        <ErrorBoundary enableAutoRecovery={true}>
          <ThrowError shouldThrow={true} errorType="critical" />
        </ErrorBoundary>
      );

      expect(screen.queryByText(/attempting automatic recovery/i)).not.toBeInTheDocument();

      jest.useRealTimers();
    });
  });

  describe('Error Reporting', () => {
    it('should provide error reporting functionality', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /report error/i })).toBeInTheDocument();
    });

    it('should handle error reporting click', () => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined)
        }
      });

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const reportButton = screen.getByRole('button', { name: /report error/i });
      fireEvent.click(reportButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  describe('Props Change Recovery', () => {
    it('should reset error state when resetKeys change', () => {
      const { rerender } = render(
        <ErrorBoundary resetOnPropsChange={true} resetKeys={['key1']}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

      // Change resetKeys to trigger reset
      rerender(
        <ErrorBoundary resetOnPropsChange={true} resetKeys={['key2']}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });
  });

  describe('Custom Fallback', () => {
    it('should render custom fallback when provided', () => {
      const customFallback = <div>Custom error message</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });
  });

  describe('Error Callback', () => {
    it('should call onError callback when error occurs', () => {
      const onError = jest.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      );
    });
  });
});
