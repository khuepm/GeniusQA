/**
 * Property-Based Tests for Script Preview - Save and Play Button State
 * 
 * Tests that the Save and Play buttons appear and behave correctly
 * based on script state and validation status.
 * 
 * **Feature: ai-script-builder, Property 11: Save and Play Button State**
 * **Validates: Requirements 7.1, 7.4**
 */

import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import {
  Action,
  ActionType,
  ScriptData,
  ScriptMetadata,
  ValidationResult,
} from '../../types/aiScriptBuilder.types';
import { ScriptPreview } from '../ScriptPreview';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a valid action type
 */
const actionTypeArbitrary: fc.Arbitrary<ActionType> = fc.constantFrom(
  'mouse_move',
  'mouse_click',
  'mouse_double_click',
  'mouse_drag',
  'mouse_scroll',
  'key_press',
  'key_release',
  'key_type',
  'screenshot',
  'wait',
  'custom'
);

/**
 * Generate a valid mouse action
 */
const mouseActionArbitrary = (timestamp: number): fc.Arbitrary<Action> => {
  return fc.oneof(
    // Mouse move
    fc.record({
      type: fc.constant('mouse_move' as const),
      timestamp: fc.constant(timestamp),
      x: fc.integer({ min: 0, max: 1920 }),
      y: fc.integer({ min: 0, max: 1080 }),
    }),
    // Mouse click
    fc.record({
      type: fc.constant('mouse_click' as const),
      timestamp: fc.constant(timestamp),
      x: fc.integer({ min: 0, max: 1920 }),
      y: fc.integer({ min: 0, max: 1080 }),
      button: fc.constantFrom('left' as const, 'right' as const, 'middle' as const),
    }),
    // Mouse double click
    fc.record({
      type: fc.constant('mouse_double_click' as const),
      timestamp: fc.constant(timestamp),
      x: fc.integer({ min: 0, max: 1920 }),
      y: fc.integer({ min: 0, max: 1080 }),
      button: fc.constantFrom('left' as const, 'right' as const, 'middle' as const),
    })
  );
};

/**
 * Generate a valid keyboard action
 */
const keyboardActionArbitrary = (timestamp: number): fc.Arbitrary<Action> => {
  return fc.oneof(
    // Key press
    fc.record({
      type: fc.constant('key_press' as const),
      timestamp: fc.constant(timestamp),
      key: fc.constantFrom('a', 'b', 'c', 'enter', 'escape', 'tab', 'space'),
      modifiers: fc.array(fc.constantFrom('ctrl', 'shift', 'alt', 'meta'), { maxLength: 2 }),
    }),
    // Key type
    fc.record({
      type: fc.constant('key_type' as const),
      timestamp: fc.constant(timestamp),
      text: fc.string({ minLength: 1, maxLength: 50 }),
    })
  );
};

/**
 * Generate a valid action
 */
const actionArbitrary = (timestamp: number): fc.Arbitrary<Action> => {
  return fc.oneof(
    mouseActionArbitrary(timestamp),
    keyboardActionArbitrary(timestamp),
    // Wait action
    fc.record({
      type: fc.constant('wait' as const),
      timestamp: fc.constant(timestamp),
    })
  );
};

/**
 * Generate valid script metadata
 */
const scriptMetadataArbitrary = (actionCount: number, duration: number): fc.Arbitrary<ScriptMetadata> => {
  return fc.record({
    created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map(d => d.toISOString()),
    duration: fc.constant(duration),
    action_count: fc.constant(actionCount),
    core_type: fc.constant('rust'),
    platform: fc.constantFrom('macos', 'windows', 'universal'),
  });
};

/**
 * Generate a valid script with specified number of actions
 */
const validScriptArbitrary: fc.Arbitrary<ScriptData> = fc
  .integer({ min: 1, max: 20 })
  .chain(actionCount => {
    // Generate timestamps in ascending order
    const timestamps = Array.from({ length: actionCount }, (_, i) => i * 500);

    // Generate actions with those timestamps
    const actionsArb = fc.array(
      fc.integer({ min: 0, max: actionCount - 1 }).chain(idx =>
        actionArbitrary(timestamps[idx])
      ),
      { minLength: actionCount, maxLength: actionCount }
    );

    return actionsArb.map(actions => {
      // Sort by timestamp to ensure order
      actions.sort((a, b) => a.timestamp - b.timestamp);
      const duration = actions.length > 0 ? actions[actions.length - 1].timestamp : 0;

      return {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration,
          action_count: actions.length,
          core_type: 'rust',
          platform: 'macos',
        },
        actions,
      };
    });
  });

/**
 * Generate a valid validation result (no errors)
 */
