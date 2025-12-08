/**
 * Custom Model Dialog Component
 *
 * Modal dialog for adding and editing custom AI models.
 * Allows users to configure OpenAI-compatible API endpoints.
 * Includes form validation and API connection testing.
 *
 * Requirements: 11.1, 11.2, 11.4, 11.7, 11.9
 */

import React, { useState, useCallback, useEffect } from 'react';
import './CustomModelDialog.css';
import {
  CustomModelConfig,
  CustomModelFormData,
  CustomModelValidationResult,
} from '../types/providerAdapter.types';

/**
 * Props for the CustomModelDialog component
 */
export interface CustomModelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: CustomModelFormData) => Promise<void>;
  onValidate: (config: CustomModelFormData) => Promise<CustomModelValidationResult>;
  editingModel?: CustomModelConfig;
  isLoading?: boolean;
}

/**
 * Form field errors
 */
interface FormErrors {
  name?: string;
  modelId?: string;
  apiBaseUrl?: string;
  apiKey?: string;
}

/**
 * Initial form state
 */
const INITIAL_FORM_DATA: CustomModelFormData = {
  name: '',
  modelId: '',
  apiBaseUrl: '',
  apiKey: '',
  description: '',
};

/**
 * Validates a URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates the form data and returns errors
 */
export function validateFormData(data: CustomModelFormData): FormErrors {
  const errors: FormErrors = {};

  // Name validation
  if (!data.name || data.name.trim() === '') {
    errors.name = 'Model name is required';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Model name must be at least 2 characters';
  } else if (data.name.trim().length > 50) {
    errors.name = 'Model name must be less than 50 characters';
  }

  // Model ID validation
  if (!data.modelId || data.modelId.trim() === '') {
    errors.modelId = 'Model ID is required';
  } else if (data.modelId.trim().length > 100) {
    errors.modelId = 'Model ID must be less than 100 characters';
  }

  // API Base URL validation
  if (!data.apiBaseUrl || data.apiBaseUrl.trim() === '') {
    errors.apiBaseUrl = 'API Base URL is required';
  } else if (!isValidUrl(data.apiBaseUrl.trim())) {
    errors.apiBaseUrl = 'Please enter a valid URL';
  }

  // API Key validation
  if (!data.apiKey || data.apiKey.trim() === '') {
    errors.apiKey = 'API Key is required';
  } else if (data.apiKey.trim().length < 10) {
    errors.apiKey = 'API Key seems too short';
  }

  return errors;
}

/**
 * Custom Model Dialog Component
 */
