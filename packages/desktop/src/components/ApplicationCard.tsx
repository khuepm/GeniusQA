import React from 'react';
import { RegisteredApplication, ApplicationStatus, FocusLossStrategy } from '../types/applicationFocusedAutomation.types';
import './ApplicationCard.css';

interface ApplicationCardProps {
  application: RegisteredApplication;
  onRemove: () => void;
  onRefreshStatus: () => void;
}

export const ApplicationCard: React.FC<ApplicationCardProps> = ({
  application,
  onRemove,
  onRefreshStatus,
}) => {
  const getStatusIcon = (status: ApplicationStatus): string => {
    switch (status) {
      case ApplicationStatus.Active:
        return '🟢';
      case ApplicationStatus.Inactive:
        return '🟡';
      case ApplicationStatus.NotFound:
        return '🔴';
      case ApplicationStatus.Error:
        return '❌';
      case ApplicationStatus.PermissionDenied:
        return '🔒';
      case ApplicationStatus.SecureInputBlocked:
        return '🛡️';
      default:
        return '❓';
    }
  };

  const getStatusColor = (status: ApplicationStatus): string => {
    switch (status) {
      case ApplicationStatus.Active:
        return 'status-active';
      case ApplicationStatus.Inactive:
        return 'status-inactive';
      case ApplicationStatus.NotFound:
      case ApplicationStatus.Error:
        return 'status-error';
      case ApplicationStatus.PermissionDenied:
      case ApplicationStatus.SecureInputBlocked:
        return 'status-warning';
      default:
        return 'status-unknown';
    }
  };

  const getFocusStrategyLabel = (strategy: FocusLossStrategy): string => {
    switch (strategy) {
      case FocusLossStrategy.AutoPause:
        return 'Auto Pause';
      case FocusLossStrategy.StrictError:
        return 'Strict Error';
      case FocusLossStrategy.Ignore:
        return 'Ignore';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  return (
    <div className="application-card">
      <div className="card-header">
        <div className="app-info">
          <h3 className="app-name">{application.name}</h3>
          <p className="app-process">{application.process_name}</p>
        </div>
        <div className={`status-indicator ${getStatusColor(application.status)}`}>
          <span className="status-icon">{getStatusIcon(application.status)}</span>
          <span className="status-text">{application.status}</span>
        </div>
      </div>

      <div className="card-body">
        <div className="app-details">
          <div className="detail-row">
            <span className="detail-label">Executable:</span>
            <span className="detail-value" title={application.executable_path}>
              {application.executable_path.split('/').pop() || application.executable_path}
            </span>
          </div>

          {application.bundle_id && (
            <div className="detail-row">
              <span className="detail-label">Bundle ID:</span>
              <span className="detail-value">{application.bundle_id}</span>
            </div>
          )}

          {application.process_id && (
            <div className="detail-row">
              <span className="detail-label">Process ID:</span>
              <span className="detail-value">{application.process_id}</span>
            </div>
          )}

          <div className="detail-row">
            <span className="detail-label">Focus Strategy:</span>
            <span className="detail-value focus-strategy">
              {getFocusStrategyLabel(application.default_focus_strategy)}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Registered:</span>
            <span className="detail-value">{formatDate(application.registered_at)}</span>
          </div>

          {application.last_seen && (
            <div className="detail-row">
              <span className="detail-label">Last Seen:</span>
              <span className="detail-value">{formatDate(application.last_seen)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card-actions">
        <button
          className="action-button refresh"
          onClick={onRefreshStatus}
          title="Refresh application status"
        >
          🔄
        </button>
        <button
          className="action-button remove"
          onClick={onRemove}
          title="Remove application"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};
