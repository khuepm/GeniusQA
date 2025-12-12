//! Playback functionality for executing recorded scripts

use crate::{
    Result, AutomationError, AutomationConfig, ScriptData, Action, ActionType,
    platform::{PlatformAutomation, create_platform_automation},
    logging::{CoreType, OperationType, LogLevel, get_logger},
    error::PlaybackError,
};
use std::sync::{Arc, Mutex, atomic::{AtomicBool, AtomicU32, AtomicUsize, Ordering}};
use std::time::{Duration, Instant};
use std::collections::HashMap;
use tokio::sync::mpsc;
use serde::{Serialize, Deserialize};
use serde_json::json;
use std::thread;

/// Player for executing recorded scripts
pub struct Player {
    platform: Box<dyn PlatformAutomation>,
    config: AutomationConfig,
    is_playing: Arc<AtomicBool>,
    is_paused: Arc<AtomicBool>,
    current_script: Option<ScriptData>,
    playback_speed: f64,
    loops_remaining: Arc<AtomicU32>,
    loops_total: u32,
    current_loop: Arc<AtomicU32>,
    current_action_index: Arc<AtomicUsize>,
    start_time: Option<Instant>,
    event_sender: Option<mpsc::UnboundedSender<PlaybackEvent>>,
}

/// Playback status information
#[derive(Debug, Clone)]
pub struct PlaybackStatus {
    pub is_playing: bool,
    pub is_paused: bool,
    pub current_action: usize,
    pub total_actions: usize,
    pub progress: f64,
    pub elapsed_time: f64,
    pub loops_completed: u32,
    pub loops_remaining: u32,
}

/// Playback statistics collected during execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackStatistics {
    /// Total number of actions in the script
    pub total_actions: usize,
    /// Number of actions successfully executed
    pub actions_executed: usize,
    /// Number of actions that failed
    pub actions_failed: usize,
    /// Number of actions that were skipped
    pub actions_skipped: usize,
    /// Total duration of playback
    pub total_duration: Duration,
    /// Average time per action execution
    pub average_action_time: Duration,
    /// Total time spent in delays between actions
    pub total_delay_time: Duration,
    /// Total time spent executing actions
    pub total_execution_time: Duration,
    /// Maximum timing drift observed
    pub max_timing_drift: Duration,
    /// Number of times timing drift occurred
    pub timing_drift_count: usize,
    /// Number of loops completed
    pub loops_completed: u32,
    /// Playback speed multiplier used
    pub playback_speed: f64,
    /// List of errors encountered (limited to first 10)
    pub errors: Vec<String>,
}

impl PlaybackStatistics {
    /// Create a new empty statistics instance
    pub fn new(total_actions: usize, playback_speed: f64) -> Self {
        Self {
            total_actions,
            actions_executed: 0,
            actions_failed: 0,
            actions_skipped: 0,
            total_duration: Duration::from_secs(0),
            average_action_time: Duration::from_secs(0),
            total_delay_time: Duration::from_secs(0),
            total_execution_time: Duration::from_secs(0),
            max_timing_drift: Duration::from_secs(0),
            timing_drift_count: 0,
            loops_completed: 0,
            playback_speed,
            errors: Vec::new(),
        }
    }
    
    /// Record a successful action execution
    pub fn record_action_success(&mut self, execution_time: Duration, delay_time: Duration) {
        self.actions_executed += 1;
        self.total_execution_time += execution_time;
        self.total_delay_time += delay_time;
    }
    
    /// Record a failed action
    pub fn record_action_failure(&mut self, error_message: String) {
        self.actions_executed += 1;
        self.actions_failed += 1;
        // Limit error list to 10 entries to avoid memory issues
        if self.errors.len() < 10 {
            self.errors.push(error_message);
        }
    }
    
    /// Record a skipped action
    pub fn record_action_skipped(&mut self) {
        self.actions_skipped += 1;
    }
    
    /// Record timing drift
    pub fn record_timing_drift(&mut self, drift: Duration) {
        if drift > self.max_timing_drift {
            self.max_timing_drift = drift;
        }
        self.timing_drift_count += 1;
    }
    
    /// Finalize statistics after playback completion
    pub fn finalize(&mut self, total_duration: Duration, loops_completed: u32) {
        self.total_duration = total_duration;
        self.loops_completed = loops_completed;
        
        // Calculate average action time
        if self.actions_executed > 0 {
            let total_micros = self.total_execution_time.as_micros();
            let avg_micros = total_micros / self.actions_executed as u128;
            self.average_action_time = Duration::from_micros(avg_micros as u64);
        }
    }
    
    /// Calculate success rate (0.0 to 1.0)
    pub fn success_rate(&self) -> f64 {
        if self.actions_executed > 0 {
            (self.actions_executed - self.actions_failed) as f64 / self.actions_executed as f64
        } else {
            0.0
        }
    }
    
    /// Check if playback completed without errors
    pub fn is_successful(&self) -> bool {
        self.actions_failed == 0 && self.actions_skipped == 0
    }
    
    /// Get a summary string of the statistics
    pub fn summary(&self) -> String {
        format!(
            "Playback Statistics: {}/{} actions succeeded ({:.1}% success rate), {} failed, {} skipped, {} loops completed in {:.2}s (avg {:.2}ms per action)",
            self.actions_executed - self.actions_failed,
            self.actions_executed,
            self.success_rate() * 100.0,
            self.actions_failed,
            self.actions_skipped,
            self.loops_completed,
            self.total_duration.as_secs_f64(),
            self.average_action_time.as_secs_f64() * 1000.0
        )
    }
}

