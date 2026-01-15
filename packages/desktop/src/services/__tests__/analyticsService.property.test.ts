/**
 * Property-Based Tests for AnalyticsService
 * 
 * Tests correctness properties for session ID uniqueness, consent enforcement,
 * user ID anonymization, and PII exclusion.
 * 
 * @module services/__tests__/analyticsService.property.test
 */

import * as fc from 'fast-check';
import { AnalyticsService } from '../analyticsService';

// ============================================================================
// Test Setup
// ============================================================================

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

// Mock navigator
const navigatorMock = {
  platform: 'MacIntel',
  language: 'en-US',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  onLine: true,
};

// Mock window.screen
const screenMock = {
  width: 1920,
  height: 1080,
};

// Setup mocks before tests
beforeAll(() => {
  Object.defineProperty(global, 'localStorage', { value: localStorageMock });
  Object.defineProperty(global, 'navigator', { value: navigatorMock, writable: true });
  Object.defineProperty(global, 'window', { 
    value: { 
      screen: screenMock,
      addEventListener: jest.fn(),
    },
    writable: true,
  });
  Object.defineProperty(global, 'crypto', {
    value: {
      subtle: {
        digest: async (_algorithm: string, data: ArrayBuffer) => {
          // Simple mock hash for testing - produces consistent 32-byte output
          const view = new Uint8Array(data);
          const hash = new Uint8Array(32);
          for (let i = 0; i < view.length; i++) {
            hash[i % 32] = (hash[i % 32] + view[i]) % 256;
          }
          return hash.buffer;
        },
      },
    },
  });
});

beforeEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
});

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a valid user ID string
 */
const userIdArbitrary = fc.string({ minLength: 1, maxLength: 100 });

/**
 * Generate an email address
 */
const emailArbitrary = fc.tuple(
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9]+$/.test(s)),
  fc.constantFrom('gmail.com', 'yahoo.com', 'outlook.com', 'example.org')
).map(([local, domain]) => `${local}@${domain}`);

/**
 * Generate a phone number
 */
const phoneArbitrary = fc.tuple(
  fc.integer({ min: 100, max: 999 }),
  fc.integer({ min: 100, max: 999 }),
  fc.integer({ min: 1000, max: 9999 })
).map(([area, prefix, line]) => `(${area}) ${prefix}-${line}`);

/**
 * Generate event parameters that may contain PII
 */
const eventParamsWithPIIArbitrary = fc.record({
  action: fc.string({ minLength: 1, maxLength: 50 }),
  email: emailArbitrary,
  phone: phoneArbitrary,
  user_name: fc.string({ minLength: 1, maxLength: 50 }),
  safe_value: fc.integer({ min: 0, max: 1000 }),
});

/**
 * Generate safe event parameters (no PII)
 */
