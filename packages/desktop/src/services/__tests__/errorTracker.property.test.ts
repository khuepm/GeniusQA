/**
 * Property-Based Tests for ErrorTracker Service
 * 
 * Tests correctness properties for error context preservation and critical error escalation.
 * 
 * @module services/__tests__/errorTracker.property.test
 */

import * as fc from 'fast-check';
import { ErrorTracker } from '../errorTracker';
import type { AnalyticsService } from '../analyticsService';
import type { ErrorContext, ErrorSeverity } from '../../types/analytics.types';

// ============================================================================
// Mock AnalyticsService
// ============================================================================

/**
 * Creates a mock AnalyticsService for testing
 */
function createMockAnalyticsService(): AnalyticsService & { 
  trackedEvents: Array<{ name: string; params: Record<string, unknown> }>;
} {
  const trackedEvents: Array<{ name: string; params: Record<string, unknown> }> = [];
  
  return {
    trackedEvents,
    getSessionId: () => 'test-session-id-12345',
    trackEvent: (name: string, params?: Record<string, unknown>) => {
      trackedEvents.push({ name, params: params || {} });
    },
  } as AnalyticsService & { trackedEvents: Array<{ name: string; params: Record<string, unknown> }> };
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a valid error name
 */
const errorNameArbitrary = fc.constantFrom(
  'Error',
  'TypeError',
  'ReferenceError',
  'NetworkError',
  'RecordingError',
  'PlaybackError',
  'SecurityError',
  'CoreConnectionError',
  'CustomError'
);

/**
 * Generate an error message
 */
const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 200 });

/**
 * Generate a component name
 */
const componentArbitrary = fc.constantFrom(
  'RecordingPanel',
  'PlaybackEngine',
  'ScriptEditor',
  'AIChat',
  'Settings',
  'Dashboard',
  'NetworkManager'
);

/**
 * Generate an action name
 */
const actionArbitrary = fc.constantFrom(
  'startRecording',
  'stopRecording',
  'playScript',
  'saveScript',
  'loadScript',
  'sendMessage',
  'connectCore',
  'fetchData'
);

/**
 * Generate an error context
 */
const errorContextArbitrary: fc.Arbitrary<ErrorContext> = fc.record({
  component: fc.option(componentArbitrary, { nil: undefined }),
  action: fc.option(actionArbitrary, { nil: undefined }),
  appState: fc.option(
    fc.record({
      isRecording: fc.boolean(),
      isPlaying: fc.boolean(),
      scriptLoaded: fc.boolean(),
    }),
    { nil: undefined }
  ),
});

/**
 * Generate a recording state
 */
const recordingStateArbitrary = fc.record({
  isRecording: fc.boolean(),
  actionCount: fc.integer({ min: 0, max: 1000 }),
  duration: fc.integer({ min: 0, max: 3600000 }),
  targetApp: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
});

/**
 * Generate a playback state
 */
const playbackStateArbitrary = fc.record({
  isPlaying: fc.boolean(),
  currentStep: fc.integer({ min: 0, max: 100 }),
  totalSteps: fc.integer({ min: 1, max: 100 }),
  actionType: fc.constantFrom('click', 'type', 'scroll', 'wait', 'assert'),
  selector: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
});

/**
 * Generate a recent action string
 */
const recentActionArbitrary = fc.oneof(
  fc.constant('clicked button'),
  fc.constant('typed text'),
  fc.constant('navigated to page'),
  fc.constant('opened dialog'),
  fc.constant('saved file'),
  fc.constant('loaded script'),
  fc.string({ minLength: 5, maxLength: 50 })
);

/**
 * Generate an Error object
 */
const errorArbitrary = fc.tuple(errorNameArbitrary, errorMessageArbitrary).map(([name, message]) => {
  const error = new Error(message);
  error.name = name;
  return error;
});

// ============================================================================
// Property Tests
// ============================================================================

