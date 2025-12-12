/**
 * Custom Model Service for GeniusQA Desktop
 *
 * Provides CRUD operations for user-defined custom AI models.
 * Custom models allow users to add any OpenAI-compatible API endpoint.
 * API keys are encrypted before storage and decrypted on retrieval.
 *
 * Requirements: 11.3, 11.4, 11.7, 11.8, 11.9
 */

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { app } from '../config/firebase.config';
import { encryptApiKey, decryptApiKey } from '../utils/encryption';
import {
  CustomModelConfig,
  CustomModelFormData,
  CustomModelValidationResult,
} from '../types/providerAdapter.types';

// Collection name for custom models in Firestore
const CUSTOM_MODELS_COLLECTION = 'custom_models';

/**
 * Stored custom model data structure (with encrypted API key)
 */
interface StoredCustomModelData {
  id: string;
  name: string;
  modelId: string;
  apiBaseUrl: string;
  encryptedApiKey: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * User's custom models document structure in Firestore
 * Structure: custom_models/{userId} -> { models: [...] }
 */
interface UserCustomModelsData {
  models: StoredCustomModelData[];
}

/**
 * Generate a unique ID for custom models
 */
function generateId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}


/**
 * Custom Model Service class for managing user-defined AI models
 */
class CustomModelService {
  private db = getFirestore(app);

  /**
   * Add a new custom model with encrypted API key
   * Requirements: 11.3
   *
   * @param userId - The user's unique identifier
   * @param config - The custom model form data
   * @returns The created custom model configuration
   */
  async addCustomModel(
    userId: string,
    config: CustomModelFormData
  ): Promise<CustomModelConfig> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    this.validateFormData(config);

    try {
      const now = new Date().toISOString();
      const id = generateId();
      const encryptedKey = encryptApiKey(config.apiKey);

      const storedModel: StoredCustomModelData = {
        id,
        name: config.name,
        modelId: config.modelId,
        apiBaseUrl: config.apiBaseUrl,
        encryptedApiKey: encryptedKey,
        description: config.description,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = doc(this.db, CUSTOM_MODELS_COLLECTION, userId);
      const existingDoc = await getDoc(docRef);
      const existingData = existingDoc.exists()
        ? (existingDoc.data() as UserCustomModelsData)
        : { models: [] };

      // Check for duplicate names
      if (existingData.models.some((m) => m.name === config.name)) {
        throw new Error(`A custom model with name "${config.name}" already exists`);
      }

      existingData.models.push(storedModel);
      await setDoc(docRef, existingData);

      return this.toCustomModelConfig(storedModel);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      console.error('Failed to add custom model:', error);
      throw new Error('Failed to add custom model to Firebase');
    }
  }

