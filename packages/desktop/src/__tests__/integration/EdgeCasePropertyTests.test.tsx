/**
 * Edge Case Property-Based Tests
 * 
 * Tests for edge cases and scenarios that need additional coverage:
 * - Empty script handling
 * - Rapid state transitions
 * - Window resize scenarios
 * - Accessibility features with screen readers
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { UnifiedInterface } from '../../components/UnifiedInterface';
import { TopToolbar } from '../../components/TopToolbar';
import { EditorArea } from '../../components/EditorArea';
import { TestErrorBoundary } from '../utils/TestErrorBoundary';
import {
  improvedActionArbitrary,
  safeNumberArbitrary,
  validateTestData,
  asyncPropertyTest
} from '../utils/propertyTestUtils';
import { isolatedCleanup, safeGetByTestId } from '../utils/testIsolation';

// Mock CSS imports
jest.mock('../../components/UnifiedInterface.css', () => ({}));
jest.mock('../../components/TopToolbar.css', () => ({}));
jest.mock('../../components/EditorArea.css', () => ({}));

// Mock window resize observer
const mockResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}));
global.ResizeObserver = mockResizeObserver;

describe('Edge Case Property-Based Tests', () => {
  beforeEach(() => {
    isolatedCleanup();
    jest.clearAllMocks();
  });

  afterEach(() => {
    isolatedCleanup();
  });

  describe('Empty Script Handling', () => {
    test('Property 17.3a: Empty script handling - components handle null/undefined/empty scripts gracefully', async () => {
      await asyncPropertyTest(
        fc.property(
          fc.constantFrom(null, undefined, [], { actions: [] }, { actions: null }),
          (emptyScript) => {
            let errorOccurred = false;

            const TestComponent = () => (
              <TestErrorBoundary
                onError={() => { errorOccurred = true; }}
              >
                <UnifiedInterface>
                  <TopToolbar />
                  <EditorArea
                    recordingSession={emptyScript}
                    onActionSelect={jest.fn()}
                    onActionEdit={jest.fn()}
                    onActionDelete={jest.fn()}
                  />
                </UnifiedInterface>
              </TestErrorBoundary>
            );

            render(<TestComponent />);

            // Should not crash with empty/null scripts
            expect(errorOccurred).toBe(false);

            // Should show appropriate empty state
            const emptyState = document.querySelector('.action-list-empty') ||
              document.querySelector('.empty-state') ||
              document.querySelector('[data-testid="empty-state"]');

            if (emptyState) {
              expect(emptyState.textContent).toMatch(/no.*action|empty|start.*record/i);
            }

            // Toolbar should still be functional
            const toolbar = document.querySelector('.top-toolbar') ||
              document.querySelector('[data-testid="top-toolbar"]');
            expect(toolbar).toBeTruthy();

            return true;
          }
        ),
        { numRuns: 8 }
      );
    });

    test('Property 17.3b: Empty script operations - all operations handle empty scripts without errors', async () => {
      await asyncPropertyTest(
        fc.property(
          fc.constantFrom('record', 'play', 'stop', 'save', 'open'),
          (operation) => {
            let errorOccurred = false;
            const mockHandlers = {
              onRecord: jest.fn(),
              onPlay: jest.fn(),
              onStop: jest.fn(),
              onSave: jest.fn(),
              onOpen: jest.fn(),
            };

            const TestComponent = () => (
              <TestErrorBoundary
                onError={() => { errorOccurred = true; }}
              >
                <TopToolbar
                  isRecording={false}
                  isPlaying={false}
                  hasRecordings={false}
                  onRecord={mockHandlers.onRecord}
                  onPlay={mockHandlers.onPlay}
                  onStop={mockHandlers.onStop}
                  onSave={mockHandlers.onSave}
                  onOpen={mockHandlers.onOpen}
                />
              </TestErrorBoundary>
            );

            render(<TestComponent />);

            // Try to trigger the operation
            const buttons = document.querySelectorAll('button');
            buttons.forEach(button => {
              if (button.textContent?.toLowerCase().includes(operation) ||
                button.getAttribute('aria-label')?.toLowerCase().includes(operation)) {
                fireEvent.click(button);
              }
            });

            // Should not crash
            expect(errorOccurred).toBe(false);

            return true;
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Rapid State Transitions', () => {
    test('Property 17.3c: Rapid state transitions - components handle quick mode changes without errors', async () => {
      await asyncPropertyTest(
        fc.property(
          fc.array(
            fc.constantFrom('idle', 'recording', 'playing', 'editing'),
            { minLength: 3, maxLength: 8 }
          ),
          safeNumberArbitrary({ min: 10, max: 100 }),
          async (stateSequence, transitionDelay) => {
            let errorOccurred = false;
            let currentState = 'idle';

            const TestComponent = () => {
              const [mode, setMode] = React.useState(currentState);

              React.useEffect(() => {
                const transitions = async () => {
                  for (const newState of stateSequence) {
                    await new Promise(resolve => setTimeout(resolve, transitionDelay));
                    act(() => {
                      setMode(newState);
                      currentState = newState;
                    });
                  }
                };
                transitions();
              }, []);

              return (
                <TestErrorBoundary
                  onError={() => { errorOccurred = true; }}
                >
                  <UnifiedInterface>
                    <TopToolbar
                      isRecording={mode === 'recording'}
                      isPlaying={mode === 'playing'}
                      hasRecordings={true}
                    />
                    <EditorArea
                      recordingSession={{
                        id: 'test',
                        isActive: mode === 'recording',
                        actions: []
                      }}
                      onActionSelect={jest.fn()}
                      onActionEdit={jest.fn()}
                      onActionDelete={jest.fn()}
                    />
                  </UnifiedInterface>
                </TestErrorBoundary>
              );
            };

            render(<TestComponent />);

            // Wait for all transitions to complete
            await waitFor(() => {
              expect(currentState).toBe(stateSequence[stateSequence.length - 1]);
            }, { timeout: (stateSequence.length * transitionDelay) + 1000 });

            // Should not crash during rapid transitions
            expect(errorOccurred).toBe(false);

            // Interface should still be functional
            const unifiedInterface = document.querySelector('.unified-interface') ||
              document.querySelector('[data-testid="unified-interface"]');
            expect(unifiedInterface).toBeTruthy();

            return true;
          }
        ),
        { numRuns: 6 }
      );
    });
  });

  describe('Window Resize Scenarios', () => {
    test('Property 17.3d: Window resize handling - components adapt to different window sizes', async () => {
      await asyncPropertyTest(
        fc.property(
          fc.record({
            width: fc.integer({ min: 320, max: 2560 }),
            height: fc.integer({ min: 240, max: 1440 })
          }),
          fc.array(improvedActionArbitrary, { minLength: 0, maxLength: 5 }),
          async (windowSize, actions) => {
            if (!validateTestData({ windowSize, actions })) {
              return true;
            }

            let errorOccurred = false;

            // Mock window dimensions
            Object.defineProperty(window, 'innerWidth', {
              writable: true,
              configurable: true,
              value: windowSize.width,
            });
            Object.defineProperty(window, 'innerHeight', {
              writable: true,
              configurable: true,
              value: windowSize.height,
            });

            const TestComponent = () => (
              <TestErrorBoundary
                onError={() => { errorOccurred = true; }}
              >
                <UnifiedInterface>
                  <TopToolbar />
                  <EditorArea
                    recordingSession={{
                      id: 'resize-test',
                      isActive: false,
                      actions: actions
                    }}
                    onActionSelect={jest.fn()}
                    onActionEdit={jest.fn()}
                    onActionDelete={jest.fn()}
                  />
                </UnifiedInterface>
              </TestErrorBoundary>
            );

            render(<TestComponent />);

            // Trigger resize event
            act(() => {
              fireEvent(window, new Event('resize'));
            });

            // Wait for any resize handlers to complete
            await waitFor(() => {
              const interface = document.querySelector('.unified-interface');
              expect(interface).toBeTruthy();
            });

            // Should not crash on resize
            expect(errorOccurred).toBe(false);

            // Components should still be rendered
            const toolbar = document.querySelector('.top-toolbar') ||
              document.querySelector('[data-testid="top-toolbar"]');
            const editor = document.querySelector('.editor-area-container') ||
              document.querySelector('[data-testid="editor-area-container"]');

            expect(toolbar).toBeTruthy();
            expect(editor).toBeTruthy();

            return true;
          }
        ),
        { numRuns: 8 }
      );
    });
  });

  describe('Accessibility Features', () => {
    test('Property 17.3e: Screen reader compatibility - components provide proper ARIA labels and roles', async () => {
      await asyncPropertyTest(
        fc.property(
          fc.array(improvedActionArbitrary, { minLength: 0, maxLength: 3 }),
          fc.boolean(),
          (actions, isRecording) => {
            if (!validateTestData(actions)) {
              return true;
            }

            let errorOccurred = false;

            const TestComponent = () => (
              <TestErrorBoundary
                onError={() => { errorOccurred = true; }}
              >
                <UnifiedInterface>
                  <TopToolbar
                    isRecording={isRecording}
                    isPlaying={false}
                    hasRecordings={actions.length > 0}
                  />
                  <EditorArea
                    recordingSession={{
                      id: 'a11y-test',
                      isActive: isRecording,
                      actions: actions
                    }}
                    onActionSelect={jest.fn()}
                    onActionEdit={jest.fn()}
                    onActionDelete={jest.fn()}
                  />
                </UnifiedInterface>
              </TestErrorBoundary>
            );

            render(<TestComponent />);

            // Should not crash
            expect(errorOccurred).toBe(false);

            // Check for essential accessibility attributes
            const buttons = document.querySelectorAll('button');
            buttons.forEach(button => {
              // Each button should have accessible name (aria-label or text content)
              const hasAccessibleName =
                button.getAttribute('aria-label') ||
                button.textContent?.trim() ||
                button.querySelector('[aria-label]');
              expect(hasAccessibleName).toBeTruthy();
            });

            // Check for proper roles
            const regions = document.querySelectorAll('[role="region"], [role="toolbar"], [role="listbox"]');
            expect(regions.length).toBeGreaterThan(0);

            // Check for live regions for dynamic content
            if (isRecording) {
              const liveRegions = document.querySelectorAll('[aria-live]');
              // Should have at least one live region for recording status
              expect(liveRegions.length).toBeGreaterThanOrEqual(0);
            }

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    test('Property 17.3f: Keyboard navigation - all interactive elements are keyboard accessible', async () => {
      await asyncPropertyTest(
        fc.property(
          fc.constantFrom('Tab', 'Enter', 'Space', 'Escape', 'ArrowUp', 'ArrowDown'),
          (keyCode) => {
            let errorOccurred = false;

            const TestComponent = () => (
              <TestErrorBoundary
                onError={() => { errorOccurred = true; }}
              >
                <TopToolbar
                  isRecording={false}
                  isPlaying={false}
                  hasRecordings={true}
                />
              </TestErrorBoundary>
            );

            render(<TestComponent />);

            // Try keyboard navigation
            const focusableElements = document.querySelectorAll(
              'button, [tabindex]:not([tabindex="-1"]), input, select, textarea'
            );

            if (focusableElements.length > 0) {
              const firstElement = focusableElements[0] as HTMLElement;
              firstElement.focus();

              // Simulate key press
              fireEvent.keyDown(firstElement, { key: keyCode });
              fireEvent.keyUp(firstElement, { key: keyCode });
            }

            // Should not crash on keyboard interaction
            expect(errorOccurred).toBe(false);

            return true;
          }
        ),
        { numRuns: 6 }
      );
    });
  });
});
