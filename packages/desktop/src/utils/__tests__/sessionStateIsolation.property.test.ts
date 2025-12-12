/**
 * Property-Based Tests for Session State Isolation
 * 
 * Tests the correctness properties of session state isolation to ensure
 * that runtime execution results are never persisted to script files and
 * that reopening scripts shows clean state without execution results.
 * 
 * **Feature: test-case-driven-automation, Property 20: Session State Isolation**
 * **Validates: Requirements 8.4**
 * 
 * Property: For any script reopened after execution, the display SHALL show 
 * original step indicators without any previous execution results
 */

import fc from 'fast-check';
import {
  createCleanEditorState,
  createCleanScriptCopy,
  validateScriptPurity,
  stripRuntimeData,
  hasRuntimeData,
  resetToCleanSession,
} from '../sessionStateIsolation';
import { 
  TestScript, 
  TestStep, 
  ActionWithId, 
  EnhancedScriptMetadata,
  StepUIState,
  StepRuntimeState,
  StepEditorState,
} from '../../types/testCaseDriven.types';

// Test configuration
const NUM_RUNS = 100;

/**
 * Generator for valid action IDs
 */
const actionIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);

/**
 * Generator for action with timestamp
 */
const actionArb = fc.constantFrom('mouse_move', 'mouse_click', 'key_press', 'key_release', 'ai_vision_capture')
  .chain(type => {
    const baseAction = {
      id: actionIdArb,
      type: fc.constant(type),
      timestamp: fc.float({ min: 0, max: 1000, noNaN: true }),
      screenshot: fc.option(fc.string()),
    };

    switch (type) {
      case 'mouse_move':
      case 'mouse_click':
        return fc.record({
          ...baseAction,
          x: fc.integer({ min: 0, max: 1920 }),
          y: fc.integer({ min: 0, max: 1080 }),
          button: type === 'mouse_click' ? fc.constantFrom('left', 'right', 'middle') : fc.constant(null),
          key: fc.constant(null),
        });
      case 'key_press':
      case 'key_release':
        return fc.record({
          ...baseAction,
          x: fc.constant(null),
          y: fc.constant(null),
          button: fc.constant(null),
          key: fc.string({ minLength: 1, maxLength: 10 }),
        });
      case 'ai_vision_capture':
        return fc.record({
          ...baseAction,
          x: fc.constant(null),
          y: fc.constant(null),
          button: fc.constant(null),
          key: fc.constant(null),
          is_dynamic: fc.boolean(),
          interaction: fc.constantFrom('click', 'dblclick', 'rclick', 'hover'),
          static_data: fc.constant({}),
          dynamic_config: fc.constant({}),
          cache_data: fc.constant({}),
          is_assertion: fc.boolean(),
        });
      default:
        return fc.record(baseAction);
    }
  }) as fc.Arbitrary<ActionWithId>;

/**
 * Generator for test step
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
 * Generator for test script
 */
