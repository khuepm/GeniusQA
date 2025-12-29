//! Playback controller for managing automation execution with focus awareness

use crate::application_focused_automation::{
    error::PlaybackError,
    types::{FocusEvent, FocusLossStrategy, PlaybackState, PauseReason, RegisteredApplication, FocusErrorReport, WarningEntry, FocusState, AutomationProgressSnapshot, ErrorRecoveryStrategy},
    validation::{ActionValidator, AutomationAction, ValidationResult},
    focus_monitor::FocusMonitor,
};
use chrono::{DateTime, Utc};
use tokio::sync::mpsc;
use uuid::Uuid;
use tauri::Manager;

/// Manages automation script execution with focus-aware pause/resume functionality
pub struct PlaybackController {
    current_session: Option<PlaybackSession>,
    focus_event_receiver: Option<mpsc::Receiver<FocusEvent>>,
    action_validator: ActionValidator,
    warning_log: Vec<WarningEntry>,
    focus_monitor: Option<FocusMonitor>,
    // Optional Tauri app handle for real-time event emission
    app_handle: Option<tauri::AppHandle>,
}

/// Represents an active playback session with focus strategy support
#[derive(Debug, Clone)]
pub struct PlaybackSession {
    pub id: String,
    pub target_app_id: String,
    pub target_process_id: u32,
    pub state: PlaybackState,
    pub focus_strategy: FocusLossStrategy,
    pub current_step: usize,
    pub started_at: DateTime<Utc>,
    pub paused_at: Option<DateTime<Utc>>,
    pub resumed_at: Option<DateTime<Utc>>,
    pub total_pause_duration: chrono::Duration,
    pub script_path: Option<String>,
}

impl PlaybackController {
    /// Create a new playback controller
    pub fn new() -> Self {
        Self {
            current_session: None,
            focus_event_receiver: None,
            action_validator: ActionValidator::new(),
            warning_log: Vec::new(),
            focus_monitor: None,
            app_handle: None,
        }
    }

    /// Create a new playback controller with Tauri app handle for real-time events
    /// 
    /// Requirements: 5.5 - Real-time event streaming
    pub fn new_with_app_handle(app_handle: tauri::AppHandle) -> Self {
        Self {
            current_session: None,
            focus_event_receiver: None,
            action_validator: ActionValidator::new(),
            warning_log: Vec::new(),
            focus_monitor: None,
            app_handle: Some(app_handle),
        }
    }

    /// Set the Tauri app handle for real-time event emission
    /// 
    /// Requirements: 5.5 - Enable real-time status broadcasting
    pub fn set_app_handle(&mut self, app_handle: tauri::AppHandle) {
        self.app_handle = Some(app_handle);
    }

    /// Set the focus event receiver for monitoring focus changes
    pub fn set_focus_event_receiver(&mut self, receiver: mpsc::Receiver<FocusEvent>) {
        self.focus_event_receiver = Some(receiver);
    }

    /// Set the focus monitor for focus state queries
    pub fn set_focus_monitor(&mut self, monitor: FocusMonitor) {
        self.focus_monitor = Some(monitor);
    }

    /// Start a new playback session with focus strategy support
    pub fn start_playback(
        &mut self,
        app_id: String,
        process_id: u32,
        focus_strategy: FocusLossStrategy,
        script_path: Option<String>,
    ) -> Result<String, PlaybackError> {
        if self.current_session.is_some() {
            return Err(PlaybackError::PlaybackAlreadyActive);
        }

        // Validate that the target process exists before starting playback
        if !self.check_process_exists(process_id)? {
            return Err(PlaybackError::TargetApplicationUnavailable(format!(
                "Target process with ID {} does not exist or is not accessible", 
                process_id
            )));
        }

        let session_id = Uuid::new_v4().to_string();
        let session = PlaybackSession {
            id: session_id.clone(),
            target_app_id: app_id,
            target_process_id: process_id,
            state: PlaybackState::Running,
            focus_strategy,
            current_step: 0,
            started_at: Utc::now(),
            paused_at: None,
            resumed_at: None,
            total_pause_duration: chrono::Duration::zero(),
            script_path: script_path.clone(),
        };

        self.current_session = Some(session.clone());
        log::info!("Started playback session {} with focus strategy {:?} for script {:?}", session_id, focus_strategy, script_path);
        
        // Emit real-time playback status update
        // Requirements: 5.5 - Real-time event streaming
        if let Some(ref app_handle) = self.app_handle {
            let status_json = serde_json::json!({
                "type": "playback_status_update",
                "data": {
                    "id": session.id,
                    "target_app_id": session.target_app_id,
                    "target_process_id": session.target_process_id,
                    "state": session.state,
                    "focus_strategy": session.focus_strategy,
                    "current_step": session.current_step,
                    "started_at": session.started_at.to_rfc3339(),
                    "paused_at": session.paused_at.map(|t| t.to_rfc3339()),
                    "resumed_at": session.resumed_at.map(|t| t.to_rfc3339()),
                    "total_pause_duration": session.total_pause_duration.num_seconds(),
                    "script_path": session.script_path
                }
            });
            
            if let Err(e) = app_handle.emit_all("playback_status_update", status_json) {
                log::warn!("Failed to emit real-time playback status update: {}", e);
            }
        }
        
        Ok(session_id)
    }

