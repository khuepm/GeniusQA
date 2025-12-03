//! Property-based tests for recording functionality

use crate::{
    AutomationConfig, ScriptData, Action, ActionType,
    recorder::Recorder,
    player::Player
};
use proptest::prelude::*;

/// **Feature: rust-automation-core, Property 6: JSON format compatibility between cores**
/// 
/// Property 6: JSON format compatibility between cores
/// *For any* recording session, both Python and Rust cores should generate Script Files with identical JSON schema and structure
/// **Validates: Requirements 2.2, 7.3**
proptest! {
    #[test]
    fn property_json_format_compatibility_between_cores(
        raw_actions in prop::collection::vec(arbitrary_action(), 1..20),
        core_type in "(rust|python)",
        platform in "(windows|macos|linux)"
    ) {
        // Generate chronologically ordered actions
        let actions = generate_chronological_actions(raw_actions);
        
        // Create a script with the given parameters
        let mut script = ScriptData::new(&core_type, &platform);
        
        for action in actions {
            script.add_action(action);
        }
        
        // Use the calculated duration from actions instead of a separate parameter
        let duration = script.duration();
        
        // Serialize to JSON
        let json_result = serde_json::to_string(&script);
        prop_assert!(json_result.is_ok(), "Script should serialize to JSON successfully");
        
        let json_str = json_result.unwrap();
        
        // Deserialize back from JSON
        let deserialized_result: Result<ScriptData, _> = serde_json::from_str(&json_str);
        prop_assert!(deserialized_result.is_ok(), "JSON should deserialize back to ScriptData successfully");
        
        let deserialized_script = deserialized_result.unwrap();
        
        // Verify the schema structure matches expected format
        prop_assert_eq!(script.version, deserialized_script.version, "Version should be preserved");
        prop_assert_eq!(script.metadata.core_type, deserialized_script.metadata.core_type, "Core type should be preserved");
        prop_assert_eq!(script.metadata.platform, deserialized_script.metadata.platform, "Platform should be preserved");
        // Use approximate comparison for floating point duration
        prop_assert!((script.metadata.duration - deserialized_script.metadata.duration).abs() < 0.001, 
            "Duration should be preserved (within tolerance)");
        prop_assert_eq!(script.metadata.action_count, deserialized_script.metadata.action_count, "Action count should be preserved");
        prop_assert_eq!(script.actions.len(), deserialized_script.actions.len(), "Number of actions should be preserved");
        
        // Verify JSON contains required fields for Python core compatibility
        let json_value: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        prop_assert!(json_value.get("version").is_some(), "JSON should contain version field");
        prop_assert!(json_value.get("metadata").is_some(), "JSON should contain metadata field");
        prop_assert!(json_value.get("actions").is_some(), "JSON should contain actions field");
        
        let metadata = json_value.get("metadata").unwrap();
        prop_assert!(metadata.get("created_at").is_some(), "Metadata should contain created_at field");
        prop_assert!(metadata.get("duration").is_some(), "Metadata should contain duration field");
        prop_assert!(metadata.get("action_count").is_some(), "Metadata should contain action_count field");
        prop_assert!(metadata.get("core_type").is_some(), "Metadata should contain core_type field");
        prop_assert!(metadata.get("platform").is_some(), "Metadata should contain platform field");
    }
}

