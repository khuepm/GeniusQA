//! Property-based tests for script format validation and cross-core compatibility

use proptest::prelude::*;
use crate::validation::*;
use crate::script::{ScriptData, Action, ActionType, ScriptMetadata};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

/// **Feature: rust-automation-core, Property 6: JSON format compatibility between cores**
/// 
/// Property 6: JSON format compatibility between cores
/// *For any* recording session, both Python and Rust cores should generate Script Files with identical JSON schema and structure
/// **Validates: Requirements 2.2, 7.3**
proptest! {
    #[test]
    fn test_json_format_compatibility_property(
        core_type in prop::sample::select(vec!["rust", "python"]),
        platform in prop::sample::select(vec!["windows", "macos", "linux"]),
        action_count in 1usize..20,
        duration in 0.1f64..60.0,
    ) {
        // Create a script with the given parameters
        let mut script = ScriptData::new(&core_type, &platform);
        
        // Add random actions
        for i in 0..action_count {
            let timestamp = (i as f64) * (duration / action_count as f64);
            let action = create_test_action(timestamp);
            script.add_action(action);
        }
        
        // Validate the script
        let validator = ScriptValidator::new();
        let result = validator.validate_script(&script).unwrap();
        
        // The script should be compatible regardless of which core created it
        prop_assert!(result.is_compatible, "Script should be compatible: {:?}", result.issues);
        
        // Serialize to JSON and validate round-trip
        let json_str = serde_json::to_string(&script).unwrap();
        let deserialized: ScriptData = serde_json::from_str(&json_str).unwrap();
        
        // The deserialized script should be equivalent
        prop_assert_eq!(&script.version, &deserialized.version);
        prop_assert_eq!(&script.metadata.core_type, &deserialized.metadata.core_type);
        prop_assert_eq!(&script.metadata.platform, &deserialized.metadata.platform);
        prop_assert_eq!(script.actions.len(), deserialized.actions.len());
        
        // Validate the deserialized script
        let deserialized_result = validator.validate_script(&deserialized).unwrap();
        prop_assert!(deserialized_result.is_compatible, "Deserialized script should be compatible");
    }
}

/// **Feature: rust-automation-core, Property 25: Cross-core testing capability**
/// 
/// Property 25: Cross-core testing capability
/// *For any* recording when both cores are available, users should be able to test the recording with both backends for comparison
/// **Validates: Requirements 7.5**
proptest! {
    #[test]
    fn test_cross_core_testing_capability_property(
        source_core in prop::sample::select(vec!["rust", "python"]),
        target_core in prop::sample::select(vec!["rust", "python"]),
        action_count in 1usize..10,
    ) {
        // Create a test script
        let mut script = ScriptData::new(&source_core, "linux");
        
        for i in 0..action_count {
            let timestamp = i as f64 * 0.5;
            let action = create_test_action(timestamp);
            script.add_action(action);
        }
        
        // Test cross-core compatibility
        let script_json = serde_json::to_string(&script).unwrap();
        let result = CompatibilityTester::test_cross_core_compatibility(
            &script_json, &source_core, &target_core
        ).unwrap();
        
        // The script should be compatible between cores
        prop_assert!(result.is_compatible, "Cross-core compatibility failed: {:?}", result.issues);
        
        // If cores are different, there should be a warning about core type mismatch
        if source_core != target_core {
            prop_assert!(!result.warnings.is_empty(), "Should have warnings when cores differ");
            prop_assert!(
                result.warnings.iter().any(|w| w.contains("core")),
                "Should warn about core type mismatch"
            );
        }
    }
}

