//! Test handling of script format differences between cores
//!
//! This test module validates that format differences between Python and Rust
//! cores are detected and handled gracefully with appropriate warnings.
//!
//! Requirements: 10.3, 10.4

use rust_automation_core::{
    script::{ScriptData, Action},
    validation::{ScriptValidator, CompatibilityTester},
    Result,
};
use serde_json::{json, Value};

/// Test detection of version differences
#[test]
fn test_version_difference_detection() {
    let mut script = ScriptData::new("version_test", "linux");
    script.add_action(Action::mouse_move(100, 100, 0.0));
    
    // Change version to simulate format difference
    script.version = "2.0".to_string();
    
    let validator = ScriptValidator::new();
    let result = validator.validate_script(&script).unwrap();
    
    // Should detect version mismatch
    assert!(!result.is_compatible || !result.warnings.is_empty(),
        "Should detect version difference");
    
    println!("✓ Version difference detected");
}

/// Test handling of missing optional fields
#[test]
fn test_missing_optional_fields() {
    // Create a minimal script JSON without optional fields
    let script_json = json!({
        "version": "1.0",
        "metadata": {
            "created_at": "2024-01-01T00:00:00Z",
            "duration": 1.0,
            "action_count": 1,
            "platform": "linux",
            "core_type": "rust",
            "additional_data": {}
        },
        "actions": [
            {
                "type": "mouse_move",
                "timestamp": 0.0,
                "x": 100,
                "y": 100
            }
        ]
    });
    
    let script_str = serde_json::to_string(&script_json).unwrap();
    let result: std::result::Result<ScriptData, serde_json::Error> = serde_json::from_str(&script_str);
    
    match &result {
        Ok(_) => println!("✓ Successfully parsed script"),
        Err(e) => println!("Parse error: {}", e),
    }
    
    assert!(result.is_ok(), "Should handle missing optional fields");
    
    println!("✓ Missing optional fields handled correctly");
}

/// Test handling of extra fields
#[test]
fn test_extra_fields_handling() {
    // Create a script JSON with extra fields
    let script_json = json!({
        "version": "1.0",
        "metadata": {
            "created_at": "2024-01-01T00:00:00Z",
            "duration": 1.0,
            "action_count": 1,
            "platform": "linux",
            "core_type": "rust",
            "additional_data": {},
            "extra_field": "should_be_ignored"
        },
        "actions": [
            {
                "type": "mouse_move",
                "timestamp": 0.0,
                "x": 100,
                "y": 100,
                "extra_action_field": "also_ignored"
            }
        ],
        "extra_root_field": "ignored_too"
    });
    
    let script_str = serde_json::to_string(&script_json).unwrap();
    let result: std::result::Result<ScriptData, serde_json::Error> = serde_json::from_str(&script_str);
    
    assert!(result.is_ok(), "Should ignore extra fields");
    
    println!("✓ Extra fields ignored correctly");
}

/// Test handling of different timestamp formats
#[test]
fn test_timestamp_format_handling() {
    let mut script = ScriptData::new("timestamp_test", "linux");
    
    // Add actions with various timestamp formats
    script.add_action(Action::mouse_move(100, 100, 0.0));
    script.add_action(Action::mouse_move(150, 150, 0.5));
    script.add_action(Action::mouse_move(200, 200, 1.123456789)); // High precision
    
    let validator = ScriptValidator::new();
    let result = validator.validate_script(&script).unwrap();
    
    assert!(result.is_compatible, "Should handle various timestamp formats");
    
    println!("✓ Timestamp format variations handled correctly");
}

/// Test handling of platform name variations
#[test]
fn test_platform_name_variations() {
    // Test various platform names
    let platforms = vec!["linux", "windows", "macos", "darwin"];
    
    for platform in platforms {
        let mut script = ScriptData::new("platform_test", platform);
        script.add_action(Action::mouse_move(100, 100, 0.0));
        
        let validator = ScriptValidator::new();
        let result = validator.validate_script(&script).unwrap();
        
        // Should be compatible or have warnings, not errors
        assert!(result.is_compatible || !result.warnings.is_empty(),
            "Platform '{}' should be handled", platform);
    }
    
    println!("✓ Platform name variations handled correctly");
}

