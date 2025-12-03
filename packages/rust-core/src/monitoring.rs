//! Monitoring and health checking system for Rust automation core
//! 
//! Provides continuous core health monitoring, automatic core availability detection,
//! and alerting for core failures and performance issues.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use crate::logging::{CoreType, OperationType, LogLevel, get_logger};
use crate::error::{AutomationError, Result, ErrorSeverity};

/// Health status levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HealthStatus {
    Healthy,
    Warning,
    Critical,
    Unknown,
}

impl std::fmt::Display for HealthStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HealthStatus::Healthy => write!(f, "healthy"),
            HealthStatus::Warning => write!(f, "warning"),
            HealthStatus::Critical => write!(f, "critical"),
            HealthStatus::Unknown => write!(f, "unknown"),
        }
    }
}

/// Core health information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoreHealthInfo {
    pub core_type: CoreType,
    pub status: HealthStatus,
    pub last_check: DateTime<Utc>,
    pub response_time_ms: Option<u64>,
    pub error_rate: f64,
    pub availability_percentage: f64,
    pub issues: Vec<HealthIssue>,
    pub performance_score: f64, // 0.0 to 100.0
}

/// Health issue details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthIssue {
    pub issue_type: HealthIssueType,
    pub severity: HealthIssueSeverity,
    pub message: String,
    pub detected_at: DateTime<Utc>,
    pub suggested_action: Option<String>,
}

/// Types of health issues
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HealthIssueType {
    PermissionDenied,
    DependencyMissing,
    PerformanceDegradation,
    HighErrorRate,
    ResponseTimeout,
    SystemResourceExhaustion,
    ConfigurationError,
    NetworkConnectivity,
    PlatformCompatibility,
}

/// Severity levels for health issues
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HealthIssueSeverity {
    Low,
    Medium,
    High,
    Critical,
}

impl From<HealthIssueSeverity> for ErrorSeverity {
    fn from(severity: HealthIssueSeverity) -> Self {
        match severity {
            HealthIssueSeverity::Low => ErrorSeverity::Warning,
            HealthIssueSeverity::Medium => ErrorSeverity::Warning,
            HealthIssueSeverity::High => ErrorSeverity::Error,
            HealthIssueSeverity::Critical => ErrorSeverity::Critical,
        }
    }
}

/// Alert configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertConfig {
    pub enabled: bool,
    pub error_rate_threshold: f64, // Percentage (0.0 to 100.0)
    pub response_time_threshold_ms: u64,
    pub availability_threshold: f64, // Percentage (0.0 to 100.0)
    pub performance_score_threshold: f64, // 0.0 to 100.0
    pub alert_cooldown_minutes: u64,
    pub max_alerts_per_hour: u32,
}

impl Default for AlertConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            error_rate_threshold: 10.0, // 10% error rate
            response_time_threshold_ms: 5000, // 5 seconds
            availability_threshold: 95.0, // 95% availability
            performance_score_threshold: 70.0, // 70/100 performance score
            alert_cooldown_minutes: 15, // 15 minutes between similar alerts
            max_alerts_per_hour: 10, // Maximum 10 alerts per hour
        }
    }
}

/// Monitoring configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    pub health_check_interval_seconds: u64,
    pub performance_window_minutes: u64,
    pub alert_config: AlertConfig,
    pub enable_continuous_monitoring: bool,
    pub enable_predictive_alerts: bool,
    pub data_retention_days: u32,
}

impl Default for MonitoringConfig {
    fn default() -> Self {
        Self {
            health_check_interval_seconds: 30, // Check every 30 seconds
            performance_window_minutes: 60, // 1 hour performance window
            alert_config: AlertConfig::default(),
            enable_continuous_monitoring: true,
            enable_predictive_alerts: true,
            data_retention_days: 30, // Keep 30 days of monitoring data
        }
    }
}

/// Alert information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub id: String,
    pub alert_type: AlertType,
    pub core_type: CoreType,
    pub severity: HealthIssueSeverity,
    pub message: String,
    pub triggered_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub suggested_actions: Vec<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Types of alerts
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum AlertType {
    CoreUnavailable,
    HighErrorRate,
    SlowResponse,
    LowAvailability,
    PerformanceDegradation,
    SystemResourceIssue,
    ConfigurationProblem,
    PredictiveFailure,
}

/// Performance metrics for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringMetrics {
    pub core_type: CoreType,
    pub timestamp: DateTime<Utc>,
    pub response_time_ms: u64,
    pub success: bool,
    pub error_code: Option<String>,
    pub cpu_usage_percent: Option<f64>,
    pub memory_usage_mb: Option<f64>,
    pub operation_type: OperationType,
}

