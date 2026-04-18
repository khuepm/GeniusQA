/**
 * Unit tests for NotificationArea component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NotificationArea } from '../NotificationArea';
import { NotificationData } from '../../types/applicationFocusedAutomation.types';

describe('NotificationArea', () => {
  const mockOnDismissNotification = jest.fn();

  const mockNotifications: NotificationData[] = [
    {
      id: 'notif-1',
      type: 'focus_lost',
      title: 'Focus Lost',
      message: 'Target application lost focus',
      application_name: 'Visual Studio Code',
      timestamp: '2023-01-01T10:00:00Z',
    },
    {
      id: 'notif-2',
      type: 'automation_paused',
      title: 'Automation Paused',
      message: 'Automation has been paused due to focus loss',
      timestamp: '2023-01-01T10:01:00Z',
    },
    {
      id: 'notif-3',
      type: 'error',
      title: 'Error Occurred',
      message: 'An error occurred during automation',
      timestamp: '2023-01-01T10:02:00Z',
    },
  ];

  const defaultProps = {
    notifications: mockNotifications,
    onDismissNotification: mockOnDismissNotification,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when no notifications', () => {
    const { container } = render(
      <NotificationArea notifications={[]} onDismissNotification={mockOnDismissNotification} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render notification header with count', () => {
    const { getByText } = render(<NotificationArea {...defaultProps} />);

    expect(getByText('Notifications')).toBeInTheDocument();
    expect(getByText('3')).toBeInTheDocument();
  });

  it('should render all notifications', () => {
    const { getByText } = render(<NotificationArea {...defaultProps} />);

    expect(getByText('Focus Lost')).toBeInTheDocument();
    expect(getByText('Automation Paused')).toBeInTheDocument();
    expect(getByText('Error Occurred')).toBeInTheDocument();
  });

  it('should render notification icons correctly', () => {
    const { getByText } = render(<NotificationArea {...defaultProps} />);

    expect(getByText('⚠️')).toBeInTheDocument(); // focus_lost
    expect(getByText('⏸️')).toBeInTheDocument(); // automation_paused
    expect(getByText('❌')).toBeInTheDocument(); // error
  });

  it('should render notification messages', () => {
    const { getByText } = render(<NotificationArea {...defaultProps} />);

    expect(getByText('Target application lost focus')).toBeInTheDocument();
    expect(getByText('Automation has been paused due to focus loss')).toBeInTheDocument();
    expect(getByText('An error occurred during automation')).toBeInTheDocument();
  });

  it('should render application name when present', () => {
    const { getByText } = render(<NotificationArea {...defaultProps} />);

    expect(getByText('Application: Visual Studio Code')).toBeInTheDocument();
  });

  it('should call onDismissNotification when dismiss button is clicked', () => {
    const { container } = render(<NotificationArea {...defaultProps} />);

    const dismissButtons = container.querySelectorAll('.dismiss-button');
    fireEvent.click(dismissButtons[0]);

    expect(mockOnDismissNotification).toHaveBeenCalledWith('notif-1');
  });

  it('should render clear all button', () => {
    const { getByText } = render(<NotificationArea {...defaultProps} />);

    expect(getByText('Clear All')).toBeInTheDocument();
  });

  it('should call onDismissNotification for all notifications when clear all is clicked', () => {
    const { getByText } = render(<NotificationArea {...defaultProps} />);

    const clearAllButton = getByText('Clear All');
    fireEvent.click(clearAllButton);

    expect(mockOnDismissNotification).toHaveBeenCalledTimes(3);
    expect(mockOnDismissNotification).toHaveBeenCalledWith('notif-1');
    expect(mockOnDismissNotification).toHaveBeenCalledWith('notif-2');
    expect(mockOnDismissNotification).toHaveBeenCalledWith('notif-3');
  });

  it('should render action hint for focus_lost notifications', () => {
    const { getByText } = render(<NotificationArea {...defaultProps} />);

    expect(getByText('Click to focus application')).toBeInTheDocument();
  });

  it('should apply correct CSS classes for notification types', () => {
    const { container } = render(<NotificationArea {...defaultProps} />);

    expect(container.querySelector('.notification.warning')).toBeInTheDocument();
    expect(container.querySelector('.notification.error')).toBeInTheDocument();
  });

  it('should format timestamp correctly for recent notifications', () => {
    // Mock current time to be 30 seconds after notification
    const mockDate = new Date('2023-01-01T10:00:30Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

    const { getAllByText } = render(<NotificationArea {...defaultProps} />);

    const justNowElements = getAllByText('Just now');
    expect(justNowElements.length).toBeGreaterThan(0);

    jest.restoreAllMocks();
  });

  it('should format timestamp for older notifications', () => {
    // Mock current time to be 2 minutes after notification
    const mockDate = new Date('2023-01-01T10:02:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

    const { container } = render(<NotificationArea {...defaultProps} />);

    // Check that timestamp elements exist
    const timeElements = container.querySelectorAll('.notification-time');
    expect(timeElements.length).toBeGreaterThan(0);

    jest.restoreAllMocks();
  });

  it('should handle notification click for focus_lost type', () => {
    const { container } = render(<NotificationArea {...defaultProps} />);

    const focusLostNotification = container.querySelector('.notification.warning');
    fireEvent.click(focusLostNotification!);

    // Should not throw any errors
    expect(focusLostNotification).toBeInTheDocument();
  });

  it('should prevent event propagation when dismiss button is clicked', () => {
    const { container } = render(<NotificationArea {...defaultProps} />);

    const dismissButton = container.querySelector('.dismiss-button');
    fireEvent.click(dismissButton!);

    expect(mockOnDismissNotification).toHaveBeenCalledWith('notif-1');
  });

  it('should render different notification types with correct icons', () => {
    const differentTypeNotifications: NotificationData[] = [
      {
        id: 'notif-success',
        type: 'focus_gained',
        title: 'Focus Gained',
        message: 'Target application gained focus',
        timestamp: '2023-01-01T10:00:00Z',
      },
      {
        id: 'notif-resume',
        type: 'automation_resumed',
        title: 'Automation Resumed',
        message: 'Automation has been resumed',
        timestamp: '2023-01-01T10:01:00Z',
      },
    ];

    const { getByText } = render(
      <NotificationArea
        notifications={differentTypeNotifications}
        onDismissNotification={mockOnDismissNotification}
      />
    );

    expect(getByText('✅')).toBeInTheDocument(); // focus_gained
    expect(getByText('▶️')).toBeInTheDocument(); // automation_resumed
  });

  it('should render single notification correctly', () => {
    const singleNotification = [mockNotifications[0]];
    const { getByText } = render(
      <NotificationArea
        notifications={singleNotification}
        onDismissNotification={mockOnDismissNotification}
      />
    );

    expect(getByText('1')).toBeInTheDocument();
    expect(getByText('Focus Lost')).toBeInTheDocument();
  });
});
