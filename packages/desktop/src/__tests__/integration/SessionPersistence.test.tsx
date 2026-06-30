/**
 * Integration Tests for Session Persistence
 * Tests session management across app restarts and sign out.
 *
 * Migrated from React Native to the web stack:
 *  - AuthContext persists the user to localStorage (key `geniusqa_auth_user`)
 *    instead of AsyncStorage, and consumes the firebaseService singleton.
 *  - The Dashboard greeting is "Welcome back!" and the sign-out control is
 *    labelled "Sign Out".
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import AppNavigator from '../../navigation/AppNavigator';
import firebaseService from '../../services/firebaseService';

// Mock the firebaseService default-export singleton.
jest.mock('../../services/firebaseService');

// Mock userProfileService (called by AuthContext on login).
jest.mock('../../services/userProfileService', () => ({
  userProfileService: {
    storeUserProfile: jest.fn().mockResolvedValue(undefined),
  },
}));

// Use the manual no-op mock for useAnalytics so AppNavigator's ScreenViewTracker
// does not require a real AnalyticsProvider.
jest.mock('../../hooks/useAnalytics');

const AUTH_STORAGE_KEY = 'geniusqa_auth_user';

// Firebase-user-shaped object (mapped by AuthContext via providerData).
const mockUser = {
  uid: 'test-uid-789',
  email: 'persistent@example.com',
  displayName: 'Persistent User',
  photoURL: null,
  emailVerified: true,
  providerData: [{ providerId: 'firebase' }],
};

describe('Session Persistence Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.history.pushState({}, '', '/dashboard');
    (firebaseService.initialize as jest.Mock).mockResolvedValue(undefined);
    (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(null);
  });

  const renderApp = () =>
    render(
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    );

  describe('App Restart with Valid Session', () => {
    it('should restore user session and navigate to dashboard', async () => {
      (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });

      const { queryByText, getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('Welcome back!')).toBeInTheDocument();
        expect(getByText(mockUser.email!)).toBeInTheDocument();
      });

      // Should not show the login tagline.
      expect(queryByText('Đăng nhập để tiếp tục')).not.toBeInTheDocument();
    });

    it('should check for existing session on mount', async () => {
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });

      renderApp();

      await waitFor(() => {
        expect(firebaseService.onAuthStateChanged).toHaveBeenCalled();
      });
    });

    it('should persist auth state to localStorage on login', async () => {
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });

      renderApp();

      // AuthContext maps the firebase user and persists it under the web key.
      await waitFor(() => {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        expect(stored).not.toBeNull();
        expect(JSON.parse(stored!).email).toBe(mockUser.email);
      });
    });
  });

  describe('App Restart with Expired Session', () => {
    it('should show login screen when session is expired', async () => {
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(null);
        return jest.fn();
      });

      const { queryByText, getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('Đăng nhập để tiếp tục')).toBeInTheDocument();
      });

      expect(queryByText('Welcome back!')).not.toBeInTheDocument();
    });

    it('should handle invalid stored session data', async () => {
      // Corrupted persisted data: AuthContext should swallow the parse error and
      // fall back to the (signed-out) Firebase auth state.
      localStorage.setItem(AUTH_STORAGE_KEY, 'invalid-json');
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(null);
        return jest.fn();
      });

      const { getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('Đăng nhập để tiếp tục')).toBeInTheDocument();
      });
    });
  });

  describe('Sign Out Clears Session', () => {
    it('should clear localStorage on sign out', async () => {
      (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });
      (firebaseService.signOut as jest.Mock).mockResolvedValue(undefined);

      const { getByText, queryByText } = renderApp();

      await waitFor(() => {
        expect(getByText('Welcome back!')).toBeInTheDocument();
      });

      expect(localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull();

      fireEvent.click(getByText('Sign Out').closest('button')!);

      await waitFor(() => {
        expect(firebaseService.signOut).toHaveBeenCalled();
      });

      // AuthContext removes the persisted user and navigates back to login.
      await waitFor(() => {
        expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
        expect(queryByText('Đăng nhập để tiếp tục')).toBeInTheDocument();
      });
    });

    it('should handle sign out errors gracefully', async () => {
      (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });
      (firebaseService.signOut as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('Welcome back!')).toBeInTheDocument();
      });

      // DashboardScreen.handleSignOut catches the error, so no unhandled
      // rejection: the service is still called and the app stays usable.
      fireEvent.click(getByText('Sign Out').closest('button')!);

      await waitFor(() => {
        expect(firebaseService.signOut).toHaveBeenCalled();
      });
    });
  });

  describe('Auth State Listener', () => {
    it('should set up auth state listener on mount', async () => {
      const unsubscribe = jest.fn();
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(null);
        return unsubscribe;
      });

      renderApp();

      await waitFor(() => {
        expect(firebaseService.onAuthStateChanged).toHaveBeenCalled();
      });
    });

    it('should update UI when auth state changes', async () => {
      let authCallback: ((user: any) => void) | null = null;
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        authCallback = callback;
        callback(null);
        return jest.fn();
      });

      const { queryByText, getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('Đăng nhập để tiếp tục')).toBeInTheDocument();
      });

      // Simulate Firebase emitting the signed-in state.
      act(() => {
        authCallback?.(mockUser);
      });

      await waitFor(() => {
        expect(queryByText('Welcome back!')).toBeInTheDocument();
      });
    });

    it('should clean up auth listener on unmount', async () => {
      const unsubscribe = jest.fn();
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(null);
        return unsubscribe;
      });

      const { unmount } = renderApp();

      await waitFor(() => {
        expect(firebaseService.onAuthStateChanged).toHaveBeenCalled();
      });

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});
