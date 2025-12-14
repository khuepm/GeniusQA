/**
 * ModelSelector Component
 * 
 * Provides UI for selecting AI models within a provider.
 * Displays available models with descriptions and pricing tiers.
 * Shows model descriptions on hover.
 * Supports custom models with "Custom" badge and separate section.
 * 
 * Requirements: 3.1, 3.3, 3.4, 11.1, 11.5
 */

import React, { useState } from 'react';
import { ProviderModel, CustomModelConfig } from '../types/providerAdapter.types';
import './ModelSelector.css';

/**
 * Extended model type that includes custom model indicator
 */
export interface ExtendedProviderModel extends ProviderModel {
  /** Whether this is a custom model */
  isCustom?: boolean;
  /** Custom model configuration (only for custom models) */
  customConfig?: CustomModelConfig;
}

/**
 * Props for ModelSelector component
 * Requirements: 3.1, 11.1, 11.5
 */
export interface ModelSelectorProps {
  /** List of available models for the current provider */
  models: ProviderModel[];
  /** List of custom models */
  customModels?: CustomModelConfig[];
  /** Currently active model ID */
  activeModel: string | null;
  /** Callback when a model is selected */
  onModelSelect: (modelId: string, isCustom?: boolean) => void;
  /** Callback when "Add Custom Model" is clicked */
  onAddCustomModel?: () => void;
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
 * Convert CustomModelConfig to ExtendedProviderModel for display
 * Requirements: 11.5
 */
export function customModelToProviderModel(customModel: CustomModelConfig): ExtendedProviderModel {
  return {
    id: customModel.id,
    name: customModel.name,
    description: customModel.description || `Custom model: ${customModel.modelId}`,
    capabilities: ['text-generation', 'code-generation'],
    pricingTier: 'standard',
    isDefault: false,
    isCustom: true,
    customConfig: customModel,
  };
}

/**
 * Combine provider models and custom models into a single list
 * Requirements: 11.5
 */
export function combineModels(
  providerModels: ProviderModel[],
  customModels: CustomModelConfig[] = []
): ExtendedProviderModel[] {
  const extendedProviderModels: ExtendedProviderModel[] = providerModels.map(m => ({
    ...m,
    isCustom: false,
  }));

  const extendedCustomModels = customModels.map(customModelToProviderModel);

  return [...extendedProviderModels, ...extendedCustomModels];
}


/**
 * ModelSelector Component
 * 
 * Renders a dropdown selector for choosing AI models.
 * Shows model descriptions on hover and pricing tier badges.
 * Pre-selects the default model when available.
 * Displays custom models in a separate section with "Custom" badge.
 * 
 * Requirements: 3.1, 3.3, 3.4, 11.1, 11.5
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  customModels = [],
  activeModel,
  onModelSelect,
  onAddCustomModel,
  disabled = false,
  loading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);

  // Combine provider models and custom models
  const allModels = combineModels(models, customModels);

  // Separate provider models and custom models for grouped display
  const providerModels = allModels.filter(m => !m.isCustom);
  const customModelsList = allModels.filter(m => m.isCustom);

  /**
   * Get the currently active model info
   */
  const activeModelInfo = allModels.find(m => m.id === activeModel);

  /**
   * Handle model selection
   */
  const handleModelClick = (model: ExtendedProviderModel) => {
    if (disabled || loading) return;

    onModelSelect(model.id, model.isCustom);
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

  // Don't render if no models available (but still show if custom models can be added)
  if (allModels.length === 0 && !onAddCustomModel) {
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
            {activeModelInfo.isCustom ? (
              <span className="model-selector-tier tier-custom">Custom</span>
            ) : (
              <span className={`model-selector-tier ${getPricingTierClass(activeModelInfo.pricingTier)}`}>
                {getPricingTierText(activeModelInfo.pricingTier)}
              </span>
            )}
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
          {/* Provider Models Section */}
          {providerModels.length > 0 && (
            <div className="model-selector-section">
              {providerModels.map((model) => (
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

          {/* Custom Models Section */}
          {customModelsList.length > 0 && (
            <div className="model-selector-section model-selector-custom-section">
              <div className="model-selector-section-header">
                <span className="model-selector-section-title">Custom Models</span>
              </div>
              {customModelsList.map((model) => (
                <button
                  key={model.id}
                  className={`model-selector-option model-selector-custom-option ${model.id === activeModel ? 'active' : ''}`}
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
                      <span className="model-option-custom-badge">Custom</span>
                    </div>
                    <div className="model-option-meta">
                      <span className="model-option-model-id">
                        {model.customConfig?.modelId || model.id}
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
                      {model.customConfig?.apiBaseUrl && (
                        <div className="model-tooltip-api-url">
                          <span className="model-tooltip-api-label">API:</span>
                          <span className="model-tooltip-api-value">
                            {model.customConfig.apiBaseUrl}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Add Custom Model Button */}
          {onAddCustomModel && (
            <div className="model-selector-add-custom">
              <button
                className="model-selector-add-custom-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onAddCustomModel();
                }}
                data-testid="add-custom-model-button"
              >
                <span className="add-custom-icon">+</span>
                <span className="add-custom-text">Add Custom Model</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
