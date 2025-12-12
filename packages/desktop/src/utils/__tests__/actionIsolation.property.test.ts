/**
 * Property-based tests for action-step isolation
 * Feature: test-case-driven-automation, Property 5: Action-Step Isolation
 * Validates: Requirements 4.4
 */

import * as fc from 'fast-check';
import { 
  updateActionInPool, 
  validateActionIsolation, 
  getStepsReferencingAction,
  actionAffectsMultipleSteps,
  deepCopyScript,
  validateMetadataPreservation
} from '../actionIsolation';
import { TestScript, TestStep, ActionWithId, EnhancedScriptMetadata } from '../../types/testCaseDriven.types';

// Generator for enhanced script metadata
const metadataArbitrary = fc.record({
  version: fc.constant('2.0'),
  created_at: fc.integer({ min: 1577836800000, max: 1924992000000 }).map(timestamp => new Date(timestamp).toISOString()),
  duration: fc.float({ min: 0, max: 3600, noNaN: true }),
  action_count: fc.integer({ min: 0, max: 100 }),
  platform: fc.constantFrom('windows', 'darwin', 'linux'),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.string({ maxLength: 500 }),
  pre_conditions: fc.string({ maxLength: 200 }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
}) as fc.Arbitrary<EnhancedScriptMetadata>;

// Generator for actions (avoiding NaN and problematic values)
const actionArbitrary = fc.record({
  id: fc.uuid(),
  type: fc.constantFrom('mouse_move', 'mouse_click', 'key_press', 'key_release', 'ai_vision_capture'),
  timestamp: fc.float({ min: 0, max: 1000, noNaN: true }),
  x: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 1920 })),
  y: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 1080 })),
  button: fc.oneof(fc.constant(null), fc.constantFrom('left', 'right', 'middle')),
  key: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 10 })),
  screenshot: fc.constant(null),
  is_dynamic: fc.boolean(),
  interaction: fc.constantFrom('click', 'dblclick', 'rclick', 'hover'),
  static_data: fc.constant(undefined),
  dynamic_config: fc.constant(undefined),
  cache_data: fc.constant(undefined),
  is_assertion: fc.boolean(),
}) as fc.Arbitrary<ActionWithId>;

// Generator for test steps
const testStepArbitrary = fc.record({
  id: fc.uuid(),
  order: fc.integer({ min: 1, max: 100 }),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  expected_result: fc.string({ maxLength: 200 }),
  action_ids: fc.array(fc.uuid(), { maxLength: 5 }),
  continue_on_failure: fc.boolean(),
}) as fc.Arbitrary<TestStep>;

// Generator for complete test scripts with consistent references
const testScriptArbitrary = fc.record({
  actions: fc.array(actionArbitrary, { minLength: 1, maxLength: 20 }),
  stepCount: fc.integer({ min: 1, max: 10 }),
}).chain(({ actions, stepCount }) => {
  const actionPool: Record<string, ActionWithId> = {};
  actions.forEach(action => {
    actionPool[action.id] = action;
  });

  const actionIds = Object.keys(actionPool);

  return fc.record({
    meta: metadataArbitrary,
    steps: fc.array(testStepArbitrary, { minLength: stepCount, maxLength: stepCount }).map(steps =>
      steps.map((step, index) => ({
        ...step,
        id: `step_${index}_${Math.random().toString(36).substring(2, 11)}`,
        order: index + 1,
        action_ids: fc.sample(fc.subarray(actionIds, { minLength: 0, maxLength: Math.min(3, actionIds.length) }), 1)[0],
      }))
    ),
    action_pool: fc.constant(actionPool),
    variables: fc.record({}).map(() => ({})),
  });
}) as fc.Arbitrary<TestScript>;

