/**
 * Property-Based Tests for Script Preview Component
 * 
 * Tests correctness properties for script preview, ensuring
 * all actions are displayed with complete information.
 * 
 * Requirements: 3.5, 4.4
 */

import * as fc from 'fast-check';
import { getActionDescription } from '../ScriptPreview';
import {
  ScriptData,
  Action,
  ActionType,
  ScriptMetadata,
  AVAILABLE_ACTION_TYPES,
  ACTION_TYPE_DESCRIPTIONS,
} from '../../types/aiScriptBuilder.types';
import {
  VALID_MOUSE_BUTTONS,
  VALID_PLATFORMS,
  VALID_CORE_TYPES,
  DEFAULT_SCREEN_BOUNDS,
} from '../../services/scriptValidationService';

// ============================================================================
// Arbitraries (Generators) for Script Data
// ============================================================================

/**
 * Generate a valid mouse button
 */
const mouseButtonArbitrary = fc.constantFrom(...VALID_MOUSE_BUTTONS);

/**
 * Generate valid screen coordinates
 */
const validCoordinateArbitrary = fc.integer({
  min: DEFAULT_SCREEN_BOUNDS.minX,
  max: Math.min(DEFAULT_SCREEN_BOUNDS.maxX, 4096),
});

/**
 * Generate a valid timestamp (non-negative)
 */
const timestampArbitrary = fc.float({ min: 0, max: 10000, noNaN: true });

/**
 * Generate a valid key string
 */
const keyChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const keyArbitrary = fc.array(
  fc.integer({ min: 0, max: keyChars.length - 1 }),
  { minLength: 1, maxLength: 20 }
).map(indices => indices.map(i => keyChars[i]).join(''));

/**
 * Generate a valid mouse move action
 */
const validMouseMoveActionArbitrary: fc.Arbitrary<Action> = fc.record({
  type: fc.constant('mouse_move' as ActionType),
  timestamp: timestampArbitrary,
  x: validCoordinateArbitrary,
  y: validCoordinateArbitrary,
});

/**
 * Generate a valid mouse click action
 */
const validMouseClickActionArbitrary: fc.Arbitrary<Action> = fc.record({
  type: fc.constantFrom('mouse_click', 'mouse_double_click') as fc.Arbitrary<ActionType>,
  timestamp: timestampArbitrary,
  x: validCoordinateArbitrary,
  y: validCoordinateArbitrary,
  button: mouseButtonArbitrary,
});

/**
 * Generate a valid mouse scroll action
 */
const validMouseScrollActionArbitrary: fc.Arbitrary<Action> = fc.record({
  type: fc.constant('mouse_scroll' as ActionType),
  timestamp: timestampArbitrary,
  x: validCoordinateArbitrary,
  y: validCoordinateArbitrary,
});

/**
 * Generate a valid mouse drag action
 */
const validMouseDragActionArbitrary: fc.Arbitrary<Action> = fc.record({
  type: fc.constant('mouse_drag' as ActionType),
  timestamp: timestampArbitrary,
  x: validCoordinateArbitrary,
  y: validCoordinateArbitrary,
});

/**
 * Generate a valid key press/release action
 */
const validKeyPressActionArbitrary: fc.Arbitrary<Action> = keyArbitrary.chain(key =>
  fc.record({
    type: fc.constantFrom('key_press', 'key_release') as fc.Arbitrary<ActionType>,
    timestamp: timestampArbitrary,
    key: fc.constant(key),
    modifiers: fc.option(fc.array(fc.constantFrom('ctrl', 'alt', 'shift', 'meta'), { minLength: 0, maxLength: 2 }), { nil: undefined }),
  })
);

/**
 * Generate a valid key type action
 */
const validKeyTypeActionArbitrary: fc.Arbitrary<Action> = fc.record({
  type: fc.constant('key_type' as ActionType),
  timestamp: timestampArbitrary,
  text: fc.string({ minLength: 0, maxLength: 100 }),
});

/**
 * Generate a valid wait action
 */
const validWaitActionArbitrary: fc.Arbitrary<Action> = fc.record({
  type: fc.constant('wait' as ActionType),
  timestamp: timestampArbitrary,
});

/**
 * Generate a valid screenshot action
 */
const validScreenshotActionArbitrary: fc.Arbitrary<Action> = fc.record({
  type: fc.constant('screenshot' as ActionType),
  timestamp: timestampArbitrary,
});

/**
 * Generate any valid action
 */
const validActionArbitrary: fc.Arbitrary<Action> = fc.oneof(
  validMouseMoveActionArbitrary,
  validMouseClickActionArbitrary,
  validMouseScrollActionArbitrary,
  validMouseDragActionArbitrary,
  validKeyPressActionArbitrary,
  validKeyTypeActionArbitrary,
  validWaitActionArbitrary,
  validScreenshotActionArbitrary
);

/**
 * Generate a valid ISO date string
 */