const validValidationResultArbitrary: fc.Arbitrary<ValidationResult> = fc.constant({
  valid: true,
  errors: [],
  warnings: [],
});

/**
 * Generate an invalid validation result (with errors)
 */
const invalidValidationResultArbitrary: fc.Arbitrary<ValidationResult> = fc
  .array(
    fc.record({
      field: fc.constantFrom('actions[0].x', 'actions[0].y', 'actions[1].key', 'metadata.duration'),
      message: fc.constantFrom(
        'X coordinate out of bounds',
        'Y coordinate out of bounds',
        'Invalid key code',
        'Duration mismatch'
      ),
      actionIndex: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
    }),
    { minLength: 1, maxLength: 5 }
  )
  .map(errors => ({
    valid: false,
    errors,
    warnings: [],
  }));

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Render ScriptPreview with given props
 */
const renderScriptPreview = (
  script: ScriptData | null,
  validationResult: ValidationResult,
  isSaved: boolean = false,
  onPlay?: (script: ScriptData) => void
) => {
  return render(
    <ScriptPreview
      script={script}
      onEdit={jest.fn()}
      onSave={jest.fn()}
      onDiscard={jest.fn()}
      onPlay={onPlay}
      validationResult={validationResult}
      isSaved={isSaved}
      isPlaying={false}
    />
  );
};

/**
 * Check if Save button is visible and enabled
 */
const isSaveButtonVisibleAndEnabled = (): boolean => {
  const saveButton = screen.queryByText(/💾\s*Save Script/i);
  return saveButton !== null && !saveButton.hasAttribute('disabled');
};

/**
 * Check if Save button shows "Saved" state
 */
const isSaveButtonInSavedState = (): boolean => {
  const savedButton = screen.queryByText(/💾\s*Saved/i);
  return savedButton !== null && savedButton.hasAttribute('disabled');
};

/**
 * Check if Play button is visible
 */
const isPlayButtonVisible = (): boolean => {
  const playButton = screen.queryByTestId('script-play-button');
  return playButton !== null;
};

/**
 * Check if Play button is enabled
 */
const isPlayButtonEnabled = (): boolean => {
  const playButton = screen.queryByTestId('script-play-button');
  return playButton !== null && !playButton.hasAttribute('disabled');
};

// ============================================================================
// Property Tests
// ============================================================================

