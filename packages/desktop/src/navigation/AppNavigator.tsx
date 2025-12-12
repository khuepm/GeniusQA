/**
 * App Navigator for GeniusQA Desktop
 * Manages navigation between authentication and main app screens
 * 
 * Requirements: 10.1 - Unified interface with tabs for Script List, AI Builder, and Editor
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';

// Import screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import RecorderScreen from '../screens/RecorderScreen';
import UnifiedScriptManager from '../screens/UnifiedScriptManager';

// Legacy imports - kept for backward compatibility redirects
// import ScriptEditorScreen from '../screens/ScriptEditorScreen';
// import AIScriptBuilderScreen from '../screens/AIScriptBuilderScreen';

/**
 * Protected Route component
 * Redirects to login if user is not authenticated
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

/**
 * Public Route component
 * Redirects to dashboard if user is already authenticated
 */
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>;
};

/**
 * AppNavigator component
 * Conditionally renders auth or main app screens based on authentication state
 */
const AppNavigator: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginScreen />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterScreen />
            </PublicRoute>
          }
        />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recorder"
          element={
            <ProtectedRoute>
              <RecorderScreen />
            </ProtectedRoute>
          }
        />

        {/* Unified Script Manager - Requirements: 10.1 */}
        {/* Main route for script management with all tabs */}
        <Route
          path="/scripts"
          element={
            <ProtectedRoute>
              <UnifiedScriptManager initialTab="list" />
            </ProtectedRoute>
          }
        />

        {/* Direct access to AI Builder tab - Requirements: 10.4 */}
        <Route
          path="/scripts/builder"
          element={
            <ProtectedRoute>
              <UnifiedScriptManager initialTab="builder" />
            </ProtectedRoute>
          }
        />

        {/* Direct access to Editor tab - Requirements: 10.3 */}
        <Route
          path="/scripts/editor"
          element={
            <ProtectedRoute>
              <UnifiedScriptManager initialTab="editor" />
            </ProtectedRoute>
          }
        />

        {/* Legacy route redirects for backward compatibility */}
        <Route
          path="/script-editor"
          element={<Navigate to="/scripts/editor" replace />}
        />
        <Route
          path="/ai-script-builder"
          element={<Navigate to="/scripts/builder" replace />}
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppNavigator;
