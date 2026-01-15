/**
 * AnalyticsSettings Component
 *
 * Settings panel for managing analytics consent and preferences.
 * Shows what data is collected and allows users to opt in/out.
 *
 * Requirements: 6.3
 */

import React, { useCallback, useState } from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import './AnalyticsSettings.css';

/**
 * Props for the AnalyticsSettings component
 */
export interface AnalyticsSettingsProps {
  /** Optional callback when consent changes */
  onConsentChange?: (enabled: boolean) => void;
}

/**
 * Data collection items to display to the user
 */
const DATA_COLLECTION_ITEMS = [
  {
    icon: '📊',
    title: 'Feature Usage',
    description: 'Which features you use and how often',
  },
  {
    icon: '🖥️',
    title: 'Device Information',
    description: 'Operating system, screen resolution, app version',
  },
  {
    icon: '⚠️',
    title: 'Error Reports',
    description: 'Anonymous error logs to help fix bugs',
  },
  {
    icon: '⏱️',
    title: 'Performance Metrics',
    description: 'App startup time and operation durations',
  },
];

/**
 * AnalyticsSettings Component
 *
 * Provides UI for managing analytics consent in the settings screen.
 * Shows what data is collected and allows users to opt out.
 *
 * @requirements 6.3 - Allow user to opt out of analytics
 */
export const AnalyticsSettings: React.FC<AnalyticsSettingsProps> = ({
  onConsentChange,
}) => {
  const { isEnabled, setEnabled } = useAnalytics();
  const [isUpdating, setIsUpdating] = useState(false);

  /**
   * Handle toggle change
   */
  const handleToggleChange = useCallback(async () => {
    setIsUpdating(true);
    try {
      const newValue = !isEnabled;
      await setEnabled(newValue);
      onConsentChange?.(newValue);
    } finally {
      setIsUpdating(false);
    }
  }, [isEnabled, setEnabled, onConsentChange]);

  return (
    <div className="analytics-settings" data-testid="analytics-settings">
      {/* Header with toggle */}
      <div className="analytics-settings-header">
        <div className="analytics-settings-info">
          <div className="analytics-settings-icon">📈</div>
          <div className="analytics-settings-text">
            <h3 className="analytics-settings-title">Usage Analytics</h3>
            <p className="analytics-settings-description">
              Help improve GeniusQA by sharing anonymous usage data
            </p>
          </div>
        </div>
        <label className="analytics-toggle" data-testid="analytics-toggle">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={handleToggleChange}
            disabled={isUpdating}
            data-testid="analytics-toggle-input"
          />
          <span className="analytics-toggle-slider" />
        </label>
      </div>

      {/* Status indicator */}
      <div
        className={`analytics-status ${isEnabled ? 'enabled' : 'disabled'}`}
        data-testid="analytics-status"
      >
        <span className="analytics-status-icon">
          {isEnabled ? '✓' : '○'}
        </span>
        <span className="analytics-status-text">
          {isEnabled ? 'Analytics enabled' : 'Analytics disabled'}
        </span>
      </div>

      {/* Data collection info */}
      <div className="analytics-data-section">
        <h4 className="analytics-data-title">What we collect:</h4>
        <ul className="analytics-data-list">
          {DATA_COLLECTION_ITEMS.map((item, index) => (
            <li key={index} className="analytics-data-item">
              <span className="analytics-data-icon">{item.icon}</span>
              <div className="analytics-data-content">
                <span className="analytics-data-name">{item.title}</span>
                <span className="analytics-data-desc">{item.description}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Privacy note */}
      <div className="analytics-privacy-note">
        <span className="analytics-privacy-icon">🔒</span>
        <p className="analytics-privacy-text">
          We never collect personal information, recordings, or scripts.
          All data is anonymized and used only to improve the app.
        </p>
      </div>
    </div>
  );
};

export default AnalyticsSettings;