const testScriptArb = fc.array(actionArb, { minLength: 0, maxLength: 20 }).chain(actions => {
  const actionIds = actions.map(a => a.id);
  const actionPool = Object.fromEntries(actions.map(a => [a.id, a]));
  
  return fc.tuple(
    enhancedMetadataArb,
    fc.array(testStepArb(actionIds), { minLength: 0, maxLength: 10 })
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

/**
 * Generator for runtime state
 */
const runtimeStateArb = fc.record({
  status: fc.constantFrom('passed', 'failed', 'skipped', 'pending'),
  error_message: fc.option(fc.string({ maxLength: 200 })),
  screenshot_proof: fc.option(fc.string({ maxLength: 100 })),
  execution_time: fc.option(fc.integer({ min: 0, max: 60000 })),
  started_at: fc.option(fc.date()),
  completed_at: fc.option(fc.date()),
}) as fc.Arbitrary<StepRuntimeState>;

/**
 * Generator for step UI state with runtime data
 */
const stepUIStateWithRuntimeArb = (step: TestStep) => fc.record({
  step: fc.constant(step),
  indicator: fc.constantFrom('manual', 'mapped', 'recording'),
  selected: fc.boolean(),
  expanded: fc.boolean(),
  runtime: fc.option(runtimeStateArb),
}) as fc.Arbitrary<StepUIState>;

describe('Session State Isolation Property Tests', () => {
  /**
   * **Feature: test-case-driven-automation, Property 20: Session State Isolation**
   * **Validates: Requirements 8.4**
   * 
   * Property: For any script reopened after execution, the display SHALL show 
   * original step indicators without any previous execution results
   */
  test('Property 20: Session State Isolation - clean editor state has no runtime data', () => {
    fc.assert(
      fc.property(
        testScriptArb,
        (script) => {
          // Create clean editor state from script
          const cleanState = createCleanEditorState(script);

          // Property 1: Clean state should not have runtime data
          const hasRuntime = hasRuntimeData(cleanState);

          // Property 2: All step UI states should not have runtime property
          const allStepsClean = cleanState.step_ui_states.every(stepState => 
            stepState.runtime === undefined
          );

          // Property 3: Recording state should be inactive
          const recordingInactive = cleanState.recording_state.recording_mode === 'inactive';

          // Property 4: No pending actions
          const noPendingActions = cleanState.recording_state.pending_actions.length === 0;

          // Property 5: No active recording step
          const noActiveStep = cleanState.recording_state.current_active_step_id === null;

          // Property 6: Not modified
          const notModified = !cleanState.modified;

          // Property 7: No error
          const noError = cleanState.error === null;

          return !hasRuntime && 
                 allStepsClean && 
                 recordingInactive && 
                 noPendingActions && 
                 noActiveStep && 
                 notModified && 
                 noError;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property: Clean script copy contains no runtime data
   * 
   * Creating a clean copy of a script should remove all runtime data
   * while preserving all persistent data.
   */
  test('Property: Clean script copy preserves persistent data only', () => {
    fc.assert(
      fc.property(
        testScriptArb,
        (script) => {
          // Create clean copy
          const cleanCopy = createCleanScriptCopy(script);

          // Validate script purity
          const validation = validateScriptPurity(cleanCopy);

          // Property 1: Clean copy should be pure (no runtime data)
          const isPure = validation.isPure;

          // Property 2: All persistent data should be preserved
          const metaPreserved = JSON.stringify(cleanCopy.meta) === JSON.stringify(script.meta);
          const stepsCountPreserved = cleanCopy.steps.length === script.steps.length;
          const actionPoolPreserved = Object.keys(cleanCopy.action_pool).length === Object.keys(script.action_pool).length;
          const variablesPreserved = JSON.stringify(cleanCopy.variables) === JSON.stringify(script.variables);

          // Property 3: Step data should be preserved (excluding any runtime fields)
          const stepsPreserved = cleanCopy.steps.every((cleanStep, index) => {
            const originalStep = script.steps[index];
            return originalStep && 
                   cleanStep.id === originalStep.id &&
                   cleanStep.order === originalStep.order &&
                   cleanStep.description === originalStep.description &&
                   cleanStep.expected_result === originalStep.expected_result &&
                   JSON.stringify(cleanStep.action_ids) === JSON.stringify(originalStep.action_ids) &&
                   cleanStep.continue_on_failure === originalStep.continue_on_failure;
          });

          return isPure && 
                 metaPreserved && 
                 stepsCountPreserved && 
                 actionPoolPreserved && 
                 variablesPreserved && 
                 stepsPreserved;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property: Stripping runtime data removes all runtime information
   * 
   * The stripRuntimeData function should remove all runtime state
   * while preserving step data and resetting UI state.
   */
  test('Property: Strip runtime data removes all runtime information', () => {
    fc.assert(
      fc.property(
        testScriptArb,
        (script) => {
          if (script.steps.length === 0) {
            return true; // Skip empty scripts
          }

          // Create step UI states with runtime data
          const stepsWithRuntime = script.steps.map(step => ({
            step,
            indicator: 'mapped' as const,
            selected: true,
            expanded: true,
            runtime: {
              status: 'passed' as const,
              error_message: 'Some error',
              screenshot_proof: '/path/to/screenshot.png',
              execution_time: 1000,
              started_at: new Date(),
              completed_at: new Date(),
            },
          }));

          // Strip runtime data
          const cleanSteps = stripRuntimeData(stepsWithRuntime);

          // Property 1: No runtime data should remain
          const noRuntimeData = cleanSteps.every(stepState => 
            stepState.runtime === undefined
          );

          // Property 2: UI state should be reset
          const uiStateReset = cleanSteps.every(stepState => 
            !stepState.selected && !stepState.expanded
          );

          // Property 3: Step data should be preserved
          const stepDataPreserved = cleanSteps.every((cleanStep, index) => {
            const originalStep = stepsWithRuntime[index].step;
            return JSON.stringify(cleanStep.step) === JSON.stringify(originalStep);
          });

          // Property 4: Indicators should be recalculated correctly
          const indicatorsCorrect = cleanSteps.every(stepState => {
            const expectedIndicator = stepState.step.action_ids.length > 0 ? 'mapped' : 'manual';
            return stepState.indicator === expectedIndicator;
          });

          return noRuntimeData && 
                 uiStateReset && 
                 stepDataPreserved && 
                 indicatorsCorrect;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property: Reset to clean session preserves script but clears runtime
   * 
   * Resetting an editor state to clean session should preserve the script
   * but remove all runtime execution data.
   */
  test('Property: Reset to clean session preserves script but clears runtime', () => {
    fc.assert(
      fc.property(
        testScriptArb,
        (script) => {
          // Create editor state with some runtime data
          const editorState: StepEditorState = {
            script,
            step_ui_states: script.steps.map(step => ({
              step,
              indicator: 'mapped' as const,
              selected: true,
              expanded: true,
              runtime: {
                status: 'failed' as const,
                error_message: 'Test error',
                execution_time: 2000,
              },
            })),
            selected_step_id: script.steps.length > 0 ? script.steps[0].id : null,
            recording_state: {
              current_active_step_id: script.steps.length > 0 ? script.steps[0].id : null,
              recording_mode: 'step',
              pending_actions: [
                {
                  id: 'pending-1',
                  type: 'mouse_click',
                  timestamp: 100,
                  x: 100,
                  y: 100,
                  button: 'left',
                  key: null,
                  screenshot: null,
                }
              ],
            },
            modified: true,
            error: 'Some error',
          };

          // Reset to clean session
          const cleanState = resetToCleanSession(editorState);

          // Property 1: Script should be preserved
          const scriptPreserved = cleanState.script === script;

          // Property 2: Should not have runtime data
          const noRuntimeData = !hasRuntimeData(cleanState);

          // Property 3: All step UI states should be clean
          const allStepsClean = cleanState.step_ui_states.every(stepState => 
            stepState.runtime === undefined && 
            !stepState.selected && 
            !stepState.expanded
          );

          // Property 4: Recording state should be inactive
          const recordingInactive = cleanState.recording_state.recording_mode === 'inactive' &&
                                   cleanState.recording_state.current_active_step_id === null &&
                                   cleanState.recording_state.pending_actions.length === 0;

          // Property 5: State should not be modified
          const notModified = !cleanState.modified;

          // Property 6: No error
          const noError = cleanState.error === null;

          return scriptPreserved && 
                 noRuntimeData && 
                 allStepsClean && 
                 recordingInactive && 
                 notModified && 
                 noError;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property: Script purity validation correctly identifies runtime data
   * 
   * The validation function should correctly identify when a script
   * contains runtime data that shouldn't be persisted.
   */
  test('Property: Script purity validation correctly identifies contaminated scripts', () => {
    fc.assert(
      fc.property(
        testScriptArb,
        (script) => {
          // Skip empty scripts for this test
          if (script.steps.length === 0) {
            return true;
          }

          // Create script with runtime data (simulate contamination)
          const contaminatedScript = {
            ...script,
            steps: script.steps.map(step => ({
              ...step,
              // Add runtime fields that shouldn't be persisted
              status: 'passed',
              error_message: 'Some error',
              execution_time: 1000,
            } as any)),
          };

          const contaminatedValidation = validateScriptPurity(contaminatedScript);
          const contaminatedIsNotPure = !contaminatedValidation.isPure;
          const hasExpectedIssues = contaminatedValidation.issues.some(issue => 
            issue.includes('status') || 
            issue.includes('error_message') || 
            issue.includes('execution_time')
          );

          return contaminatedIsNotPure && hasExpectedIssues;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * Property: Clean scripts should be pure
   * 
   * Scripts generated by our generators should be considered pure
   * (contain no runtime data).
   */
  test('Property: Generated scripts are pure', () => {
    fc.assert(
      fc.property(
        testScriptArb,
        (script) => {
          const validation = validateScriptPurity(script);
          
          // If not pure, log the issues for debugging
          if (!validation.isPure) {
            console.log('Script validation issues:', validation.issues);
            console.log('Script:', JSON.stringify(script, null, 2));
          }

          return validation.isPure;
        }
      ),
      { numRuns: 10 } // Reduce runs for debugging
    );
  });

  /**
   * Property: Multiple clean operations are idempotent
   * 
   * Applying clean operations multiple times should produce the same result.
   */
  test('Property: Multiple clean operations are idempotent', () => {
    fc.assert(
      fc.property(
        testScriptArb,
        (script) => {
          // Apply clean operations multiple times
          const clean1 = createCleanScriptCopy(script);
          const clean2 = createCleanScriptCopy(clean1);
          const clean3 = createCleanScriptCopy(clean2);

          // All should be identical
          const allIdentical = JSON.stringify(clean1) === JSON.stringify(clean2) &&
                              JSON.stringify(clean2) === JSON.stringify(clean3);

          // All should be pure
          const allPure = validateScriptPurity(clean1).isPure &&
                         validateScriptPurity(clean2).isPure &&
                         validateScriptPurity(clean3).isPure;

          return allIdentical && allPure;
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});
