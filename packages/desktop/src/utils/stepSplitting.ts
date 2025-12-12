/**
 * Step Splitting Utility
 * 
 * Provides functionality for splitting a single test step into multiple steps
 * while preserving action data and maintaining execution order. This utility
 * allows users to reorganize actions within steps for better test organization.
 * 
 * Requirements: 7.3
 */

import { TestStep, TestScript, ActionWithId } from '../types/testCaseDriven.types';

/**
 * Configuration for splitting a step
 */
export interface StepSplitConfig {
  /** ID of the step to split */
  stepId: string;
  /** Array of split configurations, each defining a new step */
  splits: StepSplitDefinition[];
}

/**
 * Definition for a single split result step
 */
export interface StepSplitDefinition {
  /** Description for the new step */
  description: string;
  /** Expected result for the new step */
  expected_result: string;
  /** Action IDs that should belong to this split step */
  action_ids: string[];
  /** Whether this step should continue on failure */
  continue_on_failure?: boolean;
}

/**
 * Result of a step split operation
 */
export interface StepSplitResult {
  /** Whether the split was successful */
  success: boolean;
  /** Updated test script with split steps */
  script?: TestScript;
  /** Error message if split failed */
  error?: string;
  /** IDs of the newly created steps */
  new_step_ids?: string[];
}

/**
 * Split a single test step into multiple steps
 * 
 * Takes a test step and splits it into multiple steps based on the provided
 * configuration. Each split definition specifies which actions should belong
 * to each resulting step.
 * 
 * @param script - The test script containing the step to split
 * @param config - Configuration defining how to split the step
 * @returns Result of the split operation
 * 
 * Requirements: 7.3
 */
