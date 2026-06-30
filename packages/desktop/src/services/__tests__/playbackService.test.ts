/**
 * Unit tests for PlaybackService
 * 
 * Tests the playback service's ability to control script playback,
 * manage state, and handle event subscriptions.
 * 
 * Requirements: 7.5
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { IPCEvent } from '../../types/recorder.types';
import { getIPCBridge, resetIPCBridge } from '../ipcBridgeService';
import { PlaybackService, getPlaybackService, resetPlaybackService } from '../playbackService';

// Mock the IPC bridge
jest.mock('../ipcBridgeService');

describe('PlaybackService', () => {
  let playbackService: PlaybackService;
  let mockIPCBridge: any;
  let eventListeners: Map<string, ((event: IPCEvent) => void)[]>;

  beforeEach(() => {
    // Reset the service
    resetPlaybackService();
    resetIPCBridge();
    
    // Create event listeners map
    eventListeners = new Map();
    
    // Create mock IPC bridge
    mockIPCBridge = {
      startPlayback: jest.fn().mockResolvedValue(undefined),
      stopPlayback: jest.fn().mockResolvedValue(undefined),
      pausePlayback: jest.fn().mockResolvedValue(false),
      addEventListener: jest.fn((eventType: string, listener: (event: IPCEvent) => void) => {
        if (!eventListeners.has(eventType)) {
          eventListeners.set(eventType, []);
        }
        eventListeners.get(eventType)!.push(listener);
      }),
      removeEventListener: jest.fn((eventType: string, listener: (event: IPCEvent) => void) => {
        const listeners = eventListeners.get(eventType);
        if (listeners) {
          const index = listeners.indexOf(listener);
          if (index !== -1) {
            listeners.splice(index, 1);
          }
        }
      }),
    };
    
    // Mock getIPCBridge to return our mock
    (getIPCBridge as jest.MockedFunction<typeof getIPCBridge>).mockReturnValue(mockIPCBridge);
    
    // Create service instance
    playbackService = new PlaybackService();
  });

  afterEach(() => {
    resetPlaybackService();
    resetIPCBridge();
    jest.clearAllMocks();
  });

  // Helper function to emit IPC events
  const emitIPCEvent = (eventType: string, data: any) => {
    const listeners = eventListeners.get(eventType) || [];
    listeners.forEach(listener => listener({ type: eventType as any, data }));
  };

  describe('startPlayback', () => {
    it('should start playback with default options', async () => {
      const scriptPath = '/path/to/script.json';
      
      await playbackService.startPlayback(scriptPath);
      
      expect(mockIPCBridge.startPlayback).toHaveBeenCalledWith(scriptPath, undefined, undefined);
      
      const status = playbackService.getStatus();
      expect(status.isPlaying).toBe(true);
      expect(status.isPaused).toBe(false);
      expect(status.currentScript).toBe(scriptPath);
    });

    it('should start playback with custom speed and loop count', async () => {
      const scriptPath = '/path/to/script.json';
      const options = { speed: 2.0, loopCount: 3 };
      
      await playbackService.startPlayback(scriptPath, options);
      
      expect(mockIPCBridge.startPlayback).toHaveBeenCalledWith(scriptPath, 2.0, 3);
      
      const status = playbackService.getStatus();
      expect(status.isPlaying).toBe(true);
      expect(status.progress?.totalLoops).toBe(3);
    });

    it('should handle startPlayback errors', async () => {
      const scriptPath = '/path/to/script.json';
      const error = new Error('Failed to start playback');
      mockIPCBridge.startPlayback.mockRejectedValue(error);
      
      await expect(playbackService.startPlayback(scriptPath)).rejects.toThrow('Failed to start playback');
      
      const status = playbackService.getStatus();
      expect(status.isPlaying).toBe(false);
      expect(status.currentScript).toBeUndefined();
    });
  });

  describe('stopPlayback', () => {
    it('should stop playback', async () => {
      // Start playback first
      await playbackService.startPlayback('/path/to/script.json');
      
      await playbackService.stopPlayback();
      
      expect(mockIPCBridge.stopPlayback).toHaveBeenCalled();
    });

    it('should reset state when playback_stopped event is received', async () => {
      // Start playback
      await playbackService.startPlayback('/path/to/script.json');
      
      // Emit playback_stopped event
      emitIPCEvent('playback_stopped', {});
      
      const status = playbackService.getStatus();
      expect(status.isPlaying).toBe(false);
      expect(status.isPaused).toBe(false);
      expect(status.currentScript).toBeUndefined();
    });

    it('should handle stopPlayback errors', async () => {
      const error = new Error('Failed to stop playback');
      mockIPCBridge.stopPlayback.mockRejectedValue(error);
      
      await expect(playbackService.stopPlayback()).rejects.toThrow('Failed to stop playback');
      
      // State should be reset even on error
      const status = playbackService.getStatus();
      expect(status.isPlaying).toBe(false);
    });
  });

  describe('togglePause', () => {
    it('should pause playback', async () => {
      mockIPCBridge.pausePlayback.mockResolvedValue(true);
      
      const isPaused = await playbackService.togglePause();
      
      expect(mockIPCBridge.pausePlayback).toHaveBeenCalled();
      expect(isPaused).toBe(true);
      
      const status = playbackService.getStatus();
      expect(status.isPaused).toBe(true);
    });

    it('should resume playback', async () => {
      // First pause
      mockIPCBridge.pausePlayback.mockResolvedValue(true);
      await playbackService.togglePause();
      
      // Then resume
      mockIPCBridge.pausePlayback.mockResolvedValue(false);
      const isPaused = await playbackService.togglePause();
      
      expect(isPaused).toBe(false);
      
      const status = playbackService.getStatus();
      expect(status.isPaused).toBe(false);
    });

    it('should handle togglePause errors', async () => {
      const error = new Error('Failed to toggle pause');
      mockIPCBridge.pausePlayback.mockRejectedValue(error);
      
      await expect(playbackService.togglePause()).rejects.toThrow('Failed to toggle pause');
    });
  });

  describe('progress events', () => {
    it('should notify progress callbacks on progress event', async () => {
      const progressCallback = jest.fn();
      playbackService.onProgress(progressCallback);
      
      // Start playback
      await playbackService.startPlayback('/path/to/script.json');
      
      // Emit progress event
      emitIPCEvent('progress', {
        currentAction: 5,
        totalActions: 10,
        currentLoop: 1,
        totalLoops: 1,
      });
      
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          currentAction: 5,
          totalActions: 10,
          currentLoop: 1,
          totalLoops: 1,
          status: 'playing',
        })
      );
    });

    it('should allow unsubscribing from progress events', async () => {
      const progressCallback = jest.fn();
      const unsubscribe = playbackService.onProgress(progressCallback);
      
      // Unsubscribe
      unsubscribe();
      
      // Emit progress event
      emitIPCEvent('progress', {
        currentAction: 5,
        totalActions: 10,
        currentLoop: 1,
        totalLoops: 1,
      });
      
      expect(progressCallback).not.toHaveBeenCalled();
    });

    it('should handle multiple progress callbacks', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      playbackService.onProgress(callback1);
      playbackService.onProgress(callback2);
      
      // Emit progress event
      emitIPCEvent('progress', {
        currentAction: 3,
        totalActions: 10,
        currentLoop: 1,
        totalLoops: 1,
      });
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('complete events', () => {
    it('should notify complete callbacks on complete event', async () => {
      const completeCallback = jest.fn();
      playbackService.onComplete(completeCallback);
      
      // Start playback
      await playbackService.startPlayback('/path/to/script.json');
      
      // Emit complete event
      emitIPCEvent('complete', {});
      
      expect(completeCallback).toHaveBeenCalled();
      
      const status = playbackService.getStatus();
      expect(status.isPlaying).toBe(false);
      expect(status.currentScript).toBeUndefined();
    });

    it('should allow unsubscribing from complete events', async () => {
      const completeCallback = jest.fn();
      const unsubscribe = playbackService.onComplete(completeCallback);
      
      // Unsubscribe
      unsubscribe();
      
      // Emit complete event
      emitIPCEvent('complete', {});
      
      expect(completeCallback).not.toHaveBeenCalled();
    });
  });

  describe('error events', () => {
    it('should notify error callbacks on error event', async () => {
      const errorCallback = jest.fn();
      playbackService.onError(errorCallback);
      
      // Start playback
      await playbackService.startPlayback('/path/to/script.json');
      
      // Emit error event
      emitIPCEvent('error', { message: 'Playback failed' });
      
      expect(errorCallback).toHaveBeenCalledWith('Playback failed');
      
      const status = playbackService.getStatus();
      expect(status.isPlaying).toBe(false);
      expect(status.currentScript).toBeUndefined();
    });

    it('should handle error event with error field', async () => {
      const errorCallback = jest.fn();
      playbackService.onError(errorCallback);
      
      // Emit error event with error field
      emitIPCEvent('error', { error: 'Script not found' });
      
      expect(errorCallback).toHaveBeenCalledWith('Script not found');
    });

    it('should handle error event with no message', async () => {
      const errorCallback = jest.fn();
      playbackService.onError(errorCallback);
      
      // Emit error event with no message
      emitIPCEvent('error', {});
      
      expect(errorCallback).toHaveBeenCalledWith('Unknown playback error');
    });

    it('should allow unsubscribing from error events', async () => {
      const errorCallback = jest.fn();
      const unsubscribe = playbackService.onError(errorCallback);
      
      // Unsubscribe
      unsubscribe();
      
      // Emit error event
      emitIPCEvent('error', { message: 'Playback failed' });
      
      expect(errorCallback).not.toHaveBeenCalled();
    });
  });

  describe('playback_paused events', () => {
    it('should update status on playback_paused event', async () => {
      const progressCallback = jest.fn();
      playbackService.onProgress(progressCallback);
      
      // Start playback
      await playbackService.startPlayback('/path/to/script.json');
      
      // Set initial progress
      emitIPCEvent('progress', {
        currentAction: 5,
        totalActions: 10,
        currentLoop: 1,
        totalLoops: 1,
      });
      
      // Emit playback_paused event
      emitIPCEvent('playback_paused', { is_paused: true });
      
      const status = playbackService.getStatus();
      expect(status.isPaused).toBe(true);
      expect(status.progress?.status).toBe('paused');
      
      // Progress callback should be called with updated status
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'paused',
        })
      );
    });

    it('should handle playback_paused event with isPaused field', async () => {
      // Emit playback_paused event with isPaused field
      emitIPCEvent('playback_paused', { isPaused: true });
      
      const status = playbackService.getStatus();
      expect(status.isPaused).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return idle status initially', () => {
      const status = playbackService.getStatus();
      
      expect(status.isPlaying).toBe(false);
      expect(status.isPaused).toBe(false);
      expect(status.currentScript).toBeUndefined();
      expect(status.progress).toBeUndefined();
    });

    it('should return playing status during playback', async () => {
      await playbackService.startPlayback('/path/to/script.json');
      
      const status = playbackService.getStatus();
      
      expect(status.isPlaying).toBe(true);
      expect(status.isPaused).toBe(false);
      expect(status.currentScript).toBe('/path/to/script.json');
      expect(status.progress).toBeDefined();
    });

    it('should return paused status when paused', async () => {
      await playbackService.startPlayback('/path/to/script.json');
      
      mockIPCBridge.pausePlayback.mockResolvedValue(true);
      await playbackService.togglePause();
      
      const status = playbackService.getStatus();
      
      expect(status.isPlaying).toBe(true);
      expect(status.isPaused).toBe(true);
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getPlaybackService();
      const instance2 = getPlaybackService();
      
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getPlaybackService();
      
      resetPlaybackService();
      
      const instance2 = getPlaybackService();
      
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('error handling in callbacks', () => {
    it('should handle errors in progress callbacks gracefully', async () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = jest.fn();
      
      playbackService.onProgress(errorCallback);
      playbackService.onProgress(normalCallback);
      
      // Emit progress event
      emitIPCEvent('progress', {
        currentAction: 5,
        totalActions: 10,
        currentLoop: 1,
        totalLoops: 1,
      });
      
      // Both callbacks should be called despite error in first one
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });

    it('should handle errors in complete callbacks gracefully', async () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = jest.fn();
      
      playbackService.onComplete(errorCallback);
      playbackService.onComplete(normalCallback);
      
      // Emit complete event
      emitIPCEvent('complete', {});
      
      // Both callbacks should be called despite error in first one
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });

    it('should handle errors in error callbacks gracefully', async () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = jest.fn();
      
      playbackService.onError(errorCallback);
      playbackService.onError(normalCallback);
      
      // Emit error event
      emitIPCEvent('error', { message: 'Playback failed' });
      
      // Both callbacks should be called despite error in first one
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });
  });
});