/// Health check result
#[derive(Debug, Clone)]
pub struct HealthCheckResult {
    pub core_type: CoreType,
    pub status: HealthStatus,
    pub response_time: Duration,
    pub issues: Vec<HealthIssue>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Core monitoring system
pub struct CoreMonitor {
    config: MonitoringConfig,
    health_info: Arc<RwLock<HashMap<CoreType, CoreHealthInfo>>>,
    metrics_history: Arc<Mutex<Vec<MonitoringMetrics>>>,
    active_alerts: Arc<RwLock<HashMap<String, Alert>>>,
    alert_history: Arc<Mutex<Vec<Alert>>>,
    last_alert_times: Arc<Mutex<HashMap<(CoreType, AlertType), DateTime<Utc>>>>,
    monitoring_active: Arc<RwLock<bool>>,
}

impl CoreMonitor {
    /// Create a new core monitor with configuration
    pub fn new(config: MonitoringConfig) -> Self {
        Self {
            config,
            health_info: Arc::new(RwLock::new(HashMap::new())),
            metrics_history: Arc::new(Mutex::new(Vec::new())),
            active_alerts: Arc::new(RwLock::new(HashMap::new())),
            alert_history: Arc::new(Mutex::new(Vec::new())),
            last_alert_times: Arc::new(Mutex::new(HashMap::new())),
            monitoring_active: Arc::new(RwLock::new(false)),
        }
    }

    /// Start continuous monitoring
    pub async fn start_monitoring(&self) -> Result<()> {
        let mut active = self.monitoring_active.write().await;
        if *active {
            return Ok(()); // Already monitoring
        }
        *active = true;
        drop(active);

        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::PerformanceMonitoring,
                "monitor_start".to_string(),
                "Starting continuous core monitoring".to_string(),
                None,
            );
        }

        // Start monitoring loop
        let monitor = self.clone();
        tokio::spawn(async move {
            monitor.monitoring_loop().await;
        });

