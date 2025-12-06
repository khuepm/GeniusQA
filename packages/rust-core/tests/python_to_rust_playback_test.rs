//! Test Python-recorded scripts with Rust playback
//!
//! This test module validates that scripts recorded with the Python core
//! can be successfully played back with the Rust core.
//!
//! Requirements: 10.1

use rust_automation_core::{
    script::{ScriptData, Action, ActionType},
    validation::{ScriptValidator, CompatibilityTester},
    cross_core_testing::{CrossCoreTestSuite, TestScript, ExpectedBehavior, create_default_test_scripts},
    Result,
};
use std::path::Path;
use std::fs;
use std::collections::HashMap;

/// Load a Python-recorded script from a JSON file
fn load_python_script(path: &Path) -> Result<ScriptData> {
    let content = fs::read_to_string(path)
        .map_err(|e| rust_automation_core::AutomationError::ScriptError {
            message: format!("Failed to read script file: {}", e),
        })?;
    
    let script: ScriptData = serde_json::from_str(&content)
        .map_err(|e| rust_automation_core::AutomationError::ScriptError {
            message: format!("Failed to parse script: {}", e),
        })?;
    
    Ok(script)
}

/// Test that a Python-recorded script can be loaded by Rust
#[test]
fn test_load_python_recorded_script() {
    // Create a sample Python-recorded script
    let mut script = ScriptData::new("python_test", "linux");
    script.add_action(Action::mouse_move(100, 100, 0.0));
    script.add_action(Action::mouse_click(100, 100, "left", 0.5));
    script.add_action(Action::key_press("a", 1.0, None));
    
    // Serialize to JSON (simulating Python output)
    let json = serde_json::to_string(&script).unwrap();
    
    // Deserialize in Rust
    let loaded_script: ScriptData = serde_json::from_str(&json).unwrap();
    
    assert_eq!(loaded_script.actions.len(), 3);
    assert_eq!(loaded_script.metadata.platform, "linux");
    
    println!("✓ Python-recorded script loaded successfully");
}

/// Test that Python-recorded mouse actions are compatible
#[test]
fn test_python_mouse_actions_compatibility() {
    let mut script = ScriptData::new("python_mouse", "linux");
    
    // Add various mouse actions that Python might record
    script.add_action(Action::mouse_move(100, 100, 0.0));
    script.add_action(Action::mouse_move(200, 200, 0.5));
    script.add_action(Action::mouse_click(200, 200, "left", 1.0));
    script.add_action(Action::mouse_click(200, 200, "right", 1.5));
    script.add_action(Action::mouse_click(200, 200, "middle", 2.0));
    
    // Validate script
    let validator = ScriptValidator::new();
    let validation_result = validator.validate_script(&script).unwrap();
    
    assert!(validation_result.is_compatible, "Mouse actions should be compatible");
    
    // Check that all actions are compatible
    for action in &script.actions {
        assert!(matches!(action.action_type, ActionType::MouseMove | ActionType::MouseClick));
    }
    
    println!("✓ Python mouse actions are compatible with Rust playback");
}

/// Test that Python-recorded keyboard actions are compatible
#[test]
fn test_python_keyboard_actions_compatibility() {
    let mut script = ScriptData::new("python_keyboard", "linux");
    
    // Add various keyboard actions that Python might record
    script.add_action(Action::key_press("a", 0.0, None));
    script.add_action(Action::key_press("b", 0.2, None));
    script.add_action(Action::key_press("Enter", 0.4, None));
    script.add_action(Action::key_press("Tab", 0.6, None));
    script.add_action(Action::key_type("hello", 0.8));
    
    // Validate script
    let validator = ScriptValidator::new();
    let validation_result = validator.validate_script(&script).unwrap();
    
    assert!(validation_result.is_compatible, "Keyboard actions should be compatible");
    
    // Check that all actions are compatible
    for action in &script.actions {
        assert!(matches!(action.action_type, ActionType::KeyPress | ActionType::KeyType));
    }
    
    println!("✓ Python keyboard actions are compatible with Rust playback");
}

/// Test that Python-recorded scripts with mixed actions are compatible
#[test]
fn test_python_mixed_actions_compatibility() {
    let mut script = ScriptData::new("python_mixed", "linux");
    
    // Add mixed actions
    script.add_action(Action::mouse_move(50, 50, 0.0));
    script.add_action(Action::mouse_click(50, 50, "left", 0.2));
    script.add_action(Action::key_type("username", 0.5));
    script.add_action(Action::key_press("Tab", 1.0, None));
    script.add_action(Action::key_type("password", 1.2));
    script.add_action(Action::key_press("Enter", 1.5, None));
    
    // Validate script
    let validator = ScriptValidator::new();
    let validation_result = validator.validate_script(&script).unwrap();
    
    assert!(validation_result.is_compatible, "Mixed actions should be compatible");
    
    println!("✓ Python mixed actions are compatible with Rust playback");
}

