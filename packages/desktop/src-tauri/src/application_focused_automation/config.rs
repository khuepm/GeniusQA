//! Configuration management for application-focused automation

use crate::application_focused_automation::types::FocusLossStrategy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::io::Write;

/// Configuration for application focus monitoring and automation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationFocusConfig {
    /// Interval for focus checking in milliseconds (fallback polling)
    pub focus_check_interval_ms: u64,
    /// Maximum number of registered applications allowed
    pub max_registered_applications: usize,
    /// Delay before auto-resuming after focus is regained (milliseconds)
    pub auto_resume_delay_ms: u64,
    /// Timeout for notifications in milliseconds
    pub notification_timeout_ms: u64,
    /// Whether to show focus change notifications
    pub enable_focus_notifications: bool,
    /// Whether to perform strict window validation
    pub strict_window_validation: bool,
    /// Default focus loss strategy for new applications
    pub default_focus_strategy: FocusLossStrategy,
    /// Whether to use platform event hooks (primary method)
    pub use_event_hooks: bool,
    /// Whether to enable fallback polling when event hooks fail
    pub fallback_polling_enabled: bool,
}

impl Default for ApplicationFocusConfig {
    fn default() -> Self {
        Self {
            focus_check_interval_ms: 100,
            max_registered_applications: 50,
            auto_resume_delay_ms: 500,
            notification_timeout_ms: 5000,
            enable_focus_notifications: true,
            strict_window_validation: true,
            default_focus_strategy: FocusLossStrategy::AutoPause,
            use_event_hooks: true,
            fallback_polling_enabled: true,
        }
    }
}

impl ApplicationFocusConfig {
    /// Get the default configuration file path
    pub fn default_config_path() -> PathBuf {
        // Use platform-appropriate config directory
        #[cfg(target_os = "macos")]
        let config_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("~/.config"))
            .join("GeniusQA");
        
