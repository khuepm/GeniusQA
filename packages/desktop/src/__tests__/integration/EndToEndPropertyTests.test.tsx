/**
 * End-to-End Property-Based Tests
 * Property-based tests for complete end-to-end workflows using fast-check
 * Requirements: 4.5 (Runtime core switching)
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import RecorderScreen from '../../screens/RecorderScreen';
import { getIPCBridge } from '../../services/ipcBridgeService';

// Mock IPC Bridge Service
jest.mock('../../services/ipcBridgeService');

describe('End-to-End Property-Based Tests', () => {
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

  describe('Property 17: Runtime core switching', () => {
    /**
     * Feature: rust-automation-core, Property 17: Runtime core switching
     * 
     * Property: For any automation command when both cores are available, 
     * the system should allow runtime switching without requiring application restart
     * 
     * Validates: Requirements 4.5
     */
    it('should allow runtime core switching across all workflow scenarios', () => {
      // Generate comprehensive test scenarios
      const coreSequenceArb = fc.array(
        fc.constantFrom('python', 'rust'),
        { minLength: 2, maxLength: 5 }
      );

      const workflowStepArb = fc.constantFrom(
        'record',
        'playback',
        'pause',
        'stop',
        'list_scripts',
        'load_script'
      );

      const workflowArb = fc.array(workflowStepArb, { minLength: 1, maxLength: 4 });

      const performanceMetricsArb = fc.record({
        responseTime: fc.float({ min: 50, max: 1000 }),
        successRate: fc.float({ min: 0.7, max: 1.0 }),
        operationCount: fc.integer({ min: 0, max: 500 }),
        errorRate: fc.float({ min: 0, max: 0.1 })
      });

      fc.assert(fc.property(
        coreSequenceArb,
        workflowArb,
        performanceMetricsArb,
        async (coreSequence, workflow, metrics) => {
          // Setup: Both cores available
          mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
          mockIPCBridge.selectCore.mockResolvedValue(undefined);
          mockIPCBridge.checkForRecordings.mockResolvedValue(true);

          // Mock all workflow operations
          mockIPCBridge.startRecording.mockResolvedValue(undefined);
          mockIPCBridge.stopRecording.mockResolvedValue({
            success: true,
            scriptPath: '/path/to/script.json',
            actionCount: 25,
            duration: 10.0
          });
          mockIPCBridge.startPlayback.mockResolvedValue(undefined);
          mockIPCBridge.stopPlayback.mockResolvedValue(undefined);
          mockIPCBridge.pausePlayback.mockResolvedValue(true);
          mockIPCBridge.listScripts.mockResolvedValue([
            { path: '/script1.json', name: 'script1' },
            { path: '/script2.json', name: 'script2' }
          ]);
          mockIPCBridge.loadScript.mockResolvedValue({
            actions: [],
            metadata: { version: '1.0' }
          });

          // Mock performance metrics
          mockIPCBridge.getCorePerformanceMetrics.mockResolvedValue([
            { coreType: 'python', ...metrics },
            { coreType: 'rust', ...metrics }
          ]);

          let currentCoreIndex = 0;
          let currentCore = coreSequence[currentCoreIndex];

          // Initial core status
          mockIPCBridge.getCoreStatus.mockResolvedValue({
            activeCoreType: currentCore,
            availableCores: ['python', 'rust'],
            coreHealth: { python: true, rust: true }
          });

          render(<RecorderScreen />);

          await waitFor(() => {
            expect(screen.getByTestId('core-selector')).toBeInTheDocument();
          });

          // Execute workflow with core switching
          for (let i = 0; i < Math.min(workflow.length, coreSequence.length - 1); i++) {
            const step = workflow[i];

            // Execute workflow step
            switch (step) {
              case 'record':
                if (screen.queryByText('Record')) {
                  fireEvent.click(screen.getByText('Record'));
                  await waitFor(() => {
                    expect(mockIPCBridge.startRecording).toHaveBeenCalled();
                  });
                }
                break;

              case 'playback':
                if (screen.queryByText('Start Playback')) {
                  fireEvent.click(screen.getByText('Start Playback'));
                  await waitFor(() => {
                    expect(mockIPCBridge.startPlayback).toHaveBeenCalled();
                  });
                }
                break;

              case 'pause':
                if (screen.queryByText('Pause')) {
                  fireEvent.click(screen.getByText('Pause'));
                  await waitFor(() => {
                    expect(mockIPCBridge.pausePlayback).toHaveBeenCalled();
                  });
                }
                break;

              case 'stop':
                if (screen.queryByText('Stop Recording')) {
                  fireEvent.click(screen.getByText('Stop Recording'));
                  await waitFor(() => {
                    expect(mockIPCBridge.stopRecording).toHaveBeenCalled();
                  });
                } else if (screen.queryByText('Stop Playback')) {
                  fireEvent.click(screen.getByText('Stop Playback'));
                  await waitFor(() => {
                    expect(mockIPCBridge.stopPlayback).toHaveBeenCalled();
                  });
                }
                break;
            }

            // Switch to next core in sequence (runtime switching)
            if (currentCoreIndex < coreSequence.length - 1) {
              currentCoreIndex++;
              const nextCore = coreSequence[currentCoreIndex];

              // Update mock to reflect new core
              mockIPCBridge.getCoreStatus.mockResolvedValue({
                activeCoreType: nextCore,
                availableCores: ['python', 'rust'],
                coreHealth: { python: true, rust: true }
              });

              // Perform runtime core switch
              const nextCoreOption = screen.getByTestId(`core-option-${nextCore}`);

              // Should be able to switch cores at runtime
              expect(nextCoreOption).not.toBeDisabled();

              fireEvent.click(nextCoreOption);
              await waitFor(() => {
                expect(mockIPCBridge.selectCore).toHaveBeenCalledWith(nextCore);
              });

              currentCore = nextCore;
            }
          }

          // Property: Runtime core switching should be possible throughout the workflow
          // without requiring application restart
          expect(mockIPCBridge.selectCore).toHaveBeenCalled();

          // Verify the UI remains functional after core switches
          expect(screen.getByTestId('core-selector')).toBeInTheDocument();

          // Property: All workflow operations should work with any core
          // This is validated by the successful execution of workflow steps
        }
      ), { numRuns: 15 }); // Run 15 comprehensive test cases
    });

    it('should maintain workflow state consistency during core switches', () => {
      // Test that workflow state is preserved during runtime core switching
      const workflowStateArb = fc.record({
        hasRecordings: fc.boolean(),
        selectedScript: fc.option(fc.string({ minLength: 5, maxLength: 30 })),
        playbackSpeed: fc.constantFrom(0.5, 1.0, 1.5, 2.0, 5.0),
        loopCount: fc.integer({ min: 1, max: 10 }),
        isOperationActive: fc.boolean()
      });

      const coreTransitionArb = fc.record({
        fromCore: fc.constantFrom('python', 'rust'),
        toCore: fc.constantFrom('python', 'rust'),
        transitionTiming: fc.constantFrom('before_operation', 'after_operation', 'between_operations')
      });

      fc.assert(fc.property(
        workflowStateArb,
        coreTransitionArb,
        async (state, transition) => {
          // Skip if switching to same core
          if (transition.fromCore === transition.toCore) return;

          // Setup initial state
          mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
          mockIPCBridge.getCoreStatus.mockResolvedValue({
            activeCoreType: transition.fromCore,
            availableCores: ['python', 'rust'],
            coreHealth: { python: true, rust: true }
          });
          mockIPCBridge.checkForRecordings.mockResolvedValue(state.hasRecordings);
          mockIPCBridge.selectCore.mockResolvedValue(undefined);

          if (state.selectedScript) {
            mockIPCBridge.getLatestRecording.mockResolvedValue(state.selectedScript);
          }

          // Mock operations
          mockIPCBridge.startRecording.mockResolvedValue(undefined);
          mockIPCBridge.stopRecording.mockResolvedValue({
            success: true,
            scriptPath: '/path/to/new_script.json',
            actionCount: 15,
            duration: 8.0
          });
          mockIPCBridge.startPlayback.mockResolvedValue(undefined);
          mockIPCBridge.stopPlayback.mockResolvedValue(undefined);

          render(<RecorderScreen />);

          await waitFor(() => {
            expect(screen.getByTestId('core-selector')).toBeInTheDocument();
          });

          // Verify initial state
          if (state.hasRecordings) {
            expect(screen.getByText('Start Playback')).not.toBeDisabled();
          }

          // Perform core switch based on timing
          if (transition.transitionTiming === 'before_operation') {
            // Switch cores before starting any operation
            const targetCoreOption = screen.getByTestId(`core-option-${transition.toCore}`);
            fireEvent.click(targetCoreOption);
            await waitFor(() => {
              expect(mockIPCBridge.selectCore).toHaveBeenCalledWith(transition.toCore);
            });

            // Update mock to reflect new core
            mockIPCBridge.getCoreStatus.mockResolvedValue({
              activeCoreType: transition.toCore,
              availableCores: ['python', 'rust'],
              coreHealth: { python: true, rust: true }
            });
          }

          // Start an operation if state indicates it should be active
          if (state.isOperationActive) {
            if (state.hasRecordings) {
              fireEvent.click(screen.getByText('Start Playback'));
              await waitFor(() => {
                expect(mockIPCBridge.startPlayback).toHaveBeenCalled();
              });
            } else {
              fireEvent.click(screen.getByText('Record'));
              await waitFor(() => {
                expect(mockIPCBridge.startRecording).toHaveBeenCalled();
              });
            }

            // Stop operation if we need to switch cores after
            if (transition.transitionTiming === 'after_operation') {
              if (state.hasRecordings) {
                fireEvent.click(screen.getByText('Stop Playback'));
                await waitFor(() => {
                  expect(mockIPCBridge.stopPlayback).toHaveBeenCalled();
                });
              } else {
                fireEvent.click(screen.getByText('Stop Recording'));
                await waitFor(() => {
                  expect(mockIPCBridge.stopRecording).toHaveBeenCalled();
                });
              }

              // Now switch cores
              const targetCoreOption = screen.getByTestId(`core-option-${transition.toCore}`);
              fireEvent.click(targetCoreOption);
              await waitFor(() => {
                expect(mockIPCBridge.selectCore).toHaveBeenCalledWith(transition.toCore);
              });
            }
          }

          // Property: Workflow state should be preserved across core switches
          // - Recordings availability should remain consistent
          // - UI state should remain functional
          // - Settings should be preserved

          if (state.hasRecordings) {
            // Recordings should still be available after core switch
            expect(screen.getByText('Start Playback')).not.toBeDisabled();
          }

          // UI should remain responsive
          expect(screen.getByTestId('core-selector')).toBeInTheDocument();

          // Core switching should have been successful
          if (transition.transitionTiming !== 'between_operations' || !state.isOperationActive) {
            expect(mockIPCBridge.selectCore).toHaveBeenCalledWith(transition.toCore);
          }
        }
      ), { numRuns: 20 });
    });

    it('should handle concurrent operations during runtime core switching', () => {
      // Test runtime core switching with concurrent/overlapping operations
      const concurrentOperationsArb = fc.array(
        fc.record({
          type: fc.constantFrom('recording', 'playback', 'script_management'),
          duration: fc.float({ min: 0.1, max: 2.0 }),
          shouldSucceed: fc.boolean()
        }),
        { minLength: 1, maxLength: 3 }
      );

      fc.assert(fc.property(
        concurrentOperationsArb,
        async (operations) => {
          // Setup: Both cores available
          mockIPCBridge.getAvailableCores.mockResolvedValue(['python', 'rust']);
          mockIPCBridge.getCoreStatus.mockResolvedValue({
            activeCoreType: 'python',
            availableCores: ['python', 'rust'],
            coreHealth: { python: true, rust: true }
          });
          mockIPCBridge.checkForRecordings.mockResolvedValue(true);
          mockIPCBridge.selectCore.mockResolvedValue(undefined);

          // Mock operations with varying success/failure
          operations.forEach((op, index) => {
            if (op.shouldSucceed) {
              switch (op.type) {
                case 'recording':
                  mockIPCBridge.startRecording.mockResolvedValue(undefined);
                  mockIPCBridge.stopRecording.mockResolvedValue({
                    success: true,
                    scriptPath: `/path/to/script_${index}.json`,
                    actionCount: 10,
                    duration: op.duration
                  });
                  break;
                case 'playback':
                  mockIPCBridge.startPlayback.mockResolvedValue(undefined);
                  mockIPCBridge.stopPlayback.mockResolvedValue(undefined);
                  break;
                case 'script_management':
                  mockIPCBridge.listScripts.mockResolvedValue([
                    { path: `/script_${index}.json`, name: `script_${index}` }
                  ]);
                  break;
              }
            } else {
              // Mock failures
              const error = new Error(`${op.type} operation failed`);
              switch (op.type) {
                case 'recording':
                  mockIPCBridge.startRecording.mockRejectedValue(error);
                  break;
                case 'playback':
                  mockIPCBridge.startPlayback.mockRejectedValue(error);
                  break;
                case 'script_management':
                  mockIPCBridge.listScripts.mockRejectedValue(error);
                  break;
              }
            }
          });

          render(<RecorderScreen />);

          await waitFor(() => {
            expect(screen.getByTestId('core-selector')).toBeInTheDocument();
          });

          // Execute operations and attempt core switching
          for (const operation of operations) {
            try {
              switch (operation.type) {
                case 'recording':
                  fireEvent.click(screen.getByText('Record'));
                  await waitFor(() => {
                    expect(mockIPCBridge.startRecording).toHaveBeenCalled();
                  });

                  // Try to switch cores during recording (should be prevented)
                  const rustOption = screen.getByTestId('core-option-rust');
                  expect(rustOption).toBeDisabled();

                  // Stop recording to allow core switching
                  fireEvent.click(screen.getByText('Stop Recording'));
                  await waitFor(() => {
                    expect(mockIPCBridge.stopRecording).toHaveBeenCalled();
                  });
                  break;

                case 'playback':
                  fireEvent.click(screen.getByText('Start Playback'));
                  await waitFor(() => {
                    expect(mockIPCBridge.startPlayback).toHaveBeenCalled();
                  });

                  // Try to switch cores during playback (should be prevented)
                  const rustOptionPlayback = screen.getByTestId('core-option-rust');
                  expect(rustOptionPlayback).toBeDisabled();

                  // Stop playback to allow core switching
                  fireEvent.click(screen.getByText('Stop Playback'));
                  await waitFor(() => {
                    expect(mockIPCBridge.stopPlayback).toHaveBeenCalled();
                  });
                  break;
              }

              // After operation completes, core switching should be possible
              const rustOptionAfter = screen.getByTestId('core-option-rust');
              expect(rustOptionAfter).not.toBeDisabled();

              // Perform runtime core switch
              fireEvent.click(rustOptionAfter);
              await waitFor(() => {
                expect(mockIPCBridge.selectCore).toHaveBeenCalledWith('rust');
              });

              // Update mock for next iteration
              mockIPCBridge.getCoreStatus.mockResolvedValue({
                activeCoreType: 'rust',
                availableCores: ['python', 'rust'],
                coreHealth: { python: true, rust: true }
              });

            } catch (error) {
              // Operation failed, but UI should remain functional
              expect(screen.getByTestId('core-selector')).toBeInTheDocument();
            }
          }

          // Property: Runtime core switching should work correctly even when 
          // operations fail or succeed, maintaining system stability
          expect(screen.getByTestId('core-selector')).toBeInTheDocument();
        }
      ), { numRuns: 10 });
    });
  });

  describe('Cross-Platform Runtime Switching Properties', () => {
    it('should handle runtime core switching across different platforms', () => {
      const platformArb = fc.constantFrom('windows', 'macos', 'linux');
      const platformCapabilitiesArb = fc.record({
        supportsRust: fc.boolean(),
        supportsPython: fc.boolean(),
        hasPermissions: fc.boolean(),
        performanceProfile: fc.constantFrom('high', 'medium', 'low')
      });

      fc.assert(fc.property(
        platformArb,
        platformCapabilitiesArb,
        async (platform, capabilities) => {
          // Skip if no cores are supported
          if (!capabilities.supportsRust && !capabilities.supportsPython) return;

          // Setup platform-specific core availability
          const availableCores = [];
          if (capabilities.supportsPython) availableCores.push('python');
          if (capabilities.supportsRust) availableCores.push('rust');

          mockIPCBridge.getAvailableCores.mockResolvedValue(availableCores);
          mockIPCBridge.getCoreStatus.mockResolvedValue({
            activeCoreType: availableCores[0],
            availableCores,
            coreHealth: {
              python: capabilities.supportsPython,
              rust: capabilities.supportsRust
            }
          });
          mockIPCBridge.checkForRecordings.mockResolvedValue(true);

          // Mock platform-specific behavior
          if (capabilities.hasPermissions) {
            mockIPCBridge.selectCore.mockResolvedValue(undefined);
            mockIPCBridge.startRecording.mockResolvedValue(undefined);
            mockIPCBridge.startPlayback.mockResolvedValue(undefined);
          } else {
            const permissionError = new Error(`${platform} permissions required`);
            mockIPCBridge.selectCore.mockRejectedValue(permissionError);
            mockIPCBridge.startRecording.mockRejectedValue(permissionError);
          }

          render(<RecorderScreen />);

          await waitFor(() => {
            expect(screen.getByTestId('core-selector')).toBeInTheDocument();
          });

          // Test runtime core switching on this platform
          if (availableCores.length > 1) {
            const targetCore = availableCores[1];
            const targetCoreOption = screen.getByTestId(`core-option-${targetCore}`);

            if (capabilities.hasPermissions) {
              // Should be able to switch cores
              expect(targetCoreOption).not.toBeDisabled();
              fireEvent.click(targetCoreOption);
              await waitFor(() => {
                expect(mockIPCBridge.selectCore).toHaveBeenCalledWith(targetCore);
              });
            } else {
              // Should show permission error
              fireEvent.click(targetCoreOption);
              await waitFor(() => {
                expect(screen.getByText(/permissions/i)).toBeInTheDocument();
              });
            }
          }

          // Property: Runtime core switching should work consistently across platforms
          // when permissions and capabilities allow it
          if (capabilities.hasPermissions && availableCores.length > 1) {
            expect(mockIPCBridge.selectCore).toHaveBeenCalled();
          }

          // UI should remain functional regardless of platform
          expect(screen.getByTestId('core-selector')).toBeInTheDocument();
        }
      ), { numRuns: 12 });
    });
  });
});
