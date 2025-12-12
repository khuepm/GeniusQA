/**
 * Type definitions for Test Case Driven Automation
 * 
 * This module defines all TypeScript interfaces and types used in the test case driven
 * automation feature. It provides type safety for step-based script management, UI state
 * management, and data exchange between the React frontend and Python Core backend.
 * 
 * Requirements: 1.1, 1.2, 8.1, 8.2
 */

/**
 * Enhanced metadata for test scripts with business context
 * 
 * Extends the basic script metadata with additional fields needed for
 * test case driven automation including title, description, pre-conditions,
 * and tags for organization and searchability.
 * 
 * @interface EnhancedScriptMetadata
 * @property {string} version - Script format version (currently "2.0" for step-based)
 * @property {string} created_at - ISO 8601 timestamp of when script was created
 * @property {number} duration - Total recording time in seconds (non-negative)
 * @property {number} action_count - Number of actions in the action pool (non-negative)
 * @property {string} platform - Operating system identifier (windows, darwin, linux)
 * @property {string} title - Human-readable script title (required)
 * @property {string} description - Detailed script description (optional)
 * @property {string} pre_conditions - Prerequisites for running the script (optional)
 * @property {string[]} tags - List of tags for organization and filtering
 */
export interface EnhancedScriptMetadata {
  version: string;
  created_at: string;
  duration: number;
  action_count: number;
  platform: string;
  title: string;
  description: string;
  pre_conditions: string;
  tags: string[];
}

/**
 * Individual step in a test case with description, expected result, and action references
 * 
 * A TestStep represents a logical grouping of actions that accomplish a specific
 * test objective. Steps contain human-readable descriptions and reference actions
 * by ID rather than embedding them directly.
 * 
 * @interface TestStep
 * @property {string} id - Unique step identifier (UUID)
 * @property {number} order - Execution order (1-based, positive integer)
 * @property {string} description - Human-readable step description (required, non-empty)
 * @property {string} expected_result - Expected outcome description (optional)
 * @property {string[]} action_ids - List of action IDs referencing the action pool
 * @property {boolean} continue_on_failure - Whether to continue execution if step fails
 */
export interface TestStep {
  id: string;
  order: number;
  description: string;
  expected_result: string;
  action_ids: string[];
  continue_on_failure: boolean;
}

/**
 * Action data structure with ID support for action pool references
 * 
 * Extends the existing ActionData interface to support ID-based references
 * in the action pool architecture.
 * 
 * @interface ActionWithId
 * @extends ActionData from recorder.types.ts
 * @property {string} id - Unique action identifier for pool references
 */
export interface ActionWithId {
  id: string;
  type: 'mouse_move' | 'mouse_click' | 'key_press' | 'key_release' | 'ai_vision_capture';
  timestamp: number;
  x: number | null;
  y: number | null;
  button: 'left' | 'right' | 'middle' | null;
  key: string | null;
  screenshot: string | null;
  // AI Vision Capture specific fields (when type is 'ai_vision_capture')
  is_dynamic?: boolean;
  interaction?: 'click' | 'dblclick' | 'rclick' | 'hover';
  static_data?: any;
  dynamic_config?: any;
  cache_data?: any;
  is_assertion?: boolean; // For assertion mode
}

/**
 * Enhanced script file with hierarchical test step structure
 * 
 * TestScript extends the flat action list approach with a structured hierarchy:
 * - Metadata: Script information (title, description, pre-conditions, tags)
 * - Steps: Ordered list of test steps with descriptions and action references
 * - Action Pool: Flat repository of all actions referenced by ID
 * - Variables: Optional variable definitions for substitution
 * 
 * @interface TestScript
 * @property {EnhancedScriptMetadata} meta - Enhanced metadata with business context
 * @property {TestStep[]} steps - Ordered list of test steps
 * @property {Record<string, ActionWithId>} action_pool - Dictionary of actions keyed by ID
 * @property {Record<string, string>} variables - Optional variable definitions for substitution
 */
export interface TestScript {
  meta: EnhancedScriptMetadata;
  steps: TestStep[];
  action_pool: Record<string, ActionWithId>;
  variables: Record<string, string>;
}

/**
 * Runtime status for test step execution
 * 
 * Runtime-only status that is never persisted to script files.
 * Used for tracking execution results and UI state during playback.
 * 
 * @typedef {'passed' | 'failed' | 'skipped' | 'pending'} StepStatus
 * - passed: Step executed successfully
 * - failed: Step execution failed
 * - skipped: Step was skipped due to previous failure or conditions
 * - pending: Step has not been executed yet
 */
export type StepStatus = 'passed' | 'failed' | 'skipped' | 'pending';

/**
 * Runtime state for test step during execution
 * 
 * Contains execution results and evidence that are generated during playback
 * but never persisted to the script file. Used for UI display and reporting.
 * 
 * @interface StepRuntimeState
 * @property {StepStatus} status - Current execution status
 * @property {string} [error_message] - Error message if status is 'failed'
 * @property {string} [screenshot_proof] - Path to screenshot evidence
 * @property {number} [execution_time] - Time taken to execute step in milliseconds
 * @property {Date} [started_at] - When step execution started
 * @property {Date} [completed_at] - When step execution completed
 */
export interface StepRuntimeState {
  status: StepStatus;
  error_message?: string;
  screenshot_proof?: string;
  execution_time?: number;
  started_at?: Date;
  completed_at?: Date;
}

/**
 * Visual indicator types for test steps in the UI
 * 
 * @typedef {'manual' | 'mapped' | 'recording'} StepIndicator
 * - manual: ⚪ Step has no mapped actions (manual step)
 * - mapped: 🟢 Step has actions mapped to it
 * - recording: 🔴 Step is currently active for recording
 */
