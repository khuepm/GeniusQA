/**
 * AnalyticsService
 * 
 * Core service for managing analytics operations in GeniusQA Desktop App.
 * Handles Firebase Analytics tracking, session management, consent, and user anonymization.
 * 
 * @module services/analyticsService
 */

import type { Analytics } from 'firebase/analytics';
import type { Firestore } from 'firebase/firestore';
import { EventQueue } from './eventQueue';
import {
  AnalyticsEvent,
  AnalyticsConfig,
  SessionInfo,
  DeviceInfo,
  ConsentStatus,
  DEFAULT_ANALYTICS_CONFIG,
} from '../types/analytics.types';

// Lazy-loaded Firebase modules to avoid side effects during testing
let firebaseAnalytics: typeof import('firebase/analytics') | null = null;
let firebaseFirestore: typeof import('firebase/firestore') | null = null;
let firebaseConfig: typeof import('../config/firebase.config') | null = null;

/**
 * Lazily loads Firebase Analytics module
 */
async function getFirebaseAnalytics() {
  if (!firebaseAnalytics) {
    firebaseAnalytics = await import('firebase/analytics');
  }
  return firebaseAnalytics;
}

/**
 * Lazily loads Firebase Firestore module
 */
async function getFirebaseFirestore() {
  if (!firebaseFirestore) {
    firebaseFirestore = await import('firebase/firestore');
  }
  return firebaseFirestore;
}

/**
 * Lazily loads Firebase config
 */
async function getFirebaseConfig() {
  if (!firebaseConfig) {
    firebaseConfig = await import('../config/firebase.config');
  }
  return firebaseConfig;
}

// ============================================================================
// Constants
// ============================================================================

const CONSENT_STORAGE_KEY = 'analytics_consent';
const USER_ID_STORAGE_KEY = 'analytics_user_id';
const SESSION_STORAGE_KEY = 'analytics_session';

// PII patterns for detection
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
  ssn: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
};

// ============================================================================
// AnalyticsService Class
// ============================================================================

/**
 * AnalyticsService manages all analytics operations for the desktop app.
 * 
 * Features:
 * - Firebase Analytics integration
 * - Session management with unique IDs
 * - User consent management
 * - User ID anonymization
 * - Offline event queuing
 * - PII exclusion from events
 */
export class AnalyticsService {
  private analytics: Analytics | null = null;
  private firestoreDb: Firestore | null = null;
  private sessionInfo: SessionInfo | null = null;
  private config: AnalyticsConfig;
  private eventQueue: EventQueue;
  private consentGiven: boolean = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private initialized: boolean = false;
  private anonymizedUserId: string | null = null;

