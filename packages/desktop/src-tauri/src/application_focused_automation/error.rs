//! Error types for application-focused automation

use thiserror::Error;

/// Errors that can occur in the application registry
#[derive(Error, Debug)]
pub enum RegistryError {
    #[error("Application not found: {0}")]
    ApplicationNotFound(String),
    
    #[error("Application already registered: {0}")]
    ApplicationAlreadyRegistered(String),
    
    #[error("Invalid application ID: {0}")]
    InvalidApplicationId(String),
    
    #[error("Platform detection error: {0}")]
    PlatformDetectionError(String),
    
    #[error("Storage error: {0}")]
    StorageError(String),
    
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

/// Errors that can occur during focus monitoring
#[derive(Error, Debug)]
pub enum FocusError {
    #[error("Platform API error: {0}")]
    PlatformApiError(String),
    
    #[error("Monitoring not started")]
    MonitoringNotStarted,
    
    #[error("Monitoring already active")]
    MonitoringAlreadyActive,
    
    #[error("Invalid process ID: {0}")]
    InvalidProcessId(u32),
    
    #[error("Process not found: {0}")]
    ProcessNotFound(u32),
    
    #[error("Window handle invalid")]
    InvalidWindowHandle,
    
    #[error("Permission denied for focus monitoring: {0}")]
    PermissionDenied(String),
    
    #[error("Secure input mode active")]
    SecureInputActive,
    
    #[error("Platform-specific error: {0}")]
    PlatformSpecific(String),
    
    #[error("Event system error: {0}")]
    EventSystemError(String),
}

/// Errors that can occur during playback control
#[derive(Error, Debug)]
pub enum PlaybackError {
    #[error("No active playback session")]
    NoActiveSession,
    
    #[error("Playback already active")]
    PlaybackAlreadyActive,
    
    #[error("Invalid playback state: {0}")]
    InvalidState(String),
    
    #[error("Target application not available: {0}")]
    TargetApplicationUnavailable(String),
    
    #[error("Focus validation failed: {0}")]
    FocusValidationFailed(String),
    
    #[error("Focus verification failed: {0}")]
    FocusVerificationFailed(String),
    
    #[error("Action validation failed: {0}")]
    ActionValidationFailed(String),
    
    #[error("Automation engine error: {0}")]
    AutomationEngineError(String),
    
    #[error("Registry error: {0}")]
    RegistryError(#[from] RegistryError),
    
    #[error("Focus monitoring error: {0}")]
    FocusError(#[from] FocusError),
    
    #[error("Application closed during automation: {0}")]
    ApplicationClosed(String),
    
    #[error("Application unresponsive: {0}")]
    ApplicationUnresponsive(String),
    
    #[error("Recovery failed: {0}")]
    RecoveryFailed(String),
}

/// Comprehensive error detection and recovery system
#[derive(Error, Debug)]
pub enum ErrorRecoveryError {
    #[error("Error detection failed: {0}")]
    DetectionFailed(String),
    
    #[error("Recovery mechanism failed: {0}")]
    RecoveryMechanismFailed(String),
    
    #[error("State preservation failed: {0}")]
    StatePreservationFailed(String),
    
    #[error("Progress saving failed: {0}")]
    ProgressSavingFailed(String),
    
    #[error("Recovery options unavailable: {0}")]
    RecoveryOptionsUnavailable(String),
    
    #[error("Error messaging failed: {0}")]
    ErrorMessagingFailed(String),
}

/// Main error type for application-focused automation service
#[derive(Error, Debug)]
pub enum ApplicationFocusedAutomationError {
    #[error("Registry error: {0}")]
    RegistryError(#[from] RegistryError),
    
    #[error("Focus monitoring error: {0}")]
    FocusError(#[from] FocusError),
    
    #[error("Playback error: {0}")]
    PlaybackError(#[from] PlaybackError),
    
    #[error("Error recovery error: {0}")]
    ErrorRecoveryError(#[from] ErrorRecoveryError),
    
    #[error("Service error: {0}")]
    ServiceError(String),
    
    #[error("Application not found: {0}")]
    ApplicationNotFound(String),
    
    #[error("Application not active: {0}")]
    ApplicationNotActive(String),
    
    #[error("Configuration error: {0}")]
    ConfigurationError(String),
    
    #[error("Notification error: {0}")]
    NotificationError(String),
    
    #[error("Platform error: {0}")]
    PlatformError(String),
    
    #[error("Validation error: {0}")]
    ValidationError(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}
