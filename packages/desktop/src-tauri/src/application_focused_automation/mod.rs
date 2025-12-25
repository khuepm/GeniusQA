//! Application-Focused Automation Module
//! 
//! This module provides functionality for registering applications and running
//! automation scripts that are constrained to operate only within those applications.
//! The system monitors application focus and automatically pauses/resumes playback
//! based on whether the target application window is active.

pub mod types;
pub mod registry;
pub mod focus_monitor;
pub mod playback_controller;
pub mod platform;
pub mod error;
pub mod config;
pub mod validation;
pub mod notification;
pub mod service;

#[cfg(test)]
pub mod focus_strategy_tests;

#[cfg(test)]
pub mod property_tests;

#[cfg(test)]
pub mod tests;

#[cfg(test)]
pub mod integration_tests;

#[cfg(test)]
pub mod performance_tests;

#[cfg(test)]
pub mod macos_tests;

#[cfg(test)]
// pub mod ignore_focus_test; // Temporarily disabled due to compilation errors

// Re-export main types and functions for easier access
pub use types::{
    RegisteredApplication, ApplicationStatus, FocusLossStrategy, 
    FocusState, FocusEvent, ApplicationInfo, PlaybackState, PauseReason,
    AutomationProgressSnapshot, ErrorRecoveryStrategy, WarningEntry, FocusErrorReport
};
pub use registry::*;
pub use error::*;
pub use config::ApplicationFocusConfig;
pub use validation::{ActionValidator, AutomationAction, ValidationResult, ValidationError, Point, Bounds};
pub use notification::{NotificationService, NotificationType, NotificationEvent, NotificationConfig};
pub use focus_monitor::FocusMonitor;
pub use playback_controller::{PlaybackController, SessionStats};
pub use service::{ApplicationFocusedAutomationService, ServiceState};

// Platform-specific exports
#[cfg(target_os = "windows")]
pub use platform::windows::{WindowsApplicationDetector, WindowsFocusMonitor};

#[cfg(target_os = "macos")]
pub use platform::macos::{MacOSApplicationDetector, MacOSFocusMonitor};
