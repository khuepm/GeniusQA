/**
 * Property-Based Tests for Step Merging Preservation
 * 
 * Tests the correctness properties of step merging functionality to ensure
 * that merged steps preserve all action data and maintain execution order.
 * 
 * **Feature: test-case-driven-automation, Property 13: Step Merging Preservation**
 * **Validates: Requirements 7.2**
 * 
 * Property: For any two test steps being merged, the resulting step SHALL contain 
 * all action_ids from both steps in chronological order
 */

import fc from 'fast-check';
import { mergeTestSteps, validateStepMerging } from '../stepMerging';
import { TestScript, TestStep, ActionWithId, EnhancedScriptMetadata } from '../../types/testCaseDriven.types';

// Test configuration
const NUM_RUNS = 100;

/**
 * Generator for valid action IDs
 */
const actionIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);

/**
 * Generator for action with timestamp
 */
const actionArb = fc.record({
  id: actionIdArb,
  type: fc.constantFrom('mouse_move', 'mouse_click', 'key_press', 'key_release', 'ai_vision_capture'),
  timestamp: fc.float({ min: 0, max: 1000, noNaN: true }),
  x: fc.option(fc.integer({ min: 0, max: 1920 })),
  y: fc.option(fc.integer({ min: 0, max: 1080 })),
  button: fc.option(fc.constantFrom('left', 'right', 'middle')),
  key: fc.option(fc.string({ minLength: 1, maxLength: 10 })),
  screenshot: fc.option(fc.string()),
}) as fc.Arbitrary<ActionWithId>;

/**
 * Generator for test step with action references
 */
const testStepArb = (actionIds: string[]) => fc.record({
  id: fc.uuid(),
  order: fc.integer({ min: 1, max: 100 }),
  description: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  expected_result: fc.string({ maxLength: 200 }),
  action_ids: fc.subarray(actionIds, { minLength: 0, maxLength: actionIds.length }),
  continue_on_failure: fc.boolean(),
}) as fc.Arbitrary<TestStep>;

/**
 * Generator for enhanced script metadata
 */