        #[cfg(target_os = "windows")]
        let config_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("%APPDATA%"))
            .join("GeniusQA");
        
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let config_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("~/.config"))
            .join("GeniusQA");
        
        config_dir.join("application_focus_config.json")
    }
    
    /// Load configuration from file, creating default if file doesn't exist
    pub fn load() -> Result<Self, ConfigError> {
        Self::load_from_path(&Self::default_config_path())
    }
    
    /// Load configuration from a specific path
    pub fn load_from_path<P: AsRef<Path>>(path: P) -> Result<Self, ConfigError> {
        let path = path.as_ref();
        
        if !path.exists() {
            // Create default configuration and save it
            let default_config = Self::default();
            default_config.save_to_path(path)?;
            return Ok(default_config);
        }
        
        let content = fs::read_to_string(path)
            .map_err(|e| ConfigError::IoError(format!("Failed to read config file: {}", e)))?;
        
        let config: Self = serde_json::from_str(&content)
            .map_err(|e| ConfigError::ParseError(format!("Failed to parse config JSON: {}", e)))?;
        
        // Validate the loaded configuration
        config.validate()?;
        
        Ok(config)
    }
    
    /// Save configuration to default file path
    pub fn save(&self) -> Result<(), ConfigError> {
        self.save_to_path(&Self::default_config_path())
    }
    
    /// Save configuration to a specific path
    pub fn save_to_path<P: AsRef<Path>>(&self, path: P) -> Result<(), ConfigError> {
        let path = path.as_ref();
        
        // Validate configuration before saving
        self.validate()?;
        
        // Create parent directory if it doesn't exist
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| ConfigError::IoError(format!("Failed to create config directory: {}", e)))?;
        }
        
        // Serialize configuration to JSON with pretty formatting
        let json_content = serde_json::to_string_pretty(self)
            .map_err(|e| ConfigError::SerializationError(format!("Failed to serialize config: {}", e)))?;
        
        // Write to file atomically (write to temp file, then rename)
        let temp_path = path.with_extension("tmp");
        {
            let mut file = fs::File::create(&temp_path)
                .map_err(|e| ConfigError::IoError(format!("Failed to create temp config file: {}", e)))?;
            
            file.write_all(json_content.as_bytes())
                .map_err(|e| ConfigError::IoError(format!("Failed to write config content: {}", e)))?;
            
            file.sync_all()
                .map_err(|e| ConfigError::IoError(format!("Failed to sync config file: {}", e)))?;
        }
        
        // Atomically replace the original file
        fs::rename(&temp_path, path)
            .map_err(|e| ConfigError::IoError(format!("Failed to replace config file: {}", e)))?;
        
        Ok(())
    }
    
    /// Validate configuration values
    pub fn validate(&self) -> Result<(), ConfigError> {
        if self.focus_check_interval_ms == 0 {
            return Err(ConfigError::ValidationError("focus_check_interval_ms must be greater than 0".to_string()));
        }
        
        if self.focus_check_interval_ms > 10000 {
            return Err(ConfigError::ValidationError("focus_check_interval_ms should not exceed 10 seconds (10000ms)".to_string()));
        }
        
        if self.max_registered_applications == 0 {
            return Err(ConfigError::ValidationError("max_registered_applications must be greater than 0".to_string()));
        }
        
        if self.max_registered_applications > 1000 {
            return Err(ConfigError::ValidationError("max_registered_applications should not exceed 1000".to_string()));
        }
        
        if self.auto_resume_delay_ms > 30000 {
            return Err(ConfigError::ValidationError("auto_resume_delay_ms should not exceed 30 seconds (30000ms)".to_string()));
        }
        
        if self.notification_timeout_ms == 0 {
            return Err(ConfigError::ValidationError("notification_timeout_ms must be greater than 0".to_string()));
        }
        
        if self.notification_timeout_ms > 300000 {
            return Err(ConfigError::ValidationError("notification_timeout_ms should not exceed 5 minutes (300000ms)".to_string()));
        }
        
        Ok(())
    }
    
    /// Reset configuration to default values
    pub fn reset_to_default(&mut self) {
        *self = Self::default();
    }
    
    /// Update a specific configuration field with validation
    pub fn update_focus_check_interval(&mut self, interval_ms: u64) -> Result<(), ConfigError> {
        if interval_ms == 0 || interval_ms > 10000 {
            return Err(ConfigError::ValidationError("focus_check_interval_ms must be between 1 and 10000".to_string()));
        }
        self.focus_check_interval_ms = interval_ms;
        Ok(())
    }
    
    /// Update max registered applications with validation
    pub fn update_max_registered_applications(&mut self, max_apps: usize) -> Result<(), ConfigError> {
        if max_apps == 0 || max_apps > 1000 {
            return Err(ConfigError::ValidationError("max_registered_applications must be between 1 and 1000".to_string()));
        }
        self.max_registered_applications = max_apps;
        Ok(())
    }
    
    /// Update auto resume delay with validation
    pub fn update_auto_resume_delay(&mut self, delay_ms: u64) -> Result<(), ConfigError> {
        if delay_ms > 30000 {
            return Err(ConfigError::ValidationError("auto_resume_delay_ms should not exceed 30000".to_string()));
        }
        self.auto_resume_delay_ms = delay_ms;
        Ok(())
    }
    
    /// Update notification timeout with validation
    pub fn update_notification_timeout(&mut self, timeout_ms: u64) -> Result<(), ConfigError> {
        if timeout_ms == 0 || timeout_ms > 300000 {
            return Err(ConfigError::ValidationError("notification_timeout_ms must be between 1 and 300000".to_string()));
        }
        self.notification_timeout_ms = timeout_ms;
        Ok(())
    }
    
    /// Update default focus strategy
    pub fn update_default_focus_strategy(&mut self, strategy: FocusLossStrategy) {
        self.default_focus_strategy = strategy;
    }
    
    /// Toggle focus notifications
    pub fn toggle_focus_notifications(&mut self) {
        self.enable_focus_notifications = !self.enable_focus_notifications;
    }
    
    /// Toggle strict window validation
    pub fn toggle_strict_window_validation(&mut self) {
        self.strict_window_validation = !self.strict_window_validation;
    }
    
    /// Toggle event hooks usage
    pub fn toggle_event_hooks(&mut self) {
        self.use_event_hooks = !self.use_event_hooks;
    }
    
    /// Toggle fallback polling
    pub fn toggle_fallback_polling(&mut self) {
        self.fallback_polling_enabled = !self.fallback_polling_enabled;
    }
}

/// Configuration-related errors
#[derive(Debug, Clone)]
pub enum ConfigError {
    /// IO error during file operations
    IoError(String),
    /// JSON parsing error
    ParseError(String),
    /// JSON serialization error
    SerializationError(String),
    /// Configuration validation error
    ValidationError(String),
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConfigError::IoError(msg) => write!(f, "IO Error: {}", msg),
            ConfigError::ParseError(msg) => write!(f, "Parse Error: {}", msg),
            ConfigError::SerializationError(msg) => write!(f, "Serialization Error: {}", msg),
            ConfigError::ValidationError(msg) => write!(f, "Validation Error: {}", msg),
        }
    }
}

impl std::error::Error for ConfigError {}
