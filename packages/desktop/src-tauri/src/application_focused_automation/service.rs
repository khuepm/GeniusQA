//! Service Integration Module
//! 
//! This module provides the main service that integrates all application-focused
//! automation components and manages their lifecycle.

use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tokio::sync::mpsc;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

use crate::application_focused_automation::{
    ApplicationRegistry, FocusMonitor, PlaybackController, NotificationService,
    ApplicationFocusConfig, ApplicationFocusedAutomationError,
    NotificationConfig,
    types::{FocusEvent, PlaybackState, ApplicationStatus,
        RegisteredApplication, ApplicationInfo, FocusLossStrategy, PauseReason,
        AutomationProgressSnapshot, ErrorRecoveryStrategy}
};

/// Service state enumeration
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ServiceState {
    Stopped,
    Starting,
    Running,
    Stopping,
    Error(String),
}

/// Service statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceStats {
    pub state: ServiceState,
    pub uptime_seconds: u64,
    pub registered_applications: usize,
    pub active_sessions: usize,
    pub total_focus_events: u64,
    pub total_playback_sessions: u64,
    pub last_error: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
}

/// Main service that integrates all application-focused automation components
pub struct ApplicationFocusedAutomationService {
    state: Arc<Mutex<ServiceState>>,
    config: ApplicationFocusConfig,
    registry: Arc<Mutex<ApplicationRegistry>>,
    focus_monitors: Arc<Mutex<HashMap<String, FocusMonitor>>>,
    playback_controller: Arc<Mutex<PlaybackController>>,
    notification_service: Arc<Mutex<NotificationService>>,
    event_sender: mpsc::UnboundedSender<ServiceEvent>,
    event_receiver: Arc<Mutex<Option<mpsc::UnboundedReceiver<ServiceEvent>>>>,
    stats: Arc<Mutex<ServiceStats>>,
    started_at: Arc<Mutex<Option<DateTime<Utc>>>>,
}

/// Internal service events
#[derive(Debug, Clone)]
pub enum ServiceEvent {
    FocusChanged {
        app_id: String,
        event: FocusEvent,
    },
    PlaybackStateChanged {
        session_id: String,
        state: PlaybackState,
    },
    ApplicationStatusChanged {
        app_id: String,
        status: ApplicationStatus,
    },
    ServiceError {
        component: String,
        error: String,
    },
    Shutdown,
}

impl ApplicationFocusedAutomationService {
    /// Create a new service instance
    pub fn new() -> Result<Self, ApplicationFocusedAutomationError> {
        let config = ApplicationFocusConfig::default();
        let (event_sender, event_receiver) = mpsc::unbounded_channel();
        
        let stats = ServiceStats {
            state: ServiceState::Stopped,
            uptime_seconds: 0,
            registered_applications: 0,
            active_sessions: 0,
            total_focus_events: 0,
            total_playback_sessions: 0,
            last_error: None,
            started_at: None,
        };

        Ok(Self {
            state: Arc::new(Mutex::new(ServiceState::Stopped)),
            config,
            registry: Arc::new(Mutex::new(ApplicationRegistry::new())),
            focus_monitors: Arc::new(Mutex::new(HashMap::new())),
            playback_controller: Arc::new(Mutex::new(PlaybackController::new())),
            notification_service: Arc::new(Mutex::new(NotificationService::new(NotificationConfig::default()))),
            event_sender,
            event_receiver: Arc::new(Mutex::new(Some(event_receiver))),
            stats: Arc::new(Mutex::new(stats)),
            started_at: Arc::new(Mutex::new(None)),
        })
    }

