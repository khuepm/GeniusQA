/**
 * ErrorTracker Service
 * 
 * Specialized tracking for errors with additional context.
 * Handles error severity detection, context preservation, and critical error escalation.
 * 
 * @module services/errorTracker
 */

import type { AnalyticsService } from './analyticsService';
import type {
  ErrorContext,
  TrackedError,
  ErrorSeverity,
} from '../types/analytics.types';

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of recent actions to track for error context */
const MAX_RECENT_ACTIONS = 20;

/** Threshold for escalating error to critical severity */
const CRITICAL_ERROR_THRESHOLD = 3;

// ============================================================================
// ErrorTracker Class
// ============================================================================

/**
 * ErrorTracker provides specialized error tracking with context preservation.
 * 
 * Features:
 * - Error tracking with full context (component, action, recent actions, app state)
 * - Error count tracking per error type
 * - Automatic severity detection and critical error escalation
 * - Specialized tracking for recording, playback, network, and command errors
 * - Recent actions tracking for error context
 */
export class ErrorTracker {
  private analyticsService: AnalyticsService;
  private errorCounts: Map<string, number> = new Map();
  private recentActions: string[] = [];
  private maxRecentActions: number = MAX_RECENT_ACTIONS;

  /**
   * Creates a new ErrorTracker instance
   * 
   * @param analyticsService - The analytics service to use for tracking events
   */
  constructor(analyticsService: AnalyticsService) {
    this.analyticsService = analyticsService;
  }

  // ==========================================================================
  // Core Error Tracking (Subtask 6.1)
  // ==========================================================================

  /**
   * Tracks an error with context
   * Increments error count and determines severity
   * 
   * @param error - The error to track
   * @param context - Additional context about the error
   */
  trackError(error: Error, context?: ErrorContext): void {
    const errorType = error.name || 'UnknownError';
    
    // Increment error count for this type
    const currentCount = this.errorCounts.get(errorType) || 0;
    const newCount = currentCount + 1;
    this.errorCounts.set(errorType, newCount);

    // Determine severity based on error type and count
    const severity = this.determineSeverity(error, newCount);

    // Build tracked error object
    const trackedError: TrackedError = {
      type: errorType,
      message: error.message,
      stack: error.stack,
      context: {
        ...context,
        recentActions: this.getRecentActions(),
      },
      timestamp: Date.now(),
      sessionId: this.analyticsService.getSessionId(),
      severity,
    };

    // Track the error event
    const eventName = severity === 'critical' ? 'critical_error' : 'error_occurred';
    this.analyticsService.trackEvent(eventName, {
      error_type: trackedError.type,
      error_message: trackedError.message,
      error_stack: trackedError.stack,
      error_severity: trackedError.severity,
      error_count: newCount,
      component: trackedError.context.component,
      action: trackedError.context.action,
      recent_actions: trackedError.context.recentActions,
      app_state: trackedError.context.appState,
    });
  }

  /**
   * Gets the current error count for a specific error type
   * 
   * @param errorType - The error type to check
   * @returns The number of times this error type has occurred
   */
  getErrorCount(errorType: string): number {
    return this.errorCounts.get(errorType) || 0;
  }

  /**
   * Determines the severity of an error based on type and occurrence count
   * 
   * @param error - The error to evaluate
   * @param errorCount - Number of times this error has occurred
   * @returns The determined severity level
   */
  determineSeverity(error: Error, errorCount: number): ErrorSeverity {
    const errorType = error.name || 'UnknownError';

    // Check if this is a critical error based on count threshold
    if (this.isCriticalError(errorType, errorCount)) {
      return 'critical';
    }

    // High severity for specific error types
    const highSeverityTypes = [
      'TypeError',
      'ReferenceError',
      'SecurityError',
      'CoreConnectionError',
    ];
    if (highSeverityTypes.includes(errorType)) {
      return 'high';
    }

    // Medium severity for network and recording errors
    const mediumSeverityTypes = [
      'NetworkError',
      'RecordingError',
      'PlaybackError',
    ];
    if (mediumSeverityTypes.includes(errorType)) {
      return 'medium';
    }

    // Default to low severity
    return 'low';
  }

  /**
   * Checks if an error should be escalated to critical severity
   * An error is critical if it occurs more than 3 times in a session
   * 
   * @param errorType - The error type to check
   * @param count - Current occurrence count
   * @returns True if the error should be marked as critical
   */
  isCriticalError(errorType: string, count: number): boolean {
    return count > CRITICAL_ERROR_THRESHOLD;
  }

  // ==========================================================================
  // Recording Error Tracking (Subtask 6.2)
  // ==========================================================================

  /**
   * Tracks recording-related errors
   * Logs recording_failed or recording_interrupted events
   * 
   * @param error - The recording error
   * @param recordingState - Current state of the recording
   */
  trackRecordingError(error: Error, recordingState: Record<string, unknown>): void {
    const errorType = error.name || 'RecordingError';
    
    // Increment error count
    const currentCount = this.errorCounts.get(errorType) || 0;
    const newCount = currentCount + 1;
    this.errorCounts.set(errorType, newCount);

    const severity = this.determineSeverity(error, newCount);

    // Determine event name based on error type
    const isInterrupted = error.message?.toLowerCase().includes('interrupt') ||
                          error.message?.toLowerCase().includes('stopped') ||
                          error.message?.toLowerCase().includes('unexpected');
    
    const eventName = isInterrupted ? 'recording_interrupted' : 'recording_failed';

    this.analyticsService.trackEvent(eventName, {
      error_type: errorType,
      error_message: error.message,
      error_stack: error.stack,
      error_severity: severity,
      error_count: newCount,
      recording_state: recordingState,
      recent_actions: this.getRecentActions(),
    });
  }

