import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import './ErrorRecoveryDialog.css';

interface ErrorRecoveryDialogProps {
  error: {
    type: 'focus_lost' | 'application_closed' | 'permission_denied' | 'connection_error' | 'automation_failed' | 'network_error' | 'ipc_error';
    message: string;
    details?: string;
    timestamp: string;
    sessionId?: string;
    applicationName?: string;
    retryCount?: number;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  };
  onResolve: () => void;
  onDismiss: () => void;
  onRetry?: (retryOptions?: any) => Promise<void>;
}

interface RecoveryOption {
  id: string;
  title: string;
  description: string;
  action: () => Promise<void>;
  icon: string;
  type: 'primary' | 'secondary' | 'danger';
  retryable?: boolean;
  estimatedTime?: string;
}

interface RecoveryState {
  isRecovering: boolean;
  recoveryStatus: string | null;
  lastAttempt: number;
  retryCount: number;
  maxRetries: number;
  autoRetryEnabled: boolean;
  nextRetryIn: number;
}

export const ErrorRecoveryDialog: React.FC<ErrorRecoveryDialogProps> = ({
  error,
  onResolve,
  onDismiss,
  onRetry
}) => {
  const [recoveryState, setRecoveryState] = useState<RecoveryState>({
    isRecovering: false,
    recoveryStatus: null,
    lastAttempt: 0,
    retryCount: error.retryCount || 0,
    maxRetries: getMaxRetries(error.type),
    autoRetryEnabled: shouldEnableAutoRetry(error.type),
    nextRetryIn: 0
  });

  const [autoRetryTimer, setAutoRetryTimer] = useState<NodeJS.Timeout | null>(null);
  const [countdownTimer, setCountdownTimer] = useState<NodeJS.Timeout | null>(null);

  // Enhanced error classification
  function getMaxRetries(errorType: string): number {
    switch (errorType) {
      case 'network_error':
      case 'connection_error': return 5;
      case 'ipc_error': return 3;
      case 'automation_failed': return 2;
      case 'focus_lost': return 1;
      default: return 1;
    }
  }

  function shouldEnableAutoRetry(errorType: string): boolean {
    return ['network_error', 'connection_error', 'ipc_error'].includes(errorType);
  }

  function getRetryDelay(retryCount: number): number {
    // Exponential backoff: 2s, 4s, 8s, 16s, 32s
    return Math.min(2000 * Math.pow(2, retryCount), 32000);
  }

  // Auto-retry mechanism
  useEffect(() => {
    if (recoveryState.autoRetryEnabled &&
      recoveryState.retryCount < recoveryState.maxRetries &&
      !recoveryState.isRecovering &&
      error.severity !== 'critical') {

      const delay = getRetryDelay(recoveryState.retryCount);
      setRecoveryState(prev => ({ ...prev, nextRetryIn: delay / 1000 }));

      // Countdown timer
      const countdown = setInterval(() => {
        setRecoveryState(prev => {
          if (prev.nextRetryIn <= 1) {
            clearInterval(countdown);
            return { ...prev, nextRetryIn: 0 };
          }
          return { ...prev, nextRetryIn: prev.nextRetryIn - 1 };
        });
      }, 1000);

      // Auto-retry timer
      const timer = setTimeout(() => {
        handleAutoRetry();
      }, delay);

      setAutoRetryTimer(timer);
      setCountdownTimer(countdown);

      return () => {
        clearTimeout(timer);
        clearInterval(countdown);
      };
    }
  }, [recoveryState.retryCount, recoveryState.autoRetryEnabled, recoveryState.isRecovering]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoRetryTimer) clearTimeout(autoRetryTimer);
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [autoRetryTimer, countdownTimer]);

  const handleAutoRetry = useCallback(async () => {
    if (onRetry) {
      setRecoveryState(prev => ({
        ...prev,
        isRecovering: true,
        recoveryStatus: 'Attempting automatic recovery...',
        retryCount: prev.retryCount + 1,
        lastAttempt: Date.now()
      }));

      try {
        await onRetry({ automatic: true, retryCount: recoveryState.retryCount + 1 });
        setRecoveryState(prev => ({
          ...prev,
          recoveryStatus: 'Recovery successful',
          isRecovering: false
        }));
        setTimeout(onResolve, 1000);
      } catch (err) {
        setRecoveryState(prev => ({
          ...prev,
          recoveryStatus: `Auto-retry failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
          isRecovering: false
        }));
      }
    }
  }, [onRetry, recoveryState.retryCount, onResolve]);

  const getRecoveryOptions = (): RecoveryOption[] => {
    const canRetry = recoveryState.retryCount < recoveryState.maxRetries;

    switch (error.type) {
      case 'focus_lost':
        return [
          {
            id: 'resume_when_focused',
            title: 'Resume When Focused',
            description: `Switch back to ${error.applicationName || 'the target application'} to automatically resume automation`,
            action: async () => {
              setRecoveryState(prev => ({ ...prev, recoveryStatus: 'Waiting for application focus...' }));
              onResolve();
            },
            icon: '🎯',
            type: 'primary',
            estimatedTime: 'Immediate'
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
            type: 'secondary',
            estimatedTime: '< 1s'
          }
        ];

      case 'application_closed':
        return [
          {
            id: 'wait_for_restart',
            title: 'Wait for Application Restart',
            description: `Wait for ${error.applicationName || 'the target application'} to be restarted`,
            action: async () => {
              setRecoveryState(prev => ({ ...prev, recoveryStatus: 'Waiting for application to restart...' }));
              // Monitor for application restart
              const checkInterval = setInterval(async () => {
                try {
                  const isRunning = await invoke('check_application_running', {
                    appName: error.applicationName
                  });
                  if (isRunning) {
                    clearInterval(checkInterval);
                    setRecoveryState(prev => ({ ...prev, recoveryStatus: 'Application detected, resuming...' }));
                    setTimeout(onResolve, 1000);
                  }
                } catch (e) {
                  // Continue waiting
                }
              }, 2000);
            },
            icon: '🔄',
            type: 'primary',
            retryable: true,
            estimatedTime: 'Variable'
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
            type: 'secondary',
            estimatedTime: '< 1s'
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
              setRecoveryState(prev => ({
                ...prev,
                recoveryStatus: 'Please grant permissions in System Settings, then click "Check Permissions"'
              }));
            },
            icon: '⚙️',
            type: 'primary',
            estimatedTime: '1-2 min'
          },
          {
            id: 'check_permissions',
            title: 'Check Permissions',
            description: 'Verify that permissions have been granted',
            action: async () => {
              setRecoveryState(prev => ({ ...prev, isRecovering: true, recoveryStatus: 'Checking permissions...' }));
              try {
                const hasPermissions = await invoke('check_accessibility_permissions');
                if (hasPermissions) {
                  setRecoveryState(prev => ({ ...prev, recoveryStatus: 'Permissions granted successfully' }));
                  setTimeout(onResolve, 1000);
                } else {
                  setRecoveryState(prev => ({
                    ...prev,
                    recoveryStatus: 'Permissions still not granted. Please check System Settings.'
                  }));
                }
              } catch (err) {
                setRecoveryState(prev => ({
                  ...prev,
                  recoveryStatus: `Permission check failed: ${err}`
                }));
              } finally {
                setRecoveryState(prev => ({ ...prev, isRecovering: false }));
              }
            },
            icon: '✅',
            type: 'secondary',
            retryable: true,
            estimatedTime: '< 5s'
          }
        ];

      case 'connection_error':
      case 'network_error':
        return [
          {
            id: 'retry_connection',
            title: 'Retry Connection',
            description: 'Attempt to reconnect to the service',
            action: async () => {
              setRecoveryState(prev => ({
                ...prev,
                isRecovering: true,
                recoveryStatus: 'Reconnecting...',
                retryCount: prev.retryCount + 1
              }));
              try {
                await invoke('restart_service');
                setRecoveryState(prev => ({ ...prev, recoveryStatus: 'Connection restored' }));
                setTimeout(onResolve, 1000);
              } catch (err) {
                setRecoveryState(prev => ({
                  ...prev,
                  recoveryStatus: `Failed to reconnect: ${err}`
                }));
              } finally {
                setRecoveryState(prev => ({ ...prev, isRecovering: false }));
              }
            },
            icon: '🔌',
            type: 'primary',
            retryable: canRetry,
            estimatedTime: '5-10s'
          },
          {
            id: 'check_network',
            title: 'Check Network',
            description: 'Verify network connectivity',
            action: async () => {
              setRecoveryState(prev => ({ ...prev, isRecovering: true, recoveryStatus: 'Checking network...' }));
              try {
                const isOnline = await invoke('check_network_connectivity');
                setRecoveryState(prev => ({
                  ...prev,
                  recoveryStatus: isOnline ? 'Network is available' : 'Network connectivity issues detected'
                }));
              } catch (err) {
                setRecoveryState(prev => ({
                  ...prev,
                  recoveryStatus: `Network check failed: ${err}`
                }));
              } finally {
                setRecoveryState(prev => ({ ...prev, isRecovering: false }));
              }
            },
            icon: '🌐',
            type: 'secondary',
            estimatedTime: '< 5s'
          }
        ];

      case 'ipc_error':
        return [
          {
            id: 'restart_ipc',
            title: 'Restart IPC Connection',
            description: 'Restart the inter-process communication',
            action: async () => {
              setRecoveryState(prev => ({
                ...prev,
                isRecovering: true,
                recoveryStatus: 'Restarting IPC...',
                retryCount: prev.retryCount + 1
              }));
              try {
                await invoke('restart_ipc_connection');
                setRecoveryState(prev => ({ ...prev, recoveryStatus: 'IPC connection restored' }));
                setTimeout(onResolve, 1000);
              } catch (err) {
                setRecoveryState(prev => ({
                  ...prev,
                  recoveryStatus: `IPC restart failed: ${err}`
                }));
              } finally {
                setRecoveryState(prev => ({ ...prev, isRecovering: false }));
              }
            },
            icon: '🔄',
            type: 'primary',
            retryable: canRetry,
            estimatedTime: '3-5s'
          }
        ];

      case 'automation_failed':
        return [
          {
            id: 'retry_from_checkpoint',
            title: 'Retry from Last Checkpoint',
            description: 'Resume automation from the last successful step',
            action: async () => {
              setRecoveryState(prev => ({
                ...prev,
                isRecovering: true,
                recoveryStatus: 'Resuming from checkpoint...',
                retryCount: prev.retryCount + 1
              }));
              try {
                await invoke('resume_focused_playback');
                onResolve();
              } catch (err) {
                setRecoveryState(prev => ({
                  ...prev,
                  recoveryStatus: `Failed to resume: ${err}`
                }));
              } finally {
                setRecoveryState(prev => ({ ...prev, isRecovering: false }));
              }
            },
            icon: '↩️',
            type: 'primary',
            retryable: canRetry,
            estimatedTime: '2-5s'
          },
          {
            id: 'restart_automation',
            title: 'Restart Automation',
            description: 'Start the automation from the beginning',
            action: async () => {
              setRecoveryState(prev => ({ ...prev, isRecovering: true, recoveryStatus: 'Restarting automation...' }));
              try {
                await invoke('stop_focused_playback');
                setRecoveryState(prev => ({
                  ...prev,
                  recoveryStatus: 'Automation stopped. Please start again manually.'
                }));
                setTimeout(onResolve, 2000);
              } catch (err) {
                setRecoveryState(prev => ({
                  ...prev,
                  recoveryStatus: `Failed to restart: ${err}`
                }));
              } finally {
                setRecoveryState(prev => ({ ...prev, isRecovering: false }));
              }
            },
            icon: '🔄',
            type: 'secondary',
            estimatedTime: '< 3s'
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
            type: 'danger',
            estimatedTime: '< 1s'
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
            type: 'secondary',
            estimatedTime: 'Immediate'
          }
        ];
    }
  };

  const handleRecoveryAction = async (option: RecoveryOption) => {
    // Cancel auto-retry if user takes manual action
    if (autoRetryTimer) {
      clearTimeout(autoRetryTimer);
      setAutoRetryTimer(null);
    }
    if (countdownTimer) {
      clearInterval(countdownTimer);
      setCountdownTimer(null);
    }

    setRecoveryState(prev => ({
      ...prev,
      isRecovering: true,
      recoveryStatus: null,
      autoRetryEnabled: false,
      nextRetryIn: 0
    }));

    try {
      await option.action();
    } catch (err) {
      setRecoveryState(prev => ({
        ...prev,
        recoveryStatus: `Recovery failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      }));
    } finally {
      setRecoveryState(prev => ({ ...prev, isRecovering: false }));
    }
  };

  const toggleAutoRetry = () => {
    setRecoveryState(prev => ({
      ...prev,
      autoRetryEnabled: !prev.autoRetryEnabled
    }));
  };

  const getErrorIcon = () => {
    switch (error.type) {
      case 'focus_lost': return '👁️';
      case 'application_closed': return '📱';
      case 'permission_denied': return '🔒';
      case 'connection_error': return '🔌';
      case 'network_error': return '🌐';
      case 'ipc_error': return '⚡';
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
      case 'network_error': return 'Network Error';
      case 'ipc_error': return 'Communication Error';
      case 'automation_failed': return 'Automation Failed';
      default: return 'Error Occurred';
    }
  };

  const getSeverityClass = () => {
    return `error-recovery-dialog-${error.severity || 'medium'}`;
  };

  const recoveryOptions = getRecoveryOptions();

  return (
    <div className="error-recovery-dialog-overlay">
      <div className={`error-recovery-dialog ${getSeverityClass()}`}>
        <div className="error-header">
          <div className="error-icon">{getErrorIcon()}</div>
          <div className="error-info">
            <h3 className="error-title">{getErrorTitle()}</h3>
            <div className="error-metadata">
              <span className="error-type">Type: {error.type}</span>
              <span className="error-severity">Severity: {error.severity || 'medium'}</span>
              {recoveryState.retryCount > 0 && (
                <span className="error-retry-count">
                  Retry: {recoveryState.retryCount}/{recoveryState.maxRetries}
                </span>
              )}
            </div>
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

        {/* Auto-retry status */}
        {recoveryState.autoRetryEnabled && recoveryState.nextRetryIn > 0 && (
          <div className="auto-retry-status">
            <div className="auto-retry-info">
              <span>Auto-retry in {recoveryState.nextRetryIn}s</span>
              <button
                className="cancel-auto-retry"
                onClick={toggleAutoRetry}
              >
                Cancel
              </button>
            </div>
            <div className="auto-retry-progress">
              <div
                className="progress-bar"
                style={{
                  width: `${((getRetryDelay(recoveryState.retryCount) / 1000 - recoveryState.nextRetryIn) / (getRetryDelay(recoveryState.retryCount) / 1000)) * 100}%`
                }}
              />
            </div>
          </div>
        )}

        {/* Recovery status */}
        {recoveryState.recoveryStatus && (
          <div className="recovery-status">
            <div className="status-icon">
              {recoveryState.isRecovering ? (
                <div className="loading-spinner" />
              ) : (
                'ℹ️'
              )}
            </div>
            <span>{recoveryState.recoveryStatus}</span>
          </div>
        )}

        {/* Recovery options */}
        <div className="recovery-options">
          <div className="options-header">
            <h4>Recovery Options</h4>
            {recoveryState.autoRetryEnabled && (
              <div className="auto-retry-toggle">
                <label>
                  <input
                    type="checkbox"
                    checked={recoveryState.autoRetryEnabled}
                    onChange={toggleAutoRetry}
                  />
                  Auto-retry
                </label>
              </div>
            )}
          </div>
          <div className="options-list">
            {recoveryOptions.map((option) => (
              <button
                key={option.id}
                className={`recovery-option ${option.type} ${(!option.retryable && recoveryState.retryCount >= recoveryState.maxRetries) ? 'disabled' : ''}`}
                onClick={() => handleRecoveryAction(option)}
                disabled={recoveryState.isRecovering || (!option.retryable && recoveryState.retryCount >= recoveryState.maxRetries)}
              >
                <div className="option-icon">{option.icon}</div>
                <div className="option-content">
                  <div className="option-title">{option.title}</div>
                  <div className="option-description">{option.description}</div>
                  {option.estimatedTime && (
                    <div className="option-time">Est. time: {option.estimatedTime}</div>
                  )}
                </div>
                {recoveryState.isRecovering && (
                  <div className="option-loading">
                    <div className="loading-spinner" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="dialog-footer">
          <div className="footer-info">
            {recoveryState.retryCount >= recoveryState.maxRetries && (
              <span className="max-retries-warning">
                Maximum retry attempts reached
              </span>
            )}
          </div>
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
