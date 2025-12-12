//! Script format validation and cross-core compatibility utilities
//!
//! This module provides comprehensive validation for script files to ensure
//! compatibility between Python and Rust automation cores. It includes JSON
//! schema validation, format migration utilities, and compatibility testing.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use crate::{AutomationError, Result};
use crate::script::{ScriptData, ScriptMetadata, Action, ActionType};

/// JSON schema for script file validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptSchema {
    pub version: String,
    pub required_fields: Vec<String>,
    pub action_types: Vec<String>,
    pub metadata_fields: Vec<String>,
}

/// Script format validator for cross-core compatibility
#[derive(Debug)]
pub struct ScriptValidator {
    schema: ScriptSchema,
    supported_versions: Vec<String>,
}

/// Migration utility for script format upgrades
pub struct ScriptMigrator {
    migrations: HashMap<String, Box<dyn Fn(&mut Value) -> Result<()>>>,
}

/// Compatibility test result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompatibilityResult {
    pub is_compatible: bool,
    pub version: String,
    pub core_type: String,
    pub issues: Vec<CompatibilityIssue>,
    pub warnings: Vec<String>,
}

/// Compatibility issue details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompatibilityIssue {
    pub severity: IssueSeverity,
    pub field: String,
    pub message: String,
    pub suggestion: Option<String>,
}

/// Severity levels for compatibility issues
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IssueSeverity {
    Error,
    Warning,
    Info,
}

impl ScriptValidator {
    /// Create a new script validator with default schema
    pub fn new() -> Self {
        let schema = ScriptSchema {
            version: "1.0".to_string(),
            required_fields: vec![
                "version".to_string(),
                "metadata".to_string(),
                "actions".to_string(),
            ],
            action_types: vec![
                "mouse_move".to_string(),
                "mouse_click".to_string(),
                "mouse_double_click".to_string(),
                "mouse_drag".to_string(),
                "mouse_scroll".to_string(),
                "key_press".to_string(),
                "key_release".to_string(),
                "key_type".to_string(),
                "screenshot".to_string(),
                "wait".to_string(),
                "custom".to_string(),
            ],
            metadata_fields: vec![
                "created_at".to_string(),
                "duration".to_string(),
                "action_count".to_string(),
                "core_type".to_string(),
                "platform".to_string(),
            ],
        };

        Self {
            schema,
            supported_versions: vec!["1.0".to_string()],
        }
    }

    /// Validate a script file for cross-core compatibility
    pub fn validate_script(&self, script: &ScriptData) -> Result<CompatibilityResult> {
        let mut issues = Vec::new();
        let mut warnings = Vec::new();

        // Validate version
        if !self.supported_versions.contains(&script.version) {
            issues.push(CompatibilityIssue {
                severity: IssueSeverity::Error,
                field: "version".to_string(),
                message: format!("Unsupported script version: {}", script.version),
                suggestion: Some(format!("Supported versions: {:?}", self.supported_versions)),
            });
        }

        // Validate metadata
        self.validate_metadata(&script.metadata, &mut issues, &mut warnings)?;

        // Validate actions
        self.validate_actions(&script.actions, &mut issues, &mut warnings)?;

        // Check action count consistency
        if script.metadata.action_count != script.actions.len() {
            issues.push(CompatibilityIssue {
                severity: IssueSeverity::Warning,
                field: "metadata.action_count".to_string(),
                message: "Action count in metadata doesn't match actual actions".to_string(),
                suggestion: Some("Update metadata.action_count to match actions.len()".to_string()),
            });
        }

        // Check duration consistency
        if let Some(last_action) = script.actions.last() {
            if (script.metadata.duration - last_action.timestamp).abs() > 0.1 {
                warnings.push("Duration in metadata may not match last action timestamp".to_string());
            }
        }

        let is_compatible = issues.iter().all(|issue| {
            matches!(issue.severity, IssueSeverity::Warning | IssueSeverity::Info)
        });

        Ok(CompatibilityResult {
            is_compatible,
            version: script.version.clone(),
            core_type: script.metadata.core_type.clone(),
            issues,
            warnings,
        })
    }

