//! Core data types for application-focused automation

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Strategy for handling focus loss during automation
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum FocusLossStrategy {
    /// Default: Pause execution and wait for focus return
    AutoPause,
    /// Immediately stop execution and mark as FAILED
    StrictError,
    /// Log warning but continue execution
    Ignore,
}

impl Default for FocusLossStrategy {
    fn default() -> Self {
        FocusLossStrategy::AutoPause
    }
}

/// Status of a registered application
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ApplicationStatus {
    /// Application is currently running and accessible
    Active,
    /// Application is not currently running
    Inactive,
    /// Application was not found on the system
    NotFound,
    /// An error occurred while checking application status
    Error(String),
    /// macOS: Accessibility permission required
    PermissionDenied,
    /// macOS: Secure input mode active
    SecureInputBlocked,
}

/// Platform-agnostic window handle
#[derive(Debug, Clone)]
pub enum WindowHandle {
    #[cfg(target_os = "windows")]
    Windows(isize), // HWND
    #[cfg(target_os = "macos")]
    MacOS(u32), // CGWindowID
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    Unsupported,
}

/// Information about an application available for registration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationInfo {
    /// Display name of the application
    pub name: String,
    /// Path to the application executable
    pub executable_path: String,
    /// Process name for identification
    pub process_name: String,
    /// Current process ID
    pub process_id: u32,
    /// macOS: Bundle Identifier
    pub bundle_id: Option<String>,
    /// Window handle for the main window
    #[serde(skip)]
    pub window_handle: Option<WindowHandle>,
}

/// Information about a registered application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisteredApplication {
    /// Unique identifier for this registration
    pub id: String,
    /// Display name of the application
    pub name: String,
    /// Path to the application executable
    pub executable_path: String,
    /// Process name for identification
    pub process_name: String,
    /// macOS: Bundle Identifier for persistence
    pub bundle_id: Option<String>,
    /// Runtime only - current process ID (not persisted)
    #[serde(skip)]
    pub process_id: Option<u32>,
    /// Runtime only - current window handle (not persisted)
    #[serde(skip)]
    pub window_handle: Option<WindowHandle>,
    /// Current status of the application
    pub status: ApplicationStatus,
    /// When this application was registered
    pub registered_at: DateTime<Utc>,
    /// Last time this application was seen running
    pub last_seen: Option<DateTime<Utc>>,
    /// Default focus loss strategy for this application
    pub default_focus_strategy: FocusLossStrategy,
}

impl RegisteredApplication {
    /// Create a new registered application
    pub fn new(
        name: String,
        executable_path: String,
        process_name: String,
        bundle_id: Option<String>,
    ) -> Self {
        use uuid::Uuid;
        
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            executable_path,
            process_name,
            bundle_id,
            process_id: None,
            window_handle: None,
            status: ApplicationStatus::Inactive,
            registered_at: Utc::now(),
            last_seen: None,
            default_focus_strategy: FocusLossStrategy::default(),
        }
    }
    
    /// Update the application status
    pub fn update_status(&mut self, status: ApplicationStatus) {
        // Update last_seen timestamp when application becomes active
        if matches!(status, ApplicationStatus::Active) {
            self.last_seen = Some(Utc::now());
        }
        
        self.status = status;
    }
}

/// Focus State represents the current focus state of the target application
#[derive(Debug, Clone)]
pub struct FocusState {
    /// Whether the target process is currently focused
    pub is_target_process_focused: bool,
    /// Process ID of the currently focused application
    pub focused_process_id: Option<u32>,
    /// Title of the currently focused window
    pub focused_window_title: Option<String>,
    /// When this focus state was last updated
    pub last_change: DateTime<Utc>,
}

impl FocusState {
    /// Create a new focus state
    pub fn new(
        is_target_process_focused: bool,
        focused_process_id: Option<u32>,
        focused_window_title: Option<String>,
    ) -> Self {
        Self {
            is_target_process_focused,
            focused_process_id,
            focused_window_title,
            last_change: Utc::now(),
        }
    }

    /// Create an unfocused state
    pub fn unfocused() -> Self {
        Self::new(false, None, None)
    }
}

