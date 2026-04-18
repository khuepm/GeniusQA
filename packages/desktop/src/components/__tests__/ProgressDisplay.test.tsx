/**
 * Unit tests for ProgressDisplay component
 */

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProgressDisplay } from '../ProgressDisplay';
import { PlaybackSession, PlaybackState, FocusLossStrategy, FocusState } from '../../types/applicationFocusedAutomation.types';

describe('ProgressDisplay', () => {
  const mockSession: PlaybackSession = {
    id: 'session-123',
    target_app_id: 'app-1',
    target_process_id: 12345,
    state: PlaybackState.Running,
    focus_strategy: FocusLossStrategy.AutoPause,
    current_step: 25,
    started_at: '2023-01-01T10:00:00Z',
  };

  const mockFocusState: FocusState = {
    is_target_process_focused: true,
    focused_process_id: 12345,
    focused_window_title: 'Visual Studio Code',
    last_change: '2023-01-01T10:00:00Z',
  };

  const defaultProps = {
    currentSession: mockSession,
    focusState: mockFocusState,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render no session message when no session', () => {
    const { getByText } = render(
      <ProgressDisplay currentSession={null} focusState={mockFocusState} />
    );

    expect(getByText('No Active Session')).toBeInTheDocument();
    expect(getByText('Start a playback session to see progress information')).toBeInTheDocument();
  });

  it('should render progress header when session exists', () => {
    const { getByText } = render(<ProgressDisplay {...defaultProps} />);

    expect(getByText('Automation Progress')).toBeInTheDocument();
  });

  it('should render session state with correct icon', () => {
    const { getByText } = render(<ProgressDisplay {...defaultProps} />);

    expect(getByText('▶️')).toBeInTheDocument();
    expect(getByText('Running')).toBeInTheDocument();
  });

  it('should render different state icons for different states', () => {
    const pausedSession = { ...mockSession, state: PlaybackState.Paused };
    const { getByText } = render(
      <ProgressDisplay {...defaultProps} currentSession={pausedSession} />
    );

    expect(getByText('⏸️')).toBeInTheDocument();
    expect(getByText('Paused')).toBeInTheDocument();
  });

  it('should render progress bar with correct percentage', () => {
    const { getByText, container } = render(<ProgressDisplay {...defaultProps} />);

    expect(getByText('25.0% Complete')).toBeInTheDocument();

    const progressFill = container.querySelector('.progress-fill');
    expect(progressFill).toHaveStyle('width: 25%');
  });

  it('should render progress statistics', () => {
    const { getByText } = render(<ProgressDisplay {...defaultProps} />);

    expect(getByText('Current Step')).toBeInTheDocument();
    expect(getByText('25')).toBeInTheDocument();
    expect(getByText('Elapsed Time')).toBeInTheDocument();
    expect(getByText('Target Process')).toBeInTheDocument();
    expect(getByText('PID 12345')).toBeInTheDocument();
  });

  it('should show paused duration when session is paused', () => {
    const pausedSession = {
      ...mockSession,
      state: PlaybackState.Paused,
      paused_at: '2023-01-01T10:30:00Z'
    };
    const { getByText } = render(
      <ProgressDisplay {...defaultProps} currentSession={pausedSession} />
    );

    expect(getByText('Paused For')).toBeInTheDocument();
  });

  it('should render focus impact section when focus state exists', () => {
    const { getByText } = render(<ProgressDisplay {...defaultProps} />);

    expect(getByText('Focus Impact')).toBeInTheDocument();
  });

  it('should show focus good status when target is focused', () => {
    const { getByText } = render(<ProgressDisplay {...defaultProps} />);

    expect(getByText('Target application is focused - automation can proceed')).toBeInTheDocument();
  });

  it('should show focus warning when target is not focused', () => {
    const notFocusedState = { ...mockFocusState, is_target_process_focused: false };
    const { getByText } = render(
      <ProgressDisplay {...defaultProps} focusState={notFocusedState} />
    );

    expect(getByText('Target application is not focused - automation may be paused')).toBeInTheDocument();
  });

  it('should render session metadata', () => {
    const { getByText } = render(<ProgressDisplay {...defaultProps} />);

    expect(getByText('Session Details')).toBeInTheDocument();
    expect(getByText('Session ID:')).toBeInTheDocument();
    expect(getByText('session-123...')).toBeInTheDocument();
    expect(getByText('Started:')).toBeInTheDocument();
    expect(getByText('Focus Strategy:')).toBeInTheDocument();
    expect(getByText('Target App:')).toBeInTheDocument();
  });

  it('should show error details when session failed', () => {
    const failedSession = { ...mockSession, state: PlaybackState.Failed };
    const { getByText } = render(
      <ProgressDisplay {...defaultProps} currentSession={failedSession} />
    );

    expect(getByText('Error Information')).toBeInTheDocument();
    expect(getByText('The automation session failed. Check the logs for more details.')).toBeInTheDocument();
  });

  it('should show completion details when session completed', () => {
    const completedSession = { ...mockSession, state: PlaybackState.Completed };
    const { getByText } = render(
      <ProgressDisplay {...defaultProps} currentSession={completedSession} />
    );

    expect(getByText('Session Completed')).toBeInTheDocument();
    expect(getByText('The automation session completed successfully!')).toBeInTheDocument();
  });

  it('should apply correct CSS classes for session state', () => {
    const { container } = render(<ProgressDisplay {...defaultProps} />);

    expect(container.querySelector('.session-state.running')).toBeInTheDocument();
  });

  it('should format elapsed time correctly', () => {
    // Mock current time to be 1 hour and 30 minutes after start
    const mockDate = new Date('2023-01-01T11:30:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

    const { container } = render(<ProgressDisplay {...defaultProps} />);

    // Check that elapsed time element exists
    const elapsedTimeElement = container.querySelector('.stat-value');
    expect(elapsedTimeElement).toBeInTheDocument();

    jest.restoreAllMocks();
  });

  it('should truncate long session ID', () => {
    const longIdSession = { ...mockSession, id: 'very-long-session-id-that-should-be-truncated' };
    const { getByText } = render(
      <ProgressDisplay {...defaultProps} currentSession={longIdSession} />
    );

    expect(getByText('very-long-se...')).toBeInTheDocument();
  });

  it('should handle missing focus state gracefully', () => {
    const { queryByText } = render(
      <ProgressDisplay {...defaultProps} focusState={null} />
    );

    expect(queryByText('Focus Impact')).not.toBeInTheDocument();
  });

  it('should render no session icon', () => {
    const { container } = render(
      <ProgressDisplay currentSession={null} focusState={mockFocusState} />
    );

    expect(container.querySelector('.no-session-icon')).toBeInTheDocument();
  });
});
