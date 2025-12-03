//! Comprehensive logging system for Rust automation core
//! 
//! Provides structured logging with core identification, performance analysis,
//! log rotation, and monitoring capabilities.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tracing::{info, warn, error, debug, trace};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Layer};
use chrono::{DateTime, Utc};

/// Core type identifier for logging
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum CoreType {
    Python,
    Rust,
}

impl std::fmt::Display for CoreType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CoreType::Python => write!(f, "python"),
            CoreType::Rust => write!(f, "rust"),
        }
    }
}

/// Log levels for structured logging
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl From<LogLevel> for tracing::Level {
    fn from(level: LogLevel) -> Self {
        match level {
            LogLevel::Trace => tracing::Level::TRACE,
            LogLevel::Debug => tracing::Level::DEBUG,
            LogLevel::Info => tracing::Level::INFO,
            LogLevel::Warn => tracing::Level::WARN,
            LogLevel::Error => tracing::Level::ERROR,
        }
    }
}

/// Operation types for categorizing log entries
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum OperationType {
    Recording,
    Playback,
    CoreSwitch,
    HealthCheck,
    PerformanceMonitoring,
    ErrorHandling,
    Configuration,
    SystemIntegration,
}

impl std::fmt::Display for OperationType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OperationType::Recording => write!(f, "recording"),
            OperationType::Playback => write!(f, "playback"),
            OperationType::CoreSwitch => write!(f, "core_switch"),
            OperationType::HealthCheck => write!(f, "health_check"),
            OperationType::PerformanceMonitoring => write!(f, "performance_monitoring"),
            OperationType::ErrorHandling => write!(f, "error_handling"),
            OperationType::Configuration => write!(f, "configuration"),
            OperationType::SystemIntegration => write!(f, "system_integration"),
        }
    }
}

/// Structured log entry with core identification and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: DateTime<Utc>,
    pub level: LogLevel,
    pub core_type: CoreType,
    pub operation_type: OperationType,
    pub operation_id: String,
    pub message: String,
    pub metadata: HashMap<String, serde_json::Value>,
    pub duration_ms: Option<u64>,
    pub success: Option<bool>,
    pub error_code: Option<String>,
}

impl LogEntry {
    /// Create a new log entry with automatic timestamp
    pub fn new(
        level: LogLevel,
        core_type: CoreType,
        operation_type: OperationType,
        operation_id: String,
        message: String,
    ) -> Self {
        Self {
            timestamp: Utc::now(),
            level,
            core_type,
            operation_type,
            operation_id,
            message,
            metadata: HashMap::new(),
            duration_ms: None,
            success: None,
            error_code: None,
        }
    }

    /// Add metadata to the log entry
    pub fn with_metadata(mut self, key: String, value: serde_json::Value) -> Self {
        self.metadata.insert(key, value);
        self
    }

    /// Add duration information
    pub fn with_duration(mut self, duration: std::time::Duration) -> Self {
        self.duration_ms = Some(duration.as_millis() as u64);
        self
    }

    /// Mark operation as successful or failed
    pub fn with_success(mut self, success: bool) -> Self {
        self.success = Some(success);
        self
    }

    /// Add error code for failed operations
    pub fn with_error_code(mut self, error_code: String) -> Self {
        self.error_code = Some(error_code);
        self
    }
}

/// Configuration for the logging system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub log_level: LogLevel,
    pub log_to_file: bool,
    pub log_to_console: bool,
    pub log_directory: PathBuf,
    pub max_file_size_mb: u64,
    pub max_files: u32,
    pub enable_json_format: bool,
    pub enable_performance_logging: bool,
    pub buffer_size: usize,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            log_level: LogLevel::Info,
            log_to_file: true,
            log_to_console: true,
            log_directory: dirs::data_local_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("GeniusQA")
                .join("logs"),
            max_file_size_mb: 10,
            max_files: 5,
            enable_json_format: true,
            enable_performance_logging: true,
            buffer_size: 1000,
        }
    }
}

