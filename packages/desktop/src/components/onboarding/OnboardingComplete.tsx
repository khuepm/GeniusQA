/**
 * Onboarding Complete Step Component
 * 
 * Celebrates successful onboarding completion and provides
 * next steps for users to start using application-focused automation.
 * 
 * Requirements: Task 18.1 - Feature onboarding flow
 */

import React from 'react';
import { OnboardingStep } from '../../services/onboardingService';

interface OnboardingCompleteProps {
  step: OnboardingStep;
  onFinish: () => void;
}

export const OnboardingComplete: React.FC<OnboardingCompleteProps> = ({
  step,
  onFinish,
}) => {
  return (
    <div className="onboarding-step">
      <div className="step-header">
        <h2 className="step-title">{step.title}</h2>
        <p className="step-description">{step.description}</p>
      </div>

      <div className="step-body">
        <div className="completion-celebration">
          <span className="celebration-icon">🎉</span>

          <div style={{ marginBottom: '30px' }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#28a745',
              marginBottom: '10px'
            }}>
              Congratulations!
            </h3>
            <p style={{
              fontSize: '16px',
              color: '#495057',
              lineHeight: '1.5',
              maxWidth: '400px',
              margin: '0 auto'
            }}>
              You've successfully set up application-focused automation.
              You're now ready to create safer, more controlled automation workflows.
            </p>
          </div>

          <div className="completion-summary">
            <h4>What You've Accomplished:</h4>
            <ul>
              <li>✅ Learned about focus-aware automation capabilities</li>
              <li>✅ Configured system permissions for application monitoring</li>
              <li>✅ Set up your preferred focus strategies and notifications</li>
              <li>✅ Prepared GeniusQA for application-constrained automation</li>
            </ul>
          </div>

          <div style={{
            background: '#f8f9fa',
            borderRadius: '8px',
            padding: '20px',
            marginTop: '20px',
            textAlign: 'left'
          }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#212529',
              marginBottom: '15px',
              textAlign: 'center'
            }}>
              Next Steps:
            </h4>

            <div style={{ display: 'grid', gap: '15px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <span style={{
                  fontSize: '20px',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  📱
                </span>
                <div>
                  <strong style={{ color: '#212529' }}>Add Applications</strong>
                  <p style={{
                    margin: '4px 0 0',
                    fontSize: '14px',
                    color: '#6c757d',
                    lineHeight: '1.4'
                  }}>
                    Go to Application Management to register the apps you want to automate.
                  </p>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <span style={{
                  fontSize: '20px',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  🎮
                </span>
                <div>
                  <strong style={{ color: '#212529' }}>Start Automating</strong>
                  <p style={{
                    margin: '4px 0 0',
                    fontSize: '14px',
                    color: '#6c757d',
                    lineHeight: '1.4'
                  }}>
                    Use the Automation Control Panel to run scripts with focus-aware controls.
                  </p>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <span style={{
                  fontSize: '20px',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  ⚙️
                </span>
                <div>
                  <strong style={{ color: '#212529' }}>Customize Settings</strong>
                  <p style={{
                    margin: '4px 0 0',
                    fontSize: '14px',
                    color: '#6c757d',
                    lineHeight: '1.4'
                  }}>
                    Visit Configuration to fine-tune focus strategies and monitoring options.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            background: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '6px',
            padding: '15px',
            marginTop: '20px',
            color: '#155724'
          }}>
            <p style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: '1.4',
              textAlign: 'center'
            }}>
              <strong>🛡️ Safety First:</strong> Application-focused automation helps prevent
              accidental interference with other applications, making your automation workflows
              safer and more reliable.
            </p>
          </div>
        </div>
      </div>

      <div className="step-actions">
        <div></div> {/* Empty div for spacing */}
        <button className="btn btn-primary" onClick={onFinish}>
          Start Using GeniusQA
        </button>
      </div>
    </div>
  );
};
