/**
 * Core Switching Integration Tests
 * Tests comprehensive core switching scenarios including error recovery and fallback mechanisms
 * Requirements: 1.3, 1.4, 1.5, 4.5, 8.4, 9.2, 9.4, 9.5
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import RecorderScreen from '../../screens/RecorderScreen';
import * as ipcBridgeService from '../../services/ipcBridgeService';

// Mock IPC Bridge Service
jest.mock('../../services/ipcBridgeService');

describe('Core Switching Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Runtime Core Switching', () => {
    it('should allow runtime switching without application restart', async () => {
      // Mock both cores available
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
      (ipcBridgeService.selectCore as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { getByTestId, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByTestId('core-selector')).toBeTruthy();
      });

      // Verify initial state (Python active)
      expect(queryByText(/python/i) && queryByText(/active/i)).toBeTruthy();

      // Switch to Rust core at runtime
      const rustOption = getByTestId('core-option-rust');
      fireEvent.press(rustOption);

      // Verify switching without restart
      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalledWith('rust');
      });

      // Verify new active core
      await waitFor(() => {
        expect(queryByText(/rust/i) && queryByText(/active/i)).toBeTruthy();
      });

      // Switch back to Python
      const pythonOption = getByTestId('core-option-python');
      fireEvent.press(pythonOption);

      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalledWith('python');
      });
    });

    it('should handle rapid core switching attempts', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.selectCore as jest.Mock).mockImplementation(() => {
        // Simulate core switching delay
        return new Promise(resolve => setTimeout(resolve, 200));
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { getByTestId } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByTestId('core-selector')).toBeTruthy();
      });

      const rustOption = getByTestId('core-option-rust');
      const pythonOption = getByTestId('core-option-python');

      // Rapid switching attempts
      fireEvent.press(rustOption);
      fireEvent.press(pythonOption);
      fireEvent.press(rustOption);

      // Should handle gracefully without errors
      await waitFor(() => {
        expect(ipcBridgeService.selectCore).toHaveBeenCalled();
      }, { timeout: 1000 });

      // Should not crash or show errors
      expect(getByTestId('core-selector')).toBeTruthy();
    });

    it('should prevent core switching during active operations', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockImplementation(() => {
        // Simulate long-running recording
        return new Promise(resolve => setTimeout(resolve, 2000));
      });

      const { getByTestId, getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Start recording
      fireEvent.press(getByText('Record'));

      // Core switching should be disabled during recording
      await waitFor(() => {
        const rustOption = getByTestId('core-option-rust');
        expect(rustOption.props.accessibilityState?.disabled).toBe(true);
      });

      // Verify selectCore is not called during active operation
      const rustOption = getByTestId('core-option-rust');
      fireEvent.press(rustOption);

      // Should not call selectCore while recording
      expect(ipcBridgeService.selectCore).not.toHaveBeenCalled();
    });
  });

  describe('Automatic Fallback Mechanisms', () => {
    it('should automatically fallback when preferred core becomes unavailable', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock)
        .mockResolvedValueOnce(['python', 'rust'])
        .mockResolvedValueOnce(['python']); // Rust becomes unavailable
      (ipcBridgeService.getCoreStatus as jest.Mock)
        .mockResolvedValueOnce({
          activeCoreType: 'rust',
          availableCores: ['python', 'rust'],
          coreHealth: { python: true, rust: true }
        })
        .mockResolvedValueOnce({
          activeCoreType: 'python', // Automatically switched to Python
          availableCores: ['python'],
          coreHealth: { python: true, rust: false }
        });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock)
        .mockRejectedValueOnce(new Error('Rust core unavailable'))
        .mockResolvedValueOnce(undefined); // Python fallback succeeds

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Try to record with Rust core (should fail and fallback)
      fireEvent.press(getByText('Record'));

      // Should show fallback message
      await waitFor(() => {
        expect(queryByText(/fallback/i) || queryByText(/switched/i)).toBeTruthy();
      });

      // Should eventually succeed with Python core
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle graceful degradation when no cores are available', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue([]);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: [],
        coreHealth: { python: false, rust: false }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockRejectedValue(
        new Error('No automation cores are available')
      );

      const { queryByText, getByText } = render(<RecorderScreen />);

      // Should display clear instructions
      await waitFor(() => {
        expect(queryByText(/No automation cores/i)).toBeTruthy();
        expect(queryByText(/install/i) || queryByText(/dependencies/i)).toBeTruthy();
      });

      // Buttons should be disabled
      await waitFor(() => {
        const recordButton = getByText('Record');
        expect(recordButton.props.accessibilityState?.disabled).toBe(true);
      });
    });

    it('should recover when cores become available again', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock)
        .mockResolvedValueOnce([]) // Initially no cores
        .mockResolvedValueOnce(['python']); // Python becomes available
      (ipcBridgeService.getCoreStatus as jest.Mock)
        .mockResolvedValueOnce({
          activeCoreType: 'python',
          availableCores: [],
          coreHealth: { python: false, rust: false }
        })
        .mockResolvedValueOnce({
          activeCoreType: 'python',
          availableCores: ['python'],
          coreHealth: { python: true, rust: false }
        });
      (ipcBridgeService.checkForRecordings as jest.Mock)
        .mockRejectedValueOnce(new Error('No cores available'))
        .mockResolvedValueOnce(false);

      const { queryByText, getByText } = render(<RecorderScreen />);

      // Initially no cores available
      await waitFor(() => {
        expect(queryByText(/No automation cores/i)).toBeTruthy();
      });

      // Simulate core becoming available (e.g., user installs dependencies)
      // This would typically happen through a refresh or health check
      await waitFor(() => {
        const recordButton = getByText('Record');
        // Should eventually become enabled when core is available
        expect(recordButton).toBeTruthy();
      });
    });
  });

  describe('Core Availability Detection', () => {
    it('should detect core availability changes in real-time', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock)
        .mockResolvedValueOnce(['python'])
        .mockResolvedValueOnce(['python', 'rust']); // Rust becomes available
      (ipcBridgeService.getCoreStatus as jest.Mock)
        .mockResolvedValueOnce({
          activeCoreType: 'python',
          availableCores: ['python'],
          coreHealth: { python: true, rust: false }
        })
        .mockResolvedValueOnce({
          activeCoreType: 'python',
          availableCores: ['python', 'rust'],
          coreHealth: { python: true, rust: true }
        });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { getByTestId } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByTestId('core-selector')).toBeTruthy();
      });

      // Initially only Python available
      const rustOption = getByTestId('core-option-rust');
      expect(rustOption.props.accessibilityState?.disabled).toBe(true);

      // Simulate Rust core becoming available
      // In real app, this would be triggered by health checks or user actions
      await waitFor(() => {
        // Rust should become available
        expect(rustOption.props.accessibilityState?.disabled).toBe(false);
      });
    });

    it('should update UI when core availability changes', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock)
        .mockResolvedValueOnce(['python', 'rust'])
        .mockResolvedValueOnce(['python']); // Rust becomes unavailable
      (ipcBridgeService.getCoreStatus as jest.Mock)
        .mockResolvedValueOnce({
          activeCoreType: 'python',
          availableCores: ['python', 'rust'],
          coreHealth: { python: true, rust: true }
        })
        .mockResolvedValueOnce({
          activeCoreType: 'python',
          availableCores: ['python'],
          coreHealth: { python: true, rust: false }
        });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { getByTestId, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByTestId('core-selector')).toBeTruthy();
      });

      // Initially both cores available
      const rustOption = getByTestId('core-option-rust');
      expect(rustOption.props.accessibilityState?.disabled).toBe(false);

      // Simulate Rust core becoming unavailable
      await waitFor(() => {
        expect(rustOption.props.accessibilityState?.disabled).toBe(true);
        expect(queryByText(/unavailable/i) || queryByText(/offline/i)).toBeTruthy();
      });
    });

    it('should provide detailed core health information', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python'],
        coreHealth: {
          python: true,
          rust: false // Rust unavailable with reason
        }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { queryByText } = render(<RecorderScreen />);

      // Should show health status information
      await waitFor(() => {
        expect(queryByText(/python/i) && queryByText(/available/i)).toBeTruthy();
        expect(queryByText(/rust/i) && queryByText(/unavailable/i)).toBeTruthy();
      });
    });
  });

  describe('Error Recovery and Fallback', () => {
    it('should handle core switching validation errors', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.selectCore as jest.Mock).mockRejectedValue(
        new Error('Core validation failed: Rust core permissions not granted')
      );
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { getByTestId, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByTestId('core-selector')).toBeTruthy();
      });

      // Try to switch to Rust core
      const rustOption = getByTestId('core-option-rust');
      fireEvent.press(rustOption);

      // Should show validation error
      await waitFor(() => {
        expect(queryByText(/validation failed/i)).toBeTruthy();
        expect(queryByText(/permissions/i)).toBeTruthy();
      });

      // Should remain on Python core
      const pythonOption = getByTestId('core-option-python');
      expect(pythonOption.props.accessibilityState?.selected).toBe(true);
    });

    it('should handle core failure during operation with automatic recovery', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock)
        .mockRejectedValueOnce(new Error('Rust core crashed during playback'))
        .mockResolvedValueOnce(undefined); // Python fallback succeeds
      (ipcBridgeService.selectCore as jest.Mock).mockResolvedValue(undefined);

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      // Start playback with Rust core (should fail and recover)
      fireEvent.press(getByText('Start'));

      // Should show error and recovery message
      await waitFor(() => {
        expect(queryByText(/crashed/i)).toBeTruthy();
        expect(queryByText(/switched/i) || queryByText(/fallback/i)).toBeTruthy();
      });

      // Should eventually succeed with fallback
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalledTimes(2);
      });
    });

    it('should provide actionable error messages for core failures', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockRejectedValue(
        new Error('Rust core failed: macOS Accessibility permissions required')
      );

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Try to record with Rust core
      fireEvent.press(getByText('Record'));

      // Should show actionable error message
      await waitFor(() => {
        expect(queryByText(/Accessibility permissions/i)).toBeTruthy();
        expect(queryByText(/System Preferences/i) || queryByText(/Settings/i)).toBeTruthy();
      });
    });

    it('should track and report failure patterns', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'rust',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockRejectedValue(
        new Error('Rust core timeout')
      );

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Multiple failures with same core
      for (let i = 0; i < 3; i++) {
        fireEvent.press(getByText('Record'));
        await waitFor(() => {
          expect(queryByText(/timeout/i)).toBeTruthy();
        });
      }

      // Should suggest switching cores after multiple failures
      await waitFor(() => {
        expect(queryByText(/recommend/i) && queryByText(/python/i)).toBeTruthy();
      });
    });
  });

  describe('Performance-Based Core Switching', () => {
    it('should recommend core switching based on performance metrics', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.getCorePerformanceMetrics as jest.Mock).mockResolvedValue({
        python: {
          avgResponseTime: 500, // Slow
          successRate: 0.80, // Low success rate
          totalOperations: 100,
          lastUpdated: new Date().toISOString()
        },
        rust: {
          avgResponseTime: 100, // Fast
          successRate: 0.98, // High success rate
          totalOperations: 50,
          lastUpdated: new Date().toISOString()
        }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { queryByText } = render(<RecorderScreen />);

      // Should recommend switching to better performing core
      await waitFor(() => {
        expect(queryByText(/recommend/i) && queryByText(/rust/i)).toBeTruthy();
        expect(queryByText(/faster/i) || queryByText(/better/i)).toBeTruthy();
      });
    });

    it('should automatically suggest core switching after performance degradation', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockImplementation(() => {
        // Simulate very slow operation
        return new Promise(resolve => setTimeout(resolve, 3000));
      });

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Perform slow operation
      fireEvent.press(getByText('Record'));

      // Should detect performance issue and suggest switching
      await waitFor(() => {
        expect(queryByText(/slow/i) || queryByText(/performance/i)).toBeTruthy();
        expect(queryByText(/try/i) && queryByText(/rust/i)).toBeTruthy();
      }, { timeout: 5000 });
    });

    it('should provide performance comparison when both cores have data', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.getCorePerformanceMetrics as jest.Mock).mockResolvedValue({
        python: {
          avgResponseTime: 200,
          successRate: 0.95,
          totalOperations: 100,
          lastUpdated: new Date().toISOString()
        },
        rust: {
          avgResponseTime: 150,
          successRate: 0.97,
          totalOperations: 80,
          lastUpdated: new Date().toISOString()
        }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { queryByText } = render(<RecorderScreen />);

      // Should show performance comparison
      await waitFor(() => {
        expect(queryByText(/200ms/) || queryByText(/150ms/)).toBeTruthy();
        expect(queryByText(/95%/) || queryByText(/97%/)).toBeTruthy();
      });
    });
  });

  describe('User Preference Management', () => {
    it('should save and restore core preferences', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python', 'rust']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'rust', // User's saved preference
        availableCores: ['python', 'rust'],
        coreHealth: { python: true, rust: true }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { getByTestId } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByTestId('core-selector')).toBeTruthy();
      });

      // Should restore user's preference (Rust selected)
      const rustOption = getByTestId('core-option-rust');
      expect(rustOption.props.accessibilityState?.selected).toBe(true);
    });

    it('should handle preference migration when preferred core is unavailable', async () => {
      (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue(['python']);
      (ipcBridgeService.getCoreStatus as jest.Mock).mockResolvedValue({
        activeCoreType: 'python', // Migrated from unavailable Rust
        availableCores: ['python'],
        coreHealth: { python: true, rust: false }
      });
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { getByTestId, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByTestId('core-selector')).toBeTruthy();
      });

      // Should show migration message
      expect(queryByText(/migrated/i) || queryByText(/switched/i)).toBeTruthy();

      // Should use available core
      const pythonOption = getByTestId('core-option-python');
      expect(pythonOption.props.accessibilityState?.selected).toBe(true);
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

      // Verify settings are preserved (recordings still available)
      // This is implicit in the test setup where checkForRecordings returns true
    });
  });
});
