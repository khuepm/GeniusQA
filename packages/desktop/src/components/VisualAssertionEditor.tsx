/**
 * Visual Assertion Editor Component
 *
 * Main editor component for Visual Assert actions.
 * Provides UI for configuring visual regression testing including:
 * - Screenshot display with ROI and ignore region tools
 * - Sensitivity profile selection
 * - Comparison method and threshold configuration
 * - Timeout and retry settings
 * - Storage backend selection
 *
 * Requirements: 7.1, 7.2, 2.1
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  VisualAssertAction,
  VisualAssertConfig,
  SensitivityProfile,
  ComparisonMethod,
  StorageBackend,
  applySensitivityProfile,
  SENSITIVITY_PROFILES,
} from '../types/visualTesting.types';
import { VisionROI } from '../types/aiVisionCapture.types';
import { ROITool } from './ROITool';
import './VisualAssertionEditor.css';

// ============================================================================
// Types
// ============================================================================

export interface VisualAssertionEditorProps {
  /** The Visual Assert action to edit */
  action: VisualAssertAction;
  /** Callback when action is updated */
  onUpdate: (action: VisualAssertAction) => void;
  /** Base path for resolving asset paths */
  assetsBasePath?: string;
  /** Current screenshot URL for ROI selection */
  screenshotUrl?: string;
}

