/**
 * Property-Based Tests for OS-Specific Key Code Validation
 * 
 * Tests that generated scripts with a target OS only use key codes valid for that OS.
 * Universal scripts should only contain cross-platform compatible actions.
 * 
 * **Feature: ai-script-builder, Property 13: OS-Specific Key Code Validation**
 * **Validates: Requirements 8.3, 8.4, 8.5**
 */

import * as fc from 'fast-check';
import {
    Action,
    ScriptData,
    ScriptMetadata
} from '../../types/aiScriptBuilder.types';
import { isValidKeyForOS } from '../../utils/osKeyMappings';
import { TargetOS } from '../scriptStorageService';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a valid target OS
 */
const targetOSArbitrary: fc.Arbitrary<TargetOS> = fc.constantFrom(
  'macos',
  'windows',
  'universal'
);

/**
 * Generate macOS-specific key codes
 * Only includes keys that are valid according to isValidKeyForOS
 */
const macosKeyArbitrary: fc.Arbitrary<string> = fc.oneof(
  // Common keys
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'),
  // Numbers
  fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
  // Special keys
  fc.constantFrom('enter', 'return', 'tab', 'space', 'backspace', 'delete', 'escape'),
  // Arrow keys
  fc.constantFrom('up', 'down', 'left', 'right'),
  // Function keys
  fc.constantFrom('f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'),
  // Navigation keys
  fc.constantFrom('home', 'end', 'pageup', 'pagedown')
);

/**
 * Generate Windows-specific key codes
 * Only includes keys that are valid according to isValidKeyForOS
 */
const windowsKeyArbitrary: fc.Arbitrary<string> = fc.oneof(
  // Common keys
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'),
  // Numbers
  fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
  // Special keys
  fc.constantFrom('enter', 'return', 'tab', 'space', 'backspace', 'delete', 'escape'),
  // Arrow keys
  fc.constantFrom('up', 'down', 'left', 'right'),
  // Function keys (Windows has more function keys)
  fc.constantFrom('f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'),
  // Navigation keys
  fc.constantFrom('home', 'end', 'pageup', 'pagedown'),
  // Windows-specific keys
  fc.constantFrom('printscreen')
);

/**
 * Generate universal/cross-platform key codes
 */
const universalKeyArbitrary: fc.Arbitrary<string> = fc.oneof(
  // Common alphanumeric keys
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'),
  fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
  // Universal special keys
  fc.constantFrom('enter', 'return', 'tab', 'space', 'backspace', 'delete', 'escape'),
  // Arrow keys (universal)
  fc.constantFrom('up', 'down', 'left', 'right'),
  // Common function keys
  fc.constantFrom('f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'),
  // Navigation keys
  fc.constantFrom('home', 'end', 'pageup', 'pagedown'),
  // Universal action keys (these are cross-platform compatible)
  fc.constantFrom('copy', 'paste', 'cut', 'selectall', 'save', 'undo', 'redo',
    'find', 'findreplace', 'new', 'open', 'close', 'quit', 'print',
    'bold', 'italic', 'underline', 'refresh', 'zoomin', 'zoomout', 'zoomreset',
    'fullscreen', 'minimize', 'switchapp', 'switchwindow', 'screenshot',
    'screenshotregion', 'forcequit')
);

/**
 * Generate modifiers appropriate for a target OS
 */
const modifiersForOSArbitrary = (os: TargetOS): fc.Arbitrary<string[]> => {
  switch (os) {
    case 'macos':
      return fc.array(
        fc.constantFrom('meta', 'ctrl', 'alt', 'shift'),
        { minLength: 0, maxLength: 3 }
      ).map(arr => Array.from(new Set(arr))); // Remove duplicates
    case 'windows':
      return fc.array(
        fc.constantFrom('ctrl', 'alt', 'shift', 'meta'),
        { minLength: 0, maxLength: 3 }
      ).map(arr => Array.from(new Set(arr)));
    case 'universal':
      return fc.array(
        fc.constantFrom('primary', 'shift', 'alt'),
        { minLength: 0, maxLength: 2 }
      ).map(arr => Array.from(new Set(arr)));
  }
};

/**
 * Generate a keyboard action for a specific OS
 */
