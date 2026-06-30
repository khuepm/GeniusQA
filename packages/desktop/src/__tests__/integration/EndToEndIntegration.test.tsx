/**
 * End-to-End Integration Tests
 *
 * NOTE (2026 rewrite): RecorderScreen is now web React (not React Native) and
 * forces the Rust core (no dual-core selector UI, no `selectCore` /
 * `getAvailableCores` / `getCoreStatus` calls, no fallback / performance
 * recommendation behaviour).
 *
 * The original suite also tried to stub the bridge via
 * `(getIPCBridge as jest.Mock).mockReturnValue(...)`, but the manual mock's
 * `getIPCBridge` is a plain function returning a shared bridge whose methods are
 * the named-export jest.fns. We therefore configure behaviour through those
 * named exports.
 *
 * Removed-feature tests are `it.skip`-ed with a reason.
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

describe('End-to-End Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
    (ipcBridgeService.getLatestRecording as jest.Mock).mockResolvedValue(null);
    (ipcBridgeService.listScripts as jest.Mock).mockResolvedValue([]);
    (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
    (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue({
      success: true,
      scriptPath: '/path/to/script.json',
      actionCount: 15,
      duration: 8.0,
    });
    (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);
    (ipcBridgeService.stopPlayback as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Complete Workflow Testing', () => {
    it('completes a full recording and playback workflow', async () => {
      renderScreen();

      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      // Record.
      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });

      // Stop recording (recording now becomes available).
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      fireEvent.click(screen.getByText('Stop Recording'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
      });

      // After stopRecording, the recorded script path is selected and playback enabled.
      await waitForPlaybackEnabled();
      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });
    });

    it.skip('should handle core switching during workflow (REMOVED: dual-core selector)', () => {});
    it.skip('should validate cross-core script compatibility (REMOVED: dual-core switch UI)', () => {});
  });

  describe('Error Handling and Recovery', () => {
    it('handles recording failures by displaying the error', async () => {
      (ipcBridgeService.startRecording as jest.Mock).mockRejectedValue(
        new Error('Rust core failed: Permission denied')
      );

      renderScreen();
      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(screen.getByText(/Permission denied/)).toBeInTheDocument();
      });
    });

    it.skip('should handle no cores available scenario (REMOVED: dual-core availability UI)', () => {});

    it('recovers from a temporary failure on retry', async () => {
      (ipcBridgeService.startRecording as jest.Mock)
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(undefined);

      renderScreen();
      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(screen.getByText(/Temporary failure/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Performance Monitoring', () => {
    it.skip('should display performance metrics for available cores (REMOVED: dual-core metrics)', () => {});
    it.skip('should recommend better performing core (REMOVED: dual-core recommendation)', () => {});
  });

  describe('Cross-Platform Compatibility', () => {
    it('works on macOS', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

      renderScreen();
      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });
    });

    it('handles platform-specific errors gracefully', async () => {
      (ipcBridgeService.startRecording as jest.Mock).mockRejectedValue(
        new Error('macOS Accessibility permissions required')
      );

      renderScreen();
      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(screen.getByText(/Accessibility permission/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Preference Persistence', () => {
    it.skip('should restore user core preference on startup (REMOVED: dual-core selector)', () => {});

    it('enables playback when recordings already exist on startup', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.getLatestRecording as jest.Mock).mockResolvedValue('/path/to/script.json');

      renderScreen();
      await waitForPlaybackEnabled();
      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });
    });
  });

  describe('UI Responsiveness and Feedback', () => {
    it('provides visual feedback while recording', async () => {
      (ipcBridgeService.startRecording as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      renderScreen();
      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(screen.getByText(/Recording in Progress/i)).toBeInTheDocument();
      });
    });

    it('renders a status display', async () => {
      renderScreen();
      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });
      // Idle by default.
      expect(screen.getByText('Idle')).toBeInTheDocument();
    });
  });
});