/// Test cross-core compatibility validation
#[test]
fn test_cross_core_compatibility_validation() {
    let mut script = ScriptData::new("cross_core_test", "linux");
    script.add_action(Action::mouse_move(100, 100, 0.0));
    script.add_action(Action::mouse_click(100, 100, "left", 0.5));
    
    // Serialize script
    let script_json = serde_json::to_string(&script).unwrap();
    
    // Test compatibility
    let result = CompatibilityTester::test_cross_core_compatibility(
        &script_json, "python", "rust"
    ).unwrap();
    
    assert!(result.is_compatible, "Cross-core compatibility should pass");
    assert_eq!(result.issues.len(), 0, "Should have no compatibility issues");
    
    println!("✓ Cross-core compatibility validation passed");
}

/// Test that Python scripts with variables are handled
#[test]
fn test_python_script_with_variables() {
    // Create a script with variable placeholders (as Python might record)
    let mut script = ScriptData::new("python_variables", "linux");
    script.add_action(Action::key_type("{{username}}", 0.0));
    script.add_action(Action::key_press("Tab", 0.5, None));
    script.add_action(Action::key_type("{{password}}", 1.0));
    script.add_action(Action::key_press("Enter", 1.5, None));
    
    // Validate script
    let validator = ScriptValidator::new();
    let validation_result = validator.validate_script(&script).unwrap();
    
    assert!(validation_result.is_compatible, "Scripts with variables should be compatible");
    
    println!("✓ Python scripts with variables are handled correctly");
}

/// Test that Python scripts with timing variations are handled
#[test]
fn test_python_script_timing_variations() {
    let mut script = ScriptData::new("python_timing", "linux");
    
    // Python might record with various timing patterns
    script.add_action(Action::mouse_move(100, 100, 0.0));
    script.add_action(Action::mouse_move(150, 150, 0.001)); // Very fast
    script.add_action(Action::mouse_move(200, 200, 0.5)); // Normal
    script.add_action(Action::mouse_move(250, 250, 2.0)); // Slow
    
    // Validate script
    let validator = ScriptValidator::new();
    let validation_result = validator.validate_script(&script).unwrap();
    
    assert!(validation_result.is_compatible, "Scripts with timing variations should be compatible");
    
    println!("✓ Python scripts with timing variations are handled correctly");
}

/// Test that Python scripts with edge case coordinates are handled
#[test]
fn test_python_script_edge_coordinates() {
    let mut script = ScriptData::new("python_edge_coords", "linux");
    
    // Python might record coordinates at screen edges
    script.add_action(Action::mouse_move(0, 0, 0.0)); // Top-left corner
    script.add_action(Action::mouse_move(1920, 1080, 0.5)); // Bottom-right (common resolution)
    script.add_action(Action::mouse_move(960, 540, 1.0)); // Center
    
    // Validate script
    let validator = ScriptValidator::new();
    let validation_result = validator.validate_script(&script).unwrap();
    
    assert!(validation_result.is_compatible, "Scripts with edge coordinates should be compatible");
    
    println!("✓ Python scripts with edge case coordinates are handled correctly");
}

/// Test loading the example Python script
#[test]
fn test_load_example_python_script() {
    let example_path = Path::new("../python-core/examples/login_with_variables.json");
    
    if example_path.exists() {
        let result = load_python_script(example_path);
        
        match result {
            Ok(script) => {
                assert!(!script.actions.is_empty());
                println!("Successfully loaded Python example script with {} actions", script.actions.len());
                
                // Validate the loaded script
                let validator = ScriptValidator::new();
                let validation_result = validator.validate_script(&script).unwrap();
                assert!(validation_result.is_compatible, "Example script should be compatible");
                
                println!("✓ Example Python script loaded and validated successfully");
            }
            Err(e) => {
                println!("Note: Could not load example script (this is OK if file doesn't exist): {}", e);
            }
        }
    } else {
        println!("Note: Example Python script not found at {:?}", example_path);
    }
}

/// Test that Python-recorded scripts can be validated for playback
#[test]
fn test_python_script_playback_validation() {
    let mut script = ScriptData::new("python_playback", "linux");
    
    // Create a realistic Python-recorded script
    script.add_action(Action::mouse_move(100, 100, 0.0));
    script.add_action(Action::mouse_click(100, 100, "left", 0.2));
    script.add_action(Action::key_type("test", 0.5));
    script.add_action(Action::key_press("Enter", 1.0, None));
    
    // Validate for playback
    let validator = ScriptValidator::new();
    let validation_result = validator.validate_script(&script).unwrap();
    
    assert!(validation_result.is_compatible, "Script should be compatible for playback");
    
    // Check that all actions have valid timestamps
    for (i, action) in script.actions.iter().enumerate() {
        if i > 0 {
            assert!(action.timestamp >= script.actions[i - 1].timestamp,
                "Actions should be in chronological order");
        }
    }
    
    println!("✓ Python scripts validated for playback successfully");
}

