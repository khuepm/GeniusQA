/**
 * App Navigator for GeniusQA Desktop
 * Manages navigation between authentication and main app screens
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
import ScriptEditorScreen from '../screens/ScriptEditorScreen';
import AIScriptBuilderScreen from '../screens/AIScriptBuilderScreen';

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
        <Route
          path="/script-editor"
          element={
            <ProtectedRoute>
              <ScriptEditorScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-script-builder"
          element={
            <ProtectedRoute>
              <AIScriptBuilderScreen />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppNavigator;
