/**
 * Property-based tests for step reordering consistency
 * Feature: test-case-driven-automation, Property 3: Step Reordering Consistency
 * Validates: Requirements 1.3
 */

import * as fc from 'fast-check';
import { reorderSteps, validateStepOrdering, getExecutionSequence } from '../stepReordering';
import { TestStep } from '../../types/testCaseDriven.types';

// Generator for creating valid test steps
const testStepArbitrary = fc.record({
  id: fc.uuid(),
  order: fc.integer({ min: 1, max: 100 }),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  expected_result: fc.string({ maxLength: 200 }),
  action_ids: fc.array(fc.uuid(), { maxLength: 10 }),
  continue_on_failure: fc.boolean(),
});

// Generator for creating arrays of test steps with proper ordering and unique IDs
const orderedStepsArbitrary = fc.integer({ min: 1, max: 20 }).chain(count =>
  fc.array(fc.uuid(), { minLength: count, maxLength: count }).chain(ids => {
    // Ensure unique IDs
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length < count) {
      // If we don't have enough unique IDs, generate more
      const additionalIds = Array.from({ length: count - uniqueIds.length }, () => 
        Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      );
      uniqueIds.push(...additionalIds);
    }
    
    return fc.array(testStepArbitrary, { minLength: count, maxLength: count }).map(steps =>
      steps.map((step, index) => ({
        ...step,
        id: uniqueIds[index],
        order: index + 1,
      }))
    );
  })
);