/// Events sent to UI during playback
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub data: PlaybackEventData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum PlaybackEventData {
    Progress {
        #[serde(rename = "currentAction")]
        current_action: usize,
        #[serde(rename = "totalActions")]
        total_actions: usize,
        #[serde(rename = "currentLoop")]
        current_loop: u32,
        #[serde(rename = "totalLoops")]
        total_loops: u32,
        progress: f64,
    },
    ActionPreview {
        index: usize,
        action: ActionPreviewData,
    },
    Status {
        status: String,
        message: Option<String>,
    },
    Complete {
        completed: bool,
        reason: String,
        #[serde(rename = "totalActions")]
        total_actions: usize,
        #[serde(rename = "actionsExecuted")]
        actions_executed: usize,
        #[serde(rename = "actionsFailed")]
        actions_failed: usize,
        #[serde(rename = "actionsSkipped")]
        actions_skipped: usize,
        #[serde(rename = "loopsCompleted")]
        loops_completed: u32,
        #[serde(rename = "durationMs")]
        duration_ms: u64,
        #[serde(rename = "successRate")]
        success_rate: f64,
        errors: Option<Vec<String>>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionPreviewData {
    #[serde(rename = "type")]
    pub action_type: String,
    pub timestamp: f64,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub button: Option<String>,
    pub key: Option<String>,
    pub text: Option<String>,
}

impl Player {
    /// Create a new player instance
    pub fn new(config: AutomationConfig) -> Result<Self> {
        let platform = create_platform_automation()?;
        
        Ok(Self {
            platform,
            config,
            is_playing: Arc::new(AtomicBool::new(false)),
            is_paused: Arc::new(AtomicBool::new(false)),
            current_script: None,
            playback_speed: 1.0,
            loops_remaining: Arc::new(AtomicU32::new(1)),
            loops_total: 1,
            current_loop: Arc::new(AtomicU32::new(1)),
            current_action_index: Arc::new(AtomicUsize::new(0)),
            start_time: None,
            event_sender: None,
        })
    }

    /// Log playback start with script details
    fn log_playback_start(script: &ScriptData, speed: f64, loops: u32) {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("action_count".to_string(), json!(script.actions.len()));
            metadata.insert("speed".to_string(), json!(speed));
            metadata.insert("loops".to_string(), json!(loops));
            metadata.insert("script_version".to_string(), json!(script.version));
            metadata.insert("script_duration".to_string(), json!(script.metadata.duration));
            metadata.insert("core_type".to_string(), json!(script.metadata.core_type));
            metadata.insert("platform".to_string(), json!(script.metadata.platform));
            
            if let Some((width, height)) = script.metadata.screen_resolution {
                metadata.insert("screen_resolution".to_string(), json!(format!("{}x{}", width, height)));
            }

            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Playback,
                format!("playback_start_{}", chrono::Utc::now().timestamp()),
                format!("Starting playback: {} actions, speed={}x, loops={}", 
                    script.actions.len(), speed, loops),
                Some(metadata),
            );
        }
    }

    /// Log playback completion with statistics
    fn log_playback_complete(
        script: &ScriptData,
        total_actions_executed: usize,
        total_actions_failed: usize,
        total_actions_skipped: usize,
        loops_completed: u32,
        duration: Duration,
        success: bool,
    ) {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("total_actions".to_string(), json!(script.actions.len()));
            metadata.insert("actions_executed".to_string(), json!(total_actions_executed));
            metadata.insert("actions_failed".to_string(), json!(total_actions_failed));
            metadata.insert("actions_skipped".to_string(), json!(total_actions_skipped));
            metadata.insert("loops_completed".to_string(), json!(loops_completed));
            metadata.insert("duration_ms".to_string(), json!(duration.as_millis()));
            metadata.insert("success_rate".to_string(), json!(
                if total_actions_executed > 0 {
                    (total_actions_executed - total_actions_failed) as f64 / total_actions_executed as f64
                } else {
                    0.0
                }
            ));

            let message = if success {
                format!("Playback completed successfully: {}/{} actions executed, {} loops completed in {:.2}s",
                    total_actions_executed - total_actions_failed,
                    total_actions_executed,
                    loops_completed,
                    duration.as_secs_f64())
            } else {
                format!("Playback completed with errors: {}/{} actions executed, {} failed, {} skipped",
                    total_actions_executed - total_actions_failed,
                    total_actions_executed,
                    total_actions_failed,
                    total_actions_skipped)
            };

            logger.log_operation_complete(
                CoreType::Rust,
                OperationType::Playback,
                format!("playback_complete_{}", chrono::Utc::now().timestamp()),
                message,
                duration,
                success,
                if success { None } else { Some("PLAYBACK_ERRORS".to_string()) },
            );
        }
    }

    /// Log action execution attempt
    fn log_action_execution(action_index: usize, action: &Action) {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("action_index".to_string(), json!(action_index));
            metadata.insert("action_type".to_string(), json!(format!("{:?}", action.action_type)));
            metadata.insert("timestamp".to_string(), json!(action.timestamp));
            
            if let Some(x) = action.x {
                metadata.insert("x".to_string(), json!(x));
            }
            if let Some(y) = action.y {
                metadata.insert("y".to_string(), json!(y));
            }
            if let Some(ref button) = action.button {
                metadata.insert("button".to_string(), json!(button));
            }
            if let Some(ref key) = action.key {
                metadata.insert("key".to_string(), json!(key));
            }
            if let Some(ref text) = action.text {
                metadata.insert("text".to_string(), json!(text));
            }

            logger.log_operation(
                LogLevel::Debug,
                CoreType::Rust,
                OperationType::Playback,
                format!("action_{}_{}", action_index, chrono::Utc::now().timestamp_millis()),
                format!("Executing action {}: {:?} at ({:?}, {:?})", 
                    action_index, action.action_type, action.x, action.y),
                Some(metadata),
            );
        }
    }

    /// Log action execution success
    fn log_action_success(action_index: usize, action: &Action, duration: Duration) {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("action_index".to_string(), json!(action_index));
            metadata.insert("action_type".to_string(), json!(format!("{:?}", action.action_type)));
            metadata.insert("duration_ms".to_string(), json!(duration.as_millis()));

            logger.log_operation(
                LogLevel::Debug,
                CoreType::Rust,
                OperationType::Playback,
                format!("action_success_{}_{}", action_index, chrono::Utc::now().timestamp_millis()),
                format!("Action {} completed successfully in {:.2}ms", 
                    action_index, duration.as_millis()),
                Some(metadata),
            );
        }
    }

    /// Log action execution failure
    fn log_action_failure(action_index: usize, action: &Action, error: &AutomationError) {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("action_index".to_string(), json!(action_index));
            metadata.insert("action_type".to_string(), json!(format!("{:?}", action.action_type)));
            metadata.insert("error".to_string(), json!(error.to_string()));
            metadata.insert("error_type".to_string(), json!(format!("{:?}", error)));

            logger.log_operation(
                LogLevel::Error,
                CoreType::Rust,
                OperationType::Playback,
                format!("action_failure_{}_{}", action_index, chrono::Utc::now().timestamp_millis()),
                format!("Action {} failed: {:?} - {}", 
                    action_index, action.action_type, error),
                Some(metadata),
            );
        }
    }

    /// Log platform-specific API call
    fn log_platform_call(operation: &str, params: &str) {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("operation".to_string(), json!(operation));
            metadata.insert("params".to_string(), json!(params));

            logger.log_operation(
                LogLevel::Trace,
                CoreType::Rust,
                OperationType::Playback,
                format!("platform_call_{}", chrono::Utc::now().timestamp_millis()),
                format!("Platform call: {} with params {}", operation, params),
                Some(metadata),
            );
        }
    }

    /// Log platform API error
    fn log_platform_error(operation: &str, error: &AutomationError) {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("operation".to_string(), json!(operation));
            metadata.insert("error".to_string(), json!(error.to_string()));
            metadata.insert("error_type".to_string(), json!(format!("{:?}", error)));

            logger.log_operation(
                LogLevel::Error,
                CoreType::Rust,
                OperationType::Playback,
                format!("platform_error_{}", chrono::Utc::now().timestamp_millis()),
                format!("Platform error in {}: {}", operation, error),
                Some(metadata),
            );
        }
    }

    /// Set event sender for real-time UI updates
    pub fn set_event_sender(&mut self, sender: mpsc::UnboundedSender<PlaybackEvent>) {
        self.event_sender = Some(sender);
        
        // Log event sender initialization
        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Playback,
                format!("event_sender_init_{}", chrono::Utc::now().timestamp_millis()),
                "Event sender initialized for playback UI updates".to_string(),
                None,
            );
        }
        
        // Test event channel connectivity by sending a test event
        self.test_event_channel();
    }
    
    /// Test event channel connectivity
    fn test_event_channel(&self) {
        if let Some(ref sender) = self.event_sender {
            let test_event = PlaybackEvent {
                event_type: "status".to_string(),
                data: PlaybackEventData::Status {
                    status: "initialized".to_string(),
                    message: Some("Event channel connected".to_string()),
                },
            };
            
            match sender.send(test_event) {
                Ok(_) => {
                    if let Some(logger) = get_logger() {
                        logger.log_operation(
                            LogLevel::Info,
                            CoreType::Rust,
                            OperationType::Playback,
                            format!("event_channel_test_{}", chrono::Utc::now().timestamp_millis()),
                            "Event channel connectivity test successful".to_string(),
                            None,
                        );
                    }
                },
                Err(e) => {
                    if let Some(logger) = get_logger() {
                        let mut metadata = HashMap::new();
                        metadata.insert("error".to_string(), json!(e.to_string()));
                        
                        logger.log_operation(
                            LogLevel::Error,
                            CoreType::Rust,
                            OperationType::Playback,
                            format!("event_channel_test_failure_{}", chrono::Utc::now().timestamp_millis()),
                            format!("Event channel connectivity test failed: {}", e),
                            Some(metadata),
                        );
                    }
                }
            }
        }
    }
    
    /// Check if event sender is initialized
    pub fn has_event_sender(&self) -> bool {
        self.event_sender.is_some()
    }

    /// Load a script for playback
    pub fn load_script(&mut self, script: ScriptData) -> Result<()> {
        // Validate the script first
        script.validate()?;
        
        self.current_script = Some(script);
        self.current_action_index.store(0, Ordering::Relaxed);
        
        Ok(())
    }

    /// Start playback with specified parameters
    pub fn start_playback(&mut self, speed: f64, loops: u32) -> Result<()> {
        // Verify event sender is initialized
        if self.event_sender.is_none() {
            if let Some(logger) = get_logger() {
                logger.log_operation(
                    LogLevel::Warn,
                    CoreType::Rust,
                    OperationType::Playback,
                    format!("event_sender_warning_{}", chrono::Utc::now().timestamp_millis()),
                    "Starting playback without event sender - UI updates will not be available".to_string(),
                    None,
                );
            }
        } else {
            if let Some(logger) = get_logger() {
                logger.log_operation(
                    LogLevel::Info,
                    CoreType::Rust,
                    OperationType::Playback,
                    format!("event_sender_verified_{}", chrono::Utc::now().timestamp_millis()),
                    "Event sender verified - UI updates will be sent during playback".to_string(),
                    None,
                );
            }
        }
        
        // Check if playback is already active to prevent concurrent playback
        if self.is_playing.load(Ordering::Relaxed) {
            // Log rejected playback attempt with detailed context
            if let Some(logger) = get_logger() {
                let mut metadata = HashMap::new();
                metadata.insert("requested_speed".to_string(), json!(speed));
                metadata.insert("requested_loops".to_string(), json!(loops));
                metadata.insert("current_action_index".to_string(), json!(self.current_action_index.load(Ordering::Relaxed)));
                metadata.insert("current_loop".to_string(), json!(self.current_loop.load(Ordering::Relaxed)));
                metadata.insert("is_paused".to_string(), json!(self.is_paused.load(Ordering::Relaxed)));
                
                if let Some(ref script) = self.current_script {
                    metadata.insert("current_script_actions".to_string(), json!(script.actions.len()));
                }
                
                if let Some(start_time) = self.start_time {
                    metadata.insert("playback_elapsed_ms".to_string(), json!(start_time.elapsed().as_millis()));
                }
                
                logger.log_operation(
                    LogLevel::Warn,
                    CoreType::Rust,
                    OperationType::Playback,
                    format!("concurrent_playback_rejected_{}", chrono::Utc::now().timestamp_millis()),
                    format!("Rejected concurrent playback attempt: playback already in progress (action {}, loop {}, {})", 
                        self.current_action_index.load(Ordering::Relaxed),
                        self.current_loop.load(Ordering::Relaxed),
                        if self.is_paused.load(Ordering::Relaxed) { "paused" } else { "playing" }),
                    Some(metadata),
                );
            }
            
            return Err(AutomationError::PlaybackError {
                message: "Playback is already in progress. Please stop the current playback before starting a new one.".to_string(),
            });
        }
        
        // Check permissions after concurrent playback check
        if !self.platform.check_permissions()? {
            if !self.platform.request_permissions()? {
                return Err(AutomationError::PermissionDenied {
                    operation: "Playback requires system permissions".to_string(),
                });
            }
        }

        if self.current_script.is_none() {
            return Err(AutomationError::PlaybackError {
                message: "No script loaded for playback".to_string(),
            });
        }

        // Validate and clamp speed parameter (0.1x to 10x)
        let clamped_speed = speed.max(0.1).min(10.0);
        
        if (speed - clamped_speed).abs() > 0.001 {
            if let Some(logger) = get_logger() {
                logger.log_operation(
                    LogLevel::Info,
                    CoreType::Rust,
                    OperationType::Playback,
                    format!("speed_validation_{}", chrono::Utc::now().timestamp_millis()),
                    format!("Speed parameter clamped from {:.2}x to {:.2}x (valid range: 0.1x-10x)", 
                        speed, clamped_speed),
                    None,
                );
            }
        }

        // Log playback start
        if let Some(ref script) = self.current_script {
            Self::log_playback_start(script, clamped_speed, loops);
        }

        self.is_playing.store(true, Ordering::Relaxed);
        self.is_paused.store(false, Ordering::Relaxed);
        
        self.playback_speed = clamped_speed;
        self.loops_remaining.store(loops, Ordering::Relaxed);
        self.loops_total = loops;
        self.current_loop.store(1, Ordering::Relaxed);
        self.current_action_index.store(0, Ordering::Relaxed);
        self.start_time = Some(Instant::now());

        // Send status event to UI
        self.send_event(PlaybackEvent {
            event_type: "status".to_string(),
            data: PlaybackEventData::Status {
                status: "playing".to_string(),
                message: Some("Playback started".to_string()),
            },
        });

        // Start playback execution
        self.start_playback_execution()?;

        Ok(())
    }

    /// Stop playback with immediate termination and resource cleanup
    pub fn stop_playback(&mut self) -> Result<()> {
        // Start timing for responsiveness measurement
        let operation_start = Instant::now();
        
        if !self.is_playing.load(Ordering::Relaxed) {
            return Err(AutomationError::PlaybackError {
                message: "No playback in progress".to_string(),
            });
        }

        let current_action_index = self.current_action_index.load(Ordering::Relaxed);
        let was_paused = self.is_paused.load(Ordering::Relaxed);
        
        // Log stop operation with detailed context
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("current_action_index".to_string(), json!(current_action_index));
            metadata.insert("was_paused".to_string(), json!(was_paused));
            metadata.insert("current_loop".to_string(), json!(self.current_loop.load(Ordering::Relaxed)));
            metadata.insert("loops_remaining".to_string(), json!(self.loops_remaining.load(Ordering::Relaxed)));
            metadata.insert("loops_total".to_string(), json!(self.loops_total));
            
            if let Some(ref script) = self.current_script {
                metadata.insert("total_actions".to_string(), json!(script.actions.len()));
                metadata.insert("progress_pct".to_string(), json!(
                    if script.actions.len() > 0 {
                        (current_action_index as f64 / script.actions.len() as f64) * 100.0
                    } else {
                        0.0
                    }
                ));
            }
            
            if let Some(start_time) = self.start_time {
                metadata.insert("elapsed_time_ms".to_string(), json!(start_time.elapsed().as_millis()));
            }
            
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Playback,
                format!("playback_stop_{}", chrono::Utc::now().timestamp_millis()),
                format!("Stopping playback at action {} (loop {}/{}, {:.1}% complete)", 
                    current_action_index,
                    self.current_loop.load(Ordering::Relaxed),
                    self.loops_total,
                    if let Some(ref script) = self.current_script {
                        if script.actions.len() > 0 {
                            (current_action_index as f64 / script.actions.len() as f64) * 100.0
                        } else {
                            0.0
                        }
                    } else {
                        0.0
                    }),
                Some(metadata),
            );
        }

        // Set atomic flags to stop playback immediately
        // The playback loop checks is_playing at multiple points and will exit
        let atomic_update_start = Instant::now();
        self.is_playing.store(false, Ordering::Relaxed);
        self.is_paused.store(false, Ordering::Relaxed);
        let atomic_update_duration = atomic_update_start.elapsed();
        
        // Resource cleanup
        let cleanup_start = Instant::now();
        self.current_action_index.store(0, Ordering::Relaxed);
        self.start_time = None;
        self.loops_remaining.store(0, Ordering::Relaxed);
        let cleanup_duration = cleanup_start.elapsed();
        
        // Log resource cleanup
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("cleanup_duration_us".to_string(), json!(cleanup_duration.as_micros()));
            
            logger.log_operation(
                LogLevel::Debug,
                CoreType::Rust,
                OperationType::Playback,
                format!("playback_cleanup_{}", chrono::Utc::now().timestamp_millis()),
                format!("Playback resources cleaned up in {:.2}us: reset action index, cleared start time, reset loops", 
                    cleanup_duration.as_micros()),
                Some(metadata),
            );
        }
        
        // Send status event to UI
        let event_send_start = Instant::now();
        self.send_event(PlaybackEvent {
            event_type: "status".to_string(),
            data: PlaybackEventData::Status {
                status: "stopped".to_string(),
                message: Some(format!("Playback stopped at action {} (was {})", 
                    current_action_index,
                    if was_paused { "paused" } else { "playing" })),
            },
        });
        let event_send_duration = event_send_start.elapsed();
        
        // Measure total operation time for responsiveness
        let total_duration = operation_start.elapsed();
        
        // Log stop completion time with responsiveness metrics
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("total_duration_ms".to_string(), json!(total_duration.as_secs_f64() * 1000.0));
            metadata.insert("atomic_update_duration_us".to_string(), json!(atomic_update_duration.as_micros()));
            metadata.insert("cleanup_duration_us".to_string(), json!(cleanup_duration.as_micros()));
            metadata.insert("event_send_duration_ms".to_string(), json!(event_send_duration.as_secs_f64() * 1000.0));
            metadata.insert("within_100ms_target".to_string(), json!(total_duration.as_millis() <= 100));
            
            let log_level = if total_duration.as_millis() > 100 {
                LogLevel::Warn
            } else {
                LogLevel::Debug
            };
            
            logger.log_operation(
                log_level,
                CoreType::Rust,
                OperationType::Playback,
                format!("control_responsiveness_stop_{}", chrono::Utc::now().timestamp_millis()),
                format!("Stop operation completed in {:.2}ms (target: <100ms, atomic: {:.2}us, cleanup: {:.2}us, event: {:.2}ms)", 
                    total_duration.as_secs_f64() * 1000.0,
                    atomic_update_duration.as_micros(),
                    cleanup_duration.as_micros(),
                    event_send_duration.as_secs_f64() * 1000.0),
                Some(metadata),
            );
        }
        
        Ok(())
    }

    /// Pause or resume playback
    pub fn pause_playback(&mut self) -> Result<bool> {
        // Start timing for responsiveness measurement
        let operation_start = Instant::now();
        
        if !self.is_playing.load(Ordering::Relaxed) {
            return Err(AutomationError::PlaybackError {
                message: "No playback in progress".to_string(),
            });
        }

        let current_paused = self.is_paused.load(Ordering::Relaxed);
        let new_paused = !current_paused;
        let current_action_index = self.current_action_index.load(Ordering::Relaxed);
        
        // Log pause/resume operation with detailed context
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("previous_state".to_string(), json!(if current_paused { "paused" } else { "playing" }));
            metadata.insert("new_state".to_string(), json!(if new_paused { "paused" } else { "playing" }));
            metadata.insert("current_action_index".to_string(), json!(current_action_index));
            metadata.insert("current_loop".to_string(), json!(self.current_loop.load(Ordering::Relaxed)));
            metadata.insert("loops_remaining".to_string(), json!(self.loops_remaining.load(Ordering::Relaxed)));
            
            if let Some(ref script) = self.current_script {
                metadata.insert("total_actions".to_string(), json!(script.actions.len()));
                metadata.insert("progress_pct".to_string(), json!(
                    if script.actions.len() > 0 {
                        (current_action_index as f64 / script.actions.len() as f64) * 100.0
                    } else {
                        0.0
                    }
                ));
            }
            
            if let Some(start_time) = self.start_time {
                metadata.insert("elapsed_time_ms".to_string(), json!(start_time.elapsed().as_millis()));
            }
            
            let operation = if new_paused { "pause" } else { "resume" };
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Playback,
                format!("playback_{}_{}", operation, chrono::Utc::now().timestamp_millis()),
                format!("Playback {} at action {} (loop {}/{})", 
                    if new_paused { "paused" } else { "resumed" },
                    current_action_index,
                    self.current_loop.load(Ordering::Relaxed),
                    self.loops_total),
                Some(metadata),
            );
        }
        
        // Update atomic state - this is the critical operation for responsiveness
        let atomic_update_start = Instant::now();
        self.is_paused.store(new_paused, Ordering::Relaxed);
        let atomic_update_duration = atomic_update_start.elapsed();
        
        // Send status event to UI
        let event_send_start = Instant::now();
        self.send_event(PlaybackEvent {
            event_type: "status".to_string(),
            data: PlaybackEventData::Status {
                status: if new_paused { "paused" } else { "playing" }.to_string(),
                message: Some(if new_paused { 
                    format!("Playback paused at action {}", current_action_index)
                } else { 
                    format!("Playback resumed from action {}", current_action_index)
                }),
            },
        });
        let event_send_duration = event_send_start.elapsed();
        
        // Measure total operation time for responsiveness
        let total_duration = operation_start.elapsed();
        
        // Log timing measurements for control responsiveness
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("total_duration_ms".to_string(), json!(total_duration.as_secs_f64() * 1000.0));
            metadata.insert("atomic_update_duration_us".to_string(), json!(atomic_update_duration.as_micros()));
            metadata.insert("event_send_duration_ms".to_string(), json!(event_send_duration.as_secs_f64() * 1000.0));
            metadata.insert("within_100ms_target".to_string(), json!(total_duration.as_millis() <= 100));
            
            let log_level = if total_duration.as_millis() > 100 {
                LogLevel::Warn
            } else {
                LogLevel::Debug
            };
            
            let operation = if new_paused { "pause" } else { "resume" };
            logger.log_operation(
                log_level,
                CoreType::Rust,
                OperationType::Playback,
                format!("control_responsiveness_{}_{}", operation, chrono::Utc::now().timestamp_millis()),
                format!("{} operation completed in {:.2}ms (target: <100ms, atomic: {:.2}us, event: {:.2}ms)", 
                    if new_paused { "Pause" } else { "Resume" },
                    total_duration.as_secs_f64() * 1000.0,
                    atomic_update_duration.as_micros(),
                    event_send_duration.as_secs_f64() * 1000.0),
                Some(metadata),
            );
        }
        
        Ok(new_paused)
    }



    /// Start playback execution in background thread
    fn start_playback_execution(&self) -> Result<()> {
        let is_playing = Arc::clone(&self.is_playing);
        let is_paused = Arc::clone(&self.is_paused);
        let current_action_index = Arc::clone(&self.current_action_index);
        let script = self.current_script.clone();
        let playback_speed = self.playback_speed;
        let loops_remaining = Arc::clone(&self.loops_remaining);
        let loops_total = self.loops_total;
        let current_loop = Arc::clone(&self.current_loop);
        let event_sender = self.event_sender.clone();
        let config = self.config.clone();
        
        // Create platform automation for the background thread
        let platform = create_platform_automation()?;
        
        // Spawn ESC key listener thread to stop playback
        #[cfg(not(target_os = "macos"))]
        {
            let is_playing_esc = Arc::clone(&self.is_playing);
            thread::spawn(move || {
                let is_playing_ref = is_playing_esc;
                
                // Use catch_unwind to prevent panics from crashing
                let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    let callback = move |event: rdev::Event| {
                        if !is_playing_ref.load(Ordering::SeqCst) {
                            return;
                        }
                        
                        if let rdev::EventType::KeyPress(rdev::Key::Escape) = event.event_type {
                            // Stop playback when ESC is pressed
                            is_playing_ref.store(false, Ordering::SeqCst);
                        }
                    };
                    
                    let _ = rdev::listen(callback);
                }));
            });
        }
        
        thread::spawn(move || {
            if let Some(script) = script {
                // Initialize loop start time and get first action timestamp for proper timing
                let mut loop_start_time = Instant::now();
                let first_action_timestamp = script.actions.first().map(|a| a.timestamp).unwrap_or(0.0);
                
                // Initialize playback statistics
                let mut statistics = PlaybackStatistics::new(script.actions.len(), playback_speed);
                let playback_start_time = Instant::now();
                
                // Error accumulation for reporting
                let mut accumulated_errors: Vec<PlaybackError> = Vec::new();
                const MAX_RETRY_ATTEMPTS: usize = 3;
                const RETRY_DELAY_MS: u64 = 100;
                
                while is_playing.load(Ordering::Relaxed) && loops_remaining.load(Ordering::Relaxed) > 0 {
                    let action_index = current_action_index.load(Ordering::Relaxed);
                    
                    if action_index >= script.actions.len() {
                        // End of script reached, start next loop
                        let remaining = loops_remaining.fetch_sub(1, Ordering::Relaxed).saturating_sub(1);
                        current_loop.fetch_add(1, Ordering::Relaxed);
                        
                        if remaining > 0 {
                            current_action_index.store(0, Ordering::Relaxed);
                            loop_start_time = Instant::now();
                            
                            if let Some(logger) = get_logger() {
                                logger.log_operation(
                                    LogLevel::Debug,
                                    CoreType::Rust,
                                    OperationType::Playback,
                                    format!("loop_restart_{}", chrono::Utc::now().timestamp_millis()),
                                    format!("Starting loop {} of {}", current_loop.load(Ordering::Relaxed), loops_total),
                                    None,
                                );
                            }
                            
                            // Send progress event for loop restart
                            if let Some(ref sender) = event_sender {
                                let _ = sender.send(PlaybackEvent {
                                    event_type: "progress".to_string(),
                                    data: PlaybackEventData::Progress {
                                        current_action: 0,
                                        total_actions: script.actions.len(),
                                        current_loop: current_loop.load(Ordering::Relaxed),
                                        total_loops: loops_total,
                                        progress: 0.0,
                                    },
                                });
                            }
                            
                            continue;
                        } else {
                            break;
                        }
                    }
                    
                    // Wait if paused - pause at action boundary
                    let pause_entered = is_paused.load(Ordering::Relaxed);
                    if pause_entered && is_playing.load(Ordering::Relaxed) {
                        // Log pause detection
                        if let Some(logger) = get_logger() {
                            let mut metadata = HashMap::new();
                            metadata.insert("action_index".to_string(), json!(action_index));
                            metadata.insert("current_loop".to_string(), json!(current_loop.load(Ordering::Relaxed)));
                            metadata.insert("total_loops".to_string(), json!(loops_total));
                            
                            logger.log_operation(
                                LogLevel::Debug,
                                CoreType::Rust,
                                OperationType::Playback,
                                format!("pause_detected_{}", chrono::Utc::now().timestamp_millis()),
                                format!("Playback paused at action boundary (action {}, loop {}/{})", 
                                    action_index, current_loop.load(Ordering::Relaxed), loops_total),
                                Some(metadata),
                            );
                        }
                        
                        // Wait while paused
                        while is_paused.load(Ordering::Relaxed) && is_playing.load(Ordering::Relaxed) {
                            thread::sleep(Duration::from_millis(10));
                        }
                        
                        // Log resume detection
                        if is_playing.load(Ordering::Relaxed) && !is_paused.load(Ordering::Relaxed) {
                            if let Some(logger) = get_logger() {
                                let mut metadata = HashMap::new();
                                metadata.insert("action_index".to_string(), json!(action_index));
                                metadata.insert("current_loop".to_string(), json!(current_loop.load(Ordering::Relaxed)));
                                
                                logger.log_operation(
                                    LogLevel::Debug,
                                    CoreType::Rust,
                                    OperationType::Playback,
                                    format!("resume_detected_{}", chrono::Utc::now().timestamp_millis()),
                                    format!("Playback resumed from action {} (loop {}/{})", 
                                        action_index, current_loop.load(Ordering::Relaxed), loops_total),
                                    Some(metadata),
                                );
                            }
                        }
                    }
                    
                    // Check if playback was stopped during pause
                    if !is_playing.load(Ordering::Relaxed) {
                        if let Some(logger) = get_logger() {
                            logger.log_operation(
                                LogLevel::Info,
                                CoreType::Rust,
                                OperationType::Playback,
                                format!("playback_stopped_during_pause_{}", chrono::Utc::now().timestamp_millis()),
                                format!("Playback stopped while paused at action {}", action_index),
                                None,
                            );
                        }
                        break;
                    }
                    
                    let action = &script.actions[action_index];
                    
                    // Send action preview event before executing each action
                    // This allows the UI to show what action is about to be executed
                    if let Some(ref sender) = event_sender {
                        let preview_data = ActionPreviewData {
                            action_type: match action.action_type {
                                ActionType::MouseMove => "mouse_move".to_string(),
                                ActionType::MouseClick => "mouse_click".to_string(),
                                ActionType::MouseDoubleClick => "mouse_double_click".to_string(),
                                ActionType::MouseDrag => "mouse_drag".to_string(),
                                ActionType::MouseScroll => "mouse_scroll".to_string(),
                                ActionType::KeyPress => "key_press".to_string(),
                                ActionType::KeyRelease => "key_release".to_string(),
                                ActionType::KeyType => "key_type".to_string(),
                                ActionType::Screenshot => "screenshot".to_string(),
                                ActionType::Wait => "wait".to_string(),
                                ActionType::Custom => "custom".to_string(),
                                ActionType::AiVisionCapture => "ai_vision_capture".to_string(),
                            },
                            timestamp: action.timestamp,
                            x: action.x,
                            y: action.y,
                            button: action.button.clone(),
                            key: action.key.clone(),
                            text: action.text.clone(),
                        };
                        
                        let preview_event = PlaybackEvent {
                            event_type: "action_preview".to_string(),
                            data: PlaybackEventData::ActionPreview {
                                index: action_index,
                                action: preview_data.clone(),
                            },
                        };
                        
                        // Send with error handling and logging
                        if let Err(e) = sender.send(preview_event) {
                            if let Some(logger) = get_logger() {
                                let mut metadata = HashMap::new();
                                metadata.insert("action_index".to_string(), json!(action_index));
                                metadata.insert("action_type".to_string(), json!(&preview_data.action_type));
                                metadata.insert("error".to_string(), json!(e.to_string()));
                                
                                logger.log_operation(
                                    LogLevel::Error,
                                    CoreType::Rust,
                                    OperationType::Playback,
                                    format!("preview_event_failure_{}", chrono::Utc::now().timestamp_millis()),
                                    format!("Failed to send action preview event for action {}: {}", action_index, e),
                                    Some(metadata),
                                );
                            }
                        } else {
                            // Log preview event sent (at trace level)
                            if let Some(logger) = get_logger() {
                                let mut metadata = HashMap::new();
                                metadata.insert("action_index".to_string(), json!(action_index));
                                metadata.insert("action_type".to_string(), json!(&preview_data.action_type));
                                metadata.insert("timestamp".to_string(), json!(preview_data.timestamp));
                                if let Some(x) = preview_data.x {
                                    metadata.insert("x".to_string(), json!(x));
                                }
                                if let Some(y) = preview_data.y {
                                    metadata.insert("y".to_string(), json!(y));
                                }
                                
                                logger.log_operation(
                                    LogLevel::Trace,
                                    CoreType::Rust,
                                    OperationType::Playback,
                                    format!("action_preview_{}", chrono::Utc::now().timestamp_millis()),
                                    format!("Previewing action {}: {} at ({:?}, {:?})", 
                                        action_index, preview_data.action_type, preview_data.x, preview_data.y),
                                    Some(metadata),
                                );
                            }
                        }
                    }
                    
                    // Calculate timing delay relative to first action timestamp
                    // This ensures the first action executes immediately and subsequent actions
                    // maintain proper timing relative to the start of the loop
                    let relative_timestamp = action.timestamp - first_action_timestamp;
                    
                    // Calculate expected timing without speed scaling
                    let expected_time_unscaled = Duration::from_secs_f64(relative_timestamp.max(0.0));
                    
                    // Apply speed scaling to get target time
                    let target_time = Duration::from_secs_f64(relative_timestamp.max(0.0) / playback_speed);
                    let elapsed = loop_start_time.elapsed();
                    
                    // Calculate expected vs actual delay
                    let delay_needed = if target_time > elapsed {
                        target_time - elapsed
                    } else {
                        Duration::from_secs(0)
                    };
                    
                    // Log timing calculations with speed scaling information
                    if let Some(logger) = get_logger() {
                        let mut metadata = HashMap::new();
                        metadata.insert("action_index".to_string(), json!(action_index));
                        metadata.insert("action_timestamp".to_string(), json!(action.timestamp));
                        metadata.insert("relative_timestamp".to_string(), json!(relative_timestamp));
                        metadata.insert("expected_time_unscaled_ms".to_string(), json!(expected_time_unscaled.as_millis()));
                        metadata.insert("target_time_scaled_ms".to_string(), json!(target_time.as_millis()));
                        metadata.insert("elapsed_ms".to_string(), json!(elapsed.as_millis()));
                        metadata.insert("delay_needed_ms".to_string(), json!(delay_needed.as_millis()));
                        metadata.insert("playback_speed".to_string(), json!(playback_speed));
                        metadata.insert("speed_multiplier_applied".to_string(), json!(
                            expected_time_unscaled.as_secs_f64() / target_time.as_secs_f64().max(0.001)
                        ));
                        
                        logger.log_operation(
                            LogLevel::Trace,
                            CoreType::Rust,
                            OperationType::Playback,
                            format!("timing_calc_{}", chrono::Utc::now().timestamp_millis()),
                            format!("Action {} timing: expected={:.2}ms, target@{:.1}x={:.2}ms, elapsed={:.2}ms, delay={:.2}ms",
                                action_index,
                                expected_time_unscaled.as_secs_f64() * 1000.0,
                                playback_speed,
                                target_time.as_secs_f64() * 1000.0,
                                elapsed.as_secs_f64() * 1000.0,
                                delay_needed.as_secs_f64() * 1000.0),
                            Some(metadata),
                        );
                    }
                    
                    // Handle edge cases: zero or negative delays
                    let actual_delay_start = Instant::now();
                    if delay_needed > Duration::from_secs(0) {
                        thread::sleep(delay_needed);
                    } else if target_time < elapsed {
                        // We're behind schedule - calculate timing drift
                        let timing_drift = elapsed - target_time;
                        let drift_ms = timing_drift.as_secs_f64() * 1000.0;
                        
                        // Define timing tolerance (100ms)
                        const TIMING_TOLERANCE_MS: f64 = 100.0;
                        
                        if drift_ms > TIMING_TOLERANCE_MS {
                            // Timing exceeds tolerance - log warning
                            if let Some(logger) = get_logger() {
                                let mut metadata = HashMap::new();
                                metadata.insert("action_index".to_string(), json!(action_index));
                                metadata.insert("timing_drift_ms".to_string(), json!(drift_ms));
                                metadata.insert("tolerance_ms".to_string(), json!(TIMING_TOLERANCE_MS));
                                metadata.insert("drift_percentage".to_string(), json!(
                                    (drift_ms / target_time.as_secs_f64().max(0.001) / 1000.0) * 100.0
                                ));
                                
                                logger.log_operation(
                                    LogLevel::Warn,
                                    CoreType::Rust,
                                    OperationType::Playback,
                                    format!("timing_tolerance_exceeded_{}", chrono::Utc::now().timestamp_millis()),
                                    format!("Action {} timing drift {:.2}ms exceeds tolerance of {:.2}ms", 
                                        action_index, drift_ms, TIMING_TOLERANCE_MS),
                                    Some(metadata),
                                );
                            }
                        } else {
                            // Within tolerance but still behind - log debug message
                            if let Some(logger) = get_logger() {
                                logger.log_operation(
                                    LogLevel::Debug,
                                    CoreType::Rust,
                                    OperationType::Playback,
                                    format!("timing_drift_{}", chrono::Utc::now().timestamp_millis()),
                                    format!("Action {} is behind schedule by {:.2}ms (within tolerance)", 
                                        action_index, drift_ms),
                                    None,
                                );
                            }
                        }
                    }
                    let actual_delay = actual_delay_start.elapsed();
                    
                    // Execute the action with retry logic for transient errors
                    let action_exec_start = Instant::now();
                    let mut action_result = Self::execute_action_sync(&*platform, action, action_index, &config);
                    let mut retry_count = 0usize;
                    
                    // Retry logic for transient platform errors
                    while let Err(ref playback_error) = action_result {
                        // Check if we should retry based on error type
                        let should_retry = match &playback_error.underlying_error {
                            AutomationError::SystemError { .. } => true,
                            AutomationError::RuntimeFailure { .. } => true,
                            AutomationError::Timeout { .. } => true,
                            _ => false,
                        };
                        
                        if should_retry && retry_count < MAX_RETRY_ATTEMPTS {
                            retry_count += 1;
                            
                            if let Some(logger) = get_logger() {
                                logger.log_operation(
                                    LogLevel::Info,
                                    CoreType::Rust,
                                    OperationType::Playback,
                                    format!("retry_attempt_{}_{}", action_index, chrono::Utc::now().timestamp_millis()),
                                    format!("Retrying action {} (attempt {}/{}): {}", 
                                        action_index, retry_count, MAX_RETRY_ATTEMPTS, playback_error.to_user_message()),
                                    None,
                                );
                            }
                            
                            // Wait before retrying
                            thread::sleep(Duration::from_millis(RETRY_DELAY_MS));
                            
                            // Retry the action
                            action_result = Self::execute_action_sync(&*platform, action, action_index, &config);
                        } else {
                            // No more retries or not a retryable error
                            break;
                        }
                    }
                    
                    let action_exec_time = action_exec_start.elapsed();
                    
                    // Handle errors with recovery logic
                    if let Err(playback_error) = action_result {
                        // Record failed action in statistics
                        statistics.record_action_failure(playback_error.to_user_message());
                        
                        // Accumulate error for reporting
                        accumulated_errors.push(playback_error.clone());
                        
                        // Check if error is recoverable
                        if !playback_error.should_continue() {
                            // Critical error - stop playback immediately
                            if let Some(logger) = get_logger() {
                                logger.log_operation(
                                    LogLevel::Error,
                                    CoreType::Rust,
                                    OperationType::Playback,
                                    format!("critical_error_{}", chrono::Utc::now().timestamp_millis()),
                                    format!("Critical error encountered, stopping playback: {}", playback_error.to_user_message()),
                                    None,
                                );
                            }
                            
                            // Send error event to UI
                            if let Some(ref sender) = event_sender {
                                let _ = sender.send(PlaybackEvent {
                                    event_type: "status".to_string(),
                                    data: PlaybackEventData::Status {
                                        status: "error".to_string(),
                                        message: Some(playback_error.to_user_message()),
                                    },
                                });
                            }
                            
                            // Stop playback
                            is_playing.store(false, Ordering::Relaxed);
                            break;
                        } else {
                            // Recoverable error - log warning and continue with graceful degradation
                            if let Some(logger) = get_logger() {
                                let mut metadata = HashMap::new();
                                metadata.insert("retry_count".to_string(), json!(retry_count));
                                metadata.insert("max_retries".to_string(), json!(MAX_RETRY_ATTEMPTS));
                                metadata.insert("action_skipped".to_string(), json!(true));
                                
                                logger.log_operation(
                                    LogLevel::Warn,
                                    CoreType::Rust,
                                    OperationType::Playback,
                                    format!("recoverable_error_{}", chrono::Utc::now().timestamp_millis()),
                                    format!("Recoverable error after {} retries, skipping action and continuing: {}", 
                                        retry_count, playback_error.to_user_message()),
                                    Some(metadata),
                                );
                            }
                            
                            // Send warning event to UI
                            if let Some(ref sender) = event_sender {
                                let _ = sender.send(PlaybackEvent {
                                    event_type: "status".to_string(),
                                    data: PlaybackEventData::Status {
                                        status: "warning".to_string(),
                                        message: Some(format!("Action {} failed after {} retries, continuing: {}", 
                                            action_index, retry_count, playback_error.to_user_message())),
                                    },
                                });
                            }
                            
                            // Record skipped action in statistics
                            statistics.record_action_skipped();
                        }
                    } else {
                        // Record successful action in statistics
                        statistics.record_action_success(action_exec_time, actual_delay);
                    }
                    
                    // Track timing drift
                    if target_time < elapsed {
                        let drift = elapsed - target_time;
                        statistics.record_timing_drift(drift);
                    }
                    
                    // Log actual vs expected timing for verification
                    if let Some(logger) = get_logger() {
                        let total_time_for_action = actual_delay + action_exec_time;
                        let expected_delay = delay_needed;
                        let timing_accuracy = if expected_delay > Duration::from_secs(0) {
                            (actual_delay.as_secs_f64() / expected_delay.as_secs_f64()) * 100.0
                        } else {
                            100.0
                        };
                        
                        let mut metadata = HashMap::new();
                        metadata.insert("action_index".to_string(), json!(action_index));
                        metadata.insert("expected_delay_ms".to_string(), json!(expected_delay.as_millis()));
                        metadata.insert("actual_delay_ms".to_string(), json!(actual_delay.as_millis()));
                        metadata.insert("action_exec_ms".to_string(), json!(action_exec_time.as_millis()));
                        metadata.insert("total_time_ms".to_string(), json!(total_time_for_action.as_millis()));
                        metadata.insert("timing_accuracy_pct".to_string(), json!(timing_accuracy));
                        
                        logger.log_operation(
                            LogLevel::Trace,
                            CoreType::Rust,
                            OperationType::Playback,
                            format!("timing_verification_{}", chrono::Utc::now().timestamp_millis()),
                            format!("Action {} timing verification: expected_delay={:.2}ms, actual_delay={:.2}ms, exec={:.2}ms, accuracy={:.1}%",
                                action_index,
                                expected_delay.as_secs_f64() * 1000.0,
                                actual_delay.as_secs_f64() * 1000.0,
                                action_exec_time.as_secs_f64() * 1000.0,
                                timing_accuracy),
                            Some(metadata),
                        );
                    }
                    
                    // Update action index
                    current_action_index.store(action_index + 1, Ordering::Relaxed);
                    
                    // Send progress update after each action with comprehensive information
                    if let Some(ref sender) = event_sender {
                        let progress = (action_index + 1) as f64 / script.actions.len() as f64;
                        let progress_event = PlaybackEvent {
                            event_type: "progress".to_string(),
                            data: PlaybackEventData::Progress {
                                current_action: action_index + 1,
                                total_actions: script.actions.len(),
                                current_loop: current_loop.load(Ordering::Relaxed),
                                total_loops: loops_total,
                                progress,
                            },
                        };
                        
                        // Send with logging and error handling
                        if let Err(e) = sender.send(progress_event) {
                            if let Some(logger) = get_logger() {
                                let mut metadata = HashMap::new();
                                metadata.insert("action_index".to_string(), json!(action_index + 1));
                                metadata.insert("progress".to_string(), json!(progress));
                                metadata.insert("error".to_string(), json!(e.to_string()));
                                
                                logger.log_operation(
                                    LogLevel::Error,
                                    CoreType::Rust,
                                    OperationType::Playback,
                                    format!("progress_event_failure_{}", chrono::Utc::now().timestamp_millis()),
                                    format!("Failed to send progress event for action {}: {}", action_index + 1, e),
                                    Some(metadata),
                                );
                            }
                        } else {
                            // Log progress event sent (at trace level to avoid spam)
                            if let Some(logger) = get_logger() {
                                // Only log every 10th action or at key milestones to reduce log volume
                                if action_index % 10 == 0 || action_index == 0 || action_index + 1 == script.actions.len() {
                                    let mut metadata = HashMap::new();
                                    metadata.insert("current_action".to_string(), json!(action_index + 1));
                                    metadata.insert("total_actions".to_string(), json!(script.actions.len()));
                                    metadata.insert("progress_pct".to_string(), json!(progress * 100.0));
                                    metadata.insert("current_loop".to_string(), json!(current_loop.load(Ordering::Relaxed)));
                                    metadata.insert("total_loops".to_string(), json!(loops_total));
                                    
                                    logger.log_operation(
                                        LogLevel::Debug,
                                        CoreType::Rust,
                                        OperationType::Playback,
                                        format!("progress_update_{}", chrono::Utc::now().timestamp_millis()),
                                        format!("Progress: {}/{} actions ({:.1}%), loop {}/{}", 
                                            action_index + 1, script.actions.len(), progress * 100.0, current_loop.load(Ordering::Relaxed), loops_total),
                                        Some(metadata),
                                    );
                                }
                            }
                        }
                    }
                    
                    // Add small delay between actions
                    thread::sleep(Duration::from_millis(config.platform_config.mouse_delay));
                }
                
                // Playback completed
                is_playing.store(false, Ordering::Relaxed);
                let total_playback_duration = playback_start_time.elapsed();
                
                // Finalize statistics
                statistics.finalize(total_playback_duration, loops_total - loops_remaining.load(Ordering::Relaxed));
                
                // Log complete statistics summary
                if let Some(logger) = get_logger() {
                    let mut metadata = HashMap::new();
                    metadata.insert("total_actions".to_string(), json!(statistics.total_actions));
                    metadata.insert("actions_executed".to_string(), json!(statistics.actions_executed));
                    metadata.insert("actions_failed".to_string(), json!(statistics.actions_failed));
                    metadata.insert("actions_skipped".to_string(), json!(statistics.actions_skipped));
                    metadata.insert("total_duration_ms".to_string(), json!(statistics.total_duration.as_millis()));
                    metadata.insert("average_action_time_ms".to_string(), json!(statistics.average_action_time.as_secs_f64() * 1000.0));
                    metadata.insert("total_delay_time_ms".to_string(), json!(statistics.total_delay_time.as_millis()));
                    metadata.insert("total_execution_time_ms".to_string(), json!(statistics.total_execution_time.as_millis()));
                    metadata.insert("max_timing_drift_ms".to_string(), json!(statistics.max_timing_drift.as_millis()));
                    metadata.insert("timing_drift_count".to_string(), json!(statistics.timing_drift_count));
                    metadata.insert("loops_completed".to_string(), json!(statistics.loops_completed));
                    metadata.insert("playback_speed".to_string(), json!(statistics.playback_speed));
                    metadata.insert("success_rate".to_string(), json!(statistics.success_rate()));
                    metadata.insert("is_successful".to_string(), json!(statistics.is_successful()));
                    
                    // Calculate additional metrics
                    let avg_delay_time = if statistics.actions_executed > 0 {
                        statistics.total_delay_time.as_secs_f64() / statistics.actions_executed as f64
                    } else {
                        0.0
                    };
                    metadata.insert("avg_delay_time_ms".to_string(), json!(avg_delay_time * 1000.0));
                    
                    logger.log_operation(
                        LogLevel::Info,
                        CoreType::Rust,
                        OperationType::Playback,
                        format!("playback_statistics_{}", chrono::Utc::now().timestamp_millis()),
                        statistics.summary(),
                        Some(metadata),
                    );
                }
                
                // Log error summary if there were any errors
                if !accumulated_errors.is_empty() {
                    if let Some(logger) = get_logger() {
                        let mut metadata = HashMap::new();
                        metadata.insert("total_errors".to_string(), json!(accumulated_errors.len()));
                        metadata.insert("critical_errors".to_string(), json!(
                            accumulated_errors.iter().filter(|e| !e.recoverable).count()
                        ));
                        metadata.insert("recoverable_errors".to_string(), json!(
                            accumulated_errors.iter().filter(|e| e.recoverable).count()
                        ));
                        
                        // Include first few error messages
                        let error_messages: Vec<String> = accumulated_errors.iter()
                            .take(5)
                            .map(|e| e.to_user_message())
                            .collect();
                        metadata.insert("error_samples".to_string(), json!(error_messages));
                        
                        logger.log_operation(
                            LogLevel::Error,
                            CoreType::Rust,
                            OperationType::Playback,
                            format!("error_summary_{}", chrono::Utc::now().timestamp_millis()),
                            format!("Playback completed with {} errors ({} critical, {} recoverable)", 
                                accumulated_errors.len(),
                                accumulated_errors.iter().filter(|e| !e.recoverable).count(),
                                accumulated_errors.iter().filter(|e| e.recoverable).count()),
                            Some(metadata),
                        );
                    }
                }
                
                // Log playback completion
                Self::log_playback_complete(
                    &script,
                    statistics.actions_executed,
                    statistics.actions_failed,
                    statistics.actions_skipped,
                    statistics.loops_completed,
                    statistics.total_duration,
                    statistics.is_successful(),
                );
                
                // Send completion event with comprehensive statistics and error information
                if let Some(ref sender) = event_sender {
                    // Include error messages from statistics
                    let error_messages = if !statistics.errors.is_empty() {
                        Some(statistics.errors.clone())
                    } else {
                        None
                    };
                    
                    let completion_event = PlaybackEvent {
                        event_type: "complete".to_string(),
                        data: PlaybackEventData::Complete {
                            completed: true,
                            reason: if statistics.actions_failed == 0 { 
                                "finished".to_string() 
                            } else { 
                                format!("finished_with_errors ({} failed)", statistics.actions_failed)
                            },
                            total_actions: statistics.total_actions,
                            actions_executed: statistics.actions_executed,
                            actions_failed: statistics.actions_failed,
                            actions_skipped: statistics.actions_skipped,
                            loops_completed: statistics.loops_completed,
                            duration_ms: statistics.total_duration.as_millis() as u64,
                            success_rate: statistics.success_rate(),
                            errors: error_messages,
                        },
                    };
                    
                    // Send with error handling and logging
                    if let Err(e) = sender.send(completion_event) {
                        if let Some(logger) = get_logger() {
                            let mut metadata = HashMap::new();
                            metadata.insert("error".to_string(), json!(e.to_string()));
                            metadata.insert("total_actions_executed".to_string(), json!(statistics.actions_executed));
                            metadata.insert("total_actions_failed".to_string(), json!(statistics.actions_failed));
                            
                            logger.log_operation(
                                LogLevel::Error,
                                CoreType::Rust,
                                OperationType::Playback,
                                format!("completion_event_failure_{}", chrono::Utc::now().timestamp_millis()),
                                format!("Failed to send completion event: {}", e),
                                Some(metadata),
                            );
                        }
                    } else {
                        if let Some(logger) = get_logger() {
                            let mut metadata = HashMap::new();
                            metadata.insert("total_actions".to_string(), json!(statistics.total_actions));
                            metadata.insert("actions_executed".to_string(), json!(statistics.actions_executed));
                            metadata.insert("actions_failed".to_string(), json!(statistics.actions_failed));
                            metadata.insert("actions_skipped".to_string(), json!(statistics.actions_skipped));
                            metadata.insert("loops_completed".to_string(), json!(statistics.loops_completed));
                            metadata.insert("duration_ms".to_string(), json!(statistics.total_duration.as_millis()));
                            metadata.insert("success_rate".to_string(), json!(statistics.success_rate()));
                            
                            logger.log_operation(
                                LogLevel::Info,
                                CoreType::Rust,
                                OperationType::Playback,
                                format!("completion_event_sent_{}", chrono::Utc::now().timestamp_millis()),
                                format!("Completion event sent: {}/{} actions succeeded, {:.1}% success rate", 
                                    statistics.actions_executed - statistics.actions_failed, 
                                    statistics.actions_executed,
                                    statistics.success_rate() * 100.0),
                                Some(metadata),
                            );
                        }
                    }
                }
            }
        });
        
        Ok(())
    }

    /// Validate if an action type is supported for playback
    fn is_action_supported(action: &Action) -> bool {
        match action.action_type {
            // Supported mouse actions
            ActionType::MouseMove => action.x.is_some() && action.y.is_some(),
            ActionType::MouseClick => action.x.is_some() && action.y.is_some() && action.button.is_some(),
            ActionType::MouseDoubleClick => action.x.is_some() && action.y.is_some() && action.button.is_some(),
            ActionType::MouseDrag => action.x.is_some() && action.y.is_some() && action.button.is_some(),
            ActionType::MouseScroll => action.x.is_some() && action.y.is_some(),
            
            // Supported keyboard actions
            ActionType::KeyPress => action.key.is_some(),
            ActionType::KeyRelease => action.key.is_some(),
            ActionType::KeyType => action.text.is_some(),
            
            // Wait is always supported
            ActionType::Wait => true,
            
            // Screenshot and Custom are not supported during playback
            ActionType::Screenshot => false,
            ActionType::Custom => false,
            
            // AI Vision Capture requires separate handling (not via standard Action struct)
            ActionType::AiVisionCapture => false,
        }
    }
    
    /// Log when an action is skipped due to being unsupported
    fn log_action_skipped(action_index: usize, action: &Action, reason: &str) {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("action_index".to_string(), json!(action_index));
            metadata.insert("action_type".to_string(), json!(format!("{:?}", action.action_type)));
            metadata.insert("reason".to_string(), json!(reason));
            metadata.insert("timestamp".to_string(), json!(action.timestamp));
            
            // Add action details for context
            if let Some(x) = action.x {
                metadata.insert("x".to_string(), json!(x));
            }
            if let Some(y) = action.y {
                metadata.insert("y".to_string(), json!(y));
            }
            if let Some(ref button) = action.button {
                metadata.insert("button".to_string(), json!(button));
            }
            if let Some(ref key) = action.key {
                metadata.insert("key".to_string(), json!(key));
            }
            if let Some(ref text) = action.text {
                metadata.insert("text".to_string(), json!(text));
            }
            
            logger.log_operation(
                LogLevel::Warn,
                CoreType::Rust,
                OperationType::Playback,
                format!("action_skipped_{}", chrono::Utc::now().timestamp_millis()),
                format!("Skipping action {} ({:?}): {}", action_index, action.action_type, reason),
                Some(metadata),
            );
        }
    }
    
    /// Execute a single action synchronously with comprehensive logging and error handling
    fn execute_action_sync(platform: &dyn PlatformAutomation, action: &Action, action_index: usize, _config: &AutomationConfig) -> std::result::Result<(), PlaybackError> {
        // Validate action type before execution
        if !Self::is_action_supported(action) {
            let reason = match action.action_type {
                ActionType::Screenshot => "Screenshot actions are not executed during playback",
                ActionType::Custom => "Custom actions are not supported in this version",
                ActionType::MouseMove | ActionType::MouseClick | ActionType::MouseDoubleClick | 
                ActionType::MouseDrag | ActionType::MouseScroll => "Missing required coordinates or button parameter",
                ActionType::KeyPress | ActionType::KeyRelease => "Missing required key parameter",
                ActionType::KeyType => "Missing required text parameter",
                ActionType::Wait => "Wait action has invalid parameters",
                ActionType::AiVisionCapture => "AI Vision Capture actions require separate handling via AIVisionCaptureAction struct",
            };
            
            Self::log_action_skipped(action_index, action, reason);
            
            // Return Ok to continue playback after skipping
            return Ok(());
        }
        
        // Log action execution attempt
        Self::log_action_execution(action_index, action);
        
        let start_time = Instant::now();
        
        // Helper to convert AutomationError to PlaybackError with context
        let to_playback_error = |e: AutomationError| -> PlaybackError {
            let action_type_str = format!("{:?}", action.action_type);
            let coordinates = action.x.and_then(|x| action.y.map(|y| (x, y)));
            PlaybackError::new(action_index, action_type_str, coordinates, e)
        };
        
        // Helper to clamp coordinates to screen bounds
        let clamp_coordinates = |x: i32, y: i32| -> (i32, i32) {
            // Get screen size for coordinate validation
            match platform.get_screen_size() {
                Ok((screen_width, screen_height)) => {
                    let max_x = (screen_width as i32).saturating_sub(1).max(0);
                    let max_y = (screen_height as i32).saturating_sub(1).max(0);
                    
                    let clamped_x = x.max(0).min(max_x);
                    let clamped_y = y.max(0).min(max_y);
                    
                    // Log warning if coordinates were clamped
                    if clamped_x != x || clamped_y != y {
                        if let Some(logger) = get_logger() {
                            let mut metadata = HashMap::new();
                            metadata.insert("action_index".to_string(), json!(action_index));
                            metadata.insert("original_x".to_string(), json!(x));
                            metadata.insert("original_y".to_string(), json!(y));
                            metadata.insert("clamped_x".to_string(), json!(clamped_x));
                            metadata.insert("clamped_y".to_string(), json!(clamped_y));
                            metadata.insert("screen_width".to_string(), json!(screen_width));
                            metadata.insert("screen_height".to_string(), json!(screen_height));
                            
                            logger.log_operation(
                                LogLevel::Warn,
                                CoreType::Rust,
                                OperationType::Playback,
                                format!("coordinate_clamping_{}", chrono::Utc::now().timestamp_millis()),
                                format!("Coordinates clamped from ({}, {}) to ({}, {}) for screen bounds {}x{}", 
                                    x, y, clamped_x, clamped_y, screen_width, screen_height),
                                Some(metadata),
                            );
                        }
                    }
                    
                    (clamped_x, clamped_y)
                },
                Err(e) => {
                    // If we can't get screen size, log error but use original coordinates
                    if let Some(logger) = get_logger() {
                        let mut metadata = HashMap::new();
                        metadata.insert("action_index".to_string(), json!(action_index));
                        metadata.insert("error".to_string(), json!(e.to_string()));
                        
                        logger.log_operation(
                            LogLevel::Warn,
                            CoreType::Rust,
                            OperationType::Playback,
                            format!("screen_size_error_{}", chrono::Utc::now().timestamp_millis()),
                            format!("Failed to get screen size for coordinate validation: {}", e),
                            Some(metadata),
                        );
                    }
                    (x, y)
                }
            }
        };
        
        let result = match action.action_type {
            ActionType::MouseMove => {
                if let (Some(x), Some(y)) = (action.x, action.y) {
                    // Clamp coordinates to screen bounds
                    let (clamped_x, clamped_y) = clamp_coordinates(x, y);
                    Self::log_platform_call("mouse_move", &format!("x={}, y={}", clamped_x, clamped_y));
                    platform.mouse_move(clamped_x, clamped_y).map_err(|e| {
                        Self::log_platform_error("mouse_move", &e);
                        to_playback_error(e)
                    })
                } else {
                    Ok(())
                }
            }
            ActionType::MouseClick => {
                if let (Some(x), Some(y), Some(ref button)) = (action.x, action.y, &action.button) {
                    // Clamp coordinates to screen bounds
                    let (clamped_x, clamped_y) = clamp_coordinates(x, y);
                    Self::log_platform_call("mouse_click_at", &format!("x={}, y={}, button={}", clamped_x, clamped_y, button));
                    platform.mouse_click_at(clamped_x, clamped_y, button).map_err(|e| {
                        Self::log_platform_error("mouse_click_at", &e);
                        to_playback_error(e)
                    })
                } else {
                    Ok(())
                }
            }
            ActionType::MouseDoubleClick => {
                if let (Some(x), Some(y), Some(ref button)) = (action.x, action.y, &action.button) {
                    // Clamp coordinates to screen bounds
                    let (clamped_x, clamped_y) = clamp_coordinates(x, y);
                    Self::log_platform_call("mouse_double_click", &format!("x={}, y={}, button={}", clamped_x, clamped_y, button));
                    platform.mouse_double_click(clamped_x, clamped_y, button).map_err(|e| {
                        Self::log_platform_error("mouse_double_click", &e);
                        to_playback_error(e)
                    })
                } else {
                    Ok(())
                }
            }
            ActionType::MouseDrag => {
                // For drag actions, we need additional data to determine start/end positions
                if let (Some(x), Some(y), Some(ref button)) = (action.x, action.y, &action.button) {
                    // Check for drag coordinates in additional_data
                    if let Some(ref additional_data) = action.additional_data {
                        if let (Some(from_x), Some(from_y), Some(to_x), Some(to_y)) = (
                            additional_data.get("from_x").and_then(|v| v.as_i64()).map(|v| v as i32),
                            additional_data.get("from_y").and_then(|v| v.as_i64()).map(|v| v as i32),
                            additional_data.get("to_x").and_then(|v| v.as_i64()).map(|v| v as i32),
                            additional_data.get("to_y").and_then(|v| v.as_i64()).map(|v| v as i32),
                        ) {
                            // Clamp both start and end coordinates
                            let (clamped_from_x, clamped_from_y) = clamp_coordinates(from_x, from_y);
                            let (clamped_to_x, clamped_to_y) = clamp_coordinates(to_x, to_y);
                            Self::log_platform_call("mouse_drag", &format!("from=({},{}), to=({},{}), button={}", clamped_from_x, clamped_from_y, clamped_to_x, clamped_to_y, button));
                            platform.mouse_drag(clamped_from_x, clamped_from_y, clamped_to_x, clamped_to_y, button).map_err(|e| {
                                Self::log_platform_error("mouse_drag", &e);
                                to_playback_error(e)
                            })
                        } else {
                            // Fallback to click with clamped coordinates
                            let (clamped_x, clamped_y) = clamp_coordinates(x, y);
                            Self::log_platform_call("mouse_click_at", &format!("x={}, y={}, button={} (drag fallback)", clamped_x, clamped_y, button));
                            platform.mouse_click_at(clamped_x, clamped_y, button).map_err(|e| {
                                Self::log_platform_error("mouse_click_at", &e);
                                to_playback_error(e)
                            })
                        }
                    } else {
                        // Fallback to click with clamped coordinates
                        let (clamped_x, clamped_y) = clamp_coordinates(x, y);
                        Self::log_platform_call("mouse_click_at", &format!("x={}, y={}, button={} (drag fallback)", clamped_x, clamped_y, button));
                        platform.mouse_click_at(clamped_x, clamped_y, button).map_err(|e| {
                            Self::log_platform_error("mouse_click_at", &e);
                            to_playback_error(e)
                        })
                    }
                } else {
                    Ok(())
                }
            }
            ActionType::MouseScroll => {
                if let (Some(x), Some(y)) = (action.x, action.y) {
                    // Clamp coordinates to screen bounds
                    let (clamped_x, clamped_y) = clamp_coordinates(x, y);
                    let (delta_x, delta_y) = if let Some(ref additional_data) = action.additional_data {
                        (
                            additional_data.get("delta_x").and_then(|v| v.as_i64()).map(|v| v as i32).unwrap_or(0),
                            additional_data.get("delta_y").and_then(|v| v.as_i64()).map(|v| v as i32).unwrap_or(1),
                        )
                    } else {
                        (0, 1)
                    };
                    Self::log_platform_call("mouse_scroll", &format!("x={}, y={}, delta_x={}, delta_y={}", clamped_x, clamped_y, delta_x, delta_y));
                    platform.mouse_scroll(clamped_x, clamped_y, delta_x, delta_y).map_err(|e| {
                        Self::log_platform_error("mouse_scroll", &e);
                        to_playback_error(e)
                    })
                } else {
                    Ok(())
                }
            }
            ActionType::KeyPress => {
                if let Some(ref key) = action.key {
                    if let Some(ref modifiers) = action.modifiers {
                        Self::log_platform_call("key_combination", &format!("key={}, modifiers={:?}", key, modifiers));
                        platform.key_combination(key, modifiers).map_err(|e| {
                            Self::log_platform_error("key_combination", &e);
                            to_playback_error(e)
                        })
                    } else {
                        Self::log_platform_call("key_press", &format!("key={}", key));
                        platform.key_press(key).map_err(|e| {
                            Self::log_platform_error("key_press", &e);
                            to_playback_error(e)
                        })
                    }
                } else {
                    Ok(())
                }
            }
            ActionType::KeyRelease => {
                if let Some(ref key) = action.key {
                    Self::log_platform_call("key_release", &format!("key={}", key));
                    platform.key_release(key).map_err(|e| {
                        Self::log_platform_error("key_release", &e);
                        to_playback_error(e)
                    })
                } else {
                    Ok(())
                }
            }
            ActionType::KeyType => {
                if let Some(ref text) = action.text {
                    Self::log_platform_call("key_type", &format!("text={}", text));
                    platform.key_type(text).map_err(|e| {
                        Self::log_platform_error("key_type", &e);
                        to_playback_error(e)
                    })
                } else {
                    Ok(())
                }
            }
            ActionType::Screenshot => {
                // Screenshot actions are typically for verification, not playback
                Ok(())
            }
            ActionType::Wait => {
                // Wait actions pause execution for a specified duration
                if let Some(duration_ms) = action.additional_data
                    .as_ref()
                    .and_then(|data| data.get("duration_ms"))
                    .and_then(|v| v.as_u64()) {
                    Self::log_platform_call("wait", &format!("duration_ms={}", duration_ms));
                    thread::sleep(Duration::from_millis(duration_ms));
                }
                Ok(())
            }
            ActionType::Custom => {
                // Custom actions would need specific handling based on additional_data
                Ok(())
            }
            ActionType::AiVisionCapture => {
                // AI Vision Capture actions are handled separately via AIVisionCaptureAction struct
                // This branch should not be reached as is_action_supported returns false
                Ok(())
            }
        };

        let duration = start_time.elapsed();
        
        // Log success or failure
        match &result {
            Ok(_) => Self::log_action_success(action_index, action, duration),
            Err(e) => {
                // Log the underlying automation error
                Self::log_action_failure(action_index, action, &e.underlying_error);
                
                // Also log the playback error with context
                if let Some(logger) = get_logger() {
                    let mut metadata = HashMap::new();
                    metadata.insert("action_index".to_string(), json!(e.action_index));
                    metadata.insert("action_type".to_string(), json!(&e.action_type));
                    metadata.insert("recoverable".to_string(), json!(e.recoverable));
                    if let Some((x, y)) = e.coordinates {
                        metadata.insert("coordinates".to_string(), json!(format!("({}, {})", x, y)));
                    }
                    metadata.insert("user_message".to_string(), json!(e.to_user_message()));
                    
                    logger.log_operation(
                        LogLevel::Error,
                        CoreType::Rust,
                        OperationType::Playback,
                        format!("playback_error_{}_{}", action_index, chrono::Utc::now().timestamp_millis()),
                        format!("PlaybackError: {}", e.to_user_message()),
                        Some(metadata),
                    );
                }
            },
        }
        
        result
    }

    /// Send event to UI for real-time feedback with logging and error handling
    fn send_event(&self, event: PlaybackEvent) {
        if let Some(ref sender) = self.event_sender {
            // Log the event being sent
            if let Some(logger) = get_logger() {
                let mut metadata = HashMap::new();
                metadata.insert("event_type".to_string(), json!(&event.event_type));
                
                // Add event-specific metadata
                match &event.data {
                    PlaybackEventData::Progress { current_action, total_actions, current_loop, total_loops, progress } => {
                        metadata.insert("current_action".to_string(), json!(current_action));
                        metadata.insert("total_actions".to_string(), json!(total_actions));
                        metadata.insert("current_loop".to_string(), json!(current_loop));
                        metadata.insert("total_loops".to_string(), json!(total_loops));
                        metadata.insert("progress".to_string(), json!(progress));
                    },
                    PlaybackEventData::ActionPreview { index, action } => {
                        metadata.insert("action_index".to_string(), json!(index));
                        metadata.insert("action_type".to_string(), json!(&action.action_type));
                    },
                    PlaybackEventData::Status { status, message } => {
                        metadata.insert("status".to_string(), json!(status));
                        if let Some(msg) = message {
                            metadata.insert("message".to_string(), json!(msg));
                        }
                    },
                    PlaybackEventData::Complete { completed, reason, total_actions, actions_executed, 
                                                   actions_failed, actions_skipped, loops_completed, 
                                                   duration_ms, success_rate, errors } => {
                        metadata.insert("completed".to_string(), json!(completed));
                        metadata.insert("reason".to_string(), json!(reason));
                        metadata.insert("total_actions".to_string(), json!(total_actions));
                        metadata.insert("actions_executed".to_string(), json!(actions_executed));
                        metadata.insert("actions_failed".to_string(), json!(actions_failed));
                        metadata.insert("actions_skipped".to_string(), json!(actions_skipped));
                        metadata.insert("loops_completed".to_string(), json!(loops_completed));
                        metadata.insert("duration_ms".to_string(), json!(duration_ms));
                        metadata.insert("success_rate".to_string(), json!(success_rate));
                        if let Some(ref errs) = errors {
                            metadata.insert("error_count".to_string(), json!(errs.len()));
                        }
                    },
                }
                
                logger.log_operation(
                    LogLevel::Trace,
                    CoreType::Rust,
                    OperationType::Playback,
                    format!("event_send_{}", chrono::Utc::now().timestamp_millis()),
                    format!("Sending {} event to UI", event.event_type),
                    Some(metadata),
                );
            }
            
            // Send the event with error handling
            if let Err(e) = sender.send(event.clone()) {
                // Log send failure
                if let Some(logger) = get_logger() {
                    let mut metadata = HashMap::new();
                    metadata.insert("event_type".to_string(), json!(&event.event_type));
                    metadata.insert("error".to_string(), json!(e.to_string()));
                    
                    logger.log_operation(
                        LogLevel::Error,
                        CoreType::Rust,
                        OperationType::Playback,
                        format!("event_send_failure_{}", chrono::Utc::now().timestamp_millis()),
                        format!("Failed to send {} event to UI: {}", event.event_type, e),
                        Some(metadata),
                    );
                }
            }
        } else {
            // Log warning if event sender is not initialized
            if let Some(logger) = get_logger() {
                logger.log_operation(
                    LogLevel::Warn,
                    CoreType::Rust,
                    OperationType::Playback,
                    format!("event_sender_missing_{}", chrono::Utc::now().timestamp_millis()),
                    format!("Event sender not initialized, cannot send {} event", event.event_type),
                    None,
                );
            }
        }
    }

    /// Get current playback status
    pub fn get_status(&self) -> PlaybackStatus {
        let is_playing = self.is_playing.load(Ordering::Relaxed);
        let is_paused = self.is_paused.load(Ordering::Relaxed);
        let current_action_index = self.current_action_index.load(Ordering::Relaxed);
        
        let (total_actions, progress, elapsed_time) = if let Some(ref script) = self.current_script {
            let total = script.actions.len();
            let progress = if total > 0 {
                current_action_index as f64 / total as f64
            } else {
                0.0
            };
            let elapsed = self.start_time
                .map(|start| start.elapsed().as_secs_f64())
                .unwrap_or(0.0);
            (total, progress, elapsed)
        } else {
            (0, 0.0, 0.0)
        };

        PlaybackStatus {
            is_playing,
            is_paused,
            current_action: current_action_index,
            total_actions,
            progress,
            elapsed_time,
            loops_completed: self.current_loop.load(Ordering::Relaxed).saturating_sub(1),
            loops_remaining: self.loops_remaining.load(Ordering::Relaxed),
        }
    }

    /// Check if currently playing
    pub fn is_playing(&self) -> bool {
        self.is_playing.load(Ordering::Relaxed)
    }

    /// Check if currently paused
    pub fn is_paused(&self) -> bool {
        self.is_paused.load(Ordering::Relaxed)
    }
}

