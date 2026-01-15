/**
 * Property-Based Tests for EventQueue Service
 * 
 * Tests correctness properties for the EventQueue service, ensuring
 * FIFO ordering, persistence round-trip, and overflow handling.
 * 
 * **Feature: desktop-analytics-logging**
 * **Properties: 5, 6, 7**
 * **Validates: Requirements 5.2, 5.3, 5.4**
 */

import * as fc from 'fast-check';
import { EventQueue } from '../eventQueue';
import { AnalyticsEvent, QueuedEvent, EventCategory } from '../../types/analytics.types';

// ============================================================================
// localStorage Mock
// ============================================================================

const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  };
};

// ============================================================================
// Arbitraries (Generators) for Analytics Events
// ============================================================================

/**
 * Generate a valid event category
 */
const eventCategoryArbitrary: fc.Arbitrary<EventCategory> = fc.constantFrom(
  'session',
  'feature',
  'navigation',
  'error',
  'performance'
);

/**
 * Generate a valid event name
 */
const eventNameArbitrary = fc.constantFrom(
  'feature_used',
  'recording_started',
  'recording_completed',
  'screen_view',
  'error_occurred',
  'app_startup'
);

/**
 * Generate a valid session ID
 */
const sessionIdArbitrary = fc.string({ minLength: 10, maxLength: 30 }).filter(s => s.length > 0);

/**
 * Generate valid event params
 */
const eventParamsArbitrary = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.oneof(
    fc.string({ maxLength: 50 }),
    fc.integer(),
    fc.boolean()
  ),
  { minKeys: 0, maxKeys: 5 }
);

/**
 * Generate a valid AnalyticsEvent
 */
const analyticsEventArbitrary: fc.Arbitrary<AnalyticsEvent> = fc.record({
  name: eventNameArbitrary,
  params: eventParamsArbitrary,
  timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }), // Valid timestamps
  sessionId: sessionIdArbitrary,
  userId: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: undefined }),
  category: fc.option(eventCategoryArbitrary, { nil: undefined }),
});

/**
 * Generate an array of AnalyticsEvents with unique timestamps
 */
const analyticsEventsArrayArbitrary = (minLength: number, maxLength: number): fc.Arbitrary<AnalyticsEvent[]> =>
  fc.array(analyticsEventArbitrary, { minLength, maxLength }).map(events => {
    // Ensure unique timestamps by adding index offset
    return events.map((event, index) => ({
      ...event,
      timestamp: event.timestamp + index,
    }));
  });

// ============================================================================
// Property Tests
// ============================================================================

