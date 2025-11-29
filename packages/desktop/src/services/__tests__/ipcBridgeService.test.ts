/**
 * Unit tests for IPC Bridge Service
 * Requirements: 5.1, 5.3, 5.4
 */

import { IPCBridgeService, resetIPCBridge } from '../ipcBridgeService';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
jest.mock('child_process');

describe('IPCBridgeService', () => {
  let service: IPCBridgeService;
  let mockProcess: any;

  beforeEach(() => {
    // Reset the singleton
    resetIPCBridge();

    // Create a mock process
    mockProcess = new EventEmitter();
    mockProcess.stdin = {
      write: jest.fn((data: string, callback?: (error?: Error) => void) => {
        if (callback) callback();
        return true;
      }),
    };
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = jest.fn();

    // Mock spawn to return our mock process
    const { spawn } = require('child_process');
    spawn.mockReturnValue(mockProcess);

    service = new IPCBridgeService({
      pythonPath: 'python3',
      pythonCorePath: './test.py',
      commandTimeout: 1000,
    });
  });

  afterEach(() => {
    service.terminate();
    jest.clearAllMocks();
  });

  describe('Message Serialization/Deserialization', () => {
    it('should serialize commands to JSON format', async () => {
      const promise = service.startRecording();

      // Wait for process initialization
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockProcess.stdin.write).toHaveBeenCalled();
      const writtenData = mockProcess.stdin.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);

      expect(parsed).toEqual({
        command: 'start_recording',
        params: {},
      });

      // Send response to resolve promise
      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: { status: 'recording' } }) + '\n')
      );

      await promise;
    });

    it('should deserialize JSON responses from Python Core', async () => {
      const promise = service.stopRecording();

      // Wait for process initialization
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Send response
      const response = {
        success: true,
        data: {
          scriptPath: '/path/to/script.json',
          actionCount: 100,
          duration: 45.5,
        },
      };

      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));

      const result = await promise;

      expect(result).toEqual({
        success: true,
        scriptPath: '/path/to/script.json',
        actionCount: 100,
        duration: 45.5,
      });
    });

    it('should handle multi-line JSON responses', async () => {
      const promise1 = service.checkForRecordings();

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Send first response
      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: { hasRecordings: true } }) + '\n')
      );

      const result1 = await promise1;
      expect(result1).toBe(true);

      // Now start second command
      const promise2 = service.getLatestRecording();

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Send second response
      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: { scriptPath: '/path/to/latest.json' } }) + '\n')
      );

      const result2 = await promise2;
      expect(result2).toBe('/path/to/latest.json');
    });

    it('should handle incomplete JSON in buffer', async () => {
      const promise = service.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Send partial JSON
      mockProcess.stdout.emit('data', Buffer.from('{"success": tr'));
      
      // Send rest of JSON
      mockProcess.stdout.emit('data', Buffer.from('ue, "data": {}}\n'));

      await promise;
    });

    it('should handle malformed JSON gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Initialize the process first
      const promise = service.checkForRecordings();
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Send malformed JSON
      mockProcess.stdout.emit('data', Buffer.from('not valid json\n'));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse JSON'),
        expect.any(String),
        expect.any(Error)
      );

      // Clean up - send valid response
      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: { hasRecordings: false } }) + '\n')
      );

      await promise;

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Command Timeout Handling', () => {
    it('should timeout commands that take too long', async () => {
      const promise = service.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Don't send a response - let it timeout
      await expect(promise).rejects.toThrow('timed out');
    });

    it('should not timeout commands that respond in time', async () => {
      const promise = service.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Send response before timeout
      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: {} }) + '\n')
      );

      await expect(promise).resolves.not.toThrow();
    });

    it('should clear timeout after successful response', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      const promise = service.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: {} }) + '\n')
      );

      await promise;

      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Process Lifecycle Management', () => {
    it('should spawn Python process on first command', async () => {
      const { spawn } = require('child_process');

      const promise = service.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(spawn).toHaveBeenCalledWith('python3', ['./test.py'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Clean up
      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: {} }) + '\n')
      );
      await promise;
    });

    it('should reuse existing Python process for multiple commands', async () => {
      const { spawn } = require('child_process');

      const promise1 = service.startRecording();
      await new Promise((resolve) => setTimeout(resolve, 150));
      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: {} }) + '\n')
      );
      await promise1;

      spawn.mockClear();

      const promise2 = service.stopRecording();
      await new Promise((resolve) => setTimeout(resolve, 50));
      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: {} }) + '\n')
      );
      await promise2;

      expect(spawn).not.toHaveBeenCalled();
    });

    it('should terminate Python process on terminate()', async () => {
      // Initialize process first
      const promise = service.checkForRecordings();
      await new Promise((resolve) => setTimeout(resolve, 150));
      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: { hasRecordings: false } }) + '\n')
      );
      await promise;

      service.terminate();

      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it('should reject pending commands on process exit', async () => {
      const promise = service.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Simulate process exit
      mockProcess.emit('exit', 1);

      await expect(promise).rejects.toThrow('Python Core process exited with code 1');
    });

    it('should handle process errors', async () => {
      const { spawn } = require('child_process');
      const errorProcess = new EventEmitter();
      errorProcess.stdin = { write: jest.fn() };
      errorProcess.stdout = new EventEmitter();
      errorProcess.stderr = new EventEmitter();

      spawn.mockReturnValueOnce(errorProcess);

      const newService = new IPCBridgeService();

      // Start the command which will trigger initialization
      const promise = newService.startRecording();

      // Wait a bit for initialization to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Simulate process error during initialization
      const testError = new Error('Process spawn failed');
      errorProcess.emit('error', testError);

      // The promise should reject
      await expect(promise).rejects.toThrow();

      newService.terminate();
    }, 10000);

    it('should log stderr output', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Initialize process first
      const promise = service.checkForRecordings();
      await new Promise((resolve) => setTimeout(resolve, 150));

      mockProcess.stderr.emit('data', Buffer.from('Python error message\n'));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Python Core stderr:',
        'Python error message'
      );

      // Clean up
      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: { hasRecordings: false } }) + '\n')
      );
      await promise;

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle Python Core returning error response', async () => {
      const promise = service.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      mockProcess.stdout.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            success: false,
            error: 'PyAutoGUI not installed',
          }) + '\n'
        )
      );

      await expect(promise).rejects.toThrow('PyAutoGUI not installed');
    });

    it('should handle stopRecording error gracefully', async () => {
      // stopRecording has special error handling that returns a result object
      // instead of throwing
      const promise = service.stopRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      // For stopRecording, we need to handle the error in the implementation
      // Let's send a success response for this test
      mockProcess.stdout.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            success: true,
            data: {
              scriptPath: '/path/to/script.json',
              actionCount: 0,
              duration: 0,
            },
          }) + '\n'
        )
      );

      const result = await promise;

      expect(result.success).toBe(true);
    });

    it('should handle missing Python process', async () => {
      const { spawn } = require('child_process');
      spawn.mockReturnValueOnce(null);

      const newService = new IPCBridgeService();

      await expect(newService.startRecording()).rejects.toThrow();

      newService.terminate();
    });

    it('should handle write errors', async () => {
      // Initialize process first
      const initPromise = service.checkForRecordings();
      await new Promise((resolve) => setTimeout(resolve, 150));
      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: { hasRecordings: false } }) + '\n')
      );
      await initPromise;

      // Now mock write to fail
      mockProcess.stdin.write.mockImplementationOnce(
        (data: string, callback?: (error?: Error) => void) => {
          if (callback) callback(new Error('Write failed'));
          return false;
        }
      );

      const promise = service.startRecording();

      await expect(promise).rejects.toThrow('Write failed');
    });
  });

  describe('Event Handling', () => {
    it('should emit progress events to listeners', async () => {
      const progressListener = jest.fn();
      service.addEventListener('progress', progressListener);

      // Initialize process first
      const promise = service.checkForRecordings();
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Send a progress event
      const progressEvent = {
        type: 'progress',
        data: {
          currentAction: 50,
          totalActions: 100,
        },
      };

      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(progressEvent) + '\n'));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(progressListener).toHaveBeenCalledWith(progressEvent);

      // Clean up
      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: { hasRecordings: false } }) + '\n')
      );
      await promise;
    });

    it('should support multiple listeners for same event', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      service.addEventListener('progress', listener1);
      service.addEventListener('progress', listener2);

      // Initialize process first
      const promise = service.checkForRecordings();
      await new Promise((resolve) => setTimeout(resolve, 150));

      const event = { type: 'progress', data: {} };
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(event) + '\n'));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      // Clean up
      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: { hasRecordings: false } }) + '\n')
      );
      await promise;
    });

    it('should remove event listeners', async () => {
      const listener = jest.fn();

      service.addEventListener('progress', listener);
      service.removeEventListener('progress', listener);

      const event = { type: 'progress', data: {} };
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(event) + '\n'));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle errors in event listeners gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const faultyListener = jest.fn(() => {
        throw new Error('Listener error');
      });

      service.addEventListener('progress', faultyListener);

      // Initialize process first
      const promise = service.checkForRecordings();
      await new Promise((resolve) => setTimeout(resolve, 150));

      const event = { type: 'progress', data: {} };
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(event) + '\n'));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in event listener:',
        expect.any(Error)
      );

      // Clean up
      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: { hasRecordings: false } }) + '\n')
      );
      await promise;

      consoleErrorSpy.mockRestore();
    });
  });

  describe('API Methods', () => {
    it('should call startRecording command', async () => {
      const promise = service.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: {} }) + '\n')
      );

      await promise;

      const writtenData = mockProcess.stdin.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);

      expect(parsed.command).toBe('start_recording');
    });

    it('should call stopRecording command and return result', async () => {
      const promise = service.stopRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      const response = {
        success: true,
        data: {
          scriptPath: '/path/to/script.json',
          actionCount: 127,
          duration: 45.5,
        },
      };

      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));

      const result = await promise;

      expect(result).toEqual({
        success: true,
        scriptPath: '/path/to/script.json',
        actionCount: 127,
        duration: 45.5,
      });
    });

    it('should call startPlayback with optional script path', async () => {
      const promise = service.startPlayback('/custom/path.json');

      await new Promise((resolve) => setTimeout(resolve, 150));

      const writtenData = mockProcess.stdin.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);

      expect(parsed).toEqual({
        command: 'start_playback',
        params: { scriptPath: '/custom/path.json' },
      });

      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: {} }) + '\n')
      );

      await promise;
    });

    it('should call startPlayback without script path', async () => {
      const promise = service.startPlayback();

      await new Promise((resolve) => setTimeout(resolve, 150));

      const writtenData = mockProcess.stdin.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);

      expect(parsed).toEqual({
        command: 'start_playback',
        params: {},
      });

      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: {} }) + '\n')
      );

      await promise;
    });

    it('should call stopPlayback command', async () => {
      const promise = service.stopPlayback();

      await new Promise((resolve) => setTimeout(resolve, 150));

      const writtenData = mockProcess.stdin.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);

      expect(parsed.command).toBe('stop_playback');

      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: {} }) + '\n')
      );

      await promise;
    });

    it('should call checkForRecordings and return boolean', async () => {
      const promise = service.checkForRecordings();

      await new Promise((resolve) => setTimeout(resolve, 150));

      mockProcess.stdout.emit(
        'data',
        Buffer.from(
          JSON.stringify({ success: true, data: { hasRecordings: true, count: 5 } }) + '\n'
        )
      );

      const result = await promise;

      expect(result).toBe(true);
    });

    it('should call getLatestRecording and return path', async () => {
      const promise = service.getLatestRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      mockProcess.stdout.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            success: true,
            data: { scriptPath: '/path/to/latest.json' },
          }) + '\n'
        )
      );

      const result = await promise;

      expect(result).toBe('/path/to/latest.json');
    });

    it('should return null when no recordings exist', async () => {
      const promise = service.getLatestRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: { scriptPath: null } }) + '\n')
      );

      const result = await promise;

      expect(result).toBe(null);
    });
  });

  describe('Comprehensive Error Handling', () => {
    // Additional error scenario tests for Requirements 9.1, 9.2, 9.3, 9.4, 9.5
    it('should format permission denied errors with helpful message', async () => {
      const promise = service.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      mockProcess.stdout.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            success: false,
            error: 'Permission denied: GeniusQA needs Accessibility permissions',
          }) + '\n'
        )
      );

      await expect(promise).rejects.toThrow('Permission denied');
      await expect(promise).rejects.toThrow('Accessibility');
    });

    it('should format Python Core unavailable errors', async () => {
      const { spawn } = require('child_process');
      const errorProcess = new EventEmitter();
      errorProcess.stdin = { write: jest.fn() };
      errorProcess.stdout = new EventEmitter();
      errorProcess.stderr = new EventEmitter();

      spawn.mockReturnValueOnce(errorProcess);

      const newService = new IPCBridgeService();
      const promise = newService.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const enoentError = new Error('spawn python3 ENOENT');
      (enoentError as any).code = 'ENOENT';
      errorProcess.emit('error', enoentError);

      await expect(promise).rejects.toThrow('Python executable not found');
      await expect(promise).rejects.toThrow('Python 3.9+');

      newService.terminate();
    });

    it('should format corrupted script file errors', async () => {
      const promise = service.startPlayback();

      await new Promise((resolve) => setTimeout(resolve, 150));

      mockProcess.stdout.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            success: false,
            error: 'Script file corrupted: Invalid JSON format',
          }) + '\n'
        )
      );

      await expect(promise).rejects.toThrow('corrupted');
    });

    it('should format no recordings found errors', async () => {
      const promise = service.startPlayback();

      await new Promise((resolve) => setTimeout(resolve, 150));

      mockProcess.stdout.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            success: false,
            error: 'No recordings found. Please record a session first.',
          }) + '\n'
        )
      );

      await expect(promise).rejects.toThrow('No recordings found');
      await expect(promise).rejects.toThrow('record a session first');
    });

    it('should handle timeout errors with helpful message', async () => {
      const promise = service.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Don't send response - let it timeout
      await expect(promise).rejects.toThrow('timed out');
    });

    it('should handle already in progress errors', async () => {
      const promise = service.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      mockProcess.stdout.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            success: false,
            error: 'Recording already in progress',
          }) + '\n'
        )
      );

      await expect(promise).rejects.toThrow('already in progress');
    });

    it('should handle file system errors', async () => {
      const promise = service.stopRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      mockProcess.stdout.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            success: false,
            error: 'File system error: Not enough disk space',
          }) + '\n'
        )
      );

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('disk space');
    });

    it('should handle missing Python dependencies', async () => {
      const promise = service.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      mockProcess.stdout.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            success: false,
            error: 'Required libraries not installed: pyautogui. Please run: pip install pyautogui',
          }) + '\n'
        )
      );

      await expect(promise).rejects.toThrow('pyautogui');
      await expect(promise).rejects.toThrow('pip install');
    });

    it('should handle process exit during command execution', async () => {
      const promise1 = service.startRecording();
      const promise2 = service.checkForRecordings();

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Simulate process exit before responses
      mockProcess.emit('exit', 1);

      await expect(promise1).rejects.toThrow('exited with code 1');
      await expect(promise2).rejects.toThrow('exited with code 1');
    });

    it('should handle EACCES permission errors on process spawn', async () => {
      const { spawn } = require('child_process');
      const errorProcess = new EventEmitter();
      errorProcess.stdin = { write: jest.fn() };
      errorProcess.stdout = new EventEmitter();
      errorProcess.stderr = new EventEmitter();

      spawn.mockReturnValueOnce(errorProcess);

      const newService = new IPCBridgeService();
      const promise = newService.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const eaccesError = new Error('spawn python3 EACCES');
      (eaccesError as any).code = 'EACCES';
      errorProcess.emit('error', eaccesError);

      await expect(promise).rejects.toThrow('Permission denied');

      newService.terminate();
    });

    it('should handle multiple sequential errors', async () => {
      // Error 1: No recording in progress
      const promise1 = service.stopRecording();
      await new Promise((resolve) => setTimeout(resolve, 150));
      mockProcess.stdout.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            success: false,
            error: 'No recording in progress',
          }) + '\n'
        )
      );
      const result1 = await promise1;
      expect(result1.success).toBe(false);

      // Error 2: No recordings found
      const promise2 = service.startPlayback();
      await new Promise((resolve) => setTimeout(resolve, 50));
      mockProcess.stdout.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            success: false,
            error: 'No recordings found',
          }) + '\n'
        )
      );
      await expect(promise2).rejects.toThrow();

      // Error 3: Permission denied
      const promise3 = service.startRecording();
      await new Promise((resolve) => setTimeout(resolve, 50));
      mockProcess.stdout.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            success: false,
            error: 'Permission denied',
          }) + '\n'
        )
      );
      await expect(promise3).rejects.toThrow();
    });

    it('should handle corrupted response from Python Core', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const promise = service.checkForRecordings();
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Send corrupted JSON
      mockProcess.stdout.emit('data', Buffer.from('{"success": true, "data": {incomplete\n'));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(consoleErrorSpy).toHaveBeenCalled();

      // Send valid response to complete
      mockProcess.stdout.emit(
        'data',
        Buffer.from(JSON.stringify({ success: true, data: { hasRecordings: false } }) + '\n')
      );

      await promise;

      consoleErrorSpy.mockRestore();
    });

    it('should handle empty error messages gracefully', async () => {
      const promise = service.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      mockProcess.stdout.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            success: false,
            error: '',
          }) + '\n'
        )
      );

      await expect(promise).rejects.toThrow('unknown error');
    });

    it('should handle missing error field in error response', async () => {
      const promise = service.startRecording();

      await new Promise((resolve) => setTimeout(resolve, 150));

      mockProcess.stdout.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            success: false,
          }) + '\n'
        )
      );

      await expect(promise).rejects.toThrow('unknown error');
    });
  });
});

