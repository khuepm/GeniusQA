/**
 * RecorderStepSelector Component
 * 
 * Compact step selection and management UI for the RecorderScreen.
 * Allows users to select which test step to record actions for,
 * create new steps, and view active step information.
 * 
 * Requirements: 2.1, 2.2, 4.1
 */

import React, { useState, useCallback, useMemo } from 'react';
import { TestStep, TestScript, StepIndicator } from '../types/testCaseDriven.types';
import './RecorderStepSelector.css';

interface RecorderStepSelectorProps {
  /** Current test script being recorded */
  script: TestScript | null;
  /** ID of step currently active for recording */
  activeStepId: string | null;
  /** Whether recording is currently in progress */
  isRecording: boolean;
  /** Callback when a step is selected for recording */
  onStepSelect: (stepId: string | null) => void;
  /** Callback to create a new step */
  onCreateStep: (description: string, expectedResult: string) => void;
  /** Callback to load a script for step-based recording */
  onLoadScript: () => void;
  /** Whether a script is loaded */
  hasScript: boolean;
}

export const RecorderStepSelector: React.FC<RecorderStepSelectorProps> = ({
  script,
  activeStepId,
  isRecording,
  onStepSelect,
  onCreateStep,
  onLoadScript,
  hasScript,
}) => {
  const [showStepList, setShowStepList] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newStepDescription, setNewStepDescription] = useState('');
  const [newStepExpectedResult, setNewStepExpectedResult] = useState('');

  /**
   * Get visual indicator for a step
   */
  const getStepIndicator = useCallback((step: TestStep): StepIndicator => {
    if (activeStepId === step.id && isRecording) {
      return 'recording';
    }
    if (step.action_ids.length > 0) {
      return 'mapped';
    }
    return 'manual';
  }, [activeStepId, isRecording]);

  /**
   * Get indicator emoji for display
   */
  const getIndicatorEmoji = useCallback((indicator: StepIndicator): string => {
    switch (indicator) {
      case 'manual': return '⚪';
      case 'mapped': return '🟢';
      case 'recording': return '🔴';
      default: return '⚪';
    }
  }, []);

  /**
   * Get the currently active step
   */
  const activeStep = useMemo((): TestStep | null => {
    if (!script || !activeStepId) return null;
    return script.steps.find(step => step.id === activeStepId) || null;
  }, [script, activeStepId]);

  /**
   * Handle step selection
   */
  const handleStepSelect = useCallback((stepId: string) => {
    onStepSelect(stepId);
    setShowStepList(false);
  }, [onStepSelect]);

  /**
   * Handle clearing step selection (record to Setup Step)
   */
  const handleClearSelection = useCallback(() => {
    onStepSelect(null);
    setShowStepList(false);
  }, [onStepSelect]);

  /**
   * Handle creating a new step
   */
  const handleCreateStep = useCallback(() => {
    if (newStepDescription.trim()) {
      onCreateStep(newStepDescription.trim(), newStepExpectedResult.trim());
      setNewStepDescription('');
      setNewStepExpectedResult('');
      setShowCreateForm(false);
    }
  }, [newStepDescription, newStepExpectedResult, onCreateStep]);

  /**
   * Get display text for active step
   */
  const getActiveStepDisplay = useCallback((): string => {
    if (!hasScript) {
      return 'No script loaded';
    }
    if (!activeStep) {
      return 'Setup Step (auto-created)';
    }
    return `Step ${activeStep.order}: ${activeStep.description}`;
  }, [hasScript, activeStep]);

  // If no script is loaded, show load script button
  if (!hasScript) {
    return (
      <div className="recorder-step-selector">
        <div className="step-selector-header">
          <span className="step-selector-label">Step-Based Recording</span>
        </div>
        <div className="no-script-container">
          <p className="no-script-text">
            Load a test script to record actions for specific test steps.
          </p>
          <button
            className="load-script-btn"
            onClick={onLoadScript}
            disabled={isRecording}
          >
            Load Script for Recording
          </button>
          <p className="setup-step-hint">
            Or record without a script - actions will be saved to a new recording.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="recorder-step-selector">
      <div className="step-selector-header">
        <span className="step-selector-label">Recording Target Step</span>
        {script && (
          <span className="script-name">{script.meta.title || 'Untitled Script'}</span>
        )}
      </div>

      {/* Active Step Display */}
      <div className="active-step-display">
        <button
          className={`step-selector-button ${isRecording ? 'recording' : ''}`}
          onClick={() => !isRecording && setShowStepList(!showStepList)}
          disabled={isRecording}
        >
          <span className="step-indicator-emoji">
            {activeStep ? getIndicatorEmoji(getStepIndicator(activeStep)) : '📋'}
          </span>
          <span className="step-selector-text">
            {getActiveStepDisplay()}
          </span>
          {!isRecording && (
            <span className="step-selector-icon">▼</span>
          )}
        </button>
      </div>

      {/* Recording Status */}
      {isRecording && activeStep && (
        <div className="recording-step-info">
          <div className="recording-step-indicator">
            <span className="recording-dot"></span>
            <span className="recording-label">Recording to:</span>
          </div>
          <div className="recording-step-details">
            <span className="recording-step-name">
              Step {activeStep.order}: {activeStep.description}
            </span>
            {activeStep.expected_result && (
              <span className="recording-step-expected">
                Expected: {activeStep.expected_result}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Step List Dropdown */}
      {showStepList && !isRecording && script && (
        <div className="step-list-dropdown">
          <div className="step-list-header">
            <span className="step-list-title">Select Target Step</span>
            <button
              className="create-step-btn"
              onClick={() => {
                setShowStepList(false);
                setShowCreateForm(true);
              }}
            >
              + New Step
            </button>
          </div>

          <div className="step-list-items">
            {/* Setup Step Option */}
            <div
              className={`step-list-item ${!activeStepId ? 'selected' : ''}`}
              onClick={handleClearSelection}
            >
              <span className="step-item-indicator">📋</span>
              <div className="step-item-content">
                <span className="step-item-name">Setup Step (auto-created)</span>
                <span className="step-item-description">
                  Actions recorded without a selected step
                </span>
              </div>
            </div>

            {/* Script Steps */}
            {script.steps.map((step) => {
              const indicator = getStepIndicator(step);
              return (
                <div
                  key={step.id}
                  className={`step-list-item ${activeStepId === step.id ? 'selected' : ''}`}
                  onClick={() => handleStepSelect(step.id)}
                >
                  <span className="step-item-indicator">
                    {getIndicatorEmoji(indicator)}
                  </span>
                  <div className="step-item-content">
                    <span className="step-item-name">
                      Step {step.order}: {step.description}
                    </span>
                    {step.expected_result && (
                      <span className="step-item-description">
                        Expected: {step.expected_result}
                      </span>
                    )}
                    <span className="step-item-actions">
                      {step.action_ids.length} action{step.action_ids.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              );
            })}

            {script.steps.length === 0 && (
              <div className="empty-steps-message">
                <p>No steps defined yet.</p>
                <p>Create a step or record to Setup Step.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Step Form */}
      {showCreateForm && !isRecording && (
        <div className="create-step-form">
          <div className="form-header">
            <span className="form-title">Create New Step</span>
            <button
              className="form-close-btn"
              onClick={() => setShowCreateForm(false)}
            >
              ×
            </button>
          </div>
          <div className="form-body">
            <div className="form-field">
              <label className="form-label">Step Description *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Login with valid credentials"
                value={newStepDescription}
                onChange={(e) => setNewStepDescription(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-field">
              <label className="form-label">Expected Result</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., User is redirected to dashboard"
                value={newStepExpectedResult}
                onChange={(e) => setNewStepExpectedResult(e.target.value)}
              />
            </div>
            <div className="form-actions">
              <button
                className="form-cancel-btn"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </button>
              <button
                className="form-submit-btn"
                onClick={handleCreateStep}
                disabled={!newStepDescription.trim()}
              >
                Create & Select
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecorderStepSelector;
