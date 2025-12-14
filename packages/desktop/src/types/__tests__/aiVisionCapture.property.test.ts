/**
 * Property-Based Tests for AI Vision Capture Types
 *
 * Tests correctness properties for the AI Vision Capture action schema,
 * ensuring all required fields are present with correct types and valid values.
 *
 * Uses fast-check for property-based testing.
 *
 * **Feature: ai-vision-capture, Property 1: AI Vision Capture Action Schema Validation**
 * **Validates: Requirements 5.1, 5.2, 5.3**
 */

import * as fc from 'fast-check';
import {
  AIVisionCaptureAction,
  VisionROI,
  StaticData,
  DynamicConfig,
  CacheData,
  InteractionType,
  SearchScope,
  ScreenDimensions,
  createAIVisionCaptureAction,
  DEFAULT_CACHE_DATA,
  DEFAULT_DYNAMIC_CONFIG,
} from '../aiVisionCapture.types';

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
  x: fc.integer({ min: 0, max: 10000 }),
  y: fc.integer({ min: 0, max: 10000 }),
  width: fc.integer({ min: 1, max: 5000 }),
  height: fc.integer({ min: 1, max: 5000 }),
});

/**
 * Arbitrary for optional VisionROI
 */
const optionalVisionROIArb = fc.option(visionROIArb, { nil: null });

/**
 * Arbitrary for valid file paths (POSIX format)
 */
const filePathArb = fc.string({ minLength: 1, maxLength: 255 })
  .filter(s => !s.includes('..') && /^[a-zA-Z0-9_\-/.]+$/.test(s));

/**
 * Arbitrary for valid StaticData
 */
const staticDataArb: fc.Arbitrary<StaticData> = fc.record({
  original_screenshot: filePathArb,
  saved_x: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: null }),
  saved_y: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: null }),
  screen_dim: screenDimArb,
});

/**
 * Arbitrary for valid DynamicConfig
 */
const dynamicConfigArb: fc.Arbitrary<DynamicConfig> = fc.record({
  prompt: fc.string({ maxLength: 1000 }),
  reference_images: fc.array(filePathArb, { maxLength: 10 }),
  roi: optionalVisionROIArb,
  search_scope: searchScopeArb,
});

/**
 * Arbitrary for valid CacheData
 */
const cacheDataArb: fc.Arbitrary<CacheData> = fc.record({
  cached_x: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: null }),
  cached_y: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: null }),
  cache_dim: fc.option(screenDimArb, { nil: null }),
});

/**
 * Arbitrary for valid AIVisionCaptureAction
 */
const aiVisionCaptureActionArb: fc.Arbitrary<AIVisionCaptureAction> = fc.record({
  type: fc.constant('ai_vision_capture' as const),
  id: uuidArb,
  timestamp: timestampArb,
  is_dynamic: fc.boolean(),
  interaction: interactionTypeArb,
  static_data: staticDataArb,
  dynamic_config: dynamicConfigArb,
  cache_data: cacheDataArb,
});

// ============================================================================
// Property Tests
// ============================================================================

