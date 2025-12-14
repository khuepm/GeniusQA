/// <reference types="vite/client" />

/**
 * Type definitions for Vite environment variables
 * 
 * All environment variables must be prefixed with VITE_ to be accessible
 * in the frontend code. This is a Vite requirement for security.
 * 
 * See: https://vitejs.dev/guide/env-and-mode.html
 */

interface ImportMetaEnv {
  // Firebase Configuration
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;
  
  // Google Sign-In
  readonly VITE_FIREBASE_WEB_CLIENT_ID: string;
  
  // Vite built-in variables
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
