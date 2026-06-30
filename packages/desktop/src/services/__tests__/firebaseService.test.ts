/**
 * Unit tests for Firebase Authentication Service
 *
 * The service uses the Firebase Web SDK (standalone functions like
 * `signInWithEmailAndPassword(auth, ...)`), the Tauri-aware oauthService,
 * and the Vite `getEnvVar` helper. We mock all three so the singleton can be
 * exercised without a real Firebase app or browser environment.
 */

// Mock the env utility (path is relative to this test file: src/services/__tests__)
jest.mock('../../utils/env', () => ({
  getEnvVar: jest.fn((key: string, fallback?: string) => {
    const mockEnv: Record<string, string> = {
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'test-auth-domain',
      VITE_FIREBASE_PROJECT_ID: 'test-project-id',
      VITE_FIREBASE_STORAGE_BUCKET: 'test-storage-bucket',
      VITE_FIREBASE_MESSAGING_SENDER_ID: 'test-sender-id',
      VITE_FIREBASE_APP_ID: 'test-app-id',
      VITE_GOOGLE_WEB_CLIENT_ID: 'test-google-client-id',
      VITE_GOOGLE_CLIENT_ID: 'test-google-client-id',
    };
    const viteKey = key.startsWith('VITE_') ? key : `VITE_${key}`;
    return mockEnv[viteKey] ?? fallback ?? '';
  }),
  getRequiredEnvVar: jest.fn((key: string) => `test-${key}`),
  hasEnvVar: jest.fn(() => true),
}));

// Mock the Firebase app config so importing the service does not bootstrap Firebase
jest.mock('../../config/firebase.config', () => ({
  app: { name: 'test-app' },
}));

