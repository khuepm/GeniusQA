import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import {
  PlaybackSession,
  PlaybackState,
  FocusState,
  RegisteredApplication,
  NotificationData,
  FocusLossStrategy
} from '../types/applicationFocusedAutomation.types';
import './EnhancedStatusDisplay.css';

interface EnhancedStatusDisplayProps {
  focusState: FocusState | null;
  playbackSession: PlaybackSession | null;
  targetApplication: RegisteredApplication | null;
  notifications: NotificationData[];
  isConnected: boolean;
  connectionError: string | null;
  onRetryConnection: () => void;
  onDismissNotification: (id: string) => void;
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  last_error?: string;
  performance_metrics?: {
    focus_check_latency_ms: number;
    event_processing_rate: number;
    memory_usage_mb: number;
  };
}

export const EnhancedStatusDisplay: React.FC<EnhancedStatusDisplayProps> = ({
  focusState,
  playbackSession,
  targetApplication,
  notifications,
  isConnected,
  connectionError,
  onRetryConnection,
  onDismissNotification
}) => {
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      checkServiceHealth();
      setLastUpdateTime(new Date());
    }, 5000);

    checkServiceHealth();
    return () => clearInterval(interval);
  }, []);

  const checkServiceHealth = async () => {
    try {
      const health = await invoke<ServiceHealth>('get_service_health');
      setServiceHealth(health);
    } catch (err) {
      console.warn('Failed to get service health:', err);
      setServiceHealth({
        status: 'unhealthy',
        uptime: 0,
        last_error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  };

  const getStatusColor = () => {
    if (!isConnected || connectionError) return 'error';
    if (!serviceHealth) return 'warning';

    switch (serviceHealth.status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'unhealthy': return 'error';
      default: return 'neutral';
    }
  };

  const getPlaybackStatusInfo = () => {
    if (!playbackSession) {
      return {
        status: 'No active session',
        color: 'neutral',
        icon: '⏹️',
        description: 'No automation session is currently running'
      };
    }

    switch (playbackSession.state) {
      case PlaybackState.Running:
        return {
          status: 'Running',
          color: 'success',
          icon: '▶️',
          description: 'Automation is actively running'
        };
      case PlaybackState.Paused:
        const reason = playbackSession.paused_reason || 'Unknown';
        return {
          status: `Paused (${reason})`,
          color: 'warning',
          icon: '⏸️',
          description: `Automation paused due to: ${reason}`
        };
      case PlaybackState.Completed:
        return {
          status: 'Completed',
          color: 'success',
          icon: '✅',
          description: 'Automation completed successfully'
        };
      case PlaybackState.Failed:
        return {
          status: 'Failed',
          color: 'error',
          icon: '❌',
          description: `Automation failed: ${playbackSession.error_message || 'Unknown error'}`
        };
      case PlaybackState.Aborted:
        return {
          status: 'Aborted',
          color: 'error',
          icon: '🛑',
          description: `Automation aborted: ${playbackSession.error_message || 'User requested'}`
        };
      default:
        return {
          status: 'Unknown',
          color: 'neutral',
          icon: '❓',
          description: 'Unknown automation state'
        };
    }
  };

  const getFocusStatusInfo = () => {
    if (!focusState) {
      return {
        status: 'Unknown',
        color: 'neutral',
        icon: '❓',
        description: 'Focus state is not available'
      };
    }

    if (focusState.is_target_process_focused) {
      return {
        status: 'Focused',
        color: 'success',
        icon: '🎯',
        description: 'Target application is currently focused'
      };
    } else {
      const focusedApp = focusState.focused_window_title || 'Unknown application';
      return {
        status: 'Not Focused',
        color: 'warning',
        icon: '👁️',
        description: `Currently focused: ${focusedApp}`
      };
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatTimestamp = (timestamp: string | Date) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString();
  };

  const playbackStatus = getPlaybackStatusInfo();
  const focusStatus = getFocusStatusInfo();
  const statusColor = getStatusColor();

  return (
    <div className="enhanced-status-display">
      {/* Main Status Header */}
      <div className={`status-header ${statusColor}`}>
        <div className="status-main">
          <div className="status-indicator">
            <span className={`indicator-dot ${statusColor}`} />
            <span className="status-text">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="last-update">
            Last updated: {formatTimestamp(lastUpdateTime)}
          </div>
        </div>

        <button
          className="expand-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'Collapse details' : 'Expand details'}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {/* Connection Error Banner */}
      {connectionError && (
        <div className="connection-error">
          <div className="error-content">
            <span className="error-icon">🔌</span>
            <div className="error-details">
              <strong>Connection Error</strong>
              <p>{connectionError}</p>
            </div>
          </div>
          <button
            className="retry-button"
            onClick={onRetryConnection}
          >
            Retry
          </button>
        </div>
      )}

      {/* Quick Status Cards */}
      <div className="status-cards">
        <div className={`status-card playback ${playbackStatus.color}`}>
          <div className="card-header">
            <span className="card-icon">{playbackStatus.icon}</span>
            <span className="card-title">Playback</span>
          </div>
          <div className="card-status">{playbackStatus.status}</div>
          <div className="card-description">{playbackStatus.description}</div>
        </div>

        <div className={`status-card focus ${focusStatus.color}`}>
          <div className="card-header">
            <span className="card-icon">{focusStatus.icon}</span>
            <span className="card-title">Focus</span>
          </div>
          <div className="card-status">{focusStatus.status}</div>
          <div className="card-description">{focusStatus.description}</div>
        </div>

        {targetApplication && (
          <div className="status-card application neutral">
            <div className="card-header">
              <span className="card-icon">📱</span>
              <span className="card-title">Target App</span>
            </div>
            <div className="card-status">{targetApplication.name}</div>
            <div className="card-description">
              Status: {targetApplication.status}
              {targetApplication.process_id && ` (PID: ${targetApplication.process_id})`}
            </div>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="expanded-details">
          {/* Service Health */}
          {serviceHealth && (
            <div className="detail-section">
              <h4>Service Health</h4>
              <div className="health-metrics">
                <div className="metric">
                  <span className="metric-label">Status:</span>
                  <span className={`metric-value ${serviceHealth.status}`}>
                    {serviceHealth.status.toUpperCase()}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Uptime:</span>
                  <span className="metric-value">{formatUptime(serviceHealth.uptime)}</span>
                </div>
                {serviceHealth.performance_metrics && (
                  <>
                    <div className="metric">
                      <span className="metric-label">Focus Latency:</span>
                      <span className="metric-value">
                        {serviceHealth.performance_metrics.focus_check_latency_ms}ms
                      </span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Event Rate:</span>
                      <span className="metric-value">
                        {serviceHealth.performance_metrics.event_processing_rate}/s
                      </span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Memory:</span>
                      <span className="metric-value">
                        {serviceHealth.performance_metrics.memory_usage_mb}MB
                      </span>
                    </div>
                  </>
                )}
                {serviceHealth.last_error && (
                  <div className="metric error">
                    <span className="metric-label">Last Error:</span>
                    <span className="metric-value">{serviceHealth.last_error}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Session Details */}
          {playbackSession && (
            <div className="detail-section">
              <h4>Session Details</h4>
              <div className="session-info">
                <div className="info-row">
                  <span className="info-label">Session ID:</span>
                  <span className="info-value">{playbackSession.id}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Started:</span>
                  <span className="info-value">{formatTimestamp(playbackSession.started_at)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Focus Strategy:</span>
                  <span className="info-value">{playbackSession.focus_strategy}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Current Step:</span>
                  <span className="info-value">
                    {playbackSession.current_step} / {playbackSession.total_steps || '?'}
                  </span>
                </div>
                {playbackSession.paused_at && (
                  <div className="info-row">
                    <span className="info-label">Paused At:</span>
                    <span className="info-value">{formatTimestamp(playbackSession.paused_at)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Focus Details */}
          {focusState && (
            <div className="detail-section">
              <h4>Focus Details</h4>
              <div className="focus-info">
                <div className="info-row">
                  <span className="info-label">Target Focused:</span>
                  <span className={`info-value ${focusState.is_target_process_focused ? 'success' : 'warning'}`}>
                    {focusState.is_target_process_focused ? 'Yes' : 'No'}
                  </span>
                </div>
                {focusState.focused_process_id && (
                  <div className="info-row">
                    <span className="info-label">Focused PID:</span>
                    <span className="info-value">{focusState.focused_process_id}</span>
                  </div>
                )}
                {focusState.focused_window_title && (
                  <div className="info-row">
                    <span className="info-label">Focused Window:</span>
                    <span className="info-value">{focusState.focused_window_title}</span>
                  </div>
                )}
                <div className="info-row">
                  <span className="info-label">Last Change:</span>
                  <span className="info-value">{formatTimestamp(focusState.last_change)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Notifications */}
      {notifications.length > 0 && (
        <div className="active-notifications">
          <h4>Active Notifications</h4>
          <div className="notification-list">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`notification-item ${notification.type}`}
              >
                <div className="notification-content">
                  <div className="notification-title">{notification.title}</div>
                  <div className="notification-message">{notification.message}</div>
                  <div className="notification-time">
                    {formatTimestamp(notification.timestamp)}
                  </div>
                </div>
                <button
                  className="dismiss-notification"
                  onClick={() => onDismissNotification(notification.id)}
                  title="Dismiss notification"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