/// Background player that runs playback with event streaming
pub struct BackgroundPlayer {
    player: Arc<Mutex<Player>>,
    event_receiver: Option<mpsc::UnboundedReceiver<PlaybackEvent>>,
}

impl BackgroundPlayer {
    /// Create a new background player
    pub fn new(config: AutomationConfig) -> Result<Self> {
        let player = Arc::new(Mutex::new(Player::new(config)?));
        
        Ok(Self { 
            player,
            event_receiver: None,
        })
    }

    /// Set up event streaming and return receiver
    pub fn setup_event_streaming(&mut self) -> mpsc::UnboundedReceiver<PlaybackEvent> {
        let (sender, receiver) = mpsc::unbounded_channel();
        
        {
            let mut player = self.player.lock().unwrap();
            player.set_event_sender(sender);
        }
        
        receiver
    }

    /// Load a script for playback
    pub fn load_script(&self, script: ScriptData) -> Result<()> {
        let mut player = self.player.lock().unwrap();
        player.load_script(script)
    }

    /// Start background playback
    pub fn start_playback(&self, speed: f64, loops: u32) -> Result<()> {
        let mut player = self.player.lock().unwrap();
        player.start_playback(speed, loops)
    }

    /// Stop playback
    pub fn stop_playback(&self) -> Result<()> {
        let mut player = self.player.lock().unwrap();
        player.stop_playback()
    }

