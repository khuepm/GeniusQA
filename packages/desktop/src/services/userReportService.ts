/**
 * UserReportService
 * 
 * Service for generating user-specific analytics reports and determining user segments.
 * Aggregates events by user_id for user-specific reports, calculates feature usage frequency,
 * and classifies users based on usage patterns.
 * 
 * @module services/userReportService
 */

import type { Firestore } from 'firebase/firestore';
import {
  UserReport,
  FeatureUsage,
  ErrorSummary,
  UserSegment,
  AnalyticsEvent,
} from '../types/analytics.types';

// Lazy-loaded Firebase Firestore module to avoid side effects during testing
let firebaseFirestore: typeof import('firebase/firestore') | null = null;

/**
 * Lazily loads Firebase Firestore module
 */
async function getFirebaseFirestore() {
  if (!firebaseFirestore) {
    firebaseFirestore = await import('firebase/firestore');
  }
  return firebaseFirestore;
}

// ============================================================================
// Constants
// ============================================================================

/** Threshold for 'new' user segment (sessions) */
const NEW_USER_SESSION_THRESHOLD = 3;

/** Threshold for 'casual' user segment (sessions) */
const CASUAL_USER_SESSION_THRESHOLD = 10;

/** Threshold for 'regular' user segment (sessions) */
const REGULAR_USER_SESSION_THRESHOLD = 30;

/** Minimum features used for 'power' user classification */
const POWER_USER_FEATURE_THRESHOLD = 5;

/** Minimum total duration (ms) for 'power' user classification - 10 hours */
const POWER_USER_DURATION_THRESHOLD = 10 * 60 * 60 * 1000;

// ============================================================================
// UserReportService Class
// ============================================================================

/**
 * UserReportService generates user-specific analytics reports and determines user segments.
 * 
 * Features:
 * - Aggregate events by user_id for user-specific reports
 * - Generate usage summary (total sessions, features used, errors, durations)
 * - Calculate feature usage frequency per user
 * - Identify user segments based on usage patterns
 * - Provide recent activity log for support
 */
export class UserReportService {
  private firestore: Firestore;

  /**
   * Creates a new UserReportService instance
   * 
   * @param firestore - Firestore instance for database operations
   */
  constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  // ==========================================================================
  // Report Generation (Requirements 8.1, 8.2, 8.5)
  // ==========================================================================

  /**
   * Generates a comprehensive user report for the specified time period
   * Aggregates events by user_id and calculates usage statistics
   * 
   * @param userId - User identifier (anonymized)
   * @param startDate - Report period start date
   * @param endDate - Report period end date
   * @returns Promise resolving to UserReport
   */
  async generateReport(userId: string, startDate: Date, endDate: Date): Promise<UserReport> {
    const { collection, query, where, getDocs, orderBy } = await getFirebaseFirestore();

    // Query user events within the date range
    const eventsRef = collection(this.firestore, 'users', userId, 'events');
    const eventsQuery = query(
      eventsRef,
      where('timestamp', '>=', startDate.getTime()),
      where('timestamp', '<=', endDate.getTime()),
      orderBy('timestamp', 'asc')
    );

    const snapshot = await getDocs(eventsQuery);
    const events: AnalyticsEvent[] = snapshot.docs.map(doc => doc.data() as AnalyticsEvent);

    // Calculate total sessions
    const sessionIds = new Set(events.map(e => e.sessionId));
    const totalSessions = sessionIds.size;

    // Calculate total duration from session events
    const totalDuration = this.calculateTotalDuration(events);

    // Aggregate feature usage
    const featuresUsed = await this.aggregateFeatureUsage(userId, startDate, endDate, events);

    // Aggregate errors
    const errorsEncountered = await this.aggregateErrors(userId, startDate, endDate, events);

    // Determine user segment
    const userSegment = await this.determineUserSegment(userId);

    return {
      userId,
      period: { start: startDate, end: endDate },
      totalSessions,
      totalDuration,
      featuresUsed,
      errorsEncountered,
      userSegment,
    };
  }

