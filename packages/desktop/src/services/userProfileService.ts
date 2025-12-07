/**
 * User Profile Service for GeniusQA Desktop
 *
 * Provides storage and retrieval of user profile data in Firebase Firestore.
 * User profiles are stored per user account and synced across devices.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
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

// Collection name for user profiles in Firestore
const USER_PROFILES_COLLECTION = 'user_profiles';

/**
 * User profile data structure stored in Firebase
 */
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Input data for creating/updating user profile
 */
export interface UserProfileInput {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified?: boolean;
  providerId?: string;
}

/**
 * User Profile Service class for managing user profiles in Firebase
 */
class UserProfileService {
  private db = getFirestore(app);


  /**
   * Store user profile to Firebase Firestore
   * Creates a new profile or updates existing one
   *
   * @param userId - The user's unique identifier
   * @param profile - The user profile data to store
   */
  async storeUserProfile(userId: string, profile: UserProfileInput): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const docRef = doc(this.db, USER_PROFILES_COLLECTION, userId);
      const existingDoc = await getDoc(docRef);
      const now = Timestamp.now();

      const profileData: UserProfile = {
        uid: profile.uid,
        email: profile.email,
        displayName: profile.displayName,
        photoURL: profile.photoURL,
        emailVerified: profile.emailVerified ?? false,
        providerId: profile.providerId ?? 'unknown',
        createdAt: existingDoc.exists() 
          ? (existingDoc.data() as UserProfile).createdAt 
          : now,
        updatedAt: now,
      };

      await setDoc(docRef, profileData);
    } catch (error) {
      console.error('Failed to store user profile:', error);
      throw new Error('Failed to store user profile in Firebase');
    }
  }

  /**
   * Retrieve user profile from Firebase Firestore
   *
   * @param userId - The user's unique identifier
   * @returns The user profile, or null if not found
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const docRef = doc(this.db, USER_PROFILES_COLLECTION, userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return docSnap.data() as UserProfile;
    } catch (error) {
      console.error('Failed to retrieve user profile:', error);
      throw new Error('Failed to retrieve user profile from Firebase');
    }
  }

  /**
   * Update specific fields of user profile
   *
   * @param userId - The user's unique identifier
   * @param updates - Partial profile data to update
   */
  async updateUserProfile(
    userId: string,
    updates: Partial<Omit<UserProfile, 'uid' | 'createdAt'>>
  ): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const docRef = doc(this.db, USER_PROFILES_COLLECTION, userId);
      const existingDoc = await getDoc(docRef);

      if (!existingDoc.exists()) {
        throw new Error('User profile not found');
      }

      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw new Error('Failed to update user profile in Firebase');
    }
  }

  /**
   * Delete user profile from Firebase
   *
   * @param userId - The user's unique identifier
   */
  async deleteUserProfile(userId: string): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const docRef = doc(this.db, USER_PROFILES_COLLECTION, userId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Failed to delete user profile:', error);
      throw new Error('Failed to delete user profile from Firebase');
    }
  }

  /**
   * Check if user profile exists
   *
   * @param userId - The user's unique identifier
   * @returns True if profile exists
   */
  async hasUserProfile(userId: string): Promise<boolean> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const docRef = doc(this.db, USER_PROFILES_COLLECTION, userId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error('Failed to check user profile existence:', error);
      throw new Error('Failed to check user profile in Firebase');
    }
  }
}

// Export singleton instance
export const userProfileService = new UserProfileService();

// Export class for testing purposes
export { UserProfileService };

export default userProfileService;
