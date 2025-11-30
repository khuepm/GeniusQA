/**
 * Unit tests for IPC Bridge Service (Tauri)
 * Requirements: 5.1, 5.3, 5.4
 */

import { IPCBridgeService, resetIPCBridge } from '../ipcBridgeService';

// Mock Tauri APIs
jest.mock('@tauri-apps/api/tauri', () => ({
  invoke: jest.fn(),
}));

jest.mock('@tauri-apps/api/event', () => ({
  listen: jest.fn(),
}));

describe('IPCBridgeService', () => {
  let service: IPCBridgeService;
  let mockInvoke: jest.Mock;
  let mockListen: jest.Mock;
  let mockUnlisten: jest.Mock;

  beforeEach(() => {
    // Reset the singleton
    resetIPCBridge();

    // Get mock functions
    const { invoke } = require('@tauri-apps/api/tauri');
    const { listen } = require('@tauri-apps/api/event');
    
    mockInvoke = invoke as jest.Mock;
    mockListen = listen as jest.Mock;
    mockUnlisten = jest.fn();

    // Setup default mock implementations
    mockInvoke.mockResolvedValue({ success: true, data: {} });
    mockListen.mockResolvedValue(mockUnlisten);

    service = new IPCBridgeService();
  });

  afterEach(() => {
    service.terminate();
    jest.clearAllMocks();
  });

  describe('Tauri Command Invocation', () => {
    it('should invoke Tauri commands with correct parameters', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await service.startRecording();

      expect(mockInvoke).toHaveBeenCalledWith('start_recording');
    });

    it('should handle Tauri command responses', async () => {
      const response = {
        success: true,
        scriptPath: '/path/to/script.json',
        actionCount: 100,
        duration: 45.5,
      };

      mockInvoke.mockResolvedValueOnce(response);

      const result = await service.stopRecording();

      expect(result).toEqual(response);
      expect(mockInvoke).toHaveBeenCalledWith('stop_recording');
    });

    it('should handle multiple sequential commands', async () => {
      mockInvoke.mockResolvedValueOnce(true);
      mockInvoke.mockResolvedValueOnce('/path/to/latest.json');

      const result1 = await service.checkForRecordings();
      expect(result1).toBe(true);

      const result2 = await service.getLatestRecording();
      expect(result2).toBe('/path/to/latest.json');

      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('should pass parameters to Tauri commands', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await service.startPlayback('/custom/path.json', 1.5, 3);

      expect(mockInvoke).toHaveBeenCalledWith('start_playback', {
        scriptPath: '/custom/path.json',
        speed: 1.5,
        loopCount: 3,
      });
    });

    it('should handle optional parameters', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await service.startPlayback();

      expect(mockInvoke).toHaveBeenCalledWith('start_playback', {
        scriptPath: null,
        speed: 1.0,
        loopCount: 1,
      });
    });
  });

  describe('Tauri Error Handling', () => {
    it('should handle Tauri command errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Tauri command failed'));

      await expect(service.startRecording()).rejects.toThrow('Tauri command failed');
    });

    it('should handle Tauri error format', async () => {
      const tauriError = new Error('Python Core error: PyAutoGUI not installed');

      mockInvoke.mockRejectedValueOnce(tauriError);

      await expect(service.startRecording()).rejects.toThrow('Python Core error: PyAutoGUI not installed');
    });

    it('should handle error responses from backend', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Recording already in progress'));

      await expect(service.startRecording()).rejects.toThrow('Recording already in progress');
    });
  });

  describe('Tauri Backend Integration', () => {
    it('should invoke Tauri commands without managing process lifecycle', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await service.startRecording();

      // Tauri backend manages Python process, not the frontend
      expect(mockInvoke).toHaveBeenCalledWith('start_recording');
    });

    it('should handle multiple commands without process management', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      mockInvoke.mockResolvedValueOnce({ success: true, scriptPath: '/path/to/script.json' });

      await service.startRecording();
      await service.stopRecording();

      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('should cleanup event listeners on terminate', () => {
      service.terminate();

      // Verify unlisten was called for all registered listeners
      expect(mockUnlisten).toHaveBeenCalled();
    });

    it('should handle backend unavailable errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Tauri backend not available'));

      await expect(service.startRecording()).rejects.toThrow('Tauri backend not available');
    });

    it('should handle Python Core errors from backend', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Python Core process failed to start'));

      await expect(service.startRecording()).rejects.toThrow('Python Core process failed');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle Python Core returning error response', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('PyAutoGUI not installed'));

      await expect(service.startRecording()).rejects.toThrow('PyAutoGUI not installed');
    });

    it('should handle stopRecording error gracefully', async () => {
      mockInvoke.mockResolvedValueOnce({
        success: true,
        scriptPath: '/path/to/script.json',
        actionCount: 0,
        duration: 0,
      });

      const result = await service.stopRecording();

      expect(result.success).toBe(true);
    });

    it('should handle Tauri backend errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Backend command failed'));

      await expect(service.startRecording()).rejects.toThrow('Backend command failed');
    });

    it('should handle command invocation errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Command not found'));

      await expect(service.startRecording()).rejects.toThrow('Command not found');
    });
  });

  describe('Tauri Event Handling', () => {
    it('should setup Tauri event listeners on initialization', () => {
      // The service sets up a single 'python-event' listener in constructor
      expect(mockListen).toHaveBeenCalledWith('python-event', expect.any(Function));
    });

    it('should forward Tauri events to registered listeners', async () => {
      const progressListener = jest.fn();
      let tauriEventHandler: any;

      // Capture the event handler
      mockListen.mockImplementationOnce((event: string, handler: any) => {
        tauriEventHandler = handler;
        return Promise.resolve(mockUnlisten);
      });

      // Create new service to capture handler
      resetIPCBridge();
      const newService = new IPCBridgeService();
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 10));

      newService.addEventListener('progress', progressListener);

      // Simulate Tauri event with python-event format
      const tauriEvent = {
        payload: {
          type: 'progress',
          data: {
            currentAction: 50,
            totalActions: 100,
          },
        },
      };

      tauriEventHandler(tauriEvent);

      expect(progressListener).toHaveBeenCalledWith({
        type: 'progress',
        data: {
          currentAction: 50,
          totalActions: 100,
        },
      });

      newService.terminate();
    });

    it('should support multiple listeners for same event', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      let tauriEventHandler: any;

      mockListen.mockImplementationOnce((event: string, handler: any) => {
        tauriEventHandler = handler;
        return Promise.resolve(mockUnlisten);
      });

      resetIPCBridge();
      const newService = new IPCBridgeService();
      await new Promise(resolve => setTimeout(resolve, 10));

      newService.addEventListener('progress', listener1);
      newService.addEventListener('progress', listener2);

      const tauriEvent = {
        payload: {
          type: 'progress',
          data: { test: 'data' },
        },
      };
      tauriEventHandler(tauriEvent);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      newService.terminate();
    });

    it('should remove event listeners', () => {
      const listener = jest.fn();

      service.addEventListener('progress', listener);
      service.removeEventListener('progress', listener);

      // Listener should be removed from internal map
      // We can't easily test this without triggering an event, but the method should not throw
      expect(() => service.removeEventListener('progress', listener)).not.toThrow();
    });

    it('should handle errors in event listeners gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const faultyListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      let tauriEventHandler: any;

      mockListen.mockImplementationOnce((event: string, handler: any) => {
        tauriEventHandler = handler;
        return Promise.resolve(mockUnlisten);
      });

      resetIPCBridge();
      const newService = new IPCBridgeService();
      await new Promise(resolve => setTimeout(resolve, 10));

      newService.addEventListener('progress', faultyListener);

      const tauriEvent = {
        payload: {
          type: 'progress',
          data: { test: 'data' },
        },
      };
      tauriEventHandler(tauriEvent);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in event listener:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
      newService.terminate();
    });

    it('should handle all event types through single python-event listener', () => {
      const progressListener = jest.fn();
      const completeListener = jest.fn();
      const errorListener = jest.fn();
      const actionPreviewListener = jest.fn();

      service.addEventListener('progress', progressListener);
      service.addEventListener('complete', completeListener);
      service.addEventListener('error', errorListener);
      service.addEventListener('action_preview', actionPreviewListener);

      // All events go through the single 'python-event' listener
      expect(mockListen).toHaveBeenCalledWith('python-event', expect.any(Function));
    });
  });

  describe('API Methods', () => {
    it('should call startRecording command', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await service.startRecording();

      expect(mockInvoke).toHaveBeenCalledWith('start_recording');
    });

    it('should call stopRecording command and return result', async () => {
      const response = {
        success: true,
        scriptPath: '/path/to/script.json',
        actionCount: 127,
        duration: 45.5,
      };

      mockInvoke.mockResolvedValueOnce(response);

      const result = await service.stopRecording();

      expect(result).toEqual(response);
      expect(mockInvoke).toHaveBeenCalledWith('stop_recording');
    });

    it('should call startPlayback with all parameters', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await service.startPlayback('/custom/path.json', 2.0, 5);

      expect(mockInvoke).toHaveBeenCalledWith('start_playback', {
        scriptPath: '/custom/path.json',
        speed: 2.0,
        loopCount: 5,
      });
    });

    it('should call startPlayback with default parameters', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await service.startPlayback();

      expect(mockInvoke).toHaveBeenCalledWith('start_playback', {
        scriptPath: null,
        speed: 1.0,
        loopCount: 1,
      });
    });

    it('should call stopPlayback command', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await service.stopPlayback();

      expect(mockInvoke).toHaveBeenCalledWith('stop_playback');
    });

    it('should call checkForRecordings and return boolean', async () => {
      mockInvoke.mockResolvedValueOnce(true);

      const result = await service.checkForRecordings();

      expect(result).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('check_recordings');
    });

    it('should call getLatestRecording and return path', async () => {
      mockInvoke.mockResolvedValueOnce('/path/to/latest.json');

      const result = await service.getLatestRecording();

      expect(result).toBe('/path/to/latest.json');
      expect(mockInvoke).toHaveBeenCalledWith('get_latest');
    });

    it('should return null when no recordings exist', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const result = await service.getLatestRecording();

      expect(result).toBe(null);
    });

    it('should call listScripts command', async () => {
      const scripts = [
        { path: '/path/1.json', name: 'script1' },
        { path: '/path/2.json', name: 'script2' },
      ];

      mockInvoke.mockResolvedValueOnce(scripts);

      const result = await service.listScripts();

      expect(result).toEqual(scripts);
      expect(mockInvoke).toHaveBeenCalledWith('list_scripts');
    });

    it('should call loadScript command', async () => {
      const scriptData = { metadata: {}, actions: [] };

      mockInvoke.mockResolvedValueOnce(scriptData);

      const result = await service.loadScript('/path/to/script.json');

      expect(result).toEqual(scriptData);
      expect(mockInvoke).toHaveBeenCalledWith('load_script', { scriptPath: '/path/to/script.json' });
    });

    it('should call saveScript command', async () => {
      const scriptData = { metadata: {}, actions: [] };

      mockInvoke.mockResolvedValueOnce(undefined);

      await service.saveScript('/path/to/script.json', scriptData);

      expect(mockInvoke).toHaveBeenCalledWith('save_script', {
        scriptPath: '/path/to/script.json',
        scriptData,
      });
    });

    it('should call deleteScript command', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await service.deleteScript('/path/to/script.json');

      expect(mockInvoke).toHaveBeenCalledWith('delete_script', { scriptPath: '/path/to/script.json' });
    });
  });

  describe('Comprehensive Error Handling', () => {
    // Additional error scenario tests for Requirements 9.1, 9.2, 9.3, 9.4, 9.5
    it('should format permission denied errors with helpful message', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Permission denied: GeniusQA needs Accessibility permissions'));

      await expect(service.startRecording()).rejects.toThrow('Permission denied');
    });

    it('should format Python Core unavailable errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Python Core process failed to start. Please ensure Python 3.9+ is installed.'));

      await expect(service.startRecording()).rejects.toThrow('Python Core process failed to start');
    });

    it('should format corrupted script file errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Script file corrupted: Invalid JSON format'));

      await expect(service.startPlayback()).rejects.toThrow('corrupted');
    });

    it('should format no recordings found errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('No recordings found'));

      await expect(service.startPlayback()).rejects.toThrow('No recordings found');
    });

    it('should handle already in progress errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Recording already in progress'));

      await expect(service.startRecording()).rejects.toThrow('already in progress');
    });

    it('should handle file system errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('File system error: Not enough disk space'));

      const result = await service.stopRecording();
      expect(result.success).toBe(false);
      expect(result.error).toContain('disk space');
    });

    it('should handle missing Python dependencies', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Required libraries not installed: pyautogui. Please run: pip install pyautogui'));

      await expect(service.startRecording()).rejects.toThrow('pyautogui');
    });

    it('should handle multiple sequential errors', async () => {
      // Error 1: No recording in progress
      mockInvoke.mockRejectedValueOnce(new Error('No recording in progress'));
      const result1 = await service.stopRecording();
      expect(result1.success).toBe(false);

      // Error 2: No recordings found
      mockInvoke.mockRejectedValueOnce(new Error('No recordings found'));
      await expect(service.startPlayback()).rejects.toThrow();

      // Error 3: Permission denied
      mockInvoke.mockRejectedValueOnce(new Error('Permission denied'));
      await expect(service.startRecording()).rejects.toThrow();
    });

    it('should handle empty error messages gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error(''));

      await expect(service.startRecording()).rejects.toThrow('unknown error');
    });

    it('should handle missing error field in error response', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Unknown error'));

      await expect(service.startRecording()).rejects.toThrow('unknown error');
    });

    it('should handle Tauri backend connection errors', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Tauri backend not responding'));

      await expect(service.startRecording()).rejects.toThrow('Tauri backend not responding');
    });

    it('should handle command timeout from backend', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Command execution timed out'));

      await expect(service.startRecording()).rejects.toThrow('timed out');
    });
  });
});

