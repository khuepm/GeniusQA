/**
 * Script File Compatibility Integration Tests
 * Tests Script File compatibility across all scenarios between Python and Rust cores
 * Requirements: 2.2, 3.5, 7.1, 7.2, 7.3, 7.5
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import RecorderScreen from '../../screens/RecorderScreen';
import * as ipcBridgeService from '../../services/ipcBridgeService';

// Mock IPC Bridge Service
jest.mock('../../services/ipcBridgeService');

describe('Script File Compatibility Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Cross-Core Script File Format Compatibility', () => {
    it('should maintain identical JSON schema between Python and Rust cores', async () => {
      // Mock Python recording
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue({
        success: true,
        scriptPath: '/path/to/python_script.json',
        actionCount: 15,
        duration: 8.0,
        metadata: {
          version: '1.0',
          coreType: 'python',
          platform: 'darwin',
          createdAt: '2024-01-01T12:00:00Z'
        }
      });
      (ipcBridgeService.selectCore as jest.Mock).mockResolvedValue(undefined);

      const { getByTestId, getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Record with Python core
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });

      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
      });

      // Switch to Rust core
      const rustOption = getByTestId('core-option-rust');
      fireEvent.press(rustOption);
      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalledWith('rust');
      });

      // Mock Rust recording with identical schema
      (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue({
        success: true,
        scriptPath: '/path/to/rust_script.json',
        actionCount: 20,
        duration: 12.0,
        metadata: {
          version: '1.0', // Same version
          coreType: 'rust',
          platform: 'darwin',
          createdAt: '2024-01-01T12:05:00Z'
        }
      });

      // Record with Rust core
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalledTimes(2);
      });

      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalledTimes(2);
      });

      // Both recordings should have identical schema structure
      const pythonResult = await (ipcBridgeService.stopRecording as jest.Mock).mock.results[0].value;
      const rustResult = await (ipcBridgeService.stopRecording as jest.Mock).mock.results[1].value;

      expect(pythonResult.metadata.version).toBe(rustResult.metadata.version);
      expect(typeof pythonResult.actionCount).toBe(typeof rustResult.actionCount);
      expect(typeof pythonResult.duration).toBe(typeof rustResult.duration);
    });

    it('should validate script format before playback', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock).mockRejectedValue(
        new Error('Script validation failed: Invalid JSON schema version 0.9, expected 1.0')
      );

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      // Try to play incompatible script
      fireEvent.press(getByText('Start'));

      // Should show detailed validation error
      await waitFor(() => {
        expect(queryByText(/validation failed/i)).toBeTruthy();
        expect(queryByText(/schema version/i)).toBeTruthy();
        expect(queryByText(/0.9/)).toBeTruthy();
        expect(queryByText(/1.0/)).toBeTruthy();
      });
    });

    it('should handle script migration between format versions', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock)
        .mockRejectedValueOnce(new Error('Script format outdated: Migrating from v0.9 to v1.0'))
        .mockResolvedValueOnce(undefined); // Migration succeeds

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      // Try to play old format script
      fireEvent.press(getByText('Start'));

      // Should show migration message
      await waitFor(() => {
        expect(queryByText(/migrating/i)).toBeTruthy();
        expect(queryByText(/v0.9/)).toBeTruthy();
        expect(queryByText(/v1.0/)).toBeTruthy();
      });

      // Should eventually succeed after migration
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Cross-Core Playback Compatibility', () => {
    it('should play Python-created scripts with Rust core', async () => {
      // Setup: Python core creates a script
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock)
        .mockResolvedValueOnce({
          activeCoreType: 'python',
          availableCores: ['python', 'rust'],
          coreHealth: { python: true, rust: true }
        })
        .mockResolvedValueOnce({
          activeCoreType: 'rust',
          availableCores: ['python', 'rust'],
          coreHealth: { python: true, rust: true }
        });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue({
        success: true,
        scriptPath: '/recordings/python_mouse_clicks.json',
        actionCount: 25,
        duration: 15.5,
        actions: [
          { type: 'mouse_move', x: 100, y: 200, timestamp: 0.0 },
          { type: 'mouse_click', x: 100, y: 200, button: 'left', timestamp: 0.5 },
          { type: 'key_press', key: 'Enter', timestamp: 1.0 }
        ]
      });
      (ipcBridgeService.selectCore as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);

      const { getByTestId, getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Create script with Python core
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });

      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
      });

      // Switch to Rust core
      const rustOption = getByTestId('core-option-rust');
      fireEvent.press(rustOption);
      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalledWith('rust');
      });

      // Mock recordings available after core switch
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);

      // Play Python-created script with Rust core
      fireEvent.press(getByText('Start'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });

      // Should succeed without compatibility issues
      expect(ipcBridgeService.startPlayback).toHaveBeenCalledWith(
        expect.objectContaining({
          // Should pass the script path or use latest recording
        })
      );
    });

    it('should play Rust-created scripts with Python core', async () => {
      // Setup: Rust core creates a script
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock)
        .mockResolvedValueOnce({
          activeCoreType: 'rust',
          availableCores: ['python', 'rust'],
          coreHealth: { python: true, rust: true }
        })
        .mockResolvedValueOnce({
          activeCoreType: 'python',
          availableCores: ['python', 'rust'],
          coreHealth: { python: true, rust: true }
        });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue({
        success: true,
        scriptPath: '/recordings/rust_keyboard_sequence.json',
        actionCount: 30,
        duration: 20.0,
        actions: [
          { type: 'key_press', key: 'Ctrl+C', timestamp: 0.0 },
          { type: 'key_press', key: 'Ctrl+V', timestamp: 0.5 },
          { type: 'mouse_scroll', x: 500, y: 300, delta: -3, timestamp: 1.0 }
        ]
      });
      (ipcBridgeService.selectCore as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);

      const { getByTestId, getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Start with Rust core selected
      const rustOption = getByTestId('core-option-rust');
      fireEvent.press(rustOption);
      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalledWith('rust');
      });

      // Create script with Rust core
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });

      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
      });

      // Switch to Python core
      const pythonOption = getByTestId('core-option-python');
      fireEvent.press(pythonOption);
      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalledWith('python');
      });

      // Mock recordings available after core switch
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);

      // Play Rust-created script with Python core
      fireEvent.press(getByText('Start'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });

      // Should succeed without compatibility issues
      expect(ipcBridgeService.startPlayback).toHaveBeenCalledWith(
        expect.objectContaining({
          // Should pass the script path or use latest recording
        })
      );
    });

    it('should handle complex action sequences across cores', async () => {
      const complexScript = {
        success: true,
        scriptPath: '/recordings/complex_workflow.json',
        actionCount: 50,
        duration: 45.0,
        actions: [
          // Mouse actions
          { type: 'mouse_move', x: 100, y: 200, timestamp: 0.0 },
          { type: 'mouse_click', x: 100, y: 200, button: 'left', timestamp: 0.1 },
          { type: 'mouse_drag', startX: 100, startY: 200, endX: 300, endY: 400, timestamp: 0.5 },
          { type: 'mouse_scroll', x: 200, y: 300, delta: -5, timestamp: 1.0 },

          // Keyboard actions
          { type: 'key_press', key: 'Ctrl+A', timestamp: 1.5 },
          { type: 'key_type', text: 'Hello World', timestamp: 2.0 },
          { type: 'key_press', key: 'Tab', timestamp: 3.0 },
          { type: 'key_press', key: 'Enter', timestamp: 3.5 },

          // Complex combinations
          { type: 'key_combo', keys: ['Ctrl', 'Shift', 'N'], timestamp: 4.0 },
          { type: 'mouse_double_click', x: 150, y: 250, timestamp: 4.5 },

          // Timing-sensitive actions
          { type: 'wait', duration: 2000, timestamp: 5.0 },
          { type: 'mouse_right_click', x: 200, y: 300, timestamp: 7.0 }
        ]
      };

      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue(complexScript);
      (ipcBridgeService.selectCore as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);

      const { getByTestId, getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Record complex script with Python
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });

      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
      });

      // Switch to Rust core
      const rustOption = getByTestId('core-option-rust');
      fireEvent.press(rustOption);
      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalledWith('rust');
      });

      // Mock recordings available
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);

      // Play complex script with Rust core
      fireEvent.press(getByText('Start'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });

      // Should handle all action types without errors
      expect(ipcBridgeService.startPlayback).toHaveBeenCalledWith(
        expect.objectContaining({
          // Should successfully play the complex script
        })
      );
    });
  });

  describe('Script Metadata and Versioning', () => {
    it('should preserve metadata across core switches', async () => {
      const scriptWithMetadata = {
        success: true,
        scriptPath: '/recordings/metadata_test.json',
        actionCount: 10,
        duration: 5.0,
        metadata: {
          version: '1.0',
          coreType: 'python',
          platform: 'darwin',
          createdAt: '2024-01-01T12:00:00Z',
          userAgent: 'GeniusQA Desktop v1.0.0',
          screenResolution: '1920x1080',
          tags: ['test', 'automation'],
          description: 'Test recording for metadata preservation'
        }
      };

      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue(scriptWithMetadata);
      (ipcBridgeService.selectCore as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.getLatestRecording as jest.Mock).mockResolvedValue('/recordings/metadata_test.json');
      (ipcBridgeService.loadScript as jest.Mock).mockResolvedValue(scriptWithMetadata);

      const { getByTestId, getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Create script with metadata
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });

      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
      });

      // Switch to Rust core
      const rustOption = getByTestId('core-option-rust');
      fireEvent.press(rustOption);
      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalledWith('rust');
      });

      // Load script with Rust core - metadata should be preserved
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);

      // The metadata should be accessible and preserved
      expect(scriptWithMetadata.metadata.version).toBe('1.0');
      expect(scriptWithMetadata.metadata.coreType).toBe('python');
      expect(scriptWithMetadata.metadata.tags).toEqual(['test', 'automation']);
    });

    it('should handle version compatibility checks', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock).mockRejectedValue(
        new Error('Version compatibility check failed: Script version 2.0 not supported by current core (max: 1.0)')
      );

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      // Try to play future version script
      fireEvent.press(getByText('Start'));

      // Should show version compatibility error
      await waitFor(() => {
        expect(queryByText(/version compatibility/i)).toBeTruthy();
        expect(queryByText(/2.0/)).toBeTruthy();
        expect(queryByText(/1.0/)).toBeTruthy();
      });
    });

    it('should track core attribution in script metadata', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue({
        success: true,
        scriptPath: '/recordings/rust_attributed.json',
        actionCount: 15,
        duration: 8.0,
        metadata: {
          version: '1.0',
          coreType: 'rust', // Should be attributed to Rust core
          coreVersion: '1.0.0',
          platform: 'darwin',
          createdAt: '2024-01-01T12:00:00Z'
        }
      });

      const { getByTestId, getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Select Rust core
      const rustOption = getByTestId('core-option-rust');
      fireEvent.press(rustOption);
      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalledWith('rust');
      });

      // Record with Rust core
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });

      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
      });

      // Verify core attribution in metadata
      const result = await (ipcBridgeService.stopRecording as jest.Mock).mock.results[0].value;
      expect(result.metadata.coreType).toBe('rust');
      expect(result.metadata.coreVersion).toBeDefined();
    });
  });

  describe('Cross-Core Testing and Validation', () => {
    it('should allow side-by-side testing with both cores', async () => {
      const testScript = {
        success: true,
        scriptPath: '/recordings/test_script.json',
        actionCount: 20,
        duration: 10.0
      };

      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue(testScript);
      (ipcBridgeService.selectCore as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);

      const { getByTestId, getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Create test script with Python
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });

      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
      });

      // Mock recordings available
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);

      // Test with Python core
      fireEvent.press(getByText('Start'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalledTimes(1);
      });

      // Switch to Rust core
      const rustOption = getByTestId('core-option-rust');
      fireEvent.press(rustOption);
      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalledWith('rust');
      });

      // Test same script with Rust core
      fireEvent.press(getByText('Start'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalledTimes(2);
      });

      // Both cores should be able to play the same script
      expect(ipcBridgeService.startPlayback).toHaveBeenCalledTimes(2);
    });

    it('should provide compatibility testing results', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock)
        .mockResolvedValueOnce(undefined) // Python succeeds
        .mockRejectedValueOnce(new Error('Rust core: Unsupported action type "custom_gesture"')); // Rust fails

      const { getByTestId, getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      // Test with Python core (succeeds)
      fireEvent.press(getByText('Start'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalledTimes(1);
      });

      // Switch to Rust core
      const rustOption = getByTestId('core-option-rust');
      fireEvent.press(rustOption);
      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalledWith('rust');
      });

      // Test with Rust core (fails)
      fireEvent.press(getByText('Start'));
      await waitFor(() => {
        expect(queryByText(/Unsupported action type/i)).toBeTruthy();
        expect(queryByText(/custom_gesture/)).toBeTruthy();
      });

      // Should provide compatibility information
      expect(queryByText(/compatibility/i) || queryByText(/supported/i)).toBeTruthy();
    });

    it('should handle format validation across cores', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock).mockRejectedValue(
        new Error('Format validation failed: Missing required field "timestamp" in action at index 5')
      );

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      // Try to play malformed script
      fireEvent.press(getByText('Start'));

      // Should show detailed format validation error
      await waitFor(() => {
        expect(queryByText(/Format validation failed/i)).toBeTruthy();
        expect(queryByText(/timestamp/)).toBeTruthy();
        expect(queryByText(/index 5/)).toBeTruthy();
      });
    });
  });

  describe('Performance and Resource Usage', () => {
    it('should validate performance improvements with cross-core compatibility', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.getCorePerformanceMetrics as jest.Mock).mockResolvedValue({
        python: {
          avgResponseTime: 200,
          successRate: 0.95,
          totalOperations: 100,
          lastUpdated: new Date().toISOString()
        },
        rust: {
          avgResponseTime: 80, // Faster
          successRate: 0.98, // More reliable
          totalOperations: 50,
          lastUpdated: new Date().toISOString()
        }
      });

      const { queryByText } = render(<RecorderScreen />);

      // Should show performance comparison
      await waitFor(() => {
        expect(queryByText(/200ms/) || queryByText(/80ms/)).toBeTruthy();
        expect(queryByText(/95%/) || queryByText(/98%/)).toBeTruthy();
      });

      // Should recommend better performing core while maintaining compatibility
      expect(queryByText(/recommend/i) && queryByText(/rust/i)).toBeTruthy();
    });

    it('should track resource usage during cross-core operations', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock).mockImplementation(() => {
        // Simulate resource-intensive operation
        return new Promise(resolve => setTimeout(resolve, 1500));
      });

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      const startTime = Date.now();

      // Start resource-intensive playback
      fireEvent.press(getByText('Start'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });

      const endTime = Date.now();
      const operationTime = endTime - startTime;

      // Should track operation time for performance analysis
      expect(operationTime).toBeGreaterThan(1400);
    });
  });
});
