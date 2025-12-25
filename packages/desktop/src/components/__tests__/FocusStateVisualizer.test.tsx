/**
 * Unit tests for FocusStateVisualizer component
 */

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FocusStateVisualizer } from '../FocusStateVisualizer';
import { FocusState, RegisteredApplication, ApplicationStatus, FocusLossStrategy } from '../../types/applicationFocusedAutomation.types';

describe('FocusStateVisualizer', () => {
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
    isMonitoring: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render focus monitor header', () => {
    const { getByText } = render(<FocusStateVisualizer {...defaultProps} />);

    expect(getByText('Focus Monitor')).toBeInTheDocument();
  });

  it('should show monitoring active when isMonitoring is true', () => {
    const { getByText } = render(<FocusStateVisualizer {...defaultProps} />);

    expect(getByText('Monitoring')).toBeInTheDocument();
  });

  it('should show monitoring inactive when isMonitoring is false', () => {
    const { container } = render(
      <FocusStateVisualizer {...defaultProps} isMonitoring={false} />
    );

    expect(container.querySelector('.monitoring-indicator.inactive')).toBeInTheDocument();
    expect(container.querySelector('.monitoring-indicator .indicator-text')).toHaveTextContent('Inactive');
  });

  it('should render focused state correctly', () => {
    const { getByText, container } = render(<FocusStateVisualizer {...defaultProps} />);

    expect(container.querySelector('.focus-icon')).toHaveTextContent('🎯');
    expect(getByText('Target Focused')).toBeInTheDocument();
    expect(getByText('Automation can proceed safely')).toBeInTheDocument();
  });

  it('should render unfocused state correctly', () => {
    const unfocusedState = { ...mockFocusState, is_target_process_focused: false };
    const { getByText, container } = render(
      <FocusStateVisualizer {...defaultProps} focusState={unfocusedState} />
    );

    expect(container.querySelector('.focus-icon')).toHaveTextContent('⚠️');
    expect(getByText('Focus Lost')).toBeInTheDocument();
    expect(getByText('Automation may be paused or restricted')).toBeInTheDocument();
  });

  it('should render inactive state when not monitoring', () => {
    const { getByText, container } = render(
      <FocusStateVisualizer {...defaultProps} isMonitoring={false} />
    );

    expect(container.querySelector('.focus-icon')).toHaveTextContent('⏸️');
    expect(getByText('Not Monitoring')).toBeInTheDocument();
    expect(getByText('Focus monitoring is not active')).toBeInTheDocument();
  });

  it('should render unknown state when no focus state', () => {
    const { getByText } = render(
      <FocusStateVisualizer {...defaultProps} focusState={null} />
    );

    expect(getByText('❓')).toBeInTheDocument();
    expect(getByText('Unknown State')).toBeInTheDocument();
    expect(getByText('Unable to determine focus state')).toBeInTheDocument();
  });

  it('should render target application info', () => {
    const { getByText, getAllByText } = render(<FocusStateVisualizer {...defaultProps} />);

    expect(getByText('Target Application')).toBeInTheDocument();
    const vscodeElements = getAllByText('Visual Studio Code');
    expect(vscodeElements.length).toBeGreaterThan(0);
    expect(getByText('PID: 12345')).toBeInTheDocument();
  });

  it('should render focus metrics when focus state exists', () => {
    const { getByText } = render(<FocusStateVisualizer {...defaultProps} />);

    expect(getByText('Last Change')).toBeInTheDocument();
    expect(getByText('Current Focus')).toBeInTheDocument();
    expect(getByText('PID 12345')).toBeInTheDocument();
    expect(getByText('Window')).toBeInTheDocument();
  });

  it('should truncate long window titles', () => {
    const longTitleState = {
      ...mockFocusState,
      focused_window_title: 'This is a very long window title that should be truncated'
    };
    const { getByText } = render(
      <FocusStateVisualizer {...defaultProps} focusState={longTitleState} />
    );

    expect(getByText('This is a very long ...')).toBeInTheDocument();
  });

  it('should render visualization legend', () => {
    const { getByText } = render(<FocusStateVisualizer {...defaultProps} />);

    expect(getByText('Focused')).toBeInTheDocument();
    expect(getByText('Unfocused')).toBeInTheDocument();
    expect(getByText('Inactive')).toBeInTheDocument();
  });

  it('should apply correct CSS classes for focused state', () => {
    const { container } = render(<FocusStateVisualizer {...defaultProps} />);

    expect(container.querySelector('.focus-state-visualizer.focused')).toBeInTheDocument();
  });

  it('should apply correct CSS classes for unfocused state', () => {
    const unfocusedState = { ...mockFocusState, is_target_process_focused: false };
    const { container } = render(
      <FocusStateVisualizer {...defaultProps} focusState={unfocusedState} />
    );

    expect(container.querySelector('.focus-state-visualizer.unfocused')).toBeInTheDocument();
  });

  it('should apply correct CSS classes for inactive state', () => {
    const { container } = render(
      <FocusStateVisualizer {...defaultProps} isMonitoring={false} />
    );

    expect(container.querySelector('.focus-state-visualizer.inactive')).toBeInTheDocument();
  });

  it('should handle missing target application gracefully', () => {
    const { queryByText } = render(
      <FocusStateVisualizer {...defaultProps} targetApplication={null} />
    );

    expect(queryByText('Target Application')).not.toBeInTheDocument();
  });

  it('should handle missing focus state details gracefully', () => {
    const minimalFocusState: FocusState = {
      is_target_process_focused: true,
      last_change: '2023-01-01T10:00:00Z',
    };
    const { queryByText } = render(
      <FocusStateVisualizer {...defaultProps} focusState={minimalFocusState} />
    );

    expect(queryByText('Current Focus')).not.toBeInTheDocument();
    expect(queryByText('Window')).not.toBeInTheDocument();
  });

  it('should render monitoring indicator with correct class', () => {
    const { container } = render(<FocusStateVisualizer {...defaultProps} />);

    expect(container.querySelector('.monitoring-indicator.active')).toBeInTheDocument();
  });

  it('should render focus circle with correct styling', () => {
    const { container } = render(<FocusStateVisualizer {...defaultProps} />);

    expect(container.querySelector('.focus-circle')).toBeInTheDocument();
    expect(container.querySelector('.focus-icon')).toBeInTheDocument();
  });
});