  /**
   * Creates a new AnalyticsService instance
   * 
   * @param config - Partial configuration to override defaults
   */
  constructor(config?: Partial<AnalyticsConfig>) {
    this.config = { ...DEFAULT_ANALYTICS_CONFIG, ...config };
    this.eventQueue = new EventQueue(this.config.maxQueueSize);
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initializes the analytics service with Firebase
   * Sets up analytics, firestore, and starts session if consent is given
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Check consent first
      this.consentGiven = await this.checkConsent();

      if (!this.consentGiven || !this.config.enabled) {
        if (this.config.debugMode) {
          console.log('AnalyticsService: Analytics disabled or consent not given');
        }
        this.initialized = true;
        return;
      }

      // Initialize Firebase Analytics (lazy load)
      const config = await getFirebaseConfig();
      this.analytics = await config.getAnalyticsInstance();
      this.firestoreDb = config.firestore;

      // Start session
      this.startSession();

      // Set up periodic flush
      this.startFlushTimer();

      // Listen for online/offline events
      this.setupNetworkListeners();

      this.initialized = true;

      if (this.config.debugMode) {
        console.log('AnalyticsService: Initialized successfully');
      }
    } catch (error) {
      console.error('AnalyticsService: Initialization failed', error);
      // Continue without analytics - app should still work
      this.config.enabled = false;
      this.initialized = true;
    }
  }

  // ==========================================================================
  // Consent Management
  // ==========================================================================

  /**
   * Checks if user has given consent for analytics
   * 
   * @returns Promise resolving to consent status
   */
  async checkConsent(): Promise<boolean> {
    try {
      const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (stored) {
        const consentStatus: ConsentStatus = JSON.parse(stored);
        return consentStatus.analyticsConsent;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Sets user consent for analytics
   * If consent is revoked, clears all queued events
   * 
   * @param consent - Whether user consents to analytics
   */
  async setConsent(consent: boolean): Promise<void> {
    const consentStatus: ConsentStatus = {
      analyticsConsent: consent,
      consentTimestamp: Date.now(),
      consentVersion: '1.0',
    };

    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentStatus));
    this.consentGiven = consent;

    if (!consent) {
      // Clear queued events when consent is revoked
      this.eventQueue.clear();
      this.stopFlushTimer();
      
      if (this.config.debugMode) {
        console.log('AnalyticsService: Consent revoked, cleared event queue');
      }
    } else if (this.initialized && !this.flushTimer) {
      // Restart flush timer if consent is given
      this.startFlushTimer();
    }
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  /**
   * Starts a new analytics session
   * Generates unique session ID and logs session_start event
   */
  startSession(): void {
    const sessionId = this.generateSessionId();
    const deviceInfo = this.getDeviceInfo();

    this.sessionInfo = {
      sessionId,
      startTime: Date.now(),
      deviceInfo,
      appVersion: this.config.appVersion || '1.0.0',
      userId: this.anonymizedUserId || undefined,
    };

    // Store session info
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.sessionInfo));
    } catch {
      // Ignore storage errors
    }

    // Log session start event
    this.trackEvent('session_start', {
      device_platform: deviceInfo.platform,
      device_os_version: deviceInfo.osVersion,
      screen_resolution: deviceInfo.screenResolution,
      language: deviceInfo.language,
      app_version: this.sessionInfo.appVersion,
    });

    if (this.config.debugMode) {
      console.log('AnalyticsService: Session started', sessionId);
    }
  }

  /**
   * Ends the current analytics session
   * Logs session_end event with duration
   */
  endSession(): void {
    if (!this.sessionInfo) {
      return;
    }

    const duration = Date.now() - this.sessionInfo.startTime;
    this.sessionInfo.endTime = Date.now();

    this.trackEvent('session_end', {
      duration_ms: duration,
    });

    // Flush remaining events
    this.flushEvents();

    // Clear session
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }

    if (this.config.debugMode) {
      console.log('AnalyticsService: Session ended, duration:', duration);
    }

    this.sessionInfo = null;
  }

  /**
   * Gets the current session ID
   * 
   * @returns Current session ID or empty string if no session
   */
  getSessionId(): string {
    return this.sessionInfo?.sessionId || '';
  }

  /**
   * Generates a unique session ID
   * Uses timestamp + random string for uniqueness
   * 
   * @returns Unique session ID string
   */
  generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    const randomPart2 = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${randomPart}-${randomPart2}`;
  }

  /**
   * Gets device information for analytics
   * 
   * @returns DeviceInfo object with platform, OS, screen, and language info
   */
  getDeviceInfo(): DeviceInfo {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const screen = typeof window !== 'undefined' ? window.screen : null;

    return {
      platform: nav?.platform || 'unknown',
      osVersion: this.getOSVersion(),
      screenResolution: screen ? `${screen.width}x${screen.height}` : 'unknown',
      language: nav?.language || 'en',
      userAgent: nav?.userAgent,
    };
  }

  // ==========================================================================
  // User Management
  // ==========================================================================

  /**
   * Sets the user ID with anonymization
   * User ID is hashed before being stored or sent to analytics
   * 
   * @param userId - Original user identifier to anonymize
   */
  async setUserId(userId: string): Promise<void> {
    if (!userId) {
      this.anonymizedUserId = null;
      return;
    }

    // Anonymize the user ID using SHA-256 hash
    this.anonymizedUserId = await this.hashUserId(userId);

    // Update session info
    if (this.sessionInfo) {
      this.sessionInfo.userId = this.anonymizedUserId;
    }

    // Store anonymized ID
    try {
      localStorage.setItem(USER_ID_STORAGE_KEY, this.anonymizedUserId);
    } catch {
      // Ignore storage errors
    }

    // Set in Firebase Analytics if available and consent given
    if (this.analytics && this.consentGiven) {
      try {
        const { setUserId: firebaseSetUserId } = await getFirebaseAnalytics();
        firebaseSetUserId(this.analytics, this.anonymizedUserId);
      } catch {
        // Ignore Firebase errors
      }
    }

    if (this.config.debugMode) {
      console.log('AnalyticsService: User ID set (anonymized)');
    }
  }

  /**
   * Sets user properties for analytics
   * Properties are sanitized to remove PII
   * 
   * @param properties - User properties to set
   */
  async setUserProperties(properties: Record<string, unknown>): Promise<void> {
    if (!this.consentGiven || !this.analytics) {
      return;
    }

    // Sanitize properties to remove PII
    const sanitizedProperties = this.sanitizeEventParams(properties);

    // Convert to string values for Firebase
    const stringProperties: Record<string, string> = {};
    for (const [key, value] of Object.entries(sanitizedProperties)) {
      stringProperties[key] = String(value);
    }

    try {
      const { setUserProperties: firebaseSetUserProperties } = await getFirebaseAnalytics();
      firebaseSetUserProperties(this.analytics, stringProperties);
    } catch {
      // Ignore Firebase errors
    }

    if (this.config.debugMode) {
      console.log('AnalyticsService: User properties set', Object.keys(stringProperties));
    }
  }

  /**
   * Hashes a user ID using SHA-256 for anonymization
   * 
   * @param userId - Original user ID
   * @returns Promise resolving to hashed user ID
   */
  async hashUserId(userId: string): Promise<string> {
    // Use Web Crypto API for hashing
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(userId);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback: simple hash function for environments without crypto.subtle
    return this.simpleHash(userId);
  }

  // ==========================================================================
  // Event Tracking
  // ==========================================================================

  /**
   * Tracks an analytics event
   * Events are queued if offline or sent directly to Firebase
   * 
   * @param eventName - Name of the event
   * @param params - Event parameters
   */
  trackEvent(eventName: string, params?: Record<string, unknown>): void {
    // Block tracking if consent not given
    if (!this.consentGiven) {
      if (this.config.debugMode) {
        console.log('AnalyticsService: Event blocked (no consent)', eventName);
      }
      return;
    }

    // Sanitize params to remove PII
    const sanitizedParams = this.sanitizeEventParams(params || {});

    const event: AnalyticsEvent = {
      name: eventName,
      params: sanitizedParams,
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
      userId: this.anonymizedUserId || undefined,
    };

    // Queue event for batch processing
    this.eventQueue.enqueue(event);

    // Send to Firebase Analytics immediately if online
    if (this.analytics && typeof navigator !== 'undefined' && navigator.onLine) {
      this.logToFirebase(eventName, sanitizedParams);
    }

    if (this.config.debugMode) {
      console.log('AnalyticsService: Event tracked', eventName, sanitizedParams);
    }
  }

  /**
   * Logs event to Firebase Analytics (async helper)
   */
  private async logToFirebase(eventName: string, params: Record<string, unknown>): Promise<void> {
    if (!this.analytics) return;
    
    try {
      const { logEvent } = await getFirebaseAnalytics();
      logEvent(this.analytics, eventName, params);
    } catch (error) {
      if (this.config.debugMode) {
        console.error('AnalyticsService: Failed to log event to Firebase', error);
      }
    }
  }

  /**
   * Tracks a screen view event
   * Logs screen_view events with screen name
   * 
   * @param screenName - Name of the screen being viewed
   */
  trackScreenView(screenName: string): void {
    this.trackEvent('screen_view', {
      screen_name: screenName,
    });
  }

  /**
   * Tracks feature usage events
   * Logs feature_used events with feature name and metadata
   * Supports recording, playback, script editor, AI chat features
   * 
   * @param featureName - Name of the feature being used
   * @param metadata - Additional metadata about the feature usage
   */
  trackFeatureUsed(featureName: string, metadata?: Record<string, unknown>): void {
    this.trackEvent('feature_used', {
      feature_name: featureName,
      ...metadata,
    });
  }

  // ==========================================================================
  // PII Sanitization
  // ==========================================================================

  /**
   * Sanitizes event parameters to remove PII
   * 
   * @param params - Original parameters
   * @returns Sanitized parameters with PII removed
   */
  sanitizeEventParams(params: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      // Skip keys that might contain PII
      const lowerKey = key.toLowerCase();
      if (this.isPIIKey(lowerKey)) {
        continue;
      }

      // Sanitize string values
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeEventParams(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Checks if a key name suggests PII content
   * 
   * @param key - Key name to check
   * @returns True if key might contain PII
   */
  isPIIKey(key: string): boolean {
    const piiKeys = [
      'email', 'mail', 'phone', 'telephone', 'mobile', 'cell',
      'name', 'firstname', 'lastname', 'fullname', 'username',
      'address', 'street', 'city', 'zip', 'postal',
      'ssn', 'social', 'passport', 'license',
      'credit', 'card', 'cvv', 'expiry',
      'password', 'secret', 'token', 'key', 'auth',
    ];
    return piiKeys.some(pii => key.includes(pii));
  }

  /**
   * Sanitizes a string value to remove PII patterns
   * 
   * @param value - String to sanitize
   * @returns Sanitized string with PII replaced
   */
  sanitizeString(value: string): string {
    let sanitized = value;

    // Replace email addresses
    sanitized = sanitized.replace(PII_PATTERNS.email, '[EMAIL_REDACTED]');
    
    // Replace phone numbers
    sanitized = sanitized.replace(PII_PATTERNS.phone, '[PHONE_REDACTED]');
    
    // Replace SSN
    sanitized = sanitized.replace(PII_PATTERNS.ssn, '[SSN_REDACTED]');
    
    // Replace credit card numbers
    sanitized = sanitized.replace(PII_PATTERNS.creditCard, '[CARD_REDACTED]');

    return sanitized;
  }

  /**
   * Checks if a value contains PII
   * 
   * @param value - Value to check
   * @returns True if value contains PII
   */
  containsPII(value: unknown): boolean {
    if (typeof value !== 'string') {
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(v => this.containsPII(v));
      }
      return false;
    }

    // Create new regex instances to avoid state issues with global flag
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phonePattern = /(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/;
    const ssnPattern = /\b\d{3}[-]?\d{2}[-]?\d{4}\b/;
    const creditCardPattern = /\b(?:\d{4}[-\s]?){3}\d{4}\b/;

    return (
      emailPattern.test(value) ||
      phonePattern.test(value) ||
      ssnPattern.test(value) ||
      creditCardPattern.test(value)
    );
  }

  // ==========================================================================
  // Internal Methods
  // ==========================================================================

  /**
   * Flushes queued events to Firestore
   */
  private async flushEvents(): Promise<void> {
    if (!this.consentGiven || this.eventQueue.isEmpty()) {
      return;
    }

    const events = this.eventQueue.dequeue(this.config.batchSize);
    
    if (events.length === 0) {
      return;
    }

    try {
      await this.storeToFirestore(events);
      
      if (this.config.debugMode) {
        console.log('AnalyticsService: Flushed', events.length, 'events');
      }
    } catch (error) {
      // Re-queue events on failure
      events.forEach(event => this.eventQueue.enqueue(event));
      
      if (this.config.debugMode) {
        console.error('AnalyticsService: Failed to flush events', error);
      }
    }
  }

  /**
   * Stores events to Firestore
   * Organizes data in users/{userId}/events collection
   * Uses batch writes for efficiency
   * 
   * @param events - Events to store
   */
  private async storeToFirestore(events: AnalyticsEvent[]): Promise<void> {
    if (!this.firestoreDb || !this.consentGiven) {
      return;
    }

    const { writeBatch, collection, doc } = await getFirebaseFirestore();
    const batch = writeBatch(this.firestoreDb);

    for (const event of events) {
      let eventsCollection;
      
      // Organize by user if userId is available, otherwise use general events collection
      if (event.userId) {
        eventsCollection = collection(this.firestoreDb, 'users', event.userId, 'events');
      } else {
        eventsCollection = collection(this.firestoreDb, 'events');
      }

      const docRef = doc(eventsCollection);
      batch.set(docRef, {
        ...event,
        createdAt: new Date(event.timestamp),
        deviceInfo: this.sessionInfo?.deviceInfo || null,
        appVersion: this.sessionInfo?.appVersion || null,
      });
    }

    await batch.commit();
  }

  /**
   * Starts the periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, this.config.flushInterval);
  }

  /**
   * Stops the periodic flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Sets up network online/offline listeners
   */
  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('online', () => {
      if (this.config.debugMode) {
        console.log('AnalyticsService: Online, flushing events');
      }
      this.flushEvents();
    });
  }

  /**
   * Gets the OS version string
   */
  private getOSVersion(): string {
    if (typeof navigator === 'undefined') {
      return 'unknown';
    }

    const ua = navigator.userAgent;
    
    // macOS
    const macMatch = ua.match(/Mac OS X (\d+[._]\d+[._]?\d*)/);
    if (macMatch) {
      return `macOS ${macMatch[1].replace(/_/g, '.')}`;
    }

    // Windows
    const winMatch = ua.match(/Windows NT (\d+\.\d+)/);
    if (winMatch) {
      const versions: Record<string, string> = {
        '10.0': '10/11',
        '6.3': '8.1',
        '6.2': '8',
        '6.1': '7',
      };
      return `Windows ${versions[winMatch[1]] || winMatch[1]}`;
    }

    // Linux
    if (ua.includes('Linux')) {
      return 'Linux';
    }

    return 'unknown';
  }

  /**
   * Simple hash function fallback for environments without crypto.subtle
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Cleans up resources when service is destroyed
   */
  destroy(): void {
    this.stopFlushTimer();
    this.endSession();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Default analytics service instance
 */
export const analyticsService = new AnalyticsService();

export default AnalyticsService;
