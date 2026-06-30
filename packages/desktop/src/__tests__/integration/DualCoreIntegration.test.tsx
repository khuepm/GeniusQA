/**
 * Dual-Core Integration Tests
 *
 * NOTE (2026 rewrite): The dual-core (Python/Rust) selector feature these tests
 * originally targeted has been removed from RecorderScreen. The component now
 * forces the Rust core only (see RecorderScreen.tsx `initializeCoreStatus`) and
 * the <CoreSelector> render is commented out, so there is no `core-selector` /
 * `core-option-*` UI, no runtime `selectCore`/`getAvailableCores`/`getCoreStatus`
 * calls, and no fallback / performance-recommendation behaviour.
 *
 * The component is also plain web React (Testing Library `fireEvent.click`,
 * `getByText`), not React Native (`fireEvent.press`, `.props.accessibilityState`).
 *
 * These tests have been rewritten to validate the CURRENT recording / playback /
 * error-handling behaviour. Tests that asserted genuinely-removed dual-core
 * functionality are `it.skip`-ed with a reason.
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RecorderScreen from '../../screens/RecorderScreen';
import * as ipcBridgeService from '../../services/ipcBridgeService';

// Mock IPC Bridge Service (manual mock at src/services/__mocks__/ipcBridgeService.ts)
jest.mock('../../services/ipcBridgeService');
// RecorderScreen + ClickCursorOverlay talk to Tauri directly.
jest.mock('@tauri-apps/api/tauri', () => ({ invoke: jest.fn() }));
jest.mock('@tauri-apps/api/event', () => ({ listen: jest.fn().mockResolvedValue(jest.fn()) }));

const renderScreen = () =>
  render(
    <MemoryRouter>
      <RecorderScreen />
    </MemoryRouter>
  );

describe('Dual-Core Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Sensible defaults; individual tests override as needed.
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

  describe('Core Selection and Switching', () => {
    // Removed feature: runtime Python/Rust core selector UI.
    it.skip('should successfully switch between Python and Rust cores (REMOVED: dual-core selector)', () => {});
    it.skip('should handle core switching during active recording (REMOVED: dual-core selector)', () => {});
    it.skip('should handle core switching during active playback (REMOVED: dual-core selector)', () => {});

    it('forces the Rust core only (no core selector rendered)', async () => {
      renderScreen();
      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });
      // Core selector UI has been removed.
      expect(screen.queryByTestId('core-selector')).toBeNull();
      // Core APIs are no longer invoked from the UI.
      expect(ipcBridgeService.selectCore).not.toHaveBeenCalled();
      expect(ipcBridgeService.getAvailableCores).not.toHaveBeenCalled();
    });
  });

  describe('Recording and Playback Workflow', () => {
    it('records and stops a recording', async () => {
      renderScreen();

      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });
      expect(screen.getByText(/Recording in Progress/i)).toBeInTheDocument();

      fireEvent.click(screen.getByText('Stop Recording'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
      });
    });

    it('starts playback for an existing recording', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.getLatestRecording as jest.Mock).mockResolvedValue('/path/to/script.json');

      renderScreen();

      // Wait for the async initialize() to enable playback once recordings load.
      await waitFor(() => {
        expect(screen.getByText('Start Playback').closest('button')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });
    });

    it('displays a script format validation error from playback', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.getLatestRecording as jest.Mock).mockResolvedValue('/path/to/script.json');
      (ipcBridgeService.startPlayback as jest.Mock).mockRejectedValue(
        new Error('Script format validation failed: Incompatible JSON schema version')
      );

      renderScreen();

      await waitFor(() => {
        expect(screen.getByText('Start Playback').closest('button')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByText('Start Playback'));

      await waitFor(() => {
        expect(screen.getByText(/format validation failed/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays recording errors to the user', async () => {
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

    it('recovers from a temporary recording failure on retry', async () => {
      (ipcBridgeService.startRecording as jest.Mock)
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(undefined);

      renderScreen();

      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      // First attempt fails.
      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(screen.getByText(/Temporary failure/)).toBeInTheDocument();
      });

      // Retry succeeds.
      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalledTimes(2);
      });
    });

    // Removed feature: automatic cross-core fallback.
    it.skip('should fallback to Python core when Rust core fails (REMOVED: dual-core fallback)', () => {});
    it.skip('should fallback to Rust core when Python core fails (REMOVED: dual-core fallback)', () => {});
    it.skip('should handle both cores unavailable scenario (REMOVED: dual-core availability UI)', () => {});
  });

  describe('Performance Monitoring and Comparison', () => {
    // Removed feature: per-core performance metrics / recommendation UI.
    it.skip('should display performance metrics for both cores (REMOVED: dual-core metrics)', () => {});
    it.skip('should recommend better performing core (REMOVED: dual-core recommendation)', () => {});

    it('tracks operation timing across a slow recording', async () => {
      (ipcBridgeService.startRecording as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      renderScreen();

      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      const startTime = Date.now();
      fireEvent.click(screen.getByText('Record'));
      // Recording only becomes active after the slow startRecording resolves,
      // which is reflected by the "Recording in Progress" status.
      await waitFor(
        () => {
          expect(screen.getByText(/Recording in Progress/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
      const operationTime = Date.now() - startTime;
      expect(operationTime).toBeGreaterThan(900);
    });
  });

  describe('User Preference Persistence', () => {
    // Removed feature: persisted core preference selection.
    it.skip('should persist core selection across app restarts (REMOVED: dual-core selector)', () => {});

    it('keeps recordings available after the initial load', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.getLatestRecording as jest.Mock).mockResolvedValue('/path/to/script.json');

      renderScreen();

      await waitFor(() => {
        expect(screen.getByText('Start Playback')).toBeInTheDocument();
      });
      // Playback button is enabled once recordings exist.
      expect(screen.getByText('Start Playback')).not.toBeDisabled();
    });
  });

  describe('UI Responsiveness and Feedback', () => {
    // Removed feature: core-switching visual feedback / active-core status display.
    it.skip('should provide visual feedback during core switching (REMOVED: dual-core selector)', () => {});
    it.skip('should update status display to show active core (REMOVED: dual-core status)', () => {});
    it.skip('should show core availability indicators (REMOVED: dual-core availability UI)', () => {});

    it('shows recording status feedback while recording', async () => {
      renderScreen();

      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));

      await waitFor(() => {
        expect(screen.getByText(/Recording in Progress/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Platform Compatibility', () => {
    const platforms = ['win32', 'darwin', 'linux'];
    platforms.forEach(platform => {
      it(`records successfully on ${platform}`, async () => {
        Object.defineProperty(process, 'platform', { value: platform, configurable: true });

        renderScreen();

        await waitFor(() => {
          expect(screen.getByText('Record')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Record'));
        await waitFor(() => {
          expect(ipcBridgeService.startRecording).toHaveBeenCalled();
        });
      });
    });
  });
});