    /// Update the progress (current step) of the active session
    pub fn update_progress(&mut self, current_step: usize) -> Result<(), PlaybackError> {
        let session = self.current_session
            .as_mut()
            .ok_or(PlaybackError::NoActiveSession)?;

        session.current_step = current_step;
        
        // Emit real-time playback status update with new step
        if let Some(ref app_handle) = self.app_handle {
            let status_json = serde_json::json!({
                "type": "playback_status_update",
                "data": {
                    "id": session.id,
                    "target_app_id": session.target_app_id,
                    "target_process_id": session.target_process_id,
                    "state": session.state,
                    "focus_strategy": session.focus_strategy,
                    "current_step": session.current_step,
                    "started_at": session.started_at.to_rfc3339(),
                    "paused_at": session.paused_at.map(|t| t.to_rfc3339()),
                    "resumed_at": session.resumed_at.map(|t| t.to_rfc3339()),
                    "total_pause_duration": session.total_pause_duration.num_seconds()
                }
            });
            
            if let Err(e) = app_handle.emit_all("playback_status_update", status_json) {
                log::warn!("Failed to emit real-time playback status update: {}", e);
            }
        }
        
        Ok(())
    }
    pub fn pause_playback(&mut self, reason: PauseReason) -> Result<(), PlaybackError> {
        let session = self.current_session
            .as_mut()
            .ok_or(PlaybackError::NoActiveSession)?;

        if !matches!(session.state, PlaybackState::Running) {
            return Err(PlaybackError::InvalidState(format!("Cannot pause from state: {:?}", session.state)));
        }

        session.state = PlaybackState::Paused(reason.clone());
        session.paused_at = Some(Utc::now());
        log::info!("Paused playback session {} due to {:?}", session.id, reason);
        
        // Emit real-time playback status update
        // Requirements: 5.5 - Real-time event streaming
        if let Some(ref app_handle) = self.app_handle {
            let status_json = serde_json::json!({
                "type": "playback_status_update",
                "data": {
                    "id": session.id,
                    "target_app_id": session.target_app_id,
                    "target_process_id": session.target_process_id,
                    "state": session.state,
                    "focus_strategy": session.focus_strategy,
                    "current_step": session.current_step,
                    "started_at": session.started_at.to_rfc3339(),
                    "paused_at": session.paused_at.map(|t| t.to_rfc3339()),
                    "resumed_at": session.resumed_at.map(|t| t.to_rfc3339()),
                    "total_pause_duration": session.total_pause_duration.num_seconds()
                }
            });
            
            if let Err(e) = app_handle.emit_all("playback_status_update", status_json) {
                log::warn!("Failed to emit real-time playback status update: {}", e);
            }
        }
        
        Ok(())
    }

    /// Resume the current playback session
    pub fn resume_playback(&mut self) -> Result<(), PlaybackError> {
        let session = self.current_session
            .as_mut()
            .ok_or(PlaybackError::NoActiveSession)?;

        if !matches!(session.state, PlaybackState::Paused(_)) {
            return Err(PlaybackError::InvalidState(format!("Cannot resume from state: {:?}", session.state)));
        }

        // Calculate pause duration if we have a pause timestamp
        if let Some(paused_at) = session.paused_at {
            let pause_duration = Utc::now() - paused_at;
            session.total_pause_duration = session.total_pause_duration + pause_duration;
        }

        session.state = PlaybackState::Running;
        session.paused_at = None;
        session.resumed_at = Some(Utc::now());
        log::info!("Resumed playback session {}", session.id);
        
        // Emit real-time playback status update
        // Requirements: 5.5 - Real-time event streaming
        if let Some(ref app_handle) = self.app_handle {
            let status_json = serde_json::json!({
                "type": "playback_status_update",
                "data": {
                    "id": session.id,
                    "target_app_id": session.target_app_id,
                    "target_process_id": session.target_process_id,
                    "state": session.state,
                    "focus_strategy": session.focus_strategy,
                    "current_step": session.current_step,
                    "started_at": session.started_at.to_rfc3339(),
                    "paused_at": session.paused_at.map(|t| t.to_rfc3339()),
                    "resumed_at": session.resumed_at.map(|t| t.to_rfc3339()),
                    "total_pause_duration": session.total_pause_duration.num_seconds()
                }
            });
            
            if let Err(e) = app_handle.emit_all("playback_status_update", status_json) {
                log::warn!("Failed to emit real-time playback status update: {}", e);
            }
        }
        
        Ok(())
    }

    /// Abort the current playback session
    pub fn abort_playback(&mut self, reason: String) -> Result<(), PlaybackError> {
        let session = self.current_session
            .as_mut()
            .ok_or(PlaybackError::NoActiveSession)?;

        session.state = PlaybackState::Aborted(reason.clone());
        log::warn!("Aborted playback session {}: {}", session.id, reason);
        
        // Emit real-time playback status update
        // Requirements: 5.5 - Real-time event streaming
        if let Some(ref app_handle) = self.app_handle {
            let status_json = serde_json::json!({
                "type": "playback_status_update",
                "data": {
                    "id": session.id,
                    "target_app_id": session.target_app_id,
                    "target_process_id": session.target_process_id,
                    "state": session.state,
                    "focus_strategy": session.focus_strategy,
                    "current_step": session.current_step,
                    "started_at": session.started_at.to_rfc3339(),
                    "paused_at": session.paused_at.map(|t| t.to_rfc3339()),
                    "resumed_at": session.resumed_at.map(|t| t.to_rfc3339()),
                    "total_pause_duration": session.total_pause_duration.num_seconds()
                }
            });
            
            if let Err(e) = app_handle.emit_all("playback_status_update", status_json) {
                log::warn!("Failed to emit real-time playback status update: {}", e);
            }
        }
        
        Ok(())
    }

