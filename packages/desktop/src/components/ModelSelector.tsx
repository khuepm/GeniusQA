/**
 * ModelSelector Component
 * 
 * Provides UI for selecting AI models within a provider.
 * Displays available models with descriptions and pricing tiers.
 * Shows model descriptions on hover.
 * 
 * Requirements: 3.1, 3.3, 3.4
 */

import React, { useState } from 'react';
import { ProviderModel } from '../types/providerAdapter.types';
import './ModelSelector.css';

/**
 * Props for ModelSelector component
 * Requirements: 3.1
 */
export interface ModelSelectorProps {
  /** List of available models for the current provider */
  models: ProviderModel[];
  /** Currently active model ID */
  activeModel: string | null;
  /** Callback when a model is selected */
  onModelSelect: (modelId: string) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Whether a model switch is in progress */
  loading?: boolean;
}

/**
 * Get pricing tier badge color
 */
const getPricingTierClass = (tier: ProviderModel['pricingTier']): string => {
  switch (tier) {
    case 'free':
      return 'tier-free';
    case 'standard':
      return 'tier-standard';
    case 'premium':
      return 'tier-premium';
    default:
      return '';
  }
};

/**
 * Get pricing tier display text
 */
const getPricingTierText = (tier: ProviderModel['pricingTier']): string => {
  switch (tier) {
    case 'free':
      return 'Free';
    case 'standard':
      return 'Standard';
    case 'premium':
      return 'Premium';
    default:
      return tier;
  }
};

/**
 * Get the default model from a list of models
 * Requirements: 3.3
 */
export function getDefaultModel(models: ProviderModel[]): ProviderModel | undefined {
  return models.find(m => m.isDefault) || models[0];
}

/**
 * Get models for a specific provider
 * Requirements: 3.1
 */
export function getModelsForProvider(models: ProviderModel[]): ProviderModel[] {
  return models;
}


/**
 * ModelSelector Component
 * 
 * Renders a dropdown selector for choosing AI models.
 * Shows model descriptions on hover and pricing tier badges.
 * Pre-selects the default model when available.
 * 
 * Requirements: 3.1, 3.3, 3.4
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  activeModel,
  onModelSelect,
  disabled = false,
  loading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);

  /**
   * Get the currently active model info
   */
  const activeModelInfo = models.find(m => m.id === activeModel);

  /**
   * Handle model selection
   */
  const handleModelClick = (model: ProviderModel) => {
    if (disabled || loading) return;

    onModelSelect(model.id);
    setIsOpen(false);
  };

  /**
   * Toggle dropdown
   */
  const toggleDropdown = () => {
    if (!disabled && !loading && models.length > 0) {
      setIsOpen(!isOpen);
    }
  };

  /**
   * Close dropdown when clicking outside
   */
  const handleBlur = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
      setHoveredModel(null);
    }
  };

  /**
   * Handle mouse enter on model option
   */
  const handleModelHover = (modelId: string) => {
    setHoveredModel(modelId);
  };

  /**
   * Handle mouse leave on model option
   */
  const handleModelLeave = () => {
    setHoveredModel(null);
  };

  // Don't render if no models available
  if (models.length === 0) {
    return (
      <div className="model-selector-container" data-testid="model-selector">
        <div className="model-selector-empty">
          <span className="model-selector-empty-text">No models available</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="model-selector-container"
      data-testid="model-selector"
      onBlur={handleBlur}
    >
      {/* Selected Model Display / Dropdown Trigger */}
      <button
        className={`model-selector-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={toggleDropdown}
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        data-testid="model-selector-trigger"
      >
        {loading ? (
          <div className="model-selector-loading">
            <span className="model-selector-spinner" />
            <span className="model-selector-loading-text">Loading...</span>
          </div>
        ) : activeModelInfo ? (
          <div className="model-selector-selected">
            <span className="model-selector-name">{activeModelInfo.name}</span>
            <span className={`model-selector-tier ${getPricingTierClass(activeModelInfo.pricingTier)}`}>
              {getPricingTierText(activeModelInfo.pricingTier)}
            </span>
          </div>
        ) : (
          <div className="model-selector-placeholder">
            <span className="model-selector-placeholder-text">Select Model</span>
          </div>
        )}
        <span className="model-selector-arrow">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="model-selector-dropdown"
          role="listbox"
          data-testid="model-selector-dropdown"
        >
          {models.map((model) => (
            <button
              key={model.id}
              className={`model-selector-option ${model.id === activeModel ? 'active' : ''} ${model.isDefault ? 'default' : ''}`}
              onClick={() => handleModelClick(model)}
              onMouseEnter={() => handleModelHover(model.id)}
              onMouseLeave={handleModelLeave}
              role="option"
              aria-selected={model.id === activeModel}
              data-testid={`model-option-${model.id}`}
            >
              <div className="model-option-main">
                <div className="model-option-header">
                  <span className="model-option-name">{model.name}</span>
                  {model.isDefault && (
                    <span className="model-option-default-badge">Default</span>
                  )}
                </div>
                <div className="model-option-meta">
                  <span className={`model-option-tier ${getPricingTierClass(model.pricingTier)}`}>
                    {getPricingTierText(model.pricingTier)}
                  </span>
                  {model.id === activeModel && (
                    <span className="model-option-active-badge">Active</span>
                  )}
                </div>
              </div>

              {/* Description Tooltip on Hover */}
              {hoveredModel === model.id && (
                <div
                  className="model-option-tooltip"
                  data-testid={`model-tooltip-${model.id}`}
                >
                  <p className="model-tooltip-description">{model.description}</p>
                  {model.capabilities.length > 0 && (
                    <div className="model-tooltip-capabilities">
                      <span className="model-tooltip-capabilities-label">Capabilities:</span>
                      <div className="model-tooltip-capabilities-list">
                        {model.capabilities.map((cap, index) => (
                          <span key={index} className="model-capability-tag">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