describe('ErrorTracker Property Tests', () => {
  /**
   * **Property 3: Error Context Preservation**
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.5-4.10**
   * 
   * For any error event, the event SHALL include error type, message, and
   * relevant context (component, action, recent actions) without losing information.
   */
  describe('Property 3: Error Context Preservation', () => {
    it('trackError preserves error type and message in tracked events', () => {
      fc.assert(
        fc.property(
          errorArbitrary,
          errorContextArbitrary,
          (error: Error, context: ErrorContext) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            tracker.trackError(error, context);
            
            // Should have tracked exactly one event
            if (mockService.trackedEvents.length !== 1) {
              return false;
            }
            
            const event = mockService.trackedEvents[0];
            
            // Verify error type is preserved
            const hasErrorType = event.params.error_type === error.name;
            
            // Verify error message is preserved
            const hasErrorMessage = event.params.error_message === error.message;
            
            return hasErrorType && hasErrorMessage;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('trackError preserves component and action context', () => {
      fc.assert(
        fc.property(
          errorArbitrary,
          errorContextArbitrary,
          (error: Error, context: ErrorContext) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            tracker.trackError(error, context);
            
            const event = mockService.trackedEvents[0];
            
            // Verify component is preserved (if provided)
            const componentPreserved = context.component === undefined || 
                                        event.params.component === context.component;
            
            // Verify action is preserved (if provided)
            const actionPreserved = context.action === undefined || 
                                     event.params.action === context.action;
            
            return componentPreserved && actionPreserved;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('trackError includes recent actions in context', () => {
      fc.assert(
        fc.property(
          errorArbitrary,
          fc.array(recentActionArbitrary, { minLength: 1, maxLength: 15 }),
          (error: Error, actions: string[]) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            // Add recent actions
            actions.forEach(action => tracker.addRecentAction(action));
            
            // Track error
            tracker.trackError(error, {});
            
            const event = mockService.trackedEvents[0];
            const trackedActions = event.params.recent_actions as string[];
            
            // Recent actions should be included
            if (!Array.isArray(trackedActions)) {
              return false;
            }
            
            // All added actions should be present (up to max limit)
            const expectedActions = actions.slice(-20);
            return expectedActions.every(action => trackedActions.includes(action));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('trackError includes stack trace when available', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          (message: string) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            const error = new Error(message);
            tracker.trackError(error, {});
            
            const event = mockService.trackedEvents[0];
            
            // Stack trace should be included if error has one
            if (error.stack) {
              return event.params.error_stack === error.stack;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('trackRecordingError preserves recording state', () => {
      fc.assert(
        fc.property(
          errorArbitrary,
          recordingStateArbitrary,
          (error: Error, recordingState: Record<string, unknown>) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            tracker.trackRecordingError(error, recordingState);
            
            const event = mockService.trackedEvents[0];
            
            // Recording state should be preserved
            const statePreserved = JSON.stringify(event.params.recording_state) === 
                                   JSON.stringify(recordingState);
            
            // Event name should be recording-related
            const isRecordingEvent = event.name === 'recording_failed' || 
                                      event.name === 'recording_interrupted';
            
            return statePreserved && isRecordingEvent;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('trackPlaybackError preserves playback state and action details', () => {
      fc.assert(
        fc.property(
          errorArbitrary,
          playbackStateArbitrary,
          (error: Error, playbackState: Record<string, unknown>) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            tracker.trackPlaybackError(error, playbackState);
            
            const event = mockService.trackedEvents[0];
            
            // Playback state should be preserved
            const statePreserved = JSON.stringify(event.params.playback_state) === 
                                   JSON.stringify(playbackState);
            
            // Action type should be preserved
            const actionTypePreserved = event.params.action_type === playbackState.actionType;
            
            // Event name should be playback-related
            const isPlaybackEvent = event.name === 'playback_action_failed' || 
                                     event.name === 'element_not_found';
            
            return statePreserved && actionTypePreserved && isPlaybackEvent;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('trackNetworkError preserves endpoint and status code', () => {
      fc.assert(
        fc.property(
          errorArbitrary,
          fc.webUrl(),
          fc.option(fc.integer({ min: 100, max: 599 }), { nil: undefined }),
          (error: Error, endpoint: string, statusCode: number | undefined) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            tracker.trackNetworkError(error, endpoint, statusCode);
            
            const event = mockService.trackedEvents[0];
            
            // Endpoint should be preserved
            const endpointPreserved = event.params.endpoint === endpoint;
            
            // Status code should be preserved (if provided)
            const statusCodePreserved = statusCode === undefined || 
                                         event.params.status_code === statusCode;
            
            // Event name should be network-related
            const isNetworkEvent = event.name === 'network_error' || 
                                    event.name === 'script_load_error';
            
            return endpointPreserved && statusCodePreserved && isNetworkEvent;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('trackCommandError preserves command name', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          errorArbitrary,
          (commandName: string, error: Error) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            tracker.trackCommandError(commandName, error);
            
            const event = mockService.trackedEvents[0];
            
            // Command name should be preserved
            const commandPreserved = event.params.command_name === commandName;
            
            // Event name should be command-related
            const isCommandEvent = event.name === 'command_error' || 
                                    event.name === 'core_connection_error';
            
            return commandPreserved && isCommandEvent;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all error tracking methods include severity', () => {
      fc.assert(
        fc.property(
          errorArbitrary,
          (error: Error) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            tracker.trackError(error, {});
            
            const event = mockService.trackedEvents[0];
            
            // Severity should be one of the valid values
            const validSeverities: ErrorSeverity[] = ['low', 'medium', 'high', 'critical'];
            return validSeverities.includes(event.params.error_severity as ErrorSeverity);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('error count is tracked and included in events', () => {
      fc.assert(
        fc.property(
          errorArbitrary,
          fc.integer({ min: 1, max: 10 }),
          (error: Error, repeatCount: number) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            // Track the same error multiple times
            for (let i = 0; i < repeatCount; i++) {
              tracker.trackError(error, {});
            }
            
            // Each event should have incrementing error count
            for (let i = 0; i < repeatCount; i++) {
              const event = mockService.trackedEvents[i];
              if (event.params.error_count !== i + 1) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Property 4: Critical Error Escalation**
   * **Validates: Requirements 4.4**
   * 
   * For any error type that occurs more than 3 times within a session,
   * the error severity SHALL be escalated to 'critical'.
   */
  describe('Property 4: Critical Error Escalation', () => {
    it('errors occurring more than 3 times are escalated to critical', () => {
      fc.assert(
        fc.property(
          errorArbitrary,
          fc.integer({ min: 4, max: 20 }),
          (error: Error, repeatCount: number) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            // Track the same error multiple times
            for (let i = 0; i < repeatCount; i++) {
              tracker.trackError(error, {});
            }
            
            // Events after the 3rd occurrence should be critical
            for (let i = 3; i < repeatCount; i++) {
              const event = mockService.trackedEvents[i];
              if (event.params.error_severity !== 'critical') {
                return false;
              }
              // Event name should be critical_error for escalated errors
              if (event.name !== 'critical_error') {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('errors occurring 3 or fewer times are not escalated to critical (unless inherently critical)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3 }),
          (repeatCount: number) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            // Use a low-severity error type
            const error = new Error('Test error');
            error.name = 'CustomError';
            
            // Track the error up to 3 times
            for (let i = 0; i < repeatCount; i++) {
              tracker.trackError(error, {});
            }
            
            // None of the events should be critical
            return mockService.trackedEvents.every(event => 
              event.params.error_severity !== 'critical' && 
              event.name !== 'critical_error'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isCriticalError returns true for count > 3', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.integer({ min: 4, max: 100 }),
          (errorType: string, count: number) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            return tracker['isCriticalError'](errorType, count) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isCriticalError returns false for count <= 3', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.integer({ min: 1, max: 3 }),
          (errorType: string, count: number) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            return tracker['isCriticalError'](errorType, count) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('different error types are tracked separately for escalation', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(errorNameArbitrary, { minLength: 2, maxLength: 5 }),
          fc.integer({ min: 1, max: 3 }),
          (errorTypes: string[], countPerType: number) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            // Track each error type up to 3 times
            for (const errorType of errorTypes) {
              for (let i = 0; i < countPerType; i++) {
                const error = new Error('Test');
                error.name = errorType;
                tracker.trackError(error, {});
              }
            }
            
            // Verify each error type has correct count
            for (const errorType of errorTypes) {
              const count = tracker.getErrorCount(errorType);
              if (count !== countPerType) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('escalation threshold is exactly 3 (4th occurrence triggers critical)', () => {
      const mockService = createMockAnalyticsService();
      const tracker = new ErrorTracker(mockService);
      
      const error = new Error('Test');
      error.name = 'TestError';
      
      // Track 4 times
      for (let i = 0; i < 4; i++) {
        tracker.trackError(error, {});
      }
      
      // First 3 should not be critical
      for (let i = 0; i < 3; i++) {
        expect(mockService.trackedEvents[i].params.error_severity).not.toBe('critical');
        expect(mockService.trackedEvents[i].name).toBe('error_occurred');
      }
      
      // 4th should be critical
      expect(mockService.trackedEvents[3].params.error_severity).toBe('critical');
      expect(mockService.trackedEvents[3].name).toBe('critical_error');
    });
  });

  /**
   * Additional tests for recent actions tracking
   */
  describe('Recent Actions Tracking', () => {
    it('maintains maximum of 20 recent actions', () => {
      fc.assert(
        fc.property(
          fc.array(recentActionArbitrary, { minLength: 21, maxLength: 50 }),
          (actions: string[]) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            // Add all actions
            actions.forEach(action => tracker.addRecentAction(action));
            
            // Should only have last 20
            const recentActions = tracker.getRecentActions();
            return recentActions.length === 20;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('preserves order of recent actions (FIFO when exceeding limit)', () => {
      fc.assert(
        fc.property(
          fc.array(recentActionArbitrary, { minLength: 25, maxLength: 40 }),
          (actions: string[]) => {
            const mockService = createMockAnalyticsService();
            const tracker = new ErrorTracker(mockService);
            
            // Add all actions
            actions.forEach(action => tracker.addRecentAction(action));
            
            // Should have the last 20 actions in order
            const recentActions = tracker.getRecentActions();
            const expectedActions = actions.slice(-20);
            
            return recentActions.every((action, index) => action === expectedActions[index]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getRecentActions returns a copy, not the internal array', () => {
      const mockService = createMockAnalyticsService();
      const tracker = new ErrorTracker(mockService);
      
      tracker.addRecentAction('action1');
      tracker.addRecentAction('action2');
      
      const actions1 = tracker.getRecentActions();
      actions1.push('modified');
      
      const actions2 = tracker.getRecentActions();
      
      // Modification should not affect internal state
      expect(actions2.length).toBe(2);
      expect(actions2).not.toContain('modified');
    });
  });
});