    /// Stop the current playback session
    pub fn stop_playback(&mut self) -> Result<(), PlaybackError> {
        if self.current_session.is_none() {
            return Err(PlaybackError::NoActiveSession);
        }

        let session_id = self.current_session.as_ref().unwrap().id.clone();
        let session = self.current_session.take().unwrap();
        log::info!("Stopped playback session {}", session_id);
        
        // Emit real-time playback status update (session stopped)
        // Requirements: 5.5 - Real-time event streaming
        if let Some(ref app_handle) = self.app_handle {
            let status_json = serde_json::json!({
                "type": "playback_status_update",
                "data": {
                    "id": session.id,
                    "target_app_id": session.target_app_id,
                    "target_process_id": session.target_process_id,
                    "state": PlaybackState::Completed,
                    "focus_strategy": session.focus_strategy,
                    "current_step": session.current_step,
                    "started_at": session.started_at.to_rfc3339(),
                    "paused_at": session.paused_at.map(|t| t.to_rfc3339()),
                    "resumed_at": session.resumed_at.map(|t| t.to_rfc3339()),
                    "total_pause_duration": session.total_pause_duration.num_seconds()
                }
            });
            
            if let Err(e) = app_handle.emit_all("playback_status_update", status_json) {
                log::warn!("Failed to emit real-time playback status update: {}", e);
            }
        }
        
        Ok(())
    }

    /// Get the current playback session status
    pub fn get_playback_status(&self) -> Option<PlaybackSession> {
        self.current_session.clone()
    }

    /// Check if there is an active playback session
    pub fn has_active_session(&self) -> bool {
        self.current_session.is_some()
    }

    /// Get the current session ID if active
    pub fn get_current_session_id(&self) -> Option<String> {
        self.current_session.as_ref().map(|s| s.id.clone())
    }

    /// Handle focus events from the focus monitor with focus strategy implementation
    pub fn handle_focus_event(&mut self, event: FocusEvent) -> Result<(), PlaybackError> {
        let session = match &mut self.current_session {
            Some(session) => session,
            None => return Ok(()), // No active session, ignore events
        };

        match event {
            FocusEvent::TargetProcessLostFocus { app_id, new_focused_app, .. } => {
                if app_id == session.target_app_id {
                    match session.focus_strategy {
                        FocusLossStrategy::AutoPause => {
                            self.handle_auto_pause_focus_loss(&app_id, &new_focused_app)?;
                        }
                        FocusLossStrategy::StrictError => {
                            self.handle_strict_error_focus_loss(&app_id, &new_focused_app)?;
                        }
                        FocusLossStrategy::Ignore => {
                            self.handle_ignore_focus_loss(&app_id, &new_focused_app)?;
                        }
                    }
                }
            }
            FocusEvent::TargetProcessGainedFocus { app_id, .. } => {
                if app_id == session.target_app_id && matches!(session.state, PlaybackState::Paused(PauseReason::FocusLost)) {
                    match session.focus_strategy {
                        FocusLossStrategy::AutoPause => {
                            self.handle_auto_pause_focus_gain(&app_id)?;
                        }
                        _ => {
                            // Other strategies don't auto-resume
                        }
                    }
                }
            }
            FocusEvent::FocusError { error, .. } => {
                log::error!("Focus monitoring error: {}", error);
                // Handle focus monitoring errors - implementation in later subtasks
            }
        }

        Ok(())
    }

    /// Handle Auto-Pause strategy when focus is lost
    fn handle_auto_pause_focus_loss(&mut self, app_id: &str, new_focused_app: &Option<String>) -> Result<(), PlaybackError> {
        log::info!("Auto-Pause: Target application '{}' lost focus to '{:?}', pausing playback", 
                 app_id, new_focused_app);
        
        // Check if we should pause (only if currently running)
        let should_pause = if let Some(session) = &self.current_session {
            matches!(session.state, PlaybackState::Running)
        } else {
            false
        };
        
        if should_pause {
            self.pause_playback(PauseReason::FocusLost)?;
        } else {
            log::debug!("Auto-Pause: Session not running or no active session, ignoring focus loss event");
        }
        
        // TODO: Send notification to user
        // This will be implemented in the notification system subtasks
        log::info!("Auto-Pause: Playback paused. Please return focus to '{}' to resume automation", app_id);
        
        Ok(())
    }

    /// Handle Auto-Pause strategy when focus is regained
    fn handle_auto_pause_focus_gain(&mut self, app_id: &str) -> Result<(), PlaybackError> {
        log::info!("Auto-Pause: Target application '{}' regained focus, resuming playback", app_id);
        
        self.resume_playback()?;
        
        // TODO: Send notification to user
        // This will be implemented in the notification system subtasks
        log::info!("Auto-Pause: Playback resumed for application '{}'", app_id);
        
        Ok(())
    }