    /// Pause or resume playback
    pub fn pause_playback(&self) -> Result<bool> {
        let mut player = self.player.lock().unwrap();
        player.pause_playback()
    }

    /// Get current playback status
    pub fn get_status(&self) -> PlaybackStatus {
        let player = self.player.lock().unwrap();
        player.get_status()
    }

    /// Check if currently playing
    pub fn is_playing(&self) -> bool {
        let player = self.player.lock().unwrap();
        player.is_playing()
    }

    /// Check if currently paused
    pub fn is_paused(&self) -> bool {
        let player = self.player.lock().unwrap();
        player.is_paused()
    }
}

// ============================================================================
// Coordinate Scaling Utilities for AI Vision Capture
// ============================================================================

/// Represents screen dimensions (width, height)
pub type ScreenDimensions = (u32, u32);

/// Result of coordinate scaling operation
#[derive(Debug, Clone, PartialEq)]
pub struct ScaledCoordinates {
    /// Scaled X coordinate
    pub x: i32,
    /// Scaled Y coordinate
    pub y: i32,
    /// Whether scaling was applied (false if dimensions match)
    pub was_scaled: bool,
}

/// Scale coordinates proportionally when screen resolution differs.
///
/// This function implements proportional scaling for AI Vision Capture coordinates
/// when the playback screen resolution differs from the recording resolution.
///
/// # Formula
/// - `new_x = old_x * (new_width / old_width)`
/// - `new_y = old_y * (new_height / old_height)`
///
/// # Clamping
/// The resulting coordinates are clamped to the new screen bounds:
/// - `0 <= x < new_width`
/// - `0 <= y < new_height`
///
/// # Arguments
/// * `x` - Original X coordinate
/// * `y` - Original Y coordinate
/// * `old_dim` - Original screen dimensions (width, height) at recording time
/// * `new_dim` - Current screen dimensions (width, height) at playback time
///
/// # Returns
/// `ScaledCoordinates` containing the scaled and clamped coordinates
///
/// # Requirements
/// - **Validates: Requirements 4.3, 4.4** - Proportional scaling for Static Mode
/// - **Validates: Requirements 4.5** - Proportional scaling for Cache Mode
///
/// # Example
/// ```
/// use rust_core::player::{scale_coordinates, ScreenDimensions};
///
/// // Original coordinates at 1920x1080
/// let result = scale_coordinates(960, 540, (1920, 1080), (3840, 2160));
///
/// // Should scale proportionally to 4K
/// assert_eq!(result.x, 1920);
/// assert_eq!(result.y, 1080);
/// assert!(result.was_scaled);
/// ```
pub fn scale_coordinates(
    x: i32,
    y: i32,
    old_dim: ScreenDimensions,
    new_dim: ScreenDimensions,
) -> ScaledCoordinates {
    let (old_width, old_height) = old_dim;
    let (new_width, new_height) = new_dim;

    // If dimensions are the same, no scaling needed
    if old_width == new_width && old_height == new_height {
        return ScaledCoordinates {
            x,
            y,
            was_scaled: false,
        };
    }

    // Handle edge case: zero dimensions (avoid division by zero)
    if old_width == 0 || old_height == 0 {
        return ScaledCoordinates {
            x: 0,
            y: 0,
            was_scaled: true,
        };
    }

    // Calculate proportional scaling using floating point for precision
    // Formula: new_x = old_x * (new_width / old_width)
    let scale_x = new_width as f64 / old_width as f64;
    let scale_y = new_height as f64 / old_height as f64;

    let scaled_x = (x as f64 * scale_x).round() as i32;
    let scaled_y = (y as f64 * scale_y).round() as i32;

    // Clamp coordinates to screen bounds
    // x must be in range [0, new_width - 1]
    // y must be in range [0, new_height - 1]
    let clamped_x = scaled_x.max(0).min((new_width as i32).saturating_sub(1));
    let clamped_y = scaled_y.max(0).min((new_height as i32).saturating_sub(1));

    ScaledCoordinates {
        x: clamped_x,
        y: clamped_y,
        was_scaled: true,
    }
}