const keyboardActionForOSArbitrary = (os: TargetOS, timestamp: number): fc.Arbitrary<Action> => {
  const keyArbitrary = os === 'macos' ? macosKeyArbitrary :
                       os === 'windows' ? windowsKeyArbitrary :
                       universalKeyArbitrary;

  return fc.record({
    type: fc.constantFrom('key_press' as const, 'key_release' as const),
    timestamp: fc.constant(timestamp),
    key: keyArbitrary,
    modifiers: modifiersForOSArbitrary(os),
  });
};

/**
 * Generate a non-keyboard action (mouse, wait, etc.)
 */
const nonKeyboardActionArbitrary = (timestamp: number): fc.Arbitrary<Action> => {
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
    // Wait
    fc.record({
      type: fc.constant('wait' as const),
      timestamp: fc.constant(timestamp),
    }),
    // Key type (text input, not key codes)
    fc.record({
      type: fc.constant('key_type' as const),
      timestamp: fc.constant(timestamp),
      text: fc.string({ minLength: 1, maxLength: 50 }),
    })
  );
};

/**
 * Generate a script metadata with target OS
 */
const scriptMetadataWithOSArbitrary = (os: TargetOS, actionCount: number, duration: number): fc.Arbitrary<ScriptMetadata> => {
  return fc.record({
    created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map(d => d.toISOString()),
    duration: fc.constant(duration),
    action_count: fc.constant(actionCount),
    core_type: fc.constant('rust'),
    platform: fc.constant(os === 'macos' ? 'macos' : os === 'windows' ? 'windows' : 'universal'),
    target_os: fc.constant(os),
    source: fc.constant('ai_generated' as const),
  });
};

/**
 * Generate a script with OS-appropriate keyboard actions
 */
const scriptWithOSArbitrary: fc.Arbitrary<{ script: ScriptData; targetOS: TargetOS }> = fc
  .tuple(
    targetOSArbitrary,
    fc.integer({ min: 1, max: 20 })
  )
  .chain(([os, actionCount]) => {
    // Generate a mix of keyboard and non-keyboard actions
    const keyboardActionCount = Math.floor(actionCount * 0.6); // 60% keyboard actions
    const nonKeyboardActionCount = actionCount - keyboardActionCount;

    // Generate timestamps in ascending order
    const timestamps = Array.from({ length: actionCount }, (_, i) => i * 0.5);

    // Generate keyboard actions
    const keyboardActionsArb = fc.array(
      fc.integer({ min: 0, max: actionCount - 1 }).chain(idx =>
        keyboardActionForOSArbitrary(os, timestamps[idx])
      ),
      { minLength: keyboardActionCount, maxLength: keyboardActionCount }
    );

    // Generate non-keyboard actions
    const nonKeyboardActionsArb = fc.array(
      fc.integer({ min: 0, max: actionCount - 1 }).chain(idx =>
        nonKeyboardActionArbitrary(timestamps[idx])
      ),
      { minLength: nonKeyboardActionCount, maxLength: nonKeyboardActionCount }
    );

    return fc.tuple(
      fc.constant(os),
      keyboardActionsArb,
      nonKeyboardActionsArb
    ).map(([targetOS, keyboardActions, nonKeyboardActions]) => {
      const allActions = [...keyboardActions, ...nonKeyboardActions];
      // Sort by timestamp
      allActions.sort((a, b) => a.timestamp - b.timestamp);

      const duration = allActions.length > 0 ? allActions[allActions.length - 1].timestamp : 0;

      return {
        script: {
          version: '1.0',
          metadata: {
            created_at: new Date().toISOString(),
            duration,
            action_count: allActions.length,
            core_type: 'rust',
            platform: targetOS === 'macos' ? 'macos' : targetOS === 'windows' ? 'windows' : 'universal',
            target_os: targetOS,
            source: 'ai_generated' as const,
          },
          actions: allActions,
        },
        targetOS,
      };
    });
  });

/**
 * Generate a script with INVALID key codes for the target OS
 * (for negative testing)
 */
