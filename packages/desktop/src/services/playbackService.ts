/**
 * Playback Service for AI Script Builder
 * 
 * This service provides a high-level interface for controlling script playback
 * through the IPC bridge. It manages playback state, progress tracking, and
 * event subscriptions for the AI Script Builder feature.
 * 
 * The service wraps the IPC bridge's playback commands and provides a cleaner
 * API with progress callbacks and state management.
 * 
 * Requirements: 7.5
 */

import { IPCEvent, PlaybackProgress as IPCPlaybackProgress } from '../types/recorder.types';
import { getIPCBridge } from './ipcBridgeService';

/**
 * Playback options for starting playback
 */
export interface PlaybackOptions {
  speed?: number;      // Playback speed multiplier (0.1 to 10.0, default 1.0)
  loopCount?: number;  // Number of times to loop (0 = infinite, default 1)
}

/**
 * Playback progress information
 */
export interface PlaybackProgress {
  currentAction: number;  // Current action index (0-based)
  totalActions: number;   // Total number of actions in script
  currentLoop: number;    // Current loop iteration (1-based)
  totalLoops: number;     // Total loops (0 = infinite)
  status: 'playing' | 'paused' | 'completed' | 'error';
  error?: string;         // Error message if status is 'error'
}

/**
 * Playback status information
 */
export interface PlaybackStatus {
  isPlaying: boolean;
  isPaused: boolean;
  currentScript?: string;
  progress?: PlaybackProgress;
}

/**
 * Callback function types
 */
type ProgressCallback = (progress: PlaybackProgress) => void;
type CompleteCallback = () => void;
type ErrorCallback = (error: string) => void;

/**
 * Playback Service
 * 
 * Manages script playback through the IPC bridge with progress tracking
 * and event subscriptions.
 */
export class PlaybackService {
  private ipcBridge = getIPCBridge();
  private currentScript?: string;
  private isPlayingState = false;
  private isPausedState = false;
  private currentProgress?: PlaybackProgress;
  