    /// Handle Strict Error strategy when focus is lost
    fn handle_strict_error_focus_loss(&mut self, app_id: &str, new_focused_app: &Option<String>) -> Result<(), PlaybackError> {
        let focused_app_name = new_focused_app.as_deref().unwrap_or("unknown application");
        let error_msg = format!(
            "Strict Error: Target application '{}' lost focus to '{}'. Automation aborted immediately to maintain strict focus requirements.", 
            app_id, 
            focused_app_name
        );
        
        log::error!("{}", error_msg);
        
        // Generate detailed error report with focus information (Requirement 8.6)
        if let Some(session) = &self.current_session {
            let error_report = self.generate_focus_error_report(
                session,
                app_id,
                new_focused_app,
                &error_msg,
            );
            
            // Log the detailed error report
            log::error!("Focus Error Report: {}", serde_json::to_string_pretty(&error_report).unwrap_or_else(|_| "Failed to serialize error report".to_string()));
            
            // Store error report in abort reason for later retrieval
            let abort_reason = format!("{} [Error Report ID: {}]", error_msg, error_report.report_id);
            self.abort_playback(abort_reason)?;
        } else {
            self.abort_playback(error_msg)?;
        }
        
        Ok(())
    }

    /// Handle Ignore strategy when focus is lost
    fn handle_ignore_focus_loss(&mut self, app_id: &str, new_focused_app: &Option<String>) -> Result<(), PlaybackError> {
        let focused_app_name = new_focused_app.as_deref().unwrap_or("unknown application");
        log::warn!(
            "Ignore: Target application '{}' lost focus to '{}'. Continuing execution with warning as per Ignore strategy.", 
            app_id, 
            focused_app_name
        );
        
        // TODO: Implement warning logging system
        // This will be implemented in the warning logging subtasks
        
        // Continue execution - no state change needed for Ignore strategy
        Ok(())
    }

    /// Process pending focus events from the receiver
    pub async fn process_focus_events(&mut self) -> Result<(), PlaybackError> {
        let mut events_to_process = Vec::new();
        
        // Collect events first to avoid borrowing conflicts
        if let Some(receiver) = &mut self.focus_event_receiver {
            while let Ok(event) = receiver.try_recv() {
                events_to_process.push(event);
            }
        }
        
        // Process collected events
        for event in events_to_process {
            self.handle_focus_event(event)?;
        }
        
        Ok(())
    }

    /// Detect if the target application has closed during automation (Requirement 8.1)
    pub fn detect_application_closure(&self) -> Result<bool, PlaybackError> {
        let session = self.current_session
            .as_ref()
            .ok_or(PlaybackError::NoActiveSession)?;

        // Check if the target process is still running
        let process_exists = self.check_process_exists(session.target_process_id)?;
        
        if !process_exists {
            log::warn!("Target application (PID: {}) has closed during automation", session.target_process_id);
            return Ok(true);
        }

        Ok(false)
    }

    /// Detect if the target application has become unresponsive (Requirement 8.2)
    pub fn detect_application_unresponsiveness(&self) -> Result<bool, PlaybackError> {
        let session = self.current_session
            .as_ref()
            .ok_or(PlaybackError::NoActiveSession)?;

        // Check if the application is responding to system queries
        let is_responsive = self.check_application_responsiveness(session.target_process_id)?;
        
        if !is_responsive {
            log::warn!("Target application (PID: {}) has become unresponsive", session.target_process_id);
            return Ok(true);
        }

        Ok(false)
    }

    /// Handle application closure error with clear messaging and recovery options (Requirements 8.1, 8.3, 8.4)
    pub fn handle_application_closure(&mut self) -> Result<(), PlaybackError> {
        let session = self.current_session
            .as_ref()
            .ok_or(PlaybackError::NoActiveSession)?;

        let error_message = format!(
            "Target application '{}' (PID: {}) has closed unexpectedly during automation. \
            The automation has been paused to prevent errors. \
            Recovery options: 1) Restart the application and resume automation, \
            2) Stop the current automation session, 3) Switch to a different target application.",
            session.target_app_id,
            session.target_process_id
        );

        log::error!("{}", error_message);

        // Pause automation with clear reason (Requirement 8.3)
        self.pause_playback(PauseReason::ApplicationError)?;

        // Generate error report for user (Requirement 8.4)
        self.generate_application_closure_error_report(&error_message)?;

        Err(PlaybackError::ApplicationClosed(error_message))
    }

    /// Handle application unresponsiveness with clear messaging and recovery options (Requirements 8.2, 8.3, 8.4)
    pub fn handle_application_unresponsiveness(&mut self) -> Result<(), PlaybackError> {
        let session = self.current_session
            .as_ref()
            .ok_or(PlaybackError::NoActiveSession)?;

        let error_message = format!(
            "Target application '{}' (PID: {}) has become unresponsive during automation. \
            The automation has been paused to prevent system instability. \
            Recovery options: 1) Wait for the application to respond and resume automation, \
            2) Force quit and restart the application, 3) Stop the current automation session.",
            session.target_app_id,
            session.target_process_id
        );

        log::error!("{}", error_message);

        // Pause automation with clear reason (Requirement 8.3)
        self.pause_playback(PauseReason::ApplicationError)?;

        // Generate error report for user (Requirement 8.4)
        self.generate_application_unresponsiveness_error_report(&error_message)?;

        Err(PlaybackError::ApplicationUnresponsive(error_message))
    }

