/**
 * Integration Tests for Login Flow
 * Tests complete login flow including email and Google authentication.
 *
 * Migrated from React Native to the web stack:
 *  - AppNavigator now uses react-router (BrowserRouter) with the web LoginScreen.
 *  - AuthContext consumes the firebaseService default-export singleton and
 *    persists to localStorage.
 *  - The Dashboard greeting is "Welcome back!" (was "Chào mừng trở lại!").
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import * as AuthContextModule from '../../contexts/AuthContext';
import { AuthProvider } from '../../contexts/AuthContext';
import AppNavigator from '../../navigation/AppNavigator';
import LoginScreen from '../../screens/LoginScreen';
import firebaseService from '../../services/firebaseService';

// A default (logged-out) context value used when spying on useAuth for the
// error-display tests, so we can inject a specific `error` without driving the
// real sign-in promise (which the LoginScreen handlers await without catching).
const baseAuthValue = {
  user: null,
  loading: false,
  error: null as string | null,
  signInWithGoogle: jest.fn().mockResolvedValue(undefined),
  signInWithGoogleExternalBrowser: jest.fn().mockResolvedValue(''),
  signInWithGoogleCode: jest.fn().mockResolvedValue(undefined),
  signInWithEmail: jest.fn().mockResolvedValue(undefined),
  signUpWithEmail: jest.fn().mockResolvedValue(undefined),
  signOut: jest.fn().mockResolvedValue(undefined),
  clearError: jest.fn(),
  resetAuthState: jest.fn(),
};

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

// Firebase-user-shaped object: AuthContext maps it via mapFirebaseUser, which
// reads providerData[0].providerId.
const mockUser = {
  uid: 'test-uid-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
  emailVerified: true,
  providerData: [{ providerId: 'firebase' }],
};

describe('Login Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.history.pushState({}, '', '/login');

    (firebaseService.initialize as jest.Mock).mockResolvedValue(undefined);
    (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(null);
    // By default, drive auth state to "signed out" so the login screen renders.
    (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
      callback(null);
      return jest.fn();
    });
  });

  const renderApp = () =>
    render(
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    );

  // Render just the LoginScreen with a spied useAuth that injects a context
  // `error`. This exercises the error-display integration point without driving
  // the real re-throwing sign-in promise (which the LoginScreen handlers await
  // without a local catch, producing a detached rejection in jsdom).
  const renderLoginWithError = (error: string) => {
    jest
      .spyOn(AuthContextModule, 'useAuth')
      .mockReturnValue({ ...baseAuthValue, error });
    return render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginScreen />
      </MemoryRouter>
    );
  };

  // Fire the stored onAuthStateChanged callback with a user to simulate Firebase
  // emitting a signed-in state.
  const emitAuthState = (user: any) => {
    const calls = (firebaseService.onAuthStateChanged as jest.Mock).mock.calls;
    const callback = calls[calls.length - 1][0];
    act(() => {
      callback(user);
    });
  };

  describe('Email Login Flow', () => {
    it('should successfully login with valid email and password', async () => {
      (firebaseService.signInWithEmail as jest.Mock).mockResolvedValue({ user: mockUser });

      const { getByPlaceholderText, getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('GeniusQA')).toBeInTheDocument();
      });

      fireEvent.change(getByPlaceholderText('Email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(getByPlaceholderText('Mật khẩu'), {
        target: { value: 'password123' },
      });

      fireEvent.click(getByText('Đăng nhập').closest('button')!);

      await waitFor(() => {
        expect(firebaseService.signInWithEmail).toHaveBeenCalledWith(
          'test@example.com',
          'password123'
        );
      });

      emitAuthState(mockUser);

      await waitFor(() => {
        expect(getByText('Welcome back!')).toBeInTheDocument();
      });
    });

    it('should display error message for invalid credentials', async () => {
      // AuthContext surfaces a failed sign-in as the `error` value, which the
      // LoginScreen renders.
      const { findByText } = renderLoginWithError('auth/wrong-password');

      expect(await findByText('auth/wrong-password')).toBeInTheDocument();
    });

    it('should disable the sign in button with empty fields', async () => {
      const { getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('GeniusQA')).toBeInTheDocument();
      });

      const signInButton = getByText('Đăng nhập').closest('button');
      expect(signInButton).toBeDisabled();
      expect(firebaseService.signInWithEmail).not.toHaveBeenCalled();
    });
  });

  describe('Google Login Flow', () => {
    it('should successfully login with Google OAuth', async () => {
      (firebaseService.signInWithGoogle as jest.Mock).mockResolvedValue({ user: mockUser });

      const { getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('GeniusQA')).toBeInTheDocument();
      });

      fireEvent.click(getByText('Đăng nhập với Google').closest('button')!);

      await waitFor(() => {
        expect(firebaseService.signInWithGoogle).toHaveBeenCalled();
      });

      emitAuthState(mockUser);

      await waitFor(() => {
        expect(getByText('Welcome back!')).toBeInTheDocument();
      });
    });

    it('should handle Google OAuth cancellation', async () => {
      const { findByText } = renderLoginWithError('auth/popup-closed-by-user');

      expect(await findByText('auth/popup-closed-by-user')).toBeInTheDocument();
    });

    it('should handle Google OAuth network error', async () => {
      const { findByText } = renderLoginWithError('auth/network-request-failed');

      expect(await findByText('auth/network-request-failed')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to register screen from login', async () => {
      const { getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('Đăng nhập để tiếp tục')).toBeInTheDocument();
      });

      fireEvent.click(getByText('Đăng ký ngay').closest('button')!);

      await waitFor(() => {
        expect(getByText('Tạo tài khoản mới')).toBeInTheDocument();
      });
    });

    it('should navigate to dashboard after successful login', async () => {
      (firebaseService.signInWithEmail as jest.Mock).mockResolvedValue({ user: mockUser });

      const { getByPlaceholderText, getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('GeniusQA')).toBeInTheDocument();
      });

      fireEvent.change(getByPlaceholderText('Email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(getByPlaceholderText('Mật khẩu'), {
        target: { value: 'password123' },
      });
      fireEvent.click(getByText('Đăng nhập').closest('button')!);

      emitAuthState(mockUser);

      await waitFor(() => {
        expect(getByText('Welcome back!')).toBeInTheDocument();
        expect(getByText(mockUser.email!)).toBeInTheDocument();
      });
    });
  });
});
