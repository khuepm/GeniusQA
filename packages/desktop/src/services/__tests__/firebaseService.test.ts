/**
 * Unit tests for Firebase Authentication Service (Firebase Web SDK / Tauri)
 *
 * The service under test uses the Firebase Web SDK (`firebase/auth`), NOT the
 * React Native Firebase packages. These tests mock the Web SDK functions and
 * the supporting modules (config, oauthService, env util).
 */

// --- Mocks must be declared before importing the service under test ---

// env util lives at src/utils/env (two levels up from this __tests__ dir).
// It uses import.meta.env which Jest cannot parse, so it must be mocked.
jest.mock('../../utils/env', () => ({
  getEnvVar: jest.fn((key: string, fallback?: string) => {
    const mockEnv: Record<string, string> = {
      GOOGLE_CLIENT_ID: 'test-google-client-id',
      VITE_GOOGLE_CLIENT_ID: 'test-google-client-id',
    };
    return mockEnv[key] ?? fallback ?? '';
  }),
  getRequiredEnvVar: jest.fn((key: string) => key),
  hasEnvVar: jest.fn(() => true),
}));

// Firebase config — avoid real Firebase initialization.
jest.mock('../../config/firebase.config', () => ({
  app: { name: 'test-app' },
}));

// oauthService used by Google sign-in helpers.
jest.mock('../oauthService', () => ({
  __esModule: true,
  default: {
    generateGoogleOAuthUrl: jest.fn(() => 'https://accounts.google.com/o/oauth2/auth?test'),
    openOAuthInBrowser: jest.fn(async () => undefined),
  },
}));

// Firebase Web SDK auth functions.
// The mock auth instance must be created INSIDE the factory because jest.mock
// is hoisted above all module-scope declarations; we read it back after import.
jest.mock('firebase/auth', () => {
  const authInstance = { currentUser: null as any };
  return {
    __mockAuthInstance: authInstance,
    getAuth: jest.fn(() => authInstance),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signInWithPopup: jest.fn(),
    signInWithCredential: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
    GoogleAuthProvider: class {
      static credential = jest.fn((idToken: string) => ({ idToken, providerId: 'google.com' }));
    },
  };
});

// This suite runs under the "services" jest project (testEnvironment: node),
// so localStorage is not provided by the runtime — supply a minimal polyfill
// because signOut() calls localStorage.clear().
const localStoragePolyfill = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
})();
(globalThis as any).localStorage = localStoragePolyfill;

import firebaseService from '../firebaseService';
import * as firebaseAuth from 'firebase/auth';
import oauthService from '../oauthService';

const mockedAuth = firebaseAuth as jest.Mocked<typeof firebaseAuth>;
const mockAuthInstance = (firebaseAuth as any).__mockAuthInstance as { currentUser: any };

describe('FirebaseAuthService (Web SDK)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthInstance.currentUser = null;
    localStorage.clear();
  });

  describe('initialize', () => {
    it('initializes successfully and is idempotent', async () => {
      await expect(firebaseService.initialize()).resolves.toBeUndefined();
      // Second call returns early without throwing
      await expect(firebaseService.initialize()).resolves.toBeUndefined();
    });
  });

  describe('getCurrentUser', () => {
    it('returns null when no user is signed in', () => {
      expect(firebaseService.getCurrentUser()).toBeNull();
    });

    it('returns the current Firebase user when signed in', () => {
      const fakeUser = { uid: 'abc', email: 'a@b.com' };
      mockAuthInstance.currentUser = fakeUser;
      expect(firebaseService.getCurrentUser()).toBe(fakeUser);
    });
  });

  describe('onAuthStateChanged', () => {
    it('registers a listener and returns the unsubscribe fn', () => {
      const unsub = jest.fn();
      mockedAuth.onAuthStateChanged.mockReturnValue(unsub as any);
      const cb = jest.fn();
      const result = firebaseService.onAuthStateChanged(cb);
      expect(mockedAuth.onAuthStateChanged).toHaveBeenCalledWith(mockAuthInstance, cb);
      expect(result).toBe(unsub);
    });
  });

  describe('signInWithEmail', () => {
    it('returns the user credential on success', async () => {
      const cred = { user: { uid: 'u1' } };
      mockedAuth.signInWithEmailAndPassword.mockResolvedValue(cred as any);
      await expect(firebaseService.signInWithEmail('a@b.com', 'pw')).resolves.toBe(cred);
      expect(mockedAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuthInstance,
        'a@b.com',
        'pw'
      );
    });

    it('throws a mapped error on failure', async () => {
      mockedAuth.signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/wrong-password' });
      await expect(firebaseService.signInWithEmail('a@b.com', 'pw')).rejects.toThrow();
    });
  });

  describe('signUpWithEmail', () => {
    it('returns the user credential on success', async () => {
      const cred = { user: { uid: 'u2' } };
      mockedAuth.createUserWithEmailAndPassword.mockResolvedValue(cred as any);
      await expect(firebaseService.signUpWithEmail('a@b.com', 'pw')).resolves.toBe(cred);
    });

    it('throws a mapped error on failure', async () => {
      mockedAuth.createUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/email-already-in-use' });
      await expect(firebaseService.signUpWithEmail('a@b.com', 'pw')).rejects.toThrow();
    });
  });

  describe('signInWithGoogleExternalBrowser', () => {
    it('returns the generated OAuth URL', async () => {
      const url = await firebaseService.signInWithGoogleExternalBrowser();
      expect(url).toContain('accounts.google.com');
      expect(oauthService.generateGoogleOAuthUrl).toHaveBeenCalledWith('test-google-client-id');
      expect(oauthService.openOAuthInBrowser).toHaveBeenCalledWith(url);
    });

    it('still returns the URL if opening the browser fails', async () => {
      (oauthService.openOAuthInBrowser as jest.Mock).mockRejectedValueOnce(new Error('no browser'));
      const url = await firebaseService.signInWithGoogleExternalBrowser();
      expect(url).toContain('accounts.google.com');
    });
  });

  describe('signOut', () => {
    it('signs out from Firebase and clears local storage', async () => {
      mockedAuth.signOut.mockResolvedValue(undefined as any);
      localStorage.setItem('foo', 'bar');
      await firebaseService.signOut();
      expect(mockedAuth.signOut).toHaveBeenCalledWith(mockAuthInstance);
      expect(localStorage.getItem('foo')).toBeNull();
    });

    it('throws a mapped error on failure', async () => {
      mockedAuth.signOut.mockRejectedValue({ code: 'auth/network-request-failed' });
      await expect(firebaseService.signOut()).rejects.toThrow();
    });
  });
});
