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
  webClientId: string;
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
  webClientId: getEnvVar('FIREBASE_WEB_CLIENT_ID'),
};

export default firebaseConfig;
