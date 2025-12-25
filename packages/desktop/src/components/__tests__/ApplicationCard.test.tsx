/**
 * Unit tests for ApplicationCard component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApplicationCard } from '../ApplicationCard';
import { RegisteredApplication, ApplicationStatus, FocusLossStrategy } from '../../types/applicationFocusedAutomation.types';

describe('ApplicationCard', () => {
  const mockOnRemove = jest.fn();
  const mockOnRefreshStatus = jest.fn();

  const mockApplication: RegisteredApplication = {
    id: 'app1',
    name: 'Visual Studio Code',
    executable_path: '/Applications/Visual Studio Code.app',
    process_name: 'Code',
    bundle_id: 'com.microsoft.VSCode',
    process_id: 12345,
    status: ApplicationStatus.Active,
    registered_at: '2023-01-01T00:00:00Z',
    last_seen: '2023-01-01T12:00:00Z',
    default_focus_strategy: FocusLossStrategy.AutoPause,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render application name and process name', () => {
    const { getByText } = render(
      <ApplicationCard
        application={mockApplication}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(getByText('Visual Studio Code')).toBeInTheDocument();
    expect(getByText('Code')).toBeInTheDocument();
  });

  it('should render status indicator with correct icon and text', () => {
    const { getByText } = render(
      <ApplicationCard
        application={mockApplication}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(getByText('🟢')).toBeInTheDocument();
    expect(getByText('Active')).toBeInTheDocument();
  });

  it('should render different status icons for different statuses', () => {
    const inactiveApp = { ...mockApplication, status: ApplicationStatus.Inactive };
    const { getByText } = render(
      <ApplicationCard
        application={inactiveApp}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(getByText('🟡')).toBeInTheDocument();
    expect(getByText('Inactive')).toBeInTheDocument();
  });

  it('should render executable path (filename only)', () => {
    const { getByText } = render(
      <ApplicationCard
        application={mockApplication}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(getByText('Visual Studio Code.app')).toBeInTheDocument();
  });

  it('should render bundle ID when present', () => {
    const { getByText } = render(
      <ApplicationCard
        application={mockApplication}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(getByText('com.microsoft.VSCode')).toBeInTheDocument();
  });

  it('should render process ID when present', () => {
    const { getByText } = render(
      <ApplicationCard
        application={mockApplication}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(getByText('12345')).toBeInTheDocument();
  });

  it('should render focus strategy label', () => {
    const { getByText } = render(
      <ApplicationCard
        application={mockApplication}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(getByText('Auto Pause')).toBeInTheDocument();
  });

  it('should render different focus strategy labels', () => {
    const strictErrorApp = { ...mockApplication, default_focus_strategy: FocusLossStrategy.StrictError };
    const { getByText } = render(
      <ApplicationCard
        application={strictErrorApp}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(getByText('Strict Error')).toBeInTheDocument();
  });

  it('should render registered date', () => {
    const { getAllByText } = render(
      <ApplicationCard
        application={mockApplication}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    const dates = getAllByText('1/1/2023');
    expect(dates.length).toBeGreaterThan(0);
  });

  it('should render last seen date when present', () => {
    const { getAllByText } = render(
      <ApplicationCard
        application={mockApplication}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    const dates = getAllByText('1/1/2023');
    expect(dates.length).toBe(2); // Both registered and last seen dates
  });

  it('should not render bundle ID section when not present', () => {
    const appWithoutBundleId = { ...mockApplication, bundle_id: undefined };
    const { queryByText } = render(
      <ApplicationCard
        application={appWithoutBundleId}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(queryByText('Bundle ID:')).not.toBeInTheDocument();
  });

  it('should not render process ID section when not present', () => {
    const appWithoutProcessId = { ...mockApplication, process_id: undefined };
    const { queryByText } = render(
      <ApplicationCard
        application={appWithoutProcessId}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(queryByText('Process ID:')).not.toBeInTheDocument();
  });

  it('should not render last seen section when not present', () => {
    const appWithoutLastSeen = { ...mockApplication, last_seen: undefined };
    const { queryByText } = render(
      <ApplicationCard
        application={appWithoutLastSeen}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(queryByText('Last Seen:')).not.toBeInTheDocument();
  });

  it('should call onRefreshStatus when refresh button is clicked', () => {
    const { container } = render(
      <ApplicationCard
        application={mockApplication}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    const refreshButton = container.querySelector('.action-button.refresh');
    fireEvent.click(refreshButton!);

    expect(mockOnRefreshStatus).toHaveBeenCalledTimes(1);
  });

  it('should call onRemove when remove button is clicked', () => {
    const { container } = render(
      <ApplicationCard
        application={mockApplication}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    const removeButton = container.querySelector('.action-button.remove');
    fireEvent.click(removeButton!);

    expect(mockOnRemove).toHaveBeenCalledTimes(1);
  });

  it('should apply correct CSS classes for status', () => {
    const { container } = render(
      <ApplicationCard
        application={mockApplication}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(container.querySelector('.status-active')).toBeInTheDocument();
  });

  it('should handle invalid date gracefully', () => {
    const appWithInvalidDate = { ...mockApplication, registered_at: 'invalid-date' };
    const { getByText } = render(
      <ApplicationCard
        application={appWithInvalidDate}
        onRemove={mockOnRemove}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(getByText('Invalid Date')).toBeInTheDocument();
  });
});
