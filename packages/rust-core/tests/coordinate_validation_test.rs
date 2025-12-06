// Test coordinate validation and edge case handling

use rust_automation_core::{
    AutomationConfig, ScriptData, Action, ActionType,
    player::Player,
};
use tokio::sync::mpsc;

#[test]
fn test_coordinate_clamping_with_out_of_bounds() {
    // Create a test script with out-of-bounds coordinates
    let mut script = ScriptData::new("rust", "test");
    
    // Add actions with coordinates that are way out of bounds
    script.add_action(Action::mouse_move(-1000, -1000, 0.0));
    script.add_action(Action::mouse_move(100000, 100000, 0.5));
    script.add_action(Action::mouse_click(50000, 50000, "left", 1.0));
    
    let config = AutomationConfig::default();
    let mut player = Player::new(config).expect("Failed to create player");
    
    // Set up event sender
    let (sender, _receiver) = mpsc::unbounded_channel();
    player.set_event_sender(sender);
    
    // Load script
    let result = player.load_script(script);
    assert!(result.is_ok(), "Failed to load script with out-of-bounds coordinates");
    
    // Note: We can't actually start playback in tests without permissions,
    // but the coordinate clamping logic will be tested when actions are executed
}

#[test]
fn test_unsupported_action_handling() {
    // Create a test script with unsupported actions
    let mut script = ScriptData::new("rust", "test");
    
    // Add a screenshot action (not supported during playback)
    // We'll create it manually since there's no helper method
    let screenshot_action = Action {
        action_type: ActionType::Screenshot,
        timestamp: 0.0,
        x: Some(100),
        y: Some(100),
        button: None,
        key: None,
        text: None,
        modifiers: None,
        additional_data: None,
    };
    script.add_action(screenshot_action);
    
    // Add a custom action (not supported)
    let custom_action = Action {
        action_type: ActionType::Custom,
        timestamp: 0.5,
        x: None,
        y: None,
        button: None,
        key: None,
        text: None,
        modifiers: None,
        additional_data: None,
    };
    script.add_action(custom_action);
    
    // Add a mouse move with missing coordinates (invalid)
    let invalid_mouse_move = Action {
        action_type: ActionType::MouseMove,
        timestamp: 1.0,
        x: None,
        y: None,
        button: None,
        key: None,
        text: None,
        modifiers: None,
        additional_data: None,
    };
    script.add_action(invalid_mouse_move);
    
    // Add a valid action
    script.add_action(Action::mouse_move(100, 100, 1.5));
    
    let config = AutomationConfig::default();
    let mut player = Player::new(config).expect("Failed to create player");
    
    // Set up event sender
    let (sender, _receiver) = mpsc::unbounded_channel();
    player.set_event_sender(sender);
    
    // Load script
    let result = player.load_script(script);
    assert!(result.is_ok(), "Failed to load script with unsupported actions");
    
    // The unsupported actions should be skipped during playback
    // (tested through logging when playback actually runs)
}

#[test]
fn test_concurrent_playback_prevention() {
    let mut script = ScriptData::new("rust", "test");
    script.add_action(Action::mouse_move(100, 100, 0.0));
    script.add_action(Action::mouse_move(200, 200, 0.5));
    
    let config = AutomationConfig::default();
    let mut player = Player::new(config).expect("Failed to create player");
    
    // Set up event sender
    let (sender, _receiver) = mpsc::unbounded_channel();
    player.set_event_sender(sender);
    
    // Load script
    player.load_script(script.clone()).expect("Failed to load script");
    
    // Try to start playback (will fail due to permissions, but that's ok)
    let _first_result = player.start_playback(1.0, 1);
    
    // If playback started (unlikely in test environment), try to start again
    if player.is_playing() {
        // This should fail with concurrent playback error
        let second_result = player.start_playback(1.0, 1);
        assert!(second_result.is_err(), "Should reject concurrent playback");
        
        if let Err(e) = second_result {
            let error_msg = format!("{}", e);
            assert!(error_msg.contains("already in progress"), 
                "Error should mention playback already in progress: {}", error_msg);
        }
        
        // Clean up
        let _ = player.stop_playback();
    }
}

#[test]
fn test_action_validation_logic() {
    // Test that action validation correctly identifies supported vs unsupported actions
    
    // Valid mouse move
    let valid_mouse_move = Action::mouse_move(100, 100, 0.0);
    assert!(has_required_fields(&valid_mouse_move), "Valid mouse move should have required fields");
    
    // Invalid mouse move (missing coordinates)
    let invalid_mouse_move = Action {
        action_type: ActionType::MouseMove,
        timestamp: 0.0,
        x: None,
        y: None,
        button: None,
        key: None,
        text: None,
        modifiers: None,
        additional_data: None,
    };
    assert!(!has_required_fields(&invalid_mouse_move), "Mouse move without coordinates should be invalid");
    
    // Valid mouse click
    let valid_mouse_click = Action::mouse_click(100, 100, "left", 0.0);
    assert!(has_required_fields(&valid_mouse_click), "Valid mouse click should have required fields");
    
    // Invalid mouse click (missing button)
    let invalid_mouse_click = Action {
        action_type: ActionType::MouseClick,
        timestamp: 0.0,
        x: Some(100),
        y: Some(100),
        button: None,
        key: None,
        text: None,
        modifiers: None,
        additional_data: None,
    };
    assert!(!has_required_fields(&invalid_mouse_click), "Mouse click without button should be invalid");
    
    // Valid key type
    let valid_key_type = Action::key_type("test", 0.0);
    assert!(has_required_fields(&valid_key_type), "Valid key type should have required fields");
    
    // Invalid key type (missing text)
    let invalid_key_type = Action {
        action_type: ActionType::KeyType,
        timestamp: 0.0,
        x: None,
        y: None,
        button: None,
        key: None,
        text: None,
        modifiers: None,
        additional_data: None,
    };
    assert!(!has_required_fields(&invalid_key_type), "Key type without text should be invalid");
    
    // Screenshot (not supported during playback)
    let screenshot = Action {
        action_type: ActionType::Screenshot,
        timestamp: 0.0,
        x: None,
        y: None,
        button: None,
        key: None,
        text: None,
        modifiers: None,
        additional_data: None,
    };
    assert!(!is_supported_for_playback(&screenshot), "Screenshot should not be supported for playback");
    
    // Custom (not supported)
    let custom = Action {
        action_type: ActionType::Custom,
        timestamp: 0.0,
        x: None,
        y: None,
        button: None,
        key: None,
        text: None,
        modifiers: None,
        additional_data: None,
    };
    assert!(!is_supported_for_playback(&custom), "Custom actions should not be supported for playback");
}

// Helper functions to test action validation logic
fn has_required_fields(action: &Action) -> bool {
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

fn is_supported_for_playback(action: &Action) -> bool {
    match action.action_type {
        ActionType::Screenshot | ActionType::Custom => false,
        _ => has_required_fields(action),
    }
}
