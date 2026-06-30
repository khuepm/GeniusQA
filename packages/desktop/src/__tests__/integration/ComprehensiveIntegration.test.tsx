/**
 * Comprehensive Integration Tests
 *
 * NOTE (2026 rewrite): RecorderScreen forces the Rust core and is plain web
 * React. The dual-core selector UI (`core-selector`, `core-option-*`), runtime
 * core switching, automatic fallback, cross-core compatibility flows, and
 * per-core performance metrics/recommendations have all been removed. The
 * original suite stubbed the bridge via
 * `(getIPCBridge as jest.Mock).mockReturnValue(...)`; the manual mock exposes a
 * plain `getIPCBridge` returning a shared bridge whose methods are the
 * named-export jest.fns, so behaviour is configured through those.
 *
 * Removed-feature tests are `it.skip`-ed with a reason; the surviving
 * recording/playback/error/UI behaviours are retained.
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

const waitForPlaybackEnabled = async () => {
  await waitFor(() => {
    expect(screen.getByText('Start Playback').closest('button')).not.toBeDisabled();
  });
};

describe('Comprehensive Integration Tests', () => {
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

  describe('Core Switching During Active Operations', () => {
    it.skip('should prevent core switching during active recording (REMOVED: dual-core selector)', () => {});
    it.skip('should prevent core switching during active playback (REMOVED: dual-core selector)', () => {});
    it.skip('should allow core switching after operations complete (REMOVED: dual-core selector)', () => {});

    it('disables the Record button while a recording is active', async () => {
      renderScreen();
      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(screen.getByText(/Recording in Progress/i)).toBeInTheDocument();
      });
      // Cannot start a second recording while one is in progress.
      expect(screen.getByText('Record').closest('button')).toBeDisabled();
    });
  });

  describe('Script File Compatibility Across All Scenarios', () => {
    it('handles complex script format validation errors on playback', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.getLatestRecording as jest.Mock).mockResolvedValue('/p.json');
      (ipcBridgeService.startPlayback as jest.Mock).mockRejectedValue(
        new Error('Script validation failed: Action at index 3 has invalid timestamp format')
      );

      renderScreen();
      await waitForPlaybackEnabled();

      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        const err = screen.getByText(/validation failed/i);
        expect(err.textContent).toContain('index 3');
        expect(err.textContent).toMatch(/timestamp format/);
      });
    });

    it('handles script migration messaging then succeeds on retry', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.getLatestRecording as jest.Mock).mockResolvedValue('/p.json');
      (ipcBridgeService.startPlayback as jest.Mock)
        .mockRejectedValueOnce(new Error('Script format outdated: Migrating from v1.0 to v1.1'))
        .mockResolvedValueOnce(undefined);

      renderScreen();
      await waitForPlaybackEnabled();

      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        const err = screen.getByText(/migrating/i);
        expect(err.textContent).toContain('v1.0');
        expect(err.textContent).toContain('v1.1');
      });

      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalledTimes(2);
      });
    });

    it.skip('should validate cross-core action compatibility (REMOVED: dual-core switch UI)', () => {});

    it('handles unsupported action types gracefully', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.getLatestRecording as jest.Mock).mockResolvedValue('/p.json');
      (ipcBridgeService.startPlayback as jest.Mock).mockRejectedValue(
        new Error('Unsupported action type "custom_gesture" at action index 7')
      );

      renderScreen();
      await waitForPlaybackEnabled();

      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        const err = screen.getByText(/Unsupported action type/i);
        expect(err.textContent).toContain('custom_gesture');
        expect(err.textContent).toContain('index 7');
      });
    });
  });

  describe('UI Responsiveness During Operations', () => {
    it.skip('should provide immediate visual feedback during core switching (REMOVED: dual-core selector)', () => {});

    it('updates UI state correctly while recording', async () => {
      renderScreen();
      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(screen.getByText(/Recording in Progress/i)).toBeInTheDocument();
      });

      const recordButton = screen.getByText('Record').closest('button');
      expect(recordButton).toBeDisabled();
    });

    it.skip('should handle rapid user interactions gracefully (REMOVED: dual-core selector)', () => {});
  });

  describe('Error Recovery and Fallback Mechanisms', () => {
    it.skip('should recover from core switching failures (REMOVED: dual-core selector)', () => {});

    it('reports operation failures with detailed, actionable messaging', async () => {
      (ipcBridgeService.startRecording as jest.Mock).mockRejectedValue(
        new Error(
          'Rust core failed: macOS Accessibility permissions not granted. Please enable in System Preferences > Security & Privacy > Privacy > Accessibility.'
        )
      );

      renderScreen();
      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(screen.getByText(/Accessibility permission/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/System Preferences|System Settings/i)).toBeInTheDocument();
    });

    it('implements retry after a transient failure', async () => {
      (ipcBridgeService.startRecording as jest.Mock)
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce(undefined);

      renderScreen();
      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalledTimes(2);
      });
    });

    it.skip('should handle cascading failures gracefully (REMOVED: dual-core selector)', () => {});
  });

  describe('Performance and Resource Management', () => {
    it.skip('should monitor resource usage during operations (REMOVED: dual-core metrics)', () => {});
    it.skip('should provide performance-based recommendations (REMOVED: dual-core recommendation)', () => {});
  });
});
