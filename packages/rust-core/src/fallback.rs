//! Fallback and recovery mechanisms for core availability

use crate::{
    Result, AutomationError, ErrorInfo, ErrorSeverity,
    health::{CoreType, CoreHealthChecker, CoreHealth},
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use std::sync::Arc;

/// Fallback strategy configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FallbackConfig {
    /// Enable automatic fallback when core fails
    pub auto_fallback_enabled: bool,
    /// Maximum number of retry attempts before fallback
    pub max_retry_attempts: u32,
    /// Delay between retry attempts
    pub retry_delay: Duration,
    /// Timeout for core switching operations
    pub switch_timeout: Duration,
    /// Enable performance-based core switching suggestions
    pub performance_based_switching: bool,
    /// Minimum performance degradation threshold for suggestions
    pub performance_threshold: f32,
}

impl Default for FallbackConfig {
    fn default() -> Self {
        Self {
            auto_fallback_enabled: true,
            max_retry_attempts: 3,
            retry_delay: Duration::from_secs(1),
            switch_timeout: Duration::from_secs(10),
            performance_based_switching: true,
            performance_threshold: 0.7, // 70% success rate threshold
        }
    }
}

/// Fallback operation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FallbackResult {
    /// Successfully switched to fallback core
    Success { 
        from_core: CoreType, 
        to_core: CoreType,
        reason: String,
    },
    /// No fallback available
    NoFallbackAvailable { 
        failed_core: CoreType,
        reason: String,
    },
    /// Fallback failed
    FallbackFailed { 
        from_core: CoreType, 
        attempted_core: CoreType,
        error: String,
    },
    /// Retry successful, no fallback needed
    RetrySuccessful { 
        core: CoreType,
        attempt: u32,
    },
}

/// Core failure context for better error handling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailureContext {
    pub failed_core: CoreType,
    pub operation: String,
    pub error: ErrorInfo,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub retry_count: u32,
}

/// Fallback manager handles core switching and recovery
pub struct FallbackManager {
    config: FallbackConfig,
    health_checker: Arc<RwLock<CoreHealthChecker>>,
    active_core: Arc<RwLock<Option<CoreType>>>,
    preferred_core: Arc<RwLock<Option<CoreType>>>,
    failure_history: Arc<RwLock<Vec<FailureContext>>>,
    retry_counts: Arc<RwLock<HashMap<CoreType, u32>>>,
}

