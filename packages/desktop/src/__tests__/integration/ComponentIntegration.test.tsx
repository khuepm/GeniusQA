/**
 * Component Integration Unit Tests
 * Unit tests for component integration covering toolbar-editor communication,
 * state synchronization, event propagation, and layout responsiveness
 * 
 * **Feature: desktop-ui-redesign, Task 13.2: Component Integration Tests**
 * 
 * Test areas:
 * - Toolbar-editor communication
 * - State synchronization between components
 * - Event propagation and handling
 * - Layout responsiveness
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

// Mock IPC bridge service
const mockIPCBridge = {
  checkForRecordings: jest.fn().mockResolvedValue(false),
  getLatestRecording: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  startRecording: jest.fn().mockResolvedValue({}),
  stopRecording: jest.fn().mockResolvedValue({ success: true }),
  startPlayback: jest.fn().mockResolvedValue({}),
  stopPlayback: jest.fn().mockResolvedValue({}),
};

jest.mock('../../services/ipcBridgeService', () => ({
  getIPCBridge: () => mockIPCBridge,
}));

// ============================================================================
// Test Components
// ============================================================================

/**
 * Integrated test component that combines toolbar and editor
 */
const IntegratedTestComponent: React.FC<{
  onStateChange?: (state: any) => void;
  onToolbarAction?: (action: string, data?: any) => void;
  onEditorAction?: (action: string, data?: any) => void;
}> = ({ onStateChange, onToolbarAction, onEditorAction }) => {
  const { state, setMode, setEditorVisible, setRecordingSession, setPlaybackSession, setCurrentScript } = useUnifiedInterface();
  const [recordingActions, setRecordingActions] = React.useState<any[]>([]);

  // Notify parent of state changes
  React.useEffect(() => {
    if (onStateChange) {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  // Toolbar event handlers
  const handleRecordStart = () => {
    setMode('recording');
    setEditorVisible(true);
    const session = {
      isActive: true,
      startTime: Date.now(),
      actions: []
    };
    setRecordingSession(session);
    setRecordingActions([]);
    onToolbarAction?.('record-start', session);
  };

  const handleRecordStop = () => {
    setMode('idle');
    const session = { isActive: false, startTime: 0, actions: recordingActions };
    setRecordingSession(session);
    onToolbarAction?.('record-stop', session);
  };

  const handlePlayStart = () => {
    setMode('playing');
    setEditorVisible(true);
    const session = {
      isActive: true,
      currentActionIndex: 0,
      totalActions: recordingActions.length,
      isPaused: false
    };
    setPlaybackSession(session);
    onToolbarAction?.('play-start', session);
  };

  const handlePlayStop = () => {
    setMode('idle');
    setPlaybackSession(null);
    onToolbarAction?.('play-stop');
  };

  const handleSave = () => {
    setMode('editing');
    const script = {
      path: '/test/script.json',
      filename: 'test-script.json',
      actions: recordingActions
    };
    setCurrentScript(script);
    onToolbarAction?.('save', script);
  };

  const handleOpen = () => {
    setMode('editing');
    onToolbarAction?.('open');
  };

  const handleClear = () => {
    setCurrentScript(null);
    setRecordingActions([]);
    setMode('idle');
    onToolbarAction?.('clear');
  };

  // Editor event handlers
  const handleActionSelect = (action: any) => {
    onEditorAction?.('action-select', action);
  };

  const handleActionEdit = (action: any) => {
    setMode('editing');
    onEditorAction?.('action-edit', action);
  };

  const handleActionDelete = (actionId: string) => {
    const updatedActions = recordingActions.filter(a => a.id !== actionId);
    setRecordingActions(updatedActions);
    onEditorAction?.('action-delete', { actionId, updatedActions });
  };

  // Simulate adding actions during recording
  React.useEffect(() => {
    if (state.applicationMode === 'recording' && state.recordingSession?.isActive) {
      const interval = setInterval(() => {
        const newAction = {
          id: `action-${Date.now()}`,
          type: 'mouse_click',
          timestamp: Date.now(),
          data: { x: Math.floor(Math.random() * 100), y: Math.floor(Math.random() * 100) }
        };
        setRecordingActions(prev => [...prev, newAction]);
      }, 100);

      return () => clearInterval(interval);
    }
  }, [state.applicationMode, state.recordingSession?.isActive]);

  const toolbarProps = {
    hasRecordings: recordingActions.length > 0,
    onRecordStart: handleRecordStart,
    onRecordStop: handleRecordStop,
    onPlayStart: handlePlayStart,
    onPlayStop: handlePlayStop,
    onSave: handleSave,
    onOpen: handleOpen,
    onClear: handleClear,
    onSettings: () => onToolbarAction?.('settings'),
  };

  const editorProps = {
    recordingSession: state.recordingSession ? {
      ...state.recordingSession,
      actions: recordingActions
    } : null,
    onActionSelect: handleActionSelect,
    onActionEdit: handleActionEdit,
    onActionDelete: handleActionDelete,
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Renders integrated component with provider
 */
function renderIntegratedComponent(props: any = {}) {
  return render(
    <UnifiedInterfaceProvider>
      <IntegratedTestComponent {...props} />
    </UnifiedInterfaceProvider>
  );
}

/**
 * Waits for state changes to propagate
 */
async function waitForStateChange(callback: () => boolean, timeout = 1000) {
  return waitFor(callback, { timeout });
}

// ============================================================================
// Unit Tests
// ============================================================================

describe('Component Integration Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Toolbar-Editor Communication Tests
  // ==========================================================================

  describe('Toolbar-Editor Communication', () => {
    it('should communicate recording start from toolbar to editor', async () => {
      const onStateChange = jest.fn();
      const onToolbarAction = jest.fn();

      const { container } = renderIntegratedComponent({
        onStateChange,
        onToolbarAction
      });

      // Click record button
      const recordButton = screen.getByTestId('button-record');
      fireEvent.click(recordButton);

      // Wait for state changes
      await waitForStateChange(() => onStateChange.mock.calls.length > 0);

      // Verify toolbar action was triggered
      expect(onToolbarAction).toHaveBeenCalledWith('record-start', expect.objectContaining({
        isActive: true,
        actions: []
      }));

      // Verify state change occurred
      const lastStateCall = onStateChange.mock.calls[onStateChange.mock.calls.length - 1];
      expect(lastStateCall[0]).toMatchObject({
        applicationMode: 'recording',
        editorVisible: true
      });

      // Verify editor area is visible
      const editorArea = container.querySelector('.editor-area');
      expect(editorArea).toHaveClass('visible');
    });

    it('should communicate recording stop from toolbar to editor', async () => {
      const onStateChange = jest.fn();
      const onToolbarAction = jest.fn();

      renderIntegratedComponent({
        onStateChange,
        onToolbarAction
      });

      // Start recording first
      const recordButton = screen.getByTestId('button-record');
      fireEvent.click(recordButton);

      await waitForStateChange(() => onStateChange.mock.calls.length > 0);

      // Stop recording
      const stopButton = screen.getByTestId('button-stop');
      fireEvent.click(stopButton);

      await waitForStateChange(() =>
        onToolbarAction.mock.calls.some(call => call[0] === 'record-stop')
      );

      // Verify stop action was triggered
      expect(onToolbarAction).toHaveBeenCalledWith('record-stop', expect.objectContaining({
        isActive: false
      }));

      // Verify state returned to idle
      const lastStateCall = onStateChange.mock.calls[onStateChange.mock.calls.length - 1];
      expect(lastStateCall[0]).toMatchObject({
        applicationMode: 'idle'
      });
    });

    it('should communicate playback actions between toolbar and editor', async () => {
      const onStateChange = jest.fn();
      const onToolbarAction = jest.fn();

      renderIntegratedComponent({
        onStateChange,
        onToolbarAction
      });

      // First record some actions
      const recordButton = screen.getByTestId('button-record');
      fireEvent.click(recordButton);

      await waitForStateChange(() => onStateChange.mock.calls.length > 0);

      // Wait for some actions to be recorded
      await new Promise(resolve => setTimeout(resolve, 250));

      // Stop recording
      const stopButton = screen.getByTestId('button-stop');
      fireEvent.click(stopButton);

      await waitForStateChange(() =>
        onToolbarAction.mock.calls.some(call => call[0] === 'record-stop')
      );

      // Start playback
      const playButton = screen.getByTestId('button-play');
      fireEvent.click(playButton);

      await waitForStateChange(() =>
        onToolbarAction.mock.calls.some(call => call[0] === 'play-start')
      );

      // Verify playback action was triggered
      expect(onToolbarAction).toHaveBeenCalledWith('play-start', expect.objectContaining({
        isActive: true,
        currentActionIndex: 0
      }));

      // Verify state changed to playing
      const lastStateCall = onStateChange.mock.calls[onStateChange.mock.calls.length - 1];
      expect(lastStateCall[0]).toMatchObject({
        applicationMode: 'playing',
        editorVisible: true
      });
    });

    it('should communicate editor actions back to toolbar state', async () => {
      const onStateChange = jest.fn();
      const onEditorAction = jest.fn();

      renderIntegratedComponent({
        onStateChange,
        onEditorAction
      });

      // Start recording to get some actions
      const recordButton = screen.getByTestId('button-record');
      fireEvent.click(recordButton);

      await waitForStateChange(() => onStateChange.mock.calls.length > 0);

      // Wait for actions to be recorded
      await new Promise(resolve => setTimeout(resolve, 250));

      // Stop recording
      const stopButton = screen.getByTestId('button-stop');
      fireEvent.click(stopButton);

      await waitForStateChange(() => onStateChange.mock.calls.length > 1);

      // Simulate editor action (action edit)
      const saveButton = screen.getByTestId('button-save');
      fireEvent.click(saveButton);

      await waitForStateChange(() =>
        onEditorAction.mock.calls.length > 0 ||
        onStateChange.mock.calls.some(call => call[0].applicationMode === 'editing')
      );

      // Verify state changed to editing mode
      const lastStateCall = onStateChange.mock.calls[onStateChange.mock.calls.length - 1];
      expect(lastStateCall[0]).toMatchObject({
        applicationMode: 'editing'
      });
    });
  });

  // ==========================================================================
  // State Synchronization Tests
  // ==========================================================================

  describe('State Synchronization Between Components', () => {
    it('should synchronize application mode across toolbar and editor', async () => {
      const onStateChange = jest.fn();

      const { container } = renderIntegratedComponent({ onStateChange });

      const modes = ['recording', 'playing', 'editing', 'idle'];
      const buttons = {
        recording: 'button-record',
        playing: 'button-play',
        editing: 'button-save',
        idle: 'button-clear'
      };

      for (const mode of modes) {
        if (mode === 'playing') {
          // Need to record first for play to work
          fireEvent.click(screen.getByTestId('button-record'));
          await new Promise(resolve => setTimeout(resolve, 100));
          fireEvent.click(screen.getByTestId('button-stop'));
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const button = screen.getByTestId(buttons[mode as keyof typeof buttons]);
        fireEvent.click(button);

        await waitForStateChange(() =>
          onStateChange.mock.calls.some(call =>
            call[0].applicationMode === mode ||
            (mode === 'idle' && call[0].applicationMode === 'idle')
          )
        );

        // Verify both toolbar and editor reflect the same state
        const unifiedInterface = container.querySelector('.unified-interface');
        expect(unifiedInterface).toHaveClass(`mode-${mode === 'idle' ? 'idle' : mode}`);
      }
    });

    it('should synchronize editor visibility state', async () => {
      const onStateChange = jest.fn();

      const { container } = renderIntegratedComponent({ onStateChange });

      // Start recording (should make editor visible)
      const recordButton = screen.getByTestId('button-record');
      fireEvent.click(recordButton);

      await waitForStateChange(() => onStateChange.mock.calls.length > 0);

      // Verify editor is visible
      const editorArea = container.querySelector('.editor-area');
      expect(editorArea).toHaveClass('visible');

      // Verify state reflects editor visibility
      const lastStateCall = onStateChange.mock.calls[onStateChange.mock.calls.length - 1];
      expect(lastStateCall[0].editorVisible).toBe(true);
    });

    it('should synchronize recording session data between components', async () => {
      const onStateChange = jest.fn();
      const onToolbarAction = jest.fn();

      renderIntegratedComponent({
        onStateChange,
        onToolbarAction
      });

      // Start recording
      const recordButton = screen.getByTestId('button-record');
      fireEvent.click(recordButton);

      await waitForStateChange(() => onToolbarAction.mock.calls.length > 0);

      // Verify recording session is synchronized
      const recordingCall = onToolbarAction.mock.calls.find(call => call[0] === 'record-start');
      expect(recordingCall).toBeDefined();
      expect(recordingCall[1]).toMatchObject({
        isActive: true,
        actions: []
      });

      // Wait for some actions to be recorded
      await new Promise(resolve => setTimeout(resolve, 250));

      // Stop recording
      const stopButton = screen.getByTestId('button-stop');
      fireEvent.click(stopButton);

      await waitForStateChange(() =>
        onToolbarAction.mock.calls.some(call => call[0] === 'record-stop')
      );

      // Verify session data is synchronized on stop
      const stopCall = onToolbarAction.mock.calls.find(call => call[0] === 'record-stop');
      expect(stopCall).toBeDefined();
      expect(stopCall[1]).toMatchObject({
        isActive: false,
        actions: expect.arrayContaining([
          expect.objectContaining({
            type: 'mouse_click',
            timestamp: expect.any(Number)
          })
        ])
      });
    });

    it('should maintain state consistency during rapid mode changes', async () => {
      const onStateChange = jest.fn();

      renderIntegratedComponent({ onStateChange });

      // Perform rapid mode changes
      const recordButton = screen.getByTestId('button-record');
      const stopButton = screen.getByTestId('button-stop');
      const saveButton = screen.getByTestId('button-save');

      // Rapid sequence: record -> stop -> edit -> clear
      fireEvent.click(recordButton);
      await new Promise(resolve => setTimeout(resolve, 50));

      fireEvent.click(stopButton);
      await new Promise(resolve => setTimeout(resolve, 50));

      fireEvent.click(saveButton);
      await new Promise(resolve => setTimeout(resolve, 50));

      const clearButton = screen.getByTestId('button-clear');
      fireEvent.click(clearButton);

      await waitForStateChange(() => onStateChange.mock.calls.length >= 4);

      // Verify final state is consistent
      const finalState = onStateChange.mock.calls[onStateChange.mock.calls.length - 1][0];
      expect(finalState.applicationMode).toBe('idle');
      expect(finalState.currentScript).toBeNull();
    });
  });

  // ==========================================================================
  // Event Propagation and Handling Tests
  // ==========================================================================

  describe('Event Propagation and Handling', () => {
    it('should properly propagate keyboard events from toolbar to editor', async () => {
      const onStateChange = jest.fn();

      const { container } = renderIntegratedComponent({ onStateChange });

      // Start recording
      const recordButton = screen.getByTestId('button-record');
      fireEvent.click(recordButton);

      await waitForStateChange(() => onStateChange.mock.calls.length > 0);

      // Simulate keyboard shortcut (Ctrl+S for save)
      fireEvent.keyDown(container, { key: 's', ctrlKey: true });

      await waitForStateChange(() =>
        onStateChange.mock.calls.some(call => call[0].applicationMode === 'editing')
      );

      // Verify keyboard event was handled and state changed
      const finalState = onStateChange.mock.calls[onStateChange.mock.calls.length - 1][0];
      expect(finalState.applicationMode).toBe('editing');
    });

    it('should handle mouse events and clicks properly across components', async () => {
      const onToolbarAction = jest.fn();
      const onEditorAction = jest.fn();

      renderIntegratedComponent({
        onToolbarAction,
        onEditorAction
      });

      // Click toolbar button
      const recordButton = screen.getByTestId('button-record');
      fireEvent.click(recordButton);

      await waitForStateChange(() => onToolbarAction.mock.calls.length > 0);

      // Verify toolbar click was handled
      expect(onToolbarAction).toHaveBeenCalledWith('record-start', expect.any(Object));

      // Wait for actions to be recorded
      await new Promise(resolve => setTimeout(resolve, 200));

      // Stop recording
      const stopButton = screen.getByTestId('button-stop');
      fireEvent.click(stopButton);

      await waitForStateChange(() =>
        onToolbarAction.mock.calls.some(call => call[0] === 'record-stop')
      );

      // Verify all mouse events were properly handled
      expect(onToolbarAction).toHaveBeenCalledWith('record-stop', expect.any(Object));
    });

    it('should prevent event conflicts between toolbar and editor', async () => {
      const onStateChange = jest.fn();
      const onToolbarAction = jest.fn();
      const onEditorAction = jest.fn();

      renderIntegratedComponent({
        onStateChange,
        onToolbarAction,
        onEditorAction
      });

      // Start recording
      const recordButton = screen.getByTestId('button-record');
      fireEvent.click(recordButton);

      await waitForStateChange(() => onToolbarAction.mock.calls.length > 0);

      // Simulate simultaneous events (should not conflict)
      const saveButton = screen.getByTestId('button-save');

      // Click save while recording (should handle gracefully)
      fireEvent.click(saveButton);

      await waitForStateChange(() => onStateChange.mock.calls.length > 1);

      // Verify no conflicts occurred and state is consistent
      const finalState = onStateChange.mock.calls[onStateChange.mock.calls.length - 1][0];
      expect(['recording', 'editing']).toContain(finalState.applicationMode);
    });

    it('should handle custom events between components', async () => {
      const onStateChange = jest.fn();

      const { container } = renderIntegratedComponent({ onStateChange });

      // Dispatch custom event
      const customEvent = new CustomEvent('mode-change', {
        detail: { fromMode: 'idle', toMode: 'recording' }
      });

      act(() => {
        container.dispatchEvent(customEvent);
      });

      // Custom events should not interfere with normal operation
      const recordButton = screen.getByTestId('button-record');
      fireEvent.click(recordButton);

      await waitForStateChange(() => onStateChange.mock.calls.length > 0);

      // Verify normal operation continues after custom event
      const finalState = onStateChange.mock.calls[onStateChange.mock.calls.length - 1][0];
      expect(finalState.applicationMode).toBe('recording');
    });
  });

  // ==========================================================================
  // Layout Responsiveness Tests
  // ==========================================================================

  describe('Layout Responsiveness', () => {
    it('should maintain component layout during window resize', async () => {
      const { container } = renderIntegratedComponent();

      // Get initial layout
      const initialToolbar = container.querySelector('.top-toolbar');
      const initialEditor = container.querySelector('.editor-area-container');

      expect(initialToolbar).toBeInTheDocument();
      expect(initialEditor).toBeInTheDocument();

      // Simulate window resize
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 800,
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 600,
        });
        window.dispatchEvent(new Event('resize'));
      });

      // Verify layout is maintained after resize
      const resizedToolbar = container.querySelector('.top-toolbar');
      const resizedEditor = container.querySelector('.editor-area-container');

      expect(resizedToolbar).toBeInTheDocument();
      expect(resizedEditor).toBeInTheDocument();

      // Verify components are still in correct order
      const unifiedInterface = container.querySelector('.unified-interface');
      const children = Array.from(unifiedInterface?.children || []);
      const toolbarIndex = children.findIndex(child => child.classList.contains('toolbar-area'));
      const editorIndex = children.findIndex(child => child.classList.contains('editor-area'));

      expect(toolbarIndex).toBeLessThan(editorIndex);
    });

    it('should adapt component sizes based on content', async () => {
      const onStateChange = jest.fn();

      const { container } = renderIntegratedComponent({ onStateChange });

      // Start recording to generate content
      const recordButton = screen.getByTestId('button-record');
      fireEvent.click(recordButton);

      await waitForStateChange(() => onStateChange.mock.calls.length > 0);

      // Wait for multiple actions to be recorded
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify editor area adapts to content
      const editorArea = container.querySelector('.editor-area');
      expect(editorArea).toBeInTheDocument();

      // Stop recording
      const stopButton = screen.getByTestId('button-stop');
      fireEvent.click(stopButton);

      await waitForStateChange(() => onStateChange.mock.calls.length > 1);

      // Verify layout remains responsive after content changes
      expect(editorArea).toBeInTheDocument();
      expect(editorArea).toHaveClass('visible');
    });

    it('should handle component visibility changes responsively', async () => {
      const onStateChange = jest.fn();

      const { container } = renderIntegratedComponent({ onStateChange });

      // Initially editor should be visible
      let editorArea = container.querySelector('.editor-area');
      expect(editorArea).toHaveClass('visible');

      // Start recording (editor should remain visible)
      const recordButton = screen.getByTestId('button-record');
      fireEvent.click(recordButton);

      await waitForStateChange(() => onStateChange.mock.calls.length > 0);

      // Verify editor visibility is maintained
      editorArea = container.querySelector('.editor-area');
      expect(editorArea).toHaveClass('visible');

      // Verify toolbar remains accessible
      const toolbar = container.querySelector('.top-toolbar');
      expect(toolbar).toBeInTheDocument();
    });

    it('should maintain responsive behavior across different screen sizes', async () => {
      const { container } = renderIntegratedComponent();

      const screenSizes = [
        { width: 1920, height: 1080 }, // Desktop
        { width: 1366, height: 768 },  // Laptop
        { width: 1024, height: 768 },  // Tablet landscape
        { width: 800, height: 600 },   // Small window
      ];

      for (const size of screenSizes) {
        act(() => {
          Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: size.width,
          });
          Object.defineProperty(window, 'innerHeight', {
            writable: true,
            configurable: true,
            value: size.height,
          });
          window.dispatchEvent(new Event('resize'));
        });

        // Verify components remain accessible at each size
        const toolbar = container.querySelector('.top-toolbar');
        const editorArea = container.querySelector('.editor-area');
        const unifiedInterface = container.querySelector('.unified-interface');

        expect(toolbar).toBeInTheDocument();
        expect(editorArea).toBeInTheDocument();
        expect(unifiedInterface).toBeInTheDocument();

        // Verify layout structure is maintained
        const children = Array.from(unifiedInterface?.children || []);
        const toolbarIndex = children.findIndex(child => child.classList.contains('toolbar-area'));
        const editorIndex = children.findIndex(child => child.classList.contains('editor-area'));

        expect(toolbarIndex).toBeLessThan(editorIndex);
      }
    });
  });
});
