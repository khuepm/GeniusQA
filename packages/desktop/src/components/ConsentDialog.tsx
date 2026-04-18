/**
 * ConsentDialog Component
 *
 * Modal dialog for analytics consent on first app launch.
 * Allows users to accept or decline analytics data collection.
 * Displays information about what data is collected.
 *
 * Requirements: 6.1, 6.2
 */

import React, { useCallback, useEffect, useState } from 'react';
import './ConsentDialog.css';

/**
 * Props for the ConsentDialog component
 */
export interface ConsentDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when user accepts analytics */
  onAccept: () => void;
  /** Callback when user declines analytics */
  onDecline: () => void;
}

/**
 * Data collection items to display to the user
 */
const DATA_COLLECTION_ITEMS = [
  {
    icon: '📊',
    title: 'Feature Usage',
    description: 'Which features you use and how often (recording, playback, AI chat)',
  },
  {
    icon: '🖥️',
    title: 'Device Information',
    description: 'Operating system, screen resolution, and app version',
  },
  {
    icon: '⚠️',
    title: 'Error Reports',
    description: 'Anonymous error logs to help us fix bugs and improve stability',
  },
  {
    icon: '⏱️',
    title: 'Performance Metrics',
    description: 'App startup time and operation durations to optimize performance',
  },
];

/**
 * Privacy commitments to display to the user
 */
const PRIVACY_COMMITMENTS = [
  'We never collect personal information (names, emails, passwords)',
  'Your recordings and scripts are never sent to our servers',
  'All user IDs are anonymized before transmission',
  'You can opt out at any time in Settings',
];

/**
 * ConsentDialog Component
 *
 * Shows on first app launch to request analytics consent.
 * Provides clear information about data collection practices.
 *
 * @requirements 6.1 - Check for user consent before collecting data
 * @requirements 6.2 - Do not send events without consent
 */
export const ConsentDialog: React.FC<ConsentDialogProps> = ({
  isOpen,
  onAccept,
  onDecline,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Handle accept button click
   */
  const handleAccept = useCallback(async () => {
    setIsProcessing(true);
    try {
      await onAccept();
    } finally {
      setIsProcessing(false);
    }
  }, [onAccept]);

  /**
   * Handle decline button click
   */
  const handleDecline = useCallback(async () => {
    setIsProcessing(true);
    try {
      await onDecline();
    } finally {
      setIsProcessing(false);
    }
  }, [onDecline]);

  /**
   * Handle keyboard events for accessibility
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        handleDecline();
      }
    },
    [handleDecline, isProcessing]
  );

  /**
   * Trap focus within dialog for accessibility
   */
  useEffect(() => {
    if (isOpen) {
      // Focus the dialog when it opens
      const dialog = document.querySelector('.consent-dialog') as HTMLElement;
      if (dialog) {
        dialog.focus();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="consent-dialog-overlay"
      data-testid="consent-dialog"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-dialog-title"
      aria-describedby="consent-dialog-description"
    >
      <div className="consent-dialog" tabIndex={-1}>
        {/* Header */}
        <div className="consent-dialog-header">
          <div className="consent-dialog-icon">📈</div>
          <h2 id="consent-dialog-title" className="consent-dialog-title">
            Help Us Improve GeniusQA
          </h2>
        </div>

        {/* Body */}
        <div className="consent-dialog-body">
          <p id="consent-dialog-description" className="consent-dialog-description">
            We'd like to collect anonymous usage data to help improve your experience.
            Your privacy is important to us.
          </p>

          {/* What we collect section */}
          <div className="consent-dialog-section">
            <h3 className="consent-dialog-section-title">What we collect:</h3>
            <ul className="consent-dialog-data-list">
              {DATA_COLLECTION_ITEMS.map((item, index) => (
                <li key={index} className="consent-dialog-data-item">
                  <span className="consent-dialog-data-icon">{item.icon}</span>
                  <div className="consent-dialog-data-content">
                    <span className="consent-dialog-data-title">{item.title}</span>
                    <span className="consent-dialog-data-description">
                      {item.description}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Privacy commitments section */}
          <div className="consent-dialog-section">
            <h3 className="consent-dialog-section-title">Our privacy commitment:</h3>
            <ul className="consent-dialog-privacy-list">
              {PRIVACY_COMMITMENTS.map((commitment, index) => (
                <li key={index} className="consent-dialog-privacy-item">
                  <span className="consent-dialog-check-icon">✓</span>
                  <span>{commitment}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer with actions */}
        <div className="consent-dialog-footer">
          <button
            type="button"
            className="consent-dialog-button decline"
            onClick={handleDecline}
            disabled={isProcessing}
            data-testid="consent-decline-button"
          >
            No Thanks
          </button>
          <button
            type="button"
            className="consent-dialog-button accept"
            onClick={handleAccept}
            disabled={isProcessing}
            data-testid="consent-accept-button"
          >
            {isProcessing ? 'Processing...' : 'Accept & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsentDialog;
