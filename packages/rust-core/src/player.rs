//! Playback functionality for executing recorded scripts

use crate::{
    Result, AutomationError, AutomationConfig, ScriptData, Action, ActionType,
    platform::{PlatformAutomation, create_platform_automation},
    logging::{CoreType, OperationType, LogLevel, get_logger}
};
use std::sync::{Arc, Mutex, atomic::{AtomicBool, AtomicUsize, Ordering}};
use std::time::{Duration, Instant};
use std::collections::HashMap;
use tokio::sync::mpsc;
use serde::{Serialize, Deserialize};
use std::thread;

/// Player for executing recorded scripts
pub struct Player {
    platform: Box<dyn PlatformAutomation>,
    config: AutomationConfig,
    is_playing: Arc<AtomicBool>,
    is_paused: Arc<AtomicBool>,
    current_script: Option<ScriptData>,
    playback_speed: f64,
    loops_remaining: u32,
    loops_total: u32,
    current_loop: u32,
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
            loops_remaining: 1,
            loops_total: 1,
            current_loop: 1,
            current_action_index: Arc::new(AtomicUsize::new(0)),
            start_time: None,
            event_sender: None,
        })
    }

    /// Set event sender for real-time UI updates
    pub fn set_event_sender(&mut self, sender: mpsc::UnboundedSender<PlaybackEvent>) {
        self.event_sender = Some(sender);
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
        // Check permissions first
        if !self.platform.check_permissions()? {
            if !self.platform.request_permissions()? {
                return Err(AutomationError::PermissionDenied {
                    operation: "Playback requires system permissions".to_string(),
                });
            }
        }

        if self.is_playing.load(Ordering::Relaxed) {
            return Err(AutomationError::PlaybackError {
                message: "Playback is already in progress".to_string(),
            });
        }

        if self.current_script.is_none() {
            return Err(AutomationError::PlaybackError {
                message: "No script loaded for playback".to_string(),
            });
        }

        self.is_playing.store(true, Ordering::Relaxed);
        self.is_paused.store(false, Ordering::Relaxed);
        
        self.playback_speed = speed.max(0.1).min(10.0); // Clamp speed between 0.1x and 10x
        self.loops_remaining = loops;
        self.loops_total = loops;
        self.current_loop = 1;
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

    /// Stop playback
    pub fn stop_playback(&mut self) -> Result<()> {
        if !self.is_playing.load(Ordering::Relaxed) {
            return Err(AutomationError::PlaybackError {
                message: "No playback in progress".to_string(),
            });
        }

        self.is_playing.store(false, Ordering::Relaxed);
        self.is_paused.store(false, Ordering::Relaxed);
        self.current_action_index.store(0, Ordering::Relaxed);
        
        // Send status event to UI
        self.send_event(PlaybackEvent {
            event_type: "status".to_string(),
            data: PlaybackEventData::Status {
                status: "stopped".to_string(),
                message: Some("Playback stopped".to_string()),
            },
        });
        
        Ok(())
    }

    /// Pause or resume playback
    pub fn pause_playback(&mut self) -> Result<bool> {
        if !self.is_playing.load(Ordering::Relaxed) {
            return Err(AutomationError::PlaybackError {
                message: "No playback in progress".to_string(),
            });
        }

        let current_paused = self.is_paused.load(Ordering::Relaxed);
        let new_paused = !current_paused;
        self.is_paused.store(new_paused, Ordering::Relaxed);
        
        // Send status event to UI
        self.send_event(PlaybackEvent {
            event_type: "status".to_string(),
            data: PlaybackEventData::Status {
                status: if new_paused { "paused" } else { "playing" }.to_string(),
                message: Some(if new_paused { "Playback paused" } else { "Playback resumed" }.to_string()),
            },
        });
        
        Ok(new_paused)
    }



    /// Start playback execution in background thread
    fn start_playback_execution(&self) -> Result<()> {
        let is_playing = Arc::clone(&self.is_playing);
        let is_paused = Arc::clone(&self.is_paused);
        let current_action_index = Arc::clone(&self.current_action_index);
        let script = self.current_script.clone();
        let playback_speed = self.playback_speed;
        let mut loops_remaining = self.loops_remaining;
        let loops_total = self.loops_total;
        let mut current_loop = self.current_loop;
        let event_sender = self.event_sender.clone();
        let config = self.config.clone();
        
        // Create platform automation for the background thread
        let platform = create_platform_automation()?;
        
        thread::spawn(move || {
            if let Some(script) = script {
                let mut loop_start_time = Instant::now();
                
                while is_playing.load(Ordering::Relaxed) && loops_remaining > 0 {
                    let action_index = current_action_index.load(Ordering::Relaxed);
                    
                    if action_index >= script.actions.len() {
                        // End of script reached, start next loop
                        loops_remaining = loops_remaining.saturating_sub(1);
                        current_loop += 1;
                        
                        if loops_remaining > 0 {
                            current_action_index.store(0, Ordering::Relaxed);
                            loop_start_time = Instant::now();
                            continue;
                        } else {
                            break;
                        }
                    }
                    
                    // Wait if paused
                    while is_paused.load(Ordering::Relaxed) && is_playing.load(Ordering::Relaxed) {
                        thread::sleep(Duration::from_millis(10));
                    }
                    
                    if !is_playing.load(Ordering::Relaxed) {
                        break;
                    }
                    
                    let action = &script.actions[action_index];
                    
                    // Send action preview event
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
                            },
                            timestamp: action.timestamp,
                            x: action.x,
                            y: action.y,
                            button: action.button.clone(),
                            key: action.key.clone(),
                            text: action.text.clone(),
                        };
                        
                        let _ = sender.send(PlaybackEvent {
                            event_type: "action_preview".to_string(),
                            data: PlaybackEventData::ActionPreview {
                                index: action_index,
                                action: preview_data,
                            },
                        });
                    }
                    
                    // Calculate timing delay
                    let target_time = Duration::from_secs_f64(action.timestamp / playback_speed);
                    let elapsed = loop_start_time.elapsed();
                    
                    if target_time > elapsed {
                        let delay = target_time - elapsed;
                        thread::sleep(delay);
                    }
                    
                    // Execute the action
                    if let Err(_) = Self::execute_action_sync(&*platform, action, &config) {
                        // Handle error - for now just continue
                    }
                    
                    // Update action index
                    current_action_index.store(action_index + 1, Ordering::Relaxed);
                    
                    // Send progress update
                    if let Some(ref sender) = event_sender {
                        let progress = (action_index + 1) as f64 / script.actions.len() as f64;
                        let _ = sender.send(PlaybackEvent {
                            event_type: "progress".to_string(),
                            data: PlaybackEventData::Progress {
                                current_action: action_index + 1,
                                total_actions: script.actions.len(),
                                current_loop,
                                total_loops: loops_total,
                                progress,
                            },
                        });
                    }
                    
                    // Add small delay between actions
                    thread::sleep(Duration::from_millis(config.platform_config.mouse_delay));
                }
                
                // Playback completed
                is_playing.store(false, Ordering::Relaxed);
                
                if let Some(ref sender) = event_sender {
                    let _ = sender.send(PlaybackEvent {
                        event_type: "complete".to_string(),
                        data: PlaybackEventData::Complete {
                            completed: true,
                            reason: "finished".to_string(),
                        },
                    });
                }
            }
        });
        
        Ok(())
    }

    /// Execute a single action synchronously
    fn execute_action_sync(platform: &dyn PlatformAutomation, action: &Action, _config: &AutomationConfig) -> Result<()> {
        match action.action_type {
            ActionType::MouseMove => {
                if let (Some(x), Some(y)) = (action.x, action.y) {
                    platform.mouse_move(x, y)?;
                }
            }
            ActionType::MouseClick => {
                if let (Some(x), Some(y), Some(ref button)) = (action.x, action.y, &action.button) {
                    platform.mouse_click_at(x, y, button)?;
                }
            }
            ActionType::MouseDoubleClick => {
                if let (Some(x), Some(y), Some(ref button)) = (action.x, action.y, &action.button) {
                    platform.mouse_double_click(x, y, button)?;
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
                            platform.mouse_drag(from_x, from_y, to_x, to_y, button)?;
                        } else {
                            // Fallback to click
                            platform.mouse_click_at(x, y, button)?;
                        }
                    } else {
                        platform.mouse_click_at(x, y, button)?;
                    }
                }
            }
            ActionType::MouseScroll => {
                if let (Some(x), Some(y)) = (action.x, action.y) {
                    let (delta_x, delta_y) = if let Some(ref additional_data) = action.additional_data {
                        (
                            additional_data.get("delta_x").and_then(|v| v.as_i64()).map(|v| v as i32).unwrap_or(0),
                            additional_data.get("delta_y").and_then(|v| v.as_i64()).map(|v| v as i32).unwrap_or(1),
                        )
                    } else {
                        (0, 1)
                    };
                    platform.mouse_scroll(x, y, delta_x, delta_y)?;
                }
            }
            ActionType::KeyPress => {
                if let Some(ref key) = action.key {
                    if let Some(ref modifiers) = action.modifiers {
                        platform.key_combination(key, modifiers)?;
                    } else {
                        platform.key_press(key)?;
                    }
                }
            }
            ActionType::KeyRelease => {
                if let Some(ref key) = action.key {
                    platform.key_release(key)?;
                }
            }
            ActionType::KeyType => {
                if let Some(ref text) = action.text {
                    platform.key_type(text)?;
                }
            }
            ActionType::Screenshot => {
                // Screenshot actions are typically for verification, not playback
            }
            ActionType::Wait => {
                // Wait actions pause execution for a specified duration
                if let Some(duration_ms) = action.additional_data
                    .as_ref()
                    .and_then(|data| data.get("duration_ms"))
                    .and_then(|v| v.as_u64()) {
                    thread::sleep(Duration::from_millis(duration_ms));
                }
            }
            ActionType::Custom => {
                // Custom actions would need specific handling based on additional_data
            }
        }
        
        Ok(())
    }

    /// Send event to UI for real-time feedback
    fn send_event(&self, event: PlaybackEvent) {
        if let Some(ref sender) = self.event_sender {
            let _ = sender.send(event);
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
            loops_completed: self.current_loop.saturating_sub(1),
            loops_remaining: self.loops_remaining,
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
