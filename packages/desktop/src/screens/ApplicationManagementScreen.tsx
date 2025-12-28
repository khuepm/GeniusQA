import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { ApplicationList } from '../components/ApplicationList';
import { AddApplicationModal } from '../components/AddApplicationModal';
import { RegisteredApplication, ApplicationInfo } from '../types/applicationFocusedAutomation.types';
import './ApplicationManagementScreen.css';

export const ApplicationManagementScreen: React.FC = () => {
  const [registeredApps, setRegisteredApps] = useState<RegisteredApplication[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRegisteredApplications();
  }, []);

  const loadRegisteredApplications = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const apps = await invoke<RegisteredApplication[]>('get_registered_applications');
      setRegisteredApps(apps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddApplication = async (appInfo: ApplicationInfo) => {
    try {
      setError(null);
      const appId = await invoke<string>('register_application', {
        appInfo,
        defaultFocusStrategy: null // Use service default
      });

      // Reload the applications list to get the updated data
      await loadRegisteredApplications();
      setIsAddModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add application');
    }
  };

  const handleRemoveApplication = async (appId: string) => {
    try {
      setError(null);
      await invoke('unregister_application', { appId });
      setRegisteredApps(prev => prev.filter(app => app.id !== appId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove application');
    }
  };

  const handleRefreshStatus = async () => {
    await loadRegisteredApplications();
  };

  if (isLoading) {
    return (
      <div className="application-management-screen">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="application-management-screen">
      <div className="header">
        <h1>Application Management</h1>
        <p>Manage applications for focused automation</p>
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

      <div className="actions-bar">
        <button
          className="add-app-button primary"
          onClick={() => setIsAddModalOpen(true)}
        >
          + Add Application
        </button>
        <button
          className="refresh-button secondary"
          onClick={handleRefreshStatus}
        >
          🔄 Refresh Status
        </button>
      </div>

      <ApplicationList
        applications={registeredApps}
        onRemoveApplication={handleRemoveApplication}
        onRefreshStatus={handleRefreshStatus}
      />

      {isAddModalOpen && (
        <AddApplicationModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAddApplication={handleAddApplication}
        />
      )}
    </div>
  );
};
