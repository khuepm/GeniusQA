//! Core automation traits and interfaces

use crate::{
    Result, AutomationError, ScriptData, AutomationConfig,
    recorder::{BackgroundRecorder, RecordingEvent},
    player::{BackgroundPlayer, PlaybackEvent},
    performance::{PerformanceCollector, OperationType},
    health::CoreType,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::sync::mpsc;

/// Main automation core trait defining the interface for all automation operations
pub trait AutomationCore: Send + Sync {
    /// Start recording user interactions
    fn start_recording(&mut self) -> Result<()>;
    
    /// Stop recording and return the recorded data
    fn stop_recording(&mut self) -> Result<RecordingResult>;
    
    /// Start playback of a script with specified parameters
    fn start_playback(&mut self, script_path: Option<String>, speed: f64, loops: u32) -> Result<()>;
    
    /// Stop current playback operation
    fn stop_playback(&mut self) -> Result<()>;
    
    /// Pause or resume current playback
    fn pause_playback(&mut self) -> Result<bool>;
    
    /// Check if recording is currently active
    fn is_recording(&self) -> bool;
    
    /// Check if playback is currently active
    fn is_playing(&self) -> bool;
    
    /// Get current status of the automation core
    fn get_status(&self) -> CoreStatus;
}

/// Commands that can be sent to the automation core
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AutomationCommand {
    StartRecording,
    StopRecording,
    StartPlayback {
        script_path: Option<String>,
        speed: f64,
        loops: u32,
    },
    StopPlayback,
    PausePlayback,
    CheckRecordings,
    GetLatestRecording,
    ListScripts,
    LoadScript { path: String },
    SaveScript { path: String, data: ScriptData },
    DeleteScript { path: String },
    GetStatus,
}

/// Result of executing an automation command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CommandResult {
    Success,
    RecordingStarted,
    RecordingStopped { result: RecordingResult },
    PlaybackStarted,
    PlaybackStopped,
    PlaybackPaused { is_paused: bool },
    ScriptList { scripts: Vec<String> },
    ScriptLoaded { data: ScriptData },
    Status { status: CoreStatus },
    Error { message: String },
}

/// Result of a recording operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingResult {
    pub script_data: ScriptData,
    pub duration: f64,
    pub action_count: usize,
    pub file_path: Option<PathBuf>,
}

/// Rust automation core implementation
pub struct RustAutomationCore {
    config: AutomationConfig,
    recorder: Option<BackgroundRecorder>,
    player: Option<BackgroundPlayer>,
    recording_event_receiver: Option<mpsc::UnboundedReceiver<RecordingEvent>>,
    playback_event_receiver: Option<mpsc::UnboundedReceiver<PlaybackEvent>>,
    performance_collector: PerformanceCollector,
}

impl RustAutomationCore {
    /// Create a new Rust automation core
    pub fn new(config: AutomationConfig) -> Result<Self> {
        Ok(Self {
            config,
            recorder: None,
            player: None,
            recording_event_receiver: None,
            playback_event_receiver: None,
            performance_collector: PerformanceCollector::new(CoreType::Rust),
        })
    }

    /// Get recording event receiver for UI updates
    pub fn get_recording_events(&mut self) -> Option<&mut mpsc::UnboundedReceiver<RecordingEvent>> {
        self.recording_event_receiver.as_mut()
    }

    /// Get playback event receiver for UI updates
    pub fn get_playback_events(&mut self) -> Option<&mut mpsc::UnboundedReceiver<PlaybackEvent>> {
        self.playback_event_receiver.as_mut()
    }

    /// Get performance collector for metrics
    pub fn get_performance_collector(&self) -> &PerformanceCollector {
        &self.performance_collector
    }
}

/// Current status of the automation core
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoreStatus {
    pub is_recording: bool,
    pub is_playing: bool,
    pub is_paused: bool,
    pub current_script: Option<String>,
    pub playback_progress: Option<f64>,
    pub last_error: Option<String>,
}