interface EditorState {
  /** Currently selected ignore region for editing */
  selectedIgnoreRegion: number | null;
  /** Whether ROI tool is in ignore region drawing mode */
  drawingIgnoreRegion: boolean;
  /** Error message to display */
  error: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const SENSITIVITY_OPTIONS: { value: SensitivityProfile; label: string; description: string }[] = [
  {
    value: 'strict',
    label: 'Strict',
    description: 'Pixel-perfect matching (0.1% threshold, no tolerance)'
  },
  {
    value: 'moderate',
    label: 'Moderate',
    description: 'Balanced comparison (1% threshold, 1px shift tolerance)'
  },
  {
    value: 'flexible',
    label: 'Flexible',
    description: 'Tolerant matching (5% threshold, 2px shift + anti-aliasing)'
  },
];

const COMPARISON_METHOD_OPTIONS: { value: ComparisonMethod; label: string; description: string }[] = [
  {
    value: 'pixel_match',
    label: 'Pixel Match',
    description: 'Fastest - Strict pixel-by-pixel comparison'
  },
  {
    value: 'layout_aware',
    label: 'Layout Aware',
    description: 'Balanced - Smart comparison with shift tolerance'
  },
  {
    value: 'ssim',
    label: 'SSIM',
    description: 'Slowest - Structural similarity (most tolerant)'
  },
  {
    value: 'hybrid',
    label: 'Hybrid',
    description: 'Combination of multiple methods'
  },
];

const STORAGE_BACKEND_OPTIONS: { value: StorageBackend; label: string; description: string }[] = [
  {
    value: 'local',
    label: 'Local Storage',
    description: 'Store baselines in local filesystem'
  },
  {
    value: 'git_lfs',
    label: 'Git LFS',
    description: 'Store baselines in Git Large File Storage'
  },
  {
    value: 'cloud',
    label: 'Cloud Storage',
    description: 'Store baselines in cloud storage (S3/MinIO)'
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a placeholder screenshot URL if none provided
 */
function getScreenshotUrl(action: VisualAssertAction, assetsBasePath?: string): string {
  // If we have a baseline path, use it as screenshot
  if (action.assets.baseline_path) {
    return assetsBasePath
      ? `${assetsBasePath}/${action.assets.baseline_path}`
      : action.assets.baseline_path;
  }

  // Generate placeholder based on screen resolution
  const [width, height] = action.context.screen_resolution.split('x').map(Number);
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial" font-size="24" fill="#666">
        Screenshot Preview
      </text>
      <text x="50%" y="60%" text-anchor="middle" dy=".3em" font-family="Arial" font-size="16" fill="#999">
        ${action.context.screen_resolution}
      </text>
    </svg>
  `)}`;
}

// ============================================================================
// VisualAssertionEditor Component
// ============================================================================

/**
 * Visual Assertion Editor Component
 *
 * Main editor for Visual Assert actions with:
 * - Screenshot display with ROI and ignore region tools
 * - Sensitivity profile selection with automatic configuration
 * - Manual configuration overrides
 * - Storage backend selection
 * - Performance and timeout settings
 */
export const VisualAssertionEditor: React.FC<VisualAssertionEditorProps> = ({
  action,
  onUpdate,
  assetsBasePath = '',
  screenshotUrl,
}) => {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [state, setState] = useState<EditorState>({
    selectedIgnoreRegion: null,
    drawingIgnoreRegion: false,
    error: null,
  });

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  /**
   * Handle sensitivity profile change
   * Automatically applies profile configuration
   * Requirements: 7.1, 2.1
   */
  const handleSensitivityProfileChange = useCallback(
    (profile: SensitivityProfile) => {
      const updatedConfig = applySensitivityProfile(action.config, profile);
      const updatedAction: VisualAssertAction = {
        ...action,
        config: updatedConfig,
      };
      onUpdate(updatedAction);
    },
    [action, onUpdate]
  );

  /**
   * Handle manual configuration changes
   */
  const handleConfigChange = useCallback(
    (configUpdate: Partial<VisualAssertConfig>) => {
      const updatedAction: VisualAssertAction = {
        ...action,
        config: {
          ...action.config,
          ...configUpdate,
        },
      };
      onUpdate(updatedAction);
    },
    [action, onUpdate]
  );

  /**
   * Handle ROI change for target region
   * Requirements: 7.1, 2.1
   */
  const handleROIChange = useCallback(
    (roi: VisionROI) => {
      const updatedAction: VisualAssertAction = {
        ...action,
        regions: {
          ...action.regions,
          target_roi: roi,
        },
      };
      onUpdate(updatedAction);
    },
    [action, onUpdate]
  );

  /**
   * Handle clearing target ROI
   */
  const handleClearROI = useCallback(() => {
    const updatedAction: VisualAssertAction = {
      ...action,
      regions: {
        ...action.regions,
        target_roi: null,
      },
    };
    onUpdate(updatedAction);
  }, [action, onUpdate]);

  /**
   * Handle adding ignore region
   * Requirements: 7.1, 2.1
   */
  const handleAddIgnoreRegion = useCallback(
    (roi: VisionROI) => {
      const updatedAction: VisualAssertAction = {
        ...action,
        regions: {
          ...action.regions,
          ignore_regions: [...action.regions.ignore_regions, roi],
        },
      };
      onUpdate(updatedAction);
      setState(prev => ({ ...prev, drawingIgnoreRegion: false }));
    },
    [action, onUpdate]
  );

  /**
   * Handle removing ignore region
   */
  const handleRemoveIgnoreRegion = useCallback(
    (index: number) => {
      const updatedAction: VisualAssertAction = {
        ...action,
        regions: {
          ...action.regions,
          ignore_regions: action.regions.ignore_regions.filter((_, i) => i !== index),
        },
      };
      onUpdate(updatedAction);
      setState(prev => ({
        ...prev,
        selectedIgnoreRegion: prev.selectedIgnoreRegion === index ? null : prev.selectedIgnoreRegion
      }));
    },
    [action, onUpdate]
  );

  /**
   * Handle storage backend change
   */
  const handleStorageBackendChange = useCallback(
    (backend: StorageBackend) => {
      const updatedAction: VisualAssertAction = {
        ...action,
        assets: {
          ...action.assets,
          storage_backend: backend,
        },
      };
      onUpdate(updatedAction);
    },
    [action, onUpdate]
  );

  /**
   * Start drawing ignore region mode
   */
  const handleStartDrawingIgnoreRegion = useCallback(() => {
    setState(prev => ({ ...prev, drawingIgnoreRegion: true }));
  }, []);

  /**
   * Cancel drawing ignore region mode
   */
  const handleCancelDrawingIgnoreRegion = useCallback(() => {
    setState(prev => ({ ...prev, drawingIgnoreRegion: false }));
  }, []);

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------

  const currentScreenshotUrl = screenshotUrl || getScreenshotUrl(action, assetsBasePath);
  const isCustomConfig = !Object.keys(SENSITIVITY_PROFILES).some(profile => {
    const profileConfig = SENSITIVITY_PROFILES[profile as SensitivityProfile];
    return Object.keys(profileConfig).every(key =>
      action.config[key as keyof VisualAssertConfig] === profileConfig[key as keyof VisualAssertConfig]
    );
  });

  // Parse screen dimensions from context
  const [screenWidth, screenHeight] = action.context.screen_resolution.split('x').map(Number);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="visual-assertion-editor" data-testid="visual-assertion-editor">
      {/* Header */}
      <div className="visual-assertion-editor-header">
        <div className="visual-assertion-editor-title">
          <h3>Visual Assertion</h3>
          <span className="visual-assertion-editor-id">ID: {action.id.slice(0, 8)}...</span>
        </div>

        <div className="visual-assertion-editor-status">
          <span className="status-badge status-visual">
            <span className="status-icon">👁️</span>
            Visual Test
          </span>
          <span className="status-badge status-profile">
            {action.config.sensitivity_profile.charAt(0).toUpperCase() + action.config.sensitivity_profile.slice(1)}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="visual-assertion-editor-content">
        {/* Left Panel: Screenshot with ROI Tools */}
        <div className="visual-assertion-editor-screenshot-panel">
          <div className="screenshot-header">
            <h4>Screenshot & Regions</h4>
            <div className="screenshot-info">
              {action.context.screen_resolution} • {action.context.os_scaling_factor}x scale
            </div>
          </div>

          <ROITool
            imageUrl={currentScreenshotUrl}
            roi={state.drawingIgnoreRegion ? null : action.regions.target_roi}
            onROIChange={state.drawingIgnoreRegion ? handleAddIgnoreRegion : handleROIChange}
            imageDimensions={{
              width: screenWidth,
              height: screenHeight,
            }}
          />

          {/* ROI Controls */}
          <div className="roi-controls">
            <div className="roi-controls-section">
              <label>Target Region (ROI)</label>
              <div className="roi-controls-buttons">
                {action.regions.target_roi ? (
                  <button
                    className="btn-clear-roi"
                    onClick={handleClearROI}
                    data-testid="clear-roi-btn"
                  >
                    Clear ROI
                  </button>
                ) : (
                  <span className="roi-hint">Draw on screenshot to set ROI</span>
                )}
              </div>
            </div>

            <div className="roi-controls-section">
              <label>Ignore Regions</label>
              <div className="roi-controls-buttons">
                {state.drawingIgnoreRegion ? (
                  <button
                    className="btn-cancel-ignore"
                    onClick={handleCancelDrawingIgnoreRegion}
                    data-testid="cancel-ignore-btn"
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    className="btn-add-ignore"
                    onClick={handleStartDrawingIgnoreRegion}
                    data-testid="add-ignore-btn"
                  >
                    + Add Ignore Region
                  </button>
                )}
              </div>

              {/* Ignore Regions List */}
              {action.regions.ignore_regions.length > 0 && (
                <div className="ignore-regions-list">
                  {action.regions.ignore_regions.map((region, index) => (
                    <div key={index} className="ignore-region-item">
                      <span className="ignore-region-coords">
                        ({region.x}, {region.y}) {region.width}×{region.height}
                      </span>
                      <button
                        className="btn-remove-ignore"
                        onClick={() => handleRemoveIgnoreRegion(index)}
                        data-testid={`remove-ignore-${index}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {state.drawingIgnoreRegion && (
            <div className="drawing-mode-overlay">
              <div className="drawing-mode-message">
                Draw a rectangle to create an ignore region
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Configuration */}
        <div className="visual-assertion-editor-config-panel">
          {/* Sensitivity Profile */}
          <div className="config-section">
            <label className="config-label">Sensitivity Profile</label>
            <div className="sensitivity-profiles">
              {SENSITIVITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`sensitivity-btn ${action.config.sensitivity_profile === option.value ? 'active' : ''}`}
                  onClick={() => handleSensitivityProfileChange(option.value)}
                  title={option.description}
                  data-testid={`sensitivity-${option.value}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="config-hint">
              {SENSITIVITY_OPTIONS.find(opt => opt.value === action.config.sensitivity_profile)?.description}
            </p>
            {isCustomConfig && (
              <p className="config-warning">
                ⚠️ Custom configuration detected. Select a profile to reset to defaults.
              </p>
            )}
          </div>

          {/* Manual Configuration */}
          <div className="config-section">
            <label className="config-label">Advanced Settings</label>

            {/* Threshold */}
            <div className="config-field">
              <label htmlFor="threshold">Difference Threshold (%)</label>
              <input
                id="threshold"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={(action.config.threshold * 100).toFixed(1)}
                onChange={(e) => handleConfigChange({ threshold: parseFloat(e.target.value) / 100 })}
                data-testid="threshold-input"
              />
            </div>

            {/* Comparison Method */}
            <div className="config-field">
              <label htmlFor="comparison-method">Comparison Algorithm</label>
              <select
                id="comparison-method"
                value={action.config.comparison_method}
                onChange={(e) => handleConfigChange({ comparison_method: e.target.value as ComparisonMethod })}
                data-testid="comparison-method-select"
              >
                {COMPARISON_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="field-hint">
                {COMPARISON_METHOD_OPTIONS.find(opt => opt.value === action.config.comparison_method)?.description}
              </p>
            </div>

            {/* Timeout */}
            <div className="config-field">
              <label htmlFor="timeout">Stability Timeout (ms)</label>
              <input
                id="timeout"
                type="number"
                min="1000"
                max="30000"
                step="500"
                value={action.config.timeout}
                onChange={(e) => handleConfigChange({ timeout: parseInt(e.target.value) })}
                data-testid="timeout-input"
              />
            </div>

            {/* Retry Count */}
            <div className="config-field">
              <label htmlFor="retry-count">Retry Attempts</label>
              <input
                id="retry-count"
                type="number"
                min="0"
                max="10"
                value={action.config.retry_count}
                onChange={(e) => handleConfigChange({ retry_count: parseInt(e.target.value) })}
                data-testid="retry-count-input"
              />
            </div>

            {/* Anti-aliasing Tolerance */}
            <div className="config-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={action.config.anti_aliasing_tolerance}
                  onChange={(e) => handleConfigChange({ anti_aliasing_tolerance: e.target.checked })}
                  data-testid="anti-aliasing-checkbox"
                />
                Anti-aliasing Tolerance
              </label>
              <p className="field-hint">Ignore minor font rendering differences</p>
            </div>

            {/* Layout Shift Tolerance */}
            <div className="config-field">
              <label htmlFor="layout-shift">Layout Shift Tolerance (px)</label>
              <input
                id="layout-shift"
                type="number"
                min="0"
                max="10"
                value={action.config.layout_shift_tolerance}
                onChange={(e) => handleConfigChange({ layout_shift_tolerance: parseInt(e.target.value) })}
                data-testid="layout-shift-input"
              />
            </div>
          </div>

          {/* Storage Configuration */}
          <div className="config-section">
            <label className="config-label">Storage Backend</label>
            <select
              value={action.assets.storage_backend}
              onChange={(e) => handleStorageBackendChange(e.target.value as StorageBackend)}
              data-testid="storage-backend-select"
            >
              {STORAGE_BACKEND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="config-hint">
              {STORAGE_BACKEND_OPTIONS.find(opt => opt.value === action.assets.storage_backend)?.description}
            </p>
          </div>

          {/* Context Information */}
          <div className="config-section">
            <label className="config-label">Execution Context</label>
            <div className="context-info">
              <div className="context-item">
                <span className="context-label">Resolution:</span>
                <span className="context-value">{action.context.screen_resolution}</span>
              </div>
              <div className="context-item">
                <span className="context-label">OS Scale:</span>
                <span className="context-value">{action.context.os_scaling_factor}x</span>
              </div>
              <div className="context-item">
                <span className="context-label">Browser Zoom:</span>
                <span className="context-value">{action.context.browser_zoom}%</span>
              </div>
              <div className="context-item">
                <span className="context-label">Environment:</span>
                <span className="context-value">{action.context.execution_environment}</span>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {state.error && (
            <div className="visual-assertion-editor-error" data-testid="error-message">
              <span className="error-icon">⚠️</span>
              <span>{state.error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisualAssertionEditor;
