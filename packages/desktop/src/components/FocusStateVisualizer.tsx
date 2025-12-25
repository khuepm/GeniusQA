import React, { useState, useEffect } from 'react';
import { FocusState, RegisteredApplication } from '../types/applicationFocusedAutomation.types';
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

  useEffect(() => {
    if (focusState?.last_change && focusState.last_change !== lastFocusChange) {
      setLastFocusChange(focusState.last_change);
      setPulseAnimation(true);

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
      case 'unknown':
      default:
        return 'Unable to determine focus state';
    }
  };

  return (
    <div className={`focus-state-visualizer ${getVisualizationState()}`}>
      <div className="visualizer-header">
        <h4>Focus Monitor</h4>
        <div className={`monitoring-indicator ${isMonitoring ? 'active' : 'inactive'}`}>
          <span className="indicator-dot"></span>
          <span className="indicator-text">
            {isMonitoring ? 'Monitoring' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className={`focus-visualization ${pulseAnimation ? 'pulse' : ''}`}>
        <div className="focus-circle">
          <div className="focus-icon">{getStatusIcon()}</div>
          <div className="focus-ripple"></div>
        </div>

        <div className="focus-details">
          <div className="focus-status-text">{getStatusText()}</div>
          <div className="focus-description">{getStatusDescription()}</div>
        </div>
      </div>

      {targetApplication && (
        <div className="target-info">
          <div className="target-label">Target Application</div>
          <div className="target-name">{targetApplication.name}</div>
          {targetApplication.process_id && (
            <div className="target-pid">PID: {targetApplication.process_id}</div>
          )}
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
      </div>
    </div>
  );
};
