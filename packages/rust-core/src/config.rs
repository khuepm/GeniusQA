//! Configuration types for the automation core

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Configuration for the automation core
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationConfig {
    /// Directory where script files are stored
    pub scripts_directory: PathBuf,
    
    /// Default playback speed (1.0 = normal speed)
    pub default_playback_speed: f64,
    
    /// Default number of loops for playback
    pub default_loops: u32,
    
    /// Whether to capture screenshots during recording
    pub capture_screenshots: bool,
    
    /// Screenshot capture interval in milliseconds
    pub screenshot_interval: u64,
    
    /// Maximum recording duration in seconds (0 = unlimited)
    pub max_recording_duration: u64,
    
    /// Platform-specific settings
    pub platform_config: PlatformConfig,
}

/// Platform-specific configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformConfig {
    /// Mouse movement smoothing factor (0.0 = no smoothing, 1.0 = maximum smoothing)
    pub mouse_smoothing: f64,
    
    /// Keyboard input delay in milliseconds
    pub keyboard_delay: u64,
    
    /// Mouse click delay in milliseconds
    pub mouse_delay: u64,
    
    /// Whether to use high-precision timing
    pub high_precision_timing: bool,
    
    /// Platform-specific options
    #[cfg(windows)]
    pub windows: WindowsConfig,
    
    #[cfg(target_os = "macos")]
    pub macos: MacOSConfig,
    
    #[cfg(target_os = "linux")]
    pub linux: LinuxConfig,
}

#[cfg(windows)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowsConfig {
    /// Use SendInput API instead of mouse_event/keybd_event
    pub use_send_input: bool,
    
    /// Handle UAC elevation prompts
    pub handle_uac: bool,
}

#[cfg(target_os = "macos")]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacOSConfig {
    /// Request accessibility permissions on startup
    pub request_accessibility: bool,
    
    /// Use Quartz Event Services
    pub use_quartz_events: bool,
}

#[cfg(target_os = "linux")]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinuxConfig {
    /// Preferred display server (x11 or wayland)
    pub display_server: String,
    
    /// X11 display name
    pub x11_display: Option<String>,
}

impl Default for AutomationConfig {
    fn default() -> Self {
        Self {
            scripts_directory: PathBuf::from("scripts"),
            default_playback_speed: 1.0,
            default_loops: 1,
            capture_screenshots: false,
            screenshot_interval: 1000,
            max_recording_duration: 0,
            platform_config: PlatformConfig::default(),
        }
    }
}

impl Default for PlatformConfig {
    fn default() -> Self {
        Self {
            mouse_smoothing: 0.0,
            keyboard_delay: 10,
            mouse_delay: 10,
            high_precision_timing: true,
            
            #[cfg(windows)]
            windows: WindowsConfig::default(),
            
            #[cfg(target_os = "macos")]
            macos: MacOSConfig::default(),
            
            #[cfg(target_os = "linux")]
            linux: LinuxConfig::default(),
        }
    }
}

#[cfg(windows)]
impl Default for WindowsConfig {
    fn default() -> Self {
        Self {
            use_send_input: true,
            handle_uac: false,
        }
    }
}

#[cfg(target_os = "macos")]
impl Default for MacOSConfig {
    fn default() -> Self {
        Self {
            request_accessibility: true,
            use_quartz_events: true,
        }
    }
}

#[cfg(target_os = "linux")]
impl Default for LinuxConfig {
    fn default() -> Self {
        Self {
            display_server: "x11".to_string(),
            x11_display: None,
        }
    }
}