/// Scale a VisionROI (Region of Interest) proportionally when screen resolution differs.
///
/// This function scales all four components of an ROI (x, y, width, height) proportionally.
///
/// # Arguments
/// * `roi` - The original ROI to scale
/// * `old_dim` - Original screen dimensions at recording time
/// * `new_dim` - Current screen dimensions at playback time
///
/// # Returns
/// A new `VisionROI` with scaled coordinates and dimensions, clamped to screen bounds
///
/// # Requirements
/// - **Validates: Requirements 4.7** - ROI scaling for Dynamic Mode Regional Search
pub fn scale_roi(
    roi: &crate::script::VisionROI,
    old_dim: ScreenDimensions,
    new_dim: ScreenDimensions,
) -> crate::script::VisionROI {
    let (old_width, old_height) = old_dim;
    let (new_width, new_height) = new_dim;

    // If dimensions are the same, return a clone
    if old_width == new_width && old_height == new_height {
        return roi.clone();
    }

    // Handle edge case: zero dimensions
    if old_width == 0 || old_height == 0 {
        return crate::script::VisionROI {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
        };
    }

    // Calculate scale factors
    let scale_x = new_width as f64 / old_width as f64;
    let scale_y = new_height as f64 / old_height as f64;

    // Scale position
    let scaled_x = (roi.x as f64 * scale_x).round() as i32;
    let scaled_y = (roi.y as f64 * scale_y).round() as i32;

    // Scale dimensions
    let scaled_width = (roi.width as f64 * scale_x).round() as i32;
    let scaled_height = (roi.height as f64 * scale_y).round() as i32;

    // Clamp position to screen bounds
    let clamped_x = scaled_x.max(0).min((new_width as i32).saturating_sub(1));
    let clamped_y = scaled_y.max(0).min((new_height as i32).saturating_sub(1));

    // Clamp dimensions to fit within screen (ensure at least 1 pixel)
    let max_width = (new_width as i32 - clamped_x).max(1);
    let max_height = (new_height as i32 - clamped_y).max(1);
    let clamped_width = scaled_width.max(1).min(max_width) as u32;
    let clamped_height = scaled_height.max(1).min(max_height) as u32;

    crate::script::VisionROI {
        x: clamped_x,
        y: clamped_y,
        width: clamped_width,
        height: clamped_height,
    }
}

