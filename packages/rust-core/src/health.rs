//! Core health checking and availability detection

use crate::{Result, AutomationError, ErrorInfo, ErrorSeverity};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::time::timeout;

/// Core type identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
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

/// Health status of a core
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoreHealth {
    pub core_type: CoreType,
    pub is_available: bool,
    pub is_functional: bool,
    pub last_check: chrono::DateTime<chrono::Utc>,
    pub response_time: Option<Duration>,
    pub error_count: u32,
    pub last_error: Option<ErrorInfo>,
    pub performance_metrics: PerformanceMetrics,
}

/// Performance metrics for core comparison
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub avg_response_time: Duration,
    pub memory_usage: Option<u64>,
    pub cpu_usage: Option<f32>,
    pub success_rate: f32,
    pub operations_count: u64,
}

impl Default for PerformanceMetrics {
    fn default() -> Self {
        Self {
            avg_response_time: Duration::from_millis(0),
            memory_usage: None,
            cpu_usage: None,
            success_rate: 1.0,
            operations_count: 0,
        }
    }
}

/// Core health checker and availability detector
pub struct CoreHealthChecker {
    health_status: HashMap<CoreType, CoreHealth>,
    check_interval: Duration,
    timeout_duration: Duration,
}

impl CoreHealthChecker {
    /// Create a new core health checker
    pub fn new() -> Self {
        Self {
            health_status: HashMap::new(),
            check_interval: Duration::from_secs(30),
            timeout_duration: Duration::from_secs(5),
        }
    }

    /// Set the health check interval
    pub fn with_check_interval(mut self, interval: Duration) -> Self {
        self.check_interval = interval;
        self
    }

