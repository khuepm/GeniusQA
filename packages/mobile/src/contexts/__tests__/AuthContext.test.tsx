/**
 * Unit tests for AuthContext
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import firebaseService from '../../services/firebaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('../../services/firebaseService');
jest.mock('@react-native-async-storage/async-storage');

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
    jest.clearAllMocks();
    (firebaseService.initialize as jest.Mock).mockResolvedValue(undefined);
    (firebaseService.onAuthStateChanged as jest.Mock).mockReturnValue(jest.fn());
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.error).toBeDefined();
    });

    it('should provide auth context when used inside AuthProvider', async () => {
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

    it('should load persisted user from storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockUser));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(AsyncStorage.getItem).toHaveBeenCalledWith('@geniusqa_auth_user');
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
    it('should sign out successfully', async () => {
      (firebaseService.signOut as jest.Mock).mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signOut();
      });

      expect(firebaseService.signOut).toHaveBeenCalled();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@geniusqa_auth_user');
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
