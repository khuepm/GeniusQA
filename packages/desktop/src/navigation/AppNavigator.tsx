/**
 * App Navigator for GeniusQA Desktop
 * Manages navigation between authentication and main app screens
 * 
 * Requirements: 10.1 - Unified interface with tabs for Script List, AI Builder, and Editor
 * Requirements: Story 1.1 - Immediate access without login prompts
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GuestModeProvider } from '../contexts/GuestModeContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { FlexibleRoute } from '../components/FlexibleRoute';

// Import screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import RecorderScreen from '../screens/RecorderScreen';
import GuestRecorderScreen from '../screens/GuestRecorderScreen';
import UnifiedScriptManager from '../screens/UnifiedScriptManager';

// Application-Focused Automation screens
import { ApplicationManagementScreen } from '../screens/ApplicationManagementScreen';
import { AutomationControlPanel } from '../screens/AutomationControlPanel';
import { ConfigurationScreen } from '../screens/ConfigurationScreen';

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
 * Supports both authenticated and anonymous access modes
 */
const AppNavigator: React.FC = () => {
  return (
    <BrowserRouter>
      <GuestModeProvider>
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

          {/* Main dashboard - supports both authenticated and guest modes */}
          <Route
            path="/dashboard"
            element={
              <FlexibleRoute guestFallback={<GuestRecorderScreen />}>
                <DashboardScreen />
              </FlexibleRoute>
            }
          />

          {/* Recorder - available to guest users for local recording */}
          <Route
            path="/recorder"
            element={
              <FlexibleRoute guestFallback={<GuestRecorderScreen />}>
                <RecorderScreen />
              </FlexibleRoute>
            }
          />

          {/* Unified Script Manager - supports guest mode with local storage */}
          <Route
            path="/scripts"
            element={
              <FlexibleRoute>
                <UnifiedScriptManager initialTab="list" />
              </FlexibleRoute>
            }
          />

          <Route
            path="/scripts/builder"
            element={
              <FlexibleRoute>
                <UnifiedScriptManager initialTab="builder" />
              </FlexibleRoute>
            }
          />

          <Route
            path="/scripts/editor"
            element={
              <FlexibleRoute>
                <UnifiedScriptManager initialTab="editor" />
              </FlexibleRoute>
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

          {/* Application-Focused Automation routes - require authentication for cloud features */}
          <Route
            path="/automation"
            element={
              <ProtectedRoute>
                <AutomationControlPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/automation/applications"
            element={
              <ProtectedRoute>
                <ApplicationManagementScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/automation/control"
            element={
              <ProtectedRoute>
                <AutomationControlPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/automation/settings"
            element={
              <ProtectedRoute>
                <ConfigurationScreen />
              </ProtectedRoute>
            }
          />

          {/* Default redirect - Requirements: Story 1.1 - Immediate access */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </GuestModeProvider>
    </BrowserRouter>
  );
};

export default AppNavigator;
