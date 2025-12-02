//! Tests for script format validation and cross-core compatibility

#[cfg(test)]
mod tests {
    use crate::validation::*;
    use crate::script::{ScriptData, Action, ActionType};
    use serde_json::json;

    #[test]
    fn test_valid_script_validation() {
        let mut script = ScriptData::new("rust", "linux");
        script.add_action(Action::mouse_move(100, 200, 0.5));
        script.add_action(Action::mouse_click(100, 200, "left", 1.0));

        let validator = ScriptValidator::new();
        let result = validator.validate_script(&script).unwrap();

        assert!(result.is_compatible);
        assert!(result.issues.is_empty());
        assert_eq!(result.version, "1.0");
        assert_eq!(result.core_type, "rust");
    }

    #[test]
    fn test_invalid_script_validation() {
        let script = ScriptData::new("", ""); // Invalid core_type and platform
        
        let validator = ScriptValidator::new();
        let result = validator.validate_script(&script).unwrap();

        assert!(!result.is_compatible);
        assert!(!result.issues.is_empty());

        // Check for specific issues
        let issue_fields: Vec<&str> = result.issues.iter().map(|i| i.field.as_str()).collect();
        assert!(issue_fields.contains(&"metadata.core_type"));
        assert!(issue_fields.contains(&"metadata.platform"));
    }

    #[test]
    fn test_cross_core_compatibility_different_cores() {
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
        assert!(result.warnings.iter().any(|w| w.contains("python core") && w.contains("rust core")));
    }
}
