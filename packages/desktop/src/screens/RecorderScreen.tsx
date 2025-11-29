/**
 * RecorderScreen Component
 * Main UI for Desktop Recorder MVP
 * Requirements: 1.2, 1.5, 2.5, 4.1, 4.2, 4.3, 4.4, 4.5
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthButton } from '../components/AuthButton';
import { getIPCBridge } from '../services/ipcBridgeService';
import {
  RecorderStatus,
  IPCEvent,
  ActionData,
  ActionPreviewData,
} from '../types/recorder.types';
import { calculateButtonStates } from '../utils/buttonStates';
import './RecorderScreen.css';

interface ScriptInfo {
  path: string;
  filename: string;
  created_at: string;
  duration: number;
  action_count: number;
}

const RecorderScreen: React.FC = () => {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastRecordingPath, setLastRecordingPath] = useState<string | null>(null);
  const [hasRecordings, setHasRecordings] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [showScriptSelector, setShowScriptSelector] = useState<boolean>(false);
  const [availableScripts, setAvailableScripts] = useState<ScriptInfo[]>([]);
  const [selectedScriptPath, setSelectedScriptPath] = useState<string | null>(null);
  const [currentAction, setCurrentAction] = useState<ActionData | null>(null);
  const [actionIndex, setActionIndex] = useState<number>(0);
  const [totalActions, setTotalActions] = useState<number>(0);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [previewOpacity, setPreviewOpacity] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [loopCount, setLoopCount] = useState<number>(1);
  const [currentLoop, setCurrentLoop] = useState<number>(1);
  const [totalLoops, setTotalLoops] = useState<number>(1);

  const navigate = useNavigate();
  const ipcBridge = getIPCBridge();

  // Calculate button states
  const buttonStates = calculateButtonStates(status, hasRecordings);

  /**
   * Initialize component - check for existing recordings
   * Requirements: 2.5, 6.4
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        // Check for existing recordings
        const recordings = await ipcBridge.checkForRecordings();
        setHasRecordings(recordings);

        if (recordings) {
          // Get the latest recording path
          const latestPath = await ipcBridge.getLatestRecording();
          setLastRecordingPath(latestPath);
          setSelectedScriptPath(latestPath);

          // Load list of available scripts
          await loadAvailableScripts();
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize recorder';
        setError(errorMessage);
        console.error('Initialization error:', err);
      }
    };

    initialize();

    // Set up event listeners for playback progress
    const handleProgressEvent = (event: IPCEvent) => {
      console.log('Playback progress:', event.data);
      if (event.data?.currentAction && event.data?.totalActions) {
        setActionIndex(event.data.currentAction);
        setTotalActions(event.data.totalActions);
      }
      if (event.data?.currentLoop !== undefined && event.data?.totalLoops !== undefined) {
        setCurrentLoop(event.data.currentLoop);
        setTotalLoops(event.data.totalLoops);
      }
    };

    const handleActionPreviewEvent = (event: IPCEvent) => {
      const previewData = event.data as ActionPreviewData;
      if (previewData?.action) {
        setCurrentAction(previewData.action);
        setActionIndex(previewData.index);
        setShowPreview(true);
        setPreviewOpacity(1);
      }
    };

    const handleCompleteEvent = (event: IPCEvent) => {
      console.log('Playback complete:', event.data);
      setStatus('idle');
      setLoading(false);
      setShowPreview(false);
      setCurrentAction(null);
      setPreviewOpacity(0);
    };

    const handleErrorEvent = (event: IPCEvent) => {
      console.error('Playback error:', event.data);
      setError(event.data?.message || 'Playback error occurred');
      setStatus('idle');
      setLoading(false);
      setShowPreview(false);
      setCurrentAction(null);
      setPreviewOpacity(0);
    };

    ipcBridge.addEventListener('progress', handleProgressEvent);
    ipcBridge.addEventListener('action_preview', handleActionPreviewEvent);
    ipcBridge.addEventListener('complete', handleCompleteEvent);
    ipcBridge.addEventListener('error', handleErrorEvent);

    // Cleanup
    return () => {
      ipcBridge.removeEventListener('progress', handleProgressEvent);
      ipcBridge.removeEventListener('action_preview', handleActionPreviewEvent);
      ipcBridge.removeEventListener('complete', handleCompleteEvent);
      ipcBridge.removeEventListener('error', handleErrorEvent);
    };
  }, []);

  /**
   * Load available scripts for selection
   */
  const loadAvailableScripts = async () => {
    try {
      const scripts = await ipcBridge.listScripts();
      setAvailableScripts(scripts);
    } catch (err) {
      console.error('Failed to load scripts:', err);
    }
  };

  /**
   * Handle Record button click
   * Requirements: 1.1, 1.3
   */
  const handleRecordClick = async () => {
    try {
      setError(null);
      setLoading(true);
      await ipcBridge.startRecording();
      setStatus('recording');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      console.error('Recording error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Start button click (playback)
   * Requirements: 2.1, 2.3
   */
  const handleStartClick = async () => {
    try {
      setError(null);
      setLoading(true);
      // Use selected script path, or fall back to last recording
      const scriptPath = selectedScriptPath || lastRecordingPath || undefined;
      await ipcBridge.startPlayback(scriptPath, playbackSpeed, loopCount);
      setStatus('playing');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start playback';
      setError(errorMessage);
      console.error('Playback error:', err);
      setLoading(false);
    }
  };

  /**
   * Handle script selection from modal
   */
  const handleScriptSelect = (script: ScriptInfo) => {
    setSelectedScriptPath(script.path);
    setShowScriptSelector(false);
  };

  /**
   * Open script selector modal
   */
  const openScriptSelector = async () => {
    try {
      setLoading(true);
      await loadAvailableScripts();
      setShowScriptSelector(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load scripts';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Stop button click
   * Requirements: 1.3, 2.4
   */
  const handleStopClick = async () => {
    try {
      setError(null);
      setLoading(true);

      if (status === 'recording') {
        // Stop recording
        const result = await ipcBridge.stopRecording();

        if (result.success) {
          setLastRecordingPath(result.scriptPath || null);
          setSelectedScriptPath(result.scriptPath || null);
          setHasRecordings(true);
          setStatus('idle');
          // Reload available scripts to include the new recording
          await loadAvailableScripts();
        } else {
          setError(result.error || 'Failed to stop recording');
        }
      } else if (status === 'playing') {
        // Stop playback
        await ipcBridge.stopPlayback();
        setStatus('idle');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop';
      setError(errorMessage);
      console.error('Stop error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get selected script display name
   */
  const getSelectedScriptName = (): string => {
    if (!selectedScriptPath) return 'Latest recording';

    const script = availableScripts.find(s => s.path === selectedScriptPath);
    return script ? script.filename : 'Latest recording';
  };

  /**
   * Format action for display
   */
  const formatActionDisplay = (action: ActionData): string => {
    switch (action.type) {
      case 'mouse_move':
        return `Move mouse to (${action.x}, ${action.y})`;
      case 'mouse_click':
        return `Click ${action.button} button at (${action.x}, ${action.y})`;
      case 'key_press':
        return `Press key: ${action.key}`;
      case 'key_release':
        return `Release key: ${action.key}`;
      default:
        return 'Unknown action';
    }
  };

  /**
   * Get action icon
   */
  const getActionIcon = (action: ActionData): string => {
    switch (action.type) {
      case 'mouse_move':
        return '🖱️';
      case 'mouse_click':
        return '👆';
      case 'key_press':
      case 'key_release':
        return '⌨️';
      default:
        return '❓';
    }
  };

  /**
   * Get status display text
   */
  const getStatusText = (): string => {
    switch (status) {
      case 'idle':
        return 'Idle';
      case 'recording':
        return 'Recording';
      case 'playing':
        return 'Playing';
      default:
        return 'Unknown';
    }
  };

  /**
   * Get status color
   */
  const getStatusColor = (): string => {
    switch (status) {
      case 'idle':
        return '#5f6368';
      case 'recording':
        return '#d93025';
      case 'playing':
        return '#1a73e8';
      default:
        return '#5f6368';
    }
  };

  return (
    <div className="recorder-container">
      <div className="recorder-content">
        {/* Back Button */}
        <button
          className="back-button"
          onClick={() => navigate(-1)}
        >
          ← Back to Dashboard
        </button>

        {/* Header Section */}
        <div className="header">
          <h1 className="logo">GeniusQA Recorder</h1>
          <p className="subtitle">Record and replay desktop interactions</p>
        </div>

        {/* Status Display */}
        <div className="status-card">
          <span className="status-label">Status</span>
          <span className="status-text" style={{ color: getStatusColor() }}>
            {getStatusText()}
          </span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-container">
            <p className="error-text">{error}</p>
          </div>
        )}

        {/* Visual Playback Preview */}
        {showPreview && currentAction && (
          <div className="preview-card" style={{ opacity: previewOpacity }}>
            <div className="preview-header">
              <span className="preview-title">
                {getActionIcon(currentAction)} Playback Preview
              </span>
              <div className="preview-progress-container">
                <span className="preview-progress">
                  Action {actionIndex + 1} of {totalActions}
                </span>
                {totalLoops > 1 && (
                  <span className="preview-loop-progress">
                    Loop {currentLoop} of {totalLoops}
                  </span>
                )}
                {totalLoops === 0 && (
                  <span className="preview-loop-progress">
                    Loop {currentLoop} (Infinite)
                  </span>
                )}
              </div>
            </div>

            <div className="preview-content">
              <span className="preview-action-type">
                {currentAction.type.replace('_', ' ').toUpperCase()}
              </span>
              <span className="preview-action-details">
                {formatActionDisplay(currentAction)}
              </span>

              {currentAction.timestamp !== undefined && (
                <span className="preview-timestamp">
                  Time: {currentAction.timestamp.toFixed(2)}s
                </span>
              )}

              {currentAction.screenshot && (
                <div className="preview-screenshot-indicator">
                  <span className="preview-screenshot-text">
                    📸 Screenshot available
                  </span>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${((actionIndex + 1) / totalActions) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="controls-card">
          <h2 className="controls-title">Controls</h2>

          {/* Record Button */}
          <AuthButton
            title="Record"
            onPress={handleRecordClick}
            loading={loading && status === 'idle'}
            disabled={!buttonStates.recordEnabled || loading}
            variant="primary"
          />

          {/* Script Selection */}
          {hasRecordings && (
            <div className="script-selection-container">
              <span className="script-selection-label">Selected Script:</span>
              <button
                className="script-selection-button"
                onClick={openScriptSelector}
                disabled={loading || status !== 'idle'}
              >
                <span className="script-selection-text">
                  {getSelectedScriptName()}
                </span>
                <span className="script-selection-icon">▼</span>
              </button>
            </div>
          )}

          {/* Playback Speed Control */}
          {hasRecordings && (
            <div className="speed-control-container">
              <span className="speed-control-label">Playback Speed: {playbackSpeed}x</span>
              <div className="speed-buttons-container">
                <button
                  className={`speed-button ${playbackSpeed === 0.5 ? 'active' : ''}`}
                  onClick={() => setPlaybackSpeed(0.5)}
                  disabled={loading || status !== 'idle'}
                >
                  0.5x
                </button>
                <button
                  className={`speed-button ${playbackSpeed === 1.0 ? 'active' : ''}`}
                  onClick={() => setPlaybackSpeed(1.0)}
                  disabled={loading || status !== 'idle'}
                >
                  1x
                </button>
                <button
                  className={`speed-button ${playbackSpeed === 1.5 ? 'active' : ''}`}
                  onClick={() => setPlaybackSpeed(1.5)}
                  disabled={loading || status !== 'idle'}
                >
                  1.5x
                </button>
                <button
                  className={`speed-button ${playbackSpeed === 2.0 ? 'active' : ''}`}
                  onClick={() => setPlaybackSpeed(2.0)}
                  disabled={loading || status !== 'idle'}
                >
                  2x
                </button>
              </div>
            </div>
          )}

          {/* Loop/Repeat Control */}
          {hasRecordings && (
            <div className="loop-control-container">
              <span className="loop-control-label">
                Loop Count: {loopCount === 0 ? '∞ (Infinite)' : `${loopCount}x`}
              </span>
              <div className="loop-buttons-container">
                <button
                  className={`loop-button ${loopCount === 1 ? 'active' : ''}`}
                  onClick={() => setLoopCount(1)}
                  disabled={loading || status !== 'idle'}
                >
                  Once
                </button>
                <button
                  className={`loop-button ${loopCount === 2 ? 'active' : ''}`}
                  onClick={() => setLoopCount(2)}
                  disabled={loading || status !== 'idle'}
                >
                  2x
                </button>
                <button
                  className={`loop-button ${loopCount === 3 ? 'active' : ''}`}
                  onClick={() => setLoopCount(3)}
                  disabled={loading || status !== 'idle'}
                >
                  3x
                </button>
                <button
                  className={`loop-button ${loopCount === 5 ? 'active' : ''}`}
                  onClick={() => setLoopCount(5)}
                  disabled={loading || status !== 'idle'}
                >
                  5x
                </button>
                <button
                  className={`loop-button ${loopCount === 0 ? 'active' : ''}`}
                  onClick={() => setLoopCount(0)}
                  disabled={loading || status !== 'idle'}
                >
                  ∞
                </button>
              </div>
            </div>
          )}

          {/* Start Button */}
          <AuthButton
            title="Start Playback"
            onPress={handleStartClick}
            loading={loading && status === 'idle'}
            disabled={!buttonStates.startEnabled || loading}
            variant="primary"
          />

          {/* Stop Button */}
          <AuthButton
            title="Stop"
            onPress={handleStopClick}
            loading={loading && (status === 'recording' || status === 'playing')}
            disabled={!buttonStates.stopEnabled || loading}
            variant="secondary"
          />
        </div>

        {/* Script Selector Modal */}
        {showScriptSelector && (
          <div className="modal-overlay" onClick={() => setShowScriptSelector(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Select Script to Play</h2>
                <button
                  className="modal-close-button"
                  onClick={() => setShowScriptSelector(false)}
                >
                  ×
                </button>
              </div>

              <div className="script-list">
                {availableScripts.length === 0 ? (
                  <p className="empty-text">No scripts available</p>
                ) : (
                  availableScripts.map((item) => (
                    <button
                      key={item.path}
                      className={`script-item ${selectedScriptPath === item.path ? 'selected' : ''}`}
                      onClick={() => handleScriptSelect(item)}
                    >
                      <span className="script-filename">{item.filename}</span>
                      <span className="script-info">
                        Created: {new Date(item.created_at).toLocaleString()}
                      </span>
                      <span className="script-info">
                        Duration: {item.duration.toFixed(2)}s | Actions: {item.action_count}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="info-card">
          <h2 className="info-title">Information</h2>
          <p className="info-text">
            • Click Record to capture your interactions<br />
            • Click Stop to end recording<br />
            • Click Start Playback to replay the last recording<br />
            • Recordings are saved automatically
          </p>
          {lastRecordingPath && (
            <div className="recording-info">
              <span className="recording-label">Last Recording:</span>
              <span className="recording-path">
                {lastRecordingPath}
              </span>
            </div>
          )}
        </div>

        {/* Script Editor Link */}
        <div className="editor-link-card">
          <h2 className="editor-link-title">Manage Scripts</h2>
          <p className="editor-link-text">
            View, edit, and manage all your recorded scripts
          </p>
          <AuthButton
            title="Open Script Editor"
            onPress={() => navigate('/script-editor')}
            loading={false}
            disabled={false}
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
};

export default RecorderScreen;