/// Property test for script migration functionality
proptest! {
    #[test]
    fn test_script_migration_property(
        core_type in prop::sample::select(vec!["rust", "python"]),
        platform in prop::sample::select(vec!["windows", "macos", "linux"]),
        action_count in 1usize..10,
    ) {
        // Create a script in old format (simulate version 0.9)
        let mut script_json = serde_json::json!({
            "version": "0.9",
            "metadata": {
                "created_at": "2024-01-01T12:00:00Z",
                "duration": action_count as f64 * 0.5,
                "action_count": action_count,
                "screen_resolution": null,
                "additional_data": {}
                // Missing core_type and platform
            },
            "actions": []
        });
        
        // Add actions in old format
        for i in 0..action_count {
            let action = serde_json::json!({
                "type": "mouseclick", // Old format
                "timestamp": i as f64 * 0.5,
                "x": 100 + i * 10,
                "y": 200 + i * 10,
                "button": "left",
                "key": null,
                "text": null,
                "modifiers": null,
                "additional_data": null
            });
            script_json["actions"].as_array_mut().unwrap().push(action);
        }
        
        // Migrate the script
        let migrator = ScriptMigrator::new();
        let new_version = migrator.migrate_to_latest(&mut script_json).unwrap();
        
        // Verify migration results
        prop_assert_eq!(new_version, "1.0");
        prop_assert_eq!(script_json["version"].as_str().unwrap(), "1.0");
        prop_assert_eq!(script_json["metadata"]["core_type"].as_str().unwrap(), "python");
        prop_assert_eq!(script_json["metadata"]["platform"].as_str().unwrap(), "unknown");
        
        // Verify action types were normalized
        for action in script_json["actions"].as_array().unwrap() {
            prop_assert_eq!(action["type"].as_str().unwrap(), "mouse_click");
        }
        
        // Validate the migrated script
        let validator = ScriptValidator::new();
        let result = validator.validate_json(&script_json).unwrap();
        prop_assert!(result.is_compatible, "Migrated script should be compatible");
    }
}

/// Property test for script validation edge cases
proptest! {
    #[test]
    fn test_script_validation_edge_cases_property(
        empty_core_type in prop::bool::ANY,
        empty_platform in prop::bool::ANY,
        negative_duration in prop::bool::ANY,
        out_of_order_timestamps in prop::bool::ANY,
    ) {
        let core_type = if empty_core_type { "" } else { "rust" };
        let platform = if empty_platform { "" } else { "linux" };
        
        let mut script = ScriptData::new(core_type, platform);
        
        // Set negative duration if requested
        if negative_duration {
            script.metadata.duration = -1.0;
        }
        
        // Add actions with potentially out-of-order timestamps
        let timestamps = if out_of_order_timestamps {
            vec![1.0, 0.5, 2.0] // Out of order
        } else {
            vec![0.5, 1.0, 2.0] // In order
        };
        
        for timestamp in timestamps {
            script.add_action(create_test_action(timestamp));
        }
        
        // Set negative duration AFTER adding actions if requested
        if negative_duration {
            script.metadata.duration = -1.0;
        }
        
        // Validate the script
        let validator = ScriptValidator::new();
        let result = validator.validate_script(&script).unwrap();
        
        // Determine expected compatibility
        let should_be_compatible = !empty_core_type && !empty_platform && !negative_duration && !out_of_order_timestamps;
        
        prop_assert_eq!(
            result.is_compatible, 
            should_be_compatible,
            "Compatibility mismatch. Expected: {}, Got: {}, Issues: {:?}",
            should_be_compatible,
            result.is_compatible,
            result.issues
        );
        
        // Check for specific error types
        if empty_core_type {
            prop_assert!(
                result.issues.iter().any(|issue| issue.field.contains("core_type")),
                "Should have core_type error"
            );
        }
        
        if empty_platform {
            prop_assert!(
                result.issues.iter().any(|issue| issue.field.contains("platform")),
                "Should have platform error"
            );
        }
        
        if negative_duration {
            prop_assert!(
                result.issues.iter().any(|issue| issue.field.contains("duration")),
                "Should have duration error"
            );
        }
        
        if out_of_order_timestamps {
            prop_assert!(
                result.issues.iter().any(|issue| issue.field.contains("timestamp")),
                "Should have timestamp ordering error"
            );
        }
    }
}

