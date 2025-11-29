/**
 * Unit tests for RecorderScreen component
 * Requirements: 4.1, 4.2, 4.3
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RecorderScreen from '../RecorderScreen';
import { getIPCBridge, resetIPCBridge } from '../../services/ipcBridgeService';

// Mock the IPC Bridge service
jest.mock('../../services/ipcBridgeService', () => ({
  getIPCBridge: jest.fn(),
  resetIPCBridge: jest.fn(),
}));

describe('RecorderScreen', () => {
  let mockIPCBridge: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock IPC Bridge
    mockIPCBridge = {
      checkForRecordings: jest.fn().mockResolvedValue(false),
      getLatestRecording: jest.fn().mockResolvedValue(null),
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
    };

    (getIPCBridge as jest.Mock).mockReturnValue(mockIPCBridge);
  });

  afterEach(() => {
    resetIPCBridge();
  });

  describe('Initial Rendering', () => {
    it('should render the component with title', () => {
      const { getByText } = render(<RecorderScreen />);

      expect(getByText('GeniusQA Recorder')).toBeTruthy();
      expect(getByText('Record and replay desktop interactions')).toBeTruthy();
    });

    it('should display idle status initially', () => {
      const { getByText } = render(<RecorderScreen />);

      expect(getByText('Status')).toBeTruthy();
      expect(getByText('Idle')).toBeTruthy();
    });

    it('should render all three control buttons', () => {
      const { getByText } = render(<RecorderScreen />);

      expect(getByText('Record')).toBeTruthy();
      expect(getByText('Start Playback')).toBeTruthy();
      expect(getByText('Stop')).toBeTruthy();
    });
  });

  describe('Button States - Idle with No Recordings', () => {
    it('should enable Record button when idle with no recordings', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        const recordButton = getByText('Record').parent?.parent;
        expect(recordButton?.props.accessibilityState?.disabled).toBeFalsy();
      });
    });

    it('should disable Start button when idle with no recordings', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        const startButton = getByText('Start Playback').parent?.parent;
        expect(startButton?.props.accessibilityState?.disabled).toBeTruthy();
      });
    });

    it('should disable Stop button when idle', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        const stopButton = getByText('Stop').parent?.parent;
        expect(stopButton?.props.accessibilityState?.disabled).toBeTruthy();
      });
    });
  });

  describe('Button States - Idle with Recordings', () => {
    it('should enable both Record and Start buttons when idle with recordings', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        const recordButton = getByText('Record').parent?.parent;
        const startButton = getByText('Start Playback').parent?.parent;

        expect(recordButton?.props.accessibilityState?.disabled).toBeFalsy();
        expect(startButton?.props.accessibilityState?.disabled).toBeFalsy();
      });
    });
  });

  describe('Status Display', () => {
    it('should display Recording status when recording', async () => {
      const { getByText } = render(<RecorderScreen />);

      const recordButton = getByText('Record');
      fireEvent.press(recordButton);

      await waitFor(() => {
        expect(getByText('Recording')).toBeTruthy();
      });
    });

    it('should display Playing status when playing', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        const startButton = getByText('Start Playback');
        fireEvent.press(startButton);
      });

      await waitFor(() => {
        expect(getByText('Playing')).toBeTruthy();
      });
    });
  });

  describe('Error Display', () => {
    it('should display error message when recording fails', async () => {
      mockIPCBridge.startRecording.mockRejectedValue(new Error('Recording failed'));

      const { getByText, queryByText } = render(<RecorderScreen />);

      const recordButton = getByText('Record');
      fireEvent.press(recordButton);

      await waitFor(() => {
        expect(getByText('Recording failed')).toBeTruthy();
      });
    });

    it('should display error message when playback fails', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');
      mockIPCBridge.startPlayback.mockRejectedValue(new Error('Playback failed'));

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        const startButton = getByText('Start Playback');
        fireEvent.press(startButton);
      });

      await waitFor(() => {
        expect(getByText('Playback failed')).toBeTruthy();
      });
    });

    it('should clear error when starting new action', async () => {
      mockIPCBridge.startRecording.mockRejectedValueOnce(new Error('Recording failed'));

      const { getByText, queryByText } = render(<RecorderScreen />);

      // First attempt - should fail
      const recordButton = getByText('Record');
      fireEvent.press(recordButton);

      await waitFor(() => {
        expect(getByText('Recording failed')).toBeTruthy();
      });

      // Second attempt - should clear error
      mockIPCBridge.startRecording.mockResolvedValue(undefined);
      fireEvent.press(recordButton);

      await waitFor(() => {
        expect(queryByText('Recording failed')).toBeNull();
      });
    });
  });

  describe('Button Click Handlers', () => {
    it('should call startRecording when Record button is clicked', async () => {
      const { getByText } = render(<RecorderScreen />);

      const recordButton = getByText('Record');
      fireEvent.press(recordButton);

      await waitFor(() => {
        expect(mockIPCBridge.startRecording).toHaveBeenCalledTimes(1);
      });
    });

    it('should call startPlayback when Start button is clicked', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');

      const { getByText } = render(<RecorderScreen />);

      await waitFor(() => {
        const startButton = getByText('Start Playback');
        fireEvent.press(startButton);
      });

      await waitFor(() => {
        expect(mockIPCBridge.startPlayback).toHaveBeenCalledWith('/path/to/latest.json');
      });
    });

    it('should call stopRecording when Stop button is clicked during recording', async () => {
      const { getByText } = render(<RecorderScreen />);

      // Start recording
      const recordButton = getByText('Record');
      fireEvent.press(recordButton);

      await waitFor(() => {
        expect(getByText('Recording')).toBeTruthy();
      });

      // Stop recording
      const stopButton = getByText('Stop');
      fireEvent.press(stopButton);

      await waitFor(() => {
        expect(mockIPCBridge.stopRecording).toHaveBeenCalledTimes(1);
      });
    });

    it('should call stopPlayback when Stop button is clicked during playback', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');

      const { getByText } = render(<RecorderScreen />);

      // Start playback
      await waitFor(() => {
        const startButton = getByText('Start Playback');
        fireEvent.press(startButton);
      });

      await waitFor(() => {
        expect(getByText('Playing')).toBeTruthy();
      });

      // Stop playback
      const stopButton = getByText('Stop');
      fireEvent.press(stopButton);

      await waitFor(() => {
        expect(mockIPCBridge.stopPlayback).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Initialization', () => {
    it('should check for recordings on mount', async () => {
      render(<RecorderScreen />);

      await waitFor(() => {
        expect(mockIPCBridge.checkForRecordings).toHaveBeenCalledTimes(1);
      });
    });

    it('should get latest recording path when recordings exist', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(mockIPCBridge.getLatestRecording).toHaveBeenCalledTimes(1);
      });
    });

    it('should not get latest recording when no recordings exist', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);

      render(<RecorderScreen />);

      await waitFor(() => {
        expect(mockIPCBridge.checkForRecordings).toHaveBeenCalledTimes(1);
        expect(mockIPCBridge.getLatestRecording).not.toHaveBeenCalled();
      });
    });

    it('should register event listeners on mount', () => {
      render(<RecorderScreen />);

      expect(mockIPCBridge.addEventListener).toHaveBeenCalledWith('progress', expect.any(Function));
      expect(mockIPCBridge.addEventListener).toHaveBeenCalledWith('complete', expect.any(Function));
      expect(mockIPCBridge.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should unregister event listeners on unmount', () => {
      const { unmount } = render(<RecorderScreen />);

      unmount();

      expect(mockIPCBridge.removeEventListener).toHaveBeenCalledWith('progress', expect.any(Function));
      expect(mockIPCBridge.removeEventListener).toHaveBeenCalledWith('complete', expect.any(Function));
      expect(mockIPCBridge.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('Recording Result Handling', () => {
    it('should update state with recording path after successful stop', async () => {
      const { getByText } = render(<RecorderScreen />);

      // Start recording
      const recordButton = getByText('Record');
      fireEvent.press(recordButton);

      await waitFor(() => {
        expect(getByText('Recording')).toBeTruthy();
      });

      // Stop recording
      const stopButton = getByText('Stop');
      fireEvent.press(stopButton);

      await waitFor(() => {
        expect(getByText('Idle')).toBeTruthy();
        expect(getByText('/path/to/script.json')).toBeTruthy();
      });
    });

    it('should enable Start button after successful recording', async () => {
      const { getByText } = render(<RecorderScreen />);

      // Start recording
      const recordButton = getByText('Record');
      fireEvent.press(recordButton);

      await waitFor(() => {
        expect(getByText('Recording')).toBeTruthy();
      });

      // Stop recording
      const stopButton = getByText('Stop');
      fireEvent.press(stopButton);

      await waitFor(() => {
        const startButton = getByText('Start Playback').parent?.parent;
        expect(startButton?.props.accessibilityState?.disabled).toBeFalsy();
      });
    });
  });
});
