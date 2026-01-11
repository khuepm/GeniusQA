/**
 * Toolbar Button State Consistency Property-Based Tests
 * Property-based tests for toolbar button state consistency using fast-check
 * 
 * **Feature: desktop-ui-redesign, Property 11: Toolbar button state consistency**
 * **Validates: Preserves existing desktop-recorder-mvp functionality**
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { TopToolbar } from '../../components/TopToolbar';
import { UnifiedInterfaceProvider, ApplicationMode, ScriptFile, RecordingSession, PlaybackSession } from '../../components/UnifiedInterface';

// Mock CSS imports
jest.mock('../../components/TopToolbar.css', () => ({}));
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

// Test wrapper component that provides context with specific state
interface TestWrapperProps {
  applicationMode: ApplicationMode;
  currentScript: ScriptFile | null;
  recordingSession: RecordingSession | null;
  playbackSession: PlaybackSession | null;
  hasRecordings: boolean;
  children: React.ReactNode;
}

const TestWrapper: React.FC<TestWrapperProps> = ({
  applicationMode,
  currentScript,
  recordingSession,
  playbackSession,
  hasRecordings,
  children
}) => {
  // Create a mock context provider that provides the specified state
  const mockContextValue = {
    state: {
      applicationMode,
      currentScript,
      recordingSession,
      playbackSession,
      editorVisible: true,
      toolbarCollapsed: false,
    },
    dispatch: jest.fn(),
    setMode: jest.fn(),
    setCurrentScript: jest.fn(),
    setRecordingSession: jest.fn(),
    setPlaybackSession: jest.fn(),
    setEditorVisible: jest.fn(),
    setToolbarCollapsed: jest.fn(),
    resetState: jest.fn(),
  };

  return (
    <div data-context-mode={applicationMode} data-has-recordings={hasRecordings}>
      {React.cloneElement(children as React.ReactElement, {
        ...mockContextValue.state,
        hasRecordings
      })}
    </div>
  );
};

// Mock useUnifiedInterface hook
const mockUseUnifiedInterface = jest.fn();
jest.mock('../../components/UnifiedInterface', () => ({
  ...jest.requireActual('../../components/UnifiedInterface'),
  useUnifiedInterface: () => mockUseUnifiedInterface(),
}));

// Arbitraries for property-based testing
const applicationModeArbitrary = fc.constantFrom('idle', 'recording', 'playing', 'editing');

const scriptFileArbitrary = fc.option(
  fc.record({
    path: fc.string({ minLength: 1, maxLength: 50 }),
    filename: fc.string({ minLength: 1, maxLength: 20 }),
    content: fc.option(fc.string()),
    actions: fc.option(fc.array(fc.anything()))
  }),
  { nil: null }
);

const recordingSessionArbitrary = fc.option(
  fc.record({
    isActive: fc.boolean(),
    startTime: fc.option(fc.integer({ min: 0 })),
    actions: fc.array(fc.anything())
  }),
  { nil: null }
);

const playbackSessionArbitrary = fc.option(
  fc.record({
    isActive: fc.boolean(),
    currentActionIndex: fc.integer({ min: 0, max: 100 }),
    totalActions: fc.integer({ min: 0, max: 100 }),
    isPaused: fc.boolean()
  }),
  { nil: null }
);

describe('Toolbar Button State Consistency Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // Feature: desktop-ui-redesign, Property 11: Toolbar button state consistency
  // Validates: Preserves existing desktop-recorder-mvp functionality
  test('Property 11: Toolbar button state consistency - button enabled/disabled states match original functionality', () => {
    fc.assert(
      fc.property(
        applicationModeArbitrary,
        scriptFileArbitrary,
        recordingSessionArbitrary,
        playbackSessionArbitrary,
        fc.boolean(), // hasRecordings
        (applicationMode, currentScript, recordingSession, playbackSession, hasRecordings) => {
          // Mock the context hook to return our test state
          mockUseUnifiedInterface.mockReturnValue({
            state: {
              applicationMode,
              currentScript,
              recordingSession,
              playbackSession,
              editorVisible: true,
              toolbarCollapsed: false,
            },
            dispatch: jest.fn(),
            setMode: jest.fn(),
            setCurrentScript: jest.fn(),
            setRecordingSession: jest.fn(),
            setPlaybackSession: jest.fn(),
            setEditorVisible: jest.fn(),
            setToolbarCollapsed: jest.fn(),
            resetState: jest.fn(),
          });

          // Mock handlers
          const mockHandlers = {
            onRecordStart: jest.fn(),
            onRecordStop: jest.fn(),
            onPlayStart: jest.fn(),
            onPlayStop: jest.fn(),
            onSave: jest.fn(),
            onOpen: jest.fn(),
            onClear: jest.fn(),
            onSettings: jest.fn(),
          };

          // Render the toolbar
          render(
            <TopToolbar
              hasRecordings={hasRecordings}
              {...mockHandlers}
            />
          );

          // Verify Record button state - should be enabled only when idle
          const recordButton = screen.getByTestId('button-record');
          const recordShouldBeEnabled = applicationMode === 'idle';
          expect(recordButton.disabled).toBe(!recordShouldBeEnabled);

          // Verify Play button state - should be enabled when idle and has script or recordings
          const playButton = screen.getByTestId('button-play');
          const playShouldBeEnabled = applicationMode === 'idle' && (currentScript !== null || hasRecordings);
          expect(playButton.disabled).toBe(!playShouldBeEnabled);

          // Verify Stop button state - should be enabled when recording or playing
          const stopButton = screen.getByTestId('button-stop');
          const stopShouldBeEnabled = applicationMode === 'recording' || applicationMode === 'playing';
          expect(stopButton.disabled).toBe(!stopShouldBeEnabled);

          // Verify Save button state - should be enabled when has script and not recording
          const saveButton = screen.getByTestId('button-save');
          const saveShouldBeEnabled = currentScript !== null && applicationMode !== 'recording';
          expect(saveButton.disabled).toBe(!saveShouldBeEnabled);

          // Verify Open button state - should be enabled when idle
          const openButton = screen.getByTestId('button-open');
          const openShouldBeEnabled = applicationMode === 'idle';
          expect(openButton.disabled).toBe(!openShouldBeEnabled);

          // Verify Clear button state - should be enabled when has script and idle
          const clearButton = screen.getByTestId('button-clear');
          const clearShouldBeEnabled = currentScript !== null && applicationMode === 'idle';
          expect(clearButton.disabled).toBe(!clearShouldBeEnabled);

          // Verify Settings button state - should always be enabled
          const settingsButton = screen.getByTestId('button-settings');
          expect(settingsButton.disabled).toBe(false);

          // Verify active states
          // Record button should be active when recording
          if (applicationMode === 'recording') {
            expect(recordButton.classList.contains('active')).toBe(true);
          }

          // Play button should be active when playing
          if (applicationMode === 'playing') {
            expect(playButton.classList.contains('active')).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional test for specific edge cases
  test('Property 11a: Button state consistency edge cases - validates specific state combinations', () => {
    const edgeCases = [
      // Idle with no script and no recordings - only record, open, settings should be enabled
      {
        applicationMode: 'idle' as ApplicationMode,
        currentScript: null,
        hasRecordings: false,
        expectedEnabled: ['record', 'open', 'settings']
      },
      // Idle with script but no recordings - record, play, save, open, clear, settings should be enabled
      {
        applicationMode: 'idle' as ApplicationMode,
        currentScript: { path: '/test.json', filename: 'test.json' },
        hasRecordings: false,
        expectedEnabled: ['record', 'play', 'save', 'open', 'clear', 'settings']
      },
      // Recording state - only stop and settings should be enabled
      {
        applicationMode: 'recording' as ApplicationMode,
        currentScript: null,
        hasRecordings: false,
        expectedEnabled: ['stop', 'settings']
      },
      // Playing state - only stop and settings should be enabled
      {
        applicationMode: 'playing' as ApplicationMode,
        currentScript: { path: '/test.json', filename: 'test.json' },
        hasRecordings: true,
        expectedEnabled: ['stop', 'settings']
      }
    ];

    edgeCases.forEach((testCase, index) => {
      // Mock the context hook
      mockUseUnifiedInterface.mockReturnValue({
        state: {
          applicationMode: testCase.applicationMode,
          currentScript: testCase.currentScript,
          recordingSession: null,
          playbackSession: null,
          editorVisible: true,
          toolbarCollapsed: false,
        },
        dispatch: jest.fn(),
        setMode: jest.fn(),
        setCurrentScript: jest.fn(),
        setRecordingSession: jest.fn(),
        setPlaybackSession: jest.fn(),
        setEditorVisible: jest.fn(),
        setToolbarCollapsed: jest.fn(),
        resetState: jest.fn(),
      });

      const { unmount } = render(
        <TopToolbar
          hasRecordings={testCase.hasRecordings}
          onRecordStart={jest.fn()}
          onRecordStop={jest.fn()}
          onPlayStart={jest.fn()}
          onPlayStop={jest.fn()}
          onSave={jest.fn()}
          onOpen={jest.fn()}
          onClear={jest.fn()}
          onSettings={jest.fn()}
        />
      );

      const allButtons = ['record', 'play', 'stop', 'save', 'open', 'clear', 'settings'];

      allButtons.forEach(buttonId => {
        const button = screen.getByTestId(`button-${buttonId}`);
        const shouldBeEnabled = testCase.expectedEnabled.includes(buttonId);

        expect(button.disabled).toBe(!shouldBeEnabled);
      });

      unmount();
    });
  });
});
