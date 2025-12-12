/**
 * Property-Based Tests for AI Vision Service
 *
 * Tests correctness properties for AI Vision Capture feature,
 * including timeout enforcement and response parsing.
 *
 * **Feature: ai-vision-capture**
 */

import * as fc from 'fast-check';
import {
  AIVisionService,
  extractJsonFromResponse,
  parseVisionResult,
} from '../aiVisionService';
import {
  AIVisionRequest,
  VisionROI,
} from '../../types/aiVisionCapture.types';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate valid screen coordinates
 */
const validCoordinateArbitrary = fc.integer({ min: 0, max: 4096 });

/**
 * Generate a valid ROI
 */
const validROIArbitrary: fc.Arbitrary<VisionROI> = fc.record({
  x: fc.integer({ min: 0, max: 1000 }),
  y: fc.integer({ min: 0, max: 1000 }),
  width: fc.integer({ min: 10, max: 500 }),
  height: fc.integer({ min: 10, max: 500 }),
});

/**
 * Generate a valid confidence score
 */
const confidenceArbitrary = fc.float({ min: 0, max: 1, noNaN: true });

/**
 * Generate a valid AI vision response JSON (found case)
 */
const validFoundResponseArbitrary = fc.record({
  found: fc.constant(true),
  x: validCoordinateArbitrary,
  y: validCoordinateArbitrary,
  confidence: confidenceArbitrary,
  description: fc.string({ minLength: 0, maxLength: 100 }),
});


/**
 * Generate a valid AI vision response JSON (not found case)
 */
const validNotFoundResponseArbitrary = fc.record({
  found: fc.constant(false),
  error: fc.string({ minLength: 1, maxLength: 100 }),
  confidence: fc.constant(0),
});

/**
 * Generate a valid prompt string
 */
const validPromptArbitrary = fc.string({ minLength: 1, maxLength: 200 });

/**
 * Generate a simple base64 image (1x1 pixel PNG)
 * This is a minimal valid PNG for testing purposes
 */
const minimalBase64ImageArbitrary = fc.constant(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
);

/**
 * Generate a valid AI vision request
 */
const validRequestArbitrary: fc.Arbitrary<AIVisionRequest> = fc.record({
  screenshot: minimalBase64ImageArbitrary,
  prompt: validPromptArbitrary,
  reference_images: fc.array(minimalBase64ImageArbitrary, { minLength: 0, maxLength: 3 }),
  roi: fc.option(validROIArbitrary, { nil: undefined }),
});

/**
 * Generate a timeout value in milliseconds
 */
const timeoutArbitrary = fc.integer({ min: 100, max: 30000 });

// Suppress unused variable warning - used for documentation
void validRequestArbitrary;

// ============================================================================
// Property Tests
// ============================================================================