impl Default for CoreStatus {
    fn default() -> Self {
        Self {
            is_recording: false,
            is_playing: false,
            is_paused: false,
            current_script: None,
            playback_progress: None,
            last_error: None,
        }
    }
}

impl AutomationCore for RustAutomationCore {
    fn start_recording(&mut self) -> Result<()> {
        if self.recorder.is_some() {
            return Err(AutomationError::RecordingError {
                message: "Recording is already initialized".to_string(),
            });
        }

        // Start performance measurement
        let performance_collector = self.performance_collector.clone();
        tokio::spawn(async move {
            let measurement = performance_collector.start_operation(OperationType::Recording).await;
            // The measurement will be completed when recording stops
            // For now, we'll complete it immediately as a placeholder
            let _ = measurement.complete(true).await;
        });

        let mut recorder = BackgroundRecorder::new(self.config.clone())?;
        
        // Set up event streaming
        let (sender, receiver) = mpsc::unbounded_channel();
        recorder.set_event_sender(sender);
        self.recording_event_receiver = Some(receiver);
        
        // Store recorder before spawning task
        self.recorder = Some(recorder);
        Ok(())
    }

    fn stop_recording(&mut self) -> Result<RecordingResult> {
        let mut recorder = self.recorder.take()
            .ok_or_else(|| AutomationError::RecordingError {
                message: "No recording in progress".to_string(),
            })?;

        // Measure stop recording performance
        let performance_collector = self.performance_collector.clone();
        tokio::spawn(async move {
            let measurement = performance_collector.start_operation(OperationType::Recording).await;
            let _ = measurement.complete(true).await;
        });

        let script_data = recorder.stop_recording()?;
        let duration = script_data.duration();
        let action_count = script_data.action_count();

        Ok(RecordingResult {
            script_data,
            duration,
            action_count,
            file_path: None, // Would be set when saving to disk
        })
    }

    fn start_playback(&mut self, script_path: Option<String>, speed: f64, loops: u32) -> Result<()> {
        if self.player.is_some() {
            return Err(AutomationError::PlaybackError {
                message: "Playback is already initialized".to_string(),
            });
        }

        // Start performance measurement
        let performance_collector = self.performance_collector.clone();
        tokio::spawn(async move {
            let measurement = performance_collector.start_operation(OperationType::Playback).await;
            let _ = measurement.complete(true).await;
        });

        let mut player = BackgroundPlayer::new(self.config.clone())?;
        
        // Set up event streaming
        let receiver = player.setup_event_streaming();
        self.playback_event_receiver = Some(receiver);
        
        // Load script if provided
        if let Some(_path) = script_path {
            // In a real implementation, this would load from file
            // For now, we'll need the script to be loaded separately
        }
        
        // Start playback
        player.start_playback(speed, loops)?;
        
        self.player = Some(player);
        Ok(())
    }

    fn stop_playback(&mut self) -> Result<()> {
        if let Some(ref player) = self.player {
            player.stop_playback()?;
        }
        self.player = None;
        Ok(())
    }

    fn pause_playback(&mut self) -> Result<bool> {
        let player = self.player.as_ref()
            .ok_or_else(|| AutomationError::PlaybackError {
                message: "No playback in progress".to_string(),
            })?;

        player.pause_playback()
    }

    fn is_recording(&self) -> bool {
        self.recorder.as_ref()
            .map(|r| r.is_recording())
            .unwrap_or(false)
    }

    fn is_playing(&self) -> bool {
        self.player.as_ref()
            .map(|p| p.is_playing())
            .unwrap_or(false)
    }

    fn get_status(&self) -> CoreStatus {
        let is_recording = self.is_recording();
        let is_playing = self.is_playing();
        let is_paused = self.player.as_ref()
            .map(|p| p.is_paused())
            .unwrap_or(false);

        CoreStatus {
            is_recording,
            is_playing,
            is_paused,
            current_script: None, // Would track current script name
            playback_progress: self.player.as_ref()
                .map(|p| p.get_status().progress),
            last_error: None,
        }
    }
}
