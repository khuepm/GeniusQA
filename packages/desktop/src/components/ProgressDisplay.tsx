import React from 'react';
import { PlaybackSession, PlaybackState, FocusState } from '../types/applicationFocusedAutomation.types';
import './ProgressDisplay.css';

interface ProgressDisplayProps {
  currentSession: PlaybackSession | null;
  focusState: FocusState | null;
}

export const ProgressDisplay: React.FC<ProgressDisplayProps> = ({
  currentSession,
  focusState,
}) => {
  const getProgressPercentage = (): number => {
    if (!currentSession) return 0;

    // For now, we'll calculate based on current step
    // In a real implementation, this would be based on total steps
    const totalSteps = 100; // Mock total steps
    return Math.min((currentSession.current_step / totalSteps) * 100, 100);
  };

  const getElapsedTime = (): string => {
    if (!currentSession) return '00:00:00';

    const startTime = new Date(currentSession.started_at);
    const now = new Date();
    const elapsedMs = now.getTime() - startTime.getTime();

    const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
    const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((elapsedMs % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getPausedDuration = (): string => {
    if (!currentSession?.paused_at) return '00:00:00';

    const pausedTime = new Date(currentSession.paused_at);
    const now = new Date();
    const pausedMs = now.getTime() - pausedTime.getTime();

    const hours = Math.floor(pausedMs / (1000 * 60 * 60));
    const minutes = Math.floor((pausedMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((pausedMs % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStateIcon = (state: PlaybackState): string => {
    switch (state) {
      case PlaybackState.Running:
        return '▶️';
      case PlaybackState.Paused:
        return '⏸️';
      case PlaybackState.Completed:
        return '✅';
      case PlaybackState.Failed:
        return '❌';
      case PlaybackState.Aborted:
        return '⏹️';
      default:
        return '❓';
    }
  };

  const getStateColor = (state: PlaybackState): string => {
    switch (state) {
      case PlaybackState.Running:
        return 'running';
      case PlaybackState.Paused:
        return 'paused';
      case PlaybackState.Completed:
        return 'completed';
      case PlaybackState.Failed:
        return 'failed';
      case PlaybackState.Aborted:
        return 'aborted';
      default:
        return 'unknown';
    }
  };

  if (!currentSession) {
    return (
      <div className="progress-display">
        <div className="no-session">
          <div className="no-session-icon">📊</div>
          <h3>No Active Session</h3>
          <p>Start a playback session to see progress information</p>
        </div>
      </div>
    );
  }

  const progressPercentage = getProgressPercentage();

  return (
    <div className="progress-display">
      <div className="progress-header">
        <h3>Automation Progress</h3>
        <div className={`session-state ${getStateColor(currentSession.state)}`}>
          <span className="state-icon">{getStateIcon(currentSession.state)}</span>
          <span className="state-text">{currentSession.state}</span>
        </div>
      </div>

      <div className="progress-bar-container">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="progress-text">
          {progressPercentage.toFixed(1)}% Complete
        </div>
      </div>

      <div className="progress-stats">
        <div className="stat-grid">
          <div className="stat-item">
            <span className="stat-label">Current Step</span>
            <span className="stat-value">{currentSession.current_step}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">Elapsed Time</span>
            <span className="stat-value">{getElapsedTime()}</span>
          </div>

          {currentSession.state === PlaybackState.Paused && (
            <div className="stat-item">
              <span className="stat-label">Paused For</span>
              <span className="stat-value">{getPausedDuration()}</span>
            </div>
          )}

          <div className="stat-item">
            <span className="stat-label">Target Process</span>
            <span className="stat-value">PID {currentSession.target_process_id}</span>
          </div>
        </div>
      </div>

      {focusState && (
        <div className="focus-impact">
          <h4>Focus Impact</h4>
          <div className="focus-status-summary">
            {focusState.is_target_process_focused ? (
              <div className="focus-good">
                <span className="icon">✅</span>
                <span>Target application is focused - automation can proceed</span>
              </div>
            ) : (
              <div className="focus-warning">
                <span className="icon">⚠️</span>
                <span>Target application is not focused - automation may be paused</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="session-metadata">
        <h4>Session Details</h4>
        <div className="metadata-grid">
          <div className="metadata-item">
            <span className="label">Session ID:</span>
            <span className="value" title={currentSession.id}>
              {currentSession.id.slice(0, 12)}...
            </span>
          </div>

          <div className="metadata-item">
            <span className="label">Started:</span>
            <span className="value">
              {new Date(currentSession.started_at).toLocaleString()}
            </span>
          </div>

          <div className="metadata-item">
            <span className="label">Focus Strategy:</span>
            <span className="value">{currentSession.focus_strategy}</span>
          </div>

          <div className="metadata-item">
            <span className="label">Target App:</span>
            <span className="value">{currentSession.target_app_id}</span>
          </div>
        </div>
      </div>

      {currentSession.state === PlaybackState.Failed && (
        <div className="error-details">
          <h4>Error Information</h4>
          <p>The automation session failed. Check the logs for more details.</p>
        </div>
      )}

      {currentSession.state === PlaybackState.Completed && (
        <div className="completion-details">
          <h4>Session Completed</h4>
          <p>The automation session completed successfully!</p>
        </div>
      )}
    </div>
  );
};
