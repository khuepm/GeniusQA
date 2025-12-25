import React, { useState, useEffect } from 'react';
import { PlaybackControls } from '../components/PlaybackControls';
import { FocusIndicator } from '../components/FocusIndicator';
import { ProgressDisplay } from '../components/ProgressDisplay';
import { NotificationArea } from '../components/NotificationArea';
import { FocusStateVisualizer } from '../components/FocusStateVisualizer';
import {
  PlaybackSession,
  PlaybackState,
  FocusLossStrategy,
  RegisteredApplication,
  FocusState,
  NotificationData
} from '../types/applicationFocusedAutomation.types';
import './AutomationControlPanel.css';

export const AutomationControlPanel: React.FC = () => {
  const [currentSession, setCurrentSession] = useState<PlaybackSession | null>(null);
  const [focusState, setFocusState] = useState<FocusState | null>(null);
  const [targetApplication, setTargetApplication] = useState<RegisteredApplication | null>(null);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentSession();
    loadFocusState();
  }, []);

  const loadCurrentSession = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // TODO: Replace with actual Tauri command call
      // const session = await invoke('get_current_playback_session');
      // setCurrentSession(session);

      // Mock data for now
      setCurrentSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFocusState = async () => {
    try {
      // TODO: Replace with actual Tauri command call
      // const focus = await invoke('get_current_focus_state');
      // setFocusState(focus);

      // Mock data for now
      setFocusState({
        is_target_process_focused: false,
        focused_process_id: undefined,
        focused_window_title: undefined,
        last_change: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to load focus state:', err);
    }
  };

  const handleStartPlayback = async (
    targetAppId: string,
    focusStrategy: FocusLossStrategy,
    scriptPath?: string
  ) => {
    try {
      setError(null);
      // TODO: Replace with actual Tauri command call
      // const session = await invoke('start_playback', { 
      //   targetAppId, 
      //   focusStrategy, 
      //   scriptPath 
      // });
      // setCurrentSession(session);

      console.log('Starting playback:', { targetAppId, focusStrategy, scriptPath });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start playback');
    }
  };

  const handlePausePlayback = async () => {
    try {
      setError(null);
      // TODO: Replace with actual Tauri command call
      // await invoke('pause_playback');

      if (currentSession) {
        setCurrentSession({
          ...currentSession,
          state: PlaybackState.Paused,
          paused_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause playback');
    }
  };

  const handleResumePlayback = async () => {
    try {
      setError(null);
      // TODO: Replace with actual Tauri command call
      // await invoke('resume_playback');

      if (currentSession) {
        setCurrentSession({
          ...currentSession,
          state: PlaybackState.Running,
          paused_at: undefined,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume playback');
    }
  };

  const handleStopPlayback = async () => {
    try {
      setError(null);
      // TODO: Replace with actual Tauri command call
      // await invoke('stop_playback');

      setCurrentSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop playback');
    }
  };

  const handleDismissNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleRefreshFocus = async () => {
    await loadFocusState();
  };

  if (isLoading) {
    return (
      <div className="automation-control-panel">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading automation control...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="automation-control-panel">
      <div className="header">
        <h1>Automation Control</h1>
        <p>Control and monitor application-focused automation</p>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button
            className="error-dismiss"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="control-sections">
        <div className="main-controls">
          <PlaybackControls
            currentSession={currentSession}
            onStartPlayback={handleStartPlayback}
            onPausePlayback={handlePausePlayback}
            onResumePlayback={handleResumePlayback}
            onStopPlayback={handleStopPlayback}
          />

          <FocusIndicator
            focusState={focusState}
            targetApplication={targetApplication}
            onRefresh={handleRefreshFocus}
          />
        </div>

        <div className="progress-section">
          <ProgressDisplay
            currentSession={currentSession}
            focusState={focusState}
          />
        </div>
      </div>

      <div className="visualization-section">
        <FocusStateVisualizer
          focusState={focusState}
          targetApplication={targetApplication}
          isMonitoring={!!currentSession}
        />
      </div>

      <NotificationArea
        notifications={notifications}
        onDismissNotification={handleDismissNotification}
      />
    </div>
  );
};
