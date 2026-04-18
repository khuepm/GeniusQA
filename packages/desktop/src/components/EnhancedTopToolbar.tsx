/**
 * EnhancedTopToolbar Component
 * Enhanced toolbar with integrated script selection, playback speed, and loop controls
 * Simplified version to ensure proper rendering
 */

import React from 'react';
import { RecorderStatus } from '../types/recorder.types';
import './EnhancedTopToolbar.css';

// Props interface
export interface EnhancedTopToolbarProps {
  hasRecordings?: boolean;
  onRecordStart?: () => void;
  onRecordStop?: () => void;
  onPlayStart?: () => void;
  onPlayStop?: () => void;
  onSave?: () => void;
  onOpen?: () => void;
  onClear?: () => void;
  onSettings?: () => void;
  // Navigation props
  onBack?: () => void;
  onSwitchToClassic?: () => void;
  // Script selection props
  selectedScriptName?: string;
  onScriptSelect?: () => void;
  // Playback controls props
  playbackSpeed?: number;
  onPlaybackSpeedChange?: (speed: number) => void;
  loopCount?: number;
  onLoopCountChange?: (count: number) => void;
  // Status props
  status?: RecorderStatus;
  loading?: boolean;
  recordingTime?: number;
  playbackProgress?: number;
  actionIndex?: number;
  totalActions?: number;
  isPaused?: boolean;
  isPlaybackComplete?: boolean;
}

/**
 * EnhancedTopToolbar Component
 * Renders the main toolbar with integrated controls
 */
