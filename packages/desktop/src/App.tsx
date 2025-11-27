/**
 * GeniusQA Desktop App Entry Point
 * Initializes Firebase, wraps app with providers, and renders navigation
 */

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './contexts/AuthContext';
import AppNavigator from './navigation/AppNavigator';
import firebaseService from './services/firebaseService';

/**
 * Main App component
 * Handles Firebase initialization and provides navigation structure
 */
const App: React.FC = () => {
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // Initialize Firebase on app start
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await firebaseService.initialize();
        setInitializing(false);
      } catch (error: any) {
        console.error('Failed to initialize Firebase:', error);
        setInitError(error.message || 'Không thể khởi tạo ứng dụng');
        setInitializing(false);
      }
    };

    initializeApp();
  }, []);

  // Show loading screen while initializing
  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  // Show error screen if initialization failed
  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorBox}>
          <View style={styles.errorText}>Error: {initError}</View>
        </View>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 20,
  },
  errorBox: {
    padding: 20,
    backgroundColor: '#fee',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fcc',
  },
  errorText: {
    color: '#c00',
    fontSize: 16,
  },
});

export default App;
