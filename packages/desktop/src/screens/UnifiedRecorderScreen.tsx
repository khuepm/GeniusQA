/**
 * UnifiedRecorderScreen Component
 * New unified interface for recording and editing
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.4, 2.5
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UnifiedInterface, UnifiedInterfaceProvider, useUnifiedInterface } from '../components/UnifiedInterface';
import { TopToolbar } from '../components/TopToolbar';
import { EditorArea } from '../components/EditorArea';
import { getIPCBridge } from '../services/ipcBridgeService';
import { RecorderStatus, IPCEvent } from '../types/recorder.types';
import './UnifiedRecorderScreen.css';

/**
 * UnifiedRecorderContent Component
 * The main content that uses the unified interface context
 */
const UnifiedRecorderContent: React.FC = () => {
  const navigate = useNavigate();
  const ipcBridge = getIPCBridge();
  const {
    state,
    setMode,
    setCurrentScript,
    setRecordingSession,
    setPlaybackSession,
    setEditorVisible
  } = useUnifiedInterface();

  // Local state for recorder functionality
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasRecordings, setHasRecordings] = useState<boolean>(false);
  const [lastRecordingPath, setLastRecordingPath] = useState<string | null>(null);

  /**
   * Initialize component
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

          // Load the script into unified state
          if (latestPath) {
            setCurrentScript({
              path: latestPath,
              filename: latestPath.split('/').pop() || 'Unknown',
              content: '', // Will be loaded when needed
              actions: [] // Will be loaded when needed
            });
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

    // Set up event listeners for recording/playback events
    const handleRecordingStoppedEvent = async (event: IPCEvent) => {
      console.log('Recording stopped:', event.data);
      setStatus('idle');
      setMode('idle');
      setLoading(false);

      // Update with the new recording
      if (event.data?.scriptPath) {
        setLastRecordingPath(event.data.scriptPath);
        setHasRecordings(true);

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
      console.log('Playback stopped:', event.data);
      setStatus('idle');
      setMode('idle');
      setLoading(false);
      setPlaybackSession(null);
    };

    const handleErrorEvent = (event: IPCEvent) => {
      console.error('IPC Error:', event.data);
      setError(event.data?.message || 'An error occurred');
      setStatus('idle');
      setMode('idle');
      setLoading(false);
      setRecordingSession(null);
      setPlaybackSession(null);
    };

    ipcBridge.addEventListener('recording_stopped', handleRecordingStoppedEvent);
    ipcBridge.addEventListener('playback_stopped', handlePlaybackStoppedEvent);
    ipcBridge.addEventListener('error', handleErrorEvent);

    // Cleanup
    return () => {
      ipcBridge.removeEventListener('recording_stopped', handleRecordingStoppedEvent);
      ipcBridge.removeEventListener('playback_stopped', handlePlaybackStoppedEvent);
      ipcBridge.removeEventListener('error', handleErrorEvent);
    };
  }, [ipcBridge, setMode, setCurrentScript, setRecordingSession, setPlaybackSession, setEditorVisible]);

  /**
   * Handle Record Start - Requirements: 1.1, 1.3, 5.1, 5.2
   */
  const handleRecordStart = async () => {
    try {
      setError(null);
      setLoading(true);

      // Start recording
      await ipcBridge.startRecording();
      setStatus('recording');
      setMode('recording');

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
   */
  const handleRecordStop = async () => {
    try {
      setError(null);
      setLoading(true);

      // Stop recording
      const result = await ipcBridge.stopRecording();

      if (result.success) {
        setLastRecordingPath(result.scriptPath || null);
        setHasRecordings(true);
        setStatus('idle');
        setMode('idle');

        // Update current script with recorded actions
        if (result.scriptPath) {
          setCurrentScript({
            path: result.scriptPath,
            filename: result.scriptPath.split('/').pop() || 'Unknown',
            content: '',
            actions: [] // Actions will be loaded when needed
          });
        }
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
   */
  const handlePlayStart = async () => {
    try {
      setError(null);
      setLoading(true);

      // Use current script path or last recording
      const scriptPath = state.currentScript?.path || lastRecordingPath;
      if (!scriptPath) {
        throw new Error('No script selected for playback');
      }

      // Start playback
      await ipcBridge.startPlayback(scriptPath, 1.0, 1);
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
   */
  const handlePlayStop = async () => {
    try {
      setError(null);
      setLoading(true);

      // Stop playback
      await ipcBridge.stopPlayback();
      setStatus('idle');
      setMode('idle');
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
      // Open script functionality will be implemented in future tasks
      console.log('Open script dialog');
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
      {/* Back button - positioned outside the unified interface */}
      <button
        className="back-button"
        onClick={() => navigate(-1)}
        title="Back to Dashboard"
      >
        ←
      </button>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span className="error-text">{error}</span>
          <button
            className="error-close"
            onClick={() => setError(null)}
          >
            ×
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
      </div>
    </UnifiedInterfaceProvider>
  );
};

export default UnifiedRecorderScreen;
