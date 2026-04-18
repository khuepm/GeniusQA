/**
 * Type definitions for Visual Regression Testing feature
 *
 * This module defines all TypeScript interfaces and types used in the Visual Regression Testing feature.
 * It provides type safety for visual assertions, comparison configurations, and diff review workflows.
 *
 * Requirements: 7.1, 7.2, 7.5
 */

import { VisionROI } from './aiVisionCapture.types';

/**
 * Comparison method for visual assertions
 *
 * @typedef {'pixel_match' | 'ssim' | 'layout_aware' | 'hybrid'} ComparisonMethod
 * - pixel_match: Strict pixel-by-pixel comparison (fastest)
 * - ssim: Structural Similarity Index (most tolerant)
 * - layout_aware: Smart comparison with shift tolerance (balanced)
 * - hybrid: Combination of methods
 */
export type ComparisonMethod = 'pixel_match' | 'ssim' | 'layout_aware' | 'hybrid';

/**
 * Sensitivity profile for comparison tolerance
 *
 * @typedef {'strict' | 'moderate' | 'flexible'} SensitivityProfile
 * - strict: threshold: 0.001, no tolerance, PixelMatch algorithm
 * - moderate: threshold: 0.01, 1px shift tolerance, LayoutAware algorithm
 * - flexible: threshold: 0.05, 2px shift tolerance + anti-aliasing, SSIM algorithm
 */
export type SensitivityProfile = 'strict' | 'moderate' | 'flexible';

/**
 * Difference type classification
 *
 * @typedef {'no_change' | 'layout_shift' | 'content_change' | 'color_variation' | 'dimension_mismatch'} DifferenceType
 */
export type DifferenceType = 'no_change' | 'layout_shift' | 'content_change' | 'color_variation' | 'dimension_mismatch';

/**
 * Storage backend type
 *
 * @typedef {'local' | 'git_lfs' | 'cloud'} StorageBackend
 */
export type StorageBackend = 'local' | 'git_lfs' | 'cloud';

/**
 * Visual assertion configuration
 *
 * Contains all settings for visual comparison including thresholds,
 * algorithms, regions, and performance requirements.
 *
 * @interface VisualAssertConfig
 */
export interface VisualAssertConfig {
  /** Difference threshold (0.0 to 1.0, e.g., 0.01 for 1% difference) */
  threshold: number;
  /** Sensitivity profile (determines default algorithm and tolerances) */
  sensitivity_profile: SensitivityProfile;
  /** Comparison algorithm to use */
  comparison_method: ComparisonMethod;
  /** Timeout for screen stability wait (milliseconds) */
  timeout: number;
  /** Number of retry attempts for screenshot capture */
  retry_count: number;
  /** Enable anti-aliasing tolerance for font rendering differences */
  anti_aliasing_tolerance: boolean;
  /** Layout shift tolerance in pixels (1-2px acceptable displacement) */
  layout_shift_tolerance: number;
}

/**
 * Visual assertion regions configuration
 *
 * Defines target ROI and ignore regions for focused comparison.
 *
 * @interface VisualAssertRegions
 */
export interface VisualAssertRegions {
  /** Target region of interest (null = fullscreen comparison) */
  target_roi: VisionROI | null;
  /** Areas to exclude from comparison (dynamic content) */
  ignore_regions: VisionROI[];
}

/**
 * Visual assertion asset references
 *
 * Contains paths and metadata for baseline images and storage configuration.
 *
 * @interface VisualAssertAssets
 */
export interface VisualAssertAssets {
  /** Relative path to baseline image */
  baseline_path: string;
  /** File integrity checksum for baseline */
  baseline_hash: string;
  /** Storage backend configuration */
  storage_backend: StorageBackend;
}

/**
 * Visual assertion execution context
 *
 * Contains environment information for cross-platform consistency.
 *
 * @interface VisualAssertContext
 */
export interface VisualAssertContext {
  /** Screen resolution at capture time */
  screen_resolution: string;
  /** OS scaling factor (1.0, 1.25, 1.5, etc.) */
  os_scaling_factor: number;
  /** Browser zoom level (100%, 125%, etc.) */
  browser_zoom: number;
  /** Execution environment */
  execution_environment: 'desktop' | 'ci';
}

/**
 * Visual Assert Action
 *
 * Complete action object for visual regression testing.
 * Extends the existing action model with visual comparison capabilities.
 *
 * @interface VisualAssertAction
 */
export interface VisualAssertAction {
  /** Action type identifier - always 'visual_assert' */
  type: 'visual_assert';
  /** Unique identifier (UUID) */
  id: string;
  /** Time in seconds since recording start */
  timestamp: number;
  