/// Performance metrics for log analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceLogMetrics {
    pub operation_type: OperationType,
    pub core_type: CoreType,
    pub avg_duration_ms: f64,
    pub min_duration_ms: u64,
    pub max_duration_ms: u64,
    pub success_rate: f64,
    pub total_operations: u64,
    pub error_count: u64,
    pub last_updated: DateTime<Utc>,
}

/// Log rotation manager
#[derive(Debug)]
pub struct LogRotationManager {
    config: LoggingConfig,
    current_file_size: Arc<Mutex<u64>>,
    file_counter: Arc<Mutex<u32>>,
}

impl LogRotationManager {
    pub fn new(config: LoggingConfig) -> Self {
        Self {
            config,
            current_file_size: Arc::new(Mutex::new(0)),
            file_counter: Arc::new(Mutex::new(0)),
        }
    }

    /// Check if log rotation is needed
    pub fn should_rotate(&self) -> bool {
        let current_size = *self.current_file_size.lock().unwrap();
        current_size > (self.config.max_file_size_mb * 1024 * 1024)
    }

    /// Perform log rotation
    pub fn rotate_logs(&self) -> Result<PathBuf, std::io::Error> {
        let mut counter = self.file_counter.lock().unwrap();
        *counter = (*counter + 1) % self.config.max_files;
        
        let new_file_path = self.config.log_directory
            .join(format!("rust_automation_core_{}.log", *counter));
        
        // Reset file size counter
        let mut size = self.current_file_size.lock().unwrap();
        *size = 0;
        
        Ok(new_file_path)
    }

    /// Update current file size
    pub fn update_file_size(&self, additional_bytes: u64) {
        let mut size = self.current_file_size.lock().unwrap();
        *size += additional_bytes;
    }
}

/// Main logging system for the Rust automation core
pub struct AutomationLogger {
    config: LoggingConfig,
    rotation_manager: LogRotationManager,
    log_buffer: Arc<Mutex<Vec<LogEntry>>>,
    performance_metrics: Arc<Mutex<HashMap<(OperationType, CoreType), PerformanceLogMetrics>>>,
    _file_appender: Option<tracing_appender::non_blocking::WorkerGuard>,
}

impl AutomationLogger {
    /// Initialize the logging system with configuration
    pub fn new(config: LoggingConfig) -> Result<Self, Box<dyn std::error::Error>> {
        // Create log directory if it doesn't exist
        std::fs::create_dir_all(&config.log_directory)?;

        // Set up tracing subscriber
        let env_filter = EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| {
                let level_str = match config.log_level {
                    LogLevel::Trace => "trace",
                    LogLevel::Debug => "debug", 
                    LogLevel::Info => "info",
                    LogLevel::Warn => "warn",
                    LogLevel::Error => "error",
                };
                EnvFilter::new(format!("rust_automation_core={}", level_str))
            });

        let mut layers = Vec::new();

        // Console logging
        if config.log_to_console {
            let console_layer = tracing_subscriber::fmt::layer()
                .with_target(true)
                .with_thread_ids(true)
                .with_file(true)
                .with_line_number(true);
            
            if config.enable_json_format {
                layers.push(console_layer.json().boxed());
            } else {
                layers.push(console_layer.boxed());
            }
        }

        // File logging with rotation
        let file_appender = if config.log_to_file {
            let file_appender = tracing_appender::rolling::daily(
                &config.log_directory,
                "rust_automation_core.log"
            );
            let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
            
            let file_layer = tracing_subscriber::fmt::layer()
                .with_writer(non_blocking)
                .with_target(true)
                .with_thread_ids(true)
                .with_file(true)
                .with_line_number(true);

            if config.enable_json_format {
                layers.push(file_layer.json().boxed());
            } else {
                layers.push(file_layer.boxed());
            }

            Some(guard)
        } else {
            None
        };

