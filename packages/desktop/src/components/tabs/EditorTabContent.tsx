/**
 * EditorTabContent Component
 * 
 * Displays the script editor interface within the tab system.
 * Shows placeholder when no script loaded, and editor with visual/JSON modes.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import React, { useState, useCallback } from 'react';
import { ScriptData, Action } from '../../types/aiScriptBuilder.types';
import { StoredScriptInfo } from '../../services/scriptStorageService';
import './EditorTabContent.css';

/**
 * Props for EditorTabContent component
 */
export interface EditorTabContentProps {
  /** Current script data */
  script: ScriptData | null;
  /** Selected script info from list */
  selectedScript: StoredScriptInfo | null;
  /** Whether in edit mode */
  editMode: boolean;
  /** Callback when edit mode changes */
  onEditModeChange: (mode: boolean) => void;
  /** Callback when script is saved */
  onScriptSave: () => void;
  /** Callback when an action is updated */
  onActionUpdate: (index: number, field: string, value: unknown) => void;
  /** Callback when an action is deleted */
  onActionDelete: (index: number) => void;
}

/**
 * Edit mode type
 */
type EditModeType = 'visual' | 'json';

/**
 * Formats timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  if (timestamp < 1000) {
    return `${timestamp}ms`;
  }
  return `${(timestamp / 1000).toFixed(2)}s`;
}

/**
 * Formats date for display
 */
function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
}

/**
 * Gets action description
 */
function getActionDescription(action: Action): string {
  switch (action.type) {
    case 'mouse_move':
      return `Move to (${action.x}, ${action.y})`;
    case 'mouse_click':
    case 'mouse_double_click':
      return `${action.button || 'left'} click at (${action.x}, ${action.y})`;
    case 'mouse_drag':
      return `Drag from (${action.x}, ${action.y})`;
    case 'mouse_scroll':
      return `Scroll at (${action.x}, ${action.y})`;
    case 'key_press':
    case 'key_release':
      const modifiers = action.modifiers?.length ? `${action.modifiers.join('+')}+` : '';
      return `${action.type === 'key_press' ? 'Press' : 'Release'} ${modifiers}${action.key}`;
    case 'key_type':
      const text = action.text || '';
      return `Type "${text.length > 20 ? text.substring(0, 20) + '...' : text}"`;
    case 'wait':
      return `Wait ${action.timestamp}ms`;
    case 'screenshot':
      return 'Take screenshot';
    default:
      return action.type;
  }
}

/**
 * ActionEditor component - edits a single action
 */
interface ActionEditorProps {
  action: Action;
  index: number;
  onUpdate: (index: number, field: string, value: unknown) => void;
  onDelete: (index: number) => void;
  editMode: boolean;
}