const isoDateArbitrary = fc.tuple(
  fc.integer({ min: 2020, max: 2030 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 1, max: 28 }),
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 }),
  fc.integer({ min: 0, max: 59 })
).map(([year, month, day, hour, minute, second]) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}.000Z`;
});

/**
 * Generate a valid script metadata
 */
const validMetadataArbitrary = (actionCount: number, duration: number): fc.Arbitrary<ScriptMetadata> =>
  fc.record({
    created_at: isoDateArbitrary,
    duration: fc.constant(duration),
    action_count: fc.constant(actionCount),
    core_type: fc.constantFrom(...VALID_CORE_TYPES),
    platform: fc.constantFrom(...VALID_PLATFORMS),
  });

/**
 * Generate a valid script with sorted timestamps
 */
const validScriptArbitrary: fc.Arbitrary<ScriptData> = fc
  .array(validActionArbitrary, { minLength: 1, maxLength: 20 })
  .map(actions => {
    const sortedActions = [...actions].sort((a, b) => a.timestamp - b.timestamp);
    let currentTime = 0;
    const orderedActions = sortedActions.map(action => {
      const newAction = { ...action, timestamp: currentTime };
      currentTime += 0.1 + Math.random() * 0.5;
      return newAction;
    });
    return orderedActions;
  })
  .chain(actions => {
    const duration = actions.length > 0 ? actions[actions.length - 1].timestamp : 0;
    return fc.record({
      version: fc.constant('1.0'),
      metadata: validMetadataArbitrary(actions.length, duration),
      actions: fc.constant(actions),
    });
  });

// ============================================================================
// Property Tests
// ============================================================================

describe('Script Preview Property Tests', () => {
  /**
   * **Feature: ai-script-builder, Property 10: Script Preview Completeness**
   * **Validates: Requirements 3.5, 4.4**
   * 
   * For any valid generated script, the preview should display all actions
   * with their type, parameters, and human-readable descriptions.
   */
  describe('Property 10: Script Preview Completeness', () => {
    it('getActionDescription returns non-empty string for all valid actions', () => {
      fc.assert(
        fc.property(validActionArbitrary, (action: Action) => {
          const description = getActionDescription(action);
          
          // Description should be a non-empty string
          return typeof description === 'string' && description.length > 0;
        }),
        { numRuns: 100 }
      );
    });

    it('getActionDescription includes action type information', () => {
      fc.assert(
        fc.property(validActionArbitrary, (action: Action) => {
          const description = getActionDescription(action);
          const baseDescription = ACTION_TYPE_DESCRIPTIONS[action.type];
          
          // Description should contain the base action type description
          return description.includes(baseDescription);
        }),
        { numRuns: 100 }
      );
    });

    it('mouse action descriptions include coordinates', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            validMouseMoveActionArbitrary,
            validMouseClickActionArbitrary,
            validMouseScrollActionArbitrary,
            validMouseDragActionArbitrary
          ),
          (action: Action) => {
            const description = getActionDescription(action);
            
            // Description should include x and y coordinates
            const hasX = description.includes(String(action.x));
            const hasY = description.includes(String(action.y));
            
            return hasX && hasY;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('click action descriptions include button type', () => {
      fc.assert(
        fc.property(validMouseClickActionArbitrary, (action: Action) => {
          const description = getActionDescription(action);
          
          // Description should include the button type
          return description.includes(action.button || 'left');
        }),
        { numRuns: 100 }
      );
    });

    it('key action descriptions include key name', () => {
      fc.assert(
        fc.property(validKeyPressActionArbitrary, (action: Action) => {
          const description = getActionDescription(action);
          
          // Description should include the key
          return description.includes(action.key || '');
        }),
        { numRuns: 100 }
      );
    });

    it('key type action descriptions include text content', () => {
      fc.assert(
        fc.property(validKeyTypeActionArbitrary, (action: Action) => {
          const description = getActionDescription(action);
          const text = action.text || '';
          
          // For short text, should include full text
          // For long text (>30 chars), should include truncated version
          if (text.length <= 30) {
            return description.includes(text);
          } else {
            return description.includes(text.substring(0, 30)) && description.includes('...');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('all actions in a script can be described', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          // Every action in the script should produce a valid description
          for (const action of script.actions) {
            const description = getActionDescription(action);
            if (typeof description !== 'string' || description.length === 0) {
              return false;
            }
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('action descriptions are deterministic', () => {
      fc.assert(
        fc.property(validActionArbitrary, (action: Action) => {
          // Same action should always produce the same description
          const description1 = getActionDescription(action);
          const description2 = getActionDescription(action);
          
          return description1 === description2;
        }),
        { numRuns: 100 }
      );
    });

    it('key actions with modifiers include modifier information', () => {
      fc.assert(
        fc.property(
          keyArbitrary,
          timestampArbitrary,
          fc.array(fc.constantFrom('ctrl', 'alt', 'shift'), { minLength: 1, maxLength: 3 }),
          (key: string, timestamp: number, modifiers: string[]) => {
            const action: Action = {
              type: 'key_press',
              timestamp,
              key,
              modifiers,
            };
            
            const description = getActionDescription(action);
            
            // Description should include at least one modifier
            return modifiers.some(mod => description.includes(mod));
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