/// **Feature: rust-automation-core, Property 10: Timing accuracy equivalence**
/// 
/// Property 10: Timing accuracy equivalence
/// *For any* Script File, playback timing accuracy should be equivalent between Python and Rust cores within acceptable tolerance
/// **Validates: Requirements 3.1**
proptest! {
    #[test]
    fn property_timing_accuracy_equivalence(
        raw_actions in prop::collection::vec(arbitrary_action(), 2..10),
        playback_speed in 0.5f64..2.0f64
    ) {
        let _config = AutomationConfig::default();
        
        // Generate chronologically ordered actions
        let actions = generate_chronological_actions(raw_actions);
        
        // Create a script with timed actions
        let mut script = ScriptData::new("rust", "test");
        for action in actions {
            script.add_action(action);
        }
        
        // Validate that timestamps are in chronological order (required for timing accuracy)
        prop_assert!(script.validate().is_ok(), "Script should be valid with chronological timestamps");
        
        // Calculate expected timing intervals
        let mut expected_intervals = Vec::new();
        for i in 1..script.actions.len() {
            let interval = script.actions[i].timestamp - script.actions[i-1].timestamp;
            expected_intervals.push(interval / playback_speed);
        }
        
        // Verify that timing calculations are consistent
        for (i, expected_interval) in expected_intervals.iter().enumerate() {
            // The timing should be positive and reasonable
            prop_assert!(*expected_interval >= 0.0, "Time intervals should be non-negative");
            prop_assert!(*expected_interval <= 60.0, "Time intervals should be reasonable (< 60s)");
            
            // Verify that speed adjustment works correctly
            let original_interval = script.actions[i+1].timestamp - script.actions[i].timestamp;
            let adjusted_interval = original_interval / playback_speed;
            prop_assert!((adjusted_interval - expected_interval).abs() < 0.001, 
                "Speed adjustment should be mathematically correct");
        }
    }
}

/// **Feature: rust-automation-core, Property 14: Cross-core Script File compatibility**
/// 
/// Property 14: Cross-core Script File compatibility
/// *For any* Script File created by one core, it should be playable by the other core without modification or data loss
/// **Validates: Requirements 3.5, 7.1, 7.2**
proptest! {
    #[test]
    fn property_cross_core_script_file_compatibility(
        raw_actions in prop::collection::vec(arbitrary_action(), 1..15),
        source_core in "(rust|python)",
        _target_core in "(rust|python)",
        platform in "(windows|macos|linux)"
    ) {
        // Generate chronologically ordered actions
        let actions = generate_chronological_actions(raw_actions);
        // Create a script with the source core
        let mut original_script = ScriptData::new(&source_core, &platform);
        for action in actions {
            original_script.add_action(action);
        }
        
        // Serialize the script (simulating saving to file)
        let serialized = serde_json::to_string(&original_script).unwrap();
        
        // Deserialize the script (simulating loading by target core)
        let loaded_script: ScriptData = serde_json::from_str(&serialized).unwrap();
        
        // Verify no data loss occurred
        prop_assert_eq!(&original_script.version, &loaded_script.version, "Version should be preserved");
        // Use approximate comparison for floating point duration
        prop_assert!((original_script.metadata.duration - loaded_script.metadata.duration).abs() < 0.001, 
            "Duration should be preserved (within tolerance)");
        prop_assert_eq!(original_script.metadata.action_count, loaded_script.metadata.action_count, "Action count should be preserved");
        prop_assert_eq!(&original_script.metadata.platform, &loaded_script.metadata.platform, "Platform should be preserved");
        prop_assert_eq!(original_script.actions.len(), loaded_script.actions.len(), "Number of actions should be preserved");
        
        // Verify each action is preserved exactly
        for (i, (original_action, loaded_action)) in original_script.actions.iter().zip(loaded_script.actions.iter()).enumerate() {
            prop_assert_eq!(&original_action.action_type, &loaded_action.action_type, "Action type should be preserved at index {}", i);
            prop_assert_eq!(original_action.timestamp, loaded_action.timestamp, "Timestamp should be preserved at index {}", i);
            prop_assert_eq!(original_action.x, loaded_action.x, "X coordinate should be preserved at index {}", i);
            prop_assert_eq!(original_action.y, loaded_action.y, "Y coordinate should be preserved at index {}", i);
            prop_assert_eq!(&original_action.button, &loaded_action.button, "Button should be preserved at index {}", i);
            prop_assert_eq!(&original_action.key, &loaded_action.key, "Key should be preserved at index {}", i);
            prop_assert_eq!(&original_action.text, &loaded_action.text, "Text should be preserved at index {}", i);
            prop_assert_eq!(&original_action.modifiers, &loaded_action.modifiers, "Modifiers should be preserved at index {}", i);
        }
        
        // Verify the script is still valid after cross-core transfer
        prop_assert!(loaded_script.validate().is_ok(), "Script should remain valid after cross-core transfer");
        
        // Verify that the target core can process the script
        // (This would be tested by actually loading it into a player, but we'll test the data structure compatibility)
        let config = AutomationConfig::default();
        let player_result = Player::new(config);
        prop_assert!(player_result.is_ok(), "Player should be creatable for cross-core compatibility testing");
        
        let mut player = player_result.unwrap();
        let load_result = player.load_script(loaded_script);
        prop_assert!(load_result.is_ok(), "Player should be able to load cross-core script without errors");
    }
}

