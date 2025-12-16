/**
 * TestCaseGeneratorModal Component
 * 
 * Modal component for generating test cases from requirements using AI.
 * Provides input for requirements text and generation options.
 * 
 * Requirements: 6.1, 6.2
 */

import React, { useState, useEffect } from 'react';
import './TestCaseGeneratorModal.css';
import {
  TestCaseGeneratorModalProps,
  GenerationOptions,
  ProjectType,
  ComplexityLevel,
  TestCase,
  GenerationResponse
} from '../types/aiTestCaseGenerator.types';

export const TestCaseGeneratorModal: React.FC<TestCaseGeneratorModalProps> = ({
  isOpen,
  onClose,
  onTestCasesGenerated,
  initialRequirements = '',
  initialOptions = {}
}) => {
  const [requirements, setRequirements] = useState(initialRequirements);
  const [options, setOptions] = useState<GenerationOptions>({
    project_type: 'Web',
    complexity_level: 'Detailed',
    include_edge_cases: true,
    include_error_scenarios: true,
    max_test_cases: 10,
    custom_context: '',
    ...initialOptions
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setRequirements(initialRequirements);
      setOptions(prev => ({ ...prev, ...initialOptions }));
      setError(undefined);
    }
  }, [isOpen, initialRequirements, initialOptions]);

  const handleGenerate = async () => {
    if (!requirements.trim()) {
      setError('Please enter requirements text');
      return;
    }

    setIsGenerating(true);
    setError(undefined);

    try {
      // Call Tauri command to generate test cases
      const { invoke } = await import('@tauri-apps/api/tauri');
      const response: GenerationResponse = await invoke('generate_test_cases_from_requirements', {
        requirements: requirements.trim(),
        options
      });

      if (response.success) {
        onTestCasesGenerated(response.test_cases);
        onClose();
      } else {
        setError(response.message || 'Failed to generate test cases');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProjectTypeChange = (projectType: ProjectType) => {
    setOptions(prev => ({ ...prev, project_type: projectType }));
  };

  const handleComplexityChange = (complexity: ComplexityLevel) => {
    setOptions(prev => ({ ...prev, complexity_level: complexity }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Generate Test Cases</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="requirements">Requirements Description</label>
            <textarea
              id="requirements"
              value={requirements}
              onChange={e => setRequirements(e.target.value)}
              placeholder="Describe the feature or functionality you want to test..."
              rows={6}
              disabled={isGenerating}
            />
          </div>

          <div className="options-section">
            <h3>Generation Options</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="project-type">Project Type</label>
                <select
                  id="project-type"
                  value={options.project_type}
                  onChange={e => handleProjectTypeChange(e.target.value as ProjectType)}
                  disabled={isGenerating}
                >
                  <option value="Web">Web Application</option>
                  <option value="Mobile">Mobile Application</option>
                  <option value="Api">API/Backend</option>
                  <option value="Desktop">Desktop Application</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="complexity">Complexity Level</label>
                <select
                  id="complexity"
                  value={options.complexity_level}
                  onChange={e => handleComplexityChange(e.target.value as ComplexityLevel)}
                  disabled={isGenerating}
                >
                  <option value="Basic">Basic (3-5 test cases)</option>
                  <option value="Detailed">Detailed (5-10 test cases)</option>
                  <option value="Comprehensive">Comprehensive (10-20 test cases)</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="max-test-cases">Maximum Test Cases</label>
                <input
                  id="max-test-cases"
                  type="number"
                  min="1"
                  max="50"
                  value={options.max_test_cases || 10}
                  onChange={e => setOptions(prev => ({
                    ...prev,
                    max_test_cases: parseInt(e.target.value) || 10
                  }))}
                  disabled={isGenerating}
                />
              </div>
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={options.include_edge_cases}
                  onChange={e => setOptions(prev => ({
                    ...prev,
                    include_edge_cases: e.target.checked
                  }))}
                  disabled={isGenerating}
                />
                Include edge cases and boundary conditions
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={options.include_error_scenarios}
                  onChange={e => setOptions(prev => ({
                    ...prev,
                    include_error_scenarios: e.target.checked
                  }))}
                  disabled={isGenerating}
                />
                Include error handling scenarios
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="custom-context">Additional Context (Optional)</label>
              <textarea
                id="custom-context"
                value={options.custom_context || ''}
                onChange={e => setOptions(prev => ({
                  ...prev,
                  custom_context: e.target.value
                }))}
                placeholder="Any additional context or specific requirements..."
                rows={3}
                disabled={isGenerating}
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="secondary-button"
            onClick={onClose}
            disabled={isGenerating}
          >
            Cancel
          </button>
          <button
            className="primary-button"
            onClick={handleGenerate}
            disabled={isGenerating || !requirements.trim()}
          >
            {isGenerating ? 'Generating...' : 'Generate Test Cases'}
          </button>
        </div>
      </div>
    </div>
  );
};
