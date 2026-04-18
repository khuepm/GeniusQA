import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { GuestModeProvider } from '../contexts/GuestModeContext';
import { FlexibleRoute } from '../components/FlexibleRoute';
import { GuestDashboard } from '../pages/GuestDashboard';

// Mock Firebase
vi.mock('../lib/firebase', () => ({
  auth: {},
}));

// Mock Firebase auth functions
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth, callback) => {
    // Simulate no user (anonymous)
    callback(null);
    return vi.fn(); // unsubscribe function
  }),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      <GuestModeProvider>
        {children}
      </GuestModeProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe('Anonymous Access', () => {
  it('should allow access to main interface without authentication', async () => {
    const TestComponent = () => <div>Main Interface</div>;
    const GuestComponent = () => <div>Guest Mode Interface</div>;

    render(
      <TestWrapper>
        <FlexibleRoute guestFallback={<GuestComponent />}>
          <TestComponent />
        </FlexibleRoute>
      </TestWrapper>
    );

    // Should show guest fallback when not authenticated
    expect(screen.getByText('Guest Mode Interface')).toBeInTheDocument();
  });

  it('should render guest dashboard without authentication', async () => {
    render(
      <TestWrapper>
        <GuestDashboard />
      </TestWrapper>
    );

    // Should show guest dashboard elements
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Guest Mode')).toBeInTheDocument();
    expect(screen.getByText('Welcome to GeniusQA - Start testing without barriers')).toBeInTheDocument();
  });

  it('should show guest mode indicator', async () => {
    render(
      <TestWrapper>
        <GuestDashboard />
      </TestWrapper>
    );

    // Should show guest mode indicator
    expect(screen.getByText('Guest Mode')).toBeInTheDocument();
    expect(screen.getByText('Scripts saved locally')).toBeInTheDocument();
    expect(screen.getByText('Create Account')).toBeInTheDocument();
  });
});
