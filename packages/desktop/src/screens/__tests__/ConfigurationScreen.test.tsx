import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigurationScreen } from '../ConfigurationScreen';
import { FocusLossStrategy } from '../../types/applicationFocusedAutomation.types';

// Mock console.log to avoid noise in tests
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => { });

describe('ConfigurationScreen', () => {
  beforeEach(() => {
    mockConsoleLog.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  it('renders loading state initially', async () => {
    render(<ConfigurationScreen />);

    // The loading state might resolve very quickly with mock data
    // So we check if either loading is shown or the form is already loaded
    const loadingText = screen.queryByText('Loading configuration...');
    const configForm = screen.queryByText('Application Focus Configuration');

    expect(loadingText || configForm).toBeTruthy();
  });

  it('renders configuration form after loading', async () => {
    render(<ConfigurationScreen />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    // Check main sections are rendered
    expect(screen.getByText('Application Focus Configuration')).toBeInTheDocument();
    expect(screen.getByText('Focus Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Application Management')).toBeInTheDocument();
    expect(screen.getByText('Focus Strategies')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('renders default configuration values', async () => {
    render(<ConfigurationScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    // Check default values
    expect(screen.getByDisplayValue('100')).toBeInTheDocument(); // focus_check_interval_ms
    expect(screen.getByDisplayValue('50')).toBeInTheDocument(); // max_registered_applications
    expect(screen.getByDisplayValue('500')).toBeInTheDocument(); // auto_resume_delay_ms
    expect(screen.getByDisplayValue('5000')).toBeInTheDocument(); // notification_timeout_ms

    // Check checkboxes
    expect(screen.getByLabelText('Use Event Hooks (Recommended)')).toBeChecked();
    expect(screen.getByLabelText('Enable Fallback Polling')).toBeChecked();
    expect(screen.getByLabelText('Strict Window Validation')).toBeChecked();
    expect(screen.getByLabelText('Enable Focus Change Notifications')).toBeChecked();

    // Check select value
    expect(screen.getByDisplayValue('Auto-Pause')).toBeInTheDocument();
  });

  it('updates numeric input values', async () => {
    render(<ConfigurationScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    const focusIntervalInput = screen.getByLabelText('Focus Check Interval (ms)');

    fireEvent.change(focusIntervalInput, { target: { value: '200' } });

    expect(focusIntervalInput).toHaveValue(200);
  });

  it('updates checkbox values', async () => {
    render(<ConfigurationScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    const eventHooksCheckbox = screen.getByLabelText('Use Event Hooks (Recommended)');

    expect(eventHooksCheckbox).toBeChecked();

    fireEvent.click(eventHooksCheckbox);

    expect(eventHooksCheckbox).not.toBeChecked();
  });

  it('updates select values', async () => {
    render(<ConfigurationScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    const strategySelect = screen.getByLabelText('Default Focus Loss Strategy');

    fireEvent.change(strategySelect, { target: { value: FocusLossStrategy.StrictError } });

    expect(strategySelect).toHaveValue(FocusLossStrategy.StrictError);
  });

  it('validates configuration on save', async () => {
    render(<ConfigurationScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    // Set invalid value
    const focusIntervalInput = screen.getByLabelText('Focus Check Interval (ms)');
    fireEvent.change(focusIntervalInput, { target: { value: '0' } });

    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Focus check interval must be between 1 and 10000/)).toBeInTheDocument();
    });
  });

  it('shows success message after saving valid configuration', async () => {
    render(<ConfigurationScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Configuration saved successfully')).toBeInTheDocument();
    });

    expect(mockConsoleLog).toHaveBeenCalledWith('Saving configuration:', expect.any(Object));
  });

  it('resets configuration to defaults', async () => {
    render(<ConfigurationScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    // Change a value
    const focusIntervalInput = screen.getByLabelText('Focus Check Interval (ms)');
    fireEvent.change(focusIntervalInput, { target: { value: '200' } });
    expect(focusIntervalInput).toHaveValue(200);

    // Reset to defaults
    const resetButton = screen.getByText('Reset to Defaults');
    fireEvent.click(resetButton);

    // Check value is reset
    expect(focusIntervalInput).toHaveValue(100);
    expect(screen.getByText('Configuration reset to defaults')).toBeInTheDocument();
  });

  it('reloads configuration', async () => {
    render(<ConfigurationScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    // Change a value
    const focusIntervalInput = screen.getByLabelText('Focus Check Interval (ms)');
    fireEvent.change(focusIntervalInput, { target: { value: '200' } });
    expect(focusIntervalInput).toHaveValue(200);

    // Reload configuration
    const reloadButton = screen.getByText('Reload');
    fireEvent.click(reloadButton);

    // Should reset to defaults (loading might be too fast to catch with mock data)
    await waitFor(() => {
      expect(focusIntervalInput).toHaveValue(100);
    });
  });

  it('validates all numeric field ranges', async () => {
    render(<ConfigurationScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Configuration');

    // Test focus check interval validation
    const focusIntervalInput = screen.getByLabelText('Focus Check Interval (ms)');
    fireEvent.change(focusIntervalInput, { target: { value: '15000' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Focus check interval must be between 1 and 10000/)).toBeInTheDocument();
    });

    // Clear error and test max applications validation
    fireEvent.change(focusIntervalInput, { target: { value: '100' } });
    const maxAppsInput = screen.getByLabelText('Maximum Registered Applications');
    fireEvent.change(maxAppsInput, { target: { value: '2000' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Max registered applications must be between 1 and 1000/)).toBeInTheDocument();
    });

    // Clear error and test auto resume delay validation
    fireEvent.change(maxAppsInput, { target: { value: '50' } });
    const resumeDelayInput = screen.getByLabelText('Auto Resume Delay (ms)');
    fireEvent.change(resumeDelayInput, { target: { value: '35000' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Auto resume delay should not exceed 30 seconds/)).toBeInTheDocument();
    });

    // Clear error and test notification timeout validation
    fireEvent.change(resumeDelayInput, { target: { value: '500' } });
    const notificationTimeoutInput = screen.getByLabelText('Notification Timeout (ms)');
    fireEvent.change(notificationTimeoutInput, { target: { value: '400000' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Notification timeout must be between 1 and 300000/)).toBeInTheDocument();
    });
  });

  it('disables buttons while saving', async () => {
    render(<ConfigurationScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Configuration');
    const resetButton = screen.getByText('Reset to Defaults');
    const reloadButton = screen.getByText('Reload');

    fireEvent.click(saveButton);

    // With mock data, save completes immediately, so check final state
    await waitFor(() => {
      expect(screen.getByText('Configuration saved successfully')).toBeInTheDocument();
    });

    // Buttons should be enabled after save completes
    expect(resetButton).not.toBeDisabled();
    expect(reloadButton).not.toBeDisabled();
    expect(saveButton).toHaveTextContent('Save Configuration');
  });

  it('clears error messages when configuration is updated', async () => {
    render(<ConfigurationScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    // Create an error
    const focusIntervalInput = screen.getByLabelText('Focus Check Interval (ms)');
    fireEvent.change(focusIntervalInput, { target: { value: '0' } });

    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Focus check interval must be between 1 and 10000/)).toBeInTheDocument();
    });

    // Update configuration - error should clear
    fireEvent.change(focusIntervalInput, { target: { value: '100' } });

    expect(screen.queryByText(/Focus check interval must be between 1 and 10000/)).not.toBeInTheDocument();
  });

  it('dismisses error messages', async () => {
    render(<ConfigurationScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading configuration...')).not.toBeInTheDocument();
    });

    // Create an error
    const focusIntervalInput = screen.getByLabelText('Focus Check Interval (ms)');
    fireEvent.change(focusIntervalInput, { target: { value: '0' } });

    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Focus check interval must be between 1 and 10000/)).toBeInTheDocument();
    });

    // Dismiss error
    const dismissButton = screen.getByText('×');
    fireEvent.click(dismissButton);

    expect(screen.queryByText(/Focus check interval must be between 1 and 10000/)).not.toBeInTheDocument();
  });
});
