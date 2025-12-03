//! Recording functionality for capturing user interactions

use crate::{
    Result, AutomationError, AutomationConfig, ScriptData, Action, ActionType,
    platform::{PlatformAutomation, create_platform_automation},
    logging::{CoreType, OperationType, LogLevel, get_logger}
};
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::mpsc;
use serde::{Serialize, Deserialize};
use std::thread;
use std::collections::HashMap;

/// Event recorder that captures user interactions
pub struct Recorder {
    platform: Box<dyn PlatformAutomation>,
    config: AutomationConfig,
    is_recording: Arc<AtomicBool>,
    start_time: Option<Instant>,
    recorded_actions: Arc<Mutex<Vec<Action>>>,
    event_sender: Option<mpsc::UnboundedSender<RecordingEvent>>,
    screenshot_counter: Arc<Mutex<u32>>,
}

/// Events that can be recorded
#[derive(Debug, Clone)]
pub enum RecordedEvent {
    MouseMove { x: i32, y: i32 },
    MouseClick { x: i32, y: i32, button: String },
    MouseDoubleClick { x: i32, y: i32, button: String },
    MouseDrag { from_x: i32, from_y: i32, to_x: i32, to_y: i32, button: String },
    MouseScroll { x: i32, y: i32, delta_x: i32, delta_y: i32 },
    KeyPress { key: String, modifiers: Vec<String> },
    KeyRelease { key: String },
    KeyType { text: String },
}

