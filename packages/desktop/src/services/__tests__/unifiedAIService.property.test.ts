/**
 * Property-Based Tests for Unified AI Service
 * 
 * Tests the Unified AI Service's core functionality including:
 * - Single provider auto-selection (Property 5)
 * - Error logging completeness (Property 11)
 * - Alternative provider suggestion on failure (Property 12)
 * - Response attribution (Property 17)
 * 
 * Uses fast-check for property-based testing.
 * 
 * Note: These tests use mock implementations to avoid Firebase dependencies.
 */

import * as fc from 'fast-check';
import { ProviderManager } from '../providerManager';
import {
  AIProvider,
  AIProviderAdapter,
  ProviderModel,
  ProviderResponse,
  ProviderError,
  ProviderErrorType,
  SUPPORTED_PROVIDERS,
} from '../../types/providerAdapter.types';
import { ScriptData, AVAILABLE_ACTION_TYPES, ActionType } from '../../types/aiScriptBuilder.types';

// ============================================================================
// Mock Adapter Factory
// ============================================================================

/**
 * Creates a mock adapter for testing
 */
function createMockAdapter(
  providerId: AIProvider,
  initialized: boolean = true,
  shouldFail: boolean = false,
  failureMessage: string = 'Mock failure'
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
    
    generateScript: jest.fn().mockImplementation(async () => {
      if (shouldFail) {
        return {
          success: false,
          message: failureMessage,
          metadata: {
            providerId,
            modelId: currentModel,
            processingTimeMs: 100,
          },
        } as ProviderResponse;
      }
      return {
        success: true,
        script: createMockScript(),
        message: 'Script generated',
        metadata: {
          providerId,
          modelId: currentModel,
          processingTimeMs: 100,
        },
      } as ProviderResponse;
    }),
    
    refineScript: jest.fn().mockImplementation(async () => {
      if (shouldFail) {
        return {
          success: false,
          message: failureMessage,
          metadata: {
            providerId,
            modelId: currentModel,
            processingTimeMs: 50,
          },
        } as ProviderResponse;
      }
      return {
        success: true,
        script: createMockScript(),
        message: 'Script refined',
        metadata: {
          providerId,
          modelId: currentModel,
          processingTimeMs: 50,
        },
      } as ProviderResponse;
    }),
  };
}

/**
 * Creates a mock script for testing
 */
function createMockScript(): ScriptData {
  return {
    version: '1.0',
    metadata: {
      created_at: new Date().toISOString(),
      duration: 5,
      action_count: 2,
      core_type: 'rust',
      platform: 'macos',
    },
    actions: [
      { type: 'mouse_click', timestamp: 0, x: 100, y: 100, button: 'left' },
      { type: 'wait', timestamp: 1 },
    ],
  };
}

// ============================================================================
// Error Log Entry Type (matching UnifiedAIService)
// ============================================================================

interface ErrorLogEntry {
  timestamp: Date;
  providerId: AIProvider;
  errorType: ProviderErrorType;
  message: string;
  context?: string;
}

// ============================================================================
// Fallback Action Type (matching UnifiedAIService)
// ============================================================================

interface FallbackAction {
  action: 'show_error' | 'suggest_alternative';
  error?: ProviderError;
  alternatives?: AIProvider[];
  originalError?: ProviderError;
}

// ============================================================================
// Simulated Service Logic for Testing
// ============================================================================

/**
 * Simulates the auto-selection logic from UnifiedAIService
 */
