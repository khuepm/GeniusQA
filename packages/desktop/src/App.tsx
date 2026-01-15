/**
 * GeniusQA Desktop App Entry Point
 * Tauri + React Web version
 */

import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { AnalyticsProvider } from './contexts/AnalyticsContext';
import AppNavigator from './navigation/AppNavigator';
import './App.css';

const App: React.FC = () => {
  return (
    <AnalyticsProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </AnalyticsProvider>
  );
};

export default App;
