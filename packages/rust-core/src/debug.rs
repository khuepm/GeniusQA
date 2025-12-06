//! Debug and diagnostic utilities for playback
//!
//! This module provides debugging tools, diagnostic capabilities, and verification
//! utilities for playback functionality. It includes debug mode with verbose logging,
//! dry-run mode for script validation, and comprehensive diagnostic reporting.

use crate::{
    Result, AutomationError, ScriptData, Action, ActionType,
    config::{AutomationConfig, DebugConfig},
    logging::{CoreType, OperationType, LogLevel, get_logger},
    validation::ScriptValidator,
};
use serde::{Serialize, Deserialize};
use serde_json::json;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use chrono::Utc;

/// Debug mode controller for playback
pub struct DebugController {
    config: DebugConfig,
    action_confirmations: Vec<ActionConfirmation>,
    timing_diagnostics: Vec<TimingDiagnostic>,
}

/// Action confirmation record for debug mode
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionConfirmation {
    pub action_index: usize,
    pub action_type: String,
    pub timestamp: f64,
    pub confirmed_at: String,
    pub user_input: Option<String>,
}

/// Timing diagnostic record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimingDiagnostic {
    pub action_index: usize,
    pub expected_delay_ms: f64,
    pub actual_delay_ms: f64,
    pub execution_time_ms: f64,
    pub timing_drift_ms: f64,
    pub drift_percentage: f64,
}

/// Script verification result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub is_valid: bool,
    pub total_actions: usize,
    pub supported_actions: usize,
    pub unsupported_actions: usize,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub estimated_duration_seconds: f64,
}

/// Dry-run simulation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DryRunResult {
    pub script_name: String,
    pub total_actions: usize,
    pub simulated_actions: Vec<SimulatedAction>,
    pub estimated_duration_seconds: f64,
    pub potential_issues: Vec<String>,
}

/// Simulated action for dry-run mode
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulatedAction {
    pub index: usize,
    pub action_type: String,
    pub timestamp: f64,
    pub would_execute: bool,
    pub reason: Option<String>,
}

/// Platform capability detection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformCapabilities {
    pub platform: String,
    pub mouse_control: bool,
    pub keyboard_control: bool,
    pub screen_capture: bool,
    pub permissions_granted: bool,
    pub display_server: Option<String>,
    pub screen_resolution: Option<(u32, u32)>,
    pub additional_info: HashMap<String, String>,
}

/// System information for diagnostics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub os_version: String,
    pub architecture: String,
    pub hostname: String,
    pub rust_version: String,
    pub core_version: String,
    pub timestamp: String,
}

/// Diagnostic report combining all diagnostic information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticReport {
    pub system_info: SystemInfo,
    pub platform_capabilities: PlatformCapabilities,
    pub script_verification: Option<VerificationResult>,
    pub timing_diagnostics: Vec<TimingDiagnostic>,
    pub generated_at: String,
}

impl DebugController {
    /// Create a new debug controller
    pub fn new(config: DebugConfig) -> Self {
        Self {
            config,
            action_confirmations: Vec::new(),
            timing_diagnostics: Vec::new(),
        }
    }

    /// Check if debug mode is enabled
    pub fn is_enabled(&self) -> bool {
        self.config.enabled
    }

    /// Check if action confirmation is required
    pub fn requires_confirmation(&self) -> bool {
        self.config.action_confirmation
    }

    /// Get pause duration between actions
    pub fn pause_duration(&self) -> Duration {
        Duration::from_millis(self.config.pause_between_actions_ms)
    }

    /// Log debug message with verbose details
    pub fn log_debug(&self, message: &str, metadata: Option<HashMap<String, serde_json::Value>>) {
        if !self.config.enabled {
            return;
        }

        if let Some(logger) = get_logger() {
            let log_level = match self.config.log_level.as_str() {
                "trace" => LogLevel::Trace,
                "debug" => LogLevel::Debug,
                "info" => LogLevel::Info,
                "warn" => LogLevel::Warn,
                "error" => LogLevel::Error,
                _ => LogLevel::Debug,
            };

            logger.log_operation(
                log_level,
                CoreType::Rust,
                OperationType::Playback,
                format!("debug_{}", Utc::now().timestamp_millis()),
                message.to_string(),
                metadata,
            );
        }
    }

