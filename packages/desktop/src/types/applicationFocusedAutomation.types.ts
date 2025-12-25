export interface RegisteredApplication {
  id: string;
  name: string;
  executable_path: string;
  process_name: string;
  bundle_id?: string; // macOS Bundle Identifier
  process_id?: number; // Runtime only
  status: ApplicationStatus;
  registered_at: string; // ISO date string
  last_seen?: string; // ISO date string
  default_focus_strategy: FocusLossStrategy;
}

export enum ApplicationStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  NotFound = 'NotFound',
  Error = 'Error',
  PermissionDenied = 'PermissionDenied', // macOS: Accessibility permission required
  SecureInputBlocked = 'SecureInputBlocked', // macOS: Secure input mode active
}

export enum FocusLossStrategy {
  AutoPause = 'AutoPause', // Default: Pause execution and wait for focus
  StrictError = 'StrictError', // Immediately stop execution and mark as FAILED
  Ignore = 'Ignore', // Log warning but continue execution
}

export interface ApplicationInfo {
  name: string;
  executable_path: string;
  process_name: string;
  bundle_id?: string;
  process_id: number;
}

export interface FocusState {
  is_target_process_focused: boolean;
  focused_process_id?: number;
  focused_window_title?: string;
  last_change: string; // ISO date string
}

export interface PlaybackSession {
  id: string;
  target_app_id: string;
  target_process_id: number;
  state: PlaybackState;
  focus_strategy: FocusLossStrategy;
  current_step: number;
  started_at: string; // ISO date string
  paused_at?: string; // ISO date string
}

export enum PlaybackState {
  Running = 'Running',
  Paused = 'Paused',
  Completed = 'Completed',
  Failed = 'Failed',
  Aborted = 'Aborted',
}

export interface NotificationData {
  id: string;
  type: 'focus_lost' | 'focus_gained' | 'automation_paused' | 'automation_resumed' | 'error';
  title: string;
  message: string;
  application_name?: string;
  timestamp: string; // ISO date string
  timeout?: number; // milliseconds
}

export interface ApplicationFocusConfig {
  focus_check_interval_ms: number;
  max_registered_applications: number;
  auto_resume_delay_ms: number;
  notification_timeout_ms: number;
  enable_focus_notifications: boolean;
  strict_window_validation: boolean;
  default_focus_strategy: FocusLossStrategy;
  use_event_hooks: boolean;
  fallback_polling_enabled: boolean;
}