    /// Validate script metadata
    fn validate_metadata(
        &self,
        metadata: &ScriptMetadata,
        issues: &mut Vec<CompatibilityIssue>,
        warnings: &mut Vec<String>,
    ) -> Result<()> {
        // Check required metadata fields
        if metadata.core_type.is_empty() {
            issues.push(CompatibilityIssue {
                severity: IssueSeverity::Error,
                field: "metadata.core_type".to_string(),
                message: "Core type cannot be empty".to_string(),
                suggestion: Some("Set core_type to 'python' or 'rust'".to_string()),
            });
        }

        if metadata.platform.is_empty() {
            issues.push(CompatibilityIssue {
                severity: IssueSeverity::Error,
                field: "metadata.platform".to_string(),
                message: "Platform cannot be empty".to_string(),
                suggestion: Some("Set platform to 'windows', 'macos', or 'linux'".to_string()),
            });
        }

        // Validate core type
        if !["python", "rust"].contains(&metadata.core_type.as_str()) {
            warnings.push(format!("Unknown core type: {}", metadata.core_type));
        }

        // Validate platform
        if !["windows", "macos", "linux", "darwin"].contains(&metadata.platform.as_str()) {
            warnings.push(format!("Unknown platform: {}", metadata.platform));
        }

        // Validate duration
        if metadata.duration < 0.0 {
            issues.push(CompatibilityIssue {
                severity: IssueSeverity::Error,
                field: "metadata.duration".to_string(),
                message: "Duration cannot be negative".to_string(),
                suggestion: Some("Set duration to a non-negative value".to_string()),
            });
        }

        Ok(())
    }

    /// Validate script actions
    fn validate_actions(
        &self,
        actions: &[Action],
        issues: &mut Vec<CompatibilityIssue>,
        warnings: &mut Vec<String>,
    ) -> Result<()> {
        let mut last_timestamp = 0.0;

        for (index, action) in actions.iter().enumerate() {
            // Validate timestamp ordering
            if action.timestamp < last_timestamp {
                issues.push(CompatibilityIssue {
                    severity: IssueSeverity::Error,
                    field: format!("actions[{}].timestamp", index),
                    message: "Action timestamps must be in chronological order".to_string(),
                    suggestion: Some("Sort actions by timestamp".to_string()),
                });
            }
            last_timestamp = action.timestamp;

            // Validate action type
            let action_type_str = match action.action_type {
                ActionType::MouseMove => "mouse_move",
                ActionType::MouseClick => "mouse_click",
                ActionType::MouseDoubleClick => "mouse_double_click",
                ActionType::MouseDrag => "mouse_drag",
                ActionType::MouseScroll => "mouse_scroll",
                ActionType::KeyPress => "key_press",
                ActionType::KeyRelease => "key_release",
                ActionType::KeyType => "key_type",
                ActionType::Screenshot => "screenshot",
                ActionType::Wait => "wait",
                ActionType::Custom => "custom",
                ActionType::AiVisionCapture => "ai_vision_capture",
            };

            if !self.schema.action_types.contains(&action_type_str.to_string()) {
                warnings.push(format!("Unknown action type: {}", action_type_str));
            }

            // Validate action-specific fields
            self.validate_action_fields(action, index, issues)?;
        }

        Ok(())
    }

    /// Validate action-specific required fields
    fn validate_action_fields(
        &self,
        action: &Action,
        index: usize,
        issues: &mut Vec<CompatibilityIssue>,
    ) -> Result<()> {
        match action.action_type {
            ActionType::MouseMove | ActionType::MouseClick | ActionType::MouseDoubleClick | ActionType::MouseDrag => {
                if action.x.is_none() || action.y.is_none() {
                    issues.push(CompatibilityIssue {
                        severity: IssueSeverity::Error,
                        field: format!("actions[{}]", index),
                        message: "Mouse actions require x and y coordinates".to_string(),
                        suggestion: Some("Add x and y fields to the action".to_string()),
                    });
                }
                
                // Check for button field on click actions
                if matches!(action.action_type, ActionType::MouseClick | ActionType::MouseDoubleClick) {
                    if action.button.is_none() {
                        issues.push(CompatibilityIssue {
                            severity: IssueSeverity::Error,
                            field: format!("actions[{}].button", index),
                            message: "Click actions require a button field".to_string(),
                            suggestion: Some("Add button field ('left', 'right', or 'middle')".to_string()),
                        });
                    }
                }
            }
            ActionType::KeyPress | ActionType::KeyRelease => {
                if action.key.is_none() {
                    issues.push(CompatibilityIssue {
                        severity: IssueSeverity::Error,
                        field: format!("actions[{}].key", index),
                        message: "Keyboard actions require a key field".to_string(),
                        suggestion: Some("Add key field with the key identifier".to_string()),
                    });
                }
            }
            ActionType::KeyType => {
                if action.text.is_none() {
                    issues.push(CompatibilityIssue {
                        severity: IssueSeverity::Error,
                        field: format!("actions[{}].text", index),
                        message: "Key type actions require a text field".to_string(),
                        suggestion: Some("Add text field with the text to type".to_string()),
                    });
                }
            }
            _ => {} // Other action types don't have specific requirements
        }

        Ok(())
    }