    /// Request action confirmation from user (simulated for now)
    pub fn request_action_confirmation(&mut self, action_index: usize, action: &Action) -> bool {
        if !self.config.action_confirmation {
            return true;
        }

        let confirmation = ActionConfirmation {
            action_index,
            action_type: format!("{:?}", action.action_type),
            timestamp: action.timestamp,
            confirmed_at: Utc::now().to_rfc3339(),
            user_input: Some("auto-confirmed".to_string()),
        };

        self.action_confirmations.push(confirmation.clone());

        // Log confirmation request
        let mut metadata = HashMap::new();
        metadata.insert("action_index".to_string(), json!(action_index));
        metadata.insert("action_type".to_string(), json!(&confirmation.action_type));
        metadata.insert("timestamp".to_string(), json!(action.timestamp));

        self.log_debug(
            &format!("Action confirmation requested for action {}", action_index),
            Some(metadata),
        );

        // For now, auto-confirm. In a real implementation, this would wait for user input
        true
    }

    /// Record timing diagnostic
    pub fn record_timing_diagnostic(
        &mut self,
        action_index: usize,
        expected_delay_ms: f64,
        actual_delay_ms: f64,
        execution_time_ms: f64,
    ) {
        if !self.config.timing_diagnostics {
            return;
        }

        let timing_drift_ms = actual_delay_ms - expected_delay_ms;
        let drift_percentage = if expected_delay_ms > 0.0 {
            (timing_drift_ms / expected_delay_ms) * 100.0
        } else {
            0.0
        };

        let diagnostic = TimingDiagnostic {
            action_index,
            expected_delay_ms,
            actual_delay_ms,
            execution_time_ms,
            timing_drift_ms,
            drift_percentage,
        };

        self.timing_diagnostics.push(diagnostic.clone());

        // Log timing diagnostic
        let mut metadata = HashMap::new();
        metadata.insert("action_index".to_string(), json!(action_index));
        metadata.insert("expected_delay_ms".to_string(), json!(expected_delay_ms));
        metadata.insert("actual_delay_ms".to_string(), json!(actual_delay_ms));
        metadata.insert("execution_time_ms".to_string(), json!(execution_time_ms));
        metadata.insert("timing_drift_ms".to_string(), json!(timing_drift_ms));
        metadata.insert("drift_percentage".to_string(), json!(drift_percentage));

        self.log_debug(
            &format!("Timing diagnostic for action {}: drift={:.2}ms ({:.1}%)",
                action_index, timing_drift_ms, drift_percentage),
            Some(metadata),
        );
    }

    /// Get all timing diagnostics
    pub fn get_timing_diagnostics(&self) -> &[TimingDiagnostic] {
        &self.timing_diagnostics
    }

    /// Get all action confirmations
    pub fn get_action_confirmations(&self) -> &[ActionConfirmation] {
        &self.action_confirmations
    }

    /// Clear all recorded diagnostics
    pub fn clear_diagnostics(&mut self) {
        self.action_confirmations.clear();
        self.timing_diagnostics.clear();
    }
}

/// Script verification utilities
pub struct ScriptVerifier;

impl ScriptVerifier {
    /// Verify a script before playback
    pub fn verify_script(script: &ScriptData) -> Result<VerificationResult> {
        let mut warnings = Vec::new();
        let mut errors = Vec::new();
        let mut supported_count = 0;
        let mut unsupported_count = 0;

        // Validate script structure
        let validator = ScriptValidator::new();
        let compat_result = validator.validate_script(script)?;

        if !compat_result.is_compatible {
            for issue in &compat_result.issues {
                errors.push(format!("{}: {}", issue.field, issue.message));
            }
        }

        warnings.extend(compat_result.warnings);

        // Check each action for support
        for (index, action) in script.actions.iter().enumerate() {
            let is_supported = Self::is_action_supported(action);
            
            if is_supported {
                supported_count += 1;
            } else {
                unsupported_count += 1;
                warnings.push(format!(
                    "Action {} ({:?}) may not be fully supported or is missing required fields",
                    index, action.action_type
                ));
            }
        }

        // Estimate duration
        let estimated_duration = if let Some(last_action) = script.actions.last() {
            last_action.timestamp
        } else {
            0.0
        };

        Ok(VerificationResult {
            is_valid: errors.is_empty(),
            total_actions: script.actions.len(),
            supported_actions: supported_count,
            unsupported_actions: unsupported_count,
            warnings,
            errors,
            estimated_duration_seconds: estimated_duration,
        })
    }

