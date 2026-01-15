import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAnalytics, Analytics, isSupported } from 'firebase/analytics';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getEnvVar } from '../utils/env';

/**
 * Firebase Configuration for GeniusQA Desktop
 * 
 * Configuration is loaded from environment variables (.env file).
 * See .env.example for required variables.
 * 
 * DESKTOP-SPECIFIC SETUP:
 * 
 * 1. OAuth Redirect URLs:
 *    - In Firebase Console, go to Authentication > Sign-in method > Google
 *    - Add authorized redirect URIs:
 *      - http://localhost (for development)
 *      - tauri://localhost (for production builds)
 *      - Your custom domain if applicable
 * 
 * 2. Google Sign-In Configuration:
 *    - The webClientId should be your OAuth 2.0 Web Client ID from Google Cloud Console
 *    - Go to: https://console.cloud.google.com/apis/credentials
 *    - Find your Web Client ID (not the Android/iOS client IDs)
 * 
 * 3. Tauri Security:
 *    - Firebase domains are already whitelisted in src-tauri/tauri.conf.json
 *    - The CSP policy allows connections to Firebase services
 *    - HTTP scope includes all necessary Firebase endpoints
 * 
 * 4. Testing:
 *    - Use `pnpm --filter @geniusqa/desktop dev` to test in development
 *    - Use `pnpm --filter @geniusqa/desktop build` to create production builds
 */

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
}

const firebaseConfig: FirebaseConfig = {
  apiKey: getEnvVar('FIREBASE_API_KEY'),
  authDomain: getEnvVar('FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('FIREBASE_APP_ID'),
  measurementId: getEnvVar('FIREBASE_MEASUREMENT_ID'),
};

// Initialize Firebase app
export const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialize Firestore
export const firestore: Firestore = getFirestore(app);

// Initialize Analytics (may not be supported in all environments)
let analyticsInstance: Analytics | null = null;

/**
 * Get the Analytics instance.
 * Analytics may not be available in non-browser environments (e.g., Node.js, SSR).
 * Returns null if analytics is not supported.
 */
export const getAnalyticsInstance = async (): Promise<Analytics | null> => {
  if (analyticsInstance) {
    return analyticsInstance;
  }
  
  try {
    const supported = await isSupported();
    if (supported) {
      analyticsInstance = getAnalytics(app);
      return analyticsInstance;
    }
    console.warn('Firebase Analytics is not supported in this environment');
    return null;
  } catch (error) {
    console.warn('Failed to initialize Firebase Analytics:', error);
    return null;
  }
};

// Synchronous getter for analytics (returns null if not yet initialized)
export const analytics: Analytics | null = null;

// Initialize analytics asynchronously
isSupported().then((supported) => {
  if (supported) {
    try {
      (globalThis as { __firebaseAnalytics?: Analytics }).__firebaseAnalytics = getAnalytics(app);
    } catch (error) {
      console.warn('Failed to initialize Firebase Analytics:', error);
    }
  }
}).catch(() => {
  // Analytics not supported, silently ignore
});

export default firebaseConfig;
