/**
 * Onboarding Welcome Step Component
 * 
 * Introduces users to the application-focused automation feature
 * and explains the key benefits and capabilities.
 * 
 * Requirements: Task 18.1 - Feature onboarding flow
 */

import React from 'react';
import { OnboardingStep } from '../../services/onboardingService';

interface OnboardingWelcomeProps {
  step: OnboardingStep;
  onNext: () => void;
  onSkip: () => void;
}

export const OnboardingWelcome: React.FC<OnboardingWelcomeProps> = ({
  step,
  onNext,
  onSkip,
}) => {
  return (
    <div className="onboarding-step">
      <div className="step-header">
        <h2 className="step-title">{step.title}</h2>
        <p className="step-description">{step.description}</p>
      </div>

      <div className="step-body">
        <div className="feature-highlights">
          <div className="feature-item">
            <span className="feature-icon">🎯</span>
            <h3 className="feature-title">Focus-Aware Automation</h3>
            <p className="feature-description">
              Automation runs only when your target application is in focus,
              preventing interference with other apps.
            </p>
          </div>

          <div className="feature-item">
            <span className="feature-icon">⚙️</span>
            <h3 className="feature-title">Flexible Control</h3>
            <p className="feature-description">
              Choose how automation behaves when focus is lost: pause,
              stop with error, or continue with warnings.
            </p>
          </div>

          <div className="feature-item">
            <span className="feature-icon">🔒</span>
            <h3 className="feature-title">Application Isolation</h3>
            <p className="feature-description">
              Actions are constrained to registered applications,
              ensuring automation stays within intended boundaries.
            </p>
          </div>
        </div>

        <div className="welcome-content">
          <h3 style={{ textAlign: 'center', marginBottom: '20px', color: '#495057' }}>
            How It Works
          </h3>

          <div style={{
            background: '#f8f9fa',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <ol style={{ margin: 0, paddingLeft: '20px', color: '#495057' }}>
              <li style={{ marginBottom: '12px' }}>
                <strong>Register Applications:</strong> Add the applications you want to automate
              </li>
              <li style={{ marginBottom: '12px' }}>
                <strong>Configure Focus Strategy:</strong> Choose how automation responds to focus changes
              </li>
              <li style={{ marginBottom: '12px' }}>
                <strong>Run Automation:</strong> Scripts automatically pause/resume based on application focus
              </li>
              <li style={{ marginBottom: '12px' }}>
                <strong>Stay in Control:</strong> Get notifications and maintain full control over automation
              </li>
            </ol>
          </div>

          <div style={{
            textAlign: 'center',
            padding: '15px',
            background: '#e3f2fd',
            borderRadius: '6px',
            border: '1px solid #2196f3'
          }}>
            <p style={{
              margin: 0,
              color: '#1565c0',
              fontWeight: '500',
              fontSize: '14px'
            }}>
              💡 This setup wizard will guide you through the initial configuration
              and help you get started with application-focused automation.
            </p>
          </div>
        </div>
      </div>

      <div className="step-actions">
        <button className="btn btn-outline" onClick={onSkip}>
          Skip Setup
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          Get Started
        </button>
      </div>
    </div>
  );
};