  // ==========================================================================
  // Playback Error Tracking (Subtask 6.3)
  // ==========================================================================

  /**
   * Tracks playback-related errors
   * Logs playback_action_failed or element_not_found events
   * 
   * @param error - The playback error
   * @param playbackState - Current state of the playback including action details
   */
  trackPlaybackError(error: Error, playbackState: Record<string, unknown>): void {
    const errorType = error.name || 'PlaybackError';
    
    // Increment error count
    const currentCount = this.errorCounts.get(errorType) || 0;
    const newCount = currentCount + 1;
    this.errorCounts.set(errorType, newCount);

    const severity = this.determineSeverity(error, newCount);

    // Determine event name based on error type
    const isElementNotFound = error.message?.toLowerCase().includes('element') &&
                              (error.message?.toLowerCase().includes('not found') ||
                               error.message?.toLowerCase().includes('cannot find'));
    
    const eventName = isElementNotFound ? 'element_not_found' : 'playback_action_failed';

    this.analyticsService.trackEvent(eventName, {
      error_type: errorType,
      error_message: error.message,
      error_stack: error.stack,
      error_severity: severity,
      error_count: newCount,
      playback_state: playbackState,
      action_type: playbackState.actionType,
      selector_info: playbackState.selector,
      recent_actions: this.getRecentActions(),
    });
  }

  // ==========================================================================
  // Network and Command Error Tracking (Subtask 6.4)
  // ==========================================================================

  /**
   * Tracks network-related errors
   * Logs network_error or script_load_error events
   * 
   * @param error - The network error
   * @param endpoint - The endpoint that failed
   * @param statusCode - HTTP status code (if applicable)
   */
  trackNetworkError(error: Error, endpoint: string, statusCode?: number): void {
    const errorType = error.name || 'NetworkError';
    
    // Increment error count
    const currentCount = this.errorCounts.get(errorType) || 0;
    const newCount = currentCount + 1;
    this.errorCounts.set(errorType, newCount);

    const severity = this.determineSeverity(error, newCount);

    // Determine if this is a script load error
    const isScriptLoadError = endpoint.includes('.js') || 
                              endpoint.includes('script') ||
                              error.message?.toLowerCase().includes('script');
    
    const eventName = isScriptLoadError ? 'script_load_error' : 'network_error';

    this.analyticsService.trackEvent(eventName, {
      error_type: errorType,
      error_message: error.message,
      error_stack: error.stack,
      error_severity: severity,
      error_count: newCount,
      endpoint,
      status_code: statusCode,
      recent_actions: this.getRecentActions(),
    });
  }

  /**
   * Tracks command execution errors
   * Logs command_error or core_connection_error events
   * 
   * @param commandName - Name of the command that failed
   * @param error - The command error
   */
  trackCommandError(commandName: string, error: Error): void {
    const errorType = error.name || 'CommandError';
    
    // Increment error count
    const currentCount = this.errorCounts.get(errorType) || 0;
    const newCount = currentCount + 1;
    this.errorCounts.set(errorType, newCount);

    const severity = this.determineSeverity(error, newCount);

    // Determine if this is a core connection error
    const isCoreConnectionError = commandName.toLowerCase().includes('core') ||
                                   commandName.toLowerCase().includes('python') ||
                                   error.message?.toLowerCase().includes('connection') ||
                                   error.message?.toLowerCase().includes('core');
    
    const eventName = isCoreConnectionError ? 'core_connection_error' : 'command_error';

    this.analyticsService.trackEvent(eventName, {
      error_type: errorType,
      error_message: error.message,
      error_stack: error.stack,
      error_severity: severity,
      error_count: newCount,
      command_name: commandName,
      recent_actions: this.getRecentActions(),
    });
  }

  // ==========================================================================
  // Recent Actions Tracking (Subtask 6.5)
  // ==========================================================================

  /**
   * Adds a recent action to the tracking list
   * Maintains a maximum of 20 recent actions
   * 
   * @param action - Description of the action performed
   */
  addRecentAction(action: string): void {
    this.recentActions.push(action);
    
    // Keep only the last maxRecentActions
    if (this.recentActions.length > this.maxRecentActions) {
      this.recentActions = this.recentActions.slice(-this.maxRecentActions);
    }
  }

  /**
   * Gets the list of recent actions
   * 
   * @returns Array of recent action descriptions
   */
  getRecentActions(): string[] {
    return [...this.recentActions];
  }

  /**
   * Clears all recent actions
   */
  clearRecentActions(): void {
    this.recentActions = [];
  }

  /**
   * Resets error counts (useful for testing or session reset)
   */
  resetErrorCounts(): void {
    this.errorCounts.clear();
  }
}

export default ErrorTracker;
