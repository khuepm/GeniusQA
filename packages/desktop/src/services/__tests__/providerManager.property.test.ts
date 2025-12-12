/**
 * Property-Based Tests for Provider Manager Service
 * 
 * Tests the Provider Manager's core functionality including:
 * - Provider selection and active provider tracking
 * - Provider status accuracy
 * - Request count tracking
 * 
 * Uses fast-check for property-based testing.
 */

import * as fc from 'fast-check';
import { ProviderManager } from '../providerManager';
import {
  AIProvider,
  AIProviderAdapter,
  ProviderModel,
  ProviderResponse,
  SUPPORTED_PROVIDERS,
} from '../../types/providerAdapter.types';
import { ConversationContext, ScriptData } from '../../types/aiScriptBuilder.types';

// ============================================================================
// Mock Adapter Factory
// ============================================================================

/**
 * Creates a mock adapter for testing
 */
function createMockAdapter(
  providerId: AIProvider,
  initialized: boolean = true
): AIProviderAdapter {
  let isInit = initialized;
  let currentModel = 'default-model';

  return {
    providerId,
    providerName: `Mock ${providerId}`,
    
    initialize: jest.fn().mockImplementation(async (apiKey: string) => {
      if (!apiKey) throw new Error('API key required');
      isInit = true;
    }),
    
    isInitialized: jest.fn().mockImplementation(() => isInit),
    
    reset: jest.fn().mockImplementation(() => {
      isInit = false;
    }),
    
    getAvailableModels: jest.fn().mockReturnValue([
      {
        id: 'default-model',
        name: 'Default Model',
        description: 'Test model',
        capabilities: ['text-generation'],
        pricingTier: 'free',
        isDefault: true,
      },
    ] as ProviderModel[]),
    
    getDefaultModel: jest.fn().mockReturnValue('default-model'),
    
    setModel: jest.fn().mockImplementation((modelId: string) => {
      currentModel = modelId;
    }),
    
    getCurrentModel: jest.fn().mockImplementation(() => currentModel),
    
    generateScript: jest.fn().mockResolvedValue({
      success: true,
      message: 'Script generated',
      metadata: {
        providerId,
        modelId: currentModel,
        processingTimeMs: 100,
      },
    } as ProviderResponse),
    
    refineScript: jest.fn().mockResolvedValue({
      success: true,
      message: 'Script refined',
      metadata: {
        providerId,
        modelId: currentModel,
        processingTimeMs: 50,
      },
    } as ProviderResponse),
  };
}

// ============================================================================
// Arbitraries
// ============================================================================

/**
 * Arbitrary for valid provider IDs
 */
const providerIdArb = fc.constantFrom<AIProvider>('gemini', 'openai', 'anthropic', 'azure');

/**
 * Arbitrary for a subset of providers (1-4 providers)
 */
const providerSubsetArb = fc.uniqueArray(providerIdArb, { minLength: 1, maxLength: 4 });

/**
 * Arbitrary for request sequences
 */
const requestSequenceArb = fc.array(
  fc.record({
    providerId: providerIdArb,
    success: fc.boolean(),
    responseTimeMs: fc.integer({ min: 10, max: 5000 }),
  }),
  { minLength: 1, maxLength: 50 }
);


// ============================================================================
// Property Tests
// ============================================================================

