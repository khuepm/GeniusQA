/**
 * Guest Recorder Screen
 * Provides immediate recording access for anonymous users
 * Requirements: Story 1.1 - User can record first test script within 30 seconds
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuickRecordingInterface } from '../components/QuickRecordingInterface';
import { GuestModeIndicator } from '../components/GuestModeIndicator';
import { StorageUsageIndicator } from '../components/StorageUsageIndicator';
import { AuthButton } from '../components/AuthButton';
import { useGuestMode } from '../contexts/GuestModeContext';
import { getIPCBridge } from '../services/ipcBridgeService';
import { RecorderStatus } from '../types/recorder.types';
import './GuestRecorderScreen.css';

const GuestRecorderScreen: React.FC = () => {
  const navigate = useNavigate();
  const { scripts, scriptCount, maxScripts, showUpgradePrompt, dismissUpgradePrompt } = useGuestMode();
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<RecorderStatus>('idle');
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const ipcBridge = getIPCBridge();

  // Set up playback event listeners
  useEffect(() => {
    const handleProgressEvent = (event: any) => {
      if (event.data?.currentAction && event.data?.totalActions) {
        const progress = (event.data.currentAction / event.data.totalActions) * 100;
        setPlaybackProgress(progress);
      }
    };

    const handleCompleteEvent = () => {
      setPlaybackStatus('idle');
      setPlaybackProgress(0);
    };

    const handleErrorEvent = (event: any) => {
      setError(event.data?.message || 'Playback error occurred');
      setPlaybackStatus('idle');
      setPlaybackProgress(0);
    };

    ipcBridge.addEventListener('progress', handleProgressEvent);
    ipcBridge.addEventListener('complete', handleCompleteEvent);
    ipcBridge.addEventListener('error', handleErrorEvent);

    return () => {
      ipcBridge.removeEventListener('progress', handleProgressEvent);
      ipcBridge.removeEventListener('complete', handleCompleteEvent);
      ipcBridge.removeEventListener('error', handleErrorEvent);
    };
  }, [ipcBridge]);

  const handleRecordingComplete = (scriptId: string) => {
    setSelectedScriptId(scriptId);
  };

  const handlePlayback = async () => {
    if (!selectedScriptId) return;

    try {
      setError(null);
      setPlaybackStatus('playing');
      setPlaybackProgress(0);
      // Mock playback for desktop - in real implementation this would use IPC
      console.log('Starting playback for script:', selectedScriptId);
      setTimeout(() => {
        setPlaybackStatus('idle');
        setPlaybackProgress(0);
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start playback';
      setError(errorMessage);
      setPlaybackStatus('idle');
    }
  };

  const handleStopPlayback = async () => {
    try {
      await ipcBridge.stopPlayback();
      setPlaybackStatus('idle');
      setPlaybackProgress(0);
    } catch (err) {
      console.error('Failed to stop playback:', err);
    }
  };

  const handleCreateAccount = () => {
    navigate('/register');
  };

  const handleSignIn = () => {
    navigate('/login');
  };

  const recentScripts = scripts.slice(-3).reverse(); // Show 3 most recent scripts

  return (
    <div className="guest-recorder-container">
      <div className="guest-recorder-content">
        {/* Header */}
        <div className="guest-recorder-header">
          <div className="header-content">
            <h1 className="app-title">🎯 GeniusQA</h1>
            <p className="app-subtitle">
              Record and automate your desktop interactions
            </p>
          </div>
          <div className="auth-buttons">
            <button className="sign-in-btn" onClick={handleSignIn}>
              Sign In
            </button>
            <button className="create-account-btn" onClick={handleCreateAccount}>
              Create Account
            </button>
          </div>
        </div>

        {/* Guest Mode Indicator */}
        <GuestModeIndicator showStorageDetails={true} onCreateAccount={handleCreateAccount} />

        {/* Storage Usage Indicator */}
        <div className="storage-usage-section">
          <StorageUsageIndicator
            currentCount={scriptCount}
            maxCount={maxScripts}
            size="md"
          />
        </div>

        {/* Upgrade Prompt */}
        {showUpgradePrompt && (
          <div className="upgrade-prompt">
            <div className="upgrade-content">
              <div className="upgrade-info">
                <h3 className="upgrade-title">☁️ Never lose your work</h3>
                <p className="upgrade-description">
                  You have {scripts.length} scripts saved locally. Create an account to:
                </p>
                <ul className="upgrade-benefits">
                  <li>✅ Save unlimited scripts to the cloud</li>
                  <li>✅ Access your scripts from any device</li>
                  <li>✅ Share scripts with your team</li>
                  <li>✅ Never lose your work again</li>
                </ul>
              </div>
              <div className="upgrade-actions">
                <button className="upgrade-btn" onClick={handleCreateAccount}>
                  Create Free Account
                </button>
                <button className="dismiss-btn" onClick={dismissUpgradePrompt}>
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="error-container">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error}</span>
          </div>
        )}

        {/* Quick Recording Interface */}
        <QuickRecordingInterface onRecordingComplete={handleRecordingComplete} />

        {/* Recent Scripts & Playback */}
        {scripts.length > 0 && (
          <div className="recent-scripts-section">
            <h2 className="section-title">📋 Your Recent Scripts</h2>

            {selectedScriptId && (
              <div className="playback-controls">
                <h3 className="playback-title">🎬 Playback Controls</h3>

                {playbackStatus === 'playing' && (
                  <div className="playback-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${playbackProgress}%` }}
                      />
                    </div>
                    <span className="progress-text">
                      {Math.round(playbackProgress)}% complete
                    </span>
                  </div>
                )}

                <div className="playback-buttons">
                  {playbackStatus === 'idle' ? (
                    <AuthButton
                      title="▶️ Play Last Recording"
                      onPress={handlePlayback}
                      variant="primary"
                      loading={false}
                      disabled={false}
                    />
                  ) : (
                    <AuthButton
                      title="⏹️ Stop Playback"
                      onPress={handleStopPlayback}
                      variant="secondary"
                      loading={false}
                      disabled={false}
                    />
                  )}
                </div>
              </div>
            )}

            <div className="scripts-list">
              {recentScripts.map((script) => {
                const scriptSteps = script.content ? JSON.parse(script.content).length : 0;
                return (
                  <div
                    key={script.id}
                    className={`script-item ${selectedScriptId === script.id ? 'selected' : ''}`}
                    onClick={() => setSelectedScriptId(script.id)}
                  >
                    <div className="script-info">
                      <span className="script-name">{script.name}</span>
                      <span className="script-details">
                        {scriptSteps} steps • Created {new Date(script.createdAt).toLocaleDateString()}
                      </span>
                      <span className="script-date">
                        {new Date(script.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="script-actions">
                      {selectedScriptId === script.id && (
                        <span className="selected-indicator">✓</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {scripts.length > 3 && (
              <div className="view-all-scripts">
                <p className="view-all-text">
                  You have {scripts.length - 3} more scripts saved locally
                </p>
                <button
                  className="view-all-btn"
                  onClick={() => navigate('/recorder')}
                >
                  View All Scripts
                </button>
              </div>
            )}
          </div>
        )}

        {/* Getting Started Guide */}
        <div className="getting-started-section">
          <h2 className="section-title">🚀 Getting Started</h2>
          <div className="steps-grid">
            <div className="step-item">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3 className="step-title">Click "Start Recording"</h3>
                <p className="step-description">
                  Begin capturing your mouse clicks and keyboard inputs
                </p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3 className="step-title">Perform Your Actions</h3>
                <p className="step-description">
                  Navigate and interact with any application on your desktop
                </p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3 className="step-title">Stop & Play Back</h3>
                <p className="step-description">
                  Press ESC or click stop, then replay your automation
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Features Highlight */}
        <div className="features-section">
          <h2 className="section-title">✨ What You Can Do</h2>
          <div className="features-grid">
            <div className="feature-card">
              <span className="feature-icon">🖱️</span>
              <h3 className="feature-title">Mouse Automation</h3>
              <p className="feature-description">
                Record clicks, drags, and movements with pixel-perfect accuracy
              </p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">⌨️</span>
              <h3 className="feature-title">Keyboard Input</h3>
              <p className="feature-description">
                Capture typing, shortcuts, and key combinations automatically
              </p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">📸</span>
              <h3 className="feature-title">Visual Verification</h3>
              <p className="feature-description">
                Screenshots are captured to verify each step of your automation
              </p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">🔄</span>
              <h3 className="feature-title">Instant Replay</h3>
              <p className="feature-description">
                Play back your recordings immediately with customizable speed
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestRecorderScreen;
