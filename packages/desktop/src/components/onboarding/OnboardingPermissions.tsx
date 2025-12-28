/**
 * Onboarding Permissions Step Component
 * 
 * Guides users through platform-specific permission setup,
 * with special focus on macOS accessibility permissions.
 * 
 * Requirements: Task 18.1 - Feature onboarding flow
 */

import React, { useState } from 'react';
import { OnboardingStep, PermissionStatus, onboardingService } from '../../services/onboardingService';

interface OnboardingPermissionsProps {
  step: OnboardingStep;
  permissionStatus: PermissionStatus | null;
  onNext: () => void;
  onRecheck: () => void;
  onSkip: () => void;
}

export const OnboardingPermissions: React.FC<OnboardingPermissionsProps> = ({
  step,
  permissionStatus,
  onNext,
  onRecheck,
  onSkip,
}) => {
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(false);

  const handleOpenSettings = async () => {
    try {
      await onboardingService.openPermissionSettings();
    } catch (error) {
      console.error('Failed to open permission settings:', error);
    }
  };

  const handleRecheckPermissions = async () => {
    setIsCheckingPermissions(true);
    try {
      await onRecheck();
    } finally {
      setIsCheckingPermissions(false);
    }
  };

  const canProceed = permissionStatus?.isGranted || !permissionStatus?.isRequired;

  return (
    <div className="onboarding-step">
      <div className="step-header">
        <h2 className="step-title">{step.title}</h2>
        <p className="step-description">{step.description}</p>
      </div>

      <div className="step-body">
        {/* Platform guidance */}
        <div style={{
          background: '#f8f9fa',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          border: '1px solid #dee2e6'
        }}>
          <h4 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#212529',
            marginBottom: '10px'
          }}>
            Why Permissions Are Needed
          </h4>
          <p style={{
            margin: 0,
            color: '#495057',
            lineHeight: '1.5',
            fontSize: '14px'
          }}>
            {onboardingService.getPlatformGuidance()}
          </p>
        </div>

        {/* Permission status */}
        {permissionStatus && (
          <div className={`permission-status ${permissionStatus.isGranted ? 'granted' : 'denied'}`}>
            <div className="permission-message">
              <span className="permission-icon">
                {permissionStatus.isGranted ? '✅' : '⚠️'}
              </span>
              <span className="permission-text">
                {permissionStatus.message}
              </span>
            </div>

            {!permissionStatus.isGranted && permissionStatus.instructions && (
              <div className="permission-instructions">
                <h4>Setup Instructions:</h4>
                <ol>
                  {permissionStatus.instructions.map((instruction, index) => (
                    <li key={index}>{instruction}</li>
                  ))}
                </ol>

                <div className="permission-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={handleOpenSettings}
                  >
                    Open System Settings
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={handleRecheckPermissions}
                    disabled={isCheckingPermissions}
                  >
                    {isCheckingPermissions ? 'Checking...' : 'Recheck Permissions'}
                  </button>
                </div>
              </div>
            )}

            {permissionStatus.isGranted && (
              <div style={{
                marginTop: '15px',
                padding: '10px',
                background: 'rgba(40, 167, 69, 0.1)',
                borderRadius: '4px'
              }}>
                <p style={{
                  margin: 0,
                  color: '#155724',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  🎉 Great! Permissions are configured correctly. You can now proceed to the next step.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Loading state */}
        {!permissionStatus && (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#6c757d'
          }}>
            <div className="loading-spinner" style={{
              width: '32px',
              height: '32px',
              margin: '0 auto 15px'
            }} />
            <p>Checking system permissions...</p>
          </div>
        )}

        {/* Additional platform-specific notes */}
        {permissionStatus?.platform === 'macos' && (
          <div style={{
            background: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '6px',
            padding: '15px',
            marginTop: '20px'
          }}>
            <h4 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#856404',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ marginRight: '8px' }}>💡</span>
              macOS Security Note
            </h4>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#856404',
              lineHeight: '1.4'
            }}>
              After granting accessibility permissions, you may need to restart GeniusQA
              for the changes to take effect. This is a macOS security requirement.
            </p>
          </div>
        )}

        {permissionStatus?.platform === 'windows' && (
          <div style={{
            background: '#d1ecf1',
            border: '1px solid #bee5eb',
            borderRadius: '6px',
            padding: '15px',
            marginTop: '20px'
          }}>
            <h4 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#0c5460',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ marginRight: '8px' }}>💡</span>
              Windows Security Note
            </h4>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#0c5460',
              lineHeight: '1.4'
            }}>
              Some antivirus software may flag automation tools. If you experience issues,
              consider adding GeniusQA to your antivirus whitelist.
            </p>
          </div>
        )}
      </div>

      <div className="step-actions">
        <button className="btn btn-outline" onClick={onSkip}>
          Skip This Step
        </button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!canProceed}
        >
          {canProceed ? 'Continue' : 'Permissions Required'}
        </button>
      </div>
    </div>
  );
};
