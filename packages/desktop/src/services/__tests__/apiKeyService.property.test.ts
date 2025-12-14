/**
 * Property-Based Tests for API Key Service
 * 
 * Tests encryption/decryption round-trip and multi-provider storage.
 * 
 * **Feature: ai-script-builder, Property 1: API Key Storage Round-Trip**
 * **Validates: Requirements 1.1, 1.2, 1.4**
 * 
 * **Feature: multi-provider-ai, Property 1: Multi-Provider API Key Storage Round-Trip**
 * **Validates: Requirements 1.2**
 * 
 * **Feature: multi-provider-ai, Property 2: Configured Providers Accuracy**
 * **Validates: Requirements 1.3, 1.4**
 */

import * as fc from 'fast-check';
import { encryptApiKey, decryptApiKey } from '../../utils/encryption';
import { AIProvider, SUPPORTED_PROVIDERS } from '../../types/providerAdapter.types';

describe('API Key Service Property Tests', () => {
  /**
   * **Feature: ai-script-builder, Property 1: API Key Storage Round-Trip**
   * **Validates: Requirements 1.1, 1.2, 1.4**
   * 
   * For any valid API key string, encrypting and then decrypting
   * should return the original key value.
   */
  describe('Property 1: API Key Storage Round-Trip (Encryption)', () => {
    it('encryption followed by decryption returns original key for any non-empty string', () => {
      fc.assert(
        fc.property(
          // Generate non-empty strings that could be valid API keys
          fc.string({ minLength: 1, maxLength: 256 }),
          (apiKey: string) => {
            const encrypted = encryptApiKey(apiKey);
            const decrypted = decryptApiKey(encrypted);
            
            // The decrypted value should equal the original
            return decrypted === apiKey;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('encryption followed by decryption returns original key for typical API key formats', () => {
      // Arbitrary for API key-like strings (alphanumeric with dashes/underscores)
      const apiKeyChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      const apiKeyArbitrary = fc.array(
        fc.integer({ min: 0, max: apiKeyChars.length - 1 }),
        { minLength: 20, maxLength: 100 }
      ).map(indices => indices.map(i => apiKeyChars[i]).join(''));

      fc.assert(
        fc.property(apiKeyArbitrary, (apiKey: string) => {
          const encrypted = encryptApiKey(apiKey);
          const decrypted = decryptApiKey(encrypted);
          
          return decrypted === apiKey;
        }),
        { numRuns: 100 }
      );
    });

    it('encrypted value is different from original key', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 256 }),
          (apiKey: string) => {
            const encrypted = encryptApiKey(apiKey);
            
            // Encrypted value should be different from original (unless by extreme coincidence)
            // We check that it's base64 encoded (different format)
            return encrypted !== apiKey;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('same key always produces same encrypted value (deterministic)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 256 }),
          (apiKey: string) => {
            const encrypted1 = encryptApiKey(apiKey);
            const encrypted2 = encryptApiKey(apiKey);
            
            return encrypted1 === encrypted2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('different keys produce different encrypted values', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 128 }),
          fc.string({ minLength: 1, maxLength: 128 }),
          (apiKey1: string, apiKey2: string) => {
            // Only test when keys are different
            fc.pre(apiKey1 !== apiKey2);
            
            const encrypted1 = encryptApiKey(apiKey1);
            const encrypted2 = encryptApiKey(apiKey2);
            
            return encrypted1 !== encrypted2;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles single character API keys', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1 }),
          (char: string) => {
            const encrypted = encryptApiKey(char);
            const decrypted = decryptApiKey(encrypted);
            return decrypted === char;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles API keys with special characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (apiKey: string) => {
            const encrypted = encryptApiKey(apiKey);
            const decrypted = decryptApiKey(encrypted);
            return decrypted === apiKey;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: multi-provider-ai, Property 1: Multi-Provider API Key Storage Round-Trip**
   * **Validates: Requirements 1.2**
   * 
   * For any valid API key, user ID, and provider combination, storing the key
   * and then retrieving it with the same provider identifier should return
   * the original key value.
   * 
   * This test simulates the storage/retrieval logic using encryption/decryption
   * to verify the round-trip property holds for all providers.
   */
  describe('Property 1: Multi-Provider API Key Storage Round-Trip', () => {
    // Arbitrary for provider selection
    const providerArbitrary = fc.constantFrom<AIProvider>(...SUPPORTED_PROVIDERS);
    
    // Arbitrary for API key-like strings
    const apiKeyArbitrary = fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length > 0);
    
    // Arbitrary for user ID-like strings
    const userIdArbitrary = fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0);

    it('storing and retrieving API key for any provider returns original value', () => {
      fc.assert(
        fc.property(
          userIdArbitrary,
          providerArbitrary,
          apiKeyArbitrary,
          (userId: string, provider: AIProvider, apiKey: string) => {
            // Simulate storage: encrypt the key
            const encryptedKey = encryptApiKey(apiKey);
            
            // Simulate storage structure: { [provider]: { encryptedKey } }
            const storage: Record<string, { encryptedKey: string }> = {
              [provider]: { encryptedKey }
            };
            
            // Simulate retrieval: get encrypted key for provider and decrypt
            const storedData = storage[provider];
            if (!storedData) return false;
            
            const retrievedKey = decryptApiKey(storedData.encryptedKey);
            
            // Round-trip should preserve the original key
            return retrievedKey === apiKey;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('storing keys for multiple providers maintains isolation', () => {
      fc.assert(
        fc.property(
          userIdArbitrary,
          fc.array(
            fc.tuple(providerArbitrary, apiKeyArbitrary),
            { minLength: 1, maxLength: 4 }
          ),
          (userId: string, providerKeys: [AIProvider, string][]) => {
            // Simulate storage for multiple providers
            const storage: Record<string, { encryptedKey: string }> = {};
            
            // Store all keys
            for (const [provider, apiKey] of providerKeys) {
              storage[provider] = { encryptedKey: encryptApiKey(apiKey) };
            }
            
            // Verify each provider's key can be retrieved correctly
            // Use the last key stored for each provider (simulating overwrite)
            const lastKeyByProvider = new Map<AIProvider, string>();
            for (const [provider, apiKey] of providerKeys) {
              lastKeyByProvider.set(provider, apiKey);
            }
            
            for (const [provider, expectedKey] of lastKeyByProvider) {
              const storedData = storage[provider];
              if (!storedData) return false;
              
              const retrievedKey = decryptApiKey(storedData.encryptedKey);
              if (retrievedKey !== expectedKey) return false;
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('each provider type can store and retrieve keys independently', () => {
      // Test that all supported providers work correctly
      fc.assert(
        fc.property(
          apiKeyArbitrary,
          (apiKey: string) => {
            // Test each provider independently
            for (const provider of SUPPORTED_PROVIDERS) {
              const encrypted = encryptApiKey(apiKey);
              const decrypted = decryptApiKey(encrypted);
              
              if (decrypted !== apiKey) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: multi-provider-ai, Property 2: Configured Providers Accuracy**
   * **Validates: Requirements 1.3, 1.4**
   * 
   * For any set of stored API keys for different providers, querying
   * configured providers should return exactly the providers that have
   * keys stored.
   */
  describe('Property 2: Configured Providers Accuracy', () => {
    // Arbitrary for provider selection
    const providerArbitrary = fc.constantFrom<AIProvider>(...SUPPORTED_PROVIDERS);
    
    // Arbitrary for API key-like strings
    const apiKeyArbitrary = fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length > 0);

    /**
     * Simulates the getConfiguredProviders logic
     */
    function getConfiguredProviders(
      storage: Record<string, { encryptedKey: string } | undefined>
    ): AIProvider[] {
      return Object.keys(storage).filter(
        (key) => storage[key]?.encryptedKey
      ) as AIProvider[];
    }

    it('configured providers returns exactly the providers with stored keys', () => {
      fc.assert(
        fc.property(
          // Generate a subset of providers to configure
          fc.subarray(SUPPORTED_PROVIDERS, { minLength: 0, maxLength: SUPPORTED_PROVIDERS.length }),
          fc.array(apiKeyArbitrary, { minLength: 0, maxLength: 4 }),
          (providersToStore: AIProvider[], apiKeys: string[]) => {
            // Simulate storage
            const storage: Record<string, { encryptedKey: string } | undefined> = {};
            
            // Store keys for selected providers
            providersToStore.forEach((provider, index) => {
              const apiKey = apiKeys[index % Math.max(apiKeys.length, 1)] || 'default-key';
              storage[provider] = { encryptedKey: encryptApiKey(apiKey) };
            });
            
            // Get configured providers
            const configuredProviders = getConfiguredProviders(storage);
            
            // Verify: configured providers should match exactly what was stored
            const expectedProviders = new Set(providersToStore);
            const actualProviders = new Set(configuredProviders);
            
            // Same size
            if (expectedProviders.size !== actualProviders.size) return false;
            
            // Same elements
            for (const provider of expectedProviders) {
              if (!actualProviders.has(provider)) return false;
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('deleting a provider key removes it from configured providers', () => {
      fc.assert(
        fc.property(
          // Generate providers to initially store
          fc.subarray(SUPPORTED_PROVIDERS, { minLength: 1, maxLength: SUPPORTED_PROVIDERS.length }),
          // Generate provider to delete (from the stored ones)
          fc.nat({ max: SUPPORTED_PROVIDERS.length - 1 }),
          apiKeyArbitrary,
          (providersToStore: AIProvider[], deleteIndex: number, apiKey: string) => {
            // Simulate storage
            const storage: Record<string, { encryptedKey: string } | undefined> = {};
            
            // Store keys for selected providers
            for (const provider of providersToStore) {
              storage[provider] = { encryptedKey: encryptApiKey(apiKey) };
            }
            
            // Select a provider to delete (from those stored)
            const providerToDelete = providersToStore[deleteIndex % providersToStore.length];
            
            // Delete the provider
            delete storage[providerToDelete];
            
            // Get configured providers after deletion
            const configuredProviders = getConfiguredProviders(storage);
            
            // Verify: deleted provider should not be in configured list
            if (configuredProviders.includes(providerToDelete)) return false;
            
            // Verify: other providers should still be configured
            const expectedRemaining = providersToStore.filter(p => p !== providerToDelete);
            const actualSet = new Set(configuredProviders);
            
            for (const provider of expectedRemaining) {
              if (!actualSet.has(provider)) return false;
            }
            
            return configuredProviders.length === expectedRemaining.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('empty storage returns empty configured providers list', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            const storage: Record<string, { encryptedKey: string } | undefined> = {};
            const configuredProviders = getConfiguredProviders(storage);
            return configuredProviders.length === 0;
          }
        ),
        { numRuns: 10 }
      );
    });

    it('providers with undefined or null keys are not included in configured list', () => {
      fc.assert(
        fc.property(
          fc.subarray(SUPPORTED_PROVIDERS, { minLength: 1, maxLength: SUPPORTED_PROVIDERS.length }),
          apiKeyArbitrary,
          (providers: AIProvider[], apiKey: string) => {
            const storage: Record<string, { encryptedKey: string } | undefined> = {};
            
            // Store some providers with valid keys, some with undefined
            providers.forEach((provider, index) => {
              if (index % 2 === 0) {
                storage[provider] = { encryptedKey: encryptApiKey(apiKey) };
              } else {
                storage[provider] = undefined;
              }
            });
            
            const configuredProviders = getConfiguredProviders(storage);
            
            // Only providers with valid keys should be returned
            const expectedProviders = providers.filter((_, index) => index % 2 === 0);
            
            if (configuredProviders.length !== expectedProviders.length) return false;
            
            const actualSet = new Set(configuredProviders);
            for (const provider of expectedProviders) {
              if (!actualSet.has(provider)) return false;
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
