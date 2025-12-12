/**
 * Property-Based Tests for Model Selector Component
 * 
 * Tests correctness properties for the Model Selector,
 * ensuring models are displayed correctly per provider
 * and default model pre-selection works properly.
 * 
 * Uses fast-check for property-based testing.
 * 
 * Requirements: 3.1, 3.3
 */

import * as fc from 'fast-check';
import {
  AIProvider,
  ProviderModel,
  PROVIDER_CONFIGS,
  SUPPORTED_PROVIDERS,
} from '../../types/providerAdapter.types';
import { getDefaultModel, getModelsForProvider } from '../ModelSelector';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Arbitrary for valid provider IDs
 */
const providerIdArb = fc.constantFrom<AIProvider>(...SUPPORTED_PROVIDERS);

/**
 * Arbitrary for pricing tier
 */
const pricingTierArb = fc.constantFrom<ProviderModel['pricingTier']>('free', 'standard', 'premium');

/**
 * Arbitrary for a single ProviderModel
 */
const providerModelArb: fc.Arbitrary<ProviderModel> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  description: fc.string({ minLength: 0, maxLength: 200 }),
  capabilities: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
  pricingTier: pricingTierArb,
  isDefault: fc.boolean(),
});

/**
 * Arbitrary for a list of models with at most one default
 */
const modelListArb: fc.Arbitrary<ProviderModel[]> = fc
  .array(providerModelArb, { minLength: 1, maxLength: 10 })
  .map(models => {
    // Ensure at most one model is marked as default
    let hasDefault = false;
    return models.map(model => {
      if (model.isDefault && !hasDefault) {
        hasDefault = true;
        return model;
      }
      return { ...model, isDefault: false };
    });
  });

/**
 * Arbitrary for a list of models with exactly one default
 */
const modelListWithDefaultArb: fc.Arbitrary<ProviderModel[]> = fc
  .array(providerModelArb, { minLength: 1, maxLength: 10 })
  .map(models => {
    // Set exactly one model as default (the first one)
    return models.map((model, index) => ({
      ...model,
      isDefault: index === 0,
    }));
  });

/**
 * Arbitrary for a list of models with no default
 */
const modelListWithoutDefaultArb: fc.Arbitrary<ProviderModel[]> = fc
  .array(providerModelArb, { minLength: 1, maxLength: 10 })
  .map(models => models.map(model => ({ ...model, isDefault: false })));

// ============================================================================
// Property Tests
// ============================================================================

