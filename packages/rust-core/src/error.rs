//! Error types for the Rust automation core

use thiserror::Error;
use serde::{Deserialize, Serialize};

/// Result type alias for automation operations
pub type Result<T> = std::result::Result<T, AutomationError>;

/// Comprehensive error types for automation operations
#[derive(Error, Debug, Clone, Serialize, Deserialize)]
pub enum AutomationError {
    #[error("Platform not supported: {platform}")]
    UnsupportedPlatform { platform: String },

    #[error("Permission denied: {operation}")]
    PermissionDenied { operation: String },

    #[error("Recording error: {message}")]
    RecordingError { message: String },

    #[error("Playback error: {message}")]
    PlaybackError { message: String },

    #[error("Script error: {message}")]
    ScriptError { message: String },

    #[error("IO error: {message}")]
    IoError { message: String },

    #[error("Serialization error: {message}")]
    SerializationError { message: String },

    #[error("Configuration error: {message}")]
    ConfigError { message: String },

    #[error("System error: {message}")]
    SystemError { message: String },

    #[error("Invalid input: {message}")]
    InvalidInput { message: String },

    #[error("Operation timeout: {operation}")]
    Timeout { operation: String },

    #[error("Core unavailable: {core_type}")]
    CoreUnavailable { core_type: String },

    #[error("Core health check failed: {core_type} - {reason}")]
    CoreHealthCheckFailed { core_type: String, reason: String },

    #[error("Fallback failed: {reason}")]
    FallbackFailed { reason: String },

    #[error("Runtime failure: {operation} - {reason}")]
    RuntimeFailure { operation: String, reason: String },

    #[error("Performance degradation detected: {metric} - {details}")]
    PerformanceDegradation { metric: String, details: String },

    #[error("Dependency missing: {dependency} - {suggestion}")]
    DependencyMissing { dependency: String, suggestion: String },
}

impl From<std::io::Error> for AutomationError {
    fn from(error: std::io::Error) -> Self {
        AutomationError::IoError {
            message: error.to_string(),
        }
    }
}

impl From<serde_json::Error> for AutomationError {
    fn from(error: serde_json::Error) -> Self {
        AutomationError::SerializationError {
            message: error.to_string(),
        }
    }
}

/// Error severity levels for proper error handling and user feedback
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ErrorSeverity {
    /// Low severity - operation can continue with degraded functionality
    Warning,
    /// Medium severity - operation failed but system remains stable
    Error,
    /// High severity - system stability compromised, immediate action required
    Critical,
}

/// Enhanced error information for better error handling and user feedback
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorInfo {
    pub error: AutomationError,
    pub severity: ErrorSeverity,
    pub core_type: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub context: Option<String>,
    pub suggested_action: Option<String>,
    pub can_retry: bool,
    pub can_fallback: bool,
}

impl ErrorInfo {
    /// Create a new error info with automatic severity detection
    pub fn new(error: AutomationError) -> Self {
        let severity = Self::determine_severity(&error);
        let (can_retry, can_fallback, suggested_action) = Self::determine_recovery_options(&error);

        Self {
            error,
            severity,
            core_type: None,
            timestamp: chrono::Utc::now(),
            context: None,
            suggested_action,
            can_retry,
            can_fallback,
        }
    }

    /// Create error info with core attribution
    pub fn with_core(mut self, core_type: String) -> Self {
        self.core_type = Some(core_type);
        self
    }

    /// Add context information to the error
    pub fn with_context(mut self, context: String) -> Self {
        self.context = Some(context);
        self
    }

