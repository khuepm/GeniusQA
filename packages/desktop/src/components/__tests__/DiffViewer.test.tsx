/**
 * Integration tests for Diff Viewer Component
 *
 * Tests end-to-end diff review workflow including:
 * - Multiple view modes (side-by-side, slider, overlay)
 * - Baseline approval and rejection functionality
 * - Ignore region addition during review
 * - Performance metrics display and error handling
 *
 * Requirements: 7.3, 7.4, 7.5
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DiffViewer } from '../DiffViewer';
import { VisualTestResult } from '../../types/visualTesting.types';

// ============================================================================
// Test Data and Mocks
// ============================================================================

/**
 * Create a test visual test result
 */
function createTestVisualTestResult(overrides: Partial<VisualTestResult> = {}): VisualTestResult {
  return {
    action_id: 'test-action-123',
    passed: false,
    difference_percentage: 0.025, // 2.5%
    difference_type: 'content_change',
    baseline_path: 'baseline_test.png',
    actual_path: 'actual_test.png',
    diff_path: 'diff_test.png',
    performance_metrics: {
      capture_time_ms: 150,
      comparison_time_ms: 75,
      total_time_ms: 225,
    },
    error_details: null,
    retry_count: 1,
    ...overrides,
  };
}

/**
 * Mock image URLs for testing
 */
const mockImageUrls = {
  baseline: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5CYXNlbGluZTwvdGV4dD48L3N2Zz4=',
  actual: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5BY3R1YWw8L3RleHQ+PC9zdmc+',
  diff: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZjY2NjIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5EaWZmPC90ZXh0Pjwvc3ZnPg==',
};

// ============================================================================
// Integration Tests
// ============================================================================

