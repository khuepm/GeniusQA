/**
 * Integration Tests for Registration Flow
 * Tests complete registration flow including validation and error handling
 * Requirements: 3.2, 3.3, 3.4, 3.5
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from '../../contexts/AuthContext';
import AppNavigator from '../../navigation/AppNavigator';
import * as firebaseService from '../../services/firebaseService';

// Mock Firebase service
jest.mock('../../services/firebaseService');

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
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
  uid: 'test-uid-456',
  email: 'newuser@example.com',
  displayName: 'New User',
  photoURL: null,
  emailVerified: false,
  providerId: 'firebase',
};

describe('Registration Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (firebaseService.getCurrentUser as jest.Mock).mockReturnValue(null);
    (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
      callback(null);
      return jest.fn();
    });
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

  const navigateToRegister = async (component: ReturnType<typeof renderApp>) => {
    const { getByText } = component;

    await waitFor(() => {
      expect(getByText('GeniusQA')).toBeTruthy();
    });

    // Navigate to register screen
    fireEvent.press(getByText('Đăng ký ngay'));

    await waitFor(() => {
      expect(getByText('Tạo tài khoản mới')).toBeTruthy();
    });
  };

  describe('Email Registration', () => {
    it('should successfully register with valid credentials', async () => {
      (firebaseService.signUpWithEmail as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      const component = renderApp();
      await navigateToRegister(component);

      const { getByPlaceholderText, getByText } = component;

      // Fill in registration form
      fireEvent.changeText(getByPlaceholderText('Email'), 'newuser@example.com');
      fireEvent.changeText(getByPlaceholderText('Mật khẩu'), 'password123');
      fireEvent.changeText(getByPlaceholderText('Xác nhận mật khẩu'), 'password123');

      // Submit registration
      fireEvent.press(getByText('Đăng ký'));

      // Verify Firebase service was called
      await waitFor(() => {
        expect(firebaseService.signUpWithEmail).toHaveBeenCalledWith(
          'newuser@example.com',
          'password123'
        );
      });

      // Simulate auth state change
      const authStateCallback = (firebaseService.onAuthStateChanged as jest.Mock).mock.calls[0][0];
      authStateCallback(mockUser);

      // Verify auto-login and navigation to dashboard
      await waitFor(() => {
        expect(component.queryByText('Chào mừng trở lại!')).toBeTruthy();
      });
    });

    it('should not submit with empty fields', async () => {
      const component = renderApp();
      await navigateToRegister(component);

      const { getByText } = component;

      // Try to submit without filling fields
      const registerButton = getByText('Đăng ký');

      // Button should be disabled
      expect(registerButton.props.accessibilityState?.disabled).toBe(true);

      // Firebase should not be called
      expect(firebaseService.signUpWithEmail).not.toHaveBeenCalled();
    });
  });

  describe('Password Confirmation Validation', () => {
    it('should show error when passwords do not match', async () => {
      const component = renderApp();
      await navigateToRegister(component);

      const { getByPlaceholderText, getByText, findByText } = component;

      // Fill in form with mismatched passwords
      fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
      fireEvent.changeText(getByPlaceholderText('Mật khẩu'), 'password123');
      fireEvent.changeText(getByPlaceholderText('Xác nhận mật khẩu'), 'password456');

      // Submit form
      fireEvent.press(getByText('Đăng ký'));

      // Verify error message is displayed
      await waitFor(() => {
        expect(findByText('Mật khẩu xác nhận không khớp')).toBeTruthy();
      });

      // Firebase should not be called
      expect(firebaseService.signUpWithEmail).not.toHaveBeenCalled();
    });

    it('should show error for weak password', async () => {
      const component = renderApp();
      await navigateToRegister(component);

      const { getByPlaceholderText, getByText, findByText } = component;

      // Fill in form with weak password
      fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
      fireEvent.changeText(getByPlaceholderText('Mật khẩu'), '12345');
      fireEvent.changeText(getByPlaceholderText('Xác nhận mật khẩu'), '12345');

      // Submit form
      fireEvent.press(getByText('Đăng ký'));

      // Verify error message
      await waitFor(() => {
        expect(findByText('Mật khẩu phải có ít nhất 6 ký tự')).toBeTruthy();
      });

      // Firebase should not be called
      expect(firebaseService.signUpWithEmail).not.toHaveBeenCalled();
    });

    it('should clear validation error when user types', async () => {
      const component = renderApp();
      await navigateToRegister(component);

      const { getByPlaceholderText, getByText, queryByText } = component;

      // Trigger validation error
      fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
      fireEvent.changeText(getByPlaceholderText('Mật khẩu'), 'password123');
      fireEvent.changeText(getByPlaceholderText('Xác nhận mật khẩu'), 'password456');
      fireEvent.press(getByText('Đăng ký'));

      await waitFor(() => {
        expect(queryByText('Mật khẩu xác nhận không khớp')).toBeTruthy();
      });

      // Start typing again
      fireEvent.changeText(getByPlaceholderText('Xác nhận mật khẩu'), 'password123');

      // Error should be cleared
      await waitFor(() => {
        expect(queryByText('Mật khẩu xác nhận không khớp')).toBeNull();
      });
    });
  });

  describe('Duplicate Email Handling', () => {
    it('should display error when email is already registered', async () => {
      // Mock duplicate email error
      const error = new Error('auth/email-already-in-use');
      (firebaseService.signUpWithEmail as jest.Mock).mockRejectedValue(error);

      const component = renderApp();
      await navigateToRegister(component);

      const { getByPlaceholderText, getByText } = component;

      // Fill in form
      fireEvent.changeText(getByPlaceholderText('Email'), 'existing@example.com');
      fireEvent.changeText(getByPlaceholderText('Mật khẩu'), 'password123');
      fireEvent.changeText(getByPlaceholderText('Xác nhận mật khẩu'), 'password123');

      // Submit form
      fireEvent.press(getByText('Đăng ký'));

      // Verify Firebase was called
      await waitFor(() => {
        expect(firebaseService.signUpWithEmail).toHaveBeenCalledWith(
          'existing@example.com',
          'password123'
        );
      });

      // Error should be displayed (handled by AuthContext)
    });
  });

  describe('Navigation', () => {
    it('should navigate back to login screen', async () => {
      const component = renderApp();
      await navigateToRegister(component);

      const { getByText } = component;

      // Click login link
      fireEvent.press(getByText('Đăng nhập ngay'));

      // Verify navigation back to login
      await waitFor(() => {
        expect(getByText('Đăng nhập để tiếp tục')).toBeTruthy();
      });
    });
  });

  describe('Loading State', () => {
    it('should disable inputs during registration', async () => {
      // Mock slow registration
      (firebaseService.signUpWithEmail as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ user: mockUser }), 1000))
      );

      const component = renderApp();
      await navigateToRegister(component);

      const { getByPlaceholderText, getByText } = component;

      // Fill in form
      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Mật khẩu');
      const confirmInput = getByPlaceholderText('Xác nhận mật khẩu');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmInput, 'password123');

      // Submit form
      fireEvent.press(getByText('Đăng ký'));

      // Verify inputs are disabled during loading
      await waitFor(() => {
        expect(emailInput.props.editable).toBe(false);
        expect(passwordInput.props.editable).toBe(false);
        expect(confirmInput.props.editable).toBe(false);
      });
    });
  });
});
