/**
 * Authentication Context for GeniusQA Desktop
 * Provides global authentication state and actions
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firebaseService from '../services/firebaseService';
import { User, AuthContextType } from '../types/auth.types';

// Storage key for persisting auth state
const AUTH_STORAGE_KEY = '@geniusqa_auth_user';

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider props
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider component
 * Wraps the app and provides authentication state and actions
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to convert Firebase user to app User type
  const mapFirebaseUser = (firebaseUser: FirebaseAuthTypes.User | null): User | null => {
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
  };

  // Persist user to AsyncStorage
  const persistUser = async (userData: User | null) => {
    try {
      if (userData) {
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
      } else {
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (err) {
      console.error('Failed to persist user data:', err);
    }
  };

  // Load persisted user from AsyncStorage
  const loadPersistedUser = async () => {
    try {
      const userData = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (err) {
      console.error('Failed to load persisted user:', err);
    }
  };

  // Initialize Firebase and setup auth state listener
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initializeAuth = async () => {
      try {
        // Initialize Firebase service
        await firebaseService.initialize();

        // Load persisted user
        await loadPersistedUser();

        // Setup auth state listener
        unsubscribe = firebaseService.onAuthStateChanged((firebaseUser) => {
          const mappedUser = mapFirebaseUser(firebaseUser);
          setUser(mappedUser);
          persistUser(mappedUser);
          setLoading(false);
        });
      } catch (err: any) {
        console.error('Failed to initialize auth:', err);
        setError(err.message || 'Không thể khởi tạo xác thực');
        setLoading(false);
      }
    };

    initializeAuth();

    // Cleanup listener on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  /**
   * Sign in with Google OAuth
   */
  const signInWithGoogle = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await firebaseService.signInWithGoogle();
      // User state will be updated by onAuthStateChanged listener
    } catch (err: any) {
      console.error('Google sign in failed:', err);
      setError(err.message || 'Đăng nhập Google thất bại');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign in with email and password
   */
  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await firebaseService.signInWithEmail(email, password);
      // User state will be updated by onAuthStateChanged listener
    } catch (err: any) {
      console.error('Email sign in failed:', err);
      setError(err.message || 'Đăng nhập thất bại');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign up with email and password
   */
  const signUpWithEmail = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await firebaseService.signUpWithEmail(email, password);
      // User state will be updated by onAuthStateChanged listener
    } catch (err: any) {
      console.error('Email sign up failed:', err);
      setError(err.message || 'Đăng ký thất bại');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign out the current user
   */
  const signOut = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await firebaseService.signOut();
      setUser(null);
      await persistUser(null);
    } catch (err: any) {
      console.error('Sign out failed:', err);
      setError(err.message || 'Đăng xuất thất bại');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to use the AuthContext
 * Throws an error if used outside of AuthProvider
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
