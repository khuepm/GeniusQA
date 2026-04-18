/**
 * Quick Recording Interface
 * Provides immediate recording access for anonymous users
 * Requirements: Story 1.1 - User can record first test script within 30 seconds
 */

import React, { useState, useEffect } from 'react';
import { useGuestMode } from '../contexts/GuestModeContext';
import { getIPCBridge } from '../services/ipcBridgeService';
import { RecorderStatus } from '../types/recorder.types';
import './QuickRecordingInterface.css';

interface QuickRecordingInterfaceProps {
  onRecordingComplete?: (scriptPath: string) => void;
}

export const QuickRecordingInterface: React.FC<QuickRecordingInterfaceProps> = ({
  onRecordingComplete
}) => {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);

  const { canRecordMore, addScript } = useGuestMode();
  const ipcBridge = getIPCBridge();

  // Update recording time while recording
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (status === 'recording' && recordingStartTime) {
      interval = setInterval(() => {
        const elapsed = (Date.now() - recordingStartTime) / 1000;
        setRecordingTime(elapsed);
      }, 100);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [status, recordingStartTime]);

  // Set up event listeners
  useEffect(() => {
    const handleRecordingStoppedEvent = async (event: any) => {
      console.log('Quick recording stopped:', event.data);
      setStatus('idle');
      setRecordingStartTime(null);
      setRecordingTime(0);

      if (event.data?.scriptPath) {
        setShowSuccess(true);

        // Add to guest mode storage
        try {
          addScript({
            name: `Recording ${new Date().toLocaleTimeString()}`,
            content: event.data.scriptPath || '', // Store the path as content for now
          });
        } catch (err) {
          console.error('Failed to add script to guest storage:', err);
        }

        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setShowSuccess(false);
        }, 3000);

        // Notify parent component
        if (onRecordingComplete) {
          onRecordingComplete(event.data.scriptPath);
        }
      }
    };

    ipcBridge.addEventListener('recording_stopped', handleRecordingStoppedEvent);

    return () => {
      ipcBridge.removeEventListener('recording_stopped', handleRecordingStoppedEvent);
    };
  }, [ipcBridge, addScript, onRecordingComplete]);

  const handleStartRecording = async () => {
    if (!canRecordMore) {
      setError('Script limit reached. Please create an account to record more scripts.');
      return;
    }

    try {
      setError(null);
      setShowSuccess(false);
      await ipcBridge.startRecording();
      setStatus('recording');
      setRecordingStartTime(Date.now());
      setRecordingTime(0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      console.error('Quick recording error:', err);
    }
  };

  const handleStopRecording = async () => {
    try {
      setError(null);
      const result = await ipcBridge.stopRecording();

      if (!result.success) {
        setError(result.error || 'Failed to stop recording');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop recording';
      setError(errorMessage);
      console.error('Stop recording error:', err);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = (): string => {
    if (recordingTime < 30) return '#4caf50'; // Green for under 30s
    if (recordingTime < 60) return '#ff9800'; // Orange for 30-60s
    return '#f44336'; // Red for over 60s
  };

  return (
    <div className="quick-recording-interface">
      <div className="quick-recording-header">
        <h2 className="quick-recording-title">
          🎬 Quick Recording
        </h2>
        <p className="quick-recording-subtitle">
          Start recording your interactions immediately - no signup required
        </p>
      </div>

      {error && (
        <div className="quick-recording-error">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
        </div>
      )}

      {showSuccess && (
        <div className="quick-recording-success">
          <span className="success-icon">✅</span>
          <span className="success-text">
            Recording saved successfully! You can now play it back.
          </span>
        </div>
      )}

      {status === 'recording' ? (
        <div className="recording-active">
          <div className="recording-indicator">
            <div className="recording-pulse" />
            <span className="recording-text">Recording in progress...</span>
          </div>

          <div className="recording-timer">
            <span
              className="timer-display"
              style={{ color: getTimeColor() }}
            >
              {formatTime(recordingTime)}
            </span>
            {recordingTime < 30 && (
              <span className="timer-goal">
                Goal: Under 30 seconds
              </span>
            )}
          </div>

          <div className="recording-instructions">
            <p>🖱️ All mouse clicks and movements are being captured</p>
            <p>⌨️ All keyboard inputs are being recorded</p>
            <p>📸 Screenshots are taken automatically</p>
          </div>

          <button
            className="stop-recording-btn"
            onClick={handleStopRecording}
          >
            ⏹️ Stop Recording
          </button>

          <div className="recording-hint">
            Press <kbd>ESC</kbd> to stop recording
          </div>
        </div>
      ) : (
        <div className="recording-ready">
          <div className="recording-features">
            <div className="feature-item">
              <span className="feature-icon">⚡</span>
              <span className="feature-text">Instant start - no setup required</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💾</span>
              <span className="feature-text">Automatically saved locally</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🔄</span>
              <span className="feature-text">Play back immediately</span>
            </div>
          </div>

          <button
            className="start-recording-btn"
            onClick={handleStartRecording}
            disabled={!canRecordMore}
          >
            🔴 Start Recording Now
          </button>

          {!canRecordMore && (
            <p className="limit-message">
              You've reached the 50 script limit for guest mode.
              <br />Create an account to record unlimited scripts.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
