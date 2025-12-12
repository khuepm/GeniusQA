/**
 * Property-based tests for button state calculation
 * Feature: desktop-recorder-mvp, Property 6: Button state consistency
 * Validates: Requirements 1.5, 2.5, 4.3
 */

import * as fc from 'fast-check';
import { calculateButtonStates } from '../buttonStates';
import { RecorderStatus } from '../../types/recorder.types';

describe('Button State Property Tests', () => {
  /**
   * Property 6: Button state consistency
   * For any application state (idle, recording, playing), the enabled/disabled state
   * of each button should match the specification:
   * - Record enabled only when idle
   * - Start enabled only when idle with recordings
   * - Stop enabled only when recording or playing
   */
  test('button states match specification for all app states', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<RecorderStatus>('idle', 'recording', 'playing'),
        fc.boolean(),
        (status: RecorderStatus, hasRecordings: boolean) => {
          const buttonStates = calculateButtonStates(status, hasRecordings);

          // Record button: enabled only when idle
          if (status === 'idle') {
            expect(buttonStates.recordEnabled).toBe(true);
          } else {
            expect(buttonStates.recordEnabled).toBe(false);
          }

          // Start button: enabled only when idle AND hasRecordings is true
          if (status === 'idle' && hasRecordings) {
            expect(buttonStates.startEnabled).toBe(true);
          } else {
            expect(buttonStates.startEnabled).toBe(false);
          }

          // Stop button: enabled only when recording OR playing
          if (status === 'recording' || status === 'playing') {
            expect(buttonStates.stopEnabled).toBe(true);
          } else {
            expect(buttonStates.stopEnabled).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Mutual exclusivity of Record and Stop buttons
   * Record and Stop should never both be enabled at the same time
   */
  test('record and stop buttons are mutually exclusive', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<RecorderStatus>('idle', 'recording', 'playing'),
        fc.boolean(),
        (status: RecorderStatus, hasRecordings: boolean) => {
          const buttonStates = calculateButtonStates(status, hasRecordings);

          // Record and Stop should never both be enabled
          const bothEnabled = buttonStates.recordEnabled && buttonStates.stopEnabled;
          expect(bothEnabled).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: At least one button is always enabled
   * The UI should always have at least one actionable button
   */
  test('at least one button is always enabled', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<RecorderStatus>('idle', 'recording', 'playing'),
        fc.boolean(),
        (status: RecorderStatus, hasRecordings: boolean) => {
          const buttonStates = calculateButtonStates(status, hasRecordings);

          // At least one button should be enabled
          const atLeastOneEnabled =
            buttonStates.recordEnabled ||
            buttonStates.startEnabled ||
            buttonStates.stopEnabled;
          
          expect(atLeastOneEnabled).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Start button dependency on hasRecordings
   * Start button should never be enabled when hasRecordings is false
   */
  test('start button requires hasRecordings to be true', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<RecorderStatus>('idle', 'recording', 'playing'),
        (status: RecorderStatus) => {
          const buttonStates = calculateButtonStates(status, false);

          // Start button should never be enabled when hasRecordings is false
          expect(buttonStates.startEnabled).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