export const EnhancedTopToolbar: React.FC<EnhancedTopToolbarProps> = ({
  hasRecordings = false,
  onRecordStart,
  onRecordStop,
  onPlayStart,
  onPlayStop,
  onSave,
  onOpen,
  onClear,
  onSettings,
  onBack,
  onSwitchToClassic,
  selectedScriptName = 'Latest recording',
  onScriptSelect,
  playbackSpeed = 1.0,
  onPlaybackSpeedChange,
  loopCount = 1,
  onLoopCountChange,
  status = 'idle',
  loading = false,
  recordingTime = 0,
  playbackProgress = 0,
  actionIndex = 0,
  totalActions = 0,
  isPaused = false,
  isPlaybackComplete = false
}) => {
  // Format recording time
  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  // Speed options
  const speedOptions = [0.5, 1.0, 1.5, 2.0, 5.0];
  const loopOptions = [1, 2, 3, 5, 0]; // 0 = infinite

  const isRecording = status === 'recording';
  const isPlaying = status === 'playing';

  return (
    <div className="enhanced-top-toolbar">
      {/* Left Section: Navigation and Main Action Buttons */}
      <div className="toolbar-section toolbar-section-main">
        {/* Navigation Group */}
        <div className="toolbar-group toolbar-group-nav">
          <button
            className="toolbar-btn back-btn"
            onClick={onBack}
            title="Back to Dashboard"
          >
            ←
          </button>
          <button
            className="toolbar-btn classic-btn"
            onClick={onSwitchToClassic}
            title="Switch to Classic Interface"
          >
            Classic
          </button>
        </div>

        {/* Separator */}
        <div className="toolbar-separator" />

        {/* Step indicator */}
        <div className="step-indicator">
          <div className="step-icon">📋</div>
          <span className="step-text">Step</span>
        </div>

        {/* Recording Group */}
        <div className="toolbar-group toolbar-group-recording">
          <button
            className={`toolbar-btn record-btn ${isRecording ? 'active' : ''}`}
            onClick={isRecording ? onRecordStop : onRecordStart}
            disabled={loading || (status !== 'idle' && status !== 'recording')}
            title={isRecording ? 'Stop Recording' : 'Start Recording (Ctrl+R)'}
          >
            <div className={`record-icon ${isRecording ? 'recording' : ''}`}></div>
          </button>
        </div>

        {/* Playback Group */}
        <div className="toolbar-group toolbar-group-playback">
          <button
            className={`toolbar-btn play-btn ${isPlaying ? 'active' : ''}`}
            onClick={isPlaying ? onPlayStop : onPlayStart}
            disabled={loading || (status !== 'idle' && status !== 'playing') || !hasRecordings}
            title={isPlaying ? 'Stop Playback' : 'Start Playback (Ctrl+P)'}
          >
            <div className="play-icon"></div>
          </button>

          <button
            className="toolbar-btn stop-btn"
            onClick={isRecording ? onRecordStop : onPlayStop}
            disabled={loading || (status !== 'recording' && status !== 'playing')}
            title="Stop Current Action"
          >
            <div className="stop-icon"></div>
          </button>
        </div>

        {/* Separator */}
        <div className="toolbar-separator" />

        {/* Editor Group */}
        <div className="toolbar-group toolbar-group-editor">
          <button
            className="toolbar-btn save-btn"
            onClick={onSave}
            disabled={loading || !hasRecordings || status === 'recording'}
            title="Save Script (Ctrl+S)"
          >
            💾
          </button>

          <button
            className="toolbar-btn open-btn"
            onClick={onOpen}
            disabled={loading || status !== 'idle'}
            title="Open Script (Ctrl+O)"
          >
            📁
          </button>

          <button
            className="toolbar-btn clear-btn"
            onClick={onClear}
            disabled={loading || !hasRecordings || status !== 'idle'}
            title="Clear Editor"
          >
            🗑️
          </button>

          {/* Separator */}
          <div className="toolbar-separator" />

          <button
            className="toolbar-btn settings-btn"
            onClick={onSettings}
            disabled={loading}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Center Section: Script Selection and Status */}
      <div className="toolbar-section toolbar-section-center">
        {/* Script Selection */}
        {status === 'idle' && (
          <div className="script-selection-control">
            <span className="control-label">Script:</span>
            <button
              className="script-selection-button"
              onClick={onScriptSelect}
              disabled={loading}
              title="Select script to play"
            >
              <span className="script-selection-text">{selectedScriptName}</span>
              <span className="script-selection-icon">📁</span>
            </button>
          </div>
        )}

        {/* Recording Status */}
        {isRecording && (
          <div className="recording-status-display">
            <div className="recording-indicator">
              <div className="recording-pulse" />
              <span className="recording-text">Recording</span>
            </div>
            <div className="recording-time">
              {formatRecordingTime(recordingTime)}
            </div>
          </div>
        )}

        {/* Playback Status */}
        {(isPlaying || isPlaybackComplete) && totalActions > 0 && (
          <div className="playback-status-display">
            <div className="playback-indicator">
              {isPlaybackComplete ? (
                <span className="playback-text completed">✅ Complete</span>
              ) : isPaused ? (
                <span className="playback-text paused">⏸ Paused</span>
              ) : (
                <span className="playback-text playing">▶ Playing</span>
              )}
            </div>
            <div className="playback-progress">
              <span className="progress-text">
                {actionIndex}/{totalActions} ({Math.round(playbackProgress)}%)
              </span>
              <div className="progress-bar-mini">
                <div
                  className="progress-fill"
                  style={{ width: `${playbackProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Section: Playback Controls */}
      <div className="toolbar-section toolbar-section-right">
        {/* Playback Speed Control */}
        {status === 'idle' && hasRecordings && (
          <div className="speed-control">
            <span className="control-label">Speed:</span>
            <div className="speed-buttons">
              {speedOptions.map(speed => (
                <button
                  key={speed}
                  className={`speed-button ${playbackSpeed === speed ? 'active' : ''}`}
                  onClick={() => onPlaybackSpeedChange?.(speed)}
                  disabled={loading}
                  title={`Set playback speed to ${speed}x`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loop Control */}
        {status === 'idle' && hasRecordings && (
          <div className="loop-control">
            <span className="control-label">Loop:</span>
            <div className="loop-buttons">
              {loopOptions.map(count => (
                <button
                  key={count}
                  className={`loop-button ${loopCount === count ? 'active' : ''}`}
                  onClick={() => onLoopCountChange?.(count)}
                  disabled={loading}
                  title={count === 0 ? 'Loop infinitely' : `Loop ${count} time${count > 1 ? 's' : ''}`}
                >
                  {count === 0 ? '∞' : count}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedTopToolbar;
