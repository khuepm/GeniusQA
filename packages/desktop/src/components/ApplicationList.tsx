import React from 'react';
import { ApplicationCard } from './ApplicationCard';
import { RegisteredApplication } from '../types/applicationFocusedAutomation.types';
import './ApplicationList.css';

interface ApplicationListProps {
  applications: RegisteredApplication[];
  onRemoveApplication: (appId: string) => void;
  onRefreshStatus: () => void;
}

export const ApplicationList: React.FC<ApplicationListProps> = ({
  applications,
  onRemoveApplication,
  onRefreshStatus,
}) => {
  if (applications.length === 0) {
    return (
      <div className="application-list-empty">
        <div className="empty-state">
          <div className="empty-icon">📱</div>
          <h3>No Applications Registered</h3>
          <p>Add applications to enable focused automation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="application-list">
      <div className="list-header">
        <span className="app-count">{applications.length} application{applications.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="applications-grid">
        {applications.map((app) => (
          <ApplicationCard
            key={app.id}
            application={app}
            onRemove={() => onRemoveApplication(app.id)}
            onRefreshStatus={onRefreshStatus}
          />
        ))}
      </div>
    </div>
  );
};