    /// Comprehensive error detection that checks for various error conditions (Requirements 8.1, 8.2)
    pub fn detect_error_conditions(&mut self) -> Result<(), PlaybackError> {
        // Only perform error detection if we have an active session
        if !self.has_active_session() {
            return Ok(());
        }

        // Check for application closure
        if self.detect_application_closure()? {
            return self.handle_application_closure();
        }

        // Check for application unresponsiveness
        if self.detect_application_unresponsiveness()? {
            return self.handle_application_unresponsiveness();
        }

        Ok(())
    }

    /// Check if a process exists by process ID (platform-specific implementation)
    fn check_process_exists(&self, process_id: u32) -> Result<bool, PlaybackError> {
        #[cfg(target_os = "windows")]
        {
            self.check_process_exists_windows(process_id)
        }
        #[cfg(target_os = "macos")]
        {
            self.check_process_exists_macos(process_id)
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            // Fallback for unsupported platforms
            log::warn!("Process existence check not implemented for this platform");
            Ok(true) // Assume process exists to avoid false positives
        }
    }

    /// Check application responsiveness (platform-specific implementation)
    fn check_application_responsiveness(&self, process_id: u32) -> Result<bool, PlaybackError> {
        #[cfg(target_os = "windows")]
        {
            self.check_application_responsiveness_windows(process_id)
        }
        #[cfg(target_os = "macos")]
        {
            self.check_application_responsiveness_macos(process_id)
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            // Fallback for unsupported platforms
            log::warn!("Application responsiveness check not implemented for this platform");
            Ok(true) // Assume application is responsive to avoid false positives
        }
    }

    /// Windows-specific process existence check
    #[cfg(target_os = "windows")]
    fn check_process_exists_windows(&self, process_id: u32) -> Result<bool, PlaybackError> {
        use std::process::Command;
        
        // Use tasklist command to check if process exists
        let output = Command::new("tasklist")
            .args(&["/FI", &format!("PID eq {}", process_id), "/FO", "CSV"])
            .output()
            .map_err(|e| PlaybackError::AutomationEngineError(format!("Failed to execute tasklist: {}", e)))?;

        let output_str = String::from_utf8_lossy(&output.stdout);
        
        // If the process exists, tasklist will return a line with the process info
        // If it doesn't exist, it will only return the header line
        let lines: Vec<&str> = output_str.lines().collect();
        Ok(lines.len() > 1) // More than just the header line means process exists
    }

    /// macOS-specific process existence check
    #[cfg(target_os = "macos")]
    fn check_process_exists_macos(&self, process_id: u32) -> Result<bool, PlaybackError> {
        use std::process::Command;
        
        // Use ps command to check if process exists
        let output = Command::new("ps")
            .args(&["-p", &process_id.to_string()])
            .output()
            .map_err(|e| PlaybackError::AutomationEngineError(format!("Failed to execute ps: {}", e)))?;

        // ps returns exit code 0 if process exists, non-zero if it doesn't
        Ok(output.status.success())
    }

    /// Windows-specific application responsiveness check
    #[cfg(target_os = "windows")]
    fn check_application_responsiveness_windows(&self, process_id: u32) -> Result<bool, PlaybackError> {
        use std::process::Command;
        
        // Use tasklist with /FI filter to check if process is responding
        let output = Command::new("tasklist")
            .args(&["/FI", &format!("PID eq {}", process_id), "/FI", "STATUS eq Not Responding", "/FO", "CSV"])
            .output()
            .map_err(|e| PlaybackError::AutomationEngineError(format!("Failed to execute tasklist for responsiveness: {}", e)))?;

        let output_str = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = output_str.lines().collect();
        
        // If the process is not responding, it will appear in the filtered results
        // If it's responding, only the header line will be returned
        Ok(lines.len() <= 1) // Only header line means process is responding
    }

    /// macOS-specific application responsiveness check
    #[cfg(target_os = "macos")]
    fn check_application_responsiveness_macos(&self, process_id: u32) -> Result<bool, PlaybackError> {
        // On macOS, we can check if the application is responding by trying to get window information
        // This is a simplified check - in a full implementation, we might use more sophisticated methods
        use std::process::Command;
        
        // Use sample command to check if process is active (not hung)
        let output = Command::new("sample")
            .args(&[&process_id.to_string(), "1", "1", "-mayDie"])
            .output()
            .map_err(|e| PlaybackError::AutomationEngineError(format!("Failed to sample process: {}", e)))?;

        // If sample succeeds, the process is likely responsive
        // If it fails, the process might be hung or not responding
        Ok(output.status.success())
    }

