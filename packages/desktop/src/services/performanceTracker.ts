/**
 * PerformanceTracker Service
 * 
 * Tracks app performance metrics for GeniusQA Desktop App.
 * Provides timing utilities and specific metric tracking methods.
 * 
 * @module services/performanceTracker
 */

import type { AnalyticsService } from './analyticsService';
import type { PerformanceMetric } from '../types/analytics.types';

// ============================================================================
// PerformanceTracker Class
// ============================================================================

/**
 * PerformanceTracker manages performance metric collection.
 * 
 * Features:
 * - Timer-based duration tracking with startTimer/endTimer
 * - App startup time tracking
 * - Recording duration tracking
 * - Playback duration tracking
 * - Script load time tracking
 */
export class PerformanceTracker {
  private analyticsService: AnalyticsService;
  private activeTimers: Map<string, number> = new Map();

  /**
   * Creates a new PerformanceTracker instance
   * 
   * @param analyticsService - AnalyticsService instance for event tracking
   */
  constructor(analyticsService: AnalyticsService) {
    this.analyticsService = analyticsService;
  }

  // ==========================================================================
  // Timer Methods
  // ==========================================================================

  /**
   * Starts a named timer for performance measurement
   * 
   * @param name - Unique name for the timer
   */
  startTimer(name: string): void {
    this.activeTimers.set(name, Date.now());
  }

  /**
   * Ends a named timer and returns the duration
   * Tracks the performance metric via analytics service
   * 
   * @param name - Name of the timer to end
   * @param metadata - Optional additional metadata
   * @returns Duration in milliseconds, or -1 if timer not found
   */
  endTimer(name: string, metadata?: Record<string, unknown>): number {
    const startTime = this.activeTimers.get(name);
    
    if (startTime === undefined) {
      return -1;
    }

    const duration = Date.now() - startTime;
    this.activeTimers.delete(name);

    // Track the performance metric
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    this.analyticsService.trackEvent('operation_performance', {
      metric_name: metric.name,
      duration_ms: metric.duration,
      ...metadata,
    });

    return duration;
  }

  // ==========================================================================
  // Specific Metric Tracking Methods
  // ==========================================================================

  /**
   * Tracks app startup duration
   * 
   * @param duration - Startup duration in milliseconds (must be non-negative)
   */
  trackAppStartup(duration: number): void {
    const validDuration = this.validateDuration(duration);
    
    this.analyticsService.trackEvent('app_startup', {
      duration_ms: validDuration,
    });
  }

  /**
   * Tracks recording session duration
   * 
   * @param duration - Recording duration in milliseconds (must be non-negative)
   * @param actionCount - Number of actions recorded
   */
  trackRecordingDuration(duration: number, actionCount: number): void {
    const validDuration = this.validateDuration(duration);
    
    this.analyticsService.trackEvent('recording_duration', {
      duration_ms: validDuration,
      action_count: actionCount,
      actions_per_second: validDuration > 0 ? (actionCount / (validDuration / 1000)).toFixed(2) : '0',
    });
  }

  /**
   * Tracks playback session duration
   * 
   * @param duration - Playback duration in milliseconds (must be non-negative)
   * @param stepCount - Number of steps played back
   */
  trackPlaybackDuration(duration: number, stepCount: number): void {
    const validDuration = this.validateDuration(duration);
    
    this.analyticsService.trackEvent('playback_duration', {
      duration_ms: validDuration,
      step_count: stepCount,
      steps_per_second: validDuration > 0 ? (stepCount / (validDuration / 1000)).toFixed(2) : '0',
    });
  }

  /**
   * Tracks script load time
   * 
   * @param duration - Load time in milliseconds (must be non-negative)
   * @param scriptSize - Size of the script in bytes
   */
  trackScriptLoadTime(duration: number, scriptSize: number): void {
    const validDuration = this.validateDuration(duration);
    
    this.analyticsService.trackEvent('script_load_time', {
      duration_ms: validDuration,
      script_size_bytes: scriptSize,
      bytes_per_ms: validDuration > 0 ? (scriptSize / validDuration).toFixed(2) : '0',
    });
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Validates and normalizes duration values
   * Ensures duration is a non-negative number
   * 
   * @param duration - Duration value to validate
   * @returns Non-negative duration value
   */
  private validateDuration(duration: number): number {
    // Handle NaN, Infinity, and negative values
    if (!Number.isFinite(duration) || duration < 0) {
      return 0;
    }
    return duration;
  }

  /**
   * Checks if a timer is currently active
   * 
   * @param name - Timer name to check
   * @returns True if timer is active
   */
  hasActiveTimer(name: string): boolean {
    return this.activeTimers.has(name);
  }

  /**
   * Gets the count of active timers
   * 
   * @returns Number of active timers
   */
  getActiveTimerCount(): number {
    return this.activeTimers.size;
  }

  /**
   * Clears all active timers
   */
  clearAllTimers(): void {
    this.activeTimers.clear();
  }
}

export default PerformanceTracker;
