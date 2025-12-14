/**
 * ProviderSelector Component
 * 
 * Provides UI for selecting AI providers for script generation.
 * Displays configured providers with status indicators and
 * allows users to switch between providers.
 * 
 * Requirements: 2.1, 2.5, 6.1
 */

import React, { useState } from 'react';
import {
  AIProvider,
  ProviderInfo,
  PROVIDER_DISPLAY_NAMES,
} from '../types/providerAdapter.types';
import './ProviderSelector.css';

/**
 * Props for ProviderSelector component
 * Requirements: 2.1
 */
export interface ProviderSelectorProps {
  /** List of all providers with their configuration status */
  providers: ProviderInfo[];
  /** Currently active provider */
  activeProvider: AIProvider | null;
  /** Callback when a provider is selected */
  onProviderSelect: (providerId: AIProvider) => void;
  /** Callback to configure a provider (open settings) */
  onConfigureProvider: (providerId: AIProvider) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Whether a provider switch is in progress */
  loading?: boolean;
}

/**
 * Get status indicator icon for a provider
 */
const getStatusIcon = (status: ProviderInfo['status']): string => {
  switch (status) {
    case 'ready':
      return '✓';
    case 'error':
      return '⚠';
    case 'unconfigured':
      return '○';
    default:
      return '?';
  }
};

/**
 * Get status indicator class for styling
 */
const getStatusClass = (status: ProviderInfo['status']): string => {
  switch (status) {
    case 'ready':
      return 'status-ready';
    case 'error':
      return 'status-error';
    case 'unconfigured':
      return 'status-unconfigured';
    default:
      return '';
  }
};

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
 * ProviderSelector Component
 * 
 * Renders a dropdown selector for choosing AI providers.
 * Shows provider status, allows selection, and provides
 * access to configuration for unconfigured providers.
 * 
 * Requirements: 2.1, 2.5, 6.1
 */
export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  providers,
  activeProvider,
  onProviderSelect,
  onConfigureProvider,
  disabled = false,
  loading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  /**
   * Get the currently active provider info
   */
  const activeProviderInfo = providers.find(p => p.id === activeProvider);

  /**
   * Get configured providers (ready or error status)
   */
  const configuredProviders = providers.filter(p => p.configured);

  /**
   * Handle provider selection
   */
  const handleProviderClick = (provider: ProviderInfo) => {
    if (disabled || loading) return;

    if (!provider.configured) {
      // Open configuration for unconfigured providers
      onConfigureProvider(provider.id);
      setIsOpen(false);
      return;
    }

    if (provider.status === 'error') {
      // Allow selection but may show error state
      onProviderSelect(provider.id);
      setIsOpen(false);
      return;
    }

    // Select the provider
    onProviderSelect(provider.id);
    setIsOpen(false);
  };

  /**
   * Toggle dropdown
   */
  const toggleDropdown = () => {
    if (!disabled && !loading) {
      setIsOpen(!isOpen);
    }
  };

  /**
   * Close dropdown when clicking outside
   */
  const handleBlur = (e: React.FocusEvent) => {
    // Check if the new focus target is within the component
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
    }
  };

  return (
    <div
      className="provider-selector-container"
      data-testid="provider-selector"
      onBlur={handleBlur}
    >
      {/* Selected Provider Display / Dropdown Trigger */}
      <button
        className={`provider-selector-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={toggleDropdown}
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        data-testid="provider-selector-trigger"
      >
        {loading ? (
          <div className="provider-selector-loading">
            <span className="provider-selector-spinner" />
            <span className="provider-selector-loading-text">Switching...</span>
          </div>
        ) : activeProviderInfo ? (
          <div className="provider-selector-selected">
            <span className="provider-selector-icon">
              {getProviderIcon(activeProviderInfo.id)}
            </span>
            <span className="provider-selector-name">
              {activeProviderInfo.name}
            </span>
            <span className={`provider-selector-status ${getStatusClass(activeProviderInfo.status)}`}>
              {getStatusIcon(activeProviderInfo.status)}
            </span>
          </div>
        ) : (
          <div className="provider-selector-placeholder">
            <span className="provider-selector-placeholder-text">
              Select Provider
            </span>
          </div>
        )}
        <span className="provider-selector-arrow">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="provider-selector-dropdown"
          role="listbox"
          data-testid="provider-selector-dropdown"
        >
          {/* Configured Providers Section */}
          {configuredProviders.length > 0 && (
            <div className="provider-selector-section">
              <div className="provider-selector-section-header">
                Configured Providers
              </div>
              {configuredProviders.map((provider) => (
                <button
                  key={provider.id}
                  className={`provider-selector-option ${provider.id === activeProvider ? 'active' : ''} ${getStatusClass(provider.status)}`}
                  onClick={() => handleProviderClick(provider)}
                  role="option"
                  aria-selected={provider.id === activeProvider}
                  data-testid={`provider-option-${provider.id}`}
                >
                  <span className="provider-option-icon">
                    {getProviderIcon(provider.id)}
                  </span>
                  <div className="provider-option-info">
                    <span className="provider-option-name">{provider.name}</span>
                    <span className="provider-option-description">
                      {provider.description}
                    </span>
                  </div>
                  <div className="provider-option-status">
                    <span className={`provider-status-indicator ${getStatusClass(provider.status)}`}>
                      {getStatusIcon(provider.status)}
                    </span>
                    {provider.id === activeProvider && (
                      <span className="provider-option-active-badge">Active</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Unconfigured Providers Section */}
          {providers.filter(p => !p.configured).length > 0 && (
            <div className="provider-selector-section">
              <div className="provider-selector-section-header">
                Available Providers
              </div>
              {providers.filter(p => !p.configured).map((provider) => (
                <button
                  key={provider.id}
                  className="provider-selector-option unconfigured"
                  onClick={() => handleProviderClick(provider)}
                  role="option"
                  aria-selected={false}
                  data-testid={`provider-option-${provider.id}`}
                >
                  <span className="provider-option-icon">
                    {getProviderIcon(provider.id)}
                  </span>
                  <div className="provider-option-info">
                    <span className="provider-option-name">{provider.name}</span>
                    <span className="provider-option-description">
                      {provider.description}
                    </span>
                  </div>
                  <div className="provider-option-configure">
                    <span className="provider-configure-text">Configure</span>
                    <span className="provider-configure-icon">→</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Empty State */}
          {providers.length === 0 && (
            <div className="provider-selector-empty">
              <span className="provider-empty-text">
                No providers available
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProviderSelector;
