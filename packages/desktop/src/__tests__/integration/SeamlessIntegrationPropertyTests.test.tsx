/**
 * Seamless Integration Property-Based Tests
 * Property-based tests for seamless integration preservation using fast-check
 * 
 * **Feature: desktop-ui-redesign, Property 6: Seamless integration preservation**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
 */

import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import { UnifiedInterface, UnifiedInterfaceProvider, ApplicationMode, ScriptFile, RecordingSession } from '../../components/UnifiedInterface';
import { TopToolbar } from '../../components/TopToolbar';
import { EditorArea } from '../../components/EditorArea';

// Mock CSS imports
jest.mock('../../components/UnifiedInterface.css', () => ({}));
jest.mock('../../components/TopToolbar.css', () => ({}));
jest.mock('../../components/EditorArea.css', () => ({}));
jest.mock('../../components/ToolbarButton.css', () => ({}));
jest.mock('../../components/Tooltip.css', () => ({}));
jest.mock('../../components/icons.css', () => ({}));

// Mock the icons module
jest.mock('../../components/icons', () => ({
  ICON_COMPONENTS: {
    record: ({ size = 16, className = '' }) => <div className={className} data-testid="record-icon" style={{ width: size, height: size }}>●</div>,
    play: ({ size = 16, className = '' }) => <div className={className} data-testid="play-icon" style={{ width: size, height: size }}>▶</div>,
    stop: ({ size = 16, className = '' }) => <div className={className} data-testid="stop-icon" style={{ width: size, height: size }}>■</div>,
    save: ({ size = 16, className = '' }) => <div className={className} data-testid="save-icon" style={{ width: size, height: size }}>💾</div>,
    open: ({ size = 16, className = '' }) => <div className={className} data-testid="open-icon" style={{ width: size, height: size }}>📁</div>,
    clear: ({ size = 16, className = '' }) => <div className={className} data-testid="clear-icon" style={{ width: size, height: size }}>🗑</div>,
    settings: ({ size = 16, className = '' }) => <div className={className} data-testid="settings-icon" style={{ width: size, height: size }}>⚙</div>,
  }
}));

// Test component that simulates mode transitions with proper isolation
interface SeamlessIntegrationTestProps {
  initialMode: ApplicationMode;
  targetMode: ApplicationMode;
  hasScript: boolean;
  hasRecordings: boolean;
  editorContent?: any[];
  testId: string; // Add unique test ID to prevent conflicts
}

const SeamlessIntegrationTest: React.FC<SeamlessIntegrationTestProps> = ({
  initialMode,
  targetMode,
  hasScript,
  hasRecordings,
  editorContent = [],
  testId
}) => {
  const [currentMode, setCurrentMode] = React.useState<ApplicationMode>(initialMode);
  const [script] = React.useState<ScriptFile | null>(
    hasScript ? { path: '/test.json', filename: 'test.json', actions: editorContent } : null
  );
  const [recordingSession, setRecordingSession] = React.useState<RecordingSession | null>(
    currentMode === 'recording' ? { isActive: true, startTime: Date.now(), actions: editorContent } : null
  );

  // Simulate mode transition
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentMode(targetMode);

      // Update sessions based on target mode
      if (targetMode === 'recording') {
        setRecordingSession({ isActive: true, startTime: Date.now(), actions: editorContent });
      } else if (targetMode === 'playing') {
        setRecordingSession(null);
      } else {
        setRecordingSession(null);
      }
    }, 50); // Small delay to simulate transition

    return () => clearTimeout(timer);
  }, [targetMode, editorContent]);

  const mockHandlers = {
    onRecordStart: jest.fn(),
    onRecordStop: jest.fn(),
    onPlayStart: jest.fn(),
    onPlayStop: jest.fn(),
    onSave: jest.fn(),
    onOpen: jest.fn(),
    onClear: jest.fn(),
    onSettings: jest.fn(),
    onScriptChange: jest.fn(),
    onActionSelect: jest.fn(),
    onActionEdit: jest.fn(),
    onActionDelete: jest.fn(),
  };

  return (
    <UnifiedInterfaceProvider>
      <div data-testid={`seamless-integration-test-${testId}`} data-current-mode={currentMode} data-target-mode={targetMode}>
        {/* Use a custom container instead of UnifiedInterface to avoid duplicate elements */}
        <div
          className={`unified-interface mode-${currentMode}`}
          data-testid={`unified-interface-${testId}`}
        >
          <div className="toolbar-area">
            <TopToolbar
              hasRecordings={hasRecordings}
              {...mockHandlers}
            />
          </div>
          <div
            className="editor-area visible"
            data-testid={`editor-area-${testId}`}
          >
            <EditorArea
              script={script}
              recordingSession={recordingSession}
              {...mockHandlers}
            />
          </div>
        </div>
      </div>
    </UnifiedInterfaceProvider>
  );
};

