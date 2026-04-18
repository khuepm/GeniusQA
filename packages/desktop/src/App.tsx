/**
 * GeniusQA Desktop App Entry Point
 * Tauri + React Web version
 */

import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { GuestModeProvider } from './contexts/GuestModeContext';
import { AnalyticsProvider } from './contexts/AnalyticsContext';
import AppNavigator from './navigation/AppNavigator';
import './App.css';

const App: React.FC = () => {
  return (
    <AnalyticsProvider>
      <AuthProvider>
        <GuestModeProvider>
          <AppNavigator />
        </GuestModeProvider>
      </AuthProvider>
    </AnalyticsProvider>
  );
};

export default App;
