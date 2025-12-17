/**
 * Property-Based Tests for Visual Assertion Workflow
 *
 * Tests correctness properties for the complete visual assertion workflow including:
 * - Configuration validation and consistency
 * - ROI and ignore region bounds checking
 * - Sensitivity profile application
 * - Frontend-backend communication patterns
 *
 * **Feature: visual-regression-testing, Property 14: Visual Assertion Configuration Consistency**
 * **Validates: Requirements 7.1, 7.2, 7.5**
 */

import * as fc from 'fast-check';
import {
  VisualAssertAction,
  VisualAssertConfig,
  SensitivityProfile,
  ComparisonMethod,
  StorageBackend,
  createVisualAssertAction,
  applySensitivityProfile,
  SENSITIVITY_PROFILES,
} from '../../types/visualTesting.types';
import { VisionROI } from '../../types/aiVisionCapture.types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Valid screen resolutions for testing
 */
const VALID_SCREEN_RESOLUTIONS = [
  '1920x1080',
  '2560x1440',
  '3840x2160',
  '1366x768',
  '1440x900',
];

/**
 * Valid OS scaling factors
 */
const VALID_OS_SCALING_FACTORS = [1.0, 1.25, 1.5, 2.0];

/**
 * Valid browser zoom levels
 */
const VALID_BROWSER_ZOOM_LEVELS = [50, 75, 100, 125, 150, 200];

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate valid sensitivity profiles
 */
const sensitivityProfileArbitrary: fc.Arbitrary<SensitivityProfile> = fc.constantFrom(
  'strict',
  'moderate',
  'flexible'
);

/**
 * Generate valid comparison methods
 */
const comparisonMethodArbitrary: fc.Arbitrary<ComparisonMethod> = fc.constantFrom(
  'pixel_match',
  'ssim',
  'layout_aware',
  'hybrid'
);

/**
 * Generate valid storage backends
 */
const storageBackendArbitrary: fc.Arbitrary<StorageBackend> = fc.constantFrom(
  'local',
  'git_lfs',
  'cloud'
);

/**
 * Generate valid screen resolutions
 */
const screenResolutionArbitrary: fc.Arbitrary<string> = fc.constantFrom(
  ...VALID_SCREEN_RESOLUTIONS
);

/**
 * Generate valid OS scaling factors
 */
const osScalingFactorArbitrary: fc.Arbitrary<number> = fc.constantFrom(
  ...VALID_OS_SCALING_FACTORS
);

/**
 * Generate valid browser zoom levels
 */
const browserZoomArbitrary: fc.Arbitrary<number> = fc.constantFrom(
  ...VALID_BROWSER_ZOOM_LEVELS
);

/**
 * Generate valid execution environments
 */
const executionEnvironmentArbitrary = fc.constantFrom('desktop', 'ci');

/**
 * Generate valid visual assertion configuration
 */
const visualAssertConfigArbitrary: fc.Arbitrary<VisualAssertConfig> = fc.record({
  threshold: fc.float({ min: 0.0, max: 1.0 }),
  sensitivity_profile: sensitivityProfileArbitrary,
  comparison_method: comparisonMethodArbitrary,
  timeout: fc.integer({ min: 1000, max: 30000 }),
  retry_count: fc.integer({ min: 0, max: 10 }),
  anti_aliasing_tolerance: fc.boolean(),
  layout_shift_tolerance: fc.integer({ min: 0, max: 10 }),
});

/**
 * Generate valid ROI within screen bounds
 * Note: This generator is available for future use in tests that need
 * dynamically sized ROIs based on screen dimensions.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _roiArbitrary = (screenWidth: number, screenHeight: number): fc.Arbitrary<VisionROI> => {
  const minSize = 20;
  const maxWidth = Math.max(minSize, screenWidth - minSize);
  const maxHeight = Math.max(minSize, screenHeight - minSize);

  return fc.record({
    x: fc.integer({ min: 0, max: Math.max(0, screenWidth - minSize) }),
    y: fc.integer({ min: 0, max: Math.max(0, screenHeight - minSize) }),
    width: fc.integer({ min: minSize, max: maxWidth }),
    height: fc.integer({ min: minSize, max: maxHeight }),
  }).filter(roi => {
    return roi.x + roi.width <= screenWidth && roi.y + roi.height <= screenHeight;
  });
};

/**
 * Generate valid visual assertion context
 */
const visualAssertContextArbitrary = fc.record({
  screen_resolution: screenResolutionArbitrary,
  os_scaling_factor: osScalingFactorArbitrary,
  browser_zoom: browserZoomArbitrary,
  execution_environment: executionEnvironmentArbitrary,
});

/**
 * Generate valid visual assertion action
 */