const safeEventParamsArbitrary = fc.record({
  action: fc.string({ minLength: 1, maxLength: 50 }),
  count: fc.integer({ min: 0, max: 1000 }),
  duration: fc.float({ min: 0, max: 10000 }),
  success: fc.boolean(),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('AnalyticsService Property Tests', () => {
  /**
   * **Property 1: Session ID Uniqueness**
   * **Validates: Requirements 1.4**
   * 
   * For any number of app launches, each generated session ID SHALL be unique
   * and not repeat across sessions.
   */
  describe('Property 1: Session ID Uniqueness', () => {
    it('generates unique session IDs across multiple calls', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 200 }),
          (count: number) => {
            const service = new AnalyticsService({ enabled: false });
            const sessionIds = new Set<string>();

            for (let i = 0; i < count; i++) {
              const sessionId = service.generateSessionId();
              sessionIds.add(sessionId);
            }

            // All session IDs should be unique
            return sessionIds.size === count;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('session IDs have sufficient entropy', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }),
          (count: number) => {
            const service = new AnalyticsService({ enabled: false });
            const sessionIds: string[] = [];

            for (let i = 0; i < count; i++) {
              sessionIds.push(service.generateSessionId());
            }

            // Check that session IDs have minimum length for entropy
            const allHaveSufficientLength = sessionIds.every(id => id.length >= 20);
            
            // Check that session IDs contain expected format (timestamp-random-random)
            const allHaveCorrectFormat = sessionIds.every(id => {
              const parts = id.split('-');
              return parts.length >= 3;
            });

            return allHaveSufficientLength && allHaveCorrectFormat;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('session IDs are unique across multiple service instances', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 50 }),
          fc.integer({ min: 2, max: 10 }),
          (idsPerInstance: number, instanceCount: number) => {
            const allSessionIds = new Set<string>();

            for (let i = 0; i < instanceCount; i++) {
              const service = new AnalyticsService({ enabled: false });
              
              for (let j = 0; j < idsPerInstance; j++) {
                allSessionIds.add(service.generateSessionId());
              }
            }

            const expectedTotal = idsPerInstance * instanceCount;
            return allSessionIds.size === expectedTotal;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Property 8: Consent Enforcement**
   * **Validates: Requirements 6.1, 6.2**
   * 
   * For any analytics operation, if user consent is not given, no events
   * SHALL be sent to Firebase Analytics or Firestore.
   */
  describe('Property 8: Consent Enforcement', () => {
    it('blocks event tracking when consent is not given', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          safeEventParamsArbitrary,
          (eventName: string, params: Record<string, unknown>) => {
            // Clear any existing consent
            localStorageMock.clear();
            
            const service = new AnalyticsService({ enabled: true, debugMode: false });
            
            // Track event without consent
            service.trackEvent(eventName, params);
            
            // Event queue should be empty since consent was not given
            // Access internal queue for verification
            const queueSize = (service as any).eventQueue.size();
            
            return queueSize === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('allows event tracking when consent is given', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          safeEventParamsArbitrary,
          async (eventName: string, params: Record<string, unknown>) => {
            localStorageMock.clear();
            
            const service = new AnalyticsService({ enabled: true, debugMode: false });
            
            // Give consent
            await service.setConsent(true);
            
            // Track event with consent
            service.trackEvent(eventName, params);
            
            // Event should be queued
            const queueSize = (service as any).eventQueue.size();
            
            return queueSize === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clears event queue when consent is revoked', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 10 }),
          async (eventNames: string[]) => {
            localStorageMock.clear();
            
            const service = new AnalyticsService({ enabled: true, debugMode: false });
            
            // Give consent and track events
            await service.setConsent(true);
            eventNames.forEach(name => service.trackEvent(name, {}));
            
            // Verify events are queued
            const queueSizeBefore = (service as any).eventQueue.size();
            
            // Revoke consent
            await service.setConsent(false);
            
            // Queue should be cleared
            const queueSizeAfter = (service as any).eventQueue.size();
            
            return queueSizeBefore === eventNames.length && queueSizeAfter === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('persists consent status correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          async (consentValue: boolean) => {
            localStorageMock.clear();
            
            const service1 = new AnalyticsService({ enabled: true });
            await service1.setConsent(consentValue);
            
            // Create new service instance to check persistence
            const service2 = new AnalyticsService({ enabled: true });
            const retrievedConsent = await service2.checkConsent();
            
            return retrievedConsent === consentValue;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Property 9: User ID Anonymization**
   * **Validates: Requirements 6.4**
   * 
   * For any event containing a userId, the userId SHALL be a one-way hash
   * of the original identifier, not the original value.
   */
  describe('Property 9: User ID Anonymization', () => {
    it('anonymizes user IDs using hash function', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          async (originalUserId: string) => {
            const service = new AnalyticsService({ enabled: true });
            
            // Hash the user ID
            const hashedId = await service.hashUserId(originalUserId);
            
            // Hashed ID should not equal original
            const isAnonymized = hashedId !== originalUserId;
            
            // Hashed ID should be a hex string
            const isHexString = /^[0-9a-f]+$/i.test(hashedId);
            
            // Hashed ID should have consistent length (SHA-256 = 64 hex chars)
            const hasConsistentLength = hashedId.length === 64;
            
            return isAnonymized && isHexString && hasConsistentLength;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('produces consistent hashes for same input', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          async (userId: string) => {
            const service = new AnalyticsService({ enabled: true });
            
            const hash1 = await service.hashUserId(userId);
            const hash2 = await service.hashUserId(userId);
            
            return hash1 === hash2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('produces different hashes for different inputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(userIdArbitrary, userIdArbitrary).filter(([a, b]) => a !== b),
          async ([userId1, userId2]: [string, string]) => {
            const service = new AnalyticsService({ enabled: true });
            
            const hash1 = await service.hashUserId(userId1);
            const hash2 = await service.hashUserId(userId2);
            
            return hash1 !== hash2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('setUserId stores anonymized ID not original', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArbitrary,
          async (originalUserId: string) => {
            localStorageMock.clear();
            
            const service = new AnalyticsService({ enabled: true });
            await service.setUserId(originalUserId);
            
            // Check stored value
            const storedId = localStorageMock.getItem('analytics_user_id');
            
            // Stored ID should not be the original
            const isNotOriginal = storedId !== originalUserId;
            
            // Stored ID should be a hash
            const isHash = storedId ? /^[0-9a-f]+$/i.test(storedId) : false;
            
            return isNotOriginal && isHash;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Property 10: PII Exclusion**
   * **Validates: Requirements 6.5**
   * 
   * For any event payload, the payload SHALL NOT contain personally
   * identifiable information (email, full name, phone number, address).
   */
  describe('Property 10: PII Exclusion', () => {
    it('removes email addresses from event params', () => {
      fc.assert(
        fc.property(
          emailArbitrary,
          fc.string({ minLength: 1, maxLength: 30 }),
          (email: string, prefix: string) => {
            const service = new AnalyticsService({ enabled: true });
            
            const params = {
              message: `${prefix} ${email} ${prefix}`,
              data: email,
            };
            
            const sanitized = service.sanitizeEventParams(params);
            
            // Check that email is not in sanitized output
            const sanitizedStr = JSON.stringify(sanitized);
            const containsEmail = sanitizedStr.includes(email);
            const containsRedacted = sanitizedStr.includes('[EMAIL_REDACTED]');
            
            return !containsEmail && containsRedacted;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('removes phone numbers from event params', () => {
      fc.assert(
        fc.property(
          phoneArbitrary,
          fc.string({ minLength: 1, maxLength: 30 }),
          (phone: string, prefix: string) => {
            const service = new AnalyticsService({ enabled: true });
            
            const params = {
              message: `${prefix} ${phone} ${prefix}`,
              contact: phone,
            };
            
            const sanitized = service.sanitizeEventParams(params);
            
            // Check that phone is not in sanitized output
            const sanitizedStr = JSON.stringify(sanitized);
            const containsPhone = sanitizedStr.includes(phone);
            const containsRedacted = sanitizedStr.includes('[PHONE_REDACTED]');
            
            return !containsPhone && containsRedacted;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('removes PII-related keys from event params', () => {
      fc.assert(
        fc.property(
          eventParamsWithPIIArbitrary,
          (params: Record<string, unknown>) => {
            const service = new AnalyticsService({ enabled: true });
            
            const sanitized = service.sanitizeEventParams(params);
            
            // PII keys should be removed
            const hasEmailKey = 'email' in sanitized;
            const hasPhoneKey = 'phone' in sanitized;
            const hasUserNameKey = 'user_name' in sanitized;
            
            // Safe keys should remain
            const hasActionKey = 'action' in sanitized;
            const hasSafeValueKey = 'safe_value' in sanitized;
            
            return !hasEmailKey && !hasPhoneKey && !hasUserNameKey && 
                   hasActionKey && hasSafeValueKey;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('containsPII correctly detects PII in values', () => {
      fc.assert(
        fc.property(
          fc.oneof(emailArbitrary, phoneArbitrary),
          (piiValue: string) => {
            const service = new AnalyticsService({ enabled: true });
            
            return service.containsPII(piiValue) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('containsPII returns false for safe values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer(),
            fc.boolean(),
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => 
              !/[@]/.test(s) && !/\d{3}.*\d{3}.*\d{4}/.test(s)
            )
          ),
          (safeValue: unknown) => {
            const service = new AnalyticsService({ enabled: true });
            
            return service.containsPII(safeValue) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sanitizes nested objects for PII', () => {
      fc.assert(
        fc.property(
          emailArbitrary,
          phoneArbitrary,
          (email: string, phone: string) => {
            const service = new AnalyticsService({ enabled: true });
            
            const params = {
              level1: {
                level2: {
                  message: `Contact: ${email} or ${phone}`,
                },
              },
            };
            
            const sanitized = service.sanitizeEventParams(params);
            const sanitizedStr = JSON.stringify(sanitized);
            
            const containsEmail = sanitizedStr.includes(email);
            const containsPhone = sanitizedStr.includes(phone);
            
            return !containsEmail && !containsPhone;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