    /// Check if an action is supported
    fn is_action_supported(action: &Action) -> bool {
        match action.action_type {
            ActionType::MouseMove => action.x.is_some() && action.y.is_some(),
            ActionType::MouseClick => action.x.is_some() && action.y.is_some() && action.button.is_some(),
            ActionType::MouseDoubleClick => action.x.is_some() && action.y.is_some() && action.button.is_some(),
            ActionType::MouseDrag => action.x.is_some() && action.y.is_some() && action.button.is_some(),
            ActionType::MouseScroll => action.x.is_some() && action.y.is_some(),
            ActionType::KeyPress => action.key.is_some(),
            ActionType::KeyRelease => action.key.is_some(),
            ActionType::KeyType => action.text.is_some(),
            ActionType::Wait => true,
            ActionType::Screenshot => false,
            ActionType::Custom => false,
        }
    }

    /// Perform a dry-run simulation of script playback
    pub fn dry_run(script: &ScriptData) -> Result<DryRunResult> {
        let mut simulated_actions = Vec::new();
        let mut potential_issues = Vec::new();

        for (index, action) in script.actions.iter().enumerate() {
            let is_supported = Self::is_action_supported(action);
            let would_execute = is_supported;
            
            let reason = if !is_supported {
                Some(match action.action_type {
                    ActionType::Screenshot => "Screenshot actions are not executed during playback".to_string(),
                    ActionType::Custom => "Custom actions are not supported".to_string(),
                    _ => "Missing required fields".to_string(),
                })
            } else {
                None
            };

            if let Some(ref reason_text) = reason {
                potential_issues.push(format!("Action {}: {}", index, reason_text));
            }

            simulated_actions.push(SimulatedAction {
                index,
                action_type: format!("{:?}", action.action_type),
                timestamp: action.timestamp,
                would_execute,
                reason,
            });
        }

        let estimated_duration = if let Some(last_action) = script.actions.last() {
            last_action.timestamp
        } else {
            0.0
        };

        Ok(DryRunResult {
            script_name: script.metadata.created_at.to_rfc3339(),
            total_actions: script.actions.len(),
            simulated_actions,
            estimated_duration_seconds: estimated_duration,
            potential_issues,
        })
    }

    /// Analyze script for potential issues
    pub fn analyze_script(script: &ScriptData) -> Vec<String> {
        let mut issues = Vec::new();

        // Check for rapid actions
        for i in 1..script.actions.len() {
            let time_diff = script.actions[i].timestamp - script.actions[i - 1].timestamp;
            if time_diff < 0.01 {
                issues.push(format!(
                    "Actions {} and {} are very close in time ({:.3}s apart)",
                    i - 1, i, time_diff
                ));
            }
        }

        // Check for out-of-order timestamps
        for i in 1..script.actions.len() {
            if script.actions[i].timestamp < script.actions[i - 1].timestamp {
                issues.push(format!(
                    "Action {} has timestamp before action {}",
                    i, i - 1
                ));
            }
        }

        // Check for missing coordinates
        for (i, action) in script.actions.iter().enumerate() {
            match action.action_type {
                ActionType::MouseMove | ActionType::MouseClick | ActionType::MouseDoubleClick => {
                    if action.x.is_none() || action.y.is_none() {
                        issues.push(format!("Action {} is missing coordinates", i));
                    }
                }
                _ => {}
            }
        }

        issues
    }
}

