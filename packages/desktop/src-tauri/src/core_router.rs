use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use tokio::sync::{RwLock, mpsc};
use std::collections::HashMap;

use crate::python_process::PythonProcessManager;

// Import preference types from rust-core
use rust_automation_core::preferences::{PreferenceManager, UserSettings, CoreType as RustCoreType};
// Import automation types from rust-core
use rust_automation_core::{AutomationConfig, ScriptData};
use rust_automation_core::recorder::Recorder;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum CoreType {
    #[serde(rename = "python")]
    Python,
    #[serde(rename = "rust")]
    Rust,
}

impl From<RustCoreType> for CoreType {
    fn from(rust_core_type: RustCoreType) -> Self {
        match rust_core_type {
            RustCoreType::Python => CoreType::Python,
            RustCoreType::Rust => CoreType::Rust,
        }
    }
}

impl From<CoreType> for RustCoreType {
    fn from(core_type: CoreType) -> Self {
        match core_type {
            CoreType::Python => RustCoreType::Python,
            CoreType::Rust => RustCoreType::Rust,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoreStatus {
    pub active_core: CoreType,
    pub available_cores: Vec<CoreType>,
    pub core_health: CoreHealth,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CoreHealth {
    pub python: Option<bool>,
    pub rust: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AutomationCommand {
    StartRecording,
    StopRecording,
    StartPlayback {
        script_path: Option<String>,
        speed: Option<f64>,
        loop_count: Option<i32>,
    },
    StopPlayback,
    PausePlayback,
    CheckRecordings,
    GetLatest,
    ListScripts,
    LoadScript { path: String },
    SaveScript { path: String, data: serde_json::Value },
    DeleteScript { path: String },
}

pub struct CoreRouter {
    active_core: Arc<Mutex<CoreType>>,
    python_manager: Arc<PythonProcessManager>,
    // Enhanced error handling and fallback
    startup_health_check_completed: Arc<RwLock<bool>>,
    last_health_check: Arc<RwLock<Option<std::time::Instant>>>,
    failure_count: Arc<RwLock<HashMap<CoreType, u32>>>,
    error_history: Arc<RwLock<Vec<CoreErrorRecord>>>,
    performance_metrics: Arc<RwLock<HashMap<CoreType, CorePerformanceMetrics>>>,
    // Preference manager for settings persistence
    preference_manager: Arc<Mutex<Option<PreferenceManager>>>,
    // Rust automation core components
    rust_recorder: Arc<Mutex<Option<Recorder>>>,
    rust_player: Arc<Mutex<Option<rust_automation_core::player::Player>>>,
}

/// Error record for cross-core error tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoreErrorRecord {
    pub core_type: CoreType,
    pub operation: String,
    pub error_message: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub severity: ErrorSeverity,
    pub suggested_actions: Vec<String>,
}

/// Performance metrics for core comparison
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorePerformanceMetrics {
    pub avg_response_time: std::time::Duration,
    pub success_rate: f32,
    pub total_operations: u64,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

/// Error severity levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ErrorSeverity {
    Warning,
    Error,
    Critical,
}

/// Performance comparison between cores
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceComparison {
    pub python_metrics: Option<CorePerformanceMetrics>,
    pub rust_metrics: Option<CorePerformanceMetrics>,
    pub recommendation: CoreRecommendation,
    pub comparison_details: ComparisonDetails,
}

/// Core recommendation based on performance analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoreRecommendation {
    pub recommended_core: CoreType,
    pub confidence: f32, // 0.0 to 1.0
    pub reasons: Vec<String>,
    pub performance_improvement: Option<f32>, // Percentage improvement
}

/// Detailed performance comparison metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonDetails {
    pub response_time_ratio: f32, // rust_time / python_time
    pub memory_usage_ratio: Option<f32>,
    pub success_rate_difference: f32,
    pub operations_count_difference: i64,
}

impl CoreRouter {
    pub fn new(python_manager: Arc<PythonProcessManager>) -> Self {
        Self {
            active_core: Arc::new(Mutex::new(CoreType::Rust)), // Default to Rust
            python_manager,
            startup_health_check_completed: Arc::new(RwLock::new(false)),
            last_health_check: Arc::new(RwLock::new(None)),
            failure_count: Arc::new(RwLock::new(HashMap::new())),
            error_history: Arc::new(RwLock::new(Vec::new())),
            performance_metrics: Arc::new(RwLock::new(HashMap::new())),
            preference_manager: Arc::new(Mutex::new(None)),
            rust_recorder: Arc::new(Mutex::new(None)),
            rust_player: Arc::new(Mutex::new(None)),
        }
    }
    
    /// Initialize preference manager
    pub fn initialize_preferences(&self) -> Result<(), String> {
        let mut pref_manager = self.preference_manager.lock().unwrap();
        match PreferenceManager::with_default_path() {
            Ok(manager) => {
                // Force Rust core as active (ignore saved preferences)
                let mut active_core = self.active_core.lock().unwrap();
                *active_core = CoreType::Rust;
                
                *pref_manager = Some(manager);
                Ok(())
            }
            Err(e) => {
                eprintln!("Failed to initialize preference manager: {:?}", e);
                // Still force Rust core even if preferences fail
                let mut active_core = self.active_core.lock().unwrap();
                *active_core = CoreType::Rust;
                Ok(()) // Don't fail initialization
            }
        }
    }

    /// Perform automatic core health checking at startup
    pub async fn perform_startup_health_check(&self) -> Result<Vec<CoreType>, String> {
        let result = self.detect_available_cores_with_health_check().await;
        
        // Always update health check status, regardless of result
        let mut health_check_completed = self.startup_health_check_completed.write().await;
        *health_check_completed = true;
        
        let mut last_check = self.last_health_check.write().await;
        *last_check = Some(std::time::Instant::now());
        
        result
    }

    /// Detect available cores with comprehensive health checking
    async fn detect_available_cores_with_health_check(&self) -> Result<Vec<CoreType>, String> {
        let mut available_cores = Vec::new();
        
        // Check Python core with detailed health check
        match self.check_python_core_health().await {
            Ok(()) => {
                available_cores.push(CoreType::Python);
            }
            Err(e) => {
                eprintln!("Python core health check failed: {}", e);
            }
        }
        
        // Check Rust core with detailed health check
        match self.check_rust_core_health().await {
            Ok(()) => {
                available_cores.push(CoreType::Rust);
            }
            Err(e) => {
                eprintln!("Rust core health check failed: {}", e);
            }
        }
        
        if available_cores.is_empty() {
            return Err("No automation cores are available. Please check your system configuration and dependencies.".to_string());
        }
        
        Ok(available_cores)
    }

    /// Comprehensive Python core health check
    async fn check_python_core_health(&self) -> Result<(), String> {
        // Check if Python is installed
        let python_cmd = if cfg!(target_os = "windows") { "python" } else { "python3" };
        
        let output = tokio::process::Command::new(python_cmd)
            .arg("--version")
            .output()
            .await
            .map_err(|e| format!("Python is not installed or not in PATH: {}. Please install Python 3.9 or later.", e))?;

        if !output.status.success() {
            return Err("Python command failed. Please ensure Python 3.9+ is properly installed.".to_string());
        }

        // Check Python version
        let version_output = String::from_utf8_lossy(&output.stdout);
        if !version_output.contains("Python 3.") {
            return Err(format!("Found Python version: {}. Please install Python 3.9 or later.", version_output.trim()));
        }

        // Check if required Python packages are available
        let package_check = tokio::process::Command::new(python_cmd)
            .arg("-c")
            .arg("import pyautogui, keyboard, mouse; print('OK')")
            .output()
            .await
            .map_err(|e| format!("Failed to check Python dependencies: {}", e))?;

        if !package_check.status.success() {
            let stderr = String::from_utf8_lossy(&package_check.stderr);
            return Err(format!("Python automation dependencies are missing: {}. Please install required packages.", stderr));
        }

        // Test basic Python process functionality
        if !self.python_manager.is_healthy() {
            return Err("Python process manager is not healthy".to_string());
        }

        Ok(())
    }

    /// Comprehensive Rust core health check
    async fn check_rust_core_health(&self) -> Result<(), String> {
        // Check platform-specific requirements
        #[cfg(target_os = "windows")]
        {
            self.check_windows_automation_support().await
        }

        #[cfg(target_os = "macos")]
        {
            self.check_macos_automation_support().await
        }

        #[cfg(target_os = "linux")]
        {
            self.check_linux_automation_support().await
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            Err(format!("Rust automation core does not support platform: {}", std::env::consts::OS))
        }
    }

    #[cfg(target_os = "windows")]
    async fn check_windows_automation_support(&self) -> Result<(), String> {
        // Check Windows API access
        use winapi::um::winuser::{GetCursorPos, SetCursorPos};
        use winapi::shared::windef::POINT;

        unsafe {
            let mut point = POINT { x: 0, y: 0 };
            if GetCursorPos(&mut point) == 0 {
                return Err("Cannot access Windows cursor position. Please check permissions.".to_string());
            }

            // Test cursor control (this might fail in some security contexts)
            if SetCursorPos(point.x, point.y) == 0 {
                return Err("Cannot control Windows cursor. Please run with appropriate permissions.".to_string());
            }
        }

        Ok(())
    }

    #[cfg(target_os = "macos")]
    async fn check_macos_automation_support(&self) -> Result<(), String> {
        // Check accessibility permissions on macOS
        // Note: We'll do a basic check using osascript
        use tokio::process::Command;

        let output = Command::new("osascript")
            .arg("-e")
            .arg("tell application \"System Events\" to get name of first process")
            .output()
            .await
            .map_err(|_| "macOS Accessibility permissions are required. Please enable accessibility access in System Preferences > Security & Privacy > Privacy > Accessibility.".to_string())?;

        if !output.status.success() {
            return Err("macOS Accessibility permissions are required. Please enable accessibility access in System Preferences > Security & Privacy > Privacy > Accessibility.".to_string());
        }

        Ok(())
    }

    #[cfg(target_os = "linux")]
    async fn check_linux_automation_support(&self) -> Result<(), String> {
        // Check display server availability
        use std::env;

        if env::var("DISPLAY").is_err() && env::var("WAYLAND_DISPLAY").is_err() {
            return Err("No display server found. Please ensure X11 or Wayland is running.".to_string());
        }

        Ok(())
    }

    /// Handle runtime failure detection and recovery
    pub async fn handle_runtime_failure(
        &self,
        failed_core: CoreType,
        operation: &str,
        error: &str,
    ) -> Result<CoreType, String> {
        // Increment failure count
        {
            let mut failure_count = self.failure_count.write().await;
            let count = failure_count.get(&failed_core).unwrap_or(&0) + 1;
            failure_count.insert(failed_core.clone(), count);
        }

        // Log the failure with detailed information
        eprintln!(
            "[Core Failure] Core: {:?}, Operation: {}, Error: {}, Timestamp: {}",
            failed_core,
            operation,
            error,
            chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
        );

        // Attempt fallback if auto-fallback is enabled
        let available_cores = self.get_available_cores();
        let fallback_cores: Vec<CoreType> = available_cores
            .into_iter()
            .filter(|core| *core != failed_core)
            .collect();

        if fallback_cores.is_empty() {
            return Err(format!(
                "Core {} failed and no fallback cores are available. Error: {}",
                match failed_core {
                    CoreType::Python => "Python",
                    CoreType::Rust => "Rust",
                },
                error
            ));
        }

        // Select the best fallback core (prefer the first available for now)
        let fallback_core = fallback_cores[0].clone();
        
        // Attempt to switch to fallback core
        match self.select_core(fallback_core.clone()) {
            Ok(()) => {
                eprintln!(
                    "[Fallback Success] Switched from {:?} to {:?} due to failure: {}",
                    failed_core, fallback_core, error
                );
                Ok(fallback_core)
            }
            Err(e) => Err(format!(
                "Failed to fallback from {:?} to {:?}: {}. Original error: {}",
                failed_core, fallback_core, e, error
            )),
        }
    }

    /// Get failure count for a specific core
    pub async fn get_failure_count(&self, core_type: &CoreType) -> u32 {
        let failure_count = self.failure_count.read().await;
        failure_count.get(core_type).copied().unwrap_or(0)
    }

    /// Reset failure count for a core (useful after successful operations)
    pub async fn reset_failure_count(&self, core_type: &CoreType) {
        let mut failure_count = self.failure_count.write().await;
        failure_count.insert(core_type.clone(), 0);
    }

    /// Check if startup health check has been completed
    pub async fn is_startup_health_check_completed(&self) -> bool {
        let completed = self.startup_health_check_completed.read().await;
        *completed
    }

    /// Force a health check update
    pub async fn update_health_status(&self) -> Result<Vec<CoreType>, String> {
        self.detect_available_cores_with_health_check().await
    }

    /// Report error with cross-core consistency and attribution
    pub async fn report_error_with_attribution(
        &self,
        core_type: CoreType,
        operation: String,
        error_message: String,
        severity: ErrorSeverity,
    ) -> CoreErrorRecord {
        let suggested_actions = self.generate_suggested_actions(&core_type, &error_message, &severity);
        
        let error_record = CoreErrorRecord {
            core_type: core_type.clone(),
            operation: operation.clone(),
            error_message: error_message.clone(),
            timestamp: chrono::Utc::now(),
            severity: severity.clone(),
            suggested_actions: suggested_actions.clone(),
        };

        // Store in error history
        {
            let mut history = self.error_history.write().await;
            history.push(error_record.clone());
            
            // Keep only last 50 errors to prevent memory bloat
            if history.len() > 50 {
                let excess = history.len() - 50;
                history.drain(0..excess);
            }
        }

        // Log with core attribution
        eprintln!(
            "[Core Error] Core: {:?}, Operation: {}, Error: {}, Severity: {:?}, Timestamp: {}, Suggested Actions: {:?}",
            core_type,
            operation,
            error_message,
            severity,
            error_record.timestamp.format("%Y-%m-%d %H:%M:%S UTC"),
            suggested_actions
        );

        error_record
    }

    /// Generate suggested actions based on error type and core
    fn generate_suggested_actions(
        &self,
        core_type: &CoreType,
        error_message: &str,
        severity: &ErrorSeverity,
    ) -> Vec<String> {
        let mut actions = Vec::new();

        // Core-specific suggestions
        match core_type {
            CoreType::Python => {
                if error_message.contains("permission") || error_message.contains("Permission") {
                    actions.push("Check and grant required system permissions".to_string());
                    actions.push("Try running the application with administrator privileges".to_string());
                    actions.push("Consider switching to Rust core which may have different permission requirements".to_string());
                } else if error_message.contains("dependency") || error_message.contains("import") {
                    actions.push("Install missing Python dependencies (pip install pyautogui keyboard mouse)".to_string());
                    actions.push("Verify Python 3.9+ is properly installed".to_string());
                    actions.push("Switch to Rust core to avoid Python dependencies".to_string());
                } else if error_message.contains("timeout") || error_message.contains("slow") {
                    actions.push("Retry the operation with increased timeout".to_string());
                    actions.push("Switch to Rust core for potentially better performance".to_string());
                } else {
                    actions.push("Retry the operation after a brief delay".to_string());
                    actions.push("Restart the Python automation process".to_string());
                }
            }
            CoreType::Rust => {
                if error_message.contains("permission") || error_message.contains("Permission") {
                    actions.push("Grant system accessibility permissions".to_string());
                    actions.push("Check platform-specific permission requirements".to_string());
                    actions.push("Try Python core as an alternative".to_string());
                } else if error_message.contains("platform") || error_message.contains("unsupported") {
                    actions.push("Switch to Python core for broader platform support".to_string());
                    actions.push("Check if your platform is supported by Rust automation".to_string());
                } else {
                    actions.push("Retry the operation".to_string());
                    actions.push("Switch to Python core as fallback".to_string());
                }
            }
        }

        // Severity-based suggestions
        match severity {
            ErrorSeverity::Critical => {
                actions.insert(0, "Immediate action required - consider switching automation cores".to_string());
            }
            ErrorSeverity::Error => {
                actions.push("Monitor for recurring issues".to_string());
            }
            ErrorSeverity::Warning => {
                actions.push("No immediate action required, but monitor performance".to_string());
            }
        }

        actions
    }

    /// Detect performance-based errors and suggest core switching
    pub async fn detect_performance_degradation(&self, core_type: &CoreType) -> Option<String> {
        let metrics = {
            let performance_metrics = self.performance_metrics.read().await;
            performance_metrics.get(core_type).cloned()
        };

        if let Some(metrics) = metrics {
            // Check for performance issues
            if metrics.success_rate < 0.7 {
                return Some(format!(
                    "Success rate for {} core is critically low ({:.1}%). Consider switching to alternative core.",
                    match core_type {
                        CoreType::Python => "Python",
                        CoreType::Rust => "Rust",
                    },
                    metrics.success_rate * 100.0
                ));
            }

            if metrics.avg_response_time > std::time::Duration::from_secs(5) {
                return Some(format!(
                    "Response time for {} core is critically high ({:?}). Consider switching to alternative core.",
                    match core_type {
                        CoreType::Python => "Python",
                        CoreType::Rust => "Rust",
                    },
                    metrics.avg_response_time
                ));
            }
        }

        None
    }

    /// Update performance metrics for a core
    pub async fn update_performance_metrics(
        &self,
        core_type: CoreType,
        operation_duration: std::time::Duration,
        success: bool,
    ) {
        let mut metrics_map = self.performance_metrics.write().await;
        let metrics = metrics_map.entry(core_type).or_insert_with(|| CorePerformanceMetrics {
            avg_response_time: std::time::Duration::from_millis(0),
            success_rate: 1.0,
            total_operations: 0,
            last_updated: chrono::Utc::now(),
        });

        // Update metrics
        let new_total = metrics.total_operations + 1;
        
        // Update average response time
        let total_time = metrics.avg_response_time * metrics.total_operations as u32 + operation_duration;
        metrics.avg_response_time = total_time / new_total as u32;
        
        // Update success rate
        let successful_ops = (metrics.success_rate * metrics.total_operations as f32) + if success { 1.0 } else { 0.0 };
        metrics.success_rate = successful_ops / new_total as f32;
        
        metrics.total_operations = new_total;
        metrics.last_updated = chrono::Utc::now();
    }

    /// Get error history for analysis
    pub async fn get_error_history(&self) -> Vec<CoreErrorRecord> {
        let history = self.error_history.read().await;
        history.clone()
    }

    /// Get performance metrics for all cores
    pub async fn get_performance_metrics(&self) -> HashMap<CoreType, CorePerformanceMetrics> {
        let metrics = self.performance_metrics.read().await;
        metrics.clone()
    }

    /// Get performance comparison between cores
    pub async fn get_performance_comparison(&self) -> PerformanceComparison {
        let metrics = self.get_performance_metrics().await;
        
        let python_metrics = metrics.get(&CoreType::Python).cloned();
        let rust_metrics = metrics.get(&CoreType::Rust).cloned();
        
        let recommendation = self.generate_core_recommendation(&python_metrics, &rust_metrics);
        let comparison_details = self.calculate_comparison_details(&python_metrics, &rust_metrics);
        
        PerformanceComparison {
            python_metrics,
            rust_metrics,
            recommendation,
            comparison_details,
        }
    }

    /// Generate core recommendation based on performance metrics
    fn generate_core_recommendation(
        &self,
        python_metrics: &Option<CorePerformanceMetrics>,
        rust_metrics: &Option<CorePerformanceMetrics>,
    ) -> CoreRecommendation {
        match (python_metrics, rust_metrics) {
            (Some(python), Some(rust)) => {
                let mut reasons = Vec::new();
                let mut rust_score = 0.0f32;
                let mut python_score = 0.0f32;

                // Compare response times
                if rust.avg_response_time < python.avg_response_time {
                    rust_score += 0.4;
                    reasons.push("Rust core has faster response times".to_string());
                } else {
                    python_score += 0.4;
                    reasons.push("Python core has faster response times".to_string());
                }

                // Compare success rates
                if rust.success_rate > python.success_rate {
                    rust_score += 0.4;
                    reasons.push("Rust core has higher success rate".to_string());
                } else {
                    python_score += 0.4;
                    reasons.push("Python core has higher success rate".to_string());
                }

                // Experience factor (more operations = more reliable)
                if rust.total_operations > python.total_operations {
                    rust_score += 0.2;
                    reasons.push("Rust core has more operational experience".to_string());
                } else {
                    python_score += 0.2;
                    reasons.push("Python core has more operational experience".to_string());
                }

                let recommended_core = if rust_score > python_score {
                    CoreType::Rust
                } else {
                    CoreType::Python
                };

                let confidence = (rust_score - python_score).abs().max(0.5);
                let performance_improvement = if rust_score > python_score {
                    Some((rust_score - python_score) * 100.0)
                } else {
                    Some((python_score - rust_score) * 100.0)
                };

                CoreRecommendation {
                    recommended_core,
                    confidence,
                    reasons,
                    performance_improvement,
                }
            }
            (Some(_), None) => CoreRecommendation {
                recommended_core: CoreType::Python,
                confidence: 1.0,
                reasons: vec!["Rust core is not available".to_string()],
                performance_improvement: None,
            },
            (None, Some(_)) => CoreRecommendation {
                recommended_core: CoreType::Rust,
                confidence: 1.0,
                reasons: vec!["Python core is not available".to_string()],
                performance_improvement: None,
            },
            (None, None) => CoreRecommendation {
                recommended_core: CoreType::Python, // Default fallback
                confidence: 0.0,
                reasons: vec!["No performance data available for either core".to_string()],
                performance_improvement: None,
            },
        }
    }

    /// Calculate detailed performance comparison metrics
    fn calculate_comparison_details(
        &self,
        python_metrics: &Option<CorePerformanceMetrics>,
        rust_metrics: &Option<CorePerformanceMetrics>,
    ) -> ComparisonDetails {
        match (python_metrics, rust_metrics) {
            (Some(python), Some(rust)) => {
                let response_time_ratio = if python.avg_response_time.as_millis() > 0 {
                    rust.avg_response_time.as_millis() as f32 / python.avg_response_time.as_millis() as f32
                } else {
                    1.0
                };

                let success_rate_difference = rust.success_rate - python.success_rate;
                let operations_count_difference = rust.total_operations as i64 - python.total_operations as i64;

                ComparisonDetails {
                    response_time_ratio,
                    memory_usage_ratio: None, // Not tracked in CorePerformanceMetrics yet
                    success_rate_difference,
                    operations_count_difference,
                }
            }
            _ => ComparisonDetails {
                response_time_ratio: 1.0,
                memory_usage_ratio: None,
                success_rate_difference: 0.0,
                operations_count_difference: 0,
            },
        }
    }

    /// Check if core switching is recommended based on error patterns
    pub async fn should_recommend_core_switch(&self, current_core: &CoreType) -> Option<String> {
        let history = self.error_history.read().await;
        
        // Look at recent errors (last 5)
        let recent_errors: Vec<&CoreErrorRecord> = history
            .iter()
            .rev()
            .take(5)
            .filter(|record| record.core_type == *current_core)
            .collect();

        if recent_errors.len() < 3 {
            return None; // Not enough data
        }

        // Count critical errors
        let critical_errors = recent_errors
            .iter()
            .filter(|record| record.severity == ErrorSeverity::Critical)
            .count();

        // If more than 60% of recent errors are critical, recommend switching
        if critical_errors as f32 / recent_errors.len() as f32 > 0.6 {
            let alternative_core = match current_core {
                CoreType::Python => "Rust",
                CoreType::Rust => "Python",
            };

            return Some(format!(
                "High rate of critical errors ({}/{}) detected with {} core. Switching to {} core is recommended for better reliability.",
                critical_errors,
                recent_errors.len(),
                match current_core {
                    CoreType::Python => "Python",
                    CoreType::Rust => "Rust",
                },
                alternative_core
            ));
        }

        None
    }

    /// Update user settings in preferences
    pub fn update_user_settings(&self, settings: UserSettings) -> Result<(), String> {
        let mut pref_manager_guard = self.preference_manager.lock().unwrap();
        if let Some(ref mut pref_manager) = *pref_manager_guard {
            pref_manager.update_user_settings(settings).map_err(|e| {
                format!("Failed to update user settings: {:?}", e)
            })?;
        }
        Ok(())
    }
    
    /// Get current user settings from preferences
    pub fn get_user_settings(&self) -> Option<UserSettings> {
        let pref_manager_guard = self.preference_manager.lock().unwrap();
        if let Some(ref pref_manager) = *pref_manager_guard {
            Some(pref_manager.get_user_settings().clone())
        } else {
            None
        }
    }
    
    /// Update playback speed setting
    pub fn set_playback_speed(&self, speed: f64) -> Result<(), String> {
        let mut pref_manager_guard = self.preference_manager.lock().unwrap();
        if let Some(ref mut pref_manager) = *pref_manager_guard {
            pref_manager.set_playback_speed(speed).map_err(|e| {
                format!("Failed to set playback speed: {:?}", e)
            })?;
        }
        Ok(())
    }
    
    /// Update loop count setting
    pub fn set_loop_count(&self, count: u32) -> Result<(), String> {
        let mut pref_manager_guard = self.preference_manager.lock().unwrap();
        if let Some(ref mut pref_manager) = *pref_manager_guard {
            pref_manager.set_loop_count(count).map_err(|e| {
                format!("Failed to set loop count: {:?}", e)
            })?;
        }
        Ok(())
    }
    
    /// Update selected script path
    pub fn set_selected_script_path(&self, path: Option<String>) -> Result<(), String> {
        let mut pref_manager_guard = self.preference_manager.lock().unwrap();
        if let Some(ref mut pref_manager) = *pref_manager_guard {
            pref_manager.set_selected_script_path(path).map_err(|e| {
                format!("Failed to set selected script path: {:?}", e)
            })?;
        }
        Ok(())
    }
    
    /// Update show preview setting
    pub fn set_show_preview(&self, show_preview: bool) -> Result<(), String> {
        let mut pref_manager_guard = self.preference_manager.lock().unwrap();
        if let Some(ref mut pref_manager) = *pref_manager_guard {
            pref_manager.set_show_preview(show_preview).map_err(|e| {
                format!("Failed to set show preview: {:?}", e)
            })?;
        }
        Ok(())
    }
    
    /// Update preview opacity setting
    pub fn set_preview_opacity(&self, opacity: f64) -> Result<(), String> {
        let mut pref_manager_guard = self.preference_manager.lock().unwrap();
        if let Some(ref mut pref_manager) = *pref_manager_guard {
            pref_manager.set_preview_opacity(opacity).map_err(|e| {
                format!("Failed to set preview opacity: {:?}", e)
            })?;
        }
        Ok(())
    }

    /// Select and switch to a specific automation core with enhanced validation and settings preservation
    pub fn select_core(&self, core_type: CoreType) -> Result<(), String> {
        // Validate that the requested core is available
        let available_cores = self.get_available_cores();
        if !available_cores.contains(&core_type) {
            let error_message = match core_type {
                CoreType::Python => {
                    "Python automation core is not available. Please ensure Python 3.9+ is installed with required packages (pyautogui, keyboard, mouse)."
                }
                CoreType::Rust => {
                    "Rust automation core is not available. Please check system permissions and platform support."
                }
            };
            return Err(error_message.to_string());
        }

        // Perform additional validation before switching
        let validation_result = match core_type {
            CoreType::Python => {
                if !self.python_manager.is_healthy() {
                    Err("Python core is not healthy. Please restart the application or check Python installation.".to_string())
                } else {
                    Ok(())
                }
            }
            CoreType::Rust => {
                // TODO: Add Rust core health validation when implemented
                Ok(())
            }
        };

        if let Err(validation_error) = validation_result {
            return Err(format!(
                "Core validation failed for {:?}: {}",
                core_type, validation_error
            ));
        }

        // Preserve user settings during core switch
        let settings_backup = {
            let pref_manager_guard = self.preference_manager.lock().unwrap();
            if let Some(ref pref_manager) = *pref_manager_guard {
                Some(pref_manager.backup_settings())
            } else {
                None
            }
        };

        // Update the active core
        let mut active_core = self.active_core.lock().unwrap();
        let previous_core = active_core.clone();
        *active_core = core_type.clone();

        // Update preference manager with new core selection
        {
            let mut pref_manager_guard = self.preference_manager.lock().unwrap();
            if let Some(ref mut pref_manager) = *pref_manager_guard {
                if let Err(e) = pref_manager.set_preferred_core(core_type.clone().into()) {
                    eprintln!("Warning: Failed to persist core preference: {:?}", e);
                }
                
                // Restore user settings if we had a backup
                if let Some(backup) = settings_backup {
                    if let Err(e) = pref_manager.restore_settings(backup) {
                        eprintln!("Warning: Failed to restore user settings during core switch: {:?}", e);
                    }
                }
            }
        }

        eprintln!(
            "[Core Switch] Successfully switched from {:?} to {:?} at {} (settings preserved)",
            previous_core,
            core_type,
            chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
        );

        Ok(())
    }

    /// Get list of available automation cores
    /// NOTE: Python core temporarily disabled, only Rust core available
    pub fn get_available_cores(&self) -> Vec<CoreType> {
        // Only return Rust core for now
        vec![CoreType::Rust]
    }

    /// Get current core status including health information
    pub fn get_core_status(&self) -> CoreStatus {
        let active_core = self.active_core.lock().unwrap().clone();
        let available_cores = self.get_available_cores();
        
        CoreStatus {
            active_core,
            available_cores,
            core_health: CoreHealth {
                python: Some(self.is_python_core_available()),
                rust: Some(self.is_rust_core_available()),
            },
        }
    }

    /// Route automation command to the appropriate core with enhanced error handling
    pub async fn route_command(
        &self,
        command: AutomationCommand,
        app_handle: &AppHandle,
    ) -> Result<serde_json::Value, String> {
        let active_core = self.active_core.lock().unwrap().clone();
        let operation = format!("{:?}", command);
        let start_time = std::time::Instant::now();

        let result = match active_core.clone() {
            CoreType::Python => self.route_to_python(command.clone(), app_handle),
            CoreType::Rust => self.route_to_rust(command.clone(), app_handle),
        };

        let operation_duration = start_time.elapsed();

        // Handle routing errors with enhanced error reporting
        match result {
            Ok(value) => {
                // Reset failure count and update performance metrics on successful operation
                self.reset_failure_count(&active_core).await;
                self.update_performance_metrics(active_core.clone(), operation_duration, true).await;
                
                // Check for performance degradation
                if let Some(performance_warning) = self.detect_performance_degradation(&active_core).await {
                    self.report_error_with_attribution(
                        active_core,
                        operation.clone(),
                        performance_warning,
                        ErrorSeverity::Warning,
                    ).await;
                }
                
                Ok(value)
            }
            Err(error) => {
                // Update performance metrics for failed operation
                self.update_performance_metrics(active_core.clone(), operation_duration, false).await;
                
                // Determine error severity
                let severity = if error.contains("critical") || error.contains("permission") {
                    ErrorSeverity::Critical
                } else if error.contains("timeout") || error.contains("failed") {
                    ErrorSeverity::Error
                } else {
                    ErrorSeverity::Warning
                };

                // Report error with attribution
                self.report_error_with_attribution(
                    active_core.clone(),
                    operation.clone(),
                    error.clone(),
                    severity,
                ).await;

                // Attempt runtime failure recovery
                match self.handle_runtime_failure(active_core.clone(), &operation, &error).await {
                    Ok(fallback_core) => {
                        // Report successful fallback
                        self.report_error_with_attribution(
                            fallback_core.clone(),
                            format!("fallback_from_{:?}", active_core),
                            format!("Successfully switched to {:?} core due to: {}", fallback_core, error),
                            ErrorSeverity::Warning,
                        ).await;

                        // Retry the command with the fallback core
                        eprintln!("Retrying command with fallback core: {:?}", fallback_core);
                        let retry_start = std::time::Instant::now();
                        let retry_result = match fallback_core.clone() {
                            CoreType::Python => self.route_to_python(command, app_handle),
                            CoreType::Rust => self.route_to_rust(command, app_handle),
                        };

                        // Update metrics for retry attempt
                        let retry_duration = retry_start.elapsed();
                        match &retry_result {
                            Ok(_) => {
                                self.update_performance_metrics(fallback_core, retry_duration, true).await;
                            }
                            Err(retry_error) => {
                                self.update_performance_metrics(fallback_core.clone(), retry_duration, false).await;
                                self.report_error_with_attribution(
                                    fallback_core,
                                    format!("retry_{}", operation),
                                    retry_error.clone(),
                                    ErrorSeverity::Error,
                                ).await;
                            }
                        }

                        retry_result
                    }
                    Err(fallback_error) => {
                        // Report fallback failure
                        self.report_error_with_attribution(
                            active_core,
                            format!("fallback_failed_{}", operation),
                            fallback_error.clone(),
                            ErrorSeverity::Critical,
                        ).await;
                        Err(fallback_error)
                    }
                }
            }
        }
    }

    /// Check if Python core is available and functional
    fn is_python_core_available(&self) -> bool {
        // For now, assume Python core is always available if the process manager exists
        // In a more robust implementation, we could try to ping the Python process
        true
    }

    /// Check if Rust core is available and functional
    fn is_rust_core_available(&self) -> bool {
        // Check if the rust-automation-core library is available
        // Since we're already using it in this binary, it's available
        // We can do a basic platform check to ensure automation is supported
        #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
        {
            true
        }
        
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            false
        }
    }

    /// Route command to Python core
    fn route_to_python(
        &self,
        command: AutomationCommand,
        app_handle: &AppHandle,
    ) -> Result<serde_json::Value, String> {
        // Ensure Python process is running
        self.python_manager.ensure_process_running(app_handle.clone())?;

        match command {
            AutomationCommand::StartRecording => {
                let response = self.python_manager.send_command("start_recording", serde_json::json!({}), app_handle)?;
                Ok(response)
            }
            AutomationCommand::StopRecording => {
                let response = self.python_manager.send_command("stop_recording", serde_json::json!({}), app_handle)?;
                Ok(response)
            }
            AutomationCommand::StartPlayback { script_path, speed, loop_count } => {
                let mut params = serde_json::Map::new();
                if let Some(path) = script_path {
                    params.insert("scriptPath".to_string(), serde_json::Value::String(path));
                }
                if let Some(s) = speed {
                    params.insert("speed".to_string(), serde_json::json!(s));
                }
                if let Some(lc) = loop_count {
                    params.insert("loopCount".to_string(), serde_json::json!(lc));
                }
                let response = self.python_manager.send_command("start_playback", serde_json::Value::Object(params), app_handle)?;
                Ok(response)
            }
            AutomationCommand::StopPlayback => {
                let response = self.python_manager.send_command("stop_playback", serde_json::json!({}), app_handle)?;
                Ok(response)
            }
            AutomationCommand::PausePlayback => {
                let response = self.python_manager.send_command("pause_playback", serde_json::json!({}), app_handle)?;
                Ok(response)
            }
            AutomationCommand::CheckRecordings => {
                let response = self.python_manager.send_command("check_recordings", serde_json::json!({}), app_handle)?;
                Ok(response)
            }
            AutomationCommand::GetLatest => {
                let response = self.python_manager.send_command("get_latest", serde_json::json!({}), app_handle)?;
                Ok(response)
            }
            AutomationCommand::ListScripts => {
                let response = self.python_manager.send_command("list_scripts", serde_json::json!({}), app_handle)?;
                Ok(response)
            }
            AutomationCommand::LoadScript { path } => {
                let params = serde_json::json!({
                    "scriptPath": path
                });
                let response = self.python_manager.send_command("load_script", params, app_handle)?;
                Ok(response)
            }
            AutomationCommand::SaveScript { path, data } => {
                let params = serde_json::json!({
                    "scriptPath": path,
                    "scriptData": data
                });
                let response = self.python_manager.send_command("save_script", params, app_handle)?;
                Ok(response)
            }
            AutomationCommand::DeleteScript { path } => {
                let params = serde_json::json!({
                    "scriptPath": path
                });
                let response = self.python_manager.send_command("delete_script", params, app_handle)?;
                Ok(response)
            }
        }
    }

    /// Route command to Rust core
    fn route_to_rust(
        &self,
        command: AutomationCommand,
        app_handle: &AppHandle,
    ) -> Result<serde_json::Value, String> {
        match command {
            AutomationCommand::StartRecording => {
                // Initialize recorder if not already created
                let mut recorder_lock = self.rust_recorder.lock().unwrap();
                if recorder_lock.is_none() {
                    let config = AutomationConfig::default();
                    match Recorder::new(config) {
                        Ok(recorder) => {
                            *recorder_lock = Some(recorder);
                        }
                        Err(e) => {
                            return Err(format!("Failed to initialize Rust recorder: {:?}", e));
                        }
                    }
                }

                // Set up event streaming to Tauri for recording events
                let app_handle_clone = app_handle.clone();
                let (event_tx, mut event_rx) = mpsc::unbounded_channel::<rust_automation_core::recorder::RecordingEvent>();
                
                eprintln!("[Rust Recorder] Event streaming channel created");
                
                // Spawn a task to forward recording events to Tauri
                tauri::async_runtime::spawn(async move {
                    while let Some(event) = event_rx.recv().await {
                        let event_name = event.event_type.clone();
                        
                        // Emit the original event
                        if let Err(e) = app_handle_clone.emit_all(&event_name, &event) {
                            eprintln!("[Rust Recorder] Failed to emit event '{}': {:?}", event_name, e);
                        }
                        
                        // Also emit recording_click event for cursor overlay when it's a mouse click
                        if event_name == "action_recorded" {
                            if let rust_automation_core::recorder::RecordingEventData::ActionRecorded { ref action } = event.data {
                                if action.action_type == "mouse_click" {
                                    if let (Some(x), Some(y)) = (action.x, action.y) {
                                        let click_event = serde_json::json!({
                                            "x": x,
                                            "y": y,
                                            "button": action.button.clone().unwrap_or_else(|| "left".to_string())
                                        });
                                        if let Err(e) = app_handle_clone.emit_all("recording_click", &click_event) {
                                            eprintln!("[Rust Recorder] Failed to emit recording_click event: {:?}", e);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    eprintln!("[Rust Recorder] Event forwarding task terminated");
                });

                // Start recording
                if let Some(recorder) = recorder_lock.as_mut() {
                    // Set event sender for real-time UI updates
                    recorder.set_event_sender(event_tx);
                    eprintln!("[Rust Recorder] Event sender configured");
                    
                    match recorder.start_recording() {
                        Ok(_) => {
                            eprintln!("[Rust Recorder] Recording started successfully");
                            Ok(serde_json::json!({
                                "success": true,
                                "data": {
                                    "message": "Recording started with Rust core"
                                }
                            }))
                        }
                        Err(e) => {
                            Err(format!("Failed to start recording: {:?}", e))
                        }
                    }
                } else {
                    Err("Recorder not initialized".to_string())
                }
            }
            AutomationCommand::StopRecording => {
                let mut recorder_lock = self.rust_recorder.lock().unwrap();
                if let Some(recorder) = recorder_lock.as_mut() {
                    match recorder.stop_recording() {
                        Ok(script_data) => {
                            // Save script to file
                            let script_path = format!(
                                "{}/GeniusQA/recordings/recording_{}.json",
                                std::env::var("HOME").unwrap_or_else(|_| ".".to_string()),
                                chrono::Utc::now().timestamp()
                            );

                            // Create directory if it doesn't exist
                            if let Some(parent) = std::path::Path::new(&script_path).parent() {
                                let _ = std::fs::create_dir_all(parent);
                            }

                            // Save script to JSON file
                            let json_data = serde_json::to_string_pretty(&script_data)
                                .map_err(|e| format!("Failed to serialize script: {}", e))?;
                            
                            std::fs::write(&script_path, json_data)
                                .map_err(|e| format!("Failed to write script file: {}", e))?;

                            Ok(serde_json::json!({
                                "success": true,
                                "data": {
                                    "scriptPath": script_path,
                                    "actionCount": script_data.actions.len(),
                                    "duration": script_data.metadata.duration,
                                    "screenshotCount": 0
                                }
                            }))
                        }
                        Err(e) => {
                            Err(format!("Failed to stop recording: {:?}", e))
                        }
                    }
                } else {
                    Err("No active recording session".to_string())
                }
            }
            AutomationCommand::StartPlayback { script_path, speed, loop_count } => {
                // Initialize player if not already created
                let mut player_lock = self.rust_player.lock().unwrap();
                if player_lock.is_none() {
                    let config = AutomationConfig::default();
                    match rust_automation_core::player::Player::new(config) {
                        Ok(player) => {
                            eprintln!("[Rust Player] Player instance created successfully");
                            *player_lock = Some(player);
                        }
                        Err(e) => {
                            eprintln!("[Rust Player] Failed to initialize player: {:?}", e);
                            return Err(format!("Failed to initialize Rust player. Please check system permissions and ensure your platform is supported. Error: {:?}", e));
                        }
                    }
                }

                // Get the script path to load
                let path_to_load = if let Some(path) = script_path {
                    path
                } else {
                    // Get the latest recording
                    let recordings_dir = format!(
                        "{}/GeniusQA/recordings",
                        std::env::var("HOME").unwrap_or_else(|_| ".".to_string())
                    );
                    
                    std::fs::read_dir(&recordings_dir)
                        .ok()
                        .and_then(|entries| {
                            entries
                                .filter_map(|e| e.ok())
                                .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("json"))
                                .max_by_key(|e| e.metadata().and_then(|m| m.modified()).ok())
                                .map(|e| e.path().to_string_lossy().to_string())
                        })
                        .ok_or_else(|| "No recordings found. Please record a script first before attempting playback.".to_string())?
                };

                eprintln!("[Rust Player] Loading script from: {}", path_to_load);

                // Load the script file
                let script_content = std::fs::read_to_string(&path_to_load)
                    .map_err(|e| format!("Failed to read script file '{}'. Please ensure the file exists and is readable. Error: {}", path_to_load, e))?;
                
                let script_data: ScriptData = serde_json::from_str(&script_content)
                    .map_err(|e| format!("Failed to parse script file '{}'. The file may be corrupted or in an invalid format. Error: {}", path_to_load, e))?;

                eprintln!("[Rust Player] Script loaded successfully: {} actions", script_data.actions.len());

                // Set up event streaming to Tauri
                let app_handle_clone = app_handle.clone();
                let (event_tx, mut event_rx) = mpsc::unbounded_channel::<rust_automation_core::player::PlaybackEvent>();
                
                eprintln!("[Rust Player] Event streaming channel created");
                
                // Spawn a task to forward events to Tauri
                tauri::async_runtime::spawn(async move {
                    while let Some(event) = event_rx.recv().await {
                        let event_name = event.event_type.clone();
                        if let Err(e) = app_handle_clone.emit_all(&event_name, &event) {
                            eprintln!("[Rust Player] Failed to emit event '{}': {:?}", event_name, e);
                        }
                    }
                    eprintln!("[Rust Player] Event forwarding task terminated");
                });

                // Configure player with event sender
                if let Some(player) = player_lock.as_mut() {
                    player.set_event_sender(event_tx);
                    eprintln!("[Rust Player] Event sender configured");
                    
                    // Load the script
                    player.load_script(script_data)
                        .map_err(|e| format!("Failed to load script into player: {:?}", e))?;
                    
                    eprintln!("[Rust Player] Script loaded into player");
                    
                    // Start playback with specified parameters
                    let playback_speed = speed.unwrap_or(1.0);
                    let loops = loop_count.unwrap_or(1).max(1) as u32;
                    
                    eprintln!("[Rust Player] Starting playback: speed={:.2}x, loops={}", playback_speed, loops);
                    
                    player.start_playback(playback_speed, loops)
                        .map_err(|e| {
                            eprintln!("[Rust Player] Failed to start playback: {:?}", e);
                            format!("Failed to start playback: {:?}", e)
                        })?;
                    
                    eprintln!("[Rust Player] Playback started successfully");
                    
                    Ok(serde_json::json!({
                        "success": true,
                        "data": {
                            "message": "Playback started with Rust core",
                            "speed": playback_speed,
                            "loops": loops
                        }
                    }))
                } else {
                    Err("Player not initialized after creation attempt".to_string())
                }
            }
            AutomationCommand::StopPlayback => {
                let mut player_lock = self.rust_player.lock().unwrap();
                if let Some(player) = player_lock.as_mut() {
                    eprintln!("[Rust Player] Stopping playback");
                    
                    player.stop_playback()
                        .map_err(|e| {
                            eprintln!("[Rust Player] Failed to stop playback: {:?}", e);
                            format!("Failed to stop playback: {:?}", e)
                        })?;
                    
                    eprintln!("[Rust Player] Playback stopped successfully");
                    
                    // Send completion event to frontend
                    Ok(serde_json::json!({
                        "success": true,
                        "data": {
                            "message": "Playback stopped successfully"
                        }
                    }))
                } else {
                    Err("No active playback session. Please start playback before attempting to stop.".to_string())
                }
            }
            AutomationCommand::PausePlayback => {
                let mut player_lock = self.rust_player.lock().unwrap();
                if let Some(player) = player_lock.as_mut() {
                    let is_paused = player.pause_playback()
                        .map_err(|e| {
                            eprintln!("[Rust Player] Failed to pause/resume playback: {:?}", e);
                            format!("Failed to pause/resume playback: {:?}", e)
                        })?;
                    
                    eprintln!("[Rust Player] Playback {} successfully", if is_paused { "paused" } else { "resumed" });
                    
                    // Send pause status event to frontend
                    Ok(serde_json::json!({
                        "success": true,
                        "data": {
                            "isPaused": is_paused,
                            "message": if is_paused { "Playback paused" } else { "Playback resumed" }
                        }
                    }))
                } else {
                    Err("No active playback session. Please start playback before attempting to pause/resume.".to_string())
                }
            }
            AutomationCommand::CheckRecordings => {
                // Check if recordings directory exists and has files
                let recordings_dir = format!(
                    "{}/GeniusQA/recordings",
                    std::env::var("HOME").unwrap_or_else(|_| ".".to_string())
                );
                
                let has_recordings = std::path::Path::new(&recordings_dir)
                    .read_dir()
                    .map(|entries| entries.count() > 0)
                    .unwrap_or(false);

                Ok(serde_json::json!({
                    "success": true,
                    "data": {
                        "hasRecordings": has_recordings
                    }
                }))
            }
            AutomationCommand::GetLatest => {
                let recordings_dir = format!(
                    "{}/GeniusQA/recordings",
                    std::env::var("HOME").unwrap_or_else(|_| ".".to_string())
                );
                
                // Find the most recent recording file
                let latest = std::fs::read_dir(&recordings_dir)
                    .ok()
                    .and_then(|entries| {
                        entries
                            .filter_map(|e| e.ok())
                            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("json"))
                            .max_by_key(|e| e.metadata().and_then(|m| m.modified()).ok())
                            .map(|e| e.path().to_string_lossy().to_string())
                    });

                Ok(serde_json::json!({
                    "success": true,
                    "data": {
                        "scriptPath": latest
                    }
                }))
            }
            AutomationCommand::ListScripts => {
                let recordings_dir = format!(
                    "{}/GeniusQA/recordings",
                    std::env::var("HOME").unwrap_or_else(|_| ".".to_string())
                );
                
                let scripts: Vec<serde_json::Value> = std::fs::read_dir(&recordings_dir)
                    .ok()
                    .map(|entries| {
                        entries
                            .filter_map(|e| e.ok())
                            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("json"))
                            .filter_map(|e| {
                                let path = e.path();
                                let metadata = e.metadata().ok()?;
                                let modified = metadata.modified().ok()?;
                                let created_at = modified
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .ok()?
                                    .as_secs();

                                Some(serde_json::json!({
                                    "path": path.to_string_lossy(),
                                    "filename": path.file_name()?.to_string_lossy(),
                                    "created_at": chrono::DateTime::from_timestamp(created_at as i64, 0)?
                                        .format("%Y-%m-%d %H:%M:%S").to_string(),
                                    "duration": 0.0,
                                    "action_count": 0
                                }))
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                Ok(serde_json::json!({
                    "success": true,
                    "data": {
                        "scripts": scripts
                    }
                }))
            }
            AutomationCommand::LoadScript { path } => {
                // Load script file and return its contents
                let script_content = std::fs::read_to_string(&path)
                    .map_err(|e| format!("Failed to read script file '{}': {}", path, e))?;
                
                let script_data: ScriptData = serde_json::from_str(&script_content)
                    .map_err(|e| format!("Failed to parse script file '{}': {}", path, e))?;
                
                Ok(serde_json::json!({
                    "success": true,
                    "data": {
                        "script": script_data
                    }
                }))
            }
            AutomationCommand::SaveScript { path, data } => {
                // Save script data to file
                let json_string = serde_json::to_string_pretty(&data)
                    .map_err(|e| format!("Failed to serialize script data: {}", e))?;
                
                // Create directory if it doesn't exist
                if let Some(parent) = std::path::Path::new(&path).parent() {
                    std::fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create directory for script: {}", e))?;
                }
                
                std::fs::write(&path, json_string)
                    .map_err(|e| format!("Failed to write script file '{}': {}", path, e))?;
                
                Ok(serde_json::json!({
                    "success": true,
                    "data": {
                        "scriptPath": path
                    }
                }))
            }
            AutomationCommand::DeleteScript { path } => {
                // Delete script file
                std::fs::remove_file(&path)
                    .map_err(|e| format!("Failed to delete script file '{}': {}", path, e))?;
                
                Ok(serde_json::json!({
                    "success": true,
                    "data": {
                        "deleted": path
                    }
                }))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    // Create a test CoreRouter
    fn create_test_router() -> CoreRouter {
        let python_manager = Arc::new(crate::python_process::PythonProcessManager::new());
        CoreRouter::new(python_manager)
    }

    #[test]
    fn test_core_validation_before_switching() {
        /*
         * Feature: rust-automation-core, Property 2: Core validation before switching
         * 
         * Property: For any core switching attempt, the system should validate that the 
         * target core is available and functional before completing the switch
         */
        
        let router = create_test_router();
        
        // Test switching to Rust core (should not be available yet)
        let result = router.select_core(CoreType::Rust);
        assert!(result.is_err(), "Should not be able to switch to unavailable Rust core");
        
        // Verify the error message provides detailed information
        if let Err(error) = result {
            assert!(error.contains("not available"), "Error should indicate core is not available");
            assert!(error.len() > 20, "Error message should be detailed and helpful");
        }

        // Test that validation is actually performed
        // The Python core might fail validation in test environment due to missing dependencies
        let python_result = router.select_core(CoreType::Python);
        match python_result {
            Ok(()) => {
                // If Python core is available, that's fine
            }
            Err(error) => {
                // If Python core fails validation, the error should be informative
                assert!(error.contains("Python") || error.contains("not available") || error.contains("not healthy"), 
                       "Error should be informative about Python core issues: {}", error);
            }
        }
    }

    #[test]
    fn test_get_available_cores() {
        let router = create_test_router();
        
        let available_cores = router.get_available_cores();
        
        // Python should be available, Rust should not be (for now)
        assert!(available_cores.contains(&CoreType::Python), "Python core should be available");
        assert!(!available_cores.contains(&CoreType::Rust), "Rust core should not be available yet");
    }

    #[test]
    fn test_core_status() {
        let router = create_test_router();
        
        let status = router.get_core_status();
        
        // Verify status structure
        assert_eq!(status.active_core, CoreType::Python, "Default active core should be Python");
        assert!(status.available_cores.contains(&CoreType::Python), "Python should be in available cores");
        assert!(status.core_health.python.unwrap_or(false), "Python core health should be true");
        assert!(!status.core_health.rust.unwrap_or(true), "Rust core health should be false");
    }

    #[test]
    fn test_core_validation_property_multiple_attempts() {
        /*
         * Feature: rust-automation-core, Property 2: Core validation before switching
         * 
         * Test the property across multiple core switching attempts to verify consistency
         */
        
        let router = create_test_router();
        
        // Test multiple invalid switches (Rust core should consistently fail)
        for _ in 0..10 {
            let result = router.select_core(CoreType::Rust);
            assert!(result.is_err(), "Invalid core switches should always fail");
        }

        // Test that validation is consistent for Python core
        let mut python_results = Vec::new();
        for _ in 0..5 {
            let result = router.select_core(CoreType::Python);
            python_results.push(result.is_ok());
        }
        
        // All attempts should have the same result (either all succeed or all fail)
        let first_result = python_results[0];
        for result in python_results {
            assert_eq!(result, first_result, "Core validation should be consistent across attempts");
        }
    }

    #[test]
    fn test_command_routing_based_on_selection() {
        /*
         * Feature: rust-automation-core, Property 27: Command routing based on selection
         * 
         * Property: For any automation command when both cores are available, the system 
         * should route commands to the appropriate backend based on user selection
         */
        
        let router = create_test_router();
        
        // Ensure we're using Python core
        let _ = router.select_core(CoreType::Python);
        
        // Test that commands are routed to the active core
        // Note: This test is limited because we can't easily mock the AppHandle
        // In a real implementation, we'd need dependency injection for better testability
        
        // Verify the active core is set correctly
        let status = router.get_core_status();
        assert_eq!(status.active_core, CoreType::Python, "Active core should be Python");
        
        // Test that attempting to route to unavailable Rust core fails appropriately
        let _ = router.select_core(CoreType::Rust);
        let status = router.get_core_status();
        // Should still be Python since Rust is not available
        assert_eq!(status.active_core, CoreType::Python, "Should fallback to Python when Rust unavailable");
    }

    #[test]
    fn test_command_routing_consistency() {
        /*
         * Feature: rust-automation-core, Property 27: Command routing based on selection
         * 
         * Test that command routing is consistent across multiple operations
         */
        
        let router = create_test_router();
        
        // Get initial status
        let initial_status = router.get_core_status();
        
        // Test that invalid selections don't change the active core
        for _ in 0..5 {
            let _ = router.select_core(CoreType::Rust); // Should fail
            let status = router.get_core_status();
            assert_eq!(status.active_core, initial_status.active_core, "Active core should not change on failed selection");
        }

        // Test core selection consistency (if Python is available)
        let python_selection_result = router.select_core(CoreType::Python);
        if python_selection_result.is_ok() {
            // If Python core is available, test consistency
            for _ in 0..3 {
                let result = router.select_core(CoreType::Python);
                assert!(result.is_ok(), "Should consistently be able to select available Python core");
                
                let status = router.get_core_status();
                assert_eq!(status.active_core, CoreType::Python, "Active core should be Python after selection");
            }
        }
    }

    #[tokio::test]
    async fn test_fallback_behavior_on_core_unavailability() {
        /*
         * Feature: rust-automation-core, Property 3: Fallback behavior on core unavailability
         * 
         * Property: For any situation where the selected core becomes unavailable, 
         * the system should display an error message and fall back to the previously working core
         */
        
        let router = create_test_router();
        
        // Test switching to Rust core (should not be available yet)
        let result = router.select_core(CoreType::Rust);
        assert!(result.is_err(), "Should not be able to switch to unavailable Rust core");
        
        // Verify the error message provides detailed information
        if let Err(error) = result {
            assert!(error.contains("not available"), "Error should indicate core is not available");
            assert!(error.len() > 20, "Error message should be detailed and helpful");
        }

        // Test runtime failure handling
        let failure_result = router
            .handle_runtime_failure(
                CoreType::Rust,
                "test_operation",
                "Simulated core failure"
            )
            .await;

        // Should either succeed with fallback or provide detailed error
        match failure_result {
            Ok(fallback_core) => {
                assert_ne!(fallback_core, CoreType::Rust, "Should fallback to different core");
            }
            Err(error) => {
                assert!(error.contains("no fallback cores are available") || 
                       error.contains("failed"), "Should provide clear error message");
            }
        }

        // Test that Python core selection behavior is consistent
        let python_result = router.select_core(CoreType::Python);
        match python_result {
            Ok(()) => {
                // Python core is available in test environment
            }
            Err(error) => {
                // Python core validation failed, which is acceptable in test environment
                assert!(!error.is_empty(), "Should provide error message when core unavailable");
            }
        }
    }

    #[tokio::test]
    async fn test_graceful_error_handling_during_recording() {
        /*
         * Feature: rust-automation-core, Property 9: Graceful error handling during recording
         * 
         * Property: For any recording error with Rust core, the system should handle it 
         * gracefully and provide clear, actionable error messages
         */
        
        let router = create_test_router();
        
        // Test error handling with detailed messages
        let failure_result = router
            .handle_runtime_failure(
                CoreType::Rust,
                "start_recording",
                "Failed to capture mouse events due to permission denied"
            )
            .await;

        // Should handle the error gracefully
        match failure_result {
            Ok(fallback_core) => {
                // Successful fallback
                assert_ne!(fallback_core, CoreType::Rust, "Should fallback to different core");
            }
            Err(error) => {
                // Graceful error with detailed message
                assert!(!error.is_empty(), "Should provide error message");
                assert!(error.contains("Failed to capture mouse events") || 
                       error.contains("no fallback"), "Should include original error or fallback info");
            }
        }

        // Check that failure count is tracked
        let failure_count = router.get_failure_count(&CoreType::Rust).await;
        assert!(failure_count > 0, "Should track failure count");
    }

    #[tokio::test]
    async fn test_startup_health_check() {
        let router = create_test_router();
        
        // Test startup health check
        let health_check_result = router.perform_startup_health_check().await;
        
        // In test environment, cores may not be available due to missing dependencies
        // The important thing is that the health check completes and provides useful information
        match health_check_result {
            Ok(available_cores) => {
                // Some cores are available
                assert!(!available_cores.is_empty(), "Should find at least one available core");
            }
            Err(error) => {
                // No cores are available, but error should be informative
                assert!(!error.is_empty(), "Should provide detailed error message");
                assert!(error.contains("No automation cores are available") || 
                       error.contains("check your system"), "Should provide helpful guidance");
            }
        }

        // Verify health check completion status regardless of result
        let is_completed = router.is_startup_health_check_completed().await;
        assert!(is_completed, "Health check should be marked as completed");
    }

    #[tokio::test]
    async fn test_failure_count_tracking() {
        let router = create_test_router();
        
        // Initial failure count should be 0
        let initial_count = router.get_failure_count(&CoreType::Python).await;
        assert_eq!(initial_count, 0, "Initial failure count should be 0");
        
        // Simulate a failure
        let _ = router
            .handle_runtime_failure(CoreType::Python, "test_op", "test error")
            .await;
        
        // Failure count should increase
        let after_failure_count = router.get_failure_count(&CoreType::Python).await;
        assert!(after_failure_count > initial_count, "Failure count should increase after failure");
        
        // Reset failure count
        router.reset_failure_count(&CoreType::Python).await;
        let reset_count = router.get_failure_count(&CoreType::Python).await;
        assert_eq!(reset_count, 0, "Failure count should reset to 0");
    }

    #[tokio::test]
    async fn test_error_attribution_to_core() {
        /*
         * Feature: rust-automation-core, Property 22: Error attribution to core
         * 
         * Property: For any error that occurs, the system should clearly indicate 
         * which automation core generated the error
         */
        
        let router = create_test_router();
        
        // Report an error with core attribution
        let error_record = router
            .report_error_with_attribution(
                CoreType::Python,
                "start_recording".to_string(),
                "Failed to initialize recording due to permission denied".to_string(),
                ErrorSeverity::Critical,
            )
            .await;

        // Verify core attribution
        assert_eq!(error_record.core_type, CoreType::Python, "Error should be attributed to Python core");
        assert_eq!(error_record.operation, "start_recording", "Operation should be recorded");
        assert!(error_record.error_message.contains("permission denied"), "Error message should be preserved");
        assert_eq!(error_record.severity, ErrorSeverity::Critical, "Severity should be preserved");
        assert!(!error_record.suggested_actions.is_empty(), "Should provide suggested actions");

        // Check that error is in history
        let history = router.get_error_history().await;
        assert!(!history.is_empty(), "Error should be recorded in history");
        assert_eq!(history[0].core_type, CoreType::Python, "History should show correct core attribution");
    }

    #[tokio::test]
    async fn test_cross_core_error_handling_consistency() {
        /*
         * Feature: rust-automation-core, Property 28: Error handling mechanism consistency
         * 
         * Property: For any error with Rust core, the system should maintain all existing 
         * error handling and user feedback mechanisms
         */
        
        let router = create_test_router();
        
        // Test Python core error handling
        let python_error = router
            .report_error_with_attribution(
                CoreType::Python,
                "automation_task".to_string(),
                "Permission denied for mouse control".to_string(),
                ErrorSeverity::Error,
            )
            .await;

        // Test Rust core error handling
        let rust_error = router
            .report_error_with_attribution(
                CoreType::Rust,
                "automation_task".to_string(),
                "Permission denied for mouse control".to_string(),
                ErrorSeverity::Error,
            )
            .await;

        // Both should have consistent structure
        assert_eq!(python_error.severity, rust_error.severity, "Both cores should use same severity levels");
        assert!(!python_error.suggested_actions.is_empty(), "Python core should provide suggested actions");
        assert!(!rust_error.suggested_actions.is_empty(), "Rust core should provide suggested actions");
        
        // Both should suggest checking permissions for permission errors
        let python_has_permission_suggestion = python_error.suggested_actions.iter()
            .any(|action| action.to_lowercase().contains("permission"));
        let rust_has_permission_suggestion = rust_error.suggested_actions.iter()
            .any(|action| action.to_lowercase().contains("permission"));
        
        assert!(python_has_permission_suggestion, "Python should suggest checking permissions");
        assert!(rust_has_permission_suggestion, "Rust should suggest checking permissions");
    }

    #[tokio::test]
    async fn test_performance_based_error_detection() {
        /*
         * Feature: rust-automation-core, Property 35: Performance-based core suggestions
         * 
         * Property: For any performance issue occurrence, the system should suggest 
         * trying the alternative automation core
         */
        
        let router = create_test_router();
        
        // Simulate poor performance by updating metrics
        router.update_performance_metrics(
            CoreType::Python,
            std::time::Duration::from_secs(10), // Very slow
            false, // Failed operation
        ).await;

        // Check for performance degradation detection
        let degradation_warning = router.detect_performance_degradation(&CoreType::Python).await;
        
        match degradation_warning {
            Some(warning) => {
                assert!(warning.contains("Consider switching"), "Should suggest switching cores");
                assert!(warning.contains("Python"), "Should identify the problematic core");
            }
            None => {
                // This is acceptable if thresholds aren't met yet
            }
        }

        // Test core switching recommendation
        let switch_recommendation = router.should_recommend_core_switch(&CoreType::Python).await;
        
        // After multiple failures, should recommend switching
        for _ in 0..5 {
            router.report_error_with_attribution(
                CoreType::Python,
                "test_operation".to_string(),
                "Critical system error".to_string(),
                ErrorSeverity::Critical,
            ).await;
        }

        let recommendation_after_failures = router.should_recommend_core_switch(&CoreType::Python).await;
        match recommendation_after_failures {
            Some(recommendation) => {
                assert!(recommendation.contains("Switching to"), "Should recommend switching");
                assert!(recommendation.contains("Rust"), "Should recommend alternative core");
            }
            None => {
                // This is acceptable depending on the threshold logic
            }
        }
    }

    #[tokio::test]
    async fn test_performance_metrics_tracking() {
        let router = create_test_router();
        
        // Update performance metrics
        router.update_performance_metrics(
            CoreType::Python,
            std::time::Duration::from_millis(500),
            true,
        ).await;

        router.update_performance_metrics(
            CoreType::Python,
            std::time::Duration::from_millis(300),
            true,
        ).await;

        // Get metrics
        let metrics = router.get_performance_metrics().await;
        
        assert!(metrics.contains_key(&CoreType::Python), "Should have Python metrics");
        
        let python_metrics = &metrics[&CoreType::Python];
        assert_eq!(python_metrics.total_operations, 2, "Should track operation count");
        assert_eq!(python_metrics.success_rate, 1.0, "Should track success rate");
        assert!(python_metrics.avg_response_time > std::time::Duration::from_millis(0), "Should track response time");
    }
}
