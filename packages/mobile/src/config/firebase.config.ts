/**
 * Firebase Configuration for GeniusQA Mobile
 * 
 * Replace these placeholder values with your actual Firebase project configuration.
 * You can find these values in your Firebase Console:
 * 1. Go to Project Settings
 * 2. Scroll down to "Your apps" section
 * 3. Select your web app or create a new one
 * 4. Copy the configuration values
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
