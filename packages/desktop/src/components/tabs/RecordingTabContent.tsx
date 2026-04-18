/**
 * RecordingTabContent Component
 * 
 * Displays the recording interface within the tab system.
 * Shows empty state when no actions, and list of captured actions during recording.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import React from 'react';
import { RecordingSession } from '../UnifiedInterface';
import { ActionData } from '../../types/recorder.types';
import './RecordingTabContent.css';

/**
 * Props for RecordingTabContent component
 */
export interface RecordingTabContentProps {
  /** Current recording session state */
  recordingSession: RecordingSession | null;
  /** List of captured actions */
  actions: ActionData[];
  /** Callback to start recording */
  onStartRecording: () => void;
  /** Callback to stop recording */
  onStopRecording: () => void;
}

/**
 * Formats action type for display
 */
function formatActionType(type: string): string {
  const typeMap: Record<string, string> = {
    mouse_move: 'Mouse Move',
    mouse_click: 'Mouse Click',
    key_press: 'Key Press',
    key_release: 'Key Release',
    ai_vision_capture: 'Vision Capture',
  };
  return typeMap[type] || type;
}

/**
 * Formats timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  if (timestamp < 1) {
    return `${(timestamp * 1000).toFixed(0)}ms`;
  }
  return `${timestamp.toFixed(2)}s`;
}

/**
 * Gets action description based on type
 */
function getActionDescription(action: ActionData): string {
  switch (action.type) {
    case 'mouse_move':
      return `Move to (${action.x}, ${action.y})`;
    case 'mouse_click':
      return `${action.button || 'left'} click at (${action.x}, ${action.y})`;
    case 'key_press':
      return `Press ${action.key}`;
    case 'key_release':
      return `Release ${action.key}`;
    case 'ai_vision_capture':
      return 'Capture screen region';
    default:
      return action.type;
  }
}

/**
 * ActionItem component - displays a single action
 */
interface ActionItemProps {
  action: ActionData;
  index: number;
}

const ActionItem: React.FC<ActionItemProps> = ({ action, index }) => {
  return (
    <div className="recording-action-item" data-testid={`action-item-${index}`}>
      <span className="action-index">{index + 1}</span>
      <span className="action-type-badge">{formatActionType(action.type)}</span>
      <span className="action-description">{getActionDescription(action)}</span>
      <span className="action-timestamp">{formatTimestamp(action.timestamp)}</span>
    </div>
  );
};

/**
 * RecordingTabContent Component
 * 
 * Main component for the Recording tab content area.
 * Displays empty state or list of captured actions.
 */
export const RecordingTabContent: React.FC<RecordingTabContentProps> = ({
  recordingSession,
  actions,
  onStartRecording,
  onStopRecording,
}) => {
  const isRecording = recordingSession?.isActive ?? false;
  const hasActions = actions.length > 0;

  return (
    <div className="recording-tab-content" data-testid="recording-tab-content">
      {/* Header with recording controls */}
      <div className="recording-tab-header">
        <h3 className="recording-tab-title">
          {isRecording ? '🔴 Recording in Progress' : '🎬 Recording'}
        </h3>
        <div className="recording-tab-controls">
          {!isRecording ? (
            <button
              className="recording-start-button"
              onClick={onStartRecording}
              data-testid="start-recording-button"
            >
              ⏺️ Start Recording
            </button>
          ) : (
            <button
              className="recording-stop-button"
              onClick={onStopRecording}
              data-testid="stop-recording-button"
            >
              ⏹️ Stop Recording
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="recording-tab-body">
        {!hasActions ? (
          /* Empty state - Requirements: 2.2 */
          <div className="recording-empty-state" data-testid="recording-empty-state">
            <div className="recording-empty-icon">🎬</div>
            <p className="recording-empty-text">No Actions Yet</p>
            <p className="recording-empty-hint">
              Click Record to start capturing actions.
            </p>
          </div>
        ) : (
          /* Actions list - Requirements: 2.3 */
          <div className="recording-actions-list" data-testid="recording-actions-list">
            <div className="recording-actions-header">
              <span className="actions-count">{actions.length} actions captured</span>
              {isRecording && (
                <span className="recording-indicator">
                  <span className="recording-dot"></span>
                  Recording...
                </span>
              )}
            </div>
            <div className="recording-actions-scroll">
              {actions.map((action, index) => (
                <ActionItem key={`${index}-${action.timestamp}`} action={action} index={index} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordingTabContent;
