/**
 * Firebase Authentication Service for GeniusQA Desktop
 * Provides authentication methods using Firebase Web SDK
 */

import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User as FirebaseUser,
  UserCredential
} from 'firebase/auth';
import { app } from '../config/firebase.config';
import { User, getAuthErrorMessage } from '../types/auth.types';
import oauthService from './oauthService';
import { getEnvVar } from '../utils/env';

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
   * Sign in with Google OAuth using external browser (Tauri-compatible)
   * Opens OAuth URL in external browser and returns URL for user to copy
   * @returns OAuth URL string that user should open in browser
   */
  async signInWithGoogleExternalBrowser(): Promise<string> {
    try {
      const clientId = getEnvVar('GOOGLE_CLIENT_ID');
      const authUrl = oauthService.generateGoogleOAuthUrl(clientId);
      
      // Try to open in external browser
      try {
        await oauthService.openOAuthInBrowser(authUrl);
      } catch (openError) {
        console.warn('Failed to auto-open browser:', openError);
        // Continue anyway - user can manually open the URL
      }
      
      return authUrl;
    } catch (error: any) {
      console.error('Google auth URL generation error:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  }

  /**
   * Complete Google sign-in with authorization code
   * @param code Authorization code from OAuth flow
   * @returns User credential
   */
  async signInWithGoogleCode(code: string): Promise<UserCredential> {
    try {
      // Exchange code for credential
      // Note: This requires server-side token exchange in production
      // For now, we'll use a workaround with Firebase's credential exchange
      
      const clientId = getEnvVar('GOOGLE_CLIENT_ID');
      
      // Use Google's token endpoint to exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const tokens = await tokenResponse.json();
      
      // Create Firebase credential from Google ID token
      const credential = GoogleAuthProvider.credential(tokens.id_token);
      
      // Sign in with credential
      const userCredential = await signInWithCredential(this.auth, credential);
      return userCredential;
    } catch (error: any) {
      console.error('Google code exchange error:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  }

  /**
   * Sign in with Google - uses popup in web, external browser in desktop
   * @returns User credential
   */
  async signInWithGoogle(): Promise<UserCredential> {
    try {
      // Check if running in Tauri environment
      const isTauri = '__TAURI__' in window;
      
      if (isTauri) {
        // For Tauri, throw error to indicate manual flow needed
        throw new Error('MANUAL_FLOW_REQUIRED');
      } else {
        // Fallback to popup for web environment
        const userCredential = await signInWithPopup(this.auth, this.googleProvider);
        return userCredential;
      }
    } catch (error: any) {
      console.error('Google sign in error:', error);
      
      // Handle specific Google Sign-In errors
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error(getAuthErrorMessage({ code: 'auth/cancelled-popup-request' }));
      } else if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup bị chặn. Vui lòng cho phép popup hoặc thử lại.');
      }
      
      throw error;
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
