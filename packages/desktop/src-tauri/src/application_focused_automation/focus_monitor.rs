//! Focus monitoring service for tracking application focus state

use crate::application_focused_automation::{
    error::FocusError,
    types::{FocusEvent, FocusState},
};
use chrono::Utc;
use std::sync::{Arc, RwLock, atomic::{AtomicBool, Ordering}};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tokio::time::sleep;
use tauri::Manager;

/// Monitors application focus state and generates focus events
pub struct FocusMonitor {
    target_app_id: Option<String>,
    target_process_id: Option<u32>,
    current_focus_state: Arc<RwLock<FocusState>>,
    event_sender: Option<mpsc::Sender<FocusEvent>>,
    monitor_handle: Option<JoinHandle<()>>,
    stop_signal: Arc<AtomicBool>,
    // Optional Tauri app handle for real-time event emission
    app_handle: Option<tauri::AppHandle>,
}

impl FocusMonitor {
    /// Create a new focus monitor
    pub fn new() -> Self {
        let initial_state = FocusState {
            is_target_process_focused: false,
            focused_process_id: None,
            focused_window_title: None,
            last_change: Utc::now(),
        };

        Self {
            target_app_id: None,
            target_process_id: None,
            current_focus_state: Arc::new(RwLock::new(initial_state)),
            event_sender: None,
            monitor_handle: None,
            stop_signal: Arc::new(AtomicBool::new(false)),
            app_handle: None,
        }
    }

    /// Create a new focus monitor with Tauri app handle for real-time events
    /// 
    /// Requirements: 5.5 - Real-time event streaming
    pub fn new_with_app_handle(app_handle: tauri::AppHandle) -> Self {
        let initial_state = FocusState {
            is_target_process_focused: false,
            focused_process_id: None,
            focused_window_title: None,
            last_change: Utc::now(),
        };

        Self {
            target_app_id: None,
            target_process_id: None,
            current_focus_state: Arc::new(RwLock::new(initial_state)),
            event_sender: None,
            monitor_handle: None,
            stop_signal: Arc::new(AtomicBool::new(false)),
            app_handle: Some(app_handle),
        }
    }

    /// Set the Tauri app handle for real-time event emission
    /// 
    /// Requirements: 5.5 - Enable real-time status broadcasting
    pub fn set_app_handle(&mut self, app_handle: tauri::AppHandle) {
        self.app_handle = Some(app_handle);
    }

    /// Start monitoring focus for a specific application
    /// 
    /// Requirements: 3.1, 3.2, 3.3
    /// - 3.1: Continuously monitor if target application process is active
    /// - 3.2: Immediately notify on focus loss
    /// - 3.3: Notify on focus regain
    pub fn start_monitoring(&mut self, app_id: String, process_id: u32) -> Result<mpsc::Receiver<FocusEvent>, FocusError> {
        if self.target_app_id.is_some() {
            return Err(FocusError::MonitoringAlreadyActive);
        }

        // Validate process ID
        if process_id == 0 {
            return Err(FocusError::InvalidProcessId(process_id));
        }

        let (sender, receiver) = mpsc::channel(100);
        
        self.target_app_id = Some(app_id.clone());
        self.target_process_id = Some(process_id);
        self.event_sender = Some(sender.clone());

        // Update focus state timestamp when starting monitoring
        {
            let mut state = self.current_focus_state.write().unwrap();
            *state = FocusState {
                is_target_process_focused: false,
                focused_process_id: None,
                focused_window_title: None,
                last_change: Utc::now(),
            };
        }

        // Reset stop signal
        self.stop_signal.store(false, Ordering::Relaxed);

        // Start the monitoring task
        let focus_state = Arc::clone(&self.current_focus_state);
        let stop_signal = Arc::clone(&self.stop_signal);
        let app_handle = self.app_handle.clone();
        let monitor_handle = tokio::spawn(async move {
            Self::monitor_focus_loop(app_id, process_id, sender, focus_state, stop_signal, app_handle).await;
        });

        self.monitor_handle = Some(monitor_handle);

        Ok(receiver)
    }

