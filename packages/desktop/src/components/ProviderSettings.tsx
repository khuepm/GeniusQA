/**
 * ProviderSettings Component
 *
 * Provides UI for managing API keys for multiple AI providers.
 * Displays all supported providers with their configuration status
 * and allows users to add, update, or delete API keys.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  AIProvider,
  PROVIDER_CONFIGS,
  SUPPORTED_PROVIDERS,
} from '../types/providerAdapter.types';
import { apiKeyService } from '../services/apiKeyService';
import './ProviderSettings.css';

/**
 * Props for ProviderSettings component
 */
export interface ProviderSettingsProps {
  /** Current user ID for API key storage */
  userId: string;
  /** Callback when provider configuration changes */
  onConfigurationChange?: (configuredProviders: AIProvider[]) => void;
  /** Optional: Provider to auto-expand on mount */
  initialExpandedProvider?: AIProvider;
  /** Optional: Whether to show as modal */
  isModal?: boolean;
  /** Optional: Callback to close modal */
  onClose?: () => void;
}

/**
 * State for each provider's configuration
 */
interface ProviderState {
  configured: boolean;
  loading: boolean;
  saving: boolean;
  deleting: boolean;
  expanded: boolean;
  inputValue: string;
  showKey: boolean;
  feedback: {
    type: 'success' | 'error' | 'info' | null;
    message: string;
  };
}

/**
 * Get provider icon based on provider ID
 */
const getProviderIcon = (providerId: AIProvider): string => {
  switch (providerId) {
    case 'gemini':
      return '✨';
    case 'openai':
      return '🤖';
    case 'anthropic':
      return '🧠';
    case 'azure':
      return '☁️';
    default:
      return '🔌';
  }
};

/**
 * Get help URL for each provider
 */
const getProviderHelpUrl = (providerId: AIProvider): string => {
  switch (providerId) {
    case 'gemini':
      return 'https://aistudio.google.com/app/apikey';
    case 'openai':
      return 'https://platform.openai.com/api-keys';
    case 'anthropic':
      return 'https://console.anthropic.com/settings/keys';
    case 'azure':
      return 'https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/OpenAI';
    default:
      return '#';
  }
};

// maskApiKey is available for future use when displaying partial key info
// Currently we show a generic masked display for security


