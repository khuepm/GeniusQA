/**
 * AITestCaseConfigurationUI Component
 * 
 * Configuration UI for AI Test Case Generator settings including
 * API key management and generation preferences.
 * 
 * Requirements: 1.2, 9.1, 9.2
 */

import React, { useState, useEffect } from 'react';
import './AITestCaseConfigurationUI.css';
import {
  ConfigurationUIProps,
  GenerationPreferences,
  ProjectType,
  ComplexityLevel,
  TestType,
  ConfigurationResponse
} from '../types/aiTestCaseGenerator.types';

const PROJECT_TYPE_OPTIONS: ProjectType[] = ['Web', 'Mobile', 'Api', 'Desktop'];
const COMPLEXITY_OPTIONS: ComplexityLevel[] = ['Basic', 'Detailed', 'Comprehensive'];
const TEST_TYPE_OPTIONS: TestType[] = [
  'Functional',
  'Integration',
  'EdgeCase',
  'ErrorHandling',
  'Performance',
  'Security',
  'Accessibility'
];

export const AITestCaseConfigurationUI: React.FC<ConfigurationUIProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [apiKey, setApiKey] = useState('');
  const [preferences, setPreferences] = useState<GenerationPreferences>({
    default_complexity: 'Detailed',
    default_project_type: 'Web',
    include_edge_cases_by_default: true,
    include_error_scenarios_by_default: true,
    max_test_cases_default: 10,
    custom_prompt_template: '',
    preferred_test_types: ['Functional', 'Integration', 'EdgeCase']
  });
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Load current configuration when modal opens
  useEffect(() => {
    if (isOpen) {
      loadCurrentConfiguration();
    }
  }, [isOpen]);

  const loadCurrentConfiguration = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/tauri');

      // Check if API key is configured
      const configResponse: ConfigurationResponse = await invoke('get_ai_configuration_status');
      setIsApiKeyConfigured(configResponse.is_configured);

      // Load preferences
      const prefsResponse: GenerationPreferences = await invoke('get_generation_preferences');
      setPreferences(prefsResponse);

      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    }
  };

  const handleApiKeyValidation = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setIsValidating(true);
    setError(undefined);

    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      const response: ConfigurationResponse = await invoke('validate_api_key', {
        apiKey: apiKey.trim()
      });

      if (response.success) {
        setIsApiKeyConfigured(true);
        setError(undefined);
      } else {
        setError(response.message || 'Invalid API key');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate API key');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(undefined);

    try {
      await onSave(apiKey.trim(), preferences);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreferenceChange = <K extends keyof GenerationPreferences>(
    key: K,
    value: GenerationPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const handleTestTypeToggle = (testType: TestType) => {
    setPreferences(prev => ({
      ...prev,
      preferred_test_types: prev.preferred_test_types.includes(testType)
        ? prev.preferred_test_types.filter(t => t !== testType)
        : [...prev.preferred_test_types, testType]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content config-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>AI Test Case Generator Configuration</h2>
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

          {/* API Key Configuration */}
          <section className="config-section">
            <h3>API Key Configuration</h3>
            <p className="section-description">
              Configure your Google Gemini API key to enable AI test case generation.
            </p>

            <div className="form-group">
              <label htmlFor="api-key">Gemini API Key</label>
              <div className="api-key-input-group">
                <input
                  id="api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={isApiKeyConfigured ? 'API key is configured' : 'Enter your Gemini API key'}
                  disabled={isValidating || isSaving}
                />
                <button
                  type="button"
                  className="toggle-visibility-button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? '👁️' : '👁️‍🗨️'}
                </button>
                <button
                  type="button"
                  className="validate-button"
                  onClick={handleApiKeyValidation}
                  disabled={isValidating || !apiKey.trim()}
                >
                  {isValidating ? 'Validating...' : 'Validate'}
                </button>
              </div>
              {isApiKeyConfigured && (
                <div className="success-message">
                  ✅ API key is configured and valid
                </div>
              )}
            </div>
          </section>

          {/* Generation Preferences */}
          <section className="config-section">
            <h3>Generation Preferences</h3>
            <p className="section-description">
              Set default options for test case generation.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="default-project-type">Default Project Type</label>
                <select
                  id="default-project-type"
                  value={preferences.default_project_type}
                  onChange={e => handlePreferenceChange('default_project_type', e.target.value as ProjectType)}
                  disabled={isSaving}
                >
                  {PROJECT_TYPE_OPTIONS.map(type => (
                    <option key={type} value={type}>
                      {type === 'Api' ? 'API/Backend' : `${type} Application`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="default-complexity">Default Complexity</label>
                <select
                  id="default-complexity"
                  value={preferences.default_complexity}
                  onChange={e => handlePreferenceChange('default_complexity', e.target.value as ComplexityLevel)}
                  disabled={isSaving}
                >
                  {COMPLEXITY_OPTIONS.map(complexity => (
                    <option key={complexity} value={complexity}>
                      {complexity}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="max-test-cases">Default Maximum Test Cases</label>
              <input
                id="max-test-cases"
                type="number"
                min="1"
                max="50"
                value={preferences.max_test_cases_default}
                onChange={e => handlePreferenceChange('max_test_cases_default', parseInt(e.target.value) || 10)}
                disabled={isSaving}
              />
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={preferences.include_edge_cases_by_default}
                  onChange={e => handlePreferenceChange('include_edge_cases_by_default', e.target.checked)}
                  disabled={isSaving}
                />
                Include edge cases by default
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={preferences.include_error_scenarios_by_default}
                  onChange={e => handlePreferenceChange('include_error_scenarios_by_default', e.target.checked)}
                  disabled={isSaving}
                />
                Include error scenarios by default
              </label>
            </div>

            <div className="form-group">
              <label>Preferred Test Types</label>
              <div className="test-type-grid">
                {TEST_TYPE_OPTIONS.map(testType => (
                  <label key={testType} className="checkbox-label test-type-checkbox">
                    <input
                      type="checkbox"
                      checked={preferences.preferred_test_types.includes(testType)}
                      onChange={() => handleTestTypeToggle(testType)}
                      disabled={isSaving}
                    />
                    {testType.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="custom-prompt">Custom Prompt Template (Optional)</label>
              <textarea
                id="custom-prompt"
                value={preferences.custom_prompt_template || ''}
                onChange={e => handlePreferenceChange('custom_prompt_template', e.target.value)}
                placeholder="Enter custom prompt template for consistent output formatting..."
                rows={4}
                disabled={isSaving}
              />
              <div className="field-help">
                Use this to customize how the AI generates test cases. Leave empty to use the default template.
              </div>
            </div>
          </section>
        </div>

        <div className="modal-footer">
          <button
            className="secondary-button"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className="primary-button"
            onClick={handleSave}
            disabled={isSaving || (!isApiKeyConfigured && !apiKey.trim())}
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
};