describe('ScriptPreview Property Tests - Save and Play Button State', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * **Feature: ai-script-builder, Property 11: Save and Play Button State**
   * **Validates: Requirements 7.1, 7.4**
   * 
   * For any valid generated script, the Save button SHALL be visible.
   * After successful save, the Play button SHALL become visible.
   */
  describe('Property 11: Save and Play Button State', () => {
    it('Save button is visible for any valid generated script', () => {
      fc.assert(
        fc.property(
          validScriptArbitrary,
          validValidationResultArbitrary,
          (script, validationResult) => {
            cleanup();
            renderScriptPreview(script, validationResult, false);

            // Save button should be visible and enabled
            return isSaveButtonVisibleAndEnabled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Save button is disabled when script is already saved', () => {
      fc.assert(
        fc.property(
          validScriptArbitrary,
          validValidationResultArbitrary,
          (script, validationResult) => {
            cleanup();
            renderScriptPreview(script, validationResult, true);

            // Save button should show "Saved" and be disabled
            return isSaveButtonInSavedState();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Save button is disabled when script has validation errors', () => {
      fc.assert(
        fc.property(
          validScriptArbitrary,
          invalidValidationResultArbitrary,
          (script, validationResult) => {
            cleanup();
            renderScriptPreview(script, validationResult, false);

            const saveButton = screen.queryByText(/💾\s*Save Script/i);
            return saveButton !== null && saveButton.hasAttribute('disabled');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Play button is NOT visible when script is not saved', () => {
      fc.assert(
        fc.property(
          validScriptArbitrary,
          validValidationResultArbitrary,
          (script, validationResult) => {
            cleanup();
            const mockOnPlay = jest.fn();
            renderScriptPreview(script, validationResult, false, mockOnPlay);

            // Play button should NOT be visible
            return !isPlayButtonVisible();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Play button IS visible when script is saved and onPlay is provided', () => {
      fc.assert(
        fc.property(
          validScriptArbitrary,
          validValidationResultArbitrary,
          (script, validationResult) => {
            cleanup();
            const mockOnPlay = jest.fn();
            renderScriptPreview(script, validationResult, true, mockOnPlay);

            // Play button should be visible
            return isPlayButtonVisible();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Play button is NOT visible when onPlay callback is not provided', () => {
      fc.assert(
        fc.property(
          validScriptArbitrary,
          validValidationResultArbitrary,
          (script, validationResult) => {
            cleanup();
            renderScriptPreview(script, validationResult, true, undefined);

            // Play button should NOT be visible
            return !isPlayButtonVisible();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Play button is enabled when script is saved and valid', () => {
      fc.assert(
        fc.property(
          validScriptArbitrary,
          validValidationResultArbitrary,
          (script, validationResult) => {
            cleanup();
            const mockOnPlay = jest.fn();
            renderScriptPreview(script, validationResult, true, mockOnPlay);

            // Play button should be visible and enabled
            return isPlayButtonVisible() && isPlayButtonEnabled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Play button is disabled when script has validation errors', () => {
      fc.assert(
        fc.property(
          validScriptArbitrary,
          invalidValidationResultArbitrary,
          (script, validationResult) => {
            cleanup();
            const mockOnPlay = jest.fn();
            renderScriptPreview(script, validationResult, true, mockOnPlay);

            const playButton = screen.queryByTestId('script-play-button');
            return playButton !== null && playButton.hasAttribute('disabled');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clicking Play button calls onPlay callback with script', () => {
      fc.assert(
        fc.property(
          validScriptArbitrary,
          validValidationResultArbitrary,
          (script, validationResult) => {
            cleanup();
            const mockOnPlay = jest.fn();
            renderScriptPreview(script, validationResult, true, mockOnPlay);

            const playButton = screen.getByTestId('script-play-button');
            fireEvent.click(playButton);

            // onPlay should be called with the script
            return mockOnPlay.mock.calls.length === 1 &&
              mockOnPlay.mock.calls[0][0] === script;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Save button state transitions correctly: unsaved -> saved', () => {
      fc.assert(
        fc.property(
          validScriptArbitrary,
          validValidationResultArbitrary,
          (script, validationResult) => {
            cleanup();
            const { rerender } = renderScriptPreview(script, validationResult, false);

            // Initially, Save button should be enabled
            const initialState = isSaveButtonVisibleAndEnabled();

            // Re-render with isSaved=true
            rerender(
              <ScriptPreview
                script={script}
                onEdit={jest.fn()}
                onSave={jest.fn()}
                onDiscard={jest.fn()}
                validationResult={validationResult}
                isSaved={true}
                isPlaying={false}
              />
            );

            // Now Save button should show "Saved" and be disabled
            const savedState = isSaveButtonInSavedState();

            return initialState && savedState;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Play button appears after save state transition', () => {
      fc.assert(
        fc.property(
          validScriptArbitrary,
          validValidationResultArbitrary,
          (script, validationResult) => {
            cleanup();
            const mockOnPlay = jest.fn();
            const { rerender } = renderScriptPreview(script, validationResult, false, mockOnPlay);

            // Initially, Play button should NOT be visible
            const initialPlayVisible = isPlayButtonVisible();

            // Re-render with isSaved=true
            rerender(
              <ScriptPreview
                script={script}
                onEdit={jest.fn()}
                onSave={jest.fn()}
                onDiscard={jest.fn()}
                onPlay={mockOnPlay}
                validationResult={validationResult}
                isSaved={true}
                isPlaying={false}
              />
            );

            // Now Play button should be visible
            const finalPlayVisible = isPlayButtonVisible();

            return !initialPlayVisible && finalPlayVisible;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('button states are consistent across different script sizes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          validValidationResultArbitrary,
          fc.boolean(),
          (actionCount, validationResult, isSaved) => {
            cleanup();

            // Generate script with specific action count
            const timestamps = Array.from({ length: actionCount }, (_, i) => i * 100);
            const actions: Action[] = timestamps.map(ts => ({
              type: 'mouse_click',
              timestamp: ts,
              x: 100,
              y: 100,
              button: 'left' as const,
            }));

            const script: ScriptData = {
              version: '1.0',
              metadata: {
                created_at: new Date().toISOString(),
                duration: actions[actions.length - 1].timestamp,
                action_count: actions.length,
                core_type: 'rust',
                platform: 'macos',
              },
              actions,
            };

            const mockOnPlay = jest.fn();
            renderScriptPreview(script, validationResult, isSaved, mockOnPlay);

            // Button visibility should be consistent regardless of script size
            const saveVisible = screen.queryByText(isSaved ? /💾\s*Saved/i : /💾\s*Save Script/i) !== null;
            const playVisible = isPlayButtonVisible();

            return saveVisible && (isSaved ? playVisible : !playVisible);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('button states are consistent across different action types', () => {
      fc.assert(
        fc.property(
          actionTypeArbitrary,
          validValidationResultArbitrary,
          fc.boolean(),
          (actionType, validationResult, isSaved) => {
            cleanup();

            // Create a script with a single action of the given type
            const action: Action = {
              type: actionType,
              timestamp: 0,
              ...(actionType.startsWith('mouse') ? { x: 100, y: 100 } : {}),
              ...(actionType === 'mouse_click' ? { button: 'left' as const } : {}),
              ...(actionType === 'key_press' ? { key: 'a' } : {}),
              ...(actionType === 'key_type' ? { text: 'test' } : {}),
            };

            const script: ScriptData = {
              version: '1.0',
              metadata: {
                created_at: new Date().toISOString(),
                duration: 0,
                action_count: 1,
                core_type: 'rust',
                platform: 'macos',
              },
              actions: [action],
            };

            const mockOnPlay = jest.fn();
            renderScriptPreview(script, validationResult, isSaved, mockOnPlay);

            // Button states should be consistent regardless of action type
            const saveVisible = screen.queryByText(isSaved ? /💾\s*Saved/i : /💾\s*Save Script/i) !== null;
            const playVisible = isPlayButtonVisible();

            return saveVisible && (isSaved ? playVisible : !playVisible);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('no buttons are visible when script is null', () => {
      cleanup();
      renderScriptPreview(null, { valid: true, errors: [], warnings: [] }, false);

      const saveButton = screen.queryByText(/💾\s*Save Script/i);
      const playButton = screen.queryByTestId('script-play-button');

      expect(saveButton).not.toBeInTheDocument();
      expect(playButton).not.toBeInTheDocument();
    });

    it('button states remain consistent after multiple re-renders', () => {
      fc.assert(
        fc.property(
          validScriptArbitrary,
          validValidationResultArbitrary,
          fc.array(fc.boolean(), { minLength: 2, maxLength: 10 }),
          (script, validationResult, savedStates) => {
            cleanup();
            const mockOnPlay = jest.fn();
            const { rerender } = renderScriptPreview(script, validationResult, savedStates[0], mockOnPlay);

            // Re-render multiple times with different saved states
            for (let i = 1; i < savedStates.length; i++) {
              rerender(
                <ScriptPreview
                  script={script}
                  onEdit={jest.fn()}
                  onSave={jest.fn()}
                  onDiscard={jest.fn()}
                  onPlay={mockOnPlay}
                  validationResult={validationResult}
                  isSaved={savedStates[i]}
                  isPlaying={false}
                />
              );

              // Check button states match expected state
              const expectedSaveState = savedStates[i] ? isSaveButtonInSavedState() : isSaveButtonVisibleAndEnabled();
              const expectedPlayState = savedStates[i] ? isPlayButtonVisible() : !isPlayButtonVisible();

              if (!expectedSaveState || !expectedPlayState) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Edge cases and boundary conditions
   */
  describe('Edge Cases and Boundary Conditions', () => {
    it('handles script with single action correctly', () => {
      cleanup();
      const script: ScriptData = {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration: 0,
          action_count: 1,
          core_type: 'rust',
          platform: 'macos',
        },
        actions: [{
          type: 'mouse_click',
          timestamp: 0,
          x: 100,
          y: 100,
          button: 'left',
        }],
      };

      const mockOnPlay = jest.fn();
      renderScriptPreview(script, { valid: true, errors: [], warnings: [] }, true, mockOnPlay);

      expect(isSaveButtonInSavedState()).toBe(true);
      expect(isPlayButtonVisible()).toBe(true);
    });

    it('handles script with many actions correctly', () => {
      cleanup();
      const actions: Action[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'mouse_click' as const,
        timestamp: i * 10,
        x: 100 + i,
        y: 100 + i,
        button: 'left' as const,
      }));

      const script: ScriptData = {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration: 990,
          action_count: 100,
          core_type: 'rust',
          platform: 'macos',
        },
        actions,
      };

      const mockOnPlay = jest.fn();
      renderScriptPreview(script, { valid: true, errors: [], warnings: [] }, true, mockOnPlay);

      expect(isSaveButtonInSavedState()).toBe(true);
      expect(isPlayButtonVisible()).toBe(true);
    });

    it('handles validation result with warnings but no errors', () => {
      fc.assert(
        fc.property(
          validScriptArbitrary,
          (script) => {
            cleanup();
            const validationWithWarnings: ValidationResult = {
              valid: true,
              errors: [],
              warnings: [
                { field: 'actions[0].timestamp', message: 'Timestamp is very small' },
              ],
            };

            const mockOnPlay = jest.fn();
            renderScriptPreview(script, validationWithWarnings, true, mockOnPlay);

            // Should still allow save and play despite warnings
            return isSaveButtonInSavedState() && isPlayButtonVisible() && isPlayButtonEnabled();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