describe('DiffViewer Integration Tests', () => {
  let mockOnApprove: jest.Mock;
  let mockOnReject: jest.Mock;
  let mockOnAddIgnoreRegion: jest.Mock;
  let mockOnRetryTest: jest.Mock;
  let testResult: VisualTestResult;

  beforeEach(() => {
    mockOnApprove = jest.fn().mockResolvedValue(undefined);
    mockOnReject = jest.fn();
    mockOnAddIgnoreRegion = jest.fn();
    mockOnRetryTest = jest.fn().mockResolvedValue(undefined);
    testResult = createTestVisualTestResult();

    // Mock Image constructor for image loading
    global.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';
      naturalWidth = 100;
      naturalHeight = 100;

      constructor() {
        setTimeout(() => {
          if (this.onload) {
            this.onload();
          }
        }, 0);
      }
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test: Multiple view modes functionality
   * Requirements: 3.1, 3.2
   */
  describe('Multiple View Modes', () => {
    it('should render diff viewer with default side-by-side view', async () => {
      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
      expect(screen.getByText('Visual Test Review')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('side-by-side-view')).toBeInTheDocument();
      });
    });

    it('should switch to slider view when slider button is clicked', async () => {
      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const sliderButton = screen.getByTestId('view-mode-slider');
      fireEvent.click(sliderButton);

      await waitFor(() => {
        expect(screen.getByTestId('slider-view')).toBeInTheDocument();
        expect(screen.getByTestId('slider-control')).toBeInTheDocument();
      });
    });

    it('should switch to overlay view when overlay button is clicked', async () => {
      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const overlayButton = screen.getByTestId('view-mode-overlay');
      fireEvent.click(overlayButton);

      await waitFor(() => {
        expect(screen.getByTestId('overlay-view')).toBeInTheDocument();
      });
    });

    it('should update slider position in slider view', async () => {
      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      // Switch to slider view
      const sliderButton = screen.getByTestId('view-mode-slider');
      fireEvent.click(sliderButton);

      await waitFor(() => {
        const sliderControl = screen.getByTestId('slider-control');
        fireEvent.change(sliderControl, { target: { value: '75' } });
        expect(sliderControl).toHaveValue('75');
      });
    });

    it('should highlight active view mode button', async () => {
      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const sideBySlideButton = screen.getByTestId('view-mode-side-by-side');
      const sliderButton = screen.getByTestId('view-mode-slider');

      // Initially side-by-side should be active
      expect(sideBySlideButton).toHaveClass('active');
      expect(sliderButton).not.toHaveClass('active');

      // Click slider button
      fireEvent.click(sliderButton);

      await waitFor(() => {
        expect(sliderButton).toHaveClass('active');
        expect(sideBySlideButton).not.toHaveClass('active');
      });
    });
  });

  /**
   * Test: Test status and metrics display
   * Requirements: 7.3, 7.4
   */
  describe('Test Status and Metrics Display', () => {
    it('should display test status badge for failed test', () => {
      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const statusBadge = screen.getByTestId('test-status');
      expect(statusBadge).toHaveTextContent('✗ Failed');
      expect(statusBadge).toHaveClass('status-failed');
    });

    it('should display test status badge for passed test', () => {
      const passedResult = createTestVisualTestResult({ passed: true });

      render(
        <DiffViewer
          testResult={passedResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const statusBadge = screen.getByTestId('test-status');
      expect(statusBadge).toHaveTextContent('✓ Passed');
      expect(statusBadge).toHaveClass('status-passed');
    });

    it('should display difference type badge', () => {
      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const differenceBadge = screen.getByTestId('difference-type');
      expect(differenceBadge).toHaveTextContent('📝 Content Change');
    });

    it('should display performance metrics', () => {
      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      expect(screen.getByText('2.50%')).toBeInTheDocument(); // Difference percentage
      expect(screen.getByText('150ms')).toBeInTheDocument(); // Capture time
      expect(screen.getByText('75ms')).toBeInTheDocument(); // Comparison time
      expect(screen.getByText('225ms')).toBeInTheDocument(); // Total time
      expect(screen.getByText('1')).toBeInTheDocument(); // Retry count
    });

    it('should handle different difference types correctly', () => {
      const layoutShiftResult = createTestVisualTestResult({
        difference_type: 'layout_shift'
      });

      render(
        <DiffViewer
          testResult={layoutShiftResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const differenceBadge = screen.getByTestId('difference-type');
      expect(differenceBadge).toHaveTextContent('↔️ Layout Shift');
    });
  });

  /**
   * Test: Baseline approval and rejection functionality
   * Requirements: 3.3
   */
  describe('Baseline Approval and Rejection', () => {
    it('should call onApprove when approve button is clicked', async () => {
      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const approveButton = screen.getByTestId('approve-btn');
      fireEvent.click(approveButton);

      await waitFor(() => {
        expect(mockOnApprove).toHaveBeenCalledTimes(1);
      });
    });

    it('should show loading state during approval', async () => {
      // Make onApprove return a pending promise
      const pendingPromise = new Promise(() => { }); // Never resolves
      mockOnApprove.mockReturnValue(pendingPromise);

      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const approveButton = screen.getByTestId('approve-btn');
      fireEvent.click(approveButton);

      await waitFor(() => {
        expect(approveButton).toHaveTextContent('Approving...');
        expect(approveButton).toBeDisabled();
      });
    });

    it('should call onReject when reject button is clicked', () => {
      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const rejectButton = screen.getByTestId('reject-btn');
      fireEvent.click(rejectButton);

      expect(mockOnReject).toHaveBeenCalledTimes(1);
    });

    it('should handle approval errors gracefully', async () => {
      const errorMessage = 'Failed to approve changes';
      mockOnApprove.mockRejectedValue(new Error(errorMessage));

      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const approveButton = screen.getByTestId('approve-btn');
      fireEvent.click(approveButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });
  });

  /**
   * Test: Ignore region addition functionality
   * Requirements: 3.5
   */
  describe('Ignore Region Addition', () => {
    it('should enter drawing mode when add ignore region is clicked', async () => {
      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const addIgnoreButton = screen.getByTestId('add-ignore-btn');
      fireEvent.click(addIgnoreButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-ignore-region')).toBeInTheDocument();
        expect(screen.getByTestId('cancel-ignore-region')).toBeInTheDocument();
      });
    });

    it('should cancel drawing mode when cancel button is clicked', async () => {
      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      // Enter drawing mode
      const addIgnoreButton = screen.getByTestId('add-ignore-btn');
      fireEvent.click(addIgnoreButton);

      await waitFor(() => {
        const cancelButton = screen.getByTestId('cancel-ignore-region');
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-ignore-btn')).toBeInTheDocument();
        expect(screen.queryByTestId('confirm-ignore-region')).not.toBeInTheDocument();
      });
    });

    it('should show ROI tool in overlay view when drawing ignore region', async () => {
      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      // Switch to overlay view
      const overlayButton = screen.getByTestId('view-mode-overlay');
      fireEvent.click(overlayButton);

      // Enter drawing mode
      const addIgnoreButton = screen.getByTestId('add-ignore-btn');
      fireEvent.click(addIgnoreButton);

      await waitFor(() => {
        expect(screen.getByTestId('roi-tool')).toBeInTheDocument();
      });
    });
  });

  /**
   * Test: Retry functionality
   * Requirements: 7.3, 7.5
   */
  describe('Retry Functionality', () => {
    it('should call onRetryTest when retry button is clicked', async () => {
      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const retryButton = screen.getByTestId('retry-btn');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockOnRetryTest).toHaveBeenCalledTimes(1);
      });
    });

    it('should show loading state during retry', async () => {
      // Make onRetryTest return a pending promise
      const pendingPromise = new Promise(() => { }); // Never resolves
      mockOnRetryTest.mockReturnValue(pendingPromise);

      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const retryButton = screen.getByTestId('retry-btn');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(retryButton).toHaveTextContent('Retrying...');
        expect(retryButton).toBeDisabled();
      });
    });

    it('should handle retry errors gracefully', async () => {
      const errorMessage = 'Failed to retry test';
      mockOnRetryTest.mockRejectedValue(new Error(errorMessage));

      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const retryButton = screen.getByTestId('retry-btn');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });
  });

  /**
   * Test: Image loading and error handling
   * Requirements: 7.3, 7.4
   */
  describe('Image Loading and Error Handling', () => {
    it('should show loading indicator while images are loading', () => {
      // Mock Image constructor to not call onload immediately
      global.Image = class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = '';
      } as any;

      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      expect(screen.getByText('Loading images...')).toBeInTheDocument();
    });

    it('should handle image loading errors', async () => {
      // Mock Image constructor to simulate loading failure
      global.Image = class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = '';

        constructor() {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror();
            }
          }, 0);
        }
      } as any;

      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });
    });

    it('should handle missing diff image gracefully', async () => {
      const resultWithoutDiff = createTestVisualTestResult({ diff_path: null });

      render(
        <DiffViewer
          testResult={resultWithoutDiff}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('side-by-side-view')).toBeInTheDocument();
        // Should only show baseline and actual panels, not diff panel
        const imagePanels = screen.getAllByText(/Baseline|Actual/);
        expect(imagePanels).toHaveLength(2);
      });
    });

    it('should display error details when provided', () => {
      const resultWithError = createTestVisualTestResult({
        error_details: 'Screenshot capture failed: timeout after 5000ms'
      });

      render(
        <DiffViewer
          testResult={resultWithError}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      expect(screen.getByText('Error Details')).toBeInTheDocument();
      expect(screen.getByText('Screenshot capture failed: timeout after 5000ms')).toBeInTheDocument();
    });
  });

  /**
   * Test: Performance under various image sizes
   * Requirements: 7.3, 7.5
   */
  describe('Performance Under Various Image Sizes', () => {
    it('should handle large performance metrics without issues', () => {
      const resultWithLargeMetrics = createTestVisualTestResult({
        performance_metrics: {
          capture_time_ms: 9999,
          comparison_time_ms: 8888,
          total_time_ms: 18887,
        },
      });

      const startTime = performance.now();

      render(
        <DiffViewer
          testResult={resultWithLargeMetrics}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time
      expect(renderTime).toBeLessThan(1000);
      expect(screen.getByText('9999ms')).toBeInTheDocument();
      expect(screen.getByText('8888ms')).toBeInTheDocument();
      expect(screen.getByText('18887ms')).toBeInTheDocument();
    });

    it('should handle rapid view mode switching', async () => {
      render(
        <DiffViewer
          testResult={testResult}
          onApprove={mockOnApprove}
          onReject={mockOnReject}
          onAddIgnoreRegion={mockOnAddIgnoreRegion}
          onRetryTest={mockOnRetryTest}
        />
      );

      const sideBySlideButton = screen.getByTestId('view-mode-side-by-side');
      const sliderButton = screen.getByTestId('view-mode-slider');
      const overlayButton = screen.getByTestId('view-mode-overlay');

      // Rapidly switch between view modes
      for (let i = 0; i < 10; i++) {
        fireEvent.click(sliderButton);
        fireEvent.click(overlayButton);
        fireEvent.click(sideBySlideButton);
      }

      // Should handle all switches without errors
      await waitFor(() => {
        expect(screen.getByTestId('side-by-side-view')).toBeInTheDocument();
      });
    });
  });
});
