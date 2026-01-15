/**
 * Analytics Types and Interfaces
 * 
 * Defines all types used by the Analytics Logging system for GeniusQA Desktop App.
 * These types support Firebase Analytics tracking, Firestore logging, and error reporting.
 */

// ============================================================================
// Event Categories
// ============================================================================

export type EventCategory = 
  | 'session'
  | 'feature'
  | 'navigation'
  | 'error'
  | 'performance';

// ============================================================================
// Event Names by Category
// ============================================================================

export type FeatureEventName =
  | 'feature_used'
  | 'recording_started'
  | 'recording_completed'
  | 'recording_failed'
  | 'recording_interrupted'
  | 'playback_started'
  | 'playback_completed'
  | 'playback_failed'
  | 'script_created'
  | 'script_edited'
  | 'script_deleted'
  | 'ai_interaction';

export type ErrorEventName =
  | 'error_occurred'
  | 'recording_error'
  | 'playback_error'
  | 'playback_action_failed'
  | 'network_error'
  | 'command_error'
  | 'element_not_found'
  | 'core_connection_error'
  | 'script_load_error'
  | 'critical_error';

export type NavigationEventName =
  | 'screen_view'
  | 'dialog_opened'
  | 'shortcut_used';

export type PerformanceEventName =
  | 'app_startup'
  | 'operation_performance'
  | 'recording_duration'
  | 'playback_duration'
  | 'script_load_time';

export type SessionEventName =
  | 'session_start'
  | 'session_end';

export type AnalyticsEventName = 
  | FeatureEventName 
  | ErrorEventName 
  | NavigationEventName 
  | PerformanceEventName
  | SessionEventName;

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Represents a single analytics event
 */
export interface AnalyticsEvent {
  /** Event name identifier */
  name: AnalyticsEventName | string;
  /** Event parameters/metadata */
  params: Record<string, unknown>;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Unique session identifier */
  sessionId: string;
  /** Anonymized user identifier (optional) */
  userId?: string;
  /** Event category for grouping */
  category?: EventCategory;
}

/**
 * Queued event with additional metadata for offline storage
 */
export interface QueuedEvent extends AnalyticsEvent {
  /** Unique event identifier */
  id: string;
  /** Number of retry attempts */
  retryCount: number;
}

/**
 * Information about the current user session
 */
export interface SessionInfo {
  /** Unique session identifier */
  sessionId: string;
  /** Session start time (Unix timestamp) */
  startTime: number;
  /** Session end time (Unix timestamp, set when session ends) */
  endTime?: number;
  /** Device information */
  deviceInfo: DeviceInfo;
  /** Application version */
  appVersion: string;
  /** Anonymized user ID */
  userId?: string;
}

/**
 * Device and environment information
 */
export interface DeviceInfo {
  /** Operating system platform (e.g., 'darwin', 'win32', 'linux') */
  platform: string;
  /** OS version string */
  osVersion: string;
  /** Screen resolution (e.g., '1920x1080') */
  screenResolution: string;
  /** User's preferred language */
  language: string;
  /** User agent string */
  userAgent?: string;
}

/**
 * Configuration options for the Analytics Service
 */
export interface AnalyticsConfig {
  /** Whether analytics is enabled */
  enabled: boolean;
  /** Enable debug logging */
  debugMode: boolean;
  /** Number of events to batch before sending */
  batchSize: number;
  /** Interval in milliseconds between flush operations */
  flushInterval: number;
  /** Maximum number of events to queue */
  maxQueueSize: number;
  /** Application version string */
  appVersion?: string;
}

// ============================================================================
// Error Tracking Interfaces
// ============================================================================

/**
 * Context information for error tracking
 */
export interface ErrorContext {
  /** Component where error occurred */
  component?: string;
  /** Action being performed when error occurred */
  action?: string;
  /** List of recent user actions */
  recentActions?: string[];
  /** Current application state */
  appState?: Record<string, unknown>;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Tracked error with full context
 */
export interface TrackedError {
  /** Error type/name */
  type: string;
  /** Error message */
  message: string;
  /** Stack trace */
  stack?: string;
  /** Error context */
  context: ErrorContext;
  /** Unix timestamp */
  timestamp: number;
  /** Session identifier */
  sessionId: string;
  /** Anonymized user ID */
  userId?: string;
  /** Error severity level */
  severity: ErrorSeverity;
  /** Error code (if applicable) */
  code?: string;
}

// ============================================================================
// Performance Tracking Interfaces
// ============================================================================

/**
 * Performance metric data
 */
export interface PerformanceMetric {
  /** Metric name */
  name: string;
  /** Duration in milliseconds */
  duration: number;
  /** Unix timestamp */
  timestamp: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// User Report Interfaces
// ============================================================================

/**
 * Feature usage statistics
 */
export interface FeatureUsage {
  /** Feature name */
  featureName: string;
  /** Number of times used */
  usageCount: number;
  /** Last usage timestamp */
  lastUsed: Date;
}

/**
 * Error summary for reports
 */
export interface ErrorSummary {
  /** Error type */
  errorType: string;
  /** Number of occurrences */
  count: number;
  /** Last occurrence timestamp */
  lastOccurred: Date;
}

/**
 * User segment classification
 */
export type UserSegment = 'new' | 'casual' | 'regular' | 'power';

/**
 * User analytics report
 */
export interface UserReport {
  /** User identifier */
  userId: string;
  /** Report time period */
  period: { start: Date; end: Date };
  /** Total number of sessions */
  totalSessions: number;
  /** Total usage duration in milliseconds */
  totalDuration: number;
  /** Feature usage breakdown */
  featuresUsed: FeatureUsage[];
  /** Error summary */
  errorsEncountered: ErrorSummary[];
  /** User classification */
  userSegment: UserSegment;
}

// ============================================================================
// Consent and Privacy Interfaces
// ============================================================================

/**
 * User consent status
 */
export interface ConsentStatus {
  /** Whether analytics consent is given */
  analyticsConsent: boolean;
  /** Timestamp when consent was given/updated */
  consentTimestamp?: number;
  /** Consent version (for tracking policy updates) */
  consentVersion?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default analytics configuration values
 */
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  enabled: true,
  debugMode: true, // Enable debug logging to console
  batchSize: 10,
  flushInterval: 30000, // 30 seconds
  maxQueueSize: 1000,
};