    /// Stop monitoring focus
    pub fn stop_monitoring(&mut self) -> Result<(), FocusError> {
        if self.target_app_id.is_none() {
            return Err(FocusError::MonitoringNotStarted);
        }

        // Signal the monitoring task to stop
        self.stop_signal.store(true, Ordering::Relaxed);

        // Stop the monitoring task
        if let Some(handle) = self.monitor_handle.take() {
            handle.abort();
        }

        // Clear target information first
        self.target_app_id = None;
        self.target_process_id = None;
        self.event_sender = None;

        // Reset focus state after stopping the task to avoid race conditions
        {
            let mut state = self.current_focus_state.write().unwrap();
            *state = FocusState {
                is_target_process_focused: false,
                focused_process_id: None,
                focused_window_title: None,
                last_change: Utc::now(),
            };
        }

        Ok(())
    }

    /// Get the current focus state
    pub fn get_current_focus_state(&self) -> FocusState {
        self.current_focus_state.read().unwrap().clone()
    }

    /// Check if monitoring is currently active
    pub fn is_monitoring(&self) -> bool {
        self.target_app_id.is_some()
    }

    /// Get the target application ID being monitored
    pub fn get_target_app_id(&self) -> Option<&str> {
        self.target_app_id.as_deref()
    }

    /// Get the target process ID being monitored
    pub fn get_target_process_id(&self) -> Option<u32> {
        self.target_process_id
    }

