import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface FlexibleRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  guestFallback?: React.ReactNode;
}

export const FlexibleRoute: React.FC<FlexibleRouteProps> = ({
  children,
  requireAuth = false,
  guestFallback
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // If authentication is required and user is not logged in
  if (requireAuth && !user) {
    return <Navigate to="/login" replace />;
  }

  // If user is authenticated, show the main content
  if (user) {
    return <>{children}</>;
  }

  // If user is not authenticated but auth is not required, show guest fallback or main content
  return <>{guestFallback || children}</>;
};
