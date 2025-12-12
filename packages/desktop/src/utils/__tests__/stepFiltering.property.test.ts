/**
 * Property-based tests for step selection filtering
 * Feature: test-case-driven-automation, Property 6: Step Selection Filtering
 * Validates: Requirements 4.2
 */

import * as fc from 'fast-check';
import { 
  filterActionsForStep, 
  actionBelongsToStep, 
  getOrphanedActions, 
  validateStepFiltering,
  getStepActionCount 
} from '../stepFiltering';
import { TestStep, ActionWithId } from '../../types/testCaseDriven.types';

// Generator for creating valid actions
const actionArbitrary = fc.record({
  id: fc.uuid(),
  type: fc.constantFrom('mouse_move', 'mouse_click', 'key_press', 'key_release', 'ai_vision_capture'),
  timestamp: fc.float({ min: 0, max: 1000 }),
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

// Generator for creating test steps with unique IDs
const testStepArbitrary = fc.record({
  id: fc.uuid(),
  order: fc.integer({ min: 1, max: 100 }),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  expected_result: fc.string({ maxLength: 200 }),
  action_ids: fc.array(fc.uuid(), { maxLength: 10 }),
  continue_on_failure: fc.boolean(),
}) as fc.Arbitrary<TestStep>;

// Generator for creating action pools with consistent IDs
const actionPoolArbitrary = fc.array(actionArbitrary, { minLength: 0, maxLength: 50 }).map(actions => {
  const pool: Record<string, ActionWithId> = {};
  actions.forEach(action => {
    pool[action.id] = action;
  });
  return pool;
});

// Generator for creating steps that reference existing actions
const stepsWithValidReferencesArbitrary = actionPoolArbitrary.chain(actionPool => {
  const actionIds = Object.keys(actionPool);
  return fc.array(testStepArbitrary, { minLength: 0, maxLength: 10 }).map(steps =>
    steps.map((step, index) => ({
      ...step,
      id: `step_${index}_${Math.random().toString(36).substr(2, 9)}`,
      order: index + 1,
      action_ids: fc.sample(fc.subarray(actionIds, { minLength: 0, maxLength: Math.min(5, actionIds.length) }), 1)[0],
    }))
  ).map(steps => ({ actionPool, steps }));
});

describe('Step Selection Filtering Property Tests', () => {
  /**
   * Property 6: Step Selection Filtering
   * For any test step selection in the editor, the action display SHALL show 
   * only the actions referenced by that step's action_ids array
   */
  test('filtered actions contain only actions from selected step', () => {
    fc.assert(
      fc.property(
        stepsWithValidReferencesArbitrary,
        fc.integer({ min: 0, max: 9 }),
        ({ actionPool, steps }, stepIndex) => {
          // Skip if no steps or invalid index
          if (steps.length === 0 || stepIndex >= steps.length) {
            return true;
          }

          const selectedStep = steps[stepIndex];
          const filteredActions = filterActionsForStep(selectedStep, actionPool);

          // Validate that filtering is correct
          expect(validateStepFiltering(selectedStep, filteredActions, actionPool)).toBe(true);

          // All filtered actions must belong to the selected step
          for (const action of filteredActions) {
            expect(actionBelongsToStep(action, selectedStep)).toBe(true);
          }

          // All actions in the step's action_ids that exist in the pool should be included
          for (const actionId of selectedStep.action_ids) {
            const action = actionPool[actionId];
            if (action) {
              expect(filteredActions.some(a => a.id === actionId)).toBe(true);
            }
          }

          // No actions from other steps should be included
          const stepActionIds = new Set(selectedStep.action_ids);
          for (const action of filteredActions) {
            expect(stepActionIds.has(action.id)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Null step selection returns empty array
   * When no step is selected, no actions should be displayed
   */
  test('null step selection returns empty array', () => {
    fc.assert(
      fc.property(
        actionPoolArbitrary,
        (actionPool) => {
          const filteredActions = filterActionsForStep(null, actionPool);
          expect(filteredActions).toEqual([]);
          expect(validateStepFiltering(null, filteredActions, actionPool)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Actions are sorted by timestamp
   * Filtered actions should be returned in chronological order
   */
  test('filtered actions are sorted by timestamp', () => {
    fc.assert(
      fc.property(
        stepsWithValidReferencesArbitrary,
        fc.integer({ min: 0, max: 9 }),
        ({ actionPool, steps }, stepIndex) => {
          if (steps.length === 0 || stepIndex >= steps.length) {
            return true;
          }

          const selectedStep = steps[stepIndex];
          const filteredActions = filterActionsForStep(selectedStep, actionPool);

          // Check that actions are sorted by timestamp
          for (let i = 1; i < filteredActions.length; i++) {
            expect(filteredActions[i].timestamp).toBeGreaterThanOrEqual(
              filteredActions[i - 1].timestamp
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Action count matches filtered results
   * The count of actions for a step should match the filtered results length
   */
  test('action count matches filtered results length', () => {
    fc.assert(
      fc.property(
        stepsWithValidReferencesArbitrary,
        fc.integer({ min: 0, max: 9 }),
        ({ actionPool, steps }, stepIndex) => {
          if (steps.length === 0 || stepIndex >= steps.length) {
            return true;
          }

          const selectedStep = steps[stepIndex];
          const filteredActions = filterActionsForStep(selectedStep, actionPool);
          const actionCount = getStepActionCount(selectedStep, actionPool);

          expect(filteredActions.length).toBe(actionCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Orphaned actions are correctly identified
   * Actions not referenced by any step should be identified as orphaned
   */
  test('orphaned actions are correctly identified', () => {
    fc.assert(
      fc.property(
        stepsWithValidReferencesArbitrary,
        ({ actionPool, steps }) => {
          const orphanedActions = getOrphanedActions(actionPool, steps);
          const referencedActionIds = new Set(steps.flatMap(step => step.action_ids));

          // All orphaned actions should not be referenced by any step
          for (const action of orphanedActions) {
            expect(referencedActionIds.has(action.id)).toBe(false);
          }

          // All non-orphaned actions should be referenced by at least one step
          for (const action of Object.values(actionPool)) {
            const isOrphaned = orphanedActions.some(orphan => orphan.id === action.id);
            const isReferenced = referencedActionIds.has(action.id);
            expect(isOrphaned).toBe(!isReferenced);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Action belongs to step relationship is consistent
   * The actionBelongsToStep function should be consistent with step action_ids
   */
  test('action belongs to step relationship is consistent', () => {
    fc.assert(
      fc.property(
        stepsWithValidReferencesArbitrary,
        ({ actionPool, steps }) => {
          for (const step of steps) {
            for (const actionId of step.action_ids) {
              const action = actionPool[actionId];
              if (action) {
                expect(actionBelongsToStep(action, step)).toBe(true);
              }
            }

            // Test with actions not in this step
            for (const action of Object.values(actionPool)) {
              const shouldBelong = step.action_ids.includes(action.id);
              expect(actionBelongsToStep(action, step)).toBe(shouldBelong);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Filtering with missing actions handles gracefully
   * Steps referencing non-existent actions should filter gracefully
   */
  test('filtering handles missing actions gracefully', () => {
    fc.assert(
      fc.property(
        actionPoolArbitrary,
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        (actionPool, missingActionIds) => {
          const stepWithMissingActions: TestStep = {
            id: 'test-step',
            order: 1,
            description: 'Test step',
            expected_result: 'Success',
            action_ids: missingActionIds,
            continue_on_failure: false,
          };

          const filteredActions = filterActionsForStep(stepWithMissingActions, actionPool);

          // Should only include actions that actually exist in the pool
          for (const action of filteredActions) {
            expect(actionPool[action.id]).toBeDefined();
            expect(missingActionIds.includes(action.id)).toBe(true);
          }

          // Should not include any actions that don't exist
          expect(filteredActions.length).toBeLessThanOrEqual(missingActionIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Empty step has no actions
   * Steps with no action_ids should return empty filtered results
   */
  test('empty step returns no actions', () => {
    fc.assert(
      fc.property(
        actionPoolArbitrary,
        (actionPool) => {
          const emptyStep: TestStep = {
            id: 'empty-step',
            order: 1,
            description: 'Empty step',
            expected_result: 'Nothing',
            action_ids: [],
            continue_on_failure: false,
          };

          const filteredActions = filterActionsForStep(emptyStep, actionPool);
          expect(filteredActions).toEqual([]);
          expect(validateStepFiltering(emptyStep, filteredActions, actionPool)).toBe(true);
          expect(getStepActionCount(emptyStep, actionPool)).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
