/**
 * Script File Compatibility Integration Tests
 *
 * NOTE (2026 rewrite): The dual-core (Python/Rust) selector and cross-core
 * switching workflow these tests originally drove has been removed from
 * RecorderScreen (Rust core is forced; no `core-option-*` UI; `selectCore` is
 * never called). Cross-core record/switch/playback flows can no longer be
 * exercised through the UI.
 *
 * Retained here:
 *  - Playback format/version/validation error surfacing (still works via the
 *    single-core playback path).
 *  - Pure data assertions on the script-result shape (these never depended on
 *    the dual-core UI; they validate the mocked result payloads directly).
 *  - Resource/timing behaviour of a slow playback.
 * Tests that required the removed dual-core UI are `it.skip`-ed with a reason.
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RecorderScreen from '../../screens/RecorderScreen';
import * as ipcBridgeService from '../../services/ipcBridgeService';

jest.mock('../../services/ipcBridgeService');
jest.mock('@tauri-apps/api/tauri', () => ({ invoke: jest.fn() }));
jest.mock('@tauri-apps/api/event', () => ({ listen: jest.fn().mockResolvedValue(jest.fn()) }));

const renderScreen = () =>
  render(
    <MemoryRouter>
      <RecorderScreen />
    </MemoryRouter>
  );

/** Set up state where a recording already exists, so playback is enabled. */
const withExistingRecording = () => {
  (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
  (ipcBridgeService.getLatestRecording as jest.Mock).mockResolvedValue('/recordings/existing.json');
};

const waitForPlaybackEnabled = async () => {
  await waitFor(() => {
    expect(screen.getByText('Start Playback').closest('button')).not.toBeDisabled();
  });
};

describe('Script File Compatibility Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
    (ipcBridgeService.getLatestRecording as jest.Mock).mockResolvedValue(null);
    (ipcBridgeService.listScripts as jest.Mock).mockResolvedValue([]);
    (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
    (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue({
      success: true,
      scriptPath: '/path/to/script.json',
      actionCount: 10,
      duration: 5.0,
    });
    (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);
    (ipcBridgeService.stopPlayback as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Cross-Core Script File Format Compatibility', () => {
    it.skip('should maintain identical JSON schema between Python and Rust cores (REMOVED: dual-core record/switch UI)', () => {});

    it('shows a detailed schema-version validation error on playback', async () => {
      withExistingRecording();
      (ipcBridgeService.startPlayback as jest.Mock).mockRejectedValue(
        new Error('Script validation failed: Invalid JSON schema version 0.9, expected 1.0')
      );

      renderScreen();
      await waitForPlaybackEnabled();

      fireEvent.click(screen.getByText('Start Playback'));

      await waitFor(() => {
        const err = screen.getByText(/validation failed/i);
        expect(err).toBeInTheDocument();
        expect(err.textContent).toMatch(/schema version/i);
        expect(err.textContent).toContain('0.9');
        expect(err.textContent).toContain('1.0');
      });
    });

    it('surfaces a migration message then succeeds on retry', async () => {
      withExistingRecording();
      (ipcBridgeService.startPlayback as jest.Mock)
        .mockRejectedValueOnce(new Error('Script format outdated: Migrating from v0.9 to v1.0'))
        .mockResolvedValueOnce(undefined);

      renderScreen();
      await waitForPlaybackEnabled();

      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        const err = screen.getByText(/migrating/i);
        expect(err.textContent).toContain('v0.9');
        expect(err.textContent).toContain('v1.0');
      });

      // Retry succeeds after migration.
      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Cross-Core Playback Compatibility', () => {
    it.skip('should play Python-created scripts with Rust core (REMOVED: dual-core switch UI)', () => {});
    it.skip('should play Rust-created scripts with Python core (REMOVED: dual-core switch UI)', () => {});

    it('plays a previously recorded script through the (single) core', async () => {
      withExistingRecording();
      (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);

      renderScreen();
      await waitForPlaybackEnabled();

      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });
      // Current signature: startPlayback(scriptPath, speed, loopCount).
      expect(ipcBridgeService.startPlayback).toHaveBeenCalledWith(
        '/recordings/existing.json',
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  describe('Script Metadata and Versioning', () => {
    it('preserves metadata fields in the stopRecording result payload', async () => {
      const scriptWithMetadata = {
        success: true,
        scriptPath: '/recordings/metadata_test.json',
        actionCount: 10,
        duration: 5.0,
        metadata: {
          version: '1.0',
          coreType: 'rust',
          platform: 'darwin',
          createdAt: '2024-01-01T12:00:00Z',
          tags: ['test', 'automation'],
          description: 'Test recording for metadata preservation',
        },
      };
      (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue(scriptWithMetadata);

      renderScreen();
      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });
      fireEvent.click(screen.getByText('Stop Recording'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
      });

      const result = await (ipcBridgeService.stopRecording as jest.Mock).mock.results[0].value;
      expect(result.metadata.version).toBe('1.0');
      expect(result.metadata.tags).toEqual(['test', 'automation']);
    });

    it('shows a version compatibility error on playback', async () => {
      withExistingRecording();
      (ipcBridgeService.startPlayback as jest.Mock).mockRejectedValue(
        new Error('Version compatibility check failed: Script version 2.0 not supported by current core (max: 1.0)')
      );

      renderScreen();
      await waitForPlaybackEnabled();

      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        const err = screen.getByText(/version compatibility/i);
        expect(err.textContent).toContain('2.0');
        expect(err.textContent).toContain('1.0');
      });
    });

    it('tracks core attribution in the stopRecording result payload', async () => {
      (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue({
        success: true,
        scriptPath: '/recordings/rust_attributed.json',
        actionCount: 15,
        duration: 8.0,
        metadata: {
          version: '1.0',
          coreType: 'rust',
          coreVersion: '1.0.0',
          platform: 'darwin',
          createdAt: '2024-01-01T12:00:00Z',
        },
      });

      renderScreen();
      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });
      fireEvent.click(screen.getByText('Stop Recording'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
      });

      const result = await (ipcBridgeService.stopRecording as jest.Mock).mock.results[0].value;
      expect(result.metadata.coreType).toBe('rust');
      expect(result.metadata.coreVersion).toBeDefined();
    });
  });

  describe('Cross-Core Testing and Validation', () => {
    it.skip('should allow side-by-side testing with both cores (REMOVED: dual-core switch UI)', () => {});

    it('can replay the same recording multiple times', async () => {
      withExistingRecording();
      (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);

      renderScreen();
      await waitForPlaybackEnabled();

      // First playback.
      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalledTimes(1);
      });
      // Complete it via the stop handler so status returns to idle.
      fireEvent.click(screen.getByText('Stop Playback'));
      await waitFor(() => {
        expect(ipcBridgeService.stopPlayback).toHaveBeenCalled();
      });
      await waitForPlaybackEnabled();

      // Second playback.
      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalledTimes(2);
      });
    });

    it('shows an unsupported-action error on playback', async () => {
      withExistingRecording();
      (ipcBridgeService.startPlayback as jest.Mock).mockRejectedValue(
        new Error('Unsupported action type "custom_gesture"')
      );

      renderScreen();
      await waitForPlaybackEnabled();

      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        const err = screen.getByText(/Unsupported action type/i);
        expect(err.textContent).toContain('custom_gesture');
      });
    });

    it('shows a format-validation field error on playback', async () => {
      withExistingRecording();
      (ipcBridgeService.startPlayback as jest.Mock).mockRejectedValue(
        new Error('Format validation failed: Missing required field "timestamp" in action at index 5')
      );

      renderScreen();
      await waitForPlaybackEnabled();

      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        const err = screen.getByText(/Format validation failed/i);
        expect(err.textContent).toContain('timestamp');
        expect(err.textContent).toContain('index 5');
      });
    });
  });

  describe('Performance and Resource Usage', () => {
    it.skip('should validate performance improvements with cross-core compatibility (REMOVED: dual-core metrics)', () => {});

    it('tracks timing of a slow playback operation', async () => {
      withExistingRecording();
      (ipcBridgeService.startPlayback as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1500))
      );

      renderScreen();
      await waitForPlaybackEnabled();

      const startTime = Date.now();
      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(
        () => {
          expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );
      // startPlayback resolves only after the simulated 1.5s delay; the
      // handler awaits it before flipping to the 'playing' state.
      await waitFor(
        () => {
          expect(screen.getByText('Stop Playback').closest('button')).not.toBeDisabled();
        },
        { timeout: 3000 }
      );
      const operationTime = Date.now() - startTime;
      expect(operationTime).toBeGreaterThan(1400);
    });
  });
});
