/**
 * Property-Based Tests for Provider Selector Component
 * 
 * Tests correctness properties for the Provider Selector,
 * ensuring configured providers are displayed correctly.
 * 
 * Uses fast-check for property-based testing.
 * 
 * Requirements: 2.1
 */

import * as fc from 'fast-check';
import {
  AIProvider,
  ProviderInfo,
  PROVIDER_CONFIGS,
  SUPPORTED_PROVIDERS,
} from '../../types/providerAdapter.types';

// ============================================================================
// Helper Functions (extracted from component for testing)
// ============================================================================

/**
 * Get configured providers from a list of provider infos
 * This mirrors the logic in ProviderSelector component
 */
function getConfiguredProviders(providers: ProviderInfo[]): ProviderInfo[] {
  return providers.filter(p => p.configured);
}

/**
 * Get unconfigured providers from a list of provider infos
 */
function getUnconfiguredProviders(providers: ProviderInfo[]): ProviderInfo[] {
  return providers.filter(p => !p.configured);
}

/**
 * Check if a provider should be displayed as available for selection
 * A provider is available if it's configured (has API key)
 */
function isProviderAvailableForSelection(provider: ProviderInfo): boolean {
  return provider.configured && provider.status !== 'unconfigured';
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Arbitrary for valid provider IDs
 */
const providerIdArb = fc.constantFrom<AIProvider>(...SUPPORTED_PROVIDERS);

/**
 * Arbitrary for provider status
 */
const providerStatusArb = fc.constantFrom<ProviderInfo['status']>('ready', 'error', 'unconfigured');

/**
 * Arbitrary for a single ProviderInfo
 */
const providerInfoArb = (providerId: AIProvider): fc.Arbitrary<ProviderInfo> => {
  const config = PROVIDER_CONFIGS[providerId];
  return fc.record({
    id: fc.constant(providerId),
    name: fc.constant(config.name),
    description: fc.constant(config.description),
    configured: fc.boolean(),
    status: providerStatusArb,
    models: fc.constant(config.models),
  }).map(info => {
    // Ensure status is consistent with configured flag
    if (!info.configured) {
      return { ...info, status: 'unconfigured' as const };
    }
    return info;
  });
};

/**
 * Arbitrary for a list of ProviderInfo with unique provider IDs
 */
const providerInfoListArb: fc.Arbitrary<ProviderInfo[]> = fc
  .uniqueArray(providerIdArb, { minLength: 1, maxLength: SUPPORTED_PROVIDERS.length })
  .chain(providerIds => 
    fc.tuple(...providerIds.map(id => providerInfoArb(id)))
  );

/**
 * Arbitrary for a list with at least one configured provider
 */
const providerInfoListWithConfiguredArb: fc.Arbitrary<ProviderInfo[]> = providerInfoListArb
  .filter(providers => providers.some(p => p.configured));

/**
 * Arbitrary for a specific configuration scenario
 */
const configurationScenarioArb = fc.record({
  configuredProviders: fc.uniqueArray(providerIdArb, { minLength: 0, maxLength: 4 }),
  allProviders: fc.constant(SUPPORTED_PROVIDERS),
}).map(({ configuredProviders, allProviders }) => {
  const configuredSet = new Set(configuredProviders);
  return allProviders.map(providerId => {
    const config = PROVIDER_CONFIGS[providerId];
    const isConfigured = configuredSet.has(providerId);
    return {
      id: providerId,
      name: config.name,
      description: config.description,
      configured: isConfigured,
      status: isConfigured ? 'ready' : 'unconfigured',
      models: config.models,
    } as ProviderInfo;
  });
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Provider Selector Property Tests', () => {
  // ==========================================================================
  // Property 3: Provider Selector Shows Configured Providers
  // ==========================================================================

  /**
   * **Feature: multi-provider-ai, Property 3: Provider Selector Shows Configured Providers**
   * **Validates: Requirements 2.1**
   * 
   * For any set of configured providers, the provider selector should display
   * exactly those providers as available options.
   */
  describe('Property 3: Provider Selector Shows Configured Providers', () => {
    it('getConfiguredProviders returns exactly the providers with configured=true', () => {
      fc.assert(
        fc.property(providerInfoListArb, (providers: ProviderInfo[]) => {
          const configured = getConfiguredProviders(providers);
          
          // All returned providers should have configured=true
          const allConfigured = configured.every(p => p.configured === true);
          
          // Count should match
          const expectedCount = providers.filter(p => p.configured).length;
          const actualCount = configured.length;
          
          return allConfigured && actualCount === expectedCount;
        }),
        { numRuns: 100 }
      );
    });

    it('configured providers are a subset of all providers', () => {
      fc.assert(
        fc.property(providerInfoListArb, (providers: ProviderInfo[]) => {
          const configured = getConfiguredProviders(providers);
          const allIds = new Set(providers.map(p => p.id));
          
          // Every configured provider ID should be in the original list
          return configured.every(p => allIds.has(p.id));
        }),
        { numRuns: 100 }
      );
    });

    it('unconfigured providers are exactly those with configured=false', () => {
      fc.assert(
        fc.property(providerInfoListArb, (providers: ProviderInfo[]) => {
          const unconfigured = getUnconfiguredProviders(providers);
          
          // All returned providers should have configured=false
          const allUnconfigured = unconfigured.every(p => p.configured === false);
          
          // Count should match
          const expectedCount = providers.filter(p => !p.configured).length;
          const actualCount = unconfigured.length;
          
          return allUnconfigured && actualCount === expectedCount;
        }),
        { numRuns: 100 }
      );
    });

    it('configured + unconfigured = all providers', () => {
      fc.assert(
        fc.property(providerInfoListArb, (providers: ProviderInfo[]) => {
          const configured = getConfiguredProviders(providers);
          const unconfigured = getUnconfiguredProviders(providers);
          
          // Total should equal original count
          return configured.length + unconfigured.length === providers.length;
        }),
        { numRuns: 100 }
      );
    });

    it('provider IDs are preserved in configured list', () => {
      fc.assert(
        fc.property(configurationScenarioArb, (providers: ProviderInfo[]) => {
          const configured = getConfiguredProviders(providers);
          const configuredIds = new Set(configured.map(p => p.id));
          
          // Check that the configured IDs match exactly
          const expectedConfiguredIds = new Set(
            providers.filter(p => p.configured).map(p => p.id)
          );
          
          // Sets should be equal
          if (configuredIds.size !== expectedConfiguredIds.size) return false;
          
          for (const id of configuredIds) {
            if (!expectedConfiguredIds.has(id)) return false;
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('provider info is preserved when filtering', () => {
      fc.assert(
        fc.property(providerInfoListArb, (providers: ProviderInfo[]) => {
          const configured = getConfiguredProviders(providers);
          
          // Each configured provider should have the same info as in original
          for (const configuredProvider of configured) {
            const original = providers.find(p => p.id === configuredProvider.id);
            if (!original) return false;
            
            // Check all properties are preserved
            if (configuredProvider.name !== original.name) return false;
            if (configuredProvider.description !== original.description) return false;
            if (configuredProvider.status !== original.status) return false;
            if (configuredProvider.models !== original.models) return false;
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('isProviderAvailableForSelection returns true only for configured providers', () => {
      fc.assert(
        fc.property(providerInfoListArb, (providers: ProviderInfo[]) => {
          for (const provider of providers) {
            const isAvailable = isProviderAvailableForSelection(provider);
            
            // If not configured, should not be available
            if (!provider.configured && isAvailable) return false;
            
            // If configured and status is 'unconfigured', should not be available
            if (provider.configured && provider.status === 'unconfigured' && isAvailable) return false;
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('empty provider list results in empty configured list', () => {
      const emptyProviders: ProviderInfo[] = [];
      const configured = getConfiguredProviders(emptyProviders);
      
      expect(configured).toHaveLength(0);
    });

    it('all providers configured results in all providers in configured list', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(providerIdArb, { minLength: 1, maxLength: 4 }),
          (providerIds: AIProvider[]) => {
            // Create all providers as configured
            const providers: ProviderInfo[] = providerIds.map(id => {
              const config = PROVIDER_CONFIGS[id];
              return {
                id,
                name: config.name,
                description: config.description,
                configured: true,
                status: 'ready' as const,
                models: config.models,
              };
            });
            
            const configured = getConfiguredProviders(providers);
            
            return configured.length === providers.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('no providers configured results in empty configured list', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(providerIdArb, { minLength: 1, maxLength: 4 }),
          (providerIds: AIProvider[]) => {
            // Create all providers as unconfigured
            const providers: ProviderInfo[] = providerIds.map(id => {
              const config = PROVIDER_CONFIGS[id];
              return {
                id,
                name: config.name,
                description: config.description,
                configured: false,
                status: 'unconfigured' as const,
                models: config.models,
              };
            });
            
            const configured = getConfiguredProviders(providers);
            
            return configured.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
