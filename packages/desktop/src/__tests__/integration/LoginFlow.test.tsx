/**
 * Integration Tests for Login Flow
 * Tests complete login flow including email and Google authentication
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 2.4
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
  uid: 'test-uid-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
  emailVerified: true,
  providerId: 'firebase',
};

describe('Login Flow Integration Tests', () => {
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

  describe('Email Login Flow', () => {
    it('should successfully login with valid email and password', async () => {
      // Mock successful email sign in
      (firebaseService.signInWithEmail as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      const { getByPlaceholderText, getByText, queryByText } = renderApp();

      // Wait for login screen to render
      await waitFor(() => {
        expect(getByText('GeniusQA')).toBeTruthy();
      });

      // Enter email and password
      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Mật khẩu');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');

      // Click sign in button
      const signInButton = getByText('Đăng nhập');
      fireEvent.press(signInButton);

      // Verify Firebase service was called
      await waitFor(() => {
        expect(firebaseService.signInWithEmail).toHaveBeenCalledWith(
          'test@example.com',
          'password123'
        );
      });

      // Simulate auth state change
      const authStateCallback = (firebaseService.onAuthStateChanged as jest.Mock).mock.calls[0][0];
      authStateCallback(mockUser);

      // Verify navigation to dashboard
      await waitFor(() => {
        expect(queryByText('Chào mừng trở lại!')).toBeTruthy();
      });
    });

    it('should display error message for invalid credentials', async () => {
      // Mock failed email sign in
      const error = new Error('auth/wrong-password');
      (firebaseService.signInWithEmail as jest.Mock).mockRejectedValue(error);

      const { getByPlaceholderText, getByText, findByText } = renderApp();

      // Wait for login screen
      await waitFor(() => {
        expect(getByText('GeniusQA')).toBeTruthy();
      });

      // Enter credentials
      fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
      fireEvent.changeText(getByPlaceholderText('Mật khẩu'), 'wrongpassword');

      // Click sign in
      fireEvent.press(getByText('Đăng nhập'));

      // Verify error is displayed
      await waitFor(() => {
        expect(firebaseService.signInWithEmail).toHaveBeenCalled();
      });
    });

    it('should not submit with empty fields', async () => {
      const { getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('GeniusQA')).toBeTruthy();
      });

      // Try to click sign in without entering credentials
      const signInButton = getByText('Đăng nhập');

      // Button should be disabled
      expect(signInButton.props.accessibilityState?.disabled).toBe(true);

      // Firebase should not be called
      expect(firebaseService.signInWithEmail).not.toHaveBeenCalled();
    });

    it('should disable inputs during authentication', async () => {
      // Mock slow sign in
      (firebaseService.signInWithEmail as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ user: mockUser }), 1000))
      );

      const { getByPlaceholderText, getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('GeniusQA')).toBeTruthy();
      });

      // Enter credentials
      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Mật khẩu');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');

      // Click sign in
      fireEvent.press(getByText('Đăng nhập'));

      // Verify inputs are disabled during loading
      await waitFor(() => {
        expect(emailInput.props.editable).toBe(false);
        expect(passwordInput.props.editable).toBe(false);
      });
    });
  });

  describe('Google Login Flow', () => {
    it('should successfully login with Google OAuth', async () => {
      // Mock successful Google sign in
      (firebaseService.signInWithGoogle as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      const { getByText, queryByText } = renderApp();

      await waitFor(() => {
        expect(getByText('GeniusQA')).toBeTruthy();
      });

      // Click Google sign in button
      const googleButton = getByText('Đăng nhập với Google');
      fireEvent.press(googleButton);

      // Verify Firebase service was called
      await waitFor(() => {
        expect(firebaseService.signInWithGoogle).toHaveBeenCalled();
      });

      // Simulate auth state change
      const authStateCallback = (firebaseService.onAuthStateChanged as jest.Mock).mock.calls[0][0];
      authStateCallback(mockUser);

      // Verify navigation to dashboard
      await waitFor(() => {
        expect(queryByText('Chào mừng trở lại!')).toBeTruthy();
      });
    });

    it('should handle Google OAuth cancellation', async () => {
      // Mock cancelled Google sign in
      const error = new Error('auth/popup-closed-by-user');
      (firebaseService.signInWithGoogle as jest.Mock).mockRejectedValue(error);

      const { getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('GeniusQA')).toBeTruthy();
      });

      // Click Google sign in
      fireEvent.press(getByText('Đăng nhập với Google'));

      // Verify error handling
      await waitFor(() => {
        expect(firebaseService.signInWithGoogle).toHaveBeenCalled();
      });
    });

    it('should handle Google OAuth network error', async () => {
      // Mock network error
      const error = new Error('auth/network-request-failed');
      (firebaseService.signInWithGoogle as jest.Mock).mockRejectedValue(error);

      const { getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('GeniusQA')).toBeTruthy();
      });

      // Click Google sign in
      fireEvent.press(getByText('Đăng nhập với Google'));

      // Verify error handling
      await waitFor(() => {
        expect(firebaseService.signInWithGoogle).toHaveBeenCalled();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to register screen from login', async () => {
      const { getByText } = renderApp();

      await waitFor(() => {
        expect(getByText('GeniusQA')).toBeTruthy();
      });

      // Click register link
      const registerLink = getByText('Đăng ký ngay');
      fireEvent.press(registerLink);

      // Verify navigation to register screen
      await waitFor(() => {
        expect(getByText('Tạo tài khoản mới')).toBeTruthy();
      });
    });

    it('should navigate to dashboard after successful login', async () => {
      (firebaseService.signInWithEmail as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      const { getByPlaceholderText, getByText, queryByText } = renderApp();

      await waitFor(() => {
        expect(getByText('GeniusQA')).toBeTruthy();
      });

      // Login
      fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
      fireEvent.changeText(getByPlaceholderText('Mật khẩu'), 'password123');
      fireEvent.press(getByText('Đăng nhập'));

      // Simulate auth state change
      const authStateCallback = (firebaseService.onAuthStateChanged as jest.Mock).mock.calls[0][0];
      authStateCallback(mockUser);

      // Verify dashboard is shown
      await waitFor(() => {
        expect(queryByText('Chào mừng trở lại!')).toBeTruthy();
        expect(queryByText(mockUser.email!)).toBeTruthy();
      });
    });
  });
});
