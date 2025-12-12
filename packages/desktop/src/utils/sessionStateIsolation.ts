/**
 * Session State Isolation Utility
 * 
 * Ensures proper separation between persistent script data and runtime execution state.
 * Provides utilities to clean runtime state when loading scripts and prevent
 * runtime data from being persisted to script files.
 * 
 * Requirements: 8.4
 */

import { 
  TestScript, 
  StepUIState, 
  StepEditorState, 
  StepRuntimeState,
  StepRecordingState 
} from '../types/testCaseDriven.types';

/**
 * Create a clean editor state from a loaded script
 * 
 * Initializes a fresh StepEditorState without any runtime execution results.
 * This ensures that when a script is reopened, it shows the original step
 * indicators without any previous execution status.
 * 
 * @param script - The loaded test script
 * @returns Clean editor state without runtime data
 * 
 * Requirements: 8.4
 * Validates: Property 20 (Session State Isolation)
 */
export function createCleanEditorState(script: TestScript): StepEditorState {
  // Create clean step UI states without runtime data
  const step_ui_states: StepUIState[] = script.steps.map(step => ({
    step,
    indicator: step.action_ids.length > 0 ? 'mapped' : 'manual',
    selected: false,
    expanded: false,
    // Explicitly omit runtime property to ensure clean state
  }));

  // Create clean recording state
  const recording_state: StepRecordingState = {
    current_active_step_id: null,
    recording_mode: 'inactive',
    pending_actions: [],
  };

  return {
    script,
    step_ui_states,
    selected_step_id: script.steps.length > 0 ? script.steps[0].id : null,
    recording_state,
    modified: false,
    error: null,
  };
}

/**
 * Strip runtime data from step UI states
 * 
 * Removes all runtime execution data from step UI states, ensuring
 * that only persistent step data remains. Used before saving or
 * when resetting session state.
 * 
 * @param stepUIStates - Array of step UI states to clean
 * @returns Clean step UI states without runtime data
 * 
 * Requirements: 8.4
 */
export function stripRuntimeData(stepUIStates: StepUIState[]): StepUIState[] {
  return stepUIStates.map(stepState => ({
    step: stepState.step,
    indicator: stepState.step.action_ids.length > 0 ? 'mapped' : 'manual',
    selected: false,
    expanded: false,
    // Explicitly omit runtime property
  }));
}

/**
 * Validate that a script contains no runtime data
 * 
 * Ensures that a TestScript object contains only persistent data
 * and no runtime execution results. Used to validate scripts
 * before saving to prevent runtime data leakage.
 * 
 * @param script - The test script to validate
 * @returns Validation result with success flag and issues if any
 * 
 * Requirements: 8.4
 */
export function validateScriptPurity(script: TestScript): {
  isPure: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check that script contains only expected persistent fields
  const allowedScriptFields = ['meta', 'steps', 'action_pool', 'variables'];
  const scriptFields = Object.keys(script);
  
  for (const field of scriptFields) {
    if (!allowedScriptFields.includes(field)) {
      issues.push(`Unexpected field in script: ${field}`);
    }
  }

  // Check that steps contain only persistent data
  for (let i = 0; i < script.steps.length; i++) {
    const step = script.steps[i];
    const allowedStepFields = [
      'id', 'order', 'description', 'expected_result', 
      'action_ids', 'continue_on_failure', 'execution_condition'
    ];
    const stepFields = Object.keys(step);
    
    for (const field of stepFields) {
      if (!allowedStepFields.includes(field)) {
        issues.push(`Unexpected field in step ${i + 1}: ${field}`);
      }
    }

    // Check for runtime-like fields that shouldn't be persisted
    const runtimeFields = ['status', 'error_message', 'screenshot_proof', 'execution_time', 'started_at', 'completed_at'];
    for (const runtimeField of runtimeFields) {
      if (runtimeField in step) {
        issues.push(`Runtime field found in step ${i + 1}: ${runtimeField}`);
      }
    }
  }

  // Check that actions contain only persistent data
  for (const [actionId, action] of Object.entries(script.action_pool)) {
    const allowedActionFields = [
      'id', 'type', 'timestamp', 'x', 'y', 'button', 'key', 'screenshot',
      'is_dynamic', 'interaction', 'static_data', 'dynamic_config', 'cache_data', 'is_assertion'
    ];
    const actionFields = Object.keys(action);
    
    for (const field of actionFields) {
      if (!allowedActionFields.includes(field)) {
        issues.push(`Unexpected field in action ${actionId}: ${field}`);
      }
    }
  }

  return {
    isPure: issues.length === 0,
    issues,
  };
}

