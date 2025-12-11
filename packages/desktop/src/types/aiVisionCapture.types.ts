/**
 * Type definitions for AI Vision Capture feature
 *
 * This module defines all TypeScript interfaces and types used in the AI Vision Capture feature.
 * It provides type safety for vision-based automation actions that use AI to locate UI elements.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

/**
 * Interaction type for AI Vision Capture actions
 *
 * Defines the type of mouse interaction to perform at the detected coordinates.
 *
 * @typedef {'click' | 'dblclick' | 'rclick' | 'hover'} InteractionType
 * - click: Single left mouse click
 * - dblclick: Double left mouse click
 * - rclick: Single right mouse click (context menu)
 * - hover: Move mouse to position without clicking
 */
export type InteractionType = 'click' | 'dblclick' | 'rclick' | 'hover';

/**
 * Search scope for AI Vision analysis
 *
 * Determines whether AI searches the entire screen or only within a defined region.
 *
 * @typedef {'global' | 'regional'} SearchScope
 * - global: Search the entire screen (ignore ROI)
 * - regional: Search only within the defined vision_region (ROI)
 */
export type SearchScope = 'global' | 'regional';

/**
 * Vision Region of Interest (ROI)
 *
 * Defines a rectangular area on the screenshot for regional search.
 * Used to limit the AI search area for better accuracy and performance.
 *
 * @interface VisionROI
 * @property {number} x - X coordinate of the top-left corner (pixels)
 * @property {number} y - Y coordinate of the top-left corner (pixels)
 * @property {number} width - Width of the region (pixels)
 * @property {number} height - Height of the region (pixels)
 */
export interface VisionROI {
  /** X coordinate of the top-left corner (pixels) */
  x: number;
  /** Y coordinate of the top-left corner (pixels) */
  y: number;
  /** Width of the region (pixels) */
  width: number;
  /** Height of the region (pixels) */
  height: number;
}


/**
 * Screen dimensions tuple
 *
 * Represents screen width and height as a tuple [width, height].
 *
 * @typedef {[number, number]} ScreenDimensions
 */
export type ScreenDimensions = [number, number];

/**
 * Static data for AI Vision Capture action
 *
 * Contains data captured during recording and coordinates saved during editing.
 * Used for Static Mode playback (0 token cost).
 *
 * @interface StaticData
 * @property {string} original_screenshot - Relative path to the captured screenshot
 * @property {number | null} saved_x - X coordinate saved during editing (null if not analyzed)
 * @property {number | null} saved_y - Y coordinate saved during editing (null if not analyzed)
 * @property {ScreenDimensions} screen_dim - Screen dimensions [width, height] at capture time
 */
export interface StaticData {
  /** Relative path to the captured screenshot */
  original_screenshot: string;
  /** X coordinate saved during editing (null if not analyzed) */
  saved_x: number | null;
  /** Y coordinate saved during editing (null if not analyzed) */
  saved_y: number | null;
  /** Screen dimensions [width, height] at capture time */
  screen_dim: ScreenDimensions;
}

/**
 * Dynamic configuration for AI Vision Capture action
 *
 * Contains AI prompt, reference images, and search settings for Dynamic Mode.
 * Used when AI needs to find elements at runtime.
 *
 * @interface DynamicConfig
 * @property {string} prompt - User prompt describing the target element
 * @property {string[]} reference_images - Array of relative paths to reference images
 * @property {VisionROI | null} roi - Region of Interest for regional search (null for global)
 * @property {SearchScope} search_scope - Search scope setting (global or regional)
 */
export interface DynamicConfig {
  /** User prompt describing the target element */
  prompt: string;
  /** Array of relative paths to reference images (POSIX format) */
  reference_images: string[];
  /** Region of Interest for regional search (null for global search) */
  roi: VisionROI | null;
  /** Search scope setting (global or regional) */
  search_scope: SearchScope;
}

/**
 * Cache data for Dynamic Mode results
 *
 * Stores coordinates from successful Dynamic Mode AI calls.
 * Enables 0 token cost playback on subsequent runs.
 *
 * @interface CacheData
 * @property {number | null} cached_x - Cached X coordinate from AI (null if no cache)
 * @property {number | null} cached_y - Cached Y coordinate from AI (null if no cache)
 * @property {ScreenDimensions | null} cache_dim - Screen dimensions when cache was created
 */
export interface CacheData {
  /** Cached X coordinate from successful AI call (null if no cache) */
  cached_x: number | null;
  /** Cached Y coordinate from successful AI call (null if no cache) */
  cached_y: number | null;
  /** Screen dimensions [width, height] when cache was created (null if no cache) */
  cache_dim: ScreenDimensions | null;
}