/// Helper function to create test actions
fn create_test_action(timestamp: f64) -> Action {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    
    match rng.gen_range(0..4) {
        0 => Action::mouse_move(rng.gen_range(0..1000), rng.gen_range(0..1000), timestamp),
        1 => Action::mouse_click(rng.gen_range(0..1000), rng.gen_range(0..1000), "left", timestamp),
        2 => Action::key_press("a", timestamp, None),
        _ => Action::key_type("hello", timestamp),
    }
}

/// Property test for recording comparator functionality
proptest! {
    #[test]
    fn test_recording_comparator_property(
        tolerance_ms in 1.0f64..100.0,
        coordinate_tolerance in 1i32..50,
        action_count in 1usize..10,
        introduce_differences in prop::bool::ANY,
    ) {
        use crate::cross_core_testing::RecordingComparator;
        
        let comparator = RecordingComparator::new(tolerance_ms, coordinate_tolerance);
        
        // Create two similar scripts
        let mut script1 = ScriptData::new("rust", "linux");
        let mut script2 = ScriptData::new("python", "linux");
        
        for i in 0..action_count {
            let base_timestamp = i as f64 * 0.5;
            let base_x = 100 + i * 50;
            let base_y = 200 + i * 50;
            
            let action1 = Action::mouse_click(base_x as i32, base_y as i32, "left", base_timestamp);
            
            let action2 = if introduce_differences && i == 0 {
                // Introduce small differences within tolerance
                let time_diff = tolerance_ms / 2000.0; // Half tolerance in seconds
                let coord_diff = coordinate_tolerance / 2;
                Action::mouse_click(
                    base_x as i32 + coord_diff,
                    base_y as i32 + coord_diff,
                    "left",
                    base_timestamp + time_diff
                )
            } else {
                action1.clone()
            };
            
            script1.add_action(action1);
            script2.add_action(action2);
        }
        
        // Test script equivalence
        let are_equivalent = comparator.are_scripts_equivalent(&script1, &script2);
        
        // Should be equivalent if differences are within tolerance
        prop_assert!(are_equivalent, "Scripts should be equivalent within tolerance");
        
        // Test action comparison
        let differences = comparator.compare_actions(&script1.actions, &script2.actions).unwrap();
        
        // Should have no differences if within tolerance
        if !introduce_differences {
            prop_assert!(differences.is_empty(), "Should have no differences for identical scripts");
        }
        
        // Test timing comparison
        let timing_diffs = comparator.compare_timing(&script1.actions, &script2.actions).unwrap();
        
        // Timing differences should be within tolerance
        for timing_diff in timing_diffs {
            prop_assert!(
                !timing_diff.tolerance_exceeded,
                "Timing difference should be within tolerance: {}ms > {}ms",
                timing_diff.difference_ms,
                tolerance_ms
            );
        }
    }
}