/**
 * Create a clean copy of a script for saving
 * 
 * Creates a deep copy of a TestScript with all runtime data stripped out.
 * This ensures that only persistent data is saved to the script file.
 * 
 * @param script - The script to clean
 * @returns Clean copy suitable for persistence
 * 
 * Requirements: 8.4
 */
export function createCleanScriptCopy(script: TestScript): TestScript {
  // Deep clone the script to avoid modifying the original
  const cleanScript: TestScript = {
    meta: { ...script.meta },
    steps: script.steps.map(step => ({
      id: step.id,
      order: step.order,
      description: step.description,
      expected_result: step.expected_result,
      action_ids: [...step.action_ids],
      continue_on_failure: step.continue_on_failure,
      ...(step.execution_condition && { execution_condition: step.execution_condition }),
    })),
    action_pool: { ...script.action_pool },
    variables: { ...script.variables },
  };

  return cleanScript;
}

/**
 * Reset editor state to clean session
 * 
 * Clears all runtime data from the editor state while preserving
 * the persistent script data. Used when starting a new session
 * or after execution completes.
 * 
 * @param editorState - Current editor state
 * @returns Clean editor state for new session
 * 
 * Requirements: 8.4
 */
export function resetToCleanSession(editorState: StepEditorState): StepEditorState {
  if (!editorState.script) {
    return editorState;
  }

  return createCleanEditorState(editorState.script);
}

/**
 * Check if editor state contains runtime data
 * 
 * Determines whether the current editor state contains any runtime
 * execution data that should not be persisted.
 * 
 * @param editorState - Editor state to check
 * @returns True if runtime data is present
 * 
 * Requirements: 8.4
 */
export function hasRuntimeData(editorState: StepEditorState): boolean {
  // Check if any step UI states have runtime data
  const hasStepRuntimeData = editorState.step_ui_states.some(stepState => 
    stepState.runtime !== undefined
  );

  // Check if recording state has pending actions
  const hasPendingActions = editorState.recording_state.pending_actions.length > 0;

  // Check if recording is active
  const isRecordingActive = editorState.recording_state.recording_mode !== 'inactive';

  return hasStepRuntimeData || hasPendingActions || isRecordingActive;
}

/**
 * Get session state summary
 * 
 * Provides a summary of the current session state for debugging
 * and validation purposes.
 * 
 * @param editorState - Editor state to summarize
 * @returns Summary of session state
 */
export function getSessionStateSummary(editorState: StepEditorState): {
  hasScript: boolean;
  stepCount: number;
  stepsWithRuntime: number;
  pendingActions: number;
  recordingMode: string;
  isModified: boolean;
  hasRuntimeData: boolean;
} {
  const stepsWithRuntime = editorState.step_ui_states.filter(s => s.runtime).length;
  
  return {
    hasScript: editorState.script !== null,
    stepCount: editorState.step_ui_states.length,
    stepsWithRuntime,
    pendingActions: editorState.recording_state.pending_actions.length,
    recordingMode: editorState.recording_state.recording_mode,
    isModified: editorState.modified,
    hasRuntimeData: hasRuntimeData(editorState),
  };
}
