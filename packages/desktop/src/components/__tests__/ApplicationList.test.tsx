/**
 * Unit tests for ApplicationList component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApplicationList } from '../ApplicationList';
import { RegisteredApplication, ApplicationStatus, FocusLossStrategy } from '../../types/applicationFocusedAutomation.types';

// Mock ApplicationCard component
jest.mock('../ApplicationCard', () => ({
  ApplicationCard: ({ application, onRemove, onRefreshStatus }: any) => (
    <div data-testid={`application-card-${application.id}`}>
      <span>{application.name}</span>
      <button onClick={onRemove} data-testid={`remove-${application.id}`}>Remove</button>
      <button onClick={onRefreshStatus} data-testid={`refresh-${application.id}`}>Refresh</button>
    </div>
  ),
}));

describe('ApplicationList', () => {
  const mockOnRemoveApplication = jest.fn();
  const mockOnRefreshStatus = jest.fn();

  const mockApplications: RegisteredApplication[] = [
    {
      id: 'app1',
      name: 'Visual Studio Code',
      executable_path: '/Applications/Visual Studio Code.app',
      process_name: 'Code',
      bundle_id: 'com.microsoft.VSCode',
      status: ApplicationStatus.Active,
      registered_at: '2023-01-01T00:00:00Z',
      default_focus_strategy: FocusLossStrategy.AutoPause,
    },
    {
      id: 'app2',
      name: 'Chrome',
      executable_path: '/Applications/Google Chrome.app',
      process_name: 'Chrome',
      bundle_id: 'com.google.Chrome',
      status: ApplicationStatus.Inactive,
      registered_at: '2023-01-02T00:00:00Z',
      default_focus_strategy: FocusLossStrategy.StrictError,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render empty state when no applications', () => {
    const { getByText } = render(
      <ApplicationList
        applications={[]}
        onRemoveApplication={mockOnRemoveApplication}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(getByText('No Applications Registered')).toBeInTheDocument();
    expect(getByText('Add applications to enable focused automation')).toBeInTheDocument();
  });

  it('should render application count correctly', () => {
    const { getByText } = render(
      <ApplicationList
        applications={mockApplications}
        onRemoveApplication={mockOnRemoveApplication}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(getByText('2 applications')).toBeInTheDocument();
  });

  it('should render singular application count', () => {
    const { getByText } = render(
      <ApplicationList
        applications={[mockApplications[0]]}
        onRemoveApplication={mockOnRemoveApplication}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(getByText('1 application')).toBeInTheDocument();
  });

  it('should render all applications as cards', () => {
    const { getByTestId } = render(
      <ApplicationList
        applications={mockApplications}
        onRemoveApplication={mockOnRemoveApplication}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(getByTestId('application-card-app1')).toBeInTheDocument();
    expect(getByTestId('application-card-app2')).toBeInTheDocument();
  });

  it('should call onRemoveApplication when remove button is clicked', () => {
    const { getByTestId } = render(
      <ApplicationList
        applications={mockApplications}
        onRemoveApplication={mockOnRemoveApplication}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    const removeButton = getByTestId('remove-app1');
    fireEvent.click(removeButton);

    expect(mockOnRemoveApplication).toHaveBeenCalledWith('app1');
  });

  it('should call onRefreshStatus when refresh button is clicked', () => {
    const { getByTestId } = render(
      <ApplicationList
        applications={mockApplications}
        onRemoveApplication={mockOnRemoveApplication}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    const refreshButton = getByTestId('refresh-app1');
    fireEvent.click(refreshButton);

    expect(mockOnRefreshStatus).toHaveBeenCalled();
  });

  it('should render empty state icon', () => {
    const { container } = render(
      <ApplicationList
        applications={[]}
        onRemoveApplication={mockOnRemoveApplication}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(container.querySelector('.empty-icon')).toBeInTheDocument();
  });

  it('should render applications grid when applications exist', () => {
    const { container } = render(
      <ApplicationList
        applications={mockApplications}
        onRemoveApplication={mockOnRemoveApplication}
        onRefreshStatus={mockOnRefreshStatus}
      />
    );

    expect(container.querySelector('.applications-grid')).toBeInTheDocument();
  });
});
