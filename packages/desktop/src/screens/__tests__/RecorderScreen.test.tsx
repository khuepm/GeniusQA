/**
 * Unit tests for RecorderScreen component
 * Requirements: 4.1, 4.2, 4.3
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import RecorderScreen from '../RecorderScreen';
import { getIPCBridge, resetIPCBridge } from '../../services/ipcBridgeService';

// Mock the IPC Bridge service
jest.mock('../../services/ipcBridgeService', () => ({
  getIPCBridge: jest.fn(),
  resetIPCBridge: jest.fn(),
}));

// Mock react-router-dom navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
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
      // Core management methods
      getAvailableCores: jest.fn().mockResolvedValue(['python']),
      getCoreStatus: jest.fn().mockResolvedValue({
        activeCoreType: 'python',
        availableCores: ['python'],
        coreHealth: { python: true, rust: false }
      }),
      selectCore: jest.fn().mockResolvedValue(undefined),
      getCorePerformanceMetrics: jest.fn().mockResolvedValue([{
        coreType: 'python',
        lastOperationTime: 100,
        memoryUsage: 50,
        cpuUsage: 10,
        operationCount: 5,
        errorRate: 0
      }]),
    };

    (getIPCBridge as jest.Mock).mockReturnValue(mockIPCBridge);
  });

  afterEach(() => {
    resetIPCBridge();
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  describe('Initial Rendering', () => {
    it('should render the component with title', () => {
      const { getByText } = renderWithRouter(<RecorderScreen />);

      expect(getByText('GeniusQA Recorder')).toBeInTheDocument();
      expect(getByText('Record and replay desktop interactions')).toBeInTheDocument();
    });

    it('should display idle status initially', () => {
      const { getByText } = renderWithRouter(<RecorderScreen />);

      expect(getByText('Status')).toBeInTheDocument();
      expect(getByText('Idle')).toBeInTheDocument();
    });

    it('should render all three control buttons', () => {
      const { getByText } = renderWithRouter(<RecorderScreen />);

      expect(getByText('Record')).toBeInTheDocument();
      expect(getByText('Start Playback')).toBeInTheDocument();
      expect(getByText('Stop Recording')).toBeInTheDocument();
    });
  });

  describe('Button States - Idle with No Recordings', () => {
    it('should enable Record button when idle with no recordings', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        const recordButton = getByText('Record').closest('button');
        expect(recordButton).not.toBeDisabled();
      });
    });

    it('should disable Start button when idle with no recordings', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        const startButton = getByText('Start Playback').closest('button');
        expect(startButton).toBeDisabled();
      });
    });

    it('should disable Stop button when idle', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        const stopButton = getByText('Stop Recording').closest('button');
        expect(stopButton).toBeDisabled();
      });
    });
  });

  describe('Button States - Idle with Recordings', () => {
    it('should enable both Record and Start buttons when idle with recordings', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        const recordButton = getByText('Record').closest('button');
        const startButton = getByText('Start Playback').closest('button');

        expect(recordButton).not.toBeDisabled();
        expect(startButton).not.toBeDisabled();
      });
    });
  });

  describe('Status Display', () => {
    it('should display Recording status when recording', async () => {
      const { getByText } = renderWithRouter(<RecorderScreen />);

      const recordButton = getByText('Record').closest('button');
      fireEvent.click(recordButton!);

      await waitFor(() => {
        expect(getByText('Recording')).toBeInTheDocument();
      });
    });

    it('should display Playing status when playing', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        const startButton = getByText('Start Playback').closest('button');
        fireEvent.click(startButton!);
      });

      await waitFor(() => {
        expect(getByText('Playing')).toBeInTheDocument();
      });
    });
  });

  describe('Error Display', () => {
    it('should display error message when recording fails', async () => {
      mockIPCBridge.startRecording.mockRejectedValue(new Error('Recording failed'));

      const { getByText } = renderWithRouter(<RecorderScreen />);

      const recordButton = getByText('Record').closest('button');
      fireEvent.click(recordButton!);

      await waitFor(() => {
        expect(getByText('Recording failed')).toBeInTheDocument();
      });
    });

    it('should display error message when playback fails', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');
      mockIPCBridge.startPlayback.mockRejectedValue(new Error('Playback failed'));

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        const startButton = getByText('Start Playback').closest('button');
        fireEvent.click(startButton!);
      });

      await waitFor(() => {
        expect(getByText('Playback failed')).toBeInTheDocument();
      });
    });

    it('should clear error when starting new action', async () => {
      mockIPCBridge.startRecording.mockRejectedValueOnce(new Error('Recording failed'));

      const { getByText, queryByText } = renderWithRouter(<RecorderScreen />);

      // First attempt - should fail
      const recordButton = getByText('Record').closest('button');
      fireEvent.click(recordButton!);

      await waitFor(() => {
        expect(getByText('Recording failed')).toBeInTheDocument();
      });

      // Second attempt - should clear error
      mockIPCBridge.startRecording.mockResolvedValue(undefined);
      fireEvent.click(recordButton!);

      await waitFor(() => {
        expect(queryByText('Recording failed')).not.toBeInTheDocument();
      });
    });
  });

  describe('Button Click Handlers', () => {
    it('should call startRecording when Record button is clicked', async () => {
      const { getByText } = renderWithRouter(<RecorderScreen />);

      const recordButton = getByText('Record').closest('button');
      fireEvent.click(recordButton!);

      await waitFor(() => {
        expect(mockIPCBridge.startRecording).toHaveBeenCalledTimes(1);
      });
    });

    it('should call startPlayback when Start button is clicked', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');

      const { getByText } = renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        const startButton = getByText('Start Playback').closest('button');
        fireEvent.click(startButton!);
      });

      await waitFor(() => {
        expect(mockIPCBridge.startPlayback).toHaveBeenCalled();
      });
    });

    it('should call stopRecording when Stop button is clicked during recording', async () => {
      const { getByText } = renderWithRouter(<RecorderScreen />);

      // Start recording
      const recordButton = getByText('Record').closest('button');
      fireEvent.click(recordButton!);

      await waitFor(() => {
        expect(getByText('Recording')).toBeInTheDocument();
      });

      // Stop recording
      const stopButton = getByText('Stop Recording').closest('button');
      fireEvent.click(stopButton!);

      await waitFor(() => {
        expect(mockIPCBridge.stopRecording).toHaveBeenCalledTimes(1);
      });
    });

    it('should call stopPlayback when Stop button is clicked during playback', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');

      const { getByText } = renderWithRouter(<RecorderScreen />);

      // Start playback
      await waitFor(() => {
        const startButton = getByText('Start Playback').closest('button');
        fireEvent.click(startButton!);
      });

      await waitFor(() => {
        expect(getByText('Playing')).toBeInTheDocument();
      });

      // Stop playback
      const stopButton = getByText('Stop Playback').closest('button');
      fireEvent.click(stopButton!);

      await waitFor(() => {
        expect(mockIPCBridge.stopPlayback).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Initialization', () => {
    it('should check for recordings on mount', async () => {
      renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        expect(mockIPCBridge.checkForRecordings).toHaveBeenCalledTimes(1);
      });
    });

    it('should get latest recording path when recordings exist', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(true);
      mockIPCBridge.getLatestRecording.mockResolvedValue('/path/to/latest.json');

      renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        expect(mockIPCBridge.getLatestRecording).toHaveBeenCalledTimes(1);
      });
    });

    it('should not get latest recording when no recordings exist', async () => {
      mockIPCBridge.checkForRecordings.mockResolvedValue(false);

      renderWithRouter(<RecorderScreen />);

      await waitFor(() => {
        expect(mockIPCBridge.checkForRecordings).toHaveBeenCalledTimes(1);
        expect(mockIPCBridge.getLatestRecording).not.toHaveBeenCalled();
      });
    });

    it('should register event listeners on mount', () => {
      renderWithRouter(<RecorderScreen />);

      expect(mockIPCBridge.addEventListener).toHaveBeenCalledWith('progress', expect.any(Function));
      expect(mockIPCBridge.addEventListener).toHaveBeenCalledWith('action_preview', expect.any(Function));
      expect(mockIPCBridge.addEventListener).toHaveBeenCalledWith('complete', expect.any(Function));
      expect(mockIPCBridge.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should unregister event listeners on unmount', () => {
      const { unmount } = renderWithRouter(<RecorderScreen />);

      unmount();

      expect(mockIPCBridge.removeEventListener).toHaveBeenCalledWith('progress', expect.any(Function));
      expect(mockIPCBridge.removeEventListener).toHaveBeenCalledWith('action_preview', expect.any(Function));
      expect(mockIPCBridge.removeEventListener).toHaveBeenCalledWith('complete', expect.any(Function));
      expect(mockIPCBridge.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('Recording Result Handling', () => {
    it('should update state with recording path after successful stop', async () => {
      const { getByText } = renderWithRouter(<RecorderScreen />);

      // Start recording
      const recordButton = getByText('Record').closest('button');
      fireEvent.click(recordButton!);

      await waitFor(() => {
        expect(getByText('Recording')).toBeInTheDocument();
      });

      // Stop recording
      const stopButton = getByText('Stop Recording').closest('button');
      fireEvent.click(stopButton!);

      await waitFor(() => {
        expect(getByText('Idle')).toBeInTheDocument();
        expect(getByText('/path/to/script.json')).toBeInTheDocument();
      });
    });

    it('should enable Start button after successful recording', async () => {
      const { getByText } = renderWithRouter(<RecorderScreen />);

      // Start recording
      const recordButton = getByText('Record').closest('button');
      fireEvent.click(recordButton!);

      await waitFor(() => {
        expect(getByText('Recording')).toBeInTheDocument();
      });

      // Stop recording
      const stopButton = getByText('Stop Recording').closest('button');
      fireEvent.click(stopButton!);

      await waitFor(() => {
        const startButton = getByText('Start Playback').closest('button');
        expect(startButton).not.toBeDisabled();
      });
    });
  });
});