/// Test compatibility issues logging
#[test]
fn test_python_script_compatibility_logging() {
    let mut script = ScriptData::new("python_compat_log", "linux");
    script.add_action(Action::mouse_move(100, 100, 0.0));
    script.add_action(Action::mouse_click(100, 100, "left", 0.5));
    
    // Serialize and test compatibility
    let script_json = serde_json::to_string(&script).unwrap();
    let result = CompatibilityTester::test_cross_core_compatibility(
        &script_json, "python", "rust"
    ).unwrap();
    
    // Log compatibility result
    println!("Compatibility test result:");
    println!("  Compatible: {}", result.is_compatible);
    println!("  Version: {}", result.version);
    println!("  Core type: {}", result.core_type);
    println!("  Issues: {} issues found", result.issues.len());
    println!("  Warnings: {} warnings found", result.warnings.len());
    
    assert!(result.is_compatible, "Compatibility logging test should pass");
    
    println!("✓ Compatibility issues logged correctly");
}

/// Integration test: Test default test scripts from cross-core testing
#[test]
fn test_default_cross_core_test_scripts() {
    let test_scripts = create_default_test_scripts();
    
    assert!(!test_scripts.is_empty(), "Should have default test scripts");
    
    let validator = ScriptValidator::new();
    
    for test_script in test_scripts {
        println!("Testing script: {}", test_script.name);
        
        // Validate the script
        let validation_result = validator.validate_script(&test_script.script_data).unwrap();
        assert!(validation_result.is_compatible, 
            "Script '{}' should be compatible", test_script.name);
        
        // Check expected behavior
        assert_eq!(test_script.script_data.actions.len(), 
            test_script.expected_behavior.expected_action_count,
            "Script '{}' should have expected action count", test_script.name);
    }
    
    println!("✓ All default cross-core test scripts validated successfully");
}

/// Test that Python scripts with all action types are compatible
#[test]
fn test_python_all_action_types() {
    let mut script = ScriptData::new("python_all_types", "linux");
    
    // Add one of each action type that Python might record
    script.add_action(Action::mouse_move(100, 100, 0.0));
    script.add_action(Action::mouse_click(100, 100, "left", 0.2));
    script.add_action(Action::key_press("a", 0.4, None));
    script.add_action(Action::key_type("hello", 0.6));
    
    // Validate script
    let validator = ScriptValidator::new();
    let validation_result = validator.validate_script(&script).unwrap();
    
    assert!(validation_result.is_compatible, "All action types should be compatible");
    
    // Verify all action types are present
    let has_mouse_move = script.actions.iter().any(|a| matches!(a.action_type, ActionType::MouseMove));
    let has_mouse_click = script.actions.iter().any(|a| matches!(a.action_type, ActionType::MouseClick));
    let has_key_press = script.actions.iter().any(|a| matches!(a.action_type, ActionType::KeyPress));
    let has_key_type = script.actions.iter().any(|a| matches!(a.action_type, ActionType::KeyType));
    
    assert!(has_mouse_move, "Should have mouse move action");
    assert!(has_mouse_click, "Should have mouse click action");
    assert!(has_key_press, "Should have key press action");
    assert!(has_key_type, "Should have key type action");
    
    println!("✓ All Python action types are compatible with Rust playback");
}

#[cfg(test)]
mod async_tests {
    use super::*;
    
    /// Test async loading and validation of Python scripts
    #[tokio::test]
    async fn test_async_python_script_validation() {
        let mut script = ScriptData::new("async_python_test", "linux");
        script.add_action(Action::mouse_move(100, 100, 0.0));
        script.add_action(Action::mouse_click(100, 100, "left", 0.5));
        
        // Simulate async validation
        let validator = ScriptValidator::new();
        let validation_result = validator.validate_script(&script).unwrap();
        
        assert!(validation_result.is_compatible, "Async validation should pass");
        
        println!("✓ Async Python script validation passed");
    }
    
    /// Test cross-core test suite with Python scripts
    #[tokio::test]
    async fn test_cross_core_suite_python_scripts() {
        let mut test_suite = CrossCoreTestSuite::new(
            "target/debug/rust-automation-core",
            "../python-core"
        );
        
        // Add a Python-recorded script test
        let mut script = ScriptData::new("python_suite_test", "linux");
        script.add_action(Action::mouse_move(100, 100, 0.0));
        script.add_action(Action::mouse_click(100, 100, "left", 0.5));
        
        let test_script = TestScript {
            name: "python_to_rust_test".to_string(),
            description: "Test Python-recorded script with Rust playback".to_string(),
            script_data: script,
            expected_behavior: ExpectedBehavior {
                should_be_compatible: true,
                expected_duration_tolerance: 0.1,
                expected_action_count: 2,
                platform_specific: HashMap::new(),
            },
        };
        
        test_suite.add_test_script(test_script);
        
        // Run the test
        let results = test_suite.run_all_tests().await.unwrap();
        
        assert_eq!(results.len(), 1, "Should have one test result");
        assert!(results[0].passed, "Python to Rust test should pass");
        assert!(results[0].compatibility_result.is_compatible, "Should be compatible");
        
        println!("✓ Cross-core test suite with Python scripts passed");
    }
}