        // Initialize the subscriber (ignore error if already set)
        let _ = tracing_subscriber::registry()
            .with(env_filter)
            .with(layers)
            .try_init();

        let rotation_manager = LogRotationManager::new(config.clone());

        Ok(Self {
            config: config.clone(),
            rotation_manager,
            log_buffer: Arc::new(Mutex::new(Vec::with_capacity(config.buffer_size))),
            performance_metrics: Arc::new(Mutex::new(HashMap::new())),
            _file_appender: file_appender,
        })
    }

    /// Log an operation with core identification
    pub fn log_operation(
        &self,
        level: LogLevel,
        core_type: CoreType,
        operation_type: OperationType,
        operation_id: String,
        message: String,
        metadata: Option<HashMap<String, serde_json::Value>>,
    ) {
        let mut entry = LogEntry::new(level.clone(), core_type.clone(), operation_type.clone(), operation_id.clone(), message.clone());
        
        if let Some(meta) = metadata {
            for (key, value) in meta {
                entry = entry.with_metadata(key, value);
            }
        }

        // Add to buffer
        {
            let mut buffer = self.log_buffer.lock().unwrap();
            buffer.push(entry.clone());
            
            // Flush buffer if it's full
            if buffer.len() >= self.config.buffer_size {
                self.flush_buffer_internal(&mut buffer);
            }
        }

        // Log using tracing
        let span = tracing::span!(
            tracing::Level::INFO,
            "automation_operation",
            core_type = %core_type,
            operation_type = %operation_type,
            operation_id = %operation_id
        );
        let _enter = span.enter();

        match level {
            LogLevel::Trace => trace!("{}", message),
            LogLevel::Debug => debug!("{}", message),
            LogLevel::Info => info!("{}", message),
            LogLevel::Warn => warn!("{}", message),
            LogLevel::Error => error!("{}", message),
        }
    }

    /// Log operation start with timing
    pub fn log_operation_start(
        &self,
        core_type: CoreType,
        operation_type: OperationType,
        operation_id: String,
        message: String,
    ) -> OperationTimer {
        self.log_operation(
            LogLevel::Info,
            core_type.clone(),
            operation_type.clone(),
            operation_id.clone(),
            format!("Starting: {}", message),
            None,
        );

        OperationTimer::new(self, core_type, operation_type, operation_id)
    }

    /// Log operation completion with performance metrics
    pub fn log_operation_complete(
        &self,
        core_type: CoreType,
        operation_type: OperationType,
        operation_id: String,
        message: String,
        duration: std::time::Duration,
        success: bool,
        error_code: Option<String>,
    ) {
        let mut metadata = HashMap::new();
        metadata.insert("duration_ms".to_string(), serde_json::json!(duration.as_millis()));
        metadata.insert("success".to_string(), serde_json::json!(success));
        
        if let Some(code) = &error_code {
            metadata.insert("error_code".to_string(), serde_json::json!(code));
        }

        let level = if success { LogLevel::Info } else { LogLevel::Error };
        
        let mut entry = LogEntry::new(level.clone(), core_type.clone(), operation_type.clone(), operation_id.clone(), message.clone())
            .with_duration(duration)
            .with_success(success);
            
        if let Some(code) = error_code {
            entry = entry.with_error_code(code);
        }

        self.log_operation(level, core_type.clone(), operation_type.clone(), operation_id, message, Some(metadata));

        // Update performance metrics if enabled
        if self.config.enable_performance_logging {
            self.update_performance_metrics(core_type, operation_type, duration, success);
        }
    }

    /// Update performance metrics for analysis
    fn update_performance_metrics(
        &self,
        core_type: CoreType,
        operation_type: OperationType,
        duration: std::time::Duration,
        success: bool,
    ) {
        let mut metrics = self.performance_metrics.lock().unwrap();
        let key = (operation_type.clone(), core_type.clone());
        
        let entry = metrics.entry(key).or_insert_with(|| PerformanceLogMetrics {
            operation_type: operation_type.clone(),
            core_type: core_type.clone(),
            avg_duration_ms: 0.0,
            min_duration_ms: u64::MAX,
            max_duration_ms: 0,
            success_rate: 1.0,
            total_operations: 0,
            error_count: 0,
            last_updated: Utc::now(),
        });

        let duration_ms = duration.as_millis() as u64;
        
        // Update duration statistics
        entry.min_duration_ms = entry.min_duration_ms.min(duration_ms);
        entry.max_duration_ms = entry.max_duration_ms.max(duration_ms);
        
        // Update average duration
        let total_duration = entry.avg_duration_ms * entry.total_operations as f64 + duration_ms as f64;
        entry.total_operations += 1;
        entry.avg_duration_ms = total_duration / entry.total_operations as f64;
        
        // Update success rate
        if !success {
            entry.error_count += 1;
        }
        entry.success_rate = (entry.total_operations - entry.error_count) as f64 / entry.total_operations as f64;
        
        entry.last_updated = Utc::now();
    }

    /// Get performance metrics for analysis
    pub fn get_performance_metrics(&self) -> HashMap<(OperationType, CoreType), PerformanceLogMetrics> {
        let metrics = self.performance_metrics.lock().unwrap();
        metrics.clone()
    }

    /// Get performance metrics for a specific core and operation type
    pub fn get_metrics_for_operation(
        &self,
        core_type: &CoreType,
        operation_type: &OperationType,
    ) -> Option<PerformanceLogMetrics> {
        let metrics = self.performance_metrics.lock().unwrap();
        metrics.get(&(operation_type.clone(), core_type.clone())).cloned()
    }

    /// Flush log buffer to persistent storage
    pub fn flush_buffer(&self) {
        let mut buffer = self.log_buffer.lock().unwrap();
        self.flush_buffer_internal(&mut buffer);
    }

    fn flush_buffer_internal(&self, buffer: &mut Vec<LogEntry>) {
        if buffer.is_empty() {
            return;
        }

        // In a real implementation, you might write to a database or structured log file
        // For now, we'll just clear the buffer as the tracing system handles persistence
        info!("Flushing {} log entries to persistent storage", buffer.len());
        buffer.clear();
    }

    /// Get recent log entries from buffer
    pub fn get_recent_logs(&self, limit: usize) -> Vec<LogEntry> {
        let buffer = self.log_buffer.lock().unwrap();
        buffer.iter().rev().take(limit).cloned().collect()
    }

    /// Search logs by criteria
    pub fn search_logs(
        &self,
        core_type: Option<CoreType>,
        operation_type: Option<OperationType>,
        level: Option<LogLevel>,
        since: Option<DateTime<Utc>>,
    ) -> Vec<LogEntry> {
        let buffer = self.log_buffer.lock().unwrap();
        
        buffer.iter()
            .filter(|entry| {
                if let Some(ref ct) = core_type {
                    if entry.core_type != *ct {
                        return false;
                    }
                }
                if let Some(ref ot) = operation_type {
                    if entry.operation_type != *ot {
                        return false;
                    }
                }
                if let Some(ref l) = level {
                    if entry.level != *l {
                        return false;
                    }
                }
                if let Some(ref s) = since {
                    if entry.timestamp < *s {
                        return false;
                    }
                }
                true
            })
            .cloned()
            .collect()
    }

    /// Generate performance report
    pub fn generate_performance_report(&self) -> PerformanceReport {
        let metrics = self.performance_metrics.lock().unwrap();
        
        let mut core_summaries = HashMap::new();
        let mut operation_summaries = HashMap::new();
        
        for ((operation_type, core_type), metric) in metrics.iter() {
            // Core summary
            let core_summary = core_summaries.entry(core_type.clone()).or_insert_with(|| CorePerformanceSummary {
                core_type: core_type.clone(),
                total_operations: 0,
                avg_duration_ms: 0.0,
                success_rate: 0.0,
                operation_counts: HashMap::new(),
            });
            
            core_summary.total_operations += metric.total_operations;
            core_summary.operation_counts.insert(operation_type.clone(), metric.total_operations);
            
            // Operation summary
            let op_summary = operation_summaries.entry(operation_type.clone()).or_insert_with(|| OperationPerformanceSummary {
                operation_type: operation_type.clone(),
                total_operations: 0,
                avg_duration_ms: 0.0,
                success_rate: 0.0,
                core_performance: HashMap::new(),
            });
            
            op_summary.total_operations += metric.total_operations;
            op_summary.core_performance.insert(core_type.clone(), metric.clone());
        }
        
        // Calculate weighted averages for core summaries
        for (core_type, summary) in core_summaries.iter_mut() {
            let mut total_weighted_duration = 0.0;
            let mut total_weighted_success = 0.0;
            
            for ((op_type, ct), metric) in metrics.iter() {
                if ct == core_type {
                    let weight = metric.total_operations as f64;
                    total_weighted_duration += metric.avg_duration_ms * weight;
                    total_weighted_success += metric.success_rate * weight;
                }
            }
            
            if summary.total_operations > 0 {
                summary.avg_duration_ms = total_weighted_duration / summary.total_operations as f64;
                summary.success_rate = total_weighted_success / summary.total_operations as f64;
            }
        }
        
        // Calculate weighted averages for operation summaries
        for (operation_type, summary) in operation_summaries.iter_mut() {
            let mut total_weighted_duration = 0.0;
            let mut total_weighted_success = 0.0;
            
            for ((op_type, _), metric) in metrics.iter() {
                if op_type == operation_type {
                    let weight = metric.total_operations as f64;
                    total_weighted_duration += metric.avg_duration_ms * weight;
                    total_weighted_success += metric.success_rate * weight;
                }
            }
            
            if summary.total_operations > 0 {
                summary.avg_duration_ms = total_weighted_duration / summary.total_operations as f64;
                summary.success_rate = total_weighted_success / summary.total_operations as f64;
            }
        }
        
        PerformanceReport {
            generated_at: Utc::now(),
            core_summaries,
            operation_summaries,
            raw_metrics: metrics.clone(),
        }
    }
}

