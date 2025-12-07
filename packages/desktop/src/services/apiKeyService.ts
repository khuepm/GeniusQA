/**
 * API Key Service for GeniusQA Desktop
 *
 * Provides secure storage and retrieval of AI provider API keys using Firebase Firestore.
 * Keys are encrypted before storage and decrypted on retrieval.
 * Supports multiple providers (Gemini, OpenAI, Anthropic, Azure) per user.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { app } from '../config/firebase.config';
import { encryptApiKey, decryptApiKey } from '../utils/encryption';
import {
  AIProvider,
  PROVIDER_CONFIGS,
  SUPPORTED_PROVIDERS,
} from '../types/providerAdapter.types';

// Re-export AIProvider for backward compatibility
export type { AIProvider } from '../types/providerAdapter.types';

// Collection name for API keys in Firestore
const API_KEYS_COLLECTION = 'api_keys';

/**
 * List of supported AI providers with display information
 * Derived from PROVIDER_CONFIGS for consistency
 */
export const AI_PROVIDERS: { id: AIProvider; name: string; description: string }[] =
  SUPPORTED_PROVIDERS.map((id) => ({
    id,
    name: PROVIDER_CONFIGS[id].name,
    description: PROVIDER_CONFIGS[id].description,
  }));

/**
 * Stored API key data structure for a single provider
 */
interface ProviderKeyData {
  encryptedKey: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * User's API keys document structure in Firestore
 * Structure: api_keys/{userId} -> { gemini: {...}, openai: {...}, ... }
 */
interface UserApiKeysData {
  [provider: string]: ProviderKeyData;
}

// Re-export encryption functions for backward compatibility
export { encryptApiKey, decryptApiKey } from '../utils/encryption';

/**
 * API Key Service class for managing AI provider API keys in Firebase
 */
class ApiKeyService {
  private db = getFirestore(app);

  /**
   * Store an encrypted API key for a specific provider
   * If a key already exists for this provider, it will be replaced
   *
   * @param userId - The user's unique identifier
   * @param provider - The AI provider (gemini, openai, etc.)
   * @param apiKey - The plain text API key to store
   */
  async storeApiKey(userId: string, provider: AIProvider, apiKey: string): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!provider) {
      throw new Error('Provider is required');
    }
    if (!apiKey) {
      throw new Error('API key is required');
    }

    try {
      const encryptedKey = encryptApiKey(apiKey);
      const now = Timestamp.now();

      const docRef = doc(this.db, API_KEYS_COLLECTION, userId);
      const existingDoc = await getDoc(docRef);
      const existingData = existingDoc.exists() ? (existingDoc.data() as UserApiKeysData) : {};

      const providerData: ProviderKeyData = {
        encryptedKey,
        createdAt: existingData[provider]?.createdAt || now,
        updatedAt: now,
      };

      await setDoc(docRef, {
        ...existingData,
        [provider]: providerData,
      });
    } catch (error) {
      console.error(`Failed to store ${provider} API key:`, error);
      throw new Error(`Failed to store ${provider} API key in Firebase`);
    }
  }

  /**
   * Retrieve and decrypt an API key for a specific provider
   *
   * @param userId - The user's unique identifier
   * @param provider - The AI provider (gemini, openai, etc.)
   * @returns The decrypted API key, or null if not found
   */
  async getApiKey(userId: string, provider: AIProvider): Promise<string | null> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!provider) {
      throw new Error('Provider is required');
    }

    try {
      const docRef = doc(this.db, API_KEYS_COLLECTION, userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data() as UserApiKeysData;
      const providerData = data[provider];

      if (!providerData?.encryptedKey) {
        return null;
      }

      return decryptApiKey(providerData.encryptedKey);
    } catch (error) {
      console.error(`Failed to retrieve ${provider} API key:`, error);
      throw new Error(`Failed to retrieve ${provider} API key from Firebase`);
    }
  }

  /**
   * Check if a user has an API key configured for a specific provider
   *
   * @param userId - The user's unique identifier
   * @param provider - The AI provider (gemini, openai, etc.)
   * @returns True if the user has an API key stored for this provider
   */
  async hasApiKey(userId: string, provider: AIProvider): Promise<boolean> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!provider) {
      throw new Error('Provider is required');
    }

    try {
      const docRef = doc(this.db, API_KEYS_COLLECTION, userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return false;
      }

      const data = docSnap.data() as UserApiKeysData;
      return !!data[provider]?.encryptedKey;
    } catch (error) {
      console.error(`Failed to check ${provider} API key existence:`, error);
      throw new Error(`Failed to check ${provider} API key in Firebase`);
    }
  }

  /**
   * Get all configured providers for a user
   *
   * @param userId - The user's unique identifier
   * @returns Array of provider names that have API keys configured
   */
  async getConfiguredProviders(userId: string): Promise<AIProvider[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const docRef = doc(this.db, API_KEYS_COLLECTION, userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return [];
      }

      const data = docSnap.data() as UserApiKeysData;
      return Object.keys(data).filter(
        (key) => data[key]?.encryptedKey
      ) as AIProvider[];
    } catch (error) {
      console.error('Failed to get configured providers:', error);
      throw new Error('Failed to get configured providers from Firebase');
    }
  }

  /**
   * Delete a user's API key for a specific provider
   *
   * @param userId - The user's unique identifier
   * @param provider - The AI provider (gemini, openai, etc.)
   */
  async deleteApiKey(userId: string, provider: AIProvider): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!provider) {
      throw new Error('Provider is required');
    }

    try {
      const docRef = doc(this.db, API_KEYS_COLLECTION, userId);
      const existingDoc = await getDoc(docRef);

      if (!existingDoc.exists()) {
        return;
      }

      const existingData = existingDoc.data() as UserApiKeysData;
      delete existingData[provider];

      // If no more providers, delete the entire document
      if (Object.keys(existingData).length === 0) {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, existingData);
      }
    } catch (error) {
      console.error(`Failed to delete ${provider} API key:`, error);
      throw new Error(`Failed to delete ${provider} API key from Firebase`);
    }
  }

  /**
   * Delete all API keys for a user
   *
   * @param userId - The user's unique identifier
   */
  async deleteAllApiKeys(userId: string): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const docRef = doc(this.db, API_KEYS_COLLECTION, userId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Failed to delete all API keys:', error);
      throw new Error('Failed to delete all API keys from Firebase');
    }
  }
}

// Export singleton instance
export const apiKeyService = new ApiKeyService();

// Export class for testing purposes
export { ApiKeyService };

export default apiKeyService;
