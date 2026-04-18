/**
 * Unit tests for FocusIndicator component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FocusIndicator } from '../FocusIndicator';
import { FocusState, RegisteredApplication, ApplicationStatus, FocusLossStrategy } from '../../types/applicationFocusedAutomation.types';

describe('FocusIndicator', () => {
  const mockOnRefresh = jest.fn();

  const mockFocusState: FocusState = {
    is_target_process_focused: true,
    focused_process_id: 12345,
    focused_window_title: 'Visual Studio Code',
    last_change: '2023-01-01T10:00:00Z',
  };

  const mockTargetApplication: RegisteredApplication = {
    id: 'app-1',
    name: 'Visual Studio Code',
    executable_path: '/Applications/Visual Studio Code.app',
    process_name: 'Code',
    bundle_id: 'com.microsoft.VSCode',
    process_id: 12345,
    status: ApplicationStatus.Active,
    registered_at: '2023-01-01T00:00:00Z',
    default_focus_strategy: FocusLossStrategy.AutoPause,
  };

  const defaultProps = {
    focusState: mockFocusState,
    targetApplication: mockTargetApplication,
    onRefresh: mockOnRefresh,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render focus status header', () => {
    const { getByText } = render(<FocusIndicator {...defaultProps} />);

    expect(getByText('Focus Status')).toBeInTheDocument();
  });

  it('should render refresh button', () => {
    const { container } = render(<FocusIndicator {...defaultProps} />);

    const refreshButton = container.querySelector('.refresh-button');
    expect(refreshButton).toBeInTheDocument();
  });

  it('should call onRefresh when refresh button is clicked', () => {
    const { container } = render(<FocusIndicator {...defaultProps} />);

    const refreshButton = container.querySelector('.refresh-button');
    fireEvent.click(refreshButton!);

    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  it('should show focused status when target is focused', () => {
    const { getByText } = render(<FocusIndicator {...defaultProps} />);

    expect(getByText('🟢')).toBeInTheDocument();
    expect(getByText('Focused')).toBeInTheDocument();
  });

  it('should show not focused status when target is not focused', () => {
    const notFocusedState = { ...mockFocusState, is_target_process_focused: false };
    const { getByText } = render(
      <FocusIndicator {...defaultProps} focusState={notFocusedState} />
    );

    expect(getByText('🔴')).toBeInTheDocument();
    expect(getByText('Not Focused')).toBeInTheDocument();
  });

  it('should show unknown status when focus state is null', () => {
    const { getByText } = render(
      <FocusIndicator {...defaultProps} focusState={null} />
    );

    expect(getByText('❓')).toBeInTheDocument();
    expect(getByText('Unknown')).toBeInTheDocument();
  });

  it('should render focus state details', () => {
    const { getByText } = render(<FocusIndicator {...defaultProps} />);

    expect(getByText('Last Change:')).toBeInTheDocument();
    expect(getByText('Focused Process:')).toBeInTheDocument();
    expect(getByText('PID 12345')).toBeInTheDocument();
    expect(getByText('Window Title:')).toBeInTheDocument();
  });

  it('should render target application info', () => {
    const { getByText, getAllByText } = render(<FocusIndicator {...defaultProps} />);

    expect(getByText('Target Application')).toBeInTheDocument();
    const vscodeElements = getAllByText('Visual Studio Code');
    expect(vscodeElements.length).toBeGreaterThan(0);
    expect(getByText('Code')).toBeInTheDocument();
  });

  it('should render bring to focus button when not focused', () => {
    const notFocusedState = { ...mockFocusState, is_target_process_focused: false };
    const { getByText } = render(
      <FocusIndicator {...defaultProps} focusState={notFocusedState} />
    );

    expect(getByText('🎯 Bring to Focus')).toBeInTheDocument();
  });

  it('should not render bring to focus button when focused', () => {
    const { queryByText } = render(<FocusIndicator {...defaultProps} />);

    expect(queryByText('🎯 Bring to Focus')).not.toBeInTheDocument();
  });

  it('should render no target message when no target application', () => {
    const { getByText } = render(
      <FocusIndicator {...defaultProps} targetApplication={null} />
    );

    expect(getByText('No target application selected')).toBeInTheDocument();
    expect(getByText('Start a playback session to monitor focus')).toBeInTheDocument();
  });

  it('should render focus tips', () => {
    const { getByText } = render(<FocusIndicator {...defaultProps} />);

    expect(getByText('Focus Tips')).toBeInTheDocument();
    expect(getByText('Keep the target application window visible and active')).toBeInTheDocument();
  });

  it('should truncate long window titles', () => {
    const longTitleState = {
      ...mockFocusState,
      focused_window_title: 'This is a very long window title that should be truncated for display purposes'
    };
    const { getByText } = render(
      <FocusIndicator {...defaultProps} focusState={longTitleState} />
    );

    expect(getByText('This is a very long window tit...')).toBeInTheDocument();
  });

  it('should apply correct CSS classes for focus state', () => {
    const { container } = render(<FocusIndicator {...defaultProps} />);

    expect(container.querySelector('.focus-status.focused')).toBeInTheDocument();
  });

  it('should apply not-focused CSS class when not focused', () => {
    const notFocusedState = { ...mockFocusState, is_target_process_focused: false };
    const { container } = render(
      <FocusIndicator {...defaultProps} focusState={notFocusedState} />
    );

    expect(container.querySelector('.focus-status.not-focused')).toBeInTheDocument();
  });

  it('should format time since last change correctly', () => {
    // Mock current time to be 30 seconds after last change
    const mockDate = new Date('2023-01-01T10:00:30Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

    const { container } = render(<FocusIndicator {...defaultProps} />);

    // Check that some time ago text is displayed
    const timeElement = container.querySelector('.detail-item .value');
    expect(timeElement).toBeInTheDocument();

    jest.restoreAllMocks();
  });

  it('should handle missing focus state details gracefully', () => {
    const minimalFocusState: FocusState = {
      is_target_process_focused: true,
      last_change: '2023-01-01T10:00:00Z',
    };
    const { queryByText } = render(
      <FocusIndicator {...defaultProps} focusState={minimalFocusState} />
    );

    expect(queryByText('Focused Process:')).not.toBeInTheDocument();
    expect(queryByText('Window Title:')).not.toBeInTheDocument();
  });
});