    /// Validate a JSON value against the script schema
    pub fn validate_json(&self, json_value: &Value) -> Result<CompatibilityResult> {
        // Parse JSON into ScriptData
        let script: ScriptData = serde_json::from_value(json_value.clone())
            .map_err(|e| AutomationError::ScriptError {
                message: format!("Failed to parse script JSON: {}", e),
            })?;

        self.validate_script(&script)
    }

    /// Check if a script is compatible with a specific core type
    pub fn is_compatible_with_core(&self, script: &ScriptData, _core_type: &str) -> Result<bool> {
        let result = self.validate_script(script)?;
        
        // Check for core-specific compatibility issues
        let has_core_issues = result.issues.iter().any(|issue| {
            issue.field.contains("core_type") && matches!(issue.severity, IssueSeverity::Error)
        });

        Ok(result.is_compatible && !has_core_issues)
    }
}

impl ScriptMigrator {
    /// Create a new script migrator
    pub fn new() -> Self {
        let mut migrator = Self {
            migrations: HashMap::new(),
        };

        // Add migration functions for different versions
        migrator.add_migration("0.9", "1.0", Box::new(Self::migrate_0_9_to_1_0));
        
        migrator
    }

    /// Add a migration function for a specific version upgrade
    pub fn add_migration(
        &mut self,
        from_version: &str,
        to_version: &str,
        migration_fn: Box<dyn Fn(&mut Value) -> Result<()>>,
    ) {
        let key = format!("{}:{}", from_version, to_version);
        self.migrations.insert(key, migration_fn);
    }

    /// Migrate a script to the latest supported version
    pub fn migrate_to_latest(&self, script_json: &mut Value) -> Result<String> {
        let current_version = script_json
            .get("version")
            .and_then(|v| v.as_str())
            .unwrap_or("0.9");

        let target_version = "1.0";

        if current_version == target_version {
            return Ok(target_version.to_string());
        }

        // Apply migrations in sequence
        let migration_key = format!("{}:{}", current_version, target_version);
        if let Some(migration_fn) = self.migrations.get(&migration_key) {
            migration_fn(script_json)?;
            
            // Update version in the JSON
            if let Some(obj) = script_json.as_object_mut() {
                obj.insert("version".to_string(), Value::String(target_version.to_string()));
            }
        }

        Ok(target_version.to_string())
    }

