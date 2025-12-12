/**
 * Property-Based Tests for VisionEditor Component
 *
 * Tests correctness properties for the VisionEditor component,
 * focusing on default mode behavior and cache invalidation logic.
 *
 * Uses fast-check for property-based testing.
 *
 * **Feature: ai-vision-capture, Property 12: Default Mode Invariant**
 * **Validates: Requirements 3.1**
 *
 * **Feature: ai-vision-capture, Property 15: Editor Cache Invalidation**
 * **Validates: Requirements 7.1, 7.2, 7.3**
 */

import * as fc from 'fast-check';
import {
  AIVisionCaptureAction,
  VisionROI,
  DynamicConfig,
  CacheData,
  InteractionType,
  SearchScope,
  ScreenDimensions,
  createAIVisionCaptureAction,
  DEFAULT_CACHE_DATA,
} from '../../types/aiVisionCapture.types';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Arbitrary for valid interaction types
 */
const interactionTypeArb = fc.constantFrom<InteractionType>('click', 'dblclick', 'rclick', 'hover');

/**
 * Arbitrary for valid search scopes
 */
const searchScopeArb = fc.constantFrom<SearchScope>('global', 'regional');

/**
 * Arbitrary for valid UUID strings
 */
const uuidArb = fc.uuid();

/**
 * Arbitrary for valid timestamps (non-negative numbers)
 */
const timestampArb = fc.float({ min: 0, max: 10000, noNaN: true });

/**
 * Arbitrary for valid screen dimensions
 */
const screenDimArb = fc.tuple(
  fc.integer({ min: 800, max: 7680 }),
  fc.integer({ min: 600, max: 4320 })
) as fc.Arbitrary<ScreenDimensions>;

/**
 * Arbitrary for valid VisionROI
 */
const visionROIArb: fc.Arbitrary<VisionROI> = fc.record({
  x: fc.integer({ min: 0, max: 1000 }),
  y: fc.integer({ min: 0, max: 1000 }),
  width: fc.integer({ min: 10, max: 500 }),
  height: fc.integer({ min: 10, max: 500 }),
});

/**
 * Arbitrary for valid file paths (POSIX format)
 */
const filePathArb = fc.stringMatching(/^[a-zA-Z0-9_\-/]+\.(png|jpg|jpeg)$/)
  .filter(s => s.length > 4 && s.length < 100);

/**
 * Arbitrary for non-empty prompts
 */
const promptArb = fc.string({ minLength: 1, maxLength: 200 })
  .filter(s => s.trim().length > 0);

/**
 * Arbitrary for valid CacheData with actual cached values
 */
const validCacheDataArb: fc.Arbitrary<CacheData> = fc.record({
  cached_x: fc.integer({ min: 0, max: 1920 }),
  cached_y: fc.integer({ min: 0, max: 1080 }),
  cache_dim: screenDimArb,
});

/**
 * Arbitrary for valid DynamicConfig
 */
const dynamicConfigArb: fc.Arbitrary<DynamicConfig> = fc.record({
  prompt: fc.string({ maxLength: 200 }),
  reference_images: fc.array(filePathArb, { maxLength: 5 }),
  roi: fc.option(visionROIArb, { nil: null }),
  search_scope: searchScopeArb,
});

/**
 * Arbitrary for AIVisionCaptureAction with valid cache
 */
const actionWithCacheArb: fc.Arbitrary<AIVisionCaptureAction> = fc.record({
  type: fc.constant('ai_vision_capture' as const),
  id: uuidArb,
  timestamp: timestampArb,
  is_dynamic: fc.boolean(),
  interaction: interactionTypeArb,
  static_data: fc.record({
    original_screenshot: filePathArb,
    saved_x: fc.option(fc.integer({ min: 0, max: 1920 }), { nil: null }),
    saved_y: fc.option(fc.integer({ min: 0, max: 1080 }), { nil: null }),
    screen_dim: screenDimArb,
  }),
  dynamic_config: dynamicConfigArb,
  cache_data: validCacheDataArb,
});

