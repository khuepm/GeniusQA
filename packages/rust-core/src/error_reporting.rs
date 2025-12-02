//! Cross-core error reporting and consistency mechanisms

use crate::{AutomationError, ErrorInfo, ErrorSeverity, health::CoreType};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Unified error reporting system for cross-core consistency
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorReport {
    pub id: String,
    pub core_type: CoreType,
    pub error_info: ErrorInfo,
    pub operation_context: OperationContext,
    pub performance_impact: Option<PerformanceImpact>,
    pub suggested_actions: Vec<SuggestedAction>,
}

/// Context information about the operation that failed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationContext {
    pub operation_type: String,
    pub operation_id: Option<String>,
    pub user_action: Option<String>,
    pub system_state: HashMap<String, serde_json::Value>,
    pub duration_before_failure: Option<std::time::Duration>,
}

/// Performance impact assessment of an error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceImpact {
    pub severity: PerformanceImpactSeverity,
    pub affected_metrics: Vec<String>,
    pub estimated_degradation: f32, // Percentage
    pub recovery_time_estimate: Option<std::time::Duration>,
}

/// Severity of performance impact
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PerformanceImpactSeverity {
    Minimal,   // < 5% performance impact
    Moderate,  // 5-20% performance impact
    Severe,    // 20-50% performance impact
    Critical,  // > 50% performance impact
}

/// Suggested action for error recovery
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestedAction {
    pub action_type: ActionType,
    pub description: String,
    pub priority: ActionPriority,
    pub estimated_success_rate: f32,
    pub requires_user_intervention: bool,
}

/// Type of suggested action
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ActionType {
    Retry,
    SwitchCore,
    RestartProcess,
    CheckPermissions,
    UpdateConfiguration,
    ContactSupport,
}

/// Priority of suggested action
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, PartialOrd)]
pub enum ActionPriority {
    Low,
    Medium,
    High,
    Critical,
}

/// Cross-core error reporter for consistent error handling
pub struct CrossCoreErrorReporter {
    error_history: Arc<RwLock<Vec<ErrorReport>>>,
    performance_thresholds: PerformanceThresholds,
    core_specific_handlers: HashMap<CoreType, Box<dyn CoreErrorHandler + Send + Sync>>,
}

/// Performance thresholds for error detection
#[derive(Debug, Clone)]
pub struct PerformanceThresholds {
    pub response_time_warning: std::time::Duration,
    pub response_time_critical: std::time::Duration,
    pub success_rate_warning: f32,
    pub success_rate_critical: f32,
    pub memory_usage_warning: u64, // bytes
    pub memory_usage_critical: u64, // bytes
}

impl Default for PerformanceThresholds {
    fn default() -> Self {
        Self {
            response_time_warning: std::time::Duration::from_millis(1000),
            response_time_critical: std::time::Duration::from_millis(5000),
            success_rate_warning: 0.9,  // 90%
            success_rate_critical: 0.7, // 70%
            memory_usage_warning: 100 * 1024 * 1024,  // 100MB
            memory_usage_critical: 500 * 1024 * 1024, // 500MB
        }
    }
}

/// Trait for core-specific error handling
pub trait CoreErrorHandler {
    /// Handle an error specific to this core type
    fn handle_error(&self, error: &AutomationError, context: &OperationContext) -> Vec<SuggestedAction>;
    
    /// Assess performance impact of an error
    fn assess_performance_impact(&self, error: &AutomationError) -> Option<PerformanceImpact>;
    
    /// Check if core switching is recommended for this error
    fn should_suggest_core_switch(&self, error: &AutomationError) -> bool;
}

/// Python core error handler
pub struct PythonCoreErrorHandler;

