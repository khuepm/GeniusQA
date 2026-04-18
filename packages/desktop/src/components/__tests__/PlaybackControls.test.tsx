/**
 * Unit tests for PlaybackControls component
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PlaybackControls } from '../PlaybackControls';
import { PlaybackSession, PlaybackState, FocusLossStrategy, RegisteredApplication, ApplicationStatus } from '../../types/applicationFocusedAutomation.types';

describe('PlaybackControls', () => {
  const mockOnStartPlayback = jest.fn();
  const mockOnPausePlayback = jest.fn();
  const mockOnResumePlayback = jest.fn();
  const mockOnStopPlayback = jest.fn();

  const mockSession: PlaybackSession = {
    id: 'session-123',
    target_app_id: 'app-1',
    target_process_id: 12345,
    state: PlaybackState.Running,
    focus_strategy: FocusLossStrategy.AutoPause,
    current_step: 5,
    started_at: '2023-01-01T10:00:00Z',
  };

  const defaultProps = {
    currentSession: null,
    onStartPlayback: mockOnStartPlayback,
    onPausePlayback: mockOnPausePlayback,
    onResumePlayback: mockOnResumePlayback,
    onStopPlayback: mockOnStopPlayback,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render playback controls header', () => {
    const { getByText } = render(<PlaybackControls {...defaultProps} />);

    expect(getByText('Playback Controls')).toBeInTheDocument();
  });

  it('should render setup section when no active session', () => {
    const { getByLabelText } = render(<PlaybackControls {...defaultProps} />);

    expect(getByLabelText('Target Application')).toBeInTheDocument();
    expect(getByLabelText('Focus Loss Strategy')).toBeInTheDocument();
    expect(getByLabelText('Script Path (Optional)')).toBeInTheDocument();
  });

  it('should render start button when no active session', () => {
    const { getByRole } = render(<PlaybackControls {...defaultProps} />);

    const startButton = getByRole('button', { name: /start playback/i });
    expect(startButton).toBeInTheDocument();
    expect(startButton).toBeDisabled(); // Should be disabled when no app selected
  });

  it('should show session info when session is active', () => {
    const { getByText, container } = render(
      <PlaybackControls {...defaultProps} currentSession={mockSession} />
    );

    // Use container.querySelector to find the session-id element
    const sessionElement = container.querySelector('.session-id');
    expect(sessionElement).toBeInTheDocument();
    expect(sessionElement).toHaveTextContent('Session: session-...');
    expect(getByText('Running')).toBeInTheDocument();
  });

  it('should render pause button when session is running', () => {
    const { getByRole } = render(
      <PlaybackControls {...defaultProps} currentSession={mockSession} />
    );

    expect(getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('should render resume button when session is paused', () => {
    const pausedSession = { ...mockSession, state: PlaybackState.Paused };
    const { getByRole } = render(
      <PlaybackControls {...defaultProps} currentSession={pausedSession} />
    );

    expect(getByRole('button', { name: /resume/i })).toBeInTheDocument();
  });

  it('should render stop button when session is active', () => {
    const { getByRole } = render(
      <PlaybackControls {...defaultProps} currentSession={mockSession} />
    );

    expect(getByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  it('should call onPausePlayback when pause button is clicked', () => {
    const { getByRole } = render(
      <PlaybackControls {...defaultProps} currentSession={mockSession} />
    );

    const pauseButton = getByRole('button', { name: /pause/i });
    fireEvent.click(pauseButton);

    expect(mockOnPausePlayback).toHaveBeenCalledTimes(1);
  });

  it('should call onResumePlayback when resume button is clicked', () => {
    const pausedSession = { ...mockSession, state: PlaybackState.Paused };
    const { getByRole } = render(
      <PlaybackControls {...defaultProps} currentSession={pausedSession} />
    );

    const resumeButton = getByRole('button', { name: /resume/i });
    fireEvent.click(resumeButton);

    expect(mockOnResumePlayback).toHaveBeenCalledTimes(1);
  });

  it('should call onStopPlayback when stop button is clicked', () => {
    const { getByRole } = render(
      <PlaybackControls {...defaultProps} currentSession={mockSession} />
    );

    const stopButton = getByRole('button', { name: /stop/i });
    fireEvent.click(stopButton);

    expect(mockOnStopPlayback).toHaveBeenCalledTimes(1);
  });

  it('should update focus strategy selection', () => {
    const { getByLabelText } = render(<PlaybackControls {...defaultProps} />);

    const focusStrategySelect = getByLabelText('Focus Loss Strategy') as HTMLSelectElement;
    fireEvent.change(focusStrategySelect, { target: { value: FocusLossStrategy.StrictError } });

    expect(focusStrategySelect.value).toBe(FocusLossStrategy.StrictError);
  });

  it('should update script path input', () => {
    const { getByLabelText } = render(<PlaybackControls {...defaultProps} />);

    const scriptPathInput = getByLabelText('Script Path (Optional)') as HTMLInputElement;
    fireEvent.change(scriptPathInput, { target: { value: '/path/to/script.json' } });

    expect(scriptPathInput.value).toBe('/path/to/script.json');
  });

  it('should render browse button for script selection', () => {
    const { getByText } = render(<PlaybackControls {...defaultProps} />);

    expect(getByText('Browse')).toBeInTheDocument();
  });

  it('should show no apps message when no registered applications', () => {
    const { getByText } = render(<PlaybackControls {...defaultProps} />);

    expect(getByText('No registered applications. Please add applications first.')).toBeInTheDocument();
  });

  it('should render session details when session is active', () => {
    const { getByText } = render(
      <PlaybackControls {...defaultProps} currentSession={mockSession} />
    );

    expect(getByText('Target App:')).toBeInTheDocument();
    expect(getByText('Focus Strategy:')).toBeInTheDocument();
    expect(getByText('Started:')).toBeInTheDocument();
  });

  it('should show paused time when session is paused', () => {
    const pausedSession = {
      ...mockSession,
      state: PlaybackState.Paused,
      paused_at: '2023-01-01T10:30:00Z'
    };
    const { getByText } = render(
      <PlaybackControls {...defaultProps} currentSession={pausedSession} />
    );

    expect(getByText('Paused:')).toBeInTheDocument();
  });

  it('should render all focus strategy options', () => {
    const { getByText } = render(<PlaybackControls {...defaultProps} />);

    expect(getByText('Auto Pause - Pause when focus is lost')).toBeInTheDocument();
    expect(getByText('Strict Error - Stop immediately on focus loss')).toBeInTheDocument();
    expect(getByText('Ignore - Continue with warnings')).toBeInTheDocument();
  });

  it('should apply correct CSS classes for session state', () => {
    const { container } = render(
      <PlaybackControls {...defaultProps} currentSession={mockSession} />
    );

    expect(container.querySelector('.session-state.running')).toBeInTheDocument();
  });
});
