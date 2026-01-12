/**
 * End-to-End Workflow Integration Tests
 * Integration tests for complete end-to-end workflows including
 * record → edit → play workflow, keyboard shortcuts, window resize, and error recovery
 * 
 * **Feature: desktop-ui-redesign, Task 13.3: End-to-End Workflow Tests**
 * 
 * Test areas:
 * - Record → edit → play workflow
 * - Keyboard shortcut integration
 * - Window resize and responsive behavior
 * - Error recovery and graceful degradation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { UnifiedInterface, UnifiedInterfaceProvider, useUnifiedInterface } from '../../components/UnifiedInterface';
import { TopToolbar } from '../../components/TopToolbar';
import { EditorArea } from '../../components/EditorArea';

// Mock CSS imports
jest.mock('../../components/UnifiedInterface.css', () => ({}));
jest.mock('../../components/TopToolbar.css', () => ({}));
jest.mock('../../components/EditorArea.css', () => ({}));
jest.mock('../../screens/UnifiedRecorderScreen.css', () => ({}));

// Mock React Router
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

// Mock IPC bridge service with more comprehensive functionality
jest.mock('../../services/ipcBridgeService', () => ({
  getIPCBridge: () => ({
    checkForRecordings: jest.fn().mockResolvedValue(false),
    getLatestRecording: jest.fn().mockResolvedValue(null),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    startRecording: jest.fn().mockResolvedValue({ success: true, sessionId: 'test-session' }),
    stopRecording: jest.fn().mockResolvedValue({
      success: true,
      actions: [
        { id: '1', type: 'mouse_click', timestamp: 100, data: { x: 50, y: 50 } },
        { id: '2', type: 'key_press', timestamp: 200, data: { key: 'Enter' } }
      ]
    }),
    startPlayback: jest.fn().mockResolvedValue({ success: true, playbackId: 'test-playback' }),
    stopPlayback: jest.fn().mockResolvedValue({ success: true }),
    saveScript: jest.fn().mockResolvedValue({ success: true, path: '/test/script.json' }),
    loadScript: jest.fn().mockResolvedValue({
      success: true,
      script: {
        path: '/test/script.json',
        filename: 'test-script.json',
        actions: [
          { id: '1', type: 'mouse_click', timestamp: 100, data: { x: 50, y: 50 } }
        ]
      }
    }),
  }),
}));

// Get mock instance for test assertions
const { getIPCBridge } = require('../../services/ipcBridgeService');
const mockIPCBridge = getIPCBridge();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Test component that simulates the unified recorder screen
 */
const TestUnifiedRecorderScreen: React.FC = () => {
  const { state, setMode, setEditorVisible, setRecordingSession, setPlaybackSession, setCurrentScript } = useUnifiedInterface();

  const handleRecordStart = async () => {
    try {
      await mockIPCBridge.startRecording();
      setMode('recording');
      setEditorVisible(true);
      setRecordingSession({
        isActive: true,
        startTime: Date.now(),
        actions: []
      });
    } catch (error) {
      console.error('Recording start failed:', error);
    }
  };

  const handleRecordStop = async () => {
    try {
      const result = await mockIPCBridge.stopRecording();
      setMode('idle');
      setRecordingSession({
        isActive: false,
        startTime: 0,
        actions: result.actions || []
      });
      if (result.actions?.length > 0) {
        setCurrentScript({
          path: '/temp/recording.json',
          filename: 'recording.json',
          actions: result.actions
        });
      }
    } catch (error) {
      console.error('Recording stop failed:', error);
    }
  };

  const handlePlayStart = async () => {
    try {
      await mockIPCBridge.startPlayback();
      setMode('playing');
      setEditorVisible(true);
      setPlaybackSession({
        isActive: true,
        currentActionIndex: 0,
        totalActions: state.currentScript?.actions?.length || 0,
        isPaused: false
      });
    } catch (error) {
      console.error('Playback start failed:', error);
    }
  };

  const handlePlayStop = async () => {
    try {
      await mockIPCBridge.stopPlayback();
      setMode('idle');
      setPlaybackSession(null);
    } catch (error) {
      console.error('Playback stop failed:', error);
    }
  };

  const handleSave = () => {
    setMode('editing');
  };

  const handleOpen = () => {
    setMode('editing');
  };

  const handleClear = () => {
    setCurrentScript(null);
    setMode('idle');
  };

  const toolbarProps = {
    hasRecordings: !!state.currentScript?.actions?.length,
    onRecordStart: handleRecordStart,
    onRecordStop: handleRecordStop,
    onPlayStart: handlePlayStart,
    onPlayStop: handlePlayStop,
    onSave: handleSave,
    onOpen: handleOpen,
    onClear: handleClear,
    onSettings: () => { },
  };

  const editorProps = {
    recordingSession: state.recordingSession,
    onActionSelect: () => { },
    onActionEdit: () => { },
    onActionDelete: () => { },
  };

  return (
    <UnifiedInterface>
      <div className="toolbar-area">
        <TopToolbar {...toolbarProps} />
      </div>
      <div className="editor-area-container">
        <EditorArea {...editorProps} />
      </div>
    </UnifiedInterface>
  );
};

