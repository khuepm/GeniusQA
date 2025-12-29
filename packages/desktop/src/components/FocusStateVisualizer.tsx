import React, { useState, useEffect } from 'react';
import { FocusState, RegisteredApplication, ApplicationStatus } from '../types/applicationFocusedAutomation.types';
import './FocusStateVisualizer.css';

interface FocusStateVisualizerProps {
  focusState: FocusState | null;
  targetApplication: RegisteredApplication | null;
  isMonitoring: boolean;
}

export const FocusStateVisualizer: React.FC<FocusStateVisualizerProps> = ({
  focusState,
  targetApplication,
  isMonitoring,
}) => {
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [lastFocusChange, setLastFocusChange] = useState<string | null>(null);
  const [focusHistory, setFocusHistory] = useState<Array<{
    timestamp: string;
    focused: boolean;
    duration?: number;
  }>>([]);

  useEffect(() => {
    if (focusState?.last_change && focusState.last_change !== lastFocusChange) {
      setLastFocusChange(focusState.last_change);
      setPulseAnimation(true);

      // Add to focus history
      setFocusHistory(prev => {
        const newEntry = {
          timestamp: focusState.last_change,
          focused: focusState.is_target_process_focused
        };

        // Calculate duration for previous entry
        const updatedHistory = [...prev];
        if (updatedHistory.length > 0) {
          const lastEntry = updatedHistory[updatedHistory.length - 1];
          const duration = new Date(focusState.last_change).getTime() - new Date(lastEntry.timestamp).getTime();
          lastEntry.duration = Math.floor(duration / 1000); // Convert to seconds
        }

        return [newEntry, ...updatedHistory.slice(0, 9)]; // Keep last 10 entries
      });

      // Reset pulse animation after 1 second
      const timer = setTimeout(() => {
        setPulseAnimation(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [focusState?.last_change, lastFocusChange]);

  const getVisualizationState = () => {
    if (!isMonitoring) return 'inactive';
    if (!focusState) return 'unknown';
    if (targetApplication?.status !== ApplicationStatus.Active) return 'app-error';
    return focusState.is_target_process_focused ? 'focused' : 'unfocused';
  };

  const getStatusIcon = () => {
    const state = getVisualizationState();
    switch (state) {
      case 'focused':
        return '🎯';
      case 'unfocused':
        return '⚠️';
      case 'inactive':
        return '⏸️';
      case 'app-error':
        return '❌';
      case 'unknown':
      default:
        return '❓';
    }
  };

  const getStatusText = () => {
    const state = getVisualizationState();
    switch (state) {
      case 'focused':
        return 'Target Focused';
      case 'unfocused':
        return 'Focus Lost';
      case 'inactive':
        return 'Not Monitoring';
      case 'app-error':
        return 'Application Error';
      case 'unknown':
      default:
        return 'Unknown State';
    }
  };

  const getStatusDescription = () => {
    const state = getVisualizationState();
    switch (state) {
      case 'focused':
        return 'Automation can proceed safely';
      case 'unfocused':
        return 'Automation may be paused or restricted';
      case 'inactive':
        return 'Focus monitoring is not active';
      case 'app-error':
        return 'Target application has issues';
      case 'unknown':
      default:
        return 'Unable to determine focus state';
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  const getFocusStability = (): { score: number; label: string; color: string } => {
    if (focusHistory.length < 2) {
      return { score: 100, label: 'Stable', color: 'good' };
    }

    const recentChanges = focusHistory.slice(0, 5); // Last 5 changes
    const totalTime = recentChanges.reduce((sum, entry) => sum + (entry.duration || 0), 0);
    const avgDuration = totalTime / recentChanges.length;

    if (avgDuration > 300) { // 5+ minutes average
      return { score: 100, label: 'Very Stable', color: 'excellent' };
    } else if (avgDuration > 60) { // 1+ minute average
      return { score: 80, label: 'Stable', color: 'good' };
    } else if (avgDuration > 10) { // 10+ seconds average
      return { score: 60, label: 'Moderate', color: 'warning' };
    } else {
      return { score: 30, label: 'Unstable', color: 'poor' };
    }
  };

  const stability = getFocusStability();

  return (
    <div className={`focus-state-visualizer ${getVisualizationState()}`}>
      <div className="visualizer-header">
        <h4>Focus Monitor</h4>
        <div className="header-indicators">
          <div className={`monitoring-indicator ${isMonitoring ? 'active' : 'inactive'}`}>
            <span className="indicator-dot"></span>
            <span className="indicator-text">
              {isMonitoring ? 'Monitoring' : 'Inactive'}
            </span>
          </div>
          <div className={`stability-indicator ${stability.color}`}>
            <span className="stability-score">{stability.score}%</span>
            <span className="stability-label">{stability.label}</span>
          </div>
        </div>
      </div>

      <div className={`focus-visualization ${pulseAnimation ? 'pulse' : ''}`}>
        <div className="focus-circle">
          <div className="focus-icon">{getStatusIcon()}</div>
          <div className="focus-ripple"></div>
          {isMonitoring && (
            <div className="monitoring-ring"></div>
          )}
        </div>

        <div className="focus-details">
          <div className="focus-status-text">{getStatusText()}</div>
          <div className="focus-description">{getStatusDescription()}</div>
          {focusState && (
            <div className="real-time-badge">
              <span className="live-dot"></span>
              <span className="live-text">REAL-TIME</span>
            </div>
          )}
        </div>
      </div>

      {targetApplication && (
        <div className="target-info">
          <div className="target-label">Target Application</div>
          <div className="target-name">{targetApplication.name}</div>
          <div className="target-details">
            {targetApplication.process_id && (
              <span className="target-pid">PID: {targetApplication.process_id}</span>
            )}
            <span className={`target-status ${targetApplication.status.toLowerCase()}`}>
              {targetApplication.status}
            </span>
          </div>
        </div>
      )}

      {focusState && (
        <div className="focus-metrics">
          <div className="metric-item">
            <span className="metric-label">Last Change</span>
            <span className="metric-value">
              {new Date(focusState.last_change).toLocaleTimeString()}
            </span>
          </div>

          {focusState.focused_process_id && (
            <div className="metric-item">
              <span className="metric-label">Current Focus</span>
              <span className="metric-value">PID {focusState.focused_process_id}</span>
            </div>
          )}

          {focusState.focused_window_title && (
            <div className="metric-item">
              <span className="metric-label">Window</span>
              <span className="metric-value" title={focusState.focused_window_title}>
                {focusState.focused_window_title.length > 20
                  ? `${focusState.focused_window_title.slice(0, 20)}...`
                  : focusState.focused_window_title
                }
              </span>
            </div>
          )}
        </div>
      )}

      {focusHistory.length > 0 && (
        <div className="focus-history">
          <h5>Recent Focus Changes</h5>
          <div className="history-list">
            {focusHistory.slice(0, 5).map((entry, index) => (
              <div key={index} className={`history-item ${entry.focused ? 'focused' : 'unfocused'}`}>
                <div className="history-icon">
                  {entry.focused ? '🎯' : '⚠️'}
                </div>
                <div className="history-details">
                  <div className="history-status">
                    {entry.focused ? 'Gained Focus' : 'Lost Focus'}
                  </div>
                  <div className="history-time">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                    {entry.duration && (
                      <span className="history-duration">
                        ({formatDuration(entry.duration)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="visualization-legend">
        <div className="legend-item">
          <span className="legend-icon focused">🎯</span>
          <span className="legend-text">Focused</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon unfocused">⚠️</span>
          <span className="legend-text">Unfocused</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon inactive">⏸️</span>
          <span className="legend-text">Inactive</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon app-error">❌</span>
          <span className="legend-text">App Error</span>
        </div>
      </div>
    </div>
  );
};