// Mock the Tauri-aware OAuth service
jest.mock('../oauthService', () => ({
  __esModule: true,
  default: {
    generateGoogleOAuthUrl: jest.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth?mock=1'),
    openOAuthInBrowser: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock the Firebase Web SDK auth module (standalone functions).
// All mock fns and the mutable auth object live INSIDE the factory because
// jest.mock is hoisted above any module-scope declarations.
jest.mock('firebase/auth', () => {
  const mockAuth: { currentUser: any } = { currentUser: null };
  const GoogleAuthProvider = jest.fn().mockImplementation(() => ({}));
  (GoogleAuthProvider as any).credential = jest.fn(() => ({
    providerId: 'google.com',
    token: 'mock-credential',
  }));
  return {
    __mockAuth: mockAuth,
    getAuth: jest.fn(() => mockAuth),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signInWithPopup: jest.fn(),
    signInWithCredential: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
    GoogleAuthProvider,
  };
});

import firebaseService from '../firebaseService';
import oauthService from '../oauthService';
import * as firebaseAuth from 'firebase/auth';

// Typed handles to the mocked standalone functions
const mockAuth = (firebaseAuth as any).__mockAuth as { currentUser: any };
const mockSignInWithEmailAndPassword = firebaseAuth.signInWithEmailAndPassword as jest.Mock;
const mockCreateUserWithEmailAndPassword = firebaseAuth.createUserWithEmailAndPassword as jest.Mock;
const mockSignInWithPopup = firebaseAuth.signInWithPopup as jest.Mock;
const mockSignOut = firebaseAuth.signOut as jest.Mock;
const mockOnAuthStateChanged = firebaseAuth.onAuthStateChanged as jest.Mock;

const MOCK_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth?mock=1';

describe('FirebaseAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.currentUser = null;
    // The `react` jest project sets resetMocks:true, which strips factory-set
    // implementations before each test, so (re)apply them here.
    (oauthService.generateGoogleOAuthUrl as jest.Mock).mockReturnValue(MOCK_OAUTH_URL);
    (oauthService.openOAuthInBrowser as jest.Mock).mockResolvedValue(undefined);
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(firebaseService.initialize()).resolves.toBeUndefined();
    });

    it('should not throw when called multiple times', async () => {
      await firebaseService.initialize();
      await expect(firebaseService.initialize()).resolves.toBeUndefined();
    });
  });

  describe('signInWithEmail', () => {
    it('should sign in successfully with valid credentials', async () => {
      const mockUserCredential = { user: { uid: '123', email: 'test@example.com' } };
      mockSignInWithEmailAndPassword.mockResolvedValue(mockUserCredential);

      const result = await firebaseService.signInWithEmail('test@example.com', 'password123');

      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        'password123'
      );
      expect(result).toEqual(mockUserCredential);
    });

    it('should throw error with invalid credentials', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValue({ code: 'auth/wrong-password' });

      await expect(
        firebaseService.signInWithEmail('test@example.com', 'wrongpassword')
      ).rejects.toThrow();
    });

    it('should throw error with invalid email format', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValue({ code: 'auth/invalid-email' });

      await expect(
        firebaseService.signInWithEmail('invalid-email', 'password123')
      ).rejects.toThrow();
    });
  });

  describe('signUpWithEmail', () => {
    it('should create account successfully with valid data', async () => {
      const mockUserCredential = { user: { uid: '456', email: 'newuser@example.com' } };
      mockCreateUserWithEmailAndPassword.mockResolvedValue(mockUserCredential);

      const result = await firebaseService.signUpWithEmail('newuser@example.com', 'password123');

      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'newuser@example.com',
        'password123'
      );
      expect(result).toEqual(mockUserCredential);
    });

    it('should throw error when email already exists', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/email-already-in-use' });

      await expect(
        firebaseService.signUpWithEmail('existing@example.com', 'password123')
      ).rejects.toThrow();
    });

    it('should throw error with weak password', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/weak-password' });

      await expect(
        firebaseService.signUpWithEmail('test@example.com', '123')
      ).rejects.toThrow();
    });
  });

  describe('signInWithGoogleExternalBrowser', () => {
    it('should generate an OAuth URL and attempt to open the browser', async () => {
      const url = await firebaseService.signInWithGoogleExternalBrowser();

      expect(oauthService.generateGoogleOAuthUrl).toHaveBeenCalled();
      expect(oauthService.openOAuthInBrowser).toHaveBeenCalledWith(url);
      expect(url).toContain('https://accounts.google.com');
    });

    it('should still return the URL when opening the browser fails', async () => {
      (oauthService.openOAuthInBrowser as jest.Mock).mockRejectedValueOnce(new Error('no browser'));

      const url = await firebaseService.signInWithGoogleExternalBrowser();

      expect(url).toContain('https://accounts.google.com');
    });
  });

  describe('signInWithGoogle', () => {
    // The service reads `'__TAURI__' in window`, so ensure a window object
    // exists even under the node test environment.
    const ensureWindow = () => {
      if (typeof (globalThis as any).window === 'undefined') {
        (globalThis as any).window = {};
      }
      return (globalThis as any).window;
    };

    afterEach(() => {
      if (typeof (globalThis as any).window !== 'undefined') {
        delete (globalThis as any).window.__TAURI__;
      }
    });

    it('should require manual flow when running under Tauri', async () => {
      ensureWindow().__TAURI__ = {};

      await expect(firebaseService.signInWithGoogle()).rejects.toThrow('MANUAL_FLOW_REQUIRED');
    });

    it('should sign in via popup in a web environment', async () => {
      const win = ensureWindow();
      delete win.__TAURI__;
      const mockUserCredential = { user: { uid: '789', email: 'google@example.com' } };
      mockSignInWithPopup.mockResolvedValue(mockUserCredential);

      const result = await firebaseService.signInWithGoogle();

      expect(mockSignInWithPopup).toHaveBeenCalled();
      expect(result).toEqual(mockUserCredential);
    });
  });

  describe('signOut', () => {
    // The service calls localStorage.clear(); provide a stub under node.
    const ensureLocalStorage = () => {
      if (typeof (globalThis as any).localStorage === 'undefined') {
        (globalThis as any).localStorage = { clear: jest.fn() } as any;
      }
      return (globalThis as any).localStorage;
    };

    it('should sign out from Firebase and clear local storage', async () => {
      mockSignOut.mockResolvedValue(undefined);
      ensureLocalStorage();
      // The service calls the global `localStorage.clear()`. In jsdom this is a
      // Storage instance (patch via Storage.prototype); in node it is our stub.
      const clearMock = jest.fn();
      const StorageCtor = (globalThis as any).Storage;
      let restore: () => void;
      if (StorageCtor) {
        const original = StorageCtor.prototype.clear;
        StorageCtor.prototype.clear = clearMock;
        restore = () => {
          StorageCtor.prototype.clear = original;
        };
      } else {
        const ls = (globalThis as any).localStorage;
        const original = ls.clear;
        ls.clear = clearMock;
        restore = () => {
          ls.clear = original;
        };
      }

      await firebaseService.signOut();

      expect(mockSignOut).toHaveBeenCalledWith(mockAuth);
      expect(clearMock).toHaveBeenCalled();
      restore();
    });

    it('should throw a friendly error when sign out fails', async () => {
      ensureLocalStorage();
      mockSignOut.mockRejectedValue({ code: 'auth/network-request-failed' });

      await expect(firebaseService.signOut()).rejects.toThrow();
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user when authenticated', () => {
      const mockUser = { uid: '123', email: 'test@example.com' };
      mockAuth.currentUser = mockUser;

      expect(firebaseService.getCurrentUser()).toEqual(mockUser);
    });

    it('should return null when not authenticated', () => {
      mockAuth.currentUser = null;

      expect(firebaseService.getCurrentUser()).toBeNull();
    });
  });

  describe('onAuthStateChanged', () => {
    it('should setup auth state listener and return the unsubscribe function', () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();
      mockOnAuthStateChanged.mockReturnValue(mockUnsubscribe);

      const unsubscribe = firebaseService.onAuthStateChanged(mockCallback);

      expect(mockOnAuthStateChanged).toHaveBeenCalledWith(mockAuth, mockCallback);
      expect(unsubscribe).toBe(mockUnsubscribe);
    });
  });
});
