/**
 * Diff Viewer Component
 *
 * React component for reviewing visual test failures with multiple view modes.
 * Provides side-by-side, slider, and overlay comparison views with baseline
 * approval and ignore region addition functionality.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.5
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  VisualTestResult,
  DiffViewMode,
  DiffReviewAction,
} from '../types/visualTesting.types';
import { VisionROI } from '../types/aiVisionCapture.types';
import { ROITool } from './ROITool';
import './DiffViewer.css';

// ============================================================================
// Types
// ============================================================================

export interface DiffViewerProps {
  /** Visual test result to review */
  testResult: VisualTestResult;
  /** Callback when user approves the changes */
  onApprove: () => Promise<void>;
  /** Callback when user rejects the changes */
  onReject: () => void;
  /** Callback when user adds an ignore region */
  onAddIgnoreRegion: (region: VisionROI) => void;
  /** Callback when user requests to retry the test */
  onRetryTest: () => Promise<void>;
  /** Base path for resolving image paths */
  assetsBasePath?: string;
}

interface DiffViewerState {
  /** Current view mode */
  viewMode: DiffViewMode;
  /** Selected region for ignore region addition */
  selectedRegion: VisionROI | null;
  /** Whether ROI tool is in drawing mode */
  drawingIgnoreRegion: boolean;
  /** Slider position for slider view mode (0-100) */
  sliderPosition: number;
  /** Whether images are loaded */
  imagesLoaded: {
    baseline: boolean;
    actual: boolean;
    diff: boolean;
  };
  /** Loading state for actions */
  loading: {
    approve: boolean;
    retry: boolean;
  };
  /** Error message */
  error: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const VIEW_MODE_OPTIONS: { value: DiffViewMode; label: string; icon: string }[] = [
  { value: 'side-by-side', label: 'Side by Side', icon: '⚏' },
  { value: 'slider', label: 'Slider', icon: '⚌' },
  { value: 'overlay', label: 'Overlay', icon: '⚊' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get difference type display information
 */
function getDifferenceTypeInfo(differenceType: string) {
  switch (differenceType) {
    case 'no_change':
      return { label: 'No Change', color: '#28a745', icon: '✓' };
    case 'layout_shift':
      return { label: 'Layout Shift', color: '#ffc107', icon: '↔️' };
    case 'content_change':
      return { label: 'Content Change', color: '#dc3545', icon: '📝' };
    case 'color_variation':
      return { label: 'Color Variation', color: '#17a2b8', icon: '🎨' };
    case 'dimension_mismatch':
      return { label: 'Dimension Mismatch', color: '#6f42c1', icon: '📐' };
    default:
      return { label: 'Unknown', color: '#6c757d', icon: '❓' };
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ============================================================================
// DiffViewer Component
// ============================================================================

/**
 * Diff Viewer Component
 *
 * Main component for reviewing visual test failures with:
 * - Multiple view modes (side-by-side, slider, overlay)
 * - Baseline approval and rejection functionality
 * - Ignore region addition during review
 * - Performance metrics display
 * - Error handling and retry functionality
 */
export const DiffViewer: React.FC<DiffViewerProps> = ({
  testResult,
  onApprove,
  onReject,
  onAddIgnoreRegion,
  onRetryTest,
  assetsBasePath = '',
}) => {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [state, setState] = useState<DiffViewerState>({
    viewMode: 'side-by-side',
    selectedRegion: null,
    drawingIgnoreRegion: false,
    sliderPosition: 50,
    imagesLoaded: {
      baseline: false,
      actual: false,
      diff: false,
    },
    loading: {
      approve: false,
      retry: false,
    },
    error: null,
  });

  // Refs for image elements
  const baselineImageRef = useRef<HTMLImageElement>(null);
  const actualImageRef = useRef<HTMLImageElement>(null);
  const diffImageRef = useRef<HTMLImageElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Image Loading Effects
  // -------------------------------------------------------------------------

  useEffect(() => {
    const loadImage = (src: string, key: keyof typeof state.imagesLoaded) => {
      const img = new Image();
      img.onload = () => {
        setState(prev => ({
          ...prev,
          imagesLoaded: { ...prev.imagesLoaded, [key]: true }
        }));
      };
      img.onerror = () => {
        setState(prev => ({
          ...prev,
          error: `Failed to load ${key} image`
        }));
      };
      img.src = assetsBasePath ? `${assetsBasePath}/${src}` : src;
    };

    // Load baseline and actual images
    loadImage(testResult.baseline_path, 'baseline');
    loadImage(testResult.actual_path, 'actual');

    // Load diff image if it exists
    if (testResult.diff_path) {
      loadImage(testResult.diff_path, 'diff');
    } else {
      setState(prev => ({
        ...prev,
        imagesLoaded: { ...prev.imagesLoaded, diff: true }
      }));
    }
  }, [testResult, assetsBasePath]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  /**
   * Handle view mode change
   * Requirements: 3.1, 3.2
   */
  const handleViewModeChange = useCallback((mode: DiffViewMode) => {
    setState(prev => ({ ...prev, viewMode: mode }));
  }, []);

  /**
   * Handle slider position change
   */
  const handleSliderChange = useCallback((position: number) => {
    setState(prev => ({ ...prev, sliderPosition: position }));
  }, []);

  /**
   * Handle approve action
   * Requirements: 3.3
   */
  const handleApprove = useCallback(async () => {
    setState(prev => ({
      ...prev,
      loading: { ...prev.loading, approve: true },
      error: null
    }));

    try {
      await onApprove();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to approve changes'
      }));
    } finally {
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, approve: false }
      }));
    }
  }, [onApprove]);

  /**
   * Handle retry action
   */
  const handleRetry = useCallback(async () => {
    setState(prev => ({
      ...prev,
      loading: { ...prev.loading, retry: true },
      error: null
    }));

    try {
      await onRetryTest();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to retry test'
      }));
    } finally {
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, retry: false }
      }));
    }
  }, [onRetryTest]);

  /**
   * Handle starting ignore region drawing
   * Requirements: 3.5
   */
  const handleStartDrawingIgnoreRegion = useCallback(() => {
    setState(prev => ({ ...prev, drawingIgnoreRegion: true }));
  }, []);

  /**
   * Handle cancel ignore region drawing
   */
  const handleCancelDrawingIgnoreRegion = useCallback(() => {
    setState(prev => ({
      ...prev,
      drawingIgnoreRegion: false,
      selectedRegion: null
    }));
  }, []);

  /**
   * Handle ROI change (for ignore region addition)
   */
  const handleROIChange = useCallback((roi: VisionROI) => {
    setState(prev => ({ ...prev, selectedRegion: roi }));
  }, []);

  /**
   * Handle add ignore region
   */
  const handleAddIgnoreRegion = useCallback(() => {
    if (state.selectedRegion) {
      onAddIgnoreRegion(state.selectedRegion);
      setState(prev => ({
        ...prev,
        drawingIgnoreRegion: false,
        selectedRegion: null
      }));
    }
  }, [state.selectedRegion, onAddIgnoreRegion]);

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------

  const allImagesLoaded = Object.values(state.imagesLoaded).every(loaded => loaded);
  const differenceInfo = getDifferenceTypeInfo(testResult.difference_type);

  const baselineUrl = assetsBasePath
    ? `${assetsBasePath}/${testResult.baseline_path}`
    : testResult.baseline_path;
  const actualUrl = assetsBasePath
    ? `${assetsBasePath}/${testResult.actual_path}`
    : testResult.actual_path;
  const diffUrl = testResult.diff_path
    ? (assetsBasePath ? `${assetsBasePath}/${testResult.diff_path}` : testResult.diff_path)
    : null;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="diff-viewer" data-testid="diff-viewer">
      {/* Header */}
      <div className="diff-viewer-header">
        <div className="diff-viewer-title">
          <h3>Visual Test Review</h3>
          <div className="test-status">
            <span
              className={`status-badge ${testResult.passed ? 'status-passed' : 'status-failed'}`}
              data-testid="test-status"
            >
              {testResult.passed ? '✓ Passed' : '✗ Failed'}
            </span>
            <span
              className="difference-badge"
              style={{ backgroundColor: differenceInfo.color }}
              data-testid="difference-type"
            >
              {differenceInfo.icon} {differenceInfo.label}
            </span>
          </div>
        </div>

        {/* View Mode Controls */}
        <div className="view-mode-controls">
          {VIEW_MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`view-mode-btn ${state.viewMode === option.value ? 'active' : ''}`}
              onClick={() => handleViewModeChange(option.value)}
              title={option.label}
              data-testid={`view-mode-${option.value}`}
            >
              <span className="view-mode-icon">{option.icon}</span>
              <span className="view-mode-label">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="diff-viewer-content">
        {!allImagesLoaded && (
          <div className="diff-viewer-loading" data-testid="loading-indicator">
            <div className="loading-spinner"></div>
            <span>Loading images...</span>
          </div>
        )}

        {allImagesLoaded && (
          <>
            {/* Side-by-Side View */}
            {state.viewMode === 'side-by-side' && (
              <div className="diff-view-side-by-side" data-testid="side-by-side-view">
                <div className="image-panel">
                  <div className="image-panel-header">
                    <h4>Baseline</h4>
                  </div>
                  <div className="image-container">
                    <img
                      ref={baselineImageRef}
                      src={baselineUrl}
                      alt="Baseline"
                      className="comparison-image"
                    />
                  </div>
                </div>

                <div className="image-panel">
                  <div className="image-panel-header">
                    <h4>Actual</h4>
                  </div>
                  <div className="image-container">
                    <img
                      ref={actualImageRef}
                      src={actualUrl}
                      alt="Actual"
                      className="comparison-image"
                    />
                  </div>
                </div>

                {diffUrl && (
                  <div className="image-panel">
                    <div className="image-panel-header">
                      <h4>Differences</h4>
                    </div>
                    <div className="image-container">
                      <img
                        ref={diffImageRef}
                        src={diffUrl}
                        alt="Differences"
                        className="comparison-image"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Slider View */}
            {state.viewMode === 'slider' && (
              <div className="diff-view-slider" data-testid="slider-view">
                <div className="slider-container" ref={sliderRef}>
                  <div className="slider-images">
                    <img
                      src={baselineUrl}
                      alt="Baseline"
                      className="slider-image slider-baseline"
                      style={{ clipPath: `inset(0 ${100 - state.sliderPosition}% 0 0)` }}
                    />
                    <img
                      src={actualUrl}
                      alt="Actual"
                      className="slider-image slider-actual"
                      style={{ clipPath: `inset(0 0 0 ${state.sliderPosition}%)` }}
                    />
                  </div>
                  <div
                    className="slider-divider"
                    style={{ left: `${state.sliderPosition}%` }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={state.sliderPosition}
                    onChange={(e) => handleSliderChange(parseInt(e.target.value))}
                    className="slider-control"
                    data-testid="slider-control"
                  />
                </div>
                <div className="slider-labels">
                  <span>Baseline</span>
                  <span>Actual</span>
                </div>
              </div>
            )}

            {/* Overlay View */}
            {state.viewMode === 'overlay' && (
              <div className="diff-view-overlay" data-testid="overlay-view">
                {state.drawingIgnoreRegion ? (
                  <ROITool
                    imageUrl={actualUrl}
                    roi={state.selectedRegion}
                    onROIChange={handleROIChange}
                  />
                ) : (
                  <div className="overlay-container">
                    <img
                      src={baselineUrl}
                      alt="Baseline"
                      className="overlay-image overlay-baseline"
                    />
                    {diffUrl && (
                      <img
                        src={diffUrl}
                        alt="Differences"
                        className="overlay-image overlay-diff"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Metrics Panel */}
      <div className="diff-viewer-metrics">
        <div className="metrics-section">
          <h4>Test Metrics</h4>
          <div className="metrics-grid">
            <div className="metric-item">
              <span className="metric-label">Difference:</span>
              <span className="metric-value">
                {(testResult.difference_percentage * 100).toFixed(2)}%
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Capture Time:</span>
              <span className="metric-value">
                {testResult.performance_metrics.capture_time_ms}ms
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Comparison Time:</span>
              <span className="metric-value">
                {testResult.performance_metrics.comparison_time_ms}ms
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Total Time:</span>
              <span className="metric-value">
                {testResult.performance_metrics.total_time_ms}ms
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Retries:</span>
              <span className="metric-value">{testResult.retry_count}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Panel */}
      <div className="diff-viewer-actions">
        {state.drawingIgnoreRegion ? (
          <div className="ignore-region-actions">
            <button
              className="btn-add-ignore-confirm"
              onClick={handleAddIgnoreRegion}
              disabled={!state.selectedRegion}
              data-testid="confirm-ignore-region"
            >
              Add Ignore Region
            </button>
            <button
              className="btn-cancel"
              onClick={handleCancelDrawingIgnoreRegion}
              data-testid="cancel-ignore-region"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="review-actions">
            <button
              className="btn-approve"
              onClick={handleApprove}
              disabled={state.loading.approve}
              data-testid="approve-btn"
            >
              {state.loading.approve ? 'Approving...' : '✓ Approve Changes'}
            </button>

            <button
              className="btn-reject"
              onClick={onReject}
              data-testid="reject-btn"
            >
              ✗ Reject
            </button>

            <button
              className="btn-add-ignore"
              onClick={handleStartDrawingIgnoreRegion}
              data-testid="add-ignore-btn"
            >
              + Add Ignore Region
            </button>

            <button
              className="btn-retry"
              onClick={handleRetry}
              disabled={state.loading.retry}
              data-testid="retry-btn"
            >
              {state.loading.retry ? 'Retrying...' : '🔄 Retry Test'}
            </button>
          </div>
        )}
      </div>

      {/* Error Display */}
      {state.error && (
        <div className="diff-viewer-error" data-testid="error-message">
          <span className="error-icon">⚠️</span>
          <span>{state.error}</span>
        </div>
      )}

      {/* Error Details */}
      {testResult.error_details && (
        <div className="diff-viewer-error-details">
          <h4>Error Details</h4>
          <pre>{testResult.error_details}</pre>
        </div>
      )}
    </div>
  );
};

export default DiffViewer;