/// Events sent to UI for real-time feedback
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub data: RecordingEventData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum RecordingEventData {
    Progress {
        #[serde(rename = "actionCount")]
        action_count: usize,
        duration: f64,
    },
    ActionRecorded {
        action: ActionEventData,
    },
    Status {
        status: String,
        message: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionEventData {
    #[serde(rename = "type")]
    pub action_type: String,
    pub timestamp: f64,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub button: Option<String>,
    pub key: Option<String>,
    pub text: Option<String>,
}

impl Recorder {
    /// Create a new recorder instance
    pub fn new(config: AutomationConfig) -> Result<Self> {
        let platform = create_platform_automation()?;
        
        Ok(Self {
            platform,
            config,
            is_recording: Arc::new(AtomicBool::new(false)),
            start_time: None,
            recorded_actions: Arc::new(Mutex::new(Vec::new())),
            event_sender: None,
            screenshot_counter: Arc::new(Mutex::new(0)),
        })
    }

    /// Set event sender for real-time UI updates
    pub fn set_event_sender(&mut self, sender: mpsc::UnboundedSender<RecordingEvent>) {
        self.event_sender = Some(sender);
    }

    /// Start recording user interactions
    pub fn start_recording(&mut self) -> Result<()> {
        let operation_id = format!("start_recording_{}", chrono::Utc::now().timestamp());
        
        // Log operation start
        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Recording,
                operation_id.clone(),
                "Starting recording session".to_string(),
                None,
            );
        }

        // Check permissions first
        if !self.platform.check_permissions()? {
            if let Some(logger) = get_logger() {
                logger.log_operation(
                    LogLevel::Warn,
                    CoreType::Rust,
                    OperationType::Recording,
                    operation_id.clone(),
                    "Requesting system permissions for recording".to_string(),
                    None,
                );
            }
            
            if !self.platform.request_permissions()? {
                if let Some(logger) = get_logger() {
                    logger.log_operation(
                        LogLevel::Error,
                        CoreType::Rust,
                        OperationType::Recording,
                        operation_id,
                        "Permission denied for recording operations".to_string(),
                        None,
                    );
                }
                return Err(AutomationError::PermissionDenied {
                    operation: "Recording requires system permissions".to_string(),
                });
            }
        }

        if self.is_recording.load(Ordering::Relaxed) {
            if let Some(logger) = get_logger() {
                logger.log_operation(
                    LogLevel::Error,
                    CoreType::Rust,
                    OperationType::Recording,
                    operation_id,
                    "Attempted to start recording while already in progress".to_string(),
                    None,
                );
            }
            return Err(AutomationError::RecordingError {
                message: "Recording is already in progress".to_string(),
            });
        }

        // Initialize recording state
        self.is_recording.store(true, Ordering::Relaxed);
        self.start_time = Some(Instant::now());
        {
            let mut actions = self.recorded_actions.lock().unwrap();
            actions.clear();
        }
        {
            let mut counter = self.screenshot_counter.lock().unwrap();
            *counter = 0;
        }

        // Send status event to UI
        self.send_event(RecordingEvent {
            event_type: "status".to_string(),
            data: RecordingEventData::Status {
                status: "recording".to_string(),
                message: Some("Recording started".to_string()),
            },
        });

        // Start platform-specific event capture
        self.start_platform_capture()?;

        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Recording,
                operation_id,
                "Recording session started successfully".to_string(),
                Some({
                    let mut metadata = HashMap::new();
                    metadata.insert("platform".to_string(), serde_json::json!(self.platform.platform_name()));
                    metadata.insert("capture_screenshots".to_string(), serde_json::json!(self.config.capture_screenshots));
                    metadata
                }),
            );
        }

        Ok(())
    }

    /// Stop recording and return the recorded script
    pub fn stop_recording(&mut self) -> Result<ScriptData> {
        let operation_id = format!("stop_recording_{}", chrono::Utc::now().timestamp());
        
        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Recording,
                operation_id.clone(),
                "Stopping recording session".to_string(),
                None,
            );
        }

        if !self.is_recording.load(Ordering::Relaxed) {
            if let Some(logger) = get_logger() {
                logger.log_operation(
                    LogLevel::Error,
                    CoreType::Rust,
                    OperationType::Recording,
                    operation_id,
                    "Attempted to stop recording when no recording in progress".to_string(),
                    None,
                );
            }
            return Err(AutomationError::RecordingError {
                message: "No recording in progress".to_string(),
            });
        }

        self.is_recording.store(false, Ordering::Relaxed);
        
        let duration = self.start_time
            .map(|start| start.elapsed().as_secs_f64())
            .unwrap_or(0.0);

        let mut script = ScriptData::new("rust", self.platform.platform_name());
        script.metadata.duration = duration;
        script.metadata.screen_resolution = self.platform.get_screen_size().ok();
        
        // Add timestamp for when recording was created
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        script.metadata.additional_data.insert(
            "recording_timestamp".to_string(),
            serde_json::Value::Number(serde_json::Number::from(now)),
        );
        
        // Add all recorded actions
        let action_count = {
            let actions = self.recorded_actions.lock().unwrap();
            for action in actions.iter() {
                script.add_action(action.clone());
            }
            actions.len()
        };

        // Send final status event to UI
        self.send_event(RecordingEvent {
            event_type: "status".to_string(),
            data: RecordingEventData::Status {
                status: "stopped".to_string(),
                message: Some(format!("Recording completed: {} actions in {:.2}s", 
                    script.action_count(), duration)),
            },
        });

        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Recording,
                operation_id,
                format!("Recording session completed successfully: {} actions in {:.2}s", action_count, duration),
                Some({
                    let mut metadata = HashMap::new();
                    metadata.insert("action_count".to_string(), serde_json::json!(action_count));
                    metadata.insert("duration_seconds".to_string(), serde_json::json!(duration));
                    metadata.insert("platform".to_string(), serde_json::json!(self.platform.platform_name()));
                    if let Some(resolution) = &script.metadata.screen_resolution {
                        metadata.insert("screen_resolution".to_string(), serde_json::json!(resolution));
                    }
                    metadata
                }),
            );
        }

        Ok(script)
    }

    /// Check if currently recording
    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::Relaxed)
    }

    /// Record a mouse move event
    pub fn record_mouse_move(&self, x: i32, y: i32) -> Result<()> {
        if !self.is_recording() {
            return Ok(());
        }

        let timestamp = self.get_timestamp();
        let action = Action::mouse_move(x, y, timestamp);
        
        // Add to recorded actions
        {
            let mut actions = self.recorded_actions.lock().unwrap();
            actions.push(action.clone());
        }

        // Send real-time event to UI
        self.send_action_event(&action);
        
        Ok(())
    }

    /// Record a mouse click event
    pub fn record_mouse_click(&self, x: i32, y: i32, button: &str) -> Result<()> {
        if !self.is_recording() {
            return Ok(());
        }

        let timestamp = self.get_timestamp();
        let mut action = Action::mouse_click(x, y, button, timestamp);
        
        // Capture screenshot if enabled
        if self.config.capture_screenshots {
            if let Ok(_screenshot_data) = self.platform.take_screenshot() {
                let mut counter = self.screenshot_counter.lock().unwrap();
                *counter += 1;
                let filename = format!("screenshot_{:04}.png", *counter);
                
                // Store screenshot reference in action
                if let Some(ref mut additional_data) = action.additional_data {
                    additional_data.insert("screenshot".to_string(), 
                        serde_json::Value::String(filename));
                } else {
                    let mut data = HashMap::new();
                    data.insert("screenshot".to_string(), 
                        serde_json::Value::String(filename));
                    action.additional_data = Some(data);
                }
            }
        }
        
        // Add to recorded actions
        {
            let mut actions = self.recorded_actions.lock().unwrap();
            actions.push(action.clone());
        }

        // Send real-time event to UI
        self.send_action_event(&action);
        
        Ok(())
    }

    /// Record a key press event
    pub fn record_key_press(&self, key: &str, modifiers: Option<Vec<String>>) -> Result<()> {
        if !self.is_recording() {
            return Ok(());
        }

        let timestamp = self.get_timestamp();
        let action = Action::key_press(key, timestamp, modifiers);
        
        // Add to recorded actions
        {
            let mut actions = self.recorded_actions.lock().unwrap();
            actions.push(action.clone());
        }

        // Send real-time event to UI
        self.send_action_event(&action);
        
        Ok(())
    }

    /// Record a text typing event
    pub fn record_key_type(&self, text: &str) -> Result<()> {
        if !self.is_recording() {
            return Ok(());
        }

        let timestamp = self.get_timestamp();
        let action = Action::key_type(text, timestamp);
        
        // Add to recorded actions
        {
            let mut actions = self.recorded_actions.lock().unwrap();
            actions.push(action.clone());
        }

        // Send real-time event to UI
        self.send_action_event(&action);
        
        Ok(())
    }

    /// Get current timestamp relative to recording start
    fn get_timestamp(&self) -> f64 {
        self.start_time
            .map(|start| start.elapsed().as_secs_f64())
            .unwrap_or(0.0)
    }

    /// Start platform-specific event capture
    fn start_platform_capture(&self) -> Result<()> {
        // This would be implemented by spawning platform-specific event listeners
        // For now, we'll implement a basic polling mechanism
        // In a real implementation, this would use platform-specific event hooks
        
        let is_recording = Arc::clone(&self.is_recording);
        let _recorded_actions = Arc::clone(&self.recorded_actions);
        let _start_time = self.start_time;
        
        // Spawn background thread for event capture
        thread::spawn(move || {
            let _last_mouse_pos = (0, 0);
            
            while is_recording.load(Ordering::Relaxed) {
                // This is a simplified implementation
                // Real implementation would use platform-specific event hooks
                thread::sleep(std::time::Duration::from_millis(10));
                
                // In a real implementation, platform-specific code would:
                // 1. Hook into system mouse/keyboard events
                // 2. Call the appropriate record_* methods
                // 3. Handle ESC key for stopping recording
            }
        });
        
        Ok(())
    }

    /// Send event to UI for real-time feedback
    fn send_event(&self, event: RecordingEvent) {
        if let Some(ref sender) = self.event_sender {
            let _ = sender.send(event);
        }
    }

    /// Send action event to UI
    fn send_action_event(&self, action: &Action) {
        let action_data = ActionEventData {
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
            },
            timestamp: action.timestamp,
            x: action.x,
            y: action.y,
            button: action.button.clone(),
            key: action.key.clone(),
            text: action.text.clone(),
        };

        self.send_event(RecordingEvent {
            event_type: "action_recorded".to_string(),
            data: RecordingEventData::ActionRecorded {
                action: action_data,
            },
        });

        // Also send progress update
        let action_count = {
            let actions = self.recorded_actions.lock().unwrap();
            actions.len()
        };
        
        self.send_event(RecordingEvent {
            event_type: "progress".to_string(),
            data: RecordingEventData::Progress {
                action_count,
                duration: self.get_timestamp(),
            },
        });
    }
}