const ActionEditor: React.FC<ActionEditorProps> = ({
  action,
  index,
  onUpdate,
  onDelete,
  editMode,
}) => {
  return (
    <div className="editor-action-item" data-testid={`editor-action-${index}`}>
      <div className="editor-action-header">
        <span className="editor-action-index">{index + 1}</span>
        <span className="editor-action-type">{action.type}</span>
        <span className="editor-action-time">{formatTimestamp(action.timestamp)}</span>
        {editMode && (
          <button
            className="editor-action-delete"
            onClick={() => onDelete(index)}
            aria-label={`Delete action ${index + 1}`}
          >
            🗑️
          </button>
        )}
      </div>
      <div className="editor-action-description">
        {getActionDescription(action)}
      </div>
      {editMode && (
        <div className="editor-action-fields">
          <div className="editor-field">
            <label>Timestamp (ms)</label>
            <input
              type="number"
              value={action.timestamp}
              onChange={(e) => onUpdate(index, 'timestamp', Number(e.target.value))}
              min={0}
            />
          </div>
          {['mouse_move', 'mouse_click', 'mouse_double_click', 'mouse_drag', 'mouse_scroll'].includes(action.type) && (
            <>
              <div className="editor-field">
                <label>X</label>
                <input
                  type="number"
                  value={action.x ?? 0}
                  onChange={(e) => onUpdate(index, 'x', Number(e.target.value))}
                  min={0}
                />
              </div>
              <div className="editor-field">
                <label>Y</label>
                <input
                  type="number"
                  value={action.y ?? 0}
                  onChange={(e) => onUpdate(index, 'y', Number(e.target.value))}
                  min={0}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * EditorTabContent Component
 * 
 * Main component for the Editor tab content area.
 * Displays placeholder or script editor with visual/JSON modes.
 */
export const EditorTabContent: React.FC<EditorTabContentProps> = ({
  script,
  selectedScript,
  editMode,
  onEditModeChange,
  onScriptSave,
  onActionUpdate,
  onActionDelete,
}) => {
  const [viewMode, setViewMode] = useState<EditModeType>('visual');
  const [jsonContent, setJsonContent] = useState<string>('');

  // Update JSON content when script changes
  React.useEffect(() => {
    if (script) {
      setJsonContent(JSON.stringify(script, null, 2));
    }
  }, [script]);

  /**
   * Handle view mode toggle
   */
  const handleViewModeChange = useCallback((mode: EditModeType) => {
    setViewMode(mode);
  }, []);

  /**
   * Handle JSON content change
   */
  const handleJsonChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonContent(e.target.value);
  }, []);

  // Show placeholder when no script loaded - Requirements: 5.1
  if (!script) {
    return (
      <div className="editor-tab-content" data-testid="editor-tab-content">
        <div className="editor-placeholder" data-testid="editor-placeholder">
          <div className="editor-placeholder-icon">✏️</div>
          <p className="editor-placeholder-text">No Script Loaded</p>
          <p className="editor-placeholder-hint">
            Select a script from the Script List tab to edit it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-tab-content" data-testid="editor-tab-content">
      {/* Header with script info and controls */}
      <div className="editor-header">
        <div className="editor-script-info">
          <h3 className="editor-script-name">
            {selectedScript?.scriptName || selectedScript?.filename || 'Untitled Script'}
          </h3>
          <div className="editor-script-meta">
            <span>📋 {script.actions.length} actions</span>
            <span>⏱️ {formatTimestamp(script.metadata.duration)}</span>
            <span>🖥️ {script.metadata.platform}</span>
            {selectedScript?.createdAt && (
              <span>📅 {formatDate(selectedScript.createdAt)}</span>
            )}
          </div>
        </div>
        <div className="editor-controls">
          {/* View mode toggle - Requirements: 5.3 */}
          <div className="editor-view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'visual' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('visual')}
            >
              Visual
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'json' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('json')}
            >
              JSON
            </button>
          </div>
          {/* Edit mode toggle */}
          <button
            className={`editor-edit-btn ${editMode ? 'active' : ''}`}
            onClick={() => onEditModeChange(!editMode)}
          >
            {editMode ? '👁️ View' : '✏️ Edit'}
          </button>
          {/* Save button */}
          <button
            className="editor-save-btn"
            onClick={onScriptSave}
            disabled={!editMode}
          >
            💾 Save
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div className="editor-body">
        {viewMode === 'visual' ? (
          /* Visual editor - Requirements: 5.2, 5.4 */
          <div className="editor-visual" data-testid="editor-visual">
            <div className="editor-actions-list">
              {script.actions.map((action, index) => (
                <ActionEditor
                  key={`${index}-${action.type}-${action.timestamp}`}
                  action={action}
                  index={index}
                  onUpdate={onActionUpdate}
                  onDelete={onActionDelete}
                  editMode={editMode}
                />
              ))}
            </div>
          </div>
        ) : (
          /* JSON editor - Requirements: 5.3 */
          <div className="editor-json" data-testid="editor-json">
            <textarea
              className="editor-json-textarea"
              value={jsonContent}
              onChange={handleJsonChange}
              readOnly={!editMode}
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default EditorTabContent;
