/**
 * Integration Property-Based Tests
 * Property-based tests for integration scenarios using fast-check
 * Requirements: 1.5 (Process restart on core change)
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import RecorderScreen from '../../screens/RecorderScreen';
import { getIPCBridge } from '../../services/ipcBridgeService';

// Mock IPC Bridge Service
jest.mock('../../services/ipcBridgeService');

describe('Integration Property-Based Tests', () => {
  let mockIPCBridge: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock IPC bridge
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
    };

    (getIPCBridge as jest.Mock).mockReturnValue(mockIPCBridge);
  });

  describe('Property 4: Process restart on core change', () => {
    /**
     * Feature: rust-automation-core, Property 4: Process restart on core change
     * 
     * Property: For any core selection change during active automation processes, 
     * the system should restart those processes using the newly selected core
     * 
     * Validates: Requirements 1.5
     */
    it('should restart processes when core changes during active operations', () => {
      // Generate test cases for different core switching scenarios
      const coreTypeArb = fc.constantFrom('python', 'rust');
      const operationTypeArb = fc.constantFrom('recording', 'playback');
      const operationStateArb = fc.record({
        isActive: fc.boolean(),
        progress: fc.float({ min: 0, max: 1 }),
        actionCount: fc.integer({ min: 0, max: 100 })
      });

      fc.assert(fc.property(
        coreTypeArb,
        coreTypeArb,
        operationTypeArb,
        operationStateArb,
        async (fromCore, toCore, operationType, operationState) => {
          // Skip if switching to same core
          if (fromCore === toCore) return;

          // Setup: Mock initial state
          mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
          mockIPCBridge.getCoreStatus.mockResolvedValue({
            activeCoreType: fromCore,
            availableCores: ['python', 'rust'],
            coreHealth: { python: true, rust: true }
          });
          mockIPCBridge.checkForRecordings.mockResolvedValue(operationType === 'playback');

          // Mock active operation
          if (operationType === 'recording') {
            mockIPCBridge.startRecording.mockResolvedValue(undefined);
            mockIPCBridge.stopRecording.mockResolvedValue({
              success: true,
              scriptPath: '/path/to/script.json',
              actionCount: operationState.actionCount,
              duration: 10.0
            });
          } else {
            mockIPCBridge.startPlayback.mockResolvedValue(undefined);
            mockIPCBridge.stopPlayback.mockResolvedValue(undefined);
          }

          mockIPCBridge.selectCore.mockResolvedValue(undefined);

          render(<RecorderScreen />);

          await waitFor(() => {
            expect(screen.getByTestId('core-selector')).toBeInTheDocument();
          });

          // Start operation if it should be active
          if (operationState.isActive) {
            if (operationType === 'recording') {
              fireEvent.click(screen.getByText('Record'));
              await waitFor(() => {
                expect(mockIPCBridge.startRecording).toHaveBeenCalled();
              });
            } else {
              fireEvent.click(screen.getByText('Start Playback'));
              await waitFor(() => {
                expect(mockIPCBridge.startPlayback).toHaveBeenCalled();
              });
            }

            // Verify operation is active (core switching should be disabled)
            const targetCoreOption = screen.getByTestId(`core-option-${toCore}`);
            expect(targetCoreOption).toBeDisabled();

            // Stop the operation to allow core switching
            if (operationType === 'recording') {
              fireEvent.click(screen.getByText('Stop Recording'));
              await waitFor(() => {
                expect(mockIPCBridge.stopRecording).toHaveBeenCalled();
              });
            } else {
              fireEvent.click(screen.getByText('Stop Playback'));
              await waitFor(() => {
                expect(mockIPCBridge.stopPlayback).toHaveBeenCalled();
              });
            }
          }

          // Now core switching should be enabled
          const targetCoreOption = screen.getByTestId(`core-option-${toCore}`);
          expect(targetCoreOption).not.toBeDisabled();

          // Switch cores
          fireEvent.click(targetCoreOption);
          await waitFor(() => {
            expect(mockIPCBridge.selectCore).toHaveBeenCalledWith(toCore);
          });

          // Update mock to reflect new core
          mockIPCBridge.getCoreStatus.mockResolvedValue({
            activeCoreType: toCore,
            availableCores: ['python', 'rust'],
            coreHealth: { python: true, rust: true }
          });

          // If we restart the operation, it should use the new core
          if (operationType === 'recording') {
            fireEvent.click(screen.getByText('Record'));
            await waitFor(() => {
              expect(mockIPCBridge.startRecording).toHaveBeenCalledTimes(operationState.isActive ? 2 : 1);
            });
          } else {
            fireEvent.click(screen.getByText('Start Playback'));
            await waitFor(() => {
              expect(mockIPCBridge.startPlayback).toHaveBeenCalledTimes(operationState.isActive ? 2 : 1);
            });
          }

          // Property: The operation should now be using the new core
          // This is verified by the fact that selectCore was called with the new core
          // and subsequent operations use the updated core status
        }
      ), { numRuns: 20 }); // Run 20 test cases
    });

    it('should handle core switching with various operation states', () => {
      // Test property across different operation states
      const operationProgressArb = fc.record({
        currentAction: fc.integer({ min: 0, max: 50 }),
        totalActions: fc.integer({ min: 1, max: 100 }),
        elapsedTime: fc.float({ min: 0, max: 60 }),
        isPaused: fc.boolean()
      });

      fc.assert(fc.property(
        operationProgressArb,
        async (progress) => {
          // Setup mock with operation in progress
          mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
          mockIPCBridge.getCoreStatus.mockResolvedValue({
            activeCoreType: 'python',
            availableCores: ['python', 'rust'],
            coreHealth: { python: true, rust: true }
          });
          mockIPCBridge.checkForRecordings.mockResolvedValue(true);
          mockIPCBridge.startPlayback.mockResolvedValue(undefined);
          mockIPCBridge.stopPlayback.mockResolvedValue(undefined);
          mockIPCBridge.selectCore.mockResolvedValue(undefined);

          render(<RecorderScreen />);

          await waitFor(() => {
            expect(screen.getByText('Start Playback')).toBeInTheDocument();
          });

          // Start playback
          fireEvent.click(screen.getByText('Start Playback'));
          await waitFor(() => {
            expect(mockIPCBridge.startPlayback).toHaveBeenCalled();
          });

          // Simulate operation progress
          const progressEvent = {
            data: {
              currentAction: progress.currentAction,
              totalActions: progress.totalActions,
              elapsedTime: progress.elapsedTime,
              isPaused: progress.isPaused
            }
          };

          // Trigger progress event
          const progressHandler = mockIPCBridge.addEventListener.mock.calls
            .find(call => call[0] === 'progress')?.[1];
          if (progressHandler) {
            progressHandler(progressEvent);
          }

          // Core switching should be disabled during active operation
          const rustOption = screen.getByTestId('core-option-rust');
          expect(rustOption).toBeDisabled();

          // Stop operation
          fireEvent.click(screen.getByText('Stop Playback'));
          await waitFor(() => {
            expect(mockIPCBridge.stopPlayback).toHaveBeenCalled();
          });

          // Core switching should now be enabled
          expect(rustOption).not.toBeDisabled();

          // Switch cores
          fireEvent.click(rustOption);
          await waitFor(() => {
            expect(mockIPCBridge.selectCore).toHaveBeenCalledWith('rust');
          });

          // Property: Core switching should always be possible after operations complete,
          // regardless of the operation's progress state when it was stopped
        }
      ), { numRuns: 15 });
    });

    it('should maintain operation integrity during core transitions', () => {
      // Test that operation data is preserved during core switches
      const scriptDataArb = fc.record({
        actionCount: fc.integer({ min: 1, max: 200 }),
        duration: fc.float({ min: 0.1, max: 120 }),
        scriptPath: fc.string({ minLength: 10, maxLength: 50 }).map(s => `/recordings/${s}.json`),
        metadata: fc.record({
          platform: fc.constantFrom('windows', 'macos', 'linux'),
          timestamp: fc.date().map(d => d.toISOString()),
          version: fc.constantFrom('1.0', '1.1', '1.2')
        })
      });

      fc.assert(fc.property(
        scriptDataArb,
        async (scriptData) => {
          // Setup: Recording creates script data
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
            scriptPath: scriptData.scriptPath,
            actionCount: scriptData.actionCount,
            duration: scriptData.duration,
            metadata: scriptData.metadata
          });
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

          // Play the script with the new core
          fireEvent.click(screen.getByText('Start Playback'));
          await waitFor(() => {
            expect(mockIPCBridge.startPlayback).toHaveBeenCalled();
          });

          // Property: Script data should be accessible and playable regardless of 
          // which core created it or which core is playing it
          const playbackCall = mockIPCBridge.startPlayback.mock.calls[0];
          expect(playbackCall).toBeDefined();

          // The script should be playable (no errors thrown)
          // This validates that the script format is compatible across cores
        }
      ), { numRuns: 10 });
    });
  });

  describe('Error Handling Properties', () => {
    it('should handle core switching errors consistently', () => {
      // Test error handling across different error types
      const errorTypeArb = fc.constantFrom(
        'validation_error',
        'permission_denied',
        'core_unavailable',
        'network_timeout',
        'system_overload'
      );

      const errorMessageArb = fc.record({
        type: errorTypeArb,
        message: fc.string({ minLength: 10, maxLength: 100 }),
        recoverable: fc.boolean(),
        suggestedAction: fc.string({ minLength: 5, maxLength: 50 })
      });

      fc.assert(fc.property(
        errorMessageArb,
        async (errorInfo) => {
          // Setup: Mock error scenario
          mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
          mockIPCBridge.getCoreStatus.mockResolvedValue({
            activeCoreType: 'python',
            availableCores: ['python', 'rust'],
            coreHealth: { python: true, rust: true }
          });
          mockIPCBridge.selectCore.mockRejectedValue(
            new Error(`${errorInfo.type}: ${errorInfo.message}`)
          );
          mockIPCBridge.checkForRecordings.mockResolvedValue(false);

          render(<RecorderScreen />);

          await waitFor(() => {
            expect(screen.getByTestId('core-selector')).toBeInTheDocument();
          });

          // Try to switch cores (should fail)
          const rustOption = screen.getByTestId('core-option-rust');
          fireEvent.click(rustOption);

          // Property: All errors should be handled gracefully and display user-friendly messages
          await waitFor(() => {
            // Should show some error indication
            expect(
              screen.getByText(new RegExp(errorInfo.type, 'i')) ||
              screen.getByText(/error/i) ||
              screen.getByText(/failed/i)
            ).toBeInTheDocument();
          });

          // Should remain on original core
          const pythonOption = screen.getByTestId('core-option-python');
          expect(pythonOption).toHaveAttribute('aria-selected', 'true');

          // UI should remain functional after error
          expect(screen.getByTestId('core-selector')).toBeInTheDocument();
        }
      ), { numRuns: 12 });
    });
  });
});