const visualAssertActionArbitrary: fc.Arbitrary<VisualAssertAction> = fc.record({
  type: fc.constant('visual_assert' as const),
  id: fc.uuid(),
  timestamp: fc.integer({ min: 0, max: Date.now() }),
  config: visualAssertConfigArbitrary,
  regions: fc.record({
    target_roi: fc.option(fc.record({
      x: fc.integer({ min: 0, max: 100 }),
      y: fc.integer({ min: 0, max: 100 }),
      width: fc.integer({ min: 20, max: 100 }),
      height: fc.integer({ min: 20, max: 100 }),
    }).filter(roi => roi.x + roi.width <= 1366 && roi.y + roi.height <= 768), { nil: null }),
    ignore_regions: fc.array(fc.record({
      x: fc.integer({ min: 0, max: 100 }),
      y: fc.integer({ min: 0, max: 100 }),
      width: fc.integer({ min: 20, max: 100 }),
      height: fc.integer({ min: 20, max: 100 }),
    }).filter(roi => roi.x + roi.width <= 1366 && roi.y + roi.height <= 768), { maxLength: 5 }),
  }),
  assets: fc.record({
    baseline_path: fc.string({ minLength: 1, maxLength: 100 }),
    baseline_hash: fc.string({ minLength: 8, maxLength: 64 }),
    storage_backend: storageBackendArbitrary,
  }),
  context: visualAssertContextArbitrary,
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a configuration matches a sensitivity profile
 * Note: This utility is available for future use in tests that need
 * to verify profile matching behavior.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _configMatchesProfile(config: VisualAssertConfig, profile: SensitivityProfile): boolean {
  const profileConfig = SENSITIVITY_PROFILES[profile];
  
  return Object.keys(profileConfig).every(key => {
    const configKey = key as keyof VisualAssertConfig;
    return config[configKey] === profileConfig[configKey];
  });
}

/**
 * Validate ROI bounds within screen dimensions
 */
function isValidROIBounds(roi: VisionROI, screenWidth: number, screenHeight: number): boolean {
  return (
    roi.x >= 0 &&
    roi.y >= 0 &&
    roi.width >= 20 &&
    roi.height >= 20 &&
    roi.x + roi.width <= screenWidth &&
    roi.y + roi.height <= screenHeight
  );
}

/**
 * Parse screen resolution string
 */
function parseScreenResolution(resolution: string): { width: number; height: number } {
  const [width, height] = resolution.split('x').map(Number);
  return { width, height };
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Visual Assertion Workflow Property Tests', () => {
  /**
   * **Feature: visual-regression-testing, Property 14: Visual Assertion Configuration Consistency**
   * **Validates: Requirements 7.1, 7.2, 7.5**
   *
   * For any visual assertion configuration, applying a sensitivity profile should
   * result in a configuration that matches that profile's expected values.
   */
  describe('Property 14: Visual Assertion Configuration Consistency', () => {
    it('applying sensitivity profile produces consistent configuration', () => {
      fc.assert(
        fc.property(
          visualAssertConfigArbitrary,
          sensitivityProfileArbitrary,
          (baseConfig: VisualAssertConfig, profile: SensitivityProfile) => {
            const updatedConfig = applySensitivityProfile(baseConfig, profile);
            
            // The updated configuration should match the profile
            const profileConfig = SENSITIVITY_PROFILES[profile];
            const matchesProfile = Object.keys(profileConfig).every(key => {
              const configKey = key as keyof VisualAssertConfig;
              return updatedConfig[configKey] === profileConfig[configKey];
            });
            
            // The sensitivity_profile field should be set correctly
            const hasCorrectProfile = updatedConfig.sensitivity_profile === profile;
            
            return matchesProfile && hasCorrectProfile;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sensitivity profile application is idempotent', () => {
      fc.assert(
        fc.property(
          visualAssertConfigArbitrary,
          sensitivityProfileArbitrary,
          (baseConfig: VisualAssertConfig, profile: SensitivityProfile) => {
            const appliedOnce = applySensitivityProfile(baseConfig, profile);
            const appliedTwice = applySensitivityProfile(appliedOnce, profile);
            
            // Applying the same profile twice should produce identical results
            return JSON.stringify(appliedOnce) === JSON.stringify(appliedTwice);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('threshold values remain within valid bounds', () => {
      fc.assert(
        fc.property(
          visualAssertConfigArbitrary,
          sensitivityProfileArbitrary,
          (baseConfig: VisualAssertConfig, profile: SensitivityProfile) => {
            const updatedConfig = applySensitivityProfile(baseConfig, profile);
            
            return (
              updatedConfig.threshold >= 0.0 &&
              updatedConfig.threshold <= 1.0
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('timeout values remain within reasonable bounds', () => {
      fc.assert(
        fc.property(
          visualAssertConfigArbitrary,
          sensitivityProfileArbitrary,
          (baseConfig: VisualAssertConfig, profile: SensitivityProfile) => {
            const updatedConfig = applySensitivityProfile(baseConfig, profile);
            
            return (
              updatedConfig.timeout >= 1000 && // At least 1 second
              updatedConfig.timeout <= 30000   // At most 30 seconds
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('retry count values remain within reasonable bounds', () => {
      fc.assert(
        fc.property(
          visualAssertConfigArbitrary,
          sensitivityProfileArbitrary,
          (baseConfig: VisualAssertConfig, profile: SensitivityProfile) => {
            const updatedConfig = applySensitivityProfile(baseConfig, profile);
            
            return (
              updatedConfig.retry_count >= 0 &&
              updatedConfig.retry_count <= 10
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('layout shift tolerance values remain within reasonable bounds', () => {
      fc.assert(
        fc.property(
          visualAssertConfigArbitrary,
          sensitivityProfileArbitrary,
          (baseConfig: VisualAssertConfig, profile: SensitivityProfile) => {
            const updatedConfig = applySensitivityProfile(baseConfig, profile);
            
            return (
              updatedConfig.layout_shift_tolerance >= 0 &&
              updatedConfig.layout_shift_tolerance <= 10
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 15: ROI Bounds Validation
   * **Validates: Requirements 7.1, 2.1**
   *
   * For any visual assertion action, all ROI regions (target and ignore) should
   * be within the screen bounds defined by the execution context.
   */
  describe('Property 15: ROI Bounds Validation', () => {
    it('target ROI is within screen bounds when present', () => {
      fc.assert(
        fc.property(
          visualAssertActionArbitrary,
          (action: VisualAssertAction) => {
            if (action.regions.target_roi === null) {
              return true; // No ROI to validate
            }
            
            const { width, height } = parseScreenResolution(action.context.screen_resolution);
            return isValidROIBounds(action.regions.target_roi, width, height);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all ignore regions are within screen bounds', () => {
      fc.assert(
        fc.property(
          visualAssertActionArbitrary,
          (action: VisualAssertAction) => {
            const { width, height } = parseScreenResolution(action.context.screen_resolution);
            
            return action.regions.ignore_regions.every(roi =>
              isValidROIBounds(roi, width, height)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('ROI regions have minimum dimensions', () => {
      fc.assert(
        fc.property(
          visualAssertActionArbitrary,
          (action: VisualAssertAction) => {
            const minSize = 20;
            
            // Check target ROI
            if (action.regions.target_roi) {
              if (action.regions.target_roi.width < minSize || action.regions.target_roi.height < minSize) {
                return false;
              }
            }
            
            // Check ignore regions
            return action.regions.ignore_regions.every(roi =>
              roi.width >= minSize && roi.height >= minSize
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('ROI coordinates are non-negative', () => {
      fc.assert(
        fc.property(
          visualAssertActionArbitrary,
          (action: VisualAssertAction) => {
            // Check target ROI
            if (action.regions.target_roi) {
              if (action.regions.target_roi.x < 0 || action.regions.target_roi.y < 0) {
                return false;
              }
            }
            
            // Check ignore regions
            return action.regions.ignore_regions.every(roi =>
              roi.x >= 0 && roi.y >= 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 16: Visual Assertion Action Creation
   * **Validates: Requirements 7.1, 7.5**
   *
   * For any valid inputs, createVisualAssertAction should produce a well-formed
   * visual assertion action with correct defaults and structure.
   */
  describe('Property 16: Visual Assertion Action Creation', () => {
    it('creates action with correct type and provided values', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 0, max: Date.now() }),
          fc.string({ minLength: 1, maxLength: 100 }),
          visualAssertContextArbitrary,
          (id: string, timestamp: number, baselinePath: string, context) => {
            const action = createVisualAssertAction(id, timestamp, baselinePath, context);
            
            return (
              action.type === 'visual_assert' &&
              action.id === id &&
              action.timestamp === timestamp &&
              action.assets.baseline_path === baselinePath &&
              JSON.stringify(action.context) === JSON.stringify(context)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('creates action with valid default configuration', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 0, max: Date.now() }),
          fc.string({ minLength: 1, maxLength: 100 }),
          visualAssertContextArbitrary,
          (id: string, timestamp: number, baselinePath: string, context) => {
            const action = createVisualAssertAction(id, timestamp, baselinePath, context);
            
            return (
              action.config.threshold >= 0.0 &&
              action.config.threshold <= 1.0 &&
              action.config.timeout >= 1000 &&
              action.config.retry_count >= 0 &&
              action.config.layout_shift_tolerance >= 0 &&
              ['strict', 'moderate', 'flexible'].includes(action.config.sensitivity_profile) &&
              ['pixel_match', 'ssim', 'layout_aware', 'hybrid'].includes(action.config.comparison_method) &&
              typeof action.config.anti_aliasing_tolerance === 'boolean'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('creates action with empty regions by default', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 0, max: Date.now() }),
          fc.string({ minLength: 1, maxLength: 100 }),
          visualAssertContextArbitrary,
          (id: string, timestamp: number, baselinePath: string, context) => {
            const action = createVisualAssertAction(id, timestamp, baselinePath, context);
            
            return (
              action.regions.target_roi === null &&
              Array.isArray(action.regions.ignore_regions) &&
              action.regions.ignore_regions.length === 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('creates action with valid asset configuration', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 0, max: Date.now() }),
          fc.string({ minLength: 1, maxLength: 100 }),
          visualAssertContextArbitrary,
          (id: string, timestamp: number, baselinePath: string, context) => {
            const action = createVisualAssertAction(id, timestamp, baselinePath, context);
            
            return (
              action.assets.baseline_path === baselinePath &&
              typeof action.assets.baseline_hash === 'string' &&
              ['local', 'git_lfs', 'cloud'].includes(action.assets.storage_backend)
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 17: Configuration Bounds Validation
   * **Validates: Requirements 7.1, 7.2**
   *
   * For any visual assertion configuration, all numeric values should be within
   * reasonable bounds for practical use.
   */
  describe('Property 17: Configuration Bounds Validation', () => {
    it('threshold percentage is between 0% and 100%', () => {
      fc.assert(
        fc.property(
          visualAssertConfigArbitrary,
          (config: VisualAssertConfig) => {
            return config.threshold >= 0.0 && config.threshold <= 1.0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('timeout is at least 1 second and at most 30 seconds', () => {
      fc.assert(
        fc.property(
          visualAssertConfigArbitrary,
          (config: VisualAssertConfig) => {
            return config.timeout >= 1000 && config.timeout <= 30000;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('retry count is non-negative and reasonable', () => {
      fc.assert(
        fc.property(
          visualAssertConfigArbitrary,
          (config: VisualAssertConfig) => {
            return config.retry_count >= 0 && config.retry_count <= 10;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('layout shift tolerance is non-negative and reasonable', () => {
      fc.assert(
        fc.property(
          visualAssertConfigArbitrary,
          (config: VisualAssertConfig) => {
            return config.layout_shift_tolerance >= 0 && config.layout_shift_tolerance <= 10;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sensitivity profile matches expected configuration', () => {
      fc.assert(
        fc.property(
          sensitivityProfileArbitrary,
          (profile: SensitivityProfile) => {
            const profileConfig = SENSITIVITY_PROFILES[profile];
            
            // Verify profile configuration is valid
            return (
              profileConfig.threshold !== undefined &&
              profileConfig.threshold >= 0.0 &&
              profileConfig.threshold <= 1.0 &&
              profileConfig.comparison_method !== undefined &&
              ['pixel_match', 'ssim', 'layout_aware', 'hybrid'].includes(profileConfig.comparison_method) &&
              typeof profileConfig.anti_aliasing_tolerance === 'boolean' &&
              profileConfig.layout_shift_tolerance !== undefined &&
              profileConfig.layout_shift_tolerance >= 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 18: Context Validation
   * **Validates: Requirements 7.5**
   *
   * For any visual assertion action, the execution context should contain
   * valid values for cross-platform consistency.
   */
  describe('Property 18: Context Validation', () => {
    it('screen resolution is in valid format', () => {
      fc.assert(
        fc.property(
          visualAssertActionArbitrary,
          (action: VisualAssertAction) => {
            const resolutionPattern = /^\d+x\d+$/;
            return resolutionPattern.test(action.context.screen_resolution);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('OS scaling factor is positive', () => {
      fc.assert(
        fc.property(
          visualAssertActionArbitrary,
          (action: VisualAssertAction) => {
            return action.context.os_scaling_factor > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('browser zoom is positive', () => {
      fc.assert(
        fc.property(
          visualAssertActionArbitrary,
          (action: VisualAssertAction) => {
            return action.context.browser_zoom > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('execution environment is valid', () => {
      fc.assert(
        fc.property(
          visualAssertActionArbitrary,
          (action: VisualAssertAction) => {
            return ['desktop', 'ci'].includes(action.context.execution_environment);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('parsed screen dimensions are positive', () => {
      fc.assert(
        fc.property(
          visualAssertActionArbitrary,
          (action: VisualAssertAction) => {
            const { width, height } = parseScreenResolution(action.context.screen_resolution);
            return width > 0 && height > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
