/**
 * Unified Interface Consistency Property-Based Tests
 * Property-based tests for unified interface consistency using fast-check
 * 
 * **Feature: desktop-ui-redesign, Property 1: Unified interface consistency**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 * 
 * Requirements tested:
 * - 1.1: System displays single unified interface containing both recording controls and editor area
 * - 1.2: System remains on same unified interface during recording/playback actions
 * - 1.3: Editor area shows directly below toolbar without additional navigation
 * - 1.4: System maintains unified layout when switching between recording and editing modes
 * - 1.5: System updates interface elements without changing overall layout structure
 */

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { UnifiedInterface, UnifiedInterfaceProvider, useUnifiedInterface } from '../../components/UnifiedInterface';
import { TopToolbar } from '../../components/TopToolbar';
import { EditorArea } from '../../components/EditorArea';

// Mock CSS imports
jest.mock('../../components/UnifiedInterface.css', () => ({}));
jest.mock('../../components/TopToolbar.css', () => ({}));
jest.mock('../../components/EditorArea.css', () => ({}));

// Mock IPC bridge service
jest.mock('../../services/ipcBridgeService', () => ({
  getIPCBridge: () => ({
    checkForRecordings: jest.fn().mockResolvedValue(false),
    getLatestRecording: jest.fn().mockResolvedValue(null),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    startRecording: jest.fn().mockResolvedValue({}),
    stopRecording: jest.fn().mockResolvedValue({ success: true }),
    startPlayback: jest.fn().mockResolvedValue({}),
    stopPlayback: jest.fn().mockResolvedValue({}),
  }),
}));

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Arbitrary for application modes
 */
const applicationModeArb = fc.constantFrom('idle', 'recording', 'playing', 'editing');

/**
 * Arbitrary for application state configurations
 */
const applicationStateArb = fc.record({
  applicationMode: applicationModeArb,
  hasRecordings: fc.boolean(),
  editorVisible: fc.boolean(),
  toolbarCollapsed: fc.boolean(),
  currentScript: fc.option(fc.record({
    path: fc.string({ minLength: 1, maxLength: 100 }),
    filename: fc.string({ minLength: 1, maxLength: 50 }),
    actions: fc.array(fc.record({
      id: fc.string({ minLength: 1, maxLength: 20 }),
      type: fc.constantFrom('mouse_click', 'mouse_move', 'key_press', 'delay'),
      timestamp: fc.float({ min: 0, max: 10000 }),
    }), { minLength: 0, maxLength: 10 })
  }), { nil: null }),
});

/**
 * Arbitrary for recording session data
 */
const recordingSessionArb = fc.option(fc.record({
  isActive: fc.boolean(),
  startTime: fc.integer({ min: 0, max: Date.now() }),
  actions: fc.array(fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    type: fc.constantFrom('mouse_click', 'mouse_move', 'key_press', 'delay'),
    timestamp: fc.float({ min: 0, max: 10000 }),
  }), { minLength: 0, maxLength: 5 })
}), { nil: null });

/**
 * Arbitrary for playback session data
 */
const playbackSessionArb = fc.option(fc.record({
  isActive: fc.boolean(),
  currentActionIndex: fc.integer({ min: 0, max: 10 }),
  totalActions: fc.integer({ min: 0, max: 10 }),
  isPaused: fc.boolean(),
}), { nil: null });

// ============================================================================
// Test Components
// ============================================================================

/**
 * Test component that uses unified interface context and renders complete interface
 */