export type StepIndicator = 'manual' | 'mapped' | 'recording';

/**
 * UI state for test step in the editor
 * 
 * Combines the persistent step data with runtime UI state for display
 * and interaction in the dual-pane editor interface.
 * 
 * @interface StepUIState
 * @property {TestStep} step - The persistent step data
 * @property {StepIndicator} indicator - Visual indicator type
 * @property {boolean} selected - Whether step is currently selected
 * @property {boolean} expanded - Whether step details are expanded
 * @property {StepRuntimeState} [runtime] - Runtime execution state (if available)
 */
export interface StepUIState {
  step: TestStep;
  indicator: StepIndicator;
  selected: boolean;
  expanded: boolean;
  runtime?: StepRuntimeState;
}

/**
 * Recording state for step-based recording
 * 
 * Manages which step is currently active for recording new actions.
 * 
 * @interface StepRecordingState
 * @property {string | null} current_active_step_id - ID of step currently receiving actions
 * @property {'step' | 'setup' | 'inactive'} recording_mode - Current recording mode
 * @property {ActionWithId[]} pending_actions - Actions recorded but not yet saved
 */
export interface StepRecordingState {
  current_active_step_id: string | null;
  recording_mode: 'step' | 'setup' | 'inactive';
  pending_actions: ActionWithId[];
}

/**
 * Editor state for dual-pane interface
 * 
 * Manages the complete state of the step-based editor including
 * script data, UI state, and recording state.
 * 
 * @interface StepEditorState
 * @property {TestScript | null} script - The current test script being edited
 * @property {StepUIState[]} step_ui_states - UI state for each step
 * @property {string | null} selected_step_id - ID of currently selected step
 * @property {StepRecordingState} recording_state - Current recording state
 * @property {boolean} modified - Whether script has unsaved changes
 * @property {string | null} error - Error message to display
 */
export interface StepEditorState {
  script: TestScript | null;
  step_ui_states: StepUIState[];
  selected_step_id: string | null;
  recording_state: StepRecordingState;
  modified: boolean;
  error: string | null;
}

/**
 * Step execution progress data
 * 
 * Sent during step-based playback to update UI with current progress.
 * Extends the existing PlaybackProgress with step-level information.
 * 
 * @interface StepExecutionProgress
 * @property {number} current_step - Index of step currently being executed (0-based)
 * @property {number} total_steps - Total number of steps in the script
 * @property {number} current_action - Index of action within current step (0-based)
 * @property {number} total_actions_in_step - Total actions in current step
 * @property {string} step_description - Description of current step
 * @property {StepStatus} step_status - Current step status
 */
export interface StepExecutionProgress {
  current_step: number;
  total_steps: number;
  current_action: number;
  total_actions_in_step: number;
  step_description: string;
  step_status: StepStatus;
}

/**
 * Test report data for business-language reporting
 * 
 * Contains the results of test execution in a format suitable for
 * business stakeholders and non-technical users.
 * 
 * @interface TestReport
 * @property {string} script_title - Title of the executed script
 * @property {Date} execution_date - When the test was executed
 * @property {number} total_steps - Total number of steps
 * @property {number} passed_steps - Number of steps that passed
 * @property {number} failed_steps - Number of steps that failed
 * @property {number} skipped_steps - Number of steps that were skipped
 * @property {StepReportEntry[]} step_results - Detailed results for each step
 * @property {number} total_execution_time - Total execution time in milliseconds
 */
export interface TestReport {
  script_title: string;
  execution_date: Date;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  skipped_steps: number;
  step_results: StepReportEntry[];
  total_execution_time: number;
}

/**
 * Individual step result in test report
 * 
 * @interface StepReportEntry
 * @property {number} step_order - Step order number
 * @property {string} description - Step description
 * @property {string} expected_result - Expected result
 * @property {StepStatus} status - Execution status
 * @property {string} [error_message] - Error message if failed
 * @property {string} [screenshot_path] - Path to screenshot evidence
 * @property {number} execution_time - Time taken to execute in milliseconds
 */
export interface StepReportEntry {
  step_order: number;
  description: string;
  expected_result: string;
  status: StepStatus;
  error_message?: string;
  screenshot_path?: string;
  execution_time: number;
}

/**
 * Migration result data
 * 
 * Result of migrating a legacy script to step-based format.
 * 
 * @interface MigrationResult
 * @property {boolean} success - Whether migration succeeded
 * @property {TestScript} [migrated_script] - The migrated script (if successful)
 * @property {string} [error] - Error message (if failed)
 * @property {boolean} was_legacy - Whether the original was in legacy format
 */
export interface MigrationResult {
  success: boolean;
  migrated_script?: TestScript;
  error?: string;
  was_legacy: boolean;
}

/**
 * Step management operations
 * 
 * @typedef {'add' | 'edit' | 'delete' | 'reorder' | 'merge' | 'split'} StepOperation
 */
export type StepOperation = 'add' | 'edit' | 'delete' | 'reorder' | 'merge' | 'split';

/**
 * Step operation payload
 * 
 * Data structure for step management operations in the editor.
 * 
 * @interface StepOperationPayload
 * @property {StepOperation} operation - Type of operation to perform
 * @property {string} [step_id] - ID of step being operated on
 * @property {TestStep} [step_data] - Step data for add/edit operations
 * @property {number} [new_order] - New order for reorder operations
 * @property {string[]} [merge_step_ids] - Step IDs to merge
 * @property {string[]} [split_action_ids] - Action IDs for split operations
 */
export interface StepOperationPayload {
  operation: StepOperation;
  step_id?: string;
  step_data?: TestStep;
  new_order?: number;
  merge_step_ids?: string[];
  split_action_ids?: string[];
}