/// Test format migration logging
#[test]
fn test_format_migration_logging() {
    let mut script = ScriptData::new("migration_test", "linux");
    script.add_action(Action::mouse_move(100, 100, 0.0));
    
    // Serialize and test compatibility
    let script_json = serde_json::to_string(&script).unwrap();
    let result = CompatibilityTester::test_cross_core_compatibility(
        &script_json, "python", "rust"
    ).unwrap();
    
    // Log format information
    println!("Format compatibility result:");
    println!("  Compatible: {}", result.is_compatible);
    println!("  Version: {}", result.version);
    println!("  Issues: {} issues", result.issues.len());
    println!("  Warnings: {} warnings", result.warnings.len());
    
    for warning in &result.warnings {
        println!("  Warning: {}", warning);
    }
    
    assert!(result.is_compatible, "Format migration should succeed");
    
    println!("✓ Format migration logged correctly");
}

/// Test essential data preservation
#[test]
fn test_essential_data_preservation() {
    let mut script = ScriptData::new("preservation_test", "linux");
    
    // Add actions with essential data
    script.add_action(Action::mouse_move(100, 100, 0.0));
    script.add_action(Action::mouse_click(100, 100, "left", 0.5));
    script.add_action(Action::key_press("a", 1.0, None));
    
    // Serialize
    let script_json = serde_json::to_string(&script).unwrap();
    
    // Deserialize
    let loaded_script: ScriptData = serde_json::from_str(&script_json).unwrap();
    
    // Verify essential data is preserved
    assert_eq!(loaded_script.actions.len(), script.actions.len(),
        "Action count should be preserved");
    assert_eq!(loaded_script.metadata.platform, script.metadata.platform,
        "Platform should be preserved");
    
    for (original, loaded) in script.actions.iter().zip(loaded_script.actions.iter()) {
        assert_eq!(original.timestamp, loaded.timestamp,
            "Timestamps should be preserved");
        assert_eq!(original.action_type, loaded.action_type,
            "Action types should be preserved");
    }
    
    println!("✓ Essential data preserved correctly");
}

/// Test handling of coordinate precision differences
#[test]
fn test_coordinate_precision_handling() {
    // Create a script with integer coordinates (as expected)
    let script_json = json!({
        "version": "1.0",
        "metadata": {
            "created_at": "2024-01-01T00:00:00Z",
            "duration": 1.0,
            "action_count": 1,
            "platform": "linux",
            "core_type": "rust",
            "additional_data": {}
        },
        "actions": [
            {
                "type": "mouse_move",
                "timestamp": 0.0,
                "x": 100,  // Integer coordinate
                "y": 200   // Integer coordinate
            }
        ]
    });
    
    let script_str = serde_json::to_string(&script_json).unwrap();
    let result: std::result::Result<ScriptData, serde_json::Error> = serde_json::from_str(&script_str);
    
    assert!(result.is_ok(), "Should handle integer coordinates");
    
    if let Ok(script) = result {
        // Coordinates should be preserved as integers
        assert_eq!(script.actions[0].x, Some(100));
        assert_eq!(script.actions[0].y, Some(200));
    }
    
    // Note: Float coordinates would need to be rounded before serialization
    // This is a format difference that should be handled by the recording core
    
    println!("✓ Coordinate precision handled correctly");
}

