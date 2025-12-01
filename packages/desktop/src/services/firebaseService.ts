/**
 * Firebase Authentication Service for GeniusQA Desktop
 * Provides authentication methods using Firebase Web SDK
 */

import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User as FirebaseUser,
  UserCredential
} from 'firebase/auth';
import { app } from '../config/firebase.config';
import { User, getAuthErrorMessage } from '../types/auth.types';

class FirebaseAuthService {
  private auth = getAuth(app);
  private googleProvider = new GoogleAuthProvider();
  private initialized = false;

  /**
   * Initialize Firebase Auth
   * Must be called before using any auth methods
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.initialized = true;
      
      // Check for pending redirect result (after OAuth redirect)
      const result = await getRedirectResult(this.auth);
      if (result) {
        console.log('OAuth redirect completed successfully:', result.user.email);
      }
      
      console.log('Firebase Auth Service initialized');
    } catch (error) {
      console.error('Failed to initialize Firebase Auth Service:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  }

  /**
   * Get the currently authenticated user
   * @returns Current user or null if not authenticated
   */
  getCurrentUser(): FirebaseUser | null {
    return this.auth.currentUser;
  }

  /**
   * Listen to authentication state changes
   * @param callback Function to call when auth state changes
   * @returns Unsubscribe function
   */
  onAuthStateChanged(
    callback: (user: FirebaseUser | null) => void
  ): () => void {
    return firebaseOnAuthStateChanged(this.auth, callback);
  }

  /**
   * Sign in with email and password
   * @param email User's email address
   * @param password User's password
   * @returns User credential
   */
  async signInWithEmail(
    email: string,
    password: string
  ): Promise<UserCredential> {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      return userCredential;
    } catch (error) {
      console.error('Email sign in error:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  }

  /**
   * Sign up with email and password
   * @param email User's email address
   * @param password User's password
   * @returns User credential
   */
  async signUpWithEmail(
    email: string,
    password: string
  ): Promise<UserCredential> {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      return userCredential;
    } catch (error) {
      console.error('Email sign up error:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  }

  /**
   * Sign in with Google OAuth using redirect (Tauri-compatible)
   * @returns User credential (or throws to indicate redirect in progress)
   */
  async signInWithGoogle(): Promise<UserCredential> {
    try {
      // Check if running in Tauri environment
      const isTauri = '__TAURI__' in window;
      
      if (isTauri) {
        // Configure Google provider for redirect
        this.googleProvider.setCustomParameters({
          prompt: 'select_account'
        });
        
        // Use signInWithRedirect for Tauri (opens in system browser)
        await signInWithRedirect(this.auth, this.googleProvider);
        
        // This will redirect the app, so we throw to indicate redirect in progress
        // The actual result will be handled in initialize() after redirect
        throw new Error('REDIRECT_IN_PROGRESS');
      } else {
        // Fallback to popup for web environment
        const userCredential = await signInWithPopup(this.auth, this.googleProvider);
        return userCredential;
      }
    } catch (error: any) {
      console.error('Google sign in error:', error);
      
      // Don't treat redirect as an error
      if (error.message === 'REDIRECT_IN_PROGRESS') {
        throw error;
      }
      
      // Handle specific Google Sign-In errors
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error(getAuthErrorMessage({ code: 'auth/cancelled-popup-request' }));
      } else if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup bị chặn. Vui lòng cho phép popup hoặc thử lại.');
      }
      
      throw new Error(getAuthErrorMessage(error));
    }
  }

  /**
   * Sign out the current user
   * Clears Firebase auth and local storage
   */
  async signOut(): Promise<void> {
    try {
      // Sign out from Firebase
      await firebaseSignOut(this.auth);

      // Clear local storage
      localStorage.clear();

      console.log('User signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  }

  /**
   * Convert Firebase user to app User type
   */
  private mapFirebaseUser(firebaseUser: FirebaseUser | null): User | null {
    if (!firebaseUser) {
      return null;
    }

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      emailVerified: firebaseUser.emailVerified,
      providerId: firebaseUser.providerData[0]?.providerId || 'unknown',
    };
  }
}

// Export singleton instance
export default new FirebaseAuthService();
