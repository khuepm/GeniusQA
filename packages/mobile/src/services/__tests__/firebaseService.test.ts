/**
 * Unit tests for Firebase Authentication Service
 */

import firebaseService from '../firebaseService';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock Firebase Auth
jest.mock('@react-native-firebase/auth');
jest.mock('@react-native-google-signin/google-signin');
jest.mock('@react-native-async-storage/async-storage');

describe('FirebaseAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should configure Google Sign-In successfully', async () => {
      await firebaseService.initialize();
      
      expect(GoogleSignin.configure).toHaveBeenCalledWith({
        webClientId: expect.any(String),
      });
    });

    it('should not reinitialize if already initialized', async () => {
      await firebaseService.initialize();
      await firebaseService.initialize();
      
      expect(GoogleSignin.configure).toHaveBeenCalledTimes(1);
    });
  });

  describe('signInWithEmail', () => {
    it('should sign in successfully with valid credentials', async () => {
      const mockUserCredential = {
        user: { uid: '123', email: 'test@example.com' },
      };
      
      (auth as any).mockReturnValue({
        signInWithEmailAndPassword: jest.fn().mockResolvedValue(mockUserCredential),
      });

      const result = await firebaseService.signInWithEmail('test@example.com', 'password123');
      
      expect(result).toEqual(mockUserCredential);
    });

    it('should throw error with invalid credentials', async () => {
      const mockError = { code: 'auth/wrong-password' };
      
      (auth as any).mockReturnValue({
        signInWithEmailAndPassword: jest.fn().mockRejectedValue(mockError),
      });

      await expect(
        firebaseService.signInWithEmail('test@example.com', 'wrongpassword')
      ).rejects.toThrow();
    });

    it('should throw error with invalid email format', async () => {
      const mockError = { code: 'auth/invalid-email' };
      
      (auth as any).mockReturnValue({
        signInWithEmailAndPassword: jest.fn().mockRejectedValue(mockError),
      });

      await expect(
        firebaseService.signInWithEmail('invalid-email', 'password123')
      ).rejects.toThrow();
    });
  });

  describe('signUpWithEmail', () => {
    it('should create account successfully with valid data', async () => {
      const mockUserCredential = {
        user: { uid: '456', email: 'newuser@example.com' },
      };
      
      (auth as any).mockReturnValue({
        createUserWithEmailAndPassword: jest.fn().mockResolvedValue(mockUserCredential),
      });

      const result = await firebaseService.signUpWithEmail('newuser@example.com', 'password123');
      
      expect(result).toEqual(mockUserCredential);
    });

    it('should throw error when email already exists', async () => {
      const mockError = { code: 'auth/email-already-in-use' };
      
      (auth as any).mockReturnValue({
        createUserWithEmailAndPassword: jest.fn().mockRejectedValue(mockError),
      });

      await expect(
        firebaseService.signUpWithEmail('existing@example.com', 'password123')
      ).rejects.toThrow();
    });

    it('should throw error with weak password', async () => {
      const mockError = { code: 'auth/weak-password' };
      
      (auth as any).mockReturnValue({
        createUserWithEmailAndPassword: jest.fn().mockRejectedValue(mockError),
      });

      await expect(
        firebaseService.signUpWithEmail('test@example.com', '123')
      ).rejects.toThrow();
    });
  });

  describe('signInWithGoogle', () => {
    it('should sign in successfully with Google', async () => {
      const mockIdToken = 'mock-id-token';
      const mockCredential = { token: 'mock-credential' };
      const mockUserCredential = {
        user: { uid: '789', email: 'google@example.com' },
      };

      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ idToken: mockIdToken });
      (auth.GoogleAuthProvider.credential as jest.Mock).mockReturnValue(mockCredential);
      (auth as any).mockReturnValue({
        signInWithCredential: jest.fn().mockResolvedValue(mockUserCredential),
      });

      const result = await firebaseService.signInWithGoogle();
      
      expect(GoogleSignin.hasPlayServices).toHaveBeenCalled();
      expect(GoogleSignin.signIn).toHaveBeenCalled();
      expect(result).toEqual(mockUserCredential);
    });

    it('should throw error when sign in is cancelled', async () => {
      const mockError = { code: 'SIGN_IN_CANCELLED' };

      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
      (GoogleSignin.signIn as jest.Mock).mockRejectedValue(mockError);

      await expect(firebaseService.signInWithGoogle()).rejects.toThrow();
    });

    it('should throw error when Play Services not available', async () => {
      const mockError = { code: 'PLAY_SERVICES_NOT_AVAILABLE' };

      (GoogleSignin.hasPlayServices as jest.Mock).mockRejectedValue(mockError);

      await expect(firebaseService.signInWithGoogle()).rejects.toThrow();
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      (GoogleSignin.isSignedIn as jest.Mock).mockResolvedValue(true);
      (GoogleSignin.signOut as jest.Mock).mockResolvedValue(undefined);
      (auth as any).mockReturnValue({
        signOut: jest.fn().mockResolvedValue(undefined),
      });
      (AsyncStorage.clear as jest.Mock).mockResolvedValue(undefined);

      await firebaseService.signOut();
      
      expect(GoogleSignin.signOut).toHaveBeenCalled();
      expect(AsyncStorage.clear).toHaveBeenCalled();
    });

    it('should clear storage even if Google sign out fails', async () => {
      (GoogleSignin.isSignedIn as jest.Mock).mockResolvedValue(false);
      (auth as any).mockReturnValue({
        signOut: jest.fn().mockResolvedValue(undefined),
      });
      (AsyncStorage.clear as jest.Mock).mockResolvedValue(undefined);

      await firebaseService.signOut();
      
      expect(GoogleSignin.signOut).not.toHaveBeenCalled();
      expect(AsyncStorage.clear).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user when authenticated', () => {
      const mockUser = { uid: '123', email: 'test@example.com' };
      (auth as any).mockReturnValue({
        currentUser: mockUser,
      });

      const user = firebaseService.getCurrentUser();
      
      expect(user).toEqual(mockUser);
    });

    it('should return null when not authenticated', () => {
      (auth as any).mockReturnValue({
        currentUser: null,
      });

      const user = firebaseService.getCurrentUser();
      
      expect(user).toBeNull();
    });
  });

  describe('onAuthStateChanged', () => {
    it('should setup auth state listener', () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();
      
      (auth as any).mockReturnValue({
        onAuthStateChanged: jest.fn().mockReturnValue(mockUnsubscribe),
      });

      const unsubscribe = firebaseService.onAuthStateChanged(mockCallback);
      
      expect(auth().onAuthStateChanged).toHaveBeenCalledWith(mockCallback);
      expect(unsubscribe).toBe(mockUnsubscribe);
    });
  });
});
