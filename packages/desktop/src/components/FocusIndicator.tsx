import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { FocusState, RegisteredApplication, ApplicationStatus } from '../types/applicationFocusedAutomation.types';
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
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<'good' | 'warning' | 'error'>('good');

  // Update last update time when focus state changes
  useEffect(() => {
    if (focusState) {
      setLastUpdateTime(new Date());
      setConnectionHealth('good');
    }
  }, [focusState]);

  // Check connection health based on last update
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeSinceUpdate = now.getTime() - lastUpdateTime.getTime();

      if (timeSinceUpdate > 30000) { // 30 seconds
        setConnectionHealth('error');
      } else if (timeSinceUpdate > 10000) { // 10 seconds
        setConnectionHealth('warning');
      } else {
        setConnectionHealth('good');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdateTime]);

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

  const getApplicationStatusIcon = (status: ApplicationStatus): string => {
    switch (status) {
      case ApplicationStatus.Active:
        return '🟢';
      case ApplicationStatus.Inactive:
        return '🟡';
      case ApplicationStatus.NotFound:
        return '🔴';
      case ApplicationStatus.Error:
        return '❌';
      case ApplicationStatus.PermissionDenied:
        return '🔒';
      case ApplicationStatus.SecureInputBlocked:
        return '🛡️';
      default:
        return '❓';
    }
  };

  const getApplicationStatusText = (status: ApplicationStatus): string => {
    switch (status) {
      case ApplicationStatus.Active:
        return 'Running';
      case ApplicationStatus.Inactive:
        return 'Not Running';
      case ApplicationStatus.NotFound:
        return 'Not Found';
      case ApplicationStatus.Error:
        return 'Error';
      case ApplicationStatus.PermissionDenied:
        return 'Permission Denied';
      case ApplicationStatus.SecureInputBlocked:
        return 'Secure Input Active';
      default:
        return 'Unknown';
    }
  };

  const getRecoveryActions = (status: ApplicationStatus): string[] => {
    switch (status) {
      case ApplicationStatus.Inactive:
        return ['Launch the application', 'Refresh status'];
      case ApplicationStatus.NotFound:
        return ['Check if application is installed', 'Re-register application'];
      case ApplicationStatus.PermissionDenied:
        return ['Grant accessibility permissions in System Preferences', 'Restart GeniusQA'];
      case ApplicationStatus.SecureInputBlocked:
        return ['Close password dialogs or secure input fields', 'Wait for secure input to end'];
      case ApplicationStatus.Error:
        return ['Check application logs', 'Restart application', 'Contact support'];
      default:
        return [];
    }
  };

  const handleBringToFocus = async () => {
    if (!targetApplication) return;

    try {
      setIsRefreshing(true);
      console.log('Bringing application to focus:', targetApplication.id);

      // Attempt to bring application to focus using Tauri command
      await invoke('bring_application_to_focus', {
        appId: targetApplication.id
      });

      // Refresh focus state after a short delay
      setTimeout(() => {
        onRefresh();
        setIsRefreshing(false);
      }, 1000);
    } catch (err) {
      console.error('Failed to bring application to focus:', err);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const getConnectionHealthIcon = (): string => {
    switch (connectionHealth) {
      case 'good':
        return '🟢';
      case 'warning':
        return '🟡';
      case 'error':
        return '🔴';
      default:
        return '❓';
    }
  };

  const getConnectionHealthText = (): string => {
    switch (connectionHealth) {
      case 'good':
        return 'Real-time updates active';
      case 'warning':
        return 'Updates may be delayed';
      case 'error':
        return 'Connection lost - data may be stale';
      default:
        return 'Unknown connection status';
    }
  };

  return (
    <div className="focus-indicator">
      <div className="indicator-header">
        <h3>Focus Status</h3>
        <div className="header-controls">
          <div className={`connection-health ${connectionHealth}`}>
            <span className="health-icon">{getConnectionHealthIcon()}</span>
            <span className="health-text">{getConnectionHealthText()}</span>
          </div>
          <button
            className={`refresh-button ${isRefreshing ? 'refreshing' : ''}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh focus status"
          >
            🔄
          </button>
        </div>
      </div>

      <div className={`focus-status ${getFocusStatusClass()}`}>
        <div className="status-main">
          <span className="status-icon">{getFocusStatusIcon()}</span>
          <span className="status-text">{getFocusStatusText()}</span>
          <div className="real-time-indicator">
            <span className="live-dot"></span>
            <span className="live-text">LIVE</span>
          </div>
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
            <div className="app-header">
              <div className="app-name">{targetApplication.name}</div>
              <div className={`app-status ${targetApplication.status.toLowerCase()}`}>
                <span className="status-icon">{getApplicationStatusIcon(targetApplication.status)}</span>
                <span className="status-text">{getApplicationStatusText(targetApplication.status)}</span>
              </div>
            </div>
            <div className="app-details">
              <span className="process-name">{targetApplication.process_name}</span>
              {targetApplication.process_id && (
                <span className="process-id">PID: {targetApplication.process_id}</span>
              )}
            </div>
          </div>

          {/* Recovery Actions for problematic statuses */}
          {targetApplication.status !== ApplicationStatus.Active && (
            <div className="recovery-section">
              <h5>Recovery Actions</h5>
              <ul className="recovery-actions">
                {getRecoveryActions(targetApplication.status).map((action, index) => (
                  <li key={index} className="recovery-action">
                    <span className="action-bullet">•</span>
                    <span className="action-text">{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!focusState?.is_target_process_focused && targetApplication.status === ApplicationStatus.Active && (
            <button
              className={`bring-to-focus-button ${isRefreshing ? 'loading' : ''}`}
              onClick={handleBringToFocus}
              disabled={isRefreshing}
              title="Attempt to bring target application to focus"
            >
              {isRefreshing ? '⏳ Focusing...' : '🎯 Bring to Focus'}
            </button>
          )}
        </div>
      )}

      {!targetApplication && (
        <div className="no-target">
          <div className="no-target-icon">🎯</div>
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
          <li>Real-time updates show focus changes immediately</li>
        </ul>
      </div>
    </div>
  );
};
