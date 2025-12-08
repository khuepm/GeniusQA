/**
 * User Preferences Service for GeniusQA Desktop
 *
 * Provides storage and retrieval of user AI provider preferences in Firebase Firestore.
 * Preferences include default provider, model preferences per provider, and last used provider.
 * Preferences are stored per user account and synced across devices.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { app } from '../config/firebase.config';
import { AIProvider } from '../types/providerAdapter.types';

// Collection name for user preferences in Firestore
const USER_PREFERENCES_COLLECTION = 'user_preferences';

/**
 * User provider preferences data structure stored in Firebase
 */
export interface UserProviderPreferences {
  defaultProvider: AIProvider | null;
  modelPreferences: Partial<Record<AIProvider, string>>; // provider -> preferred model
  lastUsedProvider: AIProvider | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Default preferences for new users
 */
const DEFAULT_PREFERENCES: Omit<UserProviderPreferences, 'createdAt' | 'updatedAt'> = {
  defaultProvider: null,
  modelPreferences: {},
  lastUsedProvider: null,
};

/**
 * User Preferences Service class for managing AI provider preferences in Firebase
 */
class UserPreferencesService {
  private db = getFirestore(app);


  /**
   * Store user preferences to Firebase Firestore
   * Creates new preferences or updates existing ones
   *
   * @param userId - The user's unique identifier
   * @param preferences - The preferences data to store
   */
  async storeUserPreferences(
    userId: string,
    preferences: Partial<Omit<UserProviderPreferences, 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const docRef = doc(this.db, USER_PREFERENCES_COLLECTION, userId);
      const existingDoc = await getDoc(docRef);
      const now = Timestamp.now();

      const existingData = existingDoc.exists()
        ? (existingDoc.data() as UserProviderPreferences)
        : null;

      const preferencesData: UserProviderPreferences = {
        defaultProvider: preferences.defaultProvider ?? existingData?.defaultProvider ?? null,
        modelPreferences: {
          ...existingData?.modelPreferences,
          ...preferences.modelPreferences,
        },
        lastUsedProvider: preferences.lastUsedProvider ?? existingData?.lastUsedProvider ?? null,
        createdAt: existingData?.createdAt ?? now,
        updatedAt: now,
      };

      await setDoc(docRef, preferencesData);
    } catch (error) {
      console.error('Failed to store user preferences:', error);
      throw new Error('Failed to store user preferences in Firebase');
    }
  }

  /**
   * Retrieve user preferences from Firebase Firestore
   *
   * @param userId - The user's unique identifier
   * @returns The user preferences, or default preferences if not found
   */
  async getUserPreferences(userId: string): Promise<UserProviderPreferences | null> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const docRef = doc(this.db, USER_PREFERENCES_COLLECTION, userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return docSnap.data() as UserProviderPreferences;
    } catch (error) {
      console.error('Failed to retrieve user preferences:', error);
      throw new Error('Failed to retrieve user preferences from Firebase');
    }
  }

  /**
   * Set default provider for user
   *
   * @param userId - The user's unique identifier
   * @param provider - The provider to set as default
   */
  async setDefaultProvider(userId: string, provider: AIProvider): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!provider) {
      throw new Error('Provider is required');
    }

    try {
      const docRef = doc(this.db, USER_PREFERENCES_COLLECTION, userId);
      const existingDoc = await getDoc(docRef);
      const now = Timestamp.now();

      if (existingDoc.exists()) {
        await updateDoc(docRef, {
          defaultProvider: provider,
          lastUsedProvider: provider,
          updatedAt: now,
        });
      } else {
        await setDoc(docRef, {
          ...DEFAULT_PREFERENCES,
          defaultProvider: provider,
          lastUsedProvider: provider,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (error) {
      console.error('Failed to set default provider:', error);
      throw new Error('Failed to set default provider in Firebase');
    }
  }

  /**
   * Set model preference for a specific provider
   *
   * @param userId - The user's unique identifier
   * @param provider - The AI provider
   * @param modelId - The model ID to set as preferred
   */
  async setModelPreference(
    userId: string,
    provider: AIProvider,
    modelId: string
  ): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!provider) {
      throw new Error('Provider is required');
    }
    if (!modelId) {
      throw new Error('Model ID is required');
    }

    try {
      const docRef = doc(this.db, USER_PREFERENCES_COLLECTION, userId);
      const existingDoc = await getDoc(docRef);
      const now = Timestamp.now();

      if (existingDoc.exists()) {
        const existingData = existingDoc.data() as UserProviderPreferences;
        await updateDoc(docRef, {
          modelPreferences: {
            ...existingData.modelPreferences,
            [provider]: modelId,
          },
          updatedAt: now,
        });
      } else {
        await setDoc(docRef, {
          ...DEFAULT_PREFERENCES,
          modelPreferences: { [provider]: modelId },
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (error) {
      console.error('Failed to set model preference:', error);
      throw new Error('Failed to set model preference in Firebase');
    }
  }

  /**
   * Update last used provider
   *
   * @param userId - The user's unique identifier
   * @param provider - The provider that was last used
   */
  async setLastUsedProvider(userId: string, provider: AIProvider): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!provider) {
      throw new Error('Provider is required');
    }

    try {
      const docRef = doc(this.db, USER_PREFERENCES_COLLECTION, userId);
      const existingDoc = await getDoc(docRef);
      const now = Timestamp.now();

      if (existingDoc.exists()) {
        await updateDoc(docRef, {
          lastUsedProvider: provider,
          updatedAt: now,
        });
      } else {
        await setDoc(docRef, {
          ...DEFAULT_PREFERENCES,
          lastUsedProvider: provider,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (error) {
      console.error('Failed to set last used provider:', error);
      throw new Error('Failed to set last used provider in Firebase');
    }
  }

  /**
   * Delete user preferences from Firebase
   *
   * @param userId - The user's unique identifier
   */
  async deleteUserPreferences(userId: string): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const docRef = doc(this.db, USER_PREFERENCES_COLLECTION, userId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Failed to delete user preferences:', error);
      throw new Error('Failed to delete user preferences from Firebase');
    }
  }

  /**
   * Get model preference for a specific provider
   *
   * @param userId - The user's unique identifier
   * @param provider - The AI provider
   * @returns The preferred model ID, or null if not set
   */
  async getModelPreference(userId: string, provider: AIProvider): Promise<string | null> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!provider) {
      throw new Error('Provider is required');
    }

    try {
      const preferences = await this.getUserPreferences(userId);
      return preferences?.modelPreferences?.[provider] ?? null;
    } catch (error) {
      console.error('Failed to get model preference:', error);
      throw new Error('Failed to get model preference from Firebase');
    }
  }
}

// Export singleton instance
export const userPreferencesService = new UserPreferencesService();

// Export class for testing purposes
export { UserPreferencesService };

export default userPreferencesService;
