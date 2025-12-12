/**
 * Encryption utilities for API key storage
 * 
 * Provides encryption and decryption functions for sensitive data.
 * These are pure functions with no external dependencies, making them
 * easy to test with property-based testing.
 * 
 * Requirements: 1.1, 1.2
 */

// Simple encryption key derived from a constant (in production, use a more secure approach)
const ENCRYPTION_KEY = 'geniusqa-api-key-encryption-v1';

/**
 * Encrypts an API key using XOR cipher with base64 encoding
 * Note: This is a simple encryption for demonstration. In production,
 * consider using Web Crypto API or a more robust encryption library.
 * 
 * @param apiKey - The plain text API key to encrypt
 * @returns The encrypted API key as a base64 string
 */
export function encryptApiKey(apiKey: string): string {
  if (!apiKey) {
    throw new Error('API key cannot be empty');
  }
  
  const keyBytes = new TextEncoder().encode(ENCRYPTION_KEY);
  const apiKeyBytes = new TextEncoder().encode(apiKey);
  
  // XOR each byte with the encryption key (cycling through key bytes)
  const encryptedBytes = new Uint8Array(apiKeyBytes.length);
  for (let i = 0; i < apiKeyBytes.length; i++) {
    encryptedBytes[i] = apiKeyBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  // Convert to base64 for storage
  return btoa(String.fromCharCode(...encryptedBytes));
}

/**
 * Decrypts an encrypted API key
 * 
 * @param encryptedKey - The encrypted API key (base64 string)
 * @returns The decrypted plain text API key
 */
export function decryptApiKey(encryptedKey: string): string {
  if (!encryptedKey) {
    throw new Error('Encrypted key cannot be empty');
  }
  
  try {
    // Decode from base64
    const encryptedString = atob(encryptedKey);
    const encryptedBytes = new Uint8Array(encryptedString.length);
    for (let i = 0; i < encryptedString.length; i++) {
      encryptedBytes[i] = encryptedString.charCodeAt(i);
    }
    
    const keyBytes = new TextEncoder().encode(ENCRYPTION_KEY);
    
    // XOR again to decrypt (XOR is its own inverse)
    const decryptedBytes = new Uint8Array(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i++) {
      decryptedBytes[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return new TextDecoder().decode(decryptedBytes);
  } catch (error) {
    throw new Error('Failed to decrypt API key: Invalid encrypted data');
  }
}
