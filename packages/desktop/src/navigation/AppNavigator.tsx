/**
 * App Navigator for GeniusQA Desktop
 * Manages navigation between authentication and main app screens
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Import screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';

// Define navigation param list
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

/**
 * AppNavigator component
 * Conditionally renders auth or main app screens based on authentication state
 */
const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#ffffff' },
      }}
    >
      {user ? (
        // User is authenticated - show main app screens
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            animationEnabled: true,
          }}
        />
      ) : (
        // User is not authenticated - show auth screens
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{
              animationEnabled: true,
            }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{
              animationEnabled: true,
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});

export default AppNavigator;