const TestUnifiedInterfaceComponent: React.FC<{
  initialState?: Partial<any>;
  onStateChange?: (state: any) => void;
}> = ({ initialState = {}, onStateChange }) => {
  const { state, setMode, setEditorVisible, setToolbarCollapsed, setCurrentScript, setRecordingSession, setPlaybackSession } = useUnifiedInterface();

  // Apply initial state on mount
  React.useEffect(() => {
    if (initialState.applicationMode) setMode(initialState.applicationMode);
    if (typeof initialState.editorVisible === 'boolean') setEditorVisible(initialState.editorVisible);
    if (typeof initialState.toolbarCollapsed === 'boolean') setToolbarCollapsed(initialState.toolbarCollapsed);
    if (initialState.currentScript !== undefined) setCurrentScript(initialState.currentScript);
    if (initialState.recordingSession !== undefined) setRecordingSession(initialState.recordingSession);
    if (initialState.playbackSession !== undefined) setPlaybackSession(initialState.playbackSession);
  }, []);

  // Notify parent of state changes
  React.useEffect(() => {
    if (onStateChange) {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const toolbarProps = {
    hasRecordings: initialState.hasRecordings || false,
    onRecordStart: () => {
      setMode('recording');
      setEditorVisible(true);
      setRecordingSession({
        isActive: true,
        startTime: Date.now(),
        actions: []
      });
    },
    onRecordStop: () => {
      setMode('idle');
      setRecordingSession(null);
    },
    onPlayStart: () => {
      setMode('playing');
      setEditorVisible(true);
      setPlaybackSession({
        isActive: true,
        currentActionIndex: 0,
        totalActions: state.currentScript?.actions?.length || 0,
        isPaused: false
      });
    },
    onPlayStop: () => {
      setMode('idle');
      setPlaybackSession(null);
    },
    onSave: () => setMode('editing'),
    onOpen: () => setMode('editing'),
    onClear: () => {
      setCurrentScript(null);
      setMode('idle');
    },
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Renders complete unified interface with provider
 */
function renderUnifiedInterface(initialState: any = {}) {
  return render(
    <UnifiedInterfaceProvider>
      <TestUnifiedInterfaceComponent initialState={initialState} />
    </UnifiedInterfaceProvider>
  );
}

/**
 * Validates that unified interface structure is present and correct
 */
function validateUnifiedInterfaceStructure(container: HTMLElement): boolean {
  // Should have unified interface container
  const unifiedInterface = container.querySelector('.unified-interface');
  if (!unifiedInterface) return false;

  // Should have toolbar area as first child
  const toolbarArea = unifiedInterface.querySelector('.toolbar-area');
  if (!toolbarArea) return false;

  // Should have editor area
  const editorArea = unifiedInterface.querySelector('.editor-area');
  if (!editorArea) return false;

  // Toolbar should be positioned before editor in DOM order
  const children = Array.from(unifiedInterface.children);
  const toolbarIndex = children.findIndex(child => child.classList.contains('toolbar-area'));
  const editorIndex = children.findIndex(child => child.classList.contains('editor-area'));

  if (toolbarIndex === -1 || editorIndex === -1) return false;
  if (toolbarIndex >= editorIndex) return false;

  return true;
}

/**
 * Validates that both toolbar and editor are present and accessible
 */
function validateToolbarAndEditorPresence(container: HTMLElement): boolean {
  // Should have toolbar component
  const toolbar = container.querySelector('.top-toolbar');
  if (!toolbar) return false;

  // Should have editor area container
  const editorContainer = container.querySelector('.editor-area-container') ||
    container.querySelector('[data-testid="editor-area-container"]');
  if (!editorContainer) return false;

  // Toolbar should contain action buttons
  const toolbarButtons = toolbar.querySelectorAll('.toolbar-button');
  if (toolbarButtons.length === 0) return false;

  return true;
}

/**
 * Validates layout consistency across different states
 */
function validateLayoutConsistency(container: HTMLElement, previousLayout?: any): boolean {
  const unifiedInterface = container.querySelector('.unified-interface');
  if (!unifiedInterface) return false;

  const currentLayout = {
    hasUnifiedInterface: !!unifiedInterface,
    hasToolbarArea: !!unifiedInterface.querySelector('.toolbar-area'),
    hasEditorArea: !!unifiedInterface.querySelector('.editor-area'),
    childrenCount: unifiedInterface.children.length,
    toolbarPosition: Array.from(unifiedInterface.children).findIndex(child =>
      child.classList.contains('toolbar-area')),
    editorPosition: Array.from(unifiedInterface.children).findIndex(child =>
      child.classList.contains('editor-area')),
  };

  // If we have a previous layout, ensure structure hasn't changed
  if (previousLayout) {
    return (
      currentLayout.hasUnifiedInterface === previousLayout.hasUnifiedInterface &&
      currentLayout.hasToolbarArea === previousLayout.hasToolbarArea &&
      currentLayout.hasEditorArea === previousLayout.hasEditorArea &&
      currentLayout.toolbarPosition === previousLayout.toolbarPosition &&
      currentLayout.editorPosition === previousLayout.editorPosition
    );
  }

  return currentLayout.hasUnifiedInterface &&
    currentLayout.hasToolbarArea &&
    currentLayout.hasEditorArea &&
    currentLayout.toolbarPosition < currentLayout.editorPosition;
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Unified Interface Consistency Property Tests', () => {
  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // Property 1: Unified interface consistency
  // ==========================================================================

  /**
   * **Feature: desktop-ui-redesign, Property 1: Unified interface consistency**
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
   * 
   * For any application state, the unified interface should:
   * - Always display both recording controls and editor area in single interface
   * - Maintain the same interface during all operations
   * - Show editor directly below toolbar
   * - Preserve layout structure across mode changes
   */
  describe('Property 1: Unified interface consistency', () => {

    // Requirement 1.1: System displays single unified interface containing both recording controls and editor area
    it('always displays single unified interface with both toolbar and editor area', () => {
      fc.assert(
        fc.property(applicationStateArb, (state) => {
          const { container } = renderUnifiedInterface(state);

          // Should have unified interface structure
          if (!validateUnifiedInterfaceStructure(container)) return false;

          // Should have both toolbar and editor present
          if (!validateToolbarAndEditorPresence(container)) return false;

          // Should be a single interface (no multiple screens)
          const unifiedInterfaces = container.querySelectorAll('.unified-interface');
          if (unifiedInterfaces.length !== 1) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    // Requirement 1.2: System remains on same unified interface during recording/playback actions
    it('maintains same interface during recording and playback state transitions', () => {
      fc.assert(
        fc.property(applicationModeArb, fc.boolean(), (initialMode, hasRecordings) => {
          const { container } = renderUnifiedInterface({
            applicationMode: initialMode,
            hasRecordings,
            editorVisible: true
          });

          // Capture initial layout
          const initialLayout = {
            hasUnifiedInterface: !!container.querySelector('.unified-interface'),
            hasToolbarArea: !!container.querySelector('.toolbar-area'),
            hasEditorArea: !!container.querySelector('.editor-area'),
          };

          // Simulate state transitions by clicking buttons
          const recordButton = container.querySelector('[data-testid="button-record"]');
          const playButton = container.querySelector('[data-testid="button-play"]');
          const stopButton = container.querySelector('[data-testid="button-stop"]');

          // Test recording transition
          if (recordButton && initialMode === 'idle') {
            fireEvent.click(recordButton);

            // Should maintain same interface structure
            const layoutAfterRecord = {
              hasUnifiedInterface: !!container.querySelector('.unified-interface'),
              hasToolbarArea: !!container.querySelector('.toolbar-area'),
              hasEditorArea: !!container.querySelector('.editor-area'),
            };

            if (!validateLayoutConsistency(container, initialLayout)) return false;
          }

          // Test playback transition (if has recordings)
          if (playButton && hasRecordings && initialMode === 'idle') {
            fireEvent.click(playButton);

            // Should maintain same interface structure
            if (!validateLayoutConsistency(container, initialLayout)) return false;
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    // Requirement 1.3: Editor area shows directly below toolbar without additional navigation
    it('editor area is always positioned directly below toolbar', () => {
      fc.assert(
        fc.property(applicationStateArb, (state) => {
          const { container } = renderUnifiedInterface(state);

          const unifiedInterface = container.querySelector('.unified-interface');
          if (!unifiedInterface) return false;

          const toolbarArea = unifiedInterface.querySelector('.toolbar-area');
          const editorArea = unifiedInterface.querySelector('.editor-area');

          if (!toolbarArea || !editorArea) return false;

          // Check DOM order - toolbar should come before editor
          const children = Array.from(unifiedInterface.children);
          const toolbarIndex = children.indexOf(toolbarArea);
          const editorIndex = children.indexOf(editorArea);

          if (toolbarIndex === -1 || editorIndex === -1) return false;
          if (toolbarIndex >= editorIndex) return false;

          // Should be adjacent or have minimal elements between
          const elementsBetween = editorIndex - toolbarIndex - 1;
          if (elementsBetween > 1) return false; // Allow for one spacer element max

          return true;
        }),
        { numRuns: 100 }
      );
    });

    // Requirement 1.4: System maintains unified layout when switching between recording and editing modes
    it('maintains unified layout structure across all mode transitions', () => {
      const modes = ['idle', 'recording', 'playing', 'editing'] as const;

      fc.assert(
        fc.property(
          fc.constantFrom(...modes),
          fc.constantFrom(...modes),
          fc.boolean(),
          (fromMode, toMode, editorVisible) => {
            // Skip same mode transitions
            if (fromMode === toMode) return true;

            const { container } = renderUnifiedInterface({
              applicationMode: fromMode,
              editorVisible,
              hasRecordings: true
            });

            // Capture layout before transition
            const layoutBefore = validateLayoutConsistency(container);
            if (!layoutBefore) return false;

            // Simulate mode transition through state management
            const unifiedInterface = container.querySelector('.unified-interface');
            if (!unifiedInterface) return false;

            // Trigger mode change by simulating button clicks or state updates
            // This tests the layout preservation during transitions
            const modeChangeEvent = new CustomEvent('mode-change', {
              detail: { fromMode, toMode }
            });
            unifiedInterface.dispatchEvent(modeChangeEvent);

            // Validate layout after transition
            const layoutAfter = validateLayoutConsistency(container);
            if (!layoutAfter) return false;

            // Ensure both toolbar and editor remain present
            if (!validateToolbarAndEditorPresence(container)) return false;

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Requirement 1.5: System updates interface elements without changing overall layout structure
    it('updates interface elements while preserving overall layout structure', () => {
      fc.assert(
        fc.property(
          applicationStateArb,
          recordingSessionArb,
          playbackSessionArb,
          (state, recordingSession, playbackSession) => {
            const { container } = renderUnifiedInterface({
              ...state,
              recordingSession,
              playbackSession
            });

            // Capture initial structure
            const initialStructure = {
              unifiedInterfaceExists: !!container.querySelector('.unified-interface'),
              toolbarAreaExists: !!container.querySelector('.toolbar-area'),
              editorAreaExists: !!container.querySelector('.editor-area'),
              toolbarExists: !!container.querySelector('.top-toolbar'),
              editorContainerExists: !!container.querySelector('.editor-area-container'),
            };

            // All core elements should exist
            if (!Object.values(initialStructure).every(Boolean)) return false;

            // Simulate dynamic updates (like new actions being added)
            if (recordingSession?.actions) {
              recordingSession.actions.forEach((action, index) => {
                // Simulate action being added to the interface
                const actionEvent = new CustomEvent('action-added', {
                  detail: { action, index }
                });
                container.dispatchEvent(actionEvent);
              });
            }

            // Verify structure remains intact after updates
            const updatedStructure = {
              unifiedInterfaceExists: !!container.querySelector('.unified-interface'),
              toolbarAreaExists: !!container.querySelector('.toolbar-area'),
              editorAreaExists: !!container.querySelector('.editor-area'),
              toolbarExists: !!container.querySelector('.top-toolbar'),
              editorContainerExists: !!container.querySelector('.editor-area-container'),
            };

            // Structure should remain unchanged
            return JSON.stringify(initialStructure) === JSON.stringify(updatedStructure);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Additional validation: Interface consistency across visibility states
    it('maintains interface consistency regardless of editor visibility state', () => {
      fc.assert(
        fc.property(
          applicationModeArb,
          fc.boolean(),
          fc.boolean(),
          (mode, editorVisible, toolbarCollapsed) => {
            const { container } = renderUnifiedInterface({
              applicationMode: mode,
              editorVisible,
              toolbarCollapsed
            });

            // Should always have unified interface container
            const unifiedInterface = container.querySelector('.unified-interface');
            if (!unifiedInterface) return false;

            // Should always have toolbar area
            const toolbarArea = container.querySelector('.toolbar-area');
            if (!toolbarArea) return false;

            // Should always have editor area (even if hidden)
            const editorArea = container.querySelector('.editor-area');
            if (!editorArea) return false;

            // Toolbar should always be present
            const toolbar = container.querySelector('.top-toolbar');
            if (!toolbar) return false;

            // CSS classes should reflect state correctly
            if (editorVisible && editorArea.classList.contains('hidden')) return false;
            if (!editorVisible && editorArea.classList.contains('visible')) return false;

            if (toolbarCollapsed && !unifiedInterface.classList.contains('toolbar-collapsed')) return false;
            if (!toolbarCollapsed && unifiedInterface.classList.contains('toolbar-collapsed')) return false;

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Comprehensive layout validation
    it('maintains comprehensive layout integrity across all possible states', () => {
      fc.assert(
        fc.property(applicationStateArb, (state) => {
          const { container } = renderUnifiedInterface(state);

          // Core structure validation
          if (!validateUnifiedInterfaceStructure(container)) return false;
          if (!validateToolbarAndEditorPresence(container)) return false;
          if (!validateLayoutConsistency(container)) return false;

          // Verify CSS class consistency
          const unifiedInterface = container.querySelector('.unified-interface');
          if (!unifiedInterface) return false;

          // Should have mode-specific class
          const hasValidModeClass = unifiedInterface.classList.contains(`mode-${state.applicationMode}`);
          if (!hasValidModeClass) return false;

          // Should have correct visibility classes
          const editorArea = container.querySelector('.editor-area');
          if (!editorArea) return false;

          const hasCorrectVisibilityClass = state.editorVisible ?
            editorArea.classList.contains('visible') || !editorArea.classList.contains('hidden') :
            editorArea.classList.contains('hidden') || !editorArea.classList.contains('visible');

          if (!hasCorrectVisibilityClass) return false;

          // Verify data attributes for testing
          if (!unifiedInterface.hasAttribute('data-testid')) return false;
          if (unifiedInterface.getAttribute('data-testid') !== 'unified-interface') return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
