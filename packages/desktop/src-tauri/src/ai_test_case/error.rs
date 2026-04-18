//! Error types for AI Test Case Generator
//!
//! Provides comprehensive error handling with retry support and detailed error information.
//! Requirements: 4.3, 4.4, 5.3, 8.1, 8.3, 11.2

use std::time::Duration;
use thiserror::Error;

/// Result type alias for AI Test Case operations
pub type Result<T> = std::result::Result<T, AITestCaseError>;

/// Comprehensive error types for the AI Test Case Generator service
#[derive(Debug, Error)]
pub enum AITestCaseError {
    /// API communication errors with optional retry timing
    /// Requirements: 4.3, 4.4, 8.1
    #[error("API communication failed: {message}")]
    ApiError {
        message: String,
        retry_after: Option<Duration>,
        status_code: Option<u16>,
    },

    /// JSON parsing errors with raw response for debugging
    /// Requirements: 5.3, 8.3
    #[error("JSON parsing failed: {details}")]
    ParseError {
        details: String,
        raw_response: String,
    },

    /// Schema validation errors with field-level details
    /// Requirements: 5.4, 5.5
    #[error("Validation failed for field '{field}': {message}")]
    ValidationError { field: String, message: String },

    /// Configuration errors (API key, preferences)
    /// Requirements: 1.1, 1.5
    #[error("Configuration error: {message}")]
    ConfigError { message: String },

    /// Rate limit exceeded with retry timing
    /// Requirements: 8.2
    #[error("Rate limit exceeded, retry after {seconds} seconds")]
    RateLimitError { seconds: u64 },

    /// Request timeout error
    /// Requirements: 4.3
    #[error("Request timed out after {timeout_secs} seconds")]
    TimeoutError { timeout_secs: u64 },

    /// Input validation error
    /// Requirements: 2.1
    #[error("Invalid input: {message}")]
    InputError { message: String },

    /// Keyring/secure storage error
    /// Requirements: 1.1, 1.3
    #[error("Secure storage error: {message}")]
    KeyringError { message: String },

    /// Maximum retry attempts exceeded
    /// Requirements: 5.3
    #[error("Maximum retry attempts ({max_attempts}) exceeded")]
    MaxRetriesExceeded { max_attempts: u32 },

    /// Generic internal error
    #[error("Internal error: {0}")]
    Internal(String),
}

impl AITestCaseError {
    /// Check if this error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            AITestCaseError::ApiError { .. }
                | AITestCaseError::RateLimitError { .. }
                | AITestCaseError::TimeoutError { .. }
        )
    }

    /// Get the recommended retry delay for this error
    pub fn retry_delay(&self) -> Option<Duration> {
        match self {
            AITestCaseError::ApiError { retry_after, .. } => *retry_after,
            AITestCaseError::RateLimitError { seconds } => Some(Duration::from_secs(*seconds)),
            AITestCaseError::TimeoutError { .. } => Some(Duration::from_secs(5)),
            _ => None,
        }
    }

    /// Create an API error with status code
    pub fn api_error(message: impl Into<String>, status_code: Option<u16>) -> Self {
        AITestCaseError::ApiError {
            message: message.into(),
            retry_after: None,
            status_code,
        }
    }

    /// Create a parse error with raw response
    pub fn parse_error(details: impl Into<String>, raw_response: impl Into<String>) -> Self {
        AITestCaseError::ParseError {
            details: details.into(),
            raw_response: raw_response.into(),
        }
    }

    /// Create a validation error for a specific field
    pub fn validation_error(field: impl Into<String>, message: impl Into<String>) -> Self {
        AITestCaseError::ValidationError {
            field: field.into(),
            message: message.into(),
        }
    }

    /// Create a config error
    pub fn config_error(message: impl Into<String>) -> Self {
        AITestCaseError::ConfigError {
            message: message.into(),
        }
    }

    /// Create an input error
    pub fn input_error(message: impl Into<String>) -> Self {
        AITestCaseError::InputError {
            message: message.into(),
        }
    }

    /// Create a keyring error
    pub fn keyring_error(message: impl Into<String>) -> Self {
        AITestCaseError::KeyringError {
            message: message.into(),
        }
    }
}

// Convert from reqwest errors
impl From<reqwest::Error> for AITestCaseError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            AITestCaseError::TimeoutError { timeout_secs: 30 }
        } else if err.is_connect() {
            AITestCaseError::ApiError {
                message: format!("Connection failed: {}", err),
                retry_after: Some(Duration::from_secs(5)),
                status_code: None,
            }
        } else {
            AITestCaseError::ApiError {
                message: err.to_string(),
                retry_after: None,
                status_code: err.status().map(|s| s.as_u16()),
            }
        }
    }
}

// Convert from serde_json errors
impl From<serde_json::Error> for AITestCaseError {
    fn from(err: serde_json::Error) -> Self {
        AITestCaseError::ParseError {
            details: err.to_string(),
            raw_response: String::new(),
        }
    }
}

// Convert from keyring errors
impl From<keyring::Error> for AITestCaseError {
    fn from(err: keyring::Error) -> Self {
        AITestCaseError::KeyringError {
            message: err.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_is_retryable() {
        let api_err = AITestCaseError::api_error("test", Some(500));
        assert!(api_err.is_retryable());

        let rate_limit_err = AITestCaseError::RateLimitError { seconds: 60 };
        assert!(rate_limit_err.is_retryable());

        let timeout_err = AITestCaseError::TimeoutError { timeout_secs: 30 };
        assert!(timeout_err.is_retryable());

        let config_err = AITestCaseError::config_error("test");
        assert!(!config_err.is_retryable());

        let validation_err = AITestCaseError::validation_error("field", "message");
        assert!(!validation_err.is_retryable());
    }

    #[test]
    fn test_error_retry_delay() {
        let rate_limit_err = AITestCaseError::RateLimitError { seconds: 60 };
        assert_eq!(rate_limit_err.retry_delay(), Some(Duration::from_secs(60)));

        let timeout_err = AITestCaseError::TimeoutError { timeout_secs: 30 };
        assert_eq!(timeout_err.retry_delay(), Some(Duration::from_secs(5)));

        let config_err = AITestCaseError::config_error("test");
        assert_eq!(config_err.retry_delay(), None);
    }
}
