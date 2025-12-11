/**
 * VisionEditor Component
 *
 * Main editor component for AI Vision Capture actions.
 * Provides UI for configuring vision-based automation including:
 * - Screenshot display with ROI tool
 * - Prompt input for AI analysis
 * - Interaction type selection
 * - Search scope toggle (Global/Regional)
 * - Mode toggle (Static/Dynamic)
 * - AI analysis integration
 *
 * Requirements: 2.1, 2.3, 2.4, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7,
 *               4.2, 6.5, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  AIVisionCaptureAction,
  InteractionType,
  SearchScope,
  VisionROI,
  DynamicConfig,
  CacheData,
  DEFAULT_CACHE_DATA,
} from '../types/aiVisionCapture.types';
import { ROITool } from './ROITool';
import { aiVisionService } from '../services/aiVisionService';
import './VisionEditor.css';

// ============================================================================
// Types
// ============================================================================

export interface VisionEditorProps {
  /** The AI Vision Capture action to edit */
  action: AIVisionCaptureAction;
  /** Callback when action is updated */
  onUpdate: (action: AIVisionCaptureAction) => void;
  /** Optional callback for analyze action */
  onAnalyze?: () => Promise<void>;
  /** Base path for resolving asset paths */
  assetsBasePath?: string;
}

interface VisionEditorState {
  isAnalyzing: boolean;
  error: string | null;
  markerPosition: { x: number; y: number } | null;
}

// ============================================================================
// Constants
// ============================================================================

const INTERACTION_OPTIONS: { value: InteractionType; label: string }[] = [
  { value: 'click', label: 'Left Click' },
  { value: 'dblclick', label: 'Double Click' },
  { value: 'rclick', label: 'Right Click' },
  { value: 'hover', label: 'Hover' },
];

