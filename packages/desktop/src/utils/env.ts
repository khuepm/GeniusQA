/**
 * Environment Variable Utilities for Tauri
 * 
 * IMPORTANT: In Tauri, process.env is NOT available because the frontend runs in a browser context.
 * Instead, we use Vite's import.meta.env which injects environment variables at build time.
 * 
 * Environment variables must be prefixed with VITE_ to be exposed to the client.
 * Example: VITE_FIREBASE_API_KEY instead of FIREBASE_API_KEY
 * 
 * See: https://vitejs.dev/guide/env-and-mode.html
 */

/**
 * Get an environment variable with optional fallback
 * @param key - The environment variable key (will be prefixed with VITE_ automatically)
 * @param fallback - Optional fallback value if the key is not found
 * @returns The environment variable value or fallback, or empty string if neither exists
 */
export const getEnvVar = (key: string, fallback?: string): string => {
  // In Tauri/Vite, use import.meta.env instead of process.env
  // Vite requires VITE_ prefix for client-side env vars
  const viteKey = key.startsWith('VITE_') ? key : `VITE_${key}`;
  const value = (import.meta.env[viteKey] as string) || fallback;
  
  if (!value) {
    console.warn(`Missing environment variable: ${viteKey}`);
    return '';
  }
  return value;
};

/**
 * Get a required environment variable (throws if not found)
 * @param key - The environment variable key (will be prefixed with VITE_ automatically)
 * @returns The environment variable value
 * @throws Error if the environment variable is not found
 */
export const getRequiredEnvVar = (key: string): string => {
  const viteKey = key.startsWith('VITE_') ? key : `VITE_${key}`;
  const value = import.meta.env[viteKey] as string;
  
  if (!value) {
    throw new Error(`Required environment variable not found: ${viteKey}`);
  }
  return value;
};

/**
 * Check if an environment variable exists
 * @param key - The environment variable key (will be prefixed with VITE_ automatically)
 * @returns True if the environment variable exists
 */
export const hasEnvVar = (key: string): boolean => {
  const viteKey = key.startsWith('VITE_') ? key : `VITE_${key}`;
  return !!import.meta.env[viteKey];
};