  /** Visual assertion configuration */
  config: VisualAssertConfig;
  /** Regions definition (ROI and ignore areas) */
  regions: VisualAssertRegions;
  /** Asset references and storage settings */
  assets: VisualAssertAssets;
  /** Execution context for consistency */
  context: VisualAssertContext;
}

/**
 * Visual test result
 *
 * Result of visual assertion execution with detailed metrics and file paths.
 *
 * @interface VisualTestResult
 */
export interface VisualTestResult {
  /** Associated action ID */
  action_id: string;
  /** Whether the test passed */
  passed: boolean;
  /** Difference percentage (0.0 to 1.0) */
  difference_percentage: number;
  /** Type of difference detected */
  difference_type: DifferenceType;
  /** Path to baseline image */
  baseline_path: string;
  /** Path to actual captured image */
  actual_path: string;
  /** Path to diff image (null if no differences) */
  diff_path: string | null;
  /** Performance metrics */
  performance_metrics: VisualTestPerformanceMetrics;
  /** Error details if test failed */
  error_details: string | null;
  /** Number of retry attempts made */
  retry_count: number;
}

/**
 * Performance metrics for visual testing
 *
 * @interface VisualTestPerformanceMetrics
 */
export interface VisualTestPerformanceMetrics {
  /** Time taken to capture screenshot (ms) */
  capture_time_ms: number;
  /** Time taken for image comparison (ms) */
  comparison_time_ms: number;
  /** Total execution time (ms) */
  total_time_ms: number;
}

/**
 * Diff view mode for review interface
 *
 * @typedef {'side-by-side' | 'slider' | 'overlay'} DiffViewMode
 */
export type DiffViewMode = 'side-by-side' | 'slider' | 'overlay';

/**
 * Diff review action type
 *
 * @typedef {'approve' | 'reject' | 'add_ignore_region' | 'retry'} DiffReviewAction
 */
export type DiffReviewAction = 'approve' | 'reject' | 'add_ignore_region' | 'retry';

/**
 * Default configuration values
 */
export const DEFAULT_VISUAL_ASSERT_CONFIG: VisualAssertConfig = {
  threshold: 0.01, // 1% difference threshold
  sensitivity_profile: 'moderate',
  comparison_method: 'layout_aware',
  timeout: 3000, // 3 seconds for stability
  retry_count: 3,
  anti_aliasing_tolerance: true,
  layout_shift_tolerance: 2, // 2 pixels
};

export const DEFAULT_VISUAL_ASSERT_REGIONS: VisualAssertRegions = {
  target_roi: null, // Full screen by default
  ignore_regions: [],
};

/**
 * Sensitivity profile configurations
 */
export const SENSITIVITY_PROFILES: Record<SensitivityProfile, Partial<VisualAssertConfig>> = {
  strict: {
    threshold: 0.001,
    comparison_method: 'pixel_match',
    anti_aliasing_tolerance: false,
    layout_shift_tolerance: 0,
  },
  moderate: {
    threshold: 0.01,
    comparison_method: 'layout_aware',
    anti_aliasing_tolerance: true,
    layout_shift_tolerance: 1,
  },
  flexible: {
    threshold: 0.05,
    comparison_method: 'ssim',
    anti_aliasing_tolerance: true,
    layout_shift_tolerance: 2,
  },
};

/**
 * Creates a new Visual Assert action with default values
 *
 * @param id - Unique identifier (UUID)
 * @param timestamp - Time in seconds since recording start
 * @param baselinePath - Path to baseline image
 * @param context - Execution context
 * @returns A new VisualAssertAction with default values
 */
export function createVisualAssertAction(
  id: string,
  timestamp: number,
  baselinePath: string,
  context: VisualAssertContext
): VisualAssertAction {
  return {
    type: 'visual_assert',
    id,
    timestamp,
    config: { ...DEFAULT_VISUAL_ASSERT_CONFIG },
    regions: { ...DEFAULT_VISUAL_ASSERT_REGIONS },
    assets: {
      baseline_path: baselinePath,
      baseline_hash: '',
      storage_backend: 'local',
    },
    context,
  };
}

/**
 * Applies sensitivity profile to configuration
 *
 * @param config - Current configuration
 * @param profile - Sensitivity profile to apply
 * @returns Updated configuration with profile settings
 */
export function applySensitivityProfile(
  config: VisualAssertConfig,
  profile: SensitivityProfile
): VisualAssertConfig {
  const profileConfig = SENSITIVITY_PROFILES[profile];
  return {
    ...config,
    ...profileConfig,
    sensitivity_profile: profile,
  };
}
