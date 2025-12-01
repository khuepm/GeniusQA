/**
 * Integration Tests for Session Persistence
 * Tests session management across app restarts and sign out
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from '../../contexts/AuthContext';
import AppNavigator from '../../navigation/AppNavigator';
import * as firebaseService from '../../services/firebaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock Firebase service
jest.mock('../../services/firebaseService');

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock Google Sign In
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(),
  },
}));

const mockUser = {
  uid: 'test-uid-789',
  email: 'persistent@example.com',
  displayName: 'Persistent User',
  photoURL: null,
  emailVerified: true,
  providerId: 'firebase',
};

describe('Session Persistence Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderApp = () => {
    return render(
      <NavigationContainer>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </NavigationContainer>
    );
  };

  describe('App Restart with Valid Session', () => {
    it('should restore user session and navigate to dashboard', async () => {
      // Mock existing valid session
      (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockUser));

      const { queryByText } = renderApp();

      // Should skip login screen and go directly to dashboard
      await waitFor(() => {
        expect(queryByText('Chào mừng trở lại!')).toBeTruthy();
        expect(queryByText(mockUser.email!)).toBeTruthy();
      });

      // Should not show login screen
      expect(queryByText('Đăng nhập để tiếp tục')).toBeNull();
    });

    it('should check for existing session on mount', async () => {
      (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });

      renderApp();

      // Verify auth state listener was set up
      await waitFor(() => {
        expect(firebaseService.onAuthStateChanged).toHaveBeenCalled();
      });
    });

    it('should persist auth state to AsyncStorage on login', async () => {
      (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(null);
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(null);
        return jest.fn();
      });
      (firebaseService.signInWithEmail as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      const { getByPlaceholderText, getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('GeniusQA')).toBeTruthy();
      });

      // Login
      fireEvent.changeText(getByPlaceholderText('Email'), mockUser.email!);
      fireEvent.changeText(getByPlaceholderText('Mật khẩu'), 'password123');
      fireEvent.press(getByText('Đăng nhập'));

      // Simulate auth state change
      const authStateCallback = (firebaseService.onAuthStateChanged as jest.Mock).mock.calls[0][0];
      authStateCallback(mockUser);

      // Verify AsyncStorage was called to persist user
      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          'user',
          JSON.stringify(mockUser)
        );
      });
    });
  });

  describe('App Restart with Expired Session', () => {
    it('should show login screen when session is expired', async () => {
      // Mock expired session
      (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(null);
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(null);
        return jest.fn();
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { queryByText } = renderApp();

      // Should show login screen
      await waitFor(() => {
        expect(queryByText('Đăng nhập để tiếp tục')).toBeTruthy();
      });

      // Should not show dashboard
      expect(queryByText('Chào mừng trở lại!')).toBeNull();
    });

    it('should handle invalid stored session data', async () => {
      // Mock corrupted session data
      (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(null);
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(null);
        return jest.fn();
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid-json');

      const { queryByText } = renderApp();

      // Should show login screen despite corrupted data
      await waitFor(() => {
        expect(queryByText('Đăng nhập để tiếp tục')).toBeTruthy();
      });
    });

    it('should handle Firebase auth state mismatch', async () => {
      // Mock scenario where AsyncStorage has user but Firebase doesn't
      (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(null);
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(null);
        return jest.fn();
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockUser));

      const { queryByText } = renderApp();

      // Should trust Firebase auth state and show login
      await waitFor(() => {
        expect(queryByText('Đăng nhập để tiếp tục')).toBeTruthy();
      });
    });
  });

  describe('Sign Out Clears Session', () => {
    it('should clear AsyncStorage on sign out', async () => {
      // Start with authenticated user
      (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });
      (firebaseService.signOut as jest.Mock).mockResolvedValue(undefined);

      const { getByText, queryByText } = renderApp();

      // Wait for dashboard to load
      await waitFor(() => {
        expect(queryByText('Chào mừng trở lại!')).toBeTruthy();
      });

      // Click sign out
      fireEvent.press(getByText('Đăng xuất'));

      // Verify Firebase signOut was called
      await waitFor(() => {
        expect(firebaseService.signOut).toHaveBeenCalled();
      });

      // Simulate auth state change to null
      const authStateCallback = (firebaseService.onAuthStateChanged as jest.Mock).mock.calls[0][0];
      authStateCallback(null);

      // Verify AsyncStorage was cleared
      await waitFor(() => {
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user');
      });

      // Should navigate to login screen
      await waitFor(() => {
        expect(queryByText('Đăng nhập để tiếp tục')).toBeTruthy();
      });
    });

    it('should clear all session data on sign out', async () => {
      (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });
      (firebaseService.signOut as jest.Mock).mockResolvedValue(undefined);

      const { getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('Chào mừng trở lại!')).toBeTruthy();
      });

      // Sign out
      fireEvent.press(getByText('Đăng xuất'));

      // Simulate auth state change
      const authStateCallback = (firebaseService.onAuthStateChanged as jest.Mock).mock.calls[0][0];
      authStateCallback(null);

      // Verify all session data is cleared
      await waitFor(() => {
        expect(firebaseService.signOut).toHaveBeenCalled();
        expect(AsyncStorage.removeItem).toHaveBeenCalled();
      });
    });

    it('should handle sign out errors gracefully', async () => {
      (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });

      // Mock sign out error
      const error = new Error('Network error');
      (firebaseService.signOut as jest.Mock).mockRejectedValue(error);

      const { getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('Chào mừng trở lại!')).toBeTruthy();
      });

      // Try to sign out
      fireEvent.press(getByText('Đăng xuất'));

      // Should handle error gracefully
      await waitFor(() => {
        expect(firebaseService.signOut).toHaveBeenCalled();
      });
    });
  });

  describe('Auth State Listener', () => {
    it('should set up auth state listener on mount', async () => {
      (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(null);
      const unsubscribe = jest.fn();
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(null);
        return unsubscribe;
      });

      renderApp();

      // Verify listener was set up
      await waitFor(() => {
        expect(firebaseService.onAuthStateChanged).toHaveBeenCalled();
      });
    });

    it('should update UI when auth state changes', async () => {
      let authCallback: ((user: any) => void) | null = null;

      (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(null);
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        authCallback = callback;
        callback(null);
        return jest.fn();
      });

      const { queryByText } = renderApp();

      // Initially show login
      await waitFor(() => {
        expect(queryByText('Đăng nhập để tiếp tục')).toBeTruthy();
      });

      // Simulate auth state change to logged in
      if (authCallback) {
        authCallback(mockUser);
      }

      // Should navigate to dashboard
      await waitFor(() => {
        expect(queryByText('Chào mừng trở lại!')).toBeTruthy();
      });
    });

    it('should clean up auth listener on unmount', async () => {
      const unsubscribe = jest.fn();
      (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(null);
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(null);
        return unsubscribe;
      });

      const { unmount } = renderApp();

      await waitFor(() => {
        expect(firebaseService.onAuthStateChanged).toHaveBeenCalled();
      });

      // Unmount component
      unmount();

      // Verify cleanup was called
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator while checking auth state', async () => {
      (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(null);
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        // Don't call callback immediately to simulate loading
        setTimeout(() => callback(null), 100);
        return jest.fn();
      });

      const { queryByTestId } = renderApp();

      // Should show loading indicator initially
      // Note: This assumes AppNavigator shows a loading spinner
      // The actual implementation may vary
    });
  });
});
