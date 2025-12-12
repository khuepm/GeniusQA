/**
 * Step Filtering Utilities
 * 
 * Utilities for filtering actions based on selected test steps.
 * Used by the ActionCanvas component to display only relevant actions.
 * 
 * Requirements: 4.2
 */

import { TestStep, ActionWithId } from '../types/testCaseDriven.types';

/**
 * Filter actions for a selected test step
 * 
 * @param selectedStep - The currently selected test step
 * @param actionPool - Pool of all available actions
 * @returns Array of actions that belong to the selected step
 */
export function filterActionsForStep(
  selectedStep: TestStep | null,
  actionPool: Record<string, ActionWithId>
): ActionWithId[] {
  if (!selectedStep) {
    return [];
  }

  return selectedStep.action_ids
    .map(actionId => actionPool[actionId])
    .filter((action): action is ActionWithId => action !== undefined)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Check if an action belongs to a specific step
 * 
 * @param action - The action to check
 * @param step - The test step to check against
 * @returns True if the action belongs to the step
 */
export function actionBelongsToStep(action: ActionWithId, step: TestStep): boolean {
  return step.action_ids.includes(action.id);
}

/**
 * Get all actions that don't belong to any step
 * 
 * @param actionPool - Pool of all available actions
 * @param steps - Array of all test steps
 * @returns Array of orphaned actions
 */
export function getOrphanedActions(
  actionPool: Record<string, ActionWithId>,
  steps: TestStep[]
): ActionWithId[] {
  const referencedActionIds = new Set(
    steps.flatMap(step => step.action_ids)
  );

  return Object.values(actionPool).filter(
    action => !referencedActionIds.has(action.id)
  );
}

/**
 * Validate that step selection filtering is working correctly
 * 
 * @param selectedStep - The selected step
 * @param filteredActions - The filtered actions
 * @param actionPool - The complete action pool
 * @returns True if filtering is correct
 */
export function validateStepFiltering(
  selectedStep: TestStep | null,
  filteredActions: ActionWithId[],
  actionPool: Record<string, ActionWithId>
): boolean {
  if (!selectedStep) {
    return filteredActions.length === 0;
  }

  // Check that all filtered actions belong to the selected step
  for (const action of filteredActions) {
    if (!selectedStep.action_ids.includes(action.id)) {
      return false;
    }
  }

  // Check that all step actions are included in filtered results
  for (const actionId of selectedStep.action_ids) {
    const action = actionPool[actionId];
    if (action && !filteredActions.some(a => a.id === actionId)) {
      return false;
    }
  }

  // Check that no actions from other steps are included
  const stepActionIds = new Set(selectedStep.action_ids);
  for (const action of filteredActions) {
    if (!stepActionIds.has(action.id)) {
      return false;
    }
  }

  return true;
}

/**
 * Get action count for a specific step
 * 
 * @param step - The test step
 * @param actionPool - Pool of all available actions
 * @returns Number of valid actions for the step
 */
export function getStepActionCount(
  step: TestStep,
  actionPool: Record<string, ActionWithId>
): number {
  return step.action_ids.filter(actionId => actionPool[actionId] !== undefined).length;
}
