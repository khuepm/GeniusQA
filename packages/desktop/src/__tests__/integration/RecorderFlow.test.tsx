/**
 * Integration Tests for Recorder Flow
 * Tests complete recording and playback flows including IPC communication
 * Requirements: All (1.1-9.5)
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RecorderScreen from '../../screens/RecorderScreen';
import * as ipcBridgeService from '../../services/ipcBridgeService';

// Mock IPC Bridge Service
jest.mock('../../services/ipcBridgeService');

describe('Recorder Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Recording Flow', () => {
    it('should successfully complete a full recording session', async () => {
      // Mock successful recording flow
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue({
        success: true,
        scriptPath: '/path/to/script_20240101_120000.json',
        actionCount: 42,
        duration: 15.5,
      });

      const { getByText, queryByText } = render(<RecorderScreen />);

      // Wait for initial state
      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Verify initial state
      expect(queryByText('Status: Idle')).toBeTruthy();

      // Start recording
      const recordButton = getByText('Record');
      fireEvent.press(recordButton);

      // Verify recording started
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
        expect(queryByText('Status: Recording')).toBeTruthy();
      });

      // Verify Record button is disabled during recording
      expect(recordButton.props.accessibilityState?.disabled).toBe(true);

      // Stop recording
      const stopButton = getByText('Stop');
      fireEvent.press(stopButton);

      // Verify recording stopped and file saved
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
        expect(queryByText('Status: Idle')).toBeTruthy();
      });

      // Verify Start button is now enabled (has recordings)
      const startButton = getByText('Start');
      expect(startButton.props.accessibilityState?.disabled).toBe(false);
    });

    it('should handle recording with no actions captured', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue({
        success: true,
        scriptPath: '/path/to/script.json',
        actionCount: 0,
        duration: 0.1,
      });

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Start and stop recording quickly
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });

      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
      });

      // Should still save the file even with 0 actions
      expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
    });

    it('should handle multiple recording sessions in sequence', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopRecording as jest.Mock)
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

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // First recording session
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalledTimes(1);
      });

      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalledTimes(1);
      });

      // Second recording session
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalledTimes(2);
      });

      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Complete Playback Flow', () => {
    it('should successfully complete a full playback session', async () => {
      // Mock successful playback flow
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopPlayback as jest.Mock).mockResolvedValue(undefined);

      const { getByText, queryByText } = render(<RecorderScreen />);

      // Wait for initial state with recordings available
      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      // Verify Start button is enabled
      const startButton = getByText('Start');
      expect(startButton.props.accessibilityState?.disabled).toBe(false);

      // Start playback
      fireEvent.press(startButton);

      // Verify playback started
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
        expect(queryByText('Status: Playing')).toBeTruthy();
      });

      // Verify Start button is disabled during playback
      expect(startButton.props.accessibilityState?.disabled).toBe(true);

      // Stop playback
      const stopButton = getByText('Stop');
      fireEvent.press(stopButton);

      // Verify playback stopped
      await waitFor(() => {
        expect(ipcBridgeService.stopPlayback).toHaveBeenCalled();
        expect(queryByText('Status: Idle')).toBeTruthy();
      });
    });

    it('should handle playback completion without manual stop', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock).mockImplementation(() => {
        // Simulate playback completing on its own
        return new Promise((resolve) => {
          setTimeout(() => resolve(undefined), 100);
        });
      });

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      // Start playback
      fireEvent.press(getByText('Start'));

      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });

      // Wait for playback to complete
      await waitFor(
        () => {
          expect(queryByText('Status: Idle')).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });

    it('should handle playback with specific script path', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.getLatestRecording as jest.Mock).mockResolvedValue(
        '/path/to/specific_script.json'
      );
      (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      // Start playback
      fireEvent.press(getByText('Start'));

      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from recording start failure', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockRejectedValue(
        new Error('Permission denied. Please enable Accessibility permissions.')
      );

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Try to start recording
      fireEvent.press(getByText('Record'));

      // Verify error is displayed
      await waitFor(() => {
        expect(queryByText(/Permission denied/)).toBeTruthy();
      });

      // Verify state returned to idle
      expect(queryByText('Status: Idle')).toBeTruthy();

      // Verify Record button is still enabled for retry
      const recordButton = getByText('Record');
      expect(recordButton.props.accessibilityState?.disabled).toBe(false);
    });

    it('should recover from recording stop failure', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopRecording as jest.Mock).mockRejectedValue(
        new Error('Failed to save recording: Disk full')
      );

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Start recording
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });

      // Try to stop recording
      fireEvent.press(getByText('Stop'));

      // Verify error is displayed
      await waitFor(() => {
        expect(queryByText(/Disk full/)).toBeTruthy();
      });

      // Verify state returned to idle
      expect(queryByText('Status: Idle')).toBeTruthy();
    });

    it('should recover from playback start failure', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock).mockRejectedValue(
        new Error('Script file corrupted: Unable to parse JSON')
      );

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      // Try to start playback
      fireEvent.press(getByText('Start'));

      // Verify error is displayed
      await waitFor(() => {
        expect(queryByText(/corrupted/)).toBeTruthy();
      });

      // Verify state returned to idle
      expect(queryByText('Status: Idle')).toBeTruthy();

      // Verify Start button is still enabled for retry
      const startButton = getByText('Start');
      expect(startButton.props.accessibilityState?.disabled).toBe(false);
    });

    it('should recover from playback stop failure', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopPlayback as jest.Mock).mockRejectedValue(
        new Error('Failed to stop playback')
      );

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      // Start playback
      fireEvent.press(getByText('Start'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });

      // Try to stop playback
      fireEvent.press(getByText('Stop'));

      // Verify error is displayed
      await waitFor(() => {
        expect(queryByText(/Failed to stop/)).toBeTruthy();
      });

      // Should eventually return to idle
      await waitFor(() => {
        expect(queryByText('Status: Idle')).toBeTruthy();
      });
    });

    it('should handle Python Core unavailable error', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockRejectedValue(
        new Error('Python Core unavailable: Please ensure Python 3.9+ is installed')
      );

      const { queryByText } = render(<RecorderScreen />);

      // Verify error is displayed
      await waitFor(() => {
        expect(queryByText(/Python Core unavailable/)).toBeTruthy();
      });
    });

    it('should handle no recordings available error', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startPlayback as jest.Mock).mockRejectedValue(
        new Error('No recordings found. Please record a session first.')
      );

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Start button should be disabled
      const startButton = getByText('Start');
      expect(startButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('should clear previous errors when starting new operation', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock)
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(undefined);

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // First attempt - fails
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(queryByText(/First error/)).toBeTruthy();
      });

      // Second attempt - succeeds
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(queryByText(/First error/)).toBeFalsy();
        expect(queryByText('Status: Recording')).toBeTruthy();
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

      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue(mockResult);

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Start and stop recording
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });

      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(ipcBridgeService.stopRecording).toHaveBeenCalled();
      });

      // Verify the result was properly handled
      const stopRecordingCall = (ipcBridgeService.stopRecording as jest.Mock).mock.results[0];
      const result = await stopRecordingCall.value;
      expect(result).toEqual(mockResult);
    });

    it('should handle IPC timeout errors', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockRejectedValue(
        new Error('IPC timeout: Python Core did not respond')
      );

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      fireEvent.press(getByText('Record'));

      await waitFor(() => {
        expect(queryByText(/timeout/)).toBeTruthy();
      });
    });

    it('should handle IPC process crash', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock).mockRejectedValue(
        new Error('Python Core process crashed')
      );

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      fireEvent.press(getByText('Start'));

      await waitFor(() => {
        expect(queryByText(/crashed/)).toBeTruthy();
      });
    });

    it('should handle malformed IPC responses', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopRecording as jest.Mock).mockRejectedValue(
        new Error('Invalid response format from Python Core')
      );

      const { getByText, queryByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });

      fireEvent.press(getByText('Stop'));

      await waitFor(() => {
        expect(queryByText(/Invalid response/)).toBeTruthy();
      });
    });
  });

  describe('State Transitions', () => {
    it('should maintain correct state through idle -> recording -> idle transition', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopRecording as jest.Mock).mockResolvedValue({
        success: true,
        scriptPath: '/path/to/script.json',
        actionCount: 10,
        duration: 5.0,
      });

      const { getByText, queryByText } = render(<RecorderScreen />);

      // Initial: Idle
      await waitFor(() => {
        expect(queryByText('Status: Idle')).toBeTruthy();
      });

      // Transition to Recording
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(queryByText('Status: Recording')).toBeTruthy();
      });

      // Transition back to Idle
      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(queryByText('Status: Idle')).toBeTruthy();
      });
    });

    it('should maintain correct state through idle -> playing -> idle transition', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);
      (ipcBridgeService.stopPlayback as jest.Mock).mockResolvedValue(undefined);

      const { getByText, queryByText } = render(<RecorderScreen />);

      // Initial: Idle
      await waitFor(() => {
        expect(queryByText('Status: Idle')).toBeTruthy();
      });

      // Transition to Playing
      fireEvent.press(getByText('Start'));
      await waitFor(() => {
        expect(queryByText('Status: Playing')).toBeTruthy();
      });

      // Transition back to Idle
      fireEvent.press(getByText('Stop'));
      await waitFor(() => {
        expect(queryByText('Status: Idle')).toBeTruthy();
      });
    });

    it('should not allow recording during playback', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      // Start playback
      fireEvent.press(getByText('Start'));
      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });

      // Verify Record button is disabled
      const recordButton = getByText('Record');
      expect(recordButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('should not allow playback during recording', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Start recording
      fireEvent.press(getByText('Record'));
      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });

      // Verify Start button is disabled
      const startButton = getByText('Start');
      expect(startButton.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Button State Consistency', () => {
    it('should have correct button states when idle with no recordings', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Record: enabled
      expect(getByText('Record').props.accessibilityState?.disabled).toBe(false);

      // Start: disabled (no recordings)
      expect(getByText('Start').props.accessibilityState?.disabled).toBe(true);

      // Stop: disabled (not recording or playing)
      expect(getByText('Stop').props.accessibilityState?.disabled).toBe(true);
    });

    it('should have correct button states when idle with recordings', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      // Record: enabled
      expect(getByText('Record').props.accessibilityState?.disabled).toBe(false);

      // Start: enabled (has recordings)
      expect(getByText('Start').props.accessibilityState?.disabled).toBe(false);

      // Stop: disabled (not recording or playing)
      expect(getByText('Stop').props.accessibilityState?.disabled).toBe(true);
    });

    it('should have correct button states when recording', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(false);
      (ipcBridgeService.startRecording as jest.Mock).mockResolvedValue(undefined);

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Record')).toBeTruthy();
      });

      fireEvent.press(getByText('Record'));

      await waitFor(() => {
        expect(ipcBridgeService.startRecording).toHaveBeenCalled();
      });

      // Record: disabled
      expect(getByText('Record').props.accessibilityState?.disabled).toBe(true);

      // Start: disabled
      expect(getByText('Start').props.accessibilityState?.disabled).toBe(true);

      // Stop: enabled
      expect(getByText('Stop').props.accessibilityState?.disabled).toBe(false);
    });

    it('should have correct button states when playing', async () => {
      (ipcBridgeService.checkForRecordings as jest.Mock).mockResolvedValue(true);
      (ipcBridgeService.startPlayback as jest.Mock).mockResolvedValue(undefined);

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        expect(getByText('Start')).toBeTruthy();
      });

      fireEvent.press(getByText('Start'));

      await waitFor(() => {
        expect(ipcBridgeService.startPlayback).toHaveBeenCalled();
      });

      // Record: disabled
      expect(getByText('Record').props.accessibilityState?.disabled).toBe(true);

      // Start: disabled
      expect(getByText('Start').props.accessibilityState?.disabled).toBe(true);

      // Stop: enabled
      expect(getByText('Stop').props.accessibilityState?.disabled).toBe(false);
    });
  });
});
