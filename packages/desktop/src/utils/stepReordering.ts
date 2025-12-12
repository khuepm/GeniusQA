/**
 * Step Reordering Utilities
 * 
 * Utilities for reordering test steps while maintaining consistency.
 * Used by the TestStepPlanner component for drag-and-drop operations.
 * 
 * Requirements: 1.3
 */

import { TestStep } from '../types/testCaseDriven.types';

/**
 * Reorder steps by moving a step to a new position
 * 
 * @param steps - Array of test steps to reorder
 * @param stepId - ID of the step to move
 * @param newOrder - New order position (1-based)
 * @returns New array with reordered steps
 */
export function reorderSteps(steps: TestStep[], stepId: string, newOrder: number): TestStep[] {
  // Find the step to move
  const stepToMove = steps.find(step => step.id === stepId);
  if (!stepToMove) {
    throw new Error(`Step with ID ${stepId} not found`);
  }

  // Validate new order
  if (newOrder < 1 || newOrder > steps.length) {
    throw new Error(`Invalid new order ${newOrder}. Must be between 1 and ${steps.length}`);
  }

  // Create a copy of the steps array without the step to move
  const otherSteps = steps.filter(step => step.id !== stepId);

  // Create a simpler reordering approach
  const reorderedSteps: TestStep[] = [];
  
  // Sort other steps by their original order
  const sortedOtherSteps = otherSteps.sort((a, b) => a.order - b.order);
  
  // Build the new array by inserting the moved step at the correct position
  for (let i = 1; i <= steps.length; i++) {
    if (i === newOrder) {
      // Insert the moved step at its new position
      reorderedSteps.push({
        ...stepToMove,
        order: i,
      });
    } else {
      // Insert the next available step from the sorted list
      const nextStep = sortedOtherSteps.shift();
      if (nextStep) {
        reorderedSteps.push({
          ...nextStep,
          order: i,
        });
      }
    }
  }

  // Ensure all steps are included and properly ordered
  const finalSteps = reorderedSteps.sort((a, b) => a.order - b.order);
  
  // Validate that we have the same number of steps
  if (finalSteps.length !== steps.length) {
    throw new Error('Step reordering failed: step count mismatch');
  }

  return finalSteps;
}

/**
 * Validate that steps have consistent ordering
 * 
 * @param steps - Array of test steps to validate
 * @returns True if ordering is consistent, false otherwise
 */
export function validateStepOrdering(steps: TestStep[]): boolean {
  if (steps.length === 0) return true;

  // Sort steps by order
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  // Check that orders are sequential starting from 1
  for (let i = 0; i < sortedSteps.length; i++) {
    if (sortedSteps[i].order !== i + 1) {
      return false;
    }
  }

  // Check for duplicate IDs
  const ids = new Set(steps.map(step => step.id));
  if (ids.size !== steps.length) {
    return false;
  }

  return true;
}

/**
 * Get the execution sequence of steps based on their order
 * 
 * @param steps - Array of test steps
 * @returns Array of step IDs in execution order
 */
export function getExecutionSequence(steps: TestStep[]): string[] {
  return steps
    .sort((a, b) => a.order - b.order)
    .map(step => step.id);
}
