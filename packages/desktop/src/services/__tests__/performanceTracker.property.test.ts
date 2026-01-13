/**
 * Property-Based Tests for PerformanceTracker Service
 * 
 * Tests correctness properties for the PerformanceTracker service,
 * ensuring performance metrics have valid non-negative duration values.
 * 
 * **Feature: desktop-analytics-logging**
 * **Property: 11**
 * **Validates: Requirements 7.1, 7.2**
 */

import * as fc from 'fast-check';
import { PerformanceTracker } from '../performanceTracker';
import type { AnalyticsService } from '../analyticsService';

// ============================================================================
// Mock AnalyticsService
// ============================================================================

interface TrackedEvent {
  name: string;
  params: Record<string, unknown>;
}

const createMockAnalyticsService = (): {
  service: AnalyticsService;
  trackedEvents: TrackedEvent[];
} => {
  const trackedEvents: TrackedEvent[] = [];
  
  const service = {
    trackEvent: jest.fn((name: string, params?: Record<string, unknown>) => {
      trackedEvents.push({ name, params: params || {} });
    }),
  } as unknown as AnalyticsService;

  return { service, trackedEvents };
};

// ============================================================================
// Property Tests
// ============================================================================

describe('PerformanceTracker Property-Based Tests', () => {
  /**
   * **Property 11: Performance Metric Validity**
   * **Validates: Requirements 7.1, 7.2**
   * 
   * For any performance metric event, the duration value SHALL be a
   * non-negative number representing milliseconds.
   */
  describe('Property 11: Performance Metric Validity', () => {
    it('trackAppStartup always produces non-negative duration', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1000000, max: 1000000, noNaN: false }),
          (duration: number) => {
            const { service, trackedEvents } = createMockAnalyticsService();
            const tracker = new PerformanceTracker(service);

            tracker.trackAppStartup(duration);

            // Should have tracked exactly one event
            if (trackedEvents.length !== 1) {
              return false;
            }

            const event = trackedEvents[0];
            const trackedDuration = event.params.duration_ms as number;

            // Duration must be a non-negative finite number
            return (
              event.name === 'app_startup' &&
              typeof trackedDuration === 'number' &&
              Number.isFinite(trackedDuration) &&
              trackedDuration >= 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('trackRecordingDuration always produces non-negative duration', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1000000, max: 1000000, noNaN: false }),
          fc.integer({ min: 0, max: 10000 }),
          (duration: number, actionCount: number) => {
            const { service, trackedEvents } = createMockAnalyticsService();
            const tracker = new PerformanceTracker(service);

            tracker.trackRecordingDuration(duration, actionCount);

            if (trackedEvents.length !== 1) {
              return false;
            }

            const event = trackedEvents[0];
            const trackedDuration = event.params.duration_ms as number;

            return (
              event.name === 'recording_duration' &&
              typeof trackedDuration === 'number' &&
              Number.isFinite(trackedDuration) &&
              trackedDuration >= 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('trackPlaybackDuration always produces non-negative duration', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1000000, max: 1000000, noNaN: false }),
          fc.integer({ min: 0, max: 10000 }),
          (duration: number, stepCount: number) => {
            const { service, trackedEvents } = createMockAnalyticsService();
            const tracker = new PerformanceTracker(service);

            tracker.trackPlaybackDuration(duration, stepCount);

            if (trackedEvents.length !== 1) {
              return false;
            }

            const event = trackedEvents[0];
            const trackedDuration = event.params.duration_ms as number;

            return (
              event.name === 'playback_duration' &&
              typeof trackedDuration === 'number' &&
              Number.isFinite(trackedDuration) &&
              trackedDuration >= 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('trackScriptLoadTime always produces non-negative duration', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1000000, max: 1000000, noNaN: false }),
          fc.integer({ min: 0, max: 1000000 }),
          (duration: number, scriptSize: number) => {
            const { service, trackedEvents } = createMockAnalyticsService();
            const tracker = new PerformanceTracker(service);

            tracker.trackScriptLoadTime(duration, scriptSize);

            if (trackedEvents.length !== 1) {
              return false;
            }

            const event = trackedEvents[0];
            const trackedDuration = event.params.duration_ms as number;

            return (
              event.name === 'script_load_time' &&
              typeof trackedDuration === 'number' &&
              Number.isFinite(trackedDuration) &&
              trackedDuration >= 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('endTimer returns non-negative duration for valid timers', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (timerName: string) => {
            const { service } = createMockAnalyticsService();
            const tracker = new PerformanceTracker(service);

            // Start and immediately end timer
            tracker.startTimer(timerName);
            const duration = tracker.endTimer(timerName);

            // Duration should be non-negative (timer was started)
            return (
              typeof duration === 'number' &&
              Number.isFinite(duration) &&
              duration >= 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('endTimer returns -1 for non-existent timers', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (timerName: string) => {
            const { service } = createMockAnalyticsService();
            const tracker = new PerformanceTracker(service);

            // End timer without starting it
            const duration = tracker.endTimer(timerName);

            // Should return -1 for non-existent timer
            return duration === -1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles NaN duration values gracefully', () => {
      const { service, trackedEvents } = createMockAnalyticsService();
      const tracker = new PerformanceTracker(service);

      tracker.trackAppStartup(NaN);
      tracker.trackRecordingDuration(NaN, 10);
      tracker.trackPlaybackDuration(NaN, 5);
      tracker.trackScriptLoadTime(NaN, 1000);

      // All events should have duration_ms = 0 (normalized from NaN)
      const allValid = trackedEvents.every(event => {
        const duration = event.params.duration_ms as number;
        return typeof duration === 'number' && duration >= 0 && Number.isFinite(duration);
      });
      expect(allValid).toBe(true);
    });

    it('handles Infinity duration values gracefully', () => {
      const { service, trackedEvents } = createMockAnalyticsService();
      const tracker = new PerformanceTracker(service);

      tracker.trackAppStartup(Infinity);
      tracker.trackRecordingDuration(-Infinity, 10);
      tracker.trackPlaybackDuration(Infinity, 5);
      tracker.trackScriptLoadTime(-Infinity, 1000);

      // All events should have duration_ms = 0 (normalized from Infinity)
      const allValid = trackedEvents.every(event => {
        const duration = event.params.duration_ms as number;
        return typeof duration === 'number' && duration >= 0 && Number.isFinite(duration);
      });
      expect(allValid).toBe(true);
    });

    it('preserves valid positive duration values', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 1000000, noNaN: true }),
          (duration: number) => {
            // Skip Infinity values
            if (!Number.isFinite(duration)) {
              return true;
            }

            const { service, trackedEvents } = createMockAnalyticsService();
            const tracker = new PerformanceTracker(service);

            tracker.trackAppStartup(duration);

            const event = trackedEvents[0];
            const trackedDuration = event.params.duration_ms as number;

            // Valid positive durations should be preserved exactly
            return trackedDuration === duration;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('negative durations are normalized to zero', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1000000, max: -0.001, noNaN: true }),
          (duration: number) => {
            // Skip Infinity values
            if (!Number.isFinite(duration)) {
              return true;
            }

            const { service, trackedEvents } = createMockAnalyticsService();
            const tracker = new PerformanceTracker(service);

            tracker.trackAppStartup(duration);

            const event = trackedEvents[0];
            const trackedDuration = event.params.duration_ms as number;

            // Negative durations should be normalized to 0
            return trackedDuration === 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
