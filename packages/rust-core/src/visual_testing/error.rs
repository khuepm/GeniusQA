//! Error types for visual regression testing

use thiserror::Error;

/// Errors that can occur during visual regression testing operations
#[derive(Error, Debug, Clone, PartialEq)]
pub enum VisualError {
    #[error("Image dimension mismatch: baseline {baseline_width}x{baseline_height}, actual {actual_width}x{actual_height}")]
    DimensionMismatch {
        baseline_width: u32,
        baseline_height: u32,
        actual_width: u32,
        actual_height: u32,
    },

    #[error("Failed to load image from path '{path}': {reason}")]
    ImageLoadError {
        path: String,
        reason: String,
    },

    #[error("Failed to save image to path '{path}': {reason}")]
    ImageSaveError {
        path: String,
        reason: String,
    },

    #[error("Invalid region coordinates: x={x}, y={y}, width={width}, height={height}")]
    InvalidRegion {
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    },

    #[error("Comparison operation timed out after {timeout_ms}ms")]
    ComparisonTimeout {
        timeout_ms: u32,
    },

    #[error("Insufficient memory for image processing: required {required_mb}MB, available {available_mb}MB")]
    InsufficientMemory {
        required_mb: u32,
        available_mb: u32,
    },

    #[error("Unsupported image format: {format}")]
    UnsupportedFormat {
        format: String,
    },

    #[error("File I/O error: {message}")]
    IoError {
        message: String,
    },

    #[error("Configuration error: {message}")]
    ConfigError {
        message: String,
    },

    #[error("Screen capture failed after {attempts} attempts: {reason}")]
    ScreenCaptureError {
        attempts: u32,
        reason: String,
    },

    #[error("Screen stability check failed: {reason}")]
    StabilityCheckError {
        reason: String,
    },

    #[error("Retry limit exceeded: {max_retries} attempts failed")]
    RetryLimitExceeded {
        max_retries: u32,
    },

    #[error("File system error: {operation} failed for path '{path}': {reason}")]
    FileSystemError {
        operation: String,
        path: String,
        reason: String,
    },

    #[error("Permission denied: {operation} requires {permission}")]
    PermissionDenied {
        operation: String,
        permission: String,
    },

    #[error("Configuration error in field '{field}': {reason}")]
    ConfigurationError {
        field: String,
        reason: String,
    },

    #[error("Network error during {operation}: {reason}")]
    NetworkError {
        operation: String,
        reason: String,
    },
}

impl From<std::io::Error> for VisualError {
    fn from(error: std::io::Error) -> Self {
        VisualError::IoError {
            message: error.to_string(),
        }
    }
}

impl From<image::ImageError> for VisualError {
    fn from(error: image::ImageError) -> Self {
        match error {
            image::ImageError::IoError(io_error) => VisualError::IoError {
                message: io_error.to_string(),
            },
            image::ImageError::Unsupported(unsupported) => VisualError::UnsupportedFormat {
                format: format!("{:?}", unsupported),
            },
            _ => VisualError::ImageLoadError {
                path: "unknown".to_string(),
                reason: error.to_string(),
            },
        }
    }
}

/// Result type for visual regression testing operations
pub type VisualResult<T> = Result<T, VisualError>;

/// Error classification for user-friendly handling
#[derive(Debug, Clone, PartialEq)]
pub enum ErrorSeverity {
    /// Critical errors that prevent any operation
    Critical,
    /// Recoverable errors that can be retried
    Recoverable,
    /// Configuration errors that need user intervention
    Configuration,
    /// Warning-level issues that don't prevent operation
    Warning,
}

/// Error category for grouping similar error types
#[derive(Debug, Clone, PartialEq)]
pub enum ErrorCategory {
    /// Image processing and format errors
    ImageProcessing,
    /// File system and I/O errors
    FileSystem,
    /// Configuration and validation errors
    Configuration,
    /// Performance and resource errors
    Performance,
    /// Screen capture and hardware errors
    Capture,
}

