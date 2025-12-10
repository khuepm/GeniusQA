//! Recording functionality for capturing user interactions

use crate::{
    Result, AutomationError, AutomationConfig, ScriptData, Action, ActionType,
    AIVisionCaptureAction,
    platform::{PlatformAutomation, create_platform_automation},
    logging::{CoreType, OperationType, LogLevel, get_logger}
};
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::mpsc;
use serde::{Serialize, Deserialize};
use std::thread;
use std::collections::HashMap;
use uuid::Uuid;
#[cfg(target_os = "macos")]
use core_graphics::event::{
    CGEvent, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement, CGEventType, CGEventMask,
    EventField, CGEventTapProxy,
};
#[cfg(target_os = "macos")]
use core_foundation::runloop::{kCFRunLoopDefaultMode, CFRunLoop, CFRunLoopRunInMode};

/// Modifier key state tracking for hotkey detection
#[derive(Debug, Clone, Default)]
pub struct ModifierState {
    /// Cmd key held (macOS) or Ctrl key held (Windows/Linux)
    pub cmd_or_ctrl_held: bool,
    /// Shift key held
    pub shift_held: bool,
    /// Alt/Option key held
    pub alt_held: bool,
}

/// Event recorder that captures user interactions
pub struct Recorder {
    platform: Box<dyn PlatformAutomation>,
    config: AutomationConfig,
    is_recording: Arc<AtomicBool>,
    start_time: Option<Instant>,
    recorded_actions: Arc<Mutex<Vec<Action>>>,
    event_sender: Option<mpsc::UnboundedSender<RecordingEvent>>,
    screenshot_counter: Arc<Mutex<u32>>,
    /// Modifier key state for hotkey detection
    modifier_state: Arc<Mutex<ModifierState>>,
    /// List of AI Vision Capture actions recorded
    vision_actions: Arc<Mutex<Vec<AIVisionCaptureAction>>>,
    /// Counter for vision capture screenshots
    vision_screenshot_counter: Arc<Mutex<u32>>,
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
            modifier_state: Arc::new(Mutex::new(ModifierState::default())),
            vision_actions: Arc::new(Mutex::new(Vec::new())),
            vision_screenshot_counter: Arc::new(Mutex::new(0)),
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

