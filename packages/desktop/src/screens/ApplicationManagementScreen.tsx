import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/tauri';
import { ApplicationList } from '../components/ApplicationList';
import { AddApplicationModal } from '../components/AddApplicationModal';
import { OnboardingWizard } from '../components/OnboardingWizard';
import { onboardingService } from '../services/onboardingService';
import { RegisteredApplication, ApplicationInfo } from '../types/applicationFocusedAutomation.types';
import './ApplicationManagementScreen.css';

export const ApplicationManagementScreen: React.FC = () => {
  const [registeredApps, setRegisteredApps] = useState<RegisteredApplication[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    try {
      // Initialize onboarding service
      await onboardingService.initialize();

      // Check if onboarding is needed
      if (onboardingService.isOnboardingNeeded()) {
        setShowOnboarding(true);
        setIsLoading(false);
        return;
      }

      // Load applications if onboarding is complete
      await loadRegisteredApplications();
    } catch (error) {
      console.error('Failed to initialize screen:', error);
      setError('Failed to initialize application management');
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    await loadRegisteredApplications();
  };

  const handleOnboardingSkip = async () => {
    setShowOnboarding(false);
    await loadRegisteredApplications();
  };

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
      const errorMessage = err instanceof Error ? err.message : 'Failed to add application';
      setError(errorMessage);
      throw err; // Re-throw so the modal knows it failed
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
      {/* Onboarding Wizard */}
      <OnboardingWizard
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />

      <div className="header-container">
        <button
          className="back-button"
          onClick={() => navigate('/dashboard')}
          title="Back to Dashboard"
        >
          ←
        </button>
        <div className="header-content">
          <h1>Application Management</h1>
          <p>Manage applications for focused automation</p>
        </div>
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