/**
 * AI Vision Capture Action
 *
 * Complete action object for AI-based visual element detection and interaction.
 * Supports both Static Mode (pre-analyzed coordinates) and Dynamic Mode (runtime AI).
 *
 * @interface AIVisionCaptureAction
 * @property {'ai_vision_capture'} type - Action type identifier
 * @property {string} id - Unique identifier (UUID)
 * @property {number} timestamp - Time in seconds since recording start
 * @property {boolean} is_dynamic - Whether to use Dynamic Mode (true) or Static Mode (false)
 * @property {InteractionType} interaction - Type of mouse interaction to perform
 * @property {StaticData} static_data - Static capture data and saved coordinates
 * @property {DynamicConfig} dynamic_config - AI configuration for dynamic search
 * @property {CacheData} cache_data - Cached coordinates from Dynamic Mode
 */
export interface AIVisionCaptureAction {
  /** Action type identifier - always 'ai_vision_capture' */
  type: 'ai_vision_capture';
  /** Unique identifier (UUID) */
  id: string;
  /** Time in seconds since recording start */
  timestamp: number;
  /** Whether to use Dynamic Mode (true) or Static Mode (false, default) */
  is_dynamic: boolean;
  /** Type of mouse interaction to perform at detected coordinates */
  interaction: InteractionType;
  /** Static capture data and saved coordinates */
  static_data: StaticData;
  /** AI configuration for dynamic search */
  dynamic_config: DynamicConfig;
  /** Cached coordinates from successful Dynamic Mode AI calls */
  cache_data: CacheData;
}

/**
 * AI Vision Service Request
 *
 * Request payload for AI vision analysis.
 *
 * @interface AIVisionRequest
 * @property {string} screenshot - Base64 encoded screenshot or file path
 * @property {string} prompt - User prompt describing the target element
 * @property {string[]} reference_images - Base64 encoded reference images or paths
 * @property {VisionROI} [roi] - Optional ROI for regional search
 */
export interface AIVisionRequest {
  /** Base64 encoded screenshot or file path */
  screenshot: string;
  /** User prompt describing the target element */
  prompt: string;
  /** Base64 encoded reference images or file paths */
  reference_images: string[];
  /** Optional ROI for regional search */
  roi?: VisionROI;
}

/**
 * AI Vision Service Response
 *
 * Response from AI vision analysis.
 *
 * @interface AIVisionResponse
 * @property {boolean} success - Whether analysis was successful
 * @property {number} [x] - X coordinate of detected element
 * @property {number} [y] - Y coordinate of detected element
 * @property {number} [confidence] - Confidence score (0-1)
 * @property {string} [error] - Error message if analysis failed
 */
export interface AIVisionResponse {
  /** Whether analysis was successful */
  success: boolean;
  /** X coordinate of detected element (present if success) */
  x?: number;
  /** Y coordinate of detected element (present if success) */
  y?: number;
  /** Confidence score (0-1, present if success) */
  confidence?: number;
  /** Error message (present if not success) */
  error?: string;
}

/**
 * Vision Error codes
 *
 * @typedef {string} VisionErrorCode
 */
export type VisionErrorCode =
  | 'SCREENSHOT_FAILED'
  | 'AI_TIMEOUT'
  | 'AI_FAILED'
  | 'ASSET_ERROR'
  | 'INVALID_COORDINATES';

/**
 * Vision Error
 *
 * Structured error for vision capture operations.
 *
 * @interface VisionError
 * @property {VisionErrorCode} code - Error code
 * @property {string} message - Human-readable error message
 * @property {boolean} recoverable - Whether the error is recoverable
 * @property {string} [suggestion] - Suggested action to resolve the error
 */
export interface VisionError {
  /** Error code */
  code: VisionErrorCode;
  /** Human-readable error message */
  message: string;
  /** Whether the error is recoverable */
  recoverable: boolean;
  /** Suggested action to resolve the error */
  suggestion?: string;
}

/**
 * Default values for creating new AI Vision Capture actions
 */
export const DEFAULT_CACHE_DATA: CacheData = {
  cached_x: null,
  cached_y: null,
  cache_dim: null,
};

export const DEFAULT_DYNAMIC_CONFIG: DynamicConfig = {
  prompt: '',
  reference_images: [],
  roi: null,
  search_scope: 'global',
};

/**
 * Creates a new AI Vision Capture action with default values
 *
 * @param id - Unique identifier (UUID)
 * @param timestamp - Time in seconds since recording start
 * @param screenshotPath - Path to the captured screenshot
 * @param screenDim - Screen dimensions at capture time
 * @returns A new AIVisionCaptureAction with default values
 */
export function createAIVisionCaptureAction(
  id: string,
  timestamp: number,
  screenshotPath: string,
  screenDim: ScreenDimensions
): AIVisionCaptureAction {
  return {
    type: 'ai_vision_capture',
    id,
    timestamp,
    is_dynamic: false, // Default to Static Mode (Requirement 3.1)
    interaction: 'click', // Default interaction type
    static_data: {
      original_screenshot: screenshotPath,
      saved_x: null,
      saved_y: null,
      screen_dim: screenDim,
    },
    dynamic_config: { ...DEFAULT_DYNAMIC_CONFIG },
    cache_data: { ...DEFAULT_CACHE_DATA },
  };
}