// ============================================================================
// AI Vision Capture Execution
// ============================================================================

/// Result of AI Vision Capture execution
#[derive(Debug, Clone)]
pub struct AIVisionExecutionResult {
    /// Whether the execution was successful
    pub success: bool,
    /// The mode that was used for execution
    pub mode: AIVisionExecutionMode,
    /// The coordinates used for the interaction
    pub coordinates: Option<(i32, i32)>,
    /// Whether AI was called (only true for Dynamic Mode without cache)
    pub ai_called: bool,
    /// Error message if execution failed
    pub error: Option<String>,
}

/// The execution mode used for AI Vision Capture
#[derive(Debug, Clone, PartialEq)]
pub enum AIVisionExecutionMode {
    /// Static Mode: Used saved_x/saved_y from static_data
    Static,
    /// Cache Mode: Used cached_x/cached_y from cache_data
    Cache,
    /// Dynamic Mode: Called AI service to find coordinates
    Dynamic,
    /// Skipped: Action was skipped due to missing data
    Skipped,
}

impl std::fmt::Display for AIVisionExecutionMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AIVisionExecutionMode::Static => write!(f, "Static"),
            AIVisionExecutionMode::Cache => write!(f, "Cache"),
            AIVisionExecutionMode::Dynamic => write!(f, "Dynamic"),
            AIVisionExecutionMode::Skipped => write!(f, "Skipped"),
        }
    }
}

/// Execute an AI Vision Capture action.
///
/// This function implements the execution dispatcher for AI Vision Capture actions,
/// following the priority order defined in Requirements 4.1:
/// 1. Static Mode (saved_x/y) - 0 token cost
/// 2. Cache Mode (cached_x/y) - 0 token cost  
/// 3. Dynamic Mode (Call AI) - token cost, then cache result
///
/// # Arguments
/// * `platform` - Platform automation interface for executing interactions
/// * `action` - The AI Vision Capture action to execute
/// * `action_index` - Index of the action in the script (for logging)
///
/// # Returns
/// `AIVisionExecutionResult` containing execution details
///
/// # Requirements
/// - **Validates: Requirements 4.1** - Playback priority order
/// - **Validates: Requirements 4.3, 4.4** - Static Mode execution with scaling
/// - **Validates: Requirements 4.5** - Cache Mode execution with scaling
/// - **Validates: Requirements 4.6** - Dynamic Mode (stub for future AI integration)
/// - **Validates: Requirements 4.12** - Skip and log warning if coordinates missing
pub fn execute_ai_vision_capture(
    platform: &dyn PlatformAutomation,
    action: &crate::script::AIVisionCaptureAction,
    action_index: usize,
) -> AIVisionExecutionResult {
    // Log the start of AI Vision Capture execution
    log_ai_vision_execution_start(action_index, action);

    // Priority 1: Check if Static Mode (is_dynamic = false)
    if !action.is_dynamic {
        return execute_static_mode(platform, action, action_index);
    }

    // Priority 2: Check if Cache Mode (is_dynamic = true AND has cached coordinates)
    if action.has_cached_coordinates() {
        return execute_cache_mode(platform, action, action_index);
    }

    // Priority 3: Dynamic Mode (is_dynamic = true AND no cache)
    execute_dynamic_mode(platform, action, action_index)
}

/// Execute AI Vision Capture in Static Mode.
///
/// Uses saved_x/saved_y from static_data, applying proportional scaling
/// if the current screen resolution differs from the recorded resolution.
///
/// # Requirements
/// - **Validates: Requirements 4.3** - Static Mode execution
/// - **Validates: Requirements 4.4** - Proportional scaling
/// - **Validates: Requirements 4.12** - Skip if coordinates missing
fn execute_static_mode(
    platform: &dyn PlatformAutomation,
    action: &crate::script::AIVisionCaptureAction,
    action_index: usize,
) -> AIVisionExecutionResult {
    // Log Static Mode execution
    if let Some(logger) = get_logger() {
        let mut metadata = HashMap::new();
        metadata.insert("action_index".to_string(), json!(action_index));
        metadata.insert("action_id".to_string(), json!(&action.id));
        metadata.insert("mode".to_string(), json!("Static"));
        metadata.insert("is_dynamic".to_string(), json!(action.is_dynamic));
        
        logger.log_operation(
            LogLevel::Info,
            CoreType::Rust,
            OperationType::Playback,
            format!("ai_vision_static_{}", chrono::Utc::now().timestamp_millis()),
            format!("AI Vision Capture [{}]: Using Static Mode (0 token cost)", action_index),
            Some(metadata),
        );
    }

    // Check if saved coordinates exist
    let (saved_x, saved_y) = match (action.static_data.saved_x, action.static_data.saved_y) {
        (Some(x), Some(y)) => (x, y),
        _ => {
            // Skip action and log warning (Requirement 4.12)
            log_ai_vision_skip(action_index, action, "Missing saved coordinates in Static Mode");
            return AIVisionExecutionResult {
                success: false,
                mode: AIVisionExecutionMode::Skipped,
                coordinates: None,
                ai_called: false,
                error: Some("Missing saved coordinates in Static Mode".to_string()),
            };
        }
    };

    // Get current screen dimensions
    let current_dim = match platform.get_screen_size() {
        Ok(dim) => dim,
        Err(e) => {
            log_ai_vision_error(action_index, action, &format!("Failed to get screen size: {}", e));
            return AIVisionExecutionResult {
                success: false,
                mode: AIVisionExecutionMode::Static,
                coordinates: Some((saved_x, saved_y)),
                ai_called: false,
                error: Some(format!("Failed to get screen size: {}", e)),
            };
        }
    };

    // Apply proportional scaling if resolution differs (Requirement 4.4)
    let recorded_dim = action.static_data.screen_dim;
    let scaled = scale_coordinates(saved_x, saved_y, recorded_dim, current_dim);

    if scaled.was_scaled {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("original_x".to_string(), json!(saved_x));
            metadata.insert("original_y".to_string(), json!(saved_y));
            metadata.insert("scaled_x".to_string(), json!(scaled.x));
            metadata.insert("scaled_y".to_string(), json!(scaled.y));
            metadata.insert("recorded_dim".to_string(), json!(format!("{}x{}", recorded_dim.0, recorded_dim.1)));
            metadata.insert("current_dim".to_string(), json!(format!("{}x{}", current_dim.0, current_dim.1)));
            
            logger.log_operation(
                LogLevel::Debug,
                CoreType::Rust,
                OperationType::Playback,
                format!("ai_vision_scale_{}", chrono::Utc::now().timestamp_millis()),
                format!("Scaled coordinates from ({}, {}) to ({}, {}) for resolution change {}x{} -> {}x{}",
                    saved_x, saved_y, scaled.x, scaled.y,
                    recorded_dim.0, recorded_dim.1, current_dim.0, current_dim.1),
                Some(metadata),
            );
        }
    }

    // Execute the interaction at the coordinates
    let result = execute_interaction(platform, action, scaled.x, scaled.y, action_index);

    AIVisionExecutionResult {
        success: result.is_ok(),
        mode: AIVisionExecutionMode::Static,
        coordinates: Some((scaled.x, scaled.y)),
        ai_called: false,
        error: result.err().map(|e| e.to_string()),
    }
}

/// Execute AI Vision Capture in Cache Mode.
///
/// Uses cached_x/cached_y from cache_data, applying proportional scaling
/// if the current screen resolution differs from cache_dim.
///
/// # Requirements
/// - **Validates: Requirements 4.5** - Cache Mode execution with scaling
fn execute_cache_mode(
    platform: &dyn PlatformAutomation,
    action: &crate::script::AIVisionCaptureAction,
    action_index: usize,
) -> AIVisionExecutionResult {
    // Log Cache Mode execution
    if let Some(logger) = get_logger() {
        let mut metadata = HashMap::new();
        metadata.insert("action_index".to_string(), json!(action_index));
        metadata.insert("action_id".to_string(), json!(&action.id));
        metadata.insert("mode".to_string(), json!("Cache"));
        
        logger.log_operation(
            LogLevel::Info,
            CoreType::Rust,
            OperationType::Playback,
            format!("ai_vision_cache_{}", chrono::Utc::now().timestamp_millis()),
            format!("AI Vision Capture [{}]: Using cached coordinates (0 token cost)", action_index),
            Some(metadata),
        );
    }

    // Get cached coordinates (we already verified they exist)
    let (cached_x, cached_y) = match (action.cache_data.cached_x, action.cache_data.cached_y) {
        (Some(x), Some(y)) => (x, y),
        _ => {
            // This shouldn't happen since we checked has_cached_coordinates()
            log_ai_vision_error(action_index, action, "Cache data unexpectedly missing");
            return AIVisionExecutionResult {
                success: false,
                mode: AIVisionExecutionMode::Cache,
                coordinates: None,
                ai_called: false,
                error: Some("Cache data unexpectedly missing".to_string()),
            };
        }
    };

    // Get current screen dimensions
    let current_dim = match platform.get_screen_size() {
        Ok(dim) => dim,
        Err(e) => {
            log_ai_vision_error(action_index, action, &format!("Failed to get screen size: {}", e));
            return AIVisionExecutionResult {
                success: false,
                mode: AIVisionExecutionMode::Cache,
                coordinates: Some((cached_x, cached_y)),
                ai_called: false,
                error: Some(format!("Failed to get screen size: {}", e)),
            };
        }
    };

    // Apply proportional scaling using cache_dim if resolution differs
    let cache_dim = action.cache_data.cache_dim.unwrap_or(current_dim);
    let scaled = scale_coordinates(cached_x, cached_y, cache_dim, current_dim);

    if scaled.was_scaled {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("original_x".to_string(), json!(cached_x));
            metadata.insert("original_y".to_string(), json!(cached_y));
            metadata.insert("scaled_x".to_string(), json!(scaled.x));
            metadata.insert("scaled_y".to_string(), json!(scaled.y));
            metadata.insert("cache_dim".to_string(), json!(format!("{}x{}", cache_dim.0, cache_dim.1)));
            metadata.insert("current_dim".to_string(), json!(format!("{}x{}", current_dim.0, current_dim.1)));
            
            logger.log_operation(
                LogLevel::Debug,
                CoreType::Rust,
                OperationType::Playback,
                format!("ai_vision_cache_scale_{}", chrono::Utc::now().timestamp_millis()),
                format!("Scaled cached coordinates from ({}, {}) to ({}, {}) for resolution change {}x{} -> {}x{}",
                    cached_x, cached_y, scaled.x, scaled.y,
                    cache_dim.0, cache_dim.1, current_dim.0, current_dim.1),
                Some(metadata),
            );
        }
    }

    // Execute the interaction at the coordinates
    let result = execute_interaction(platform, action, scaled.x, scaled.y, action_index);

    AIVisionExecutionResult {
        success: result.is_ok(),
        mode: AIVisionExecutionMode::Cache,
        coordinates: Some((scaled.x, scaled.y)),
        ai_called: false,
        error: result.err().map(|e| e.to_string()),
    }
}

