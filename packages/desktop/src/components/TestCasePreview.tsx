/**
 * TestCasePreview Component
 * 
 * Component for previewing generated test cases with markdown rendering support.
 * Allows selection, expansion, and editing of individual test cases.
 * 
 * Requirements: 6.3, 6.5
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import './TestCasePreview.css';
import {
  TestCasePreviewProps,
  TestCase,
  TestStep
} from '../types/aiTestCaseGenerator.types';

export const TestCasePreview: React.FC<TestCasePreviewProps> = ({
  testCase,
  isSelected,
  isExpanded,
  onToggleSelection,
  onToggleExpansion,
  onEdit
}) => {
  const handleSelectionChange = () => {
    onToggleSelection(testCase.id);
  };

  const handleExpansionToggle = () => {
    onToggleExpansion(testCase.id);
  };

  const handleEditClick = () => {
    onEdit(testCase);
  };

  const formatSeverity = (severity: string) => {
    return severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase();
  };

  const formatTestType = (testType: string) => {
    // Convert camelCase to space-separated words
    return testType.replace(/([A-Z])/g, ' $1').trim();
  };

  const renderTestSteps = (steps: TestStep[]) => {
    return steps.map((step, index) => (
      <div key={index} className="test-step">
        <div className="step-header">
          <span className="step-number">{step.order}</span>
          <div className="step-action">
            <ReactMarkdown>{step.action}</ReactMarkdown>
          </div>
        </div>
        {step.expected_outcome && (
          <div className="step-expected">
            <strong>Expected:</strong>
            <ReactMarkdown>{step.expected_outcome}</ReactMarkdown>
          </div>
        )}
        {step.notes && (
          <div className="step-notes">
            <strong>Notes:</strong>
            <ReactMarkdown>{step.notes}</ReactMarkdown>
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className={`test-case-preview ${isSelected ? 'selected' : ''}`}>
      <div className="preview-header">
        <div className="header-left">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleSelectionChange}
            className="selection-checkbox"
            aria-label={`Select test case: ${testCase.title}`}
          />
          <div className="test-case-title">
            <ReactMarkdown>{testCase.title}</ReactMarkdown>
          </div>
        </div>

        <div className="header-right">
          <div className="test-case-badges">
            <span className={`severity-badge severity-${testCase.severity.toLowerCase()}`}>
              {formatSeverity(testCase.severity)}
            </span>
            <span className="type-badge">
              {formatTestType(testCase.test_type)}
            </span>
          </div>

          <div className="action-buttons">
            <button
              className="edit-button"
              onClick={handleEditClick}
              aria-label="Edit test case"
              title="Edit test case"
            >
              ✏️
            </button>
            <button
              className="expand-button"
              onClick={handleExpansionToggle}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          </div>
        </div>
      </div>

      <div className="preview-description">
        <ReactMarkdown>{testCase.description}</ReactMarkdown>
      </div>

      {isExpanded && (
        <div className="preview-details">
          {testCase.preconditions && (
            <div className="detail-section">
              <h4>Preconditions</h4>
              <div className="detail-content">
                <ReactMarkdown>{testCase.preconditions}</ReactMarkdown>
              </div>
            </div>
          )}

          <div className="detail-section">
            <h4>Test Steps</h4>
            <div className="test-steps">
              {renderTestSteps(testCase.steps)}
            </div>
          </div>

          <div className="detail-section">
            <h4>Expected Result</h4>
            <div className="detail-content">
              <ReactMarkdown>{testCase.expected_result}</ReactMarkdown>
            </div>
          </div>

          <div className="metadata-section">
            <div className="metadata-item">
              <span className="metadata-label">Generated:</span>
              <span className="metadata-value">
                {new Date(testCase.metadata.created_at).toLocaleString()}
              </span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Source:</span>
              <span className="metadata-value">{testCase.metadata.source_type}</span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Project Type:</span>
              <span className="metadata-value">{testCase.metadata.project_type}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
