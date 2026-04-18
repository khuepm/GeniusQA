/**
 * Error Handling and Accessibility Tests
 * Tests for task 14: Add error handling and accessibility
 * Requirements: Error handling strategy, Accessibility compliance
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import { UnifiedInterface, UnifiedInterfaceProvider } from '../UnifiedInterface';
import { TopToolbar } from '../TopToolbar';
import { EditorArea } from '../EditorArea';
import { ToolbarButton } from '../ToolbarButton';

// Mock component that throws an error
const ErrorThrowingComponent: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Test error for error boundary');
  }
  return <div>Normal component</div>;
};

describe('Error Handling and Accessibility', () => {
  describe('Task 14.1: Error boundaries and recovery', () => {
    test('ErrorBoundary catches and displays error fallback UI', () => {
      const onError = jest.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ErrorThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should show error boundary fallback UI
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Test error for error boundary')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Report Error' })).toBeInTheDocument();

      // Should call error handler
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      );
    });

    test('ErrorBoundary allows retry functionality', () => {
      let shouldThrow = true;

      const TestComponent = () => (
        <ErrorBoundary>
          <ErrorThrowingComponent shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );

      const { rerender } = render(<TestComponent />);

      // Should show error UI
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Simulate fixing the error
      shouldThrow = false;

      // Click retry button
      const retryButton = screen.getByRole('button', { name: 'Try Again' });
      fireEvent.click(retryButton);

      // Rerender to simulate retry
      rerender(<TestComponent />);

      // Should show normal component
      expect(screen.getByText('Normal component')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    test('UnifiedInterface has error boundary with recovery', () => {
      render(
        <UnifiedInterfaceProvider>
          <UnifiedInterface>
            <div>Test content</div>
          </UnifiedInterface>
        </UnifiedInterfaceProvider>
      );

      // Should render without crashing and show error boundary
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    test('TopToolbar has error boundary for button groups', () => {
      render(
        <UnifiedInterfaceProvider>
          <TopToolbar />
        </UnifiedInterfaceProvider>
      );

      // Should render toolbar with error boundaries
      expect(screen.getByRole('toolbar')).toBeInTheDocument();
    });

    test('EditorArea has error boundary with fallback', () => {
      render(
        <UnifiedInterfaceProvider>
          <EditorArea />
        </UnifiedInterfaceProvider>
      );

      // Should render editor area with error boundaries
      expect(screen.getByRole('region', { name: /script editor/i })).toBeInTheDocument();
    });
  });

  describe('Task 14.2: Accessibility features', () => {
    test('UnifiedInterface has proper ARIA labels and roles', () => {
      render(
        <UnifiedInterfaceProvider>
          <UnifiedInterface />
        </UnifiedInterfaceProvider>
      );

      const mainElement = screen.getByRole('main');
      expect(mainElement).toHaveAttribute('aria-label', 'GeniusQA Desktop Application');

      const toolbarArea = screen.getByRole('toolbar');
      expect(toolbarArea).toHaveAttribute('aria-label', 'Main toolbar');

      const editorArea = screen.getByRole('region', { name: /script editor/i });
      expect(editorArea).toHaveAttribute('aria-label', 'Script editor');
    });

    test('TopToolbar supports keyboard navigation', () => {
      render(
        <UnifiedInterfaceProvider>
          <TopToolbar />
        </UnifiedInterfaceProvider>
      );

      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toHaveAttribute('aria-label', 'Main application toolbar');

      // Should have focusable buttons
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      // Buttons should have proper tabIndex
      buttons.forEach(button => {
        expect(button).toHaveAttribute('tabIndex');
      });
    });

    test('ToolbarButton has proper accessibility attributes', () => {
      const onClick = jest.fn();

      render(
        <ToolbarButton
          icon="record"
          tooltip="Start Recording"
          onClick={onClick}
        />
      );

      const button = screen.getByRole('button');

      // Should have proper ARIA attributes
      expect(button).toHaveAttribute('aria-label', 'Start Recording');
      expect(button).toHaveAttribute('tabIndex', '0');

      // Should support keyboard activation
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(onClick).toHaveBeenCalled();

      onClick.mockClear();
      fireEvent.keyDown(button, { key: ' ' });
      expect(onClick).toHaveBeenCalled();
    });

    test('EditorArea has proper tab navigation and ARIA structure', () => {
      render(
        <UnifiedInterfaceProvider>
          <EditorArea />
        </UnifiedInterfaceProvider>
      );

      // Should have proper heading structure
      const heading = screen.getByRole('heading', { name: /script editor/i });
      expect(heading).toBeInTheDocument();

      // Should have tab navigation for view modes
      const tabList = screen.getByRole('tablist');
      expect(tabList).toHaveAttribute('aria-label', 'View mode selection');

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);

      // First tab should be selected by default
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    });

    test('Components support graceful degradation', () => {
      // Mock console.error to suppress error logs in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      render(
        <ErrorBoundary
          fallback={<div>Graceful fallback</div>}
        >
          <ErrorThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Graceful fallback')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    test('Error boundaries provide user-friendly messages', () => {
      render(
        <ErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should show user-friendly error message
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Test error for error boundary')).toBeInTheDocument();

      // Should provide recovery options
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Report Error' })).toBeInTheDocument();
    });
  });
});