/// Platform diagnostics utilities
pub struct PlatformDiagnostics;

impl PlatformDiagnostics {
    /// Detect platform capabilities
    pub fn detect_capabilities() -> PlatformCapabilities {
        let platform = std::env::consts::OS.to_string();
        let mut additional_info = HashMap::new();

        // Detect display server on Linux
        let display_server = if platform == "linux" {
            if std::env::var("WAYLAND_DISPLAY").is_ok() {
                additional_info.insert("display_server".to_string(), "wayland".to_string());
                Some("wayland".to_string())
            } else if std::env::var("DISPLAY").is_ok() {
                additional_info.insert("display_server".to_string(), "x11".to_string());
                Some("x11".to_string())
            } else {
                additional_info.insert("display_server".to_string(), "unknown".to_string());
                None
            }
        } else {
            None
        };

        // For now, assume capabilities are available
        // In a real implementation, this would check actual platform capabilities
        PlatformCapabilities {
            platform,
            mouse_control: true,
            keyboard_control: true,
            screen_capture: true,
            permissions_granted: false, // Would need actual permission check
            display_server,
            screen_resolution: None, // Would need actual screen size detection
            additional_info,
        }
    }

    /// Collect system information
    pub fn collect_system_info() -> SystemInfo {
        SystemInfo {
            os: std::env::consts::OS.to_string(),
            os_version: "unknown".to_string(), // Would need platform-specific detection
            architecture: std::env::consts::ARCH.to_string(),
            hostname: hostname::get()
                .ok()
                .and_then(|h| h.into_string().ok())
                .unwrap_or_else(|| "unknown".to_string()),
            rust_version: rustc_version_runtime::version().to_string(),
            core_version: env!("CARGO_PKG_VERSION").to_string(),
            timestamp: Utc::now().to_rfc3339(),
        }
    }

    /// Generate comprehensive diagnostic report
    pub fn generate_diagnostic_report(
        script: Option<&ScriptData>,
        timing_diagnostics: Vec<TimingDiagnostic>,
    ) -> Result<DiagnosticReport> {
        let system_info = Self::collect_system_info();
        let platform_capabilities = Self::detect_capabilities();
        
        let script_verification = if let Some(script) = script {
            Some(ScriptVerifier::verify_script(script)?)
        } else {
            None
        };

        Ok(DiagnosticReport {
            system_info,
            platform_capabilities,
            script_verification,
            timing_diagnostics,
            generated_at: Utc::now().to_rfc3339(),
        })
    }

