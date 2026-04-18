import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { NotificationData } from '../types/applicationFocusedAutomation.types';
import './NotificationArea.css';

interface NotificationAreaProps {
  notifications: NotificationData[];
  onDismissNotification: (notificationId: string) => void;
}

export const NotificationArea: React.FC<NotificationAreaProps> = ({
  notifications,
  onDismissNotification,
}) => {
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const getNotificationIcon = (type: NotificationData['type']): string => {
    switch (type) {
      case 'focus_lost':
        return '⚠️';
      case 'focus_gained':
        return '✅';
      case 'automation_paused':
        return '⏸️';
      case 'automation_resumed':
        return '▶️';
      case 'error':
        return '❌';
      default:
        return 'ℹ️';
    }
  };

  const getNotificationClass = (type: NotificationData['type']): string => {
    switch (type) {
      case 'focus_lost':
      case 'automation_paused':
        return 'warning';
      case 'focus_gained':
      case 'automation_resumed':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'info';
    }
  };

  const getNotificationPriority = (type: NotificationData['type']): number => {
    switch (type) {
      case 'error':
        return 1; // Highest priority
      case 'focus_lost':
      case 'automation_paused':
        return 2;
      case 'focus_gained':
      case 'automation_resumed':
        return 3;
      default:
        return 4; // Lowest priority
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `${minutes}m ago`;
    } else {
      return date.toLocaleTimeString();
    }
  };

  const getRecoveryActions = (notification: NotificationData): Array<{
    label: string;
    action: () => Promise<void>;
    icon: string;
  }> => {
    const actions: Array<{ label: string; action: () => Promise<void>; icon: string }> = [];

    if (notification.type === 'focus_lost' && notification.application_name) {
      actions.push({
        label: 'Focus Application',
        icon: '🎯',
        action: async () => {
          try {
            await invoke('bring_application_to_focus_by_name', {
              appName: notification.application_name
            });
          } catch (err) {
            console.error('Failed to focus application:', err);
          }
        }
      });
    }

    if (notification.type === 'error') {
      actions.push({
        label: 'Retry Operation',
        icon: '🔄',
        action: async () => {
          try {
            await invoke('retry_last_operation');
          } catch (err) {
            console.error('Failed to retry operation:', err);
          }
        }
      });

      actions.push({
        label: 'Reset Session',
        icon: '↩️',
        action: async () => {
          try {
            await invoke('reset_to_last_checkpoint');
          } catch (err) {
            console.error('Failed to reset session:', err);
          }
        }
      });
    }

    if (notification.type === 'automation_paused') {
      actions.push({
        label: 'Resume Automation',
        icon: '▶️',
        action: async () => {
          try {
            await invoke('resume_focused_playback');
          } catch (err) {
            console.error('Failed to resume automation:', err);
          }
        }
      });
    }

    return actions;
  };

  const handleNotificationClick = async (notification: NotificationData) => {
    // Auto-execute primary action for certain notification types
    const actions = getRecoveryActions(notification);
    if (actions.length > 0) {
      const primaryAction = actions[0];
      await handleActionClick(notification.id, primaryAction.action);
    }
  };

  const handleActionClick = async (notificationId: string, action: () => Promise<void>) => {
    try {
      setActionInProgress(notificationId);
      await action();
      // Dismiss notification after successful action
      setTimeout(() => {
        onDismissNotification(notificationId);
      }, 1000);
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  // Sort notifications by priority and timestamp
  const sortedNotifications = [...notifications].sort((a, b) => {
    const priorityDiff = getNotificationPriority(a.type) - getNotificationPriority(b.type);
    if (priorityDiff !== 0) return priorityDiff;

    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  if (notifications.length === 0) {
    return (
      <div className="notification-area empty">
        <div className="empty-state">
          <div className="empty-icon">🔔</div>
          <p>No notifications</p>
          <span className="empty-hint">Status updates will appear here</span>
        </div>
      </div>
    );
  }

  return (
    <div className="notification-area">
      <div className="notification-header">
        <h4>Status Notifications</h4>
        <div className="notification-summary">
          <span className="notification-count">{notifications.length}</span>
          {notifications.some(n => n.type === 'error') && (
            <span className="error-indicator">⚠️</span>
          )}
        </div>
      </div>

      <div className="notifications-list">
        {sortedNotifications.map((notification) => {
          const recoveryActions = getRecoveryActions(notification);
          const isActionInProgress = actionInProgress === notification.id;

          return (
            <div
              key={notification.id}
              className={`notification ${getNotificationClass(notification.type)} ${recoveryActions.length > 0 ? 'actionable' : ''
                }`}
              onClick={() => recoveryActions.length === 0 ? undefined : handleNotificationClick(notification)}
            >
              <div className="notification-content">
                <div className="notification-header-row">
                  <span className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </span>
                  <span className="notification-title">{notification.title}</span>
                  <span className="notification-time">
                    {formatTimestamp(notification.timestamp)}
                  </span>
                  <button
                    className="dismiss-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismissNotification(notification.id);
                    }}
                    title="Dismiss notification"
                  >
                    ×
                  </button>
                </div>

                <div className="notification-message">
                  {notification.message}
                </div>

                {notification.application_name && (
                  <div className="notification-app">
                    Application: {notification.application_name}
                  </div>
                )}

                {recoveryActions.length > 0 && (
                  <div className="notification-actions">
                    {recoveryActions.map((action, index) => (
                      <button
                        key={index}
                        className={`action-button ${isActionInProgress ? 'loading' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleActionClick(notification.id, action.action);
                        }}
                        disabled={isActionInProgress}
                        title={action.label}
                      >
                        {isActionInProgress ? '⏳' : action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {recoveryActions.length > 0 && !isActionInProgress && (
                <div className="notification-hint">
                  <span className="hint-text">Click for quick actions</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="notification-footer">
        <button
          className="clear-all-button"
          onClick={() => {
            notifications.forEach(n => onDismissNotification(n.id));
          }}
        >
          Clear All ({notifications.length})
        </button>
        <div className="footer-info">
          <span className="info-text">Real-time status updates</span>
        </div>
      </div>
    </div>
  );
};