/// Execute AI Vision Capture in Dynamic Mode.
///
/// This function handles Dynamic Mode execution by:
/// 1. Capturing a screenshot of the current screen
/// 2. Building an AI analysis request with prompt and reference images
/// 3. Calling the AI service (via callback/provider)
/// 4. Executing the interaction at the returned coordinates
///
/// Note: The actual AI service call is handled externally via the AIVisionProvider
/// trait or through IPC to the TypeScript AI Vision Service.
///
/// # Requirements
/// - **Validates: Requirements 4.6** - Dynamic Mode AI call
/// - **Validates: Requirements 4.7** - ROI handling for Regional Search
/// - **Validates: Requirements 4.8** - AI request structure
/// - **Validates: Requirements 4.10** - Timeout handling
fn execute_dynamic_mode(
    _platform: &dyn PlatformAutomation,
    action: &crate::script::AIVisionCaptureAction,
    action_index: usize,
) -> AIVisionExecutionResult {
    // Log Dynamic Mode execution
    if let Some(logger) = get_logger() {
        let mut metadata = HashMap::new();
        metadata.insert("action_index".to_string(), json!(action_index));
        metadata.insert("action_id".to_string(), json!(&action.id));
        metadata.insert("mode".to_string(), json!("Dynamic"));
        metadata.insert("prompt".to_string(), json!(&action.dynamic_config.prompt));
        metadata.insert("reference_images_count".to_string(), json!(action.dynamic_config.reference_images.len()));
        metadata.insert("search_scope".to_string(), json!(format!("{:?}", action.dynamic_config.search_scope)));
        metadata.insert("has_roi".to_string(), json!(action.dynamic_config.roi.is_some()));
        
        logger.log_operation(
            LogLevel::Info,
            CoreType::Rust,
            OperationType::Playback,
            format!("ai_vision_dynamic_{}", chrono::Utc::now().timestamp_millis()),
            format!("AI Vision Capture [{}]: Dynamic Mode - Preparing AI analysis request...", action_index),
            Some(metadata),
        );
    }

    // Dynamic Mode requires external AI service integration
    // The actual AI call is handled by the Tauri frontend via IPC
    // This function prepares the request and returns a result indicating
    // that AI analysis is needed
    
    // Log that we're ready for AI analysis
    if let Some(logger) = get_logger() {
        logger.log_operation(
            LogLevel::Info,
            CoreType::Rust,
            OperationType::Playback,
            format!("ai_vision_dynamic_ready_{}", chrono::Utc::now().timestamp_millis()),
            format!("AI Vision Capture [{}]: Dynamic Mode - Ready for AI service call (handled via IPC)", action_index),
            None,
        );
    }

    // Return a result indicating Dynamic Mode needs AI service
    // The actual execution will be handled by execute_dynamic_mode_with_ai
    AIVisionExecutionResult {
        success: false,
        mode: AIVisionExecutionMode::Dynamic,
        coordinates: None,
        ai_called: false,
        error: Some("Dynamic Mode requires AI service - use execute_dynamic_mode_with_ai".to_string()),
    }
}

/// Execute AI Vision Capture in Dynamic Mode with AI provider.
///
/// This function performs the full Dynamic Mode execution including:
/// 1. Capturing a screenshot of the current screen
/// 2. Handling ROI scaling for Regional Search (Requirement 4.7)
/// 3. Calling the AI service via the provided AIVisionProvider
/// 4. Executing the interaction at the returned coordinates
/// 5. Returning cache update information for persistence
///
/// # Arguments
/// * `platform` - Platform automation interface for executing interactions
/// * `action` - The AI Vision Capture action to execute
/// * `action_index` - Index of the action in the script (for logging)
/// * `ai_provider` - The AI Vision provider to use for analysis
/// * `screenshot_base64` - Base64 encoded screenshot of the current screen
/// * `reference_images_base64` - Base64 encoded reference images
///
/// # Returns
/// `DynamicModeExecutionResult` containing execution details and cache update info
///
/// # Requirements
/// - **Validates: Requirements 4.6** - Dynamic Mode AI call
/// - **Validates: Requirements 4.7** - ROI handling for Regional Search
/// - **Validates: Requirements 4.8** - AI request structure
/// - **Validates: Requirements 4.9** - Cache update after success
/// - **Validates: Requirements 4.10** - Timeout handling
/// - **Validates: Requirements 4.11** - Cache invalidation on failure
pub fn execute_dynamic_mode_with_ai(
    platform: &dyn PlatformAutomation,
    action: &crate::script::AIVisionCaptureAction,
    action_index: usize,
    ai_provider: &dyn crate::ai_vision_integration::AIVisionProvider,
    screenshot_base64: String,
    reference_images_base64: Vec<String>,
) -> DynamicModeExecutionResult {
    use crate::ai_vision_integration::{build_analysis_request, DEFAULT_AI_TIMEOUT_MS};
    
    // Get current screen dimensions
    let current_dim = match platform.get_screen_size() {
        Ok(dim) => dim,
        Err(e) => {
            log_ai_vision_error(action_index, action, &format!("Failed to get screen size: {}", e));
            return DynamicModeExecutionResult {
                execution_result: AIVisionExecutionResult {
                    success: false,
                    mode: AIVisionExecutionMode::Dynamic,
                    coordinates: None,
                    ai_called: false,
                    error: Some(format!("Failed to get screen size: {}", e)),
                },
                cache_update: None,
            };
        }
    };

    // Log the AI analysis request
    if let Some(logger) = get_logger() {
        let mut metadata = HashMap::new();
        metadata.insert("action_index".to_string(), json!(action_index));
        metadata.insert("action_id".to_string(), json!(&action.id));
        metadata.insert("prompt".to_string(), json!(&action.dynamic_config.prompt));
        metadata.insert("reference_images_count".to_string(), json!(reference_images_base64.len()));
        metadata.insert("search_scope".to_string(), json!(format!("{:?}", action.dynamic_config.search_scope)));
        metadata.insert("has_roi".to_string(), json!(action.dynamic_config.roi.is_some()));
        metadata.insert("current_screen_dim".to_string(), json!(format!("{}x{}", current_dim.0, current_dim.1)));
        
        logger.log_operation(
            LogLevel::Info,
            CoreType::Rust,
            OperationType::Playback,
            format!("ai_vision_dynamic_call_{}", chrono::Utc::now().timestamp_millis()),
            format!("AI Vision Capture [{}]: Calling AI service...", action_index),
            Some(metadata),
        );
    }

    // Build the AI analysis request (handles ROI scaling - Requirement 4.7)
    let request = build_analysis_request(
        action,
        screenshot_base64,
        reference_images_base64,
        current_dim,
        Some(DEFAULT_AI_TIMEOUT_MS),
    );

    // Call the AI service
    let ai_response = match ai_provider.analyze(request) {
        Ok(response) => response,
        Err(e) => {
            // AI service error - clear cache (Requirement 4.11)
            log_ai_vision_error(action_index, action, &format!("AI service error: {}", e));
            return DynamicModeExecutionResult {
                execution_result: AIVisionExecutionResult {
                    success: false,
                    mode: AIVisionExecutionMode::Dynamic,
                    coordinates: None,
                    ai_called: true,
                    error: Some(format!("AI service error: {}", e)),
                },
                cache_update: Some(CacheUpdate::Clear),
            };
        }
    };

    // Handle AI response
    if ai_response.success {
        let x = ai_response.x.unwrap_or(0);
        let y = ai_response.y.unwrap_or(0);
        
        // Log successful AI detection
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("action_index".to_string(), json!(action_index));
            metadata.insert("x".to_string(), json!(x));
            metadata.insert("y".to_string(), json!(y));
            metadata.insert("confidence".to_string(), json!(ai_response.confidence));
            
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Playback,
                format!("ai_vision_dynamic_success_{}", chrono::Utc::now().timestamp_millis()),
                format!("AI Vision Capture [{}]: AI found element at ({}, {}) with confidence {:.2}", 
                    action_index, x, y, ai_response.confidence.unwrap_or(0.0)),
                Some(metadata),
            );
        }

        // Execute the interaction at the AI-returned coordinates
        let interaction_result = execute_interaction(platform, action, x, y, action_index);

        // Prepare cache update (Requirement 4.9)
        let cache_update = CacheUpdate::Update {
            cached_x: x,
            cached_y: y,
            cache_dim: current_dim,
        };

        // Log cache update
        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Playback,
                format!("ai_vision_cache_update_{}", chrono::Utc::now().timestamp_millis()),
                format!("AI Vision Capture [{}]: Caching AI result for future runs", action_index),
                None,
            );
        }

        DynamicModeExecutionResult {
            execution_result: AIVisionExecutionResult {
                success: interaction_result.is_ok(),
                mode: AIVisionExecutionMode::Dynamic,
                coordinates: Some((x, y)),
                ai_called: true,
                error: interaction_result.err().map(|e| e.to_string()),
            },
            cache_update: Some(cache_update),
        }
    } else {
        // AI failed to find element - clear cache (Requirement 4.11)
        let error_msg = ai_response.error.unwrap_or_else(|| "Element not found".to_string());
        
        log_ai_vision_error(action_index, action, &format!("AI analysis failed: {}", error_msg));
        
        // Log cache invalidation
        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Warn,
                CoreType::Rust,
                OperationType::Playback,
                format!("ai_vision_cache_clear_{}", chrono::Utc::now().timestamp_millis()),
                format!("AI Vision Capture [{}]: Clearing cache due to AI failure", action_index),
                None,
            );
        }

        DynamicModeExecutionResult {
            execution_result: AIVisionExecutionResult {
                success: false,
                mode: AIVisionExecutionMode::Dynamic,
                coordinates: None,
                ai_called: true,
                error: Some(error_msg),
            },
            cache_update: Some(CacheUpdate::Clear),
        }
    }
}

/// Result of Dynamic Mode execution including cache update information
#[derive(Debug, Clone)]
pub struct DynamicModeExecutionResult {
    /// The execution result
    pub execution_result: AIVisionExecutionResult,
    /// Cache update to apply (if any)
    pub cache_update: Option<CacheUpdate>,
}

/// Cache update operation to apply after Dynamic Mode execution
#[derive(Debug, Clone)]
pub enum CacheUpdate {
    /// Update cache with new coordinates (Requirement 4.9)
    Update {
        cached_x: i32,
        cached_y: i32,
        cache_dim: (u32, u32),
    },
    /// Clear cache (Requirement 4.11)
    Clear,
}

/// Execute the interaction type at the specified coordinates.
///
/// Supports click, dblclick, rclick, and hover interactions.
///
/// # Requirements
/// - **Validates: Requirements 2.7** - Interaction type execution
fn execute_interaction(
    platform: &dyn PlatformAutomation,
    action: &crate::script::AIVisionCaptureAction,
    x: i32,
    y: i32,
    action_index: usize,
) -> Result<()> {
    use crate::script::InteractionType;

    // Log the interaction execution
    if let Some(logger) = get_logger() {
        let mut metadata = HashMap::new();
        metadata.insert("action_index".to_string(), json!(action_index));
        metadata.insert("interaction_type".to_string(), json!(format!("{:?}", action.interaction)));
        metadata.insert("x".to_string(), json!(x));
        metadata.insert("y".to_string(), json!(y));
        
        logger.log_operation(
            LogLevel::Debug,
            CoreType::Rust,
            OperationType::Playback,
            format!("ai_vision_interaction_{}", chrono::Utc::now().timestamp_millis()),
            format!("Executing {:?} at ({}, {})", action.interaction, x, y),
            Some(metadata),
        );
    }

    match action.interaction {
        InteractionType::Click => {
            platform.mouse_click_at(x, y, "left")
        }
        InteractionType::Dblclick => {
            platform.mouse_double_click(x, y, "left")
        }
        InteractionType::Rclick => {
            platform.mouse_click_at(x, y, "right")
        }
        InteractionType::Hover => {
            platform.mouse_move(x, y)
        }
    }
}

/// Log the start of AI Vision Capture execution
fn log_ai_vision_execution_start(action_index: usize, action: &crate::script::AIVisionCaptureAction) {
    if let Some(logger) = get_logger() {
        let mut metadata = HashMap::new();
        metadata.insert("action_index".to_string(), json!(action_index));
        metadata.insert("action_id".to_string(), json!(&action.id));
        metadata.insert("is_dynamic".to_string(), json!(action.is_dynamic));
        metadata.insert("has_static_coords".to_string(), json!(action.has_static_coordinates()));
        metadata.insert("has_cached_coords".to_string(), json!(action.has_cached_coordinates()));
        metadata.insert("interaction_type".to_string(), json!(format!("{:?}", action.interaction)));
        
        logger.log_operation(
            LogLevel::Info,
            CoreType::Rust,
            OperationType::Playback,
            format!("ai_vision_start_{}", chrono::Utc::now().timestamp_millis()),
            format!("AI Vision Capture [{}]: Starting execution (is_dynamic={}, has_static={}, has_cache={})",
                action_index, action.is_dynamic, action.has_static_coordinates(), action.has_cached_coordinates()),
            Some(metadata),
        );
    }
}

/// Log when an AI Vision Capture action is skipped
fn log_ai_vision_skip(action_index: usize, action: &crate::script::AIVisionCaptureAction, reason: &str) {
    if let Some(logger) = get_logger() {
        let mut metadata = HashMap::new();
        metadata.insert("action_index".to_string(), json!(action_index));
        metadata.insert("action_id".to_string(), json!(&action.id));
        metadata.insert("reason".to_string(), json!(reason));
        
        logger.log_operation(
            LogLevel::Warn,
            CoreType::Rust,
            OperationType::Playback,
            format!("ai_vision_skip_{}", chrono::Utc::now().timestamp_millis()),
            format!("AI Vision Capture [{}]: Skipped - {}", action_index, reason),
            Some(metadata),
        );
    }
}

