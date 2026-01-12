/**
 * SimpleUnifiedInterface Component
 * Simplified unified interface with toolbar on top and step list below
 * Based on the user's mockup image with full functionality integration
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getIPCBridge } from '../services/ipcBridgeService';
import { scriptStorageService, StoredScriptInfo, ScriptFilter as ScriptFilterType, ScriptSource, TargetOS } from '../services/scriptStorageService';
import {
  RecorderStatus,
  IPCEvent,
  ActionData,
  ActionPreviewData,
} from '../types/recorder.types';
import { TestScript, TestStep } from '../types/testCaseDriven.types';
import { ScriptListItem } from './ScriptListItem';
import { ScriptFilter } from './ScriptFilter';
import './SimpleUnifiedInterface.css';

interface Action {
  id: string;
  type: string;
  description: string;
  timestamp: number;
}

/**
 * Extended ScriptInfo interface with source and target OS
 */
interface ScriptInfo {
  path: string;
  filename: string;
  created_at: string;
  duration: number;
  action_count: number;
  source: ScriptSource;
  targetOS?: TargetOS;
  scriptName?: string;
}

export const SimpleUnifiedInterface: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const ipcBridge = getIPCBridge();

  // Core recorder state
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasRecordings, setHasRecordings] = useState<boolean>(false);
  const [lastRecordingPath, setLastRecordingPath] = useState<string | null>(null);
  const [showScriptSelector, setShowScriptSelector] = useState<boolean>(false);
  const [availableScripts, setAvailableScripts] = useState<ScriptInfo[]>([]);
  const [scriptFilter, setScriptFilter] = useState<ScriptFilterType>({ source: 'all' });
  const [selectedScriptPath, setSelectedScriptPath] = useState<string | null>(null);

  // Playback state
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

  // Recording state
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [actions, setActions] = useState<Action[]>([]);

  // Step-based recording state
  const [stepRecordingEnabled, setStepRecordingEnabled] = useState<boolean>(false);
  const [activeRecordingScript, setActiveRecordingScript] = useState<TestScript | null>(null);
  const [activeRecordingStepId, setActiveRecordingStepId] = useState<string | null>(null);
  const [showScriptLoaderForRecording, setShowScriptLoaderForRecording] = useState<boolean>(false);

  /**
   * Initialize component
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        const requestedScriptPath = (location.state as { scriptPath?: string } | null)?.scriptPath;

        // Check for existing recordings
        const recordings = await ipcBridge.checkForRecordings();
        setHasRecordings(recordings || Boolean(requestedScriptPath));

        if (recordings || requestedScriptPath) {
          // Load list of available scripts
          await loadAvailableScripts();

          if (requestedScriptPath) {
            setLastRecordingPath(requestedScriptPath);
            setSelectedScriptPath(requestedScriptPath);
          } else {
            // Get the latest recording path
            const latestPath = await ipcBridge.getLatestRecording();
            setLastRecordingPath(latestPath);
            setSelectedScriptPath(latestPath);
          }
        }

        // Load mock actions if no real recordings
        if (!recordings && !requestedScriptPath) {
          setActions([
            {
              id: '1',
              type: 'navigate',
              description: 'Navigate to "https://petstore.octoperf.com/actions/Catalog.action"',
              timestamp: 0
            },
            {
              id: '2',
              type: 'click',
              description: 'Click on Sign In link',
              timestamp: 1.2
            },
            {
              id: '3',
              type: 'type',
              description: 'Type jojo in username textbox',
              timestamp: 2.5
            },
            {
              id: '4',
              type: 'type',
              description: 'Type [Empty String] in password passwordbox',
              timestamp: 3.8
            }
          ]);
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
      console.error('IPC Error:', event.data);
      setError(event.data?.message || 'An error occurred');
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
  }, [location.state, ipcBridge]);

  /**
   * Update recording time while recording
   */
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (status === 'recording' && recordingStartTime) {
      interval = setInterval(() => {
        const elapsed = (Date.now() - recordingStartTime) / 1000;
        setRecordingTime(elapsed);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [status, recordingStartTime]);

  /**
   * Load available scripts for selection
   */
  const loadAvailableScripts = async () => {
    try {
      // Use scriptStorageService to get enriched script info with source and targetOS
      const scripts = await scriptStorageService.listScripts();

      // Map StoredScriptInfo to ScriptInfo format
      const mappedScripts: ScriptInfo[] = scripts.map((script: StoredScriptInfo) => ({
        path: script.path,
        filename: script.filename,
        created_at: script.createdAt,
        duration: script.duration,
        action_count: script.actionCount,
        source: script.source,
        targetOS: script.targetOS,
        scriptName: script.scriptName,
      }));

      setAvailableScripts(mappedScripts);
    } catch (err) {
      console.error('Failed to load scripts:', err);
      // Fallback to basic IPC bridge if scriptStorageService fails
      try {
        const scripts = await ipcBridge.listScripts();
        const fallbackScripts: ScriptInfo[] = scripts.map((script: any) => ({
          path: script.path,
          filename: script.filename,
          created_at: script.created_at,
          duration: script.duration,
          action_count: script.action_count,
          source: 'recorded' as ScriptSource,
        }));
        setAvailableScripts(fallbackScripts);
      } catch (fallbackErr) {
        console.error('Fallback script loading also failed:', fallbackErr);
      }
    }
  };

  /**
   * Handle Record Start
   */
  const handleRecord = async () => {
    try {
      setError(null);
      if (status === 'recording') {
        // Stop recording
        setLoading(true);
        const result = await ipcBridge.stopRecording();

        if (result.success) {
          setLastRecordingPath(result.scriptPath || null);
          setSelectedScriptPath(result.scriptPath || null);
          setHasRecordings(true);
          setStatus('idle');
          setRecordingStartTime(null);
          setRecordingTime(0);
          await loadAvailableScripts();
        } else {
          setError(result.error || 'Failed to stop recording');
        }
        setLoading(false);
      } else {
        // Start recording
        setLoading(true);
        await ipcBridge.startRecording();
        setStatus('recording');
        setRecordingStartTime(Date.now());
        setRecordingTime(0);
        setActions([]); // Clear previous actions
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recording failed');
      setLoading(false);
    }
  };

  /**
   * Handle Play Start/Stop
   */
  const handlePlay = async () => {
    try {
      setError(null);
      if (status === 'playing') {
        // Stop playback
        setLoading(true);
        await ipcBridge.stopPlayback();
        setStatus('idle');
        setActionIndex(0);
        setTotalActions(0);
        setCurrentLoop(1);
        setShowPreview(false);
        setCurrentAction(null);
        setPreviewOpacity(0);
        setPlaybackProgress(0);
        setIsPlaybackComplete(false);
        setIsPaused(false);
        setLoading(false);
      } else {
        // Start playback
        setLoading(true);
        setActionIndex(0);
        setTotalActions(0);
        setCurrentLoop(1);
        setPlaybackProgress(0);
        setIsPlaybackComplete(false);

        const scriptPath = selectedScriptPath || lastRecordingPath;
        if (!scriptPath) {
          throw new Error('No script selected for playback');
        }

        await ipcBridge.startPlayback(scriptPath, playbackSpeed, loopCount);
        setStatus('playing');
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Playback failed');
      setLoading(false);
    }
  };

  /**
   * Handle Stop
   */
  const handleStop = async () => {
    try {
      setError(null);
      setLoading(true);

      if (status === 'recording') {
        const result = await ipcBridge.stopRecording();
        if (result.success) {
          setLastRecordingPath(result.scriptPath || null);
          setSelectedScriptPath(result.scriptPath || null);
          setHasRecordings(true);
          await loadAvailableScripts();
        }
        setRecordingStartTime(null);
        setRecordingTime(0);
      }

      if (status === 'playing') {
        await ipcBridge.stopPlayback();
        setActionIndex(0);
        setTotalActions(0);
        setCurrentLoop(1);
        setShowPreview(false);
        setCurrentAction(null);
        setPreviewOpacity(0);
        setPlaybackProgress(0);
        setIsPlaybackComplete(false);
        setIsPaused(false);
      }

      setStatus('idle');
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stop failed');
      setLoading(false);
    }
  };

  /**
   * Handle Save Script
   */
  const handleSave = async () => {
    try {
      setError(null);
      // Save functionality - could open save dialog or save current script
      console.log('Save script functionality');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  /**
   * Handle Open Script
   */
  const handleOpen = async () => {
    try {
      setError(null);
      setLoading(true);
      await loadAvailableScripts();
      setShowScriptSelector(true);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scripts');
      setLoading(false);
    }
  };

  /**
   * Handle Clear
   */
  const handleClear = () => {
    setActions([]);
    setSelectedScriptPath(null);
    setError(null);
  };

  /**
   * Handle Settings
   */
  const handleSettings = () => {
    console.log('Open settings');
  };

  /**
   * Handle script selection from modal
   */
  const handleScriptSelect = (script: ScriptInfo) => {
    setSelectedScriptPath(script.path);
    setShowScriptSelector(false);
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
   * Filter scripts based on current filter settings
   */
  const filteredScripts = useMemo(() => {
    return availableScripts.filter(script => {
      // Filter by source
      if (scriptFilter.source && scriptFilter.source !== 'all') {
        if (script.source !== scriptFilter.source) {
          return false;
        }
      }

      // Filter by target OS (only applicable for AI-generated scripts)
      if (scriptFilter.targetOS) {
        if (script.source === 'ai_generated' && script.targetOS !== scriptFilter.targetOS) {
          return false;
        }
      }

      // Filter by search query
      if (scriptFilter.searchQuery) {
        const query = scriptFilter.searchQuery.toLowerCase();
        const filename = script.filename.toLowerCase();
        const scriptName = (script.scriptName || '').toLowerCase();
        if (!filename.includes(query) && !scriptName.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [availableScripts, scriptFilter]);

  /**
   * Check if any AI-generated scripts exist
   */
  const hasAIScripts = useMemo(() => {
    return availableScripts.some(script => script.source === 'ai_generated');
  }, [availableScripts]);

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'navigate': return '🌐';
      case 'click': return '👆';
      case 'type': return '⌨️';
      default: return '❓';
    }
  };

  const isRecording = status === 'recording';
  const isPlaying = status === 'playing';

  return (
    <div className="simple-unified-interface">
      {/* Back button - positioned inside the interface */}
      <button
        className="interface-back-button"
        onClick={() => navigate(-1)}
        title="Back to Recorder"
      >
        ←
      </button>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Visual Playback Preview */}
      {showPreview && currentAction && (
        <div className="preview-card" style={{ opacity: previewOpacity }}>
          <div className="preview-header">
            <span className="preview-title">Playback Preview</span>
            <div className="preview-progress-container">
              <span className="preview-progress">
                Action {actionIndex + 1} of {totalActions}
              </span>
              {totalLoops > 1 && (
                <span className="preview-loop-progress">
                  Loop {currentLoop} of {totalLoops}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Toolbar */}
      <div className="simple-toolbar">
        {/* Step indicator */}
        <div className="step-indicator">
          <div className="step-icon">📋</div>
          <span className="step-text">Step</span>
        </div>

        {/* Toolbar buttons */}
        <div className="toolbar-buttons">
          {/* Record button */}
          <button
            className={`toolbar-btn record-btn ${isRecording ? 'active' : ''}`}
            onClick={handleRecord}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
            disabled={loading}
          >
            <div className={`record-icon ${isRecording ? 'recording' : ''}`}></div>
          </button>

          {/* Play button */}
          <button
            className={`toolbar-btn play-btn ${isPlaying ? 'active' : ''}`}
            onClick={handlePlay}
            title={isPlaying ? 'Stop Playback' : 'Start Playback'}
            disabled={loading || (actions.length === 0 && !hasRecordings)}
          >
            <div className="play-icon"></div>
          </button>

          {/* Stop button */}
          <button
            className="toolbar-btn stop-btn"
            onClick={handleStop}
            title="Stop"
            disabled={loading || (!isRecording && !isPlaying)}
          >
            <div className="stop-icon"></div>
          </button>

          {/* Separator */}
          <div className="toolbar-separator"></div>

          {/* Save button */}
          <button
            className="toolbar-btn save-btn"
            onClick={handleSave}
            title="Save Script"
            disabled={loading || (actions.length === 0 && !hasRecordings)}
          >
            <div className="save-icon"></div>
          </button>

          {/* Open button */}
          <button
            className="toolbar-btn open-btn"
            onClick={handleOpen}
            title="Open Script"
            disabled={loading}
          >
            <div className="open-icon"></div>
          </button>

          {/* Clear button */}
          <button
            className="toolbar-btn clear-btn"
            onClick={handleClear}
            title="Clear"
            disabled={loading || actions.length === 0}
          >
            <div className="clear-icon"></div>
          </button>

          {/* Separator */}
          <div className="toolbar-separator"></div>

          {/* Settings button */}
          <button
            className="toolbar-btn settings-btn"
            onClick={handleSettings}
            title="Settings"
            disabled={loading}
          >
            <div className="settings-icon"></div>
          </button>
        </div>
      </div>

      {/* Recording Status */}
      {isRecording && (
        <div className="recording-status-container">
          <div className="recording-status-header">
            <div className="recording-status-indicator">
              <span className="recording-status-text">
                🔴 Recording in Progress
              </span>
              <div className="recording-pulse" />
            </div>
            <div className="recording-time-display">
              <span className="recording-time-value">
                {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:
                {Math.floor(recordingTime % 60).toString().padStart(2, '0')}.
                {Math.floor((recordingTime % 1) * 10)}
              </span>
            </div>
          </div>
          <div className="recording-hint">
            Press <kbd>ESC</kbd> to stop recording
          </div>
        </div>
      )}

      {/* Playback Progress */}
      {(isPlaying || isPlaybackComplete) && totalActions > 0 && (
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
          <div className="main-progress-bar-container">
            <div
              className={`main-progress-bar ${isPaused ? 'paused' : ''} ${isPlaybackComplete ? 'completed' : ''}`}
              style={{ width: `${playbackProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Steps List */}
      <div className="steps-container">
        {actions.length === 0 && !isRecording ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <div className="empty-text">No steps recorded yet</div>
            <div className="empty-subtext">Click the record button to start capturing actions</div>
          </div>
        ) : (
          <div className="steps-list">
            {actions.map((action, index) => (
              <div key={action.id} className="step-item">
                <div className="step-number">{index + 1}</div>
                <div className="step-icon-container">
                  <span className="step-action-icon">{getActionIcon(action.type)}</span>
                </div>
                <div className="step-content">
                  <div className="step-description">{action.description}</div>
                </div>
                <div className="step-actions">
                  <button className="step-action-btn" title="Edit">✏️</button>
                </div>
              </div>
            ))}

            {isRecording && (
              <div className="recording-indicator">
                <div className="recording-pulse"></div>
                <span>Recording... {recordingTime.toFixed(1)}s</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Script Selector Modal */}
      {showScriptSelector && (
        <div className="modal-overlay" onClick={() => setShowScriptSelector(false)}>
          <div className="modal-content script-selector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Select Script to Play</h2>
              <button
                className="modal-close-button"
                onClick={() => setShowScriptSelector(false)}
              >
                ×
              </button>
            </div>

            {/* Script Filter */}
            <div className="script-filter-wrapper">
              <ScriptFilter
                filter={scriptFilter}
                onFilterChange={setScriptFilter}
                totalCount={availableScripts.length}
                filteredCount={filteredScripts.length}
                showOSFilter={hasAIScripts}
                showSearch={true}
                compact={true}
              />
            </div>

            <div className="script-list">
              {availableScripts.length === 0 ? (
                <p className="empty-text">No scripts available</p>
              ) : filteredScripts.length === 0 ? (
                <p className="empty-text">No scripts match the current filter</p>
              ) : (
                filteredScripts.map((item) => (
                  <ScriptListItem
                    key={item.path}
                    script={{
                      filename: item.filename,
                      path: item.path,
                      createdAt: item.created_at,
                      duration: item.duration,
                      actionCount: item.action_count,
                      source: item.source,
                      targetOS: item.targetOS,
                      scriptName: item.scriptName,
                    }}
                    selected={selectedScriptPath === item.path}
                    onClick={(script) => handleScriptSelect({
                      path: script.path,
                      filename: script.filename,
                      created_at: script.createdAt,
                      duration: script.duration,
                      action_count: script.actionCount,
                      source: script.source,
                      targetOS: script.targetOS,
                      scriptName: script.scriptName,
                    })}
                    showDelete={false}
                    compact={true}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleUnifiedInterface;