describe('AI Vision Capture Schema Property Tests', () => {
  describe('Property 1: AI Vision Capture Action Schema Validation', () => {
    /**
     * **Feature: ai-vision-capture, Property 1: AI Vision Capture Action Schema Validation**
     * **Validates: Requirements 5.1, 5.2, 5.3**
     */
    it('generated actions pass schema validation', () => {
      fc.assert(
        fc.property(aiVisionCaptureActionArb, (action) => {
          // Verify all required fields exist
          expect(action.type).toBeDefined();
          expect(action.id).toBeDefined();
          expect(action.timestamp).toBeDefined();
          expect(action.is_dynamic).toBeDefined();
          expect(action.interaction).toBeDefined();
          expect(action.static_data).toBeDefined();
          expect(action.dynamic_config).toBeDefined();
          expect(action.cache_data).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('action type is always "ai_vision_capture"', () => {
      fc.assert(
        fc.property(aiVisionCaptureActionArb, (action) => {
          expect(action.type).toBe('ai_vision_capture');
        }),
        { numRuns: 100 }
      );
    });

    it('action id is a non-empty string', () => {
      fc.assert(
        fc.property(aiVisionCaptureActionArb, (action) => {
          expect(typeof action.id).toBe('string');
          expect(action.id.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('timestamp is a non-negative number', () => {
      fc.assert(
        fc.property(aiVisionCaptureActionArb, (action) => {
          expect(typeof action.timestamp).toBe('number');
          expect(action.timestamp).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    it('is_dynamic is a boolean', () => {
      fc.assert(
        fc.property(aiVisionCaptureActionArb, (action) => {
          expect(typeof action.is_dynamic).toBe('boolean');
        }),
        { numRuns: 100 }
      );
    });

    it('interaction is a valid InteractionType', () => {
      const validTypes: InteractionType[] = ['click', 'dblclick', 'rclick', 'hover'];
      fc.assert(
        fc.property(aiVisionCaptureActionArb, (action) => {
          expect(validTypes).toContain(action.interaction);
        }),
        { numRuns: 100 }
      );
    });

    it('static_data contains all required fields', () => {
      fc.assert(
        fc.property(aiVisionCaptureActionArb, (action) => {
          expect(action.static_data.original_screenshot).toBeDefined();
          expect(action.static_data.screen_dim).toBeDefined();
          expect(Array.isArray(action.static_data.screen_dim)).toBe(true);
          expect(action.static_data.screen_dim.length).toBe(2);
        }),
        { numRuns: 100 }
      );
    });

    it('dynamic_config contains all required fields', () => {
      fc.assert(
        fc.property(aiVisionCaptureActionArb, (action) => {
          expect(action.dynamic_config.prompt).toBeDefined();
          expect(Array.isArray(action.dynamic_config.reference_images)).toBe(true);
          expect(['global', 'regional']).toContain(action.dynamic_config.search_scope);
        }),
        { numRuns: 100 }
      );
    });

    it('cache_data contains all required fields', () => {
      fc.assert(
        fc.property(aiVisionCaptureActionArb, (action) => {
          // cached_x, cached_y, cache_dim can be null
          expect('cached_x' in action.cache_data).toBe(true);
          expect('cached_y' in action.cache_data).toBe(true);
          expect('cache_dim' in action.cache_data).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('screen_dim values are positive integers', () => {
      fc.assert(
        fc.property(aiVisionCaptureActionArb, (action) => {
          const [width, height] = action.static_data.screen_dim;
          expect(Number.isInteger(width)).toBe(true);
          expect(Number.isInteger(height)).toBe(true);
          expect(width).toBeGreaterThan(0);
          expect(height).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('reference_images are all strings', () => {
      fc.assert(
        fc.property(aiVisionCaptureActionArb, (action) => {
          action.dynamic_config.reference_images.forEach((img) => {
            expect(typeof img).toBe('string');
          });
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('createAIVisionCaptureAction factory', () => {
    it('creates valid actions with default values', () => {
      fc.assert(
        fc.property(uuidArb, timestampArb, filePathArb, screenDimArb, (id, timestamp, path, screenDim) => {
          const action = createAIVisionCaptureAction(id, timestamp, path, screenDim);
          expect(action.type).toBe('ai_vision_capture');
          expect(action.id).toBe(id);
          expect(action.timestamp).toBe(timestamp);
          expect(action.static_data.original_screenshot).toBe(path);
          expect(action.static_data.screen_dim).toEqual(screenDim);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: ai-vision-capture, Property 12: Default Mode Invariant**
     * **Validates: Requirements 3.1**
     */
    it('sets is_dynamic to false by default (Requirement 3.1)', () => {
      fc.assert(
        fc.property(uuidArb, timestampArb, filePathArb, screenDimArb, (id, timestamp, path, screenDim) => {
          const action = createAIVisionCaptureAction(id, timestamp, path, screenDim);
          expect(action.is_dynamic).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('sets interaction to "click" by default', () => {
      fc.assert(
        fc.property(uuidArb, timestampArb, filePathArb, screenDimArb, (id, timestamp, path, screenDim) => {
          const action = createAIVisionCaptureAction(id, timestamp, path, screenDim);
          expect(action.interaction).toBe('click');
        }),
        { numRuns: 100 }
      );
    });

    it('initializes saved_x and saved_y to null', () => {
      fc.assert(
        fc.property(uuidArb, timestampArb, filePathArb, screenDimArb, (id, timestamp, path, screenDim) => {
          const action = createAIVisionCaptureAction(id, timestamp, path, screenDim);
          expect(action.static_data.saved_x).toBeNull();
          expect(action.static_data.saved_y).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('initializes cache_data with null values', () => {
      fc.assert(
        fc.property(uuidArb, timestampArb, filePathArb, screenDimArb, (id, timestamp, path, screenDim) => {
          const action = createAIVisionCaptureAction(id, timestamp, path, screenDim);
          expect(action.cache_data.cached_x).toBeNull();
          expect(action.cache_data.cached_y).toBeNull();
          expect(action.cache_data.cache_dim).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('preserves provided id, timestamp, path, and screenDim', () => {
      fc.assert(
        fc.property(uuidArb, timestampArb, filePathArb, screenDimArb, (id, timestamp, path, screenDim) => {
          const action = createAIVisionCaptureAction(id, timestamp, path, screenDim);
          expect(action.id).toBe(id);
          expect(action.timestamp).toBe(timestamp);
          expect(action.static_data.original_screenshot).toBe(path);
          expect(action.static_data.screen_dim[0]).toBe(screenDim[0]);
          expect(action.static_data.screen_dim[1]).toBe(screenDim[1]);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Default constants', () => {
    it('DEFAULT_CACHE_DATA has all null values', () => {
      expect(DEFAULT_CACHE_DATA.cached_x).toBeNull();
      expect(DEFAULT_CACHE_DATA.cached_y).toBeNull();
      expect(DEFAULT_CACHE_DATA.cache_dim).toBeNull();
    });

    it('DEFAULT_DYNAMIC_CONFIG has correct default values', () => {
      expect(DEFAULT_DYNAMIC_CONFIG.prompt).toBe('');
      expect(DEFAULT_DYNAMIC_CONFIG.reference_images).toEqual([]);
      expect(DEFAULT_DYNAMIC_CONFIG.roi).toBeNull();
      expect(DEFAULT_DYNAMIC_CONFIG.search_scope).toBe('global');
    });
  });
});
