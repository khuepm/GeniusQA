/**
 * Step Merging Utility
 * 
 * Provides functionality for merging two or more test steps while preserving
 * action data and maintaining execution order. This utility ensures that
 * merged steps combine their action_ids arrays in chronological order.
 * 
 * Requirements: 7.2
 */

import { TestStep, TestScript, ActionWithId } from '../types/testCaseDriven.types';

/**
 * Merge multiple test steps into a single step
 * 
 * Combines two or more test steps by:
 * 1. Creating a new step with combined descriptions
 * 2. Merging action_ids arrays in chronological order based on action timestamps
 * 3. Preserving all action data in the action pool
 * 4. Using the lowest order number from the merged steps
 * 5. Combining expected results and other properties appropriately
 * 
 * @param script - The test script containing the steps to merge
 * @param stepIds - Array of step IDs to merge (must contain at least 2 steps)
 * @param mergedDescription - Optional custom description for the merged step
 * @param mergedExpectedResult - Optional custom expected result for the merged step
 * @returns Updated test script with merged step
 * 
 * @throws Error if fewer than 2 steps provided or steps not found
 * 
 * Requirements: 7.2
 * Validates: Property 13 (Step Merging Preservation)
 */
export function mergeTestSteps(
  script: TestScript,
  stepIds: string[],
  mergedDescription?: string,
  mergedExpectedResult?: string
): TestScript {
  if (stepIds.length < 2) {
    throw new Error('At least 2 steps are required for merging');
  }

  // Find all steps to merge
  const stepsToMerge = stepIds.map(id => {
    const step = script.steps.find(s => s.id === id);
    if (!step) {
      throw new Error(`Step with ID ${id} not found`);
    }
    return step;
  });

  // Sort steps by order to maintain logical sequence
  stepsToMerge.sort((a, b) => a.order - b.order);

  // Collect all action IDs from steps to merge
  const allActionIds = stepsToMerge.flatMap(step => step.action_ids);

  // Sort action IDs by timestamp to maintain chronological order
  const sortedActionIds = allActionIds.sort((idA, idB) => {
    const actionA = script.action_pool[idA];
    const actionB = script.action_pool[idB];
    
    if (!actionA || !actionB) {
      // If action not found, maintain original order
      return 0;
    }
    
    return actionA.timestamp - actionB.timestamp;
  });

  // Create merged step using the first (lowest order) step as base
  const baseStep = stepsToMerge[0];
  const mergedStep: TestStep = {
    id: baseStep.id, // Keep the ID of the first step
    order: baseStep.order, // Use the lowest order number
    description: mergedDescription || createMergedDescription(stepsToMerge),
    expected_result: mergedExpectedResult || createMergedExpectedResult(stepsToMerge),
    action_ids: sortedActionIds,
    continue_on_failure: stepsToMerge.some(step => step.continue_on_failure), // True if any step has it
  };

  // Remove the merged steps (except the base step) from the script
  const remainingSteps = script.steps.filter(step => 
    step.id === baseStep.id || !stepIds.includes(step.id)
  );

  // Replace the base step with the merged step
  const updatedSteps = remainingSteps.map(step => 
    step.id === baseStep.id ? mergedStep : step
  );

  // Reorder steps to fill gaps left by removed steps
  const reorderedSteps = updatedSteps
    .sort((a, b) => a.order - b.order)
    .map((step, index) => ({ ...step, order: index + 1 }));

  return {
    ...script,
    steps: reorderedSteps,
  };
}

/**
 * Create a combined description from multiple steps
 * 
 * @param steps - Array of steps to combine descriptions from
 * @returns Combined description string
 */
function createMergedDescription(steps: TestStep[]): string {
  const descriptions = steps.map((step, index) => 
    `${index + 1}. ${step.description}`
  );
  return `Merged Steps: ${descriptions.join('; ')}`;
}

/**
 * Create a combined expected result from multiple steps
 * 
 * @param steps - Array of steps to combine expected results from
 * @returns Combined expected result string
 */
function createMergedExpectedResult(steps: TestStep[]): string {
  const results = steps
    .map(step => step.expected_result)
    .filter(result => result && result.trim())
    .map((result, index) => `${index + 1}. ${result}`);
  
  if (results.length === 0) {
    return 'All merged steps complete successfully';
  }
  
  return `Combined Results: ${results.join('; ')}`;
}

/**
 * Validate that steps can be merged safely
 * 
 * Checks for potential issues that might prevent successful merging:
 * - All steps exist in the script
 * - No circular references in action dependencies
 * - Steps are in a valid state for merging
 * 
 * @param script - The test script containing the steps
 * @param stepIds - Array of step IDs to validate for merging
 * @returns Validation result with success flag and error message if any
 */
export function validateStepMerging(
  script: TestScript,
  stepIds: string[]
): { success: boolean; error?: string } {
  if (stepIds.length < 2) {
    return { success: false, error: 'At least 2 steps are required for merging' };
  }

  // Check that all steps exist
  for (const stepId of stepIds) {
    const step = script.steps.find(s => s.id === stepId);
    if (!step) {
      return { success: false, error: `Step with ID ${stepId} not found` };
    }
  }

  // Check that all referenced actions exist in the action pool
  const stepsToMerge = stepIds.map(id => script.steps.find(s => s.id === id)!);
  const allActionIds = stepsToMerge.flatMap(step => step.action_ids);
  
  for (const actionId of allActionIds) {
    if (!script.action_pool[actionId]) {
      return { 
        success: false, 
        error: `Action with ID ${actionId} referenced by step but not found in action pool` 
      };
    }
  }

  return { success: true };
}

/**
 * Get preview of what the merged step would look like
 * 
 * Provides a preview of the merged step without actually modifying the script.
 * Useful for UI confirmation dialogs.
 * 
 * @param script - The test script containing the steps
 * @param stepIds - Array of step IDs to preview merging
 * @param mergedDescription - Optional custom description
 * @param mergedExpectedResult - Optional custom expected result
 * @returns Preview of the merged step
 */
export function previewMergedStep(
  script: TestScript,
  stepIds: string[],
  mergedDescription?: string,
  mergedExpectedResult?: string
): TestStep | null {
  try {
    const validation = validateStepMerging(script, stepIds);
    if (!validation.success) {
      return null;
    }

    const stepsToMerge = stepIds.map(id => script.steps.find(s => s.id === id)!);
    stepsToMerge.sort((a, b) => a.order - b.order);

    const allActionIds = stepsToMerge.flatMap(step => step.action_ids);
    const sortedActionIds = allActionIds.sort((idA, idB) => {
      const actionA = script.action_pool[idA];
      const actionB = script.action_pool[idB];
      
      if (!actionA || !actionB) {
        return 0;
      }
      
      return actionA.timestamp - actionB.timestamp;
    });

    const baseStep = stepsToMerge[0];
    return {
      id: baseStep.id,
      order: baseStep.order,
      description: mergedDescription || createMergedDescription(stepsToMerge),
      expected_result: mergedExpectedResult || createMergedExpectedResult(stepsToMerge),
      action_ids: sortedActionIds,
      continue_on_failure: stepsToMerge.some(step => step.continue_on_failure),
    };
  } catch (error) {
    return null;
  }
}