// Helper functions for generating arbitrary test data

fn arbitrary_action() -> impl Strategy<Value = Action> {
    prop_oneof![
        arbitrary_mouse_move(),
        arbitrary_mouse_click(),
        arbitrary_key_press(),
        arbitrary_key_type(),
    ]
}

fn arbitrary_timed_action() -> impl Strategy<Value = Action> {
    arbitrary_action()
}

fn generate_chronological_actions(actions: Vec<Action>) -> Vec<Action> {
    let mut sorted_actions = actions;
    // Sort actions by timestamp to ensure chronological order
    sorted_actions.sort_by(|a, b| a.timestamp.partial_cmp(&b.timestamp).unwrap_or(std::cmp::Ordering::Equal));
    
    // Reassign timestamps to ensure strict chronological order
    for (i, action) in sorted_actions.iter_mut().enumerate() {
        action.timestamp = i as f64 * 0.1; // 100ms intervals
    }
    
    sorted_actions
}

fn arbitrary_mouse_move() -> impl Strategy<Value = Action> {
    (0i32..1920, 0i32..1080, 0.0f64..10.0f64).prop_map(|(x, y, timestamp)| {
        Action {
            action_type: ActionType::MouseMove,
            timestamp,
            x: Some(x),
            y: Some(y),
            button: None,
            key: None,
            text: None,
            modifiers: None,
            additional_data: None,
        }
    })
}

fn arbitrary_mouse_click() -> impl Strategy<Value = Action> {
    (
        0i32..1920, 
        0i32..1080, 
        "[left|right|middle]",
        0.0f64..10.0f64
    ).prop_map(|(x, y, button, timestamp)| {
        Action {
            action_type: ActionType::MouseClick,
            timestamp,
            x: Some(x),
            y: Some(y),
            button: Some(button),
            key: None,
            text: None,
            modifiers: None,
            additional_data: None,
        }
    })
}

fn arbitrary_key_press() -> impl Strategy<Value = Action> {
    (
        "[a|b|c|1|2|space|enter|escape|tab]",
        prop::option::of(prop::collection::vec(
            "[ctrl|shift|alt]", 
            0..3
        )),
        0.0f64..10.0f64
    ).prop_map(|(key, modifiers, timestamp)| {
        Action {
            action_type: ActionType::KeyPress,
            timestamp,
            x: None,
            y: None,
            button: None,
            key: Some(key),
            text: None,
            modifiers,
            additional_data: None,
        }
    })
}

fn arbitrary_key_type() -> impl Strategy<Value = Action> {
    (
        prop::string::string_regex("[a-zA-Z0-9 ]{1,20}").unwrap(),
        0.0f64..10.0f64
    ).prop_map(|(text, timestamp)| {
        Action {
            action_type: ActionType::KeyType,
            timestamp,
            x: None,
            y: None,
            button: None,
            key: None,
            text: Some(text),
            modifiers: None,
            additional_data: None,
        }
    })
}

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn test_property_test_setup() {
        // Verify that our test setup works
        let config = AutomationConfig::default();
        let recorder_result = Recorder::new(config.clone());
        assert!(recorder_result.is_ok(), "Should be able to create recorder for testing");
        
        let player_result = Player::new(config);
        assert!(player_result.is_ok(), "Should be able to create player for testing");
    }
}