export function splitTestStep(
  script: TestScript,
  config: StepSplitConfig
): StepSplitResult {
  try {
    // Validate the split configuration
    const validation = validateStepSplitting(script, config);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // Find the step to split
    const stepToSplit = script.steps.find(s => s.id === config.stepId);
    if (!stepToSplit) {
      return {
        success: false,
        error: `Step with ID ${config.stepId} not found`,
      };
    }

    // Generate new step IDs
    const newStepIds = config.splits.map(() => 
      `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );

    // Create new steps from split definitions
    const newSteps: TestStep[] = config.splits.map((split, index) => ({
      id: newStepIds[index],
      order: stepToSplit.order + index, // Will be reordered later
      description: split.description,
      expected_result: split.expected_result,
      action_ids: split.action_ids,
      continue_on_failure: split.continue_on_failure || false,
    }));

    // Remove the original step and insert new steps
    const otherSteps = script.steps.filter(s => s.id !== config.stepId);
    const allSteps = [...otherSteps, ...newSteps];

    // Reorder all steps to maintain sequential order
    const reorderedSteps = allSteps
      .sort((a, b) => a.order - b.order)
      .map((step, index) => ({ ...step, order: index + 1 }));

    // Create updated script
    const updatedScript: TestScript = {
      ...script,
      steps: reorderedSteps,
    };

    return {
      success: true,
      script: updatedScript,
      new_step_ids: newStepIds,
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during split',
    };
  }
}

/**
 * Validate that a step can be split safely
 * 
 * Checks for potential issues that might prevent successful splitting:
 * - Step exists in the script
 * - All action IDs in splits exist in the original step
 * - No action IDs are duplicated across splits
 * - All action IDs from original step are accounted for
 * 
 * @param script - The test script containing the step
 * @param config - Split configuration to validate
 * @returns Validation result with success flag and error message if any
 */
export function validateStepSplitting(
  script: TestScript,
  config: StepSplitConfig
): { success: boolean; error?: string } {
  // Check that step exists
  const stepToSplit = script.steps.find(s => s.id === config.stepId);
  if (!stepToSplit) {
    return { success: false, error: `Step with ID ${config.stepId} not found` };
  }

  // Check that we have at least 2 splits (otherwise it's not really splitting)
  if (config.splits.length < 2) {
    return { success: false, error: 'At least 2 split definitions are required' };
  }

  // Check that all splits have descriptions
  for (let i = 0; i < config.splits.length; i++) {
    const split = config.splits[i];
    if (!split.description || !split.description.trim()) {
      return { success: false, error: `Split ${i + 1} must have a description` };
    }
  }

  // Collect all action IDs from splits
  const allSplitActionIds = config.splits.flatMap(split => split.action_ids);
  
  // Check for duplicate action IDs across splits
  const uniqueActionIds = new Set(allSplitActionIds);
  if (uniqueActionIds.size !== allSplitActionIds.length) {
    return { success: false, error: 'Action IDs cannot be duplicated across splits' };
  }

  // Check that all action IDs in splits exist in the original step
  const originalActionIds = new Set(stepToSplit.action_ids);
  for (const actionId of allSplitActionIds) {
    if (!originalActionIds.has(actionId)) {
      return { 
        success: false, 
        error: `Action ID ${actionId} is not in the original step` 
      };
    }
  }

  // Check that all original action IDs are accounted for in splits
  for (const actionId of stepToSplit.action_ids) {
    if (!allSplitActionIds.includes(actionId)) {
      return { 
        success: false, 
        error: `Action ID ${actionId} from original step is not assigned to any split` 
      };
    }
  }

  // Check that all referenced actions exist in the action pool
  for (const actionId of allSplitActionIds) {
    if (!script.action_pool[actionId]) {
      return { 
        success: false, 
        error: `Action with ID ${actionId} not found in action pool` 
      };
    }
  }

  return { success: true };
}

/**
 * Generate suggested split configurations based on action timestamps
 * 
 * Analyzes the actions in a step and suggests how to split them based on
 * temporal patterns or action types. This provides a starting point for
 * users who want to split a step but aren't sure how to organize it.
 * 
 * @param script - The test script containing the step
 * @param stepId - ID of the step to analyze
 * @param numSplits - Desired number of splits (default: 2)
 * @returns Array of suggested split definitions
 */
export function suggestStepSplits(
  script: TestScript,
  stepId: string,
  numSplits: number = 2
): StepSplitDefinition[] {
  const step = script.steps.find(s => s.id === stepId);
  if (!step || step.action_ids.length === 0) {
    return [];
  }

  // Get actions with timestamps
  const actions = step.action_ids
    .map(id => ({ id, action: script.action_pool[id] }))
    .filter(({ action }) => action !== undefined)
    .sort((a, b) => a.action.timestamp - b.action.timestamp);

  if (actions.length < numSplits) {
    // Not enough actions to split into requested number
    return [];
  }

  // Divide actions into roughly equal groups by timestamp
  const actionsPerSplit = Math.ceil(actions.length / numSplits);
  const splits: StepSplitDefinition[] = [];

  for (let i = 0; i < numSplits; i++) {
    const startIndex = i * actionsPerSplit;
    const endIndex = Math.min(startIndex + actionsPerSplit, actions.length);
    const splitActions = actions.slice(startIndex, endIndex);

    if (splitActions.length === 0) {
      continue;
    }

    splits.push({
      description: `${step.description} - Part ${i + 1}`,
      expected_result: `Part ${i + 1} of: ${step.expected_result}`,
      action_ids: splitActions.map(({ id }) => id),
      continue_on_failure: step.continue_on_failure,
    });
  }

  return splits;
}

/**
 * Get preview of what the split steps would look like
 * 
 * Provides a preview of the split operation without actually modifying the script.
 * Useful for UI confirmation dialogs.
 * 
 * @param script - The test script containing the step
 * @param config - Split configuration to preview
 * @returns Array of preview steps or null if invalid
 */
export function previewStepSplit(
  script: TestScript,
  config: StepSplitConfig
): TestStep[] | null {
  try {
    const validation = validateStepSplitting(script, config);
    if (!validation.success) {
      return null;
    }

    const stepToSplit = script.steps.find(s => s.id === config.stepId);
    if (!stepToSplit) {
      return null;
    }

    // Create preview steps
    return config.splits.map((split, index) => ({
      id: `preview-${index}`,
      order: stepToSplit.order + index,
      description: split.description,
      expected_result: split.expected_result,
      action_ids: split.action_ids,
      continue_on_failure: split.continue_on_failure || false,
    }));

  } catch (error) {
    return null;
  }
}

/**
 * Calculate statistics about a potential split
 * 
 * @param script - The test script containing the step
 * @param config - Split configuration to analyze
 * @returns Statistics about the split operation
 */
export function getStepSplitStats(
  script: TestScript,
  config: StepSplitConfig
): {
  originalActionCount: number;
  splitActionCounts: number[];
  totalSplitActions: number;
  isComplete: boolean;
} | null {
  const step = script.steps.find(s => s.id === config.stepId);
  if (!step) {
    return null;
  }

  const originalActionCount = step.action_ids.length;
  const splitActionCounts = config.splits.map(split => split.action_ids.length);
  const totalSplitActions = splitActionCounts.reduce((sum, count) => sum + count, 0);
  const isComplete = totalSplitActions === originalActionCount;

  return {
    originalActionCount,
    splitActionCounts,
    totalSplitActions,
    isComplete,
  };
}
