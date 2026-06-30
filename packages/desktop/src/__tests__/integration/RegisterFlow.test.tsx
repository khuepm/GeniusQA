/**
 * Integration Tests for Registration Flow
 * Tests complete registration flow including validation and error handling.
 *
 * Migrated from React Native to the web stack:
 *  - AppNavigator now uses react-router (BrowserRouter) with the web
 *    Login/Register screens.
 *  - The web RegisterScreen performs client-side validation before calling
 *    firebase and renders validation/auth errors inline.
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

// Firebase-user-shaped object (mapped by AuthContext via providerData).
const mockUser = {
  uid: 'test-uid-456',
  email: 'newuser@example.com',
  displayName: 'New User',
  photoURL: null,
  emailVerified: false,
  providerData: [{ providerId: 'firebase' }],
};

describe('Registration Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.history.pushState({}, '', '/login');

    (firebaseService.initialize as jest.Mock).mockResolvedValue(undefined);
    (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(null);
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

  const emitAuthState = (user: any) => {
    const calls = (firebaseService.onAuthStateChanged as jest.Mock).mock.calls;
    const callback = calls[calls.length - 1][0];
    act(() => {
      callback(user);
    });
  };

  // Navigate from the login screen to the register screen.
  const navigateToRegister = async (component: ReturnType<typeof renderApp>) => {
    const { getByText } = component;

    await waitFor(() => {
      expect(getByText('GeniusQA')).toBeInTheDocument();
    });

    fireEvent.click(getByText('Đăng ký ngay').closest('button')!);

    await waitFor(() => {
      expect(getByText('Tạo tài khoản mới')).toBeInTheDocument();
    });
  };

  describe('Email Registration', () => {
    it('should successfully register with valid credentials', async () => {
      (firebaseService.signUpWithEmail as jest.Mock).mockResolvedValue({ user: mockUser });

      const component = renderApp();
      await navigateToRegister(component);

      const { getByPlaceholderText, getByText } = component;

      fireEvent.change(getByPlaceholderText('Email'), {
        target: { value: 'newuser@example.com' },
      });
      fireEvent.change(getByPlaceholderText('Mật khẩu'), {
        target: { value: 'password123' },
      });
      fireEvent.change(getByPlaceholderText('Xác nhận mật khẩu'), {
        target: { value: 'password123' },
      });

      fireEvent.click(getByText('Đăng ký').closest('button')!);

      await waitFor(() => {
        expect(firebaseService.signUpWithEmail).toHaveBeenCalledWith(
          'newuser@example.com',
          'password123'
        );
      });

      emitAuthState(mockUser);

      await waitFor(() => {
        expect(getByText('Welcome back!')).toBeInTheDocument();
      });
    });

    it('should disable submit with empty fields', async () => {
      const component = renderApp();
      await navigateToRegister(component);

      const registerButton = component.getByText('Đăng ký').closest('button');
      expect(registerButton).toBeDisabled();
      expect(firebaseService.signUpWithEmail).not.toHaveBeenCalled();
    });
  });

  describe('Password Confirmation Validation', () => {
    it('should show error when passwords do not match', async () => {
      const component = renderApp();
      await navigateToRegister(component);

      const { getByPlaceholderText, getByText, findByText } = component;

      fireEvent.change(getByPlaceholderText('Email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(getByPlaceholderText('Mật khẩu'), {
        target: { value: 'password123' },
      });
      fireEvent.change(getByPlaceholderText('Xác nhận mật khẩu'), {
        target: { value: 'password456' },
      });

      fireEvent.click(getByText('Đăng ký').closest('button')!);

      expect(await findByText('Mật khẩu xác nhận không khớp')).toBeInTheDocument();
      expect(firebaseService.signUpWithEmail).not.toHaveBeenCalled();
    });

    it('should show error for weak password', async () => {
      const component = renderApp();
      await navigateToRegister(component);

      const { getByPlaceholderText, getByText, findByText } = component;

      fireEvent.change(getByPlaceholderText('Email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(getByPlaceholderText('Mật khẩu'), {
        target: { value: '12345' },
      });
      fireEvent.change(getByPlaceholderText('Xác nhận mật khẩu'), {
        target: { value: '12345' },
      });

      fireEvent.click(getByText('Đăng ký').closest('button')!);

      expect(await findByText('Mật khẩu phải có ít nhất 6 ký tự')).toBeInTheDocument();
      expect(firebaseService.signUpWithEmail).not.toHaveBeenCalled();
    });

    it('should clear validation error when user types', async () => {
      const component = renderApp();
      await navigateToRegister(component);

      const { getByPlaceholderText, getByText, queryByText, findByText } = component;

      fireEvent.change(getByPlaceholderText('Email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(getByPlaceholderText('Mật khẩu'), {
        target: { value: 'password123' },
      });
      fireEvent.change(getByPlaceholderText('Xác nhận mật khẩu'), {
        target: { value: 'password456' },
      });
      fireEvent.click(getByText('Đăng ký').closest('button')!);

      expect(await findByText('Mật khẩu xác nhận không khớp')).toBeInTheDocument();

      // Typing again clears the validation error.
      fireEvent.change(getByPlaceholderText('Xác nhận mật khẩu'), {
        target: { value: 'password123' },
      });

      await waitFor(() => {
        expect(queryByText('Mật khẩu xác nhận không khớp')).not.toBeInTheDocument();
      });
    });
  });

  describe('Duplicate Email Handling', () => {
    it('should display error when email is already registered', async () => {
      // The web RegisterScreen catches the rejected sign-up and renders the
      // error message inline (no unhandled rejection).
      (firebaseService.signUpWithEmail as jest.Mock).mockRejectedValue(
        new Error('auth/email-already-in-use')
      );

      const component = renderApp();
      await navigateToRegister(component);

      const { getByPlaceholderText, getByText, findByText } = component;

      fireEvent.change(getByPlaceholderText('Email'), {
        target: { value: 'existing@example.com' },
      });
      fireEvent.change(getByPlaceholderText('Mật khẩu'), {
        target: { value: 'password123' },
      });
      fireEvent.change(getByPlaceholderText('Xác nhận mật khẩu'), {
        target: { value: 'password123' },
      });

      fireEvent.click(getByText('Đăng ký').closest('button')!);

      await waitFor(() => {
        expect(firebaseService.signUpWithEmail).toHaveBeenCalledWith(
          'existing@example.com',
          'password123'
        );
      });

      expect(await findByText('auth/email-already-in-use')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate back to login screen', async () => {
      const component = renderApp();
      await navigateToRegister(component);

      const { getByText } = component;

      fireEvent.click(getByText('Đăng nhập ngay').closest('button')!);

      await waitFor(() => {
        expect(getByText('Đăng nhập để tiếp tục')).toBeInTheDocument();
      });
    });
  });
});
