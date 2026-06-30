/**
 * Unit tests for AuthContext
 *
 * Migrated from React Native to the Firebase Web SDK + web testing-library.
 * The current AuthContext persists to localStorage (key `geniusqa_auth_user`),
 * uses the firebaseService default-export singleton, and exposes a context value
 * of { user, loading, error, sign-in/sign-up/sign-out methods, clearError, resetAuthState }.
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import firebaseService from '../../services/firebaseService';

// Mock the firebaseService default-export singleton.
jest.mock('../../services/firebaseService');

// Mock userProfileService (imported transitively by AuthContext on login).
jest.mock('../../services/userProfileService', () => ({
  userProfileService: {
    storeUserProfile: jest.fn().mockResolvedValue(undefined),
  },
}));

const AUTH_STORAGE_KEY = 'geniusqa_auth_user';

describe('AuthContext', () => {
  const mockUser = {
    uid: '123',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: null,
    emailVerified: true,
    providerId: 'password',
  };

  beforeEach(() => {
    // The `react` jest project resets mocks between tests, so (re)apply
    // implementations here.
    localStorage.clear();
    (firebaseService.initialize as jest.Mock).mockResolvedValue(undefined);
    (firebaseService.onAuthStateChanged as jest.Mock).mockReturnValue(jest.fn());
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      expect(() => renderHook(() => useAuth())).toThrow(
        'useAuth must be used within an AuthProvider'
      );
    });

    it('should provide auth context when used inside AuthProvider', async () => {
      // Drive loading to false by invoking the auth-state callback.
      (firebaseService.onAuthStateChanged as jest.Mock).mockImplementation((cb) => {
        cb(null);
        return jest.fn();
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
        expect(result.current.user).toBeNull();
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('AuthProvider initialization', () => {
    it('should initialize Firebase service on mount', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(firebaseService.initialize).toHaveBeenCalled();
      });
    });

    it('should setup auth state listener', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(firebaseService.onAuthStateChanged).toHaveBeenCalled();
      });
    });

    it('should load persisted user from localStorage', async () => {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockUser));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });
    });
  });

  describe('signInWithGoogle', () => {
    it('should sign in successfully with Google', async () => {
      (firebaseService.signInWithGoogle as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signInWithGoogle();
      });

      expect(firebaseService.signInWithGoogle).toHaveBeenCalled();
      expect(result.current.error).toBeNull();
    });

    it('should handle Google sign in error', async () => {
      const errorMessage = 'Đăng nhập Google thất bại';
      (firebaseService.signInWithGoogle as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        try {
          await result.current.signInWithGoogle();
        } catch (error) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
      });
    });
  });

  describe('signInWithEmail', () => {
    it('should sign in successfully with email', async () => {
      (firebaseService.signInWithEmail as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signInWithEmail('test@example.com', 'password123');
      });

      expect(firebaseService.signInWithEmail).toHaveBeenCalledWith(
        'test@example.com',
        'password123'
      );
      expect(result.current.error).toBeNull();
    });

    it('should handle email sign in error', async () => {
      const errorMessage = 'Mật khẩu không đúng';
      (firebaseService.signInWithEmail as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        try {
          await result.current.signInWithEmail('test@example.com', 'wrongpassword');
        } catch (error) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
      });
    });
  });

  describe('signUpWithEmail', () => {
    it('should sign up successfully with email', async () => {
      (firebaseService.signUpWithEmail as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signUpWithEmail('newuser@example.com', 'password123');
      });

      expect(firebaseService.signUpWithEmail).toHaveBeenCalledWith(
        'newuser@example.com',
        'password123'
      );
      expect(result.current.error).toBeNull();
    });

    it('should handle email sign up error', async () => {
      const errorMessage = 'Email đã được sử dụng';
      (firebaseService.signUpWithEmail as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        try {
          await result.current.signUpWithEmail('existing@example.com', 'password123');
        } catch (error) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
      });
    });
  });

  describe('signOut', () => {
    it('should sign out successfully and clear persisted user', async () => {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockUser));
      (firebaseService.signOut as jest.Mock).mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signOut();
      });

      expect(firebaseService.signOut).toHaveBeenCalled();
      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
      expect(result.current.user).toBeNull();
    });

    it('should handle sign out error', async () => {
      const errorMessage = 'Đăng xuất thất bại';
      (firebaseService.signOut as jest.Mock).mockRejectedValue(new Error(errorMessage));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        try {
          await result.current.signOut();
        } catch (error) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
      });
    });
  });
});