    /// Migration from version 0.9 to 1.0
    fn migrate_0_9_to_1_0(script_json: &mut Value) -> Result<()> {
        if let Some(obj) = script_json.as_object_mut() {
            // Get action count first
            let action_count = obj.get("actions")
                .and_then(|a| a.as_array())
                .map(|a| a.len())
                .unwrap_or(0);
            
            // Add missing metadata fields if they don't exist
            if let Some(metadata) = obj.get_mut("metadata").and_then(|m| m.as_object_mut()) {
                // Add core_type if missing
                if !metadata.contains_key("core_type") {
                    metadata.insert("core_type".to_string(), Value::String("python".to_string()));
                }

                // Add platform if missing
                if !metadata.contains_key("platform") {
                    metadata.insert("platform".to_string(), Value::String("unknown".to_string()));
                }

                // Update action count
                metadata.insert("action_count".to_string(), Value::Number(action_count.into()));
            }

            // Normalize action types to snake_case
            if let Some(actions) = obj.get_mut("actions").and_then(|a| a.as_array_mut()) {
                for action in actions {
                    if let Some(action_obj) = action.as_object_mut() {
                        if let Some(action_type) = action_obj.get_mut("type") {
                            if let Some(type_str) = action_type.as_str() {
                                let normalized = Self::normalize_action_type(type_str);
                                *action_type = Value::String(normalized);
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Normalize action type to snake_case format
    fn normalize_action_type(action_type: &str) -> String {
        match action_type.to_lowercase().as_str() {
            "mousemove" | "mouse_move" => "mouse_move".to_string(),
            "mouseclick" | "mouse_click" => "mouse_click".to_string(),
            "mousedoubleclick" | "mouse_double_click" => "mouse_double_click".to_string(),
            "mousedrag" | "mouse_drag" => "mouse_drag".to_string(),
            "mousescroll" | "mouse_scroll" => "mouse_scroll".to_string(),
            "keypress" | "key_press" => "key_press".to_string(),
            "keyrelease" | "key_release" => "key_release".to_string(),
            "keytype" | "key_type" => "key_type".to_string(),
            _ => action_type.to_string(),
        }
    }
}

/// Utility functions for cross-core compatibility testing
pub struct CompatibilityTester;

impl CompatibilityTester {
    /// Test if a script created by one core can be read by another
    pub fn test_cross_core_compatibility(
        script_json: &str,
        source_core: &str,
        target_core: &str,
    ) -> Result<CompatibilityResult> {
        let validator = ScriptValidator::new();
        
        // Parse the JSON
        let json_value: Value = serde_json::from_str(script_json)
            .map_err(|e| AutomationError::ScriptError {
                message: format!("Failed to parse JSON: {}", e),
            })?;

        // Validate the script
        let mut result = validator.validate_json(&json_value)?;

        // Add cross-core specific checks
        if source_core != target_core {
            // Check for core-specific features that might not be compatible
            if let Some(metadata) = json_value.get("metadata") {
                if let Some(core_type) = metadata.get("core_type").and_then(|v| v.as_str()) {
                    if core_type != target_core {
                        result.warnings.push(format!(
                            "Script was created with {} core but will be played with {} core",
                            core_type, target_core
                        ));
                    }
                }
            }
        }

        Ok(result)
    }

    /// Generate a compatibility report for a script
    pub fn generate_compatibility_report(script: &ScriptData) -> Result<String> {
        let validator = ScriptValidator::new();
        let result = validator.validate_script(script)?;

        let mut report = String::new();
        report.push_str(&format!("Script Compatibility Report\n"));
        report.push_str(&format!("==========================\n\n"));
        report.push_str(&format!("Version: {}\n", result.version));
        report.push_str(&format!("Core Type: {}\n", result.core_type));
        report.push_str(&format!("Compatible: {}\n\n", result.is_compatible));

        if !result.issues.is_empty() {
            report.push_str("Issues:\n");
            for issue in &result.issues {
                report.push_str(&format!(
                    "  [{:?}] {}: {}\n",
                    issue.severity, issue.field, issue.message
                ));
                if let Some(suggestion) = &issue.suggestion {
                    report.push_str(&format!("    Suggestion: {}\n", suggestion));
                }
            }
            report.push('\n');
        }

        if !result.warnings.is_empty() {
            report.push_str("Warnings:\n");
            for warning in &result.warnings {
                report.push_str(&format!("  - {}\n", warning));
            }
        }

        Ok(report)
    }
}

impl Default for ScriptValidator {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for ScriptMigrator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::script::Action;

    #[test]
    fn test_script_validation() {
        let mut script = ScriptData::new("rust", "linux");
        script.add_action(Action::mouse_move(100, 200, 0.5));
        script.add_action(Action::mouse_click(100, 200, "left", 1.0));

        let validator = ScriptValidator::new();
        let result = validator.validate_script(&script).unwrap();

        assert!(result.is_compatible);
        assert!(result.issues.is_empty());
    }

    #[test]
    fn test_invalid_script_validation() {
        let mut script = ScriptData::new("", ""); // Invalid core_type and platform
        
        let validator = ScriptValidator::new();
        let result = validator.validate_script(&script).unwrap();

        assert!(!result.is_compatible);
        assert!(!result.issues.is_empty());
    }

    #[test]
    fn test_cross_core_compatibility() {
        let script_json = r#"{
            "version": "1.0",
            "metadata": {
                "created_at": "2024-01-01T12:00:00Z",
                "duration": 1.0,
                "action_count": 1,
                "core_type": "python",
                "platform": "linux",
                "screen_resolution": null,
                "additional_data": {}
            },
            "actions": [
                {
                    "type": "mouse_click",
                    "timestamp": 0.5,
                    "x": 100,
                    "y": 200,
                    "button": "left",
                    "key": null,
                    "text": null,
                    "modifiers": null,
                    "additional_data": null
                }
            ]
        }"#;

        let result = CompatibilityTester::test_cross_core_compatibility(
            script_json, "python", "rust"
        ).unwrap();

        assert!(result.is_compatible);
        assert!(!result.warnings.is_empty()); // Should warn about core type mismatch
    }
}