describe('Step Reordering Property Tests', () => {
  /**
   * Property 3: Step Reordering Consistency
   * For any test script with multiple steps, when steps are reordered,
   * the execution sequence SHALL match the new order arrangement
   */
  test('step reordering maintains execution sequence consistency', () => {
    fc.assert(
      fc.property(
        orderedStepsArbitrary,
        fc.integer({ min: 0, max: 19 }), // step index to move
        fc.integer({ min: 1, max: 20 }), // new order position
        (steps: TestStep[], stepIndex: number, newOrder: number) => {
          // Skip if invalid indices
          if (stepIndex >= steps.length || newOrder > steps.length) {
            return true;
          }

          const stepToMove = steps[stepIndex];
          const originalSequence = getExecutionSequence(steps);

          // Perform reordering
          const reorderedSteps = reorderSteps(steps, stepToMove.id, newOrder);

          // Validate the reordered steps
          expect(validateStepOrdering(reorderedSteps)).toBe(true);

          // Check that the moved step is at the correct position
          const newSequence = getExecutionSequence(reorderedSteps);
          const movedStepNewIndex = newSequence.indexOf(stepToMove.id);
          expect(movedStepNewIndex).toBe(newOrder - 1); // Convert to 0-based index

          // Check that all steps are still present
          expect(reorderedSteps.length).toBe(steps.length);
          expect(new Set(reorderedSteps.map(s => s.id))).toEqual(new Set(steps.map(s => s.id)));

          // Check that orders are sequential from 1 to n
          const orders = reorderedSteps.map(s => s.order).sort((a, b) => a - b);
          for (let i = 0; i < orders.length; i++) {
            expect(orders[i]).toBe(i + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Reordering preserves step data
   * All step data except order should remain unchanged after reordering
   */
  test('reordering preserves all step data except order', () => {
    fc.assert(
      fc.property(
        orderedStepsArbitrary,
        fc.integer({ min: 0, max: 19 }),
        fc.integer({ min: 1, max: 20 }),
        (steps: TestStep[], stepIndex: number, newOrder: number) => {
          if (stepIndex >= steps.length || newOrder > steps.length) {
            return true;
          }

          const stepToMove = steps[stepIndex];
          const reorderedSteps = reorderSteps(steps, stepToMove.id, newOrder);

          // Find the moved step in the reordered array
          const movedStep = reorderedSteps.find(s => s.id === stepToMove.id);
          expect(movedStep).toBeDefined();

          if (movedStep) {
            // All properties except order should be unchanged
            expect(movedStep.id).toBe(stepToMove.id);
            expect(movedStep.description).toBe(stepToMove.description);
            expect(movedStep.expected_result).toBe(stepToMove.expected_result);
            expect(movedStep.action_ids).toEqual(stepToMove.action_ids);
            expect(movedStep.continue_on_failure).toBe(stepToMove.continue_on_failure);
          }

          // All other steps should preserve their data (except order adjustments)
          for (const originalStep of steps) {
            if (originalStep.id !== stepToMove.id) {
              const reorderedStep = reorderedSteps.find(s => s.id === originalStep.id);
              expect(reorderedStep).toBeDefined();

              if (reorderedStep) {
                expect(reorderedStep.id).toBe(originalStep.id);
                expect(reorderedStep.description).toBe(originalStep.description);
                expect(reorderedStep.expected_result).toBe(originalStep.expected_result);
                expect(reorderedStep.action_ids).toEqual(originalStep.action_ids);
                expect(reorderedStep.continue_on_failure).toBe(originalStep.continue_on_failure);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Reordering is reversible
   * Moving a step and then moving it back should restore original order
   */
  test('reordering operations are reversible', () => {
    fc.assert(
      fc.property(
        orderedStepsArbitrary,
        fc.integer({ min: 0, max: 19 }),
        fc.integer({ min: 1, max: 20 }),
        (steps: TestStep[], stepIndex: number, newOrder: number) => {
          if (stepIndex >= steps.length || newOrder > steps.length) {
            return true;
          }

          const stepToMove = steps[stepIndex];
          const originalOrder = stepToMove.order;

          // Move step to new position
          const reorderedSteps = reorderSteps(steps, stepToMove.id, newOrder);

          // Move step back to original position
          const restoredSteps = reorderSteps(reorderedSteps, stepToMove.id, originalOrder);

          // The execution sequence should match the original
          const originalSequence = getExecutionSequence(steps);
          const restoredSequence = getExecutionSequence(restoredSteps);
          expect(restoredSequence).toEqual(originalSequence);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Invalid reordering operations throw errors
   * Attempting to reorder with invalid parameters should fail gracefully
   */
  test('invalid reordering operations are rejected', () => {
    fc.assert(
      fc.property(
        orderedStepsArbitrary,
        fc.string(),
        fc.integer(),
        (steps: TestStep[], invalidStepId: string, invalidOrder: number) => {
          // Test with non-existent step ID
          if (!steps.some(s => s.id === invalidStepId)) {
            expect(() => reorderSteps(steps, invalidStepId, 1)).toThrow();
          }

          // Test with invalid order (out of bounds)
          if (steps.length > 0 && (invalidOrder < 1 || invalidOrder > steps.length)) {
            const validStepId = steps[0].id;
            expect(() => reorderSteps(steps, validStepId, invalidOrder)).toThrow();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Empty and single-step arrays are handled correctly
   * Edge cases with minimal step counts should work properly
   */
  test('edge cases with minimal step counts', () => {
    // Empty array
    expect(validateStepOrdering([])).toBe(true);
    expect(getExecutionSequence([])).toEqual([]);

    // Single step
    const singleStep: TestStep = {
      id: 'test-id',
      order: 1,
      description: 'Test step',
      expected_result: 'Success',
      action_ids: [],
      continue_on_failure: false,
    };

    expect(validateStepOrdering([singleStep])).toBe(true);
    expect(getExecutionSequence([singleStep])).toEqual(['test-id']);

    // Reordering single step to same position should work
    const reordered = reorderSteps([singleStep], 'test-id', 1);
    expect(reordered).toEqual([singleStep]);
  });

  /**
   * Additional property: Step ordering validation detects inconsistencies
   * The validation function should correctly identify invalid orderings
   */
  test('step ordering validation detects all inconsistencies', () => {
    fc.assert(
      fc.property(
        fc.array(testStepArbitrary, { minLength: 2, maxLength: 10 }),
        (steps: TestStep[]) => {
          // Create invalid ordering by duplicating an order
          const invalidSteps = steps.map((step, index) => ({
            ...step,
            order: index === 0 ? 1 : (index === 1 ? 1 : index + 1), // Duplicate order 1
          }));

          expect(validateStepOrdering(invalidSteps)).toBe(false);

          // Create invalid ordering with gaps
          const gappedSteps = steps.map((step, index) => ({
            ...step,
            order: index === 0 ? 1 : index + 2, // Skip order 2
          }));

          expect(validateStepOrdering(gappedSteps)).toBe(false);

          // Create valid ordering
          const validSteps = steps.map((step, index) => ({
            ...step,
            order: index + 1,
          }));

          expect(validateStepOrdering(validSteps)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
