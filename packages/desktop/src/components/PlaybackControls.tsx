import React, { useState, useEffect } from 'react';
import {
  PlaybackSession,
  PlaybackState,
  FocusLossStrategy,
  RegisteredApplication
} from '../types/applicationFocusedAutomation.types';
import './PlaybackControls.css';

interface PlaybackControlsProps {
  currentSession: PlaybackSession | null;
  onStartPlayback: (targetAppId: string, focusStrategy: FocusLossStrategy, scriptPath?: string) => void;
  onPausePlayback: () => void;
  onResumePlayback: () => void;
  onStopPlayback: () => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  currentSession,
  onStartPlayback,
  onPausePlayback,
  onResumePlayback,
  onStopPlayback,
}) => {
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [selectedFocusStrategy, setSelectedFocusStrategy] = useState<FocusLossStrategy>(FocusLossStrategy.AutoPause);
  const [selectedScriptPath, setSelectedScriptPath] = useState<string>('');
  const [registeredApps, setRegisteredApps] = useState<RegisteredApplication[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadRegisteredApplications();
  }, []);

  const loadRegisteredApplications = async () => {
    try {
      setIsLoading(true);
      // TODO: Replace with actual Tauri command call
      // const apps = await invoke('get_registered_applications');
      // setRegisteredApps(apps);

      // Mock data for now
      setRegisteredApps([]);
    } catch (err) {
      console.error('Failed to load registered applications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = () => {
    if (!selectedAppId) {
      alert('Please select a target application');
      return;
    }
    onStartPlayback(selectedAppId, selectedFocusStrategy, selectedScriptPath || undefined);
  };

  const handlePause = () => {
    onPausePlayback();
  };

  const handleResume = () => {
    onResumePlayback();
  };

  const handleStop = () => {
    onStopPlayback();
  };

  const handleBrowseScript = async () => {
    try {
      // TODO: Replace with actual Tauri file dialog
      // const selected = await open({
      //   multiple: false,
      //   filters: [{
      //     name: 'Script Files',
      //     extensions: ['json', 'js', 'py']
      //   }]
      // });

      // if (selected && typeof selected === 'string') {
      //   setSelectedScriptPath(selected);
      // }

      console.log('Browse script clicked - TODO: implement file dialog');
    } catch (err) {
      console.error('Failed to browse for script:', err);
    }
  };

  const isSessionActive = currentSession &&
    (currentSession.state === PlaybackState.Running || currentSession.state === PlaybackState.Paused);

  const canStart = !isSessionActive && selectedAppId;
  const canPause = currentSession?.state === PlaybackState.Running;
  const canResume = currentSession?.state === PlaybackState.Paused;
  const canStop = isSessionActive;

  return (
    <div className="playback-controls">
      <div className="controls-header">
        <h3>Playback Controls</h3>
        {currentSession && (
          <div className="session-info">
            <span className="session-id">Session: {currentSession.id.slice(0, 8)}...</span>
            <span className={`session-state ${currentSession.state.toLowerCase()}`}>
              {currentSession.state}
            </span>
          </div>
        )}
      </div>

      {!isSessionActive && (
        <div className="setup-section">
          <div className="form-group">
            <label htmlFor="target-app">Target Application</label>
            <select
              id="target-app"
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              disabled={isLoading}
            >
              <option value="">Select an application...</option>
              {registeredApps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name} ({app.status})
                </option>
              ))}
            </select>
            {registeredApps.length === 0 && !isLoading && (
              <p className="no-apps-message">
                No registered applications. Please add applications first.
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="focus-strategy">Focus Loss Strategy</label>
            <select
              id="focus-strategy"
              value={selectedFocusStrategy}
              onChange={(e) => setSelectedFocusStrategy(e.target.value as FocusLossStrategy)}
            >
              <option value={FocusLossStrategy.AutoPause}>
                Auto Pause - Pause when focus is lost
              </option>
              <option value={FocusLossStrategy.StrictError}>
                Strict Error - Stop immediately on focus loss
              </option>
              <option value={FocusLossStrategy.Ignore}>
                Ignore - Continue with warnings
              </option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="script-path">Script Path (Optional)</label>
            <div className="input-with-button">
              <input
                id="script-path"
                type="text"
                value={selectedScriptPath}
                onChange={(e) => setSelectedScriptPath(e.target.value)}
                placeholder="Select a script file..."
                readOnly
              />
              <button
                type="button"
                className="browse-button"
                onClick={handleBrowseScript}
              >
                Browse
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="control-buttons">
        {!isSessionActive ? (
          <button
            className="control-button start"
            onClick={handleStart}
            disabled={!canStart}
            title={!selectedAppId ? 'Select a target application first' : 'Start automation playback'}
          >
            ▶️ Start Playback
          </button>
        ) : (
          <div className="active-controls">
            {canPause && (
              <button
                className="control-button pause"
                onClick={handlePause}
                title="Pause automation playback"
              >
                ⏸️ Pause
              </button>
            )}

            {canResume && (
              <button
                className="control-button resume"
                onClick={handleResume}
                title="Resume automation playback"
              >
                ▶️ Resume
              </button>
            )}

            {canStop && (
              <button
                className="control-button stop"
                onClick={handleStop}
                title="Stop automation playback"
              >
                ⏹️ Stop
              </button>
            )}
          </div>
        )}
      </div>

      {currentSession && (
        <div className="session-details">
          <div className="detail-row">
            <span className="label">Target App:</span>
            <span className="value">{currentSession.target_app_id}</span>
          </div>
          <div className="detail-row">
            <span className="label">Focus Strategy:</span>
            <span className="value">{currentSession.focus_strategy}</span>
          </div>
          <div className="detail-row">
            <span className="label">Started:</span>
            <span className="value">
              {new Date(currentSession.started_at).toLocaleTimeString()}
            </span>
          </div>
          {currentSession.paused_at && (
            <div className="detail-row">
              <span className="label">Paused:</span>
              <span className="value">
                {new Date(currentSession.paused_at).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