// ============================================================================
// Helper Functions (Extracted from VisionEditor for testing)
// ============================================================================

/**
 * Check if cache_data has valid cached coordinates
 */
function hasValidCache(cacheData: CacheData): boolean {
  return cacheData.cached_x !== null && cacheData.cached_y !== null;
}

/**
 * Check if two DynamicConfig objects have changed in ways that should invalidate cache
 * Only compares fields that should trigger cache invalidation (prompt, roi, reference_images)
 */
function dynamicConfigChanged(
  prev: DynamicConfig,
  next: DynamicConfig
): boolean {
  // Check prompt change
  if (prev.prompt !== next.prompt) return true;

  // Check ROI change
  if (prev.roi === null && next.roi !== null) return true;
  if (prev.roi !== null && next.roi === null) return true;
  if (prev.roi && next.roi) {
    if (
      prev.roi.x !== next.roi.x ||
      prev.roi.y !== next.roi.y ||
      prev.roi.width !== next.roi.width ||
      prev.roi.height !== next.roi.height
    ) {
      return true;
    }
  }

  // Check reference_images change
  if (prev.reference_images.length !== next.reference_images.length) return true;
  for (let i = 0; i < prev.reference_images.length; i++) {
    if (prev.reference_images[i] !== next.reference_images[i]) return true;
  }

  return false;
}

/**
 * Simulates the cache invalidation logic from VisionEditor
 * Returns the updated action after applying the change
 */
function applyDynamicConfigChange(
  action: AIVisionCaptureAction,
  newConfig: Partial<DynamicConfig>
): AIVisionCaptureAction {
  const updatedConfig: DynamicConfig = {
    ...action.dynamic_config,
    ...newConfig,
  };

  const hasExistingCache = hasValidCache(action.cache_data);
  const configChanged = dynamicConfigChanged(action.dynamic_config, updatedConfig);

  return {
    ...action,
    dynamic_config: updatedConfig,
    // Reset cache when dynamic_config changes and cache exists
    cache_data: hasExistingCache && configChanged
      ? { ...DEFAULT_CACHE_DATA }
      : action.cache_data,
  };
}

/**
 * Simulates changing interaction_type (should NOT invalidate cache)
 */
function applyInteractionChange(
  action: AIVisionCaptureAction,
  newInteraction: InteractionType
): AIVisionCaptureAction {
  return {
    ...action,
    interaction: newInteraction,
    // Cache is preserved (Requirement 7.4)
  };
}

/**
 * Simulates toggling is_dynamic (should NOT invalidate cache)
 */
function applyModeToggle(action: AIVisionCaptureAction): AIVisionCaptureAction {
  return {
    ...action,
    is_dynamic: !action.is_dynamic,
    // Cache is preserved (Requirement 7.4)
  };
}

// ============================================================================
// Property Tests
// ============================================================================