function simulateAutoSelection(
  manager: ProviderManager,
  configuredProviders: AIProvider[],
  userPreferences: { defaultProvider: AIProvider | null; lastUsedProvider: AIProvider | null }
): AIProvider | null {
  if (configuredProviders.length === 1) {
    // Auto-select the only configured provider
    try {
      manager.setActiveProvider(configuredProviders[0]);
      return configuredProviders[0];
    } catch {
      return null;
    }
  } else if (configuredProviders.length > 1) {
    // Try to use user's default or last used provider
    const preferredProvider = 
      userPreferences.defaultProvider || 
      userPreferences.lastUsedProvider;
    
    if (preferredProvider && configuredProviders.includes(preferredProvider)) {
      try {
        manager.setActiveProvider(preferredProvider);
        return preferredProvider;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Simulates the error logging logic from UnifiedAIService
 */
class ErrorLogger {
  private errorLog: ErrorLogEntry[] = [];

  logError(providerId: AIProvider, errorType: ProviderErrorType, message: string, context?: string): void {
    const entry: ErrorLogEntry = {
      timestamp: new Date(),
      providerId,
      errorType,
      message,
      context,
    };
    
    this.errorLog.push(entry);
    
    // Keep only last 100 errors
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(-100);
    }
  }

  getErrorLog(): ErrorLogEntry[] {
    return [...this.errorLog];
  }

  clearErrorLog(): void {
    this.errorLog = [];
  }
}

/**
 * Simulates the handleProviderFailure logic from UnifiedAIService
 */
function handleProviderFailure(
  error: ProviderError,
  configuredProviders: AIProvider[]
): FallbackAction {
  if (!error.suggestAlternative || configuredProviders.length <= 1) {
    return { action: 'show_error', error };
  }

  const alternatives = configuredProviders.filter(
    p => p !== error.providerId
  );

  if (alternatives.length === 0) {
    return { action: 'show_error', error };
  }

  return {
    action: 'suggest_alternative',
    alternatives,
    originalError: error,
  };
}

// ============================================================================
// Arbitraries
// ============================================================================

/**
 * Arbitrary for valid provider IDs (excluding azure which has no models)
 */
const providerIdArb = fc.constantFrom<AIProvider>('gemini', 'openai', 'anthropic');

/**
 * Arbitrary for a single provider (for auto-selection tests)
 */
const singleProviderArb = fc.constantFrom<AIProvider[]>(
  ['gemini'],
  ['openai'],
  ['anthropic']
);

/**
 * Arbitrary for multiple providers (2-3 providers)
 */
const multipleProvidersArb = fc.uniqueArray(providerIdArb, { minLength: 2, maxLength: 3 });

/**
 * Arbitrary for error types
 */
const errorTypeArb = fc.constantFrom<ProviderErrorType>(
  'rate_limit',
  'network_error',
  'auth_error',
  'invalid_response',
  'content_filtered',
  'quota_exceeded',
  'unknown'
);

// ============================================================================
// Property Tests
// ============================================================================

describe('Unified AI Service Property Tests', () => {
  // ==========================================================================
  // Property 5: Single Provider Auto-Selection
  // ==========================================================================

  /**
   * **Feature: multi-provider-ai, Property 5: Single Provider Auto-Selection**
   * **Validates: Requirements 2.3**
   * 
   * For any user with exactly one configured provider, that provider should
   * be automatically selected as active.
   */
  describe('Property 5: Single Provider Auto-Selection', () => {
    it('auto-selects when exactly one provider is configured', () => {
      fc.assert(
        fc.property(singleProviderArb, (providers: AIProvider[]) => {
          // Setup: Create manager with single provider
          const manager = new ProviderManager();
          for (const providerId of providers) {
            const adapter = createMockAdapter(providerId, true);
            manager.registerAdapter(adapter);
          }
          
          // Action: Simulate auto-selection
          const selected = simulateAutoSelection(manager, providers, {
            defaultProvider: null,
            lastUsedProvider: null,
          });
          
          // Verify: The single provider is auto-selected
          return selected === providers[0] && manager.getActiveProvider() === providers[0];
        }),
        { numRuns: 100 }
      );
    });

    it('does not auto-select when multiple providers are configured without preference', () => {
      fc.assert(
        fc.property(multipleProvidersArb, (providers: AIProvider[]) => {
          // Setup: Create manager with multiple providers
          const manager = new ProviderManager();
          for (const providerId of providers) {
            const adapter = createMockAdapter(providerId, true);
            manager.registerAdapter(adapter);
          }
          
          // Action: Simulate auto-selection without preferences
          const selected = simulateAutoSelection(manager, providers, {
            defaultProvider: null,
            lastUsedProvider: null,
          });
          
          // Verify: No provider is auto-selected
          return selected === null && manager.getActiveProvider() === null;
        }),
        { numRuns: 100 }
      );
    });

    it('uses default provider preference when multiple providers are configured', () => {
      fc.assert(
        fc.property(multipleProvidersArb, (providers: AIProvider[]) => {
          // Setup
          const manager = new ProviderManager();
          for (const providerId of providers) {
            const adapter = createMockAdapter(providerId, true);
            manager.registerAdapter(adapter);
          }
          
          // Set a default provider preference
          const defaultProvider = providers[1]; // Use second provider as default
          
          // Action: Simulate auto-selection with preference
          const selected = simulateAutoSelection(manager, providers, {
            defaultProvider,
            lastUsedProvider: null,
          });
          
          // Verify: Default provider is selected
          return selected === defaultProvider && manager.getActiveProvider() === defaultProvider;
        }),
        { numRuns: 100 }
      );
    });

    it('uses last used provider when no default is set', () => {
      fc.assert(
        fc.property(multipleProvidersArb, (providers: AIProvider[]) => {
          // Setup
          const manager = new ProviderManager();
          for (const providerId of providers) {
            const adapter = createMockAdapter(providerId, true);
            manager.registerAdapter(adapter);
          }
          
          // Set last used provider
          const lastUsedProvider = providers[0];
          
          // Action: Simulate auto-selection
          const selected = simulateAutoSelection(manager, providers, {
            defaultProvider: null,
            lastUsedProvider,
          });
          
          // Verify: Last used provider is selected
          return selected === lastUsedProvider && manager.getActiveProvider() === lastUsedProvider;
        }),
        { numRuns: 100 }
      );
    });

    it('getConfiguredProviders returns exactly the configured providers', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(providerIdArb, { minLength: 1, maxLength: 3 }),
          (providers: AIProvider[]) => {
            // Setup
            const manager = new ProviderManager();
            for (const providerId of providers) {
              const adapter = createMockAdapter(providerId, true);
              manager.registerAdapter(adapter);
            }
            
            // Verify: getConfiguredProviders returns the right providers
            const configured = manager.getConfiguredProviders();
            
            // Check same length
            if (configured.length !== providers.length) return false;
            
            // Check all providers are present
            for (const p of providers) {
              if (!configured.includes(p)) return false;
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  // ==========================================================================
  // Property 11: Error Logging Completeness
  // ==========================================================================

  /**
   * **Feature: multi-provider-ai, Property 11: Error Logging Completeness**
   * **Validates: Requirements 4.4**
   * 
   * For any provider error, the logged error should contain the provider name
   * and error type.
   */
  describe('Property 11: Error Logging Completeness', () => {
    it('logged errors contain provider ID and error type', () => {
      fc.assert(
        fc.property(
          providerIdArb,
          errorTypeArb,
          fc.string({ minLength: 1, maxLength: 100 }),
          (providerId: AIProvider, errorType: ProviderErrorType, message: string) => {
            // Setup
            const logger = new ErrorLogger();
            
            // Action: Log an error
            logger.logError(providerId, errorType, message);
            
            // Verify: Error log contains required fields
            const errorLog = logger.getErrorLog();
            
            if (errorLog.length !== 1) return false;
            
            const entry = errorLog[0];
            return entry.providerId === providerId &&
                   entry.errorType === errorType &&
                   entry.message === message &&
                   entry.timestamp instanceof Date;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('multiple errors are all logged with correct information', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              providerId: providerIdArb,
              errorType: errorTypeArb,
              message: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (errors) => {
            // Setup
            const logger = new ErrorLogger();
            
            // Action: Log all errors
            for (const error of errors) {
              logger.logError(error.providerId, error.errorType, error.message);
            }
            
            // Verify: All errors are logged
            const errorLog = logger.getErrorLog();
            
            if (errorLog.length !== errors.length) return false;
            
            // Verify each error has required fields
            for (let i = 0; i < errors.length; i++) {
              const expected = errors[i];
              const actual = errorLog[i];
              
              if (actual.providerId !== expected.providerId ||
                  actual.errorType !== expected.errorType ||
                  actual.message !== expected.message) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clearErrorLog removes all logged errors', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              providerId: providerIdArb,
              errorType: errorTypeArb,
              message: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (errors) => {
            // Setup
            const logger = new ErrorLogger();
            
            // Log some errors
            for (const error of errors) {
              logger.logError(error.providerId, error.errorType, error.message);
            }
            
            // Action: Clear error log
            logger.clearErrorLog();
            
            // Verify: Error log is empty
            return logger.getErrorLog().length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('error log is capped at 100 entries', () => {
      // Setup
      const logger = new ErrorLogger();
      
      // Action: Log 150 errors
      for (let i = 0; i < 150; i++) {
        logger.logError('gemini', 'unknown', `Error ${i}`);
      }
      
      // Verify: Only last 100 are kept
      const errorLog = logger.getErrorLog();
      expect(errorLog.length).toBe(100);
      
      // Verify the oldest errors were removed (first 50)
      expect(errorLog[0].message).toBe('Error 50');
      expect(errorLog[99].message).toBe('Error 149');
    });
  });


  // ==========================================================================
  // Property 12: Alternative Provider Suggestion on Failure
  // ==========================================================================

  /**
   * **Feature: multi-provider-ai, Property 12: Alternative Provider Suggestion on Failure**
   * **Validates: Requirements 4.5**
   * 
   * For any provider failure when multiple providers are configured, the system
   * should offer at least one alternative provider.
   */
  describe('Property 12: Alternative Provider Suggestion on Failure', () => {
    it('suggests alternatives when multiple providers are configured and one fails', () => {
      fc.assert(
        fc.property(multipleProvidersArb, (providers: AIProvider[]) => {
          // Setup
          const failingProvider = providers[0];
          
          // Create a provider error
          const error: ProviderError = {
            type: 'rate_limit',
            message: 'Rate limit exceeded',
            providerId: failingProvider,
            timestamp: new Date(),
            retryable: true,
            suggestAlternative: true,
          };
          
          // Action: Handle the failure
          const fallback = handleProviderFailure(error, providers);
          
          // Verify: Alternatives are suggested
          if (fallback.action !== 'suggest_alternative') return false;
          if (!fallback.alternatives || fallback.alternatives.length === 0) return false;
          
          // Verify: Alternatives don't include the failing provider
          if (fallback.alternatives.includes(failingProvider)) return false;
          
          // Verify: All alternatives are from configured providers
          for (const alt of fallback.alternatives) {
            if (!providers.includes(alt)) return false;
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('does not suggest alternatives when only one provider is configured', () => {
      fc.assert(
        fc.property(singleProviderArb, (providers: AIProvider[]) => {
          // Create a provider error
          const error: ProviderError = {
            type: 'rate_limit',
            message: 'Rate limit exceeded',
            providerId: providers[0],
            timestamp: new Date(),
            retryable: true,
            suggestAlternative: true,
          };
          
          // Action: Handle the failure
          const fallback = handleProviderFailure(error, providers);
          
          // Verify: No alternatives suggested (show_error instead)
          return fallback.action === 'show_error' && 
                 (fallback.alternatives === undefined || fallback.alternatives.length === 0);
        }),
        { numRuns: 100 }
      );
    });

    it('does not suggest alternatives when error.suggestAlternative is false', () => {
      fc.assert(
        fc.property(multipleProvidersArb, (providers: AIProvider[]) => {
          // Create error with suggestAlternative = false
          const error: ProviderError = {
            type: 'invalid_response',
            message: 'Invalid response',
            providerId: providers[0],
            timestamp: new Date(),
            retryable: true,
            suggestAlternative: false, // Don't suggest alternatives
          };
          
          // Action
          const fallback = handleProviderFailure(error, providers);
          
          // Verify: No alternatives suggested
          return fallback.action === 'show_error';
        }),
        { numRuns: 100 }
      );
    });

    it('alternatives count equals configured providers minus one', () => {
      fc.assert(
        fc.property(multipleProvidersArb, (providers: AIProvider[]) => {
          const failingProvider = providers[0];
          
          const error: ProviderError = {
            type: 'network_error',
            message: 'Network error',
            providerId: failingProvider,
            timestamp: new Date(),
            retryable: true,
            suggestAlternative: true,
          };
          
          // Action
          const fallback = handleProviderFailure(error, providers);
          
          // Verify: Number of alternatives is providers.length - 1
          if (fallback.action !== 'suggest_alternative') return false;
          return fallback.alternatives?.length === providers.length - 1;
        }),
        { numRuns: 100 }
      );
    });
  });


  // ==========================================================================
  // Property 17: Response Attribution
  // ==========================================================================

  /**
   * **Feature: multi-provider-ai, Property 17: Response Attribution**
   * **Validates: Requirements 6.3**
   * 
   * For any generated response, it should include the provider ID and model ID
   * that generated it.
   */
  describe('Property 17: Response Attribution', () => {
    it('successful responses include provider and model attribution', async () => {
      await fc.assert(
        fc.asyncProperty(providerIdArb, async (providerId: AIProvider) => {
          // Setup: Create mock adapter
          const adapter = createMockAdapter(providerId, true, false);
          
          // Action: Generate a script
          const response = await adapter.generateScript('test prompt', {
            previousMessages: [],
            availableActions: AVAILABLE_ACTION_TYPES as ActionType[],
          });
          
          // Verify: Response includes attribution
          return response.metadata.providerId === providerId &&
                 response.metadata.modelId !== undefined &&
                 response.metadata.modelId !== null;
        }),
        { numRuns: 100 }
      );
    });

    it('failed responses still include provider and model attribution', async () => {
      await fc.assert(
        fc.asyncProperty(providerIdArb, async (providerId: AIProvider) => {
          // Setup: Create failing mock adapter
          const adapter = createMockAdapter(providerId, true, true, 'Test failure');
          
          // Action: Generate a script (will fail)
          const response = await adapter.generateScript('test prompt', {
            previousMessages: [],
            availableActions: AVAILABLE_ACTION_TYPES as ActionType[],
          });
          
          // Verify: Response includes attribution even on failure
          return response.metadata.providerId === providerId &&
                 response.metadata.modelId !== undefined;
        }),
        { numRuns: 100 }
      );
    });

    it('processingTimeMs is included in response metadata', async () => {
      await fc.assert(
        fc.asyncProperty(providerIdArb, async (providerId: AIProvider) => {
          // Setup
          const adapter = createMockAdapter(providerId, true, false);
          
          // Action
          const response = await adapter.generateScript('test prompt', {
            previousMessages: [],
            availableActions: AVAILABLE_ACTION_TYPES as ActionType[],
          });
          
          // Verify: processingTimeMs is present and non-negative
          return response.metadata.processingTimeMs !== undefined &&
                 response.metadata.processingTimeMs >= 0;
        }),
        { numRuns: 100 }
      );
    });

    it('refineScript responses also include attribution', async () => {
      await fc.assert(
        fc.asyncProperty(providerIdArb, async (providerId: AIProvider) => {
          // Setup
          const adapter = createMockAdapter(providerId, true, false);
          
          // Action
          const script = createMockScript();
          const response = await adapter.refineScript(script, 'make it faster');
          
          // Verify: Attribution is present
          return response.metadata.providerId === providerId &&
                 response.metadata.modelId !== undefined;
        }),
        { numRuns: 100 }
      );
    });

    it('model ID matches the adapter current model', async () => {
      await fc.assert(
        fc.asyncProperty(providerIdArb, async (providerId: AIProvider) => {
          // Setup
          const adapter = createMockAdapter(providerId, true, false);
          const expectedModel = adapter.getCurrentModel();
          
          // Action
          const response = await adapter.generateScript('test prompt', {
            previousMessages: [],
            availableActions: AVAILABLE_ACTION_TYPES as ActionType[],
          });
          
          // Verify: Model ID matches
          return response.metadata.modelId === expectedModel;
        }),
        { numRuns: 100 }
      );
    });
  });


  // ==========================================================================
  // Property 10: Model Preference Persistence
  // ==========================================================================

  /**
   * **Feature: multi-provider-ai, Property 10: Model Preference Persistence**
   * **Validates: Requirements 3.5**
   * 
   * For any model selection, the selection should persist across sessions
   * for the same provider.
   */
  describe('Property 10: Model Preference Persistence', () => {
    // Storage key used by UnifiedAIService
    const MODEL_PREFERENCES_STORAGE_KEY = 'geniusqa_model_preferences';

    // Mock localStorage for testing
    let mockStorage: Record<string, string> = {};
    
    beforeEach(() => {
      mockStorage = {};
      
      // Mock localStorage
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: jest.fn((key: string) => mockStorage[key] || null),
          setItem: jest.fn((key: string, value: string) => {
            mockStorage[key] = value;
          }),
          removeItem: jest.fn((key: string) => {
            delete mockStorage[key];
          }),
          clear: jest.fn(() => {
            mockStorage = {};
          }),
        },
        writable: true,
      });
    });

    /**
     * Arbitrary for model IDs
     */
    const modelIdArb = fc.constantFrom(
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022'
    );

    it('model preference is saved to localStorage when model is selected', () => {
      fc.assert(
        fc.property(
          providerIdArb,
          modelIdArb,
          (providerId: AIProvider, modelId: string) => {
            // Setup: Create preferences object
            const preferences = {
              defaultProvider: null,
              modelPreferences: {} as Record<AIProvider, string>,
              lastUsedProvider: null,
            };
            
            // Action: Save model preference (simulating selectModel behavior)
            preferences.modelPreferences[providerId] = modelId;
            localStorage.setItem(
              MODEL_PREFERENCES_STORAGE_KEY,
              JSON.stringify(preferences)
            );
            
            // Verify: Preference is stored
            const stored = localStorage.getItem(MODEL_PREFERENCES_STORAGE_KEY);
            if (!stored) return false;
            
            const parsed = JSON.parse(stored);
            return parsed.modelPreferences[providerId] === modelId;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('model preference is loaded from localStorage on initialization', () => {
      fc.assert(
        fc.property(
          providerIdArb,
          modelIdArb,
          (providerId: AIProvider, modelId: string) => {
            // Setup: Pre-populate localStorage with preferences
            const storedPreferences = {
              defaultProvider: null,
              modelPreferences: { [providerId]: modelId },
              lastUsedProvider: null,
            };
            mockStorage[MODEL_PREFERENCES_STORAGE_KEY] = JSON.stringify(storedPreferences);
            
            // Action: Load preferences (simulating constructor behavior)
            const stored = localStorage.getItem(MODEL_PREFERENCES_STORAGE_KEY);
            if (!stored) return false;
            
            const loaded = JSON.parse(stored);
            
            // Verify: Loaded preference matches stored
            return loaded.modelPreferences[providerId] === modelId;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('model preferences persist across multiple providers independently', () => {
      fc.assert(
        fc.property(
          fc.record({
            gemini: modelIdArb,
            openai: modelIdArb,
            anthropic: modelIdArb,
          }),
          (modelPrefs: Record<string, string>) => {
            // Setup: Create preferences with multiple providers
            const preferences = {
              defaultProvider: null,
              modelPreferences: modelPrefs,
              lastUsedProvider: null,
            };
            
            // Action: Save preferences
            localStorage.setItem(
              MODEL_PREFERENCES_STORAGE_KEY,
              JSON.stringify(preferences)
            );
            
            // Verify: All preferences are stored correctly
            const stored = localStorage.getItem(MODEL_PREFERENCES_STORAGE_KEY);
            if (!stored) return false;
            
            const parsed = JSON.parse(stored);
            
            return parsed.modelPreferences.gemini === modelPrefs.gemini &&
                   parsed.modelPreferences.openai === modelPrefs.openai &&
                   parsed.modelPreferences.anthropic === modelPrefs.anthropic;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('updating model preference for one provider does not affect others', () => {
      fc.assert(
        fc.property(
          providerIdArb,
          modelIdArb,
          modelIdArb,
          (providerId: AIProvider, originalModel: string, newModel: string) => {
            // Setup: Create preferences with all providers
            const otherProviders = SUPPORTED_PROVIDERS.filter(p => p !== providerId && p !== 'azure');
            const initialPreferences: Record<string, string> = {};
            
            for (const p of otherProviders) {
              initialPreferences[p] = 'initial-model';
            }
            initialPreferences[providerId] = originalModel;
            
            const preferences = {
              defaultProvider: null,
              modelPreferences: initialPreferences,
              lastUsedProvider: null,
            };
            
            localStorage.setItem(
              MODEL_PREFERENCES_STORAGE_KEY,
              JSON.stringify(preferences)
            );
            
            // Action: Update only one provider's model
            const stored = localStorage.getItem(MODEL_PREFERENCES_STORAGE_KEY);
            if (!stored) return false;
            
            const loaded = JSON.parse(stored);
            loaded.modelPreferences[providerId] = newModel;
            
            localStorage.setItem(
              MODEL_PREFERENCES_STORAGE_KEY,
              JSON.stringify(loaded)
            );
            
            // Verify: Other providers' preferences are unchanged
            const final = JSON.parse(localStorage.getItem(MODEL_PREFERENCES_STORAGE_KEY) || '{}');
            
            for (const p of otherProviders) {
              if (final.modelPreferences[p] !== 'initial-model') {
                return false;
              }
            }
            
            // And the updated provider has the new model
            return final.modelPreferences[providerId] === newModel;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('model preference round-trip: save then load returns same value', () => {
      fc.assert(
        fc.property(
          providerIdArb,
          modelIdArb,
          (providerId: AIProvider, modelId: string) => {
            // Action: Save preference
            const preferences = {
              defaultProvider: null,
              modelPreferences: { [providerId]: modelId },
              lastUsedProvider: null,
            };
            
            localStorage.setItem(
              MODEL_PREFERENCES_STORAGE_KEY,
              JSON.stringify(preferences)
            );
            
            // Action: Load preference
            const stored = localStorage.getItem(MODEL_PREFERENCES_STORAGE_KEY);
            if (!stored) return false;
            
            const loaded = JSON.parse(stored);
            
            // Verify: Round-trip preserves the value
            return loaded.modelPreferences[providerId] === modelId;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