impl VisualError {
    /// Get the severity level of this error
    pub fn severity(&self) -> ErrorSeverity {
        match self {
            VisualError::DimensionMismatch { .. } => ErrorSeverity::Configuration,
            VisualError::ImageLoadError { .. } => ErrorSeverity::Recoverable,
            VisualError::ImageSaveError { .. } => ErrorSeverity::Recoverable,
            VisualError::InvalidRegion { .. } => ErrorSeverity::Configuration,
            VisualError::ComparisonTimeout { .. } => ErrorSeverity::Recoverable,
            VisualError::InsufficientMemory { .. } => ErrorSeverity::Critical,
            VisualError::UnsupportedFormat { .. } => ErrorSeverity::Configuration,
            VisualError::IoError { .. } => ErrorSeverity::Recoverable,
            VisualError::ConfigError { .. } => ErrorSeverity::Configuration,
            VisualError::ScreenCaptureError { .. } => ErrorSeverity::Recoverable,
            VisualError::StabilityCheckError { .. } => ErrorSeverity::Warning,
            VisualError::RetryLimitExceeded { .. } => ErrorSeverity::Critical,
            VisualError::FileSystemError { .. } => ErrorSeverity::Recoverable,
            VisualError::PermissionDenied { .. } => ErrorSeverity::Critical,
            VisualError::ConfigurationError { .. } => ErrorSeverity::Configuration,
            VisualError::NetworkError { .. } => ErrorSeverity::Recoverable,
        }
    }

    /// Get the category of this error
    pub fn category(&self) -> ErrorCategory {
        match self {
            VisualError::DimensionMismatch { .. } |
            VisualError::ImageLoadError { .. } |
            VisualError::ImageSaveError { .. } |
            VisualError::UnsupportedFormat { .. } => ErrorCategory::ImageProcessing,
            
            VisualError::IoError { .. } |
            VisualError::FileSystemError { .. } |
            VisualError::NetworkError { .. } => ErrorCategory::FileSystem,
            
            VisualError::InvalidRegion { .. } |
            VisualError::ConfigError { .. } |
            VisualError::ConfigurationError { .. } => ErrorCategory::Configuration,
            
            VisualError::ComparisonTimeout { .. } |
            VisualError::InsufficientMemory { .. } |
            VisualError::RetryLimitExceeded { .. } => ErrorCategory::Performance,
            
            VisualError::ScreenCaptureError { .. } |
            VisualError::StabilityCheckError { .. } |
            VisualError::PermissionDenied { .. } => ErrorCategory::Capture,
        }
    }

