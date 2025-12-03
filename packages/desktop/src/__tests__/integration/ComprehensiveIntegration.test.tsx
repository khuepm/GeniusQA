/**
 * Comprehensive Integration Tests
 * Tests core switching during active operations, Script File compatibility, 
 * UI responsiveness, and error recovery mechanisms
 * Requirements: 1.3, 1.4, 1.5, 4.5, 7.1, 7.2, 7.3, 8.4, 9.2, 9.4
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import RecorderScreen from '../../screens/RecorderScreen';
import { getIPCBridge } from '../../services/ipcBridgeService';

// Mock IPC Bridge Service
jest.mock('../../services/ipcBridgeService');

describe('Comprehensive Integration Tests', () => {
  let mockIPCBridge: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create comprehensive mock IPC bridge
    mockIPCBridge = {
      getAvailableCores: jest.fn(),
      getCoreStatus: jest.fn(),
      selectCore: jest.fn(),
      checkForRecordings: jest.fn(),
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
      startPlayback: jest.fn(),
      stopPlayback: jest.fn(),
      pausePlayback: jest.fn(),
      getLatestRecording: jest.fn(),
      getCorePerformanceMetrics: jest.fn(),
      getPerformanceComparison: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      listScripts: jest.fn(),
      loadScript: jest.fn(),
      saveScript: jest.fn(),
      deleteScript: jest.fn(),
    };

    (getIPCBridge as jest.Mock).mockReturnValue(mockIPCBridge);
  });

  describe('Core Switching During Active Operations', () => {
    it('should prevent core switching during active recording', async () => {
      // Setup: Both cores available, recording in progress
      mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
      mockIPCBridge.getCoreStatus.mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);
      mockIPCBridge.startRecording.mockImplementation(() => {
        // Simulate long-running recording
        return new Promise(resolve => setTimeout(resolve, 1000));
      });

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      // Start recording
      fireEvent.click(screen.getByText('Record'));

      // Verify recording started
      await waitFor(() => {
        expect(mockIPCBridge.startRecording).toHaveBeenCalled();
      });

      // Try to switch cores during recording - should be prevented
      const rustOption = screen.getByTestId('core-option-rust');
      expect(rustOption).toBeDisabled();

      // Verify selectCore is not called during recording
      fireEvent.click(rustOption);
      expect(mockIPCBridge.selectCore).not.toHaveBeenCalled();
    });

    it('should prevent core switching during active playback', async () => {
      // Setup: Both cores available, playback in progress
      mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
      mockIPCBridge.getCoreStatus.mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.startPlayback.mockImplementation(() => {
        // Simulate long-running playback
        return new Promise(resolve => setTimeout(resolve, 1000));
      });

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(screen.getByText('Start Playback')).toBeInTheDocument();
      });

      // Start playback
      fireEvent.click(screen.getByText('Start Playback'));

      // Verify playback started
      await waitFor(() => {
        expect(mockIPCBridge.startPlayback).toHaveBeenCalled();
      });

      // Try to switch cores during playback - should be prevented
      const rustOption = screen.getByTestId('core-option-rust');
      expect(rustOption).toBeDisabled();

      // Verify selectCore is not called during playback
      fireEvent.click(rustOption);
      expect(mockIPCBridge.selectCore).not.toHaveBeenCalled();
    });

    it('should allow core switching after operations complete', async () => {
      // Setup: Recording completes, then core switching should be enabled
      mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
      mockIPCBridge.getCoreStatus.mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);
      mockIPCBridge.startRecording.mockResolvedValue(undefined);
      mockIPCBridge.stopRecording.mockResolvedValue({
        success: true,
        scriptPath: '/path/to/script.json',
        actionCount: 10,
        duration: 5.0
      });
      mockIPCBridge.selectCore.mockResolvedValue(undefined);

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      // Start and complete recording
      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(mockIPCBridge.startRecording).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByText('Stop Recording'));
      await waitFor(() => {
        expect(mockIPCBridge.stopRecording).toHaveBeenCalled();
      });

      // Core switching should now be enabled
      const rustOption = screen.getByTestId('core-option-rust');
      expect(rustOption).not.toBeDisabled();

      // Should be able to switch cores
      fireEvent.click(rustOption);
      await waitFor(() => {
        expect(mockIPCBridge.selectCore).toHaveBeenCalledWith('rust');
      });
    });
  });

  describe('Script File Compatibility Across All Scenarios', () => {
    it('should handle complex script format validation', async () => {
      mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
      mockIPCBridge.getCoreStatus.mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.startPlayback.mockRejectedValue(
        new Error('Script validation failed: Action at index 3 has invalid timestamp format')
      );

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(screen.getByText('Start Playback')).toBeInTheDocument();
      });

      // Try to play script with validation error
      fireEvent.click(screen.getByText('Start Playback'));

      // Should show detailed validation error
      await waitFor(() => {
        expect(screen.getByText(/validation failed/i)).toBeInTheDocument();
        expect(screen.getByText(/index 3/)).toBeInTheDocument();
        expect(screen.getByText(/timestamp format/)).toBeInTheDocument();
      });
    });

    it('should handle script migration between versions', async () => {
      mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
      mockIPCBridge.getCoreStatus.mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.startPlayback
        .mockRejectedValueOnce(new Error('Script format outdated: Migrating from v1.0 to v1.1'))
        .mockResolvedValueOnce(undefined); // Migration succeeds

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(screen.getByText('Start Playback')).toBeInTheDocument();
      });

      // Try to play old format script
      fireEvent.click(screen.getByText('Start Playback'));

      // Should show migration message
      await waitFor(() => {
        expect(screen.getByText(/migrating/i)).toBeInTheDocument();
        expect(screen.getByText(/v1.0/)).toBeInTheDocument();
        expect(screen.getByText(/v1.1/)).toBeInTheDocument();
      });

      // Should eventually succeed after migration
      await waitFor(() => {
        expect(mockIPCBridge.startPlayback).toHaveBeenCalledTimes(2);
      });
    });

    it('should validate cross-core action compatibility', async () => {
      // Test that actions recorded with one core work with another
      const pythonScript = {
        success: true,
        scriptPath: '/recordings/python_actions.json',
        actionCount: 25,
        duration: 15.0,
        actions: [
          { type: 'mouse_move', x: 100, y: 200, timestamp: 0.0 },
          { type: 'mouse_click', x: 100, y: 200, button: 'left', timestamp: 0.5 },
          { type: 'key_press', key: 'Enter', timestamp: 1.0 },
          { type: 'mouse_scroll', x: 200, y: 300, delta: -3, timestamp: 1.5 }
        ]
      };

      mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
      mockIPCBridge.getCoreStatus.mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);
      mockIPCBridge.startRecording.mockResolvedValue(undefined);
      mockIPCBridge.stopRecording.mockResolvedValue(pythonScript);
      mockIPCBridge.selectCore.mockResolvedValue(undefined);
      mockIPCBridge.startPlayback.mockResolvedValue(undefined);

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      // Record with Python core
      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(mockIPCBridge.startRecording).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByText('Stop Recording'));
      await waitFor(() => {
        expect(mockIPCBridge.stopRecording).toHaveBeenCalled();
      });

      // Switch to Rust core
      const rustOption = screen.getByTestId('core-option-rust');
      fireEvent.click(rustOption);
      await waitFor(() => {
        expect(mockIPCBridge.selectCore).toHaveBeenCalledWith('rust');
      });

      // Mock recordings available after core switch
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);

      // Play Python-created script with Rust core
      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        expect(mockIPCBridge.startPlayback).toHaveBeenCalled();
      });

      // Should succeed without compatibility issues
      expect(mockIPCBridge.startPlayback).toHaveBeenCalledWith(
        expect.any(String), // script path
        expect.any(Number), // speed
        expect.any(Number)  // loop count
      );
    });

    it('should handle unsupported action types gracefully', async () => {
      mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
      mockIPCBridge.getCoreStatus.mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.startPlayback.mockRejectedValue(
        new Error('Rust core: Unsupported action type "custom_gesture" at action index 7')
      );

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(screen.getByText('Start Playback')).toBeInTheDocument();
      });

      // Try to play script with unsupported action
      fireEvent.click(screen.getByText('Start Playback'));

      // Should show specific error about unsupported action
      await waitFor(() => {
        expect(screen.getByText(/Unsupported action type/i)).toBeInTheDocument();
        expect(screen.getByText(/custom_gesture/)).toBeInTheDocument();
        expect(screen.getByText(/index 7/)).toBeInTheDocument();
      });
    });
  });

  describe('UI Responsiveness During Core Operations', () => {
    it('should provide immediate visual feedback during core switching', async () => {
      mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
      mockIPCBridge.getCoreStatus.mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      mockIPCBridge.selectCore.mockImplementation(() => {
        // Simulate slow core switching
        return new Promise(resolve => setTimeout(resolve, 800));
      });
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('core-selector')).toBeInTheDocument();
      });

      // Switch to Rust core
      const rustOption = screen.getByTestId('core-option-rust');
      fireEvent.click(rustOption);

      // Should show immediate switching feedback
      await waitFor(() => {
        expect(screen.getByText(/switching/i) || screen.getByText(/loading/i)).toBeInTheDocument();
      });

      // Should complete switching
      await waitFor(() => {
        expect(mockIPCBridge.selectCore).toHaveBeenCalledWith('rust');
      }, { timeout: 1000 });
    });

    it('should update UI state correctly during operations', async () => {
      mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
      mockIPCBridge.getCoreStatus.mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);
      mockIPCBridge.startRecording.mockResolvedValue(undefined);

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      // Start recording
      fireEvent.click(screen.getByText('Record'));

      // UI should update to show recording state
      await waitFor(() => {
        expect(screen.getByText(/recording/i) || screen.getByText(/stop/i)).toBeInTheDocument();
      });

      // Buttons should be in correct state
      const recordButton = screen.getByText('Record');
      expect(recordButton).toBeDisabled();
    });

    it('should handle rapid user interactions gracefully', async () => {
      mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
      mockIPCBridge.getCoreStatus.mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      mockIPCBridge.selectCore.mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 100));
      });
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('core-selector')).toBeInTheDocument();
      });

      const rustOption = screen.getByTestId('core-option-rust');
      const pythonOption = screen.getByTestId('core-option-python');

      // Rapid clicking should be handled gracefully
      fireEvent.click(rustOption);
      fireEvent.click(pythonOption);
      fireEvent.click(rustOption);

      // Should not crash and should handle the interactions
      await waitFor(() => {
        expect(mockIPCBridge.selectCore).toHaveBeenCalled();
      });

      // UI should remain responsive
      expect(screen.getByTestId('core-selector')).toBeInTheDocument();
    });
  });

  describe('Error Recovery and Fallback Mechanisms', () => {
    it('should recover from core switching failures', async () => {
      mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
      mockIPCBridge.getCoreStatus.mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      mockIPCBridge.selectCore.mockRejectedValue(
        new Error('Core switching failed: Rust core validation error')
      );
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('core-selector')).toBeInTheDocument();
      });

      // Try to switch to Rust core (should fail)
      const rustOption = screen.getByTestId('core-option-rust');
      fireEvent.click(rustOption);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/switching failed/i)).toBeInTheDocument();
        expect(screen.getByText(/validation error/i)).toBeInTheDocument();
      });

      // Should remain on Python core
      const pythonOption = screen.getByTestId('core-option-python');
      expect(pythonOption).toHaveAttribute('aria-selected', 'true');
    });

    it('should handle operation failures with detailed error reporting', async () => {
      mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
      mockIPCBridge.getCoreStatus.mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);
      mockIPCBridge.startRecording.mockRejectedValue(
        new Error('Rust core failed: macOS Accessibility permissions not granted. Please enable in System Preferences > Security & Privacy > Privacy > Accessibility.')
      );

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      // Try to record (should fail with detailed error)
      fireEvent.click(screen.getByText('Record'));

      // Should show detailed error with actionable instructions
      await waitFor(() => {
        expect(screen.getByText(/Accessibility permissions/i)).toBeInTheDocument();
        expect(screen.getByText(/System Preferences/i)).toBeInTheDocument();
      });
    });

    it('should implement automatic retry mechanisms', async () => {
      mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
      mockIPCBridge.getCoreStatus.mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);
      mockIPCBridge.startRecording
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce(undefined); // Retry succeeds

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      // First attempt fails
      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Retry should succeed
      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(mockIPCBridge.startRecording).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle cascading failures gracefully', async () => {
      mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
      mockIPCBridge.getCoreStatus.mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.startPlayback.mockRejectedValue(
        new Error('Rust core failed: System overload')
      );
      mockIPCBridge.selectCore.mockRejectedValue(
        new Error('Python core also unavailable: Dependencies missing')
      );

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(screen.getByText('Start Playback')).toBeInTheDocument();
      });

      // Try to play (Rust fails)
      fireEvent.click(screen.getByText('Start Playback'));

      await waitFor(() => {
        expect(screen.getByText(/System overload/i)).toBeInTheDocument();
      });

      // Try to switch to Python (also fails)
      const pythonOption = screen.getByTestId('core-option-python');
      fireEvent.click(pythonOption);

      await waitFor(() => {
        expect(screen.getByText(/Dependencies missing/i)).toBeInTheDocument();
      });

      // Should show comprehensive error state
      expect(screen.getByText(/unavailable/i) || screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should monitor resource usage during operations', async () => {
      mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
      mockIPCBridge.getCoreStatus.mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      mockIPCBridge.getCorePerformanceMetrics.mockResolvedValue([
        {
          coreType: 'python',
          lastOperationTime: 250,
          memoryUsage: 45.2,
          cpuUsage: 12.5,
          operationCount: 150,
          errorRate: 0.02
        },
        {
          coreType: 'rust',
          lastOperationTime: 120,
          memoryUsage: 28.1,
          cpuUsage: 8.3,
          operationCount: 75,
          errorRate: 0.01
        }
      ]);
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('core-selector')).toBeInTheDocument();
      });

      // Should display performance metrics
      await waitFor(() => {
        expect(screen.getByText(/250ms/) || screen.getByText(/120ms/)).toBeInTheDocument();
        expect(screen.getByText(/45.2/) || screen.getByText(/28.1/)).toBeInTheDocument();
      });
    });

    it('should provide performance-based recommendations', async () => {
      mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
      mockIPCBridge.getCoreStatus.mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      mockIPCBridge.getPerformanceComparison.mockResolvedValue({
        pythonMetrics: {
          coreType: 'python',
          lastOperationTime: 400,
          memoryUsage: 65.0,
          cpuUsage: 25.0,
          operationCount: 200,
          errorRate: 0.05
        },
        rustMetrics: {
          coreType: 'rust',
          lastOperationTime: 150,
          memoryUsage: 35.0,
          cpuUsage: 12.0,
          operationCount: 100,
          errorRate: 0.01
        },
        recommendation: {
          recommendedCore: 'rust',
          confidence: 0.85,
          reasons: [
            'Rust core has 62% faster response times',
            'Rust core uses 46% less memory',
            'Rust core has 80% lower error rate'
          ],
          performanceImprovement: 62
        },
        comparisonDetails: {
          responseTimeRatio: 0.375,
          memoryUsageRatio: 0.54,
          successRateDifference: 0.04,
          operationsCountDifference: -100
        }
      });
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('core-selector')).toBeInTheDocument();
      });

      // Should show performance recommendation
      await waitFor(() => {
        expect(screen.getByText(/recommend/i)).toBeInTheDocument();
        expect(screen.getByText(/rust/i)).toBeInTheDocument();
        expect(screen.getByText(/62%/)).toBeInTheDocument();
      });
    });
  });
});