/**
 * ProviderSettings Component
 *
 * Renders a list of all supported AI providers with their configuration
 * status and provides UI for managing API keys.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export const ProviderSettings: React.FC<ProviderSettingsProps> = ({
  userId,
  onConfigurationChange,
  initialExpandedProvider,
  isModal = false,
  onClose,
}) => {
  // Initialize state for all providers
  const initialProviderStates: Record<AIProvider, ProviderState> = {} as Record<
    AIProvider,
    ProviderState
  >;
  SUPPORTED_PROVIDERS.forEach((providerId) => {
    initialProviderStates[providerId] = {
      configured: false,
      loading: true,
      saving: false,
      deleting: false,
      expanded: providerId === initialExpandedProvider,
      inputValue: '',
      showKey: false,
      feedback: { type: null, message: '' },
    };
  });

  const [providerStates, setProviderStates] =
    useState<Record<AIProvider, ProviderState>>(initialProviderStates);

  /**
   * Load configuration status for all providers on mount
   */
  useEffect(() => {
    const loadConfigurationStatus = async () => {
      try {
        const configuredProviders = await apiKeyService.getConfiguredProviders(userId);

        setProviderStates((prev) => {
          const updated = { ...prev };
          SUPPORTED_PROVIDERS.forEach((providerId) => {
            updated[providerId] = {
              ...updated[providerId],
              configured: configuredProviders.includes(providerId),
              loading: false,
            };
          });
          return updated;
        });
      } catch (error) {
        console.error('Failed to load provider configuration:', error);
        setProviderStates((prev) => {
          const updated = { ...prev };
          SUPPORTED_PROVIDERS.forEach((providerId) => {
            updated[providerId] = {
              ...updated[providerId],
              loading: false,
              feedback: {
                type: 'error',
                message: 'Failed to load configuration status',
              },
            };
          });
          return updated;
        });
      }
    };

    if (userId) {
      loadConfigurationStatus();
    }
  }, [userId]);

  /**
   * Update a single provider's state
   */
  const updateProviderState = useCallback(
    (providerId: AIProvider, updates: Partial<ProviderState>) => {
      setProviderStates((prev) => ({
        ...prev,
        [providerId]: { ...prev[providerId], ...updates },
      }));
    },
    []
  );

  /**
   * Toggle provider card expansion
   */
  const toggleExpanded = useCallback((providerId: AIProvider) => {
    setProviderStates((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        expanded: !prev[providerId].expanded,
        // Clear feedback when collapsing
        feedback: prev[providerId].expanded
          ? { type: null, message: '' }
          : prev[providerId].feedback,
      },
    }));
  }, []);

  /**
   * Handle API key input change
   */
  const handleInputChange = useCallback(
    (providerId: AIProvider, value: string) => {
      updateProviderState(providerId, {
        inputValue: value,
        feedback: { type: null, message: '' },
      });
    },
    [updateProviderState]
  );

  /**
   * Toggle API key visibility
   */
  const toggleShowKey = useCallback(
    (providerId: AIProvider) => {
      updateProviderState(providerId, {
        showKey: !providerStates[providerId].showKey,
      });
    },
    [providerStates, updateProviderState]
  );

  /**
   * Save API key for a provider
   * Requirements: 1.2
   */
  const handleSaveApiKey = useCallback(
    async (providerId: AIProvider) => {
      const state = providerStates[providerId];
      const apiKey = state.inputValue.trim();

      if (!apiKey) {
        updateProviderState(providerId, {
          feedback: { type: 'error', message: 'Please enter an API key' },
        });
        return;
      }

      updateProviderState(providerId, { saving: true });

      try {
        await apiKeyService.storeApiKey(userId, providerId, apiKey);

        updateProviderState(providerId, {
          saving: false,
          configured: true,
          inputValue: '',
          feedback: { type: 'success', message: 'API key saved successfully' },
        });

        // Notify parent of configuration change
        if (onConfigurationChange) {
          const configuredProviders = await apiKeyService.getConfiguredProviders(userId);
          onConfigurationChange(configuredProviders);
        }
      } catch (error) {
        console.error(`Failed to save ${providerId} API key:`, error);
        updateProviderState(providerId, {
          saving: false,
          feedback: {
            type: 'error',
            message: 'Failed to save API key. Please try again.',
          },
        });
      }
    },
    [userId, providerStates, updateProviderState, onConfigurationChange]
  );

  /**
   * Delete API key for a provider
   * Requirements: 1.4
   */
  const handleDeleteApiKey = useCallback(
    async (providerId: AIProvider) => {
      updateProviderState(providerId, { deleting: true });

      try {
        await apiKeyService.deleteApiKey(userId, providerId);

        updateProviderState(providerId, {
          deleting: false,
          configured: false,
          inputValue: '',
          feedback: { type: 'info', message: 'API key removed' },
        });

        // Notify parent of configuration change
        if (onConfigurationChange) {
          const configuredProviders = await apiKeyService.getConfiguredProviders(userId);
          onConfigurationChange(configuredProviders);
        }
      } catch (error) {
        console.error(`Failed to delete ${providerId} API key:`, error);
        updateProviderState(providerId, {
          deleting: false,
          feedback: {
            type: 'error',
            message: 'Failed to remove API key. Please try again.',
          },
        });
      }
    },
    [userId, updateProviderState, onConfigurationChange]
  );

  /**
   * Render a single provider card
   */
  const renderProviderCard = (providerId: AIProvider) => {
    const config = PROVIDER_CONFIGS[providerId];
    const state = providerStates[providerId];

    return (
      <div
        key={providerId}
        className={`provider-card ${state.configured ? 'configured' : ''} ${state.expanded ? 'expanded' : ''
          }`}
        data-testid={`provider-card-${providerId}`}
      >
        {/* Card Header */}
        <div
          className="provider-card-header"
          onClick={() => toggleExpanded(providerId)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              toggleExpanded(providerId);
            }
          }}
          aria-expanded={state.expanded}
          data-testid={`provider-card-header-${providerId}`}
        >
          <div className="provider-card-info">
            <span className="provider-card-icon">{getProviderIcon(providerId)}</span>
            <div className="provider-card-details">
              <span className="provider-card-name">{config.name}</span>
              <span className="provider-card-description">{config.description}</span>
            </div>
          </div>

          <div className="provider-card-status">
            {state.loading ? (
              <span className="provider-status-badge not-configured">
                <span className="button-spinner" style={{ width: 12, height: 12 }} />
              </span>
            ) : (
              <span
                className={`provider-status-badge ${state.configured ? 'configured' : 'not-configured'
                  }`}
              >
                <span className="provider-status-icon">
                  {state.configured ? '✓' : '○'}
                </span>
                {state.configured ? 'Configured' : 'Not configured'}
              </span>
            )}
            <span className={`provider-card-expand ${state.expanded ? 'expanded' : ''}`}>
              ▼
            </span>
          </div>
        </div>

        {/* Card Content (Expandable) */}
        <div className={`provider-card-content ${state.expanded ? 'expanded' : ''}`}>
          {/* Current Key Display (if configured) */}
          {state.configured && (
            <div className="current-key-display">
              <span className="current-key-icon">🔑</span>
              <span className="current-key-text">
                API key configured: <span className="current-key-masked">••••••••</span>
              </span>
            </div>
          )}

          {/* API Key Input Section */}
          <div className="api-key-section">
            <label className="api-key-label" htmlFor={`api-key-${providerId}`}>
              {state.configured ? 'Update API Key' : 'Enter API Key'}
            </label>

            <div className="api-key-input-wrapper">
              <input
                id={`api-key-${providerId}`}
                type={state.showKey ? 'text' : 'password'}
                className={`api-key-input ${state.feedback.type === 'error' ? 'error' : ''
                  } ${state.feedback.type === 'success' ? 'success' : ''}`}
                value={state.inputValue}
                onChange={(e) => handleInputChange(providerId, e.target.value)}
                placeholder={`Enter your ${config.name} API key`}
                disabled={state.saving || state.deleting}
                data-testid={`api-key-input-${providerId}`}
              />
              <button
                type="button"
                className="api-key-toggle"
                onClick={() => toggleShowKey(providerId)}
                title={state.showKey ? 'Hide API key' : 'Show API key'}
                data-testid={`api-key-toggle-${providerId}`}
              >
                {state.showKey ? '🙈' : '👁️'}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="api-key-actions">
              <button
                type="button"
                className="api-key-button save"
                onClick={() => handleSaveApiKey(providerId)}
                disabled={!state.inputValue.trim() || state.saving || state.deleting}
                data-testid={`api-key-save-${providerId}`}
              >
                {state.saving ? (
                  <>
                    <span className="button-spinner" />
                    Saving...
                  </>
                ) : (
                  <>Save API Key</>
                )}
              </button>

              {state.configured && (
                <button
                  type="button"
                  className="api-key-button delete"
                  onClick={() => handleDeleteApiKey(providerId)}
                  disabled={state.saving || state.deleting}
                  data-testid={`api-key-delete-${providerId}`}
                >
                  {state.deleting ? (
                    <>
                      <span className="button-spinner" />
                      Removing...
                    </>
                  ) : (
                    <>Remove Key</>
                  )}
                </button>
              )}
            </div>

            {/* Feedback Message */}
            {state.feedback.type && (
              <div
                className={`api-key-feedback ${state.feedback.type}`}
                role="alert"
                data-testid={`api-key-feedback-${providerId}`}
              >
                <span className="feedback-icon">
                  {state.feedback.type === 'success' && '✓'}
                  {state.feedback.type === 'error' && '✕'}
                  {state.feedback.type === 'info' && 'ℹ'}
                </span>
                {state.feedback.message}
              </div>
            )}

            {/* Help Text */}
            <p className="api-key-help">
              Get your API key from{' '}
              <a
                href={getProviderHelpUrl(providerId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {config.name} Console
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Main content
  const content = (
    <div className="provider-settings-container" data-testid="provider-settings">
      <div className="provider-settings-header">
        <h2 className="provider-settings-title">AI Provider Settings</h2>
        <p className="provider-settings-description">
          Configure API keys for the AI providers you want to use for script generation.
        </p>
      </div>

      <div className="provider-settings-list">
        {SUPPORTED_PROVIDERS.map((providerId) => renderProviderCard(providerId))}
      </div>
    </div>
  );

  // Render as modal if specified
  if (isModal) {
    return (
      <div
        className="provider-settings-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) {
            onClose();
          }
        }}
        data-testid="provider-settings-overlay"
      >
        <div className="provider-settings-modal">
          <div className="provider-settings-modal-header">
            <h2 className="provider-settings-title">AI Provider Settings</h2>
            {onClose && (
              <button
                type="button"
                className="provider-settings-modal-close"
                onClick={onClose}
                aria-label="Close settings"
                data-testid="provider-settings-close"
              >
                ✕
              </button>
            )}
          </div>
          <div style={{ padding: '16px' }}>
            <p className="provider-settings-description">
              Configure API keys for the AI providers you want to use for script
              generation.
            </p>
            <div className="provider-settings-list" style={{ marginTop: '16px' }}>
              {SUPPORTED_PROVIDERS.map((providerId) => renderProviderCard(providerId))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return content;
};

export default ProviderSettings;