describe('EventQueue Property-Based Tests', () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    localStorageMock = createLocalStorageMock();
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Property 5: Event Queue FIFO Order**
   * **Validates: Requirements 5.2**
   * 
   * For any sequence of events queued, when dequeued, the events SHALL be
   * returned in the same order they were queued (First-In-First-Out).
   */
  describe('Property 5: Event Queue FIFO Order', () => {
    it('events are dequeued in the same order they were enqueued', () => {
      fc.assert(
        fc.property(
          analyticsEventsArrayArbitrary(1, 50),
          (events: AnalyticsEvent[]) => {
            // Create a fresh queue for each test
            const queue = new EventQueue(1000, `test_queue_${Date.now()}_${Math.random()}`);
            queue.clear();

            // Enqueue all events
            events.forEach(event => queue.enqueue(event));

            // Dequeue all events
            const dequeued = queue.dequeue(events.length);

            // Verify FIFO order - events should come out in the same order
            if (dequeued.length !== events.length) {
              return false;
            }

            // Check that each dequeued event matches the original in order
            return events.every((originalEvent, index) => {
              const dequeuedEvent = dequeued[index];
              return (
                originalEvent.name === dequeuedEvent.name &&
                originalEvent.timestamp === dequeuedEvent.timestamp &&
                originalEvent.sessionId === dequeuedEvent.sessionId
              );
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('partial dequeue maintains FIFO order for remaining events', () => {
      fc.assert(
        fc.property(
          analyticsEventsArrayArbitrary(5, 30),
          fc.integer({ min: 1, max: 4 }),
          (events: AnalyticsEvent[], dequeueCount: number) => {
            const queue = new EventQueue(1000, `test_queue_${Date.now()}_${Math.random()}`);
            queue.clear();

            // Enqueue all events
            events.forEach(event => queue.enqueue(event));

            // Dequeue partial
            const firstBatch = queue.dequeue(dequeueCount);
            
            // Dequeue remaining
            const secondBatch = queue.dequeue(events.length - dequeueCount);

            // Combined should match original order
            const combined = [...firstBatch, ...secondBatch];
            
            return events.every((originalEvent, index) => {
              const combinedEvent = combined[index];
              return (
                originalEvent.name === combinedEvent.name &&
                originalEvent.timestamp === combinedEvent.timestamp
              );
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Property 6: Event Queue Persistence Round-Trip**
   * **Validates: Requirements 5.3**
   * 
   * For any set of queued events, persisting to localStorage and then
   * restoring SHALL produce an equivalent set of events.
   */
  describe('Property 6: Event Queue Persistence Round-Trip', () => {
    it('events survive persist and restore cycle', () => {
      fc.assert(
        fc.property(
          analyticsEventsArrayArbitrary(1, 50),
          (events: AnalyticsEvent[]) => {
            const storageKey = `test_queue_${Date.now()}_${Math.random()}`;
            
            // Create queue and enqueue events
            const originalQueue = new EventQueue(1000, storageKey);
            originalQueue.clear();
            events.forEach(event => originalQueue.enqueue(event));

            // Get events before persistence
            const beforePersist = originalQueue.getAll();

            // Persist is called automatically on enqueue, but call explicitly
            originalQueue.persist();

            // Create new queue instance that will restore from localStorage
            const restoredQueue = new EventQueue(1000, storageKey);

            // Get events after restoration
            const afterRestore = restoredQueue.getAll();

            // Verify same number of events
            if (beforePersist.length !== afterRestore.length) {
              return false;
            }

            // Verify each event is equivalent
            return beforePersist.every((originalEvent, index) => {
              const restoredEvent = afterRestore[index];
              return (
                originalEvent.name === restoredEvent.name &&
                originalEvent.timestamp === restoredEvent.timestamp &&
                originalEvent.sessionId === restoredEvent.sessionId &&
                originalEvent.id === restoredEvent.id &&
                originalEvent.retryCount === restoredEvent.retryCount
              );
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('empty queue persists and restores correctly', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            const storageKey = `test_queue_empty_${Date.now()}_${Math.random()}`;
            
            // Create empty queue
            const originalQueue = new EventQueue(1000, storageKey);
            originalQueue.clear();
            originalQueue.persist();

            // Restore
            const restoredQueue = new EventQueue(1000, storageKey);

            return restoredQueue.isEmpty() && restoredQueue.size() === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('event params are preserved through persistence', () => {
      fc.assert(
        fc.property(
          analyticsEventsArrayArbitrary(1, 20),
          (events: AnalyticsEvent[]) => {
            const storageKey = `test_queue_params_${Date.now()}_${Math.random()}`;
            
            const originalQueue = new EventQueue(1000, storageKey);
            originalQueue.clear();
            events.forEach(event => originalQueue.enqueue(event));
            originalQueue.persist();

            const restoredQueue = new EventQueue(1000, storageKey);
            const restoredEvents = restoredQueue.getAll();

            // Verify params are preserved
            return events.every((originalEvent, index) => {
              const restoredEvent = restoredEvents[index];
              const originalParams = JSON.stringify(originalEvent.params);
              const restoredParams = JSON.stringify(restoredEvent.params);
              return originalParams === restoredParams;
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Property 7: Event Queue Overflow Handling**
   * **Validates: Requirements 5.4**
   * 
   * For any event queue that exceeds maxSize, adding a new event SHALL
   * remove the oldest event(s) to maintain size <= maxSize.
   */
  describe('Property 7: Event Queue Overflow Handling', () => {
    it('queue never exceeds maxSize', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 50 }), // maxSize
          analyticsEventsArrayArbitrary(1, 100), // events to add (potentially more than maxSize)
          (maxSize: number, events: AnalyticsEvent[]) => {
            const storageKey = `test_queue_overflow_${Date.now()}_${Math.random()}`;
            const queue = new EventQueue(maxSize, storageKey);
            queue.clear();

            // Enqueue all events
            events.forEach(event => queue.enqueue(event));

            // Queue size should never exceed maxSize
            return queue.size() <= maxSize;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('oldest events are removed when overflow occurs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 20 }), // maxSize
          (maxSize: number) => {
            const storageKey = `test_queue_oldest_${Date.now()}_${Math.random()}`;
            const queue = new EventQueue(maxSize, storageKey);
            queue.clear();

            // Create events with sequential timestamps for easy tracking
            const totalEvents = maxSize + 10; // Add more than maxSize
            const events: AnalyticsEvent[] = [];
            
            for (let i = 0; i < totalEvents; i++) {
              events.push({
                name: `event_${i}`,
                params: { index: i },
                timestamp: 1000000000000 + i,
                sessionId: 'test-session',
              });
            }

            // Enqueue all events
            events.forEach(event => queue.enqueue(event));

            // Get remaining events
            const remaining = queue.getAll();

            // Should have exactly maxSize events
            if (remaining.length !== maxSize) {
              return false;
            }

            // The remaining events should be the LAST maxSize events (newest)
            // The oldest events (first 10) should have been removed
            const expectedStartIndex = totalEvents - maxSize;
            
            return remaining.every((event, index) => {
              const expectedIndex = expectedStartIndex + index;
              return event.name === `event_${expectedIndex}`;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isFull returns true when at capacity', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 30 }),
          (maxSize: number) => {
            const storageKey = `test_queue_full_${Date.now()}_${Math.random()}`;
            const queue = new EventQueue(maxSize, storageKey);
            queue.clear();

            // Add exactly maxSize events
            for (let i = 0; i < maxSize; i++) {
              queue.enqueue({
                name: 'test_event',
                params: {},
                timestamp: Date.now() + i,
                sessionId: 'test-session',
              });
            }

            return queue.isFull() && queue.size() === maxSize;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('adding event to full queue maintains maxSize', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 30 }),
          fc.integer({ min: 1, max: 20 }),
          (maxSize: number, extraEvents: number) => {
            const storageKey = `test_queue_maintain_${Date.now()}_${Math.random()}`;
            const queue = new EventQueue(maxSize, storageKey);
            queue.clear();

            // Fill to capacity
            for (let i = 0; i < maxSize; i++) {
              queue.enqueue({
                name: 'initial_event',
                params: {},
                timestamp: Date.now() + i,
                sessionId: 'test-session',
              });
            }

            // Add extra events
            for (let i = 0; i < extraEvents; i++) {
              queue.enqueue({
                name: 'extra_event',
                params: {},
                timestamp: Date.now() + maxSize + i,
                sessionId: 'test-session',
              });
            }

            // Size should still be maxSize
            return queue.size() === maxSize;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
