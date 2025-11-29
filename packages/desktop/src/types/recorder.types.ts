/**
 * Type definitions for Desktop Recorder MVP
 * 
 * This module defines all TypeScript interfaces and types used in the recorder feature.
 * It provides type safety for IPC communication, UI state management, and data exchange
 * between the React Native frontend and Python Core backend.
 * 
 * Requirements: 4.1, 4.2
 */

/**
 * Application state for the recorder screen
 * 
 * @typedef {'idle' | 'recording' | 'playing'} RecorderStatus
 * - idle: No active recording or playback session
 * - recording: Currently capturing user actions
 * - playing: Currently replaying recorded actions
 */
export type RecorderStatus = 'idle' | 'recording' | 'playing';

/**
 * State interface for RecorderScreen component
 * 
 * Manages the complete state of the recorder UI including current operation status,
 * error messages, recording paths, and availability of recordings.
 * 
 * @interface RecorderScreenState
 * @property {RecorderStatus} status - Current operation state (idle/recording/playing)
 * @property {string | null} error - Error message to display, null if no error
 * @property {string | null} lastRecordingPath - Path to most recent recording file
 * @property {boolean} hasRecordings - Whether any recordings exist in storage
 */
export interface RecorderScreenState {
  status: RecorderStatus;
  error: string | null;
  lastRecordingPath: string | null;
  hasRecordings: boolean;
}

/**
 * Button state types for UI control
 * 
 * Determines which buttons should be enabled based on current application state.
 * Implements the button state logic defined in Requirements 1.5, 2.5, 4.3.
 * 
 * @interface ButtonStates
 * @property {boolean} recordEnabled - Record button enabled (only when idle)
 * @property {boolean} startEnabled - Start button enabled (only when idle with recordings)
 * @property {boolean} stopEnabled - Stop button enabled (only when recording or playing)
 */
export interface ButtonStates {
  recordEnabled: boolean;
  startEnabled: boolean;
  stopEnabled: boolean;
}

/**
 * IPC command types
 * 
 * Commands sent from React Native UI to Python Core via stdin.
 * Each command triggers a specific operation in the Python automation backend.
 * 
 * @typedef {string} IPCCommand
 * - start_recording: Begin capturing user actions
 * - stop_recording: End capture and save script file
 * - start_playback: Begin replaying recorded actions
 * - stop_playback: Interrupt ongoing playback
 * - check_recordings: Query if any recordings exist
 * - get_latest: Retrieve path to most recent recording
 * - list_scripts: Get list of all available scripts
 * - load_script: Load a specific script file
 * - save_script: Save changes to a script file
 * - delete_script: Delete a script file
 */
export type IPCCommand =
  | 'start_recording'
  | 'stop_recording'
  | 'start_playback'
  | 'stop_playback'
  | 'check_recordings'
  | 'get_latest'
  | 'list_scripts'
  | 'load_script'
  | 'save_script'
  | 'delete_script';

/**
 * IPC message sent from React Native to Python Core
 * 
 * Serialized as JSON and sent via stdin to the Python process.
 * The Python Core reads these messages and executes the requested commands.
 * 
 * @interface IPCMessage
 * @property {IPCCommand} command - The operation to perform
 * @property {Record<string, any>} [params] - Optional parameters for the command
 * 
 * @example
 * { "command": "start_recording", "params": {} }
 * { "command": "start_playback", "params": { "scriptPath": "/path/to/script.json" } }
 */
export interface IPCMessage {
  command: IPCCommand;
  params?: Record<string, any>;
}

/**
 * IPC response received from Python Core
 * 
 * Sent via stdout from Python Core after processing a command.
 * Contains operation result, data payload, or error information.
 * 
 * @interface IPCResponse
 * @property {boolean} success - Whether the operation succeeded
 * @property {any} [data] - Response data (varies by command)
 * @property {string} [error] - Error message if success is false
 * 
 * @example
 * { "success": true, "data": { "scriptPath": "/path/to/script.json", "actionCount": 42 } }
 * { "success": false, "error": "Permission denied for input monitoring" }
 */
