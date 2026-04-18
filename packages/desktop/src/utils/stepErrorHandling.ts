/**
 * Step Error Handling and Recovery Utilities
 * 
 * Provides comprehensive error handling, validation, and recovery mechanisms
 * for step-based test scripts. Implements graceful fallbacks for corrupted data
 * and recovery mechanisms for failed operations.
 * 
 * Requirements: 6.4, 8.4
 */

import { TestScript, TestStep, ActionWithId, EnhancedScriptMetadata } from '../types/testCaseDriven.types';

/**
 * Error types for step-based operations
 */
export enum StepErrorType {
  CORRUPTED_STEP_DATA = 'CORRUPTED_STEP_DATA',
  INVALID_STEP_CONFIGURATION = 'INVALID_STEP_CONFIGURATION',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  ACTION_REFERENCE_BROKEN = 'ACTION_REFERENCE_BROKEN',
  STEP_ORDER_INVALID = 'STEP_ORDER_INVALID',
  METADATA_INVALID = 'METADATA_INVALID',
  ACTION_POOL_CORRUPTED = 'ACTION_POOL_CORRUPTED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Structured error for step operations
 */
export interface StepError {
  type: StepErrorType;
  message: string;
  details?: string;
  recoverable: boolean;
  suggestedAction?: string;
}

/**
 * Validation result for step data
 */
export interface StepValidationResult {
  isValid: boolean;
  errors: StepError[];
  warnings: string[];
  repairableIssues: string[];
}

/**
 * Recovery result for repair operations
 */
export interface RecoveryResult {
  success: boolean;
  repairedScript?: TestScript;
  repairsApplied: string[];
  unresolvedIssues: string[];
}

/**
 * Validate a test step for correctness
 */
export function validateStep(step: any): StepValidationResult {
  const errors: StepError[] = [];
  const warnings: string[] = [];
  const repairableIssues: string[] = [];

  // Check if step is null or undefined
  if (!step) {
    errors.push({
      type: StepErrorType.CORRUPTED_STEP_DATA,
      message: 'Step data is null or undefined',
      recoverable: false,
    });
    return { isValid: false, errors, warnings, repairableIssues };
  }

  // Validate step ID
  if (!step.id || typeof step.id !== 'string') {
    errors.push({
      type: StepErrorType.INVALID_STEP_CONFIGURATION,
      message: 'Step is missing a valid ID',
      recoverable: true,
      suggestedAction: 'Generate a new unique ID for the step',
    });
    repairableIssues.push('missing_step_id');
  }

  // Validate step order
  if (typeof step.order !== 'number' || step.order < 1) {
    errors.push({
      type: StepErrorType.STEP_ORDER_INVALID,
      message: `Step order is invalid: ${step.order}`,
      recoverable: true,
      suggestedAction: 'Recalculate step order based on position',
    });
    repairableIssues.push('invalid_step_order');
  }

  // Validate description
  if (!step.description || typeof step.description !== 'string') {
    errors.push({
      type: StepErrorType.INVALID_STEP_CONFIGURATION,
      message: 'Step is missing a description',
      recoverable: true,
      suggestedAction: 'Set a default description',
    });
    repairableIssues.push('missing_description');
  } else if (step.description.trim().length === 0) {
    warnings.push('Step description is empty');
    repairableIssues.push('empty_description');
  }

  // Validate action_ids array
  if (!Array.isArray(step.action_ids)) {
    errors.push({
      type: StepErrorType.CORRUPTED_STEP_DATA,
      message: 'Step action_ids is not an array',
      recoverable: true,
      suggestedAction: 'Initialize action_ids as empty array',
    });
    repairableIssues.push('invalid_action_ids');
  }

  // Validate expected_result (optional but should be string if present)
  if (step.expected_result !== undefined && typeof step.expected_result !== 'string') {
    warnings.push('Expected result should be a string');
    repairableIssues.push('invalid_expected_result_type');
  }

  // Validate continue_on_failure (should be boolean)
  if (step.continue_on_failure !== undefined && typeof step.continue_on_failure !== 'boolean') {
    warnings.push('continue_on_failure should be a boolean');
    repairableIssues.push('invalid_continue_on_failure_type');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    repairableIssues,
  };
}

/**
 * Validate a complete test script
 */
export function validateTestScript(script: any): StepValidationResult {
  const errors: StepError[] = [];
  const warnings: string[] = [];
  const repairableIssues: string[] = [];

  // Check if script is null or undefined
  if (!script) {
    errors.push({
      type: StepErrorType.CORRUPTED_STEP_DATA,
      message: 'Script data is null or undefined',
      recoverable: false,
    });
    return { isValid: false, errors, warnings, repairableIssues };
  }

  // Validate metadata
  if (!script.meta) {
    errors.push({
      type: StepErrorType.METADATA_INVALID,
      message: 'Script is missing metadata',
      recoverable: true,
      suggestedAction: 'Create default metadata',
    });
    repairableIssues.push('missing_metadata');
  } else {
    // Validate required metadata fields
    if (!script.meta.version) {
      warnings.push('Script version is missing');
      repairableIssues.push('missing_version');
    }
    if (!script.meta.created_at) {
      warnings.push('Script creation date is missing');
      repairableIssues.push('missing_created_at');
    }
    if (!script.meta.platform) {
      warnings.push('Script platform is missing');
      repairableIssues.push('missing_platform');
    }
  }

  // Validate steps array
  if (!Array.isArray(script.steps)) {
    errors.push({
      type: StepErrorType.CORRUPTED_STEP_DATA,
      message: 'Script steps is not an array',
      recoverable: true,
      suggestedAction: 'Initialize steps as empty array',
    });
    repairableIssues.push('invalid_steps_array');
  } else {
    // Validate each step
    script.steps.forEach((step: any, index: number) => {
      const stepValidation = validateStep(step);
      if (!stepValidation.isValid) {
        errors.push(...stepValidation.errors.map(e => ({
          ...e,
          message: `Step ${index + 1}: ${e.message}`,
        })));
      }
      warnings.push(...stepValidation.warnings.map(w => `Step ${index + 1}: ${w}`));
      repairableIssues.push(...stepValidation.repairableIssues.map(r => `step_${index}_${r}`));
    });

    // Check for duplicate step IDs
    const stepIds = script.steps.map((s: any) => s?.id).filter(Boolean);
    const duplicateIds = stepIds.filter((id: string, index: number) => stepIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push({
        type: StepErrorType.INVALID_STEP_CONFIGURATION,
        message: `Duplicate step IDs found: ${duplicateIds.join(', ')}`,
        recoverable: true,
        suggestedAction: 'Regenerate unique IDs for duplicate steps',
      });
      repairableIssues.push('duplicate_step_ids');
    }

    // Check for step order gaps or duplicates
    const orders = script.steps.map((s: any) => s?.order).filter((o: any) => typeof o === 'number');
    const sortedOrders = [...orders].sort((a, b) => a - b);
    const expectedOrders = Array.from({ length: orders.length }, (_, i) => i + 1);
    if (JSON.stringify(sortedOrders) !== JSON.stringify(expectedOrders)) {
      warnings.push('Step orders have gaps or duplicates');
      repairableIssues.push('step_order_gaps');
    }
  }

  // Validate action pool
  if (!script.action_pool || typeof script.action_pool !== 'object') {
    errors.push({
      type: StepErrorType.ACTION_POOL_CORRUPTED,
      message: 'Script action_pool is invalid',
      recoverable: true,
      suggestedAction: 'Initialize action_pool as empty object',
    });
    repairableIssues.push('invalid_action_pool');
  } else {
    // Check for broken action references
    if (Array.isArray(script.steps)) {
      const allActionIds = script.steps.flatMap((s: any) => s?.action_ids || []);
      const poolActionIds = new Set(Object.keys(script.action_pool));
      
      const brokenRefs = allActionIds.filter((id: string) => !poolActionIds.has(id));
      if (brokenRefs.length > 0) {
        errors.push({
          type: StepErrorType.ACTION_REFERENCE_BROKEN,
          message: `${brokenRefs.length} action reference(s) point to non-existent actions`,
          details: `Broken IDs: ${brokenRefs.slice(0, 5).join(', ')}${brokenRefs.length > 5 ? '...' : ''}`,
          recoverable: true,
          suggestedAction: 'Remove broken action references from steps',
        });
        repairableIssues.push('broken_action_references');
      }

      // Check for orphaned actions (in pool but not referenced)
      const referencedIds = new Set(allActionIds);
      const orphanedActions = Object.keys(script.action_pool).filter(id => !referencedIds.has(id));
      if (orphanedActions.length > 0) {
        warnings.push(`${orphanedActions.length} action(s) in pool are not referenced by any step`);
        repairableIssues.push('orphaned_actions');
      }
    }
  }

  // Validate variables (optional)
  if (script.variables !== undefined && typeof script.variables !== 'object') {
    warnings.push('Script variables should be an object');
    repairableIssues.push('invalid_variables');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    repairableIssues,
  };
}

/**
 * Attempt to repair a corrupted test script
 */
export function repairTestScript(script: any): RecoveryResult {
  const repairsApplied: string[] = [];
  const unresolvedIssues: string[] = [];

  // Start with a copy of the script or create a new one
  let repairedScript: TestScript;

  try {
    // Handle completely missing or null script
    if (!script) {
      return {
        success: false,
        repairsApplied: [],
        unresolvedIssues: ['Script data is completely missing - cannot repair'],
      };
    }

    // Initialize base structure
    repairedScript = {
      meta: script.meta || createDefaultMetadata(),
      steps: [],
      action_pool: {},
      variables: {},
    };

    // Repair metadata
    if (!script.meta) {
      repairedScript.meta = createDefaultMetadata();
      repairsApplied.push('Created default metadata');
    } else {
      repairedScript.meta = repairMetadata(script.meta);
      if (JSON.stringify(repairedScript.meta) !== JSON.stringify(script.meta)) {
        repairsApplied.push('Repaired metadata fields');
      }
    }

    // Repair action pool
    if (script.action_pool && typeof script.action_pool === 'object') {
      repairedScript.action_pool = repairActionPool(script.action_pool);
      repairsApplied.push('Validated action pool');
    } else {
      repairedScript.action_pool = {};
      repairsApplied.push('Initialized empty action pool');
    }

    // Repair steps
    if (Array.isArray(script.steps)) {
      const { repairedSteps, repairs } = repairSteps(script.steps, repairedScript.action_pool);
      repairedScript.steps = repairedSteps;
      repairsApplied.push(...repairs);
    } else {
      repairedScript.steps = [];
      repairsApplied.push('Initialized empty steps array');
    }

    // Repair variables
    if (script.variables && typeof script.variables === 'object') {
      repairedScript.variables = script.variables;
    } else {
      repairedScript.variables = {};
      if (script.variables !== undefined) {
        repairsApplied.push('Reset invalid variables to empty object');
      }
    }

    // Update action count in metadata
    const totalActions = Object.keys(repairedScript.action_pool).length;
    if (repairedScript.meta.action_count !== totalActions) {
      repairedScript.meta.action_count = totalActions;
      repairsApplied.push('Updated action count in metadata');
    }

    return {
      success: true,
      repairedScript,
      repairsApplied,
      unresolvedIssues,
    };
  } catch (error) {
    return {
      success: false,
      repairsApplied,
      unresolvedIssues: [`Repair failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Create default metadata for a script
 */
function createDefaultMetadata(): EnhancedScriptMetadata {
  return {
    version: '2.0',
    created_at: new Date().toISOString(),
    duration: 0,
    action_count: 0,
    platform: typeof process !== 'undefined' ? process.platform : 'unknown',
    title: 'Recovered Script',
    description: 'Script recovered from corrupted data',
    pre_conditions: '',
    tags: ['recovered'],
  };
}

/**
 * Repair metadata fields
 */
function repairMetadata(meta: any): EnhancedScriptMetadata {
  return {
    version: meta.version || '2.0',
    created_at: meta.created_at || new Date().toISOString(),
    duration: typeof meta.duration === 'number' ? meta.duration : 0,
    action_count: typeof meta.action_count === 'number' ? meta.action_count : 0,
    platform: meta.platform || (typeof process !== 'undefined' ? process.platform : 'unknown'),
    title: meta.title || 'Untitled Script',
    description: meta.description || '',
    pre_conditions: meta.pre_conditions || '',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
  };
}

/**
 * Repair action pool
 */
function repairActionPool(actionPool: any): Record<string, ActionWithId> {
  const repairedPool: Record<string, ActionWithId> = {};

  for (const [id, action] of Object.entries(actionPool)) {
    if (action && typeof action === 'object') {
      const repairedAction = repairAction(id, action as any);
      if (repairedAction) {
        repairedPool[id] = repairedAction;
      }
    }
  }

  return repairedPool;
}

/**
 * Repair a single action
 */
function repairAction(id: string, action: any): ActionWithId | null {
  // Skip completely invalid actions
  if (!action || typeof action !== 'object') {
    return null;
  }

  // Validate action type
  const validTypes = ['mouse_move', 'mouse_click', 'key_press', 'key_release', 'ai_vision_capture'];
  if (!validTypes.includes(action.type)) {
    return null;
  }

  return {
    id: action.id || id,
    type: action.type,
    timestamp: typeof action.timestamp === 'number' ? action.timestamp : 0,
    x: typeof action.x === 'number' ? action.x : null,
    y: typeof action.y === 'number' ? action.y : null,
    button: ['left', 'right', 'middle'].includes(action.button) ? action.button : null,
    key: typeof action.key === 'string' ? action.key : null,
    screenshot: typeof action.screenshot === 'string' ? action.screenshot : null,
    is_dynamic: action.is_dynamic,
    interaction: action.interaction,
    static_data: action.static_data,
    dynamic_config: action.dynamic_config,
    cache_data: action.cache_data,
    is_assertion: action.is_assertion,
  };
}

/**
 * Repair steps array
 */
function repairSteps(
  steps: any[],
  actionPool: Record<string, ActionWithId>
): { repairedSteps: TestStep[]; repairs: string[] } {
  const repairedSteps: TestStep[] = [];
  const repairs: string[] = [];
  const usedIds = new Set<string>();
  const poolActionIds = new Set(Object.keys(actionPool));

  steps.forEach((step, index) => {
    if (!step || typeof step !== 'object') {
      repairs.push(`Skipped invalid step at index ${index}`);
      return;
    }

    // Generate unique ID if missing or duplicate
    let stepId = step.id;
    if (!stepId || typeof stepId !== 'string' || usedIds.has(stepId)) {
      stepId = `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      repairs.push(`Generated new ID for step ${index + 1}`);
    }
    usedIds.add(stepId);

    // Repair action_ids - remove broken references
    let actionIds: string[] = [];
    if (Array.isArray(step.action_ids)) {
      const validIds = step.action_ids.filter((id: any) => 
        typeof id === 'string' && poolActionIds.has(id)
      );
      const removedCount = step.action_ids.length - validIds.length;
      if (removedCount > 0) {
        repairs.push(`Removed ${removedCount} broken action reference(s) from step ${index + 1}`);
      }
      actionIds = validIds;
    }

    const repairedStep: TestStep = {
      id: stepId,
      order: index + 1, // Recalculate order based on position
      description: typeof step.description === 'string' && step.description.trim() 
        ? step.description 
        : `Step ${index + 1}`,
      expected_result: typeof step.expected_result === 'string' ? step.expected_result : '',
      action_ids: actionIds,
      continue_on_failure: typeof step.continue_on_failure === 'boolean' ? step.continue_on_failure : false,
    };

    repairedSteps.push(repairedStep);
  });

  if (repairedSteps.length !== steps.length) {
    repairs.push(`Recovered ${repairedSteps.length} of ${steps.length} steps`);
  }

  return { repairedSteps, repairs };
}

/**
 * Create a safe fallback script when recovery fails
 */
export function createFallbackScript(originalPath?: string): TestScript {
  return {
    meta: {
      version: '2.0',
      created_at: new Date().toISOString(),
      duration: 0,
      action_count: 0,
      platform: typeof process !== 'undefined' ? process.platform : 'unknown',
      title: 'Fallback Script',
      description: originalPath 
        ? `Created as fallback for corrupted script: ${originalPath}`
        : 'Created as fallback for corrupted script',
      pre_conditions: '',
      tags: ['fallback', 'recovered'],
    },
    steps: [],
    action_pool: {},
    variables: {},
  };
}

/**
 * Format error messages for user display
 */
export function formatStepErrors(errors: StepError[]): string {
  if (errors.length === 0) return '';

  const lines = errors.map(error => {
    let line = `• ${error.message}`;
    if (error.details) {
      line += `\n  Details: ${error.details}`;
    }
    if (error.suggestedAction) {
      line += `\n  Suggested: ${error.suggestedAction}`;
    }
    return line;
  });

  return lines.join('\n\n');
}

/**
 * Check if a script can be safely loaded
 */
export function canSafelyLoadScript(scriptData: any): { safe: boolean; reason?: string } {
  if (!scriptData) {
    return { safe: false, reason: 'Script data is empty or null' };
  }

  // Check for minimum required structure
  const hasStepFormat = scriptData.meta && scriptData.steps && scriptData.action_pool;
  const hasLegacyFormat = scriptData.metadata && scriptData.actions;

  if (!hasStepFormat && !hasLegacyFormat) {
    return { safe: false, reason: 'Script format is unrecognized' };
  }

  // Validate basic structure integrity
  const validation = validateTestScript(scriptData);
  const criticalErrors = validation.errors.filter(e => !e.recoverable);

  if (criticalErrors.length > 0) {
    return { 
      safe: false, 
      reason: `Critical errors found: ${criticalErrors.map(e => e.message).join('; ')}` 
    };
  }

  return { safe: true };
}
