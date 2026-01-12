/**
 * UnifiedRecorderScreen Component
 * New unified interface for recording and editing
 * Preserves all existing functionality from RecorderScreen
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.4, 2.5, 10.1, 10.2, 10.4
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UnifiedInterface, UnifiedInterfaceProvider, useUnifiedInterface } from '../components/UnifiedInterface';
import { TopToolbar } from '../components/TopToolbar';
import { EditorArea } from '../components/EditorArea';
import { ClickCursorOverlay } from '../components/ClickCursorOverlay';
import { RecorderStepSelector } from '../components/RecorderStepSelector';
import { ScriptListItem } from '../components/ScriptListItem';
import { ScriptFilter } from '../components/ScriptFilter';
import { getIPCBridge } from '../services/ipcBridgeService';
import { scriptStorageService, StoredScriptInfo, ScriptFilter as ScriptFilterType, ScriptSource, TargetOS } from '../services/scriptStorageService';
import {
  RecorderStatus,
  IPCEvent,
  ActionData,
  ActionPreviewData,
} from '../types/recorder.types';
import { TestScript, TestStep } from '../types/testCaseDriven.types';
import './UnifiedRecorderScreen.css';
import SimpleUnifiedInterface from '../components/SimpleUnifiedInterface';
import '../components/SimpleUnifiedInterface.css';
/**
 * Extended ScriptInfo interface with source and target OS
 * Requirements: 9.1, 9.2, 9.5
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

/**
 * UnifiedRecorderContent Component
 * The main content that uses the unified interface context
 * Preserves all functionality from original RecorderScreen
 */
const UnifiedRecorderContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const ipcBridge = getIPCBridge();
  const {
    state,
    setMode,
    setCurrentScript,
    setRecordingSession,
    setPlaybackSession,
    setEditorVisible
  } = useUnifiedInterface();

  // Core recorder state - preserved from RecorderScreen
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasRecordings, setHasRecordings] = useState<boolean>(false);
  const [lastRecordingPath, setLastRecordingPath] = useState<string | null>(null);
  const [showScriptSelector, setShowScriptSelector] = useState<boolean>(false);
  const [availableScripts, setAvailableScripts] = useState<ScriptInfo[]>([]);
  const [scriptFilter, setScriptFilter] = useState<ScriptFilterType>({ source: 'all' });
  const [selectedScriptPath, setSelectedScriptPath] = useState<string | null>(null);

  // Playback state - preserved from RecorderScreen
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

  // Recording state - preserved from RecorderScreen
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);

  // Step-based recording state - preserved from RecorderScreen
  const [stepRecordingEnabled, setStepRecordingEnabled] = useState<boolean>(false);
  const [activeRecordingScript, setActiveRecordingScript] = useState<TestScript | null>(null);
  const [activeRecordingStepId, setActiveRecordingStepId] = useState<string | null>(null);
  const [showScriptLoaderForRecording, setShowScriptLoaderForRecording] = useState<boolean>(false);

  /**
   * Initialize component - preserved from RecorderScreen
   * Requirements: 2.5, 6.4, 9.1, 9.5
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

          // Load the script into unified state
          if (requestedScriptPath || recordings) {
            const scriptPath = requestedScriptPath || await ipcBridge.getLatestRecording();
            if (scriptPath) {
              setCurrentScript({
                path: scriptPath,
                filename: scriptPath.split('/').pop() || 'Unknown',
                content: '', // Will be loaded when needed
                actions: [] // Will be loaded when needed
              });
            }
          }
        }

        // Make editor visible by default - Requirements: 5.1
        setEditorVisible(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize recorder';
        setError(errorMessage);
        console.error('Initialization error:', err);
      }
    };

    initialize();

    // Set up event listeners for playback progress - preserved from RecorderScreen
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
      setMode('idle');
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

      // Clear playback session
      setPlaybackSession(null);
    };

    const handleErrorEvent = (event: IPCEvent) => {
      console.error('IPC Error:', event.data);
      setError(event.data?.message || 'An error occurred');
      setStatus('idle');
      setMode('idle');
      setLoading(false);
      setShowPreview(false);
      setCurrentAction(null);
      setPreviewOpacity(0);
      setPlaybackProgress(0);
      setIsPlaybackComplete(false);
      setRecordingSession(null);
      setPlaybackSession(null);
    };

    const handleRecordingStoppedEvent = async (event: IPCEvent) => {
      console.log('Recording stopped by ESC key:', event.data);
      setStatus('idle');
      setMode('idle');
      setLoading(false);
      setRecordingStartTime(null);
      setRecordingTime(0);

      // Update with the new recording
      if (event.data?.scriptPath) {
        setLastRecordingPath(event.data.scriptPath);
        setSelectedScriptPath(event.data.scriptPath);
        setHasRecordings(true);
        await loadAvailableScripts();

        // Update current script
        setCurrentScript({
          path: event.data.scriptPath,
          filename: event.data.scriptPath.split('/').pop() || 'Unknown',
          content: '',
          actions: [] // Actions will be loaded when needed
        });
      }

      // Clear recording session
      setRecordingSession(null);
    };

    const handlePlaybackStoppedEvent = (event: IPCEvent) => {
      console.log('Playback stopped by ESC key:', event.data);
      setStatus('idle');
      setMode('idle');
      setLoading(false);
      setShowPreview(false);
      setCurrentAction(null);
      setPreviewOpacity(0);
      setIsPaused(false);
      setActionIndex(0);
      setTotalActions(0);
      setPlaybackProgress(0);
      setIsPlaybackComplete(false);
      setPlaybackSession(null);
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
  }, [location.state, ipcBridge, setMode, setCurrentScript, setRecordingSession, setPlaybackSession, setEditorVisible]);

  /**
   * Update recording time while recording - preserved from RecorderScreen
   */
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (status === 'recording' && recordingStartTime) {
      interval = setInterval(() => {
        const elapsed = (Date.now() - recordingStartTime) / 1000;
        setRecordingTime(elapsed);
      }, 1000); // Update every 1s
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [status, recordingStartTime]);

  /**
   * Load available scripts for selection - preserved from RecorderScreen
   * Requirements: 9.1, 9.2
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
   * Handle Record Start - Requirements: 1.1, 1.3, 5.1, 5.2
   * Preserved from RecorderScreen with step-based recording support
   */
  const handleRecordStart = async () => {
    try {
      setError(null);
      setLoading(true);

      // Start recording
      await ipcBridge.startRecording();
      setStatus('recording');
      setMode('recording');
      setRecordingStartTime(Date.now());
      setRecordingTime(0);

      // Create recording session
      setRecordingSession({
        isActive: true,
        startTime: Date.now(),
        actions: []
      });

      // Ensure editor is visible during recording - Requirements: 5.1
      setEditorVisible(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      console.error('Recording error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Record Stop - Requirements: 1.3, 2.4
   * Preserved from RecorderScreen
   */
  const handleRecordStop = async () => {
    try {
      setError(null);
      setLoading(true);

      // Stop recording
      const result = await ipcBridge.stopRecording();

      if (result.success) {
        setLastRecordingPath(result.scriptPath || null);
        setSelectedScriptPath(result.scriptPath || null);
        setHasRecordings(true);
        setStatus('idle');
        setMode('idle');
        setRecordingStartTime(null);
        setRecordingTime(0);

        // Update current script with recorded actions
        if (result.scriptPath) {
          setCurrentScript({
            path: result.scriptPath,
            filename: result.scriptPath.split('/').pop() || 'Unknown',
            content: '',
            actions: [] // Actions will be loaded when needed
          });
        }

        // Reload available scripts to include the new recording
        await loadAvailableScripts();
      } else {
        setError(result.error || 'Failed to stop recording');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop recording';
      setError(errorMessage);
      console.error('Stop recording error:', err);
    } finally {
      setLoading(false);
      setRecordingSession(null);
    }
  };

  /**
   * Handle Play Start - Requirements: 2.1, 2.3
   * Preserved from RecorderScreen with speed and loop support
   */
  const handlePlayStart = async () => {
    try {
      setError(null);
      setLoading(true);

      // Reset playback state before starting
      setActionIndex(0);
      setTotalActions(0);
      setCurrentLoop(1);
      setPlaybackProgress(0);
      setIsPlaybackComplete(false);

      // Use selected script path or current script or last recording
      const scriptPath = selectedScriptPath || state.currentScript?.path || lastRecordingPath;
      if (!scriptPath) {
        throw new Error('No script selected for playback');
      }

      // Start playback with preserved speed and loop settings
      await ipcBridge.startPlayback(scriptPath, playbackSpeed, loopCount);
      setStatus('playing');
      setMode('playing');

      // Create playback session
      setPlaybackSession({
        isActive: true,
        currentActionIndex: 0,
        totalActions: state.currentScript?.actions?.length || 0,
        isPaused: false
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start playback';
      setError(errorMessage);
      console.error('Playback error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Play Stop - Requirements: 1.3, 2.4
   * Preserved from RecorderScreen
   */
  const handlePlayStop = async () => {
    try {
      setError(null);
      setLoading(true);

      // Stop playback
      await ipcBridge.stopPlayback();
      setStatus('idle');
      setMode('idle');

      // Reset all playback state
      setActionIndex(0);
      setTotalActions(0);
      setCurrentLoop(1);
      setShowPreview(false);
      setCurrentAction(null);
      setPreviewOpacity(0);
      setPlaybackProgress(0);
      setIsPlaybackComplete(false);
      setIsPaused(false);
      setPlaybackSession(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop playback';
      setError(errorMessage);
      console.error('Stop playback error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Pause button click - preserved from RecorderScreen
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
   * Handle Save Script
   */
  const handleSave = async () => {
    try {
      setError(null);
      // Save functionality will be implemented in future tasks
      console.log('Save script:', state.currentScript);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save script';
      setError(errorMessage);
    }
  };

  /**
   * Handle Open Script
   */
  const handleOpen = async () => {
    try {
      setError(null);
      await openScriptSelector();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to open script';
      setError(errorMessage);
    }
  };

  /**
   * Handle Clear Editor
   */
  const handleClear = () => {
    setCurrentScript(null);
    setSelectedScriptPath(null);
    setError(null);
  };

  /**
   * Handle Settings
   */
  const handleSettings = () => {
    // Navigate to settings or open settings modal
    console.log('Open settings');
  };

  /**
   * Open script selector modal - preserved from RecorderScreen
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
   * Handle script selection from modal - preserved from RecorderScreen
   */
  const handleScriptSelect = (script: ScriptInfo) => {
    setSelectedScriptPath(script.path);
    setCurrentScript({
      path: script.path,
      filename: script.filename,
      content: '',
      actions: []
    });
    setShowScriptSelector(false);
  };

  /**
   * Get selected script display name - preserved from RecorderScreen
   */
  const getSelectedScriptName = (): string => {
    if (!selectedScriptPath) return 'Latest recording';

    const script = availableScripts.find(s => s.path === selectedScriptPath);
    return script ? script.filename : 'Latest recording';
  };

  /**
   * Keyboard shortcut handling - preserved from RecorderScreen
   * ESC: Stop recording/playback when active
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (status === 'recording') {
          event.preventDefault();
          void handleRecordStop();
        } else if (status === 'playing') {
          event.preventDefault();
          void handlePlayStop();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [status]);

  /**
   * Step-based recording handlers - preserved from RecorderScreen
   * Requirements: 2.1, 2.2
   */
  const handleRecordingStepSelect = useCallback((stepId: string | null) => {
    setActiveRecordingStepId(stepId);
    console.log('[UnifiedRecorderScreen] Active recording step changed:', stepId);
  }, []);

  const handleCreateRecordingStep = useCallback((description: string, expectedResult: string) => {
    if (!activeRecordingScript) return;

    const newStepId = `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newStep: TestStep = {
      id: newStepId,
      order: activeRecordingScript.steps.length + 1,
      description,
      expected_result: expectedResult,
      action_ids: [],
      continue_on_failure: false,
    };

    const updatedScript: TestScript = {
      ...activeRecordingScript,
      steps: [...activeRecordingScript.steps, newStep],
    };

    setActiveRecordingScript(updatedScript);
    setActiveRecordingStepId(newStepId);
    console.log('[UnifiedRecorderScreen] Created new step for recording:', newStep);
  }, [activeRecordingScript]);

  const handleLoadScriptForRecording = useCallback(() => {
    setShowScriptLoaderForRecording(true);
  }, []);

  const handleSelectScriptForRecording = useCallback(async (scriptPath: string) => {
    try {
      setLoading(true);
      const scriptData = await ipcBridge.loadScript(scriptPath);

      // Check if it's a step-based script
      if (scriptData && scriptData.steps && Array.isArray(scriptData.steps)) {
        setActiveRecordingScript(scriptData as TestScript);
        setStepRecordingEnabled(true);
        // Select first step by default if available
        if (scriptData.steps.length > 0) {
          setActiveRecordingStepId(scriptData.steps[0].id);
        }
        console.log('[UnifiedRecorderScreen] Loaded script for step-based recording:', scriptPath);
      } else {
        // Legacy script - migrate or show message
        setError('Selected script is not in step-based format. Please use the Script Editor to convert it.');
      }

      setShowScriptLoaderForRecording(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load script';
      setError(errorMessage);
      console.error('[UnifiedRecorderScreen] Failed to load script for recording:', err);
    } finally {
      setLoading(false);
    }
  }, [ipcBridge]);

  const handleClearStepRecording = useCallback(() => {
    setStepRecordingEnabled(false);
    setActiveRecordingScript(null);
    setActiveRecordingStepId(null);
  }, []);

  /**
   * Get active step for display - preserved from RecorderScreen
   */
  const activeRecordingStep = useMemo((): TestStep | null => {
    if (!activeRecordingScript || !activeRecordingStepId) return null;
    return activeRecordingScript.steps.find(step => step.id === activeRecordingStepId) || null;
  }, [activeRecordingScript, activeRecordingStepId]);

  /**
   * Filter scripts based on current filter settings - preserved from RecorderScreen
   * Requirements: 9.4
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
   * Check if any AI-generated scripts exist - preserved from RecorderScreen
   */
  const hasAIScripts = useMemo(() => {
    return availableScripts.some(script => script.source === 'ai_generated');
  }, [availableScripts]);

  /**
   * Format action for display - preserved from RecorderScreen
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
   * Get action icon - preserved from RecorderScreen
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
   * Format recording time for display - preserved from RecorderScreen
   */
  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  /**
   * Handle script change from editor
   */
  const handleScriptChange = (script: any) => {
    setCurrentScript(script);
  };

  /**
   * Handle action selection from editor
   */
  const handleActionSelect = (actionId: string) => {
    console.log('Action selected:', actionId);
  };

  /**
   * Handle action edit from editor
   */
  const handleActionEdit = (actionId: string, changes: any) => {
    console.log('Action edit:', actionId, changes);
  };

  /**
   * Handle action delete from editor
   */
  const handleActionDelete = (actionId: string) => {
    console.log('Action delete:', actionId);
  };

  return (
    <UnifiedInterface>
      {/* Click Cursor Overlay - preserved from RecorderScreen */}
      <ClickCursorOverlay isRecording={status === 'recording'} />

      {/* Back button - positioned outside the unified interface */}
      <button
        className="back-button"
        onClick={() => navigate(-1)}
        title="Back to Dashboard"
      >
        ←
      </button>

      {/* Error Display - enhanced from RecorderScreen */}
      {error && (
        <div className="error-banner">
          {error.includes('macOS Accessibility permissions required') ? (
            <div className="permission-error-content">
              <h3>⚠️ macOS Accessibility Permission Required</h3>
              <p>To record or play automations, this app needs control over your mouse and keyboard.</p>
              <ol>
                <li>Open <strong>System Settings</strong></li>
                <li>Go to <strong>Privacy & Security {'>'} Accessibility</strong></li>
                <li>Enable the toggle next to <strong>GeniusQA Desktop</strong></li>
              </ol>
              <p className="restart-note">
                Note: You may need to restart the application after enabling permissions.
              </p>
            </div>
          ) : (
            <span className="error-text">{error}</span>
          )}
          <button
            className="error-close"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Visual Playback Preview - preserved from RecorderScreen */}
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

      {/* Step-Based Recording Selector - preserved from RecorderScreen */}
      <RecorderStepSelector
        script={activeRecordingScript}
        activeStepId={activeRecordingStepId}
        isRecording={status === 'recording'}
        onStepSelect={handleRecordingStepSelect}
        onCreateStep={handleCreateRecordingStep}
        onLoadScript={handleLoadScriptForRecording}
        hasScript={stepRecordingEnabled && activeRecordingScript !== null}
      />

      {/* Step Recording Mode Toggle - preserved from RecorderScreen */}
      {stepRecordingEnabled && status === 'idle' && (
        <div className="step-recording-toggle">
          <button
            className="clear-step-recording-btn"
            onClick={handleClearStepRecording}
          >
            Exit Step Recording Mode
          </button>
        </div>
      )}

      {/* Recording Status - preserved from RecorderScreen */}
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

          {/* Active Step Info During Recording */}
          {stepRecordingEnabled && activeRecordingStep && (
            <div className="recording-step-target">
              <span className="recording-step-target-label">Recording to Step:</span>
              <span className="recording-step-target-name">
                Step {activeRecordingStep.order}: {activeRecordingStep.description}
              </span>
            </div>
          )}

          <div className="recording-info-text">
            <span>Capturing all mouse movements, clicks, and keyboard inputs</span>
          </div>

          <div className="recording-hint">
            Press <kbd>ESC</kbd> to stop recording
          </div>
        </div>
      )}

      {/* Main Playback Progress - preserved from RecorderScreen */}
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

      {/* Playback Controls - preserved functionality */}
      {hasRecordings && status === 'idle' && (
        <div className="playback-controls-container">
          {/* Script Selection */}
          <div className="script-selection-container">
            <span className="script-selection-label">Selected Script:</span>
            <button
              className="script-selection-button"
              onClick={openScriptSelector}
              disabled={loading}
            >
              <span className="script-selection-text">
                {getSelectedScriptName()}
              </span>
              <span className="script-selection-icon">▼</span>
            </button>
          </div>

          {/* Playback Speed Control */}
          <div className="speed-control-container">
            <span className="speed-control-label">Playback Speed: {playbackSpeed}x</span>
            <div className="speed-buttons-container">
              <button
                className={`speed-button ${playbackSpeed === 0.5 ? 'active' : ''}`}
                onClick={() => setPlaybackSpeed(0.5)}
                disabled={loading}
              >
                0.5x
              </button>
              <button
                className={`speed-button ${playbackSpeed === 1.0 ? 'active' : ''}`}
                onClick={() => setPlaybackSpeed(1.0)}
                disabled={loading}
              >
                1x
              </button>
              <button
                className={`speed-button ${playbackSpeed === 1.5 ? 'active' : ''}`}
                onClick={() => setPlaybackSpeed(1.5)}
                disabled={loading}
              >
                1.5x
              </button>
              <button
                className={`speed-button ${playbackSpeed === 2.0 ? 'active' : ''}`}
                onClick={() => setPlaybackSpeed(2.0)}
                disabled={loading}
              >
                2x
              </button>
              <button
                className={`speed-button ${playbackSpeed === 5.0 ? 'active' : ''}`}
                onClick={() => setPlaybackSpeed(5.0)}
                disabled={loading}
              >
                5x
              </button>
            </div>
          </div>

          {/* Loop/Repeat Control */}
          <div className="loop-control-container">
            <span className="loop-control-label">
              Loop Count: {loopCount === 0 ? '∞ (Infinite)' : `${loopCount}x`}
            </span>
            <div className="loop-buttons-container">
              <button
                className={`loop-button ${loopCount === 1 ? 'active' : ''}`}
                onClick={() => setLoopCount(1)}
                disabled={loading}
              >
                Once
              </button>
              <button
                className={`loop-button ${loopCount === 2 ? 'active' : ''}`}
                onClick={() => setLoopCount(2)}
                disabled={loading}
              >
                2x
              </button>
              <button
                className={`loop-button ${loopCount === 3 ? 'active' : ''}`}
                onClick={() => setLoopCount(3)}
                disabled={loading}
              >
                3x
              </button>
              <button
                className={`loop-button ${loopCount === 5 ? 'active' : ''}`}
                onClick={() => setLoopCount(5)}
                disabled={loading}
              >
                5x
              </button>
              <button
                className={`loop-button ${loopCount === 0 ? 'active' : ''}`}
                onClick={() => setLoopCount(0)}
                disabled={loading}
              >
                ∞
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause/Resume Button for Playing State */}
      {status === 'playing' && (
        <div className="playback-pause-container">
          <button
            className="pause-resume-button"
            onClick={handlePauseClick}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      )}

      {/* Top Toolbar - Requirements: 4.1, 4.2, 4.3, 4.4, 4.5 */}
      <div className="toolbar-area">
        <TopToolbar
          hasRecordings={hasRecordings}
          onRecordStart={handleRecordStart}
          onRecordStop={handleRecordStop}
          onPlayStart={handlePlayStart}
          onPlayStop={handlePlayStop}
          onSave={handleSave}
          onOpen={handleOpen}
          onClear={handleClear}
          onSettings={handleSettings}
        />
      </div>

      {/* Editor Area - Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5 */}
      <div className="editor-area">
        <EditorArea
          script={state.currentScript}
          recordingSession={state.recordingSession}
          onScriptChange={handleScriptChange}
          onActionSelect={handleActionSelect}
          onActionEdit={handleActionEdit}
          onActionDelete={handleActionDelete}
        />
      </div>

      {/* Script Loader Modal for Step-Based Recording - preserved from RecorderScreen */}
      {showScriptLoaderForRecording && (
        <div className="modal-overlay" onClick={() => setShowScriptLoaderForRecording(false)}>
          <div className="modal-content script-selector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Select Script for Step Recording</h2>
              <button
                className="modal-close-button"
                onClick={() => setShowScriptLoaderForRecording(false)}
              >
                ×
              </button>
            </div>

            <div className="step-recording-info-banner">
              <p>Select a step-based script to record actions for specific test steps.</p>
              <p className="step-recording-info-note">
                Only scripts with test steps can be used for step-based recording.
              </p>
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
                    selected={false}
                    onClick={(script) => handleSelectScriptForRecording(script.path)}
                    showDelete={false}
                    compact={true}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Script Selector Modal - preserved from RecorderScreen */}
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

      {/* Keyboard Shortcut Hint - preserved from RecorderScreen */}
      {(status === 'recording' || status === 'playing') && (
        <div className="shortcut-hint">
          Press <kbd>ESC</kbd> to stop
        </div>
      )}
    </UnifiedInterface>
  );
};

/**
 * UnifiedRecorderScreen Component
 * Main screen component with context provider
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
const UnifiedRecorderScreen: React.FC = () => {
  return (
    <UnifiedInterfaceProvider>
      <div className="unified-recorder-screen">
        {/*<UnifiedRecorderContent />*/}
        <SimpleUnifiedInterface />
      </div>
    </UnifiedInterfaceProvider>
  );
};

export default UnifiedRecorderScreen;
