/**
 * TestCaseEditor Component
 * 
 * Component for inline editing of test cases with validation.
 * Allows modification of test case fields with real-time validation.
 * 
 * Requirements: 6.6
 */

import React, { useState, useEffect } from 'react';
import './TestCaseEditor.css';
import {
  TestCaseEditorProps,
  TestCase,
  TestStep,
  TestSeverity,
  TestType,
  ValidationResult
} from '../types/aiTestCaseGenerator.types';

const SEVERITY_OPTIONS: TestSeverity[] = ['Critical', 'High', 'Medium', 'Low'];
const TEST_TYPE_OPTIONS: TestType[] = [
  'Functional',
  'Integration',
  'EdgeCase',
  'ErrorHandling',
  'Performance',
  'Security',
  'Accessibility'
];

export const TestCaseEditor: React.FC<TestCaseEditorProps> = ({
  testCase,
  onSave,
  onCancel,
  onValidate
}) => {
  const [editedTestCase, setEditedTestCase] = useState<TestCase>(testCase);
  const [validationResult, setValidationResult] = useState<ValidationResult | undefined>();
  const [isModified, setIsModified] = useState(false);

  // Validate on changes
  useEffect(() => {
    const result = onValidate(editedTestCase);
    setValidationResult(result);
  }, [editedTestCase, onValidate]);

  // Track modifications
  useEffect(() => {
    const hasChanges = JSON.stringify(editedTestCase) !== JSON.stringify(testCase);
    setIsModified(hasChanges);
  }, [editedTestCase, testCase]);

  const handleFieldChange = (field: keyof TestCase, value: any) => {
    setEditedTestCase(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleStepChange = (stepIndex: number, field: keyof TestStep, value: any) => {
    setEditedTestCase(prev => ({
      ...prev,
      steps: prev.steps.map((step, index) =>
        index === stepIndex ? { ...step, [field]: value } : step
      )
    }));
  };

  const handleAddStep = () => {
    const newStep: TestStep = {
      order: editedTestCase.steps.length + 1,
      action: '',
      expected_outcome: '',
      notes: ''
    };

    setEditedTestCase(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }));
  };

  const handleRemoveStep = (stepIndex: number) => {
    setEditedTestCase(prev => ({
      ...prev,
      steps: prev.steps
        .filter((_, index) => index !== stepIndex)
        .map((step, index) => ({ ...step, order: index + 1 }))
    }));
  };

  const handleSave = () => {
    if (validationResult?.is_valid) {
      onSave(editedTestCase);
    }
  };

  const getFieldError = (field: string) => {
    return validationResult?.errors.find(error => error.field === field);
  };

  const getFieldWarning = (field: string) => {
    return validationResult?.warnings.find(warning => warning.field === field);
  };

  return (
    <div className="test-case-editor">
      <div className="editor-header">
        <h3>Edit Test Case</h3>
        <div className="header-actions">
          <button className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="save-button"
            onClick={handleSave}
            disabled={!validationResult?.is_valid || !isModified}
          >
            Save Changes
          </button>
        </div>
      </div>

      <div className="editor-content">
        {/* Title */}
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            type="text"
            value={editedTestCase.title}
            onChange={e => handleFieldChange('title', e.target.value)}
            className={getFieldError('title') ? 'error' : ''}
          />
          {getFieldError('title') && (
            <div className="field-error">{getFieldError('title')?.message}</div>
          )}
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={editedTestCase.description}
            onChange={e => handleFieldChange('description', e.target.value)}
            rows={3}
            className={getFieldError('description') ? 'error' : ''}
          />
          {getFieldError('description') && (
            <div className="field-error">{getFieldError('description')?.message}</div>
          )}
        </div>

        {/* Preconditions */}
        <div className="form-group">
          <label htmlFor="preconditions">Preconditions (Optional)</label>
          <textarea
            id="preconditions"
            value={editedTestCase.preconditions || ''}
            onChange={e => handleFieldChange('preconditions', e.target.value)}
            rows={2}
          />
        </div>

        {/* Severity and Type */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="severity">Severity</label>
            <select
              id="severity"
              value={editedTestCase.severity}
              onChange={e => handleFieldChange('severity', e.target.value as TestSeverity)}
            >
              {SEVERITY_OPTIONS.map(severity => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="test-type">Test Type</label>
            <select
              id="test-type"
              value={editedTestCase.test_type}
              onChange={e => handleFieldChange('test_type', e.target.value as TestType)}
            >
              {TEST_TYPE_OPTIONS.map(type => (
                <option key={type} value={type}>
                  {type.replace(/([A-Z])/g, ' $1').trim()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Test Steps */}
        <div className="form-group">
          <div className="steps-header">
            <label>Test Steps</label>
            <button
              type="button"
              className="add-step-button"
              onClick={handleAddStep}
            >
              + Add Step
            </button>
          </div>

          <div className="steps-list">
            {editedTestCase.steps.map((step, index) => (
              <div key={index} className="step-editor">
                <div className="step-header">
                  <span className="step-number">{step.order}</span>
                  <button
                    type="button"
                    className="remove-step-button"
                    onClick={() => handleRemoveStep(index)}
                    aria-label="Remove step"
                  >
                    ×
                  </button>
                </div>

                <div className="step-fields">
                  <div className="form-group">
                    <label htmlFor={`step-action-${index}`}>Action</label>
                    <textarea
                      id={`step-action-${index}`}
                      value={step.action}
                      onChange={e => handleStepChange(index, 'action', e.target.value)}
                      rows={2}
                      className={getFieldError(`steps.${index}.action`) ? 'error' : ''}
                    />
                    {getFieldError(`steps.${index}.action`) && (
                      <div className="field-error">
                        {getFieldError(`steps.${index}.action`)?.message}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor={`step-expected-${index}`}>Expected Outcome (Optional)</label>
                    <textarea
                      id={`step-expected-${index}`}
                      value={step.expected_outcome || ''}
                      onChange={e => handleStepChange(index, 'expected_outcome', e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor={`step-notes-${index}`}>Notes (Optional)</label>
                    <textarea
                      id={`step-notes-${index}`}
                      value={step.notes || ''}
                      onChange={e => handleStepChange(index, 'notes', e.target.value)}
                      rows={1}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expected Result */}
        <div className="form-group">
          <label htmlFor="expected-result">Expected Result</label>
          <textarea
            id="expected-result"
            value={editedTestCase.expected_result}
            onChange={e => handleFieldChange('expected_result', e.target.value)}
            rows={3}
            className={getFieldError('expected_result') ? 'error' : ''}
          />
          {getFieldError('expected_result') && (
            <div className="field-error">{getFieldError('expected_result')?.message}</div>
          )}
        </div>

        {/* Validation Summary */}
        {validationResult && !validationResult.is_valid && (
          <div className="validation-summary">
            <h4>Validation Errors</h4>
            <ul>
              {validationResult.errors.map((error, index) => (
                <li key={index} className="validation-error">
                  <strong>{error.field}:</strong> {error.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {validationResult && validationResult.warnings.length > 0 && (
          <div className="validation-warnings">
            <h4>Warnings</h4>
            <ul>
              {validationResult.warnings.map((warning, index) => (
                <li key={index} className="validation-warning">
                  <strong>{warning.field}:</strong> {warning.message}
                  {warning.suggestion && (
                    <div className="warning-suggestion">
                      Suggestion: {warning.suggestion}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
