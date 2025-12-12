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
import { CoreStatus, PerformanceMetrics, PerformanceComparison, UserSettings } from '../components/CoreSelector';
import {
  AIVisionCaptureAction,
  AIVisionRequest,
  AIVisionResponse,
  CacheData,
  ScreenDimensions,
} from '../types/aiVisionCapture.types';

/**
 * Configuration for IPC Bridge
 */
interface IPCBridgeConfig {
  // Configuration options can be added here if needed in the future
}



/**
 * IPC Bridge Service
 * Handles all communication with Python Core via Tauri backend
 */
export class IPCBridgeService {
  private eventListeners: Map<string, ((event: IPCEvent) => void)[]> = new Map();
  private unlistenFunctions: UnlistenFn[] = [];

  constructor(_config: IPCBridgeConfig = {}) {
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
      // Get current core status for logging (gracefully handle failures)
      let coreType = 'unknown';
      try {
        const coreStatus = await this.getCoreStatus();
        coreType = coreStatus.activeCoreType;
      } catch {
        // Ignore core status errors for logging purposes
      }
      
      console.log(`[IPC Bridge] Invoking start_recording command with ${coreType} core...`);
      
      await invoke('start_recording');
      console.log(`[IPC Bridge] start_recording command successful with ${coreType} core`);
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
      // Get current core status for logging (gracefully handle failures)
      let coreType = 'unknown';
      try {
        const coreStatus = await this.getCoreStatus();
        coreType = coreStatus.activeCoreType;
      } catch {
        // Ignore core status errors for logging purposes
      }
      
      console.log(`[IPC Bridge] Invoking stop_recording command with ${coreType} core...`);
      
      const result = await invoke<RecordingResult>('stop_recording');
      console.log(`[IPC Bridge] stop_recording result with ${coreType} core:`, result);
      // Tauri returns the RecordingResult struct directly
      return {
        ...result,
        success: true,
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
      // Get current core status for logging (gracefully handle failures)
      let coreType = 'unknown';
      try {
        const coreStatus = await this.getCoreStatus();
        coreType = coreStatus.activeCoreType;
      } catch {
        // Ignore core status errors for logging purposes
      }
      
      console.log(`[IPC Bridge] Invoking start_playback command with ${coreType} core...`, { scriptPath, speed, loopCount });
      
      await invoke('start_playback', {
        scriptPath: scriptPath || null,
        speed: speed || 1.0,
        loopCount: loopCount || 1,
      });
      console.log(`[IPC Bridge] start_playback command successful with ${coreType} core`);
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
    
    // Check for Rust core "not yet implemented" errors
    if (message.includes('Rust core recording not yet fully integrated')) {
      return 'Rust Core does not support recording yet.\n\n' +
             'Please switch to Python Core to use recording features.\n\n' +
             'Click on "Python Core" in the Core Selector above.';
    }
    
    if (message.includes('Rust core playback not yet fully integrated')) {
      return 'Rust Core does not support playback yet.\n\n' +
             'Please switch to Python Core to use playback features.\n\n' +
             'Click on "Python Core" in the Core Selector above.';
    }
    
    if (message.includes('Rust core') && message.includes('not yet fully integrated')) {
      return 'This feature is not yet available in Rust Core.\n\n' +
             'Please switch to Python Core to use this feature.\n\n' +
             'Click on "Python Core" in the Core Selector above.';
    }
    
    // Check for fallback errors
    if (message.includes('Failed to fallback') && message.includes('Python core is not healthy')) {
      return 'Rust Core does not support this operation yet, and Python Core is not available.\n\n' +
             'Please ensure Python Core is properly configured:\n' +
             '1. Python 3.9+ is installed (python3 --version)\n' +
             '2. Dependencies are installed (cd packages/python-core && pip3 install -r requirements.txt)\n' +
             '3. Restart the application\n\n' +
             'Then switch to Python Core to use this feature.';
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
   * Select automation core (Python or Rust)
   * 
   * Invokes the Tauri select_core command to switch between automation backends.
   * Validates that the target core is available before switching.
   * 
   * @param {CoreType} coreType - The core to switch to ('python' or 'rust')
   * 
   * @throws {Error} If target core is unavailable
   * @throws {Error} If core switching fails
   * @throws {Error} If core validation fails
   * 
   * @example
   * await ipcBridge.selectCore('rust');
   * console.log('Switched to Rust core');
   * 
   * Requirements: 1.2, 1.3, 6.1, 10.1
   */
  public async selectCore(coreType: 'python' | 'rust'): Promise<void> {
    try {
      console.log('[IPC Bridge] Invoking select_core command...', { coreType });
      await invoke('select_core', { coreType });
      console.log('[IPC Bridge] select_core command successful');
    } catch (error) {
      console.error('[IPC Bridge] select_core command failed:', error);
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Get available automation cores
   * 
   * Invokes the Tauri get_available_cores command to detect which cores
   * are installed and functional.
   * 
   * @returns {Promise<string[]>} Array of available core names
   * 
   * @throws {Error} If core detection fails
   * 
   * @example
   * const cores = await ipcBridge.getAvailableCores();
   * console.log('Available cores:', cores); // ['python', 'rust']
   * 
   * Requirements: 1.2, 1.3, 6.1, 10.1
   */
  public async getAvailableCores(): Promise<string[]> {
    try {
      console.log('[IPC Bridge] Invoking get_available_cores command...');
      const result = await invoke<string[]>('get_available_cores');
      console.log('[IPC Bridge] get_available_cores result:', result);
      return result;
    } catch (error) {
      console.error('[IPC Bridge] get_available_cores command failed:', error);
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Get current core status
   * 
   * Invokes the Tauri get_core_status command to get information about
   * the currently active core and health status of all cores.
   * 
   * @returns {Promise<CoreStatus>} Core status information
   * 
   * @throws {Error} If status retrieval fails
   * 
   * @example
   * const status = await ipcBridge.getCoreStatus();
   * console.log('Active core:', status.activeCoreType);
   * console.log('Available cores:', status.availableCores);
   * 
   * Requirements: 1.2, 4.5, 8.1, 8.3
   */
  public async getCoreStatus(): Promise<CoreStatus> {
    try {
      console.log('[IPC Bridge] Invoking get_core_status command...');
      const result = await invoke<CoreStatus>('get_core_status');
      console.log('[IPC Bridge] get_core_status result:', result);
      return result;
    } catch (error) {
      console.error('[IPC Bridge] get_core_status command failed:', error);
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Get performance metrics for cores
   * 
   * Invokes the Tauri get_core_performance_metrics command to retrieve
   * performance data for all available cores.
   * 
   * @returns {Promise<PerformanceMetrics[]>} Array of performance metrics
   * 
   * @throws {Error} If metrics retrieval fails
   * 
   * @example
   * const metrics = await ipcBridge.getCorePerformanceMetrics();
   * metrics.forEach(m => {
   *   console.log(`${m.coreType}: ${m.lastOperationTime}ms`);
   * });
   * 
   * Requirements: 1.2, 1.3, 6.1, 10.1
   */
  public async getCorePerformanceMetrics(): Promise<PerformanceMetrics[]> {
    try {
      console.log('[IPC Bridge] Invoking get_core_performance_metrics command...');
      const result = await invoke<PerformanceMetrics[]>('get_core_performance_metrics');
      console.log('[IPC Bridge] get_core_performance_metrics result:', result);
      return result;
    } catch (error) {
      console.error('[IPC Bridge] get_core_performance_metrics command failed:', error);
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Get performance comparison between cores
   * 
   * Invokes the Tauri get_performance_comparison command to retrieve
   * a detailed comparison of performance metrics between Python and Rust cores,
   * including recommendations for which core to use.
   * 
   * @returns {Promise<PerformanceComparison>} Performance comparison data
   * 
   * @throws {Error} If comparison retrieval fails
   * 
   * @example
   * const comparison = await ipcBridge.getPerformanceComparison();
   * console.log('Recommended core:', comparison.recommendation.recommendedCore);
   * console.log('Confidence:', comparison.recommendation.confidence);
   * console.log('Reasons:', comparison.recommendation.reasons);
   * 
   * Requirements: 10.2, 10.3, 10.4
   */
  public async getPerformanceComparison(): Promise<PerformanceComparison> {
    try {
      console.log('[IPC Bridge] Invoking get_performance_comparison command...');
      const result = await invoke<PerformanceComparison>('get_performance_comparison');
      console.log('[IPC Bridge] get_performance_comparison result:', result);
      return result;
    } catch (error) {
      console.error('[IPC Bridge] get_performance_comparison command failed:', error);
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Get current user settings
   * 
   * @returns Promise<UserSettings | null> Current user settings or null if not available
   * 
   * @example
   * const settings = await ipcBridge.getUserSettings();
   * if (settings) {
   *   console.log('Playback speed:', settings.playbackSpeed);
   *   console.log('Loop count:', settings.loopCount);
   * }
   * 
   * Requirements: 7.4, 7.5
   */
  public async getUserSettings(): Promise<UserSettings | null> {
    try {
      console.log('[IPC Bridge] Invoking get_user_settings command...');
      const result = await invoke<UserSettings | null>('get_user_settings');
      console.log('[IPC Bridge] get_user_settings result:', result);
      return result;
    } catch (error) {
      console.error('[IPC Bridge] get_user_settings failed:', error);
      throw new Error(`Failed to get user settings: ${error}`);
    }
  }

  /**
   * Update user settings
   * 
   * @param settings - The user settings to update
   * 
   * @example
   * await ipcBridge.updateUserSettings({
   *   playbackSpeed: 2.0,
   *   loopCount: 3,
   *   selectedScriptPath: '/path/to/script.json',
   *   uiState: { showPreview: true, previewOpacity: 0.8 }
   * });
   * 
   * Requirements: 7.4, 7.5
   */
  public async updateUserSettings(settings: UserSettings): Promise<void> {
    try {
      console.log('[IPC Bridge] Invoking update_user_settings command...', { settings });
      await invoke<void>('update_user_settings', { settings });
      console.log('[IPC Bridge] update_user_settings completed successfully');
    } catch (error) {
      console.error('[IPC Bridge] update_user_settings failed:', error);
      throw new Error(`Failed to update user settings: ${error}`);
    }
  }

  /**
   * Set playback speed setting
   * 
   * @param speed - The playback speed (e.g., 0.5, 1.0, 1.5, 2.0, 5.0)
   * 
   * @example
   * await ipcBridge.setPlaybackSpeed(2.0);
   * 
   * Requirements: 7.4, 7.5
   */
  public async setPlaybackSpeed(speed: number): Promise<void> {
    try {
      console.log('[IPC Bridge] Invoking set_playback_speed command...', { speed });
      await invoke<void>('set_playback_speed', { speed });
      console.log('[IPC Bridge] set_playback_speed completed successfully');
    } catch (error) {
      console.error('[IPC Bridge] set_playback_speed failed:', error);
      throw new Error(`Failed to set playback speed: ${error}`);
    }
  }

  /**
   * Set loop count setting
   * 
   * @param count - The loop count (0 for infinite, positive number for specific count)
   * 
   * @example
   * await ipcBridge.setLoopCount(3);
   * await ipcBridge.setLoopCount(0); // Infinite loops
   * 
   * Requirements: 7.4, 7.5
   */
  public async setLoopCount(count: number): Promise<void> {
    try {
      console.log('[IPC Bridge] Invoking set_loop_count command...', { count });
      await invoke<void>('set_loop_count', { count });
      console.log('[IPC Bridge] set_loop_count completed successfully');
    } catch (error) {
      console.error('[IPC Bridge] set_loop_count failed:', error);
      throw new Error(`Failed to set loop count: ${error}`);
    }
  }

  /**
   * Set selected script path
   * 
   * @param path - The script path to select (null to clear selection)
   * 
   * @example
   * await ipcBridge.setSelectedScriptPath('/path/to/script.json');
   * await ipcBridge.setSelectedScriptPath(null); // Clear selection
   * 
   * Requirements: 7.4, 7.5
   */
  public async setSelectedScriptPath(path: string | null): Promise<void> {
    try {
      console.log('[IPC Bridge] Invoking set_selected_script_path command...', { path });
      await invoke<void>('set_selected_script_path', { path });
      console.log('[IPC Bridge] set_selected_script_path completed successfully');
    } catch (error) {
      console.error('[IPC Bridge] set_selected_script_path failed:', error);
      throw new Error(`Failed to set selected script path: ${error}`);
    }
  }

  /**
   * Set show preview setting
   * 
   * @param showPreview - Whether to show visual preview
   * 
   * @example
   * await ipcBridge.setShowPreview(true);
   * 
   * Requirements: 7.4, 7.5
   */
  public async setShowPreview(showPreview: boolean): Promise<void> {
    try {
      console.log('[IPC Bridge] Invoking set_show_preview command...', { showPreview });
      await invoke<void>('set_show_preview', { showPreview });
      console.log('[IPC Bridge] set_show_preview completed successfully');
    } catch (error) {
      console.error('[IPC Bridge] set_show_preview failed:', error);
      throw new Error(`Failed to set show preview: ${error}`);
    }
  }

  /**
   * Set preview opacity setting
   * 
   * @param opacity - The preview opacity (0.0 to 1.0)
   * 
   * @example
   * await ipcBridge.setPreviewOpacity(0.8);
   * 
   * Requirements: 7.4, 7.5
   */
  public async setPreviewOpacity(opacity: number): Promise<void> {
    try {
      console.log('[IPC Bridge] Invoking set_preview_opacity command...', { opacity });
      await invoke<void>('set_preview_opacity', { opacity });
      console.log('[IPC Bridge] set_preview_opacity completed successfully');
    } catch (error) {
      console.error('[IPC Bridge] set_preview_opacity failed:', error);
      throw new Error(`Failed to set preview opacity: ${error}`);
    }
  }

  /**
   * Save an asset file (e.g., reference image)
   * 
   * Saves binary data (base64 encoded) to the specified path.
   * Creates parent directories if they don't exist.
   * 
   * @param {string} assetPath - Absolute path to save the asset
   * @param {string} base64Data - Base64 encoded file data
   * 
   * @throws {Error} If file write fails
   * @throws {Error} If directory creation fails
   * 
   * @example
   * await ipcBridge.saveAsset('/path/to/assets/image.png', base64ImageData);
   * 
   * Requirements: 5.5, 2.6
   */
  public async saveAsset(assetPath: string, base64Data: string): Promise<void> {
    try {
      console.log('[IPC Bridge] Invoking save_asset command...', { assetPath });
      await invoke('save_asset', { assetPath, base64Data });
      console.log('[IPC Bridge] save_asset command successful');
    } catch (error) {
      console.error('[IPC Bridge] save_asset command failed:', error);
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Load an asset file (e.g., reference image)
   * 
   * Loads binary data from the specified path and returns it as base64.
   * 
   * @param {string} assetPath - Absolute path to the asset
   * @returns {Promise<string>} Base64 encoded file data
   * 
   * @throws {Error} If file not found
   * @throws {Error} If file read fails
   * 
   * @example
   * const base64Data = await ipcBridge.loadAsset('/path/to/assets/image.png');
   * 
   * Requirements: 5.10
   */
  public async loadAsset(assetPath: string): Promise<string> {
    try {
      console.log('[IPC Bridge] Invoking load_asset command...', { assetPath });
      const result = await invoke<string>('load_asset', { assetPath });
      console.log('[IPC Bridge] load_asset command successful');
      return result;
    } catch (error) {
      console.error('[IPC Bridge] load_asset command failed:', error);
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Delete an asset file (e.g., reference image)
   * 
   * Permanently deletes the asset file at the specified path.
   * 
   * @param {string} assetPath - Absolute path to the asset
   * 
   * @throws {Error} If file not found
   * @throws {Error} If file deletion fails
   * 
   * @example
   * await ipcBridge.deleteAsset('/path/to/assets/image.png');
   * 
   * Requirements: 2.6
   */
  public async deleteAsset(assetPath: string): Promise<void> {
    try {
      console.log('[IPC Bridge] Invoking delete_asset command...', { assetPath });
      await invoke('delete_asset', { assetPath });
      console.log('[IPC Bridge] delete_asset command successful');
    } catch (error) {
      console.error('[IPC Bridge] delete_asset command failed:', error);
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  // ============================================================================
  // AI Vision Capture IPC Commands
  // Requirements: 1.1, 3.3, 4.9
  // ============================================================================

  /**
   * Capture a vision marker during recording
   * 
   * Triggers the capture of a screenshot and creates an ai_vision_capture action.
   * This is called when the user presses the vision capture hotkey (Cmd+F6 / Ctrl+F6)
   * from the UI, or when manually triggering a vision marker capture.
   * 
   * @returns {Promise<AIVisionCaptureAction>} The created vision capture action
   * 
   * @throws {Error} If screenshot capture fails
   * @throws {Error} If no recording is in progress
   * 
   * @example
   * const action = await ipcBridge.captureVisionMarker();
   * console.log('Vision marker captured:', action.id);
   * 
   * Requirements: 1.1, 1.2, 1.4
   */
  public async captureVisionMarker(): Promise<AIVisionCaptureAction> {
    try {
      console.log('[IPC Bridge] Invoking capture_vision_marker command...');
      const result = await invoke<AIVisionCaptureAction>('capture_vision_marker');
      console.log('[IPC Bridge] capture_vision_marker command successful:', result.id);
      return result;
    } catch (error) {
      console.error('[IPC Bridge] capture_vision_marker command failed:', error);
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Analyze a screenshot using AI Vision service
   * 
   * Sends a screenshot, prompt, and optional reference images to the AI service
   * for analysis. Returns the detected coordinates of the target element.
   * 
   * This command is used both during editing (Static Mode) and playback (Dynamic Mode).
   * 
   * @param {AIVisionRequest} request - The vision analysis request containing:
   *   - screenshot: Base64 encoded screenshot or file path
   *   - prompt: User prompt describing the target element
   *   - reference_images: Array of reference image paths/base64
   *   - roi: Optional region of interest for regional search
   * 
   * @returns {Promise<AIVisionResponse>} The analysis result with coordinates or error
   * 
   * @throws {Error} If AI service is not initialized
   * @throws {Error} If analysis times out (default 15s)
   * 
   * @example
   * const response = await ipcBridge.analyzeVision({
   *   screenshot: base64Screenshot,
   *   prompt: 'Click the Submit button',
   *   reference_images: ['assets/submit_icon.png'],
   *   roi: { x: 100, y: 100, width: 200, height: 100 }
   * });
   * if (response.success) {
   *   console.log(`Found at (${response.x}, ${response.y})`);
   * }
   * 
   * Requirements: 3.3, 4.6, 4.8, 4.10
   */
  public async analyzeVision(request: AIVisionRequest): Promise<AIVisionResponse> {
    try {
      console.log('[IPC Bridge] Invoking analyze_vision command...', {
        hasScreenshot: !!request.screenshot,
        prompt: request.prompt?.substring(0, 50) + '...',
        referenceImageCount: request.reference_images?.length || 0,
        hasRoi: !!request.roi,
      });
      
      // Note: This command delegates to the AI Vision Service
      // The actual AI call is made from the frontend service
      // This IPC command is for triggering analysis from the Rust backend during playback
      const result = await invoke<AIVisionResponse>('analyze_vision', { request });
      
      console.log('[IPC Bridge] analyze_vision command result:', {
        success: result.success,
        hasCoordinates: result.x !== undefined && result.y !== undefined,
        confidence: result.confidence,
      });
      
      return result;
    } catch (error) {
      console.error('[IPC Bridge] analyze_vision command failed:', error);
      // Return error response instead of throwing to match AIVisionResponse interface
      return {
        success: false,
        error: this.formatErrorMessage(error as Error),
      };
    }
  }

  /**
   * Update vision cache data in a script
   * 
   * Persists the cache_data (cached_x, cached_y, cache_dim) for an ai_vision_capture
   * action to the script file. This is called after a successful Dynamic Mode AI call
   * to cache the result for future playback runs.
   * 
   * @param {string} scriptPath - Path to the script file
   * @param {string} actionId - UUID of the ai_vision_capture action to update
   * @param {CacheData} cacheData - The cache data to persist
   * 
   * @throws {Error} If script file not found
   * @throws {Error} If action ID not found in script
   * @throws {Error} If file write fails
   * 
   * @example
   * await ipcBridge.updateVisionCache(
   *   '/path/to/script.json',
   *   'action-uuid-123',
   *   { cached_x: 520, cached_y: 280, cache_dim: [1920, 1080] }
   * );
   * 
   * Requirements: 4.9, 5.8
   */
  public async updateVisionCache(
    scriptPath: string,
    actionId: string,
    cacheData: CacheData
  ): Promise<void> {
    try {
      console.log('[IPC Bridge] Invoking update_vision_cache command...', {
        scriptPath,
        actionId,
        hasCachedCoordinates: cacheData.cached_x !== null && cacheData.cached_y !== null,
      });
      
      await invoke('update_vision_cache', {
        scriptPath,
        actionId,
        cacheData,
      });
      
      console.log('[IPC Bridge] update_vision_cache command successful');
    } catch (error) {
      console.error('[IPC Bridge] update_vision_cache command failed:', error);
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Invalidate vision cache for an action
   * 
   * Clears the cache_data for an ai_vision_capture action. This is called when
   * the dynamic_config changes (prompt, roi, reference_images) or when AI fails.
   * 
   * @param {string} scriptPath - Path to the script file
   * @param {string} actionId - UUID of the ai_vision_capture action to update
   * 
   * @throws {Error} If script file not found
   * @throws {Error} If action ID not found in script
   * @throws {Error} If file write fails
   * 
   * @example
   * await ipcBridge.invalidateVisionCache('/path/to/script.json', 'action-uuid-123');
   * 
   * Requirements: 4.11, 7.1, 7.2, 7.3
   */
  public async invalidateVisionCache(
    scriptPath: string,
    actionId: string
  ): Promise<void> {
    try {
      console.log('[IPC Bridge] Invoking invalidate_vision_cache command...', {
        scriptPath,
        actionId,
      });
      
      await invoke('update_vision_cache', {
        scriptPath,
        actionId,
        cacheData: {
          cached_x: null,
          cached_y: null,
          cache_dim: null,
        },
      });
      
      console.log('[IPC Bridge] invalidate_vision_cache command successful');
    } catch (error) {
      console.error('[IPC Bridge] invalidate_vision_cache command failed:', error);
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Get current screen dimensions
   * 
   * Returns the current screen width and height. Used for coordinate scaling
   * when screen resolution differs from recording time.
   * 
   * @returns {Promise<ScreenDimensions>} Screen dimensions as [width, height]
   * 
   * @throws {Error} If screen dimensions cannot be determined
   * 
   * @example
   * const [width, height] = await ipcBridge.getScreenDimensions();
   * console.log(`Screen: ${width}x${height}`);
   * 
   * Requirements: 4.4, 4.5
   */
  public async getScreenDimensions(): Promise<ScreenDimensions> {
    try {
      console.log('[IPC Bridge] Invoking get_screen_dimensions command...');
      const result = await invoke<ScreenDimensions>('get_screen_dimensions');
      console.log('[IPC Bridge] get_screen_dimensions result:', result);
      return result;
    } catch (error) {
      console.error('[IPC Bridge] get_screen_dimensions command failed:', error);
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Capture current screen screenshot
   * 
   * Captures a screenshot of the current screen and returns it as base64.
   * Used for Dynamic Mode AI analysis during playback.
   * 
   * @returns {Promise<string>} Base64 encoded screenshot
   * 
   * @throws {Error} If screenshot capture fails
   * 
   * @example
   * const screenshot = await ipcBridge.captureScreenshot();
   * // Use screenshot for AI analysis
   * 
   * Requirements: 4.6
   */
  public async captureScreenshot(): Promise<string> {
    try {
      console.log('[IPC Bridge] Invoking capture_screenshot command...');
      const result = await invoke<string>('capture_screenshot');
      console.log('[IPC Bridge] capture_screenshot command successful');
      return result;
    } catch (error) {
      console.error('[IPC Bridge] capture_screenshot command failed:', error);
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