describe('Model Selector Property Tests', () => {
  // ==========================================================================
  // Property 7: Model List Per Provider
  // ==========================================================================

  /**
   * **Feature: multi-provider-ai, Property 7: Model List Per Provider**
   * **Validates: Requirements 3.1**
   * 
   * For any provider, selecting it should display exactly the models
   * defined for that provider in the configuration.
   */
  describe('Property 7: Model List Per Provider', () => {
    it('getModelsForProvider returns all models in the input list', () => {
      fc.assert(
        fc.property(modelListArb, (models: ProviderModel[]) => {
          const result = getModelsForProvider(models);
          
          // Should return the same number of models
          return result.length === models.length;
        }),
        { numRuns: 100 }
      );
    });

    it('getModelsForProvider preserves model order', () => {
      fc.assert(
        fc.property(modelListArb, (models: ProviderModel[]) => {
          const result = getModelsForProvider(models);
          
          // Order should be preserved
          for (let i = 0; i < models.length; i++) {
            if (result[i].id !== models[i].id) return false;
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('getModelsForProvider preserves all model properties', () => {
      fc.assert(
        fc.property(modelListArb, (models: ProviderModel[]) => {
          const result = getModelsForProvider(models);
          
          // All properties should be preserved
          for (let i = 0; i < models.length; i++) {
            const original = models[i];
            const returned = result[i];
            
            if (returned.id !== original.id) return false;
            if (returned.name !== original.name) return false;
            if (returned.description !== original.description) return false;
            if (returned.pricingTier !== original.pricingTier) return false;
            if (returned.isDefault !== original.isDefault) return false;
            if (returned.capabilities.length !== original.capabilities.length) return false;
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('PROVIDER_CONFIGS contains models for each provider', () => {
      fc.assert(
        fc.property(providerIdArb, (providerId: AIProvider) => {
          const config = PROVIDER_CONFIGS[providerId];
          
          // Config should exist
          if (!config) return false;
          
          // Models should be an array
          if (!Array.isArray(config.models)) return false;
          
          // Azure may have empty models (user-configured)
          if (providerId === 'azure') return true;
          
          // Other providers should have at least one model
          return config.models.length > 0;
        }),
        { numRuns: 100 }
      );
    });

    it('each model in PROVIDER_CONFIGS has required properties', () => {
      fc.assert(
        fc.property(providerIdArb, (providerId: AIProvider) => {
          const config = PROVIDER_CONFIGS[providerId];
          
          for (const model of config.models) {
            // Check required properties exist
            if (typeof model.id !== 'string' || model.id.length === 0) return false;
            if (typeof model.name !== 'string' || model.name.length === 0) return false;
            if (typeof model.description !== 'string') return false;
            if (!Array.isArray(model.capabilities)) return false;
            if (!['free', 'standard', 'premium'].includes(model.pricingTier)) return false;
            if (typeof model.isDefault !== 'boolean') return false;
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('model IDs are unique within each provider', () => {
      fc.assert(
        fc.property(providerIdArb, (providerId: AIProvider) => {
          const config = PROVIDER_CONFIGS[providerId];
          const modelIds = config.models.map(m => m.id);
          const uniqueIds = new Set(modelIds);
          
          return modelIds.length === uniqueIds.size;
        }),
        { numRuns: 100 }
      );
    });

    it('empty model list returns empty result', () => {
      const emptyModels: ProviderModel[] = [];
      const result = getModelsForProvider(emptyModels);
      
      expect(result).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Property 9: Default Model Pre-Selection
  // ==========================================================================

  /**
   * **Feature: multi-provider-ai, Property 9: Default Model Pre-Selection**
   * **Validates: Requirements 3.3**
   * 
   * For any provider with a defined default model, that model should be
   * pre-selected when the provider is chosen.
   */
  describe('Property 9: Default Model Pre-Selection', () => {
    it('getDefaultModel returns the model with isDefault=true', () => {
      fc.assert(
        fc.property(modelListWithDefaultArb, (models: ProviderModel[]) => {
          const defaultModel = getDefaultModel(models);
          
          // Should return a model
          if (!defaultModel) return false;
          
          // Should be the one marked as default
          return defaultModel.isDefault === true;
        }),
        { numRuns: 100 }
      );
    });

    it('getDefaultModel returns first model when no default is set', () => {
      fc.assert(
        fc.property(modelListWithoutDefaultArb, (models: ProviderModel[]) => {
          const defaultModel = getDefaultModel(models);
          
          // Should return a model
          if (!defaultModel) return false;
          
          // Should be the first model
          return defaultModel.id === models[0].id;
        }),
        { numRuns: 100 }
      );
    });

    it('getDefaultModel returns undefined for empty list', () => {
      const emptyModels: ProviderModel[] = [];
      const defaultModel = getDefaultModel(emptyModels);
      
      expect(defaultModel).toBeUndefined();
    });

    it('each provider in PROVIDER_CONFIGS has at most one default model', () => {
      fc.assert(
        fc.property(providerIdArb, (providerId: AIProvider) => {
          const config = PROVIDER_CONFIGS[providerId];
          const defaultModels = config.models.filter(m => m.isDefault);
          
          // Should have at most one default
          return defaultModels.length <= 1;
        }),
        { numRuns: 100 }
      );
    });

    it('non-Azure providers in PROVIDER_CONFIGS have exactly one default model', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<AIProvider>('gemini', 'openai', 'anthropic'),
          (providerId: AIProvider) => {
            const config = PROVIDER_CONFIGS[providerId];
            const defaultModels = config.models.filter(m => m.isDefault);
            
            // Should have exactly one default
            return defaultModels.length === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getDefaultModel is deterministic', () => {
      fc.assert(
        fc.property(modelListArb, (models: ProviderModel[]) => {
          const result1 = getDefaultModel(models);
          const result2 = getDefaultModel(models);
          
          // Same input should produce same output
          if (result1 === undefined && result2 === undefined) return true;
          if (result1 === undefined || result2 === undefined) return false;
          
          return result1.id === result2.id;
        }),
        { numRuns: 100 }
      );
    });

    it('getDefaultModel returns a model from the input list', () => {
      fc.assert(
        fc.property(modelListArb, (models: ProviderModel[]) => {
          const defaultModel = getDefaultModel(models);
          
          if (!defaultModel) return models.length === 0;
          
          // Should be one of the input models
          return models.some(m => m.id === defaultModel.id);
        }),
        { numRuns: 100 }
      );
    });

    it('getDefaultModel prefers isDefault=true over first model', () => {
      fc.assert(
        fc.property(
          fc.array(providerModelArb, { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 1, max: 9 }),
          (models: ProviderModel[], defaultIndex: number) => {
            // Ensure defaultIndex is within bounds
            const safeIndex = defaultIndex % models.length;
            
            // Set all to non-default first
            const modelsWithDefault = models.map((m, i) => ({
              ...m,
              isDefault: i === safeIndex,
            }));
            
            const defaultModel = getDefaultModel(modelsWithDefault);
            
            if (!defaultModel) return false;
            
            // Should return the model at safeIndex, not the first one
            return defaultModel.id === modelsWithDefault[safeIndex].id;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