const SEARCH_SCOPE_OPTIONS: { value: SearchScope; label: string; description: string }[] = [
  { value: 'global', label: 'Global Search', description: 'Search entire screen' },
  { value: 'regional', label: 'Regional Search', description: 'Search within ROI only' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if cache_data has valid cached coordinates
 */
function hasValidCache(cacheData: CacheData): boolean {
  return cacheData.cached_x !== null && cacheData.cached_y !== null;
}

/**
 * Check if two DynamicConfig objects are equal (for cache invalidation)
 * Only compares fields that should trigger cache invalidation
 */
function dynamicConfigChanged(
  prev: DynamicConfig,
  next: DynamicConfig
): boolean {
  // Check prompt change
  if (prev.prompt !== next.prompt) return true;

  // Check ROI change
  if (prev.roi === null && next.roi !== null) return true;
  if (prev.roi !== null && next.roi === null) return true;
  if (prev.roi && next.roi) {
    if (
      prev.roi.x !== next.roi.x ||
      prev.roi.y !== next.roi.y ||
      prev.roi.width !== next.roi.width ||
      prev.roi.height !== next.roi.height
    ) {
      return true;
    }
  }

  // Check reference_images change
  if (prev.reference_images.length !== next.reference_images.length) return true;
  for (let i = 0; i < prev.reference_images.length; i++) {
    if (prev.reference_images[i] !== next.reference_images[i]) return true;
  }

  return false;
}

// ============================================================================
// VisionEditor Component
// ============================================================================

/**
 * VisionEditor Component
 *
 * Main editor for AI Vision Capture actions with:
 * - Screenshot display with ROI drawing tool
 * - Prompt textarea for AI description
 * - Interaction type selector
 * - Search scope toggle
 * - Mode toggle (Static/Dynamic)
 * - Analyze button with AI integration
 * - Cache invalidation logic
 */
export const VisionEditor: React.FC<VisionEditorProps> = ({
  action,
  onUpdate,
  onAnalyze,
  assetsBasePath = '',
}) => {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [state, setState] = useState<VisionEditorState>({
    isAnalyzing: false,
    error: null,
    markerPosition:
      action.static_data.saved_x !== null && action.static_data.saved_y !== null
        ? { x: action.static_data.saved_x, y: action.static_data.saved_y }
        : null,
  });

  // Track previous dynamic_config for cache invalidation
  const prevDynamicConfigRef = useRef<DynamicConfig>(action.dynamic_config);

  // -------------------------------------------------------------------------
  // Cache Invalidation Effect (Requirements: 7.1, 7.2, 7.3, 7.4)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const prevConfig = prevDynamicConfigRef.current;
    const currentConfig = action.dynamic_config;

    // Check if dynamic_config fields that should invalidate cache have changed
    if (dynamicConfigChanged(prevConfig, currentConfig)) {
      // If cache exists, invalidate it
      if (hasValidCache(action.cache_data)) {
        const updatedAction: AIVisionCaptureAction = {
          ...action,
          cache_data: { ...DEFAULT_CACHE_DATA },
        };
        onUpdate(updatedAction);
      }
    }

    // Update ref for next comparison
    prevDynamicConfigRef.current = currentConfig;
  }, [action.dynamic_config, action.cache_data, onUpdate]);

  // Update marker position when saved coordinates change
  useEffect(() => {
    if (action.static_data.saved_x !== null && action.static_data.saved_y !== null) {
      setState((prev) => ({
        ...prev,
        markerPosition: {
          x: action.static_data.saved_x!,
          y: action.static_data.saved_y!,
        },
      }));
    }
  }, [action.static_data.saved_x, action.static_data.saved_y]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  /**
   * Handle prompt change
   * Requirements: 2.4, 7.1
   */
  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newPrompt = e.target.value;
      const updatedAction: AIVisionCaptureAction = {
        ...action,
        dynamic_config: {
          ...action.dynamic_config,
          prompt: newPrompt,
        },
      };
      onUpdate(updatedAction);
    },
    [action, onUpdate]
  );

  /**
   * Handle interaction type change
   * Requirements: 2.7, 7.4
   */
  const handleInteractionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newInteraction = e.target.value as InteractionType;
      const updatedAction: AIVisionCaptureAction = {
        ...action,
        interaction: newInteraction,
      };
      // Note: interaction_type change does NOT invalidate cache (Req 7.4)
      onUpdate(updatedAction);
    },
    [action, onUpdate]
  );

  /**
   * Handle search scope change
   * Requirements: 2.3
   */
  const handleSearchScopeChange = useCallback(
    (scope: SearchScope) => {
      const updatedAction: AIVisionCaptureAction = {
        ...action,
        dynamic_config: {
          ...action.dynamic_config,
          search_scope: scope,
        },
      };
      onUpdate(updatedAction);
    },
    [action, onUpdate]
  );

  /**
   * Handle ROI change
   * Requirements: 2.2, 7.2
   */
  const handleROIChange = useCallback(
    (roi: VisionROI) => {
      const updatedAction: AIVisionCaptureAction = {
        ...action,
        dynamic_config: {
          ...action.dynamic_config,
          roi,
        },
      };
      onUpdate(updatedAction);
    },
    [action, onUpdate]
  );

  /**
   * Handle marker drag (manual coordinate adjustment)
   * Requirements: 3.5
   */
  const handleMarkerDrag = useCallback(
    (position: { x: number; y: number }) => {
      setState((prev) => ({ ...prev, markerPosition: position }));

      const updatedAction: AIVisionCaptureAction = {
        ...action,
        static_data: {
          ...action.static_data,
          saved_x: position.x,
          saved_y: position.y,
        },
      };
      onUpdate(updatedAction);
    },
    [action, onUpdate]
  );

  /**
   * Handle mode toggle (Static/Dynamic)
   * Requirements: 4.2, 7.4
   */
  const handleModeToggle = useCallback(() => {
    const updatedAction: AIVisionCaptureAction = {
      ...action,
      is_dynamic: !action.is_dynamic,
    };
    // Note: is_dynamic toggle does NOT invalidate cache (Req 7.4)
    onUpdate(updatedAction);
  }, [action, onUpdate]);

  /**
   * Handle Analyze button click
   * Requirements: 3.2, 3.3, 3.4, 3.7
   */
  const handleAnalyze = useCallback(async () => {
    // Clear previous error
    setState((prev) => ({ ...prev, isAnalyzing: true, error: null }));

    try {
      // If custom onAnalyze provided, use it
      if (onAnalyze) {
        await onAnalyze();
        setState((prev) => ({ ...prev, isAnalyzing: false }));
        return;
      }

      // Validate prompt
      if (!action.dynamic_config.prompt.trim()) {
        setState((prev) => ({
          ...prev,
          isAnalyzing: false,
          error: 'Please enter a prompt describing the target element.',
        }));
        return;
      }

      // Check if AI service is initialized
      if (!aiVisionService.isInitialized()) {
        setState((prev) => ({
          ...prev,
          isAnalyzing: false,
          error: 'AI Vision service not initialized. Please configure your API key.',
        }));
        return;
      }

      // Prepare request
      const screenshotPath = assetsBasePath
        ? `${assetsBasePath}/${action.static_data.original_screenshot}`
        : action.static_data.original_screenshot;

      const response = await aiVisionService.analyze({
        screenshot: screenshotPath,
        prompt: action.dynamic_config.prompt,
        reference_images: action.dynamic_config.reference_images.map((img) =>
          assetsBasePath ? `${assetsBasePath}/${img}` : img
        ),
        roi:
          action.dynamic_config.search_scope === 'regional'
            ? action.dynamic_config.roi || undefined
            : undefined,
      });

      if (response.success && response.x !== undefined && response.y !== undefined) {
        // Update marker position and saved coordinates
        const newPosition = { x: response.x, y: response.y };
        setState((prev) => ({
          ...prev,
          isAnalyzing: false,
          markerPosition: newPosition,
          error: null,
        }));

        // Update action with new coordinates
        const updatedAction: AIVisionCaptureAction = {
          ...action,
          static_data: {
            ...action.static_data,
            saved_x: response.x,
            saved_y: response.y,
          },
        };
        onUpdate(updatedAction);
      } else {
        // Analysis failed
        setState((prev) => ({
          ...prev,
          isAnalyzing: false,
          error: response.error || 'Failed to locate element. Please try a different prompt.',
        }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      setState((prev) => ({
        ...prev,
        isAnalyzing: false,
        error: errorMessage,
      }));
    }
  }, [action, onUpdate, onAnalyze, assetsBasePath]);

  /**
   * Clear ROI
   */
  const handleClearROI = useCallback(() => {
    const updatedAction: AIVisionCaptureAction = {
      ...action,
      dynamic_config: {
        ...action.dynamic_config,
        roi: null,
      },
    };
    onUpdate(updatedAction);
  }, [action, onUpdate]);

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------

  const hasCoordinates =
    action.static_data.saved_x !== null && action.static_data.saved_y !== null;
  const hasCachedCoordinates = hasValidCache(action.cache_data);
  const isReadyForPlayback = !action.is_dynamic && hasCoordinates;

  // Resolve screenshot URL
  const screenshotUrl = assetsBasePath
    ? `${assetsBasePath}/${action.static_data.original_screenshot}`
    : action.static_data.original_screenshot;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="vision-editor" data-testid="vision-editor">
      {/* Header with Mode Toggle and Status */}
      <div className="vision-editor-header">
        <div className="vision-editor-title">
          <h3>AI Vision Capture</h3>
          <span className="vision-editor-id">ID: {action.id.slice(0, 8)}...</span>
        </div>

        {/* Mode Status Indicators (Requirements: 6.6, 6.7) */}
        <div className="vision-editor-status">
          {action.is_dynamic ? (
            <span className="status-badge status-dynamic" data-testid="status-dynamic">
              <span className="status-icon">🔮</span>
              Dynamic Mode
            </span>
          ) : (
            <span className="status-badge status-static" data-testid="status-static">
              <span className="status-icon">📍</span>
              Static Mode
            </span>
          )}

          {isReadyForPlayback && (
            <span className="status-badge status-ready" data-testid="status-ready">
              <span className="status-icon">✓</span>
              Ready (0 Token Cost)
            </span>
          )}

          {hasCachedCoordinates && action.is_dynamic && (
            <span className="status-badge status-cached" data-testid="status-cached">
              <span className="status-icon">💾</span>
              Cached
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="vision-editor-content">
        {/* Left Panel: Screenshot with ROI Tool */}
        <div className="vision-editor-screenshot-panel">
          <ROITool
            imageUrl={screenshotUrl}
            roi={action.dynamic_config.roi}
            onROIChange={handleROIChange}
            markerPosition={state.markerPosition}
            onMarkerDrag={handleMarkerDrag}
            imageDimensions={{
              width: action.static_data.screen_dim[0],
              height: action.static_data.screen_dim[1],
            }}
          />

          {/* ROI Controls */}
          {action.dynamic_config.roi && (
            <div className="vision-editor-roi-controls">
              <button
                className="btn-clear-roi"
                onClick={handleClearROI}
                data-testid="clear-roi-btn"
              >
                Clear ROI
              </button>
            </div>
          )}

          {/* Analyzing Overlay (Requirement: 6.5) */}
          {state.isAnalyzing && (
            <div className="vision-editor-analyzing-overlay" data-testid="analyzing-overlay">
              <div className="analyzing-spinner"></div>
              <span>Analyzing...</span>
            </div>
          )}
        </div>

        {/* Right Panel: Configuration */}
        <div className="vision-editor-config-panel">
          {/* Mode Toggle (Requirement: 4.2) */}
          <div className="config-section">
            <label className="config-label">Mode</label>
            <div className="mode-toggle">
              <button
                className={`mode-btn ${!action.is_dynamic ? 'active' : ''}`}
                onClick={() => action.is_dynamic && handleModeToggle()}
                data-testid="mode-static-btn"
              >
                Static
              </button>
              <button
                className={`mode-btn ${action.is_dynamic ? 'active' : ''}`}
                onClick={() => !action.is_dynamic && handleModeToggle()}
                data-testid="mode-dynamic-btn"
              >
                Dynamic
              </button>
            </div>
            <p className="config-hint">
              {action.is_dynamic
                ? 'AI will find the element at runtime (uses tokens)'
                : 'Use saved coordinates (0 token cost)'}
            </p>
          </div>

          {/* Prompt Input (Requirement: 2.4) */}
          <div className="config-section">
            <label className="config-label" htmlFor="vision-prompt">
              Target Description
            </label>
            <textarea
              id="vision-prompt"
              className="config-textarea"
              value={action.dynamic_config.prompt}
              onChange={handlePromptChange}
              placeholder="Describe the UI element to find (e.g., 'Click the blue Submit button')"
              rows={3}
              data-testid="prompt-input"
            />
          </div>

          {/* Interaction Type (Requirement: 2.7) */}
          <div className="config-section">
            <label className="config-label" htmlFor="interaction-type">
              Interaction Type
            </label>
            <select
              id="interaction-type"
              className="config-select"
              value={action.interaction}
              onChange={handleInteractionChange}
              data-testid="interaction-select"
            >
              {INTERACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search Scope (Requirement: 2.3) */}
          <div className="config-section">
            <label className="config-label">Search Scope</label>
            <div className="search-scope-toggle">
              {SEARCH_SCOPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`scope-btn ${action.dynamic_config.search_scope === opt.value ? 'active' : ''}`}
                  onClick={() => handleSearchScopeChange(opt.value)}
                  title={opt.description}
                  data-testid={`scope-${opt.value}-btn`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="config-hint">
              {action.dynamic_config.search_scope === 'regional'
                ? 'Draw a region on the screenshot to limit search area'
                : 'AI will search the entire screen'}
            </p>
          </div>

          {/* Analyze Button (Requirements: 3.2, 3.3) */}
          <div className="config-section">
            <button
              className="btn-analyze"
              onClick={handleAnalyze}
              disabled={state.isAnalyzing || !action.dynamic_config.prompt.trim()}
              data-testid="analyze-btn"
            >
              {state.isAnalyzing ? 'Analyzing...' : '🔍 Analyze'}
            </button>
          </div>

          {/* Error Display (Requirement: 3.7) */}
          {state.error && (
            <div className="vision-editor-error" data-testid="error-message">
              <span className="error-icon">⚠️</span>
              <span>{state.error}</span>
            </div>
          )}

          {/* Coordinates Display */}
          {hasCoordinates && (
            <div className="config-section coordinates-display" data-testid="coordinates-display">
              <label className="config-label">Saved Coordinates</label>
              <div className="coordinates-value">
                X: {action.static_data.saved_x}, Y: {action.static_data.saved_y}
              </div>
              <p className="config-hint">
                Drag the marker on the screenshot to adjust
              </p>
            </div>
          )}

          {/* Cache Info (for Dynamic Mode) */}
          {action.is_dynamic && hasCachedCoordinates && (
            <div className="config-section cache-display" data-testid="cache-display">
              <label className="config-label">Cached Coordinates</label>
              <div className="coordinates-value">
                X: {action.cache_data.cached_x}, Y: {action.cache_data.cached_y}
              </div>
              <p className="config-hint">
                From previous successful AI run (0 token cost on next playback)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisionEditor;
