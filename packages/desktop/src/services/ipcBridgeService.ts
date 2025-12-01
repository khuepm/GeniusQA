/**
 * IPC Bridge Service for Desktop Recorder MVP
 * 
 * This service manages all communication between the React UI and the Python Core
 * automation backend via Tauri commands and events. It uses Tauri's IPC mechanism
 * to invoke backend commands and listen for events from the Rust backend.
 * 
 * The service implements a command-response pattern with event handling for
 * asynchronous operations like playback progress updates.
 * 
 * Architecture:
 * - Uses Tauri commands for request/response operations
 * - Uses Tauri events for async notifications (progress, complete, error)
 * - Python process managed by Rust backend
 * - Event-driven architecture for async operations
 * - Automatic error propagation and formatting
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 * Validates: Property 10 (IPC error propagation)
 */

import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  IPCEvent,
  RecordingResult,
} from '../types/recorder.types';

/**
 * Configuration for IPC Bridge
 */
interface IPCBridgeConfig {
  // Configuration options can be added here if needed in the future
}

/**
 * Tauri event payload structure
 */
interface TauriEventPayload {
  type: string;
  data: any;
}

/**
 * IPC Bridge Service
 * Handles all communication with Python Core via Tauri backend
 */
export class IPCBridgeService {
  private eventListeners: Map<string, ((event: IPCEvent) => void)[]> = new Map();
  private unlistenFunctions: UnlistenFn[] = [];

  constructor(config: IPCBridgeConfig = {}) {
    // Initialize event listeners for Tauri events
    this.initializeEventListeners();
  }

  /**
   * Initialize Tauri event listeners
   */
  private async initializeEventListeners(): Promise<void> {
    try {
      // Listen for all Python events (progress, action_preview, complete, error)
      const eventTypes = ['progress', 'action_preview', 'complete', 'error'];
      
      for (const eventType of eventTypes) {
        const unlisten = await listen<any>(eventType, (event) => {
          console.log(`[IPC Bridge] Received ${eventType} event:`, event.payload);
          this.emitEvent({
            type: eventType as any,
            data: event.payload,
          });
        });
        this.unlistenFunctions.push(unlisten);
      }
      
      console.log('[IPC Bridge] Event listeners initialized');
    } catch (error) {
      console.error('[IPC Bridge] Failed to initialize Tauri event listeners:', error);
    }
  }

