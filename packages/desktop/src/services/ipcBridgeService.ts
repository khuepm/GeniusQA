/**
 * IPC Bridge Service for Desktop Recorder MVP
 * 
 * This service manages all communication between the React Native UI and the Python Core
 * automation backend. It spawns and maintains a Python process, sends commands via stdin,
 * receives responses via stdout, and handles errors via stderr.
 * 
 * The service implements a command-response pattern with timeout handling and event
 * emission for asynchronous operations like playback progress updates.
 * 
 * Architecture:
 * - Spawns Python process on first command
 * - Maintains single long-lived process for app session
 * - JSON-based message protocol over stdin/stdout
 * - Event-driven architecture for async operations
 * - Automatic error propagation and formatting
 * 
 * Requirements: 5.1, 5.3, 5.4
 * Validates: Property 10 (IPC error propagation)
 */

import { spawn, ChildProcess } from 'child_process';
import {
  IPCMessage,
  IPCResponse,
  IPCEvent,
  RecordingResult,
  IPCCommand,
} from '../types/recorder.types';

/**
 * Configuration for IPC Bridge
 */
interface IPCBridgeConfig {
  pythonPath?: string;
  pythonCorePath?: string;
  commandTimeout?: number;
}

/**
 * IPC Bridge Service
 * Handles all communication with Python Core process
 */
export class IPCBridgeService {
  private pythonProcess: ChildProcess | null = null;
  private pythonPath: string;
  private pythonCorePath: string;
  private commandTimeout: number;
  private stdoutBuffer: string = '';
  private stderrBuffer: string = '';
  private pendingCommands: Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  > = new Map();
  private eventListeners: Map<string, ((event: IPCEvent) => void)[]> = new Map();

  constructor(config: IPCBridgeConfig = {}) {
    this.pythonPath = config.pythonPath || 'python3';
    this.pythonCorePath =
      config.pythonCorePath || '../python-core/src/__main__.py';
    this.commandTimeout = config.commandTimeout || 30000; // 30 seconds default
  }

  /**
   * Initialize the Python Core process
   */
  private async initializePythonProcess(): Promise<void> {
    if (this.pythonProcess) {
      return; // Already initialized
    }

    return new Promise((resolve, reject) => {
      try {
        this.pythonProcess = spawn(this.pythonPath, [this.pythonCorePath], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        if (!this.pythonProcess) {
          reject(new Error(
            'Python Core unavailable: Failed to start Python process. ' +
            'Please ensure Python 3.9+ is installed and accessible.'
          ));
          return;
        }

        if (!this.pythonProcess.stdin || !this.pythonProcess.stdout || !this.pythonProcess.stderr) {
          reject(new Error(
            'Python Core unavailable: Failed to initialize process communication. ' +
            'Please restart the application.'
          ));
          return;
        }

        // Set up stdout handler
        this.pythonProcess.stdout.on('data', (data: Buffer) => {
          this.handleStdout(data);
        });

        // Set up stderr handler
        this.pythonProcess.stderr.on('data', (data: Buffer) => {
          this.handleStderr(data);
        });

        // Handle process exit
        this.pythonProcess.on('exit', (code: number | null) => {
          console.error(`Python Core process exited with code ${code}`);
          this.pythonProcess = null;
          this.rejectAllPendingCommands(
            new Error(`Python Core process exited with code ${code}`)
          );
        });

        // Handle process errors
        this.pythonProcess.on('error', (error: Error) => {
          console.error('Python Core process error:', error);
          this.pythonProcess = null;
          
          // Format error message based on error type
          let errorMessage = 'Python Core unavailable: ';
          if (error.message.includes('ENOENT')) {
            errorMessage += 'Python executable not found. Please ensure Python 3.9+ is installed and in your PATH.';
          } else if (error.message.includes('EACCES')) {
            errorMessage += 'Permission denied. Please check Python Core file permissions.';
          } else {
            errorMessage += `${error.message}. Please ensure Python 3.9+ is installed.`;
          }
          
          reject(new Error(errorMessage));
        });

        // Give the process a moment to start
        setTimeout(() => resolve(), 100);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle stdout data from Python Core
   */
  private handleStdout(data: Buffer): void {
    this.stdoutBuffer += data.toString();

    // Process complete JSON messages
    const lines = this.stdoutBuffer.split('\n');
    this.stdoutBuffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          this.processMessage(message);
        } catch (error) {
          console.error('Failed to parse JSON from Python Core:', line, error);
        }
      }
    }
  }

  /**
   * Handle stderr data from Python Core
   */
  private handleStderr(data: Buffer): void {
    this.stderrBuffer += data.toString();
    const lines = this.stderrBuffer.split('\n');
    this.stderrBuffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        console.error('Python Core stderr:', line);
      }
    }
  }