    /// Generate error report for application closure (Requirement 8.4)
    fn generate_application_closure_error_report(&self, error_message: &str) -> Result<(), PlaybackError> {
        let session = self.current_session
            .as_ref()
            .ok_or(PlaybackError::NoActiveSession)?;

        let report = format!(
            "=== APPLICATION CLOSURE ERROR REPORT ===\n\
            Report ID: {}\n\
            Timestamp: {}\n\
            Session ID: {}\n\
            Target Application: {} (PID: {})\n\
            Session Duration: {} seconds\n\
            Current Step: {}\n\
            Focus Strategy: {:?}\n\
            Error Message: {}\n\
            Recovery Options:\n\
            1. Restart the target application\n\
            2. Resume automation once application is available\n\
            3. Stop current automation session\n\
            4. Switch to different target application\n\
            ==========================================",
            uuid::Uuid::new_v4(),
            chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
            session.id,
            session.target_app_id,
            session.target_process_id,
            (chrono::Utc::now() - session.started_at).num_seconds(),
            session.current_step,
            session.focus_strategy,
            error_message
        );

        log::error!("Application Closure Error Report:\n{}", report);
        
        // TODO: In a full implementation, this report could be saved to a file or sent to a UI component
        // For now, we log it for visibility
        
        Ok(())
    }

    /// Generate error report for application unresponsiveness (Requirement 8.4)
    fn generate_application_unresponsiveness_error_report(&self, error_message: &str) -> Result<(), PlaybackError> {
        let session = self.current_session
            .as_ref()
            .ok_or(PlaybackError::NoActiveSession)?;

        let report = format!(
            "=== APPLICATION UNRESPONSIVENESS ERROR REPORT ===\n\
            Report ID: {}\n\
            Timestamp: {}\n\
            Session ID: {}\n\
            Target Application: {} (PID: {})\n\
            Session Duration: {} seconds\n\
            Current Step: {}\n\
            Focus Strategy: {:?}\n\
            Error Message: {}\n\
            Recovery Options:\n\
            1. Wait for application to become responsive\n\
            2. Force quit and restart the application\n\
            3. Stop current automation session\n\
            4. Check system resources and close other applications\n\
            ================================================",
            uuid::Uuid::new_v4(),
            chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
            session.id,
            session.target_app_id,
            session.target_process_id,
            (chrono::Utc::now() - session.started_at).num_seconds(),
            session.current_step,
            session.focus_strategy,
            error_message
        );

        log::error!("Application Unresponsiveness Error Report:\n{}", report);
        
        // TODO: In a full implementation, this report could be saved to a file or sent to a UI component
        // For now, we log it for visibility
        
        Ok(())
    }

    /// Save current automation progress and state for recovery (Requirement 8.5)
    pub fn save_automation_progress(&self) -> Result<AutomationProgressSnapshot, PlaybackError> {
        let session = self.current_session
            .as_ref()
            .ok_or(PlaybackError::NoActiveSession)?;

        let snapshot = AutomationProgressSnapshot {
            snapshot_id: uuid::Uuid::new_v4().to_string(),
            session_id: session.id.clone(),
            target_app_id: session.target_app_id.clone(),
            target_process_id: session.target_process_id,
            current_step: session.current_step,
            session_state: session.state.clone(),
            focus_strategy: session.focus_strategy,
            started_at: session.started_at,
            paused_at: session.paused_at,
            resumed_at: session.resumed_at,
            total_pause_duration: session.total_pause_duration,
            saved_at: chrono::Utc::now(),
            error_context: None,
        };

        log::info!("Saved automation progress snapshot: {}", snapshot.snapshot_id);
        
        // TODO: In a full implementation, this would be persisted to storage
        // For now, we return the snapshot for the caller to handle
        
        Ok(snapshot)
    }

    /// Save automation progress with error context (Requirement 8.5)
    pub fn save_automation_progress_with_error(&self, error_context: String) -> Result<AutomationProgressSnapshot, PlaybackError> {
        let mut snapshot = self.save_automation_progress()?;
        snapshot.error_context = Some(error_context);
        
        log::info!("Saved automation progress snapshot with error context: {}", snapshot.snapshot_id);
        Ok(snapshot)
    }

    /// Restore automation state from a progress snapshot (Requirement 8.5)
    pub fn restore_automation_progress(&mut self, snapshot: AutomationProgressSnapshot) -> Result<(), PlaybackError> {
        // Stop any current session first
        if self.has_active_session() {
            self.stop_playback()?;
        }

        // Create a new session based on the snapshot
        let restored_session = PlaybackSession {
            id: snapshot.session_id.clone(),
            target_app_id: snapshot.target_app_id.clone(),
            target_process_id: snapshot.target_process_id,
            state: snapshot.session_state.clone(),
            focus_strategy: snapshot.focus_strategy,
            current_step: snapshot.current_step,
            started_at: snapshot.started_at,
            paused_at: snapshot.paused_at,
            resumed_at: snapshot.resumed_at,
            total_pause_duration: snapshot.total_pause_duration,
            script_path: None, // Script path is not currently persisted in snapshot
        };

        self.current_session = Some(restored_session);
        
        log::info!("Restored automation progress from snapshot: {} (session: {})", 
                  snapshot.snapshot_id, snapshot.session_id);
        
        // If the session was running when saved, pause it for safety after restoration
        if matches!(snapshot.session_state, PlaybackState::Running) {
            self.pause_playback(PauseReason::UserRequested)?;
            log::info!("Paused restored session for safety - user can resume when ready");
        }

        Ok(())
    }

