/**
 * Property-Based Tests for Script Validation Service
 * 
 * Tests correctness properties for script validation, ensuring
 * generated scripts are valid and compatible with rust-core.
 */

import * as fc from 'fast-check';
import {
  validateScript,
  validateAction,
  checkCompatibility,
  serializeScript,
  deserializeScript,
  VALID_MOUSE_BUTTONS,
  VALID_PLATFORMS,
  VALID_CORE_TYPES,
  DEFAULT_SCREEN_BOUNDS,
} from '../scriptValidationService';
import {
  ScriptData,
  Action,
  ActionType,
  ScriptMetadata,
  AVAILABLE_ACTION_TYPES,
} from '../../types/aiScriptBuilder.types';

// ============================================================================
// Arbitraries (Generators) for Script Data
// ============================================================================

/**
 * Generate a valid action type
 */
const actionTypeArbitrary = fc.constantFrom(...AVAILABLE_ACTION_TYPES);

/**
 * Generate a valid mouse button
 */
const mouseButtonArbitrary = fc.constantFrom(...VALID_MOUSE_BUTTONS);

/**
 * Generate valid screen coordinates
 */
const validCoordinateArbitrary = fc.integer({
  min: DEFAULT_SCREEN_BOUNDS.minX,
  max: Math.min(DEFAULT_SCREEN_BOUNDS.maxX, 4096), // Reasonable max for testing
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
 * Generate a valid mouse action (mouse_move, mouse_click, etc.)
 */
const validMouseMoveActionArbitrary: fc.Arbitrary<Action> = fc.record({
  type: fc.constant('mouse_move' as ActionType),
  timestamp: timestampArbitrary,
  x: validCoordinateArbitrary,
  y: validCoordinateArbitrary,
});

const validMouseClickActionArbitrary: fc.Arbitrary<Action> = fc.record({
  type: fc.constantFrom('mouse_click', 'mouse_double_click') as fc.Arbitrary<ActionType>,
  timestamp: timestampArbitrary,
  x: validCoordinateArbitrary,
  y: validCoordinateArbitrary,
  button: mouseButtonArbitrary,
});

/**
 * Generate a valid keyboard action
 */
const validKeyPressActionArbitrary: fc.Arbitrary<Action> = keyArbitrary.chain(key =>
  fc.record({
    type: fc.constantFrom('key_press', 'key_release') as fc.Arbitrary<ActionType>,
    timestamp: timestampArbitrary,
    key: fc.constant(key),
  })
);

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
 * Generate any valid action
 */
const validActionArbitrary: fc.Arbitrary<Action> = fc.oneof(
  validMouseMoveActionArbitrary,
  validMouseClickActionArbitrary,
  validKeyPressActionArbitrary,
  validKeyTypeActionArbitrary,
  validWaitActionArbitrary
);

/**
 * Generate a valid ISO date string
 */
const isoDateArbitrary = fc.tuple(
  fc.integer({ min: 2020, max: 2030 }), // year
  fc.integer({ min: 1, max: 12 }),      // month
  fc.integer({ min: 1, max: 28 }),      // day (use 28 to avoid month-end issues)
  fc.integer({ min: 0, max: 23 }),      // hour
  fc.integer({ min: 0, max: 59 }),      // minute
  fc.integer({ min: 0, max: 59 })       // second
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
  .array(validActionArbitrary, { minLength: 0, maxLength: 20 })
  .map(actions => {
    // Sort actions by timestamp to ensure ascending order
    const sortedActions = [...actions].sort((a, b) => a.timestamp - b.timestamp);
    // Reassign timestamps to ensure strict ordering
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

describe('Script Validation Service Property Tests', () => {
  /**
   * **Feature: ai-script-builder, Property 5: Generated Script Validity**
   * **Validates: Requirements 3.3, 6.1, 6.2, 6.3, 6.4**
   * 
   * For any script generated by the AI, the script should pass validation
   * against the rust-core schema, including: valid action types, valid
   * coordinates for mouse actions, valid key codes for keyboard actions,
   * and timestamps in ascending order.
   */
  describe('Property 5: Generated Script Validity', () => {
    it('valid scripts pass validation', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          const result = validateScript(script);
          
          // A well-formed script should have no errors
          if (!result.valid) {
            console.log('Validation errors:', result.errors);
          }
          return result.valid === true && result.errors.length === 0;
        }),
        { numRuns: 100 }
      );
    });

    it('valid scripts are compatible with rust-core', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          const result = checkCompatibility(script);
          
          // A well-formed script should be compatible
          if (!result.compatible) {
            console.log('Compatibility issues:', result.issues);
          }
          return result.compatible === true && result.issues.length === 0;
        }),
        { numRuns: 100 }
      );
    });

    it('mouse actions with valid coordinates pass validation', () => {
      fc.assert(
        fc.property(
          validCoordinateArbitrary,
          validCoordinateArbitrary,
          timestampArbitrary,
          (x: number, y: number, timestamp: number) => {
            const action: Action = {
              type: 'mouse_click',
              timestamp,
              x,
              y,
              button: 'left',
            };
            
            const result = validateAction(action);
            return result.valid === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('keyboard actions with valid keys pass validation', () => {
      fc.assert(
        fc.property(
          keyArbitrary,
          timestampArbitrary,
          (key: string, timestamp: number) => {
            const action: Action = {
              type: 'key_press',
              timestamp,
              key,
            };
            
            const result = validateAction(action);
            return result.valid === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('scripts with ascending timestamps pass validation', () => {
      fc.assert(
        fc.property(
          fc.array(timestampArbitrary, { minLength: 2, maxLength: 10 }),
          (timestamps: number[]) => {
            // Sort timestamps to ensure ascending order
            const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
            
            const actions: Action[] = sortedTimestamps.map(ts => ({
              type: 'wait' as ActionType,
              timestamp: ts,
            }));
            
            const script: ScriptData = {
              version: '1.0',
              metadata: {
                created_at: new Date().toISOString(),
                duration: sortedTimestamps[sortedTimestamps.length - 1],
                action_count: actions.length,
                core_type: 'rust',
                platform: 'macos',
              },
              actions,
            };
            
            const result = validateScript(script);
            // Should not have timestamp ordering errors
            const hasTimestampError = result.errors.some(e => 
              e.message.includes('ascending order')
            );
            return !hasTimestampError;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: ai-script-builder, Property 6: Script Modification Validation**
   * **Validates: Requirements 4.2**
   * 
   * For any user modification to a script action, the validation service
   * should immediately check the modification and return a validation result.
   */
  describe('Property 6: Script Modification Validation', () => {
    it('any action modification produces a validation result', () => {
      fc.assert(
        fc.property(validActionArbitrary, (action: Action) => {
          const result = validateAction(action);
          
          // Result should always have the expected structure
          return (
            typeof result.valid === 'boolean' &&
            Array.isArray(result.errors) &&
            Array.isArray(result.warnings)
          );
        }),
        { numRuns: 100 }
      );
    });

    it('modifying valid action to invalid produces errors', () => {
      fc.assert(
        fc.property(validMouseClickActionArbitrary, (action: Action) => {
          // Remove required field to make it invalid
          const invalidAction = { ...action, button: undefined };
          
          const result = validateAction(invalidAction);
          
          // Should have validation error for missing button
          return result.valid === false && result.errors.length > 0;
        }),
        { numRuns: 100 }
      );
    });

    it('modifying coordinates produces immediate validation', () => {
      fc.assert(
        fc.property(
          validMouseMoveActionArbitrary,
          fc.integer({ min: -1000, max: 10000 }),
          fc.integer({ min: -1000, max: 10000 }),
          (action: Action, newX: number, newY: number) => {
            const modifiedAction = { ...action, x: newX, y: newY };
            const result = validateAction(modifiedAction);
            
            // Should always return a result
            return typeof result.valid === 'boolean';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('validation detects invalid action types', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          timestampArbitrary,
          (invalidType: string, timestamp: number) => {
            // Skip if accidentally generated a valid type
            if (AVAILABLE_ACTION_TYPES.includes(invalidType as ActionType)) {
              return true;
            }
            
            const action = {
              type: invalidType as ActionType,
              timestamp,
            };
            
            const result = validateAction(action);
            
            // Should detect invalid action type
            return result.valid === false && 
              result.errors.some(e => e.field === 'type');
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: ai-script-builder, Property 7: Script Serialization Round-Trip**
   * **Validates: Requirements 4.3, 6.5**
   * 
   * For any valid ScriptData object, serializing to JSON and deserializing
   * back should produce an equivalent ScriptData object.
   */
  describe('Property 7: Script Serialization Round-Trip', () => {
    it('serialize then deserialize returns equivalent script', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          const serialized = serializeScript(script);
          const deserialized = deserializeScript(serialized);
          
          // Check structural equality
          return (
            deserialized.version === script.version &&
            deserialized.metadata.core_type === script.metadata.core_type &&
            deserialized.metadata.platform === script.metadata.platform &&
            deserialized.metadata.action_count === script.metadata.action_count &&
            deserialized.actions.length === script.actions.length
          );
        }),
        { numRuns: 100 }
      );
    });

    it('serialized script is valid JSON', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          const serialized = serializeScript(script);
          
          // Should not throw when parsing
          try {
            JSON.parse(serialized);
            return true;
          } catch {
            return false;
          }
        }),
        { numRuns: 100 }
      );
    });

    it('round-trip preserves all action data', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          const serialized = serializeScript(script);
          const deserialized = deserializeScript(serialized);
          
          // Check each action
          for (let i = 0; i < script.actions.length; i++) {
            const original = script.actions[i];
            const restored = deserialized.actions[i];
            
            if (original.type !== restored.type) return false;
            if (original.timestamp !== restored.timestamp) return false;
            if (original.x !== restored.x) return false;
            if (original.y !== restored.y) return false;
            if (original.button !== restored.button) return false;
            if (original.key !== restored.key) return false;
            if (original.text !== restored.text) return false;
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('deserialized script passes validation if original did', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          const originalValidation = validateScript(script);
          
          const serialized = serializeScript(script);
          const deserialized = deserializeScript(serialized);
          const deserializedValidation = validateScript(deserialized);
          
          // If original was valid, deserialized should also be valid
          if (originalValidation.valid) {
            return deserializedValidation.valid === true;
          }
          return true; // Skip if original wasn't valid
        }),
        { numRuns: 100 }
      );
    });

    it('double round-trip produces same result', () => {
      fc.assert(
        fc.property(validScriptArbitrary, (script: ScriptData) => {
          // First round-trip
          const serialized1 = serializeScript(script);
          const deserialized1 = deserializeScript(serialized1);
          
          // Second round-trip
          const serialized2 = serializeScript(deserialized1);
          const deserialized2 = deserializeScript(serialized2);
          
          // Both serialized forms should be identical
          return serialized1 === serialized2;
        }),
        { numRuns: 100 }
      );
    });
  });
});
