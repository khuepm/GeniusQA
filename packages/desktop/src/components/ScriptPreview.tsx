/**
 * Script Preview Component
 * 
 * Displays AI-generated scripts with human-readable descriptions,
 * validation errors/warnings, and editing capabilities.
 * 
 * Requirements: 3.5, 4.1, 4.2, 4.3, 4.5
 */

import React, { useCallback, useMemo, useState } from 'react';
import { validateAction, validateScript } from '../services/scriptValidationService';
import {
  Action,
  ACTION_TYPE_DESCRIPTIONS,
  ScriptData,
  ScriptPreviewProps,
  ValidationError,
  ValidationResult,
  ValidationWarning
} from '../types/aiScriptBuilder.types';
import './ScriptPreview.css';

/**
 * Generates a human-readable description for an action
 */
export function getActionDescription(action: Action): string {
  const baseDescription = ACTION_TYPE_DESCRIPTIONS[action.type] || action.type;

  switch (action.type) {
    case 'mouse_move':
      return `${baseDescription} (${action.x}, ${action.y})`;
    case 'mouse_click':
    case 'mouse_double_click':
      return `${baseDescription} (${action.x}, ${action.y}) - ${action.button || 'left'}`;
    case 'mouse_drag':
      return `${baseDescription} từ (${action.x}, ${action.y})`;
    case 'mouse_scroll':
      return `${baseDescription} tại (${action.x}, ${action.y})`;
    case 'key_press':
    case 'key_release':
      const modifiers = action.modifiers?.length ? `${action.modifiers.join('+')}+` : '';
      return `${baseDescription}: ${modifiers}${action.key}`;
    case 'key_type':
      const text = action.text || '';
      const displayText = text.length > 30 ? `${text.substring(0, 30)}...` : text;
      return `${baseDescription}: "${displayText}"`;
    case 'wait':
      return `${baseDescription} ${action.timestamp}ms`;
    case 'screenshot':
      return baseDescription;
    case 'custom':
      return `${baseDescription}: ${JSON.stringify(action.additional_data || {})}`;
    default:
      return baseDescription;
  }
}

/**
 * Formats timestamp to human-readable format
 */
function formatTimestamp(timestamp: number): string {
  if (timestamp < 1000) {
    return `${timestamp}ms`;
  }
  const seconds = (timestamp / 1000).toFixed(2);
  return `${seconds}s`;
}

/**
 * Gets errors for a specific action index
 */
function getActionErrors(
  errors: ValidationError[],
  actionIndex: number
): ValidationError[] {
  return errors.filter(e => e.actionIndex === actionIndex);
}

/**
 * Gets warnings for a specific action index
 */
function getActionWarnings(
  warnings: ValidationWarning[],
  actionIndex: number
): ValidationWarning[] {
  return warnings.filter(w => w.actionIndex === actionIndex);
}

/**
 * Action Item Component - displays a single action with editing capability
 */
interface ActionItemProps {
  action: Action;
  index: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  isEditing: boolean;
  onEdit: (index: number) => void;
  onSaveAction: (index: number, action: Action) => void;
  onCancelEdit: () => void;
}