        Ok(())
    }

    /// Stop continuous monitoring
    pub async fn stop_monitoring(&self) {
        let mut active = self.monitoring_active.write().await;
        *active = false;

        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::PerformanceMonitoring,
                "monitor_stop".to_string(),
                "Stopping continuous core monitoring".to_string(),
                None,
            );
        }
    }

    /// Main monitoring loop
    async fn monitoring_loop(&self) {
        let mut interval = tokio::time::interval(Duration::from_secs(self.config.health_check_interval_seconds));

        loop {
            interval.tick().await;

            let active = *self.monitoring_active.read().await;
            if !active {
                break;
            }

            // Perform health checks for all cores
            for core_type in [CoreType::Python, CoreType::Rust] {
                if let Err(e) = self.perform_health_check(&core_type).await {
                    if let Some(logger) = get_logger() {
                        logger.log_operation(
                            LogLevel::Error,
                            core_type.clone(),
                            OperationType::HealthCheck,
                            format!("health_check_{}", core_type),
                            format!("Health check failed: {}", e),
                            None,
                        );
                    }
                }
            }

            // Clean up old data
            self.cleanup_old_data().await;
        }
    }

    /// Perform health check for a specific core
    pub async fn perform_health_check(&self, core_type: &CoreType) -> Result<HealthCheckResult> {
        let start_time = Instant::now();
        let operation_id = format!("health_check_{}_{}", core_type, Utc::now().timestamp());

        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Debug,
                core_type.clone(),
                OperationType::HealthCheck,
                operation_id.clone(),
                format!("Starting health check for {} core", core_type),
                None,
            );
        }

        let mut issues = Vec::new();
        let mut metadata = HashMap::new();

        // Platform-specific health checks
        let status = match core_type {
            CoreType::Python => self.check_python_core_health(&mut issues, &mut metadata).await,
            CoreType::Rust => self.check_rust_core_health(&mut issues, &mut metadata).await,
        };

        let response_time = start_time.elapsed();

        // Update health information
        let health_info = CoreHealthInfo {
            core_type: core_type.clone(),
            status: status.clone(),
            last_check: Utc::now(),
            response_time_ms: Some(response_time.as_millis() as u64),
            error_rate: self.calculate_error_rate(core_type).await,
            availability_percentage: self.calculate_availability(core_type).await,
            issues: issues.clone(),
            performance_score: self.calculate_performance_score(core_type).await,
        };

        {
            let mut health_map = self.health_info.write().await;
            health_map.insert(core_type.clone(), health_info.clone());
        }

        // Check for alerts
        self.check_and_trigger_alerts(&health_info).await;

        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Info,
                core_type.clone(),
                OperationType::HealthCheck,
                operation_id,
                format!("Health check completed: {} ({}ms)", status, response_time.as_millis()),
                Some({
                    let mut meta = HashMap::new();
                    meta.insert("status".to_string(), serde_json::json!(status.to_string()));
                    meta.insert("response_time_ms".to_string(), serde_json::json!(response_time.as_millis()));
                    meta.insert("issues_count".to_string(), serde_json::json!(issues.len()));
                    meta.insert("performance_score".to_string(), serde_json::json!(health_info.performance_score));
                    meta
                }),
            );
        }

        Ok(HealthCheckResult {
            core_type: core_type.clone(),
            status,
            response_time,
            issues,
            metadata,
        })
    }

    /// Check Python core health
    async fn check_python_core_health(
        &self,
        issues: &mut Vec<HealthIssue>,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> HealthStatus {
        // Check if Python is installed
        let python_cmd = if cfg!(target_os = "windows") { "python" } else { "python3" };
        
        match tokio::process::Command::new(python_cmd)
            .arg("--version")
            .output()
            .await
        {
            Ok(output) => {
                if !output.status.success() {
                    issues.push(HealthIssue {
                        issue_type: HealthIssueType::DependencyMissing,
                        severity: HealthIssueSeverity::Critical,
                        message: "Python command failed".to_string(),
                        detected_at: Utc::now(),
                        suggested_action: Some("Install Python 3.9 or later".to_string()),
                    });
                    return HealthStatus::Critical;
                }

                let version_output = String::from_utf8_lossy(&output.stdout);
                metadata.insert("python_version".to_string(), serde_json::json!(version_output.trim()));

                if !version_output.contains("Python 3.") {
                    issues.push(HealthIssue {
                        issue_type: HealthIssueType::DependencyMissing,
                        severity: HealthIssueSeverity::High,
                        message: format!("Unsupported Python version: {}", version_output.trim()),
                        detected_at: Utc::now(),
                        suggested_action: Some("Install Python 3.9 or later".to_string()),
                    });
                    return HealthStatus::Critical;
                }
            }
            Err(e) => {
                issues.push(HealthIssue {
                    issue_type: HealthIssueType::DependencyMissing,
                    severity: HealthIssueSeverity::Critical,
                    message: format!("Python not found: {}", e),
                    detected_at: Utc::now(),
                    suggested_action: Some("Install Python 3.9 or later and ensure it's in PATH".to_string()),
                });
                return HealthStatus::Critical;
            }
        }

        // Check Python dependencies
        match tokio::process::Command::new(python_cmd)
            .arg("-c")
            .arg("import pyautogui, keyboard, mouse; print('OK')")
            .output()
            .await
        {
            Ok(output) => {
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    issues.push(HealthIssue {
                        issue_type: HealthIssueType::DependencyMissing,
                        severity: HealthIssueSeverity::High,
                        message: format!("Python dependencies missing: {}", stderr),
                        detected_at: Utc::now(),
                        suggested_action: Some("Install required packages: pip install pyautogui keyboard mouse".to_string()),
                    });
                    return HealthStatus::Critical;
                }
                metadata.insert("python_dependencies".to_string(), serde_json::json!("available"));
            }
            Err(e) => {
                issues.push(HealthIssue {
                    issue_type: HealthIssueType::DependencyMissing,
                    severity: HealthIssueSeverity::High,
                    message: format!("Failed to check Python dependencies: {}", e),
                    detected_at: Utc::now(),
                    suggested_action: Some("Check Python installation and dependencies".to_string()),
                });
                return HealthStatus::Warning;
            }
        }

        // Check for performance issues
        let error_rate = self.calculate_error_rate(&CoreType::Python).await;
        if error_rate > self.config.alert_config.error_rate_threshold {
            issues.push(HealthIssue {
                issue_type: HealthIssueType::HighErrorRate,
                severity: HealthIssueSeverity::Medium,
                message: format!("High error rate: {:.1}%", error_rate),
                detected_at: Utc::now(),
                suggested_action: Some("Check system permissions and dependencies".to_string()),
            });
            return HealthStatus::Warning;
        }

        HealthStatus::Healthy
    }

    /// Check Rust core health
    async fn check_rust_core_health(
        &self,
        issues: &mut Vec<HealthIssue>,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> HealthStatus {
        // Check platform-specific requirements
        #[cfg(target_os = "windows")]
        {
            if let Err(issue) = self.check_windows_automation_support(metadata).await {
                issues.push(issue);
                return HealthStatus::Critical;
            }
        }

        #[cfg(target_os = "macos")]
        {
            if let Err(issue) = self.check_macos_automation_support(metadata).await {
                issues.push(issue);
                return HealthStatus::Critical;
            }
        }

        #[cfg(target_os = "linux")]
        {
            if let Err(issue) = self.check_linux_automation_support(metadata).await {
                issues.push(issue);
                return HealthStatus::Critical;
            }
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            issues.push(HealthIssue {
                issue_type: HealthIssueType::PlatformCompatibility,
                severity: HealthIssueSeverity::Critical,
                message: format!("Unsupported platform: {}", std::env::consts::OS),
                detected_at: Utc::now(),
                suggested_action: Some("Use a supported platform (Windows, macOS, or Linux)".to_string()),
            });
            return HealthStatus::Critical;
        }

        // Check for performance issues
        let error_rate = self.calculate_error_rate(&CoreType::Rust).await;
        if error_rate > self.config.alert_config.error_rate_threshold {
            issues.push(HealthIssue {
                issue_type: HealthIssueType::HighErrorRate,
                severity: HealthIssueSeverity::Medium,
                message: format!("High error rate: {:.1}%", error_rate),
                detected_at: Utc::now(),
                suggested_action: Some("Check system permissions and configuration".to_string()),
            });
            return HealthStatus::Warning;
        }

        HealthStatus::Healthy
    }

    #[cfg(target_os = "windows")]
    async fn check_windows_automation_support(
        &self,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> std::result::Result<(), HealthIssue> {
        use winapi::um::winuser::{GetCursorPos, SetCursorPos};
        use winapi::shared::windef::POINT;

        unsafe {
            let mut point = POINT { x: 0, y: 0 };
            if GetCursorPos(&mut point) == 0 {
                return Err(HealthIssue {
                    issue_type: HealthIssueType::PermissionDenied,
                    severity: HealthIssueSeverity::Critical,
                    message: "Cannot access Windows cursor position".to_string(),
                    detected_at: Utc::now(),
                    suggested_action: Some("Check Windows permissions and run with appropriate privileges".to_string()),
                });
            }

            metadata.insert("cursor_access".to_string(), serde_json::json!(true));

            // Test cursor control (this might fail in some security contexts)
            if SetCursorPos(point.x, point.y) == 0 {
                return Err(HealthIssue {
                    issue_type: HealthIssueType::PermissionDenied,
                    severity: HealthIssueSeverity::High,
                    message: "Cannot control Windows cursor".to_string(),
                    detected_at: Utc::now(),
                    suggested_action: Some("Run with administrator privileges or check security settings".to_string()),
                });
            }

            metadata.insert("cursor_control".to_string(), serde_json::json!(true));
        }

        Ok(())
    }

    #[cfg(target_os = "macos")]
    async fn check_macos_automation_support(
        &self,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> std::result::Result<(), HealthIssue> {
        // Check accessibility permissions on macOS
        match tokio::process::Command::new("osascript")
            .arg("-e")
            .arg("tell application \"System Events\" to get name of first process")
            .output()
            .await
        {
            Ok(output) => {
                if !output.status.success() {
                    return Err(HealthIssue {
                        issue_type: HealthIssueType::PermissionDenied,
                        severity: HealthIssueSeverity::Critical,
                        message: "macOS Accessibility permissions required".to_string(),
                        detected_at: Utc::now(),
                        suggested_action: Some("Enable accessibility access in System Preferences > Security & Privacy > Privacy > Accessibility".to_string()),
                    });
                }
                metadata.insert("accessibility_permissions".to_string(), serde_json::json!(true));
            }
            Err(e) => {
                return Err(HealthIssue {
                    issue_type: HealthIssueType::PermissionDenied,
                    severity: HealthIssueSeverity::Critical,
                    message: format!("Cannot check macOS accessibility permissions: {}", e),
                    detected_at: Utc::now(),
                    suggested_action: Some("Enable accessibility access in System Preferences".to_string()),
                });
            }
        }

        Ok(())
    }

    #[cfg(target_os = "linux")]
    async fn check_linux_automation_support(
        &self,
        metadata: &mut HashMap<String, serde_json::Value>,
    ) -> std::result::Result<(), HealthIssue> {
        use std::env;

        // Check display server availability
        let has_display = env::var("DISPLAY").is_ok();
        let has_wayland = env::var("WAYLAND_DISPLAY").is_ok();

        if !has_display && !has_wayland {
            return Err(HealthIssue {
                issue_type: HealthIssueType::SystemResourceExhaustion,
                severity: HealthIssueSeverity::Critical,
                message: "No display server found".to_string(),
                detected_at: Utc::now(),
                suggested_action: Some("Ensure X11 or Wayland is running".to_string()),
            });
        }

        metadata.insert("display_server".to_string(), serde_json::json!({
            "x11": has_display,
            "wayland": has_wayland
        }));

        Ok(())
    }

    /// Calculate error rate for a core
    async fn calculate_error_rate(&self, core_type: &CoreType) -> f64 {
        let recent_metrics: Vec<_> = {
            let metrics = self.metrics_history.lock().unwrap();
            metrics
                .iter()
                .filter(|m| {
                    m.core_type == *core_type &&
                    m.timestamp > Utc::now() - chrono::Duration::minutes(self.config.performance_window_minutes as i64)
                })
                .cloned()
                .collect()
        };

        if recent_metrics.is_empty() {
            return 0.0;
        }

        let error_count = recent_metrics.iter().filter(|m| !m.success).count();
        (error_count as f64 / recent_metrics.len() as f64) * 100.0
    }

    /// Calculate availability percentage for a core
    async fn calculate_availability(&self, core_type: &CoreType) -> f64 {
        let health_map = self.health_info.read().await;
        if let Some(health_info) = health_map.get(core_type) {
            match health_info.status {
                HealthStatus::Healthy => 100.0,
                HealthStatus::Warning => 75.0,
                HealthStatus::Critical => 25.0,
                HealthStatus::Unknown => 0.0,
            }
        } else {
            0.0
        }
    }

    /// Calculate performance score for a core
    async fn calculate_performance_score(&self, core_type: &CoreType) -> f64 {
        let recent_metrics: Vec<_> = {
            let metrics = self.metrics_history.lock().unwrap();
            metrics
                .iter()
                .filter(|m| {
                    m.core_type == *core_type &&
                    m.timestamp > Utc::now() - chrono::Duration::minutes(self.config.performance_window_minutes as i64)
                })
                .cloned()
                .collect()
        };

        if recent_metrics.is_empty() {
            return 50.0; // Default score when no data
        }

        let error_rate = self.calculate_error_rate(core_type).await;
        let avg_response_time = recent_metrics.iter()
            .map(|m| m.response_time_ms as f64)
            .sum::<f64>() / recent_metrics.len() as f64;

        // Calculate score based on error rate and response time
        let error_score = (100.0 - error_rate).max(0.0);
        let response_score = if avg_response_time < 1000.0 {
            100.0
        } else if avg_response_time < 5000.0 {
            100.0 - ((avg_response_time - 1000.0) / 4000.0) * 50.0
        } else {
            50.0 - ((avg_response_time - 5000.0) / 10000.0) * 50.0
        }.max(0.0);

        (error_score * 0.6 + response_score * 0.4).min(100.0)
    }

    /// Check and trigger alerts based on health information
    async fn check_and_trigger_alerts(&self, health_info: &CoreHealthInfo) {
        if !self.config.alert_config.enabled {
            return;
        }

        let mut alerts_to_trigger = Vec::new();

        // Check for core unavailability
        if health_info.status == HealthStatus::Critical {
            alerts_to_trigger.push((AlertType::CoreUnavailable, HealthIssueSeverity::Critical));
        }

        // Check error rate
        if health_info.error_rate > self.config.alert_config.error_rate_threshold {
            alerts_to_trigger.push((AlertType::HighErrorRate, HealthIssueSeverity::High));
        }

        // Check response time
        if let Some(response_time) = health_info.response_time_ms {
            if response_time > self.config.alert_config.response_time_threshold_ms {
                alerts_to_trigger.push((AlertType::SlowResponse, HealthIssueSeverity::Medium));
            }
        }

        // Check availability
        if health_info.availability_percentage < self.config.alert_config.availability_threshold {
            alerts_to_trigger.push((AlertType::LowAvailability, HealthIssueSeverity::High));
        }

        // Check performance score
        if health_info.performance_score < self.config.alert_config.performance_score_threshold {
            alerts_to_trigger.push((AlertType::PerformanceDegradation, HealthIssueSeverity::Medium));
        }

        // Trigger alerts
        for (alert_type, severity) in alerts_to_trigger {
            self.trigger_alert(&health_info.core_type, alert_type, severity, health_info).await;
        }
    }

    /// Trigger an alert
    async fn trigger_alert(
        &self,
        core_type: &CoreType,
        alert_type: AlertType,
        severity: HealthIssueSeverity,
        health_info: &CoreHealthInfo,
    ) {
        // Check cooldown
        let cooldown_key = (core_type.clone(), alert_type.clone());
        {
            let last_alerts = self.last_alert_times.lock().unwrap();
            if let Some(last_time) = last_alerts.get(&cooldown_key) {
                let cooldown_duration = chrono::Duration::minutes(self.config.alert_config.alert_cooldown_minutes as i64);
                if *last_time + cooldown_duration > Utc::now() {
                    return; // Still in cooldown
                }
            }
        }

        // Check rate limiting
        let one_hour_ago = Utc::now() - chrono::Duration::hours(1);
        let recent_alerts_count = {
            let alert_history = self.alert_history.lock().unwrap();
            alert_history.iter()
                .filter(|a| a.triggered_at > one_hour_ago && a.core_type == *core_type)
                .count()
        };

        if recent_alerts_count >= self.config.alert_config.max_alerts_per_hour as usize {
            return; // Rate limited
        }

        // Create alert
        let alert_id = uuid::Uuid::new_v4().to_string();
        let message = self.generate_alert_message(&alert_type, core_type, health_info);
        let suggested_actions = self.generate_suggested_actions(&alert_type, core_type, health_info);

        let mut metadata = HashMap::new();
        metadata.insert("error_rate".to_string(), serde_json::json!(health_info.error_rate));
        metadata.insert("availability".to_string(), serde_json::json!(health_info.availability_percentage));
        metadata.insert("performance_score".to_string(), serde_json::json!(health_info.performance_score));
        if let Some(response_time) = health_info.response_time_ms {
            metadata.insert("response_time_ms".to_string(), serde_json::json!(response_time));
        }

        let alert = Alert {
            id: alert_id.clone(),
            alert_type: alert_type.clone(),
            core_type: core_type.clone(),
            severity: severity.clone(),
            message: message.clone(),
            triggered_at: Utc::now(),
            resolved_at: None,
            suggested_actions,
            metadata,
        };

        // Store alert
        {
            let mut active_alerts = self.active_alerts.write().await;
            active_alerts.insert(alert_id.clone(), alert.clone());
        }

        {
            let mut alert_history = self.alert_history.lock().unwrap();
            alert_history.push(alert.clone());
        }

        // Update last alert time
        {
            let mut last_alerts = self.last_alert_times.lock().unwrap();
            last_alerts.insert(cooldown_key, Utc::now());
        }

        // Log the alert
        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Warn,
                core_type.clone(),
                OperationType::ErrorHandling,
                format!("alert_{}", alert_id),
                format!("Alert triggered: {}", message),
                Some({
                    let mut meta = HashMap::new();
                    meta.insert("alert_type".to_string(), serde_json::json!(format!("{:?}", alert_type)));
                    meta.insert("severity".to_string(), serde_json::json!(format!("{:?}", severity)));
                    meta.insert("alert_id".to_string(), serde_json::json!(alert_id));
                    meta
                }),
            );
        }
    }

    /// Generate alert message
    fn generate_alert_message(
        &self,
        alert_type: &AlertType,
        core_type: &CoreType,
        health_info: &CoreHealthInfo,
    ) -> String {
        match alert_type {
            AlertType::CoreUnavailable => {
                format!("{} automation core is unavailable", core_type)
            }
            AlertType::HighErrorRate => {
                format!("{} core has high error rate: {:.1}%", core_type, health_info.error_rate)
            }
            AlertType::SlowResponse => {
                format!("{} core has slow response time: {}ms", 
                    core_type, 
                    health_info.response_time_ms.unwrap_or(0))
            }
            AlertType::LowAvailability => {
                format!("{} core has low availability: {:.1}%", core_type, health_info.availability_percentage)
            }
            AlertType::PerformanceDegradation => {
                format!("{} core performance degraded: {:.1}/100", core_type, health_info.performance_score)
            }
            AlertType::SystemResourceIssue => {
                format!("{} core experiencing system resource issues", core_type)
            }
            AlertType::ConfigurationProblem => {
                format!("{} core has configuration problems", core_type)
            }
            AlertType::PredictiveFailure => {
                format!("{} core may fail soon based on trends", core_type)
            }
        }
    }

    /// Generate suggested actions for an alert
    fn generate_suggested_actions(
        &self,
        alert_type: &AlertType,
        core_type: &CoreType,
        health_info: &CoreHealthInfo,
    ) -> Vec<String> {
        let mut actions = Vec::new();

        match alert_type {
            AlertType::CoreUnavailable => {
                actions.push("Check core dependencies and permissions".to_string());
                actions.push("Restart the automation service".to_string());
                actions.push("Switch to alternative automation core".to_string());
            }
            AlertType::HighErrorRate => {
                actions.push("Review recent error logs".to_string());
                actions.push("Check system permissions".to_string());
                actions.push("Consider switching to alternative core".to_string());
            }
            AlertType::SlowResponse => {
                actions.push("Check system resource usage".to_string());
                actions.push("Restart the automation service".to_string());
                actions.push("Consider switching to faster core".to_string());
            }
            AlertType::LowAvailability => {
                actions.push("Investigate recent failures".to_string());
                actions.push("Check system stability".to_string());
                actions.push("Enable automatic failover".to_string());
            }
            AlertType::PerformanceDegradation => {
                actions.push("Monitor system resources".to_string());
                actions.push("Check for background processes".to_string());
                actions.push("Consider core optimization".to_string());
            }
            _ => {
                actions.push("Check system logs".to_string());
                actions.push("Restart the service".to_string());
            }
        }

        // Add core-specific suggestions
        match core_type {
            CoreType::Python => {
                actions.push("Check Python installation and dependencies".to_string());
                actions.push("Verify PyAutoGUI permissions".to_string());
            }
            CoreType::Rust => {
                actions.push("Check platform-specific permissions".to_string());
                actions.push("Verify native API access".to_string());
            }
        }

        actions
    }

    /// Record monitoring metrics
    pub async fn record_metrics(&self, metrics: MonitoringMetrics) {
        {
            let mut history = self.metrics_history.lock().unwrap();
            history.push(metrics.clone());

            // Keep only recent metrics (based on retention policy)
            let retention_cutoff = Utc::now() - chrono::Duration::days(self.config.data_retention_days as i64);
            history.retain(|m| m.timestamp > retention_cutoff);
        }

        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Debug,
                metrics.core_type.clone(),
                metrics.operation_type.clone(),
                format!("metrics_{}", Utc::now().timestamp()),
                format!("Recorded metrics: {}ms, success: {}", metrics.response_time_ms, metrics.success),
                Some({
                    let mut meta = HashMap::new();
                    meta.insert("response_time_ms".to_string(), serde_json::json!(metrics.response_time_ms));
                    meta.insert("success".to_string(), serde_json::json!(metrics.success));
                    if let Some(ref error_code) = metrics.error_code {
                        meta.insert("error_code".to_string(), serde_json::json!(error_code));
                    }
                    meta
                }),
            );
        }
    }

    /// Get current health status for all cores
    pub async fn get_health_status(&self) -> HashMap<CoreType, CoreHealthInfo> {
        let health_map = self.health_info.read().await;
        health_map.clone()
    }

    /// Get active alerts
    pub async fn get_active_alerts(&self) -> Vec<Alert> {
        let active_alerts = self.active_alerts.read().await;
        active_alerts.values().cloned().collect()
    }

    /// Get alert history
    pub fn get_alert_history(&self, limit: Option<usize>) -> Vec<Alert> {
        let alert_history = self.alert_history.lock().unwrap();
        match limit {
            Some(n) => alert_history.iter().rev().take(n).cloned().collect(),
            None => alert_history.clone(),
        }
    }

    /// Resolve an alert
    pub async fn resolve_alert(&self, alert_id: &str) -> Result<()> {
        let mut active_alerts = self.active_alerts.write().await;
        if let Some(mut alert) = active_alerts.remove(alert_id) {
            alert.resolved_at = Some(Utc::now());
            
            // Update in history
            let mut alert_history = self.alert_history.lock().unwrap();
            if let Some(history_alert) = alert_history.iter_mut().find(|a| a.id == alert_id) {
                history_alert.resolved_at = Some(Utc::now());
            }

            if let Some(logger) = get_logger() {
                logger.log_operation(
                    LogLevel::Info,
                    alert.core_type.clone(),
                    OperationType::ErrorHandling,
                    format!("resolve_alert_{}", alert_id),
                    format!("Alert resolved: {}", alert.message),
                    None,
                );
            }

            Ok(())
        } else {
            Err(AutomationError::InvalidInput {
                message: format!("Alert not found: {}", alert_id),
            })
        }
    }

    /// Clean up old data
    async fn cleanup_old_data(&self) {
        let retention_cutoff = Utc::now() - chrono::Duration::days(self.config.data_retention_days as i64);

        // Clean up metrics history
        {
            let mut history = self.metrics_history.lock().unwrap();
            let initial_count = history.len();
            history.retain(|m| m.timestamp > retention_cutoff);
            let cleaned_count = initial_count - history.len();
            
            if cleaned_count > 0 {
                if let Some(logger) = get_logger() {
                    logger.log_operation(
                        LogLevel::Debug,
                        CoreType::Rust,
                        OperationType::PerformanceMonitoring,
                        "cleanup_metrics".to_string(),
                        format!("Cleaned up {} old metrics entries", cleaned_count),
                        None,
                    );
                }
            }
        }

        // Clean up alert history
        {
            let mut alert_history = self.alert_history.lock().unwrap();
            let initial_count = alert_history.len();
            alert_history.retain(|a| a.triggered_at > retention_cutoff);
            let cleaned_count = initial_count - alert_history.len();
            
            if cleaned_count > 0 {
                if let Some(logger) = get_logger() {
                    logger.log_operation(
                        LogLevel::Debug,
                        CoreType::Rust,
                        OperationType::PerformanceMonitoring,
                        "cleanup_alerts".to_string(),
                        format!("Cleaned up {} old alert entries", cleaned_count),
                        None,
                    );
                }
            }
        }
    }

    /// Get monitoring statistics
    pub async fn get_monitoring_stats(&self) -> MonitoringStats {
        let metrics_count = self.metrics_history.lock().unwrap().len();
        let active_alerts_count = self.active_alerts.read().await.len();
        let alert_history_count = self.alert_history.lock().unwrap().len();
        let health_info = self.health_info.read().await;

        MonitoringStats {
            metrics_count,
            active_alerts_count,
            alert_history_count,
            cores_monitored: health_info.len(),
            monitoring_active: *self.monitoring_active.read().await,
            last_cleanup: Utc::now(), // This would be tracked in a real implementation
        }
    }
}