    /// Create recovery checkpoint during error conditions (Requirement 8.5)
    pub fn create_recovery_checkpoint(&mut self, checkpoint_reason: String) -> Result<AutomationProgressSnapshot, PlaybackError> {
        let snapshot = self.save_automation_progress_with_error(checkpoint_reason.clone())?;
        
        // Store the checkpoint for potential recovery
        // TODO: In a full implementation, this would be persisted to storage
        log::info!("Created recovery checkpoint: {} - Reason: {}", snapshot.snapshot_id, checkpoint_reason);
        
        Ok(snapshot)
    }

    /// Implement recovery mechanisms for different error scenarios (Requirement 8.5)
    pub fn attempt_error_recovery(&mut self, recovery_strategy: ErrorRecoveryStrategy) -> Result<(), PlaybackError> {
        let session_id = self.current_session
            .as_ref()
            .ok_or(PlaybackError::NoActiveSession)?
            .id.clone();

        match recovery_strategy {
            ErrorRecoveryStrategy::RestartApplication => {
                log::info!("Attempting application restart recovery for session: {}", session_id);
                
                // Create checkpoint before attempting recovery
                let _checkpoint = self.create_recovery_checkpoint("Application restart recovery attempt".to_string())?;
                
                // Pause the session during recovery
                if let Some(session) = &self.current_session {
                    if matches!(session.state, PlaybackState::Running) {
                        self.pause_playback(PauseReason::ApplicationError)?;
                    }
                }
                
                // TODO: In a full implementation, this would:
                // 1. Attempt to restart the target application
                // 2. Wait for the application to become available
                // 3. Update the process ID in the session
                // 4. Resume automation if successful
                
                log::info!("Application restart recovery mechanism initiated (implementation pending)");
                Ok(())
            }
            ErrorRecoveryStrategy::WaitAndRetry => {
                log::info!("Attempting wait-and-retry recovery for session: {}", session_id);
                
                // Create checkpoint before attempting recovery
                let _checkpoint = self.create_recovery_checkpoint("Wait and retry recovery attempt".to_string())?;
                
                // Pause the session and wait for conditions to improve
                if let Some(session) = &self.current_session {
                    if matches!(session.state, PlaybackState::Running) {
                        self.pause_playback(PauseReason::ApplicationError)?;
                    }
                }
                
                // TODO: In a full implementation, this would:
                // 1. Wait for a specified duration
                // 2. Re-check error conditions
                // 3. Resume automation if conditions have improved
                
                log::info!("Wait-and-retry recovery mechanism initiated (implementation pending)");
                Ok(())
            }
            ErrorRecoveryStrategy::SwitchApplication => {
                log::info!("Attempting application switch recovery for session: {}", session_id);
                
                // Create checkpoint before attempting recovery
                let _checkpoint = self.create_recovery_checkpoint("Application switch recovery attempt".to_string())?;
                
                // Stop the current session as we're switching applications
                self.stop_playback()?;
                
                // TODO: In a full implementation, this would:
                // 1. Present user with alternative applications
                // 2. Allow user to select a new target application
                // 3. Start a new session with the selected application
                // 4. Optionally transfer progress to the new session
                
                log::info!("Application switch recovery mechanism initiated (implementation pending)");
                Ok(())
            }
            ErrorRecoveryStrategy::GracefulStop => {
                log::info!("Attempting graceful stop recovery for session: {}", session_id);
                
                // Create final checkpoint before stopping
                let _checkpoint = self.create_recovery_checkpoint("Graceful stop recovery".to_string())?;
                
                // Stop the session cleanly
                self.stop_playback()?;
                
                log::info!("Graceful stop recovery completed for session: {}", session_id);
                Ok(())
            }
        }
    }

    /// Get available recovery options based on current error state (Requirement 8.5)
    pub fn get_recovery_options(&self) -> Result<Vec<ErrorRecoveryStrategy>, PlaybackError> {
        let session = self.current_session
            .as_ref()
            .ok_or(PlaybackError::NoActiveSession)?;

        let mut options = Vec::new();

        // Always available options
        options.push(ErrorRecoveryStrategy::GracefulStop);
        options.push(ErrorRecoveryStrategy::WaitAndRetry);

        // Application-specific options
        if !matches!(session.state, PlaybackState::Completed | PlaybackState::Aborted(_)) {
            options.push(ErrorRecoveryStrategy::RestartApplication);
            options.push(ErrorRecoveryStrategy::SwitchApplication);
        }

        log::debug!("Available recovery options for session {}: {:?}", session.id, options);
        Ok(options)
    }

    /// Get session statistics
    pub fn get_session_stats(&self) -> Option<SessionStats> {
        self.current_session.as_ref().map(|session| {
            let total_duration = Utc::now() - session.started_at;
            let active_duration = total_duration - session.total_pause_duration;
            
            SessionStats {
                session_id: session.id.clone(),
                total_duration,
                active_duration,
                pause_duration: session.total_pause_duration,
                current_step: session.current_step,
                focus_strategy: session.focus_strategy,
                state: session.state.clone(),
            }
        })
    }

