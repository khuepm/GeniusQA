import React, { useState, useEffect } from 'react';
import { ApplicationFocusConfig, FocusLossStrategy } from '../types/applicationFocusedAutomation.types';
import './ConfigurationScreen.css';

export const ConfigurationScreen: React.FC = () => {
  const [config, setConfig] = useState<ApplicationFocusConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // TODO: Replace with actual Tauri command call
      // const loadedConfig = await invoke('load_application_focus_config');
      // setConfig(loadedConfig);

      // Mock default configuration for now
      const defaultConfig: ApplicationFocusConfig = {
        focus_check_interval_ms: 100,
        max_registered_applications: 50,
        auto_resume_delay_ms: 500,
        notification_timeout_ms: 5000,
        enable_focus_notifications: true,
        strict_window_validation: true,
        default_focus_strategy: FocusLossStrategy.AutoPause,
        use_event_hooks: true,
        fallback_polling_enabled: true,
      };
      setConfig(defaultConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfiguration = async () => {
    if (!config) return;

    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Validate configuration before saving
      validateConfiguration(config);

      // TODO: Replace with actual Tauri command call
      // await invoke('save_application_focus_config', { config });

      console.log('Saving configuration:', config);
      setSuccessMessage('Configuration saved successfully');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const validateConfiguration = (config: ApplicationFocusConfig) => {
    if (config.focus_check_interval_ms <= 0 || config.focus_check_interval_ms > 10000) {
      throw new Error('Focus check interval must be between 1 and 10000 milliseconds');
    }
    if (config.max_registered_applications <= 0 || config.max_registered_applications > 1000) {
      throw new Error('Max registered applications must be between 1 and 1000');
    }
    if (config.auto_resume_delay_ms > 30000) {
      throw new Error('Auto resume delay should not exceed 30 seconds');
    }
    if (config.notification_timeout_ms <= 0 || config.notification_timeout_ms > 300000) {
      throw new Error('Notification timeout must be between 1 and 300000 milliseconds');
    }
  };

  const resetToDefaults = () => {
    const defaultConfig: ApplicationFocusConfig = {
      focus_check_interval_ms: 100,
      max_registered_applications: 50,
      auto_resume_delay_ms: 500,
      notification_timeout_ms: 5000,
      enable_focus_notifications: true,
      strict_window_validation: true,
      default_focus_strategy: FocusLossStrategy.AutoPause,
      use_event_hooks: true,
      fallback_polling_enabled: true,
    };
    setConfig(defaultConfig);
    setSuccessMessage('Configuration reset to defaults');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const updateConfig = (field: keyof ApplicationFocusConfig, value: any) => {
    if (!config) return;

    setConfig(prev => prev ? { ...prev, [field]: value } : null);
    setError(null);
    setSuccessMessage(null);
  };

  if (isLoading) {
    return (
      <div className="configuration-screen">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="configuration-screen">
        <div className="error-container">
          <p>Failed to load configuration</p>
          <button onClick={loadConfiguration}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="configuration-screen">
      <div className="header">
        <h1>Application Focus Configuration</h1>
        <p>Configure focus monitoring and automation behavior</p>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button
            className="error-dismiss"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="success-banner">
          <span className="success-icon">✅</span>
          <span>{successMessage}</span>
        </div>
      )}

      <div className="config-sections">
        {/* Focus Monitoring Section */}
        <div className="config-section">
          <h2>Focus Monitoring</h2>

          <div className="config-field">
            <label htmlFor="focus-interval">Focus Check Interval (ms)</label>
            <input
              id="focus-interval"
              type="number"
              min="1"
              max="10000"
              value={config.focus_check_interval_ms}
              onChange={(e) => updateConfig('focus_check_interval_ms', parseInt(e.target.value))}
            />
            <span className="field-description">
              How often to check focus when polling (1-10000ms)
            </span>
          </div>

          <div className="config-field">
            <label>
              <input
                type="checkbox"
                checked={config.use_event_hooks}
                onChange={(e) => updateConfig('use_event_hooks', e.target.checked)}
              />
              Use Event Hooks (Recommended)
            </label>
            <span className="field-description">
              Use platform-specific event hooks for efficient focus detection
            </span>
          </div>

          <div className="config-field">
            <label>
              <input
                type="checkbox"
                checked={config.fallback_polling_enabled}
                onChange={(e) => updateConfig('fallback_polling_enabled', e.target.checked)}
              />
              Enable Fallback Polling
            </label>
            <span className="field-description">
              Use polling as backup when event hooks fail
            </span>
          </div>
        </div>

        {/* Application Management Section */}
        <div className="config-section">
          <h2>Application Management</h2>

          <div className="config-field">
            <label htmlFor="max-apps">Maximum Registered Applications</label>
            <input
              id="max-apps"
              type="number"
              min="1"
              max="1000"
              value={config.max_registered_applications}
              onChange={(e) => updateConfig('max_registered_applications', parseInt(e.target.value))}
            />
            <span className="field-description">
              Maximum number of applications that can be registered (1-1000)
            </span>
          </div>

          <div className="config-field">
            <label>
              <input
                type="checkbox"
                checked={config.strict_window_validation}
                onChange={(e) => updateConfig('strict_window_validation', e.target.checked)}
              />
              Strict Window Validation
            </label>
            <span className="field-description">
              Perform strict validation of window coordinates and bounds
            </span>
          </div>
        </div>

        {/* Focus Strategies Section */}
        <div className="config-section">
          <h2>Focus Strategies</h2>

          <div className="config-field">
            <label htmlFor="default-strategy">Default Focus Loss Strategy</label>
            <select
              id="default-strategy"
              value={config.default_focus_strategy}
              onChange={(e) => updateConfig('default_focus_strategy', e.target.value as FocusLossStrategy)}
            >
              <option value={FocusLossStrategy.AutoPause}>Auto-Pause</option>
              <option value={FocusLossStrategy.StrictError}>Strict Error</option>
              <option value={FocusLossStrategy.Ignore}>Ignore</option>
            </select>
            <span className="field-description">
              Default behavior when target application loses focus
            </span>
          </div>

          <div className="config-field">
            <label htmlFor="resume-delay">Auto Resume Delay (ms)</label>
            <input
              id="resume-delay"
              type="number"
              min="0"
              max="30000"
              value={config.auto_resume_delay_ms}
              onChange={(e) => updateConfig('auto_resume_delay_ms', parseInt(e.target.value))}
            />
            <span className="field-description">
              Delay before auto-resuming after focus is regained (0-30000ms)
            </span>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="config-section">
          <h2>Notifications</h2>

          <div className="config-field">
            <label>
              <input
                type="checkbox"
                checked={config.enable_focus_notifications}
                onChange={(e) => updateConfig('enable_focus_notifications', e.target.checked)}
              />
              Enable Focus Change Notifications
            </label>
            <span className="field-description">
              Show notifications when focus changes occur
            </span>
          </div>

          <div className="config-field">
            <label htmlFor="notification-timeout">Notification Timeout (ms)</label>
            <input
              id="notification-timeout"
              type="number"
              min="1"
              max="300000"
              value={config.notification_timeout_ms}
              onChange={(e) => updateConfig('notification_timeout_ms', parseInt(e.target.value))}
            />
            <span className="field-description">
              How long notifications stay visible (1-300000ms)
            </span>
          </div>
        </div>
      </div>

      <div className="actions-bar">
        <button
          className="save-button primary"
          onClick={saveConfiguration}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>
        <button
          className="reset-button secondary"
          onClick={resetToDefaults}
          disabled={isSaving}
        >
          Reset to Defaults
        </button>
        <button
          className="reload-button secondary"
          onClick={loadConfiguration}
          disabled={isSaving}
        >
          Reload
        </button>
      </div>
    </div>
  );
};
