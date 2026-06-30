/**
 * Manual Jest mock for the AuthContext module.
 *
 * The real `useAuth` throws if used outside an <AuthProvider>. Component trees
 * such as UnifiedInterface → AIChatInterface → useChatState call it deep in the
 * tree, so tests rendering those trees would otherwise need to wrap every render
 * in an AuthProvider. Opt into this no-op mock with:
 *
 *   jest.mock('../../contexts/AuthContext');
 *
 * `useAuth` then returns a logged-out stub and `AuthProvider` is a passthrough.
 * Tests that need a specific auth state can still override `useAuth` per test.
 */
import React, { ReactNode } from 'react';

const noop = () => {};
const asyncNoop = async () => {};

// Plain function (NOT jest.fn) so the `react` project's resetMocks:true cannot
// strip its implementation between tests.
export const useAuth = () => ({
  user: null,
  loading: false,
  error: null,
  signInWithGoogle: asyncNoop,
  signInWithGoogleExternalBrowser: async () => '',
  signInWithGoogleCode: asyncNoop,
  signInWithEmail: asyncNoop,
  signUpWithEmail: asyncNoop,
  signOut: asyncNoop,
  clearError: noop,
  resetAuthState: noop,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => <>{children}</>;

export const AuthContext = React.createContext<ReturnType<typeof useAuth> | null>(null);

export default { useAuth, AuthProvider, AuthContext };