    /// Internal monitoring loop that runs in a background task
    async fn monitor_focus_loop(
        app_id: String,
        target_process_id: u32,
        sender: mpsc::Sender<FocusEvent>,
        focus_state: Arc<RwLock<FocusState>>,
        stop_signal: Arc<AtomicBool>,
        app_handle: Option<tauri::AppHandle>,
    ) {
        let mut last_focused_process_id: Option<u32> = None;
        let mut process_name_cache: std::collections::HashMap<u32, String> = std::collections::HashMap::new();
        
        // Adaptive polling intervals for performance optimization (Requirement 3.4)
        let fast_interval = Duration::from_millis(50);  // Fast polling when target is focused
        let normal_interval = Duration::from_millis(100); // Normal polling
        let slow_interval = Duration::from_millis(250);   // Slow polling when target not focused
        
        let mut current_interval = normal_interval;
        let mut consecutive_errors = 0;
        const MAX_CONSECUTIVE_ERRORS: u32 = 5;

        log::info!("Starting optimized focus monitoring for app '{}' with process ID {}", app_id, target_process_id);

        loop {
            // Check if we should stop monitoring
            if stop_signal.load(Ordering::Relaxed) {
                log::info!("Stop signal received, ending focus monitoring for app '{}'", app_id);
                break;
            }

            // Get current focused process ID (platform-specific implementation will be added later)
            let current_focused_process_id = Self::get_focused_process_id().await;
            
            match current_focused_process_id {
                Ok(focused_pid) => {
                    // Reset error counter on successful query
                    consecutive_errors = 0;
                    
                    let is_target_focused = focused_pid == Some(target_process_id);
                    let focus_changed = focused_pid != last_focused_process_id;

                    // Adaptive polling optimization: adjust interval based on focus state
                    current_interval = if is_target_focused {
                        fast_interval  // Fast polling when target is focused for quick detection of focus loss
                    } else if last_focused_process_id == Some(target_process_id) {
                        normal_interval // Normal polling right after losing focus
                    } else {
                        slow_interval  // Slow polling when target is not focused
                    };

                    if focus_changed {
                        // Log focus state transition (Requirement 3.5)
                        if is_target_focused {
                            log::info!("Focus gained: Target application '{}' (PID: {}) gained focus", app_id, target_process_id);
                        } else if last_focused_process_id == Some(target_process_id) {
                            let new_focused_name = if let Some(pid) = focused_pid {
                                // Use cached process name or fetch and cache it
                                if let Some(cached_name) = process_name_cache.get(&pid) {
                                    cached_name.clone()
                                } else {
                                    let name = Self::get_process_name(pid).await.unwrap_or_else(|_| format!("PID {}", pid));
                                    process_name_cache.insert(pid, name.clone());
                                    // Limit cache size to prevent memory growth
                                    if process_name_cache.len() > 50 {
                                        process_name_cache.clear();
                                    }
                                    name
                                }
                            } else {
                                "No application".to_string()
                            };
                            log::info!("Focus lost: Target application '{}' (PID: {}) lost focus to '{}'", 
                                     app_id, target_process_id, new_focused_name);
                        } else {
                            log::debug!("Focus changed between other applications: {:?} -> {:?}", 
                                      last_focused_process_id, focused_pid);
                        }

                        // Optimize lock usage: minimize time holding the write lock
                        let window_title = if focus_changed && is_target_focused {
                            // Only get window title when target gains focus to reduce system calls
                            Self::get_window_title(focused_pid).await.ok()
                        } else {
                            None
                        };

                        // Update focus state with minimal lock time
                        {
                            let mut state = focus_state.write().unwrap();
                            state.is_target_process_focused = is_target_focused;
                            state.focused_process_id = focused_pid;
                            if let Some(title) = window_title.as_ref() {
                                state.focused_window_title = Some(title.clone());
                            }
                            state.last_change = Utc::now();
                        } // Lock guard is dropped here immediately

                        // Generate appropriate focus event
                        let event = if is_target_focused {
                            FocusEvent::TargetProcessGainedFocus {
                                app_id: app_id.clone(),
                                process_id: target_process_id,
                                window_title: window_title.unwrap_or_default(),
                                timestamp: Utc::now(),
                            }
                        } else if last_focused_process_id == Some(target_process_id) {
                            // Target process lost focus - use cached process name if available
                            let new_focused_app = if let Some(pid) = focused_pid {
                                if let Some(cached_name) = process_name_cache.get(&pid) {
                                    Some(cached_name.clone())
                                } else {
                                    let name = Self::get_process_name(pid).await.ok();
                                    if let Some(ref name_str) = name {
                                        process_name_cache.insert(pid, name_str.clone());
                                        // Limit cache size
                                        if process_name_cache.len() > 50 {
                                            process_name_cache.clear();
                                        }
                                    }
                                    name
                                }
                            } else {
                                None
                            };

                            FocusEvent::TargetProcessLostFocus {
                                app_id: app_id.clone(),
                                process_id: target_process_id,
                                new_focused_app,
                                timestamp: Utc::now(),
                            }
                        } else {
                            // Focus changed between other applications, no event needed
                            last_focused_process_id = focused_pid;
                            sleep(current_interval).await;
                            continue;
                        };

                        // Send the event
                        if sender.send(event.clone()).await.is_err() {
                            log::warn!("Focus event receiver dropped, stopping monitoring for app '{}'", app_id);
                            break;
                        }

                        // Emit real-time event to frontend if app handle is available
                        // Requirements: 5.5 - Real-time event streaming
                        if let Some(ref app_handle) = app_handle {
                            let event_json = match &event {
                                FocusEvent::TargetProcessGainedFocus { app_id, process_id, window_title, timestamp } => {
                                    serde_json::json!({
                                        "type": "target_process_gained_focus",
                                        "app_id": app_id,
                                        "process_id": process_id,
                                        "window_title": window_title,
                                        "timestamp": timestamp.to_rfc3339()
                                    })
                                }
                                FocusEvent::TargetProcessLostFocus { app_id, process_id, new_focused_app, timestamp } => {
                                    serde_json::json!({
                                        "type": "target_process_lost_focus",
                                        "app_id": app_id,
                                        "process_id": process_id,
                                        "new_focused_app": new_focused_app,
                                        "timestamp": timestamp.to_rfc3339()
                                    })
                                }
                                FocusEvent::FocusError { error, timestamp } => {
                                    serde_json::json!({
                                        "type": "focus_error",
                                        "error": error,
                                        "timestamp": timestamp.to_rfc3339()
                                    })
                                }
                            };

                            if let Err(e) = app_handle.emit_all("focus_event", event_json) {
                                log::warn!("Failed to emit real-time focus event: {}", e);
                            }
                        }

                        last_focused_process_id = focused_pid;
                    } else {
                        // No focus change, use adaptive interval for performance
                        sleep(current_interval).await;
                        continue;
                    }
                }
                Err(error) => {
                    consecutive_errors += 1;
                    log::error!("Focus monitoring error for app '{}' (error #{}/{}): {}", 
                              app_id, consecutive_errors, MAX_CONSECUTIVE_ERRORS, error);
                    
                    // Implement exponential backoff for errors to reduce system load
                    if consecutive_errors >= MAX_CONSECUTIVE_ERRORS {
                        log::error!("Too many consecutive focus monitoring errors for app '{}', stopping monitoring", app_id);
                        break;
                    }
                    
                    // Increase interval on errors to reduce system load
                    current_interval = Duration::from_millis(500 * consecutive_errors as u64);
                    
                    // Send error event
                    let error_event = FocusEvent::FocusError {
                        error: error.to_string(),
                        timestamp: Utc::now(),
                    };

                    if sender.send(error_event.clone()).await.is_err() {
                        log::warn!("Focus event receiver dropped during error, stopping monitoring for app '{}'", app_id);
                        break;
                    }

                    // Emit real-time error event to frontend if app handle is available
                    // Requirements: 5.5 - Real-time event streaming for errors
                    if let Some(ref app_handle) = app_handle {
                        let error_event_json = serde_json::json!({
                            "type": "focus_error",
                            "error": error.to_string(),
                            "timestamp": Utc::now().to_rfc3339()
                        });

                        if let Err(e) = app_handle.emit_all("focus_event", error_event_json) {
                            log::warn!("Failed to emit real-time focus error event: {}", e);
                        }
                    }
                }
            }

            sleep(current_interval).await;
        }

        log::info!("Focus monitoring stopped for app '{}' (PID: {})", app_id, target_process_id);
    }