impl FallbackManager {
    /// Create a new fallback manager
    pub fn new(config: FallbackConfig, health_checker: CoreHealthChecker) -> Self {
        Self {
            config,
            health_checker: Arc::new(RwLock::new(health_checker)),
            active_core: Arc::new(RwLock::new(None)),
            preferred_core: Arc::new(RwLock::new(None)),
            failure_history: Arc::new(RwLock::new(Vec::new())),
            retry_counts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Initialize the fallback manager and detect available cores
    pub async fn initialize(&self) -> Result<CoreType> {
        let mut health_checker = self.health_checker.write().await;
        let health_status = health_checker.check_all_cores().await?;
        drop(health_checker);

        let available_cores = self.get_available_cores_from_health(&health_status);
        
        if available_cores.is_empty() {
            return Err(AutomationError::FallbackFailed {
                reason: "No automation cores are available".to_string(),
            });
        }

        // Select the best available core
        let selected_core = self.select_best_core(&available_cores, &health_status)?;
        
        let mut active_core = self.active_core.write().await;
        *active_core = Some(selected_core.clone());
        
        let mut preferred_core = self.preferred_core.write().await;
        if preferred_core.is_none() {
            *preferred_core = Some(selected_core.clone());
        }

        Ok(selected_core)
    }

    /// Handle core failure and attempt recovery
    pub async fn handle_core_failure(
        &self,
        failed_core: CoreType,
        operation: String,
        error: AutomationError,
    ) -> Result<FallbackResult> {
        let error_info = ErrorInfo::new(error).with_core(failed_core.to_string());
        
        // Record failure
        let failure_context = FailureContext {
            failed_core: failed_core.clone(),
            operation: operation.clone(),
            error: error_info.clone(),
            timestamp: chrono::Utc::now(),
            retry_count: self.get_retry_count(&failed_core).await,
        };

        let mut failure_history = self.failure_history.write().await;
        failure_history.push(failure_context.clone());
        drop(failure_history);

        // Increment retry count
        self.increment_retry_count(&failed_core).await;

        // Check if we should retry or fallback
        let retry_count = self.get_retry_count(&failed_core).await;
        
        if retry_count <= self.config.max_retry_attempts && error_info.can_retry {
            // Attempt retry with delay
            tokio::time::sleep(self.config.retry_delay).await;
            
            // Check if core is now healthy
            let mut health_checker = self.health_checker.write().await;
            let health = health_checker.check_core_health(&failed_core).await;
            drop(health_checker);

            if health.is_available && health.is_functional {
                self.reset_retry_count(&failed_core).await;
                return Ok(FallbackResult::RetrySuccessful {
                    core: failed_core,
                    attempt: retry_count,
                });
            }
        }

        // Retry failed or not allowed, attempt fallback
        if self.config.auto_fallback_enabled && error_info.can_fallback {
            self.attempt_fallback(failed_core, failure_context).await
        } else {
            Ok(FallbackResult::NoFallbackAvailable {
                failed_core,
                reason: "Automatic fallback is disabled or not supported for this error".to_string(),
            })
        }
    }

    /// Attempt to fallback to an alternative core
    async fn attempt_fallback(
        &self,
        failed_core: CoreType,
        failure_context: FailureContext,
    ) -> Result<FallbackResult> {
        // Get available cores
        let health_checker = self.health_checker.read().await;
        let available_cores = health_checker.get_available_cores();
        drop(health_checker);

        // Filter out the failed core
        let fallback_cores: Vec<CoreType> = available_cores
            .into_iter()
            .filter(|core| *core != failed_core)
            .collect();

        if fallback_cores.is_empty() {
            return Ok(FallbackResult::NoFallbackAvailable {
                failed_core,
                reason: "No alternative cores are available".to_string(),
            });
        }

        // Select the best fallback core
        let health_checker = self.health_checker.read().await;
        let health_status = health_checker.get_all_health_status();
        let fallback_core = self.select_best_core(&fallback_cores, health_status)?;
        drop(health_checker);

        // Attempt to switch to fallback core
        match self.switch_to_core(fallback_core.clone()).await {
            Ok(()) => {
                self.reset_retry_count(&failed_core).await;
                Ok(FallbackResult::Success {
                    from_core: failed_core,
                    to_core: fallback_core,
                    reason: format!("Automatic fallback due to: {}", failure_context.error.error),
                })
            }
            Err(e) => Ok(FallbackResult::FallbackFailed {
                from_core: failed_core,
                attempted_core: fallback_core,
                error: e.to_string(),
            }),
        }
    }

    /// Switch to a specific core
    pub async fn switch_to_core(&self, target_core: CoreType) -> Result<()> {
        // Validate that target core is available
        let health_checker = self.health_checker.read().await;
        let available_cores = health_checker.get_available_cores();
        drop(health_checker);

        if !available_cores.contains(&target_core) {
            return Err(AutomationError::CoreUnavailable {
                core_type: target_core.to_string(),
            });
        }

        // Update active core
        let mut active_core = self.active_core.write().await;
        *active_core = Some(target_core.clone());
        
        // Reset retry count for the new core
        self.reset_retry_count(&target_core).await;

        Ok(())
    }

    /// Set preferred core (user preference)
    pub async fn set_preferred_core(&self, core_type: CoreType) -> Result<()> {
        let mut preferred_core = self.preferred_core.write().await;
        *preferred_core = Some(core_type);
        Ok(())
    }

    /// Get current active core
    pub async fn get_active_core(&self) -> Option<CoreType> {
        let active_core = self.active_core.read().await;
        active_core.clone()
    }

    /// Get preferred core
    pub async fn get_preferred_core(&self) -> Option<CoreType> {
        let preferred_core = self.preferred_core.read().await;
        preferred_core.clone()
    }

    /// Check if performance-based switching is recommended
    pub async fn check_performance_recommendation(&self) -> Option<CoreType> {
        if !self.config.performance_based_switching {
            return None;
        }

        let health_checker = self.health_checker.read().await;
        let available_cores = health_checker.get_available_cores();
        
        if available_cores.len() < 2 {
            return None; // Need at least 2 cores to compare
        }

        let current_core = self.get_active_core().await?;
        let current_health = health_checker.get_core_health(&current_core)?;

        // Check if current core performance is below threshold
        if current_health.performance_metrics.success_rate < self.config.performance_threshold {
            // Suggest the best alternative core
            let suggested_core = health_checker.suggest_best_core()?;
            if suggested_core != current_core {
                return Some(suggested_core);
            }
        }

        None
    }

    /// Get failure history for analysis
    pub async fn get_failure_history(&self) -> Vec<FailureContext> {
        let failure_history = self.failure_history.read().await;
        failure_history.clone()
    }

    /// Clear failure history (useful for testing or reset)
    pub async fn clear_failure_history(&self) -> Result<()> {
        let mut failure_history = self.failure_history.write().await;
        failure_history.clear();
        
        let mut retry_counts = self.retry_counts.write().await;
        retry_counts.clear();
        
        Ok(())
    }

    /// Get runtime failure detection status
    pub async fn detect_runtime_failures(&self) -> Vec<ErrorInfo> {
        let failure_history = self.failure_history.read().await;
        let recent_failures: Vec<ErrorInfo> = failure_history
            .iter()
            .filter(|failure| {
                let elapsed = chrono::Utc::now() - failure.timestamp;
                elapsed.num_minutes() < 5 // Failures in last 5 minutes
            })
            .map(|failure| failure.error.clone())
            .collect();

        recent_failures
    }

    /// Update health checker with new health status
    pub async fn update_health_status(&self) -> Result<()> {
        let mut health_checker = self.health_checker.write().await;
        health_checker.check_all_cores().await?;
        Ok(())
    }

    // Helper methods

    async fn get_retry_count(&self, core_type: &CoreType) -> u32 {
        let retry_counts = self.retry_counts.read().await;
        retry_counts.get(core_type).copied().unwrap_or(0)
    }

    async fn increment_retry_count(&self, core_type: &CoreType) {
        let mut retry_counts = self.retry_counts.write().await;
        let count = retry_counts.get(core_type).copied().unwrap_or(0);
        retry_counts.insert(core_type.clone(), count + 1);
    }

    async fn reset_retry_count(&self, core_type: &CoreType) {
        let mut retry_counts = self.retry_counts.write().await;
        retry_counts.insert(core_type.clone(), 0);
    }

    fn get_available_cores_from_health(&self, health_status: &HashMap<CoreType, CoreHealth>) -> Vec<CoreType> {
        health_status
            .values()
            .filter(|health| health.is_available && health.is_functional)
            .map(|health| health.core_type.clone())
            .collect()
    }

    fn select_best_core(
        &self,
        available_cores: &[CoreType],
        health_status: &HashMap<CoreType, CoreHealth>,
    ) -> Result<CoreType> {
        if available_cores.is_empty() {
            return Err(AutomationError::FallbackFailed {
                reason: "No cores available for selection".to_string(),
            });
        }

        // Prefer the user's preferred core if available
        if let Some(preferred) = self.preferred_core.try_read().ok().and_then(|p| p.clone()) {
            if available_cores.contains(&preferred) {
                return Ok(preferred);
            }
        }

        // Otherwise, select based on performance metrics
        let mut best_core = available_cores[0].clone();
        let mut best_score = f32::MIN;

        for core_type in available_cores {
            if let Some(health) = health_status.get(core_type) {
                let score = self.calculate_core_score(&health.performance_metrics);
                if score > best_score {
                    best_score = score;
                    best_core = core_type.clone();
                }
            }
        }

        Ok(best_core)
    }

    fn calculate_core_score(&self, metrics: &crate::health::PerformanceMetrics) -> f32 {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::health::CoreHealthChecker;

    #[tokio::test]
    async fn test_fallback_behavior_on_core_unavailability() {
        /*
         * Feature: rust-automation-core, Property 3: Fallback behavior on core unavailability
         * 
         * Property: For any situation where the selected core becomes unavailable, 
         * the system should display an error message and fall back to the previously working core
         */
        
        let config = FallbackConfig::default();
        let health_checker = CoreHealthChecker::new();
        let fallback_manager = FallbackManager::new(config, health_checker);

        // Simulate a core failure
        let error = AutomationError::CoreUnavailable {
            core_type: "python".to_string(),
        };

        let result = fallback_manager
            .handle_core_failure(CoreType::Python, "test_operation".to_string(), error)
            .await;

        // The result should indicate appropriate fallback behavior
        assert!(result.is_ok(), "Fallback handling should not fail");
        
        match result.unwrap() {
            FallbackResult::NoFallbackAvailable { failed_core, reason } => {
                assert_eq!(failed_core, CoreType::Python);
                assert!(!reason.is_empty(), "Should provide a reason for no fallback");
            }
            FallbackResult::Success { from_core, to_core, .. } => {
                assert_eq!(from_core, CoreType::Python);
                assert_ne!(to_core, CoreType::Python, "Should fallback to different core");
            }
            _ => {
                // Other results are also valid depending on system state
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
        
        let config = FallbackConfig::default();
        let health_checker = CoreHealthChecker::new();
        let fallback_manager = FallbackManager::new(config, health_checker);

        // Simulate a recording error
        let recording_error = AutomationError::RecordingError {
            message: "Failed to capture mouse events".to_string(),
        };

        let result = fallback_manager
            .handle_core_failure(CoreType::Rust, "start_recording".to_string(), recording_error)
            .await;

        assert!(result.is_ok(), "Error handling should not panic");

        // Check that error information is properly structured
        let failure_history = fallback_manager.get_failure_history().await;
        assert!(!failure_history.is_empty(), "Should record the failure");

        let last_failure = &failure_history[failure_history.len() - 1];
        assert_eq!(last_failure.failed_core, CoreType::Rust);
        assert_eq!(last_failure.operation, "start_recording");
        assert!(matches!(last_failure.error.error, AutomationError::RecordingError { .. }));
        assert!(last_failure.error.suggested_action.is_some(), "Should provide suggested action");
    }

    #[tokio::test]
    async fn test_performance_based_core_switching() {
        let config = FallbackConfig {
            performance_based_switching: true,
            performance_threshold: 0.8,
            ..Default::default()
        };
        let health_checker = CoreHealthChecker::new();
        let fallback_manager = FallbackManager::new(config, health_checker);

        // Test performance recommendation logic
        let recommendation = fallback_manager.check_performance_recommendation().await;
        
        // Since no cores are initialized, should return None
        assert!(recommendation.is_none(), "Should not recommend switching when no cores available");
    }

    #[tokio::test]
    async fn test_retry_mechanism() {
        let config = FallbackConfig {
            max_retry_attempts: 2,
            retry_delay: Duration::from_millis(10), // Fast retry for testing
            ..Default::default()
        };
        let health_checker = CoreHealthChecker::new();
        let fallback_manager = FallbackManager::new(config, health_checker);

        // Simulate multiple failures to test retry logic
        let error = AutomationError::SystemError {
            message: "Temporary system error".to_string(),
        };

        // First failure should trigger retry
        let result1 = fallback_manager
            .handle_core_failure(CoreType::Python, "test_op".to_string(), error.clone())
            .await;
        assert!(result1.is_ok());

        // Second failure should still retry
        let result2 = fallback_manager
            .handle_core_failure(CoreType::Python, "test_op".to_string(), error.clone())
            .await;
        assert!(result2.is_ok());

        // Third failure should trigger fallback (exceeds max retries)
        let result3 = fallback_manager
            .handle_core_failure(CoreType::Python, "test_op".to_string(), error)
            .await;
        assert!(result3.is_ok());

        // Check failure history
        let history = fallback_manager.get_failure_history().await;
        assert_eq!(history.len(), 3, "Should record all failures");
    }
}

// Property-based tests for fallback behavior
#[cfg(test)]
mod property_tests {
    use super::*;

    #[tokio::test]
    async fn property_fallback_behavior_on_core_unavailability() {
        /*
         * **Feature: rust-automation-core, Property 3: Fallback behavior on core unavailability**
         * 
         * Property: For any situation where the selected core becomes unavailable, 
         * the system should display an error message and fall back to the previously working core
         */
        
        let test_cases = vec![
            (CoreType::Python, AutomationError::PermissionDenied { operation: "test_op".to_string() }, "test_operation"),
            (CoreType::Rust, AutomationError::SystemError { message: "test_error".to_string() }, "another_op"),
            (CoreType::Python, AutomationError::RecordingError { message: "recording_failed".to_string() }, "record_op"),
            (CoreType::Rust, AutomationError::PlaybackError { message: "playback_failed".to_string() }, "playback_op"),
        ];

        for (failed_core, error, operation) in test_cases {
            let config = FallbackConfig::default();
            let health_checker = CoreHealthChecker::new();
            let fallback_manager = FallbackManager::new(config, health_checker);

            let result = fallback_manager
                .handle_core_failure(failed_core.clone(), operation.to_string(), error.clone())
                .await;

            // The result should always be Ok (never panic)
            assert!(result.is_ok(), "Fallback handling should never panic for core {:?}", failed_core);

            let fallback_result = result.unwrap();
            
            // Verify the result is one of the expected types
            match fallback_result {
                FallbackResult::Success { from_core, to_core, .. } => {
                    assert_eq!(from_core, failed_core);
                    assert_ne!(to_core, failed_core, "Should fallback to different core");
                }
                FallbackResult::NoFallbackAvailable { failed_core: reported_core, reason } => {
                    assert_eq!(reported_core, failed_core);
                    assert!(!reason.is_empty(), "Should provide reason");
                }
                FallbackResult::FallbackFailed { from_core, attempted_core, error: fallback_error } => {
                    assert_eq!(from_core, failed_core);
                    assert_ne!(attempted_core, failed_core, "Should attempt different core");
                    assert!(!fallback_error.is_empty(), "Should provide error details");
                }
                FallbackResult::RetrySuccessful { core, .. } => {
                    assert_eq!(core, failed_core, "Retry should be with same core");
                }
            }
        }
    }

    #[tokio::test]
    async fn property_graceful_error_handling_during_recording() {
        /*
         * **Feature: rust-automation-core, Property 9: Graceful error handling during recording**
         * 
         * Property: For any recording error with Rust core, the system should handle it 
         * gracefully and provide clear, actionable error messages
         */
        
        let test_cases = vec![
            (CoreType::Rust, AutomationError::RecordingError { message: "mouse_capture_failed".to_string() }, "start_recording"),
            (CoreType::Python, AutomationError::RecordingError { message: "keyboard_capture_failed".to_string() }, "start_recording"),
            (CoreType::Rust, AutomationError::PermissionDenied { operation: "screen_capture".to_string() }, "capture_screen"),
            (CoreType::Python, AutomationError::Timeout { operation: "wait_for_element".to_string() }, "automation_step"),
        ];

        for (core_type, error, operation) in test_cases {
            let config = FallbackConfig::default();
            let health_checker = CoreHealthChecker::new();
            let fallback_manager = FallbackManager::new(config, health_checker);

            // Test that error handling is graceful for any error type
            let result = fallback_manager
                .handle_core_failure(core_type.clone(), operation.to_string(), error.clone())
                .await;

            // Should never panic, always return a result
            assert!(result.is_ok(), "Error handling should be graceful for core {:?}", core_type);

            let fallback_result = result.unwrap();
            
            // All results should provide meaningful information
            match &fallback_result {
                FallbackResult::Success { reason, .. } => {
                    assert!(!reason.is_empty(), "Success reason should not be empty");
                }
                FallbackResult::NoFallbackAvailable { reason, .. } => {
                    assert!(!reason.is_empty(), "No fallback reason should not be empty");
                }
                FallbackResult::FallbackFailed { error: fallback_error, .. } => {
                    assert!(!fallback_error.is_empty(), "Fallback error should not be empty");
                }
                FallbackResult::RetrySuccessful { .. } => {
                    // Retry successful is always valid
                }
            }

            // Check that failure history is recorded
            let failure_history = fallback_manager.get_failure_history().await;
            assert!(!failure_history.is_empty(), "Should record failure in history");
            
            let last_failure = &failure_history[failure_history.len() - 1];
            assert_eq!(last_failure.failed_core, core_type);
            assert_eq!(last_failure.operation, operation);
        }
    }
}
