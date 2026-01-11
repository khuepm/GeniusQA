/**
 * EditorArea Property-Based Tests
 * Property-based tests for EditorArea component using fast-check
 * Requirements: 5.1, 5.2, 5.5
 */

import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import { EditorArea } from '../../components/EditorArea';
import { UnifiedInterfaceProvider } from '../../components/UnifiedInterface';

// Mock CSS imports
jest.mock('../../components/EditorArea.css', () => ({}));

// Mock action generator for property tests
const actionArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  type: fc.constantFrom('mouse_click', 'mouse_move', 'key_press', 'key_release', 'delay'),
  timestamp: fc.float({ min: 0, max: 10000 }),
  data: fc.record({
    x: fc.integer({ min: 0, max: 1920 }),
    y: fc.integer({ min: 0, max: 1080 }),
    key: fc.constantFrom('a', 'b', 'Enter', 'Space', 'Escape'),
    duration: fc.integer({ min: 10, max: 5000 })
  })
});

// Mock recording session generator
const recordingSessionArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  isActive: fc.boolean(),
  actions: fc.array(actionArbitrary, { minLength: 0, maxLength: 10 })
});

// Test wrapper component with context
const TestWrapper: React.FC<{ children: React.ReactNode; recordingActive?: boolean }> = ({
  children,
  recordingActive = false
}) => {
  const mockState = {
    applicationMode: recordingActive ? 'recording' as const : 'idle' as const,
    editorVisible: true,
    recordingSession: null,
    script: null,
    isRecording: recordingActive,
    isPlaying: false,
    error: null
  };

  const mockActions = {
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    startPlayback: jest.fn(),
    stopPlayback: jest.fn(),
    showEditor: jest.fn(),
    hideEditor: jest.fn(),
    loadScript: jest.fn(),
    saveScript: jest.fn(),
    clearError: jest.fn()
  };

  return (
    <UnifiedInterfaceProvider value={{ state: mockState, actions: mockActions }}>
      {children}
    </UnifiedInterfaceProvider>
  );
};

describe('EditorArea Property-Based Tests', () => {
  afterEach(() => {
    cleanup();
  });

  // Feature: desktop-ui-redesign, Property 12: Real-time action display
  test('Property 12: Real-time action display - actions appear immediately during recording with proper formatting', () => {
    fc.assert(
      fc.property(recordingSessionArbitrary, (recordingSession) => {
        // Skip empty sessions for this test
        if (recordingSession.actions.length === 0) return true;

        render(
          <TestWrapper recordingActive={recordingSession.isActive}>
            <EditorArea
              recordingSession={recordingSession}
              onActionSelect={jest.fn()}
              onActionEdit={jest.fn()}
              onActionDelete={jest.fn()}
            />
          </TestWrapper>
        );

        // Verify editor is visible
        const editorContainer = screen.getByTestId('editor-area-container') ||
          document.querySelector('.editor-area-container');
        expect(editorContainer).toBeTruthy();

        // Verify actions are displayed
        recordingSession.actions.forEach((action, index) => {
          // Check action item exists
          const actionElements = document.querySelectorAll('.action-item');
          expect(actionElements.length).toBe(recordingSession.actions.length);

          // Verify action formatting based on type
          const actionElement = actionElements[index];
          expect(actionElement).toBeTruthy();

          // Check timestamp display
          const timestampElement = actionElement.querySelector('.action-timestamp');
          expect(timestampElement).toBeTruthy();
          expect(timestampElement?.textContent).toContain(action.timestamp.toFixed(2));

          // Check action description based on type
          const descriptionElement = actionElement.querySelector('.action-description');
          expect(descriptionElement).toBeTruthy();

          switch (action.type) {
            case 'mouse_click':
              expect(descriptionElement?.textContent).toContain(`Click at (${action.data.x}, ${action.data.y})`);
              break;
            case 'mouse_move':
              expect(descriptionElement?.textContent).toContain(`Move to (${action.data.x}, ${action.data.y})`);
              break;
            case 'key_press':
              expect(descriptionElement?.textContent).toContain(`Press key: ${action.data.key}`);
              break;
            case 'key_release':
              expect(descriptionElement?.textContent).toContain(`Release key: ${action.data.key}`);
              break;
            case 'delay':
              expect(descriptionElement?.textContent).toContain(`Wait ${action.data.duration}ms`);
              break;
          }

          // Check icon display
          const iconElement = actionElement.querySelector('.action-icon');
          expect(iconElement).toBeTruthy();
          expect(iconElement?.textContent).toBeTruthy();
        });

        // If recording is active, verify latest action has special styling
        if (recordingSession.isActive && recordingSession.actions.length > 0) {
          const actionElements = document.querySelectorAll('.action-item');
          const latestAction = actionElements[actionElements.length - 1];
          expect(latestAction).toHaveClass('latest');
        }

        return true;
      }),
      { numRuns: 20 }
    );
  });

  // Additional property test for auto-scroll behavior during recording
  test('Property 12a: Auto-scroll behavior - action list scrolls to bottom when recording is active', async () => {
    fc.assert(
      fc.property(
        fc.array(actionArbitrary, { minLength: 5, maxLength: 15 }),
        async (actions) => {
          const recordingSession = {
            id: 'test-session',
            isActive: true,
            actions: actions
          };

          render(
            <TestWrapper recordingActive={true}>
              <EditorArea
                recordingSession={recordingSession}
                onActionSelect={jest.fn()}
                onActionEdit={jest.fn()}
                onActionDelete={jest.fn()}
              />
            </TestWrapper>
          );

          // Wait for component to render and auto-scroll to trigger
          await waitFor(() => {
            const actionList = document.querySelector('.action-list');
            expect(actionList).toBeTruthy();

            // Verify scroll position is at or near bottom
            if (actionList && actions.length > 3) {
              const scrollTop = actionList.scrollTop;
              const scrollHeight = actionList.scrollHeight;
              const clientHeight = actionList.clientHeight;

              // Should be scrolled to bottom (within 10px tolerance)
              expect(scrollTop + clientHeight).toBeGreaterThanOrEqual(scrollHeight - 10);
            }
          });

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  // Property test for empty state display
  test('Property 12b: Empty state display - shows appropriate message when no actions exist', () => {
    fc.assert(
      fc.property(fc.boolean(), (recordingActive) => {
        const emptyRecordingSession = {
          id: 'empty-session',
          isActive: recordingActive,
          actions: []
        };

        render(
          <TestWrapper recordingActive={recordingActive}>
            <EditorArea
              recordingSession={emptyRecordingSession}
              onActionSelect={jest.fn()}
              onActionEdit={jest.fn()}
              onActionDelete={jest.fn()}
            />
          </TestWrapper>
        );

        // Verify empty state is displayed
        const emptyState = document.querySelector('.action-list-empty');
        expect(emptyState).toBeTruthy();

        const emptyTitle = document.querySelector('.empty-title');
        expect(emptyTitle?.textContent).toBe('No Actions Yet');

        const emptyDescription = document.querySelector('.empty-description');
        expect(emptyDescription).toBeTruthy();

        if (recordingActive) {
          expect(emptyDescription?.textContent).toContain('Start interacting with your screen');
        } else {
          expect(emptyDescription?.textContent).toContain('Click Record to start');
        }

        return true;
      }),
      { numRuns: 10 }
    );
  });
});