    /// Get the currently focused process ID (platform-specific implementation placeholder)
    async fn get_focused_process_id() -> Result<Option<u32>, FocusError> {
        // TODO: This will be implemented with platform-specific code in later tasks
        // For now, return a placeholder implementation
        #[cfg(target_os = "windows")]
        {
            Self::get_focused_process_id_windows().await
        }
        #[cfg(target_os = "macos")]
        {
            Self::get_focused_process_id_macos().await
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            Err(FocusError::PlatformApiError("Unsupported platform".to_string()))
        }
    }

    /// Get window title for a given process ID (platform-specific implementation placeholder)
    async fn get_window_title(process_id: Option<u32>) -> Result<String, FocusError> {
        match process_id {
            Some(pid) => {
                // TODO: Platform-specific implementation
                Ok(format!("Window for PID {}", pid))
            }
            None => Ok("No focused window".to_string()),
        }
    }

    /// Get process name for a given process ID (platform-specific implementation placeholder)
    async fn get_process_name(process_id: u32) -> Result<String, FocusError> {
        // TODO: Platform-specific implementation
        Ok(format!("Process {}", process_id))
    }

    #[cfg(target_os = "windows")]
    async fn get_focused_process_id_windows() -> Result<Option<u32>, FocusError> {
        // TODO: Windows-specific implementation using User32 APIs
        // This is a placeholder that will be implemented in later tasks
        Ok(Some(1000)) // Placeholder process ID
    }

    #[cfg(target_os = "macos")]
    async fn get_focused_process_id_macos() -> Result<Option<u32>, FocusError> {
        use crate::application_focused_automation::platform::MacOSFocusMonitor;
        
        // Create a temporary macOS focus monitor to get the focused process ID
        let monitor = MacOSFocusMonitor::new();
        
        // Use the internal method to get focused process ID
        match monitor.get_focused_process_id_internal() {
            Ok(process_id) => Ok(process_id),
            Err(e) => {
                log::warn!("Failed to get focused process ID on macOS: {}", e);
                // Return None instead of error to allow monitoring to continue
                Ok(None)
            }
        }
    }
}

impl Default for FocusMonitor {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for FocusMonitor {
    fn drop(&mut self) {
        // Ensure monitoring is stopped when the monitor is dropped
        let _ = self.stop_monitoring();
    }
}