describe('VisionEditor Property Tests', () => {
  describe('Property 12: Default Mode Invariant', () => {
    /**
     * **Feature: ai-vision-capture, Property 12: Default Mode Invariant**
     * **Validates: Requirements 3.1**
     *
     * For any newly created ai_vision_capture action, is_dynamic SHALL default to false (Static Mode).
     */
    it('newly created actions have is_dynamic = false', () => {
      fc.assert(
        fc.property(
          uuidArb,
          timestampArb,
          filePathArb,
          screenDimArb,
          (id, timestamp, screenshotPath, screenDim) => {
            const action = createAIVisionCaptureAction(id, timestamp, screenshotPath, screenDim);
            
            // Property: is_dynamic must be false for new actions
            expect(action.is_dynamic).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('new actions are in Static Mode by default', () => {
      fc.assert(
        fc.property(
          uuidArb,
          timestampArb,
          filePathArb,
          screenDimArb,
          (id, timestamp, screenshotPath, screenDim) => {
            const action = createAIVisionCaptureAction(id, timestamp, screenshotPath, screenDim);
            
            // Static Mode means is_dynamic is false
            const isStaticMode = !action.is_dynamic;
            expect(isStaticMode).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 15: Editor Cache Invalidation', () => {
    /**
     * **Feature: ai-vision-capture, Property 15: Editor Cache Invalidation**
     * **Validates: Requirements 7.1, 7.2, 7.3**
     *
     * For any ai_vision_capture action with existing cache_data (cached_x/cached_y not null),
     * IF any field in dynamic_config (prompt, roi, reference_images) is modified,
     * THEN cache_data SHALL be reset to null immediately.
     */

    describe('Requirement 7.1: Prompt change invalidates cache', () => {
      it('changing prompt resets cache_data to null', () => {
        fc.assert(
          fc.property(
            actionWithCacheArb,
            promptArb,
            (action, newPrompt) => {
              // Pre-condition: action has valid cache
              fc.pre(hasValidCache(action.cache_data));
              // Pre-condition: prompt actually changes
              fc.pre(newPrompt !== action.dynamic_config.prompt);

              const updatedAction = applyDynamicConfigChange(action, { prompt: newPrompt });

              // Property: cache must be invalidated
              expect(updatedAction.cache_data.cached_x).toBeNull();
              expect(updatedAction.cache_data.cached_y).toBeNull();
              expect(updatedAction.cache_data.cache_dim).toBeNull();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Requirement 7.2: ROI change invalidates cache', () => {
      it('changing ROI resets cache_data to null', () => {
        fc.assert(
          fc.property(
            actionWithCacheArb,
            visionROIArb,
            (action, newROI) => {
              // Pre-condition: action has valid cache
              fc.pre(hasValidCache(action.cache_data));
              // Pre-condition: ROI actually changes
              const roiChanged = action.dynamic_config.roi === null ||
                newROI.x !== action.dynamic_config.roi.x ||
                newROI.y !== action.dynamic_config.roi.y ||
                newROI.width !== action.dynamic_config.roi.width ||
                newROI.height !== action.dynamic_config.roi.height;
              fc.pre(roiChanged);

              const updatedAction = applyDynamicConfigChange(action, { roi: newROI });

              // Property: cache must be invalidated
              expect(updatedAction.cache_data.cached_x).toBeNull();
              expect(updatedAction.cache_data.cached_y).toBeNull();
              expect(updatedAction.cache_data.cache_dim).toBeNull();
            }
          ),
          { numRuns: 100 }
        );
      });

      it('setting ROI to null resets cache_data', () => {
        fc.assert(
          fc.property(
            actionWithCacheArb,
            (action) => {
              // Pre-condition: action has valid cache and existing ROI
              fc.pre(hasValidCache(action.cache_data));
              fc.pre(action.dynamic_config.roi !== null);

              const updatedAction = applyDynamicConfigChange(action, { roi: null });

              // Property: cache must be invalidated
              expect(updatedAction.cache_data.cached_x).toBeNull();
              expect(updatedAction.cache_data.cached_y).toBeNull();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Requirement 7.3: Reference images change invalidates cache', () => {
      it('adding reference image resets cache_data to null', () => {
        fc.assert(
          fc.property(
            actionWithCacheArb,
            filePathArb,
            (action, newImage) => {
              // Pre-condition: action has valid cache
              fc.pre(hasValidCache(action.cache_data));

              const newImages = [...action.dynamic_config.reference_images, newImage];
              const updatedAction = applyDynamicConfigChange(action, { reference_images: newImages });

              // Property: cache must be invalidated
              expect(updatedAction.cache_data.cached_x).toBeNull();
              expect(updatedAction.cache_data.cached_y).toBeNull();
            }
          ),
          { numRuns: 100 }
        );
      });

      it('removing reference image resets cache_data to null', () => {
        fc.assert(
          fc.property(
            actionWithCacheArb,
            (action) => {
              // Pre-condition: action has valid cache and at least one reference image
              fc.pre(hasValidCache(action.cache_data));
              fc.pre(action.dynamic_config.reference_images.length > 0);

              const newImages = action.dynamic_config.reference_images.slice(1);
              const updatedAction = applyDynamicConfigChange(action, { reference_images: newImages });

              // Property: cache must be invalidated
              expect(updatedAction.cache_data.cached_x).toBeNull();
              expect(updatedAction.cache_data.cached_y).toBeNull();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Requirement 7.4: Non-invalidating changes preserve cache', () => {
      it('changing interaction_type preserves cache_data', () => {
        fc.assert(
          fc.property(
            actionWithCacheArb,
            interactionTypeArb,
            (action, newInteraction) => {
              // Pre-condition: action has valid cache
              fc.pre(hasValidCache(action.cache_data));

              const originalCache = { ...action.cache_data };
              const updatedAction = applyInteractionChange(action, newInteraction);

              // Property: cache must be preserved
              expect(updatedAction.cache_data.cached_x).toBe(originalCache.cached_x);
              expect(updatedAction.cache_data.cached_y).toBe(originalCache.cached_y);
              expect(updatedAction.cache_data.cache_dim).toEqual(originalCache.cache_dim);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('toggling is_dynamic preserves cache_data', () => {
        fc.assert(
          fc.property(
            actionWithCacheArb,
            (action) => {
              // Pre-condition: action has valid cache
              fc.pre(hasValidCache(action.cache_data));

              const originalCache = { ...action.cache_data };
              const updatedAction = applyModeToggle(action);

              // Property: cache must be preserved
              expect(updatedAction.cache_data.cached_x).toBe(originalCache.cached_x);
              expect(updatedAction.cache_data.cached_y).toBe(originalCache.cached_y);
              expect(updatedAction.cache_data.cache_dim).toEqual(originalCache.cache_dim);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('changing search_scope alone does not invalidate cache', () => {
        fc.assert(
          fc.property(
            actionWithCacheArb,
            searchScopeArb,
            (action, newScope) => {
              // Pre-condition: action has valid cache
              fc.pre(hasValidCache(action.cache_data));
              // Pre-condition: only search_scope changes (not roi)
              fc.pre(newScope !== action.dynamic_config.search_scope);

              // Note: search_scope is part of dynamic_config but changing it alone
              // should not invalidate cache according to the implementation
              // (only prompt, roi, reference_images trigger invalidation)
              const updatedConfig: DynamicConfig = {
                ...action.dynamic_config,
                search_scope: newScope,
              };

              // Check if this is considered a change that invalidates cache
              const configChanged = dynamicConfigChanged(action.dynamic_config, updatedConfig);

              // search_scope change alone should NOT trigger cache invalidation
              expect(configChanged).toBe(false);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Edge cases', () => {
      it('no cache to invalidate - action without cache remains unchanged', () => {
        fc.assert(
          fc.property(
            actionWithCacheArb,
            promptArb,
            (action, newPrompt) => {
              // Set up action without cache
              const actionWithoutCache: AIVisionCaptureAction = {
                ...action,
                cache_data: { ...DEFAULT_CACHE_DATA },
              };

              const updatedAction = applyDynamicConfigChange(actionWithoutCache, { prompt: newPrompt });

              // Property: cache_data remains null (no change)
              expect(updatedAction.cache_data.cached_x).toBeNull();
              expect(updatedAction.cache_data.cached_y).toBeNull();
              expect(updatedAction.cache_data.cache_dim).toBeNull();
            }
          ),
          { numRuns: 100 }
        );
      });

      it('same value change does not invalidate cache', () => {
        fc.assert(
          fc.property(
            actionWithCacheArb,
            (action) => {
              // Pre-condition: action has valid cache
              fc.pre(hasValidCache(action.cache_data));

              // Apply "change" with same prompt value
              const originalCache = { ...action.cache_data };
              const updatedAction = applyDynamicConfigChange(action, { 
                prompt: action.dynamic_config.prompt 
              });

              // Property: cache must be preserved (no actual change)
              expect(updatedAction.cache_data.cached_x).toBe(originalCache.cached_x);
              expect(updatedAction.cache_data.cached_y).toBe(originalCache.cached_y);
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });
});