    /// Start the service and all its components
    pub async fn start(&self) -> Result<(), ApplicationFocusedAutomationError> {
        log::info!("[Service] Starting Application-Focused Automation Service");
        
        // Update state to starting
        {
            let mut state = self.state.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock state: {}", e))
            })?;
            *state = ServiceState::Starting;
        }

        // Initialize notification service
        {
            let mut notification_service = self.notification_service.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock notification service: {}", e))
            })?;
            notification_service.start().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to start notification service: {}", e))
            })?;
        }

        // Start event processing loop
        self.start_event_loop().await?;

        // Update state to running
        {
            let mut state = self.state.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock state: {}", e))
            })?;
            *state = ServiceState::Running;
        }

        // Update started time
        {
            let mut started_at = self.started_at.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock started_at: {}", e))
            })?;
            *started_at = Some(Utc::now());
        }

        // Update stats
        {
            let mut stats = self.stats.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock stats: {}", e))
            })?;
            stats.state = ServiceState::Running;
            stats.started_at = Some(Utc::now());
        }

        log::info!("[Service] Application-Focused Automation Service started successfully");
        Ok(())
    }

    /// Stop the service and all its components
    pub async fn stop(&self) -> Result<(), ApplicationFocusedAutomationError> {
        log::info!("[Service] Stopping Application-Focused Automation Service");
        
        // Update state to stopping
        {
            let mut state = self.state.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock state: {}", e))
            })?;
            *state = ServiceState::Stopping;
        }

        // Send shutdown event
        if let Err(e) = self.event_sender.send(ServiceEvent::Shutdown) {
            log::warn!("[Service] Failed to send shutdown event: {}", e);
        }

        // Stop all focus monitors
        {
            let mut monitors = self.focus_monitors.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock focus monitors: {}", e))
            })?;
            for (app_id, monitor) in monitors.iter_mut() {
                if let Err(e) = monitor.stop_monitoring() {
                    log::warn!("[Service] Failed to stop focus monitor for {}: {}", app_id, e);
                }
            }
            monitors.clear();
        }

        // Stop playback controller
        {
            let mut controller = self.playback_controller.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock playback controller: {}", e))
            })?;
            if let Err(e) = controller.stop_playback() {
                log::warn!("[Service] Failed to stop playback controller: {}", e);
            }
        }

        // Stop notification service
        {
            let mut notification_service = self.notification_service.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock notification service: {}", e))
            })?;
            if let Err(e) = notification_service.stop() {
                log::warn!("[Service] Failed to stop notification service: {}", e);
            }
        }

        // Update state to stopped
        {
            let mut state = self.state.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock state: {}", e))
            })?;
            *state = ServiceState::Stopped;
        }

        // Update stats
        {
            let mut stats = self.stats.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock stats: {}", e))
            })?;
            stats.state = ServiceState::Stopped;
        }

        log::info!("[Service] Application-Focused Automation Service stopped successfully");
        Ok(())
    }

    /// Get current service state
    pub fn get_state(&self) -> Result<ServiceState, ApplicationFocusedAutomationError> {
        let state = self.state.lock().map_err(|e| {
            ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock state: {}", e))
        })?;
        Ok(state.clone())
    }

    /// Get service statistics
    pub fn get_stats(&self) -> Result<ServiceStats, ApplicationFocusedAutomationError> {
        let mut stats = self.stats.lock().map_err(|e| {
            ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock stats: {}", e))
        })?;
        
        // Update uptime
        if let Some(started_at) = *self.started_at.lock().map_err(|e| {
            ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock started_at: {}", e))
        })? {
            stats.uptime_seconds = (Utc::now() - started_at).num_seconds() as u64;
        }

        // Update registered applications count
        let registry = self.registry.lock().map_err(|e| {
            ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock registry: {}", e))
        })?;
        stats.registered_applications = registry.get_registered_applications().len();

        // Update active sessions count
        let controller = self.playback_controller.lock().map_err(|e| {
            ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock playback controller: {}", e))
        })?;
        stats.active_sessions = if controller.has_active_session() { 1 } else { 0 };

        Ok(stats.clone())
    }

    /// Get application registry
    pub fn get_registry(&self) -> Arc<Mutex<ApplicationRegistry>> {
        self.registry.clone()
    }

    /// Get playback controller
    pub fn get_playback_controller(&self) -> Arc<Mutex<PlaybackController>> {
        self.playback_controller.clone()
    }

    /// Get notification service
    pub fn get_notification_service(&self) -> Arc<Mutex<NotificationService>> {
        self.notification_service.clone()
    }

    /// Register an application and set up focus monitoring
    pub async fn register_application_with_monitoring(
        &self,
        app_info: ApplicationInfo,
        default_focus_strategy: FocusLossStrategy,
    ) -> Result<String, ApplicationFocusedAutomationError> {
        log::info!("[Service] Registering application with monitoring: {}", app_info.name);

        // Register application
        let app_id = {
            let mut registry = self.registry.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock registry: {}", e))
            })?;
            let app_id = registry.register_application(app_info.clone())?;
            
            // Update default focus strategy
            if let Some(app) = registry.get_application(&app_id).cloned() {
                // Create updated app with new focus strategy
                let mut updated_app = app;
                updated_app.default_focus_strategy = default_focus_strategy;
                registry.update_application(updated_app)?;
            }
            
            app_id
        };

        // Set up focus monitoring if application has a process ID
        let mut focus_monitor = FocusMonitor::new();
        let _receiver = focus_monitor.start_monitoring(app_id.clone(), app_info.process_id)?;
            
            // Store the monitor
            {
                let mut monitors = self.focus_monitors.lock().map_err(|e| {
                    ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock focus monitors: {}", e))
                })?;
                monitors.insert(app_id.clone(), focus_monitor);
            }

            log::info!("[Service] Focus monitoring started for application: {}", app_id);

        // Send application status change event
        if let Err(e) = self.event_sender.send(ServiceEvent::ApplicationStatusChanged {
            app_id: app_id.clone(),
            status: ApplicationStatus::Active,
        }) {
            log::warn!("[Service] Failed to send application status change event: {}", e);
        }

        log::info!("[Service] Application registered successfully: {}", app_id);
        Ok(app_id)
    }

    /// Unregister an application and stop its focus monitoring
    pub async fn unregister_application_with_cleanup(
        &self,
        app_id: &str,
    ) -> Result<(), ApplicationFocusedAutomationError> {
        log::info!("[Service] Unregistering application with cleanup: {}", app_id);

        // Stop focus monitoring
        {
            let mut monitors = self.focus_monitors.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock focus monitors: {}", e))
            })?;
            if let Some(mut monitor) = monitors.remove(app_id) {
                if let Err(e) = monitor.stop_monitoring() {
                    log::warn!("[Service] Failed to stop focus monitor for {}: {}", app_id, e);
                }
            }
        }

        // Stop any active playback for this application
        {
            let mut controller = self.playback_controller.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock playback controller: {}", e))
            })?;
            if let Some(session) = controller.get_playback_status() {
                if session.target_app_id == app_id {
                    if let Err(e) = controller.stop_playback() {
                        log::warn!("[Service] Failed to stop playback for {}: {}", app_id, e);
                    }
                }
            }
        }

        // Unregister from registry
        {
            let mut registry = self.registry.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock registry: {}", e))
            })?;
            registry.unregister_application(app_id)?;
        }

        log::info!("[Service] Application unregistered successfully: {}", app_id);
        Ok(())
    }

    /// Start focused playback with integrated monitoring
    pub async fn start_integrated_playback(
        &self,
        app_id: String,
        focus_strategy: FocusLossStrategy,
    ) -> Result<String, ApplicationFocusedAutomationError> {
        log::info!("[Service] Starting integrated playback for app: {} with strategy: {:?}", app_id, focus_strategy);

        // Validate application exists and is active
        let (process_id, app_name) = {
            let registry = self.registry.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock registry: {}", e))
            })?;
            
            let app = registry.get_application(&app_id)
                .ok_or_else(|| ApplicationFocusedAutomationError::ApplicationNotFound(app_id.clone()))?;
            
            if app.status != ApplicationStatus::Active {
                return Err(ApplicationFocusedAutomationError::ApplicationNotActive(app_id));
            }
            
            let process_id = app.process_id
                .ok_or_else(|| ApplicationFocusedAutomationError::ServiceError("Application has no process ID".to_string()))?;
            
            (process_id, app.name.clone())
        };

        // Start playback
        let session_id = {
            let mut controller = self.playback_controller.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock playback controller: {}", e))
            })?;
            controller.start_playback(app_id.clone(), process_id, focus_strategy)?
        };

        // Ensure focus monitoring is active
        {
            let monitors = self.focus_monitors.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock focus monitors: {}", e))
            })?;
            if !monitors.contains_key(&app_id) {
                drop(monitors);
                
                // Start focus monitoring
                let mut focus_monitor = FocusMonitor::new();
                let _receiver = focus_monitor.start_monitoring(app_id.clone(), process_id)?;
                
                let mut monitors = self.focus_monitors.lock().map_err(|e| {
                    ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock focus monitors: {}", e))
                })?;
                monitors.insert(app_id.clone(), focus_monitor);
                
                log::info!("[Service] Started focus monitoring for playback session");
            }
        }

        // Send playback state change event
        if let Err(e) = self.event_sender.send(ServiceEvent::PlaybackStateChanged {
            session_id: session_id.clone(),
            state: PlaybackState::Running,
        }) {
            log::warn!("[Service] Failed to send playback state change event: {}", e);
        }

        // Update stats
        {
            let mut stats = self.stats.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock stats: {}", e))
            })?;
            stats.total_playback_sessions += 1;
        }

        log::info!("[Service] Integrated playback started successfully: {}", session_id);
        Ok(session_id)
    }

    /// Start the event processing loop
    async fn start_event_loop(&self) -> Result<(), ApplicationFocusedAutomationError> {
        let event_receiver = {
            let mut receiver_option = self.event_receiver.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock event receiver: {}", e))
            })?;
            receiver_option.take()
                .ok_or_else(|| ApplicationFocusedAutomationError::ServiceError("Event receiver already taken".to_string()))?
        };

        let stats = self.stats.clone();
        let state = self.state.clone();

        // Spawn event processing task
        tokio::spawn(async move {
            let mut receiver = event_receiver;
            
            loop {
                match receiver.recv().await {
                    Some(ServiceEvent::FocusChanged { app_id, event }) => {
                        log::debug!("[Service] Focus changed for {}: {:?}", app_id, event);
                        
                        // Update stats
                        if let Ok(mut stats) = stats.lock() {
                            stats.total_focus_events += 1;
                        }
                    }
                    Some(ServiceEvent::PlaybackStateChanged { session_id, state: playback_state }) => {
                        log::debug!("[Service] Playback state changed for {}: {:?}", session_id, playback_state);
                    }
                    Some(ServiceEvent::ApplicationStatusChanged { app_id, status }) => {
                        log::debug!("[Service] Application status changed for {}: {:?}", app_id, status);
                    }
                    Some(ServiceEvent::ServiceError { component, error }) => {
                        log::error!("[Service] Component error in {}: {}", component, error);
                        
                        // Update stats with error
                        if let Ok(mut stats) = stats.lock() {
                            stats.last_error = Some(format!("{}: {}", component, error));
                        }
                        
                        // Update service state to error
                        if let Ok(mut service_state) = state.lock() {
                            *service_state = ServiceState::Error(format!("{}: {}", component, error));
                        }
                    }
                    Some(ServiceEvent::Shutdown) => {
                        log::info!("[Service] Received shutdown event, stopping event loop");
                        break;
                    }
                    None => {
                        log::warn!("[Service] Event channel closed, stopping event loop");
                        break;
                    }
                }
            }
            
            log::info!("[Service] Event processing loop stopped");
        });

        Ok(())
    }

    /// Get focus monitor for a specific application
    pub fn get_focus_monitor(&self, app_id: &str) -> Result<bool, ApplicationFocusedAutomationError> {
        let monitors = self.focus_monitors.lock().map_err(|e| {
            ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock focus monitors: {}", e))
        })?;
        Ok(monitors.contains_key(app_id))
    }

    /// Check if service is healthy
    pub fn is_healthy(&self) -> bool {
        match self.get_state() {
            Ok(ServiceState::Running) => true,
            _ => false,
        }
    }

    /// Perform health check on all components
    pub async fn health_check(&self) -> Result<HashMap<String, bool>, ApplicationFocusedAutomationError> {
        let mut health = HashMap::new();
        
        // Check service state
        health.insert("service".to_string(), self.is_healthy());
        
        // Check registry
        let registry_healthy = {
            let registry = self.registry.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock registry: {}", e))
            })?;
            // Registry is healthy if we can access it
            true
        };
        health.insert("registry".to_string(), registry_healthy);
        
        // Check playback controller
        let controller_healthy = {
            let controller = self.playback_controller.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock playback controller: {}", e))
            })?;
            // Controller is healthy if we can access it
            true
        };
        health.insert("playback_controller".to_string(), controller_healthy);
        
        // Check notification service
        let notification_healthy = {
            let notification_service = self.notification_service.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock notification service: {}", e))
            })?;
            notification_service.is_running()
        };
        health.insert("notification_service".to_string(), notification_healthy);
        
        // Check focus monitors
        let monitors_healthy = {
            let monitors = self.focus_monitors.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock focus monitors: {}", e))
            })?;
            monitors.values().all(|monitor| monitor.is_monitoring())
        };
        health.insert("focus_monitors".to_string(), monitors_healthy);
        
        Ok(health)
    }

    /// Optimize service performance by cleaning up unused resources
    /// 
    /// Requirements: 3.4 - Performance optimization and cleanup
    pub async fn optimize_performance(&self) -> Result<(), ApplicationFocusedAutomationError> {
        log::info!("[Service] Starting performance optimization");

        // Clean up inactive focus monitors
        {
            let mut monitors = self.focus_monitors.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock focus monitors: {}", e))
            })?;

            let mut inactive_monitors = Vec::new();
            for (app_id, monitor) in monitors.iter() {
                if !monitor.is_monitoring() {
                    inactive_monitors.push(app_id.clone());
                }
            }

            for app_id in inactive_monitors {
                log::debug!("[Service] Removing inactive focus monitor for app: {}", app_id);
                monitors.remove(&app_id);
            }
        }

        // Clean up completed or failed playback sessions
        {
            let mut controller = self.playback_controller.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock playback controller: {}", e))
            })?;

            // If there's a session that's completed or failed, clean it up
            if let Some(session) = controller.get_playback_status() {
                match session.state {
                    PlaybackState::Completed | PlaybackState::Failed(_) | PlaybackState::Aborted(_) => {
                        log::debug!("[Service] Cleaning up completed/failed session: {}", session.id);
                        let _ = controller.stop_playback();
                    }
                    _ => {}
                }
            }
        }

        // Update statistics
        self.update_stats().await?;

        log::info!("[Service] Performance optimization completed");
        Ok(())
    }

    /// Update service statistics for monitoring
    async fn update_stats(&self) -> Result<(), ApplicationFocusedAutomationError> {
        let mut stats = self.stats.lock().map_err(|e| {
            ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock stats: {}", e))
        })?;

        let state = self.state.lock().map_err(|e| {
            ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock state: {}", e))
        })?.clone();

        let registry = self.registry.lock().map_err(|e| {
            ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock registry: {}", e))
        })?;

        let controller = self.playback_controller.lock().map_err(|e| {
            ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock controller: {}", e))
        })?;

        stats.state = state;
        stats.registered_applications = registry.get_registered_applications().len();
        stats.active_sessions = if controller.has_active_session() { 1 } else { 0 };

        if let Some(started_at) = *self.started_at.lock().unwrap() {
            stats.uptime_seconds = (Utc::now() - started_at).num_seconds() as u64;
            stats.started_at = Some(started_at);
        }

        Ok(())
    }

    /// Perform resource cleanup and optimization
    /// 
    /// Requirements: 3.4 - Implement proper resource cleanup
    pub async fn cleanup_resources(&self) -> Result<(), ApplicationFocusedAutomationError> {
        log::info!("[Service] Starting resource cleanup");

        // Stop all focus monitors
        {
            let mut monitors = self.focus_monitors.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock focus monitors: {}", e))
            })?;

            for (app_id, monitor) in monitors.iter_mut() {
                if monitor.is_monitoring() {
                    log::debug!("[Service] Stopping focus monitor for app: {}", app_id);
                    if let Err(e) = monitor.stop_monitoring() {
                        log::warn!("[Service] Failed to stop focus monitor for {}: {}", app_id, e);
                    }
                }
            }
            monitors.clear();
        }

        // Stop any active playback sessions
        {
            let mut controller = self.playback_controller.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock playback controller: {}", e))
            })?;

            if controller.has_active_session() {
                log::debug!("[Service] Stopping active playback session");
                if let Err(e) = controller.stop_playback() {
                    log::warn!("[Service] Failed to stop playback session: {}", e);
                }
            }
        }

        // Clear notification service
        {
            let mut notification_service = self.notification_service.lock().map_err(|e| {
                ApplicationFocusedAutomationError::ServiceError(format!("Failed to lock notification service: {}", e))
            })?;

            notification_service.clear_all_notifications();
        }

        log::info!("[Service] Resource cleanup completed");
        Ok(())
    }
}

impl Default for ApplicationFocusedAutomationService {
    fn default() -> Self {
        Self::new().expect("Failed to create default ApplicationFocusedAutomationService")
    }
}

// Implement Drop to ensure proper cleanup
impl Drop for ApplicationFocusedAutomationService {
    fn drop(&mut self) {
        log::info!("[Service] ApplicationFocusedAutomationService dropping, performing cleanup");
        
        // Send shutdown event if possible
        if let Err(e) = self.event_sender.send(ServiceEvent::Shutdown) {
            log::warn!("[Service] Failed to send shutdown event during drop: {}", e);
        }
        
        // Stop all focus monitors
        if let Ok(mut monitors) = self.focus_monitors.lock() {
            for (app_id, monitor) in monitors.iter_mut() {
                if let Err(e) = monitor.stop_monitoring() {
                    log::warn!("[Service] Failed to stop focus monitor for {} during drop: {}", app_id, e);
                }
            }
            monitors.clear();
        }
        
        log::info!("[Service] ApplicationFocusedAutomationService cleanup completed");
    }
}