    /// Determine error severity based on error type
    fn determine_severity(error: &AutomationError) -> ErrorSeverity {
        match error {
            AutomationError::UnsupportedPlatform { .. } => ErrorSeverity::Critical,
            AutomationError::PermissionDenied { .. } => ErrorSeverity::Critical,
            AutomationError::CoreUnavailable { .. } => ErrorSeverity::Error,
            AutomationError::CoreHealthCheckFailed { .. } => ErrorSeverity::Error,
            AutomationError::FallbackFailed { .. } => ErrorSeverity::Critical,
            AutomationError::RuntimeFailure { .. } => ErrorSeverity::Error,
            AutomationError::PerformanceDegradation { .. } => ErrorSeverity::Warning,
            AutomationError::DependencyMissing { .. } => ErrorSeverity::Critical,
            AutomationError::RecordingError { .. } => ErrorSeverity::Error,
            AutomationError::PlaybackError { .. } => ErrorSeverity::Error,
            AutomationError::ScriptError { .. } => ErrorSeverity::Error,
            AutomationError::IoError { .. } => ErrorSeverity::Error,
            AutomationError::SerializationError { .. } => ErrorSeverity::Error,
            AutomationError::ConfigError { .. } => ErrorSeverity::Error,
            AutomationError::SystemError { .. } => ErrorSeverity::Error,
            AutomationError::InvalidInput { .. } => ErrorSeverity::Warning,
            AutomationError::Timeout { .. } => ErrorSeverity::Warning,
        }
    }

    /// Determine recovery options based on error type
    fn determine_recovery_options(error: &AutomationError) -> (bool, bool, Option<String>) {
        match error {
            AutomationError::UnsupportedPlatform { .. } => (
                false, 
                false, 
                Some("This platform is not supported. Please use a supported operating system.".to_string())
            ),
            AutomationError::PermissionDenied { operation } => (
                true, 
                false, 
                Some(format!("Permission denied for {}. Please grant the required permissions and try again.", operation))
            ),
            AutomationError::CoreUnavailable { .. } => (
                true, 
                true, 
                Some("The selected automation core is unavailable. Try switching to an alternative core.".to_string())
            ),
            AutomationError::CoreHealthCheckFailed { .. } => (
                true, 
                true, 
                Some("Core health check failed. Try restarting the core or switching to an alternative.".to_string())
            ),
            AutomationError::FallbackFailed { .. } => (
                false, 
                false, 
                Some("All automation cores are unavailable. Please check your system configuration.".to_string())
            ),
            AutomationError::RuntimeFailure { .. } => (
                true, 
                true, 
                Some("Runtime failure detected. Try restarting the operation or switching cores.".to_string())
            ),
            AutomationError::PerformanceDegradation { .. } => (
                false, 
                true, 
                Some("Performance issues detected. Consider switching to a different automation core.".to_string())
            ),
            AutomationError::DependencyMissing { suggestion, .. } => (
                true, 
                true, 
                Some(suggestion.clone())
            ),
            AutomationError::RecordingError { .. } => (
                true, 
                true, 
                Some("Recording failed. Try stopping and restarting the recording, or switch cores.".to_string())
            ),
            AutomationError::PlaybackError { .. } => (
                true, 
                true, 
                Some("Playback failed. Try restarting playback or switch to a different core.".to_string())
            ),
            AutomationError::ScriptError { .. } => (
                true, 
                false, 
                Some("Script error detected. Please check the script format and try again.".to_string())
            ),
            AutomationError::IoError { .. } => (
                true, 
                false, 
                Some("File system error. Please check file permissions and disk space.".to_string())
            ),
            AutomationError::SerializationError { .. } => (
                true, 
                false, 
                Some("Data format error. The script file may be corrupted.".to_string())
            ),
            AutomationError::ConfigError { .. } => (
                true, 
                false, 
                Some("Configuration error. Please check your settings and try again.".to_string())
            ),
            AutomationError::SystemError { .. } => (
                true, 
                true, 
                Some("System error detected. Try restarting the operation or switching cores.".to_string())
            ),
            AutomationError::InvalidInput { .. } => (
                true, 
                false, 
                Some("Invalid input provided. Please check your input and try again.".to_string())
            ),
            AutomationError::Timeout { .. } => (
                true, 
                true, 
                Some("Operation timed out. Try increasing timeout settings or switching cores.".to_string())
            ),
        }
    }
}
