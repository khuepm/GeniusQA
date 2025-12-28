import React from 'react';
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

  const handleNotificationClick = async (notification: NotificationData) => {
    if (notification.type === 'focus_lost' && notification.application_name) {
      try {
        // Note: There's no direct "bring_application_to_focus_by_name" command
        // We would need to find the application by name first, then focus it
        console.log('Attempting to focus application:', notification.application_name);

        // In a full implementation, this would:
        // 1. Get registered applications
        // 2. Find the one matching the name
        // 3. Use platform-specific focus commands
      } catch (err) {
        console.error('Failed to bring application to focus:', err);
      }
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-area">
      <div className="notification-header">
        <h4>Notifications</h4>
        <span className="notification-count">{notifications.length}</span>
      </div>

      <div className="notifications-list">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`notification ${getNotificationClass(notification.type)}`}
            onClick={() => handleNotificationClick(notification)}
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
            </div>

            {notification.type === 'focus_lost' && (
              <div className="notification-action">
                <span className="action-hint">Click to focus application</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="notification-footer">
        <button
          className="clear-all-button"
          onClick={() => {
            notifications.forEach(n => onDismissNotification(n.id));
          }}
        >
          Clear All
        </button>
      </div>
    </div>
  );
};