describe('Provider Manager Property Tests', () => {
  let manager: ProviderManager;

  beforeEach(() => {
    manager = new ProviderManager();
  });

  afterEach(() => {
    manager.reset();
  });

  // ==========================================================================
  // Property 4: Provider Selection Updates Active Provider
  // ==========================================================================

  /**
   * **Feature: multi-provider-ai, Property 4: Provider Selection Updates Active Provider**
   * **Validates: Requirements 2.2**
   * 
   * For any configured provider, selecting it should result in that provider
   * becoming the active provider for script generation.
   */
  describe('Property 4: Provider Selection Updates Active Provider', () => {
    it('selecting a configured provider makes it the active provider', () => {
      fc.assert(
        fc.property(providerIdArb, (providerId: AIProvider) => {
          // Setup: Register and initialize the adapter
          const adapter = createMockAdapter(providerId, true);
          manager.registerAdapter(adapter);

          // Action: Select the provider
          manager.setActiveProvider(providerId);

          // Verify: The selected provider is now active
          const activeProvider = manager.getActiveProvider();
          return activeProvider === providerId;
        }),
        { numRuns: 100 }
      );
    });

    it('selecting a provider deactivates the previous active provider', () => {
      fc.assert(
        fc.property(
          providerIdArb,
          providerIdArb,
          (firstProvider: AIProvider, secondProvider: AIProvider) => {
            // Skip if same provider
            fc.pre(firstProvider !== secondProvider);

            // Setup: Register both adapters
            const adapter1 = createMockAdapter(firstProvider, true);
            const adapter2 = createMockAdapter(secondProvider, true);
            manager.registerAdapter(adapter1);
            manager.registerAdapter(adapter2);

            // Action: Select first, then second
            manager.setActiveProvider(firstProvider);
            const statusAfterFirst = manager.getProviderStatus(firstProvider);
            
            manager.setActiveProvider(secondProvider);
            const statusAfterSecond = manager.getProviderStatus(firstProvider);

            // Verify: First provider was active, then became inactive
            return statusAfterFirst.active === true && statusAfterSecond.active === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getActiveAdapter returns the adapter for the active provider', () => {
      fc.assert(
        fc.property(providerIdArb, (providerId: AIProvider) => {
          // Setup
          const adapter = createMockAdapter(providerId, true);
          manager.registerAdapter(adapter);
          manager.setActiveProvider(providerId);

          // Verify
          const activeAdapter = manager.getActiveAdapter();
          return activeAdapter !== null && activeAdapter.providerId === providerId;
        }),
        { numRuns: 100 }
      );
    });

    it('selecting an unregistered provider throws an error', () => {
      fc.assert(
        fc.property(providerIdArb, (providerId: AIProvider) => {
          // Don't register the adapter
          
          // Verify: Selecting throws
          try {
            manager.setActiveProvider(providerId);
            return false; // Should have thrown
          } catch (error) {
            return error instanceof Error && error.message.includes('not registered');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('selecting an uninitialized provider throws an error', () => {
      fc.assert(
        fc.property(providerIdArb, (providerId: AIProvider) => {
          // Setup: Register but don't initialize
          const adapter = createMockAdapter(providerId, false);
          manager.registerAdapter(adapter);

          // Verify: Selecting throws
          try {
            manager.setActiveProvider(providerId);
            return false; // Should have thrown
          } catch (error) {
            return error instanceof Error && error.message.includes('not initialized');
          }
        }),
        { numRuns: 100 }
      );
    });
  });


  // ==========================================================================
  // Property 16: Provider Status Accuracy
  // ==========================================================================

  /**
   * **Feature: multi-provider-ai, Property 16: Provider Status Accuracy**
   * **Validates: Requirements 6.1**
   * 
   * For any provider, its status should accurately reflect whether it is
   * configured, active, or has errors.
   */
  describe('Property 16: Provider Status Accuracy', () => {
    it('status.configured reflects adapter initialization state', () => {
      fc.assert(
        fc.property(
          providerIdArb,
          fc.boolean(),
          (providerId: AIProvider, initialized: boolean) => {
            // Setup
            const adapter = createMockAdapter(providerId, initialized);
            manager.registerAdapter(adapter);

            // Verify
            const status = manager.getProviderStatus(providerId);
            return status.configured === initialized;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('status.active is true only for the selected provider', () => {
      fc.assert(
        fc.property(providerSubsetArb, (providers: AIProvider[]) => {
          // Setup: Register all providers
          for (const providerId of providers) {
            const adapter = createMockAdapter(providerId, true);
            manager.registerAdapter(adapter);
          }

          // Select the first provider
          const selectedProvider = providers[0];
          manager.setActiveProvider(selectedProvider);

          // Verify: Only selected provider is active
          for (const providerId of providers) {
            const status = manager.getProviderStatus(providerId);
            const shouldBeActive = providerId === selectedProvider;
            if (status.active !== shouldBeActive) {
              return false;
            }
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('status.lastError is set when setProviderError is called', () => {
      fc.assert(
        fc.property(
          providerIdArb,
          fc.string({ minLength: 1, maxLength: 100 }),
          (providerId: AIProvider, errorMessage: string) => {
            // Setup
            const adapter = createMockAdapter(providerId, true);
            manager.registerAdapter(adapter);

            const error = {
              type: 'network_error' as const,
              message: errorMessage,
              providerId,
              timestamp: new Date(),
              retryable: true,
              suggestAlternative: true,
            };

            // Action
            manager.setProviderError(providerId, error);

            // Verify
            const status = manager.getProviderStatus(providerId);
            return status.lastError !== undefined && 
                   status.lastError.message === errorMessage &&
                   status.lastError.providerId === providerId;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('status.lastError is cleared when clearProviderError is called', () => {
      fc.assert(
        fc.property(providerIdArb, (providerId: AIProvider) => {
          // Setup
          const adapter = createMockAdapter(providerId, true);
          manager.registerAdapter(adapter);

          const error = {
            type: 'auth_error' as const,
            message: 'Test error',
            providerId,
            timestamp: new Date(),
            retryable: false,
            suggestAlternative: true,
          };

          manager.setProviderError(providerId, error);

          // Action
          manager.clearProviderError(providerId);

          // Verify
          const status = manager.getProviderStatus(providerId);
          return status.lastError === undefined;
        }),
        { numRuns: 100 }
      );
    });

    it('getAllProviderStatuses returns accurate status for all providers', () => {
      fc.assert(
        fc.property(providerSubsetArb, (providers: AIProvider[]) => {
          // Setup: Register some providers as initialized, some not
          const initializedSet = new Set(providers.slice(0, Math.ceil(providers.length / 2)));
          
          for (const providerId of providers) {
            const initialized = initializedSet.has(providerId);
            const adapter = createMockAdapter(providerId, initialized);
            manager.registerAdapter(adapter);
          }

          // Get all statuses
          const allStatuses = manager.getAllProviderStatuses();

          // Verify each registered provider has correct configured status
          for (const providerId of providers) {
            const status = allStatuses.get(providerId);
            if (!status) return false;
            
            const expectedConfigured = initializedSet.has(providerId);
            if (status.configured !== expectedConfigured) return false;
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });


  // ==========================================================================
  // Property 18: Request Count Accuracy
  // ==========================================================================

  /**
   * **Feature: multi-provider-ai, Property 18: Request Count Accuracy**
   * **Validates: Requirements 6.4**
   * 
   * For any sequence of requests to various providers, the usage statistics
   * should accurately count requests per provider.
   */
  describe('Property 18: Request Count Accuracy', () => {
    it('incrementRequestCount accurately tracks total requests', () => {
      fc.assert(
        fc.property(
          fc.array(providerIdArb, { minLength: 1, maxLength: 100 }),
          (requestProviders: AIProvider[]) => {
            // Create fresh manager for each iteration
            const testManager = new ProviderManager();
            
            // Setup: Register all unique providers
            const uniqueProviders = [...new Set(requestProviders)];
            for (const providerId of uniqueProviders) {
              const adapter = createMockAdapter(providerId, true);
              testManager.registerAdapter(adapter);
            }

            // Action: Increment for each request
            for (const providerId of requestProviders) {
              testManager.incrementRequestCount(providerId);
            }

            // Verify: Total requests matches
            const stats = testManager.getSessionStats();
            return stats.totalRequests === requestProviders.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('incrementRequestCount accurately tracks requests per provider', () => {
      fc.assert(
        fc.property(
          fc.array(providerIdArb, { minLength: 1, maxLength: 100 }),
          (requestProviders: AIProvider[]) => {
            // Create fresh manager for each iteration
            const testManager = new ProviderManager();
            
            // Setup: Register all unique providers
            const uniqueProviders = [...new Set(requestProviders)];
            for (const providerId of uniqueProviders) {
              const adapter = createMockAdapter(providerId, true);
              testManager.registerAdapter(adapter);
            }

            // Calculate expected counts
            const expectedCounts = new Map<AIProvider, number>();
            for (const providerId of requestProviders) {
              expectedCounts.set(providerId, (expectedCounts.get(providerId) || 0) + 1);
            }

            // Action: Increment for each request
            for (const providerId of requestProviders) {
              testManager.incrementRequestCount(providerId);
            }

            // Verify: Per-provider counts match
            const stats = testManager.getSessionStats();
            for (const [providerId, expectedCount] of expectedCounts) {
              const actualCount = stats.requestsByProvider.get(providerId) || 0;
              if (actualCount !== expectedCount) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('recordRequestResult tracks success rate correctly', () => {
      fc.assert(
        fc.property(requestSequenceArb, (requests) => {
          // Create fresh manager for each iteration
          const testManager = new ProviderManager();
          
          // Setup: Register all unique providers
          const uniqueProviders = [...new Set(requests.map(r => r.providerId))];
          for (const providerId of uniqueProviders) {
            const adapter = createMockAdapter(providerId, true);
            testManager.registerAdapter(adapter);
          }

          // Action: Record each request
          for (const request of requests) {
            testManager.recordRequestResult(
              request.providerId,
              request.success,
              request.responseTimeMs
            );
          }

          // Calculate expected success rate
          const successCount = requests.filter(r => r.success).length;
          const expectedSuccessRate = successCount / requests.length;

          // Verify
          const stats = testManager.getSessionStats();
          // Allow small floating point tolerance
          return Math.abs(stats.successRate - expectedSuccessRate) < 0.0001;
        }),
        { numRuns: 100 }
      );
    });

    it('recordRequestResult tracks average response time correctly', () => {
      fc.assert(
        fc.property(requestSequenceArb, (requests) => {
          // Create fresh manager for each iteration
          const testManager = new ProviderManager();
          
          // Setup: Register all unique providers
          const uniqueProviders = [...new Set(requests.map(r => r.providerId))];
          for (const providerId of uniqueProviders) {
            const adapter = createMockAdapter(providerId, true);
            testManager.registerAdapter(adapter);
          }

          // Action: Record each request
          for (const request of requests) {
            testManager.recordRequestResult(
              request.providerId,
              request.success,
              request.responseTimeMs
            );
          }

          // Calculate expected average response time
          const totalTime = requests.reduce((sum, r) => sum + r.responseTimeMs, 0);
          const expectedAvgTime = totalTime / requests.length;

          // Verify
          const stats = testManager.getSessionStats();
          // Allow small floating point tolerance
          return Math.abs(stats.averageResponseTime - expectedAvgTime) < 0.0001;
        }),
        { numRuns: 100 }
      );
    });

    it('provider status requestCount matches session stats', () => {
      fc.assert(
        fc.property(
          fc.array(providerIdArb, { minLength: 1, maxLength: 50 }),
          (requestProviders: AIProvider[]) => {
            // Create fresh manager for each iteration
            const testManager = new ProviderManager();
            
            // Setup: Register all unique providers
            const uniqueProviders = [...new Set(requestProviders)];
            for (const providerId of uniqueProviders) {
              const adapter = createMockAdapter(providerId, true);
              testManager.registerAdapter(adapter);
            }

            // Action: Increment for each request
            for (const providerId of requestProviders) {
              testManager.incrementRequestCount(providerId);
            }

            // Verify: Provider status requestCount matches session stats
            const stats = testManager.getSessionStats();
            for (const providerId of uniqueProviders) {
              const status = testManager.getProviderStatus(providerId);
              const statsCount = stats.requestsByProvider.get(providerId) || 0;
              if (status.requestCount !== statsCount) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('reset clears all statistics', () => {
      fc.assert(
        fc.property(
          fc.array(providerIdArb, { minLength: 1, maxLength: 20 }),
          (requestProviders: AIProvider[]) => {
            // Create fresh manager for each iteration
            const testManager = new ProviderManager();
            
            // Setup: Register and make some requests
            const uniqueProviders = [...new Set(requestProviders)];
            for (const providerId of uniqueProviders) {
              const adapter = createMockAdapter(providerId, true);
              testManager.registerAdapter(adapter);
            }

            for (const providerId of requestProviders) {
              testManager.recordRequestResult(providerId, true, 100);
            }

            // Action: Reset
            testManager.reset();

            // Verify: All stats are cleared
            const stats = testManager.getSessionStats();
            return stats.totalRequests === 0 &&
                   stats.successRate === 0 &&
                   stats.averageResponseTime === 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