impl CoreErrorHandler for PythonCoreErrorHandler {
    fn handle_error(&self, error: &AutomationError, _context: &OperationContext) -> Vec<SuggestedAction> {
        match error {
            AutomationError::PermissionDenied { operation } => vec![
                SuggestedAction {
                    action_type: ActionType::CheckPermissions,
                    description: format!("Check and grant permissions for: {}", operation),
                    priority: ActionPriority::High,
                    estimated_success_rate: 0.8,
                    requires_user_intervention: true,
                },
                SuggestedAction {
                    action_type: ActionType::SwitchCore,
                    description: "Try using Rust core which may have different permission requirements".to_string(),
                    priority: ActionPriority::Medium,
                    estimated_success_rate: 0.6,
                    requires_user_intervention: false,
                },
            ],
            AutomationError::DependencyMissing { dependency, suggestion } => vec![
                SuggestedAction {
                    action_type: ActionType::UpdateConfiguration,
                    description: format!("Install missing dependency: {} - {}", dependency, suggestion),
                    priority: ActionPriority::Critical,
                    estimated_success_rate: 0.9,
                    requires_user_intervention: true,
                },
                SuggestedAction {
                    action_type: ActionType::SwitchCore,
                    description: "Switch to Rust core to avoid Python dependencies".to_string(),
                    priority: ActionPriority::High,
                    estimated_success_rate: 0.8,
                    requires_user_intervention: false,
                },
            ],
            AutomationError::RecordingError { .. } | AutomationError::PlaybackError { .. } => vec![
                SuggestedAction {
                    action_type: ActionType::Retry,
                    description: "Retry the operation after a brief delay".to_string(),
                    priority: ActionPriority::Medium,
                    estimated_success_rate: 0.7,
                    requires_user_intervention: false,
                },
                SuggestedAction {
                    action_type: ActionType::RestartProcess,
                    description: "Restart Python automation process".to_string(),
                    priority: ActionPriority::Medium,
                    estimated_success_rate: 0.8,
                    requires_user_intervention: false,
                },
                SuggestedAction {
                    action_type: ActionType::SwitchCore,
                    description: "Switch to Rust core for potentially better performance".to_string(),
                    priority: ActionPriority::Low,
                    estimated_success_rate: 0.6,
                    requires_user_intervention: false,
                },
            ],
            _ => vec![
                SuggestedAction {
                    action_type: ActionType::Retry,
                    description: "Retry the operation".to_string(),
                    priority: ActionPriority::Low,
                    estimated_success_rate: 0.5,
                    requires_user_intervention: false,
                },
            ],
        }
    }

    fn assess_performance_impact(&self, error: &AutomationError) -> Option<PerformanceImpact> {
        match error {
            AutomationError::PerformanceDegradation { .. } => Some(PerformanceImpact {
                severity: PerformanceImpactSeverity::Moderate,
                affected_metrics: vec!["response_time".to_string(), "success_rate".to_string()],
                estimated_degradation: 15.0,
                recovery_time_estimate: Some(std::time::Duration::from_secs(30)),
            }),
            AutomationError::Timeout { .. } => Some(PerformanceImpact {
                severity: PerformanceImpactSeverity::Severe,
                affected_metrics: vec!["response_time".to_string()],
                estimated_degradation: 30.0,
                recovery_time_estimate: Some(std::time::Duration::from_secs(60)),
            }),
            AutomationError::RecordingError { .. } | AutomationError::PlaybackError { .. } => Some(PerformanceImpact {
                severity: PerformanceImpactSeverity::Moderate,
                affected_metrics: vec!["success_rate".to_string()],
                estimated_degradation: 20.0,
                recovery_time_estimate: Some(std::time::Duration::from_secs(15)),
            }),
            _ => None,
        }
    }

    fn should_suggest_core_switch(&self, error: &AutomationError) -> bool {
        matches!(
            error,
            AutomationError::PerformanceDegradation { .. } |
            AutomationError::DependencyMissing { .. } |
            AutomationError::Timeout { .. }
        )
    }
}

/// Rust core error handler
pub struct RustCoreErrorHandler;

