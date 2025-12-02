/**
 * RecorderScreen Component
 * Main UI for Desktop Recorder MVP
 * Requirements: 1.2, 1.5, 2.5, 4.1, 4.2, 4.3, 4.4, 4.5
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthButton } from '../components/AuthButton';
import { CoreSelector, CoreType, CoreStatus, PerformanceMetrics, PerformanceComparison } from '../components/CoreSelector';
import { getIPCBridge } from '../services/ipcBridgeService';
import {
  RecorderStatus,
  IPCEvent,
  ActionData,
  ActionPreviewData,
} from '../types/recorder.types';
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
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);
  const [isPlaybackComplete, setIsPlaybackComplete] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);

  // Core management state
  const [currentCore, setCurrentCore] = useState<CoreType>('python');
  const [availableCores, setAvailableCores] = useState<CoreType[]>(['python']);
  const [coreStatus, setCoreStatus] = useState<CoreStatus | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics[]>([]);
  const [performanceComparison, setPerformanceComparison] = useState<PerformanceComparison | null>(null);
  const [coreLoading, setCoreLoading] = useState<boolean>(false);
  const [coreError, setCoreError] = useState<string | null>(null);

  const navigate = useNavigate();
  const ipcBridge = getIPCBridge();

  /**
   * Initialize component - check for existing recordings and core status
   * Requirements: 2.5, 6.4, 9.1, 9.5
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize core status first
        await initializeCoreStatus();

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

        // Calculate overall progress percentage
        const actionProgress = (event.data.currentAction / event.data.totalActions) * 100;
        setPlaybackProgress(actionProgress);
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
      setPlaybackProgress(100);
      setIsPlaybackComplete(true);

      // Reset completion state after 3 seconds
      setTimeout(() => {
        setIsPlaybackComplete(false);
        setPlaybackProgress(0);
        setActionIndex(0);
        setTotalActions(0);
      }, 3000);
    };

    const handleErrorEvent = (event: IPCEvent) => {
      console.error('Playback error:', event.data);
      setError(event.data?.message || 'Playback error occurred');
      setStatus('idle');
      setLoading(false);
      setShowPreview(false);
      setCurrentAction(null);
      setPreviewOpacity(0);
      setPlaybackProgress(0);
      setIsPlaybackComplete(false);
    };

    const handleRecordingStoppedEvent = async (event: IPCEvent) => {
      console.log('Recording stopped by ESC key:', event.data);
      setStatus('idle');
      setLoading(false);
      setRecordingStartTime(null);
      setRecordingTime(0);

      // Update with the new recording
      if (event.data?.scriptPath) {
        setLastRecordingPath(event.data.scriptPath);
        setSelectedScriptPath(event.data.scriptPath);
        setHasRecordings(true);
        await loadAvailableScripts();
      }
    };

    const handlePlaybackStoppedEvent = (event: IPCEvent) => {
      console.log('Playback stopped by ESC key:', event.data);
      setStatus('idle');
      setLoading(false);
      setShowPreview(false);
      setCurrentAction(null);
      setPreviewOpacity(0);
      setIsPaused(false);
      setActionIndex(0);
      setTotalActions(0);
      setPlaybackProgress(0);
      setIsPlaybackComplete(false);
    };

    const handlePlaybackPausedEvent = (event: IPCEvent) => {
      console.log('Playback pause toggled:', event.data);
      setIsPaused(event.data?.isPaused ?? false);
    };

    ipcBridge.addEventListener('progress', handleProgressEvent);
    ipcBridge.addEventListener('action_preview', handleActionPreviewEvent);
    ipcBridge.addEventListener('complete', handleCompleteEvent);
    ipcBridge.addEventListener('error', handleErrorEvent);
    ipcBridge.addEventListener('recording_stopped', handleRecordingStoppedEvent);
    ipcBridge.addEventListener('playback_stopped', handlePlaybackStoppedEvent);
    ipcBridge.addEventListener('playback_paused', handlePlaybackPausedEvent);

    // Cleanup
    return () => {
      ipcBridge.removeEventListener('progress', handleProgressEvent);
      ipcBridge.removeEventListener('action_preview', handleActionPreviewEvent);
      ipcBridge.removeEventListener('complete', handleCompleteEvent);
      ipcBridge.removeEventListener('error', handleErrorEvent);
      ipcBridge.removeEventListener('recording_stopped', handleRecordingStoppedEvent);
      ipcBridge.removeEventListener('playback_stopped', handlePlaybackStoppedEvent);
      ipcBridge.removeEventListener('playback_paused', handlePlaybackPausedEvent);
    };
  }, []);

  /**
   * Update recording time while recording
   */
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (status === 'recording' && recordingStartTime) {
      interval = setInterval(() => {
        const elapsed = (Date.now() - recordingStartTime) / 1000;
        setRecordingTime(elapsed);
      }, 100); // Update every 100ms for smooth display
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [status, recordingStartTime]);

  /**
   * Initialize core status and availability
   * Requirements: 9.1, 9.5
   */
  const initializeCoreStatus = async () => {
    try {
      setCoreLoading(true);
      setCoreError(null);

      // Get available cores
      const cores = await ipcBridge.getAvailableCores();
      setAvailableCores(cores as CoreType[]);

      // Get current core status
      const status = await ipcBridge.getCoreStatus();
      setCoreStatus(status);
      setCurrentCore(status.activeCoreType);

      // Get performance metrics
      try {
        const metrics = await ipcBridge.getCorePerformanceMetrics();
        setPerformanceMetrics(metrics);
      } catch (metricsError) {
        // Performance metrics are optional, don't fail initialization
        console.warn('Failed to load performance metrics:', metricsError);
        setPerformanceMetrics([]);
      }

      // Get performance comparison
      try {
        const comparison = await ipcBridge.getPerformanceComparison();
        setPerformanceComparison(comparison);
      } catch (comparisonError) {
        // Performance comparison is optional, don't fail initialization
        console.warn('Failed to load performance comparison:', comparisonError);
        setPerformanceComparison(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize core status';
      setCoreError(errorMessage);
      console.error('Core initialization error:', err);

      // Fallback to Python core if initialization fails
      setCurrentCore('python');
      setAvailableCores(['python']);
    } finally {
      setCoreLoading(false);
    }
  };

  /**
   * Handle core selection change
   * Requirements: 1.2, 1.3, 6.4, 8.4
   */
  const handleCoreChange = async (newCore: CoreType) => {
    if (status !== 'idle') {
      throw new Error('Cannot switch cores while recording or playing. Please stop the current operation first.');
    }

    try {
      setCoreLoading(true);
      setCoreError(null);

      // Switch to the new core
      await ipcBridge.selectCore(newCore);

      // Update current core
      setCurrentCore(newCore);

      // Refresh core status and metrics
      await refreshCoreStatus();

      console.log(`Successfully switched to ${newCore} core`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to switch to ${newCore} core`;
      setCoreError(errorMessage);
      throw err; // Re-throw to let CoreSelector handle the error display
    } finally {
      setCoreLoading(false);
    }
  };

  /**
   * Refresh core status and performance metrics
   * Requirements: 6.4, 9.5, 10.1
   */
  const refreshCoreStatus = async () => {
    try {
      // Get updated core status
      const status = await ipcBridge.getCoreStatus();
      setCoreStatus(status);
      setAvailableCores(status.availableCores as CoreType[]);

      // Get updated performance metrics
      try {
        const metrics = await ipcBridge.getCorePerformanceMetrics();
        setPerformanceMetrics(metrics);
      } catch (metricsError) {
        console.warn('Failed to refresh performance metrics:', metricsError);
      }

      // Get updated performance comparison
      try {
        const comparison = await ipcBridge.getPerformanceComparison();
        setPerformanceComparison(comparison);
      } catch (comparisonError) {
        console.warn('Failed to refresh performance comparison:', comparisonError);
      }
    } catch (err) {
      console.error('Failed to refresh core status:', err);
    }
  };

  /**
   * Periodic core status updates
   * Requirements: 9.5
   */
  useEffect(() => {
    const interval = setInterval(async () => {
      if (status === 'idle') {
        // Only refresh when idle to avoid interfering with operations
        await refreshCoreStatus();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [status]);

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
      setRecordingStartTime(Date.now());
      setRecordingTime(0);
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
      // Reset playback state before starting
      setActionIndex(0);
      setTotalActions(0);
      setCurrentLoop(1);
      setPlaybackProgress(0);
      setIsPlaybackComplete(false);
      // Use selected script path, or fall back to last recording
      const scriptPath = selectedScriptPath || lastRecordingPath || undefined;
      await ipcBridge.startPlayback(scriptPath, playbackSpeed, loopCount);
      setStatus('playing');
      setLoading(false);
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
          setRecordingStartTime(null);
          setRecordingTime(0);
          // Reload available scripts to include the new recording
          await loadAvailableScripts();
        } else {
          setError(result.error || 'Failed to stop recording');
        }
      } else if (status === 'playing') {
        // Stop playback
        await ipcBridge.stopPlayback();
        // Reset all playback state
        setStatus('idle');
        setActionIndex(0);
        setTotalActions(0);
        setCurrentLoop(1);
        setShowPreview(false);
        setCurrentAction(null);
        setPreviewOpacity(0);
        setPlaybackProgress(0);
        setIsPlaybackComplete(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop';
      setError(errorMessage);
      console.error('Stop error:', err);
    } finally {
      setLoading(false);
      setIsPaused(false);
    }
  };

  /**
   * Handle Pause button click
   */
  const handlePauseClick = async () => {
    try {
      setError(null);
      const paused = await ipcBridge.pausePlayback();
      setIsPaused(paused);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pause';
      setError(errorMessage);
      console.error('Pause error:', err);
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

  /**
   * Format recording time for display
   */
  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
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

        {/* Core Selection */}
        <CoreSelector
          currentCore={currentCore}
          availableCores={availableCores}
          onCoreChange={handleCoreChange}
          performanceMetrics={performanceMetrics}
          performanceComparison={performanceComparison}
          disabled={status !== 'idle'}
          loading={coreLoading}
        />

        {/* Core Error Message */}
        {coreError && (
          <div className="error-container">
            <p className="error-text">Core Error: {coreError}</p>
          </div>
        )}

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

        {/* Recording Status */}
        {status === 'recording' && (
          <div className="recording-status-container">
            <div className="recording-status-header">
              <div className="recording-status-indicator">
                <span className="recording-status-text">
                  🔴 Recording in Progress
                </span>
                <div className="recording-pulse" />
              </div>
              <div className="recording-time-display">
                <span className="recording-time-label">Duration</span>
                <span className="recording-time-value">
                  {formatRecordingTime(recordingTime)}
                </span>
              </div>
            </div>

            <div className="recording-info-text">
              <span>Capturing all mouse movements, clicks, and keyboard inputs</span>
            </div>

            <div className="recording-hint">
              Press <kbd>ESC</kbd> to stop recording or click "Stop Recording" button
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="controls-card">
          <h2 className="controls-title">Controls</h2>

          {/* Recording Controls */}
          <div className="button-group">
            <AuthButton
              title="Record"
              onPress={handleRecordClick}
              loading={loading && status === 'idle'}
              disabled={status !== 'idle' || loading}
              variant="primary"
            />
            <AuthButton
              title="Stop Recording"
              onPress={handleStopClick}
              loading={loading && status === 'recording'}
              disabled={status !== 'recording'}
              variant="secondary"
            />
          </div>

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
                <button
                  className={`speed-button ${playbackSpeed === 5.0 ? 'active' : ''}`}
                  onClick={() => setPlaybackSpeed(5.0)}
                  disabled={loading || status !== 'idle'}
                >
                  5x
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

          {/* Main Playback Progress */}
          {(status === 'playing' || isPlaybackComplete) && totalActions > 0 && (
            <div className={`main-progress-container ${isPaused ? 'paused' : ''} ${isPlaybackComplete ? 'completed' : ''}`}>
              <div className="main-progress-header">
                <div className="progress-status">
                  {isPlaybackComplete ? (
                    <span className="progress-status-text completed">
                      ✅ Playback Complete!
                    </span>
                  ) : isPaused ? (
                    <span className="progress-status-text paused">
                      ⏸ Paused
                    </span>
                  ) : (
                    <span className="progress-status-text playing">
                      ▶ Playing
                    </span>
                  )}
                </div>
                <div className="progress-details">
                  <span className="progress-action-count">
                    Action {actionIndex} of {totalActions}
                  </span>
                  <span className="progress-percentage">
                    {Math.round(playbackProgress)}%
                  </span>
                </div>
              </div>

              {/* Loop Information */}
              {(totalLoops > 1 || totalLoops === 0) && (
                <div className="progress-loop-info">
                  {totalLoops > 1 ? (
                    <span className="progress-loop-text">
                      Loop {currentLoop} of {totalLoops}
                    </span>
                  ) : (
                    <span className="progress-loop-text">
                      Loop {currentLoop} (Infinite)
                    </span>
                  )}
                </div>
              )}

              {/* Main Progress Bar */}
              <div className="main-progress-bar-container">
                <div
                  className={`main-progress-bar ${isPaused ? 'paused' : ''} ${isPlaybackComplete ? 'completed' : ''}`}
                  style={{ width: `${playbackProgress}%` }}
                />
                <div className="progress-bar-background" />
              </div>

              {/* Progress Text */}
              <div className="progress-text">
                {isPlaybackComplete ? (
                  <span>All actions executed successfully</span>
                ) : (
                  <span>
                    {actionIndex > 0 ? `${actionIndex} actions completed` : 'Starting playback...'}
                    {totalActions > actionIndex && `, ${totalActions - actionIndex} remaining`}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Playback Controls */}
          <div className="button-group">
            <AuthButton
              title="Start Playback"
              onPress={handleStartClick}
              loading={loading && status === 'idle'}
              disabled={status !== 'idle' || !hasRecordings || loading}
              variant="primary"
            />
            <AuthButton
              title={isPaused ? 'Resume' : 'Pause'}
              onPress={handlePauseClick}
              disabled={status !== 'playing'}
              variant="secondary"
            />
            <AuthButton
              title="Stop Playback"
              onPress={handleStopClick}
              loading={loading && status === 'playing'}
              disabled={status !== 'playing'}
              variant="secondary"
            />
          </div>

          {/* Keyboard Shortcut Hint */}
          {(status === 'recording' || status === 'playing') && (
            <div className="shortcut-hint">
              Press <kbd>ESC</kbd> to stop{status === 'playing' && <>, <kbd>⌘</kbd>+<kbd>ESC</kbd> to {isPaused ? 'resume' : 'pause'}</>}
            </div>
          )}
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
