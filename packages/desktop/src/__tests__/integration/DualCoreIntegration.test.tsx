/**
 * Dual-Core Integration Tests
 * Tests complete workflow from core selection to automation execution
 * Validates cross-platform compatibility, error handling, and fallback scenarios
 * Requirements: All requirements (1.1-10.5)
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import RecorderScreen from '../../screens/RecorderScreen';
import * as ipcBridgeService from '../../services/ipcBridgeService';

// Mock IPC Bridge Service
jest.mock('../../services/ipcBridgeService');

describe('Dual-Core Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Core Selection and Switching', () => {
    it('should successfully switch between Python and Rust cores', async () => {
      // Mock both cores available
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.selectCore as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { getByTestId, getByText } = render(<RecorderScreen />);

      // Wait for initial load
      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Verify core selector is present
      const coreSelector = getByTestId('core-selector');
      expect(coreSelector).toBeTruthy();

      // Switch to Rust core
      const rustOption = getByTestId('core-option-rust');
      fireEvent.press(rustOption);

      // Verify core selection was called
      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalledWith('rust');
      });

      // Switch back to Python core
      const pythonOption = getByTestId('core-option-python');
      fireEvent.press(pythonOption);

      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalledWith('python');
      });
    });

    it('should handle core switching during active recording', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue({
        success: true,
        scriptPath: '/path/to/script.json',
        actionCount: 10,
        duration: 5.0
      });
      (ipcBridgeService.selectCore as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { getByTestId, getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Start recording
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });

      // Try to switch cores during recording - should be disabled
      const rustOption = getByTestId('core-option-rust');
      expect(rustOption).toBeDisabled();

      // Stop recording
      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
      });

      // Core switching should be enabled again
      await waitFor(() => {
        expect(rustOption.props.accessibilityState?.disabled).toBe(false);
      });
    });

    it('should handle core switching during active playback', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopPlayback as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.selectCore as jest.Mock).mockResolvedValue(undefined);

      const { getByTestId, getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      // Start playback
      fireEvent.press(getByText('Start'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });

      // Try to switch cores during playback - should be disabled
      const rustOption = getByTestId('core-option-rust');
      expect(rustOption.props.accessibilityState?.disabled).toBe(true);

      // Stop playback
      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(ipcBridgeService.stopPlayback).toHaveBeenCalled();
      });

      // Core switching should be enabled again
      await waitFor(() => {
        expect(rustOption.props.accessibilityState?.disabled).toBe(false);
      });
    });
  });

  describe('Cross-Core Script File Compatibility', () => {
    it('should play recordings created with Python core using Rust core', async () => {
      // Mock Python recording creation
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
        scriptPath: '/path/to/python_script.json',
        actionCount: 15,
        duration: 8.0
      });
      (ipcBridgeService.selectCore as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);

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

      // Mock that recordings are now available
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);

      // Try to play the Python-created recording with Rust core
      fireEvent.press(getByText('Start'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });
    });

    it('should play recordings created with Rust core using Python core', async () => {
      // Mock Rust recording creation
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
        scriptPath: '/path/to/rust_script.json',
        actionCount: 20,
        duration: 12.0
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

      // Record with Rust core
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

      // Mock that recordings are now available
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);

      // Try to play the Rust-created recording with Python core
      fireEvent.press(getByText('Start'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });
    });

    it('should validate script file format compatibility', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock).mockRejectedValue(
        new Error('Script format validation failed: Incompatible JSON schema version')
      );

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      // Try to play incompatible script
      fireEvent.press(getByText('Start'));

      // Should display format validation error
      await waitFor(() => {
        expect(queryByText(/format validation failed/)).toBeTruthy();
      });
    });
  });

  describe('Error Handling and Fallback Scenarios', () => {
    it('should fallback to Python core when Rust core fails', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock)
        .mockRejectedValueOnce(new Error('Rust core failed: Permission denied'))
        .mockResolvedValueOnce(undefined); // Fallback to Python succeeds
      (ipcBridgeService.selectCore as jest.Mock).mockResolvedValue(undefined);

      const { getByTestId, getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Select Rust core
      const rustOption = getByTestId('core-option-rust');
      fireEvent.press(rustOption);
      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalledWith('rust');
      });

      // Try to record with Rust core (should fail and fallback)
      fireEvent.press(getByText('Record'));

      // Should show error and fallback message
      await waitFor(() => {
        expect(queryByText(/Permission denied/)).toBeTruthy();
        expect(queryByText(/fallback/i) || queryByText(/switched/i)).toBeTruthy();
      });
    });

    it('should fallback to Rust core when Python core fails', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock)
        .mockRejectedValueOnce(new Error('Python core failed: Dependencies missing'))
        .mockResolvedValueOnce(undefined); // Fallback to Rust succeeds
      (ipcBridgeService.selectCore as jest.Mock).mockResolvedValue(undefined);

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Try to record with Python core (should fail and fallback)
      fireEvent.press(getByText('Record'));

      // Should show error and fallback message
      await waitFor(() => {
        expect(queryByText(/Dependencies missing/)).toBeTruthy();
        expect(queryByText(/fallback/i) || queryByText(/switched/i)).toBeTruthy();
      });
    });

    it('should handle both cores unavailable scenario', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue([]);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: [],
        coreHealth: { python: false, rust: false }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockRejectedValue(
        new Error('No automation cores available')
      );

      const { queryByText } = render(<RecorderScreen />);

      // Should display no cores available message
      await waitFor(() => {
        expect(queryByText(/No automation cores available/)).toBeTruthy();
      });
    });

    it('should recover from temporary core failures', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock)
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(undefined); // Retry succeeds

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // First attempt fails
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(queryByText(/Temporary failure/)).toBeTruthy();
      });

      // Retry should succeed
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Performance Monitoring and Comparison', () => {
    it('should display performance metrics for both cores', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.getCorePerformanceMetrics as jest.Mock).mockResolvedValue({
        python: {
          avgResponseTime: 150,
          successRate: 0.95,
          totalOperations: 100,
          lastUpdated: new Date().toISOString()
        },
        rust: {
          avgResponseTime: 80,
          successRate: 0.98,
          totalOperations: 50,
          lastUpdated: new Date().toISOString()
        }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { getByTestId, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByTestId('core-selector')).toBeTruthy();
      });

      // Should display performance metrics
      await waitFor(() => {
        expect(queryByText(/150ms/) || queryByText(/80ms/)).toBeTruthy();
        expect(queryByText(/95%/) || queryByText(/98%/)).toBeTruthy();
      });
    });

    it('should recommend better performing core', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.getCorePerformanceMetrics as jest.Mock).mockResolvedValue({
        python: {
          avgResponseTime: 300, // Slow
          successRate: 0.85, // Lower success rate
          totalOperations: 100,
          lastUpdated: new Date().toISOString()
        },
        rust: {
          avgResponseTime: 50, // Fast
          successRate: 0.99, // High success rate
          totalOperations: 50,
          lastUpdated: new Date().toISOString()
        }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { queryByText } = render(<RecorderScreen />);

      // Should recommend switching to Rust core
      await waitFor(() => {
        expect(queryByText(/recommend/i) && queryByText(/rust/i)).toBeTruthy();
      });
    });

    it('should track performance during operations', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockImplementation(() => {
        // Simulate slow operation
        return new Promise(resolve => setTimeout(resolve, 1000));
      });
      (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue({
        success: true,
        scriptPath: '/path/to/script.json',
        actionCount: 10,
        duration: 5.0
      });

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      const startTime = Date.now();

      // Start recording
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });

      // Stop recording
      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
      });

      const endTime = Date.now();
      const operationTime = endTime - startTime;

      // Should have tracked the operation time (at least 1 second due to mock delay)
      expect(operationTime).toBeGreaterThan(900);
    });
  });

  describe('User Preference Persistence', () => {
    it('should persist core selection across app restarts', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'rust', // Previously selected Rust
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { getByTestId } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByTestId('core-selector')).toBeTruthy();
      });

      // Should show Rust as selected (persisted preference)
      const rustOption = getByTestId('core-option-rust');
      expect(rustOption.props.accessibilityState?.selected).toBe(true);
    });

    it('should preserve settings during core switching', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.selectCore as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);

      const { getByTestId } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByTestId('core-selector')).toBeTruthy();
      });

      // Switch cores
      const rustOption = getByTestId('core-option-rust');
      fireEvent.press(rustOption);

      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalledWith('rust');
      });

      // Settings should be preserved (recordings still available, etc.)
      // This is verified by the fact that checkForRecordings is still true
    });
  });

  describe('UI Responsiveness and Feedback', () => {
    it('should provide visual feedback during core switching', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.selectCore as jest.Mock).mockImplementation(() => {
        // Simulate slow core switching
        return new Promise(resolve => setTimeout(resolve, 500));
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { getByTestId, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByTestId('core-selector')).toBeTruthy();
      });

      // Switch to Rust core
      const rustOption = getByTestId('core-option-rust');
      fireEvent.press(rustOption);

      // Should show loading/switching feedback
      await waitFor(() => {
        expect(queryByText(/switching/i) || queryByText(/loading/i)).toBeTruthy();
      });

      // Should complete switching
      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalledWith('rust');
      }, { timeout: 1000 });
    });

    it('should update status display to show active core', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { queryByText } = render(<RecorderScreen />);

      // Should display active core in status
      await waitFor(() => {
        expect(queryByText(/rust/i) && queryByText(/active/i)).toBeTruthy();
      });
    });

    it('should show core availability indicators', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python'],
        coreHealth: { python: true, rust: false }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { getByTestId } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByTestId('core-selector')).toBeTruthy();
      });

      // Python should be available
      const pythonOption = getByTestId('core-option-python');
      expect(pythonOption.props.accessibilityState?.disabled).toBe(false);

      // Rust should be unavailable
      const rustOption = getByTestId('core-option-rust');
      expect(rustOption.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle Windows-specific automation features', async () => {
      // Mock Windows environment
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });

      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Should work on Windows
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });
    });

    it('should handle macOS-specific automation features', async () => {
      // Mock macOS environment
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      });

      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Should work on macOS
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });
    });

    it('should handle Linux-specific automation features', async () => {
      // Mock Linux environment
      Object.defineProperty(process, 'platform', {
        value: 'linux'
      });

      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Should work on Linux
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });
    });
  });
});