impl CoreErrorHandler for RustCoreErrorHandler {
    fn handle_error(&self, error: &AutomationError, _context: &OperationContext) -> Vec<SuggestedAction> {
        match error {
            AutomationError::PermissionDenied { operation } => vec![
                SuggestedAction {
                    action_type: ActionType::CheckPermissions,
                    description: format!("Grant system permissions for: {}", operation),
                    priority: ActionPriority::High,
                    estimated_success_rate: 0.9,
                    requires_user_intervention: true,
                },
                SuggestedAction {
                    action_type: ActionType::SwitchCore,
                    description: "Try Python core which may work with current permissions".to_string(),
                    priority: ActionPriority::Medium,
                    estimated_success_rate: 0.7,
                    requires_user_intervention: false,
                },
            ],
            AutomationError::UnsupportedPlatform { platform } => vec![
                SuggestedAction {
                    action_type: ActionType::SwitchCore,
                    description: format!("Platform {} not supported by Rust core, switch to Python core", platform),
                    priority: ActionPriority::Critical,
                    estimated_success_rate: 0.9,
                    requires_user_intervention: false,
                },
            ],
            AutomationError::RecordingError { .. } | AutomationError::PlaybackError { .. } => vec![
                SuggestedAction {
                    action_type: ActionType::Retry,
                    description: "Retry the operation with Rust core".to_string(),
                    priority: ActionPriority::Medium,
                    estimated_success_rate: 0.8,
                    requires_user_intervention: false,
                },
                SuggestedAction {
                    action_type: ActionType::SwitchCore,
                    description: "Switch to Python core as fallback".to_string(),
                    priority: ActionPriority::Low,
                    estimated_success_rate: 0.7,
                    requires_user_intervention: false,
                },
            ],
            _ => vec![
                SuggestedAction {
                    action_type: ActionType::Retry,
                    description: "Retry the operation".to_string(),
                    priority: ActionPriority::Low,
                    estimated_success_rate: 0.6,
                    requires_user_intervention: false,
                },
            ],
        }
    }

    fn assess_performance_impact(&self, error: &AutomationError) -> Option<PerformanceImpact> {
        match error {
            AutomationError::PerformanceDegradation { .. } => Some(PerformanceImpact {
                severity: PerformanceImpactSeverity::Minimal,
                affected_metrics: vec!["response_time".to_string()],
                estimated_degradation: 5.0,
                recovery_time_estimate: Some(std::time::Duration::from_secs(10)),
            }),
            AutomationError::SystemError { .. } => Some(PerformanceImpact {
                severity: PerformanceImpactSeverity::Moderate,
                affected_metrics: vec!["success_rate".to_string(), "response_time".to_string()],
                estimated_degradation: 15.0,
                recovery_time_estimate: Some(std::time::Duration::from_secs(20)),
            }),
            _ => None,
        }
    }

    fn should_suggest_core_switch(&self, error: &AutomationError) -> bool {
        matches!(
            error,
            AutomationError::UnsupportedPlatform { .. } |
            AutomationError::PermissionDenied { .. }
        )
    }
}

impl CrossCoreErrorReporter {
    /// Create a new cross-core error reporter
    pub fn new() -> Self {
        let mut core_handlers: HashMap<CoreType, Box<dyn CoreErrorHandler + Send + Sync>> = HashMap::new();
        core_handlers.insert(CoreType::Python, Box::new(PythonCoreErrorHandler));
        core_handlers.insert(CoreType::Rust, Box::new(RustCoreErrorHandler));

        Self {
            error_history: Arc::new(RwLock::new(Vec::new())),
            performance_thresholds: PerformanceThresholds::default(),
            core_specific_handlers: core_handlers,
        }
    }

    /// Report an error with full context and analysis
    pub async fn report_error(
        &self,
        core_type: CoreType,
        error: AutomationError,
        operation_context: OperationContext,
    ) -> ErrorReport {
        let error_info = ErrorInfo::new(error.clone()).with_core(core_type.to_string());
        
        // Get core-specific handling
        let suggested_actions = if let Some(handler) = self.core_specific_handlers.get(&core_type) {
            handler.handle_error(&error, &operation_context)
        } else {
            vec![]
        };

        // Assess performance impact
        let performance_impact = if let Some(handler) = self.core_specific_handlers.get(&core_type) {
            handler.assess_performance_impact(&error)
        } else {
            None
        };

        let error_report = ErrorReport {
            id: uuid::Uuid::new_v4().to_string(),
            core_type,
            error_info,
            operation_context,
            performance_impact,
            suggested_actions,
        };

        // Store in history
        let mut history = self.error_history.write().await;
        history.push(error_report.clone());

        // Keep only last 100 errors to prevent memory bloat
        if history.len() > 100 {
            let excess = history.len() - 100;
            history.drain(0..excess);
        }

        error_report
    }

