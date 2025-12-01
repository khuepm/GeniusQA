# Design Document

## Overview

Thiết kế hệ thống xác thực cho ứng dụng GeniusQA Desktop và Mobile sử dụng Firebase Authentication. Giải pháp này cung cấp giao diện đăng nhập đơn giản với hai phương thức: Google OAuth và Email/Password. Codebase được chia sẻ giữa hai packages (desktop và mobile) để tối ưu hóa việc bảo trì.

### Key Design Decisions

1. **Firebase Authentication**: Sử dụng Firebase làm backend authentication để tận dụng infrastructure sẵn có, bảo mật cao và dễ tích hợp
2. **Shared Components**: Tạo shared components có thể tái sử dụng giữa desktop và mobile
3. **React Navigation**: Sử dụng React Navigation cho routing giữa các màn hình
4. **TypeScript**: Đảm bảo type safety cho toàn bộ codebase
5. **Async Storage**: Lưu trữ authentication state locally để duy trì phiên đăng nhập

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────┐
│         React Native Apps               │
│    (Desktop & Mobile Packages)          │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │ Auth Screens │    │ Auth Context │  │
│  │  - Login     │◄───┤  - State     │  │
│  │  - Register  │    │  - Actions   │  │
│  │  - Dashboard │    └──────────────┘  │
│  └──────────────┘           │          │
│         │                   │          │
│         ▼                   ▼          │
│  ┌──────────────────────────────────┐  │
│  │     Firebase Auth Service        │  │
│  │  - signInWithGoogle()            │  │
│  │  - signInWithEmail()             │  │
│  │  - signUpWithEmail()             │  │
│  │  - signOut()                     │  │
│  │  - onAuthStateChanged()          │  │
│  └──────────────────────────────────┘  │
│                   │                    │
└───────────────────┼────────────────────┘
                    │
                    ▼
         ┌──────────────────┐
         │ Firebase Backend │
         │  - Authentication│
         │  - User Storage  │
         └──────────────────┘
```

### Package Structure

```
packages/
├── desktop/
│   ├── src/
│   │   ├── screens/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── RegisterScreen.tsx
│   │   │   └── DashboardScreen.tsx
│   │   ├── components/
│   │   │   ├── AuthButton.tsx
│   │   │   ├── AuthInput.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   ├── services/
│   │   │   └── firebaseService.ts
│   │   ├── navigation/
│   │   │   └── AppNavigator.tsx
│   │   ├── types/
│   │   │   └── auth.types.ts
│   │   ├── config/
│   │   │   └── firebase.config.ts
│   │   └── App.tsx
│   └── package.json
│
└── mobile/
    ├── src/
    │   ├── screens/
    │   │   ├── LoginScreen.tsx
    │   │   ├── RegisterScreen.tsx
    │   │   └── DashboardScreen.tsx
    │   ├── components/
    │   │   ├── AuthButton.tsx
    │   │   ├── AuthInput.tsx
    │   │   └── LoadingSpinner.tsx
    │   ├── contexts/
    │   │   └── AuthContext.tsx
    │   ├── services/
    │   │   └── firebaseService.ts
    │   ├── navigation/
    │   │   └── AppNavigator.tsx
    │   ├── types/
    │   │   └── auth.types.ts
    │   ├── config/
    │   │   └── firebase.config.ts
    │   └── App.tsx
    └── package.json
```

## Components and Interfaces

### 1. Firebase Service

**Purpose**: Wrapper cho Firebase Authentication API

**Interface**:
```typescript
interface FirebaseAuthService {
  // Initialize Firebase
  initialize(): Promise<void>;
  
  // Google Sign In
  signInWithGoogle(): Promise<UserCredential>;
  
  // Email/Password Sign In
  signInWithEmail(email: string, password: string): Promise<UserCredential>;
  
  // Email/Password Sign Up
  signUpWithEmail(email: string, password: string): Promise<UserCredential>;
  
  // Sign Out
  signOut(): Promise<void>;
  