export interface IPCResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * IPC event types
 * 
 * @typedef {string} IPCEventType
 * - progress: Playback progress update
 * - complete: Operation completed successfully
 * - error: Error occurred during operation
 * - action_preview: Preview of action about to be executed
 */
export type IPCEventType = 'progress' | 'complete' | 'error' | 'action_preview';

/**
 * IPC event message from Python Core
 * 
 * Asynchronous events sent during long-running operations like playback.
 * Allows UI to show progress and respond to completion or errors.
 * 
 * @interface IPCEvent
 * @property {IPCEventType} type - Event type
 * @property {any} data - Event-specific data payload
 * 
 * @example
 * { "type": "progress", "data": { "currentAction": 10, "totalActions": 50 } }
 * { "type": "complete", "data": {} }
 */
export interface IPCEvent {
  type: IPCEventType;
  data: any;
}

/**
 * Result of a recording session
 * 
 * Returned when stopping a recording. Contains metadata about the captured session
 * including file location, action count, and duration.
 * 
 * @interface RecordingResult
 * @property {boolean} success - Whether recording was saved successfully
 * @property {string} [scriptPath] - Absolute path to saved script file
 * @property {number} [actionCount] - Number of actions captured
 * @property {number} [duration] - Recording duration in seconds
 * @property {string} [error] - Error message if success is false
 * 
 * @example
 * {
 *   "success": true,
 *   "scriptPath": "/Users/name/GeniusQA/recordings/script_20240101_120000.json",
 *   "actionCount": 127,
 *   "duration": 45.5
 * }
 */
export interface RecordingResult {
  success: boolean;
  scriptPath?: string;
  actionCount?: number;
  duration?: number;
  error?: string;
}

/**
 * Progress data for playback events
 * 
 * Sent periodically during playback to update UI with current progress.
 * Allows displaying progress bars or status indicators.
 * 
 * @interface PlaybackProgress
 * @property {number} currentAction - Index of action currently being executed (0-based)
 * @property {number} totalActions - Total number of actions in the script
 * @property {number} currentLoop - Current loop iteration (1-indexed)
 * @property {number} totalLoops - Total number of loops (0 = infinite)
 * 
 * @example
 * { "currentAction": 25, "totalActions": 100, "currentLoop": 1, "totalLoops": 3 } // Loop 1 of 3, 25% complete
 */
export interface PlaybackProgress {
  currentAction: number;
  totalActions: number;
  currentLoop: number;
  totalLoops: number;
}

/**
 * Action data structure for preview
 * 
 * Represents a single recorded action with all its properties.
 * Used for visual preview during playback.
 * 
 * @interface ActionData
 * @property {string} type - Type of action (mouse_move, mouse_click, key_press, key_release)
 * @property {number} timestamp - Time in seconds since recording start
 * @property {number | null} x - X coordinate for mouse actions
 * @property {number | null} y - Y coordinate for mouse actions
 * @property {string | null} button - Mouse button for click actions
 * @property {string | null} key - Key identifier for keyboard actions
 * @property {string | null} screenshot - Screenshot filename if available
 */
export interface ActionData {
  type: 'mouse_move' | 'mouse_click' | 'key_press' | 'key_release';
  timestamp: number;
  x: number | null;
  y: number | null;
  button: 'left' | 'right' | 'middle' | null;
  key: string | null;
  screenshot: string | null;
}

/**
 * Action preview event data
 * 
 * Sent before each action is executed during playback.
 * Allows UI to show visual preview of what's happening.
 * 
 * @interface ActionPreviewData
 * @property {number} index - Index of the action (0-based)
 * @property {ActionData} action - The action about to be executed
 */
export interface ActionPreviewData {
  index: number;
  action: ActionData;
}