const scriptWithInvalidKeysArbitrary: fc.Arbitrary<{ script: ScriptData; targetOS: TargetOS }> = fc
  .tuple(
    targetOSArbitrary,
    fc.integer({ min: 1, max: 10 })
  )
  .chain(([os, actionCount]) => {
    // Generate invalid keys for the target OS
    const invalidKeyArb = fc.string({ minLength: 1, maxLength: 20 })
      .filter(key => !isValidKeyForOS(key, os));

    const timestamps = Array.from({ length: actionCount }, (_, i) => i * 0.5);

    const invalidActionsArb = fc.array(
      fc.integer({ min: 0, max: actionCount - 1 }).chain(idx =>
        fc.record({
          type: fc.constant('key_press' as const),
          timestamp: fc.constant(timestamps[idx]),
          key: invalidKeyArb,
          modifiers: modifiersForOSArbitrary(os),
        })
      ),
      { minLength: actionCount, maxLength: actionCount }
    );

    return fc.tuple(
      fc.constant(os),
      invalidActionsArb
    ).map(([targetOS, actions]) => {
      actions.sort((a, b) => a.timestamp - b.timestamp);
      const duration = actions.length > 0 ? actions[actions.length - 1].timestamp : 0;

      return {
        script: {
          version: '1.0',
          metadata: {
            created_at: new Date().toISOString(),
            duration,
            action_count: actions.length,
            core_type: 'rust',
            platform: targetOS === 'macos' ? 'macos' : targetOS === 'windows' ? 'windows' : 'universal',
            target_os: targetOS,
            source: 'ai_generated' as const,
          },
          actions,
        },
        targetOS,
      };
    });
  });

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract all keyboard actions from a script
 */
function getKeyboardActions(script: ScriptData): Action[] {
  return script.actions.filter(
    action => action.type === 'key_press' || action.type === 'key_release'
  );
}

/**
 * Check if all keyboard actions in a script use valid keys for the target OS
 */
function allKeysValidForOS(script: ScriptData, targetOS: TargetOS): boolean {
  const keyboardActions = getKeyboardActions(script);
  
  if (keyboardActions.length === 0) {
    return true; // No keyboard actions, so vacuously true
  }

  return keyboardActions.every(action => {
    if (!action.key) {
      return false; // Invalid action without key
    }
    return isValidKeyForOS(action.key, targetOS);
  });
}

/**
 * Get invalid keys from a script for a target OS
 */
function getInvalidKeys(script: ScriptData, targetOS: TargetOS): string[] {
  const keyboardActions = getKeyboardActions(script);
  const invalidKeys: string[] = [];

  for (const action of keyboardActions) {
    if (action.key && !isValidKeyForOS(action.key, targetOS)) {
      invalidKeys.push(action.key);
    }
  }

  return invalidKeys;
}

// ============================================================================
// Property Tests
// ============================================================================