/// Timer for tracking operation duration
pub struct OperationTimer<'a> {
    logger: &'a AutomationLogger,
    core_type: CoreType,
    operation_type: OperationType,
    operation_id: String,
    start_time: std::time::Instant,
}

impl<'a> OperationTimer<'a> {
    fn new(
        logger: &'a AutomationLogger,
        core_type: CoreType,
        operation_type: OperationType,
        operation_id: String,
    ) -> Self {
        Self {
            logger,
            core_type,
            operation_type,
            operation_id,
            start_time: std::time::Instant::now(),
        }
    }

    /// Complete the operation with success
    pub fn complete_success(self, message: String) {
        let duration = self.start_time.elapsed();
        self.logger.log_operation_complete(
            self.core_type,
            self.operation_type,
            self.operation_id,
            message,
            duration,
            true,
            None,
        );
    }

    /// Complete the operation with error
    pub fn complete_error(self, message: String, error_code: String) {
        let duration = self.start_time.elapsed();
        self.logger.log_operation_complete(
            self.core_type,
            self.operation_type,
            self.operation_id,
            message,
            duration,
            false,
            Some(error_code),
        );
    }
}

/// Performance report structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceReport {
    pub generated_at: DateTime<Utc>,
    pub core_summaries: HashMap<CoreType, CorePerformanceSummary>,
    pub operation_summaries: HashMap<OperationType, OperationPerformanceSummary>,
    pub raw_metrics: HashMap<(OperationType, CoreType), PerformanceLogMetrics>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorePerformanceSummary {
    pub core_type: CoreType,
    pub total_operations: u64,
    pub avg_duration_ms: f64,
    pub success_rate: f64,
    pub operation_counts: HashMap<OperationType, u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationPerformanceSummary {
    pub operation_type: OperationType,
    pub total_operations: u64,
    pub avg_duration_ms: f64,
    pub success_rate: f64,
    pub core_performance: HashMap<CoreType, PerformanceLogMetrics>,
}

/// Global logger instance
static mut GLOBAL_LOGGER: Option<AutomationLogger> = None;
static LOGGER_INIT: std::sync::Once = std::sync::Once::new();

/// Initialize the global logger
pub fn init_logger(config: LoggingConfig) -> Result<(), Box<dyn std::error::Error>> {
    LOGGER_INIT.call_once(|| {
        match AutomationLogger::new(config) {
            Ok(logger) => {
                unsafe {
                    GLOBAL_LOGGER = Some(logger);
                }
            }
            Err(e) => {
                eprintln!("Failed to initialize logger: {}", e);
            }
        }
    });
    Ok(())
}

/// Get reference to global logger
pub fn get_logger() -> Option<&'static AutomationLogger> {
    unsafe { GLOBAL_LOGGER.as_ref() }
}

