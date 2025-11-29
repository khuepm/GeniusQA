/**
 * Environment Variable Utilities
 * 
 * Provides safe access to environment variables with fallback support.
 * Works with bundlers that inject env vars at build time.
 */

/**
 * Get an environment variable with optional fallback
 * @param key - The environment variable key
 * @param fallback - Optional fallback value if the key is not found
 * @returns The environment variable value or fallback, or empty string if neither exists
 */
export const getEnvVar = (key: string, fallback?: string): string => {
  // Try to get from process.env (works with bundlers that inject env vars)
  const value = process.env[key] || fallback;
  
  if (!value) {
    console.warn(`Missing environment variable: ${key}`);
    return '';
  }
  return value;
};

/**
 * Get a required environment variable (throws if not found)
 * @param key - The environment variable key
 * @returns The environment variable value
 * @throws Error if the environment variable is not found
 */
export const getRequiredEnvVar = (key: string): string => {
  const value = process.env[key];
  
  if (!value) {
    throw new Error(`Required environment variable not found: ${key}`);
  }
  return value;
};

/**
 * Check if an environment variable exists
 * @param key - The environment variable key
 * @returns True if the environment variable exists
 */
export const hasEnvVar = (key: string): boolean => {
  return !!process.env[key];
};
