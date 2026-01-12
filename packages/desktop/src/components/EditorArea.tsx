/**
 * EditorArea Component
 * Integrated script editor that displays and allows modification of recorded actions
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useUnifiedInterface, ScriptFile, RecordingSession } from './UnifiedInterface';
import { ErrorBoundary } from './ErrorBoundary';
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
    const [focusedIndex, setFocusedIndex] = useState<number>(-1);

    // Auto-scroll to latest action during recording - Requirements: 5.2, 5.5
    useEffect(() => {
      if (recordingActive && listRef.current && actions.length > 0) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, [actions.length, recordingActive]);

    // Keyboard navigation for action list
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (!listRef.current?.contains(document.activeElement)) return;

        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault();
            setFocusedIndex(prev => {
              const newIndex = Math.min(prev + 1, actions.length - 1);
              if (actions[newIndex]) {
                onActionSelect(actions[newIndex].id);
              }
              return newIndex;
            });
            break;
          case 'ArrowUp':
            event.preventDefault();
            setFocusedIndex(prev => {
              const newIndex = Math.max(prev - 1, 0);
              if (actions[newIndex]) {
                onActionSelect(actions[newIndex].id);
              }
              return newIndex;
            });
            break;
          case 'Enter':
          case ' ':
            event.preventDefault();
            if (focusedIndex >= 0 && actions[focusedIndex]) {
              onActionSelect(actions[focusedIndex].id);
            }
            break;
          case 'Delete':
          case 'Backspace':
            event.preventDefault();
            if (selectedActionId) {
              onActionDelete(selectedActionId);
            }
            break;
          case 'Escape':
            event.preventDefault();
            setFocusedIndex(-1);
            break;
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [actions, focusedIndex, selectedActionId, onActionSelect, onActionDelete]);

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

    // Get accessible action description
    const getActionDescription = (action: Action, index: number): string => {
      const baseDescription = formatAction(action);
      const timestamp = `at ${action.timestamp.toFixed(2)} seconds`;
      return `Action ${index + 1}: ${baseDescription} ${timestamp}`;
    };

    if (actions.length === 0) {
      return (
        <div
          className="action-list-empty"
          role="status"
          aria-live="polite"
          aria-label="Action list status"
        >
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">📝</div>
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
      <div
        ref={listRef}
        className="action-list"
        role="listbox"
        aria-label={`Action list with ${actions.length} actions`}
        aria-activedescendant={selectedActionId ? `action-${selectedActionId}` : undefined}
        tabIndex={0}
      >
        {actions.map((action, index) => (
          <div
            key={action.id}
            id={`action-${action.id}`}
            className={`action-item ${selectedActionId === action.id ? 'selected' : ''} ${recordingActive && index === actions.length - 1 ? 'latest' : ''} ${focusedIndex === index ? 'focused' : ''}`}
            onClick={() => onActionSelect(action.id)}
            role="option"
            aria-selected={selectedActionId === action.id}
            aria-describedby={`action-desc-${action.id}`}
            tabIndex={selectedActionId === action.id ? 0 : -1}
          >
            <div className="action-item-header">
              <span className="action-icon" aria-hidden="true">{getActionIcon(action)}</span>
              <span className="action-index" aria-label={`Action number ${index + 1}`}>
                {index + 1}
              </span>
              <span className="action-timestamp" aria-label={`Timestamp ${action.timestamp.toFixed(2)} seconds`}>
                {action.timestamp.toFixed(2)}s
              </span>
            </div>
            <div
              className="action-description"
              id={`action-desc-${action.id}`}
            >
              {formatAction(action)}
            </div>
            <div className="sr-only">
              {getActionDescription(action, index)}
            </div>
            {selectedActionId === action.id && (
              <div className="action-controls" role="group" aria-label="Action controls">
                <button
                  className="action-edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Edit functionality will be implemented later
                  }}
                  aria-label={`Edit action ${index + 1}`}
                >
                  Edit
                </button>
                <button
                  className="action-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onActionDelete(action.id);
                  }}
                  aria-label={`Delete action ${index + 1}`}
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
    <div
      className="status-panel"
      role="status"
      aria-live="polite"
      aria-label="Application status"
    >
      <div className="status-item">
        <span className="status-label">Status:</span>
        <span
          className={`status-value ${recordingActive ? 'recording' : 'idle'}`}
          aria-label={recordingActive ? 'Currently recording' : 'Currently idle'}
        >
          {recordingActive ? '🔴 Recording' : '⚪ Idle'}
        </span>
      </div>
      <div className="status-item">
        <span className="status-label">Actions:</span>
        <span
          className="status-value"
          aria-label={`${actionCount} actions captured`}
        >
          {actionCount}
        </span>
      </div>
      {selectedActionId && (
        <div className="status-item">
          <span className="status-label">Selected:</span>
          <span
            className="status-value"
            aria-label={`Action ${selectedActionId} is selected`}
          >
            {selectedActionId}
          </span>
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
export const EditorArea: React.FC<EditorAreaProps> = React.memo(({
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

  // Error handling for editor operations
  const handleEditorError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('EditorArea error:', error, errorInfo);

    // Reset editor to safe state
    setEditorState({
      selectedActionId: null,
      scrollPosition: 0,
      filterText: '',
      viewMode: 'list'
    });
  };

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
    <ErrorBoundary
      onError={handleEditorError}
      resetKeys={[state.applicationMode, script?.path || 'no-script']}
      resetOnPropsChange={true}
      fallback={
        <div className="editor-area-container error" data-testid="editor-area-container">
          <div className="editor-error">
            <div className="editor-error-icon">⚠️</div>
            <div className="editor-error-title">Editor Error</div>
            <div className="editor-error-message">
              The script editor encountered an error and needs to be reset.
            </div>
            <button
              className="editor-error-button"
              onClick={() => window.location.reload()}
            >
              Reload Editor
            </button>
          </div>
        </div>
      }
    >
      <div
        className={`editor-area-container editor-layout-flexible ${state.editorVisible ? 'visible' : 'hidden'}`}
        data-testid="editor-area-container"
        role="region"
        aria-label="Script editor area"
        aria-hidden={!state.editorVisible}
      >
        {/* Editor Header */}
        <div className="editor-header" role="banner">
          <div className="editor-title">
            <h2 className="editor-title-text" id="editor-title">Script Editor</h2>
            {script && (
              <span className="editor-subtitle" aria-describedby="editor-title">
                {script.filename}
              </span>
            )}
          </div>

          <div className="editor-controls" role="tablist" aria-label="View mode selection">
            <div className="view-mode-selector">
              <button
                className={`view-mode-btn ${editorState.viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setEditorState(prev => ({ ...prev, viewMode: 'list' }))}
                role="tab"
                aria-selected={editorState.viewMode === 'list'}
                aria-controls="editor-content"
                tabIndex={editorState.viewMode === 'list' ? 0 : -1}
              >
                List
              </button>
              <button
                className={`view-mode-btn ${editorState.viewMode === 'timeline' ? 'active' : ''}`}
                onClick={() => setEditorState(prev => ({ ...prev, viewMode: 'timeline' }))}
                role="tab"
                aria-selected={editorState.viewMode === 'timeline'}
                aria-controls="editor-content"
                tabIndex={editorState.viewMode === 'timeline' ? 0 : -1}
              >
                Timeline
              </button>
              <button
                className={`view-mode-btn ${editorState.viewMode === 'code' ? 'active' : ''}`}
                onClick={() => setEditorState(prev => ({ ...prev, viewMode: 'code' }))}
                role="tab"
                aria-selected={editorState.viewMode === 'code'}
                aria-controls="editor-content"
                tabIndex={editorState.viewMode === 'code' ? 0 : -1}
              >
                Code
              </button>
            </div>
          </div>
        </div>

        {/* Editor Content - Flexible scrollable area */}
        <div
          className="editor-content editor-scrollable-content"
          id="editor-content"
          role="tabpanel"
          aria-labelledby="editor-title"
          tabIndex={0}
        >
          <ErrorBoundary
            fallback={
              <div className="editor-content-error">
                <div>⚠️ Content display error</div>
                <button onClick={() => setEditorState(prev => ({ ...prev, viewMode: 'list' }))}>
                  Reset to List View
                </button>
              </div>
            }
          >
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
              <div className="timeline-view editor-scrollable-content" role="region" aria-label="Timeline view">
                <div className="timeline-placeholder">
                  Timeline view will be implemented in future tasks
                </div>
              </div>
            )}

            {editorState.viewMode === 'code' && (
              <div className="code-view editor-scrollable-content" role="region" aria-label="Code view">
                <div className="code-placeholder">
                  Code view will be implemented in future tasks
                </div>
              </div>
            )}
          </ErrorBoundary>
        </div>

        {/* Status Panel */}
        <StatusPanel
          recordingActive={recordingActive || false}
          actionCount={actions.length}
          selectedActionId={editorState.selectedActionId}
        />
      </div>
    </ErrorBoundary>
  );
});

export default EditorArea;