  // Get Current User
  getCurrentUser(): User | null;
  
  // Auth State Listener
  onAuthStateChanged(callback: (user: User | null) => void): () => void;
}
```

### 2. Auth Context

**Purpose**: Quản lý global authentication state

**Interface**:
```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
```

### 3. Screen Components

#### LoginScreen
- Email input field
- Password input field
- "Sign In" button
- "Sign in with Google" button
- Link to RegisterScreen
- Loading state
- Error message display

#### RegisterScreen
- Email input field
- Password input field
- Confirm password input field
- "Sign Up" button
- Link back to LoginScreen
- Loading state
- Error message display

#### DashboardScreen
- Welcome message with user email
- "Sign Out" button
- Placeholder for future features

### 4. Reusable Components

#### AuthInput
```typescript
interface AuthInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
}
```

#### AuthButton
```typescript
interface AuthButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'google';
}
```

#### LoadingSpinner
```typescript
interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
}
```

## Data Models

### User Type
```typescript
interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerId: string;
}
```

### Auth State
```typescript
interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}
```

### Firebase Config
```typescript
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}
```

## Error Handling

### Error Types

```typescript
enum AuthErrorCode {
  INVALID_EMAIL = 'auth/invalid-email',
  USER_NOT_FOUND = 'auth/user-not-found',
  WRONG_PASSWORD = 'auth/wrong-password',
  EMAIL_ALREADY_IN_USE = 'auth/email-already-in-use',
  WEAK_PASSWORD = 'auth/weak-password',
  NETWORK_ERROR = 'auth/network-request-failed',
  POPUP_CLOSED = 'auth/popup-closed-by-user',
  CANCELLED = 'auth/cancelled-popup-request',
  UNKNOWN = 'auth/unknown'
}
```

### Error Messages (Vietnamese)

```typescript
const ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  [AuthErrorCode.INVALID_EMAIL]: 'Email không hợp lệ',
  [AuthErrorCode.USER_NOT_FOUND]: 'Không tìm thấy tài khoản',
  [AuthErrorCode.WRONG_PASSWORD]: 'Mật khẩu không đúng',
  [AuthErrorCode.EMAIL_ALREADY_IN_USE]: 'Email đã được sử dụng',
  [AuthErrorCode.WEAK_PASSWORD]: 'Mật khẩu quá yếu (tối thiểu 6 ký tự)',
  [AuthErrorCode.NETWORK_ERROR]: 'Lỗi kết nối mạng',
  [AuthErrorCode.POPUP_CLOSED]: 'Đã hủy đăng nhập',
  [AuthErrorCode.CANCELLED]: 'Đã hủy đăng nhập',
  [AuthErrorCode.UNKNOWN]: 'Đã xảy ra lỗi, vui lòng thử lại'
};
```

### Error Handling Strategy

1. **Try-Catch Blocks**: Wrap tất cả Firebase calls trong try-catch
2. **User-Friendly Messages**: Convert Firebase error codes thành messages tiếng Việt
3. **Error State**: Store errors trong AuthContext để hiển thị trên UI
4. **Auto-Clear Errors**: Clear errors khi user thực hiện action mới
5. **Logging**: Log errors để debug (development only)

## Navigation Flow

```
┌─────────────┐
│   App Start │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Check Auth State│
└────┬────────┬───┘
     │        │
     │        └──────────┐
     │                   │
     ▼                   ▼
┌──────────┐      ┌─────────────┐
│  Login   │      │  Dashboard  │
│  Screen  │      │   Screen    │
└────┬─────┘      └──────┬──────┘
     │                   │
     │ Sign In           │ Sign Out
     │ Success           │
     │                   │
     └──────────┬────────┘
                │
                ▼
         ┌─────────────┐
         │  Register   │
         │   Screen    │
         └─────────────┘