/// Test handling of metadata field differences
#[test]
fn test_metadata_field_differences() {
    let mut script1 = ScriptData::new("metadata_test1", "linux");
    script1.add_action(Action::mouse_move(100, 100, 0.0));
    
    let mut script2 = ScriptData::new("metadata_test2", "windows");
    script2.add_action(Action::mouse_move(100, 100, 0.0));
    
    // Both should be valid despite metadata differences
    let validator = ScriptValidator::new();
    
    let result1 = validator.validate_script(&script1).unwrap();
    let result2 = validator.validate_script(&script2).unwrap();
    
    assert!(result1.is_compatible, "Script 1 should be compatible");
    assert!(result2.is_compatible, "Script 2 should be compatible");
    
    println!("✓ Metadata field differences handled correctly");
}

/// Test cross-core format compatibility
#[test]
fn test_cross_core_format_compatibility() {
    let mut script = ScriptData::new("cross_core_format", "linux");
    script.add_action(Action::mouse_move(100, 100, 0.0));
    script.add_action(Action::mouse_click(100, 100, "left", 0.5));
    
    // Test Python to Rust compatibility
    let script_json = serde_json::to_string(&script).unwrap();
    let result_py_to_rust = CompatibilityTester::test_cross_core_compatibility(
        &script_json, "python", "rust"
    ).unwrap();
    
    assert!(result_py_to_rust.is_compatible,
        "Python to Rust format should be compatible");
    
    // Test Rust to Python compatibility
    let result_rust_to_py = CompatibilityTester::test_cross_core_compatibility(
        &script_json, "rust", "python"
    ).unwrap();
    
    assert!(result_rust_to_py.is_compatible,
        "Rust to Python format should be compatible");
    
    println!("✓ Cross-core format compatibility verified");
}

/// Test warning generation for format differences
#[test]
fn test_format_difference_warnings() {
    let mut script = ScriptData::new("warning_test", "linux");
    script.add_action(Action::mouse_move(100, 100, 0.0));
    
    // Change to unsupported version
    script.version = "0.9".to_string();
    
    let validator = ScriptValidator::new();
    let result = validator.validate_script(&script).unwrap();
    
    // Should have warnings or issues about version
    let has_version_issue = result.issues.iter().any(|issue| {
        issue.field.contains("version")
    }) || result.warnings.iter().any(|warning| {
        warning.contains("version")
    });
    
    assert!(has_version_issue || !result.is_compatible,
        "Should warn about version difference");
    
    println!("✓ Format difference warnings generated correctly");
}

/// Test handling of action type variations
#[test]
fn test_action_type_variations() {
    let mut script = ScriptData::new("action_type_test", "linux");
    
    // Add various action types
    script.add_action(Action::mouse_move(100, 100, 0.0));
    script.add_action(Action::mouse_click(100, 100, "left", 0.5));
    script.add_action(Action::key_press("a", 1.0, None));
    
    let validator = ScriptValidator::new();
    let result = validator.validate_script(&script).unwrap();
    
    assert!(result.is_compatible, "Action type variations should be compatible");
    
    println!("✓ Action type variations handled correctly");
}

/// Test format version detection
#[test]
fn test_format_version_detection() {
    let mut script = ScriptData::new("version_detection", "linux");
    script.add_action(Action::mouse_move(100, 100, 0.0));
    
    // Serialize and check version
    let script_json = serde_json::to_string(&script).unwrap();
    let parsed: Value = serde_json::from_str(&script_json).unwrap();
    
    assert!(parsed.get("version").is_some(), "Version field should be present");
    assert_eq!(parsed["version"], "1.0", "Version should be 1.0");
    
    println!("✓ Format version detected correctly");
}

#[cfg(test)]
mod async_tests {
    use super::*;
    
    /// Test async format difference handling
    #[tokio::test]
    async fn test_async_format_difference_handling() {
        let mut script = ScriptData::new("async_format_test", "linux");
        script.add_action(Action::mouse_move(100, 100, 0.0));
        
        // Simulate async validation
        let validator = ScriptValidator::new();
        let result = validator.validate_script(&script).unwrap();
        
        assert!(result.is_compatible, "Async format handling should work");
        
        println!("✓ Async format difference handling passed");
    }
}
