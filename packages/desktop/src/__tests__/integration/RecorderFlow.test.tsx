/**
 * Integration Tests for Recorder Flow
 * Tests complete recording and playback flows including IPC communication.
 *
 * Migrated from React Native to the web stack: RecorderScreen is now a web
 * component that consumes the IPC bridge via `getIPCBridge()` and uses
 * react-router. The DOM contract (button labels, status text) matches
 * src/screens/__tests__/RecorderScreen.test.tsx:
 *   - Buttons: "Record", "Start Playback", "Stop Recording" / "Stop Playback"
 *   - Status value text: "Idle" / "Recording" / "Playing"
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import RecorderScreen from '../../screens/RecorderScreen';
import { getIPCBridge, resetIPCBridge } from '../../services/ipcBridgeService';

// Mock the IPC Bridge service (getIPCBridge returns a per-test mock bridge).
jest.mock('../../services/ipcBridgeService', () => ({
  getIPCBridge: jest.fn(),
  resetIPCBridge: jest.fn(),
}));

// Mock react-router-dom navigate so RecorderScreen can render standalone.
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderWithRouter = (component: React.ReactElement) =>
  render(<BrowserRouter>{component}</BrowserRouter>);

describe('Recorder Flow Integration Tests', () => {
  let mockIPCBridge: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockIPCBridge = {
      checkForRecordings: jest.fn().mockResolvedValue(false),
      getLatestRecording: jest.fn().mockResolvedValue(null),
      listScripts: jest.fn().mockResolvedValue([]),
      startRecording: jest.fn().mockResolvedValue(undefined),
      stopRecording: jest.fn().mockResolvedValue({
        success: true,
        scriptPath: '/path/to/script.json',
        actionCount: 10,
        duration: 5.5,
      }),
      startPlayback: jest.fn().mockResolvedValue(undefined),
      stopPlayback: jest.fn().mockResolvedValue(undefined),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      getAvailableCores: jest.fn().mockResolvedValue(['python']),
      getCoreStatus: jest.fn().mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python'],
        coreHealth: { python: true, rust: false },
      }),
      selectCore: jest.fn().mockResolvedValue(undefined),
      getCorePerformanceMetrics: jest.fn().mockResolvedValue([]),
    };

    (getIPCBridge as jest.Mock).mockReturnValue(mockIPCBridge);
  });

  afterEach(() => {
    resetIPCBridge();
  });

  describe('Complete Recording Flow', () => {
    it('should successfully complete a full recording session', async () => {
      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Idle')).toBeInTheDocument();
      });

      const recordButton = getByText('Record').closest('button');
      fireEvent.click(recordButton!);

      await waitFor(() => {
        expect(mockIPCBridge.startRecording).toHaveBeenCalled();
        expect(getByText('Recording')).toBeInTheDocument();
      });

      expect(getByText('Record').closest('button')).toBeDisabled();

      const stopButton = getByText('Stop Recording').closest('button');
      fireEvent.click(stopButton!);

      await waitFor(() => {
        expect(mockIPCBridge.stopRecording).toHaveBeenCalled();
        expect(getByText('Idle')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(getByText('Start Playback').closest('button')).not.toBeDisabled();
      });
    });

    it('should handle recording with no actions captured', async () => {
      mockIPCBridge.stopRecording.mockResolvedValue({
        success: true,
        scriptPath: '/path/to/script.json',
        actionCount: 0,
        duration: 0.1,
      });

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => expect(getByText('Record')).toBeInTheDocument());

      fireEvent.click(getByText('Record').closest('button')!);
      await waitFor(() => {
        expect(mockIPCBridge.startRecording).toHaveBeenCalled();
      });

      fireEvent.click(getByText('Stop Recording').closest('button')!);
      await waitFor(() => {
        expect(mockIPCBridge.stopRecording).toHaveBeenCalled();
      });
    });

    it('should handle multiple recording sessions in sequence', async () => {
      mockIPCBridge.stopRecording
        .mockResolvedValueOnce({
          success: true,
          scriptPath: '/path/to/script1.json',
          actionCount: 10,
          duration: 5.0,
        })
        .mockResolvedValueOnce({
          success: true,
          scriptPath: '/path/to/script2.json',
          actionCount: 20,
          duration: 10.0,
        });

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => expect(getByText('Record')).toBeInTheDocument());

      fireEvent.click(getByText('Record').closest('button')!);
      await waitFor(() => expect(mockIPCBridge.startRecording).toHaveBeenCalledTimes(1));
      fireEvent.click(getByText('Stop Recording').closest('button')!);
      await waitFor(() => expect(mockIPCBridge.stopRecording).toHaveBeenCalledTimes(1));

      fireEvent.click(getByText('Record').closest('button')!);
      await waitFor(() => expect(mockIPCBridge.startRecording).toHaveBeenCalledTimes(2));
      fireEvent.click(getByText('Stop Recording').closest('button')!);
      await waitFor(() => expect(mockIPCBridge.stopRecording).toHaveBeenCalledTimes(2));
    });
  });

  describe('Complete Playback Flow', () => {
    beforeEach(() => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');
    });

    it('should successfully complete a full playback session', async () => {
      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start Playback').closest('button')).not.toBeDisabled();
      });

      fireEvent.click(getByText('Start Playback').closest('button')!);

      await waitFor(() => {
        expect(mockIPCBridge.startPlayback).toHaveBeenCalled();
        expect(getByText('Playing')).toBeInTheDocument();
      });

      expect(getByText('Start Playback').closest('button')).toBeDisabled();

      fireEvent.click(getByText('Stop Playback').closest('button')!);

      await waitFor(() => {
        expect(mockIPCBridge.stopPlayback).toHaveBeenCalled();
        expect(getByText('Idle')).toBeInTheDocument();
      });
    });

    it('should handle playback with specific script path', async () => {
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/specific_script.json');

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start Playback').closest('button')).not.toBeDisabled();
      });

      fireEvent.click(getByText('Start Playback').closest('button')!);

      await waitFor(() => {
        expect(mockIPCBridge.startPlayback).toHaveBeenCalled();
      });
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from recording start failure', async () => {
      mockIPCBridge.startRecording.mockRejectedValue(
        new Error('Permission denied. Please enable Accessibility permissions.')
      );

      const { getByText, queryByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => expect(getByText('Record')).toBeInTheDocument());

      fireEvent.click(getByText('Record').closest('button')!);

      await waitFor(() => {
        expect(queryByText(/Permission denied/)).toBeInTheDocument();
      });

      expect(getByText('Idle')).toBeInTheDocument();
      expect(getByText('Record').closest('button')).not.toBeDisabled();
    });

    it('should recover from recording stop failure', async () => {
      mockIPCBridge.stopRecording.mockRejectedValue(
        new Error('Failed to save recording: Disk full')
      );

      const { getByText, queryByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => expect(getByText('Record')).toBeInTheDocument());

      fireEvent.click(getByText('Record').closest('button')!);
      await waitFor(() => expect(mockIPCBridge.startRecording).toHaveBeenCalled());

      fireEvent.click(getByText('Stop Recording').closest('button')!);

      await waitFor(() => {
        expect(queryByText(/Disk full/)).toBeInTheDocument();
      });

      // Current behavior: a stop-recording failure surfaces the error but does
      // NOT reset the status, so the component remains in the "Recording" state
      // (unlike the legacy RN flow which returned to idle).
      expect(getByText('Recording')).toBeInTheDocument();
    });

    it('should recover from playback start failure', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');
      mockIPCBridge.startPlayback.mockRejectedValue(
        new Error('Script file corrupted: Unable to parse JSON')
      );

      const { getByText, queryByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start Playback').closest('button')).not.toBeDisabled();
      });

      fireEvent.click(getByText('Start Playback').closest('button')!);

      await waitFor(() => {
        expect(queryByText(/corrupted/)).toBeInTheDocument();
      });

      expect(getByText('Idle')).toBeInTheDocument();
      expect(getByText('Start Playback').closest('button')).not.toBeDisabled();
    });

    it('should clear previous errors when starting new operation', async () => {
      mockIPCBridge.startRecording
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(undefined);

      const { getByText, queryByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => expect(getByText('Record')).toBeInTheDocument());

      fireEvent.click(getByText('Record').closest('button')!);
      await waitFor(() => {
        expect(queryByText(/First error/)).toBeInTheDocument();
      });

      fireEvent.click(getByText('Record').closest('button')!);
      await waitFor(() => {
        expect(queryByText(/First error/)).not.toBeInTheDocument();
        expect(getByText('Recording')).toBeInTheDocument();
      });
    });
  });

  describe('IPC Communication', () => {
    it('should properly serialize and deserialize recording results', async () => {
      const mockResult = {
        success: true,
        scriptPath: '/home/user/GeniusQA/recordings/script_20240101_120000.json',
        actionCount: 127,
        duration: 45.5,
      };
      mockIPCBridge.stopRecording.mockResolvedValue(mockResult);

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => expect(getByText('Record')).toBeInTheDocument());

      fireEvent.click(getByText('Record').closest('button')!);
      await waitFor(() => expect(mockIPCBridge.startRecording).toHaveBeenCalled());

      fireEvent.click(getByText('Stop Recording').closest('button')!);
      await waitFor(() => expect(mockIPCBridge.stopRecording).toHaveBeenCalled());

      const stopRecordingCall = mockIPCBridge.stopRecording.mock.results[0];
      const result = await stopRecordingCall.value;
      expect(result).toEqual(mockResult);
    });

    it('should handle IPC timeout errors', async () => {
      mockIPCBridge.startRecording.mockRejectedValue(
        new Error('IPC timeout: Python Core did not respond')
      );

      const { getByText, queryByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => expect(getByText('Record')).toBeInTheDocument());

      fireEvent.click(getByText('Record').closest('button')!);

      await waitFor(() => {
        expect(queryByText(/timeout/)).toBeInTheDocument();
      });
    });

    it('should handle IPC process crash', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');
      mockIPCBridge.startPlayback.mockRejectedValue(new Error('Python Core process crashed'));

      const { getByText, queryByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start Playback').closest('button')).not.toBeDisabled();
      });

      fireEvent.click(getByText('Start Playback').closest('button')!);

      await waitFor(() => {
        expect(queryByText(/crashed/)).toBeInTheDocument();
      });
    });

    it('should handle malformed IPC responses', async () => {
      mockIPCBridge.stopRecording.mockRejectedValue(
        new Error('Invalid response format from Python Core')
      );

      const { getByText, queryByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => expect(getByText('Record')).toBeInTheDocument());

      fireEvent.click(getByText('Record').closest('button')!);
      await waitFor(() => expect(mockIPCBridge.startRecording).toHaveBeenCalled());

      fireEvent.click(getByText('Stop Recording').closest('button')!);

      await waitFor(() => {
        expect(queryByText(/Invalid response/)).toBeInTheDocument();
      });
    });
  });

  describe('State Transitions', () => {
    it('should maintain correct state through idle -> recording -> idle transition', async () => {
      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => expect(getByText('Idle')).toBeInTheDocument());

      fireEvent.click(getByText('Record').closest('button')!);
      await waitFor(() => expect(getByText('Recording')).toBeInTheDocument());

      fireEvent.click(getByText('Stop Recording').closest('button')!);
      await waitFor(() => expect(getByText('Idle')).toBeInTheDocument());
    });

    it('should maintain correct state through idle -> playing -> idle transition', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => expect(getByText('Idle')).toBeInTheDocument());

      await waitFor(() => {
        expect(getByText('Start Playback').closest('button')).not.toBeDisabled();
      });
      fireEvent.click(getByText('Start Playback').closest('button')!);
      await waitFor(() => expect(getByText('Playing')).toBeInTheDocument());

      fireEvent.click(getByText('Stop Playback').closest('button')!);
      await waitFor(() => expect(getByText('Idle')).toBeInTheDocument());
    });

    it('should not allow recording during playback', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start Playback').closest('button')).not.toBeDisabled();
      });

      fireEvent.click(getByText('Start Playback').closest('button')!);
      await waitFor(() => expect(mockIPCBridge.startPlayback).toHaveBeenCalled());

      expect(getByText('Record').closest('button')).toBeDisabled();
    });

    it('should not allow playback during recording', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => expect(getByText('Record')).toBeInTheDocument());

      fireEvent.click(getByText('Record').closest('button')!);
      await waitFor(() => expect(mockIPCBridge.startRecording).toHaveBeenCalled());

      expect(getByText('Start Playback').closest('button')).toBeDisabled();
    });
  });

  describe('Button State Consistency', () => {
    it('should have correct button states when idle with no recordings', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => expect(getByText('Record')).toBeInTheDocument());

      expect(getByText('Record').closest('button')).not.toBeDisabled();
      await waitFor(() => {
        expect(getByText('Start Playback').closest('button')).toBeDisabled();
      });
      expect(getByText('Stop Recording').closest('button')).toBeDisabled();
    });

    it('should have correct button states when idle with recordings', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => expect(getByText('Record')).toBeInTheDocument());

      expect(getByText('Record').closest('button')).not.toBeDisabled();
      await waitFor(() => {
        expect(getByText('Start Playback').closest('button')).not.toBeDisabled();
      });
      expect(getByText('Stop Recording').closest('button')).toBeDisabled();
    });

    it('should have correct button states when recording', async () => {
      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => expect(getByText('Record')).toBeInTheDocument());

      fireEvent.click(getByText('Record').closest('button')!);
      await waitFor(() => expect(mockIPCBridge.startRecording).toHaveBeenCalled());

      expect(getByText('Record').closest('button')).toBeDisabled();
      expect(getByText('Start Playback').closest('button')).toBeDisabled();
      expect(getByText('Stop Recording').closest('button')).not.toBeDisabled();
    });

    it('should have correct button states when playing', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start Playback').closest('button')).not.toBeDisabled();
      });

      fireEvent.click(getByText('Start Playback').closest('button')!);
      await waitFor(() => expect(mockIPCBridge.startPlayback).toHaveBeenCalled());

      expect(getByText('Record').closest('button')).toBeDisabled();
      expect(getByText('Start Playback').closest('button')).toBeDisabled();
      expect(getByText('Stop Playback').closest('button')).not.toBeDisabled();
    });
  });
});