        if self.is_recording.load(Ordering::SeqCst) {
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
        self.is_recording.store(true, Ordering::SeqCst);
        self.start_time = Some(Instant::now());
        {
            let mut actions = self.recorded_actions.lock().unwrap();
            actions.clear();
        }
        {
            let mut counter = self.screenshot_counter.lock().unwrap();
            *counter = 0;
        }
        {
            let mut modifier_state = self.modifier_state.lock().unwrap();
            *modifier_state = ModifierState::default();
        }
        {
            let mut vision_actions = self.vision_actions.lock().unwrap();
            vision_actions.clear();
        }
        {
            let mut vision_counter = self.vision_screenshot_counter.lock().unwrap();
            *vision_counter = 0;
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

    #[cfg(target_os = "macos")]
    fn macos_keycode_map() -> HashMap<u16, &'static str> {
        let mut map = HashMap::new();
        // Common letters
        map.insert(0x00, "a");
        map.insert(0x01, "s");
        map.insert(0x02, "d");
        map.insert(0x03, "f");
        map.insert(0x04, "h");
        map.insert(0x05, "g");
        map.insert(0x06, "z");
        map.insert(0x07, "x");
        map.insert(0x08, "c");
        map.insert(0x09, "v");
        map.insert(0x0B, "b");
        map.insert(0x0C, "q");
        map.insert(0x0D, "w");
        map.insert(0x0E, "e");
        map.insert(0x0F, "r");
        map.insert(0x10, "y");
        map.insert(0x11, "t");
        map.insert(0x12, "1");
        map.insert(0x13, "2");
        map.insert(0x14, "3");
        map.insert(0x15, "4");
        map.insert(0x16, "6");
        map.insert(0x17, "5");
        map.insert(0x19, "9");
        map.insert(0x1A, "7");
        map.insert(0x1B, "minus");
        map.insert(0x1C, "8");
        map.insert(0x1D, "0");
        map.insert(0x1E, "equal");
        map.insert(0x1F, "o");
        map.insert(0x20, "u");
        map.insert(0x21, "bracket_left");
        map.insert(0x22, "i");
        map.insert(0x23, "p");
        map.insert(0x24, "enter");
        map.insert(0x25, "l");
        map.insert(0x26, "j");
        map.insert(0x27, "quote");
        map.insert(0x28, "k");
        map.insert(0x29, "semicolon");
        map.insert(0x2A, "backslash");
        map.insert(0x2B, "comma");
        map.insert(0x2C, "slash");
        map.insert(0x2D, "n");
        map.insert(0x2E, "m");
        map.insert(0x2F, "period");
        // Special keys
        map.insert(0x30, "tab");
        map.insert(0x31, "space");
        map.insert(0x32, "grave");
        map.insert(0x33, "backspace");
        map.insert(0x35, "escape");
        map.insert(0x37, "cmd");
        map.insert(0x38, "shift");
        map.insert(0x39, "capslock");
        map.insert(0x3A, "option");
        map.insert(0x3B, "ctrl");
        map.insert(0x3C, "rightshift");
        map.insert(0x3D, "rightoption");
        map.insert(0x3E, "rightctrl");
        // Arrow keys
        map.insert(0x7B, "left");
        map.insert(0x7C, "right");
        map.insert(0x7D, "down");
        map.insert(0x7E, "up");
        // Function keys
        map.insert(0x7A, "f1");
        map.insert(0x78, "f2");
        map.insert(0x63, "f3");
        map.insert(0x76, "f4");
        map.insert(0x60, "f5");
        map.insert(0x61, "f6");
        map.insert(0x62, "f7");
        map.insert(0x64, "f8");
        map.insert(0x65, "f9");
        map.insert(0x6D, "f10");
        map.insert(0x67, "f11");
        map.insert(0x6F, "f12");
        map
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

        if !self.is_recording.load(Ordering::SeqCst) {
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

        self.is_recording.store(false, Ordering::SeqCst);
        
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
        self.is_recording.load(Ordering::SeqCst)
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
        let is_recording = Arc::clone(&self.is_recording);
        let recorded_actions = Arc::clone(&self.recorded_actions);
        let start_time = self.start_time;

        // macOS: use Core Graphics event tap (safe) to capture keyboard & mouse without rdev crashes
        #[cfg(target_os = "macos")]
        {
            self.start_macos_event_tap_capture(is_recording, recorded_actions, start_time)?;
        }

        // Other platforms: use rdev listener
        #[cfg(not(target_os = "macos"))]
        {
            // Use a channel to communicate events from rdev callback to processing thread
            // Use bounded channel to prevent memory buildup
            let (tx, rx) = std::sync::mpsc::sync_channel::<(rdev::EventType, f64)>(1000);

            // Spawn thread to run rdev::listen (blocking)
            let is_recording_listener = Arc::clone(&self.is_recording);
            thread::spawn(move || {
                let tx = tx;
                let start = start_time;
                let is_rec = is_recording_listener;

                // Use catch_unwind to prevent panics from crashing the app
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    let callback = move |event: rdev::Event| {
                        // Check if still recording - exit early
                        if !is_rec.load(Ordering::SeqCst) {
                            return;
                        }

                        let timestamp = start
                            .map(|s| s.elapsed().as_secs_f64())
                            .unwrap_or(0.0);

                        // Send event through channel (non-blocking with try_send)
                        let _ = tx.try_send((event.event_type, timestamp));
                    };

                    // This blocks until error - we can't stop it gracefully
                    let _ = rdev::listen(callback);
                }));

                if let Err(e) = result {
                    eprintln!("Event listener thread panicked: {:?}", e);
                }
            });

            // Spawn thread to process events from channel
            thread::spawn(move || {
                let mut last_mouse_pos: Option<(i32, i32)> = None;
                let mouse_move_threshold = 10; // Minimum pixels to record a move
                let max_actions = 50000; // Limit to prevent memory issues
                let mut last_move_time = 0.0f64;
                let min_move_interval = 0.05; // Minimum 50ms between mouse moves

                while is_recording.load(Ordering::SeqCst) {
                    // Use recv_timeout to allow checking is_recording periodically
                    match rx.recv_timeout(std::time::Duration::from_millis(100)) {
                        Ok((event_type, timestamp)) => {
                            // Handle ESC key - stop recording immediately
                            if let rdev::EventType::KeyPress(rdev::Key::Escape) = event_type {
                                // Set flag to stop recording
                                is_recording.store(false, Ordering::SeqCst);
                                break;
                            }

                            // Check action limit
                            let action_count = {
                                if let Ok(actions) = recorded_actions.try_lock() {
                                    actions.len()
                                } else {
                                    continue; // Skip if can't get lock
                                }
                            };

                            if action_count >= max_actions {
                                continue; // Skip if too many actions
                            }

                            match event_type {
                                rdev::EventType::MouseMove { x, y } => {
                                    let current_pos = (x as i32, y as i32);

                                    // Throttle mouse moves
                                    if timestamp - last_move_time < min_move_interval {
                                        last_mouse_pos = Some(current_pos);
                                        continue;
                                    }

                                    // Only record if moved significantly
                                    let should_record = if let Some(last_pos) = last_mouse_pos {
                                        let dx = (current_pos.0 - last_pos.0).abs();
                                        let dy = (current_pos.1 - last_pos.1).abs();
                                        dx >= mouse_move_threshold || dy >= mouse_move_threshold
                                    } else {
                                        true
                                    };

                                    if should_record {
                                        if let Ok(mut actions) = recorded_actions.try_lock() {
                                            let action = Action::mouse_move(current_pos.0, current_pos.1, timestamp);
                                            actions.push(action);
                                            last_mouse_pos = Some(current_pos);
                                            last_move_time = timestamp;
                                        }
                                    } else {
                                        last_mouse_pos = Some(current_pos);
                                    }
                                }
                                rdev::EventType::ButtonPress(button) => {
                                    // Get current mouse position for click
                                    let pos = last_mouse_pos.unwrap_or((0, 0));
                                    let button_str = match button {
                                        rdev::Button::Left => "left",
                                        rdev::Button::Right => "right",
                                        rdev::Button::Middle => "middle",
                                        _ => "unknown",
                                    };
                                    if let Ok(mut actions) = recorded_actions.try_lock() {
                                        let action = Action::mouse_click(pos.0, pos.1, button_str, timestamp);
                                        actions.push(action);
                                    }
                                }
                                rdev::EventType::KeyPress(key) => {
                                    // Skip ESC key from being recorded
                                    if matches!(key, rdev::Key::Escape) {
                                        continue;
                                    }
                                    let key_str = format!("{:?}", key);
                                    if let Ok(mut actions) = recorded_actions.try_lock() {
                                        let action = Action::key_press(&key_str, timestamp, None);
                                        actions.push(action);
                                    }
                                }
                                _ => {}
                            }
                        }
                        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                            // Continue checking is_recording
                            continue;
                        }
                        Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                            // Channel closed, exit
                            break;
                        }
                    }
                }
            });
        }

        Ok(())
    }

    // ---------------------------------------------------------------------
    // macOS event tap capture (keyboard + mouse) to avoid rdev crashes
    // ---------------------------------------------------------------------
    #[cfg(target_os = "macos")]
    fn start_macos_event_tap_capture(
        &self,
        is_recording: Arc<AtomicBool>,
        recorded_actions: Arc<Mutex<Vec<Action>>>,
        start_time: Option<Instant>,
    ) -> Result<()> {
        // Avoid expensive map allocation on every event: build once
        let keycode_to_name = Self::macos_keycode_map();

        thread::spawn(move || {
            let max_actions = 50000usize;
            let mouse_move_threshold = 10;
            let min_move_interval = 0.05f64;
            // Use RefCell for interior mutability since CGEventTap expects Fn, not FnMut
            use std::cell::RefCell;
            let last_mouse_pos: RefCell<Option<(i32, i32)>> = RefCell::new(None);
            let last_move_time: RefCell<f64> = RefCell::new(0.0f64);

            // Event tap callback (Fn with interior mutability)
            let is_rec_flag = Arc::clone(&is_recording);
            let is_rec_flag_loop = Arc::clone(&is_recording);  // Clone for the while loop
            let actions_ref = Arc::clone(&recorded_actions);
            let start_ref = start_time;
            let callback_state = move |_: CGEventTapProxy, event_type: CGEventType, event: CGEvent| -> Option<CGEvent> {
                if !is_rec_flag.load(Ordering::SeqCst) {
                    return None;
                }

                let timestamp = start_ref.map(|s| s.elapsed().as_secs_f64()).unwrap_or(0.0);

                // Action limit guard
                let action_count = {
                    if let Ok(actions) = actions_ref.try_lock() {
                        actions.len()
                    } else {
                        return Some(event);
                    }
                };
                if action_count >= max_actions {
                    return Some(event);
                }

                match event_type {
                    CGEventType::KeyDown => {
                        let keycode = event.get_integer_value_field(EventField::KEYBOARD_EVENT_KEYCODE) as u16;
                        if let Some(key_name) = keycode_to_name.get(&keycode) {
                            // Stop on ESC
                            if *key_name == "escape" {
                                is_rec_flag.store(false, Ordering::SeqCst);
                                return None;
                            }
                            if let Ok(mut actions) = actions_ref.try_lock() {
                                let action = Action::key_press(key_name, timestamp, None);
                                actions.push(action);
                            }
                        }
                    }
                    CGEventType::MouseMoved
                    | CGEventType::LeftMouseDragged
                    | CGEventType::RightMouseDragged
                    | CGEventType::OtherMouseDragged => {
                        let location = event.location();
                        let current_pos = (location.x as i32, location.y as i32);

                        let last_time = *last_move_time.borrow();
                        if timestamp - last_time < min_move_interval {
                            *last_mouse_pos.borrow_mut() = Some(current_pos);
                            return Some(event);
                        }

                        let should_record = if let Some(last_pos) = *last_mouse_pos.borrow() {
                            let dx = (current_pos.0 - last_pos.0).abs();
                            let dy = (current_pos.1 - last_pos.1).abs();
                            dx >= mouse_move_threshold || dy >= mouse_move_threshold
                        } else {
                            true
                        };

                        if should_record {
                            if let Ok(mut actions) = actions_ref.try_lock() {
                                let action = Action::mouse_move(current_pos.0, current_pos.1, timestamp);
                                actions.push(action);
                                *last_mouse_pos.borrow_mut() = Some(current_pos);
                                *last_move_time.borrow_mut() = timestamp;
                            }
                        } else {
                            *last_mouse_pos.borrow_mut() = Some(current_pos);
                        }
                    }
                    CGEventType::LeftMouseDown | CGEventType::RightMouseDown | CGEventType::OtherMouseDown => {
                        let location = event.location();
                        let button_str = match event_type {
                            CGEventType::LeftMouseDown => "left",
                            CGEventType::RightMouseDown => "right",
                            _ => "middle",
                        };
                        if let Ok(mut actions) = actions_ref.try_lock() {
                            let action = Action::mouse_click(location.x as i32, location.y as i32, button_str, timestamp);
                            actions.push(action);
                        }
                    }
                    _ => {}
                }

                Some(event)
            };

            // Event types to listen for: key down + mouse move/drag + mouse down
            let event_types = vec![
                CGEventType::KeyDown,
                CGEventType::MouseMoved,
                CGEventType::LeftMouseDragged,
                CGEventType::RightMouseDragged,
                CGEventType::OtherMouseDragged,
                CGEventType::LeftMouseDown,
                CGEventType::RightMouseDown,
                CGEventType::OtherMouseDown,
            ];

            let tap = match core_graphics::event::CGEventTap::new(
                CGEventTapLocation::HID,
                CGEventTapPlacement::HeadInsertEventTap,
                CGEventTapOptions::ListenOnly,
                event_types,
                move |proxy, etype, event: &CGEvent| callback_state(proxy, etype, event.clone()),
            ) {
                Ok(t) => t,
                Err(_) => {
                    eprintln!("Failed to create CGEventTap for macOS recording");
                    is_rec_flag_loop.store(false, Ordering::SeqCst);
                    return;
                }
            };

            let run_loop_source = tap.mach_port.create_runloop_source(0).unwrap();
            let run_loop = CFRunLoop::get_current();
            unsafe {
                run_loop.add_source(&run_loop_source, kCFRunLoopDefaultMode);
            }
            tap.enable();

            // Run loop with periodic check to stop
            while is_rec_flag_loop.load(Ordering::SeqCst) {
                unsafe {
                    CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.1, 1);
                }
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
                ActionType::AiVisionCapture => "ai_vision_capture".to_string(),
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

    // =========================================================================
    // AI Vision Capture Hotkey Detection and Recording
    // =========================================================================

    /// Check if the given key event is the vision capture hotkey
    /// Hotkey: Cmd+F6 (macOS) or Ctrl+F6 (Windows/Linux)
    /// Requirements: 1.1, 1.3
    pub fn is_vision_capture_hotkey(&self, key: &rdev::Key, is_press: bool) -> bool {
        // Update modifier state
        self.update_modifier_state(key, is_press);

        // Only trigger on key press, not release
        if !is_press {
            return false;
        }

        // Check if F6 is pressed
        let is_f6 = matches!(key, rdev::Key::F6);
        if !is_f6 {
            return false;
        }

        // Check if Cmd (macOS) or Ctrl (Windows/Linux) is held
        let modifier_state = self.modifier_state.lock().unwrap();
        modifier_state.cmd_or_ctrl_held
    }

    /// Update the modifier key state based on key events
    /// Tracks Cmd/Ctrl, Shift, and Alt/Option keys
    fn update_modifier_state(&self, key: &rdev::Key, is_press: bool) {
        let mut state = self.modifier_state.lock().unwrap();
        
        match key {
            // macOS: Meta/Command key
            rdev::Key::MetaLeft | rdev::Key::MetaRight => {
                state.cmd_or_ctrl_held = is_press;
            }
            // Windows/Linux: Control key
            rdev::Key::ControlLeft | rdev::Key::ControlRight => {
                // On macOS, we use Meta (Cmd), on other platforms we use Ctrl
                #[cfg(not(target_os = "macos"))]
                {
                    state.cmd_or_ctrl_held = is_press;
                }
                // On macOS, Ctrl is separate from Cmd, but we also track it
                // for potential future use
                #[cfg(target_os = "macos")]
                {
                    // On macOS, we primarily use Cmd, but also allow Ctrl+F6
                    // for consistency with other platforms
                    state.cmd_or_ctrl_held = is_press;
                }
            }
            rdev::Key::ShiftLeft | rdev::Key::ShiftRight => {
                state.shift_held = is_press;
            }
            rdev::Key::Alt | rdev::Key::AltGr => {
                state.alt_held = is_press;
            }
            _ => {}
        }
    }

    /// Get the current modifier state (for testing and debugging)
    pub fn get_modifier_state(&self) -> ModifierState {
        self.modifier_state.lock().unwrap().clone()
    }

    /// Reset the modifier state (useful when recording stops)
    pub fn reset_modifier_state(&self) {
        let mut state = self.modifier_state.lock().unwrap();
        *state = ModifierState::default();
    }

    /// Get the list of recorded AI Vision Capture actions
    pub fn get_vision_actions(&self) -> Vec<AIVisionCaptureAction> {
        self.vision_actions.lock().unwrap().clone()
    }

    /// Capture a vision marker when the hotkey is pressed
    /// This captures a screenshot and creates an AIVisionCaptureAction
    /// Requirements: 1.2, 1.4
    /// 
    /// Returns the screenshot data and the created action, or an error if capture fails.
    /// The screenshot should be saved to a file by the caller.
    pub fn capture_vision_marker(&self) -> Result<(Vec<u8>, AIVisionCaptureAction)> {
        if !self.is_recording() {
            return Err(AutomationError::RecordingError {
                message: "Cannot capture vision marker: not recording".to_string(),
            });
        }

        let operation_id = format!("vision_capture_{}", chrono::Utc::now().timestamp_millis());
        
        // Log the operation start
        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Recording,
                operation_id.clone(),
                "Capturing AI Vision marker".to_string(),
                None,
            );
        }

        // Capture screenshot using platform automation
        let screenshot_data = self.platform.take_screenshot().map_err(|e| {
            if let Some(logger) = get_logger() {
                logger.log_operation(
                    LogLevel::Error,
                    CoreType::Rust,
                    OperationType::Recording,
                    operation_id.clone(),
                    format!("Failed to capture screenshot: {:?}", e),
                    None,
                );
            }
            e
        })?;

        // Get current screen dimensions
        let screen_dim = self.platform.get_screen_size().map_err(|e| {
            if let Some(logger) = get_logger() {
                logger.log_operation(
                    LogLevel::Error,
                    CoreType::Rust,
                    OperationType::Recording,
                    operation_id.clone(),
                    format!("Failed to get screen dimensions: {:?}", e),
                    None,
                );
            }
            e
        })?;

        // Generate unique ID for this action
        let action_id = Uuid::new_v4().to_string();
        
        // Generate unique filename for the screenshot
        let screenshot_filename = {
            let mut counter = self.vision_screenshot_counter.lock().unwrap();
            *counter += 1;
            format!("vision_{}.png", action_id)
        };

        // Get current timestamp relative to recording start
        let timestamp = self.get_timestamp();

        // Create the AIVisionCaptureAction with default values
        // Requirements: 3.1 - Default to Static Mode (is_dynamic = false)
        let vision_action = AIVisionCaptureAction::new(
            action_id.clone(),
            timestamp,
            screenshot_filename.clone(),
            screen_dim,
        );

        // Add to vision actions list
        {
            let mut vision_actions = self.vision_actions.lock().unwrap();
            vision_actions.push(vision_action.clone());
        }

        // Also add a regular Action to the recorded_actions list for script continuity
        // This ensures the vision action appears in the correct position in the script
        let action = Action {
            action_type: ActionType::AiVisionCapture,
            timestamp,
            x: None,
            y: None,
            button: None,
            key: None,
            text: None,
            modifiers: None,
            additional_data: Some({
                let mut data = HashMap::new();
                data.insert("vision_action_id".to_string(), serde_json::json!(action_id));
                data.insert("screenshot".to_string(), serde_json::json!(screenshot_filename));
                data.insert("screen_width".to_string(), serde_json::json!(screen_dim.0));
                data.insert("screen_height".to_string(), serde_json::json!(screen_dim.1));
                data
            }),
        };

        {
            let mut actions = self.recorded_actions.lock().unwrap();
            actions.push(action.clone());
        }

        // Send real-time event to UI
        self.send_action_event(&action);

        // Send a specific vision capture event
        self.send_event(RecordingEvent {
            event_type: "vision_capture".to_string(),
            data: RecordingEventData::Status {
                status: "captured".to_string(),
                message: Some(format!("Vision marker captured: {}", screenshot_filename)),
            },
        });

        // Log success
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("action_id".to_string(), serde_json::json!(action_id));
            metadata.insert("screenshot".to_string(), serde_json::json!(screenshot_filename));
            metadata.insert("screen_dim".to_string(), serde_json::json!(screen_dim));
            metadata.insert("timestamp".to_string(), serde_json::json!(timestamp));
            
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Recording,
                operation_id,
                "AI Vision marker captured successfully".to_string(),
                Some(metadata),
            );
        }

        Ok((screenshot_data, vision_action))
    }

    /// Get the next vision screenshot filename without incrementing the counter
    /// Useful for previewing what the filename will be
    pub fn peek_next_vision_filename(&self) -> String {
        let counter = self.vision_screenshot_counter.lock().unwrap();
        format!("vision_{:04}.png", *counter + 1)
    }

    /// Get the count of vision captures in the current recording session
    pub fn get_vision_capture_count(&self) -> u32 {
        *self.vision_screenshot_counter.lock().unwrap()
    }

    /// Capture a vision marker asynchronously without blocking the event loop
    /// This ensures recording continuity (Requirement 1.3)
    /// 
    /// The capture is performed in a separate thread to avoid blocking
    /// the main event loop that handles mouse and keyboard hooks.
    /// 
    /// Returns a channel receiver that will receive the result when capture completes.
    pub fn capture_vision_marker_async(&self) -> std::sync::mpsc::Receiver<Result<(Vec<u8>, AIVisionCaptureAction)>> {
        let (tx, rx) = std::sync::mpsc::channel();
        
        // Clone all the Arc references we need for the capture
        let is_recording = Arc::clone(&self.is_recording);
        let vision_screenshot_counter = Arc::clone(&self.vision_screenshot_counter);
        let vision_actions = Arc::clone(&self.vision_actions);
        let recorded_actions = Arc::clone(&self.recorded_actions);
        let start_time = self.start_time;
        let event_sender = self.event_sender.clone();
        
        // We need to capture platform info before spawning the thread
        // since platform is not Send
        let screen_size_result = self.platform.get_screen_size();
        let screenshot_result = self.platform.take_screenshot();
        
        // Spawn a thread to process the capture without blocking
        thread::spawn(move || {
            let result = Self::process_vision_capture_in_thread(
                is_recording,
                vision_screenshot_counter,
                vision_actions,
                recorded_actions,
                start_time,
                event_sender,
                screen_size_result,
                screenshot_result,
            );
            
            // Send the result back through the channel
            let _ = tx.send(result);
        });
        
        rx
    }

    /// Internal helper to process vision capture in a separate thread
    /// This is called from capture_vision_marker_async to ensure non-blocking behavior
    fn process_vision_capture_in_thread(
        is_recording: Arc<AtomicBool>,
        vision_screenshot_counter: Arc<Mutex<u32>>,
        vision_actions: Arc<Mutex<Vec<AIVisionCaptureAction>>>,
        recorded_actions: Arc<Mutex<Vec<Action>>>,
        start_time: Option<Instant>,
        event_sender: Option<mpsc::UnboundedSender<RecordingEvent>>,
        screen_size_result: Result<(u32, u32)>,
        screenshot_result: Result<Vec<u8>>,
    ) -> Result<(Vec<u8>, AIVisionCaptureAction)> {
        // Check if still recording
        if !is_recording.load(Ordering::SeqCst) {
            return Err(AutomationError::RecordingError {
                message: "Cannot capture vision marker: not recording".to_string(),
            });
        }

        let operation_id = format!("vision_capture_async_{}", chrono::Utc::now().timestamp_millis());
        
        // Log the operation start
        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Recording,
                operation_id.clone(),
                "Processing AI Vision marker capture (async)".to_string(),
                None,
            );
        }

        // Get screenshot data
        let screenshot_data = screenshot_result.map_err(|e| {
            if let Some(logger) = get_logger() {
                logger.log_operation(
                    LogLevel::Error,
                    CoreType::Rust,
                    OperationType::Recording,
                    operation_id.clone(),
                    format!("Failed to capture screenshot: {:?}", e),
                    None,
                );
            }
            e
        })?;

        // Get screen dimensions
        let screen_dim = screen_size_result.map_err(|e| {
            if let Some(logger) = get_logger() {
                logger.log_operation(
                    LogLevel::Error,
                    CoreType::Rust,
                    OperationType::Recording,
                    operation_id.clone(),
                    format!("Failed to get screen dimensions: {:?}", e),
                    None,
                );
            }
            e
        })?;

        // Generate unique ID for this action
        let action_id = Uuid::new_v4().to_string();
        
        // Generate unique filename for the screenshot
        let screenshot_filename = {
            let mut counter = vision_screenshot_counter.lock().unwrap();
            *counter += 1;
            format!("vision_{}.png", action_id)
        };

        // Get current timestamp relative to recording start
        let timestamp = start_time
            .map(|start| start.elapsed().as_secs_f64())
            .unwrap_or(0.0);

        // Create the AIVisionCaptureAction with default values
        let vision_action = AIVisionCaptureAction::new(
            action_id.clone(),
            timestamp,
            screenshot_filename.clone(),
            screen_dim,
        );

        // Add to vision actions list
        {
            let mut va = vision_actions.lock().unwrap();
            va.push(vision_action.clone());
        }

        // Also add a regular Action to the recorded_actions list
        let action = Action {
            action_type: ActionType::AiVisionCapture,
            timestamp,
            x: None,
            y: None,
            button: None,
            key: None,
            text: None,
            modifiers: None,
            additional_data: Some({
                let mut data = HashMap::new();
                data.insert("vision_action_id".to_string(), serde_json::json!(action_id));
                data.insert("screenshot".to_string(), serde_json::json!(screenshot_filename));
                data.insert("screen_width".to_string(), serde_json::json!(screen_dim.0));
                data.insert("screen_height".to_string(), serde_json::json!(screen_dim.1));
                data
            }),
        };

        {
            let mut actions = recorded_actions.lock().unwrap();
            actions.push(action.clone());
        }

        // Send events to UI if sender is available
        if let Some(ref sender) = event_sender {
            // Send action recorded event
            let action_data = ActionEventData {
                action_type: "ai_vision_capture".to_string(),
                timestamp,
                x: None,
                y: None,
                button: None,
                key: None,
                text: None,
            };

            let _ = sender.send(RecordingEvent {
                event_type: "action_recorded".to_string(),
                data: RecordingEventData::ActionRecorded {
                    action: action_data,
                },
            });

            // Send vision capture specific event
            let _ = sender.send(RecordingEvent {
                event_type: "vision_capture".to_string(),
                data: RecordingEventData::Status {
                    status: "captured".to_string(),
                    message: Some(format!("Vision marker captured: {}", screenshot_filename)),
                },
            });
        }

        // Log success
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("action_id".to_string(), serde_json::json!(action_id));
            metadata.insert("screenshot".to_string(), serde_json::json!(screenshot_filename));
            metadata.insert("screen_dim".to_string(), serde_json::json!(screen_dim));
            metadata.insert("timestamp".to_string(), serde_json::json!(timestamp));
            
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Recording,
                operation_id,
                "AI Vision marker captured successfully (async)".to_string(),
                Some(metadata),
            );
        }

        Ok((screenshot_data, vision_action))
    }

    /// Check if a vision capture is currently in progress
    /// This can be used to prevent multiple simultaneous captures
    pub fn is_vision_capture_in_progress(&self) -> bool {
        // For now, we don't track this state since captures are quick
        // and the async version handles concurrency through channels
        false
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
