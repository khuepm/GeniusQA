/**
 * ActionCanvas Component
 * 
 * Right pane of the dual-pane editor interface for managing actions within selected test steps.
 * Displays filtered actions for the selected step and provides action detail editing capabilities.
 * 
 * Requirements: 4.2, 4.4
 */

import React, { useState, useCallback, useMemo } from 'react';
import { ActionWithId, TestStep } from '../types/testCaseDriven.types';
import { VisionEditor } from './VisionEditor';
import { ReferenceImageManager } from './ReferenceImageManager';
import { AIVisionCaptureAction } from '../types/aiVisionCapture.types';
import { VisualAssertionEditor } from './VisualAssertionEditor';
import { VisualAssertAction, createVisualAssertAction } from '../types/visualTesting.types';
import './ActionCanvas.css';

interface ActionCanvasProps {
  /** Currently selected test step */
  selectedStep: TestStep | null;
  /** Action pool containing all actions */
  actionPool: Record<string, ActionWithId>;
  /** Whether the editor is in edit mode */
  editMode: boolean;
  /** Callback for updating an action */
  onActionUpdate: (actionId: string, updatedAction: ActionWithId) => void;
  /** Callback for deleting an action */
  onActionDelete: (actionId: string) => void;
  /** Callback for inserting a new action at a specific position */
  onActionInsert: (stepId: string, position: number, action: ActionWithId) => void;
  /** Assets base path for reference images */
  assetsBasePath?: string;
  /** Callback for saving reference images */
  onSaveReferenceImage?: (imageData: Blob, actionId: string) => Promise<string>;
}

interface ActionEditState {
  actionId: string | null;
  field: string | null;
  value: any;
}

