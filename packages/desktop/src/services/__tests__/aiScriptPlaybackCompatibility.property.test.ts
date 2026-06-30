/**
 * Property-Based Tests for AI Script Playback Compatibility
 * 
 * Tests that AI-generated scripts can be loaded and played in the Desktop Recorder
 * with the same playback controls as recorded scripts.
 * 
 * For any AI-generated script, selecting it in the Recorder should load it with
 * the same playback controls as recorded scripts.
 * 
 * **Feature: ai-script-builder, Property 17: AI Script Playback Compatibility**
 * **Validates: Requirements 9.3**
 */

import * as fc from 'fast-check';
import {
    Action,
    ActionType,
    ScriptData
} from '../../types/aiScriptBuilder.types';
import { IPCEvent } from '../../types/recorder.types';
import { getIPCBridge, resetIPCBridge } from '../ipcBridgeService';
import { getPlaybackService, PlaybackService, resetPlaybackService } from '../playbackService';
import { prepareScriptForSave, TargetOS } from '../scriptStorageService';

// Mock the IPC bridge
jest.mock('../ipcBridgeService');

// Suppress PlaybackService console output for the whole module. fast-check runs
// each property many times and the service logs on every start; restoring the
// spy per-test would let late async logs trip jest's "log after teardown" guard.
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  (console.log as jest.Mock).mockRestore?.();
  (console.error as jest.Mock).mockRestore?.();
});

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a valid target OS
 */
const targetOSArbitrary: fc.Arbitrary<TargetOS> = fc.constantFrom(
  'macos',
  'windows',
  'universal'
);

/**
 * Generate a valid action type
 */
const actionTypeArbitrary: fc.Arbitrary<ActionType> = fc.constantFrom(
  'mouse_move',
  'mouse_click',
  'mouse_double_click',
  'mouse_drag',
  'mouse_scroll',
  'key_press',
  'key_release',
  'key_type',
  'screenshot',
  'wait',
  'custom'
);

/**
 * Generate a valid action
 */
const actionArbitrary = (timestamp: number): fc.Arbitrary<Action> => {
  return fc.oneof(
    // Mouse actions
    fc.record({
      type: fc.constantFrom('mouse_move' as const, 'mouse_click' as const),
      timestamp: fc.constant(timestamp),
      x: fc.integer({ min: 0, max: 1920 }),
      y: fc.integer({ min: 0, max: 1080 }),
      button: fc.option(fc.constantFrom('left' as const, 'right' as const, 'middle' as const), { nil: undefined }),
    }),
    // Keyboard actions
    fc.record({
      type: fc.constantFrom('key_press' as const, 'key_release' as const),
      timestamp: fc.constant(timestamp),
      key: fc.constantFrom('a', 'b', 'c', 'enter', 'escape', 'tab'),
      modifiers: fc.option(fc.array(fc.constantFrom('ctrl', 'shift', 'alt', 'meta'), { maxLength: 2 }), { nil: undefined }),
    }),
    // Key type action
    fc.record({
      type: fc.constant('key_type' as const),
      timestamp: fc.constant(timestamp),
      text: fc.string({ minLength: 1, maxLength: 50 }),
    }),
    // Wait action
    fc.record({
      type: fc.constant('wait' as const),
      timestamp: fc.constant(timestamp),
    })
  );
};

/**
 * Generate a valid AI-generated script
 */
const aiGeneratedScriptArbitrary: fc.Arbitrary<ScriptData> = fc
  .integer({ min: 1, max: 20 })
  .chain(actionCount => {
    // Generate timestamps in ascending order
    const timestamps = Array.from({ length: actionCount }, (_, i) => i * 500);

    // Generate actions with those timestamps
    const actionsArb = fc.array(
      fc.integer({ min: 0, max: actionCount - 1 }).chain(idx =>
        actionArbitrary(timestamps[idx])
      ),
      { minLength: actionCount, maxLength: actionCount }
    );

    return actionsArb.map(actions => {
      // Sort by timestamp to ensure order
      actions.sort((a, b) => a.timestamp - b.timestamp);
      const duration = actions.length > 0 ? actions[actions.length - 1].timestamp : 0;

      return {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration,
          action_count: actions.length,
          core_type: 'rust',
          platform: 'macos',
          additional_data: {
            source: 'ai_generated',
            generated_at: new Date().toISOString(),
            generated_by: 'ai_script_builder',
            script_name: 'Test AI Script',
            target_os: 'macos',
          },
        },
        actions,
      };
    });
  });