describe('Action-Step Isolation Property Tests', () => {
  /**
   * Property 5: Action-Step Isolation
   * For any action modification within a step, the changes SHALL not affect 
   * the organization or structure of other steps in the script
   */
  test('action modifications preserve step structure', () => {
    fc.assert(
      fc.property(
        testScriptArbitrary,
        actionArbitrary,
        (originalScript, modificationData) => {
          const actionIds = Object.keys(originalScript.action_pool);
          if (actionIds.length === 0) return true;

          // Pick a random action to modify
          const actionToModify = actionIds[0];
          const originalAction = originalScript.action_pool[actionToModify];

          // Create a modified version of the action
          const modifiedAction: ActionWithId = {
            ...originalAction,
            ...modificationData,
            id: actionToModify, // Preserve the ID
            timestamp: modificationData.timestamp, // Use new timestamp
          };

          // Update the action in the pool
          const modifiedScript = updateActionInPool(originalScript, actionToModify, modifiedAction);

          // Validate that isolation is maintained
          expect(validateActionIsolation(originalScript, modifiedScript, actionToModify)).toBe(true);

          // Validate that metadata is preserved
          expect(validateMetadataPreservation(originalScript, modifiedScript)).toBe(true);

          // Check that step structure is exactly the same
          expect(modifiedScript.steps.length).toBe(originalScript.steps.length);
          
          for (let i = 0; i < originalScript.steps.length; i++) {
            const originalStep = originalScript.steps[i];
            const modifiedStep = modifiedScript.steps[i];

            expect(modifiedStep.id).toBe(originalStep.id);
            expect(modifiedStep.order).toBe(originalStep.order);
            expect(modifiedStep.description).toBe(originalStep.description);
            expect(modifiedStep.expected_result).toBe(originalStep.expected_result);
            expect(modifiedStep.continue_on_failure).toBe(originalStep.continue_on_failure);
            expect(modifiedStep.action_ids).toEqual(originalStep.action_ids);
          }

          // Check that only the target action was modified
          for (const actionId of Object.keys(originalScript.action_pool)) {
            if (actionId !== actionToModify) {
              expect(modifiedScript.action_pool[actionId]).toEqual(originalScript.action_pool[actionId]);
            } else {
              expect(modifiedScript.action_pool[actionId]).toEqual(modifiedAction);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Action pool size remains constant
   * Modifying an action should not change the number of actions in the pool
   */
  test('action pool size remains constant after modification', () => {
    fc.assert(
      fc.property(
        testScriptArbitrary,
        actionArbitrary,
        (originalScript, modificationData) => {
          const actionIds = Object.keys(originalScript.action_pool);
          if (actionIds.length === 0) return true;

          const actionToModify = actionIds[0];
          const modifiedAction: ActionWithId = {
            ...originalScript.action_pool[actionToModify],
            ...modificationData,
            id: actionToModify,
          };

          const modifiedScript = updateActionInPool(originalScript, actionToModify, modifiedAction);

          expect(Object.keys(modifiedScript.action_pool).length).toBe(
            Object.keys(originalScript.action_pool).length
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Steps referencing action detection
   * The function should correctly identify all steps that reference a given action
   */
  test('steps referencing action are correctly identified', () => {
    fc.assert(
      fc.property(
        testScriptArbitrary,
        (script) => {
          for (const actionId of Object.keys(script.action_pool)) {
            const referencingSteps = getStepsReferencingAction(script, actionId);

            // Check that all returned steps actually reference the action
            for (const step of referencingSteps) {
              expect(step.action_ids.includes(actionId)).toBe(true);
            }

            // Check that all steps referencing the action are included
            for (const step of script.steps) {
              const shouldBeIncluded = step.action_ids.includes(actionId);
              const isIncluded = referencingSteps.some(s => s.id === step.id);
              expect(isIncluded).toBe(shouldBeIncluded);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Multiple step detection accuracy
   * The function should correctly identify when an action affects multiple steps
   */
  test('multiple step detection is accurate', () => {
    fc.assert(
      fc.property(
        testScriptArbitrary,
        (script) => {
          for (const actionId of Object.keys(script.action_pool)) {
            const referencingSteps = getStepsReferencingAction(script, actionId);
            const affectsMultiple = actionAffectsMultipleSteps(script, actionId);

            expect(affectsMultiple).toBe(referencingSteps.length > 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Deep copy creates independent script
   * Deep copying should create a completely independent script
   */
  test('deep copy creates independent script', () => {
    fc.assert(
      fc.property(
        testScriptArbitrary,
        (originalScript) => {
          const copiedScript = deepCopyScript(originalScript);

          // Scripts should be equal but not the same reference
          expect(copiedScript).toEqual(originalScript);
          expect(copiedScript).not.toBe(originalScript);

          // Modifying the copy should not affect the original
          if (Object.keys(copiedScript.action_pool).length > 0) {
            const actionId = Object.keys(copiedScript.action_pool)[0];
            const modifiedAction: ActionWithId = {
              ...copiedScript.action_pool[actionId],
              timestamp: 999999,
            };

            copiedScript.action_pool[actionId] = modifiedAction;

            // Original should be unchanged
            expect(originalScript.action_pool[actionId].timestamp).not.toBe(999999);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Action ID preservation
   * Updating an action should preserve its ID regardless of modification data
   */
  test('action ID is preserved during updates', () => {
    fc.assert(
      fc.property(
        testScriptArbitrary,
        actionArbitrary,
        (originalScript, modificationData) => {
          const actionIds = Object.keys(originalScript.action_pool);
          if (actionIds.length === 0) return true;

          const actionToModify = actionIds[0];
          
          // Try to modify with different ID in the modification data
          const modifiedAction: ActionWithId = {
            ...modificationData,
            id: 'different-id-that-should-be-ignored',
          };

          const modifiedScript = updateActionInPool(originalScript, actionToModify, modifiedAction);

          // The action should still have the original ID
          expect(modifiedScript.action_pool[actionToModify].id).toBe(actionToModify);
          expect(modifiedScript.action_pool[actionToModify].id).not.toBe('different-id-that-should-be-ignored');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Metadata and variables isolation
   * Action modifications should not affect script metadata or variables
   */
  test('metadata and variables remain isolated from action changes', () => {
    fc.assert(
      fc.property(
        testScriptArbitrary,
        actionArbitrary,
        (originalScript, modificationData) => {
          const actionIds = Object.keys(originalScript.action_pool);
          if (actionIds.length === 0) return true;

          const actionToModify = actionIds[0];
          const modifiedAction: ActionWithId = {
            ...originalScript.action_pool[actionToModify],
            ...modificationData,
            id: actionToModify,
          };

          const modifiedScript = updateActionInPool(originalScript, actionToModify, modifiedAction);

          // Metadata should be completely unchanged
          expect(modifiedScript.meta).toEqual(originalScript.meta);
          expect(modifiedScript.meta).not.toBe(originalScript.meta); // Different reference due to spread

          // Variables should be completely unchanged
          expect(modifiedScript.variables).toEqual(originalScript.variables);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Non-existent action handling
   * Attempting to update a non-existent action should handle gracefully
   */
  test('non-existent action updates are handled gracefully', () => {
    fc.assert(
      fc.property(
        testScriptArbitrary,
        actionArbitrary,
        (originalScript, modificationData) => {
          const nonExistentActionId = 'non-existent-action-id';
          
          // Ensure this ID doesn't exist
          if (originalScript.action_pool[nonExistentActionId]) {
            return true; // Skip this test case
          }

          const modifiedScript = updateActionInPool(originalScript, nonExistentActionId, {
            ...modificationData,
            id: nonExistentActionId,
          });

          // The new action should be added to the pool
          expect(modifiedScript.action_pool[nonExistentActionId]).toBeDefined();
          expect(modifiedScript.action_pool[nonExistentActionId].id).toBe(nonExistentActionId);

          // All original actions should still exist
          for (const actionId of Object.keys(originalScript.action_pool)) {
            expect(modifiedScript.action_pool[actionId]).toEqual(originalScript.action_pool[actionId]);
          }

          // Step structure should be preserved
          expect(modifiedScript.steps).toEqual(originalScript.steps);
        }
      ),
      { numRuns: 100 }
    );
  });
});