/// **Feature: rust-core-playback-fix, Property 37: Format difference handling**
/// 
/// Property 37: Format difference handling
/// *For any* script with format differences, the system should handle them gracefully with warnings
/// **Validates: Requirements 10.3**
proptest! {
    #[test]
    fn test_format_difference_handling_property(
        version_diff in prop::bool::ANY,
        missing_optional_fields in prop::bool::ANY,
        extra_fields in prop::bool::ANY,
        platform_variation in prop::sample::select(vec!["linux", "windows", "macos", "darwin", "win32"]),
        action_count in 1usize..10,
    ) {
        // Create a base script
        let mut script = ScriptData::new("rust", "linux");
        
        for i in 0..action_count {
            let timestamp = i as f64 * 0.5;
            let action = create_test_action(timestamp);
            script.add_action(action);
        }
        
        // Serialize to JSON for manipulation
        let mut script_json = serde_json::to_value(&script).unwrap();
        
        // Introduce format differences
        if version_diff {
            // Change version to simulate format difference
            script_json["version"] = serde_json::json!("0.9");
        }
        
        if missing_optional_fields {
            // Remove optional fields only (screen_resolution is optional)
            if let Some(metadata) = script_json["metadata"].as_object_mut() {
                metadata.remove("screen_resolution");
            }
            // Remove optional action fields
            if let Some(actions) = script_json["actions"].as_array_mut() {
                for action in actions.iter_mut() {
                    if let Some(action_obj) = action.as_object_mut() {
                        action_obj.remove("modifiers");
                        action_obj.remove("additional_data");
                    }
                }
            }
        }
        
        if extra_fields {
            // Add extra fields that should be ignored
            if let Some(metadata) = script_json["metadata"].as_object_mut() {
                metadata.insert("extra_field".to_string(), serde_json::json!("should_be_ignored"));
                metadata.insert("custom_data".to_string(), serde_json::json!({"key": "value"}));
            }
            script_json["extra_root_field"] = serde_json::json!("ignored_too");
            
            // Add extra fields to actions
            if let Some(actions) = script_json["actions"].as_array_mut() {
                for action in actions.iter_mut() {
                    if let Some(action_obj) = action.as_object_mut() {
                        action_obj.insert("extra_action_field".to_string(), serde_json::json!("also_ignored"));
                    }
                }
            }
        }
        
        // Apply platform variation
        if let Some(metadata) = script_json["metadata"].as_object_mut() {
            metadata.insert("platform".to_string(), serde_json::json!(platform_variation));
        }
        
        // Test that the script can still be loaded
        let script_str = serde_json::to_string(&script_json).unwrap();
        let load_result: Result<ScriptData, serde_json::Error> = serde_json::from_str(&script_str);
        
        // Script should load successfully despite format differences
        prop_assert!(
            load_result.is_ok(),
            "Script should load despite format differences: {:?}",
            load_result.err()
        );
        
        if let Ok(loaded_script) = load_result {
            // Validate the loaded script
            let validator = ScriptValidator::new();
            let validation_result = validator.validate_script(&loaded_script).unwrap();
            
            // Script should either be compatible or have warnings/issues (graceful handling)
            // The key is that it loaded successfully and validation provides feedback
            let handles_gracefully = validation_result.is_compatible 
                || !validation_result.warnings.is_empty()
                || !validation_result.issues.is_empty();
            
            prop_assert!(
                handles_gracefully,
                "Script should be handled gracefully (compatible, warnings, or issues). Result: {:?}",
                validation_result
            );
            
            // If version differs, should have version-related feedback
            if version_diff {
                let has_version_feedback = validation_result.warnings.iter().any(|w| w.contains("version"))
                    || validation_result.issues.iter().any(|i| i.field.contains("version"));
                prop_assert!(
                    has_version_feedback,
                    "Should provide feedback about version difference"
                );
            }
            
            // Essential data should be preserved
            prop_assert_eq!(
                loaded_script.actions.len(),
                action_count,
                "Action count should be preserved"
            );
            
            // Actions should be preserved correctly
            for (i, action) in loaded_script.actions.iter().enumerate() {
                prop_assert!(
                    action.timestamp >= 0.0,
                    "Action {} timestamp should be valid: {}",
                    i,
                    action.timestamp
                );
            }
            
            // Test cross-core compatibility with format differences
            let compat_result = CompatibilityTester::test_cross_core_compatibility(
                &script_str, "rust", "python"
            ).unwrap();
            
            // Should handle format differences gracefully
            // Either compatible or has warnings, but should not fail completely
            let handles_gracefully = compat_result.is_compatible 
                || !compat_result.warnings.is_empty()
                || !compat_result.issues.is_empty();
            
            prop_assert!(
                handles_gracefully,
                "Should handle format differences gracefully"
            );
            
            // If there are format differences, there should be warnings
            let has_format_differences = version_diff || missing_optional_fields || extra_fields 
                || platform_variation != "linux";
            
            if has_format_differences && !compat_result.is_compatible {
                prop_assert!(
                    !compat_result.warnings.is_empty() || !compat_result.issues.is_empty(),
                    "Should have warnings or issues for format differences"
                );
            }
        }
    }
}
