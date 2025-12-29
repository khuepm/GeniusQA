import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import './ErrorRecoveryDialog.css';

interface ErrorRecoveryDialogProps {
  error: {
    type: 'focus_lost' | 'application_closed' | 'permission_denied' | 'connection_error' | 'automation_failed';
    message: string;
    details?: string;
    timestamp: string;
    sessionId?: string;
    applicationName?: string;
  };
  onResolve: () => void;
  onDismiss: () => void;
}

interface RecoveryOption {
  id: string;
  title: string;
  description: string;
  action: () => Promise<void>;
  icon: string;
  type: 'primary' | 'secondary' | 'danger';
}

export const ErrorRecoveryDialog: React.FC<ErrorRecoveryDialogProps> = ({
  error,
  onResolve,
  onDismiss
}) => {
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<string | null>(null);

  const getRecoveryOptions = (): RecoveryOption[] => {
    switch (error.type) {
      case 'focus_lost':
        return [
          {
            id: 'resume_when_focused',
            title: 'Resume When Focused',
            description: `Switch back to ${error.applicationName || 'the target application'} to automatically resume automation`,
            action: async () => {
              setRecoveryStatus('Waiting for application focus...');
              // The automation will resume automatically when focus is regained
              onResolve();
            },
            icon: '🎯',
            type: 'primary'
          },
          {
            id: 'stop_automation',
            title: 'Stop Automation',
            description: 'Stop the current automation session',
            action: async () => {
              await invoke('stop_focused_playback');
              onResolve();
            },
            icon: '⏹️',
            type: 'secondary'
          }
        ];

      case 'application_closed':
        return [
          {
            id: 'restart_application',
            title: 'Restart Application',
            description: `Restart ${error.applicationName || 'the target application'} and resume automation`,
            action: async () => {
              setRecoveryStatus('Please restart the application manually, then click Resume');
              // User needs to manually restart the application
            },
            icon: '🔄',
            type: 'primary'
          },
          {
            id: 'stop_automation',
            title: 'Stop Automation',
            description: 'Stop the current automation session',
            action: async () => {
              await invoke('stop_focused_playback');
              onResolve();
            },
            icon: '⏹️',
            type: 'secondary'
          }
        ];

      case 'permission_denied':
        return [
          {
            id: 'open_settings',
            title: 'Open System Settings',
            description: 'Open system settings to grant required permissions',
            action: async () => {
              await invoke('request_accessibility_permissions');
              setRecoveryStatus('Please grant permissions in System Settings, then restart GeniusQA');
            },
            icon: '⚙️',
            type: 'primary'
          },
          {
            id: 'continue_limited',
            title: 'Continue with Limited Features',
            description: 'Continue with reduced functionality',
            action: async () => {
              onResolve();
            },
            icon: '⚠️',
            type: 'secondary'
          }
        ];

      case 'connection_error':
        return [
          {
            id: 'retry_connection',
            title: 'Retry Connection',
            description: 'Attempt to reconnect to the automation service',
            action: async () => {
              setRecoveryStatus('Reconnecting...');
              try {
                await invoke('restart_service');
                setRecoveryStatus('Connection restored');
                setTimeout(onResolve, 1000);
              } catch (err) {
                setRecoveryStatus(`Failed to reconnect: ${err}`);
              }
            },
            icon: '🔌',
            type: 'primary'
          },
          {
            id: 'restart_app',
            title: 'Restart GeniusQA',
            description: 'Restart the entire application',
            action: async () => {
              setRecoveryStatus('Please restart GeniusQA manually');
            },
            icon: '🔄',
            type: 'secondary'
          }
        ];

      case 'automation_failed':
        return [
          {
            id: 'retry_from_checkpoint',
            title: 'Retry from Last Checkpoint',
            description: 'Resume automation from the last successful step',
            action: async () => {
              setRecoveryStatus('Resuming from checkpoint...');
              try {
                await invoke('resume_focused_playback');
                onResolve();
              } catch (err) {
                setRecoveryStatus(`Failed to resume: ${err}`);
              }
            },
            icon: '↩️',
            type: 'primary'
          },
          {
            id: 'restart_automation',
            title: 'Restart Automation',
            description: 'Start the automation from the beginning',
            action: async () => {
              setRecoveryStatus('Restarting automation...');
              try {
                await invoke('stop_focused_playback');
                // User will need to manually start again
                setRecoveryStatus('Automation stopped. Please start again manually.');
                setTimeout(onResolve, 2000);
              } catch (err) {
                setRecoveryStatus(`Failed to restart: ${err}`);
              }
            },
            icon: '🔄',
            type: 'secondary'
          },
          {
            id: 'stop_automation',
            title: 'Stop Automation',
            description: 'Stop the current automation session',
            action: async () => {
              await invoke('stop_focused_playback');
              onResolve();
            },
            icon: '⏹️',
            type: 'danger'
          }
        ];

      default:
        return [
          {
            id: 'dismiss',
            title: 'Dismiss',
            description: 'Dismiss this error',
            action: async () => {
              onDismiss();
            },
            icon: '✖️',
            type: 'secondary'
          }
        ];
    }
  };

  const handleRecoveryAction = async (option: RecoveryOption) => {
    setIsRecovering(true);
    setRecoveryStatus(null);

    try {
      await option.action();
    } catch (err) {
      setRecoveryStatus(`Recovery failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsRecovering(false);
    }
  };

  const getErrorIcon = () => {
    switch (error.type) {
      case 'focus_lost': return '👁️';
      case 'application_closed': return '📱';
      case 'permission_denied': return '🔒';
      case 'connection_error': return '🔌';
      case 'automation_failed': return '❌';
      default: return '⚠️';
    }
  };

  const getErrorTitle = () => {
    switch (error.type) {
      case 'focus_lost': return 'Application Focus Lost';
      case 'application_closed': return 'Application Closed';
      case 'permission_denied': return 'Permission Required';
      case 'connection_error': return 'Connection Error';
      case 'automation_failed': return 'Automation Failed';
      default: return 'Error Occurred';
    }
  };

  const recoveryOptions = getRecoveryOptions();

  return (
    <div className="error-recovery-dialog-overlay">
      <div className="error-recovery-dialog">
        <div className="error-header">
          <div className="error-icon">{getErrorIcon()}</div>
          <div className="error-info">
            <h3 className="error-title">{getErrorTitle()}</h3>
            <p className="error-message">{error.message}</p>
            {error.details && (
              <details className="error-details">
                <summary>Technical Details</summary>
                <pre>{error.details}</pre>
              </details>
            )}
            <div className="error-timestamp">
              Occurred at: {new Date(error.timestamp).toLocaleString()}
            </div>
          </div>
          <button
            className="close-button"
            onClick={onDismiss}
            title="Close dialog"
          >
            ×
          </button>
        </div>

        {recoveryStatus && (
          <div className="recovery-status">
            <div className="status-icon">ℹ️</div>
            <span>{recoveryStatus}</span>
          </div>
        )}

        <div className="recovery-options">
          <h4>Recovery Options</h4>
          <div className="options-list">
            {recoveryOptions.map((option) => (
              <button
                key={option.id}
                className={`recovery-option ${option.type}`}
                onClick={() => handleRecoveryAction(option)}
                disabled={isRecovering}
              >
                <div className="option-icon">{option.icon}</div>
                <div className="option-content">
                  <div className="option-title">{option.title}</div>
                  <div className="option-description">{option.description}</div>
                </div>
                {isRecovering && (
                  <div className="option-loading">
                    <div className="loading-spinner" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="dialog-footer">
          <button
            className="dismiss-button"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
