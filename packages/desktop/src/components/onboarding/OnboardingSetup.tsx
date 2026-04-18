/**
 * Onboarding Setup Step Component
 * 
 * Allows users to configure initial settings for application-focused automation,
 * including default focus strategies and monitoring preferences.
 * 
 * Requirements: Task 18.1 - Feature onboarding flow
 */

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { OnboardingStep } from '../../services/onboardingService';

interface OnboardingSetupProps {
  step: OnboardingStep;
  onNext: () => void;
  onSkip: () => void;
}

interface ConfigurationOptions {
  defaultFocusStrategy: 'AutoPause' | 'StrictError' | 'Ignore';
  enableFocusNotifications: boolean;
  focusCheckInterval: number;
  strictWindowValidation: boolean;
}

export const OnboardingSetup: React.FC<OnboardingSetupProps> = ({
  step,
  onNext,
  onSkip,
}) => {
  const [config, setConfig] = useState<ConfigurationOptions>({
    defaultFocusStrategy: 'AutoPause',
    enableFocusNotifications: true,
    focusCheckInterval: 100,
    strictWindowValidation: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfigChange = (key: keyof ConfigurationOptions, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveAndContinue = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Save configuration via Tauri command
      await invoke('update_application_focus_config', {
        config: {
          focus_check_interval_ms: config.focusCheckInterval,
          enable_focus_notifications: config.enableFocusNotifications,
          strict_window_validation: config.strictWindowValidation,
          default_focus_strategy: config.defaultFocusStrategy,
        },
      });

      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="onboarding-step">
      <div className="step-header">
        <h2 className="step-title">{step.title}</h2>
        <p className="step-description">{step.description}</p>
      </div>

      <div className="step-body">
        {error && (
          <div style={{
            background: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '20px',
            color: '#721c24'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="config-options">
          {/* Focus Strategy */}
          <div className="config-group">
            <h4>Default Focus Strategy</h4>
            <p>Choose how automation should behave when the target application loses focus:</p>

            <div className="config-option-group">
              <div
                className={`config-option ${config.defaultFocusStrategy === 'AutoPause' ? 'selected' : ''}`}
                onClick={() => handleConfigChange('defaultFocusStrategy', 'AutoPause')}
              >
                <input
                  type="radio"
                  name="focusStrategy"
                  value="AutoPause"
                  checked={config.defaultFocusStrategy === 'AutoPause'}
                  onChange={() => handleConfigChange('defaultFocusStrategy', 'AutoPause')}
                />
                <div className="config-option-content">
                  <div className="config-option-title">Auto-Pause (Recommended)</div>
                  <div className="config-option-description">
                    Pause automation when focus is lost, resume when focus returns.
                    Safe and user-friendly for most scenarios.
                  </div>
                </div>
              </div>

              <div
                className={`config-option ${config.defaultFocusStrategy === 'StrictError' ? 'selected' : ''}`}
                onClick={() => handleConfigChange('defaultFocusStrategy', 'StrictError')}
              >
                <input
                  type="radio"
                  name="focusStrategy"
                  value="StrictError"
                  checked={config.defaultFocusStrategy === 'StrictError'}
                  onChange={() => handleConfigChange('defaultFocusStrategy', 'StrictError')}
                />
                <div className="config-option-content">
                  <div className="config-option-title">Strict Error</div>
                  <div className="config-option-description">
                    Immediately stop automation with an error if focus is lost.
                    Best for critical testing scenarios requiring strict focus.
                  </div>
                </div>
              </div>

              <div
                className={`config-option ${config.defaultFocusStrategy === 'Ignore' ? 'selected' : ''}`}
                onClick={() => handleConfigChange('defaultFocusStrategy', 'Ignore')}
              >
                <input
                  type="radio"
                  name="focusStrategy"
                  value="Ignore"
                  checked={config.defaultFocusStrategy === 'Ignore'}
                  onChange={() => handleConfigChange('defaultFocusStrategy', 'Ignore')}
                />
                <div className="config-option-content">
                  <div className="config-option-title">Ignore Focus Changes</div>
                  <div className="config-option-description">
                    Continue automation regardless of focus changes.
                    Use with caution - may affect other applications.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="config-group">
            <h4>Notification Preferences</h4>
            <p>Configure how you want to be notified about focus changes:</p>

            <div className="config-option">
              <input
                type="checkbox"
                id="enableNotifications"
                checked={config.enableFocusNotifications}
                onChange={(e) => handleConfigChange('enableFocusNotifications', e.target.checked)}
              />
              <div className="config-option-content">
                <div className="config-option-title">Enable Focus Notifications</div>
                <div className="config-option-description">
                  Show system notifications when automation is paused or resumed due to focus changes.
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="config-group">
            <h4>Advanced Settings</h4>
            <p>Fine-tune monitoring behavior (you can change these later):</p>

            <div className="config-option">
              <input
                type="checkbox"
                id="strictValidation"
                checked={config.strictWindowValidation}
                onChange={(e) => handleConfigChange('strictWindowValidation', e.target.checked)}
              />
              <div className="config-option-content">
                <div className="config-option-title">Strict Window Validation</div>
                <div className="config-option-description">
                  Validate that automation actions target the correct application windows.
                  Recommended for security.
                </div>
              </div>
            </div>

            <div style={{ marginTop: '15px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#212529'
              }}>
                Focus Check Interval: {config.focusCheckInterval}ms
              </label>
              <input
                type="range"
                min="50"
                max="500"
                step="50"
                value={config.focusCheckInterval}
                onChange={(e) => handleConfigChange('focusCheckInterval', parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#6c757d',
                marginTop: '4px'
              }}>
                <span>Faster (50ms)</span>
                <span>Slower (500ms)</span>
              </div>
              <p style={{
                fontSize: '13px',
                color: '#6c757d',
                marginTop: '8px',
                lineHeight: '1.4'
              }}>
                How often to check application focus. Lower values are more responsive but use more CPU.
              </p>
            </div>
          </div>
        </div>

        <div style={{
          background: '#e3f2fd',
          border: '1px solid #2196f3',
          borderRadius: '6px',
          padding: '15px',
          marginTop: '20px'
        }}>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#1565c0',
            lineHeight: '1.4'
          }}>
            💡 <strong>Don't worry!</strong> You can change all of these settings later
            in the Configuration screen. These are just sensible defaults to get you started.
          </p>
        </div>
      </div>

      <div className="step-actions">
        <button className="btn btn-outline" onClick={onSkip}>
          Use Defaults
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSaveAndContinue}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
};
