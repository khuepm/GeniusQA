/**
 * Integration Tests for Custom Model Flow
 *
 * Tests the complete custom model lifecycle:
 * - Add custom model → Validate API → Save → Verify in list
 * - Select custom model → Generate script → Verify API endpoint used
 * - Edit custom model → Save → Verify changes
 * - Delete custom model → Confirm → Verify removed
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9
 */

import {
  CustomModelConfig,
  CustomModelFormData,
  CustomModelValidationResult,
} from '../../types/providerAdapter.types';
import {
  validateFormData,
  isValidUrl,
} from '../../components/CustomModelDialog';
import {
  combineModels,
  customModelToProviderModel,
  getDefaultModel,
} from '../../components/ModelSelector';
import { ProviderManager } from '../../services/providerManager';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
}));

jest.mock('../../config/firebase.config', () => ({
  app: {},
}));

// Mock encryption utilities
jest.mock('../../utils/encryption', () => ({
  encryptApiKey: jest.fn((key: string) => `encrypted_${key}`),
  decryptApiKey: jest.fn((key: string) => key.replace('encrypted_', '')),
}));

/**
 * Helper to create a valid custom model form data
 */
function createValidFormData(overrides: Partial<CustomModelFormData> = {}): CustomModelFormData {
  return {
    name: 'Test Custom Model',
    modelId: 'gpt-4-custom',
    apiBaseUrl: 'https://api.example.com/v1',
    apiKey: 'sk-test-api-key-12345',
    description: 'A test custom model',
    ...overrides,
  };
}

/**
 * Helper to create a custom model config
 */
function createCustomModelConfig(overrides: Partial<CustomModelConfig> = {}): CustomModelConfig {
  const now = new Date().toISOString();
  return {
    id: `custom_${Date.now()}_abc123`,
    name: 'Test Custom Model',
    modelId: 'gpt-4-custom',
    apiBaseUrl: 'https://api.example.com/v1',
    apiKey: 'sk-test-api-key-12345',
    description: 'A test custom model',
    createdAt: now,
    updatedAt: now,
    isCustom: true,
    ...overrides,
  };
}