describe('OS-Specific Key Code Validation Property Tests', () => {
  /**
   * **Feature: ai-script-builder, Property 13: OS-Specific Key Code Validation**
   * **Validates: Requirements 8.3, 8.4, 8.5**
   * 
   * For any generated script with a target OS, all keyboard actions SHALL use
   * key codes valid for that OS. Universal scripts SHALL only contain
   * cross-platform compatible actions.
   */
  describe('Property 13: OS-Specific Key Code Validation', () => {
    it('all keyboard actions use valid key codes for target OS', () => {
      fc.assert(
        fc.property(
          scriptWithOSArbitrary,
          ({ script, targetOS }) => {
            return allKeysValidForOS(script, targetOS);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('macOS scripts only use macOS-compatible key codes', () => {
      fc.assert(
        fc.property(
          scriptWithOSArbitrary.filter(({ targetOS }) => targetOS === 'macos'),
          ({ script }) => {
            const keyboardActions = getKeyboardActions(script);
            return keyboardActions.every(action => 
              action.key && isValidKeyForOS(action.key, 'macos')
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Windows scripts only use Windows-compatible key codes', () => {
      fc.assert(
        fc.property(
          scriptWithOSArbitrary.filter(({ targetOS }) => targetOS === 'windows'),
          ({ script }) => {
            const keyboardActions = getKeyboardActions(script);
            return keyboardActions.every(action => 
              action.key && isValidKeyForOS(action.key, 'windows')
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Universal scripts only use cross-platform compatible key codes', () => {
      fc.assert(
        fc.property(
          scriptWithOSArbitrary.filter(({ targetOS }) => targetOS === 'universal'),
          ({ script }) => {
            const keyboardActions = getKeyboardActions(script);
            return keyboardActions.every(action => 
              action.key && isValidKeyForOS(action.key, 'universal')
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('scripts with no keyboard actions are valid for any OS', () => {
      fc.assert(
        fc.property(
          targetOSArbitrary,
          fc.integer({ min: 1, max: 10 }),
          (targetOS, actionCount) => {
            const timestamps = Array.from({ length: actionCount }, (_, i) => i * 0.5);
            const actions = timestamps.map((ts, idx) => ({
              type: 'mouse_click' as const,
              timestamp: ts,
              x: 100 + idx * 10,
              y: 100 + idx * 10,
              button: 'left' as const,
            }));

            const script: ScriptData = {
              version: '1.0',
              metadata: {
                created_at: new Date().toISOString(),
                duration: actions[actions.length - 1].timestamp,
                action_count: actions.length,
                core_type: 'rust',
                platform: targetOS,
                target_os: targetOS,
                source: 'ai_generated' as const,
              },
              actions,
            };

            return allKeysValidForOS(script, targetOS);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('key validation is case-insensitive', () => {
      fc.assert(
        fc.property(
          targetOSArbitrary,
          fc.constantFrom('a', 'b', 'c', 'enter', 'escape', 'tab'),
          (targetOS, baseKey) => {
            const upperKey = baseKey.toUpperCase();
            const lowerKey = baseKey.toLowerCase();

            // Both upper and lower case should have same validity
            return isValidKeyForOS(upperKey, targetOS) === isValidKeyForOS(lowerKey, targetOS);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('common alphanumeric keys are valid for all OS types', () => {
      fc.assert(
        fc.property(
          targetOSArbitrary,
          fc.constantFrom('a', 'b', 'c', 'x', 'y', 'z', '0', '1', '2', '9'),
          (targetOS, key) => {
            return isValidKeyForOS(key, targetOS);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('common special keys are valid for all OS types', () => {
      fc.assert(
        fc.property(
          targetOSArbitrary,
          fc.constantFrom('enter', 'return', 'tab', 'space', 'backspace', 'delete', 'escape'),
          (targetOS, key) => {
            return isValidKeyForOS(key, targetOS);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('arrow keys are valid for all OS types', () => {
      fc.assert(
        fc.property(
          targetOSArbitrary,
          fc.constantFrom('up', 'down', 'left', 'right'),
          (targetOS, key) => {
            return isValidKeyForOS(key, targetOS);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('function keys are valid for all OS types', () => {
      fc.assert(
        fc.property(
          targetOSArbitrary,
          fc.constantFrom('f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'),
          (targetOS, key) => {
            return isValidKeyForOS(key, targetOS);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('modifiers are appropriate for target OS', () => {
      fc.assert(
        fc.property(
          scriptWithOSArbitrary,
          ({ script, targetOS }) => {
            const keyboardActions = getKeyboardActions(script);
            
            for (const action of keyboardActions) {
              if (action.modifiers && action.modifiers.length > 0) {
                // Check that modifiers are appropriate for the OS
                if (targetOS === 'macos') {
                  // macOS can use meta, ctrl, alt, shift
                  const validModifiers = ['meta', 'ctrl', 'alt', 'shift'];
                  if (!action.modifiers.every(m => validModifiers.includes(m))) {
                    return false;
                  }
                } else if (targetOS === 'windows') {
                  // Windows can use ctrl, alt, shift, meta (Win key)
                  const validModifiers = ['ctrl', 'alt', 'shift', 'meta'];
                  if (!action.modifiers.every(m => validModifiers.includes(m))) {
                    return false;
                  }
                } else if (targetOS === 'universal') {
                  // Universal uses generic modifiers
                  const validModifiers = ['primary', 'shift', 'alt'];
                  if (!action.modifiers.every(m => validModifiers.includes(m))) {
                    return false;
                  }
                }
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('scripts with target_os metadata match validation OS', () => {
      fc.assert(
        fc.property(
          scriptWithOSArbitrary,
          ({ script, targetOS }) => {
            // The script's metadata target_os should match the validation OS
            return script.metadata.target_os === targetOS;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('key validation is deterministic', () => {
      fc.assert(
        fc.property(
          targetOSArbitrary,
          fc.string({ minLength: 1, maxLength: 20 }),
          (targetOS, key) => {
            const result1 = isValidKeyForOS(key, targetOS);
            const result2 = isValidKeyForOS(key, targetOS);
            return result1 === result2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('empty key string is invalid for all OS types', () => {
      fc.assert(
        fc.property(
          targetOSArbitrary,
          (targetOS) => {
            return !isValidKeyForOS('', targetOS);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('scripts maintain timestamp ordering regardless of key validity', () => {
      fc.assert(
        fc.property(
          scriptWithOSArbitrary,
          ({ script }) => {
            const actions = script.actions;
            if (actions.length <= 1) {
              return true;
            }

            for (let i = 1; i < actions.length; i++) {
              if (actions[i].timestamp < actions[i - 1].timestamp) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('non-keyboard actions do not affect key validation', () => {
      fc.assert(
        fc.property(
          scriptWithOSArbitrary,
          ({ script, targetOS }) => {
            // Filter to only keyboard actions for validation
            const keyboardActions = getKeyboardActions(script);
            const nonKeyboardActions = script.actions.filter(
              a => a.type !== 'key_press' && a.type !== 'key_release'
            );

            // Non-keyboard actions should not affect validation
            return keyboardActions.every(action =>
              action.key && isValidKeyForOS(action.key, targetOS)
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional validation tests for edge cases
   */
  describe('Edge Cases and Boundary Conditions', () => {
    it('handles scripts with only one keyboard action', () => {
      fc.assert(
        fc.property(
          targetOSArbitrary,
          (targetOS) => {
            const keyArb = targetOS === 'macos' ? macosKeyArbitrary :
                          targetOS === 'windows' ? windowsKeyArbitrary :
                          universalKeyArbitrary;

            return fc.assert(
              fc.property(
                keyArb,
                (key) => {
                  const script: ScriptData = {
                    version: '1.0',
                    metadata: {
                      created_at: new Date().toISOString(),
                      duration: 0,
                      action_count: 1,
                      core_type: 'rust',
                      platform: targetOS,
                      target_os: targetOS,
                      source: 'ai_generated' as const,
                    },
                    actions: [{
                      type: 'key_press',
                      timestamp: 0,
                      key,
                    }],
                  };

                  return allKeysValidForOS(script, targetOS);
                }
              ),
              { numRuns: 20 }
            );
          }
        ),
        { numRuns: 10 }
      );
    });

    it('handles scripts with mixed action types', () => {
      fc.assert(
        fc.property(
          scriptWithOSArbitrary,
          ({ script, targetOS }) => {
            const actionTypes = new Set(script.actions.map(a => a.type));
            
            // If script has multiple action types, validation should still work
            if (actionTypes.size > 1) {
              return allKeysValidForOS(script, targetOS);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles scripts with many keyboard actions', () => {
      fc.assert(
        fc.property(
          targetOSArbitrary,
          fc.integer({ min: 50, max: 100 }),
          (targetOS, actionCount) => {
            const keyArb = targetOS === 'macos' ? macosKeyArbitrary :
                          targetOS === 'windows' ? windowsKeyArbitrary :
                          universalKeyArbitrary;

            return fc.assert(
              fc.property(
                fc.array(keyArb, { minLength: actionCount, maxLength: actionCount }),
                (keys) => {
                  const actions = keys.map((key, idx) => ({
                    type: 'key_press' as const,
                    timestamp: idx * 0.1,
                    key,
                  }));

                  const script: ScriptData = {
                    version: '1.0',
                    metadata: {
                      created_at: new Date().toISOString(),
                      duration: actions[actions.length - 1].timestamp,
                      action_count: actions.length,
                      core_type: 'rust',
                      platform: targetOS,
                      target_os: targetOS,
                      source: 'ai_generated' as const,
                    },
                    actions,
                  };

                  return allKeysValidForOS(script, targetOS);
                }
              ),
              { numRuns: 10 }
            );
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