/// Convenience macros for logging with core identification
#[macro_export]
macro_rules! log_automation {
    ($level:expr, $core_type:expr, $operation_type:expr, $operation_id:expr, $message:expr) => {
        if let Some(logger) = $crate::logging::get_logger() {
            logger.log_operation($level, $core_type, $operation_type, $operation_id, $message, None);
        }
    };
    ($level:expr, $core_type:expr, $operation_type:expr, $operation_id:expr, $message:expr, $metadata:expr) => {
        if let Some(logger) = $crate::logging::get_logger() {
            logger.log_operation($level, $core_type, $operation_type, $operation_id, $message, Some($metadata));
        }
    };
}

#[macro_export]
macro_rules! log_operation_start {
    ($core_type:expr, $operation_type:expr, $operation_id:expr, $message:expr) => {
        if let Some(logger) = $crate::logging::get_logger() {
            logger.log_operation_start($core_type, $operation_type, $operation_id, $message)
        } else {
            // Return a dummy timer if logger is not available
            $crate::logging::OperationTimer::new(
                &$crate::logging::AutomationLogger::new($crate::logging::LoggingConfig::default()).unwrap(),
                $core_type,
                $operation_type,
                $operation_id
            )
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_config() -> LoggingConfig {
        let temp_dir = TempDir::new().unwrap();
        LoggingConfig {
            log_directory: temp_dir.path().to_path_buf(),
            log_to_console: false, // Disable console logging in tests
            ..LoggingConfig::default()
        }
    }

    #[test]
    fn test_log_entry_creation() {
        let entry = LogEntry::new(
            LogLevel::Info,
            CoreType::Rust,
            OperationType::Recording,
            "test_op_001".to_string(),
            "Test message".to_string(),
        );

        assert_eq!(entry.level, LogLevel::Info);
        assert_eq!(entry.core_type, CoreType::Rust);
        assert_eq!(entry.operation_type, OperationType::Recording);
        assert_eq!(entry.operation_id, "test_op_001");
        assert_eq!(entry.message, "Test message");
        assert!(entry.metadata.is_empty());
    }

    #[test]
    fn test_log_entry_with_metadata() {
        let mut metadata = HashMap::new();
        metadata.insert("user_id".to_string(), serde_json::json!("user123"));
        metadata.insert("duration".to_string(), serde_json::json!(1500));

        let entry = LogEntry::new(
            LogLevel::Info,
            CoreType::Python,
            OperationType::Playback,
            "test_op_002".to_string(),
            "Playback completed".to_string(),
        )
        .with_metadata("user_id".to_string(), serde_json::json!("user123"))
        .with_metadata("duration".to_string(), serde_json::json!(1500))
        .with_duration(std::time::Duration::from_millis(1500))
        .with_success(true);

        assert_eq!(entry.metadata.len(), 2);
        assert_eq!(entry.duration_ms, Some(1500));
        assert_eq!(entry.success, Some(true));
    }

    #[test]
    fn test_logger_initialization() {
        let config = create_test_config();
        let logger = AutomationLogger::new(config).unwrap();

        // Test basic logging
        logger.log_operation(
            LogLevel::Info,
            CoreType::Rust,
            OperationType::Recording,
            "test_001".to_string(),
            "Test log message".to_string(),
            None,
        );

        let recent_logs = logger.get_recent_logs(10);
        assert_eq!(recent_logs.len(), 1);
        assert_eq!(recent_logs[0].message, "Test log message");
    }

    #[test]
    fn test_performance_metrics_tracking() {
        let config = create_test_config();
        let logger = AutomationLogger::new(config).unwrap();

        // Log several operations with different durations and success rates
        logger.log_operation_complete(
            CoreType::Rust,
            OperationType::Recording,
            "op_001".to_string(),
            "Recording completed".to_string(),
            std::time::Duration::from_millis(1000),
            true,
            None,
        );

        logger.log_operation_complete(
            CoreType::Rust,
            OperationType::Recording,
            "op_002".to_string(),
            "Recording failed".to_string(),
            std::time::Duration::from_millis(500),
            false,
            Some("PERMISSION_DENIED".to_string()),
        );

        logger.log_operation_complete(
            CoreType::Rust,
            OperationType::Recording,
            "op_003".to_string(),
            "Recording completed".to_string(),
            std::time::Duration::from_millis(1500),
            true,
            None,
        );

        let metrics = logger.get_metrics_for_operation(&CoreType::Rust, &OperationType::Recording);
        assert!(metrics.is_some());

        let metrics = metrics.unwrap();
        assert_eq!(metrics.total_operations, 3);
        assert_eq!(metrics.error_count, 1);
        assert_eq!(metrics.success_rate, 2.0 / 3.0);
        assert_eq!(metrics.avg_duration_ms, 1000.0); // (1000 + 500 + 1500) / 3
        assert_eq!(metrics.min_duration_ms, 500);
        assert_eq!(metrics.max_duration_ms, 1500);
    }

    #[test]
    fn test_log_search() {
        let config = create_test_config();
        let logger = AutomationLogger::new(config).unwrap();

        // Log entries with different criteria
        logger.log_operation(
            LogLevel::Info,
            CoreType::Rust,
            OperationType::Recording,
            "op_001".to_string(),
            "Rust recording".to_string(),
            None,
        );

        logger.log_operation(
            LogLevel::Error,
            CoreType::Python,
            OperationType::Playback,
            "op_002".to_string(),
            "Python playback error".to_string(),
            None,
        );

        logger.log_operation(
            LogLevel::Warn,
            CoreType::Rust,
            OperationType::HealthCheck,
            "op_003".to_string(),
            "Rust health warning".to_string(),
            None,
        );

        // Search by core type
        let rust_logs = logger.search_logs(Some(CoreType::Rust), None, None, None);
        assert_eq!(rust_logs.len(), 2);

        // Search by operation type
        let recording_logs = logger.search_logs(None, Some(OperationType::Recording), None, None);
        assert_eq!(recording_logs.len(), 1);

        // Search by log level
        let error_logs = logger.search_logs(None, None, Some(LogLevel::Error), None);
        assert_eq!(error_logs.len(), 1);
        assert_eq!(error_logs[0].message, "Python playback error");
    }

    #[test]
    fn test_operation_timer() {
        let config = create_test_config();
        let logger = AutomationLogger::new(config).unwrap();

        let timer = logger.log_operation_start(
            CoreType::Rust,
            OperationType::Recording,
            "timed_op_001".to_string(),
            "Starting timed operation".to_string(),
        );

        // Simulate some work
        std::thread::sleep(std::time::Duration::from_millis(10));

        timer.complete_success("Timed operation completed successfully".to_string());

        let metrics = logger.get_metrics_for_operation(&CoreType::Rust, &OperationType::Recording);
        assert!(metrics.is_some());

        let metrics = metrics.unwrap();
        assert_eq!(metrics.total_operations, 1);
        assert_eq!(metrics.success_rate, 1.0);
        assert!(metrics.avg_duration_ms >= 10.0); // Should be at least 10ms
    }

    #[test]
    fn test_performance_report_generation() {
        let config = create_test_config();
        let logger = AutomationLogger::new(config).unwrap();

        // Log operations for different cores and operation types
        logger.log_operation_complete(
            CoreType::Rust,
            OperationType::Recording,
            "op_001".to_string(),
            "Rust recording".to_string(),
            std::time::Duration::from_millis(1000),
            true,
            None,
        );

        logger.log_operation_complete(
            CoreType::Python,
            OperationType::Recording,
            "op_002".to_string(),
            "Python recording".to_string(),
            std::time::Duration::from_millis(1500),
            true,
            None,
        );

        logger.log_operation_complete(
            CoreType::Rust,
            OperationType::Playback,
            "op_003".to_string(),
            "Rust playback".to_string(),
            std::time::Duration::from_millis(800),
            false,
            Some("SCRIPT_ERROR".to_string()),
        );

        let report = logger.generate_performance_report();

        // Check core summaries
        assert_eq!(report.core_summaries.len(), 2);
        assert!(report.core_summaries.contains_key(&CoreType::Rust));
        assert!(report.core_summaries.contains_key(&CoreType::Python));

        let rust_summary = &report.core_summaries[&CoreType::Rust];
        assert_eq!(rust_summary.total_operations, 2);
        assert_eq!(rust_summary.success_rate, 0.5); // 1 success out of 2

        // Check operation summaries
        assert_eq!(report.operation_summaries.len(), 2);
        assert!(report.operation_summaries.contains_key(&OperationType::Recording));
        assert!(report.operation_summaries.contains_key(&OperationType::Playback));

        let recording_summary = &report.operation_summaries[&OperationType::Recording];
        assert_eq!(recording_summary.total_operations, 2);
        assert_eq!(recording_summary.success_rate, 1.0); // Both recordings succeeded
    }

    #[test]
    fn test_log_rotation_manager() {
        let config = create_test_config();
        let rotation_manager = LogRotationManager::new(config);

        // Initially should not need rotation
        assert!(!rotation_manager.should_rotate());

        // Simulate large file size
        rotation_manager.update_file_size(15 * 1024 * 1024); // 15MB
        assert!(rotation_manager.should_rotate());

        // Test rotation
        let new_path = rotation_manager.rotate_logs().unwrap();
        assert!(new_path.to_string_lossy().contains("rust_automation_core_"));

        // After rotation, should not need rotation
        assert!(!rotation_manager.should_rotate());
    }

    #[test]
    fn test_core_type_display() {
        assert_eq!(CoreType::Python.to_string(), "python");
        assert_eq!(CoreType::Rust.to_string(), "rust");
    }

    #[test]
    fn test_operation_type_display() {
        assert_eq!(OperationType::Recording.to_string(), "recording");
        assert_eq!(OperationType::Playback.to_string(), "playback");
        assert_eq!(OperationType::CoreSwitch.to_string(), "core_switch");
        assert_eq!(OperationType::HealthCheck.to_string(), "health_check");
    }

    #[test]
    fn test_log_level_conversion() {
        assert_eq!(tracing::Level::from(LogLevel::Trace), tracing::Level::TRACE);
        assert_eq!(tracing::Level::from(LogLevel::Debug), tracing::Level::DEBUG);
        assert_eq!(tracing::Level::from(LogLevel::Info), tracing::Level::INFO);
        assert_eq!(tracing::Level::from(LogLevel::Warn), tracing::Level::WARN);
        assert_eq!(tracing::Level::from(LogLevel::Error), tracing::Level::ERROR);
    }
}