    /// Set the timeout duration for health checks
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout_duration = timeout;
        self
    }

    /// Perform health check for all registered cores
    pub async fn check_all_cores(&mut self) -> Result<HashMap<CoreType, CoreHealth>> {
        let cores_to_check = vec![CoreType::Python, CoreType::Rust];
        
        for core_type in cores_to_check {
            let health = self.check_core_health(&core_type).await;
            self.health_status.insert(core_type, health);
        }

        Ok(self.health_status.clone())
    }

    /// Check health of a specific core
    pub async fn check_core_health(&self, core_type: &CoreType) -> CoreHealth {
        let start_time = Instant::now();
        
        let (is_available, is_functional, error) = match core_type {
            CoreType::Python => self.check_python_core().await,
            CoreType::Rust => self.check_rust_core().await,
        };

        let response_time = if is_available {
            Some(start_time.elapsed())
        } else {
            None
        };

        let existing_health = self.health_status.get(core_type);
        let error_count = if error.is_some() {
            existing_health.map(|h| h.error_count + 1).unwrap_or(1)
        } else {
            existing_health.map(|h| h.error_count).unwrap_or(0)
        };

        let performance_metrics = existing_health
            .map(|h| self.update_performance_metrics(&h.performance_metrics, response_time, error.is_none()))
            .unwrap_or_default();

        CoreHealth {
            core_type: core_type.clone(),
            is_available,
            is_functional,
            last_check: chrono::Utc::now(),
            response_time,
            error_count,
            last_error: error,
            performance_metrics,
        }
    }

    /// Check Python core availability and functionality
    async fn check_python_core(&self) -> (bool, bool, Option<ErrorInfo>) {
        // Try to detect Python installation
        let python_check = timeout(
            self.timeout_duration,
            self.check_python_installation()
        ).await;

        match python_check {
            Ok(Ok(())) => {
                // Python is installed, now check if our Python core is functional
                match self.check_python_core_functionality().await {
                    Ok(()) => (true, true, None),
                    Err(e) => {
                        let error_info = ErrorInfo::new(e).with_core("python".to_string());
                        (true, false, Some(error_info))
                    }
                }
            }
            Ok(Err(e)) => {
                let error_info = ErrorInfo::new(e).with_core("python".to_string());
                (false, false, Some(error_info))
            }
            Err(_) => {
                let error_info = ErrorInfo::new(AutomationError::Timeout {
                    operation: "Python core health check".to_string(),
                }).with_core("python".to_string());
                (false, false, Some(error_info))
            }
        }
    }

    /// Check Rust core availability and functionality
    async fn check_rust_core(&self) -> (bool, bool, Option<ErrorInfo>) {
        // Check if Rust core dependencies are available
        let rust_check = timeout(
            self.timeout_duration,
            self.check_rust_core_functionality()
        ).await;

        match rust_check {
            Ok(Ok(())) => (true, true, None),
            Ok(Err(e)) => {
                let error_info = ErrorInfo::new(e).with_core("rust".to_string());
                (false, false, Some(error_info))
            }
            Err(_) => {
                let error_info = ErrorInfo::new(AutomationError::Timeout {
                    operation: "Rust core health check".to_string(),
                }).with_core("rust".to_string());
                (false, false, Some(error_info))
            }
        }
    }

    /// Check if Python is installed and accessible
    async fn check_python_installation(&self) -> Result<()> {
        use tokio::process::Command;

        let python_cmd = if cfg!(target_os = "windows") {
            "python"
        } else {
            "python3"
        };

        let output = Command::new(python_cmd)
            .arg("--version")
            .output()
            .await
            .map_err(|e| AutomationError::DependencyMissing {
                dependency: "Python 3.9+".to_string(),
                suggestion: format!("Python is not installed or not in PATH: {}. Please install Python 3.9 or later.", e),
            })?;

        if !output.status.success() {
            return Err(AutomationError::DependencyMissing {
                dependency: "Python 3.9+".to_string(),
                suggestion: "Python command failed. Please ensure Python 3.9+ is properly installed.".to_string(),
            });
        }

        // Check Python version
        let version_output = String::from_utf8_lossy(&output.stdout);
        if !version_output.contains("Python 3.") {
            return Err(AutomationError::DependencyMissing {
                dependency: "Python 3.9+".to_string(),
                suggestion: format!("Found Python version: {}. Please install Python 3.9 or later.", version_output.trim()),
            });
        }

        Ok(())
    }

    /// Check if Python core functionality is working
    async fn check_python_core_functionality(&self) -> Result<()> {
        // This would typically involve:
        // 1. Checking if required Python packages are installed
        // 2. Testing basic automation functionality
        // 3. Verifying permissions
        
        // For now, we'll do a basic import check
        use tokio::process::Command;

        let python_cmd = if cfg!(target_os = "windows") {
            "python"
        } else {
            "python3"
        };

        let output = Command::new(python_cmd)
            .arg("-c")
            .arg("import pyautogui, keyboard, mouse; print('OK')")
            .output()
            .await
            .map_err(|e| AutomationError::CoreHealthCheckFailed {
                core_type: "python".to_string(),
                reason: format!("Failed to test Python core functionality: {}", e),
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AutomationError::CoreHealthCheckFailed {
                core_type: "python".to_string(),
                reason: format!("Python core dependencies missing: {}", stderr),
            });
        }

        Ok(())
    }

    /// Check if Rust core functionality is working
    async fn check_rust_core_functionality(&self) -> Result<()> {
        // Check platform-specific dependencies
        #[cfg(target_os = "windows")]
        {
            // On Windows, check if we can access Windows API
            self.check_windows_permissions().await
        }

        #[cfg(target_os = "macos")]
        {
            // On macOS, check accessibility permissions
            self.check_macos_permissions().await
        }

        #[cfg(target_os = "linux")]
        {
            // On Linux, check X11/Wayland availability
            self.check_linux_permissions().await
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            Err(AutomationError::UnsupportedPlatform {
                platform: std::env::consts::OS.to_string(),
            })
        }
    }

    #[cfg(target_os = "windows")]
    async fn check_windows_permissions(&self) -> Result<()> {
        // Check if we can access Windows API functions
        use winapi::um::winuser::{GetCursorPos, SetCursorPos};
        use winapi::shared::windef::POINT;

        unsafe {
            let mut point = POINT { x: 0, y: 0 };
            if GetCursorPos(&mut point) == 0 {
                return Err(AutomationError::PermissionDenied {
                    operation: "Windows cursor position access".to_string(),
                });
            }

            // Try to set cursor position (this might fail in some security contexts)
            if SetCursorPos(point.x, point.y) == 0 {
                return Err(AutomationError::PermissionDenied {
                    operation: "Windows cursor control".to_string(),
                });
            }
        }

        Ok(())
    }

    #[cfg(target_os = "macos")]
    async fn check_macos_permissions(&self) -> Result<()> {
        // Check accessibility permissions on macOS
        // Note: The accessibility_api_enabled function may not be available in all versions
        // For now, we'll do a basic check
        use tokio::process::Command;

        let output = Command::new("osascript")
            .arg("-e")
            .arg("tell application \"System Events\" to get name of first process")
            .output()
            .await
            .map_err(|_| AutomationError::PermissionDenied {
                operation: "macOS Accessibility API access".to_string(),
            })?;

        if !output.status.success() {
            return Err(AutomationError::PermissionDenied {
                operation: "macOS Accessibility API access".to_string(),
            });
        }

        Ok(())
    }

    #[cfg(target_os = "linux")]
    async fn check_linux_permissions(&self) -> Result<()> {
        // Check if we can connect to X11 display
        use std::env;

        if env::var("DISPLAY").is_err() && env::var("WAYLAND_DISPLAY").is_err() {
            return Err(AutomationError::SystemError {
                message: "No display server found (neither X11 nor Wayland)".to_string(),
            });
        }

        // Try to open X11 connection
        if let Ok(display) = env::var("DISPLAY") {
            if display.is_empty() {
                return Err(AutomationError::SystemError {
                    message: "DISPLAY environment variable is empty".to_string(),
                });
            }
        }

        Ok(())
    }

    /// Update performance metrics based on new measurement
    fn update_performance_metrics(
        &self,
        current: &PerformanceMetrics,
        response_time: Option<Duration>,
        success: bool,
    ) -> PerformanceMetrics {
        let new_count = current.operations_count + 1;
        let new_success_rate = if success {
            (current.success_rate * current.operations_count as f32 + 1.0) / new_count as f32
        } else {
            (current.success_rate * current.operations_count as f32) / new_count as f32
        };

        let new_avg_response_time = if let Some(rt) = response_time {
            let total_time = current.avg_response_time * current.operations_count as u32 + rt;
            total_time / new_count as u32
        } else {
            current.avg_response_time
        };

        PerformanceMetrics {
            avg_response_time: new_avg_response_time,
            memory_usage: current.memory_usage, // Would be updated by system monitoring
            cpu_usage: current.cpu_usage,       // Would be updated by system monitoring
            success_rate: new_success_rate,
            operations_count: new_count,
        }
    }

    /// Get available cores (cores that are both available and functional)
    pub fn get_available_cores(&self) -> Vec<CoreType> {
        self.health_status
            .values()
            .filter(|health| health.is_available && health.is_functional)
            .map(|health| health.core_type.clone())
            .collect()
    }

    /// Get the health status of a specific core
    pub fn get_core_health(&self, core_type: &CoreType) -> Option<&CoreHealth> {
        self.health_status.get(core_type)
    }

    /// Get all health statuses
    pub fn get_all_health_status(&self) -> &HashMap<CoreType, CoreHealth> {
        &self.health_status
    }

    /// Check if a core needs health check (based on last check time)
    pub fn needs_health_check(&self, core_type: &CoreType) -> bool {
        match self.health_status.get(core_type) {
            Some(health) => {
                let elapsed = chrono::Utc::now() - health.last_check;
                elapsed.num_seconds() as u64 > self.check_interval.as_secs()
            }
            None => true, // Never checked before
        }
    }

    /// Suggest the best available core based on performance metrics
    pub fn suggest_best_core(&self) -> Option<CoreType> {
        let available_cores = self.get_available_cores();
        
        if available_cores.is_empty() {
            return None;
        }

        // Score cores based on performance metrics
        let mut best_core = None;
        let mut best_score = f32::MIN;

        for core_type in available_cores {
            if let Some(health) = self.health_status.get(&core_type) {
                let score = self.calculate_core_score(&health.performance_metrics);
                if score > best_score {
                    best_score = score;
                    best_core = Some(core_type);
                }
            }
        }

        best_core
    }

    /// Calculate a performance score for a core
    fn calculate_core_score(&self, metrics: &PerformanceMetrics) -> f32 {
        // Weight factors for different metrics
        const SUCCESS_RATE_WEIGHT: f32 = 0.4;
        const RESPONSE_TIME_WEIGHT: f32 = 0.3;
        const OPERATIONS_COUNT_WEIGHT: f32 = 0.3;

        let success_score = metrics.success_rate * SUCCESS_RATE_WEIGHT;
        
        // Lower response time is better (invert and normalize)
        let response_score = if metrics.avg_response_time.as_millis() > 0 {
            (1000.0 / metrics.avg_response_time.as_millis() as f32) * RESPONSE_TIME_WEIGHT
        } else {
            RESPONSE_TIME_WEIGHT
        };

        // More operations indicate more reliability
        let operations_score = (metrics.operations_count as f32).ln().max(0.0) * OPERATIONS_COUNT_WEIGHT;

        success_score + response_score + operations_score
    }
}

impl Default for CoreHealthChecker {
    fn default() -> Self {
        Self::new()
    }
}
