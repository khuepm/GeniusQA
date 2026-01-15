/**
 * Types for Firebase Cloud Functions - Email Alert System
 */

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error document structure in Firestore
 */
export interface ErrorDocument {
  type: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  severity: ErrorSeverity;
  userId?: string;
  sessionId: string;
  timestamp: FirebaseFirestore.Timestamp;
}

/**
 * Error context information
 */
export interface ErrorContext {
  component?: string;
  action?: string;
  recentActions?: string[];
  appState?: Record<string, unknown>;
  deviceInfo?: DeviceInfo;
}

/**
 * Device information
 */
export interface DeviceInfo {
  platform: string;
  osVersion: string;
  screenResolution: string;
  language: string;
  appVersion?: string;
}

/**
 * Alert tracking document in Firestore
 */
export interface AlertTrackingDocument {
  errorType: string;
  sentCount: number;
  lastSentAt: FirebaseFirestore.Timestamp;
  hourlyWindow: string; // Format: YYYY-MM-DD-HH
}

/**
 * Summary alert tracking document
 */
export interface SummaryAlertDocument {
  errorType: string;
  affectedUsers: string[];
  errorCount: number;
  hourlyWindow: string;
  summarySentAt?: FirebaseFirestore.Timestamp;
}

/**
 * Email configuration
 */
export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  recipients: string[];
  maxEmailsPerHour: number;
  summaryThreshold: number; // Number of affected users to trigger summary
  severityThresholds: {
    [key in ErrorSeverity]: boolean; // Whether to send alerts for this severity
  };
}

/**
 * Email payload for error alerts
 */
export interface ErrorAlertEmail {
  to: string[];
  subject: string;
  html: string;
  errorDetails: {
    type: string;
    message: string;
    stack?: string;
    severity: ErrorSeverity;
    userId?: string;
    sessionId: string;
    timestamp: Date;
    context: ErrorContext;
  };
}

/**
 * Email payload for summary alerts
 */
export interface SummaryAlertEmail {
  to: string[];
  subject: string;
  html: string;
  summaryDetails: {
    errorType: string;
    affectedUsersCount: number;
    totalErrors: number;
    timeWindow: string;
    sampleErrors: ErrorDocument[];
  };
}