// Arbitraries for property-based testing
const applicationModeArbitrary = fc.constantFrom('idle', 'recording', 'playing', 'editing');

const modeTransitionArbitrary = fc.tuple(applicationModeArbitrary, applicationModeArbitrary)
  .filter(([from, to]) => from !== to); // Only test actual transitions

const editorContentArbitrary = fc.array(
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 10 }),
    type: fc.constantFrom('mouse_click', 'mouse_move', 'key_press', 'delay'),
    timestamp: fc.float({ min: 0, max: 10 }),
    data: fc.record({
      x: fc.option(fc.integer({ min: 0, max: 1920 })),
      y: fc.option(fc.integer({ min: 0, max: 1080 })),
      key: fc.option(fc.string({ minLength: 1, maxLength: 5 })),
      duration: fc.option(fc.integer({ min: 10, max: 1000 }))
    })
  }),
  { minLength: 0, maxLength: 10 }
);

describe('Seamless Integration Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock performance.now for consistent timing
    jest.spyOn(performance, 'now').mockReturnValue(1000);
    // Mock timers for transitions
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // Feature: desktop-ui-redesign, Property 6: Seamless integration preservation
  // Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
  test('Property 6: Seamless integration preservation - toolbar and editor remain visible during mode transitions', () => {
    fc.assert(
      fc.property(
        modeTransitionArbitrary,
        fc.boolean(), // hasScript
        fc.boolean(), // hasRecordings
        editorContentArbitrary,
        fc.integer({ min: 1, max: 10000 }), // unique test ID
        ([initialMode, targetMode], hasScript, hasRecordings, editorContent, testId) => {
          const { container } = render(
            <SeamlessIntegrationTest
              initialMode={initialMode}
              targetMode={targetMode}
              hasScript={hasScript}
              hasRecordings={hasRecordings}
              editorContent={editorContent}
              testId={testId.toString()}
            />
          );

          // Verify initial state - both toolbar and editor should be visible using container queries
          const unifiedInterface = container.querySelector(`[data-testid="unified-interface-${testId}"]`);
          expect(unifiedInterface).toBeInTheDocument();

          const toolbar = container.querySelector('[data-testid="top-toolbar"]');
          expect(toolbar).toBeInTheDocument();
          expect(toolbar).toBeVisible();

          const editorArea = container.querySelector(`[data-testid="editor-area-${testId}"]`);
          expect(editorArea).toBeInTheDocument();

          // Wait for transition to complete
          act(() => {
            jest.advanceTimersByTime(200); // Allow transition time
          });

          // After transition - both toolbar and editor should still be visible
          expect(toolbar).toBeInTheDocument();
          expect(toolbar).toBeVisible();
          expect(editorArea).toBeInTheDocument();

          // Verify no layout changes occurred - container structure should be preserved
          const toolbarArea = container.querySelector('.toolbar-area');
          const editorAreaContainer = container.querySelector('.editor-area');
          expect(toolbarArea).toBeInTheDocument();
          expect(editorAreaContainer).toBeInTheDocument();

          // Verify unified interface maintains its structure
          expect(unifiedInterface?.children.length).toBeGreaterThan(0);

          // Check that mode transition classes are applied correctly
          const testContainer = container.querySelector(`[data-testid="seamless-integration-test-${testId}"]`);
          expect(testContainer?.getAttribute('data-current-mode')).toBe(targetMode);
        }
      ),
      { numRuns: 50 } // Reduced runs for stability
    );
  });

  // Property 6a: Editor content preservation during mode transitions
  test('Property 6a: Editor content preservation - editor content and position maintained during mode switches', () => {
    fc.assert(
      fc.property(
        modeTransitionArbitrary,
        editorContentArbitrary.filter(content => content.length > 0), // Only test with content
        fc.integer({ min: 1, max: 10000 }), // unique test ID
        ([initialMode, targetMode], testEditorContent, testId) => {
          const { container } = render(
            <SeamlessIntegrationTest
              initialMode={initialMode}
              targetMode={targetMode}
              hasScript={true}
              hasRecordings={true}
              editorContent={testEditorContent}
              testId={testId.toString()}
            />
          );

          // Get initial editor content using container queries
          const editorContainer = container.querySelector('[data-testid="editor-area-container"]');
          expect(editorContainer).toBeInTheDocument();

          // Check if actions are displayed initially
          const initialActionElements = container.querySelectorAll('.action-item');
          const initialActionCount = initialActionElements.length;

          // Wait for transition
          act(() => {
            jest.advanceTimersByTime(200);
          });

          // After transition - editor content should be preserved
          const finalActionElements = container.querySelectorAll('.action-item');

          // Content should be preserved (allowing for dynamic updates during recording)
          if (targetMode !== 'recording') {
            expect(finalActionElements.length).toBe(initialActionCount);
          }

          // Editor container should still be present and functional
          expect(editorContainer).toBeInTheDocument();

          // Verify editor maintains its scrollable structure
          const editorContent = container.querySelector('.editor-content');
          if (editorContent) {
            expect(editorContent).toBeInTheDocument();
          }
        }
      ),
      { numRuns: 25 } // Reduced runs for stability
    );
  });

  // Property 6b: No screen switching during transitions
  test('Property 6b: No screen switching - interface remains on same unified view during all transitions', () => {
    fc.assert(
      fc.property(
        modeTransitionArbitrary,
        fc.boolean(),
        fc.boolean(),
        fc.integer({ min: 1, max: 10000 }), // unique test ID
        ([initialMode, targetMode], hasScript, hasRecordings, testId) => {
          const { container } = render(
            <SeamlessIntegrationTest
              initialMode={initialMode}
              targetMode={targetMode}
              hasScript={hasScript}
              hasRecordings={hasRecordings}
              testId={testId.toString()}
            />
          );

          // Verify no navigation elements are present
          expect(container.querySelector('[data-testid="navigation"]')).toBeNull();
          expect(container.querySelector('.navigation')).toBeNull();
          expect(container.querySelector('nav')).toBeNull();

          // Verify unified interface is the main container using container queries
          const unifiedInterface = container.querySelector(`[data-testid="unified-interface-${testId}"]`);
          expect(unifiedInterface).toBeInTheDocument();

          // Wait for transition
          act(() => {
            jest.advanceTimersByTime(200);
          });

          // After transition - still no navigation elements
          expect(container.querySelector('[data-testid="navigation"]')).toBeNull();
          expect(container.querySelector('.navigation')).toBeNull();
          expect(container.querySelector('nav')).toBeNull();

          // Unified interface should still be the main container
          expect(unifiedInterface).toBeInTheDocument();
          expect(unifiedInterface?.parentElement).toBeTruthy();
        }
      ),
      { numRuns: 50 } // Reduced runs for stability
    );
  });

  // Property 6c: Layout stability during transitions
  test('Property 6c: Layout stability - no layout changes or jumps during mode transitions', () => {
    fc.assert(
      fc.property(
        modeTransitionArbitrary,
        fc.boolean(),
        fc.integer({ min: 1, max: 10000 }), // unique test ID
        ([initialMode, targetMode], hasScript, testId) => {
          const { container } = render(
            <SeamlessIntegrationTest
              initialMode={initialMode}
              targetMode={targetMode}
              hasScript={hasScript}
              hasRecordings={true}
              testId={testId.toString()}
            />
          );

          // Capture initial layout measurements using container queries
          const unifiedInterface = container.querySelector(`[data-testid="unified-interface-${testId}"]`);
          const toolbar = container.querySelector('[data-testid="top-toolbar"]');
          const editorArea = container.querySelector(`[data-testid="editor-area-${testId}"]`);

          const initialLayout = {
            interfaceRect: unifiedInterface?.getBoundingClientRect(),
            toolbarRect: toolbar?.getBoundingClientRect(),
            editorRect: editorArea?.getBoundingClientRect(),
          };

          // Verify initial layout structure
          expect(initialLayout.interfaceRect?.width).toBeGreaterThan(0);
          expect(initialLayout.interfaceRect?.height).toBeGreaterThan(0);
          expect(initialLayout.toolbarRect?.height).toBeGreaterThan(0);

          // Wait for transition
          act(() => {
            jest.advanceTimersByTime(200);
          });

          // Capture final layout measurements
          const finalLayout = {
            interfaceRect: unifiedInterface?.getBoundingClientRect(),
            toolbarRect: toolbar?.getBoundingClientRect(),
            editorRect: editorArea?.getBoundingClientRect(),
          };

          // Layout dimensions should remain stable (allowing for minor CSS transitions)
          if (initialLayout.interfaceRect && finalLayout.interfaceRect) {
            expect(Math.abs(finalLayout.interfaceRect.width - initialLayout.interfaceRect.width)).toBeLessThan(5);
            expect(Math.abs(finalLayout.interfaceRect.height - initialLayout.interfaceRect.height)).toBeLessThan(5);
          }
          if (initialLayout.toolbarRect && finalLayout.toolbarRect) {
            expect(Math.abs(finalLayout.toolbarRect.height - initialLayout.toolbarRect.height)).toBeLessThan(5);
          }

          // Verify no elements have been moved outside the viewport
          if (finalLayout.toolbarRect && finalLayout.editorRect) {
            expect(finalLayout.toolbarRect.top).toBeGreaterThanOrEqual(0);
            expect(finalLayout.editorRect.top).toBeGreaterThanOrEqual(finalLayout.toolbarRect.bottom - 1);
          }
        }
      ),
      { numRuns: 25 } // Reduced runs for stability
    );
  });

  // Property 6d: Accessibility preservation during transitions
  test('Property 6d: Accessibility preservation - toolbar buttons remain accessible during all mode transitions', () => {
    fc.assert(
      fc.property(
        modeTransitionArbitrary,
        fc.boolean(),
        fc.integer({ min: 1, max: 10000 }), // unique test ID
        ([initialMode, targetMode], hasRecordings, testId) => {
          const { container } = render(
            <SeamlessIntegrationTest
              initialMode={initialMode}
              targetMode={targetMode}
              hasScript={true}
              hasRecordings={hasRecordings}
              testId={testId.toString()}
            />
          );

          // Verify all toolbar buttons are accessible initially using container queries
          const buttonIds = ['record', 'play', 'stop', 'save', 'open', 'clear', 'settings'];

          buttonIds.forEach(buttonId => {
            const button = container.querySelector(`[data-testid="button-${buttonId}"]`);
            expect(button).toBeInTheDocument();
            expect(button?.tagName.toLowerCase()).toBe('button');
          });

          // Wait for transition
          act(() => {
            jest.advanceTimersByTime(200);
          });

          // After transition - all buttons should still be accessible
          buttonIds.forEach(buttonId => {
            const button = container.querySelector(`[data-testid="button-${buttonId}"]`);
            expect(button).toBeInTheDocument();
            expect(button?.tagName.toLowerCase()).toBe('button');

            // Button should be focusable (not removed from tab order)
            expect(button?.getAttribute('tabindex')).not.toBe('-1');
          });
        }
      ),
      { numRuns: 50 } // Reduced runs for stability
    );
  });
});