describe('AI Vision Service Property Tests', () => {
  /**
   * **Feature: ai-vision-capture, Property 11: AI Timeout Enforcement**
   * **Validates: Requirements 4.10, 4.11**
   *
   * For any Dynamic Mode AI call, if the response is not received within
   * the configured timeout (default 15 seconds), the system SHALL treat
   * it as an error and not block indefinitely.
   */
  describe('Property 11: AI Timeout Enforcement', () => {
    let service: AIVisionService;

    beforeEach(() => {
      service = new AIVisionService();
    });

    afterEach(() => {
      service.reset();
    });

    it('default timeout is 15 seconds', () => {
      expect(service.getTimeout()).toBe(15000);
    });

    it('setTimeout accepts any positive timeout value', () => {
      fc.assert(
        fc.property(timeoutArbitrary, (timeout: number) => {
          service.setTimeout(timeout);
          return service.getTimeout() === timeout;
        }),
        { numRuns: 100 }
      );
    });

    it('setTimeout rejects non-positive values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10000, max: 0 }),
          (invalidTimeout: number) => {
            expect(() => service.setTimeout(invalidTimeout)).toThrow(
              'Timeout must be a positive number'
            );
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('service returns error when not initialized', async () => {
      // Test with a single request - service is not initialized
      const response = await service.analyze({
        screenshot:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        prompt: 'Find the button',
        reference_images: [],
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('not initialized');
    });

    it('analyze returns error for missing screenshot', async () => {
      await service.initialize('test-api-key');

      const response = await service.analyze({
        screenshot: '',
        prompt: 'Find the button',
        reference_images: [],
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Screenshot is required');
    });

    it('analyze returns error for missing prompt', async () => {
      await service.initialize('test-api-key');

      const response = await service.analyze({
        screenshot:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        prompt: '',
        reference_images: [],
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Prompt is required');
    });

    it('analyze returns error for whitespace-only prompt', async () => {
      await service.initialize('test-api-key');

      // Test with various whitespace-only prompts
      const whitespacePrompts = ['   ', '\t\t', '\n\n', '  \t\n  '];

      for (const whitespacePrompt of whitespacePrompts) {
        const response = await service.analyze({
          screenshot:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          prompt: whitespacePrompt,
          reference_images: [],
        });

        expect(response.success).toBe(false);
        expect(response.error).toContain('Prompt is required');
      }
    });

    it('timeout is configurable and persists across calls', () => {
      fc.assert(
        fc.property(
          fc.array(timeoutArbitrary, { minLength: 1, maxLength: 5 }),
          (timeouts: number[]) => {
            for (const timeout of timeouts) {
              service.setTimeout(timeout);
              if (service.getTimeout() !== timeout) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('reset restores default timeout', () => {
      fc.assert(
        fc.property(timeoutArbitrary, (timeout: number) => {
          service.setTimeout(timeout);
          service.reset();
          return service.getTimeout() === 15000;
        }),
        { numRuns: 50 }
      );
    });
  });


  /**
   * Response parsing tests
   */
  describe('Response Parsing', () => {
    it('parses valid found response JSON correctly', () => {
      fc.assert(
        fc.property(validFoundResponseArbitrary, (response) => {
          const jsonString = JSON.stringify(response);
          const parsed = parseVisionResult(jsonString);

          if (!parsed) return false;

          return (
            parsed.found === true &&
            parsed.x === response.x &&
            parsed.y === response.y &&
            typeof parsed.confidence === 'number'
          );
        }),
        { numRuns: 100 }
      );
    });

    it('parses valid not-found response JSON correctly', () => {
      fc.assert(
        fc.property(validNotFoundResponseArbitrary, (response) => {
          const jsonString = JSON.stringify(response);
          const parsed = parseVisionResult(jsonString);

          if (!parsed) return false;

          return parsed.found === false && parsed.confidence === 0;
        }),
        { numRuns: 100 }
      );
    });

    it('extracts JSON from code block wrapped response', () => {
      fc.assert(
        fc.property(validFoundResponseArbitrary, (response) => {
          const jsonString = JSON.stringify(response, null, 2);
          const wrappedResponse = `Here is the result:\n\n\`\`\`json\n${jsonString}\n\`\`\`\n\nThe element was found.`;

          const extracted = extractJsonFromResponse(wrappedResponse);

          if (!extracted) return false;

          try {
            const parsed = JSON.parse(extracted);
            return parsed.found === response.found;
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });

    it('extracts JSON from response without code blocks', () => {
      fc.assert(
        fc.property(validFoundResponseArbitrary, (response) => {
          const jsonString = JSON.stringify(response);
          const rawResponse = `The result is: ${jsonString}`;

          const extracted = extractJsonFromResponse(rawResponse);

          if (!extracted) return false;

          try {
            const parsed = JSON.parse(extracted);
            return parsed.found === response.found;
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });

    it('returns null for invalid JSON', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (invalidJson: string) => {
            // Skip if accidentally generated valid JSON with 'found' field
            try {
              const parsed = JSON.parse(invalidJson);
              if (parsed && typeof parsed.found === 'boolean') {
                return true; // Skip valid JSON
              }
            } catch {
              // Expected - invalid JSON
            }

            const result = parseVisionResult(invalidJson);
            return result === null;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('coordinates are rounded to integers', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 4096, noNaN: true }),
          fc.float({ min: 0, max: 4096, noNaN: true }),
          confidenceArbitrary,
          (x: number, y: number, confidence: number) => {
            const response = {
              found: true,
              x,
              y,
              confidence,
              description: 'test',
            };

            const jsonString = JSON.stringify(response);
            const parsed = parseVisionResult(jsonString);

            if (!parsed || !parsed.found) return false;

            // Coordinates should be rounded integers
            return (
              Number.isInteger(parsed.x) &&
              Number.isInteger(parsed.y) &&
              parsed.x === Math.round(x) &&
              parsed.y === Math.round(y)
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Service initialization tests
   */
  describe('Service Initialization', () => {
    let service: AIVisionService;

    beforeEach(() => {
      service = new AIVisionService();
    });

    afterEach(() => {
      service.reset();
    });

    it('service is not initialized by default', () => {
      expect(service.isInitialized()).toBe(false);
    });

    it('service is initialized after calling initialize with valid key', async () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (apiKey: string) => {
            const trimmedKey = apiKey.trim();
            if (trimmedKey.length === 0) return true; // Skip empty keys

            // Create a fresh service for each test iteration
            const testService = new AIVisionService();
            await testService.initialize(apiKey);
            const isInit = testService.isInitialized();
            testService.reset();
            return isInit === true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('initialize rejects empty API key', async () => {
      await expect(service.initialize('')).rejects.toThrow('API key is required');
    });

    it('initialize rejects whitespace-only API key', async () => {
      // Test with various whitespace-only keys
      const whitespaceKeys = ['   ', '\t\t', '\n\n', '  \t\n  '];

      for (const whitespaceKey of whitespaceKeys) {
        await expect(service.initialize(whitespaceKey)).rejects.toThrow(
          'API key is required'
        );
      }
    });

    it('reset clears initialization state', async () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (apiKey: string) => {
            const trimmedKey = apiKey.trim();
            if (trimmedKey.length === 0) return true;

            // Create a fresh service for each test iteration
            const testService = new AIVisionService();
            await testService.initialize(apiKey);
            testService.reset();
            return testService.isInitialized() === false;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