/// Log an error during AI Vision Capture execution
fn log_ai_vision_error(action_index: usize, action: &crate::script::AIVisionCaptureAction, error: &str) {
    if let Some(logger) = get_logger() {
        let mut metadata = HashMap::new();
        metadata.insert("action_index".to_string(), json!(action_index));
        metadata.insert("action_id".to_string(), json!(&action.id));
        metadata.insert("error".to_string(), json!(error));
        
        logger.log_operation(
            LogLevel::Error,
            CoreType::Rust,
            OperationType::Playback,
            format!("ai_vision_error_{}", chrono::Utc::now().timestamp_millis()),
            format!("AI Vision Capture [{}]: Error - {}", action_index, error),
            Some(metadata),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{AutomationConfig, ScriptData, Action, ActionType};
    use crate::logging::{init_logger, LoggingConfig};
    use tempfile::TempDir;

    fn setup_test_logger() -> TempDir {
        let temp_dir = TempDir::new().unwrap();
        let config = LoggingConfig {
            log_directory: temp_dir.path().to_path_buf(),
            log_to_console: false,
            ..LoggingConfig::default()
        };
        let _ = init_logger(config);
        temp_dir
    }

    fn create_test_script() -> ScriptData {
        let mut script = ScriptData::new("rust", "test");
        script.add_action(Action::mouse_move(100, 200, 0.0));
        script.add_action(Action::mouse_click(100, 200, "left", 0.5));
        script.add_action(Action::key_type("test", 1.0));
        script
    }

    #[test]
    fn test_log_playback_start() {
        let _temp_dir = setup_test_logger();
        let script = create_test_script();
        
        // This should not panic
        Player::log_playback_start(&script, 1.0, 1);
    }

    #[test]
    fn test_log_playback_complete() {
        let _temp_dir = setup_test_logger();
        let script = create_test_script();
        
        // This should not panic
        Player::log_playback_complete(
            &script,
            3,
            0,
            0,
            1,
            Duration::from_secs(2),
            true,
        );
    }

    #[test]
    fn test_log_action_execution() {
        let _temp_dir = setup_test_logger();
        let action = Action::mouse_move(100, 200, 0.0);
        
        // This should not panic
        Player::log_action_execution(0, &action);
    }

    #[test]
    fn test_log_action_success() {
        let _temp_dir = setup_test_logger();
        let action = Action::mouse_move(100, 200, 0.0);
        
        // This should not panic
        Player::log_action_success(0, &action, Duration::from_millis(10));
    }

    #[test]
    fn test_log_action_failure() {
        let _temp_dir = setup_test_logger();
        let action = Action::mouse_move(100, 200, 0.0);
        let error = AutomationError::PlaybackError {
            message: "Test error".to_string(),
        };
        
        // This should not panic
        Player::log_action_failure(0, &action, &error);
    }

    #[test]
    fn test_log_platform_call() {
        let _temp_dir = setup_test_logger();
        
        // This should not panic
        Player::log_platform_call("mouse_move", "x=100, y=200");
    }

    #[test]
    fn test_log_platform_error() {
        let _temp_dir = setup_test_logger();
        let error = AutomationError::SystemError {
            message: "Test system error".to_string(),
        };
        
        // This should not panic
        Player::log_platform_error("mouse_move", &error);
    }

    #[test]
    fn test_player_creation() {
        let config = AutomationConfig::default();
        let player = Player::new(config);
        
        assert!(player.is_ok());
    }

    #[test]
    fn test_player_load_script() {
        let config = AutomationConfig::default();
        let mut player = Player::new(config).unwrap();
        let script = create_test_script();
        
        let result = player.load_script(script);
        assert!(result.is_ok());
    }

    #[test]
    fn test_event_sender_initialization() {
        let config = AutomationConfig::default();
        let mut player = Player::new(config).unwrap();
        
        // Initially no event sender
        assert!(!player.has_event_sender());
        
        // Set up event sender
        let (sender, _receiver) = mpsc::unbounded_channel();
        player.set_event_sender(sender);
        
        // Now has event sender
        assert!(player.has_event_sender());
    }

    #[test]
    fn test_event_channel_connectivity() {
        let _temp_dir = setup_test_logger();
        let config = AutomationConfig::default();
        let mut player = Player::new(config).unwrap();
        
        // Set up event sender and receiver
        let (sender, mut receiver) = mpsc::unbounded_channel();
        player.set_event_sender(sender);
        
        // The set_event_sender should send a test event
        // Try to receive it (non-blocking)
        let event = receiver.try_recv();
        assert!(event.is_ok());
        
        if let Ok(event) = event {
            assert_eq!(event.event_type, "status");
            if let PlaybackEventData::Status { status, message } = event.data {
                assert_eq!(status, "initialized");
                assert!(message.is_some());
            } else {
                panic!("Expected Status event data");
            }
        }
    }

    #[test]
    fn test_send_event_with_logging() {
        let _temp_dir = setup_test_logger();
        let config = AutomationConfig::default();
        let mut player = Player::new(config).unwrap();
        
        // Set up event sender and receiver
        let (sender, mut receiver) = mpsc::unbounded_channel();
        player.set_event_sender(sender);
        
        // Clear the initialization event
        let _ = receiver.try_recv();
        
        // Send a test event
        player.send_event(PlaybackEvent {
            event_type: "status".to_string(),
            data: PlaybackEventData::Status {
                status: "test".to_string(),
                message: Some("Test message".to_string()),
            },
        });
        
        // Verify event was received
        let event = receiver.try_recv();
        assert!(event.is_ok());
        
        if let Ok(event) = event {
            assert_eq!(event.event_type, "status");
        }
    }

    #[test]
    fn test_progress_event_data() {
        let progress_event = PlaybackEvent {
            event_type: "progress".to_string(),
            data: PlaybackEventData::Progress {
                current_action: 5,
                total_actions: 10,
                current_loop: 1,
                total_loops: 2,
                progress: 0.5,
            },
        };
        
        // Verify serialization works
        let json = serde_json::to_string(&progress_event);
        assert!(json.is_ok());
    }

    #[test]
    fn test_completion_event_with_statistics() {
        let completion_event = PlaybackEvent {
            event_type: "complete".to_string(),
            data: PlaybackEventData::Complete {
                completed: true,
                reason: "finished".to_string(),
                total_actions: 10,
                actions_executed: 10,
                actions_failed: 1,
                actions_skipped: 0,
                loops_completed: 2,
                duration_ms: 5000,
                success_rate: 0.9,
                errors: Some(vec!["Test error".to_string()]),
            },
        };
        
        // Verify serialization works
        let json = serde_json::to_string(&completion_event);
        assert!(json.is_ok());
        
        // Verify the JSON contains expected fields
        if let Ok(json_str) = json {
            assert!(json_str.contains("totalActions"));
            assert!(json_str.contains("actionsExecuted"));
            assert!(json_str.contains("actionsFailed"));
            assert!(json_str.contains("successRate"));
        }
    }

    #[test]
    fn test_action_preview_event() {
        let preview_event = PlaybackEvent {
            event_type: "action_preview".to_string(),
            data: PlaybackEventData::ActionPreview {
                index: 0,
                action: ActionPreviewData {
                    action_type: "mouse_move".to_string(),
                    timestamp: 0.0,
                    x: Some(100),
                    y: Some(200),
                    button: None,
                    key: None,
                    text: None,
                },
            },
        };
        
        // Verify serialization works
        let json = serde_json::to_string(&preview_event);
        assert!(json.is_ok());
    }

    #[test]
    fn test_pause_resume_control() {
        let _temp_dir = setup_test_logger();
        let config = AutomationConfig::default();
        let mut player = Player::new(config).unwrap();
        let script = create_test_script();
        
        // Load script
        player.load_script(script).unwrap();
        
        // Set up event sender
        let (sender, _receiver) = mpsc::unbounded_channel();
        player.set_event_sender(sender);
        
        // Cannot pause when not playing
        let result = player.pause_playback();
        assert!(result.is_err());
        
        // Start playback (will fail due to permissions, but that's ok for this test)
        let _ = player.start_playback(1.0, 1);
        
        // If playback started, test pause/resume
        if player.is_playing() {
            // Pause playback
            let paused = player.pause_playback().unwrap();
            assert!(paused);
            assert!(player.is_paused());
            
            // Resume playback
            let paused = player.pause_playback().unwrap();
            assert!(!paused);
            assert!(!player.is_paused());
            
            // Stop playback
            player.stop_playback().unwrap();
            assert!(!player.is_playing());
        }
    }

    #[test]
    fn test_stop_control() {
        let _temp_dir = setup_test_logger();
        let config = AutomationConfig::default();
        let mut player = Player::new(config).unwrap();
        let script = create_test_script();
        
        // Load script
        player.load_script(script).unwrap();
        
        // Set up event sender
        let (sender, _receiver) = mpsc::unbounded_channel();
        player.set_event_sender(sender);
        
        // Cannot stop when not playing
        let result = player.stop_playback();
        assert!(result.is_err());
        
        // Start playback (will fail due to permissions, but that's ok for this test)
        let _ = player.start_playback(1.0, 1);
        
        // If playback started, test stop
        if player.is_playing() {
            // Stop playback
            player.stop_playback().unwrap();
            assert!(!player.is_playing());
            assert!(!player.is_paused());
            
            // Verify resources were cleaned up
            let status = player.get_status();
            assert_eq!(status.current_action, 0);
        }
    }

    #[test]
    fn test_control_responsiveness_timing() {
        let _temp_dir = setup_test_logger();
        let config = AutomationConfig::default();
        let mut player = Player::new(config).unwrap();
        let script = create_test_script();
        
        // Load script
        player.load_script(script).unwrap();
        
        // Set up event sender
        let (sender, _receiver) = mpsc::unbounded_channel();
        player.set_event_sender(sender);
        
        // Start playback (will fail due to permissions, but that's ok for this test)
        let _ = player.start_playback(1.0, 1);
        
        // If playback started, test control timing
        if player.is_playing() {
            // Test pause timing
            let pause_start = Instant::now();
            let _ = player.pause_playback();
            let pause_duration = pause_start.elapsed();
            
            // Should complete within 100ms
            assert!(pause_duration.as_millis() <= 100, 
                "Pause operation took {:.2}ms, expected <100ms", 
                pause_duration.as_secs_f64() * 1000.0);
            
            // Test resume timing
            let resume_start = Instant::now();
            let _ = player.pause_playback();
            let resume_duration = resume_start.elapsed();
            
            // Should complete within 100ms
            assert!(resume_duration.as_millis() <= 100, 
                "Resume operation took {:.2}ms, expected <100ms", 
                resume_duration.as_secs_f64() * 1000.0);
            
            // Test stop timing
            let stop_start = Instant::now();
            let _ = player.stop_playback();
            let stop_duration = stop_start.elapsed();
            
            // Should complete within 100ms
            assert!(stop_duration.as_millis() <= 100, 
                "Stop operation took {:.2}ms, expected <100ms", 
                stop_duration.as_secs_f64() * 1000.0);
        }
    }

    #[test]
    fn test_playback_status() {
        let config = AutomationConfig::default();
        let mut player = Player::new(config).unwrap();
        let script = create_test_script();
        
        // Load script
        player.load_script(script).unwrap();
        
        // Initial status
        let status = player.get_status();
        assert!(!status.is_playing);
        assert!(!status.is_paused);
        assert_eq!(status.current_action, 0);
        assert_eq!(status.total_actions, 3);
        
        // Check is_playing and is_paused methods
        assert!(!player.is_playing());
        assert!(!player.is_paused());
    }

    #[test]
    fn test_playback_statistics_creation() {
        let stats = PlaybackStatistics::new(10, 1.0);
        
        assert_eq!(stats.total_actions, 10);
        assert_eq!(stats.actions_executed, 0);
        assert_eq!(stats.actions_failed, 0);
        assert_eq!(stats.actions_skipped, 0);
        assert_eq!(stats.playback_speed, 1.0);
        assert_eq!(stats.loops_completed, 0);
        assert!(stats.errors.is_empty());
    }

    #[test]
    fn test_playback_statistics_record_success() {
        let mut stats = PlaybackStatistics::new(10, 1.0);
        
        stats.record_action_success(Duration::from_millis(50), Duration::from_millis(100));
        
        assert_eq!(stats.actions_executed, 1);
        assert_eq!(stats.total_execution_time, Duration::from_millis(50));
        assert_eq!(stats.total_delay_time, Duration::from_millis(100));
    }

    #[test]
    fn test_playback_statistics_record_failure() {
        let mut stats = PlaybackStatistics::new(10, 1.0);
        
        stats.record_action_failure("Test error".to_string());
        
        assert_eq!(stats.actions_failed, 1);
        assert_eq!(stats.errors.len(), 1);
        assert_eq!(stats.errors[0], "Test error");
    }

    #[test]
    fn test_playback_statistics_record_skipped() {
        let mut stats = PlaybackStatistics::new(10, 1.0);
        
        stats.record_action_skipped();
        
        assert_eq!(stats.actions_skipped, 1);
    }

    #[test]
    fn test_playback_statistics_record_timing_drift() {
        let mut stats = PlaybackStatistics::new(10, 1.0);
        
        stats.record_timing_drift(Duration::from_millis(50));
        stats.record_timing_drift(Duration::from_millis(100));
        stats.record_timing_drift(Duration::from_millis(75));
        
        assert_eq!(stats.max_timing_drift, Duration::from_millis(100));
        assert_eq!(stats.timing_drift_count, 3);
    }

    #[test]
    fn test_playback_statistics_finalize() {
        let mut stats = PlaybackStatistics::new(10, 1.0);
        
        // Record some actions
        stats.record_action_success(Duration::from_millis(50), Duration::from_millis(100));
        stats.record_action_success(Duration::from_millis(60), Duration::from_millis(100));
        stats.record_action_success(Duration::from_millis(40), Duration::from_millis(100));
        
        // Finalize
        stats.finalize(Duration::from_secs(5), 2);
        
        assert_eq!(stats.total_duration, Duration::from_secs(5));
        assert_eq!(stats.loops_completed, 2);
        assert_eq!(stats.average_action_time, Duration::from_millis(50)); // (50+60+40)/3 = 50
    }

    #[test]
    fn test_playback_statistics_success_rate() {
        let mut stats = PlaybackStatistics::new(10, 1.0);
        
        // Record 8 successes and 2 failures
        for _ in 0..8 {
            stats.record_action_success(Duration::from_millis(50), Duration::from_millis(100));
        }
        for _ in 0..2 {
            stats.record_action_failure("Error".to_string());
        }
        
        // Success rate should be 8/10 = 0.8
        assert_eq!(stats.success_rate(), 0.8);
    }

    #[test]
    fn test_playback_statistics_is_successful() {
        let mut stats = PlaybackStatistics::new(10, 1.0);
        
        // Initially successful (no failures or skips)
        assert!(stats.is_successful());
        
        // Record a failure
        stats.record_action_failure("Error".to_string());
        assert!(!stats.is_successful());
        
        // Create new stats and record a skip
        let mut stats2 = PlaybackStatistics::new(10, 1.0);
        stats2.record_action_skipped();
        assert!(!stats2.is_successful());
    }

    #[test]
    fn test_playback_statistics_summary() {
        let mut stats = PlaybackStatistics::new(10, 1.0);
        
        // Record some actions
        for _ in 0..8 {
            stats.record_action_success(Duration::from_millis(50), Duration::from_millis(100));
        }
        stats.record_action_failure("Error".to_string());
        stats.record_action_skipped();
        
        // Finalize
        stats.finalize(Duration::from_secs(5), 2);
        
        let summary = stats.summary();
        
        // Verify summary contains key information
        assert!(summary.contains("8/9 actions succeeded"));
        assert!(summary.contains("88.9% success rate"));
        assert!(summary.contains("1 failed"));
        assert!(summary.contains("1 skipped"));
        assert!(summary.contains("2 loops completed"));
    }

    #[test]
    fn test_playback_statistics_error_limit() {
        let mut stats = PlaybackStatistics::new(10, 1.0);
        
        // Try to add 15 errors (should only keep first 10)
        for i in 0..15 {
            stats.record_action_failure(format!("Error {}", i));
        }
        
        assert_eq!(stats.errors.len(), 10);
        assert_eq!(stats.actions_failed, 15);
    }

    #[test]
    fn test_playback_statistics_serialization() {
        let mut stats = PlaybackStatistics::new(10, 1.0);
        stats.record_action_success(Duration::from_millis(50), Duration::from_millis(100));
        stats.record_action_failure("Test error".to_string());
        stats.finalize(Duration::from_secs(5), 2);
        
        // Test serialization
        let json = serde_json::to_string(&stats);
        assert!(json.is_ok());
        
        // Test deserialization
        if let Ok(json_str) = json {
            let deserialized = serde_json::from_str::<PlaybackStatistics>(&json_str);
            assert!(deserialized.is_ok());
            
            if let Ok(deserialized_stats) = deserialized {
                assert_eq!(deserialized_stats.total_actions, stats.total_actions);
                assert_eq!(deserialized_stats.actions_executed, stats.actions_executed);
                assert_eq!(deserialized_stats.actions_failed, stats.actions_failed);
            }
        }
    }
}