export const CustomModelDialog: React.FC<CustomModelDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  onValidate,
  editingModel,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<CustomModelFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<CustomModelValidationResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isEditMode = !!editingModel;

  // Reset form when dialog opens or editingModel changes
  useEffect(() => {
    if (isOpen) {
      if (editingModel) {
        setFormData({
          name: editingModel.name,
          modelId: editingModel.modelId,
          apiBaseUrl: editingModel.apiBaseUrl,
          apiKey: editingModel.apiKey,
          description: editingModel.description || '',
        });
      } else {
        setFormData(INITIAL_FORM_DATA);
      }
      setErrors({});
      setValidationResult(null);
      setSaveError(null);
    }
  }, [isOpen, editingModel]);

  // Handle input changes
  const handleInputChange = useCallback(
    (field: keyof CustomModelFormData) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = e.target.value;
        setFormData((prev) => ({ ...prev, [field]: value }));

        // Clear field error when user types
        if (errors[field as keyof FormErrors]) {
          setErrors((prev) => ({ ...prev, [field]: undefined }));
        }

        // Clear validation result when form changes
        if (validationResult) {
          setValidationResult(null);
        }

        // Clear save error
        if (saveError) {
          setSaveError(null);
        }
      },
    [errors, validationResult, saveError]
  );

  // Handle test connection
  const handleTestConnection = useCallback(async () => {
    // Validate form first
    const formErrors = validateFormData(formData);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const result = await onValidate(formData);
      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      });
    } finally {
      setIsValidating(false);
    }
  }, [formData, onValidate]);

  // Handle save
  const handleSave = useCallback(async () => {
    // Validate form
    const formErrors = validateFormData(formData);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    // Require successful validation before save
    if (!validationResult?.valid) {
      setSaveError('Please test the connection before saving');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save model');
    } finally {
      setIsSaving(false);
    }
  }, [formData, validationResult, onSave, onClose]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && !isValidating && !isSaving) {
        onClose();
      }
    },
    [onClose, isValidating, isSaving]
  );

  if (!isOpen) return null;

  const isFormDisabled = isLoading || isValidating || isSaving;
  const canSave = validationResult?.valid && !isFormDisabled;

  return (
    <div
      className="custom-model-dialog-overlay"
      data-testid="custom-model-dialog"
      onKeyDown={handleKeyDown}
    >
      <div className="custom-model-dialog">
        <div className="custom-model-dialog-header">
          <h2>{isEditMode ? 'Edit Custom Model' : 'Add Custom Model'}</h2>
          <button
            className="custom-model-dialog-close"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={isFormDisabled}
          >
            ×
          </button>
        </div>

        <div className="custom-model-dialog-body">
          <p className="custom-model-dialog-description">
            {isEditMode
              ? 'Update your custom model configuration. Test the connection before saving.'
              : 'Add a custom AI model using any OpenAI-compatible API endpoint.'}
          </p>

          <form onSubmit={(e) => e.preventDefault()}>
            {/* Model Name */}
            <div className="custom-model-form-group">
              <label htmlFor="custom-model-name">
                Model Name <span className="required">*</span>
              </label>
              <input
                id="custom-model-name"
                type="text"
                value={formData.name}
                onChange={handleInputChange('name')}
                placeholder="e.g., My GPT-4 Model"
                className={errors.name ? 'input-error' : ''}
                disabled={isFormDisabled}
                data-testid="custom-model-name-input"
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            {/* Model ID */}
            <div className="custom-model-form-group">
              <label htmlFor="custom-model-id">
                Model ID <span className="required">*</span>
              </label>
              <input
                id="custom-model-id"
                type="text"
                value={formData.modelId}
                onChange={handleInputChange('modelId')}
                placeholder="e.g., gpt-4, claude-3-sonnet"
                className={errors.modelId ? 'input-error' : ''}
                disabled={isFormDisabled}
                data-testid="custom-model-id-input"
              />
              <span className="field-hint">
                The model identifier used in API requests
              </span>
              {errors.modelId && <span className="field-error">{errors.modelId}</span>}
            </div>

            {/* API Base URL */}
            <div className="custom-model-form-group">
              <label htmlFor="custom-model-url">
                API Base URL <span className="required">*</span>
              </label>
              <input
                id="custom-model-url"
                type="url"
                value={formData.apiBaseUrl}
                onChange={handleInputChange('apiBaseUrl')}
                placeholder="e.g., https://api.openai.com/v1"
                className={errors.apiBaseUrl ? 'input-error' : ''}
                disabled={isFormDisabled}
                data-testid="custom-model-url-input"
              />
              <span className="field-hint">
                OpenAI-compatible API endpoint (without /chat/completions)
              </span>
              {errors.apiBaseUrl && (
                <span className="field-error">{errors.apiBaseUrl}</span>
              )}
            </div>

            {/* API Key */}
            <div className="custom-model-form-group">
              <label htmlFor="custom-model-apikey">
                API Key <span className="required">*</span>
              </label>
              <input
                id="custom-model-apikey"
                type="password"
                value={formData.apiKey}
                onChange={handleInputChange('apiKey')}
                placeholder="Enter your API key"
                className={errors.apiKey ? 'input-error' : ''}
                disabled={isFormDisabled}
                data-testid="custom-model-apikey-input"
              />
              <span className="field-hint">
                Your API key will be encrypted before storage
              </span>
              {errors.apiKey && <span className="field-error">{errors.apiKey}</span>}
            </div>

            {/* Description (Optional) */}
            <div className="custom-model-form-group">
              <label htmlFor="custom-model-description">Description</label>
              <textarea
                id="custom-model-description"
                value={formData.description}
                onChange={handleInputChange('description')}
                placeholder="Optional description for this model"
                rows={2}
                disabled={isFormDisabled}
                data-testid="custom-model-description-input"
              />
            </div>

            {/* Validation Result */}
            {validationResult && (
              <div
                className={`validation-result ${validationResult.valid ? 'validation-success' : 'validation-error'
                  }`}
                data-testid="validation-result"
              >
                {validationResult.valid ? (
                  <>
                    <span className="validation-icon">✓</span>
                    <span>
                      Connection successful
                      {validationResult.responseTime && (
                        <span className="response-time">
                          {' '}
                          ({validationResult.responseTime}ms)
                        </span>
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="validation-icon">✗</span>
                    <span>{validationResult.error || 'Connection failed'}</span>
                  </>
                )}
              </div>
            )}

            {/* Save Error */}
            {saveError && (
              <div className="save-error" data-testid="save-error">
                {saveError}
              </div>
            )}
          </form>
        </div>

        <div className="custom-model-dialog-actions">
          <button
            type="button"
            className="custom-model-cancel-button"
            onClick={onClose}
            disabled={isFormDisabled}
          >
            Cancel
          </button>
          <button
            type="button"
            className="custom-model-test-button"
            onClick={handleTestConnection}
            disabled={isFormDisabled}
            data-testid="test-connection-button"
          >
            {isValidating ? (
              <>
                <span className="spinner" />
                Testing...
              </>
            ) : (
              '🔌 Test Connection'
            )}
          </button>
          <button
            type="button"
            className="custom-model-save-button"
            onClick={handleSave}
            disabled={!canSave}
            data-testid="save-model-button"
          >
            {isSaving ? 'Saving...' : isEditMode ? '💾 Update Model' : '💾 Save Model'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomModelDialog;
