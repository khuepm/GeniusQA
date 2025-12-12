/**
 * Action-Step Isolation Utilities
 * 
 * Utilities for ensuring that action modifications within a step don't affect
 * the organization or structure of other steps in the script.
 * 
 * Requirements: 4.4
 */

import { TestStep, ActionWithId, TestScript } from '../types/testCaseDriven.types';

/**
 * Update an action in the action pool without affecting step structure
 * 
 * @param script - The test script containing steps and action pool
 * @param actionId - ID of the action to update
 * @param updatedAction - The updated action data
 * @returns New script with updated action, preserving step structure
 */
export function updateActionInPool(
  script: TestScript,
  actionId: string,
  updatedAction: ActionWithId
): TestScript {
  // Ensure the action ID remains consistent
  const actionWithCorrectId = { ...updatedAction, id: actionId };

  return {
    ...script,
    meta: { ...script.meta }, // Create new reference for metadata
    steps: script.steps.map(step => ({ ...step })), // Create new references for steps
    action_pool: {
      ...script.action_pool,
      [actionId]: actionWithCorrectId,
    },
    variables: { ...script.variables }, // Create new reference for variables
  };
}

/**
 * Validate that action modification doesn't affect step structure
 * 
 * @param originalScript - The original script before modification
 * @param modifiedScript - The script after action modification
 * @param modifiedActionId - ID of the action that was modified
 * @returns True if step structure is preserved
 */
export function validateActionIsolation(
  originalScript: TestScript,
  modifiedScript: TestScript,
  modifiedActionId: string
): boolean {
  // Check that step count is unchanged
  if (originalScript.steps.length !== modifiedScript.steps.length) {
    return false;
  }

  // Check that each step's structure is preserved
  for (let i = 0; i < originalScript.steps.length; i++) {
    const originalStep = originalScript.steps[i];
    const modifiedStep = modifiedScript.steps[i];

    // Step metadata should be unchanged
    if (
      originalStep.id !== modifiedStep.id ||
      originalStep.order !== modifiedStep.order ||
      originalStep.description !== modifiedStep.description ||
      originalStep.expected_result !== modifiedStep.expected_result ||
      originalStep.continue_on_failure !== modifiedStep.continue_on_failure
    ) {
      return false;
    }

    // Action IDs array should be unchanged
    if (originalStep.action_ids.length !== modifiedStep.action_ids.length) {
      return false;
    }

    for (let j = 0; j < originalStep.action_ids.length; j++) {
      if (originalStep.action_ids[j] !== modifiedStep.action_ids[j]) {
        return false;
      }
    }
  }

  // Check that only the specified action was modified in the pool
  const originalActionIds = Object.keys(originalScript.action_pool);
  const modifiedActionIds = Object.keys(modifiedScript.action_pool);

  // Action pool should have the same keys
  if (originalActionIds.length !== modifiedActionIds.length) {
    return false;
  }

  for (const actionId of originalActionIds) {
    if (!modifiedScript.action_pool[actionId]) {
      return false;
    }
  }

  // All actions except the modified one should be unchanged
  for (const actionId of originalActionIds) {
    if (actionId !== modifiedActionId) {
      const originalAction = originalScript.action_pool[actionId];
      const modifiedAction = modifiedScript.action_pool[actionId];

      if (JSON.stringify(originalAction) !== JSON.stringify(modifiedAction)) {
        return false;
      }
    }
  }

  // The modified action should exist and have the correct ID
  const modifiedAction = modifiedScript.action_pool[modifiedActionId];
  if (!modifiedAction || modifiedAction.id !== modifiedActionId) {
    return false;
  }

  return true;
}

/**
 * Get all steps that reference a specific action
 * 
 * @param script - The test script
 * @param actionId - ID of the action to find references for
 * @returns Array of steps that reference the action
 */
export function getStepsReferencingAction(
  script: TestScript,
  actionId: string
): TestStep[] {
  return script.steps.filter(step => step.action_ids.includes(actionId));
}

/**
 * Check if modifying an action would affect multiple steps
 * 
 * @param script - The test script
 * @param actionId - ID of the action to check
 * @returns True if the action is referenced by multiple steps
 */
export function actionAffectsMultipleSteps(
  script: TestScript,
  actionId: string
): boolean {
  const referencingSteps = getStepsReferencingAction(script, actionId);
  return referencingSteps.length > 1;
}

/**
 * Create a deep copy of a script for safe modification
 * 
 * @param script - The script to copy
 * @returns Deep copy of the script
 */
export function deepCopyScript(script: TestScript): TestScript {
  // Custom deep copy that handles undefined and NaN values properly
  const copy = JSON.parse(JSON.stringify(script, (key, value) => {
    if (value === undefined) return null;
    if (typeof value === 'number' && isNaN(value)) return null;
    return value;
  }));
  
  // Restore undefined values where they should be null
  const restoreUndefined = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(restoreUndefined);
    
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === null && (key === 'static_data' || key === 'dynamic_config' || key === 'cache_data')) {
        result[key] = undefined;
      } else {
        result[key] = restoreUndefined(value);
      }
    }
    return result;
  };
  
  return restoreUndefined(copy);
}

/**
 * Validate that script metadata is unchanged after action modification
 * 
 * @param originalScript - The original script
 * @param modifiedScript - The modified script
 * @returns True if metadata is preserved
 */
export function validateMetadataPreservation(
  originalScript: TestScript,
  modifiedScript: TestScript
): boolean {
  return JSON.stringify(originalScript.meta) === JSON.stringify(modifiedScript.meta) &&
         JSON.stringify(originalScript.variables) === JSON.stringify(modifiedScript.variables);
}
