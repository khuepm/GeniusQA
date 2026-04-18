//! Platform-specific implementations for application detection and focus monitoring

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "macos")]
pub use macos::MacOSFocusMonitor;

use crate::application_focused_automation::{
    error::{FocusError, RegistryError},
    types::{ApplicationInfo, WindowHandle},
};

/// Trait for platform-specific application detection
pub trait PlatformApplicationDetector {
    /// Get list of currently running applications
    fn get_running_applications(&self) -> Result<Vec<ApplicationInfo>, RegistryError>;
    
    /// Get window handle for a specific process
    fn get_application_window_handle(&self, process_id: u32) -> Result<WindowHandle, RegistryError>;
    
    /// Get application by Bundle ID (macOS) or executable path (Windows)
    fn get_application_by_identifier(&self, identifier: &str) -> Result<Option<ApplicationInfo>, RegistryError>;
    
    /// Validate platform-specific permissions (e.g., accessibility on macOS)
    fn validate_permissions(&self) -> Result<bool, RegistryError>;
}

/// Trait for platform-specific focus monitoring
pub trait PlatformFocusMonitor {
    /// Start monitoring focus for a specific process
    fn start_monitoring(&mut self, process_id: u32) -> Result<(), FocusError>;
    
    /// Stop focus monitoring
    fn stop_monitoring(&mut self) -> Result<(), FocusError>;
    
    /// Check if a specific process is currently focused
    fn is_process_focused(&self, process_id: u32) -> Result<bool, FocusError>;
    
    /// Get the process ID of the currently focused application
    fn get_focused_process_id(&self) -> Result<Option<u32>, FocusError>;
}