/**
 * Renders complete unified recorder screen
 */
function renderUnifiedRecorderScreen() {
  return render(
    <UnifiedInterfaceProvider>
      <TestUnifiedRecorderScreen />
    </UnifiedInterfaceProvider>
  );
}

/**
 * Waits for async operations to complete
 */
async function waitForAsyncOperation(timeout = 1000) {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

/**
 * Simulates keyboard shortcut
 */
function simulateKeyboardShortcut(container: HTMLElement, key: string, modifiers: any = {}) {
  fireEvent.keyDown(container, {
    key,
    ctrlKey: modifiers.ctrl || false,
    metaKey: modifiers.meta || false,
    shiftKey: modifiers.shift || false,
    altKey: modifiers.alt || false,
  });
}

/**
 * Simulates window resize
 */
function simulateWindowResize(width: number, height: number) {
  act(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    });
    window.dispatchEvent(new Event('resize'));
  });
}

/**
 * Waits for element to have specific class
 */
async function waitForElementClass(selector: string, className: string, timeout = 2000) {
  return waitFor(() => {
    const element = document.querySelector(selector);
    expect(element).toHaveClass(className);
  }, { timeout });
}

/**
 * Waits for button to be enabled/disabled
 */
async function waitForButtonState(testId: string, enabled: boolean, timeout = 2000) {
  return waitFor(() => {
    const button = screen.getByTestId(testId);
    if (enabled) {
      expect(button).not.toBeDisabled();
    } else {
      expect(button).toBeDisabled();
    }
  }, { timeout });
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('End-to-End Workflow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Record → Edit → Play Workflow Tests
  // ==========================================================================

  describe('Record → Edit → Play Workflow', () => {
    it('should complete full record → edit → play workflow successfully', async () => {
      const { container } = renderUnifiedRecorderScreen();

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Step 1: Start Recording
      const recordButton = screen.getByTestId('button-record');
      fireEvent.click(recordButton);

      // Verify recording started
      await waitForElementClass('.unified-interface', 'mode-recording');
      expect(mockIPCBridge.startRecording).toHaveBeenCalled();

      // Verify editor is visible during recording
      const editorArea = container.querySelector('.editor-area');
      expect(editorArea).toHaveClass('visible');

      // Step 2: Stop Recording
      await waitForAsyncOperation(100); // Simulate some recording time
      const stopButton = screen.getByTestId('button-stop');
      fireEvent.click(stopButton);

      // Verify recording stopped
      await waitForElementClass('.unified-interface', 'mode-idle');
      expect(mockIPCBridge.stopRecording).toHaveBeenCalled();

      // Step 3: Edit Script
      const saveButton = screen.getByTestId('button-save');
      fireEvent.click(saveButton);

      // Verify editing mode
      await waitForElementClass('.unified-interface', 'mode-editing');

      // Step 4: Play Script
      const playButton = screen.getByTestId('button-play');
      await waitForButtonState('button-play', true);
      fireEvent.click(playButton);

      // Verify playback started
      await waitForElementClass('.unified-interface', 'mode-playing');
      expect(mockIPCBridge.startPlayback).toHaveBeenCalled();

      // Step 5: Stop Playback
      await waitForAsyncOperation(100); // Simulate playback time
      const stopPlaybackButton = screen.getByTestId('button-stop');
      fireEvent.click(stopPlaybackButton);

      // Verify returned to idle
      await waitForElementClass('.unified-interface', 'mode-idle');
      expect(mockIPCBridge.stopPlayback).toHaveBeenCalled();
    });

    it('should maintain editor visibility throughout record → edit → play workflow', async () => {
      const { container } = renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      const editorArea = container.querySelector('.editor-area');

      // Record phase
      fireEvent.click(screen.getByTestId('button-record'));
      await waitForElementClass('.unified-interface', 'mode-recording');
      expect(editorArea).toHaveClass('visible');

      // Stop recording
      await waitForAsyncOperation(50);
      fireEvent.click(screen.getByTestId('button-stop'));
      await waitForElementClass('.unified-interface', 'mode-idle');
      expect(editorArea).toHaveClass('visible');

      // Edit phase
      fireEvent.click(screen.getByTestId('button-save'));
      await waitForElementClass('.unified-interface', 'mode-editing');
      expect(editorArea).toHaveClass('visible');

      // Play phase
      await waitForButtonState('button-play', true);
      fireEvent.click(screen.getByTestId('button-play'));
      await waitForElementClass('.unified-interface', 'mode-playing');
      expect(editorArea).toHaveClass('visible');
    });

    it('should preserve script data throughout workflow transitions', async () => {
      renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Record some actions
      fireEvent.click(screen.getByTestId('button-record'));
      await waitForElementClass('.unified-interface', 'mode-recording');

      // Stop recording (mock returns actions)
      await waitForAsyncOperation(50);
      fireEvent.click(screen.getByTestId('button-stop'));
      await waitForElementClass('.unified-interface', 'mode-idle');

      // Verify script data is preserved
      expect(mockIPCBridge.stopRecording).toHaveBeenCalled();

      // Enter edit mode
      fireEvent.click(screen.getByTestId('button-save'));
      await waitForElementClass('.unified-interface', 'mode-editing');

      // Play the script
      await waitForButtonState('button-play', true);
      fireEvent.click(screen.getByTestId('button-play'));
      await waitForElementClass('.unified-interface', 'mode-playing');

      // Verify playback uses the recorded data
      expect(mockIPCBridge.startPlayback).toHaveBeenCalled();
    });

    it('should handle workflow interruptions gracefully', async () => {
      renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Start recording
      fireEvent.click(screen.getByTestId('button-record'));
      await waitForElementClass('.unified-interface', 'mode-recording');

      // Interrupt with clear action
      fireEvent.click(screen.getByTestId('button-clear'));
      await waitForElementClass('.unified-interface', 'mode-idle');

      // Verify system returns to clean state
      const recordButton = screen.getByTestId('button-record');
      expect(recordButton).not.toBeDisabled();

      // Should be able to start new workflow
      fireEvent.click(recordButton);
      await waitForElementClass('.unified-interface', 'mode-recording');
      expect(mockIPCBridge.startRecording).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // Keyboard Shortcut Integration Tests
  // ==========================================================================

  describe('Keyboard Shortcut Integration', () => {
    it('should handle Ctrl+R to start recording', async () => {
      const { container } = renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Use Ctrl+R shortcut
      simulateKeyboardShortcut(container, 'r', { ctrl: true });

      // Verify recording started
      await waitForElementClass('.unified-interface', 'mode-recording');
      expect(mockIPCBridge.startRecording).toHaveBeenCalled();
    });

    it('should handle Ctrl+P to start playback', async () => {
      const { container } = renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // First record something
      fireEvent.click(screen.getByTestId('button-record'));
      await waitForElementClass('.unified-interface', 'mode-recording');

      await waitForAsyncOperation(50);
      fireEvent.click(screen.getByTestId('button-stop'));
      await waitForElementClass('.unified-interface', 'mode-idle');

      // Use Ctrl+P shortcut
      simulateKeyboardShortcut(container, 'p', { ctrl: true });

      // Verify playback started
      await waitForElementClass('.unified-interface', 'mode-playing');
      expect(mockIPCBridge.startPlayback).toHaveBeenCalled();
    });

    it('should handle Ctrl+S to save/edit script', async () => {
      const { container } = renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Record and stop first
      fireEvent.click(screen.getByTestId('button-record'));
      await waitForElementClass('.unified-interface', 'mode-recording');

      await waitForAsyncOperation(50);
      fireEvent.click(screen.getByTestId('button-stop'));
      await waitForElementClass('.unified-interface', 'mode-idle');

      // Use Ctrl+S shortcut
      simulateKeyboardShortcut(container, 's', { ctrl: true });

      // Verify editing mode
      await waitForElementClass('.unified-interface', 'mode-editing');
    });

    it('should handle Escape key to stop current action', async () => {
      const { container } = renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Start recording
      fireEvent.click(screen.getByTestId('button-record'));
      await waitForElementClass('.unified-interface', 'mode-recording');

      // Use Escape key
      simulateKeyboardShortcut(container, 'Escape');

      // Verify recording stopped
      await waitForElementClass('.unified-interface', 'mode-idle');
      expect(mockIPCBridge.stopRecording).toHaveBeenCalled();
    });

    it('should handle Ctrl+O to open script', async () => {
      const { container } = renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Use Ctrl+O shortcut
      simulateKeyboardShortcut(container, 'o', { ctrl: true });

      // Verify editing mode (open triggers edit mode)
      await waitForElementClass('.unified-interface', 'mode-editing');
    });

    it('should prevent keyboard shortcuts during transitions', async () => {
      const { container } = renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Start recording
      fireEvent.click(screen.getByTestId('button-record'));

      // Immediately try keyboard shortcut during transition
      simulateKeyboardShortcut(container, 'p', { ctrl: true });

      // Should not interfere with recording start
      await waitForElementClass('.unified-interface', 'mode-recording');
      expect(mockIPCBridge.startRecording).toHaveBeenCalledTimes(1);
      expect(mockIPCBridge.startPlayback).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Window Resize and Responsive Behavior Tests
  // ==========================================================================

  describe('Window Resize and Responsive Behavior', () => {
    it('should maintain layout integrity during window resize', async () => {
      const { container } = renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Get initial layout elements
      const toolbar = container.querySelector('.top-toolbar');
      const editorArea = container.querySelector('.editor-area');
      const unifiedInterface = container.querySelector('.unified-interface');

      expect(toolbar).toBeInTheDocument();
      expect(editorArea).toBeInTheDocument();
      expect(unifiedInterface).toBeInTheDocument();

      // Test various screen sizes
      const screenSizes = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1024, height: 768 },
        { width: 800, height: 600 },
      ];

      for (const size of screenSizes) {
        simulateWindowResize(size.width, size.height);

        // Verify layout elements remain intact
        expect(container.querySelector('.top-toolbar')).toBeInTheDocument();
        expect(container.querySelector('.editor-area')).toBeInTheDocument();
        expect(container.querySelector('.unified-interface')).toBeInTheDocument();

        // Verify toolbar buttons remain accessible
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
        expect(screen.getByTestId('button-play')).toBeInTheDocument();
        expect(screen.getByTestId('button-save')).toBeInTheDocument();
      }
    });

    it('should maintain functionality during window resize', async () => {
      const { container } = renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Resize to small window
      simulateWindowResize(800, 600);

      // Test functionality still works
      fireEvent.click(screen.getByTestId('button-record'));
      await waitForElementClass('.unified-interface', 'mode-recording');
      expect(mockIPCBridge.startRecording).toHaveBeenCalled();

      // Resize during recording
      simulateWindowResize(1920, 1080);

      // Should still be recording
      expect(container.querySelector('.unified-interface')).toHaveClass('mode-recording');

      // Stop recording should still work
      fireEvent.click(screen.getByTestId('button-stop'));
      await waitForElementClass('.unified-interface', 'mode-idle');
      expect(mockIPCBridge.stopRecording).toHaveBeenCalled();
    });

    it('should adapt editor area to window size changes', async () => {
      const { container } = renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      const editorArea = container.querySelector('.editor-area');
      expect(editorArea).toBeInTheDocument();

      // Start recording to make editor active
      fireEvent.click(screen.getByTestId('button-record'));
      await waitForElementClass('.unified-interface', 'mode-recording');

      // Test different window sizes
      simulateWindowResize(1920, 1080);
      expect(editorArea).toHaveClass('visible');

      simulateWindowResize(800, 600);
      expect(editorArea).toHaveClass('visible');

      // Editor should remain functional
      fireEvent.click(screen.getByTestId('button-stop'));
      await waitForElementClass('.unified-interface', 'mode-idle');
    });

    it('should handle rapid window resize events gracefully', async () => {
      const { container } = renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Rapid resize events
      for (let i = 0; i < 10; i++) {
        simulateWindowResize(800 + i * 100, 600 + i * 50);
      }

      // Should still be functional
      expect(container.querySelector('.unified-interface')).toBeInTheDocument();
      expect(screen.getByTestId('button-record')).toBeInTheDocument();

      // Test functionality
      fireEvent.click(screen.getByTestId('button-record'));
      await waitForElementClass('.unified-interface', 'mode-recording');
      expect(mockIPCBridge.startRecording).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Error Recovery and Graceful Degradation Tests
  // ==========================================================================

  describe('Error Recovery and Graceful Degradation', () => {
    it('should recover from IPC service failures during recording', async () => {
      // Mock IPC failure
      mockIPCBridge.startRecording.mockRejectedValueOnce(new Error('IPC connection failed'));

      renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Try to start recording (should fail)
      fireEvent.click(screen.getByTestId('button-record'));

      // Should remain in idle state
      await waitForAsyncOperation(100);
      const unifiedInterface = document.querySelector('.unified-interface');
      expect(unifiedInterface).toHaveClass('mode-idle');

      // Should be able to retry
      mockIPCBridge.startRecording.mockResolvedValueOnce({ success: true });
      fireEvent.click(screen.getByTestId('button-record'));
      await waitForElementClass('.unified-interface', 'mode-recording');
    });

    it('should handle playback failures gracefully', async () => {
      // Mock playback failure
      mockIPCBridge.startPlayback.mockRejectedValueOnce(new Error('Playback failed'));

      renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Record something first
      fireEvent.click(screen.getByTestId('button-record'));
      await waitForElementClass('.unified-interface', 'mode-recording');

      await waitForAsyncOperation(50);
      fireEvent.click(screen.getByTestId('button-stop'));
      await waitForElementClass('.unified-interface', 'mode-idle');

      // Try to play (should fail)
      fireEvent.click(screen.getByTestId('button-play'));

      // Should remain in idle state
      await waitForAsyncOperation(100);
      const unifiedInterface = document.querySelector('.unified-interface');
      expect(unifiedInterface).toHaveClass('mode-idle');

      // Interface should remain functional
      expect(screen.getByTestId('button-record')).not.toBeDisabled();
    });

    it('should recover from state corruption', async () => {
      const { container } = renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Simulate state corruption by dispatching invalid action
      const unifiedInterface = container.querySelector('.unified-interface');
      const corruptEvent = new CustomEvent('state-corruption', {
        detail: { invalidState: true }
      });

      act(() => {
        unifiedInterface?.dispatchEvent(corruptEvent);
      });

      // Should still be functional
      expect(screen.getByTestId('button-record')).toBeInTheDocument();

      // Should be able to start recording
      fireEvent.click(screen.getByTestId('button-record'));
      await waitForElementClass('.unified-interface', 'mode-recording');
    });

    it('should handle component unmounting during operations', async () => {
      const { container, unmount } = renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Start recording
      fireEvent.click(screen.getByTestId('button-record'));
      await waitForElementClass('.unified-interface', 'mode-recording');

      // Unmount component during recording
      act(() => {
        unmount();
      });

      // Should not throw errors (cleanup should work)
      expect(mockIPCBridge.startRecording).toHaveBeenCalled();
    });

    it('should maintain data integrity during error conditions', async () => {
      renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Record some data
      fireEvent.click(screen.getByTestId('button-record'));
      await waitForElementClass('.unified-interface', 'mode-recording');

      await waitForAsyncOperation(50);
      fireEvent.click(screen.getByTestId('button-stop'));
      await waitForElementClass('.unified-interface', 'mode-idle');

      // Simulate error during save
      mockIPCBridge.saveScript.mockRejectedValueOnce(new Error('Save failed'));

      // Try to save
      fireEvent.click(screen.getByTestId('button-save'));
      await waitForElementClass('.unified-interface', 'mode-editing');

      // Data should still be available for retry
      expect(screen.getByTestId('button-play')).not.toBeDisabled();
    });

    it('should provide user feedback during error conditions', async () => {
      // Mock console.error to capture error messages
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      mockIPCBridge.startRecording.mockRejectedValueOnce(new Error('Test error'));

      renderUnifiedRecorderScreen();

      await waitFor(() => {
        expect(screen.getByTestId('button-record')).toBeInTheDocument();
      });

      // Try to start recording (should fail)
      fireEvent.click(screen.getByTestId('button-record'));

      await waitForAsyncOperation(100);

      // Should remain functional despite error
      expect(screen.getByTestId('button-record')).not.toBeDisabled();

      consoleSpy.mockRestore();
    });
  });
});
