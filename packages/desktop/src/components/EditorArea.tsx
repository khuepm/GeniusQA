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

            {/* Load Script Interface - shown when not recording */}
            {!recordingActive && (
              <div className="load-script-interface">
                <div className="load-script-section">
                  <div className="load-script-header">
                    <div className="load-script-icon">📋</div>
                    <div className="load-script-title">Load a test script to record actions for specific test steps</div>
                  </div>
                  <button
                    className="load-script-button"
                    onClick={() => {
                      // Dispatch event to open script loader
                      window.dispatchEvent(new CustomEvent('open-script-loader-for-recording'));
                    }}
                    aria-label="Load script for step-based recording"
                  >
                    <span className="load-script-button-icon">📁</span>
                    <span className="load-script-button-text">Load Script for Recording</span>
                  </button>
                </div>

                <div className="load-script-divider">
                  <span className="load-script-divider-text">Or</span>
                </div>

                <div className="record-without-script-section">
                  <div className="record-without-script-text">
                    Record without a script - actions will be saved to a new recording
                  </div>
                  <div className="record-without-script-hint">
                    Click the Record button in the toolbar to start capturing actions
                  </div>
                </div>
              </div>
            )}
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
 * TimelineView Component
 * Displays actions in a visual timeline format with timestamps
 */