  /**
   * Gets recent activity events for a user (for support purposes)
   * 
   * @param userId - User identifier (anonymized)
   * @param limit - Maximum number of events to return
   * @returns Promise resolving to array of recent AnalyticsEvents
   */
  async getRecentActivity(userId: string, limit: number): Promise<AnalyticsEvent[]> {
    const { collection, query, orderBy, limit: firestoreLimit, getDocs } = await getFirebaseFirestore();

    const eventsRef = collection(this.firestore, 'users', userId, 'events');
    const recentQuery = query(
      eventsRef,
      orderBy('timestamp', 'desc'),
      firestoreLimit(limit)
    );

    const snapshot = await getDocs(recentQuery);
    return snapshot.docs.map(doc => doc.data() as AnalyticsEvent);
  }

  // ==========================================================================
  // User Segmentation (Requirements 8.3, 8.4)
  // ==========================================================================

  /**
   * Determines the user segment based on usage patterns
   * Classifies users as 'new', 'casual', 'regular', or 'power'
   * 
   * @param userId - User identifier (anonymized)
   * @returns Promise resolving to UserSegment
   */
  async determineUserSegment(userId: string): Promise<UserSegment> {
    const { collection, query, getDocs, where } = await getFirebaseFirestore();

    // Get all user events to analyze usage patterns
    const eventsRef = collection(this.firestore, 'users', userId, 'events');
    const eventsQuery = query(eventsRef);
    const snapshot = await getDocs(eventsQuery);
    const events: AnalyticsEvent[] = snapshot.docs.map(doc => doc.data() as AnalyticsEvent);

    if (events.length === 0) {
      return 'new';
    }

    // Calculate metrics for segmentation
    const sessionIds = new Set(events.map(e => e.sessionId));
    const totalSessions = sessionIds.size;
    const totalDuration = this.calculateTotalDuration(events);
    const uniqueFeatures = this.countUniqueFeatures(events);

    // Determine segment based on usage patterns
    return this.classifyUserSegment(totalSessions, totalDuration, uniqueFeatures);
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Aggregates feature usage statistics from events
   * 
   * @param userId - User identifier
   * @param startDate - Period start date
   * @param endDate - Period end date
   * @param events - Pre-fetched events (optional, for efficiency)
   * @returns Promise resolving to array of FeatureUsage
   */
  private async aggregateFeatureUsage(
    userId: string,
    startDate: Date,
    endDate: Date,
    events?: AnalyticsEvent[]
  ): Promise<FeatureUsage[]> {
    // Use provided events or fetch them
    let eventList = events;
    if (!eventList) {
      const { collection, query, where, getDocs, orderBy } = await getFirebaseFirestore();
      const eventsRef = collection(this.firestore, 'users', userId, 'events');
      const eventsQuery = query(
        eventsRef,
        where('timestamp', '>=', startDate.getTime()),
        where('timestamp', '<=', endDate.getTime())
      );
      const snapshot = await getDocs(eventsQuery);
      eventList = snapshot.docs.map(doc => doc.data() as AnalyticsEvent);
    }

    // Filter feature_used events and aggregate
    const featureEvents = eventList.filter(e => e.name === 'feature_used');
    const featureMap = new Map<string, { count: number; lastUsed: number }>();

    for (const event of featureEvents) {
      const featureName = (event.params?.feature_name as string) || 'unknown';
      const existing = featureMap.get(featureName);
      
      if (existing) {
        existing.count++;
        existing.lastUsed = Math.max(existing.lastUsed, event.timestamp);
      } else {
        featureMap.set(featureName, { count: 1, lastUsed: event.timestamp });
      }
    }

    // Convert to FeatureUsage array
    const featuresUsed: FeatureUsage[] = [];
    for (const [featureName, data] of featureMap) {
      featuresUsed.push({
        featureName,
        usageCount: data.count,
        lastUsed: new Date(data.lastUsed),
      });
    }

    // Sort by usage count descending
    return featuresUsed.sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Aggregates error statistics from events
   * 
   * @param userId - User identifier
   * @param startDate - Period start date
   * @param endDate - Period end date
   * @param events - Pre-fetched events (optional, for efficiency)
   * @returns Promise resolving to array of ErrorSummary
   */
  private async aggregateErrors(
    userId: string,
    startDate: Date,
    endDate: Date,
    events?: AnalyticsEvent[]
  ): Promise<ErrorSummary[]> {
    // Use provided events or fetch them
    let eventList = events;
    if (!eventList) {
      const { collection, query, where, getDocs } = await getFirebaseFirestore();
      const eventsRef = collection(this.firestore, 'users', userId, 'events');
      const eventsQuery = query(
        eventsRef,
        where('timestamp', '>=', startDate.getTime()),
        where('timestamp', '<=', endDate.getTime())
      );
      const snapshot = await getDocs(eventsQuery);
      eventList = snapshot.docs.map(doc => doc.data() as AnalyticsEvent);
    }

    // Filter error events and aggregate
    const errorEventNames = [
      'error_occurred',
      'recording_error',
      'playback_error',
      'network_error',
      'command_error',
      'element_not_found',
      'core_connection_error',
      'script_load_error',
      'critical_error',
    ];

    const errorEvents = eventList.filter(e => errorEventNames.includes(e.name));
    const errorMap = new Map<string, { count: number; lastOccurred: number }>();

    for (const event of errorEvents) {
      const errorType = (event.params?.error_type as string) || event.name;
      const existing = errorMap.get(errorType);
      
      if (existing) {
        existing.count++;
        existing.lastOccurred = Math.max(existing.lastOccurred, event.timestamp);
      } else {
        errorMap.set(errorType, { count: 1, lastOccurred: event.timestamp });
      }
    }

    // Convert to ErrorSummary array
    const errorsEncountered: ErrorSummary[] = [];
    for (const [errorType, data] of errorMap) {
      errorsEncountered.push({
        errorType,
        count: data.count,
        lastOccurred: new Date(data.lastOccurred),
      });
    }

    // Sort by count descending
    return errorsEncountered.sort((a, b) => b.count - a.count);
  }

  /**
   * Calculates total duration from session events
   * 
   * @param events - Array of analytics events
   * @returns Total duration in milliseconds
   */
  private calculateTotalDuration(events: AnalyticsEvent[]): number {
    let totalDuration = 0;

    // Look for session_end events with duration_ms
    const sessionEndEvents = events.filter(e => e.name === 'session_end');
    for (const event of sessionEndEvents) {
      const duration = event.params?.duration_ms as number;
      if (typeof duration === 'number' && duration > 0) {
        totalDuration += duration;
      }
    }

    // If no session_end events, estimate from event timestamps
    if (totalDuration === 0 && events.length > 0) {
      const sessionMap = new Map<string, { start: number; end: number }>();
      
      for (const event of events) {
        const session = sessionMap.get(event.sessionId);
        if (session) {
          session.start = Math.min(session.start, event.timestamp);
          session.end = Math.max(session.end, event.timestamp);
        } else {
          sessionMap.set(event.sessionId, { start: event.timestamp, end: event.timestamp });
        }
      }

      for (const session of sessionMap.values()) {
        totalDuration += session.end - session.start;
      }
    }

    return totalDuration;
  }

  /**
   * Counts unique features used from events
   * 
   * @param events - Array of analytics events
   * @returns Number of unique features
   */
  private countUniqueFeatures(events: AnalyticsEvent[]): number {
    const featureEvents = events.filter(e => e.name === 'feature_used');
    const uniqueFeatures = new Set<string>();

    for (const event of featureEvents) {
      const featureName = event.params?.feature_name as string;
      if (featureName) {
        uniqueFeatures.add(featureName);
      }
    }

    return uniqueFeatures.size;
  }

  /**
   * Classifies user into a segment based on usage metrics
   * 
   * @param totalSessions - Total number of sessions
   * @param totalDuration - Total usage duration in milliseconds
   * @param uniqueFeatures - Number of unique features used
   * @returns UserSegment classification
   */
  private classifyUserSegment(
    totalSessions: number,
    totalDuration: number,
    uniqueFeatures: number
  ): UserSegment {
    // Power user: high sessions, long duration, many features
    if (
      totalSessions > REGULAR_USER_SESSION_THRESHOLD &&
      totalDuration > POWER_USER_DURATION_THRESHOLD &&
      uniqueFeatures >= POWER_USER_FEATURE_THRESHOLD
    ) {
      return 'power';
    }

    // Regular user: moderate sessions
    if (totalSessions > CASUAL_USER_SESSION_THRESHOLD) {
      return 'regular';
    }

    // Casual user: few sessions
    if (totalSessions > NEW_USER_SESSION_THRESHOLD) {
      return 'casual';
    }

    // New user: very few sessions
    return 'new';
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a UserReportService instance with the default Firestore
 * 
 * @returns Promise resolving to UserReportService instance
 */
export async function createUserReportService(): Promise<UserReportService> {
  const { firestore } = await import('../config/firebase.config');
  return new UserReportService(firestore);
}

export default UserReportService;
