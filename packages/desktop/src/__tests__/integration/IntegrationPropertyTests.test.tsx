/**
 * Integration Property-Based Tests
 *
 * NOTE (2026 rewrite): The original properties ("process restart on core
 * change", core-switch-during-operation, etc.) all drove the dual-core selector
 * UI (`core-option-*`, `selectCore`) that has been removed from RecorderScreen
 * (Rust core is now forced). They also used `fc.assert(fc.property(..., async
 * fn))`, which does NOT await the async predicate (it must be
 * `fc.asyncProperty`), so they never actually asserted anything across runs.
 *
 * Those properties are `it.skip`-ed with a reason. A replacement async property
 * exercises the current single-core recording path across generated script
 * payloads using the correct `fc.asyncProperty` form.
 */

import React from 'react';
import { render, fireEvent, waitFor, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as fc from 'fast-check';
import RecorderScreen from '../../screens/RecorderScreen';
import * as ipcBridgeService from '../../services/ipcBridgeService';

jest.mock('../../services/ipcBridgeService');
jest.mock('@tauri-apps/api/tauri', () => ({ invoke: jest.fn() }));
jest.mock('@tauri-apps/api/event', () => ({ listen: jest.fn().mockResolvedValue(jest.fn()) }));

const renderWithRouter = (component: React.ReactElement) =>
  render(<MemoryRouter>{component}</MemoryRouter>);

describe('Integration Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
    (ipcBridgeService.getLatestRecording as jest.Mock).mockResolvedValue(null);
    (ipcBridgeService.listScripts as jest.Mock).mockResolvedValue([]);
    (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
    (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue({
      success: true,
      scriptPath: '/path/to/script.json',
      actionCount: 1,
      duration: 1.0,
    });
    (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);
    (ipcBridgeService.stopPlayback as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Property 4: Process restart on core change', () => {
    // Removed feature: runtime core selection. The original tests also used the
    // non-awaiting `fc.property(..., async fn)` form.
    it.skip('should restart processes when core changes during active operations (REMOVED: dual-core selector)', () => {});
    it.skip('should handle core switching with various operation states (REMOVED: dual-core selector)', () => {});
    it.skip('should maintain operation integrity during core transitions (REMOVED: dual-core selector)', () => {});
  });

  describe('Recording integrity properties (single core)', () => {
    it('records and reports a result for any generated script payload', async () => {
      const scriptDataArb = fc.record({
        actionCount: fc.integer({ min: 1, max: 200 }),
        duration: fc.double({ min: 0.1, max: 120, noNaN: true }),
        scriptPath: fc
          .string({ minLength: 1, maxLength: 30 })
          .map(s => `/recordings/${encodeURIComponent(s)}.json`),
      });

      await fc.assert(
        fc.asyncProperty(scriptDataArb, async scriptData => {
          jest.clearAllMocks();
          (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
          (ipcBridgeService.getLatestRecording as jest.Mock).mockResolvedValue(null);
          (ipcBridgeService.listScripts as jest.Mock).mockResolvedValue([]);
          (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
          (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue({
            success: true,
            scriptPath: scriptData.scriptPath,
            actionCount: scriptData.actionCount,
            duration: scriptData.duration,
          });

          renderWithRouter(<RecorderScreen />);

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

          // Property: stopRecording always returns a successful result with the
          // generated payload, regardless of the specific counts/paths.
          const result = await (ipcBridgeService.stopRecording as jest.Mock).mock.results[0].value;
          expect(result.success).toBe(true);
          expect(result.scriptPath).toBe(scriptData.scriptPath);
          expect(result.actionCount).toBe(scriptData.actionCount);

          cleanup();
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Error Handling Properties', () => {
    it.skip('should handle core switching errors consistently (REMOVED: dual-core selector)', () => {});

    it('surfaces any recording error message to the user', async () => {
      const errorMessageArb = fc
        .string({ minLength: 5, maxLength: 60 })
        // Keep messages renderable/matchable: alphanumerics and spaces only.
        .map(s => s.replace(/[^a-zA-Z0-9 ]/g, 'x'))
        .filter(s => s.trim().length >= 5);

      await fc.assert(
        fc.asyncProperty(errorMessageArb, async message => {
          jest.clearAllMocks();
          (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
          (ipcBridgeService.getLatestRecording as jest.Mock).mockResolvedValue(null);
          (ipcBridgeService.listScripts as jest.Mock).mockResolvedValue([]);
          (ipcBridgeService.startRecording as jest.Mock).mockRejectedValue(new Error(message));

          renderWithRouter(<RecorderScreen />);

          await waitFor(() => {
            expect(screen.getByText('Record')).toBeInTheDocument();
          });

          fireEvent.click(screen.getByText('Record'));

          // Property: any error thrown by startRecording is rendered in the
          // error container, and the UI remains functional (Record still shown).
          await waitFor(() => {
            expect(document.querySelector('.error-text')?.textContent).toContain(message.trim());
          });
          expect(screen.getByText('Record')).toBeInTheDocument();

          cleanup();
        }),
        { numRuns: 10 }
      );
    });
  });
});