  /**
   * Process a message from Python Core
   */
  private processMessage(message: IPCResponse | IPCEvent): void {
    // Check if it's an event message
    if ('type' in message && message.type) {
      this.emitEvent(message as IPCEvent);
      return;
    }

    // It's a response message - resolve the pending command
    const response = message as IPCResponse;
    
    // Find and resolve the first pending command (FIFO)
    const entries = Array.from(this.pendingCommands.entries());
    if (entries.length > 0) {
      const [commandId, pending] = entries[0];
      clearTimeout(pending.timeout);
      this.pendingCommands.delete(commandId);

      if (response.success) {
        pending.resolve(response);
      } else {
        pending.reject(new Error(response.error || 'Unknown error'));
      }
    }
  }

  /**
   * Send a command to Python Core
   */
  private async sendCommand(
    command: IPCCommand,
    params: Record<string, any> = {}
  ): Promise<IPCResponse> {
    await this.initializePythonProcess();

    if (!this.pythonProcess || !this.pythonProcess.stdin) {
      throw new Error('Python Core process not available');
    }

    return new Promise((resolve, reject) => {
      const commandId = `${command}_${Date.now()}`;
      const message: IPCMessage = { command, params };

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        reject(new Error(`Command ${command} timed out after ${this.commandTimeout}ms`));
      }, this.commandTimeout);

      // Store pending command
      this.pendingCommands.set(commandId, { resolve, reject, timeout });

      // Send command
      const messageStr = JSON.stringify(message) + '\n';
      this.pythonProcess!.stdin!.write(messageStr, (error: Error | null | undefined) => {
        if (error) {
          clearTimeout(timeout);
          this.pendingCommands.delete(commandId);
          reject(error);
        }
      });
    });
  }

  /**
   * Reject all pending commands with an error
   */
  private rejectAllPendingCommands(error: Error): void {
    for (const [commandId, pending] of this.pendingCommands.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingCommands.clear();
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
   * Sends a start_recording command to Python Core, which begins capturing all
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
      const response = await this.sendCommand('start_recording');
      if (!response.success) {
        throw new Error(response.error || 'Failed to start recording');
      }
    } catch (error) {
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Stop recording and save to file
   * 
   * Sends a stop_recording command to Python Core, which terminates the active
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
      const response = await this.sendCommand('stop_recording');
      
      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Failed to stop recording',
        };
      }

      return {
        success: true,
        scriptPath: response.data?.scriptPath,
        actionCount: response.data?.actionCount,
        duration: response.data?.duration,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop recording',
      };
    }
  }

  /**
   * Start playback of a recorded script
   * 
   * Sends a start_playback command to Python Core, which loads the specified script
   * file (or the most recent one if no path provided) and begins executing the
   * recorded actions with accurate timing preservation.
   * 
   * @param {string} [scriptPath] - Optional path to specific script file. If omitted,
   *   plays the most recent recording
   * 
   * @throws {Error} If Python Core is unavailable or playback fails to start
   * @throws {Error} If no recordings exist (when scriptPath not provided)
   * @throws {Error} If script file is corrupted or invalid
   * @throws {Error} If permissions are insufficient (macOS Accessibility)
   * @throws {Error} If a playback is already in progress
   * 
   * @example
   * // Play most recent recording
   * await ipcBridge.startPlayback();
   * 
   * @example
   * // Play specific recording
   * await ipcBridge.startPlayback('/path/to/script_20240101_120000.json');
   * 
   * Requirements: 2.1, 2.2, 5.1, 5.3
   * Validates: Property 3 (Playback executes actions in order)
   * Validates: Property 4 (Timing preservation during playback)
   */
  public async startPlayback(scriptPath?: string): Promise<void> {
    try {
      const params = scriptPath ? { scriptPath } : {};
      const response = await this.sendCommand('start_playback', params);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to start playback');
      }
    } catch (error) {
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Stop current playback
   * 
   * Sends a stop_playback command to Python Core, which immediately interrupts
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
      const response = await this.sendCommand('stop_playback');
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to stop playback');
      }
    } catch (error) {
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Check if any recordings exist
   * 
   * Queries Python Core to determine if any script files exist in the recordings
   * directory. Used to enable/disable the Start button in the UI.
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
      const response = await this.sendCommand('check_recordings');
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to check for recordings');
      }

      return response.data?.hasRecordings || false;
    } catch (error) {
      throw new Error(this.formatErrorMessage(error as Error));
    }
  }

  /**
   * Get the path to the latest recording
   * 
   * Queries Python Core for the path to the most recently created script file.
   * Used to determine which recording to play when startPlayback() is called
   * without a specific path.
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
      const response = await this.sendCommand('get_latest');
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get latest recording');
      }

      return response.data?.scriptPath || null;
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
   * Terminate the Python Core process
   */
  public terminate(): void {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
    this.rejectAllPendingCommands(new Error('IPC Bridge terminated'));
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