/// Background recorder that captures system events
pub struct BackgroundRecorder {
    recorder: Arc<Mutex<Recorder>>,
    event_sender: mpsc::UnboundedSender<RecordedEvent>,
    event_receiver: Option<mpsc::UnboundedReceiver<RecordedEvent>>,
}

impl BackgroundRecorder {
    /// Create a new background recorder
    pub fn new(config: AutomationConfig) -> Result<Self> {
        let recorder = Arc::new(Mutex::new(Recorder::new(config)?));
        let (event_sender, event_receiver) = mpsc::unbounded_channel();

        Ok(Self {
            recorder,
            event_sender,
            event_receiver: Some(event_receiver),
        })
    }

    /// Set event sender for real-time UI updates
    pub fn set_event_sender(&mut self, sender: mpsc::UnboundedSender<RecordingEvent>) {
        let mut recorder = self.recorder.lock().unwrap();
        recorder.set_event_sender(sender);
    }

    /// Start background recording
    pub async fn start_recording(&mut self) -> Result<()> {
        {
            let mut recorder = self.recorder.lock().unwrap();
            recorder.start_recording()?;
        }

        // Start event processing loop
        if let Some(mut receiver) = self.event_receiver.take() {
            let recorder = Arc::clone(&self.recorder);
            
            tokio::spawn(async move {
                while let Some(event) = receiver.recv().await {
                    let recorder = recorder.lock().unwrap();
                    
                    match event {
                        RecordedEvent::MouseMove { x, y } => {
                            let _ = recorder.record_mouse_move(x, y);
                        }
                        RecordedEvent::MouseClick { x, y, button } => {
                            let _ = recorder.record_mouse_click(x, y, &button);
                        }
                        RecordedEvent::KeyPress { key, modifiers } => {
                            let _ = recorder.record_key_press(&key, Some(modifiers));
                        }
                        RecordedEvent::KeyType { text } => {
                            let _ = recorder.record_key_type(&text);
                        }
                        _ => {
                            // Handle other event types as needed
                        }
                    }
                }
            });
        }

        Ok(())
    }

    /// Stop recording and return the script
    pub fn stop_recording(&mut self) -> Result<ScriptData> {
        let mut recorder = self.recorder.lock().unwrap();
        recorder.stop_recording()
    }

    /// Check if recording is active
    pub fn is_recording(&self) -> bool {
        let recorder = self.recorder.lock().unwrap();
        recorder.is_recording()
    }

    /// Get event sender for external event sources
    pub fn get_event_sender(&self) -> mpsc::UnboundedSender<RecordedEvent> {
        self.event_sender.clone()
    }
}