```

### Navigation Implementation

- **Stack Navigator**: Sử dụng `@react-navigation/stack` cho navigation
- **Auth Flow**: Conditional rendering dựa trên auth state
- **Deep Linking**: Support deep links cho future features
- **Persistence**: Persist navigation state (optional)

## Testing Strategy

### Unit Tests

1. **Firebase Service Tests**
   - Mock Firebase SDK
   - Test signInWithEmail success/failure
   - Test signUpWithEmail success/failure
   - Test signOut
   - Test auth state listener

2. **Auth Context Tests**
   - Test context provider
   - Test state updates
   - Test error handling

3. **Component Tests**
   - Test AuthInput rendering and input handling
   - Test AuthButton states (loading, disabled)
   - Test form validation

### Integration Tests

1. **Login Flow**
   - Complete email login flow
   - Complete Google login flow
   - Error handling scenarios

2. **Registration Flow**
   - Complete registration flow
   - Password confirmation validation
   - Duplicate email handling

3. **Session Persistence**
   - App restart with valid session
   - App restart with expired session

### Manual Testing Checklist

- [ ] Google sign-in on desktop
- [ ] Google sign-in on mobile
- [ ] Email sign-in on both platforms
- [ ] Email registration on both platforms
- [ ] Password visibility toggle
- [ ] Error message display
- [ ] Loading states
- [ ] Session persistence
- [ ] Sign out functionality
- [ ] Navigation between screens

## Security Considerations

1. **Firebase Security Rules**: Configure Firestore rules để protect user data
2. **API Keys**: Store Firebase config securely (environment variables)
3. **Token Storage**: Use secure storage for auth tokens
4. **HTTPS Only**: Ensure all Firebase communication uses HTTPS
5. **Input Validation**: Validate email format and password strength client-side
6. **Rate Limiting**: Firebase provides built-in rate limiting
7. **No Sensitive Data**: Never log passwords or tokens

## Dependencies

### Required NPM Packages

**Both Packages (desktop & mobile)**:
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-native": "^0.72.0",
    "@react-navigation/native": "^6.1.0",
    "@react-navigation/stack": "^6.3.0",
    "react-native-screens": "^3.29.0",
    "react-native-safe-area-context": "^4.8.0",
    "react-native-gesture-handler": "^2.14.0",
    "@react-native-firebase/app": "^19.0.0",
    "@react-native-firebase/auth": "^19.0.0",
    "@react-native-google-signin/google-signin": "^11.0.0",
    "@react-native-async-storage/async-storage": "^1.21.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-native": "^0.73.0",
    "typescript": "^5.3.3"
  }
}
```

### Platform-Specific Setup

**Desktop (Tauri)**:
- Configure Tauri to allow Firebase domains
- Setup OAuth redirect URLs for desktop

**Mobile (Expo/React Native)**:
- Configure `google-services.json` (Android)
- Configure `GoogleService-Info.plist` (iOS)
- Setup OAuth redirect schemes

## Performance Considerations

1. **Lazy Loading**: Load Firebase only when needed
2. **Memoization**: Use React.memo for components
3. **Debouncing**: Debounce input validation
4. **Optimistic Updates**: Update UI before Firebase confirms
5. **Caching**: Cache user data locally
6. **Bundle Size**: Use modular Firebase imports

## Accessibility

1. **Labels**: All inputs have proper labels
2. **Screen Readers**: Support for screen readers
3. **Keyboard Navigation**: Full keyboard support (desktop)
4. **Touch Targets**: Minimum 44x44pt touch targets (mobile)
5. **Color Contrast**: WCAG AA compliant colors
6. **Error Announcements**: Announce errors to screen readers

## Future Enhancements

1. **Biometric Authentication**: Face ID / Touch ID / Fingerprint
2. **Social Logins**: Facebook, Apple Sign In
3. **Multi-Factor Authentication**: SMS or authenticator app
4. **Password Reset**: Email-based password recovery
5. **Email Verification**: Require email verification
6. **Profile Management**: Edit profile, change password
7. **Remember Me**: Optional persistent login
8. **Offline Support**: Queue auth actions when offline
