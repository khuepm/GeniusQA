/**
 * Onboarding Wizard Component for Application-Focused Automation
 * 
 * Provides step-by-step guidance for first-time users including:
 * - Welcome and feature introduction
 * - Platform-specific permission setup
 * - Initial configuration
 * 
 * Requirements: Task 18.1 - Feature onboarding flow
 */

import React, { useState, useEffect } from 'react';
import { onboardingService, OnboardingStep, PermissionStatus } from '../services/onboardingService';
import { OnboardingWelcome } from './onboarding/OnboardingWelcome';
import { OnboardingPermissions } from './onboarding/OnboardingPermissions';
import { OnboardingSetup } from './onboarding/OnboardingSetup';
import { OnboardingComplete } from './onboarding/OnboardingComplete';
import './OnboardingWizard.css';

interface OnboardingWizardProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip?: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onComplete,
  onSkip,
}) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep | null>(null);
  const [allSteps, setAllSteps] = useState<OnboardingStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);

  useEffect(() => {
    if (isOpen) {
      initializeOnboarding();
    }
  }, [isOpen]);

  const initializeOnboarding = async () => {
    try {
      setIsLoading(true);

      // Initialize the onboarding service
      await onboardingService.initialize();

      // Get steps and current step
      const steps = onboardingService.getOnboardingSteps();
      const current = onboardingService.getCurrentStep();

      setAllSteps(steps);
      setCurrentStep(current);

      // Check permissions if we're on a permissions step
      if (current?.component === 'permissions') {
        const status = await onboardingService.checkPermissions();
        setPermissionStatus(status);
      }
    } catch (error) {
      console.error('Failed to initialize onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStepComplete = async (stepId: string) => {
    try {
      // Mark step as completed
      onboardingService.completeStep(stepId);

      // Get next step
      const nextStep = onboardingService.getCurrentStep();
      setCurrentStep(nextStep);

      // If no more steps, complete onboarding
      if (!nextStep) {
        onComplete();
        return;
      }

      // Check permissions for permissions step
      if (nextStep.component === 'permissions') {
        const status = await onboardingService.checkPermissions();
        setPermissionStatus(status);
      }
    } catch (error) {
      console.error('Failed to complete step:', error);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
    onboardingService.skipOnboarding();
    onComplete();
  };

  const handlePermissionRecheck = async () => {
    try {
      const status = await onboardingService.checkPermissions();
      setPermissionStatus(status);

      // If permissions are now granted, auto-complete the permissions step
      if (status.isGranted && currentStep?.component === 'permissions') {
        handleStepComplete(currentStep.id);
      }
    } catch (error) {
      console.error('Failed to recheck permissions:', error);
    }
  };

  const getCurrentStepIndex = (): number => {
    if (!currentStep) return 0;
    return allSteps.findIndex(step => step.id === currentStep.id);
  };

  const renderStepContent = () => {
    if (!currentStep) return null;

    switch (currentStep.component) {
      case 'welcome':
        return (
          <OnboardingWelcome
            step={currentStep}
            onNext={() => handleStepComplete(currentStep.id)}
            onSkip={handleSkip}
          />
        );

      case 'permissions':
        return (
          <OnboardingPermissions
            step={currentStep}
            permissionStatus={permissionStatus}
            onNext={() => handleStepComplete(currentStep.id)}
            onRecheck={handlePermissionRecheck}
            onSkip={handleSkip}
          />
        );

      case 'setup':
        return (
          <OnboardingSetup
            step={currentStep}
            onNext={() => handleStepComplete(currentStep.id)}
            onSkip={() => handleStepComplete(currentStep.id)} // Setup is optional
          />
        );

      case 'complete':
        return (
          <OnboardingComplete
            step={currentStep}
            onFinish={() => handleStepComplete(currentStep.id)}
          />
        );

      default:
        return <div>Unknown step type</div>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-wizard">
        {isLoading ? (
          <div className="onboarding-loading">
            <div className="loading-spinner" />
            <p>Initializing setup wizard...</p>
          </div>
        ) : (
          <>
            {/* Progress indicator */}
            <div className="onboarding-progress">
              <div className="progress-steps">
                {allSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`progress-step ${index <= getCurrentStepIndex() ? 'active' : ''
                      } ${index < getCurrentStepIndex() ? 'completed' : ''}`}
                  >
                    <div className="step-number">
                      {index < getCurrentStepIndex() ? '✓' : index + 1}
                    </div>
                    <div className="step-label">{step.title}</div>
                  </div>
                ))}
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${((getCurrentStepIndex() + 1) / allSteps.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Step content */}
            <div className="onboarding-content">
              {renderStepContent()}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
