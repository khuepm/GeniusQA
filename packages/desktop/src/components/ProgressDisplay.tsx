import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { PlaybackSession, PlaybackState, FocusState, FocusLossStrategy } from '../types/applicationFocusedAutomation.types';
import './ProgressDisplay.css';

interface ProgressDisplayProps {
  currentSession: PlaybackSession | null;
  focusState: FocusState | null;
}

export const ProgressDisplay: React.FC<ProgressDisplayProps> = ({
  currentSession,
  focusState,
}) => {
  const [estimatedTotalSteps, setEstimatedTotalSteps] = useState<number>(100);
  const [isRecovering, setIsRecovering] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Update estimated total steps based on session progress
  useEffect(() => {
    if (currentSession && currentSession.current_step > estimatedTotalSteps) {
      setEstimatedTotalSteps(currentSession.current_step + 20); // Add buffer
    }
  }, [currentSession?.current_step, estimatedTotalSteps]);

  // Track error states
  useEffect(() => {
    if (currentSession?.state === PlaybackState.Failed) {
      setLastError('Automation session failed');
    } else if (currentSession?.state === PlaybackState.Aborted) {
      setLastError('Automation session was aborted');
    } else {
      setLastError(null);
    }
  }, [currentSession?.state]);

  const getProgressPercentage = (): number => {
    if (!currentSession) return 0;

    // Calculate progress based on current step and estimated total
    const progress = Math.min((currentSession.current_step / estimatedTotalSteps) * 100, 100);
    return Math.max(progress, 0);
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

  const getTotalPauseDuration = (): string => {
    if (!currentSession?.total_pause_duration) return '00:00:00';

    const totalSeconds = currentSession.total_pause_duration;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getEstimatedTimeRemaining = (): string => {
    if (!currentSession || currentSession.current_step === 0) return 'Calculating...';

    const elapsedMs = new Date().getTime() - new Date(currentSession.started_at).getTime();
    const stepsPerMs = currentSession.current_step / elapsedMs;
    const remainingSteps = estimatedTotalSteps - currentSession.current_step;
    const estimatedRemainingMs = remainingSteps / stepsPerMs;

    if (!isFinite(estimatedRemainingMs) || estimatedRemainingMs < 0) {
      return 'Unknown';
    }

    const hours = Math.floor(estimatedRemainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((estimatedRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((estimatedRemainingMs % (1000 * 60)) / 1000);

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

  const getFocusStrategyDescription = (strategy: FocusLossStrategy): string => {
    switch (strategy) {
      case FocusLossStrategy.AutoPause:
        return 'Pauses when focus is lost, resumes when regained';
      case FocusLossStrategy.StrictError:
        return 'Stops immediately if focus is lost';
      case FocusLossStrategy.Ignore:
        return 'Continues running regardless of focus';
      default:
        return 'Unknown strategy';
    }
  };

  const handleRetrySession = async () => {
    if (!currentSession) return;

    try {
      setIsRecovering(true);
      await invoke('retry_failed_session', {
        sessionId: currentSession.id
      });
    } catch (err) {
      console.error('Failed to retry session:', err);
    } finally {
      setIsRecovering(false);
    }
  };

  const handleResetSession = async () => {
    if (!currentSession) return;

    try {
      setIsRecovering(true);
      await invoke('reset_session_to_checkpoint', {
        sessionId: currentSession.id
      });
    } catch (err) {
      console.error('Failed to reset session:', err);
    } finally {
      setIsRecovering(false);
    }
  };

  if (!currentSession) {
    return (
      <div className="progress-display">
        <div className="no-session">
          <div className="no-session-icon">📊</div>
          <h3>No Active Session</h3>
          <p>Start a playback session to see progress information</p>
          <div className="session-benefits">
            <h4>Session Monitoring Includes:</h4>
            <ul>
              <li>Real-time progress tracking</li>
              <li>Focus state monitoring</li>
              <li>Error detection and recovery</li>
              <li>Performance metrics</li>
            </ul>
          </div>
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
            className={`progress-fill ${getStateColor(currentSession.state)}`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="progress-text">
          {progressPercentage.toFixed(1)}% Complete
          {currentSession.state === PlaybackState.Running && (
            <span className="progress-live">
              <span className="live-dot"></span>
              LIVE
            </span>
          )}
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

          <div className="stat-item">
            <span className="stat-label">Est. Remaining</span>
            <span className="stat-value">{getEstimatedTimeRemaining()}</span>
          </div>

          {currentSession.state === PlaybackState.Paused && (
            <div className="stat-item">
              <span className="stat-label">Paused For</span>
              <span className="stat-value">{getPausedDuration()}</span>
            </div>
          )}

          {currentSession.total_pause_duration && currentSession.total_pause_duration > 0 && (
            <div className="stat-item">
              <span className="stat-label">Total Paused</span>
              <span className="stat-value">{getTotalPauseDuration()}</span>
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
                <div className="focus-strategy-info">
                  Strategy: {getFocusStrategyDescription(currentSession.focus_strategy)}
                </div>
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

      {/* Error Recovery Section */}
      {(currentSession.state === PlaybackState.Failed || currentSession.state === PlaybackState.Aborted) && (
        <div className="error-recovery">
          <h4>Error Recovery</h4>
          {lastError && (
            <div className="error-message">
              <span className="error-icon">❌</span>
              <span>{lastError}</span>
            </div>
          )}
          <div className="recovery-actions">
            <button
              className={`recovery-button retry ${isRecovering ? 'loading' : ''}`}
              onClick={handleRetrySession}
              disabled={isRecovering}
              title="Retry the failed session from the last checkpoint"
            >
              {isRecovering ? '⏳ Retrying...' : '🔄 Retry Session'}
            </button>
            <button
              className={`recovery-button reset ${isRecovering ? 'loading' : ''}`}
              onClick={handleResetSession}
              disabled={isRecovering}
              title="Reset session to the last stable checkpoint"
            >
              {isRecovering ? '⏳ Resetting...' : '↩️ Reset to Checkpoint'}
            </button>
          </div>
          <div className="recovery-tips">
            <h5>Recovery Tips:</h5>
            <ul>
              <li>Ensure target application is running and accessible</li>
              <li>Check that focus permissions are granted</li>
              <li>Verify no blocking dialogs are open</li>
              <li>Consider adjusting focus strategy if needed</li>
            </ul>
          </div>
        </div>
      )}

      {currentSession.state === PlaybackState.Completed && (
        <div className="completion-details">
          <h4>Session Completed Successfully! 🎉</h4>
          <p>The automation session completed all steps successfully.</p>
          <div className="completion-stats">
            <div className="completion-stat">
              <span className="label">Total Steps:</span>
              <span className="value">{currentSession.current_step}</span>
            </div>
            <div className="completion-stat">
              <span className="label">Total Time:</span>
              <span className="value">{getElapsedTime()}</span>
            </div>
            {currentSession.total_pause_duration && currentSession.total_pause_duration > 0 && (
              <div className="completion-stat">
                <span className="label">Time Paused:</span>
                <span className="value">{getTotalPauseDuration()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
