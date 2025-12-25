import React from 'react';
import { FocusState, RegisteredApplication } from '../types/applicationFocusedAutomation.types';
import './FocusIndicator.css';

interface FocusIndicatorProps {
  focusState: FocusState | null;
  targetApplication: RegisteredApplication | null;
  onRefresh: () => void;
}

export const FocusIndicator: React.FC<FocusIndicatorProps> = ({
  focusState,
  targetApplication,
  onRefresh,
}) => {
  const getFocusStatusIcon = (): string => {
    if (!focusState) return '❓';
    return focusState.is_target_process_focused ? '🟢' : '🔴';
  };

  const getFocusStatusText = (): string => {
    if (!focusState) return 'Unknown';
    return focusState.is_target_process_focused ? 'Focused' : 'Not Focused';
  };

  const getFocusStatusClass = (): string => {
    if (!focusState) return 'unknown';
    return focusState.is_target_process_focused ? 'focused' : 'not-focused';
  };

  const getTimeSinceLastChange = (): string => {
    if (!focusState?.last_change) return 'Unknown';

    const lastChange = new Date(focusState.last_change);
    const now = new Date();
    const diffMs = now.getTime() - lastChange.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    } else if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `${minutes}m ago`;
    } else {
      const hours = Math.floor(diffSeconds / 3600);
      return `${hours}h ago`;
    }
  };

  const handleBringToFocus = async () => {
    if (!targetApplication) return;

    try {
      // TODO: Replace with actual Tauri command call
      // await invoke('bring_application_to_focus', { appId: targetApplication.id });
      console.log('Bringing application to focus:', targetApplication.id);

      // Refresh focus state after attempting to bring to focus
      setTimeout(onRefresh, 500);
    } catch (err) {
      console.error('Failed to bring application to focus:', err);
    }
  };

  return (
    <div className="focus-indicator">
      <div className="indicator-header">
        <h3>Focus Status</h3>
        <button
          className="refresh-button"
          onClick={onRefresh}
          title="Refresh focus status"
        >
          🔄
        </button>
      </div>

      <div className={`focus-status ${getFocusStatusClass()}`}>
        <div className="status-main">
          <span className="status-icon">{getFocusStatusIcon()}</span>
          <span className="status-text">{getFocusStatusText()}</span>
        </div>

        {focusState && (
          <div className="status-details">
            <div className="detail-item">
              <span className="label">Last Change:</span>
              <span className="value">{getTimeSinceLastChange()}</span>
            </div>

            {focusState.focused_process_id && (
              <div className="detail-item">
                <span className="label">Focused Process:</span>
                <span className="value">PID {focusState.focused_process_id}</span>
              </div>
            )}

            {focusState.focused_window_title && (
              <div className="detail-item">
                <span className="label">Window Title:</span>
                <span className="value" title={focusState.focused_window_title}>
                  {focusState.focused_window_title.length > 30
                    ? `${focusState.focused_window_title.slice(0, 30)}...`
                    : focusState.focused_window_title
                  }
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {targetApplication && (
        <div className="target-application">
          <h4>Target Application</h4>
          <div className="app-info">
            <div className="app-name">{targetApplication.name}</div>
            <div className="app-details">
              <span className="process-name">{targetApplication.process_name}</span>
              {targetApplication.process_id && (
                <span className="process-id">PID: {targetApplication.process_id}</span>
              )}
            </div>
          </div>

          {!focusState?.is_target_process_focused && (
            <button
              className="bring-to-focus-button"
              onClick={handleBringToFocus}
              title="Attempt to bring target application to focus"
            >
              🎯 Bring to Focus
            </button>
          )}
        </div>
      )}

      {!targetApplication && (
        <div className="no-target">
          <p>No target application selected</p>
          <p className="hint">Start a playback session to monitor focus</p>
        </div>
      )}

      <div className="focus-tips">
        <h4>Focus Tips</h4>
        <ul>
          <li>Keep the target application window visible and active</li>
          <li>Avoid switching to other applications during automation</li>
          <li>Use Alt+Tab (Windows) or Cmd+Tab (macOS) to switch back quickly</li>
        </ul>
      </div>
    </div>
  );
};