    /// Get a user-friendly error message with suggested actions
    pub fn user_friendly_message(&self) -> String {
        match self {
            VisualError::DimensionMismatch { baseline_width, baseline_height, actual_width, actual_height } => {
                format!(
                    "Image size mismatch: Expected {}×{} but got {}×{}.\n\
                    Suggestions:\n\
                    • Check if the application window size changed\n\
                    • Verify screen resolution settings\n\
                    • Consider updating the baseline image",
                    baseline_width, baseline_height, actual_width, actual_height
                )
            }
            VisualError::ImageLoadError { path, reason } => {
                format!(
                    "Could not load image from '{}'.\n\
                    Reason: {}\n\
                    Suggestions:\n\
                    • Check if the file exists\n\
                    • Verify file permissions\n\
                    • Ensure the image format is supported",
                    path, reason
                )
            }
            VisualError::ImageSaveError { path, reason } => {
                format!(
                    "Could not save image to '{}'.\n\
                    Reason: {}\n\
                    Suggestions:\n\
                    • Check available disk space\n\
                    • Verify write permissions\n\
                    • Ensure the directory exists",
                    path, reason
                )
            }
            VisualError::InvalidRegion { x, y, width, height } => {
                format!(
                    "Invalid region specified: {}×{} at ({}, {}).\n\
                    Suggestions:\n\
                    • Check that the region fits within the image bounds\n\
                    • Verify coordinates are not negative\n\
                    • Ensure width and height are greater than zero",
                    width, height, x, y
                )
            }
            VisualError::ComparisonTimeout { timeout_ms } => {
                format!(
                    "Image comparison timed out after {} milliseconds.\n\
                    Suggestions:\n\
                    • Try with smaller images\n\
                    • Increase the timeout limit\n\
                    • Check system performance",
                    timeout_ms
                )
            }
            VisualError::InsufficientMemory { required_mb, available_mb } => {
                format!(
                    "Not enough memory: Need {}MB but only {}MB available.\n\
                    Suggestions:\n\
                    • Close other applications\n\
                    • Use smaller images\n\
                    • Increase system memory",
                    required_mb, available_mb
                )
            }
            VisualError::UnsupportedFormat { format } => {
                format!(
                    "Unsupported image format: '{}'.\n\
                    Supported formats: PNG, JPEG, WebP\n\
                    Suggestion: Convert the image to a supported format",
                    format
                )
            }
            VisualError::ScreenCaptureError { attempts, reason } => {
                format!(
                    "Screen capture failed after {} attempts.\n\
                    Reason: {}\n\
                    Suggestions:\n\
                    • Check screen capture permissions\n\
                    • Ensure the display is accessible\n\
                    • Try again after a moment",
                    attempts, reason
                )
            }
            VisualError::StabilityCheckError { reason } => {
                format!(
                    "Screen stability check failed: {}\n\
                    Suggestions:\n\
                    • Wait for animations to complete\n\
                    • Increase stability wait time\n\
                    • Disable screen stability checks if not needed",
                    reason
                )
            }
            VisualError::RetryLimitExceeded { max_retries } => {
                format!(
                    "Operation failed after {} retry attempts.\n\
                    Suggestions:\n\
                    • Check system resources\n\
                    • Verify network connectivity\n\
                    • Try again later",
                    max_retries
                )
            }
            VisualError::FileSystemError { operation, path, reason } => {
                format!(
                    "File system error during {}: '{}'\n\
                    Reason: {}\n\
                    Suggestions:\n\
                    • Check file permissions\n\
                    • Verify disk space\n\
                    • Ensure the path is accessible",
                    operation, path, reason
                )
            }
            VisualError::PermissionDenied { operation, permission } => {
                format!(
                    "Permission denied: {} requires {} permission.\n\
                    Suggestions:\n\
                    • Grant the required permission in system settings\n\
                    • Run with appropriate privileges\n\
                    • Check security software settings",
                    operation, permission
                )
            }
            VisualError::ConfigurationError { field, reason } => {
                format!(
                    "Configuration error in '{}': {}\n\
                    Suggestions:\n\
                    • Check the configuration file\n\
                    • Verify all required fields are set\n\
                    • Ensure values are in the correct format",
                    field, reason
                )
            }
            VisualError::NetworkError { operation, reason } => {
                format!(
                    "Network error during {}: {}\n\
                    Suggestions:\n\
                    • Check internet connectivity\n\
                    • Verify credentials and permissions\n\
                    • Try again later",
                    operation, reason
                )
            }
            VisualError::IoError { message } |
            VisualError::ConfigError { message } => {
                format!("{}\n\
                    Suggestion: Check the configuration and try again", message)
            }
        }
    }

    /// Check if this error can be retried
    pub fn is_retryable(&self) -> bool {
        matches!(self.severity(), ErrorSeverity::Recoverable | ErrorSeverity::Warning)
    }

    /// Get suggested retry delay in milliseconds
    pub fn suggested_retry_delay_ms(&self) -> Option<u64> {
        if !self.is_retryable() {
            return None;
        }

        match self {
            VisualError::ImageLoadError { .. } |
            VisualError::ImageSaveError { .. } |
            VisualError::IoError { .. } |
            VisualError::FileSystemError { .. } => Some(500), // 500ms for I/O errors
            
            VisualError::ComparisonTimeout { .. } => Some(1000), // 1s for timeout errors
            
            VisualError::ScreenCaptureError { .. } => Some(200), // 200ms for capture errors
            
            VisualError::StabilityCheckError { .. } => Some(100), // 100ms for stability errors
            
            VisualError::NetworkError { .. } => Some(2000), // 2s for network errors
            
            _ => Some(250), // Default 250ms
        }
    }
}