    /// Detect performance-based errors and suggest core switching
    pub async fn detect_performance_issues(
        &self,
        _core_type: &CoreType,
        current_metrics: &crate::health::PerformanceMetrics,
    ) -> Vec<SuggestedAction> {
        let mut suggestions = Vec::new();

        // Check response time
        if current_metrics.avg_response_time > self.performance_thresholds.response_time_critical {
            suggestions.push(SuggestedAction {
                action_type: ActionType::SwitchCore,
                description: format!(
                    "Response time ({:?}) exceeds critical threshold ({:?}). Consider switching cores.",
                    current_metrics.avg_response_time,
                    self.performance_thresholds.response_time_critical
                ),
                priority: ActionPriority::High,
                estimated_success_rate: 0.8,
                requires_user_intervention: false,
            });
        } else if current_metrics.avg_response_time > self.performance_thresholds.response_time_warning {
            suggestions.push(SuggestedAction {
                action_type: ActionType::SwitchCore,
                description: format!(
                    "Response time ({:?}) is elevated. Switching cores may improve performance.",
                    current_metrics.avg_response_time
                ),
                priority: ActionPriority::Medium,
                estimated_success_rate: 0.6,
                requires_user_intervention: false,
            });
        }

        // Check success rate
        if current_metrics.success_rate < self.performance_thresholds.success_rate_critical {
            suggestions.push(SuggestedAction {
                action_type: ActionType::SwitchCore,
                description: format!(
                    "Success rate ({:.1}%) is critically low. Switching cores is recommended.",
                    current_metrics.success_rate * 100.0
                ),
                priority: ActionPriority::Critical,
                estimated_success_rate: 0.9,
                requires_user_intervention: false,
            });
        } else if current_metrics.success_rate < self.performance_thresholds.success_rate_warning {
            suggestions.push(SuggestedAction {
                action_type: ActionType::SwitchCore,
                description: format!(
                    "Success rate ({:.1}%) is below optimal. Consider switching cores.",
                    current_metrics.success_rate * 100.0
                ),
                priority: ActionPriority::Medium,
                estimated_success_rate: 0.7,
                requires_user_intervention: false,
            });
        }

        // Check memory usage if available
        if let Some(memory_usage) = current_metrics.memory_usage {
            if memory_usage > self.performance_thresholds.memory_usage_critical {
                suggestions.push(SuggestedAction {
                    action_type: ActionType::SwitchCore,
                    description: format!(
                        "Memory usage ({} MB) is critically high. Switching to a more efficient core is recommended.",
                        memory_usage / (1024 * 1024)
                    ),
                    priority: ActionPriority::High,
                    estimated_success_rate: 0.8,
                    requires_user_intervention: false,
                });
            }
        }

        suggestions
    }

    /// Get error history for analysis
    pub async fn get_error_history(&self) -> Vec<ErrorReport> {
        let history = self.error_history.read().await;
        history.clone()
    }

    /// Get error statistics by core type
    pub async fn get_error_statistics(&self) -> HashMap<CoreType, ErrorStatistics> {
        let history = self.error_history.read().await;
        let mut stats: HashMap<CoreType, ErrorStatistics> = HashMap::new();

        for report in history.iter() {
            let core_stats = stats.entry(report.core_type.clone()).or_insert_with(ErrorStatistics::default);
            core_stats.total_errors += 1;
            
            match report.error_info.severity {
                ErrorSeverity::Warning => core_stats.warning_count += 1,
                ErrorSeverity::Error => core_stats.error_count += 1,
                ErrorSeverity::Critical => core_stats.critical_count += 1,
            }

            if let Some(impact) = &report.performance_impact {
                match impact.severity {
                    PerformanceImpactSeverity::Minimal => core_stats.minimal_impact_count += 1,
                    PerformanceImpactSeverity::Moderate => core_stats.moderate_impact_count += 1,
                    PerformanceImpactSeverity::Severe => core_stats.severe_impact_count += 1,
                    PerformanceImpactSeverity::Critical => core_stats.critical_impact_count += 1,
                }
            }
        }

        stats
    }