  // Event callback arrays
  private progressCallbacks: ProgressCallback[] = [];
  private completeCallbacks: CompleteCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];

  constructor() {
    // Set up IPC event listeners
    this.setupEventListeners();
  }

  /**
   * Set up IPC event listeners for playback events
   */
  private setupEventListeners(): void {
    // Listen for progress events
    this.ipcBridge.addEventListener('progress', (event: IPCEvent) => {
      const progressData = event.data as IPCPlaybackProgress;
      
      this.currentProgress = {
        currentAction: progressData.currentAction,
        totalActions: progressData.totalActions,
        currentLoop: progressData.currentLoop,
        totalLoops: progressData.totalLoops,
        status: this.isPausedState ? 'paused' : 'playing',
      };
      
      // Notify all progress callbacks
      this.progressCallbacks.forEach(callback => {
        try {
          callback(this.currentProgress!);
        } catch (error) {
          console.error('[PlaybackService] Error in progress callback:', error);
        }
      });
    });

    // Listen for complete events
    this.ipcBridge.addEventListener('complete', () => {
      this.isPlayingState = false;
      this.isPausedState = false;
      
      if (this.currentProgress) {
        this.currentProgress.status = 'completed';
      }
      
      // Notify all complete callbacks
      this.completeCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('[PlaybackService] Error in complete callback:', error);
        }
      });
      
      // Reset state
      this.currentScript = undefined;
      this.currentProgress = undefined;
    });

    // Listen for error events
    this.ipcBridge.addEventListener('error', (event: IPCEvent) => {
      const errorMessage = event.data?.message || event.data?.error || 'Unknown playback error';
      
      this.isPlayingState = false;
      this.isPausedState = false;
      
      if (this.currentProgress) {
        this.currentProgress.status = 'error';
        this.currentProgress.error = errorMessage;
      }
      
      // Notify all error callbacks
      this.errorCallbacks.forEach(callback => {
        try {
          callback(errorMessage);
        } catch (error) {
          console.error('[PlaybackService] Error in error callback:', error);
        }
      });
      
      // Reset state
      this.currentScript = undefined;
      this.currentProgress = undefined;
    });

    // Listen for playback_stopped events
    this.ipcBridge.addEventListener('playback_stopped', () => {
      this.isPlayingState = false;
      this.isPausedState = false;
      
      if (this.currentProgress) {
        this.currentProgress.status = 'completed';
      }
      
      // Notify complete callbacks
      this.completeCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('[PlaybackService] Error in complete callback:', error);
        }
      });
      
      // Reset state
      this.currentScript = undefined;
      this.currentProgress = undefined;
    });

    // Listen for playback_paused events
    this.ipcBridge.addEventListener('playback_paused', (event: IPCEvent) => {
      const isPaused = event.data?.is_paused ?? event.data?.isPaused ?? false;
      this.isPausedState = isPaused;
      
      if (this.currentProgress) {
        this.currentProgress.status = isPaused ? 'paused' : 'playing';
      }
      
      // Notify progress callbacks with updated status
      if (this.currentProgress) {
        this.progressCallbacks.forEach(callback => {
          try {
            callback(this.currentProgress!);
          } catch (error) {
            console.error('[PlaybackService] Error in progress callback:', error);
          }
        });
      }
    });
  }

  /**
   * Start playback of a script
   * 
   * @param scriptPath - Absolute path to the script file to play
   * @param options - Optional playback options (speed, loopCount)
   * @throws {Error} If playback fails to start
   * 
   * @example
   * await playbackService.startPlayback('/path/to/script.json', { speed: 1.5, loopCount: 2 });
   */
  public async startPlayback(
    scriptPath: string,
    options?: PlaybackOptions
  ): Promise<void> {
    try {
      console.log('[PlaybackService] Starting playback:', { scriptPath, options });
      
      // Start playback through IPC bridge
      await this.ipcBridge.startPlayback(
        scriptPath,
        options?.speed,
        options?.loopCount
      );
      
      // Update state
      this.currentScript = scriptPath;
      this.isPlayingState = true;
      this.isPausedState = false;
      this.currentProgress = {
        currentAction: 0,
        totalActions: 0,
        currentLoop: 1,
        totalLoops: options?.loopCount || 1,
        status: 'playing',
      };
      
      console.log('[PlaybackService] Playback started successfully');
    } catch (error) {
      console.error('[PlaybackService] Failed to start playback:', error);
      this.isPlayingState = false;
      this.isPausedState = false;
      this.currentScript = undefined;
      this.currentProgress = undefined;
      throw error;
    }
  }

  /**
   * Stop current playback
   * 
   * @throws {Error} If no playback is active or stop fails
   * 
   * @example
   * await playbackService.stopPlayback();
   */
  public async stopPlayback(): Promise<void> {
    try {
      console.log('[PlaybackService] Stopping playback');
      
      await this.ipcBridge.stopPlayback();
      
      // State will be reset by the playback_stopped event listener
      console.log('[PlaybackService] Playback stopped successfully');
    } catch (error) {
      console.error('[PlaybackService] Failed to stop playback:', error);
      // Reset state even on error
      this.isPlayingState = false;
      this.isPausedState = false;
      this.currentScript = undefined;
      this.currentProgress = undefined;
      throw error;
    }
  }

  /**
   * Toggle pause/resume playback
   * 
   * @returns {Promise<boolean>} True if playback is now paused, false if resumed
   * @throws {Error} If no playback is active or pause fails
   * 
   * @example
   * const isPaused = await playbackService.togglePause();
   * console.log(isPaused ? 'Paused' : 'Resumed');
   */
  public async togglePause(): Promise<boolean> {
    try {
      console.log('[PlaybackService] Toggling pause');
      
      const isPaused = await this.ipcBridge.pausePlayback();
      
      // Update state
      this.isPausedState = isPaused;
      
      if (this.currentProgress) {
        this.currentProgress.status = isPaused ? 'paused' : 'playing';
      }
      
      console.log('[PlaybackService] Pause toggled:', isPaused);
      return isPaused;
    } catch (error) {
      console.error('[PlaybackService] Failed to toggle pause:', error);
      throw error;
    }
  }

  /**
   * Get current playback status
   * 
   * @returns {PlaybackStatus} Current playback status
   * 
   * @example
   * const status = playbackService.getStatus();
   * if (status.isPlaying) {
   *   console.log('Playing:', status.currentScript);
   * }
   */
  public getStatus(): PlaybackStatus {
    return {
      isPlaying: this.isPlayingState,
      isPaused: this.isPausedState,
      currentScript: this.currentScript,
      progress: this.currentProgress,
    };
  }

  /**
   * Subscribe to playback progress events
   * 
   * @param callback - Function to call on progress updates
   * @returns Unsubscribe function
   * 
   * @example
   * const unsubscribe = playbackService.onProgress((progress) => {
   *   console.log(`Action ${progress.currentAction}/${progress.totalActions}`);
   * });
   * // Later: unsubscribe();
   */
  public onProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.progressCallbacks.indexOf(callback);
      if (index !== -1) {
        this.progressCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to playback complete events
   * 
   * @param callback - Function to call when playback completes
   * @returns Unsubscribe function
   * 
   * @example
   * const unsubscribe = playbackService.onComplete(() => {
   *   console.log('Playback completed!');
   * });
   * // Later: unsubscribe();
   */
  public onComplete(callback: CompleteCallback): () => void {
    this.completeCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.completeCallbacks.indexOf(callback);
      if (index !== -1) {
        this.completeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to playback error events
   * 
   * @param callback - Function to call when an error occurs
   * @returns Unsubscribe function
   * 
   * @example
   * const unsubscribe = playbackService.onError((error) => {
   *   console.error('Playback error:', error);
   * });
   * // Later: unsubscribe();
   */
  public onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index !== -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }
}

// Export singleton instance
let playbackServiceInstance: PlaybackService | null = null;

/**
 * Get the singleton PlaybackService instance
 * 
 * @returns {PlaybackService} The playback service instance
 * 
 * @example
 * const playbackService = getPlaybackService();
 * await playbackService.startPlayback('/path/to/script.json');
 */
export function getPlaybackService(): PlaybackService {
  if (!playbackServiceInstance) {
    playbackServiceInstance = new PlaybackService();
  }
  return playbackServiceInstance;
}

/**
 * Reset the PlaybackService singleton (mainly for testing)
 */
export function resetPlaybackService(): void {
  playbackServiceInstance = null;
}
