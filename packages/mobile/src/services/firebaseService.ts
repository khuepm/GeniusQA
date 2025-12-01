/**
 * Firebase Authentication Service for GeniusQA Mobile
 * Provides authentication methods using Firebase
 */

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebaseConfig from '../config/firebase.config';
import { User, getAuthErrorMessage } from '../types/auth.types';

class FirebaseAuthService {
  private initialized = false;

  /**
   * Initialize Firebase and Google Sign-In
   * Must be called before using any auth methods
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Configure Google Sign-In
      GoogleSignin.configure({
        webClientId: firebaseConfig.webClientId,
      });

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
  getCurrentUser(): FirebaseAuthTypes.User | null {
    return auth().currentUser;
  }

  /**
   * Listen to authentication state changes
   * @param callback Function to call when auth state changes
   * @returns Unsubscribe function
   */
  onAuthStateChanged(
    callback: (user: FirebaseAuthTypes.User | null) => void
  ): () => void {
    return auth().onAuthStateChanged(callback);
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
  ): Promise<FirebaseAuthTypes.UserCredential> {
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
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
  ): Promise<FirebaseAuthTypes.UserCredential> {
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      return userCredential;
    } catch (error) {
      console.error('Email sign up error:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  }

  /**
   * Sign in with Google OAuth
   * @returns User credential
   */
  async signInWithGoogle(): Promise<FirebaseAuthTypes.UserCredential> {
    try {
      // Check if device supports Google Play services
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Get user's ID token
      const { idToken } = await GoogleSignin.signIn();

      // Create a Google credential with the token
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);

      // Sign in with the credential
      const userCredential = await auth().signInWithCredential(googleCredential);
      return userCredential;
    } catch (error: any) {
      console.error('Google sign in error:', error);
      
      // Handle specific Google Sign-In errors
      if (error.code === 'SIGN_IN_CANCELLED') {
        throw new Error(getAuthErrorMessage({ code: 'auth/cancelled-popup-request' }));
      } else if (error.code === 'IN_PROGRESS') {
        throw new Error('Đăng nhập đang được xử lý');
      } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        throw new Error('Google Play Services không khả dụng');
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
      // Sign out from Google if user was signed in with Google
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (isSignedIn) {
        await GoogleSignin.signOut();
      }

      // Sign out from Firebase
      await auth().signOut();

      // Clear local storage
      await AsyncStorage.clear();

      console.log('User signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  }

  /**
   * Convert Firebase user to app User type
   */
  private mapFirebaseUser(firebaseUser: FirebaseAuthTypes.User | null): User | null {
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
