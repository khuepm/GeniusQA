import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { PlaybackControls } from '../components/PlaybackControls';
import { FocusIndicator } from '../components/FocusIndicator';
import { ProgressDisplay } from '../components/ProgressDisplay';
import { NotificationArea } from '../components/NotificationArea';
import { FocusStateVisualizer } from '../components/FocusStateVisualizer';
import { OnboardingWizard } from '../components/OnboardingWizard';
import { EnhancedStatusDisplay } from '../components/EnhancedStatusDisplay';
import { useApplicationFocusEvents } from '../hooks/useApplicationFocusEvents';
import { onboardingService } from '../services/onboardingService';
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
  const [targetApplication, setTargetApplication] = useState<RegisteredApplication | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if onboarding should be shown
  useEffect(() => {
    if (onboardingService.shouldShowOnboarding()) {
      setShowOnboarding(true);
    }
  }, []);

  // Use the real-time events hook
  const {
    focusState,
    playbackSession: currentSession,
    notifications,
    isConnected,
    connectionError,
    reconnectAttempts,
    maxReconnectAttempts,
    dismissNotification,
    reconnect
  } = useApplicationFocusEvents(currentSessionId || undefined);

  useEffect(() => {
    loadCurrentSession();
    loadTargetApplication();
  }, []);

  // Update target application and session ID when session changes
  useEffect(() => {
    if (currentSession?.target_app_id) {
      setCurrentSessionId(currentSession.target_app_id);
      loadTargetApplication(currentSession.target_app_id);
    } else {
      setCurrentSessionId(null);
    }
  }, [currentSession?.target_app_id]);

  const loadCurrentSession = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const sessionData = await invoke<any>('get_playback_status');

      // The session data will be updated via the real-time events hook
      // This is just for initial load
      console.log('Initial session load:', sessionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTargetApplication = async (appId?: string) => {
    if (!appId && !currentSession?.target_app_id) return;

    try {
      const targetAppId = appId || currentSession?.target_app_id;
      const app = await invoke<RegisteredApplication>('get_application', {
        appId: targetAppId
      });
      setTargetApplication(app);
    } catch (err) {
      console.error('Failed to load target application:', err);
      setTargetApplication(null);
    }
  };

  const handleStartPlayback = async (
    targetAppId: string,
    focusStrategy: FocusLossStrategy,
    scriptPath?: string
  ) => {
    try {
      setError(null);
      const sessionId = await invoke<string>('start_focused_playback', {
        appId: targetAppId,
        focusStrategy
      });

      console.log('Started playback session:', sessionId);

      // Load target application info
      await loadTargetApplication(targetAppId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start playback');
    }
  };

  const handlePausePlayback = async () => {
    try {
      setError(null);
      await invoke('pause_focused_playback', {
        reason: 'UserRequested'
      });
      // Session state will be updated via real-time events
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause playback');
    }
  };

  const handleResumePlayback = async () => {
    try {
      setError(null);
      await invoke('resume_focused_playback');
      // Session state will be updated via real-time events
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume playback');
    }
  };

  const handleStopPlayback = async () => {
    try {
      setError(null);
      await invoke('stop_focused_playback');
      // Session state will be updated via real-time events
      setTargetApplication(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop playback');
    }
  };

  const handleDismissNotification = (notificationId: string) => {
    dismissNotification(notificationId);
  };

  const handleRefreshFocus = async () => {
    // Focus state is now managed by real-time events
    // This could trigger a manual refresh if needed
    console.log('Focus refresh requested - using real-time data');
  };

  const handleOnboardingComplete = () => {
    onboardingService.completeOnboarding();
    setShowOnboarding(false);
  };

  const handleOnboardingSkip = () => {
    onboardingService.skipOnboarding();
    setShowOnboarding(false);
  };

  const handleRetryConnection = () => {
    reconnect();
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
      {/* Onboarding Wizard */}
      {showOnboarding && (
        <OnboardingWizard
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}

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

      {/* Enhanced Status Display */}
      <EnhancedStatusDisplay
        focusState={focusState}
        playbackSession={currentSession}
        targetApplication={targetApplication}
        notifications={notifications}
        isConnected={isConnected}
        connectionError={connectionError}
        onRetryConnection={handleRetryConnection}
        onDismissNotification={handleDismissNotification}
      />

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