export const ActionCanvas: React.FC<ActionCanvasProps> = ({
  selectedStep,
  actionPool,
  editMode,
  onActionUpdate,
  onActionDelete,
  onActionInsert,
  assetsBasePath = '',
  onSaveReferenceImage,
}) => {
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [editState, setEditState] = useState<ActionEditState>({
    actionId: null,
    field: null,
    value: null,
  });
  const [showInsertForm, setShowInsertForm] = useState<number | null>(null);

  const toVisualAssertAction = useCallback((action: ActionWithId): VisualAssertAction | null => {
    if (action.type !== 'visual_assert') return null;

    const config = action.config;
    const regions = action.regions;
    const assets = action.assets;
    const context = action.context;

    if (!config || !regions || !assets || !context) return null;

    return {
      type: 'visual_assert',
      id: action.id,
      timestamp: action.timestamp,
      config,
      regions,
      assets,
      context,
    } as VisualAssertAction;
  }, []);

  const getDefaultVisualAssertContext = useCallback(() => {
    const w = typeof window !== 'undefined' ? window : null;
    const screenW = w?.screen?.width ?? 0;
    const screenH = w?.screen?.height ?? 0;
    const devicePixelRatio = w?.devicePixelRatio ?? 1;

    return {
      screen_resolution: `${screenW}x${screenH}`,
      os_scaling_factor: devicePixelRatio,
      browser_zoom: 100,
      execution_environment: 'desktop' as const,
    };
  }, []);

  /**
   * Get filtered actions for the selected step
   */
  const filteredActions = useMemo(() => {
    if (!selectedStep) return [];

    return selectedStep.action_ids
      .map(actionId => actionPool[actionId])
      .filter(Boolean) // Remove any undefined actions
      .sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp
  }, [selectedStep, actionPool]);

  /**
   * Handle action field editing
   */
  const handleFieldEdit = useCallback((actionId: string, field: string, value: any) => {
    if (!editMode) return;

    setEditState({ actionId, field, value });
  }, [editMode]);

  /**
   * Handle saving field edit
   */
  const handleFieldSave = useCallback((actionId: string, field: string, value: any) => {
    if (!editMode) return;

    const action = actionPool[actionId];
    if (!action) return;

    const updatedAction: ActionWithId = {
      ...action,
      [field]: value,
    };

    onActionUpdate(actionId, updatedAction);
    setEditState({ actionId: null, field: null, value: null });
  }, [editMode, actionPool, onActionUpdate]);

  /**
   * Handle canceling field edit
   */
  const handleFieldCancel = useCallback(() => {
    setEditState({ actionId: null, field: null, value: null });
  }, []);

  /**
   * Handle action deletion
   */
  const handleActionDelete = useCallback((actionId: string) => {
    if (!editMode) return;

    const action = actionPool[actionId];
    if (!action) return;

    if (confirm(`Delete ${action.type} action at ${action.timestamp.toFixed(3)}s?`)) {
      onActionDelete(actionId);
    }
  }, [editMode, actionPool, onActionDelete]);

  /**
   * Handle expanding/collapsing action details
   */
  const handleActionToggle = useCallback((actionId: string) => {
    setExpandedActionId(prev => prev === actionId ? null : actionId);
  }, []);

  /**
   * Handle AI Vision action update
   */
  const handleVisionActionUpdate = useCallback((actionId: string, updatedAction: AIVisionCaptureAction) => {
    if (!editMode) return;

    // Convert AIVisionCaptureAction back to ActionWithId
    const actionWithId: ActionWithId = {
      ...updatedAction,
      id: actionId,
    };

    onActionUpdate(actionId, actionWithId);
  }, [editMode, onActionUpdate]);

  /**
   * Convert ActionWithId to AIVisionCaptureAction for VisionEditor
   */
  const toVisionCaptureAction = useCallback((action: ActionWithId): AIVisionCaptureAction | null => {
    if (action.type !== 'ai_vision_capture') return null;

    return {
      type: 'ai_vision_capture',
      id: action.id,
      timestamp: action.timestamp,
      is_dynamic: action.is_dynamic || false,
      interaction: (action.interaction as 'click' | 'dblclick' | 'rclick' | 'hover') || 'click',
      static_data: action.static_data || {
        original_screenshot: '',
        saved_x: null,
        saved_y: null,
        screen_dim: [1920, 1080],
      },
      dynamic_config: action.dynamic_config || {
        prompt: '',
        reference_images: [],
        roi: null,
        search_scope: 'global',
      },
      cache_data: action.cache_data || {
        cached_x: null,
        cached_y: null,
        cache_dim: null,
      },
      is_assertion: action.is_assertion || false,
    };
  }, []);

  /**
   * Handle inserting new action
   */
  const handleInsertAction = useCallback((position: number) => {
    if (!editMode || !selectedStep) return;
    setShowInsertForm(position);
  }, [editMode, selectedStep]);

  /**
   * Handle saving inserted action
   */
  const handleSaveInsertedAction = useCallback((position: number, actionType: string) => {
    if (!editMode || !selectedStep) return;

    const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now() / 1000;

    if (actionType === 'visual_assert') {
      const baselinePath = `assets/visual_baseline_${actionId}.png`;
      const visualAction = createVisualAssertAction(actionId, timestamp, baselinePath, getDefaultVisualAssertContext());

      const newAction: ActionWithId = {
        id: visualAction.id,
        type: 'visual_assert',
        timestamp: visualAction.timestamp,
        x: null,
        y: null,
        button: null,
        key: null,
        screenshot: null,
        config: visualAction.config,
        regions: visualAction.regions,
        assets: visualAction.assets,
        context: visualAction.context,
      };

      onActionInsert(selectedStep.id, position, newAction);
      setShowInsertForm(null);
      return;
    }

    // Create a new action based on type
    const newAction: ActionWithId = {
      id: actionId,
      type: actionType as any,
      timestamp,
      x: actionType.includes('mouse') ? 0 : null,
      y: actionType.includes('mouse') ? 0 : null,
      button: actionType === 'mouse_click' ? 'left' : null,
      key: actionType.includes('key') ? '' : null,
      screenshot: null,
    };

    onActionInsert(selectedStep.id, position, newAction);
    setShowInsertForm(null);
  }, [editMode, selectedStep, onActionInsert, getDefaultVisualAssertContext]);

  /**
   * Render editable field
   */
  const renderEditableField = useCallback((
    actionId: string,
    field: string,
    value: any,
    type: 'text' | 'number' = 'text'
  ) => {
    const isEditing = editState.actionId === actionId && editState.field === field;

    if (isEditing) {
      return (
        <div className="field-edit">
          <input
            type={type}
            value={editState.value}
            onChange={(e) => setEditState(prev => ({
              ...prev,
              value: type === 'number' ? parseFloat(e.target.value) : e.target.value
            }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleFieldSave(actionId, field, editState.value);
              } else if (e.key === 'Escape') {
                handleFieldCancel();
              }
            }}
            className="field-input"
            autoFocus
          />
          <div className="field-actions">
            <button
              onClick={() => handleFieldSave(actionId, field, editState.value)}
              className="field-btn save-btn"
            >
              ✓
            </button>
            <button
              onClick={handleFieldCancel}
              className="field-btn cancel-btn"
            >
              ✕
            </button>
          </div>
        </div>
      );
    }

    return (
      <span
        className={`field-value ${editMode ? 'editable' : ''}`}
        onClick={() => editMode && handleFieldEdit(actionId, field, value)}
        title={editMode ? 'Click to edit' : ''}
      >
        {value}
      </span>
    );
  }, [editState, editMode, handleFieldEdit, handleFieldSave, handleFieldCancel]);

  /**
   * Render action item
   */
  const renderActionItem = useCallback((action: ActionWithId, index: number) => {
    const isExpanded = expandedActionId === action.id;
    const isVisionAction = action.type === 'ai_vision_capture';
    const isVisualAssertAction = action.type === 'visual_assert';

    return (
      <div key={action.id} className={`action-item ${isExpanded ? 'expanded' : ''}`}>
        {/* Insert action button (above) */}
        {editMode && (
          <div className="action-insert-zone">
            <button
              onClick={() => handleInsertAction(index)}
              className="insert-action-btn"
              title="Insert action here"
            >
              + Insert Action
            </button>
          </div>
        )}

        {isVisualAssertAction && isExpanded && (
          <div className="vision-editor-container">
            {(() => {
              const visualAction = toVisualAssertAction(action);
              if (!visualAction) return null;

              return (
                <VisualAssertionEditor
                  action={visualAction}
                  onUpdate={(updated) => {
                    const updatedAction: ActionWithId = {
                      ...action,
                      type: 'visual_assert',
                      timestamp: updated.timestamp,
                      config: updated.config,
                      regions: updated.regions,
                      assets: updated.assets,
                      context: updated.context,
                    };
                    onActionUpdate(action.id, updatedAction);
                  }}
                  assetsBasePath={assetsBasePath}
                />
              );
            })()}
          </div>
        )}

        {/* Action header */}
        <div className="action-header">
          <div className="action-info">
            <span className="action-index">#{index + 1}</span>
            <span className={`action-type ${isVisionAction ? 'vision-action' : ''}`}>
              {isVisionAction ? '🔍 AI Vision Capture' : (isVisualAssertAction ? '🧪 Visual Assert' : action.type)}
            </span>
            {action.is_assertion && (
              <span className="assertion-badge">Assertion</span>
            )}
          </div>
          <div className="action-controls">
            {(isVisionAction || isVisualAssertAction) && (
              <button
                onClick={() => handleActionToggle(action.id)}
                className="expand-btn"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {editMode && (
              <button
                onClick={() => handleActionDelete(action.id)}
                className="delete-btn"
                title="Delete action"
              >
                🗑️
              </button>
            )}
          </div>
        </div>

        {/* Action details */}
        <div className="action-details">
          <div className="detail-row">
            <span className="detail-label">Time:</span>
            <span className="detail-value">{action.timestamp.toFixed(3)}s</span>
          </div>

          {action.x !== null && (
            <div className="detail-row">
              <span className="detail-label">X:</span>
              {renderEditableField(action.id, 'x', action.x, 'number')}
            </div>
          )}

          {action.y !== null && (
            <div className="detail-row">
              <span className="detail-label">Y:</span>
              {renderEditableField(action.id, 'y', action.y, 'number')}
            </div>
          )}

          {action.button && (
            <div className="detail-row">
              <span className="detail-label">Button:</span>
              <span className="detail-value">{action.button}</span>
            </div>
          )}

          {action.key && (
            <div className="detail-row">
              <span className="detail-label">Key:</span>
              {renderEditableField(action.id, 'key', action.key)}
            </div>
          )}

          {/* AI Vision specific details */}
          {isVisionAction && (
            <>
              <div className="detail-row">
                <span className="detail-label">Mode:</span>
                <span className="detail-value">
                  {action.is_dynamic ? 'Dynamic' : 'Static'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Interaction:</span>
                <span className="detail-value">{action.interaction || 'click'}</span>
              </div>
              {action.static_data?.saved_x !== null && action.static_data?.saved_y !== null && (
                <div className="detail-row">
                  <span className="detail-label">Saved Coords:</span>
                  <span className="detail-value">
                    ({action.static_data.saved_x}, {action.static_data.saved_y})
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Expanded AI Vision editor */}
        {isVisionAction && isExpanded && (
          <div className="vision-editor-container">
            {(() => {
              const visionAction = toVisionCaptureAction(action);
              if (!visionAction) return null;

              return (
                <>
                  <VisionEditor
                    action={visionAction}
                    onUpdate={(updatedAction) => handleVisionActionUpdate(action.id, updatedAction)}
                    onAnalyze={() => {/* Handle analysis */ }}
                    assetsBasePath={assetsBasePath}
                    disabled={!editMode}
                  />

                  {/* Reference Image Manager */}
                  {onSaveReferenceImage && (
                    <div className="reference-images-section">
                      <ReferenceImageManager
                        images={visionAction.dynamic_config.reference_images}
                        onImagesChange={(images) => {
                          const updated: AIVisionCaptureAction = {
                            ...visionAction,
                            dynamic_config: {
                              ...visionAction.dynamic_config,
                              reference_images: images,
                            },
                          };
                          handleVisionActionUpdate(action.id, updated);
                        }}
                        assetsBasePath={assetsBasePath}
                        onSaveImage={onSaveReferenceImage}
                        actionId={visionAction.id}
                        disabled={!editMode}
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Insert form */}
        {showInsertForm === index && (
          <div className="insert-form">
            <h4>Insert New Action</h4>
            <div className="action-type-buttons">
              <button onClick={() => handleSaveInsertedAction(index, 'mouse_click')}>
                Mouse Click
              </button>
              <button onClick={() => handleSaveInsertedAction(index, 'mouse_move')}>
                Mouse Move
              </button>
              <button onClick={() => handleSaveInsertedAction(index, 'key_press')}>
                Key Press
              </button>
              <button onClick={() => handleSaveInsertedAction(index, 'ai_vision_capture')}>
                AI Vision Capture
              </button>
              <button onClick={() => handleSaveInsertedAction(index, 'visual_assert')}>
                Visual Assert
              </button>
            </div>
            <button onClick={() => setShowInsertForm(null)} className="cancel-insert">
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }, [
    expandedActionId,
    editMode,
    handleInsertAction,
    handleActionToggle,
    handleActionDelete,
    renderEditableField,
    toVisionCaptureAction,
    toVisualAssertAction,
    handleVisionActionUpdate,
    assetsBasePath,
    onSaveReferenceImage,
    showInsertForm,
    handleSaveInsertedAction,
    onActionUpdate,
  ]);

  /**
   * Render empty state
   */
  const renderEmptyState = useCallback(() => {
    if (!selectedStep) {
      return (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>No Step Selected</h3>
          <p>Select a test step from the left panel to view and edit its actions.</p>
        </div>
      );
    }

    return (
      <div className="empty-state">
        <div className="empty-icon">🎬</div>
        <h3>No Actions Recorded</h3>
        <p>
          This step has no recorded actions yet.
          {editMode && ' Start recording or insert actions manually.'}
        </p>
        {editMode && (
          <button
            onClick={() => handleInsertAction(0)}
            className="add-first-action-btn"
          >
            + Add First Action
          </button>
        )}
      </div>
    );
  }, [selectedStep, editMode, handleInsertAction]);

  return (
    <div className="action-canvas">
      <div className="canvas-header">
        <h2 className="canvas-title">
          {selectedStep ? `Actions for Step ${selectedStep.order}` : 'Action Details'}
        </h2>
        {selectedStep && (
          <div className="step-info">
            <span className="step-description">{selectedStep.description}</span>
            <span className="action-count">
              {filteredActions.length} action{filteredActions.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      <div className="canvas-content">
        {filteredActions.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="actions-list">
            {filteredActions.map((action, index) => renderActionItem(action, index))}

            {/* Insert action at end */}
            {editMode && (
              <div className="action-insert-zone final">
                <button
                  onClick={() => handleInsertAction(filteredActions.length)}
                  className="insert-action-btn"
                  title="Insert action at end"
                >
                  + Insert Action
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionCanvas;