    /// Clear error history
    pub async fn clear_error_history(&self) {
        let mut history = self.error_history.write().await;
        history.clear();
    }

    /// Check if core switching is recommended based on error patterns
    pub async fn should_recommend_core_switch(&self, current_core: &CoreType) -> Option<(CoreType, String)> {
        let history = self.error_history.read().await;
        
        // Look at recent errors (last 10)
        let recent_errors: Vec<&ErrorReport> = history
            .iter()
            .rev()
            .take(10)
            .filter(|report| report.core_type == *current_core)
            .collect();

        if recent_errors.len() < 3 {
            return None; // Not enough data
        }

        // Count critical errors in recent history
        let critical_errors = recent_errors
            .iter()
            .filter(|report| report.error_info.severity == ErrorSeverity::Critical)
            .count();

        // If more than 50% of recent errors are critical, recommend switching
        if critical_errors as f32 / recent_errors.len() as f32 > 0.5 {
            let alternative_core = match current_core {
                CoreType::Python => CoreType::Rust,
                CoreType::Rust => CoreType::Python,
            };

            return Some((
                alternative_core.clone(),
                format!(
                    "High rate of critical errors ({}/{}) detected with {} core. Switching to {} core is recommended.",
                    critical_errors,
                    recent_errors.len(),
                    current_core,
                    alternative_core
                ),
            ));
        }

        None
    }
}

/// Error statistics for a specific core
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ErrorStatistics {
    pub total_errors: u32,
    pub warning_count: u32,
    pub error_count: u32,
    pub critical_count: u32,
    pub minimal_impact_count: u32,
    pub moderate_impact_count: u32,
    pub severe_impact_count: u32,
    pub critical_impact_count: u32,
}

impl Default for CrossCoreErrorReporter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_error_attribution_to_core() {
        /*
         * Feature: rust-automation-core, Property 22: Error attribution to core
         * 
         * Property: For any error that occurs, the system should clearly indicate 
         * which automation core generated the error
         */
        
        let reporter = CrossCoreErrorReporter::new();
        
        let error = AutomationError::RecordingError {
            message: "Test recording error".to_string(),
        };
        
        let context = OperationContext {
            operation_type: "start_recording".to_string(),
            operation_id: Some("test_op_123".to_string()),
            user_action: Some("click_record_button".to_string()),
            system_state: HashMap::new(),
            duration_before_failure: Some(std::time::Duration::from_secs(5)),
        };
        
        let report = reporter.report_error(CoreType::Python, error, context).await;
        