const ActionItem: React.FC<ActionItemProps> = ({
  action,
  index,
  errors,
  warnings,
  isEditing,
  onEdit,
  onSaveAction,
  onCancelEdit,
}) => {
  const [editedAction, setEditedAction] = useState<Action>(action);
  const [localErrors, setLocalErrors] = useState<ValidationError[]>([]);

  const handleFieldChange = useCallback((field: keyof Action, value: unknown) => {
    const updated = { ...editedAction, [field]: value };
    setEditedAction(updated);

    // Real-time validation
    const result = validateAction(updated, index);
    setLocalErrors(result.errors);
  }, [editedAction, index]);

  const handleSave = useCallback(() => {
    const result = validateAction(editedAction, index);
    if (result.valid) {
      onSaveAction(index, editedAction);
    } else {
      setLocalErrors(result.errors);
    }
  }, [editedAction, index, onSaveAction]);

  const hasErrors = errors.length > 0 || localErrors.length > 0;
  const hasWarnings = warnings.length > 0;

  return (
    <div
      className={`action-item ${hasErrors ? 'action-item-error' : ''} ${hasWarnings && !hasErrors ? 'action-item-warning' : ''}`}
      data-testid={`action-item-${index}`}
    >
      <div className="action-item-header">
        <span className="action-index">{index + 1}</span>
        <span className="action-type-badge">{action.type}</span>
        <span className="action-timestamp">{formatTimestamp(action.timestamp)}</span>
        {!isEditing && (
          <button
            className="action-edit-button"
            onClick={() => onEdit(index)}
            aria-label={`Edit action ${index + 1}`}
          >
            ✏️
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="action-edit-form">
          <div className="action-edit-field">
            <label>Timestamp (ms)</label>
            <input
              type="number"
              value={editedAction.timestamp}
              onChange={(e) => handleFieldChange('timestamp', Number(e.target.value))}
              min={0}
            />
          </div>

          {['mouse_move', 'mouse_click', 'mouse_double_click', 'mouse_drag', 'mouse_scroll'].includes(action.type) && (
            <>
              <div className="action-edit-field">
                <label>X Coordinate</label>
                <input
                  type="number"
                  value={editedAction.x ?? 0}
                  onChange={(e) => handleFieldChange('x', Number(e.target.value))}
                  min={0}
                />
              </div>
              <div className="action-edit-field">
                <label>Y Coordinate</label>
                <input
                  type="number"
                  value={editedAction.y ?? 0}
                  onChange={(e) => handleFieldChange('y', Number(e.target.value))}
                  min={0}
                />
              </div>
            </>
          )}

          {['mouse_click', 'mouse_double_click'].includes(action.type) && (
            <div className="action-edit-field">
              <label>Button</label>
              <select
                value={editedAction.button || 'left'}
                onChange={(e) => handleFieldChange('button', e.target.value)}
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="middle">Middle</option>
              </select>
            </div>
          )}

          {['key_press', 'key_release'].includes(action.type) && (
            <div className="action-edit-field">
              <label>Key</label>
              <input
                type="text"
                value={editedAction.key || ''}
                onChange={(e) => handleFieldChange('key', e.target.value)}
              />
            </div>
          )}

          {action.type === 'key_type' && (
            <div className="action-edit-field">
              <label>Text</label>
              <textarea
                value={editedAction.text || ''}
                onChange={(e) => handleFieldChange('text', e.target.value)}
                rows={3}
              />
            </div>
          )}

          {localErrors.length > 0 && (
            <div className="action-edit-errors">
              {localErrors.map((err, i) => (
                <div key={i} className="validation-error-inline">
                  ❌ {err.field}: {err.message}
                </div>
              ))}
            </div>
          )}

          <div className="action-edit-buttons">
            <button className="action-save-button" onClick={handleSave}>
              Save
            </button>
            <button className="action-cancel-button" onClick={onCancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="action-description">
            {getActionDescription(action)}
          </div>

          {errors.length > 0 && (
            <div className="action-errors">
              {errors.map((err, i) => (
                <div key={i} className="validation-error">
                  ❌ {err.message}
                </div>
              ))}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="action-warnings">
              {warnings.map((warn, i) => (
                <div key={i} className="validation-warning">
                  ⚠️ {warn.message}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};


/**
 * Script Preview Component
 * 
 * Main component for displaying and editing AI-generated scripts
 */
export const ScriptPreview: React.FC<ScriptPreviewProps> = ({
  script,
  onEdit,
  onSave,
  onDiscard,
  onPlay,
  validationResult,
  isSaved = false,
  isPlaying = false,
  playbackProgress,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [localScript, setLocalScript] = useState<ScriptData | null>(script);
  const [localValidation, setLocalValidation] = useState<ValidationResult>(validationResult);

  // Update local state when props change
  React.useEffect(() => {
    setLocalScript(script);
    setLocalValidation(validationResult);
  }, [script, validationResult]);

  // Get global errors (not associated with specific actions)
  const globalErrors = useMemo(() => {
    return localValidation.errors.filter(e => e.actionIndex === undefined);
  }, [localValidation.errors]);

  const globalWarnings = useMemo(() => {
    return localValidation.warnings.filter(w => w.actionIndex === undefined);
  }, [localValidation.warnings]);

  const handleEditAction = useCallback((index: number) => {
    setEditingIndex(index);
  }, []);

  const handleSaveAction = useCallback((index: number, updatedAction: Action) => {
    if (!localScript) return;

    const newActions = [...localScript.actions];
    newActions[index] = updatedAction;

    const newScript: ScriptData = {
      ...localScript,
      actions: newActions,
      metadata: {
        ...localScript.metadata,
        action_count: newActions.length,
      },
    };

    // Re-validate the entire script
    const newValidation = validateScript(newScript);

    setLocalScript(newScript);
    setLocalValidation(newValidation);
    setEditingIndex(null);

    // Notify parent of edit
    onEdit(newScript);
  }, [localScript, onEdit]);

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const handleSave = useCallback(() => {
    if (localScript && localValidation.valid) {
      onSave(localScript);
    }
  }, [localScript, localValidation.valid, onSave]);

  const handleDiscard = useCallback(() => {
    setLocalScript(null);
    setEditingIndex(null);
    onDiscard();
  }, [onDiscard]);

  const handlePlay = useCallback(() => {
    if (localScript && onPlay && isSaved) {
      onPlay(localScript);
    }
  }, [localScript, onPlay, isSaved]);

  // Empty state
  if (!localScript) {
    return (
      <div className="script-preview-container" data-testid="script-preview">
        <div className="script-preview-empty">
          <div className="script-preview-empty-icon">📝</div>
          <p className="script-preview-empty-text">No script generated yet</p>
          <p className="script-preview-empty-hint">
            Describe your test scenario in the chat to generate a script
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="script-preview-container" data-testid="script-preview">
      {/* Header */}
      <div className="script-preview-header">
        <h3 className="script-preview-title">Script Preview</h3>
        <div className="script-preview-meta">
          <span className="script-meta-item">
            📋 {localScript.actions.length} actions
          </span>
          <span className="script-meta-item">
            ⏱️ {formatTimestamp(localScript.metadata.duration)}
          </span>
          <span className="script-meta-item">
            🖥️ {localScript.metadata.platform}
          </span>
        </div>
      </div>

      {/* Global Validation Messages */}
      {globalErrors.length > 0 && (
        <div className="script-preview-global-errors">
          <div className="validation-section-title">❌ Errors</div>
          {globalErrors.map((err, i) => (
            <div key={i} className="validation-error">
              {err.field}: {err.message}
            </div>
          ))}
        </div>
      )}

      {globalWarnings.length > 0 && (
        <div className="script-preview-global-warnings">
          <div className="validation-section-title">⚠️ Warnings</div>
          {globalWarnings.map((warn, i) => (
            <div key={i} className="validation-warning">
              {warn.field}: {warn.message}
            </div>
          ))}
        </div>
      )}

      {/* Actions List */}
      <div className="script-preview-actions">
        <div className="actions-header">
          <span>Actions</span>
          {!localValidation.valid && (
            <span className="validation-status validation-status-invalid">
              ❌ Invalid
            </span>
          )}
          {localValidation.valid && localValidation.warnings.length > 0 && (
            <span className="validation-status validation-status-warning">
              ⚠️ Has warnings
            </span>
          )}
          {localValidation.valid && localValidation.warnings.length === 0 && (
            <span className="validation-status validation-status-valid">
              ✅ Valid
            </span>
          )}
        </div>

        <div className="actions-list">
          {localScript.actions.map((action, index) => (
            <ActionItem
              key={`${index}-${action.type}-${action.timestamp}`}
              action={action}
              index={index}
              errors={getActionErrors(localValidation.errors, index)}
              warnings={getActionWarnings(localValidation.warnings, index)}
              isEditing={editingIndex === index}
              onEdit={handleEditAction}
              onSaveAction={handleSaveAction}
              onCancelEdit={handleCancelEdit}
            />
          ))}
        </div>
      </div>

      {/* Playback Progress Indicator */}
      {isPlaying && playbackProgress && (
        <div className="playback-progress-container" data-testid="playback-progress">
          <div className="playback-progress-header">
            <span className="playback-status">
              {playbackProgress.status === 'playing' && '▶️ Playing...'}
              {playbackProgress.status === 'paused' && '⏸️ Paused'}
              {playbackProgress.status === 'completed' && '✅ Completed'}
              {playbackProgress.status === 'error' && '❌ Error'}
            </span>
            <span className="playback-progress-text">
              Action {playbackProgress.currentAction} of {playbackProgress.totalActions}
            </span>
          </div>
          <div className="playback-progress-bar">
            <div
              className="playback-progress-fill"
              style={{
                width: `${(playbackProgress.currentAction / playbackProgress.totalActions) * 100}%`,
              }}
            />
          </div>
          {playbackProgress.status === 'error' && playbackProgress.error && (
            <div className="playback-error" data-testid="playback-error">
              <div className="playback-error-message">
                ❌ {playbackProgress.error}
              </div>
              <button
                className="playback-error-edit-button"
                onClick={() => {
                  // Find the action that failed and open it for editing
                  const failedActionIndex = playbackProgress.currentAction - 1;
                  if (failedActionIndex >= 0 && failedActionIndex < (localScript?.actions.length || 0)) {
                    handleEditAction(failedActionIndex);
                  }
                }}
              >
                ✏️ Edit Failed Action
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="script-preview-buttons">
        <button
          className="script-save-button"
          onClick={handleSave}
          disabled={!localValidation.valid || isSaved}
          title={
            isSaved
              ? 'Script already saved'
              : !localValidation.valid
                ? 'Fix validation errors before saving'
                : 'Save script'
          }
        >
          💾 {isSaved ? 'Saved' : 'Save Script'}
        </button>
        {isSaved && onPlay && (
          <button
            className="script-play-button"
            onClick={handlePlay}
            disabled={isPlaying || !localValidation.valid}
            title={
              isPlaying
                ? 'Playback in progress'
                : !localValidation.valid
                  ? 'Fix validation errors before playing'
                  : 'Play script'
            }
            data-testid="script-play-button"
          >
            ▶️ {isPlaying ? 'Playing...' : 'Play'}
          </button>
        )}
        <button
          className="script-discard-button"
          onClick={handleDiscard}
          disabled={isPlaying}
        >
          🗑️ Discard
        </button>
      </div>
    </div>
  );
};

export default ScriptPreview;
