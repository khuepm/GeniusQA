/**
 * Authentication Types and Interfaces
 * Defines all types used in the authentication system
 */

// User type representing authenticated user data
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerId: string;
}

// Authentication state
export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

// Firebase configuration
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Auth Context type for global state management
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// Component prop interfaces
export interface AuthInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
}

export interface AuthButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'google';
}

export interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
}

// Firebase Authentication error codes
export enum AuthErrorCode {
  INVALID_EMAIL = 'auth/invalid-email',
  USER_NOT_FOUND = 'auth/user-not-found',
  WRONG_PASSWORD = 'auth/wrong-password',
  EMAIL_ALREADY_IN_USE = 'auth/email-already-in-use',
  WEAK_PASSWORD = 'auth/weak-password',
  NETWORK_ERROR = 'auth/network-request-failed',
  POPUP_CLOSED = 'auth/popup-closed-by-user',
  CANCELLED = 'auth/cancelled-popup-request',
  UNKNOWN = 'auth/unknown',
}

// Vietnamese error messages mapping
export const ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  [AuthErrorCode.INVALID_EMAIL]: 'Email không hợp lệ',
  [AuthErrorCode.USER_NOT_FOUND]: 'Không tìm thấy tài khoản',
  [AuthErrorCode.WRONG_PASSWORD]: 'Mật khẩu không đúng',
  [AuthErrorCode.EMAIL_ALREADY_IN_USE]: 'Email đã được sử dụng',
  [AuthErrorCode.WEAK_PASSWORD]: 'Mật khẩu quá yếu (tối thiểu 6 ký tự)',
  [AuthErrorCode.NETWORK_ERROR]: 'Lỗi kết nối mạng',
  [AuthErrorCode.POPUP_CLOSED]: 'Đã hủy đăng nhập',
  [AuthErrorCode.CANCELLED]: 'Đã hủy đăng nhập',
  [AuthErrorCode.UNKNOWN]: 'Đã xảy ra lỗi, vui lòng thử lại',
};

// Helper function to get error message from Firebase error
export const getAuthErrorMessage = (error: any): string => {
  const errorCode = error?.code as AuthErrorCode;
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES[AuthErrorCode.UNKNOWN];
};