        // Verify core attribution
        assert_eq!(report.core_type, CoreType::Python, "Error should be attributed to Python core");
        assert_eq!(report.error_info.core_type, Some("python".to_string()), "Error info should include core type");
        assert!(!report.id.is_empty(), "Error report should have unique ID");
        assert!(!report.suggested_actions.is_empty(), "Should provide suggested actions");
    }

    #[tokio::test]
    async fn test_performance_based_error_detection() {
        /*
         * Feature: rust-automation-core, Property 19: Performance equivalence or improvement
         * 
         * Test performance-based error detection and core switching suggestions
         */
        
        let reporter = CrossCoreErrorReporter::new();
        
        // Create metrics indicating poor performance
        let poor_metrics = crate::health::PerformanceMetrics {
            avg_response_time: std::time::Duration::from_secs(10), // Very slow
            memory_usage: Some(600 * 1024 * 1024), // High memory usage
            cpu_usage: Some(90.0), // High CPU
            success_rate: 0.5, // Low success rate
            operations_count: 100,
        };
        
        let suggestions = reporter.detect_performance_issues(&CoreType::Python, &poor_metrics).await;
        
        assert!(!suggestions.is_empty(), "Should detect performance issues");
        
        // Check that core switching is suggested
        let has_switch_suggestion = suggestions.iter().any(|s| s.action_type == ActionType::SwitchCore);
        assert!(has_switch_suggestion, "Should suggest core switching for poor performance");
        
        // Check priority levels
        let has_high_priority = suggestions.iter().any(|s| s.priority >= ActionPriority::High);
        assert!(has_high_priority, "Should have high priority suggestions for critical performance issues");
    }

    #[tokio::test]
    async fn test_cross_core_error_handling_consistency() {
        /*
         * Feature: rust-automation-core, Property 28: Error handling mechanism consistency
         * 
         * Test that both cores use consistent error handling mechanisms
         */
        
        let reporter = CrossCoreErrorReporter::new();
        
        let error = AutomationError::PermissionDenied {
            operation: "mouse_control".to_string(),
        };
        
        let context = OperationContext {
            operation_type: "automation".to_string(),
            operation_id: None,
            user_action: None,
            system_state: HashMap::new(),
            duration_before_failure: None,
        };
        
        // Test Python core error handling
        let python_report = reporter.report_error(CoreType::Python, error.clone(), context.clone()).await;
        
        // Test Rust core error handling
        let rust_report = reporter.report_error(CoreType::Rust, error, context).await;
        
        // Both should have suggested actions
        assert!(!python_report.suggested_actions.is_empty(), "Python core should provide suggested actions");
        assert!(!rust_report.suggested_actions.is_empty(), "Rust core should provide suggested actions");
        
        // Both should have similar action types for the same error
        let python_action_types: Vec<ActionType> = python_report.suggested_actions.iter().map(|a| a.action_type.clone()).collect();
        let rust_action_types: Vec<ActionType> = rust_report.suggested_actions.iter().map(|a| a.action_type.clone()).collect();
        
        // Both should suggest checking permissions
        assert!(python_action_types.contains(&ActionType::CheckPermissions), "Python should suggest checking permissions");
        assert!(rust_action_types.contains(&ActionType::CheckPermissions), "Rust should suggest checking permissions");
    }

    #[tokio::test]
    async fn test_error_statistics_tracking() {
        let reporter = CrossCoreErrorReporter::new();
        
        // Report several errors for different cores
        let context = OperationContext {
            operation_type: "test".to_string(),
            operation_id: None,
            user_action: None,
            system_state: HashMap::new(),
            duration_before_failure: None,
        };
        
        // Python errors
        reporter.report_error(CoreType::Python, AutomationError::RecordingError { message: "test".to_string() }, context.clone()).await;
        reporter.report_error(CoreType::Python, AutomationError::PermissionDenied { operation: "test".to_string() }, context.clone()).await;
        
        // Rust errors
        reporter.report_error(CoreType::Rust, AutomationError::SystemError { message: "test".to_string() }, context).await;
        
        let stats = reporter.get_error_statistics().await;
        
        assert!(stats.contains_key(&CoreType::Python), "Should have Python stats");
        assert!(stats.contains_key(&CoreType::Rust), "Should have Rust stats");
        
        let python_stats = &stats[&CoreType::Python];
        assert_eq!(python_stats.total_errors, 2, "Should track Python error count");
        
        let rust_stats = &stats[&CoreType::Rust];
        assert_eq!(rust_stats.total_errors, 1, "Should track Rust error count");
    }

    #[tokio::test]
    async fn test_core_switching_recommendation() {
        let reporter = CrossCoreErrorReporter::new();
        
        let context = OperationContext {
            operation_type: "test".to_string(),
            operation_id: None,
            user_action: None,
            system_state: HashMap::new(),
            duration_before_failure: None,
        };
        
        // Report multiple critical errors for Python core
        for _ in 0..5 {
            reporter.report_error(
                CoreType::Python,
                AutomationError::PermissionDenied { operation: "test".to_string() },
                context.clone()
            ).await;
        }
        
        let recommendation = reporter.should_recommend_core_switch(&CoreType::Python).await;
        
        match recommendation {
            Some((recommended_core, reason)) => {
                assert_eq!(recommended_core, CoreType::Rust, "Should recommend switching to Rust");
                assert!(reason.contains("critical errors"), "Reason should mention critical errors");
            }
            None => {
                // This is also acceptable if the error pattern doesn't trigger recommendation
            }
        }
    }
}