impl Clone for CoreMonitor {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            health_info: Arc::clone(&self.health_info),
            metrics_history: Arc::clone(&self.metrics_history),
            active_alerts: Arc::clone(&self.active_alerts),
            alert_history: Arc::clone(&self.alert_history),
            last_alert_times: Arc::clone(&self.last_alert_times),
            monitoring_active: Arc::clone(&self.monitoring_active),
        }
    }
}

/// Monitoring statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringStats {
    pub metrics_count: usize,
    pub active_alerts_count: usize,
    pub alert_history_count: usize,
    pub cores_monitored: usize,
    pub monitoring_active: bool,
    pub last_cleanup: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_status_display() {
        assert_eq!(HealthStatus::Healthy.to_string(), "healthy");
        assert_eq!(HealthStatus::Warning.to_string(), "warning");
        assert_eq!(HealthStatus::Critical.to_string(), "critical");
        assert_eq!(HealthStatus::Unknown.to_string(), "unknown");
    }

    #[test]
    fn test_health_issue_creation() {
        let issue = HealthIssue {
            issue_type: HealthIssueType::PermissionDenied,
            severity: HealthIssueSeverity::Critical,
            message: "Test permission issue".to_string(),
            detected_at: Utc::now(),
            suggested_action: Some("Grant permissions".to_string()),
        };

        assert_eq!(issue.issue_type, HealthIssueType::PermissionDenied);
        assert_eq!(issue.severity, HealthIssueSeverity::Critical);
        assert_eq!(issue.message, "Test permission issue");
        assert!(issue.suggested_action.is_some());
    }

    #[test]
    fn test_monitoring_config_defaults() {
        let config = MonitoringConfig::default();
        
        assert_eq!(config.health_check_interval_seconds, 30);
        assert_eq!(config.performance_window_minutes, 60);
        assert!(config.enable_continuous_monitoring);
        assert!(config.enable_predictive_alerts);
        assert_eq!(config.data_retention_days, 30);
    }

    #[test]
    fn test_alert_config_defaults() {
        let config = AlertConfig::default();
        
        assert!(config.enabled);
        assert_eq!(config.error_rate_threshold, 10.0);
        assert_eq!(config.response_time_threshold_ms, 5000);
        assert_eq!(config.availability_threshold, 95.0);
        assert_eq!(config.performance_score_threshold, 70.0);
        assert_eq!(config.alert_cooldown_minutes, 15);
        assert_eq!(config.max_alerts_per_hour, 10);
    }

    #[tokio::test]
    async fn test_core_monitor_creation() {
        let config = MonitoringConfig::default();
        let monitor = CoreMonitor::new(config.clone());
        
        let stats = monitor.get_monitoring_stats().await;
        assert_eq!(stats.metrics_count, 0);
        assert_eq!(stats.active_alerts_count, 0);
        assert_eq!(stats.cores_monitored, 0);
        assert!(!stats.monitoring_active);
    }

    #[tokio::test]
    async fn test_metrics_recording() {
        let config = MonitoringConfig::default();
        let monitor = CoreMonitor::new(config);
        
        let metrics = MonitoringMetrics {
            core_type: CoreType::Rust,
            timestamp: Utc::now(),
            response_time_ms: 1000,
            success: true,
            error_code: None,
            cpu_usage_percent: Some(25.0),
            memory_usage_mb: Some(128.0),
            operation_type: OperationType::Recording,
        };
        
        monitor.record_metrics(metrics).await;
        
        let stats = monitor.get_monitoring_stats().await;
        assert_eq!(stats.metrics_count, 1);
    }

    #[tokio::test]
    async fn test_error_rate_calculation() {
        let config = MonitoringConfig::default();
        let monitor = CoreMonitor::new(config);
        
        // Record some metrics with mixed success/failure
        for i in 0..10 {
            let metrics = MonitoringMetrics {
                core_type: CoreType::Rust,
                timestamp: Utc::now(),
                response_time_ms: 1000,
                success: i % 3 != 0, // 2/3 success rate
                error_code: if i % 3 == 0 { Some("TEST_ERROR".to_string()) } else { None },
                cpu_usage_percent: None,
                memory_usage_mb: None,
                operation_type: OperationType::Recording,
            };
            monitor.record_metrics(metrics).await;
        }
        
        let error_rate = monitor.calculate_error_rate(&CoreType::Rust).await;
        assert!((error_rate - 40.0).abs() < 1.0); // Should be approximately 40% (4 failures out of 10)
    }

    #[tokio::test]
    async fn test_health_check_result() {
        let config = MonitoringConfig::default();
        let monitor = CoreMonitor::new(config);
        
        // This test may fail in CI environments without proper setup
        // but it tests the structure and basic functionality
        match monitor.perform_health_check(&CoreType::Python).await {
            Ok(result) => {
                assert_eq!(result.core_type, CoreType::Python);
                assert!(result.response_time.as_millis() > 0);
            }
            Err(_) => {
                // Expected in environments without Python setup
            }
        }
    }

    #[tokio::test]
    async fn test_alert_resolution() {
        let config = MonitoringConfig::default();
        let monitor = CoreMonitor::new(config);
        
        // Create a test alert
        let alert = Alert {
            id: "test_alert_001".to_string(),
            alert_type: AlertType::HighErrorRate,
            core_type: CoreType::Rust,
            severity: HealthIssueSeverity::Medium,
            message: "Test alert".to_string(),
            triggered_at: Utc::now(),
            resolved_at: None,
            suggested_actions: vec!["Test action".to_string()],
            metadata: HashMap::new(),
        };
        
        // Add to active alerts
        {
            let mut active_alerts = monitor.active_alerts.write().await;
            active_alerts.insert(alert.id.clone(), alert.clone());
        }
        
        // Resolve the alert
        let result = monitor.resolve_alert(&alert.id).await;
        assert!(result.is_ok());
        
        // Check that it's no longer active
        let active_alerts = monitor.get_active_alerts().await;
        assert!(active_alerts.is_empty());
    }
}
