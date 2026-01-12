/**
 * Immediate Editor Visibility Property-Based Tests
 * Property-based tests for immediate editor visibility during recording
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import { UnifiedInterface, UnifiedInterfaceProvider, useUnifiedInterface } from '../../components/UnifiedInterface';
import { TopToolbar } from '../../components/TopToolbar';
import { EditorArea } from '../../components/EditorArea';

// Mock CSS imports
jest.mock('../../components/UnifiedInterface.css', () => ({}));
jest.mock('../../components/TopToolbar.css', () => ({}));
jest.mock('../../components/EditorArea.css', () => ({}));

// Test component that simulates the recording workflow
const TestRecordingWorkflow: React.FC<{
  initialMode?: 'idle' | 'recording' | 'playing' | 'editing';
  hasRecordings?: boolean;
}> = ({
  initialMode = 'idle',
  hasRecordings = false
}) => {
    const { state, setMode, setRecordingSession, setEditorVisible } = useUnifiedInterface();

    // Simulate record start
    const handleRecordStart = () => {
      setMode('recording');
      setRecordingSession({
        isActive: true,
        startTime: Date.now(),
        actions: []
      });
      setEditorVisible(true);
    };

    // Simulate record stop
    const handleRecordStop = () => {
      setMode('idle');
      setRecordingSession(null);
      // Editor should remain visible with complete script
    };

    React.useEffect(() => {
      if (initialMode !== 'idle') {
        setMode(initialMode);
      }
    }, [initialMode, setMode]);

    return (
      <UnifiedInterface>
        <div data-testid="test-workflow">
          <TopToolbar
            hasRecordings={hasRecordings}
            onRecordStart={handleRecordStart}
            onRecordStop={handleRecordStop}
            onPlayStart={() => { }}
            onPlayStop={() => { }}
            onSave={() => { }}
            onOpen={() => { }}
            onClear={() => { }}
            onSettings={() => { }}
          />
          <EditorArea
            script={state.currentScript}
            recordingSession={state.recordingSession}
            onScriptChange={() => { }}
            onActionSelect={() => { }}
            onActionEdit={() => { }}
            onActionDelete={() => { }}
          />
          <div data-testid="application-mode">{state.applicationMode}</div>
          <div data-testid="editor-visible">{state.editorVisible ? 'visible' : 'hidden'}</div>
          <div data-testid="recording-active">{state.recordingSession?.isActive ? 'active' : 'inactive'}</div>
        </div>
      </UnifiedInterface>
    );
  };

describe('Immediate Editor Visibility Property-Based Tests', () => {
  afterEach(() => {
    cleanup();
  });

  // Feature: desktop-ui-redesign, Property 5: Immediate editor visibility during recording
  test('Property 5: Immediate editor visibility - editor becomes visible immediately when recording starts and displays real-time actions', async () => {
    fc.assert(
      fc.property(
        fc.record({
          hasRecordings: fc.boolean(),
          initialEditorVisible: fc.boolean()
        }),
        async ({ hasRecordings, initialEditorVisible }) => {
          render(
            <UnifiedInterfaceProvider>
              <TestRecordingWorkflow hasRecordings={hasRecordings} />
            </UnifiedInterfaceProvider>
          );

          // Verify initial state
          const applicationModes = screen.getAllByTestId('application-mode');
          expect(applicationModes[0]).toHaveTextContent('idle');

          // Editor should be visible by default (Requirements: 5.1)
          const editorVisibleElements = screen.getAllByTestId('editor-visible');
          expect(editorVisibleElements[0]).toHaveTextContent('visible');

          // Find and click record button
          const recordButton = screen.getByTestId('button-record');
          expect(recordButton).toBeInTheDocument();
          expect(recordButton).not.toBeDisabled();

          // Click record button to start recording
          fireEvent.click(recordButton);

          // Wait for state changes to propagate
          await waitFor(() => {
            // Verify recording mode is active (Requirements: 5.1, 5.2)
            const applicationModes = screen.getAllByTestId('application-mode');
            expect(applicationModes[0]).toHaveTextContent('recording');
            const recordingActiveElements = screen.getAllByTestId('recording-active');
            expect(recordingActiveElements[0]).toHaveTextContent('active');
          });

          // Verify editor is immediately visible during recording (Requirements: 5.1, 5.3)
          const editorVisibleElements2 = screen.getAllByTestId('editor-visible');
          expect(editorVisibleElements2[0]).toHaveTextContent('visible');

          // Verify editor area is rendered and visible
          const editorArea = screen.getByTestId('editor-area');
          expect(editorArea).toBeInTheDocument();
          expect(editorArea).toHaveClass('visible');

          // Verify editor container is present for real-time updates (Requirements: 5.2, 5.5)
          const editorContainer = screen.getByTestId('editor-area-container');
          expect(editorContainer).toBeInTheDocument();
          expect(editorContainer).toHaveClass('visible');

          // Verify recording controls remain accessible in toolbar (Requirements: 5.3)
          const stopButton = screen.getByTestId('button-stop');
          expect(stopButton).toBeInTheDocument();
          expect(stopButton).not.toBeDisabled();

          // Stop recording
          fireEvent.click(stopButton);

          await waitFor(() => {
            // Verify recording has stopped
            const applicationModes = screen.getAllByTestId('application-mode');
            expect(applicationModes[0]).toHaveTextContent('idle');
            const recordingActiveElements = screen.getAllByTestId('recording-active');
            expect(recordingActiveElements[0]).toHaveTextContent('inactive');
          });

          // Verify editor remains visible with complete script (Requirements: 5.4)
          const editorVisibleElements3 = screen.getAllByTestId('editor-visible');
          expect(editorVisibleElements3[0]).toHaveTextContent('visible');
          expect(editorArea).toHaveClass('visible');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property test for editor visibility timing during recording start
  test('Property 5a: Editor visibility timing - editor becomes visible within acceptable time limits when recording starts', async () => {
    fc.assert(
      fc.property(
        fc.boolean(), // hasRecordings
        async (hasRecordings) => {
          const startTime = performance.now();

          render(
            <UnifiedInterfaceProvider>
              <TestRecordingWorkflow hasRecordings={hasRecordings} />
            </UnifiedInterfaceProvider>
          );

          // Record button should be available
          const recordButton = screen.getByTestId('button-record');
          expect(recordButton).not.toBeDisabled();

          // Click record button
          fireEvent.click(recordButton);

          // Measure time for editor to become visible
          await waitFor(() => {
            const editorVisibleElementsTiming = screen.getAllByTestId('editor-visible');
            expect(editorVisibleElementsTiming[0]).toHaveTextContent('visible');
            const applicationModes = screen.getAllByTestId('application-mode');
            expect(applicationModes[0]).toHaveTextContent('recording');
          });

          const visibilityTime = performance.now() - startTime;

          // Editor should become visible immediately (within 100ms as per Requirements: 5.1)
          expect(visibilityTime).toBeLessThan(100);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  // Property test for editor persistence across mode transitions
  test('Property 5b: Editor persistence - editor remains visible across recording mode transitions', async () => {
    fc.assert(
      fc.property(
        fc.record({
          hasRecordings: fc.boolean(),
          performMultipleRecordings: fc.boolean()
        }),
        async ({ hasRecordings, performMultipleRecordings }) => {
          render(
            <UnifiedInterfaceProvider>
              <TestRecordingWorkflow hasRecordings={hasRecordings} />
            </UnifiedInterfaceProvider>
          );

          // Start recording
          const recordButton = screen.getByTestId('button-record');
          fireEvent.click(recordButton);

          await waitFor(() => {
            const applicationModes = screen.getAllByTestId('application-mode');
            expect(applicationModes[0]).toHaveTextContent('recording');
          });

          // Verify editor is visible during recording
          const editorVisibleElementsPersist1 = screen.getAllByTestId('editor-visible');
          expect(editorVisibleElementsPersist1[0]).toHaveTextContent('visible');

          // Stop recording
          const stopButton = screen.getByTestId('button-stop');
          fireEvent.click(stopButton);

          await waitFor(() => {
            const applicationModes = screen.getAllByTestId('application-mode');
            expect(applicationModes[0]).toHaveTextContent('idle');
          });

          // Verify editor remains visible after recording stops (Requirements: 5.4)
          const editorVisibleElementsPersist2 = screen.getAllByTestId('editor-visible');
          expect(editorVisibleElementsPersist2[0]).toHaveTextContent('visible');

          // If performing multiple recordings, test persistence
          if (performMultipleRecordings) {
            // Start another recording
            fireEvent.click(recordButton);

            await waitFor(() => {
              const applicationModes = screen.getAllByTestId('application-mode');
              expect(applicationModes[0]).toHaveTextContent('recording');
            });

            // Editor should still be visible
            const editorVisibleElementsPersist3 = screen.getAllByTestId('editor-visible');
            expect(editorVisibleElementsPersist3[0]).toHaveTextContent('visible');

            // Stop second recording
            fireEvent.click(stopButton);

            await waitFor(() => {
              const applicationModes = screen.getAllByTestId('application-mode');
              expect(applicationModes[0]).toHaveTextContent('idle');
            });

            // Editor should remain visible
            const editorVisibleElementsPersist4 = screen.getAllByTestId('editor-visible');
            expect(editorVisibleElementsPersist4[0]).toHaveTextContent('visible');
          }

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  // Property test for real-time action display during recording
  test('Property 5c: Real-time action display - editor shows recording progress immediately', async () => {
    fc.assert(
      fc.property(
        fc.boolean(), // hasRecordings
        async (hasRecordings) => {
          render(
            <UnifiedInterfaceProvider>
              <TestRecordingWorkflow hasRecordings={hasRecordings} />
            </UnifiedInterfaceProvider>
          );

          // Start recording
          const recordButton = screen.getByTestId('button-record');
          fireEvent.click(recordButton);

          await waitFor(() => {
            const applicationModes = screen.getAllByTestId('application-mode');
            expect(applicationModes[0]).toHaveTextContent('recording');
          });

          // Verify editor shows recording status (Requirements: 5.2, 5.5)
          const editorContainer = screen.getByTestId('editor-area-container');
          expect(editorContainer).toBeInTheDocument();

          // Check for status panel showing recording state
          const statusPanel = editorContainer.querySelector('.status-panel');
          expect(statusPanel).toBeTruthy();

          // Should show recording status
          const statusValue = statusPanel?.querySelector('.status-value.recording');
          expect(statusValue).toBeTruthy();
          expect(statusValue?.textContent).toContain('Recording');

          // Should show action count (initially 0)
          const actionCountElements = statusPanel?.querySelectorAll('.status-value');
          expect(actionCountElements?.length).toBeGreaterThan(1);

          return true;
        }
      ),
      { numRuns: 25 }
    );
  });
});
