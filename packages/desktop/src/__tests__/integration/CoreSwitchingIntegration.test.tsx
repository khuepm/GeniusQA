/**
 * Core Switching Integration Tests
 *
 * NOTE (2026 rewrite): RecorderScreen no longer exposes a runtime dual-core
 * (Python/Rust) selector. The Rust core is forced, the <CoreSelector> render is
 * commented out, and the component never calls `selectCore` /
 * `getAvailableCores` / `getCoreStatus`. There is therefore no core-switching,
 * automatic-fallback, availability-detection, performance-recommendation, or
 * core-preference behaviour left to exercise.
 *
 * Tests asserting that removed functionality are `it.skip`-ed with a reason.
 * The few behaviours that still exist (recording/playback error surfacing) are
 * retained against the current web-React component.
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

describe('Core Switching Integration Tests', () => {
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

  describe('Runtime Core Switching', () => {
    it.skip('should allow runtime switching without application restart (REMOVED: dual-core selector)', () => {});
    it.skip('should handle rapid core switching attempts (REMOVED: dual-core selector)', () => {});
    it.skip('should prevent core switching during active operations (REMOVED: dual-core selector)', () => {});

    it('does not call selectCore (Rust core is forced)', async () => {
      renderScreen();
      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });
      expect(ipcBridgeService.selectCore).not.toHaveBeenCalled();
    });
  });

  describe('Automatic Fallback Mechanisms', () => {
    it.skip('should automatically fallback when preferred core becomes unavailable (REMOVED: dual-core fallback)', () => {});
    it.skip('should handle graceful degradation when no cores are available (REMOVED: dual-core availability UI)', () => {});
    it.skip('should recover when cores become available again (REMOVED: dual-core availability UI)', () => {});
  });

  describe('Core Availability Detection', () => {
    it.skip('should detect core availability changes in real-time (REMOVED: dual-core availability UI)', () => {});
    it.skip('should update UI when core availability changes (REMOVED: dual-core availability UI)', () => {});
    it.skip('should provide detailed core health information (REMOVED: dual-core health UI)', () => {});
  });

  describe('Error Recovery and Fallback', () => {
    it.skip('should handle core switching validation errors (REMOVED: dual-core selector)', () => {});
    it.skip('should handle core failure during operation with automatic recovery (REMOVED: dual-core fallback)', () => {});

    it('provides an actionable error message for accessibility-permission failures', async () => {
      (ipcBridgeService.startRecording as jest.Mock).mockRejectedValue(
        new Error('macOS Accessibility permissions required')
      );

      renderScreen();

      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));

      await waitFor(() => {
        expect(screen.getByText(/Accessibility Permission Required/i)).toBeInTheDocument();
      });
      // The permission error renders dedicated, actionable instructions
      // (heading + button both reference System Settings).
      expect(screen.getAllByText(/System Settings/i).length).toBeGreaterThan(0);
    });

    it('surfaces repeated operation failures to the user', async () => {
      (ipcBridgeService.startRecording as jest.Mock).mockRejectedValue(
        new Error('Rust core timeout')
      );

      renderScreen();

      await waitFor(() => {
        expect(screen.getByText('Record')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(screen.getByText(/timeout/i)).toBeInTheDocument();
      });

      // Retrying surfaces the error again and re-invokes the core.
      fireEvent.click(screen.getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Performance-Based Core Switching', () => {
    it.skip('should recommend core switching based on performance metrics (REMOVED: dual-core recommendation)', () => {});
    it.skip('should automatically suggest core switching after performance degradation (REMOVED: dual-core recommendation)', () => {});
    it.skip('should provide performance comparison when both cores have data (REMOVED: dual-core metrics)', () => {});
  });

  describe('User Preference Management', () => {
    it.skip('should save and restore core preferences (REMOVED: dual-core selector)', () => {});
    it.skip('should handle preference migration when preferred core is unavailable (REMOVED: dual-core selector)', () => {});

    it('preserves the ability to play recordings after load', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.getLatestRecording as jest.Mock).mockResolvedValue('/path/to/script.json');

      renderScreen();

      await waitFor(() => {
        expect(screen.getByText('Start Playback').closest('button')).not.toBeDisabled();
      });
      fireEvent.click(screen.getByText('Start Playback'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });
    });
  });
});
