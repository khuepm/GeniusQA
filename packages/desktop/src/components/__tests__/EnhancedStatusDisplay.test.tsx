import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EnhancedStatusDisplay } from '../EnhancedStatusDisplay';
import {
  FocusState,
  PlaybackSession,
  PlaybackState,
  RegisteredApplication,
  ApplicationStatus,
  NotificationData,
  FocusLossStrategy
} from '../../types/applicationFocusedAutomation.types';

// Mock Tauri API
jest.mock('@tauri-apps/api/tauri', () => ({
  invoke: jest.fn(),
}));

const { invoke: mockInvoke } = require('@tauri-apps/api/tauri');

describe('EnhancedStatusDisplay', () => {
  const mockOnRetryConnection = jest.fn();
  const mockOnDismissNotification = jest.fn();

  const mockFocusState: FocusState = {
    is_target_process_focused: true,
    focused_process_id: 1234,
    focused_window_title: 'Test Application',
    last_change: '2023-12-01T10:00:00Z'
  };

  const mockPlaybackSession: PlaybackSession = {
    id: 'session-123',
    target_app_id: 'app-123',
    target_process_id: 1234,
    state: PlaybackState.Running,
    focus_strategy: FocusLossStrategy.AutoPause,
    current_step: 5,
    total_steps: 10,
    started_at: '2023-12-01T09:00:00Z',
    paused_at: null,
    paused_reason: null,
    error_message: null
  };

  const mockTargetApplication: RegisteredApplication = {
    id: 'app-123',
    name: 'Test Application',
    executable_path: '/path/to/app',
    process_name: 'test-app',
    bundle_id: 'com.test.app',
    process_id: 1234,
    window_handle: null,
    status: ApplicationStatus.Active,
    registered_at: '2023-12-01T08:00:00Z',
    last_seen: '2023-12-01T10:00:00Z',
    default_focus_strategy: FocusLossStrategy.AutoPause
  };

  const mockNotifications: NotificationData[] = [
    {
      id: 'notif-1',
      type: 'info',
      title: 'Focus Changed',
      message: 'Application focus has changed',
      timestamp: '2023-12-01T10:00:00Z',
      timeout: 5000,
      actions: []
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockResolvedValue({
      status: 'healthy',
      uptime: 3600,
      performance_metrics: {
        focus_check_latency_ms: 10,
        event_processing_rate: 100,
        memory_usage_mb: 50
      }
    });
  });

  const renderEnhancedStatusDisplay = (props = {}) => {
    const defaultProps = {
      focusState: mockFocusState,
      playbackSession: mockPlaybackSession,
      targetApplication: mockTargetApplication,
      notifications: mockNotifications,
      isConnected: true,
      connectionError: null,
      onRetryConnection: mockOnRetryConnection,
      onDismissNotification: mockOnDismissNotification,
      ...props
    };

    return render(<EnhancedStatusDisplay {...defaultProps} />);
  };

  it('should render status header with connected state', () => {
    renderEnhancedStatusDisplay();

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it('should render disconnected state when not connected', () => {
    renderEnhancedStatusDisplay({ isConnected: false });

    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('should show connection error banner when there is an error', () => {
    renderEnhancedStatusDisplay({
      connectionError: 'Failed to connect to service',
      isConnected: false
    });

    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText('Failed to connect to service')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should call onRetryConnection when retry button is clicked', () => {
    renderEnhancedStatusDisplay({
      connectionError: 'Failed to connect to service',
      isConnected: false
    });

    fireEvent.click(screen.getByText('Retry'));

    expect(mockOnRetryConnection).toHaveBeenCalledTimes(1);
  });

  it('should render playback status card', () => {
    renderEnhancedStatusDisplay();

    expect(screen.getByText('Playback')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Automation is actively running')).toBeInTheDocument();
  });

  it('should render focus status card', () => {
    renderEnhancedStatusDisplay();

    expect(screen.getByText('Focus')).toBeInTheDocument();
    expect(screen.getByText('Focused')).toBeInTheDocument();
    expect(screen.getByText('Target application is currently focused')).toBeInTheDocument();
  });

  it('should render target application card', () => {
    renderEnhancedStatusDisplay();

    expect(screen.getByText('Target App')).toBeInTheDocument();
    expect(screen.getByText('Test Application')).toBeInTheDocument();
    expect(screen.getByText('Status: Active (PID: 1234)')).toBeInTheDocument();
  });

  it('should show paused playback status', () => {
    const pausedSession = {
      ...mockPlaybackSession,
      state: PlaybackState.Paused,
      paused_reason: 'FocusLost'
    };

    renderEnhancedStatusDisplay({ playbackSession: pausedSession });

    expect(screen.getByText('Paused (FocusLost)')).toBeInTheDocument();
    expect(screen.getByText('Automation paused due to: FocusLost')).toBeInTheDocument();
  });

  it('should show failed playback status', () => {
    const failedSession = {
      ...mockPlaybackSession,
      state: PlaybackState.Failed,
      error_message: 'Application crashed'
    };

    renderEnhancedStatusDisplay({ playbackSession: failedSession });

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Automation failed: Application crashed')).toBeInTheDocument();
  });

  it('should show not focused state', () => {
    const notFocusedState = {
      ...mockFocusState,
      is_target_process_focused: false,
      focused_window_title: 'Other Application'
    };

    renderEnhancedStatusDisplay({ focusState: notFocusedState });

    expect(screen.getByText('Not Focused')).toBeInTheDocument();
    expect(screen.getByText('Currently focused: Other Application')).toBeInTheDocument();
  });

  it('should expand and collapse details', async () => {
    renderEnhancedStatusDisplay();

    // Initially collapsed
    expect(screen.queryByText('Service Health')).not.toBeInTheDocument();

    // Expand
    fireEvent.click(screen.getByTitle('Expand details'));

    await waitFor(() => {
      expect(screen.getByText('Service Health')).toBeInTheDocument();
    });

    // Collapse
    fireEvent.click(screen.getByTitle('Collapse details'));

    await waitFor(() => {
      expect(screen.queryByText('Service Health')).not.toBeInTheDocument();
    });
  });

  it('should show service health metrics when expanded', async () => {
    renderEnhancedStatusDisplay();

    fireEvent.click(screen.getByTitle('Expand details'));

    await waitFor(() => {
      expect(screen.getByText('Service Health')).toBeInTheDocument();
      expect(screen.getByText('HEALTHY')).toBeInTheDocument();
      expect(screen.getByText('1h 0m 0s')).toBeInTheDocument(); // Uptime
      expect(screen.getByText('10ms')).toBeInTheDocument(); // Latency
      expect(screen.getByText('100/s')).toBeInTheDocument(); // Event rate
      expect(screen.getByText('50MB')).toBeInTheDocument(); // Memory
    });
  });

  it('should show session details when expanded', async () => {
    renderEnhancedStatusDisplay();

    fireEvent.click(screen.getByTitle('Expand details'));

    await waitFor(() => {
      expect(screen.getByText('Session Details')).toBeInTheDocument();
      expect(screen.getByText('session-123')).toBeInTheDocument();
      expect(screen.getByText('AutoPause')).toBeInTheDocument();
      expect(screen.getByText('5 / 10')).toBeInTheDocument();
    });
  });

  it('should show focus details when expanded', async () => {
    renderEnhancedStatusDisplay();

    fireEvent.click(screen.getByTitle('Expand details'));

    await waitFor(() => {
      expect(screen.getByText('Focus Details')).toBeInTheDocument();
      expect(screen.getByText('Yes')).toBeInTheDocument(); // Target focused
      expect(screen.getByText('1234')).toBeInTheDocument(); // Focused PID
      // Use getAllByText for the duplicate text and check the specific one in focus details
      const testAppTexts = screen.getAllByText('Test Application');
      expect(testAppTexts.length).toBeGreaterThan(1); // Should appear in both places
      expect(screen.getByText('5:00:00 PM')).toBeInTheDocument(); // Last change time
    });
  });

  it('should render active notifications', () => {
    renderEnhancedStatusDisplay();

    expect(screen.getByText('Active Notifications')).toBeInTheDocument();
    expect(screen.getByText('Focus Changed')).toBeInTheDocument();
    expect(screen.getByText('Application focus has changed')).toBeInTheDocument();
  });

  it('should dismiss notifications', () => {
    renderEnhancedStatusDisplay();

    const dismissButton = screen.getByTitle('Dismiss notification');
    fireEvent.click(dismissButton);

    expect(mockOnDismissNotification).toHaveBeenCalledWith('notif-1');
  });

  it('should handle no playback session', () => {
    renderEnhancedStatusDisplay({ playbackSession: null });

    expect(screen.getByText('No active session')).toBeInTheDocument();
    expect(screen.getByText('No automation session is currently running')).toBeInTheDocument();
  });

  it('should handle no focus state', () => {
    renderEnhancedStatusDisplay({ focusState: null });

    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('Focus state is not available')).toBeInTheDocument();
  });

  it('should handle no target application', () => {
    renderEnhancedStatusDisplay({ targetApplication: null });

    expect(screen.queryByText('Target App')).not.toBeInTheDocument();
  });

  it('should handle empty notifications', () => {
    renderEnhancedStatusDisplay({ notifications: [] });

    expect(screen.queryByText('Active Notifications')).not.toBeInTheDocument();
  });

  it('should fetch service health on mount', async () => {
    renderEnhancedStatusDisplay();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_service_health');
    });
  });

  it('should handle service health fetch error', async () => {
    mockInvoke.mockRejectedValue(new Error('Service unavailable'));

    renderEnhancedStatusDisplay();

    fireEvent.click(screen.getByTitle('Expand details'));

    await waitFor(() => {
      expect(screen.getByText('UNHEALTHY')).toBeInTheDocument();
    });
  });
});
