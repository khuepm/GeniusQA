/**
 * Flexible Route Component for Desktop App
 * Handles both authenticated and guest mode access
 * Requirements: Story 1.1 - Immediate access without login prompts
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';

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
    return <LoadingSpinner />;
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