    /// Get the current focus state from the focus monitor
    fn get_current_focus_state(&self) -> Option<FocusState> {
        self.focus_monitor.as_ref().map(|monitor| monitor.get_current_focus_state())
    }

    /// Set the target application for action validation (Requirement 6.3)
    pub fn set_target_application(&mut self, app: RegisteredApplication) -> Result<(), PlaybackError> {
        self.action_validator.set_target_application(app);
        log::info!("Set target application for validation");
        Ok(())
    }

    /// Execute an automation action with validation (Requirements 6.1, 6.2, 6.4)
    pub fn execute_action(&mut self, action: AutomationAction) -> Result<(), PlaybackError> {
        // First, verify focus before executing the action (Requirement 6.3)
        self.verify_focus_before_action()?;

        // Update the action validator with current focus state
        if let Some(focus_state) = self.get_current_focus_state() {
            self.action_validator.set_focus_state(focus_state);
        }

        // Validate the action
        match self.action_validator.validate_action(&action) {
            ValidationResult::Valid => {
                log::debug!("Action validation passed: {:?}", action);
                // TODO: Execute the actual automation action
                // This would integrate with the automation engine
                Ok(())
            }
            ValidationResult::Invalid(error) => {
                let error_msg = format!("Action validation failed: {}", error);
                log::error!("{}", error_msg);
                
                // Pause automation and notify user when validation fails (Requirement 6.5)
                self.pause_playback(PauseReason::ValidationFailed)?;
                
                Err(PlaybackError::ActionValidationFailed(error_msg))
            }
        }
    }

    /// Verify focus before executing an action (Requirements 6.3, 6.5)
    pub fn verify_focus_before_action(&self) -> Result<(), PlaybackError> {
        let session = self.current_session
            .as_ref()
            .ok_or(PlaybackError::NoActiveSession)?;

        // Check if session is in a state where actions can be executed
        match &session.state {
            PlaybackState::Running => {
                // Implement actual focus verification (Requirement 6.3)
                // Check if the target application is currently focused
                if let Some(focus_state) = self.get_current_focus_state() {
                    if focus_state.is_target_process_focused {
                        log::debug!("Focus verification passed for session {} - target application is focused", session.id);
                        Ok(())
                    } else {
                        let error_msg = format!(
                            "Focus verification failed: Target application (PID: {}) is not currently focused. Currently focused: {:?}",
                            session.target_process_id,
                            focus_state.focused_process_id
                        );
                        log::warn!("{}", error_msg);
                        
                        // Pause automation and notify user (Requirement 6.5)
                        // Note: We can't modify self here since this is an immutable reference
                        // The caller should handle pausing the automation based on this error
                        Err(PlaybackError::FocusVerificationFailed(error_msg))
                    }
                } else {
                    let error_msg = "Focus verification failed: No focus monitoring active".to_string();
                    log::error!("{}", error_msg);
                    Err(PlaybackError::FocusVerificationFailed(error_msg))
                }
            }
            PlaybackState::Paused(reason) => {
                let error_msg = format!("Cannot execute action while paused: {:?}", reason);
                log::warn!("{}", error_msg);
                Err(PlaybackError::FocusVerificationFailed(error_msg))
            }
            PlaybackState::Aborted(reason) => {
                let error_msg = format!("Cannot execute action on aborted session: {}", reason);
                log::error!("{}", error_msg);
                Err(PlaybackError::FocusVerificationFailed(error_msg))
            }
            PlaybackState::Completed => {
                let error_msg = "Cannot execute action on completed session".to_string();
                log::warn!("{}", error_msg);
                Err(PlaybackError::FocusVerificationFailed(error_msg))
            }
            PlaybackState::Failed(reason) => {
                let error_msg = format!("Cannot execute action on failed session: {}", reason);
                log::error!("{}", error_msg);
                Err(PlaybackError::FocusVerificationFailed(error_msg))
            }
        }
    }

    /// Generate a detailed error report for focus-related failures (Requirement 8.6)
    fn generate_focus_error_report(
        &self,
        session: &PlaybackSession,
        target_app_id: &str,
        new_focused_app: &Option<String>,
        error_message: &str,
    ) -> FocusErrorReport {
        use uuid::Uuid;
        
        let session_duration = Utc::now() - session.started_at;
        
        FocusErrorReport {
            report_id: Uuid::new_v4().to_string(),
            session_id: session.id.clone(),
            target_app_id: target_app_id.to_string(),
            target_process_id: session.target_process_id,
            new_focused_app: new_focused_app.clone(),
            focus_strategy: session.focus_strategy,
            focus_lost_at: Utc::now(),
            current_step: session.current_step,
            session_duration,
            error_message: error_message.to_string(),
            context: Some(format!(
                "Session was running for {} seconds when focus was lost from '{}' to '{}'",
                session_duration.num_seconds(),
                target_app_id,
                new_focused_app.as_deref().unwrap_or("unknown application")
            )),
        }
    }

}

/// Statistics for a playback session
#[derive(Debug, Clone)]
pub struct SessionStats {
    pub session_id: String,
    pub total_duration: chrono::Duration,
    pub active_duration: chrono::Duration,
    pub pause_duration: chrono::Duration,
    pub current_step: usize,
    pub focus_strategy: FocusLossStrategy,
    pub state: PlaybackState,
}