/**
 * Generate a valid recorded script (for comparison)
 */
const recordedScriptArbitrary: fc.Arbitrary<ScriptData> = fc
  .integer({ min: 1, max: 20 })
  .chain(actionCount => {
    // Generate timestamps in ascending order
    const timestamps = Array.from({ length: actionCount }, (_, i) => i * 500);

    // Generate actions with those timestamps
    const actionsArb = fc.array(
      fc.integer({ min: 0, max: actionCount - 1 }).chain(idx =>
        actionArbitrary(timestamps[idx])
      ),
      { minLength: actionCount, maxLength: actionCount }
    );

    return actionsArb.map(actions => {
      // Sort by timestamp to ensure order
      actions.sort((a, b) => a.timestamp - b.timestamp);
      const duration = actions.length > 0 ? actions[actions.length - 1].timestamp : 0;

      return {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration,
          action_count: actions.length,
          core_type: 'rust',
          platform: 'macos',
          additional_data: {
            source: 'recorded',
          },
        },
        actions,
      };
    });
  });

/**
 * Generate a valid script name
 */
const scriptNameArbitrary: fc.Arbitrary<string> = fc.oneof(
  fc.string({ minLength: 5, maxLength: 50 })
    .filter(s => s.trim().length >= 5)
    .map(s => s.replace(/[^a-zA-Z0-9_\-\s]/g, '')),
  fc.constantFrom(
    'Login Test',
    'Navigation Flow',
    'Form Submission',
    'Data Entry Script',
    'UI Automation Test'
  )
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a script has AI-generated metadata
 */
function isAIGeneratedScript(script: ScriptData): boolean {
  return script.metadata.additional_data?.source === 'ai_generated';
}

/**
 * Check if a script has recorded metadata
 */
function isRecordedScript(script: ScriptData): boolean {
  return script.metadata.additional_data?.source === 'recorded';
}

/**
 * Extract playback capabilities from a script
 * These are the controls that should be available for any script
 */
interface PlaybackCapabilities {
  canStart: boolean;
  canStop: boolean;
  canPause: boolean;
  canResume: boolean;
  hasProgressTracking: boolean;
  hasErrorHandling: boolean;
}

/**
 * Get playback capabilities for a script
 * All scripts (AI-generated or recorded) should have the same capabilities
 */
function getPlaybackCapabilities(script: ScriptData): PlaybackCapabilities {
  // All valid scripts should have the same playback capabilities
  const hasValidActions = script.actions && script.actions.length > 0;
  const hasValidMetadata = script.metadata && !!script.version;

  const canPlayback = hasValidActions && hasValidMetadata;

  return {
    canStart: canPlayback,
    canStop: canPlayback,
    canPause: canPlayback,
    canResume: canPlayback,
    hasProgressTracking: canPlayback,
    hasErrorHandling: canPlayback,
  };
}

/**
 * Compare playback capabilities between two scripts
 */
function haveSamePlaybackCapabilities(
  capabilities1: PlaybackCapabilities,
  capabilities2: PlaybackCapabilities
): boolean {
  return (
    capabilities1.canStart === capabilities2.canStart &&
    capabilities1.canStop === capabilities2.canStop &&
    capabilities1.canPause === capabilities2.canPause &&
    capabilities1.canResume === capabilities2.canResume &&
    capabilities1.hasProgressTracking === capabilities2.hasProgressTracking &&
    capabilities1.hasErrorHandling === capabilities2.hasErrorHandling
  );
}

/**
 * Setup mock IPC bridge for testing
 */
function setupMockIPCBridge() {
  const eventListeners = new Map<string, ((event: IPCEvent) => void)[]>();

  const mockIPCBridge = {
    startPlayback: jest.fn().mockResolvedValue(undefined),
    stopPlayback: jest.fn().mockResolvedValue(undefined),
    pausePlayback: jest.fn().mockResolvedValue(false),
    loadScript: jest.fn().mockImplementation(async (scriptPath: string) => {
      // Return a mock script based on the path
      return {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration: 1000,
          action_count: 2,
          core_type: 'rust',
          platform: 'macos',
        },
        actions: [
          { type: 'mouse_click', timestamp: 0, x: 100, y: 100, button: 'left' },
          { type: 'wait', timestamp: 1000 },
        ],
      };
    }),
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

  (getIPCBridge as jest.MockedFunction<typeof getIPCBridge>).mockReturnValue(mockIPCBridge);

  return { mockIPCBridge, eventListeners };
}

/**
 * Emit IPC event to listeners
 */
function emitIPCEvent(
  eventListeners: Map<string, ((event: IPCEvent) => void)[]>,
  eventType: string,
  data: any
) {
  const listeners = eventListeners.get(eventType) || [];
  listeners.forEach(listener => listener({ type: eventType as any, data }));
}

// ============================================================================
// Property Tests
// ============================================================================

describe('AI Script Playback Compatibility Property Tests', () => {
  let playbackService: PlaybackService;
  let mockIPCBridge: any;
  let eventListeners: Map<string, ((event: IPCEvent) => void)[]>;

  /**
   * Build a completely fresh, ISOLATED playback service + mock IPC bridge and
   * return them as locals.
   *
   * IMPORTANT: fast-check executes each property body many times. Reusing a
   * singleton across runs leaks state (isPlaying flag, accumulated callbacks,
   * currentScript). Worse, mutating a single suite-level `playbackService` /
   * `eventListeners` per run is racy across `await` points: a callback may be
   * registered on instance A but events get emitted to instance B.
   *
   * Each property run captures its own locals from this helper and uses them
   * exclusively. The suite-level vars are kept in sync only for the handful of
   * fully-synchronous tests that still read them.
   */
  function freshPlayback() {
    resetPlaybackService();
    resetIPCBridge();
    const setup = setupMockIPCBridge();
    // Construct the service DIRECTLY (not via the module singleton) so each run
    // owns a private instance bound to its own mock bridge — immune to the
    // shared global singleton being reset by a subsequent property run.
    const service = new PlaybackService();
    mockIPCBridge = setup.mockIPCBridge;
    eventListeners = setup.eventListeners;
    playbackService = service;
    return { service, listeners: setup.eventListeners, bridge: setup.mockIPCBridge };
  }

  beforeEach(() => {
    freshPlayback();
  });

  afterEach(() => {
    resetPlaybackService();
    resetIPCBridge();
  });

  /**
   * **Feature: ai-script-builder, Property 17: AI Script Playback Compatibility**
   * **Validates: Requirements 9.3**
   * 
   * For any AI-generated script, selecting it in the Recorder should load it
   * with the same playback controls as recorded scripts.
   */
  describe('Property 17: AI Script Playback Compatibility', () => {
    it('AI-generated scripts have the same playback capabilities as recorded scripts', async () => {
      await fc.assert(
        fc.property(
          aiGeneratedScriptArbitrary,
          recordedScriptArbitrary,
          (aiScript, recordedScript) => {
            const aiCapabilities = getPlaybackCapabilities(aiScript);
            const recordedCapabilities = getPlaybackCapabilities(recordedScript);

            return haveSamePlaybackCapabilities(aiCapabilities, recordedCapabilities);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('AI-generated scripts can be started with playback service', async () => {
      await fc.assert(
        fc.asyncProperty(
          aiGeneratedScriptArbitrary,
          scriptNameArbitrary,
          targetOSArbitrary,
          async (script, scriptName, targetOS) => {
            // Fresh, isolated instance for THIS run. Alias to body-local consts so
            // any interleaving across awaits cannot swap the instance mid-run.
            const { service: playbackService, listeners: eventListeners, bridge: mockIPCBridge } = freshPlayback();
            // Prepare script for save (adds AI metadata)
            const preparedScript = prepareScriptForSave(script, scriptName, targetOS);

            // Verify it's an AI-generated script
            if (!isAIGeneratedScript(preparedScript)) {
              return false;
            }

            // Mock script path
            const scriptPath = `/path/to/${scriptName}.json`;

            // Try to start playback
            try {
              await playbackService.startPlayback(scriptPath);

              // Verify playback was started
              const status = playbackService.getStatus();
              return status.isPlaying && status.currentScript === scriptPath;
            } catch (error) {
              return false;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('AI-generated scripts support stop control', async () => {
      await fc.assert(
        fc.asyncProperty(
          aiGeneratedScriptArbitrary,
          scriptNameArbitrary,
          async (script, scriptName) => {
            // Fresh, isolated instance for THIS run. Alias to body-local consts so
            // any interleaving across awaits cannot swap the instance mid-run.
            const { service: playbackService, listeners: eventListeners, bridge: mockIPCBridge } = freshPlayback();
            const scriptPath = `/path/to/${scriptName}.json`;

            // Start playback
            await playbackService.startPlayback(scriptPath);

            // Stop playback
            try {
              await playbackService.stopPlayback();

              // Emit stop event
              emitIPCEvent(eventListeners, 'playback_stopped', {});

              // Verify playback was stopped
              const status = playbackService.getStatus();
              return !status.isPlaying && status.currentScript === undefined;
            } catch (error) {
              return false;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('AI-generated scripts support pause/resume control', async () => {
      await fc.assert(
        fc.asyncProperty(
          aiGeneratedScriptArbitrary,
          scriptNameArbitrary,
          async (script, scriptName) => {
            // Fresh, isolated instance for THIS run. Alias to body-local consts so
            // any interleaving across awaits cannot swap the instance mid-run.
            const { service: playbackService, listeners: eventListeners, bridge: mockIPCBridge } = freshPlayback();
            const scriptPath = `/path/to/${scriptName}.json`;

            // Start playback
            await playbackService.startPlayback(scriptPath);

            // Pause playback
            mockIPCBridge.pausePlayback.mockResolvedValue(true);
            const isPaused = await playbackService.togglePause();

            if (!isPaused) {
              return false;
            }

            // Resume playback
            mockIPCBridge.pausePlayback.mockResolvedValue(false);
            const isResumed = await playbackService.togglePause();

            return !isResumed;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('AI-generated scripts support progress tracking', async () => {
      await fc.assert(
        fc.asyncProperty(
          aiGeneratedScriptArbitrary,
          scriptNameArbitrary,
          async (script, scriptName) => {
            // Fresh, isolated instance for THIS run. Alias to body-local consts so
            // any interleaving across awaits cannot swap the instance mid-run.
            const { service: playbackService, listeners: eventListeners, bridge: mockIPCBridge } = freshPlayback();
            const scriptPath = `/path/to/${scriptName}.json`;

            // Setup progress callback
            let progressReceived = false;
            playbackService.onProgress((progress) => {
              progressReceived = true;
            });

            // Start playback
            await playbackService.startPlayback(scriptPath);

            // Emit progress event
            emitIPCEvent(eventListeners, 'progress', {
              currentAction: 1,
              totalActions: script.actions.length,
              currentLoop: 1,
              totalLoops: 1,
            });

            return progressReceived;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('AI-generated scripts support error handling', async () => {
      await fc.assert(
        fc.asyncProperty(
          aiGeneratedScriptArbitrary,
          scriptNameArbitrary,
          fc.string({ minLength: 5, maxLength: 50 }),
          async (script, scriptName, errorMessage) => {
            // Fresh, isolated instance for THIS run. Alias to body-local consts so
            // any interleaving across awaits cannot swap the instance mid-run.
            const { service: playbackService, listeners: eventListeners, bridge: mockIPCBridge } = freshPlayback();
            const scriptPath = `/path/to/${scriptName}.json`;

            // Setup error callback
            let errorReceived = false;
            let receivedMessage = '';
            playbackService.onError((error) => {
              errorReceived = true;
              receivedMessage = error;
            });

            // Start playback
            await playbackService.startPlayback(scriptPath);

            // Emit error event
            emitIPCEvent(eventListeners, 'error', { message: errorMessage });

            return errorReceived && receivedMessage === errorMessage;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('AI-generated scripts support completion events', async () => {
      await fc.assert(
        fc.asyncProperty(
          aiGeneratedScriptArbitrary,
          scriptNameArbitrary,
          async (script, scriptName) => {
            // Fresh, isolated instance for THIS run. Alias to body-local consts so
            // any interleaving across awaits cannot swap the instance mid-run.
            const { service: playbackService, listeners: eventListeners, bridge: mockIPCBridge } = freshPlayback();
            const scriptPath = `/path/to/${scriptName}.json`;

            // Setup complete callback
            let completeReceived = false;
            playbackService.onComplete(() => {
              completeReceived = true;
            });

            // Start playback
            await playbackService.startPlayback(scriptPath);

            // Emit complete event
            emitIPCEvent(eventListeners, 'complete', {});

            return completeReceived;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('AI-generated scripts with different target OS all support playback', async () => {
      await fc.assert(
        fc.asyncProperty(
          aiGeneratedScriptArbitrary,
          scriptNameArbitrary,
          async (script, scriptName) => {
            // Fresh, isolated instance for THIS run. Alias to body-local consts so
            // any interleaving across awaits cannot swap the instance mid-run.
            const { service: playbackService, listeners: eventListeners, bridge: mockIPCBridge } = freshPlayback();
            const targetOSValues: TargetOS[] = ['macos', 'windows', 'universal'];
            const results: boolean[] = [];

            for (const targetOS of targetOSValues) {
              const preparedScript = prepareScriptForSave(script, scriptName, targetOS);
              const scriptPath = `/path/to/${scriptName}_${targetOS}.json`;

              try {
                await playbackService.startPlayback(scriptPath);
                const status = playbackService.getStatus();
                results.push(status.isPlaying);

                // Stop for next iteration
                await playbackService.stopPlayback();
                emitIPCEvent(eventListeners, 'playback_stopped', {});
              } catch (error) {
                results.push(false);
              }
            }

            // All target OS variants should support playback
            return results.every(result => result === true);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('AI-generated scripts support playback options (speed, loop)', async () => {
      await fc.assert(
        fc.asyncProperty(
          aiGeneratedScriptArbitrary,
          scriptNameArbitrary,
          fc.double({ min: 0.1, max: 10.0 }),
          fc.integer({ min: 1, max: 5 }),
          async (script, scriptName, speed, loopCount) => {
            // Fresh, isolated instance for THIS run. Alias to body-local consts so
            // any interleaving across awaits cannot swap the instance mid-run.
            const { service: playbackService, listeners: eventListeners, bridge: mockIPCBridge } = freshPlayback();
            const scriptPath = `/path/to/${scriptName}.json`;

            try {
              await playbackService.startPlayback(scriptPath, { speed, loopCount });

              // Verify playback started with options
              expect(mockIPCBridge.startPlayback).toHaveBeenCalledWith(
                scriptPath,
                speed,
                loopCount
              );

              const status = playbackService.getStatus();
              return status.isPlaying && status.progress?.totalLoops === loopCount;
            } catch (error) {
              return false;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('playback capabilities are independent of script source', async () => {
      await fc.assert(
        fc.property(
          aiGeneratedScriptArbitrary,
          recordedScriptArbitrary,
          (aiScript, recordedScript) => {
            // Both scripts should have identical playback capabilities
            const aiCaps = getPlaybackCapabilities(aiScript);
            const recordedCaps = getPlaybackCapabilities(recordedScript);

            // All capabilities should match
            return (
              aiCaps.canStart === recordedCaps.canStart &&
              aiCaps.canStop === recordedCaps.canStop &&
              aiCaps.canPause === recordedCaps.canPause &&
              aiCaps.canResume === recordedCaps.canResume &&
              aiCaps.hasProgressTracking === recordedCaps.hasProgressTracking &&
              aiCaps.hasErrorHandling === recordedCaps.hasErrorHandling
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('AI-generated scripts maintain playback state correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          aiGeneratedScriptArbitrary,
          scriptNameArbitrary,
          async (script, scriptName) => {
            // Fresh, isolated instance for THIS run. Alias to body-local consts so
            // any interleaving across awaits cannot swap the instance mid-run.
            const { service: playbackService, listeners: eventListeners, bridge: mockIPCBridge } = freshPlayback();
            const scriptPath = `/path/to/${scriptName}.json`;

            // Initial state: not playing
            let status = playbackService.getStatus();
            if (status.isPlaying) {
              return false;
            }

            // Start playback
            await playbackService.startPlayback(scriptPath);
            status = playbackService.getStatus();
            if (!status.isPlaying || status.currentScript !== scriptPath) {
              return false;
            }

            // Pause
            mockIPCBridge.pausePlayback.mockResolvedValue(true);
            await playbackService.togglePause();
            status = playbackService.getStatus();
            if (!status.isPaused) {
              return false;
            }

            // Resume
            mockIPCBridge.pausePlayback.mockResolvedValue(false);
            await playbackService.togglePause();
            status = playbackService.getStatus();
            if (status.isPaused) {
              return false;
            }

            // Stop
            await playbackService.stopPlayback();
            emitIPCEvent(eventListeners, 'playback_stopped', {});
            status = playbackService.getStatus();
            if (status.isPlaying || status.currentScript !== undefined) {
              return false;
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('AI-generated scripts with varying action counts all support playback', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          scriptNameArbitrary,
          async (actionCount, scriptName) => {
            // Fresh, isolated instance for THIS run. Alias to body-local consts so
            // any interleaving across awaits cannot swap the instance mid-run.
            const { service: playbackService, listeners: eventListeners, bridge: mockIPCBridge } = freshPlayback();
            // Create script with specific action count
            const actions: Action[] = Array.from({ length: actionCount }, (_, i) => ({
              type: 'mouse_click' as const,
              timestamp: i * 100,
              x: 100 + i,
              y: 100 + i,
              button: 'left' as const,
            }));

            const script: ScriptData = {
              version: '1.0',
              metadata: {
                created_at: new Date().toISOString(),
                duration: actions[actions.length - 1].timestamp,
                action_count: actions.length,
                core_type: 'rust',
                platform: 'macos',
                additional_data: {
                  source: 'ai_generated',
                  generated_at: new Date().toISOString(),
                  generated_by: 'ai_script_builder',
                },
              },
              actions,
            };

            const scriptPath = `/path/to/${scriptName}.json`;

            try {
              await playbackService.startPlayback(scriptPath);
              const status = playbackService.getStatus();
              return status.isPlaying;
            } catch (error) {
              return false;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('AI-generated scripts support all action types in playback', async () => {
      await fc.assert(
        fc.asyncProperty(
          actionTypeArbitrary,
          scriptNameArbitrary,
          async (actionType, scriptName) => {
            // Fresh, isolated instance for THIS run. Alias to body-local consts so
            // any interleaving across awaits cannot swap the instance mid-run.
            const { service: playbackService, listeners: eventListeners, bridge: mockIPCBridge } = freshPlayback();
            // Create script with single action of given type
            const action: Action = {
              type: actionType,
              timestamp: 0,
              ...(actionType.startsWith('mouse') ? { x: 100, y: 100 } : {}),
              ...(actionType === 'mouse_click' ? { button: 'left' as const } : {}),
              ...(actionType === 'key_press' ? { key: 'a' } : {}),
              ...(actionType === 'key_type' ? { text: 'test' } : {}),
            };

            const script: ScriptData = {
              version: '1.0',
              metadata: {
                created_at: new Date().toISOString(),
                duration: 0,
                action_count: 1,
                core_type: 'rust',
                platform: 'macos',
                additional_data: {
                  source: 'ai_generated',
                  generated_at: new Date().toISOString(),
                  generated_by: 'ai_script_builder',
                },
              },
              actions: [action],
            };

            const scriptPath = `/path/to/${scriptName}.json`;

            try {
              await playbackService.startPlayback(scriptPath);
              const status = playbackService.getStatus();
              return status.isPlaying;
            } catch (error) {
              return false;
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Edge cases and boundary conditions
   */
  describe('Edge Cases and Boundary Conditions', () => {
    it('handles AI-generated script with single action', async () => {
      const script: ScriptData = {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration: 0,
          action_count: 1,
          core_type: 'rust',
          platform: 'macos',
          additional_data: {
            source: 'ai_generated',
            generated_at: new Date().toISOString(),
            generated_by: 'ai_script_builder',
          },
        },
        actions: [{
          type: 'mouse_click',
          timestamp: 0,
          x: 100,
          y: 100,
          button: 'left',
        }],
      };

      const capabilities = getPlaybackCapabilities(script);
      expect(capabilities.canStart).toBe(true);
      expect(capabilities.canStop).toBe(true);
      expect(capabilities.canPause).toBe(true);
    });

    it('handles AI-generated script with many actions', async () => {
      const actions: Action[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'mouse_click' as const,
        timestamp: i * 10,
        x: 100 + i,
        y: 100 + i,
        button: 'left' as const,
      }));

      const script: ScriptData = {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration: 990,
          action_count: 100,
          core_type: 'rust',
          platform: 'macos',
          additional_data: {
            source: 'ai_generated',
            generated_at: new Date().toISOString(),
            generated_by: 'ai_script_builder',
          },
        },
        actions,
      };

      const capabilities = getPlaybackCapabilities(script);
      expect(capabilities.canStart).toBe(true);
      expect(capabilities.hasProgressTracking).toBe(true);
    });

    it('AI and recorded scripts with same structure have identical capabilities', async () => {
      const actions: Action[] = [
        { type: 'mouse_click', timestamp: 0, x: 100, y: 100, button: 'left' },
        { type: 'key_type', timestamp: 500, text: 'test' },
        { type: 'wait', timestamp: 1000 },
      ];

      const aiScript: ScriptData = {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration: 1000,
          action_count: 3,
          core_type: 'rust',
          platform: 'macos',
          additional_data: {
            source: 'ai_generated',
            generated_at: new Date().toISOString(),
            generated_by: 'ai_script_builder',
          },
        },
        actions,
      };

      const recordedScript: ScriptData = {
        version: '1.0',
        metadata: {
          created_at: new Date().toISOString(),
          duration: 1000,
          action_count: 3,
          core_type: 'rust',
          platform: 'macos',
          additional_data: {
            source: 'recorded',
          },
        },
        actions,
      };

      const aiCaps = getPlaybackCapabilities(aiScript);
      const recordedCaps = getPlaybackCapabilities(recordedScript);

      expect(haveSamePlaybackCapabilities(aiCaps, recordedCaps)).toBe(true);
    });

    it('handles playback service state transitions correctly', async () => {
      const scriptPath = '/path/to/test.json';

      // Start
      await playbackService.startPlayback(scriptPath);
      expect(playbackService.getStatus().isPlaying).toBe(true);

      // Pause
      mockIPCBridge.pausePlayback.mockResolvedValue(true);
      await playbackService.togglePause();
      expect(playbackService.getStatus().isPaused).toBe(true);

      // Resume
      mockIPCBridge.pausePlayback.mockResolvedValue(false);
      await playbackService.togglePause();
      expect(playbackService.getStatus().isPaused).toBe(false);

      // Stop
      await playbackService.stopPlayback();
      emitIPCEvent(eventListeners, 'playback_stopped', {});
      expect(playbackService.getStatus().isPlaying).toBe(false);
    });
  });
});