/// Focus Event represents a change in application focus
#[derive(Debug, Clone)]
pub enum FocusEvent {
    /// Target process gained focus
    TargetProcessGainedFocus {
        app_id: String,
        process_id: u32,
        window_title: String,
        timestamp: DateTime<Utc>,
    },
    /// Target process lost focus
    TargetProcessLostFocus {
        app_id: String,
        process_id: u32,
        new_focused_app: Option<String>,
        timestamp: DateTime<Utc>,
    },
    /// Error occurred during focus monitoring
    FocusError {
        error: String,
        timestamp: DateTime<Utc>,
    },
}

impl FocusEvent {
    /// Get the timestamp of this event
    pub fn timestamp(&self) -> DateTime<Utc> {
        match self {
            FocusEvent::TargetProcessGainedFocus { timestamp, .. } => *timestamp,
            FocusEvent::TargetProcessLostFocus { timestamp, .. } => *timestamp,
            FocusEvent::FocusError { timestamp, .. } => *timestamp,
        }
    }

    /// Get the app_id if this event relates to a specific application
    pub fn app_id(&self) -> Option<&str> {
        match self {
            FocusEvent::TargetProcessGainedFocus { app_id, .. } => Some(app_id),
            FocusEvent::TargetProcessLostFocus { app_id, .. } => Some(app_id),
            FocusEvent::FocusError { .. } => None,
        }
    }
}
/// Reason for playback pause
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PauseReason {
    /// Focus was lost from target application
    FocusLost,
    /// User manually requested pause
    UserRequested,
    /// Application encountered an error
    ApplicationError,
    /// Validation failed for automation action
    ValidationFailed,
}

/// Current state of playback session
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PlaybackState {
    /// Automation is currently running
    Running,
    /// Automation is paused for the given reason
    Paused(PauseReason),
    /// Automation completed successfully
    Completed,
    /// Automation failed with error message
    Failed(String),
    /// Automation was aborted with reason
    Aborted(String),
}

/// Detailed error report for focus-related failures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusErrorReport {
    /// Unique identifier for this error report
    pub report_id: String,
    /// Session ID where the error occurred
    pub session_id: String,
    /// Target application that lost focus
    pub target_app_id: String,
    /// Target application process ID
    pub target_process_id: u32,
    /// Application that gained focus (caused the error)
    pub new_focused_app: Option<String>,
    /// Focus loss strategy that was active
    pub focus_strategy: FocusLossStrategy,
    /// Timestamp when focus was lost
    pub focus_lost_at: DateTime<Utc>,
    /// Current step in automation when error occurred
    pub current_step: usize,
    /// Total session duration before error
    pub session_duration: chrono::Duration,
    /// Error message
    pub error_message: String,
    /// Additional context information
    pub context: Option<String>,
}

/// Warning severity levels for the warning logging system
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum WarningSeverity {
    /// Low severity - informational warnings
    Low,
    /// Medium severity - potential issues that should be noted
    Medium,
    /// High severity - significant issues that may affect automation quality
    High,
}

/// Category of warnings for better organization and filtering
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum WarningCategory {
    /// Focus-related warnings
    Focus,
    /// Application state warnings
    Application,
    /// Automation execution warnings
    Execution,
    /// System-level warnings
    System,
}

/// Structured warning entry for the warning logging system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarningEntry {
    /// Unique identifier for this warning
    pub warning_id: String,
    /// Session ID where the warning occurred
    pub session_id: String,
    /// Target application ID
    pub target_app_id: String,
    /// Warning category for organization
    pub category: WarningCategory,
    /// Severity level of the warning
    pub severity: WarningSeverity,
    /// Warning message
    pub message: String,
    /// Timestamp when warning was generated
    pub timestamp: DateTime<Utc>,
    /// Current step in automation when warning occurred
    pub current_step: usize,
    /// Additional context information
    pub context: Option<String>,
    /// Related data (e.g., application that gained focus)
    pub related_data: Option<serde_json::Value>,
}

impl WarningEntry {
    /// Create a new warning entry
    pub fn new(
        session_id: String,
        target_app_id: String,
        category: WarningCategory,
        severity: WarningSeverity,
        message: String,
        current_step: usize,
    ) -> Self {
        use uuid::Uuid;
        
        Self {
            warning_id: Uuid::new_v4().to_string(),
            session_id,
            target_app_id,
            category,
            severity,
            message,
            timestamp: Utc::now(),
            current_step,
            context: None,
            related_data: None,
        }
    }
    