const TimelineView: React.FC<{
  actions: Action[];
  selectedActionId: string | null;
  onActionSelect: (actionId: string) => void;
  onActionEdit: (actionId: string, changes: Partial<Action>) => void;
  onActionDelete: (actionId: string) => void;
}> = ({ actions, selectedActionId, onActionSelect, onActionEdit, onActionDelete }) => {
  const timelineRef = useRef<HTMLDivElement>(null);

  // Calculate timeline scale based on action timestamps
  const timelineScale = useMemo(() => {
    if (actions.length === 0) return { start: 0, end: 1, scale: 1 };

    const timestamps = actions.map(action => action.timestamp);
    const start = Math.min(...timestamps);
    const end = Math.max(...timestamps);
    const duration = end - start || 1;

    return {
      start,
      end,
      scale: 800 / duration // 800px timeline width
    };
  }, [actions]);

  // Get position on timeline for an action
  const getTimelinePosition = (timestamp: number): number => {
    return (timestamp - timelineScale.start) * timelineScale.scale;
  };

  // Format duration for display
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(0).padStart(2, '0')}`;
  };

  // Get action color based on type
  const getActionColor = (actionType: string): string => {
    switch (actionType) {
      case 'mouse_click': return '#4CAF50';
      case 'mouse_move': return '#2196F3';
      case 'key_press':
      case 'key_release': return '#FF9800';
      case 'delay': return '#9C27B0';
      default: return '#757575';
    }
  };

  if (actions.length === 0) {
    return (
      <div className="timeline-view editor-scrollable-content" role="region" aria-label="Timeline view">
        <div className="timeline-empty">
          <div className="empty-icon">📊</div>
          <div className="empty-title">No Timeline Data</div>
          <div className="empty-description">
            Record some actions to see them displayed on the timeline
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-view editor-scrollable-content" role="region" aria-label="Timeline view">
      <div className="timeline-header">
        <div className="timeline-info">
          <span className="timeline-duration">
            Duration: {formatDuration(timelineScale.end - timelineScale.start)}
          </span>
          <span className="timeline-actions">
            {actions.length} actions
          </span>
        </div>
      </div>

      <div className="timeline-container" ref={timelineRef}>
        <div className="timeline-track">
          {/* Timeline ruler */}
          <div className="timeline-ruler">
            {Array.from({ length: 11 }, (_, i) => {
              const time = timelineScale.start + (timelineScale.end - timelineScale.start) * (i / 10);
              return (
                <div
                  key={i}
                  className="timeline-tick"
                  style={{ left: `${(i / 10) * 100}%` }}
                >
                  <div className="timeline-tick-mark" />
                  <div className="timeline-tick-label">
                    {formatDuration(time)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action markers */}
          <div className="timeline-actions">
            {actions.map((action, index) => (
              <div
                key={action.id}
                className={`timeline-action ${selectedActionId === action.id ? 'selected' : ''}`}
                style={{
                  left: `${(getTimelinePosition(action.timestamp) / 800) * 100}%`,
                  backgroundColor: getActionColor(action.type)
                }}
                onClick={() => onActionSelect(action.id)}
                role="button"
                tabIndex={0}
                aria-label={`Action ${index + 1}: ${action.type} at ${formatDuration(action.timestamp)}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onActionSelect(action.id);
                  }
                }}
              >
                <div className="timeline-action-marker" />
                <div className="timeline-action-tooltip">
                  <div className="tooltip-title">Action {index + 1}</div>
                  <div className="tooltip-type">{action.type}</div>
                  <div className="tooltip-time">{formatDuration(action.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected action details */}
        {selectedActionId && (
          <div className="timeline-details">
            {(() => {
              const selectedAction = actions.find(a => a.id === selectedActionId);
              if (!selectedAction) return null;

              return (
                <div className="action-details-panel">
                  <div className="details-header">
                    <h4>Action Details</h4>
                    <div className="details-controls">
                      <button
                        className="edit-btn"
                        onClick={() => onActionEdit(selectedActionId, {})}
                        aria-label="Edit action"
                      >
                        Edit
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => onActionDelete(selectedActionId)}
                        aria-label="Delete action"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="details-content">
                    <div className="detail-row">
                      <span className="detail-label">Type:</span>
                      <span className="detail-value">{selectedAction.type}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Time:</span>
                      <span className="detail-value">{formatDuration(selectedAction.timestamp)}</span>
                    </div>
                    {selectedAction.data && Object.keys(selectedAction.data).length > 0 && (
                      <div className="detail-row">
                        <span className="detail-label">Data:</span>
                        <pre className="detail-value">{JSON.stringify(selectedAction.data, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * CodeView Component
 * Displays and allows editing of the script in code format
 */
const CodeView: React.FC<{
  actions: Action[];
  script?: ScriptFile | null;
  onScriptChange?: (script: ScriptFile) => void;
}> = ({ actions, script, onScriptChange }) => {
  const [codeContent, setCodeContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Generate code representation from actions
  const generateCode = useCallback((actionList: Action[]): string => {
    if (actionList.length === 0) {
      return '# No actions recorded yet\n# Start recording to see generated code here';
    }

    const lines: string[] = [
      '# Generated automation script',
      '# This code represents the recorded actions',
      '',
      'import time',
      'from automation import mouse, keyboard',
      '',
      'def run_automation():',
      '    """Execute the recorded automation sequence"""'
    ];

    actionList.forEach((action, index) => {
      lines.push(`    # Action ${index + 1}: ${action.type}`);

      switch (action.type) {
        case 'mouse_click':
          lines.push(`    mouse.click(${action.data.x}, ${action.data.y})`);
          break;
        case 'mouse_move':
          lines.push(`    mouse.move(${action.data.x}, ${action.data.y})`);
          break;
        case 'key_press':
          lines.push(`    keyboard.press('${action.data.key}')`);
          break;
        case 'key_release':
          lines.push(`    keyboard.release('${action.data.key}')`);
          break;
        case 'delay':
          lines.push(`    time.sleep(${action.data.duration / 1000})`);
          break;
        default:
          lines.push(`    # Unknown action: ${action.type}`);
      }

      if (index < actionList.length - 1) {
        lines.push('');
      }
    });

    lines.push('');
    lines.push('if __name__ == "__main__":');
    lines.push('    run_automation()');

    return lines.join('\n');
  }, []);

  // Update code content when actions change
  useEffect(() => {
    if (!isEditing) {
      setCodeContent(generateCode(actions));
    }
  }, [actions, generateCode, isEditing]);

  // Handle code editing
  const handleCodeChange = (newCode: string) => {
    setCodeContent(newCode);
  };

  const handleSaveCode = () => {
    if (script && onScriptChange) {
      // In a real implementation, we would parse the code back to actions
      // For now, we just update the script content
      const updatedScript: ScriptFile = {
        ...script,
        content: codeContent
      };
      onScriptChange(updatedScript);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setCodeContent(generateCode(actions));
    setIsEditing(false);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(codeContent);
      // Show success feedback (could be improved with a toast notification)
      const button = document.querySelector('.copy-btn') as HTMLButtonElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="code-view editor-scrollable-content" role="region" aria-label="Code view">
      <div className="code-header">
        <div className="code-info">
          <h4>Generated Code</h4>
          <span className="code-language">Python</span>
        </div>
        <div className="code-controls">
          <button
            className="copy-btn"
            onClick={handleCopyCode}
            aria-label="Copy code to clipboard"
          >
            Copy
          </button>
          {!isEditing ? (
            <button
              className="edit-btn"
              onClick={() => setIsEditing(true)}
              aria-label="Edit code"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                className="save-btn"
                onClick={handleSaveCode}
                aria-label="Save code changes"
              >
                Save
              </button>
              <button
                className="cancel-btn"
                onClick={handleCancelEdit}
                aria-label="Cancel code editing"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="code-content">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className="code-editor"
            value={codeContent}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="Enter your automation code here..."
            aria-label="Code editor"
            spellCheck={false}
          />
        ) : (
          <pre className="code-display">
            <code>{codeContent}</code>
          </pre>
        )}
      </div>

      {actions.length === 0 && (
        <div className="code-empty">
          <div className="empty-icon">💻</div>
          <div className="empty-title">No Code Generated</div>
          <div className="empty-description">
            Record some actions to see the generated automation code
          </div>
        </div>
      )}
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
              <TimelineView
                actions={actions}
                selectedActionId={editorState.selectedActionId}
                onActionSelect={handleActionSelect}
                onActionEdit={handleActionEdit}
                onActionDelete={handleActionDelete}
              />
            )}

            {editorState.viewMode === 'code' && (
              <CodeView
                actions={actions}
                script={script}
                onScriptChange={onScriptChange}
              />
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