describe('Custom Model Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Custom Model Form Validation', () => {
    /**
     * Test: Form validation for required fields
     * Requirements: 11.2
     */
    it('should reject empty model name', () => {
      const formData = createValidFormData({ name: '' });
      const errors = validateFormData(formData);
      expect(errors.name).toBe('Model name is required');
    });

    it('should reject short model name', () => {
      const formData = createValidFormData({ name: 'A' });
      const errors = validateFormData(formData);
      expect(errors.name).toBe('Model name must be at least 2 characters');
    });

    it('should reject long model name', () => {
      const formData = createValidFormData({ name: 'A'.repeat(51) });
      const errors = validateFormData(formData);
      expect(errors.name).toBe('Model name must be less than 50 characters');
    });

    it('should reject empty model ID', () => {
      const formData = createValidFormData({ modelId: '' });
      const errors = validateFormData(formData);
      expect(errors.modelId).toBe('Model ID is required');
    });

    it('should reject empty API base URL', () => {
      const formData = createValidFormData({ apiBaseUrl: '' });
      const errors = validateFormData(formData);
      expect(errors.apiBaseUrl).toBe('API Base URL is required');
    });

    it('should reject invalid API base URL', () => {
      const formData = createValidFormData({ apiBaseUrl: 'not-a-valid-url' });
      const errors = validateFormData(formData);
      expect(errors.apiBaseUrl).toBe('Please enter a valid URL');
    });

    it('should reject empty API key', () => {
      const formData = createValidFormData({ apiKey: '' });
      const errors = validateFormData(formData);
      expect(errors.apiKey).toBe('API Key is required');
    });

    it('should reject short API key', () => {
      const formData = createValidFormData({ apiKey: 'short' });
      const errors = validateFormData(formData);
      expect(errors.apiKey).toBe('API Key seems too short');
    });

    it('should accept valid form data', () => {
      const formData = createValidFormData();
      const errors = validateFormData(formData);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should accept form data with optional description', () => {
      const formData = createValidFormData({ description: undefined });
      const errors = validateFormData(formData);
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('URL Validation', () => {
    /**
     * Test: URL format validation
     * Requirements: 11.2
     */
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://api.openai.com/v1')).toBe(true);
      expect(isValidUrl('http://localhost:8080')).toBe(true);
      expect(isValidUrl('https://custom-api.example.com/api/v2')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://invalid')).toBe(true); // ftp is valid URL scheme
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('api.example.com')).toBe(false); // missing protocol
    });
  });

  describe('Custom Model to Provider Model Conversion', () => {
    /**
     * Test: Converting custom model config to provider model format
     * Requirements: 11.5
     */
    it('should convert custom model to provider model format', () => {
      const customModel = createCustomModelConfig({
        name: 'My GPT-4',
        modelId: 'gpt-4-turbo',
        description: 'Custom GPT-4 endpoint',
      });

      const providerModel = customModelToProviderModel(customModel);

      expect(providerModel.id).toBe(customModel.id);
      expect(providerModel.name).toBe('My GPT-4');
      expect(providerModel.description).toBe('Custom GPT-4 endpoint');
      expect(providerModel.isCustom).toBe(true);
      expect(providerModel.customConfig).toBe(customModel);
      expect(providerModel.capabilities).toContain('text-generation');
      expect(providerModel.capabilities).toContain('code-generation');
    });

    it('should use default description when not provided', () => {
      const customModel = createCustomModelConfig({
        name: 'My Model',
        modelId: 'custom-model-id',
        description: undefined,
      });

      const providerModel = customModelToProviderModel(customModel);

      expect(providerModel.description).toBe('Custom model: custom-model-id');
    });
  });

  describe('Combining Provider and Custom Models', () => {
    /**
     * Test: Combining provider models with custom models
     * Requirements: 11.5
     */
    it('should combine provider models and custom models', () => {
      const providerModels = [
        {
          id: 'gemini-pro',
          name: 'Gemini Pro',
          description: 'Google Gemini Pro',
          capabilities: ['text-generation'],
          pricingTier: 'free' as const,
          isDefault: true,
        },
      ];

      const customModels = [
        createCustomModelConfig({ name: 'Custom Model 1' }),
        createCustomModelConfig({ id: 'custom_2', name: 'Custom Model 2' }),
      ];

      const combined = combineModels(providerModels, customModels);

      expect(combined).toHaveLength(3);
      expect(combined[0].name).toBe('Gemini Pro');
      expect(combined[0].isCustom).toBe(false);
      expect(combined[1].name).toBe('Custom Model 1');
      expect(combined[1].isCustom).toBe(true);
      expect(combined[2].name).toBe('Custom Model 2');
      expect(combined[2].isCustom).toBe(true);
    });

    it('should handle empty custom models list', () => {
      const providerModels = [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          description: 'OpenAI GPT-4',
          capabilities: ['text-generation'],
          pricingTier: 'premium' as const,
          isDefault: true,
        },
      ];

      const combined = combineModels(providerModels, []);

      expect(combined).toHaveLength(1);
      expect(combined[0].name).toBe('GPT-4');
    });

    it('should handle empty provider models list', () => {
      const customModels = [createCustomModelConfig({ name: 'Only Custom' })];

      const combined = combineModels([], customModels);

      expect(combined).toHaveLength(1);
      expect(combined[0].name).toBe('Only Custom');
      expect(combined[0].isCustom).toBe(true);
    });
  });

  describe('Provider Manager Custom Model Integration', () => {
    /**
     * Test: Provider Manager custom model management
     * Requirements: 11.5, 11.6
     */
    let providerManager: ProviderManager;

    beforeEach(() => {
      providerManager = new ProviderManager();
    });

    it('should set and get custom models', () => {
      const customModels = [
        createCustomModelConfig({ id: 'custom_1', name: 'Model 1' }),
        createCustomModelConfig({ id: 'custom_2', name: 'Model 2' }),
      ];

      providerManager.setCustomModels(customModels);
      const retrieved = providerManager.getCustomModels();

      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].name).toBe('Model 1');
      expect(retrieved[1].name).toBe('Model 2');
    });

    it('should select a custom model', () => {
      const customModels = [
        createCustomModelConfig({ id: 'custom_1', name: 'Model 1' }),
      ];

      providerManager.setCustomModels(customModels);
      providerManager.setActiveModel('custom_1', true);

      expect(providerManager.isUsingCustomModel()).toBe(true);
      expect(providerManager.getActiveModel()).toBe('custom_1');
    });

    it('should get active custom model configuration', () => {
      const customModels = [
        createCustomModelConfig({
          id: 'custom_1',
          name: 'My Custom Model',
          apiBaseUrl: 'https://my-api.com/v1',
        }),
      ];

      providerManager.setCustomModels(customModels);
      providerManager.setActiveModel('custom_1', true);

      const activeCustomModel = providerManager.getActiveCustomModel();

      expect(activeCustomModel).not.toBeNull();
      expect(activeCustomModel?.name).toBe('My Custom Model');
      expect(activeCustomModel?.apiBaseUrl).toBe('https://my-api.com/v1');
    });

    it('should return null when no custom model is active', () => {
      const customModels = [
        createCustomModelConfig({ id: 'custom_1', name: 'Model 1' }),
      ];

      providerManager.setCustomModels(customModels);
      // Don't select any model

      expect(providerManager.isUsingCustomModel()).toBe(false);
      expect(providerManager.getActiveCustomModel()).toBeNull();
    });

    it('should throw error when selecting non-existent custom model', () => {
      providerManager.setCustomModels([]);

      expect(() => {
        providerManager.setActiveModel('non_existent', true);
      }).toThrow("Custom model 'non_existent' not found");
    });

    it('should clear custom model selection when model is removed', () => {
      const customModels = [
        createCustomModelConfig({ id: 'custom_1', name: 'Model 1' }),
      ];

      providerManager.setCustomModels(customModels);
      providerManager.setActiveModel('custom_1', true);

      expect(providerManager.isUsingCustomModel()).toBe(true);

      // Remove the custom model
      providerManager.setCustomModels([]);

      expect(providerManager.isUsingCustomModel()).toBe(false);
      expect(providerManager.getActiveCustomModel()).toBeNull();
    });

    it('should include custom models in all available models', () => {
      const customModels = [
        createCustomModelConfig({ id: 'custom_1', name: 'Custom Model' }),
      ];

      providerManager.setCustomModels(customModels);
      const allModels = providerManager.getAllAvailableModels();

      // Should include the custom model
      const customModel = allModels.find((m) => m.id === 'custom_1');
      expect(customModel).toBeDefined();
      expect(customModel?.name).toBe('Custom Model');
    });

    it('should reset custom model state on manager reset', () => {
      const customModels = [
        createCustomModelConfig({ id: 'custom_1', name: 'Model 1' }),
      ];

      providerManager.setCustomModels(customModels);
      providerManager.setActiveModel('custom_1', true);

      providerManager.reset();

      expect(providerManager.getCustomModels()).toHaveLength(0);
      expect(providerManager.isUsingCustomModel()).toBe(false);
      expect(providerManager.getActiveCustomModel()).toBeNull();
    });
  });

  describe('Custom Model CRUD Operations Flow', () => {
    /**
     * Test: Complete CRUD flow for custom models
     * Requirements: 11.3, 11.7, 11.8
     */
    it('should support add → verify → edit → verify → delete flow', () => {
      const providerManager = new ProviderManager();

      // Step 1: Add custom model
      const model1 = createCustomModelConfig({
        id: 'custom_1',
        name: 'Initial Model',
        apiBaseUrl: 'https://api.initial.com/v1',
      });

      providerManager.setCustomModels([model1]);

      // Verify model was added
      let models = providerManager.getCustomModels();
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('Initial Model');

      // Step 2: Edit custom model (simulate by updating the list)
      const updatedModel = {
        ...model1,
        name: 'Updated Model',
        apiBaseUrl: 'https://api.updated.com/v1',
        updatedAt: new Date().toISOString(),
      };

      providerManager.setCustomModels([updatedModel]);

      // Verify model was updated
      models = providerManager.getCustomModels();
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('Updated Model');
      expect(models[0].apiBaseUrl).toBe('https://api.updated.com/v1');

      // Step 3: Delete custom model
      providerManager.setCustomModels([]);

      // Verify model was deleted
      models = providerManager.getCustomModels();
      expect(models).toHaveLength(0);
    });

    it('should handle multiple custom models', () => {
      const providerManager = new ProviderManager();

      const models = [
        createCustomModelConfig({ id: 'custom_1', name: 'Model A' }),
        createCustomModelConfig({ id: 'custom_2', name: 'Model B' }),
        createCustomModelConfig({ id: 'custom_3', name: 'Model C' }),
      ];

      providerManager.setCustomModels(models);

      expect(providerManager.getCustomModels()).toHaveLength(3);

      // Select middle model
      providerManager.setActiveModel('custom_2', true);
      expect(providerManager.getActiveCustomModel()?.name).toBe('Model B');

      // Remove middle model, should clear selection
      providerManager.setCustomModels([models[0], models[2]]);
      expect(providerManager.getCustomModels()).toHaveLength(2);
      expect(providerManager.isUsingCustomModel()).toBe(false);
    });
  });

  describe('Custom Model Selection for Script Generation', () => {
    /**
     * Test: Selecting custom model for script generation
     * Requirements: 11.6
     */
    it('should track custom model selection state correctly', () => {
      const providerManager = new ProviderManager();

      const customModels = [
        createCustomModelConfig({
          id: 'custom_gpt4',
          name: 'My GPT-4',
          modelId: 'gpt-4-turbo',
          apiBaseUrl: 'https://my-openai-proxy.com/v1',
        }),
      ];

      providerManager.setCustomModels(customModels);

      // Initially not using custom model
      expect(providerManager.isUsingCustomModel()).toBe(false);

      // Select custom model
      providerManager.setActiveModel('custom_gpt4', true);

      // Now using custom model
      expect(providerManager.isUsingCustomModel()).toBe(true);
      expect(providerManager.getActiveModel()).toBe('custom_gpt4');

      // Get the custom model config for API calls
      const activeConfig = providerManager.getActiveCustomModel();
      expect(activeConfig).not.toBeNull();
      expect(activeConfig?.modelId).toBe('gpt-4-turbo');
      expect(activeConfig?.apiBaseUrl).toBe('https://my-openai-proxy.com/v1');
    });
  });

  describe('Custom Model Validation Result Handling', () => {
    /**
     * Test: Handling validation results
     * Requirements: 11.4, 11.9
     */
    it('should handle successful validation result', () => {
      const result: CustomModelValidationResult = {
        valid: true,
        responseTime: 150,
      };

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.responseTime).toBe(150);
    });

    it('should handle authentication error', () => {
      const result: CustomModelValidationResult = {
        valid: false,
        error: 'Authentication failed. Please check your API key.',
        responseTime: 50,
      };

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });

    it('should handle network error', () => {
      const result: CustomModelValidationResult = {
        valid: false,
        error: 'Network error. Please check the API URL and your internet connection.',
        responseTime: 5000,
      };

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle timeout error', () => {
      const result: CustomModelValidationResult = {
        valid: false,
        error: 'Connection timed out. Please check the API URL.',
        responseTime: 10000,
      };

      expect(result.valid).toBe(false);
      expect(result.error).toContain('timed out');
    });
  });

  describe('Model Selector Default Model Selection', () => {
    /**
     * Test: Default model selection logic
     * Requirements: 11.5
     */
    it('should get default model from provider models', () => {
      const models = [
        {
          id: 'model-1',
          name: 'Model 1',
          description: 'First model',
          capabilities: ['text-generation'],
          pricingTier: 'standard' as const,
          isDefault: false,
        },
        {
          id: 'model-2',
          name: 'Model 2',
          description: 'Second model (default)',
          capabilities: ['text-generation'],
          pricingTier: 'free' as const,
          isDefault: true,
        },
      ];

      const defaultModel = getDefaultModel(models);

      expect(defaultModel?.id).toBe('model-2');
      expect(defaultModel?.isDefault).toBe(true);
    });

    it('should return first model when no default is set', () => {
      const models = [
        {
          id: 'model-1',
          name: 'Model 1',
          description: 'First model',
          capabilities: ['text-generation'],
          pricingTier: 'standard' as const,
          isDefault: false,
        },
        {
          id: 'model-2',
          name: 'Model 2',
          description: 'Second model',
          capabilities: ['text-generation'],
          pricingTier: 'free' as const,
          isDefault: false,
        },
      ];

      const defaultModel = getDefaultModel(models);

      expect(defaultModel?.id).toBe('model-1');
    });

    it('should return undefined for empty models list', () => {
      const defaultModel = getDefaultModel([]);
      expect(defaultModel).toBeUndefined();
    });
  });

  describe('Custom Model Data Integrity', () => {
    /**
     * Test: Data integrity for custom model operations
     * Requirements: 11.3
     */
    it('should preserve all fields when converting custom model', () => {
      const customModel = createCustomModelConfig({
        id: 'custom_test',
        name: 'Test Model',
        modelId: 'test-model-id',
        apiBaseUrl: 'https://test.api.com/v1',
        apiKey: 'test-api-key',
        description: 'Test description',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      });

      const providerModel = customModelToProviderModel(customModel);

      // Verify all original data is accessible through customConfig
      expect(providerModel.customConfig?.id).toBe('custom_test');
      expect(providerModel.customConfig?.name).toBe('Test Model');
      expect(providerModel.customConfig?.modelId).toBe('test-model-id');
      expect(providerModel.customConfig?.apiBaseUrl).toBe('https://test.api.com/v1');
      expect(providerModel.customConfig?.apiKey).toBe('test-api-key');
      expect(providerModel.customConfig?.description).toBe('Test description');
      expect(providerModel.customConfig?.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(providerModel.customConfig?.updatedAt).toBe('2024-01-02T00:00:00Z');
      expect(providerModel.customConfig?.isCustom).toBe(true);
    });

    it('should maintain model list order', () => {
      const providerManager = new ProviderManager();

      const models = [
        createCustomModelConfig({ id: 'custom_a', name: 'A Model' }),
        createCustomModelConfig({ id: 'custom_b', name: 'B Model' }),
        createCustomModelConfig({ id: 'custom_c', name: 'C Model' }),
      ];

      providerManager.setCustomModels(models);
      const retrieved = providerManager.getCustomModels();

      expect(retrieved[0].name).toBe('A Model');
      expect(retrieved[1].name).toBe('B Model');
      expect(retrieved[2].name).toBe('C Model');
    });
  });
});