const enhancedMetadataArb = fc.record({
  version: fc.constant('2.0'),
  created_at: fc.date(),
  duration: fc.float({ min: 0, max: 3600 }),
  action_count: fc.integer({ min: 0, max: 1000 }),
  platform: fc.constantFrom('windows', 'darwin', 'linux'),
  title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  description: fc.string({ maxLength: 500 }),
  pre_conditions: fc.string({ maxLength: 300 }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
}) as fc.Arbitrary<EnhancedScriptMetadata>;

/**
 * Generator for test script with multiple steps
 */
const testScriptArb = fc.integer({ min: 2, max: 10 }).chain(numSteps => {
  return fc.array(actionArb, { minLength: 0, maxLength: 20 }).chain(actions => {
    const actionIds = actions.map(a => a.id);
    const actionPool = Object.fromEntries(actions.map(a => [a.id, a]));
    
    return fc.tuple(
      enhancedMetadataArb,
      fc.array(testStepArb(actionIds), { minLength: numSteps, maxLength: numSteps })
    ).map(([meta, steps]) => {
      // Ensure unique step IDs and sequential orders
      const uniqueSteps = steps.map((step, index) => ({
        ...step,
        id: `step-${index}`,
        order: index + 1,
      }));
      
      return {
        meta,
        steps: uniqueSteps,
        action_pool: actionPool,
        variables: {},
      } as TestScript;
    });
  });
});

describe('Step Merging Preservation Property Tests', () => {
  /**
   * **Feature: test-case-driven-automation, Property 13: Step Merging Preservation**
   * **Validates: Requirements 7.2**
   * 
   * Property: For any two test steps being merged, the resulting step SHALL contain 
   * all action_ids from both steps in chronological order
   */
  test('Property 13: Step Merging Preservation - merged steps contain all actions in chronological order', () => {
    fc.assert(
      fc.property(
        testScriptArb,
        fc.integer({ min: 2, max: 5 }), // Number of steps to merge
        (script, numToMerge) => {
          // Skip if script doesn't have enough steps
          if (script.steps.length < numToMerge) {
            return true;
          }

          // Select steps to merge (first N steps for consistency)
          const stepsToMerge = script.steps.slice(0, numToMerge);
          const stepIds = stepsToMerge.map(s => s.id);

          // Validate merge is possible
          const validation = validateStepMerging(script, stepIds);
          if (!validation.success) {
            return true; // Skip invalid scenarios
          }

          // Collect original action IDs from steps to merge
          const originalActionIds = stepsToMerge.flatMap(step => step.action_ids);
          
          // Sort original action IDs by timestamp for expected order
          const expectedOrder = originalActionIds.sort((idA, idB) => {
            const actionA = script.action_pool[idA];
            const actionB = script.action_pool[idB];
            
            if (!actionA || !actionB) {
              return 0; // Maintain order if action not found
            }
            
            return actionA.timestamp - actionB.timestamp;
          });

          // Perform merge
          const mergedScript = mergeTestSteps(script, stepIds);

          // Find the merged step (should be the one with the lowest original order)
          const baseStepId = stepsToMerge.sort((a, b) => a.order - b.order)[0].id;
          const mergedStep = mergedScript.steps.find(s => s.id === baseStepId);

          // Verify merged step exists
          if (!mergedStep) {
            return false;
          }

          // Property 1: All original action IDs are preserved
          const mergedActionIds = mergedStep.action_ids;
          const allOriginalIdsPresent = originalActionIds.every(id => 
            mergedActionIds.includes(id)
          );

          // Property 2: No extra action IDs are added
          const noExtraIds = mergedActionIds.every(id => 
            originalActionIds.includes(id)
          );

          // Property 3: Action IDs are in chronological order
          const isChronological = mergedActionIds.every((id, index) => {
            if (index === 0) return true;
            
            const currentAction = script.action_pool[id];
            const previousAction = script.action_pool[mergedActionIds[index - 1]];
            
            if (!currentAction || !previousAction) {
              return true; // Skip if actions not found
            }
            
            return previousAction.timestamp <= currentAction.timestamp;
          });

          // Property 4: Merged step count is reduced
          const originalStepCount = script.steps.length;
          const mergedStepCount = mergedScript.steps.length;
          const stepCountReduced = mergedStepCount === originalStepCount - numToMerge + 1;

          // Property 5: All actions remain in action pool
          const allActionsPreserved = Object.keys(script.action_pool).every(actionId => 
            mergedScript.action_pool[actionId] !== undefined
          );

          return allOriginalIdsPresent && 
                 noExtraIds && 
                 isChronological && 
                 stepCountReduced && 
                 allActionsPreserved;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property: Merge operation preserves step order integrity
   * 
   * After merging, remaining steps should have sequential order numbers
   * starting from 1 with no gaps.
   */
  test('Property: Merge preserves step order integrity', () => {
    fc.assert(
      fc.property(
        testScriptArb,
        fc.integer({ min: 2, max: 3 }), // Number of steps to merge
        (script, numToMerge) => {
          // Skip if script doesn't have enough steps
          if (script.steps.length < numToMerge) {
            return true;
          }

          const stepIds = script.steps.slice(0, numToMerge).map(s => s.id);
          
          // Validate merge is possible
          const validation = validateStepMerging(script, stepIds);
          if (!validation.success) {
            return true;
          }

          // Perform merge
          const mergedScript = mergeTestSteps(script, stepIds);

          // Check that step orders are sequential starting from 1
          const sortedSteps = mergedScript.steps.sort((a, b) => a.order - b.order);
          const hasSequentialOrders = sortedSteps.every((step, index) => 
            step.order === index + 1
          );

          // Check that all step IDs are unique
          const stepIds_after = mergedScript.steps.map(s => s.id);
          const hasUniqueIds = stepIds_after.length === new Set(stepIds_after).size;

          return hasSequentialOrders && hasUniqueIds;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property: Merge operation is deterministic
   * 
   * Merging the same steps multiple times should produce identical results.
   */
  test('Property: Merge operation is deterministic', () => {
    fc.assert(
      fc.property(
        testScriptArb,
        (script) => {
          // Skip if script doesn't have at least 2 steps
          if (script.steps.length < 2) {
            return true;
          }

          const stepIds = script.steps.slice(0, 2).map(s => s.id);
          
          // Validate merge is possible
          const validation = validateStepMerging(script, stepIds);
          if (!validation.success) {
            return true;
          }

          // Perform merge twice
          const mergedScript1 = mergeTestSteps(script, stepIds);
          const mergedScript2 = mergeTestSteps(script, stepIds);

          // Results should be identical
          const step1 = mergedScript1.steps.find(s => s.id === stepIds[0]);
          const step2 = mergedScript2.steps.find(s => s.id === stepIds[0]);

          if (!step1 || !step2) {
            return false;
          }

          // Compare action IDs arrays
          const sameActionIds = step1.action_ids.length === step2.action_ids.length &&
            step1.action_ids.every((id, index) => id === step2.action_ids[index]);

          // Compare step counts
          const sameStepCount = mergedScript1.steps.length === mergedScript2.steps.length;

          return sameActionIds && sameStepCount;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property: Validation correctly identifies invalid merge scenarios
   */
  test('Property: Validation correctly identifies invalid scenarios', () => {
    fc.assert(
      fc.property(
        testScriptArb,
        (script) => {
          // Test with non-existent step IDs
          const invalidStepIds = ['non-existent-1', 'non-existent-2'];
          const validation = validateStepMerging(script, invalidStepIds);
          
          // Should fail validation
          return !validation.success;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property: Single step merge is rejected
   */
  test('Property: Single step merge is correctly rejected', () => {
    fc.assert(
      fc.property(
        testScriptArb,
        (script) => {
          if (script.steps.length === 0) {
            return true;
          }

          // Try to merge just one step
          const singleStepId = [script.steps[0].id];
          const validation = validateStepMerging(script, singleStepId);
          
          // Should fail validation (need at least 2 steps)
          return !validation.success;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});