    /// Add context information to the warning
    pub fn with_context(mut self, context: String) -> Self {
        self.context = Some(context);
        self
    }
    
    /// Add related data to the warning
    pub fn with_related_data(mut self, data: serde_json::Value) -> Self {
        self.related_data = Some(data);
        self
    }
}

/// Automation progress snapshot for state preservation during errors (Requirement 8.5)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationProgressSnapshot {
    /// Unique identifier for this snapshot
    pub snapshot_id: String,
    /// Session ID that this snapshot belongs to
    pub session_id: String,
    /// Target application ID
    pub target_app_id: String,
    /// Target application process ID at time of snapshot
    pub target_process_id: u32,
    /// Current step in automation when snapshot was taken
    pub current_step: usize,
    /// Session state at time of snapshot
    pub session_state: PlaybackState,
    /// Focus loss strategy that was active
    pub focus_strategy: FocusLossStrategy,
    /// When the original session was started
    pub started_at: DateTime<Utc>,
    /// When the session was paused (if applicable)
    pub paused_at: Option<DateTime<Utc>>,
    /// When the session was last resumed (if applicable)
    pub resumed_at: Option<DateTime<Utc>>,
    /// Total pause duration at time of snapshot
    pub total_pause_duration: chrono::Duration,
    /// When this snapshot was created
    pub saved_at: DateTime<Utc>,
    /// Error context that led to this snapshot (if any)
    pub error_context: Option<String>,
}

impl AutomationProgressSnapshot {
    /// Create a new progress snapshot
    pub fn new(
        session_id: String,
        target_app_id: String,
        target_process_id: u32,
        current_step: usize,
        session_state: PlaybackState,
        focus_strategy: FocusLossStrategy,
        started_at: DateTime<Utc>,
    ) -> Self {
        use uuid::Uuid;
        
        Self {
            snapshot_id: Uuid::new_v4().to_string(),
            session_id,
            target_app_id,
            target_process_id,
            current_step,
            session_state,
            focus_strategy,
            started_at,
            paused_at: None,
            resumed_at: None,
            total_pause_duration: chrono::Duration::zero(),
            saved_at: Utc::now(),
            error_context: None,
        }
    }
    
    /// Add error context to the snapshot
    pub fn with_error_context(mut self, error_context: String) -> Self {
        self.error_context = Some(error_context);
        self
    }
    
    /// Check if this snapshot represents a recoverable state
    pub fn is_recoverable(&self) -> bool {
        !matches!(self.session_state, PlaybackState::Completed | PlaybackState::Failed(_))
    }
    
    /// Get the duration since this snapshot was created
    pub fn age(&self) -> chrono::Duration {
        Utc::now() - self.saved_at
    }
}

/// Error recovery strategies available during error conditions (Requirement 8.5)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ErrorRecoveryStrategy {
    /// Attempt to restart the target application and resume automation
    RestartApplication,
    /// Wait for conditions to improve and retry automation
    WaitAndRetry,
    /// Switch to a different target application
    SwitchApplication,
    /// Gracefully stop automation and save progress
    GracefulStop,
}

impl ErrorRecoveryStrategy {
    /// Get a human-readable description of the recovery strategy
    pub fn description(&self) -> &'static str {
        match self {
            ErrorRecoveryStrategy::RestartApplication => {
                "Restart the target application and attempt to resume automation from the current step"
            }
            ErrorRecoveryStrategy::WaitAndRetry => {
                "Wait for the application to become responsive and retry the current operation"
            }
            ErrorRecoveryStrategy::SwitchApplication => {
                "Switch to a different target application and continue automation"
            }
            ErrorRecoveryStrategy::GracefulStop => {
                "Stop automation gracefully and save current progress for later resumption"
            }
        }
    }
    
    /// Check if this strategy requires user interaction
    pub fn requires_user_interaction(&self) -> bool {
        matches!(self, ErrorRecoveryStrategy::SwitchApplication)
    }
    
    /// Check if this strategy preserves automation progress
    pub fn preserves_progress(&self) -> bool {
        !matches!(self, ErrorRecoveryStrategy::GracefulStop)
    }
}