  /**
   * Emit an event to registered listeners
   */
  private emitEvent(event: IPCEvent): void {
    const listeners = this.eventListeners.get(event.type) || [];
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    }
  }

  /**
   * Register an event listener
   */
  public addEventListener(
    eventType: string,
    listener: (event: IPCEvent) => void
  ): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * Remove an event listener
   */
  public removeEventListener(
    eventType: string,
    listener: (event: IPCEvent) => void
  ): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Start recording user interactions
   * 
   * Invokes the Tauri start_recording command, which begins capturing all
   * mouse movements, clicks, and keyboard inputs. The recording continues until
   * stopRecording() is called.
   * 
   * @throws {Error} If Python Core is unavailable or recording fails to start
   * @throws {Error} If a recording is already in progress
   * @throws {Error} If permissions are insufficient (macOS Accessibility)
   * 
   * @example
   * try {
   *   await ipcBridge.startRecording();
   *   console.log('Recording started');
   * } catch (error) {
   *   console.error('Failed to start recording:', error.message);
   * }
   * 
   * Requirements: 1.1, 5.1, 5.3
   */
  public async startRecording(): Promise<void> {
    try {
      console.log('[IPC Bridge] Invoking start_recording command...');
      await invoke('start_recording');
      console.log('[IPC Bridge] start_recording command successful');
    } catch (error) {
      console.error('[IPC Bridge] start_recording command failed:', error);
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Stop recording and save to file
   * 
   * Invokes the Tauri stop_recording command, which terminates the active
   * recording session and saves all captured actions to a JSON script file in
   * the local recordings directory (~/ GeniusQA/recordings/).
   * 
   * @returns {Promise<RecordingResult>} Result object containing success status,
   *   script file path, action count, duration, or error message
   * 
   * @example
   * const result = await ipcBridge.stopRecording();
   * if (result.success) {
   *   console.log(`Saved ${result.actionCount} actions to ${result.scriptPath}`);
   *   console.log(`Duration: ${result.duration} seconds`);
   * } else {
   *   console.error('Recording failed:', result.error);
   * }
   * 
   * Requirements: 1.3, 1.4, 5.1, 5.3, 6.1, 6.3
   * Validates: Property 7 (Recording termination saves file)
   */
  public async stopRecording(): Promise<RecordingResult> {
    try {
      console.log('[IPC Bridge] Invoking stop_recording command...');
      const result = await invoke<RecordingResult>('stop_recording');
      console.log('[IPC Bridge] stop_recording result:', result);
      // Tauri returns the RecordingResult struct directly, add success field
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('[IPC Bridge] stop_recording command failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop recording',
      };
    }
  }

  /**
   * Start playback of a recorded script
   * 
   * Invokes the Tauri start_playback command, which loads the specified script
   * file (or the most recent one if no path provided) and begins executing the
   * recorded actions with accurate timing preservation.
   * 
   * @param {string} [scriptPath] - Optional path to specific script file. If omitted,
   *   plays the most recent recording
   * @param {number} [speed] - Optional playback speed multiplier (0.5 = half speed, 2.0 = double speed).
   *   Default is 1.0. Valid range: 0.1x to 10x
   * @param {number} [loopCount] - Optional number of times to repeat playback (1 = play once, 0 = infinite loop).
   *   Default is 1
   * 
   * @throws {Error} If Python Core is unavailable or playback fails to start
   * @throws {Error} If no recordings exist (when scriptPath not provided)
   * @throws {Error} If script file is corrupted or invalid
   * @throws {Error} If permissions are insufficient (macOS Accessibility)
   * @throws {Error} If a playback is already in progress
   * 
   * @example
   * // Play most recent recording at normal speed once
   * await ipcBridge.startPlayback();
   * 
   * @example
   * // Play specific recording at double speed, repeat 3 times
   * await ipcBridge.startPlayback('/path/to/script_20240101_120000.json', 2.0, 3);
   * 
   * @example
   * // Play at half speed for debugging, infinite loop
   * await ipcBridge.startPlayback(undefined, 0.5, 0);
   * 
   * Requirements: 2.1, 2.2, 5.1, 5.3
   * Validates: Property 3 (Playback executes actions in order)
   * Validates: Property 4 (Timing preservation during playback)
   */
  public async startPlayback(scriptPath?: string, speed?: number, loopCount?: number): Promise<void> {
    try {
      console.log('[IPC Bridge] Invoking start_playback command...', { scriptPath, speed, loopCount });
      await invoke('start_playback', {
        scriptPath: scriptPath || null,
        speed: speed || 1.0,
        loopCount: loopCount || 1,
      });
      console.log('[IPC Bridge] start_playback command successful');
    } catch (error) {
      console.error('[IPC Bridge] start_playback command failed:', error);
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Stop current playback
   * 
   * Invokes the Tauri stop_playback command, which immediately interrupts
   * the active playback session. Any remaining actions in the script are not executed.
   * 
   * @throws {Error} If Python Core is unavailable
   * @throws {Error} If no playback is currently active
   * 
   * @example
   * await ipcBridge.stopPlayback();
   * console.log('Playback stopped');
   * 
   * Requirements: 2.3, 5.1, 5.3
   */
  public async stopPlayback(): Promise<void> {
    try {
      console.log('[IPC Bridge] Invoking stop_playback command...');
      await invoke('stop_playback');
      console.log('[IPC Bridge] stop_playback command successful');
    } catch (error) {
      console.error('[IPC Bridge] stop_playback command failed:', error);
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Pause/Resume current playback
   * 
   * Invokes the Tauri pause_playback command, which toggles the pause state
   * of the active playback session.
   * 
   * @returns {Promise<boolean>} True if playback is now paused, false if resumed
   * @throws {Error} If Python Core is unavailable
   * @throws {Error} If no playback is currently active
   * 
   * Requirements: 2.3
   */
  public async pausePlayback(): Promise<boolean> {
    try {
      console.log('[IPC Bridge] Invoking pause_playback command...');
      const isPaused = await invoke<boolean>('pause_playback');
      console.log('[IPC Bridge] pause_playback command successful, isPaused:', isPaused);
      return isPaused;
    } catch (error) {
      console.error('[IPC Bridge] pause_playback command failed:', error);
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Check if any recordings exist
   * 
   * Invokes the Tauri check_recordings command to determine if any script files
   * exist in the recordings directory. Used to enable/disable the Start button in the UI.
   * 
   * @returns {Promise<boolean>} True if at least one recording exists, false otherwise
   * 
   * @throws {Error} If Python Core is unavailable
   * @throws {Error} If file system access fails
   * 
   * @example
   * const hasRecordings = await ipcBridge.checkForRecordings();
   * if (hasRecordings) {
   *   console.log('Recordings available for playback');
   * } else {
   *   console.log('No recordings found. Record a session first.');
   * }
   * 
   * Requirements: 2.5, 5.1, 5.3, 6.4
   */
  public async checkForRecordings(): Promise<boolean> {
    try {
      const result = await invoke<boolean>('check_recordings');
      return result;
    } catch (error) {
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Get the path to the latest recording
   * 
   * Invokes the Tauri get_latest command for the path to the most recently created
   * script file. Used to determine which recording to play when startPlayback() is
   * called without a specific path.
   * 
   * @returns {Promise<string | null>} Absolute path to latest script file, or null
   *   if no recordings exist
   * 
   * @throws {Error} If Python Core is unavailable
   * @throws {Error} If file system access fails
   * 
   * @example
   * const latestPath = await ipcBridge.getLatestRecording();
   * if (latestPath) {
   *   console.log('Latest recording:', latestPath);
   *   await ipcBridge.startPlayback(latestPath);
   * } else {
   *   console.log('No recordings available');
   * }
   * 
   * Requirements: 5.1, 5.3, 6.5
   * Validates: Property 9 (Latest recording identification)
   */
  public async getLatestRecording(): Promise<string | null> {
    try {
      const result = await invoke<string | null>('get_latest');
      return result;
    } catch (error) {
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Format error message for user display
   */
  private formatErrorMessage(error: Error): string {
    const message = error.message;
    
    // Handle empty or missing error messages
    if (!message || message.trim() === '' || message === 'Unknown error') {
      return 'An unknown error occurred. Please try again.';
    }
    
    // Check for Python process errors
    if (message.includes('Broken pipe') || message.includes('Failed to write to Python stdin')) {
      return 'Python process is not running or has crashed. Please ensure:\n' +
             '1. Python 3.9+ is installed (python3 --version)\n' +
             '2. Dependencies are installed (cd packages/python-core && pip3 install -r requirements.txt)\n' +
             '3. Restart the application';
    }
    
    if (message.includes('Failed to spawn Python process')) {
      return 'Failed to start Python process. Please ensure:\n' +
             '1. Python 3.9+ is installed (python3 --version)\n' +
             '2. Python is in your system PATH\n' +
             '3. Try restarting the application';
    }
    
    if (message.includes('Python process not running')) {
      return 'Python process is not running. Please restart the application.';
    }
    
    // Check for common error patterns and provide helpful guidance
    if (message.includes('Permission denied') || message.includes('Accessibility')) {
      return message; // Already formatted by Python Core
    }
    
    if (message.includes('No recordings found')) {
      return 'No recordings found. Please record a session first by clicking the Record button.';
    }
    
    if (message.includes('Script file corrupted') || message.includes('Invalid JSON')) {
      return 'The recording file is corrupted or invalid. Please create a new recording.';
    }
    
    if (message.includes('Python Core unavailable') || message.includes('not found')) {
      return message; // Already formatted
    }
    
    if (message.includes('timed out')) {
      return 'Operation timed out. The Python Core may be unresponsive. Please try again.';
    }
    
    if (message.includes('already in progress')) {
      return message; // Clear as-is
    }
    
    // Default: return original message
    return message;
  }

  /**
   * List all available scripts
   * 
   * Invokes the Tauri list_scripts command for a list of all script files in the
   * recordings directory. Returns metadata for each script including filename, path,
   * creation date, duration, and action count.
   * 
   * @returns {Promise<Array>} Array of script information objects
   * 
   * @throws {Error} If Python Core is unavailable
   * @throws {Error} If file system access fails
   * 
   * @example
   * const scripts = await ipcBridge.listScripts();
   * scripts.forEach(script => {
   *   console.log(`${script.filename}: ${script.action_count} actions`);
   * });
   */
  public async listScripts(): Promise<any[]> {
    try {
      const result = await invoke<any[]>('list_scripts');
      return result;
    } catch (error) {
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Load a specific script file
   * 
   * Loads and parses a script file from the given path. Returns the complete
   * script data including metadata and all actions.
   * 
   * @param {string} scriptPath - Absolute path to the script file
   * @returns {Promise<any>} Script data with metadata and actions
   * 
   * @throws {Error} If Python Core is unavailable
   * @throws {Error} If script file not found
   * @throws {Error} If script file is corrupted or invalid
   * 
   * @example
   * const scriptData = await ipcBridge.loadScript('/path/to/script.json');
   * console.log(`Loaded ${scriptData.actions.length} actions`);
   */
  public async loadScript(scriptPath: string): Promise<any> {
    try {
      const result = await invoke<any>('load_script', { scriptPath });
      return result;
    } catch (error) {
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Save changes to a script file
   * 
   * Saves the modified script data back to the file. Validates the script
   * structure before saving to ensure data integrity.
   * 
   * @param {string} scriptPath - Absolute path to the script file
   * @param {any} scriptData - Complete script data with metadata and actions
   * 
   * @throws {Error} If Python Core is unavailable
   * @throws {Error} If script data is invalid
   * @throws {Error} If file write fails
   * 
   * @example
   * await ipcBridge.saveScript('/path/to/script.json', modifiedScriptData);
   * console.log('Script saved successfully');
   */
  public async saveScript(scriptPath: string, scriptData: any): Promise<void> {
    try {
      await invoke('save_script', { scriptPath, scriptData });
    } catch (error) {
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Delete a script file
   * 
   * Permanently deletes a script file from the recordings directory.
   * This operation cannot be undone.
   * 
   * @param {string} scriptPath - Absolute path to the script file
   * 
   * @throws {Error} If Python Core is unavailable
   * @throws {Error} If script file not found
   * @throws {Error} If file deletion fails
   * 
   * @example
   * await ipcBridge.deleteScript('/path/to/script.json');
   * console.log('Script deleted successfully');
   */
  public async deleteScript(scriptPath: string): Promise<void> {
    try {
      await invoke('delete_script', { scriptPath });
    } catch (error) {
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Cleanup event listeners
   */
  public terminate(): void {
    // Unlisten from all Tauri events
    for (const unlisten of this.unlistenFunctions) {
      unlisten();
    }
    this.unlistenFunctions = [];
    this.eventListeners.clear();
  }
}

// Export singleton instance
let ipcBridgeInstance: IPCBridgeService | null = null;

export function getIPCBridge(config?: IPCBridgeConfig): IPCBridgeService {
  if (!ipcBridgeInstance) {
    ipcBridgeInstance = new IPCBridgeService(config);
  }
  return ipcBridgeInstance;
}

export function resetIPCBridge(): void {
  if (ipcBridgeInstance) {
    ipcBridgeInstance.terminate();
    ipcBridgeInstance = null;
  }
}