    /// Log diagnostic report
    pub fn log_diagnostic_report(report: &DiagnosticReport) {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("os".to_string(), json!(&report.system_info.os));
            metadata.insert("architecture".to_string(), json!(&report.system_info.architecture));
            metadata.insert("hostname".to_string(), json!(&report.system_info.hostname));
            metadata.insert("rust_version".to_string(), json!(&report.system_info.rust_version));
            metadata.insert("core_version".to_string(), json!(&report.system_info.core_version));
            metadata.insert("platform".to_string(), json!(&report.platform_capabilities.platform));
            metadata.insert("mouse_control".to_string(), json!(report.platform_capabilities.mouse_control));
            metadata.insert("keyboard_control".to_string(), json!(report.platform_capabilities.keyboard_control));
            metadata.insert("permissions_granted".to_string(), json!(report.platform_capabilities.permissions_granted));

            if let Some(ref verification) = report.script_verification {
                metadata.insert("script_valid".to_string(), json!(verification.is_valid));
                metadata.insert("total_actions".to_string(), json!(verification.total_actions));
                metadata.insert("supported_actions".to_string(), json!(verification.supported_actions));
                metadata.insert("unsupported_actions".to_string(), json!(verification.unsupported_actions));
            }

            metadata.insert("timing_diagnostics_count".to_string(), json!(report.timing_diagnostics.len()));

            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Playback,
                format!("diagnostic_report_{}", Utc::now().timestamp_millis()),
                "Diagnostic report generated".to_string(),
                Some(metadata),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ScriptData;

    #[test]
    fn test_debug_controller_creation() {
        let config = DebugConfig::default();
        let controller = DebugController::new(config);
        
        assert!(!controller.is_enabled());
        assert!(!controller.requires_confirmation());
    }

    #[test]
    fn test_debug_controller_with_enabled_debug() {
        let mut config = DebugConfig::default();
        config.enabled = true;
        config.action_confirmation = true;
        config.pause_between_actions_ms = 500;
        
        let controller = DebugController::new(config);
        
        assert!(controller.is_enabled());
        assert!(controller.requires_confirmation());
        assert_eq!(controller.pause_duration(), Duration::from_millis(500));
    }

    #[test]
    fn test_timing_diagnostic_recording() {
        let config = DebugConfig {
            enabled: true,
            timing_diagnostics: true,
            ..Default::default()
        };
        let mut controller = DebugController::new(config);
        
        controller.record_timing_diagnostic(0, 100.0, 105.0, 50.0);
        
        let diagnostics = controller.get_timing_diagnostics();
        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].action_index, 0);
        assert_eq!(diagnostics[0].expected_delay_ms, 100.0);
        assert_eq!(diagnostics[0].actual_delay_ms, 105.0);
        assert_eq!(diagnostics[0].timing_drift_ms, 5.0);
    }

    #[test]
    fn test_script_verification() {
        let mut script = ScriptData::new("rust", "test");
        script.add_action(Action::mouse_move(100, 200, 0.0));
        script.add_action(Action::mouse_click(100, 200, "left", 0.5));
        
        let result = ScriptVerifier::verify_script(&script).unwrap();
        
        assert!(result.is_valid);
        assert_eq!(result.total_actions, 2);
        assert_eq!(result.supported_actions, 2);
        assert_eq!(result.unsupported_actions, 0);
    }

    #[test]
    fn test_dry_run_simulation() {
        let mut script = ScriptData::new("rust", "test");
        script.add_action(Action::mouse_move(100, 200, 0.0));
        script.add_action(Action::mouse_click(100, 200, "left", 0.5));
        
        let result = ScriptVerifier::dry_run(&script).unwrap();
        
        assert_eq!(result.total_actions, 2);
        assert_eq!(result.simulated_actions.len(), 2);
        assert!(result.simulated_actions[0].would_execute);
        assert!(result.simulated_actions[1].would_execute);
    }

    #[test]
    fn test_platform_capabilities_detection() {
        let capabilities = PlatformDiagnostics::detect_capabilities();
        
        assert!(!capabilities.platform.is_empty());
        // Other assertions depend on the actual platform
    }

    #[test]
    fn test_system_info_collection() {
        let info = PlatformDiagnostics::collect_system_info();
        
        assert!(!info.os.is_empty());
        assert!(!info.architecture.is_empty());
        assert!(!info.rust_version.is_empty());
        assert!(!info.core_version.is_empty());
    }

    #[test]
    fn test_diagnostic_report_generation() {
        let mut script = ScriptData::new("rust", "test");
        script.add_action(Action::mouse_move(100, 200, 0.0));
        
        let timing_diagnostics = vec![
            TimingDiagnostic {
                action_index: 0,
                expected_delay_ms: 100.0,
                actual_delay_ms: 105.0,
                execution_time_ms: 50.0,
                timing_drift_ms: 5.0,
                drift_percentage: 5.0,
            },
        ];
        
        let report = PlatformDiagnostics::generate_diagnostic_report(
            Some(&script),
            timing_diagnostics,
        ).unwrap();
        
        assert!(report.script_verification.is_some());
        assert_eq!(report.timing_diagnostics.len(), 1);
    }

    #[test]
    fn test_script_analysis() {
        let mut script = ScriptData::new("rust", "test");
        script.add_action(Action::mouse_move(100, 200, 0.0));
        script.add_action(Action::mouse_click(100, 200, "left", 0.005)); // Very close in time
        
        let issues = ScriptVerifier::analyze_script(&script);
        
        // Should detect rapid actions
        assert!(!issues.is_empty());
    }
}
