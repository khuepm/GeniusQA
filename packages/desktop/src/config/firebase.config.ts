/**
 * Firebase Configuration for GeniusQA Desktop
 * 
 * Replace these placeholder values with your actual Firebase project configuration.
 * You can find these values in your Firebase Console:
 * 1. Go to Project Settings
 * 2. Scroll down to "Your apps" section
 * 3. Select your web app or create a new one
 * 4. Copy the configuration values
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
}

const firebaseConfig: FirebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
};

export default firebaseConfig;