  /**
   * Update an existing custom model
   * Requirements: 11.7
   *
   * @param userId - The user's unique identifier
   * @param modelId - The custom model's unique identifier
   * @param config - Partial custom model form data to update
   * @returns The updated custom model configuration
   */
  async updateCustomModel(
    userId: string,
    modelId: string,
    config: Partial<CustomModelFormData>
  ): Promise<CustomModelConfig> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!modelId) {
      throw new Error('Model ID is required');
    }

    try {
      const docRef = doc(this.db, CUSTOM_MODELS_COLLECTION, userId);
      const existingDoc = await getDoc(docRef);

      if (!existingDoc.exists()) {
        throw new Error('Custom model not found');
      }

      const existingData = existingDoc.data() as UserCustomModelsData;
      const modelIndex = existingData.models.findIndex((m) => m.id === modelId);

      if (modelIndex === -1) {
        throw new Error('Custom model not found');
      }

      // Check for duplicate names (excluding current model)
      if (
        config.name &&
        existingData.models.some((m, i) => i !== modelIndex && m.name === config.name)
      ) {
        throw new Error(`A custom model with name "${config.name}" already exists`);
      }

      const existingModel = existingData.models[modelIndex];
      const now = new Date().toISOString();

      const updatedModel: StoredCustomModelData = {
        ...existingModel,
        name: config.name ?? existingModel.name,
        modelId: config.modelId ?? existingModel.modelId,
        apiBaseUrl: config.apiBaseUrl ?? existingModel.apiBaseUrl,
        encryptedApiKey: config.apiKey
          ? encryptApiKey(config.apiKey)
          : existingModel.encryptedApiKey,
        description: config.description ?? existingModel.description,
        updatedAt: now,
      };

      existingData.models[modelIndex] = updatedModel;
      await setDoc(docRef, existingData);

      return this.toCustomModelConfig(updatedModel);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      console.error('Failed to update custom model:', error);
      throw new Error('Failed to update custom model in Firebase');
    }
  }


  /**
   * Delete a custom model
   * Requirements: 11.8
   *
   * @param userId - The user's unique identifier
   * @param modelId - The custom model's unique identifier
   */
  async deleteCustomModel(userId: string, modelId: string): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!modelId) {
      throw new Error('Model ID is required');
    }

    try {
      const docRef = doc(this.db, CUSTOM_MODELS_COLLECTION, userId);
      const existingDoc = await getDoc(docRef);

      if (!existingDoc.exists()) {
        return; // Nothing to delete
      }

      const existingData = existingDoc.data() as UserCustomModelsData;
      const modelIndex = existingData.models.findIndex((m) => m.id === modelId);

      if (modelIndex === -1) {
        return; // Model not found, nothing to delete
      }

      existingData.models.splice(modelIndex, 1);
      await setDoc(docRef, existingData);
    } catch (error) {
      console.error('Failed to delete custom model:', error);
      throw new Error('Failed to delete custom model from Firebase');
    }
  }

  /**
   * Get all custom models for a user
   * Requirements: 11.5
   *
   * @param userId - The user's unique identifier
   * @returns Array of custom model configurations
   */
  async getCustomModels(userId: string): Promise<CustomModelConfig[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const docRef = doc(this.db, CUSTOM_MODELS_COLLECTION, userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return [];
      }

      const data = docSnap.data() as UserCustomModelsData;
      return data.models.map((m) => this.toCustomModelConfig(m));
    } catch (error) {
      console.error('Failed to get custom models:', error);
      throw new Error('Failed to get custom models from Firebase');
    }
  }

  /**
   * Get a single custom model by ID
   *
   * @param userId - The user's unique identifier
   * @param modelId - The custom model's unique identifier
   * @returns The custom model configuration, or null if not found
   */
  async getCustomModel(
    userId: string,
    modelId: string
  ): Promise<CustomModelConfig | null> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!modelId) {
      throw new Error('Model ID is required');
    }

    try {
      const docRef = doc(this.db, CUSTOM_MODELS_COLLECTION, userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data() as UserCustomModelsData;
      const model = data.models.find((m) => m.id === modelId);

      if (!model) {
        return null;
      }

      return this.toCustomModelConfig(model);
    } catch (error) {
      console.error('Failed to get custom model:', error);
      throw new Error('Failed to get custom model from Firebase');
    }
  }

  /**
   * Validate a custom model API connection
   * Tests the API endpoint with a simple request
   * Requirements: 11.4, 11.9
   *
   * @param config - The custom model form data to validate
   * @returns Validation result with success status and response time
   */
  async validateCustomModel(
    config: CustomModelFormData
  ): Promise<CustomModelValidationResult> {
    this.validateFormData(config);

    const startTime = Date.now();

    try {
      // Construct the API URL for models endpoint (OpenAI-compatible)
      const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
      const modelsUrl = `${baseUrl}/models`;

      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        
        if (response.status === 401 || response.status === 403) {
          return {
            valid: false,
            error: 'Authentication failed. Please check your API key.',
            responseTime,
          };
        }
        
        if (response.status === 404) {
          // Try a chat completion endpoint as fallback
          return await this.validateWithChatEndpoint(config, startTime);
        }

        return {
          valid: false,
          error: `API error (${response.status}): ${errorText}`,
          responseTime,
        };
      }

      return {
        valid: true,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          return {
            valid: false,
            error: 'Connection timed out. Please check the API URL.',
            responseTime,
          };
        }

        if (error.message.includes('fetch')) {
          return {
            valid: false,
            error: 'Network error. Please check the API URL and your internet connection.',
            responseTime,
          };
        }

        return {
          valid: false,
          error: error.message,
          responseTime,
        };
      }

      return {
        valid: false,
        error: 'Unknown error occurred during validation',
        responseTime,
      };
    }
  }


  /**
   * Fallback validation using chat completions endpoint
   * Some APIs don't expose /models but do support chat completions
   */
  private async validateWithChatEndpoint(
    config: CustomModelFormData,
    startTime: number
  ): Promise<CustomModelValidationResult> {
    try {
      const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
      const chatUrl = `${baseUrl}/chat/completions`;

      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.modelId,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(15000), // 15 second timeout for chat
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');

        if (response.status === 401 || response.status === 403) {
          return {
            valid: false,
            error: 'Authentication failed. Please check your API key.',
            responseTime,
          };
        }

        return {
          valid: false,
          error: `API error (${response.status}): ${errorText}`,
          responseTime,
        };
      }

      return {
        valid: true,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error instanceof Error) {
        return {
          valid: false,
          error: error.message,
          responseTime,
        };
      }

      return {
        valid: false,
        error: 'Unknown error occurred during validation',
        responseTime,
      };
    }
  }

  /**
   * Validate form data before processing
   */
  private validateFormData(config: CustomModelFormData): void {
    if (!config.name || config.name.trim() === '') {
      throw new Error('Model name is required');
    }
    if (!config.modelId || config.modelId.trim() === '') {
      throw new Error('Model ID is required');
    }
    if (!config.apiBaseUrl || config.apiBaseUrl.trim() === '') {
      throw new Error('API Base URL is required');
    }
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('API Key is required');
    }

    // Validate URL format
    try {
      new URL(config.apiBaseUrl);
    } catch {
      throw new Error('Invalid API Base URL format');
    }
  }

  /**
   * Convert stored model data to CustomModelConfig
   */
  private toCustomModelConfig(stored: StoredCustomModelData): CustomModelConfig {
    return {
      id: stored.id,
      name: stored.name,
      modelId: stored.modelId,
      apiBaseUrl: stored.apiBaseUrl,
      apiKey: decryptApiKey(stored.encryptedApiKey),
      description: stored.description,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      isCustom: true,
    };
  }
}

// Export singleton instance
export const customModelService = new CustomModelService();

// Export class for testing purposes
export { CustomModelService };

export default customModelService;
