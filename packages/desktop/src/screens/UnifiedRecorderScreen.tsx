/**
 * UnifiedRecorderScreen Component
 * New unified interface for recording and editing
 * Preserves all existing functionality from RecorderScreen
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.4, 2.5, 10.1, 10.2, 10.4
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EditorArea } from '../components/EditorArea';
import { EnhancedTopToolbar } from '../components/EnhancedTopToolbar';
import { ScriptFilter } from '../components/ScriptFilter';
import { ScriptListItem } from '../components/ScriptListItem';
import { RecordingSession, UnifiedInterface, UnifiedInterfaceProvider, useUnifiedInterface } from '../components/UnifiedInterface';
import { useAnalytics } from '../hooks/useAnalytics';
import { getIPCBridge } from '../services/ipcBridgeService';
import { ScriptFilter as ScriptFilterType, ScriptSource, scriptStorageService, StoredScriptInfo, TargetOS } from '../services/scriptStorageService';
import {
  ActionData,
  ActionPreviewData,
  IPCEvent,
  RecorderStatus,
} from '../types/recorder.types';
import { TestScript, TestStep } from '../types/testCaseDriven.types';
import './UnifiedRecorderScreen.css';
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
  const { trackEvent, trackFeatureUsed, trackError } = useAnalytics();
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

  // Core initialization state
  const [coreInitialized, setCoreInitialized] = useState<boolean>(false);

  /**
   * Initialize core status - copied from RecorderScreen
   * This ensures the Rust core is ready before recording
   */
  const initializeCoreStatus = async () => {
    try {
      console.log('[UnifiedRecorder] Initializing core status...');
      // Get core status to ensure backend is ready
      const status = await ipcBridge.getCoreStatus();
      console.log('[UnifiedRecorder] Core status:', status);
      setCoreInitialized(true);
      return true;
    } catch (err) {
      console.error('[UnifiedRecorder] Core initialization error:', err);
      // Still mark as initialized to allow attempts
      setCoreInitialized(true);
      return false;
    }
  };

  /**
   * Initialize component - preserved from RecorderScreen
   * Requirements: 2.5, 6.4, 9.1, 9.5
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize core status first - critical for recording to work
        await initializeCoreStatus();

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

    // Handle custom event to open script loader for recording
    const handleOpenScriptLoaderForRecording = () => {
      setShowScriptLoaderForRecording(true);
    };

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

      // Track playback_completed event (natural completion)
      trackEvent('playback_completed', {
        completedActions: event.data?.totalActions || totalActions,
        totalActions: event.data?.totalActions || totalActions,
        completedLoops: event.data?.totalLoops || totalLoops,
        totalLoops: event.data?.totalLoops || totalLoops,
        stoppedByUser: false,
      });

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
      const errorMessage = event.data?.message || 'An error occurred';

      // Track error event
      trackEvent('playback_failed', {
        error: errorMessage,
        phase: 'execution',
        errorType: event.data?.type,
      });

      // Check for element_not_found error
      if (event.data?.type === 'element_not_found' || errorMessage.includes('element not found')) {
        trackError(new Error(errorMessage), {
          component: 'UnifiedRecorderScreen',
          action: 'playback_element_not_found',
          metadata: {
            errorType: 'element_not_found',
          },
        });
      }

      setError(errorMessage);
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

      // Track recording_completed event (ESC key stop)
      trackEvent('recording_completed', {
        duration: recordingTime,
        actionCount: state.recordingSession?.actions?.length || 0,
        scriptPath: event.data?.scriptPath,
        stoppedByEsc: true,
      });

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

    // Add event listener for recording actions
    const handleRecordingActionEvent = (event: IPCEvent) => {
      console.log('[UnifiedRecorder] Recording action received:', event.data);

      if (event.data?.action && status === 'recording') {
        // Update recording session with new action
        const currentSession = state.recordingSession;
        if (currentSession) {
          const newAction = {
            ...event.data.action,
            id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: event.data.action.timestamp || ((Date.now() - (currentSession.startTime || Date.now())) / 1000)
          };

          const updatedSession: RecordingSession = {
            ...currentSession,
            actions: [...currentSession.actions, newAction]
          };

          setRecordingSession(updatedSession);
          console.log('[UnifiedRecorder] Recording session updated with new action:', newAction);
        }
      }
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
    ipcBridge.addEventListener('recording_action', handleRecordingActionEvent);

    // Add custom event listener for opening script loader
    window.addEventListener('open-script-loader-for-recording', handleOpenScriptLoaderForRecording);

    // Cleanup
    return () => {
      ipcBridge.removeEventListener('progress', handleProgressEvent);
      ipcBridge.removeEventListener('action_preview', handleActionPreviewEvent);
      ipcBridge.removeEventListener('complete', handleCompleteEvent);
      ipcBridge.removeEventListener('error', handleErrorEvent);
      ipcBridge.removeEventListener('recording_stopped', handleRecordingStoppedEvent);
      ipcBridge.removeEventListener('playback_stopped', handlePlaybackStoppedEvent);
      ipcBridge.removeEventListener('playback_paused', handlePlaybackPausedEvent);
      ipcBridge.removeEventListener('recording_action', handleRecordingActionEvent);

      // Remove custom event listener
      window.removeEventListener('open-script-loader-for-recording', handleOpenScriptLoaderForRecording);
    };
  }, [location.state, ipcBridge, setMode, setCurrentScript, setRecordingSession, setPlaybackSession, setEditorVisible, trackEvent, trackError, recordingTime, state.recordingSession, totalActions, totalLoops]);

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
   * Preserved from RecorderScreen with step-based recording support and enhanced state management
   */
  const handleRecordStart = async () => {
    try {
      setError(null);
      setLoading(true);

      console.log('[UnifiedRecorder] Starting recording...');
      console.log('[UnifiedRecorder] Current status:', status);

      // Track feature usage for recorder
      trackFeatureUsed('recorder', { action: 'start' });

      // Start recording - add timeout to prevent infinite hang
      console.log('[UnifiedRecorder] Calling ipcBridge.startRecording()...');

      const startPromise = ipcBridge.startRecording();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Recording start timeout after 10s')), 10000)
      );

      await Promise.race([startPromise, timeoutPromise]);

      console.log('[UnifiedRecorder] startRecording() completed successfully');

      setStatus('recording');
      setMode('recording');
      setRecordingStartTime(Date.now());
      setRecordingTime(0);

      // Track recording_started event
      trackEvent('recording_started', {
        stepRecordingEnabled,
        hasActiveScript: !!activeRecordingScript,
      });

      // Create recording session
      const newRecordingSession: RecordingSession = {
        isActive: true,
        startTime: Date.now(),
        actions: []
      };

      setRecordingSession(newRecordingSession);
      console.log('[UnifiedRecorder] Recording session created:', newRecordingSession);

      // Ensure editor is visible during recording - Requirements: 5.1
      setEditorVisible(true);

      console.log('[UnifiedRecorder] Recording started successfully');

      // TEMPORARY: Add test actions to verify UI is working
      // This will be removed once backend events are working properly
      if (process.env.NODE_ENV === 'development') {
        console.log('[UnifiedRecorder] Adding test actions for development...');

        // Simulate some test actions after a short delay
        setTimeout(() => {
          const testActions = [
            {
              id: `action_${Date.now()}_1`,
              type: 'mouse_click',
              timestamp: 1.0,
              x: 100,
              y: 200,
              button: 'left'
            },
            {
              id: `action_${Date.now()}_2`,
              type: 'key_press',
              timestamp: 2.5,
              key: 'a'
            },
            {
              id: `action_${Date.now()}_3`,
              type: 'mouse_move',
              timestamp: 3.2,
              x: 150,
              y: 250
            }
          ];

          // Add test actions to recording session
          const currentSession = state.recordingSession;
          if (currentSession && status === 'recording') {
            const updatedSession: RecordingSession = {
              ...currentSession,
              actions: [...currentSession.actions, ...testActions]
            };
            setRecordingSession(updatedSession);
            console.log('[UnifiedRecorder] Test actions added:', testActions);
          }
        }, 2000); // Add test actions after 2 seconds
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      console.error('[UnifiedRecorder] Recording error:', err);

      // Track recording_failed event
      trackEvent('recording_failed', {
        error: errorMessage,
        phase: 'start',
      });

      // Track error for error tracking
      if (err instanceof Error) {
        trackError(err, {
          component: 'UnifiedRecorderScreen',
          action: 'handleRecordStart',
        });
      }

      // Reset state on start failure
      setStatus('idle');
      setMode('idle');
      setRecordingStartTime(null);
      setRecordingTime(0);
      setRecordingSession(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Record Stop - Requirements: 1.3, 2.4
   * Preserved from RecorderScreen with enhanced error handling
   */
  const handleRecordStop = async () => {
    // Check if we're actually recording before calling stop
    // This prevents the "No recording in progress" error when ESC key already stopped recording
    if (status !== 'recording') {
      console.log('[UnifiedRecorder] Not recording, skipping stop');
      // Just ensure UI state is synced
      setStatus('idle');
      setMode('idle');
      setRecordingStartTime(null);
      setRecordingTime(0);
      setRecordingSession(null);
      return;
    }

    const recordingDuration = recordingTime;
    const actionCount = state.recordingSession?.actions?.length || 0;

    try {
      setError(null);
      setLoading(true);

      // Stop recording
      const result = await ipcBridge.stopRecording();

      if (result.success) {
        // Handle successful stop with potential warning
        if (result.warning) {
          console.warn('Recording stop warning:', result.warning);
        }

        // Track recording_completed event
        trackEvent('recording_completed', {
          duration: recordingDuration,
          actionCount,
          scriptPath: result.scriptPath,
        });

        setLastRecordingPath(result.scriptPath || null);
        setSelectedScriptPath(result.scriptPath || null);
        setHasRecordings(result.scriptPath ? true : hasRecordings);
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
            actions: []
          });

          // Reload available scripts to include the new recording
          await loadAvailableScripts();
        }
      } else {
        // Handle specific "No recording in progress" error gracefully
        if (result.error?.includes('No recording in progress')) {
          console.warn('Recording was already stopped (likely by ESC key)');
          // Just sync frontend state
          setStatus('idle');
          setMode('idle');
          setRecordingStartTime(null);
          setRecordingTime(0);
        } else {
          setError(result.error || 'Failed to stop recording');

          // Track recording_failed event
          trackEvent('recording_failed', {
            error: result.error || 'Failed to stop recording',
            phase: 'stop',
            duration: recordingDuration,
          });
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop recording';

      if (errorMessage.includes('No recording in progress')) {
        console.warn('Recording was already stopped (likely by ESC key)');
        setStatus('idle');
        setMode('idle');
        setRecordingStartTime(null);
        setRecordingTime(0);
      } else {
        setError(errorMessage);
        console.error('Stop recording error:', err);

        // Track recording_failed event
        trackEvent('recording_failed', {
          error: errorMessage,
          phase: 'stop',
          duration: recordingDuration,
        });

        // Track error for error tracking
        if (err instanceof Error) {
          trackError(err, {
            component: 'UnifiedRecorderScreen',
            action: 'handleRecordStop',
          });
        }
      }
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

      // Track feature usage for playback
      trackFeatureUsed('playback', { action: 'start' });

      // Start playback with preserved speed and loop settings
      await ipcBridge.startPlayback(scriptPath, playbackSpeed, loopCount);
      setStatus('playing');
      setMode('playing');

      // Track playback_started event
      trackEvent('playback_started', {
        scriptPath,
        playbackSpeed,
        loopCount,
      });

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

      // Track playback_failed event
      trackEvent('playback_failed', {
        error: errorMessage,
        phase: 'start',
      });

      // Track error for error tracking
      if (err instanceof Error) {
        trackError(err, {
          component: 'UnifiedRecorderScreen',
          action: 'handlePlayStart',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Play Stop - Requirements: 1.3, 2.4
   * Preserved from RecorderScreen
   */
  const handlePlayStop = async () => {
    const completedActions = actionIndex;
    const totalActionsCount = totalActions;

    try {
      setError(null);
      setLoading(true);

      // Stop playback
      await ipcBridge.stopPlayback();

      // Track playback_completed event (user-initiated stop)
      trackEvent('playback_completed', {
        completedActions,
        totalActions: totalActionsCount,
        completedLoops: currentLoop,
        totalLoops,
        stoppedByUser: true,
      });

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

      // Track playback_failed event
      trackEvent('playback_failed', {
        error: errorMessage,
        phase: 'stop',
        completedActions,
      });

      // Track error for error tracking
      if (err instanceof Error) {
        trackError(err, {
          component: 'UnifiedRecorderScreen',
          action: 'handlePlayStop',
        });
      }
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

      // Track dialog_opened event
      trackEvent('dialog_opened', {
        dialogName: 'ScriptSelector',
      });
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
          // Track shortcut_used event
          trackEvent('shortcut_used', {
            shortcut: 'Escape',
            action: 'stop_recording',
          });
          void handleRecordStop();
        } else if (status === 'playing') {
          event.preventDefault();
          // Track shortcut_used event
          trackEvent('shortcut_used', {
            shortcut: 'Escape',
            action: 'stop_playback',
          });
          void handlePlayStop();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [status, trackEvent]);

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

    // Track dialog_opened event
    trackEvent('dialog_opened', {
      dialogName: 'ScriptLoaderForRecording',
    });
  }, [trackEvent]);

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
      {/* Click Cursor Overlay - temporarily disabled as fullscreen overlay not working */}
      {/* <ClickCursorOverlay isRecording={status === 'recording'} /> */}

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

      {/* Enhanced Top Toolbar with integrated controls */}
      <div className="toolbar-area">
        <EnhancedTopToolbar
          hasRecordings={hasRecordings}
          onRecordStart={handleRecordStart}
          onRecordStop={handleRecordStop}
          onPlayStart={handlePlayStart}
          onPlayStop={handlePlayStop}
          onSave={handleSave}
          onOpen={handleOpen}
          onClear={handleClear}
          onSettings={handleSettings}
          // Navigation props
          onBack={() => navigate(-1)}
          onSwitchToClassic={() => navigate('/recorder')}
          // Script selection props
          selectedScriptName={getSelectedScriptName()}
          onScriptSelect={openScriptSelector}
          // Playback controls props
          playbackSpeed={playbackSpeed}
          onPlaybackSpeedChange={setPlaybackSpeed}
          loopCount={loopCount}
          onLoopCountChange={setLoopCount}
          // Status props
          status={status}
          loading={loading}
          recordingTime={recordingTime}
          playbackProgress={playbackProgress}
          actionIndex={actionIndex}
          totalActions={totalActions}
          isPaused={isPaused}
          isPlaybackComplete={isPlaybackComplete}
        />
      </div>

      {/* Editor Area */}
      <div
        className={`editor-area ${state.editorVisible ? 'visible' : 'hidden'}`}
      >
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
        <UnifiedRecorderContent />
        {/*<SimpleUnifiedInterface />*/}
      </div>
    </UnifiedInterfaceProvider>
  );
};

export default UnifiedRecorderScreen;
