/**
 * EditorArea Component
 * Integrated script editor that displays and allows modification of recorded actions
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5
 */

import React, { useState, useEffect, useRef } from 'react';
import { useUnifiedInterface, ScriptFile, RecordingSession } from './UnifiedInterface';
import './EditorArea.css';

// Action interface (simplified for now)
interface Action {
  id: string;
  type: string;
  timestamp: number;
  data: any;
}

// Props interface
export interface EditorAreaProps {
  script?: ScriptFile | null;
  recordingSession?: RecordingSession | null;
  onScriptChange?: (script: ScriptFile) => void;
  onActionSelect?: (actionId: string) => void;
  onActionEdit?: (actionId: string, changes: Partial<Action>) => void;
  onActionDelete?: (actionId: string) => void;
}

// Editor area state
interface EditorAreaState {
  selectedActionId: string | null;
  scrollPosition: number;
  filterText: string;
  viewMode: 'list' | 'timeline' | 'code';
}

/**
 * ActionList Component
 * Displays recorded actions in real-time during recording and allows editing
 * Requirements: 5.1, 5.2, 5.5
 */
const ActionList: React.FC<{
  actions: Action[];
  selectedActionId: string | null;
  recordingActive: boolean;
  onActionSelect: (actionId: string) => void;
  onActionEdit: (actionId: string, changes: Partial<Action>) => void;
  onActionDelete: (actionId: string) => void;
}> = ({
  actions,
  selectedActionId,
  recordingActive,
  onActionSelect,
  onActionEdit,
  onActionDelete
}) => {
    const listRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to latest action during recording - Requirements: 5.2, 5.5
    useEffect(() => {
      if (recordingActive && listRef.current && actions.length > 0) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, [actions.length, recordingActive]);

    // Format action for display
    const formatAction = (action: Action): string => {
      switch (action.type) {
        case 'mouse_click':
          return `Click at (${action.data.x}, ${action.data.y})`;
        case 'mouse_move':
          return `Move to (${action.data.x}, ${action.data.y})`;
        case 'key_press':
          return `Press key: ${action.data.key}`;
        case 'key_release':
          return `Release key: ${action.data.key}`;
        case 'delay':
          return `Wait ${action.data.duration}ms`;
        default:
          return `${action.type}`;
      }
    };

    // Get action icon
    const getActionIcon = (action: Action): string => {
      switch (action.type) {
        case 'mouse_click':
          return '👆';
        case 'mouse_move':
          return '🖱️';
        case 'key_press':
        case 'key_release':
          return '⌨️';
        case 'delay':
          return '⏱️';
        default:
          return '❓';
      }
    };

    if (actions.length === 0) {
      return (
        <div className="action-list-empty">
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <div className="empty-title">No Actions Yet</div>
            <div className="empty-description">
              {recordingActive
                ? 'Start interacting with your screen to see actions appear here'
                : 'Click Record to start capturing actions'
              }
            </div>
          </div>
        </div>
      );
    }

    return (
      <div ref={listRef} className="action-list">
        {actions.map((action, index) => (
          <div
            key={action.id}
            className={`action-item ${selectedActionId === action.id ? 'selected' : ''} ${recordingActive && index === actions.length - 1 ? 'latest' : ''}`}
            onClick={() => onActionSelect(action.id)}
          >
            <div className="action-item-header">
              <span className="action-icon">{getActionIcon(action)}</span>
              <span className="action-index">{index + 1}</span>
              <span className="action-timestamp">
                {action.timestamp.toFixed(2)}s
              </span>
            </div>
            <div className="action-description">
              {formatAction(action)}
            </div>
            {selectedActionId === action.id && (
              <div className="action-controls">
                <button
                  className="action-edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Edit functionality will be implemented later
                  }}
                >
                  Edit
                </button>
                <button
                  className="action-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onActionDelete(action.id);
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

/**
 * StatusPanel Component
 * Shows recording, playback, and editor status
 */
const StatusPanel: React.FC<{
  recordingActive: boolean;
  actionCount: number;
  selectedActionId: string | null;
}> = ({ recordingActive, actionCount, selectedActionId }) => {
  return (
    <div className="status-panel">
      <div className="status-item">
        <span className="status-label">Status:</span>
        <span className={`status-value ${recordingActive ? 'recording' : 'idle'}`}>
          {recordingActive ? '🔴 Recording' : '⚪ Idle'}
        </span>
      </div>
      <div className="status-item">
        <span className="status-label">Actions:</span>
        <span className="status-value">{actionCount}</span>
      </div>
      {selectedActionId && (
        <div className="status-item">
          <span className="status-label">Selected:</span>
          <span className="status-value">{selectedActionId}</span>
        </div>
      )}
    </div>
  );
};

/**
 * EditorArea Component
 * Main editor interface component
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5
 */
export const EditorArea: React.FC<EditorAreaProps> = ({
  script,
  recordingSession,
  onScriptChange,
  onActionSelect,
  onActionEdit,
  onActionDelete
}) => {
  const { state } = useUnifiedInterface();
  const [editorState, setEditorState] = useState<EditorAreaState>({
    selectedActionId: null,
    scrollPosition: 0,
    filterText: '',
    viewMode: 'list'
  });

  // Get actions from script or recording session
  const actions: Action[] = React.useMemo(() => {
    if (recordingSession?.actions) {
      return recordingSession.actions.map((action, index) => ({
        id: `action_${index}`,
        type: action.type || 'unknown',
        timestamp: action.timestamp || 0,
        data: action
      }));
    }

    if (script?.actions) {
      return script.actions.map((action, index) => ({
        id: `action_${index}`,
        type: action.type || 'unknown',
        timestamp: action.timestamp || 0,
        data: action
      }));
    }

    return [];
  }, [script, recordingSession]);

  // Handle action selection
  const handleActionSelect = (actionId: string) => {
    setEditorState(prev => ({ ...prev, selectedActionId: actionId }));
    onActionSelect?.(actionId);
  };

  // Handle action edit
  const handleActionEdit = (actionId: string, changes: Partial<Action>) => {
    onActionEdit?.(actionId, changes);
  };

  // Handle action delete
  const handleActionDelete = (actionId: string) => {
    onActionDelete?.(actionId);
    if (editorState.selectedActionId === actionId) {
      setEditorState(prev => ({ ...prev, selectedActionId: null }));
    }
  };

  // Check if recording is active
  const recordingActive = state.applicationMode === 'recording' && recordingSession?.isActive;

  return (
    <div
      className={`editor-area-container editor-layout-flexible ${state.editorVisible ? 'visible' : 'hidden'}`}
      data-testid="editor-area-container"
    >
      {/* Editor Header */}
      <div className="editor-header">
        <div className="editor-title">
          <span className="editor-title-text">Script Editor</span>
          {script && (
            <span className="editor-subtitle">{script.filename}</span>
          )}
        </div>

        <div className="editor-controls">
          <div className="view-mode-selector">
            <button
              className={`view-mode-btn ${editorState.viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setEditorState(prev => ({ ...prev, viewMode: 'list' }))}
            >
              List
            </button>
            <button
              className={`view-mode-btn ${editorState.viewMode === 'timeline' ? 'active' : ''}`}
              onClick={() => setEditorState(prev => ({ ...prev, viewMode: 'timeline' }))}
            >
              Timeline
            </button>
            <button
              className={`view-mode-btn ${editorState.viewMode === 'code' ? 'active' : ''}`}
              onClick={() => setEditorState(prev => ({ ...prev, viewMode: 'code' }))}
            >
              Code
            </button>
          </div>
        </div>
      </div>

      {/* Editor Content - Flexible scrollable area */}
      <div className="editor-content editor-scrollable-content">
        {editorState.viewMode === 'list' && (
          <ActionList
            actions={actions}
            selectedActionId={editorState.selectedActionId}
            recordingActive={recordingActive || false}
            onActionSelect={handleActionSelect}
            onActionEdit={handleActionEdit}
            onActionDelete={handleActionDelete}
          />
        )}

        {editorState.viewMode === 'timeline' && (
          <div className="timeline-view editor-scrollable-content">
            <div className="timeline-placeholder">
              Timeline view will be implemented in future tasks
            </div>
          </div>
        )}

        {editorState.viewMode === 'code' && (
          <div className="code-view editor-scrollable-content">
            <div className="code-placeholder">
              Code view will be implemented in future tasks
            </div>
          </div>
        )}
      </div>

      {/* Status Panel */}
      <StatusPanel
        recordingActive={recordingActive || false}
        actionCount={actions.length}
        selectedActionId={editorState.selectedActionId}
      />
    </div>
  );
};

export default EditorArea;
