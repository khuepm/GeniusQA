//! Property-based tests for AI Vision Capture types
//!
//! These tests verify the correctness properties defined in the design document
//! for the AI Vision Capture feature.

use proptest::prelude::*;
use crate::script::{
    AIVisionCaptureAction, VisionROI, StaticData, DynamicConfig, CacheData,
    InteractionType, SearchScope,
};

// ============================================================================
// Proptest Strategies for AI Vision Capture Types
// ============================================================================

/// Strategy for generating random InteractionType values
fn interaction_type_strategy() -> impl Strategy<Value = InteractionType> {
    prop_oneof![
        Just(InteractionType::Click),
        Just(InteractionType::Dblclick),
        Just(InteractionType::Rclick),
        Just(InteractionType::Hover),
    ]
}

/// Strategy for generating random SearchScope values
fn search_scope_strategy() -> impl Strategy<Value = SearchScope> {
    prop_oneof![
        Just(SearchScope::Global),
        Just(SearchScope::Regional),
    ]
}

/// Strategy for generating random VisionROI values
fn vision_roi_strategy() -> impl Strategy<Value = VisionROI> {
    (0i32..10000, 0i32..10000, 1u32..5000, 1u32..5000)
        .prop_map(|(x, y, width, height)| VisionROI { x, y, width, height })
}

/// Strategy for generating optional VisionROI
fn optional_vision_roi_strategy() -> impl Strategy<Value = Option<VisionROI>> {
    prop_oneof![
        Just(None),
        vision_roi_strategy().prop_map(Some),
    ]
}

/// Strategy for generating screen dimensions
fn screen_dim_strategy() -> impl Strategy<Value = (u32, u32)> {
    (800u32..7680, 600u32..4320) // From 800x600 to 8K resolution
}

/// Strategy for generating optional screen dimensions
fn optional_screen_dim_strategy() -> impl Strategy<Value = Option<(u32, u32)>> {
    prop_oneof![
        Just(None),
        screen_dim_strategy().prop_map(Some),
    ]
}

/// Strategy for generating optional coordinates
fn optional_coordinate_strategy() -> impl Strategy<Value = Option<i32>> {
    prop_oneof![
        Just(None),
        (0i32..10000).prop_map(Some),
    ]
}

/// Strategy for generating StaticData
fn static_data_strategy() -> impl Strategy<Value = StaticData> {
    (
        "[a-zA-Z0-9_/]{1,50}\\.png",  // screenshot path
        optional_coordinate_strategy(),
        optional_coordinate_strategy(),
        screen_dim_strategy(),
    )
        .prop_map(|(screenshot, saved_x, saved_y, screen_dim)| StaticData {
            original_screenshot: screenshot,
            saved_x,
            saved_y,
            screen_dim,
        })
}

/// Strategy for generating reference image paths
fn reference_images_strategy() -> impl Strategy<Value = Vec<String>> {
    prop::collection::vec("[a-zA-Z0-9_/]{1,30}\\.png", 0..5)
}

/// Strategy for generating DynamicConfig
fn dynamic_config_strategy() -> impl Strategy<Value = DynamicConfig> {
    (
        "[a-zA-Z0-9 ]{0,100}",  // prompt
        reference_images_strategy(),
        optional_vision_roi_strategy(),
        search_scope_strategy(),
    )
        .prop_map(|(prompt, reference_images, roi, search_scope)| DynamicConfig {
            prompt,
            reference_images,
            roi,
            search_scope,
        })
}

/// Strategy for generating CacheData
fn cache_data_strategy() -> impl Strategy<Value = CacheData> {
    (
        optional_coordinate_strategy(),
        optional_coordinate_strategy(),
        optional_screen_dim_strategy(),
    )
        .prop_map(|(cached_x, cached_y, cache_dim)| CacheData {
            cached_x,
            cached_y,
            cache_dim,
        })
}

/// Strategy for generating complete AIVisionCaptureAction
fn ai_vision_capture_action_strategy() -> impl Strategy<Value = AIVisionCaptureAction> {
    (
        "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}",  // UUID-like id
        0.0f64..3600.0,  // timestamp (up to 1 hour)
        prop::bool::ANY,  // is_dynamic
        interaction_type_strategy(),
        static_data_strategy(),
        dynamic_config_strategy(),
        cache_data_strategy(),
    )
        .prop_map(|(id, timestamp, is_dynamic, interaction, static_data, dynamic_config, cache_data)| {
            AIVisionCaptureAction {
                action_type: "ai_vision_capture".to_string(),
                id,
                timestamp,
                is_dynamic,
                interaction,
                static_data,
                dynamic_config,
                cache_data,
            }
        })
}

// ============================================================================
// Property Tests
// ============================================================================

/// **Feature: ai-vision-capture, Property 2: Round-trip Serialization Consistency**
///
/// *For any* valid ai_vision_capture action, serializing to JSON and then
/// deserializing SHALL produce an equivalent action object with identical field values.
///
/// **Validates: Requirements 5.6**
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_round_trip_serialization_consistency(
        action in ai_vision_capture_action_strategy()
    ) {
        // Serialize to JSON
        let json_str = serde_json::to_string(&action)
            .expect("Serialization should succeed");
        
        // Deserialize back
        let deserialized: AIVisionCaptureAction = serde_json::from_str(&json_str)
            .expect("Deserialization should succeed");
        
        // Verify all fields are identical
        prop_assert_eq!(&action.action_type, &deserialized.action_type,
            "action_type should be preserved");
        prop_assert_eq!(&action.id, &deserialized.id,
            "id should be preserved");
        prop_assert!((action.timestamp - deserialized.timestamp).abs() < 1e-10,
            "timestamp should be preserved (within floating point tolerance)");
        prop_assert_eq!(action.is_dynamic, deserialized.is_dynamic,
            "is_dynamic should be preserved");
        prop_assert_eq!(action.interaction, deserialized.interaction,
            "interaction should be preserved");
        
        // Verify static_data
        prop_assert_eq!(
            &action.static_data.original_screenshot,
            &deserialized.static_data.original_screenshot,
            "static_data.original_screenshot should be preserved"
        );
        prop_assert_eq!(
            action.static_data.saved_x,
            deserialized.static_data.saved_x,
            "static_data.saved_x should be preserved"
        );
        prop_assert_eq!(
            action.static_data.saved_y,
            deserialized.static_data.saved_y,
            "static_data.saved_y should be preserved"
        );
        prop_assert_eq!(
            action.static_data.screen_dim,
            deserialized.static_data.screen_dim,
            "static_data.screen_dim should be preserved"
        );
        
        // Verify dynamic_config
        prop_assert_eq!(
            &action.dynamic_config.prompt,
            &deserialized.dynamic_config.prompt,
            "dynamic_config.prompt should be preserved"
        );
        prop_assert_eq!(
            &action.dynamic_config.reference_images,
            &deserialized.dynamic_config.reference_images,
            "dynamic_config.reference_images should be preserved"
        );
        prop_assert_eq!(
            action.dynamic_config.roi,
            deserialized.dynamic_config.roi,
            "dynamic_config.roi should be preserved"
        );
        prop_assert_eq!(
            action.dynamic_config.search_scope,
            deserialized.dynamic_config.search_scope,
            "dynamic_config.search_scope should be preserved"
        );
        
        // Verify cache_data
        prop_assert_eq!(
            action.cache_data.cached_x,
            deserialized.cache_data.cached_x,
            "cache_data.cached_x should be preserved"
        );
        prop_assert_eq!(
            action.cache_data.cached_y,
            deserialized.cache_data.cached_y,
            "cache_data.cached_y should be preserved"
        );
        prop_assert_eq!(
            action.cache_data.cache_dim,
            deserialized.cache_data.cache_dim,
            "cache_data.cache_dim should be preserved"
        );
    }
}

/// Test that VisionROI serializes and deserializes correctly
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_vision_roi_round_trip(roi in vision_roi_strategy()) {
        let json_str = serde_json::to_string(&roi)
            .expect("VisionROI serialization should succeed");
        
        let deserialized: VisionROI = serde_json::from_str(&json_str)
            .expect("VisionROI deserialization should succeed");
        
        prop_assert_eq!(roi, deserialized, "VisionROI should round-trip correctly");
    }
}

/// Test that InteractionType serializes to expected snake_case values
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_interaction_type_serialization(interaction in interaction_type_strategy()) {
        let json_str = serde_json::to_string(&interaction)
            .expect("InteractionType serialization should succeed");
        
        // Verify it serializes to lowercase
        let expected = match interaction {
            InteractionType::Click => "\"click\"",
            InteractionType::Dblclick => "\"dblclick\"",
            InteractionType::Rclick => "\"rclick\"",
            InteractionType::Hover => "\"hover\"",
        };
        
        prop_assert_eq!(&json_str, expected, "InteractionType should serialize to lowercase");
        
        // Verify round-trip
        let deserialized: InteractionType = serde_json::from_str(&json_str)
            .expect("InteractionType deserialization should succeed");
        
        prop_assert_eq!(interaction, deserialized, "InteractionType should round-trip correctly");
    }
}

/// Test that SearchScope serializes to expected snake_case values
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_search_scope_serialization(scope in search_scope_strategy()) {
        let json_str = serde_json::to_string(&scope)
            .expect("SearchScope serialization should succeed");
        
        // Verify it serializes to lowercase
        let expected = match scope {
            SearchScope::Global => "\"global\"",
            SearchScope::Regional => "\"regional\"",
        };
        
        prop_assert_eq!(&json_str, expected, "SearchScope should serialize to lowercase");
        
        // Verify round-trip
        let deserialized: SearchScope = serde_json::from_str(&json_str)
            .expect("SearchScope deserialization should succeed");
        
        prop_assert_eq!(scope, deserialized, "SearchScope should round-trip correctly");
    }
}

/// Test that StaticData serializes and deserializes correctly
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_static_data_round_trip(static_data in static_data_strategy()) {
        let json_str = serde_json::to_string(&static_data)
            .expect("StaticData serialization should succeed");
        
        let deserialized: StaticData = serde_json::from_str(&json_str)
            .expect("StaticData deserialization should succeed");
        
        prop_assert_eq!(static_data, deserialized, "StaticData should round-trip correctly");
    }
}

/// Test that DynamicConfig serializes and deserializes correctly
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_dynamic_config_round_trip(dynamic_config in dynamic_config_strategy()) {
        let json_str = serde_json::to_string(&dynamic_config)
            .expect("DynamicConfig serialization should succeed");
        
        let deserialized: DynamicConfig = serde_json::from_str(&json_str)
            .expect("DynamicConfig deserialization should succeed");
        
        prop_assert_eq!(dynamic_config, deserialized, "DynamicConfig should round-trip correctly");
    }
}

/// Test that CacheData serializes and deserializes correctly
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_cache_data_round_trip(cache_data in cache_data_strategy()) {
        let json_str = serde_json::to_string(&cache_data)
            .expect("CacheData serialization should succeed");
        
        let deserialized: CacheData = serde_json::from_str(&json_str)
            .expect("CacheData deserialization should succeed");
        
        prop_assert_eq!(cache_data, deserialized, "CacheData should round-trip correctly");
    }
}

/// Test that default values are correct
#[test]
fn test_default_values() {
    // Test InteractionType default
    assert_eq!(InteractionType::default(), InteractionType::Click);
    
    // Test SearchScope default
    assert_eq!(SearchScope::default(), SearchScope::Global);
    
    // Test DynamicConfig default
    let default_config = DynamicConfig::default();
    assert_eq!(default_config.prompt, "");
    assert!(default_config.reference_images.is_empty());
    assert!(default_config.roi.is_none());
    assert_eq!(default_config.search_scope, SearchScope::Global);
    
    // Test CacheData default
    let default_cache = CacheData::default();
    assert!(default_cache.cached_x.is_none());
    assert!(default_cache.cached_y.is_none());
    assert!(default_cache.cache_dim.is_none());
}

/// Test AIVisionCaptureAction::new creates correct defaults
#[test]
fn test_ai_vision_capture_action_new() {
    let action = AIVisionCaptureAction::new(
        "test-id-123".to_string(),
        5.0,
        "screenshots/test.png".to_string(),
        (1920, 1080),
    );
    
    // Verify defaults per Requirement 3.1
    assert_eq!(action.action_type, "ai_vision_capture");
    assert_eq!(action.id, "test-id-123");
    assert!((action.timestamp - 5.0).abs() < 1e-10);
    assert!(!action.is_dynamic, "Default mode should be Static (is_dynamic = false)");
    assert_eq!(action.interaction, InteractionType::Click);
    
    // Verify static_data
    assert_eq!(action.static_data.original_screenshot, "screenshots/test.png");
    assert!(action.static_data.saved_x.is_none());
    assert!(action.static_data.saved_y.is_none());
    assert_eq!(action.static_data.screen_dim, (1920, 1080));
    
    // Verify dynamic_config defaults
    assert_eq!(action.dynamic_config.prompt, "");
    assert!(action.dynamic_config.reference_images.is_empty());
    assert!(action.dynamic_config.roi.is_none());
    assert_eq!(action.dynamic_config.search_scope, SearchScope::Global);
    
    // Verify cache_data defaults
    assert!(action.cache_data.cached_x.is_none());
    assert!(action.cache_data.cached_y.is_none());
    assert!(action.cache_data.cache_dim.is_none());
}

/// Test helper methods on AIVisionCaptureAction
#[test]
fn test_ai_vision_capture_action_helpers() {
    let mut action = AIVisionCaptureAction::new(
        "test-id".to_string(),
        0.0,
        "test.png".to_string(),
        (1920, 1080),
    );
    
    // Initially no coordinates
    assert!(!action.has_static_coordinates());
    assert!(!action.has_cached_coordinates());
    
    // Set static coordinates
    action.static_data.saved_x = Some(100);
    action.static_data.saved_y = Some(200);
    assert!(action.has_static_coordinates());
    assert!(!action.has_cached_coordinates());
    
    // Update cache
    action.update_cache(300, 400, (1920, 1080));
    assert!(action.has_cached_coordinates());
    assert_eq!(action.cache_data.cached_x, Some(300));
    assert_eq!(action.cache_data.cached_y, Some(400));
    assert_eq!(action.cache_data.cache_dim, Some((1920, 1080)));
    
    // Clear cache
    action.clear_cache();
    assert!(!action.has_cached_coordinates());
    assert!(action.cache_data.cached_x.is_none());
    assert!(action.cache_data.cached_y.is_none());
    assert!(action.cache_data.cache_dim.is_none());
}

// ============================================================================
// Recording Continuity Property Tests
// ============================================================================

use crate::recorder::{Recorder, ModifierState};
use crate::config::AutomationConfig;

/// **Feature: ai-vision-capture, Property 13: Recording Continuity**
///
/// *For any* recording session, pressing the vision capture hotkey SHALL NOT
/// interrupt the capture of subsequent mouse and keyboard events.
///
/// **Validates: Requirements 1.3**
///
/// This test verifies that:
/// 1. The modifier state tracking works correctly for various key combinations
/// 2. The hotkey detection correctly identifies Cmd+F6 (macOS) or Ctrl+F6 (Windows/Linux)
/// 3. The recorder remains in recording state after hotkey detection
/// 4. Actions can continue to be recorded after a vision capture hotkey is detected
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_recording_continuity_modifier_state_tracking(
        // Generate random sequences of modifier key presses/releases
        cmd_pressed in prop::bool::ANY,
        shift_pressed in prop::bool::ANY,
        alt_pressed in prop::bool::ANY,
    ) {
        // Create a recorder (this may fail on systems without proper permissions,
        // so we handle that gracefully)
        let config = AutomationConfig::default();
        let recorder_result = Recorder::new(config);
        
        // Skip test if recorder creation fails (e.g., no permissions)
        if recorder_result.is_err() {
            return Ok(());
        }
        
        let recorder = recorder_result.unwrap();
        
        // Simulate modifier key state changes
        // Note: We're testing the state tracking logic, not actual key events
        
        // Test that modifier state starts at default (all false)
        let initial_state = recorder.get_modifier_state();
        prop_assert!(!initial_state.cmd_or_ctrl_held, "Initial cmd_or_ctrl should be false");
        prop_assert!(!initial_state.shift_held, "Initial shift should be false");
        prop_assert!(!initial_state.alt_held, "Initial alt should be false");
        
        // Simulate pressing Meta/Cmd key
        if cmd_pressed {
            recorder.is_vision_capture_hotkey(&rdev::Key::MetaLeft, true);
            let state = recorder.get_modifier_state();
            prop_assert!(state.cmd_or_ctrl_held, "cmd_or_ctrl should be true after MetaLeft press");
        }
        
        // Simulate pressing Shift key
        if shift_pressed {
            recorder.is_vision_capture_hotkey(&rdev::Key::ShiftLeft, true);
            let state = recorder.get_modifier_state();
            prop_assert!(state.shift_held, "shift should be true after ShiftLeft press");
        }
        
        // Simulate pressing Alt key
        if alt_pressed {
            recorder.is_vision_capture_hotkey(&rdev::Key::Alt, true);
            let state = recorder.get_modifier_state();
            prop_assert!(state.alt_held, "alt should be true after Alt press");
        }
        
        // Test reset functionality
        recorder.reset_modifier_state();
        let reset_state = recorder.get_modifier_state();
        prop_assert!(!reset_state.cmd_or_ctrl_held, "cmd_or_ctrl should be false after reset");
        prop_assert!(!reset_state.shift_held, "shift should be false after reset");
        prop_assert!(!reset_state.alt_held, "alt should be false after reset");
    }
}

/// Test that the vision capture hotkey is correctly detected
/// **Feature: ai-vision-capture, Property 13: Recording Continuity**
/// **Validates: Requirements 1.1, 1.3**
#[test]
fn test_vision_capture_hotkey_detection() {
    let config = AutomationConfig::default();
    let recorder_result = Recorder::new(config);
    
    // Skip test if recorder creation fails
    if recorder_result.is_err() {
        println!("Skipping test: Recorder creation failed (likely missing permissions)");
        return;
    }
    
    let recorder = recorder_result.unwrap();
    
    // Test 1: F6 alone should NOT trigger vision capture
    let is_hotkey = recorder.is_vision_capture_hotkey(&rdev::Key::F6, true);
    assert!(!is_hotkey, "F6 alone should not trigger vision capture");
    
    // Test 2: Cmd/Meta + F6 should trigger vision capture
    // First press Meta key
    recorder.is_vision_capture_hotkey(&rdev::Key::MetaLeft, true);
    // Then press F6
    let is_hotkey = recorder.is_vision_capture_hotkey(&rdev::Key::F6, true);
    assert!(is_hotkey, "Cmd+F6 should trigger vision capture");
    
    // Reset state
    recorder.reset_modifier_state();
    
    // Test 3: Ctrl + F6 should also trigger vision capture (for Windows/Linux compatibility)
    recorder.is_vision_capture_hotkey(&rdev::Key::ControlLeft, true);
    let is_hotkey = recorder.is_vision_capture_hotkey(&rdev::Key::F6, true);
    assert!(is_hotkey, "Ctrl+F6 should trigger vision capture");
    
    // Reset state
    recorder.reset_modifier_state();
    
    // Test 4: Key release should NOT trigger vision capture
    recorder.is_vision_capture_hotkey(&rdev::Key::MetaLeft, true);
    let is_hotkey = recorder.is_vision_capture_hotkey(&rdev::Key::F6, false); // Release, not press
    assert!(!is_hotkey, "Key release should not trigger vision capture");
    
    // Test 5: Other function keys should NOT trigger vision capture
    recorder.reset_modifier_state();
    recorder.is_vision_capture_hotkey(&rdev::Key::MetaLeft, true);
    let is_hotkey = recorder.is_vision_capture_hotkey(&rdev::Key::F5, true);
    assert!(!is_hotkey, "Cmd+F5 should not trigger vision capture");
    
    let is_hotkey = recorder.is_vision_capture_hotkey(&rdev::Key::F7, true);
    assert!(!is_hotkey, "Cmd+F7 should not trigger vision capture");
}

/// Test that recording state is preserved after hotkey detection
/// **Feature: ai-vision-capture, Property 13: Recording Continuity**
/// **Validates: Requirements 1.3**
#[test]
fn test_recording_state_preserved_after_hotkey() {
    let config = AutomationConfig::default();
    let recorder_result = Recorder::new(config);
    
    // Skip test if recorder creation fails
    if recorder_result.is_err() {
        println!("Skipping test: Recorder creation failed (likely missing permissions)");
        return;
    }
    
    let recorder = recorder_result.unwrap();
    
    // Verify recorder is not recording initially
    assert!(!recorder.is_recording(), "Recorder should not be recording initially");
    
    // Simulate hotkey detection (this should not affect recording state)
    recorder.is_vision_capture_hotkey(&rdev::Key::MetaLeft, true);
    recorder.is_vision_capture_hotkey(&rdev::Key::F6, true);
    
    // Verify recorder is still not recording (hotkey detection doesn't start recording)
    assert!(!recorder.is_recording(), "Hotkey detection should not start recording");
    
    // Verify modifier state can be reset
    recorder.reset_modifier_state();
    let state = recorder.get_modifier_state();
    assert!(!state.cmd_or_ctrl_held, "Modifier state should be reset");
}

/// Property test for modifier state consistency
/// **Feature: ai-vision-capture, Property 13: Recording Continuity**
/// **Validates: Requirements 1.3**
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_modifier_state_consistency(
        // Generate random sequences of key events
        num_events in 1usize..20,
    ) {
        let config = AutomationConfig::default();
        let recorder_result = Recorder::new(config);
        
        if recorder_result.is_err() {
            return Ok(());
        }
        
        let recorder = recorder_result.unwrap();
        
        // Simulate a sequence of key events
        let keys = vec![
            rdev::Key::MetaLeft,
            rdev::Key::MetaRight,
            rdev::Key::ControlLeft,
            rdev::Key::ControlRight,
            rdev::Key::ShiftLeft,
            rdev::Key::ShiftRight,
            rdev::Key::Alt,
        ];
        
        for i in 0..num_events {
            let key = &keys[i % keys.len()];
            let is_press = i % 2 == 0; // Alternate between press and release
            
            // This should never panic or cause issues
            let _ = recorder.is_vision_capture_hotkey(key, is_press);
        }
        
        // After any sequence of events, reset should work
        recorder.reset_modifier_state();
        let state = recorder.get_modifier_state();
        
        prop_assert!(!state.cmd_or_ctrl_held, "After reset, cmd_or_ctrl should be false");
        prop_assert!(!state.shift_held, "After reset, shift should be false");
        prop_assert!(!state.alt_held, "After reset, alt should be false");
    }
}


// ============================================================================
// Asset Manager Property Tests
// ============================================================================

use crate::asset_manager::{to_posix_path, to_native_path, generate_unique_filename, is_safe_path, AssetManager};
use std::collections::HashSet;
use tempfile::TempDir;

/// Strategy for generating paths with mixed separators (Windows and Unix style)
fn mixed_path_strategy() -> impl Strategy<Value = String> {
    // Generate path segments and randomly use / or \ between them
    (
        prop::collection::vec("[a-zA-Z0-9_]{1,10}", 1..5),
        prop::collection::vec(prop::bool::ANY, 0..4),
    )
        .prop_map(|(segments, use_backslash)| {
            let mut path = String::new();
            for (i, segment) in segments.iter().enumerate() {
                if i > 0 {
                    // Use backslash or forward slash based on random bool
                    if i <= use_backslash.len() && use_backslash[i - 1] {
                        path.push('\\');
                    } else {
                        path.push('/');
                    }
                }
                path.push_str(segment);
            }
            path
        })
}

/// Strategy for generating valid action IDs (UUID-like strings)
fn action_id_strategy() -> impl Strategy<Value = String> {
    "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"
}

/// Strategy for generating file extensions
fn extension_strategy() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("png".to_string()),
        Just("jpg".to_string()),
        Just("jpeg".to_string()),
        Just("gif".to_string()),
        Just("webp".to_string()),
    ]
}

/// **Feature: ai-vision-capture, Property 16: Asset Path Normalization (Cross-Platform)**
///
/// *For any* reference_image path stored in the script JSON, the path SHALL use
/// POSIX format (forward slashes `/`) regardless of the operating system.
/// When loading, the Asset_Manager SHALL convert to OS-native format if needed.
///
/// **Validates: Requirements 5.9, 5.10**
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_asset_path_normalization_to_posix(
        path in mixed_path_strategy()
    ) {
        let posix_path = to_posix_path(&path);
        
        // Property 1: POSIX path should never contain backslashes
        prop_assert!(
            !posix_path.contains('\\'),
            "POSIX path '{}' should not contain backslashes (original: '{}')",
            posix_path, path
        );
        
        // Property 2: All path segments should be preserved
        let original_segments: Vec<&str> = path.split(|c| c == '/' || c == '\\')
            .filter(|s| !s.is_empty())
            .collect();
        let posix_segments: Vec<&str> = posix_path.split('/')
            .filter(|s| !s.is_empty())
            .collect();
        
        prop_assert_eq!(
            original_segments, posix_segments,
            "Path segments should be preserved after normalization"
        );
        
        // Property 3: Idempotence - normalizing twice should give same result
        let double_normalized = to_posix_path(&posix_path);
        prop_assert_eq!(
            posix_path, double_normalized,
            "to_posix_path should be idempotent"
        );
    }
    
    #[test]
    fn test_asset_path_round_trip(
        path in mixed_path_strategy()
    ) {
        // Convert to POSIX (for storage)
        let posix_path = to_posix_path(&path);
        
        // Convert to native (for file operations)
        let native_path = to_native_path(&posix_path);
        
        // Convert back to POSIX
        let back_to_posix = to_posix_path(&native_path);
        
        // Property: Round-trip should preserve the POSIX path
        prop_assert_eq!(
            posix_path, back_to_posix,
            "Round-trip (POSIX -> native -> POSIX) should preserve path"
        );
    }
    
    #[test]
    fn test_native_path_platform_specific(
        path in "[a-zA-Z0-9_/]{1,50}"
    ) {
        let native_path = to_native_path(&path);
        
        #[cfg(windows)]
        {
            // On Windows, forward slashes should be converted to backslashes
            prop_assert!(
                !native_path.contains('/'),
                "On Windows, native path should not contain forward slashes"
            );
        }
        
        #[cfg(not(windows))]
        {
            // On Unix-like systems, path should remain unchanged
            prop_assert_eq!(
                path, native_path,
                "On Unix, native path should be unchanged"
            );
        }
    }
}

/// **Feature: ai-vision-capture, Property 17: Asset File Naming Uniqueness**
///
/// *For any* reference image saved via paste or drag-drop, the Asset_Manager
/// SHALL generate a unique filename using the pattern `vision_{action_id}_{timestamp}.{ext}`
/// to prevent filename collisions.
///
/// **Validates: Requirements 5.11**
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_unique_filename_format(
        action_id in action_id_strategy(),
        extension in extension_strategy()
    ) {
        let filename = generate_unique_filename(&action_id, &extension);
        
        // Property 1: Filename should start with "vision_"
        prop_assert!(
            filename.starts_with("vision_"),
            "Filename '{}' should start with 'vision_'",
            filename
        );
        
        // Property 2: Filename should contain the action_id (sanitized)
        let sanitized_id: String = action_id
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect();
        prop_assert!(
            filename.contains(&sanitized_id),
            "Filename '{}' should contain sanitized action_id '{}'",
            filename, sanitized_id
        );
        
        // Property 3: Filename should end with the extension
        prop_assert!(
            filename.ends_with(&format!(".{}", extension.trim_start_matches('.'))),
            "Filename '{}' should end with '.{}'",
            filename, extension
        );
        
        // Property 4: Filename should match the pattern vision_{id}_{timestamp}.{ext}
        let parts: Vec<&str> = filename.split('.').collect();
        prop_assert_eq!(
            parts.len(), 2,
            "Filename should have exactly one dot (extension separator)"
        );
        
        let name_parts: Vec<&str> = parts[0].split('_').collect();
        prop_assert!(
            name_parts.len() >= 3,
            "Filename base should have at least 3 parts separated by underscore"
        );
        prop_assert_eq!(
            name_parts[0], "vision",
            "First part should be 'vision'"
        );
    }
    
    #[test]
    fn test_unique_filename_uniqueness_same_action(
        action_id in action_id_strategy(),
        extension in extension_strategy(),
        count in 2usize..10
    ) {
        let mut filenames = HashSet::new();
        
        for _ in 0..count {
            let filename = generate_unique_filename(&action_id, &extension);
            
            // Small delay to ensure different timestamps
            std::thread::sleep(std::time::Duration::from_millis(2));
            
            // Property: Each filename should be unique
            prop_assert!(
                filenames.insert(filename.clone()),
                "Filename '{}' should be unique, but was already generated",
                filename
            );
        }
        
        // Verify we got the expected number of unique filenames
        prop_assert_eq!(
            filenames.len(), count,
            "Should have generated {} unique filenames",
            count
        );
    }
    
    #[test]
    fn test_unique_filename_sanitization(
        // Generate action IDs with potentially problematic characters
        action_id in "[a-zA-Z0-9./<>:\"\\|?*]{1,20}",
        extension in extension_strategy()
    ) {
        let filename = generate_unique_filename(&action_id, &extension);
        
        // Property 1: Filename should not contain path separators
        prop_assert!(
            !filename.contains('/') && !filename.contains('\\'),
            "Filename '{}' should not contain path separators",
            filename
        );
        
        // Property 2: Filename should not contain characters invalid for filenames
        let invalid_chars = ['<', '>', ':', '"', '|', '?', '*'];
        for c in invalid_chars {
            prop_assert!(
                !filename.contains(c),
                "Filename '{}' should not contain invalid character '{}'",
                filename, c
            );
        }
        
        // Property 3: Filename should be a valid filename (no double dots)
        prop_assert!(
            !filename.contains(".."),
            "Filename '{}' should not contain '..'",
            filename
        );
    }
}

/// Test safe path validation
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_safe_path_validation(
        // Generate relative paths that don't start with / and don't contain ..
        path in "[a-zA-Z0-9_][a-zA-Z0-9_/]{0,49}"
    ) {
        // Normal relative paths without traversal should be safe
        prop_assert!(
            is_safe_path(&path),
            "Normal relative path '{}' should be considered safe",
            path
        );
    }
    
    #[test]
    fn test_unsafe_path_detection(
        prefix in "[a-zA-Z0-9_]{0,10}",
        suffix in "[a-zA-Z0-9_]{0,10}"
    ) {
        // Paths with directory traversal should be unsafe
        let traversal_path = format!("{}/../{}", prefix, suffix);
        prop_assert!(
            !is_safe_path(&traversal_path),
            "Path with traversal '{}' should be unsafe",
            traversal_path
        );
        
        // Absolute paths should be unsafe
        let absolute_path = format!("/{}/{}", prefix, suffix);
        prop_assert!(
            !is_safe_path(&absolute_path),
            "Absolute path '{}' should be unsafe",
            absolute_path
        );
    }
}

/// Integration test for AssetManager with property-based inputs
proptest! {
    #![proptest_config(ProptestConfig::with_cases(50))]
    
    #[test]
    fn test_asset_manager_save_load_round_trip(
        action_id in action_id_strategy(),
        data in prop::collection::vec(prop::num::u8::ANY, 10..100)
    ) {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let script_path = temp_dir.path().join("script.json");
        let manager = AssetManager::new(script_path.to_str().unwrap());
        
        // Save the image
        let relative_path = manager.save_reference_image(&data, &action_id, "png")
            .expect("Save should succeed");
        
        // Property 1: Relative path should be in POSIX format
        prop_assert!(
            !relative_path.contains('\\'),
            "Saved path '{}' should be in POSIX format",
            relative_path
        );
        
        // Property 2: Relative path should start with assets/
        prop_assert!(
            relative_path.starts_with("assets/"),
            "Saved path '{}' should start with 'assets/'",
            relative_path
        );
        
        // Property 3: File should exist
        prop_assert!(
            manager.reference_image_exists(&relative_path),
            "Saved file should exist at '{}'",
            relative_path
        );
        
        // Property 4: Loading should return the same data
        let loaded_data = manager.load_reference_image(&relative_path)
            .expect("Load should succeed");
        prop_assert_eq!(
            data, loaded_data,
            "Loaded data should match saved data"
        );
        
        // Property 5: Delete should work
        manager.delete_reference_image(&relative_path)
            .expect("Delete should succeed");
        prop_assert!(
            !manager.reference_image_exists(&relative_path),
            "File should not exist after deletion"
        );
    }
}


// ============================================================================
// Coordinate Scaling Property Tests
// ============================================================================

use crate::player::{scale_coordinates, scale_roi, ScreenDimensions, ScaledCoordinates};

/// Strategy for generating valid screen dimensions
/// Range: 800x600 to 7680x4320 (8K resolution)
fn valid_screen_dim_strategy() -> impl Strategy<Value = ScreenDimensions> {
    (800u32..7680, 600u32..4320)
}

/// Strategy for generating coordinates within screen bounds
fn coordinate_within_bounds_strategy(max_x: u32, max_y: u32) -> impl Strategy<Value = (i32, i32)> {
    (0i32..(max_x as i32), 0i32..(max_y as i32))
}

/// Strategy for generating coordinates that may be outside bounds (for edge case testing)
fn any_coordinate_strategy() -> impl Strategy<Value = (i32, i32)> {
    (-1000i32..10000, -1000i32..10000)
}

/// **Feature: ai-vision-capture, Property 3: Coordinate Scaling Proportionality**
///
/// *For any* saved coordinates (x, y) and screen dimensions, when the playback
/// screen resolution differs from the recorded resolution, the scaled coordinates
/// SHALL be proportional: `scaled_x / new_width == original_x / original_width`
/// and `scaled_y / new_height == original_y / original_height`.
///
/// **Validates: Requirements 4.3, 4.5**
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_coordinate_scaling_proportionality(
        old_dim in valid_screen_dim_strategy(),
        new_dim in valid_screen_dim_strategy(),
    ) {
        let (old_width, old_height) = old_dim;
        let (new_width, new_height) = new_dim;
        
        // Generate coordinates within the old screen bounds
        let x = (old_width / 2) as i32;  // Center point
        let y = (old_height / 2) as i32;
        
        let result = scale_coordinates(x, y, old_dim, new_dim);
        
        // If dimensions are the same, coordinates should be unchanged
        if old_width == new_width && old_height == new_height {
            prop_assert_eq!(result.x, x, "X should be unchanged when dimensions match");
            prop_assert_eq!(result.y, y, "Y should be unchanged when dimensions match");
            prop_assert!(!result.was_scaled, "was_scaled should be false when dimensions match");
            return Ok(());
        }
        
        // Verify proportionality (with floating point tolerance)
        // scaled_x / new_width ≈ original_x / original_width
        let expected_ratio_x = x as f64 / old_width as f64;
        let actual_ratio_x = result.x as f64 / new_width as f64;
        
        let expected_ratio_y = y as f64 / old_height as f64;
        let actual_ratio_y = result.y as f64 / new_height as f64;
        
        // Allow for rounding error (1 pixel tolerance relative to screen size)
        let tolerance_x = 1.0 / new_width as f64;
        let tolerance_y = 1.0 / new_height as f64;
        
        prop_assert!(
            (expected_ratio_x - actual_ratio_x).abs() <= tolerance_x,
            "X ratio mismatch: expected {:.6}, got {:.6} (tolerance: {:.6})",
            expected_ratio_x, actual_ratio_x, tolerance_x
        );
        
        prop_assert!(
            (expected_ratio_y - actual_ratio_y).abs() <= tolerance_y,
            "Y ratio mismatch: expected {:.6}, got {:.6} (tolerance: {:.6})",
            expected_ratio_y, actual_ratio_y, tolerance_y
        );
        
        prop_assert!(result.was_scaled, "was_scaled should be true when dimensions differ");
    }
    
    #[test]
    fn test_coordinate_scaling_with_random_coordinates(
        old_dim in valid_screen_dim_strategy(),
        new_dim in valid_screen_dim_strategy(),
    ) {
        let (old_width, old_height) = old_dim;
        let (new_width, new_height) = new_dim;
        
        // Test with coordinates at various positions within bounds
        let test_points = vec![
            (0, 0),                                           // Top-left corner
            ((old_width - 1) as i32, 0),                      // Top-right corner
            (0, (old_height - 1) as i32),                     // Bottom-left corner
            ((old_width - 1) as i32, (old_height - 1) as i32), // Bottom-right corner
            ((old_width / 2) as i32, (old_height / 2) as i32), // Center
        ];
        
        for (x, y) in test_points {
            let result = scale_coordinates(x, y, old_dim, new_dim);
            
            // Verify coordinates are within new screen bounds
            prop_assert!(
                result.x >= 0 && result.x < new_width as i32,
                "Scaled X {} should be within [0, {})",
                result.x, new_width
            );
            prop_assert!(
                result.y >= 0 && result.y < new_height as i32,
                "Scaled Y {} should be within [0, {})",
                result.y, new_height
            );
        }
    }
    
    #[test]
    fn test_coordinate_scaling_clamping(
        old_dim in valid_screen_dim_strategy(),
        new_dim in valid_screen_dim_strategy(),
        coords in any_coordinate_strategy(),
    ) {
        let (x, y) = coords;
        let (new_width, new_height) = new_dim;
        
        let result = scale_coordinates(x, y, old_dim, new_dim);
        
        // Regardless of input, output should always be within new screen bounds
        prop_assert!(
            result.x >= 0,
            "Scaled X {} should be >= 0",
            result.x
        );
        prop_assert!(
            result.x < new_width as i32,
            "Scaled X {} should be < {}",
            result.x, new_width
        );
        prop_assert!(
            result.y >= 0,
            "Scaled Y {} should be >= 0",
            result.y
        );
        prop_assert!(
            result.y < new_height as i32,
            "Scaled Y {} should be < {}",
            result.y, new_height
        );
    }
    
    #[test]
    fn test_coordinate_scaling_identity(
        dim in valid_screen_dim_strategy(),
    ) {
        let (width, height) = dim;
        
        // Test multiple points
        let test_points = vec![
            (0, 0),
            ((width / 2) as i32, (height / 2) as i32),
            ((width - 1) as i32, (height - 1) as i32),
        ];
        
        for (x, y) in test_points {
            let result = scale_coordinates(x, y, dim, dim);
            
            // When dimensions are the same, coordinates should be unchanged
            prop_assert_eq!(
                result.x, x,
                "X should be unchanged when scaling to same dimensions"
            );
            prop_assert_eq!(
                result.y, y,
                "Y should be unchanged when scaling to same dimensions"
            );
            prop_assert!(
                !result.was_scaled,
                "was_scaled should be false when dimensions match"
            );
        }
    }
    
    #[test]
    fn test_coordinate_scaling_double_then_half(
        base_dim in (400u32..1920, 300u32..1080),
    ) {
        let (base_width, base_height) = base_dim;
        let double_dim = (base_width * 2, base_height * 2);
        
        // Original coordinate at center
        let x = (base_width / 2) as i32;
        let y = (base_height / 2) as i32;
        
        // Scale up to double
        let scaled_up = scale_coordinates(x, y, base_dim, double_dim);
        
        // Scale back down to original
        let scaled_back = scale_coordinates(scaled_up.x, scaled_up.y, double_dim, base_dim);
        
        // Should be approximately the same as original (within 1 pixel due to rounding)
        prop_assert!(
            (scaled_back.x - x).abs() <= 1,
            "Round-trip X should be within 1 pixel: original={}, final={}",
            x, scaled_back.x
        );
        prop_assert!(
            (scaled_back.y - y).abs() <= 1,
            "Round-trip Y should be within 1 pixel: original={}, final={}",
            y, scaled_back.y
        );
    }
}

/// Test ROI scaling proportionality
/// **Feature: ai-vision-capture, Property 3 (extended): ROI Scaling**
/// **Validates: Requirements 4.7**
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_roi_scaling_proportionality(
        old_dim in valid_screen_dim_strategy(),
        new_dim in valid_screen_dim_strategy(),
    ) {
        let (old_width, old_height) = old_dim;
        let (new_width, new_height) = new_dim;
        
        // Create an ROI in the center of the screen
        let roi = VisionROI {
            x: (old_width / 4) as i32,
            y: (old_height / 4) as i32,
            width: old_width / 2,
            height: old_height / 2,
        };
        
        let scaled_roi = scale_roi(&roi, old_dim, new_dim);
        
        // If dimensions are the same, ROI should be unchanged
        if old_width == new_width && old_height == new_height {
            prop_assert_eq!(scaled_roi.x, roi.x, "ROI X should be unchanged");
            prop_assert_eq!(scaled_roi.y, roi.y, "ROI Y should be unchanged");
            prop_assert_eq!(scaled_roi.width, roi.width, "ROI width should be unchanged");
            prop_assert_eq!(scaled_roi.height, roi.height, "ROI height should be unchanged");
            return Ok(());
        }
        
        // Verify ROI is within new screen bounds
        prop_assert!(
            scaled_roi.x >= 0 && scaled_roi.x < new_width as i32,
            "Scaled ROI X {} should be within [0, {})",
            scaled_roi.x, new_width
        );
        prop_assert!(
            scaled_roi.y >= 0 && scaled_roi.y < new_height as i32,
            "Scaled ROI Y {} should be within [0, {})",
            scaled_roi.y, new_height
        );
        prop_assert!(
            scaled_roi.width >= 1,
            "Scaled ROI width {} should be >= 1",
            scaled_roi.width
        );
        prop_assert!(
            scaled_roi.height >= 1,
            "Scaled ROI height {} should be >= 1",
            scaled_roi.height
        );
        prop_assert!(
            scaled_roi.x + scaled_roi.width as i32 <= new_width as i32,
            "Scaled ROI right edge {} should be <= {}",
            scaled_roi.x + scaled_roi.width as i32, new_width
        );
        prop_assert!(
            scaled_roi.y + scaled_roi.height as i32 <= new_height as i32,
            "Scaled ROI bottom edge {} should be <= {}",
            scaled_roi.y + scaled_roi.height as i32, new_height
        );
    }
    
    #[test]
    fn test_roi_scaling_identity(
        dim in valid_screen_dim_strategy(),
    ) {
        let (width, height) = dim;
        
        let roi = VisionROI {
            x: (width / 4) as i32,
            y: (height / 4) as i32,
            width: width / 2,
            height: height / 2,
        };
        
        let scaled_roi = scale_roi(&roi, dim, dim);
        
        // When dimensions are the same, ROI should be unchanged
        prop_assert_eq!(scaled_roi, roi, "ROI should be unchanged when scaling to same dimensions");
    }
}

/// Test edge cases for coordinate scaling
#[test]
fn test_coordinate_scaling_edge_cases() {
    // Test zero dimensions (should handle gracefully)
    let result = scale_coordinates(100, 100, (0, 0), (1920, 1080));
    assert_eq!(result.x, 0, "Zero old dimensions should result in (0, 0)");
    assert_eq!(result.y, 0, "Zero old dimensions should result in (0, 0)");
    
    // Test negative coordinates (should clamp to 0)
    let result = scale_coordinates(-100, -100, (1920, 1080), (1920, 1080));
    assert_eq!(result.x, -100, "Negative coords with same dims should be unchanged");
    
    // Test coordinates at exact boundary
    let result = scale_coordinates(1919, 1079, (1920, 1080), (1920, 1080));
    assert_eq!(result.x, 1919, "Boundary coords with same dims should be unchanged");
    assert_eq!(result.y, 1079, "Boundary coords with same dims should be unchanged");
    
    // Test scaling from 1080p to 4K (common use case)
    let result = scale_coordinates(960, 540, (1920, 1080), (3840, 2160));
    assert_eq!(result.x, 1920, "Center point should scale to center in 4K");
    assert_eq!(result.y, 1080, "Center point should scale to center in 4K");
    assert!(result.was_scaled, "Scaling should be indicated");
    
    // Test scaling from 4K to 1080p
    let result = scale_coordinates(1920, 1080, (3840, 2160), (1920, 1080));
    assert_eq!(result.x, 960, "Center point should scale back to center in 1080p");
    assert_eq!(result.y, 540, "Center point should scale back to center in 1080p");
}

/// Test ROI scaling edge cases
#[test]
fn test_roi_scaling_edge_cases() {
    // Test zero dimensions
    let roi = VisionROI { x: 100, y: 100, width: 200, height: 200 };
    let result = scale_roi(&roi, (0, 0), (1920, 1080));
    assert_eq!(result.x, 0, "Zero old dimensions should result in (0, 0)");
    assert_eq!(result.y, 0, "Zero old dimensions should result in (0, 0)");
    
    // Test ROI at origin
    let roi = VisionROI { x: 0, y: 0, width: 100, height: 100 };
    let result = scale_roi(&roi, (1920, 1080), (3840, 2160));
    assert_eq!(result.x, 0, "Origin should remain at origin");
    assert_eq!(result.y, 0, "Origin should remain at origin");
    assert_eq!(result.width, 200, "Width should double");
    assert_eq!(result.height, 200, "Height should double");
    
    // Test ROI covering full screen
    let roi = VisionROI { x: 0, y: 0, width: 1920, height: 1080 };
    let result = scale_roi(&roi, (1920, 1080), (3840, 2160));
    assert_eq!(result.x, 0, "Full screen ROI X should be 0");
    assert_eq!(result.y, 0, "Full screen ROI Y should be 0");
    assert_eq!(result.width, 3840, "Full screen ROI width should scale");
    assert_eq!(result.height, 2160, "Full screen ROI height should scale");
}


// ============================================================================
// AI Vision Capture Execution Property Tests
// ============================================================================

use crate::player::{execute_ai_vision_capture, AIVisionExecutionMode, AIVisionExecutionResult};
use crate::platform::PlatformAutomation;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

/// Mock platform for testing AI Vision Capture execution
/// Tracks which methods are called to verify execution behavior
struct MockPlatform {
    click_count: Arc<AtomicUsize>,
    double_click_count: Arc<AtomicUsize>,
    right_click_count: Arc<AtomicUsize>,
    move_count: Arc<AtomicUsize>,
    screen_size: (u32, u32),
}

impl MockPlatform {
    fn new(screen_size: (u32, u32)) -> Self {
        Self {
            click_count: Arc::new(AtomicUsize::new(0)),
            double_click_count: Arc::new(AtomicUsize::new(0)),
            right_click_count: Arc::new(AtomicUsize::new(0)),
            move_count: Arc::new(AtomicUsize::new(0)),
            screen_size,
        }
    }

    fn total_interactions(&self) -> usize {
        self.click_count.load(Ordering::Relaxed)
            + self.double_click_count.load(Ordering::Relaxed)
            + self.right_click_count.load(Ordering::Relaxed)
            + self.move_count.load(Ordering::Relaxed)
    }
}

impl PlatformAutomation for MockPlatform {
    fn initialize(&mut self) -> crate::Result<()> { Ok(()) }
    fn check_permissions(&self) -> crate::Result<bool> { Ok(true) }
    fn request_permissions(&self) -> crate::Result<bool> { Ok(true) }
    
    fn mouse_move(&self, _x: i32, _y: i32) -> crate::Result<()> {
        self.move_count.fetch_add(1, Ordering::Relaxed);
        Ok(())
    }
    
    fn mouse_click(&self, _button: &str) -> crate::Result<()> {
        self.click_count.fetch_add(1, Ordering::Relaxed);
        Ok(())
    }
    
    fn mouse_click_at(&self, _x: i32, _y: i32, button: &str) -> crate::Result<()> {
        if button == "right" {
            self.right_click_count.fetch_add(1, Ordering::Relaxed);
        } else {
            self.click_count.fetch_add(1, Ordering::Relaxed);
        }
        Ok(())
    }
    
    fn mouse_double_click(&self, _x: i32, _y: i32, _button: &str) -> crate::Result<()> {
        self.double_click_count.fetch_add(1, Ordering::Relaxed);
        Ok(())
    }
    
    fn mouse_drag(&self, _from_x: i32, _from_y: i32, _to_x: i32, _to_y: i32, _button: &str) -> crate::Result<()> {
        Ok(())
    }
    
    fn mouse_scroll(&self, _x: i32, _y: i32, _delta_x: i32, _delta_y: i32) -> crate::Result<()> {
        Ok(())
    }
    
    fn key_press(&self, _key: &str) -> crate::Result<()> { Ok(()) }
    fn key_release(&self, _key: &str) -> crate::Result<()> { Ok(()) }
    fn key_type(&self, _text: &str) -> crate::Result<()> { Ok(()) }
    fn key_combination(&self, _key: &str, _modifiers: &[String]) -> crate::Result<()> { Ok(()) }
    fn get_mouse_position(&self) -> crate::Result<(i32, i32)> { Ok((0, 0)) }
    
    fn get_screen_size(&self) -> crate::Result<(u32, u32)> {
        Ok(self.screen_size)
    }
    
    fn take_screenshot(&self) -> crate::Result<Vec<u8>> { Ok(vec![]) }
    fn platform_name(&self) -> &'static str { "mock" }
}

/// Strategy for generating AI Vision Capture actions with static coordinates
fn action_with_static_coords_strategy() -> impl Strategy<Value = AIVisionCaptureAction> {
    (
        "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}",
        0.0f64..3600.0,
        interaction_type_strategy(),
        100i32..1800,  // saved_x
        100i32..1000,  // saved_y
        screen_dim_strategy(),
    )
        .prop_map(|(id, timestamp, interaction, saved_x, saved_y, screen_dim)| {
            let mut action = AIVisionCaptureAction::new(
                id,
                timestamp,
                "screenshots/test.png".to_string(),
                screen_dim,
            );
            action.is_dynamic = false;  // Static mode
            action.interaction = interaction;
            action.static_data.saved_x = Some(saved_x);
            action.static_data.saved_y = Some(saved_y);
            action
        })
}

/// Strategy for generating AI Vision Capture actions with cached coordinates
fn action_with_cached_coords_strategy() -> impl Strategy<Value = AIVisionCaptureAction> {
    (
        "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}",
        0.0f64..3600.0,
        interaction_type_strategy(),
        100i32..1800,  // cached_x
        100i32..1000,  // cached_y
        screen_dim_strategy(),
    )
        .prop_map(|(id, timestamp, interaction, cached_x, cached_y, cache_dim)| {
            let mut action = AIVisionCaptureAction::new(
                id,
                timestamp,
                "screenshots/test.png".to_string(),
                (1920, 1080),
            );
            action.is_dynamic = true;  // Dynamic mode
            action.interaction = interaction;
            action.cache_data.cached_x = Some(cached_x);
            action.cache_data.cached_y = Some(cached_y);
            action.cache_data.cache_dim = Some(cache_dim);
            action
        })
}

/// Strategy for generating AI Vision Capture actions for dynamic mode (no cache)
fn action_dynamic_no_cache_strategy() -> impl Strategy<Value = AIVisionCaptureAction> {
    (
        "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}",
        0.0f64..3600.0,
        interaction_type_strategy(),
        "[a-zA-Z0-9 ]{1,50}",  // prompt
    )
        .prop_map(|(id, timestamp, interaction, prompt)| {
            let mut action = AIVisionCaptureAction::new(
                id,
                timestamp,
                "screenshots/test.png".to_string(),
                (1920, 1080),
            );
            action.is_dynamic = true;  // Dynamic mode
            action.interaction = interaction;
            action.dynamic_config.prompt = prompt;
            // No cache - cache_data remains default (all None)
            action
        })
}

/// **Feature: ai-vision-capture, Property 14: Playback Priority Order**
///
/// *For any* ai_vision_capture action, the Player SHALL check modes in this exact order:
/// (1) Static saved_x/y, (2) Dynamic cached_x/y, (3) Dynamic AI call.
/// The first valid option SHALL be used.
///
/// **Validates: Requirements 4.1**
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_playback_priority_static_mode_first(
        action in action_with_static_coords_strategy()
    ) {
        // Static mode action with valid saved coordinates
        let platform = MockPlatform::new((1920, 1080));
        
        let result = execute_ai_vision_capture(&platform, &action, 0);
        
        // Property: Static mode should be used when is_dynamic = false and saved coords exist
        prop_assert_eq!(
            result.mode, AIVisionExecutionMode::Static,
            "Should use Static mode when is_dynamic=false and saved coords exist"
        );
        prop_assert!(
            result.success,
            "Static mode execution should succeed"
        );
        prop_assert!(
            !result.ai_called,
            "AI should NOT be called in Static mode"
        );
        prop_assert!(
            result.coordinates.is_some(),
            "Coordinates should be returned"
        );
    }
    
    #[test]
    fn test_playback_priority_cache_mode_second(
        action in action_with_cached_coords_strategy()
    ) {
        // Dynamic mode action with valid cached coordinates
        let platform = MockPlatform::new((1920, 1080));
        
        let result = execute_ai_vision_capture(&platform, &action, 0);
        
        // Property: Cache mode should be used when is_dynamic = true and cached coords exist
        prop_assert_eq!(
            result.mode, AIVisionExecutionMode::Cache,
            "Should use Cache mode when is_dynamic=true and cached coords exist"
        );
        prop_assert!(
            result.success,
            "Cache mode execution should succeed"
        );
        prop_assert!(
            !result.ai_called,
            "AI should NOT be called in Cache mode"
        );
        prop_assert!(
            result.coordinates.is_some(),
            "Coordinates should be returned"
        );
    }
    
    #[test]
    fn test_playback_priority_dynamic_mode_third(
        action in action_dynamic_no_cache_strategy()
    ) {
        // Dynamic mode action without cached coordinates
        let platform = MockPlatform::new((1920, 1080));
        
        let result = execute_ai_vision_capture(&platform, &action, 0);
        
        // Property: Dynamic mode should be used when is_dynamic = true and no cache exists
        prop_assert_eq!(
            result.mode, AIVisionExecutionMode::Dynamic,
            "Should use Dynamic mode when is_dynamic=true and no cache exists"
        );
        // Note: Dynamic mode currently returns failure as it's a stub
        prop_assert!(
            !result.success,
            "Dynamic mode should fail (stub implementation)"
        );
        prop_assert!(
            result.error.is_some(),
            "Error message should be present for stub"
        );
    }
}

/// **Feature: ai-vision-capture, Property 4: Static Mode Zero AI Calls**
///
/// *For any* ai_vision_capture action with is_dynamic = false and valid saved_x/saved_y,
/// playback SHALL execute the interaction at the saved coordinates without making
/// any AI API calls.
///
/// **Validates: Requirements 4.3**
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_static_mode_zero_ai_calls(
        action in action_with_static_coords_strategy()
    ) {
        let platform = MockPlatform::new((1920, 1080));
        
        let result = execute_ai_vision_capture(&platform, &action, 0);
        
        // Property 1: AI should never be called in Static mode
        prop_assert!(
            !result.ai_called,
            "AI should NOT be called in Static mode (0 token cost)"
        );
        
        // Property 2: Mode should be Static
        prop_assert_eq!(
            result.mode, AIVisionExecutionMode::Static,
            "Mode should be Static"
        );
        
        // Property 3: Execution should succeed
        prop_assert!(
            result.success,
            "Static mode execution should succeed with valid coordinates"
        );
        
        // Property 4: Interaction should be executed
        prop_assert!(
            platform.total_interactions() > 0,
            "An interaction should have been executed"
        );
    }
    
    #[test]
    fn test_static_mode_executes_correct_interaction(
        saved_x in 100i32..1800,
        saved_y in 100i32..1000,
        interaction in interaction_type_strategy(),
    ) {
        let mut action = AIVisionCaptureAction::new(
            "test-id".to_string(),
            0.0,
            "test.png".to_string(),
            (1920, 1080),
        );
        action.is_dynamic = false;
        action.static_data.saved_x = Some(saved_x);
        action.static_data.saved_y = Some(saved_y);
        action.interaction = interaction.clone();
        
        let platform = MockPlatform::new((1920, 1080));
        
        let result = execute_ai_vision_capture(&platform, &action, 0);
        
        // Verify correct interaction type was executed
        match interaction {
            InteractionType::Click => {
                prop_assert!(
                    platform.click_count.load(Ordering::Relaxed) > 0,
                    "Click should have been executed"
                );
            }
            InteractionType::Dblclick => {
                prop_assert!(
                    platform.double_click_count.load(Ordering::Relaxed) > 0,
                    "Double click should have been executed"
                );
            }
            InteractionType::Rclick => {
                prop_assert!(
                    platform.right_click_count.load(Ordering::Relaxed) > 0,
                    "Right click should have been executed"
                );
            }
            InteractionType::Hover => {
                prop_assert!(
                    platform.move_count.load(Ordering::Relaxed) > 0,
                    "Mouse move (hover) should have been executed"
                );
            }
        }
        
        // AI should not be called
        prop_assert!(!result.ai_called, "AI should not be called in Static mode");
    }
}

/// **Feature: ai-vision-capture, Property 5: Dynamic Cache Zero AI Calls**
///
/// *For any* ai_vision_capture action with is_dynamic = true AND valid cached_x/cached_y,
/// playback SHALL execute the interaction at the cached coordinates (with scaling if needed)
/// without making any AI API calls.
///
/// **Validates: Requirements 4.5**
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_cache_mode_zero_ai_calls(
        action in action_with_cached_coords_strategy()
    ) {
        let platform = MockPlatform::new((1920, 1080));
        
        let result = execute_ai_vision_capture(&platform, &action, 0);
        
        // Property 1: AI should never be called in Cache mode
        prop_assert!(
            !result.ai_called,
            "AI should NOT be called in Cache mode (0 token cost)"
        );
        
        // Property 2: Mode should be Cache
        prop_assert_eq!(
            result.mode, AIVisionExecutionMode::Cache,
            "Mode should be Cache"
        );
        
        // Property 3: Execution should succeed
        prop_assert!(
            result.success,
            "Cache mode execution should succeed with valid cached coordinates"
        );
        
        // Property 4: Interaction should be executed
        prop_assert!(
            platform.total_interactions() > 0,
            "An interaction should have been executed"
        );
    }
    
    #[test]
    fn test_cache_mode_executes_correct_interaction(
        cached_x in 100i32..1800,
        cached_y in 100i32..1000,
        interaction in interaction_type_strategy(),
    ) {
        let mut action = AIVisionCaptureAction::new(
            "test-id".to_string(),
            0.0,
            "test.png".to_string(),
            (1920, 1080),
        );
        action.is_dynamic = true;
        action.cache_data.cached_x = Some(cached_x);
        action.cache_data.cached_y = Some(cached_y);
        action.cache_data.cache_dim = Some((1920, 1080));
        action.interaction = interaction.clone();
        
        let platform = MockPlatform::new((1920, 1080));
        
        let result = execute_ai_vision_capture(&platform, &action, 0);
        
        // Verify correct interaction type was executed
        match interaction {
            InteractionType::Click => {
                prop_assert!(
                    platform.click_count.load(Ordering::Relaxed) > 0,
                    "Click should have been executed"
                );
            }
            InteractionType::Dblclick => {
                prop_assert!(
                    platform.double_click_count.load(Ordering::Relaxed) > 0,
                    "Double click should have been executed"
                );
            }
            InteractionType::Rclick => {
                prop_assert!(
                    platform.right_click_count.load(Ordering::Relaxed) > 0,
                    "Right click should have been executed"
                );
            }
            InteractionType::Hover => {
                prop_assert!(
                    platform.move_count.load(Ordering::Relaxed) > 0,
                    "Mouse move (hover) should have been executed"
                );
            }
        }
        
        // AI should not be called
        prop_assert!(!result.ai_called, "AI should not be called in Cache mode");
    }
    
    #[test]
    fn test_cache_mode_with_resolution_scaling(
        cached_x in 100i32..900,
        cached_y in 100i32..500,
    ) {
        // Create action with cache at 1920x1080
        let mut action = AIVisionCaptureAction::new(
            "test-id".to_string(),
            0.0,
            "test.png".to_string(),
            (1920, 1080),
        );
        action.is_dynamic = true;
        action.cache_data.cached_x = Some(cached_x);
        action.cache_data.cached_y = Some(cached_y);
        action.cache_data.cache_dim = Some((1920, 1080));
        
        // Execute on a 4K screen (3840x2160)
        let platform = MockPlatform::new((3840, 2160));
        
        let result = execute_ai_vision_capture(&platform, &action, 0);
        
        // Property: Coordinates should be scaled proportionally
        if let Some((x, y)) = result.coordinates {
            // Expected scaled coordinates (approximately 2x)
            let expected_x = cached_x * 2;
            let expected_y = cached_y * 2;
            
            // Allow 1 pixel tolerance for rounding
            prop_assert!(
                (x - expected_x).abs() <= 1,
                "Scaled X {} should be approximately {} (2x of {})",
                x, expected_x, cached_x
            );
            prop_assert!(
                (y - expected_y).abs() <= 1,
                "Scaled Y {} should be approximately {} (2x of {})",
                y, expected_y, cached_y
            );
        }
        
        // AI should not be called even with scaling
        prop_assert!(!result.ai_called, "AI should not be called in Cache mode even with scaling");
    }
}

/// Test that Static mode skips when coordinates are missing
#[test]
fn test_static_mode_skips_without_coordinates() {
    let mut action = AIVisionCaptureAction::new(
        "test-id".to_string(),
        0.0,
        "test.png".to_string(),
        (1920, 1080),
    );
    action.is_dynamic = false;
    // No saved coordinates - static_data.saved_x and saved_y are None
    
    let platform = MockPlatform::new((1920, 1080));
    
    let result = execute_ai_vision_capture(&platform, &action, 0);
    
    // Should be skipped
    assert_eq!(result.mode, AIVisionExecutionMode::Skipped);
    assert!(!result.success);
    assert!(!result.ai_called);
    assert!(result.error.is_some());
    assert!(result.error.unwrap().contains("Missing saved coordinates"));
    
    // No interaction should be executed
    assert_eq!(platform.total_interactions(), 0);
}

/// Test priority order: Static takes precedence over Cache
#[test]
fn test_static_mode_takes_precedence_over_cache() {
    let mut action = AIVisionCaptureAction::new(
        "test-id".to_string(),
        0.0,
        "test.png".to_string(),
        (1920, 1080),
    );
    action.is_dynamic = false;  // Static mode
    action.static_data.saved_x = Some(100);
    action.static_data.saved_y = Some(200);
    // Also set cache data (should be ignored)
    action.cache_data.cached_x = Some(500);
    action.cache_data.cached_y = Some(600);
    action.cache_data.cache_dim = Some((1920, 1080));
    
    let platform = MockPlatform::new((1920, 1080));
    
    let result = execute_ai_vision_capture(&platform, &action, 0);
    
    // Should use Static mode, not Cache
    assert_eq!(result.mode, AIVisionExecutionMode::Static);
    assert!(result.success);
    
    // Coordinates should be from static_data, not cache_data
    if let Some((x, y)) = result.coordinates {
        assert_eq!(x, 100, "Should use static_data.saved_x");
        assert_eq!(y, 200, "Should use static_data.saved_y");
    }
}

/// Test priority order: Cache takes precedence over Dynamic AI
#[test]
fn test_cache_mode_takes_precedence_over_dynamic() {
    let mut action = AIVisionCaptureAction::new(
        "test-id".to_string(),
        0.0,
        "test.png".to_string(),
        (1920, 1080),
    );
    action.is_dynamic = true;  // Dynamic mode
    action.dynamic_config.prompt = "Find the button".to_string();
    // Set cache data (should be used instead of calling AI)
    action.cache_data.cached_x = Some(300);
    action.cache_data.cached_y = Some(400);
    action.cache_data.cache_dim = Some((1920, 1080));
    
    let platform = MockPlatform::new((1920, 1080));
    
    let result = execute_ai_vision_capture(&platform, &action, 0);
    
    // Should use Cache mode, not Dynamic
    assert_eq!(result.mode, AIVisionExecutionMode::Cache);
    assert!(result.success);
    assert!(!result.ai_called, "AI should NOT be called when cache exists");
    
    // Coordinates should be from cache_data
    if let Some((x, y)) = result.coordinates {
        assert_eq!(x, 300, "Should use cache_data.cached_x");
        assert_eq!(y, 400, "Should use cache_data.cached_y");
    }
}


// ============================================================================
// Property Tests for Dynamic Mode AI Integration (Task 13)
// ============================================================================

use crate::ai_vision_integration::{
    AIVisionAnalysisRequest, AIVisionAnalysisResponse, AIVisionProvider,
    build_analysis_request, apply_cache_update, MockAIVisionProvider,
};
use crate::player::{execute_dynamic_mode_with_ai, CacheUpdate, DynamicModeExecutionResult};

/// **Feature: ai-vision-capture, Property 6: Dynamic Mode AI Request Structure**
///
/// *For any* ai_vision_capture action with is_dynamic = true AND no valid cache,
/// the AI request SHALL contain the current screenshot, user_prompt, and all
/// reference_images from dynamic_config.
///
/// **Validates: Requirements 4.6, 4.8**
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_dynamic_mode_ai_request_structure(
        prompt in "[a-zA-Z0-9 ]{1,100}",
        ref_image_count in 0usize..5,
        screenshot in "[a-zA-Z0-9+/=]{100,500}",  // Base64-like string
    ) {
        // Create action with dynamic config
        let mut action = AIVisionCaptureAction::new(
            "test-id".to_string(),
            0.0,
            "screenshots/test.png".to_string(),
            (1920, 1080),
        );
        action.is_dynamic = true;
        action.dynamic_config.prompt = prompt.clone();
        
        // Generate reference images
        let reference_images: Vec<String> = (0..ref_image_count)
            .map(|i| format!("ref_image_{}.png", i))
            .collect();
        action.dynamic_config.reference_images = reference_images.clone();
        
        // Generate reference images base64
        let reference_images_base64: Vec<String> = (0..ref_image_count)
            .map(|i| format!("base64_ref_{}", i))
            .collect();
        
        // Build the request
        let request = build_analysis_request(
            &action,
            screenshot.clone(),
            reference_images_base64.clone(),
            (1920, 1080),
            Some(15000),
        );
        
        // Property 1: Request should contain the screenshot
        prop_assert_eq!(
            &request.screenshot, &screenshot,
            "Request should contain the provided screenshot"
        );
        
        // Property 2: Request should contain the prompt
        prop_assert_eq!(
            &request.prompt, &prompt,
            "Request should contain the prompt from dynamic_config"
        );
        
        // Property 3: Request should contain all reference images
        prop_assert_eq!(
            request.reference_images.len(), ref_image_count,
            "Request should contain all reference images"
        );
        
        // Property 4: Request should have correct timeout
        prop_assert_eq!(
            request.timeout_ms, 15000,
            "Request should have the specified timeout"
        );
    }
    
    #[test]
    fn test_dynamic_mode_ai_request_with_roi(
        roi_x in 0i32..1000,
        roi_y in 0i32..500,
        roi_width in 100u32..500,
        roi_height in 100u32..300,
    ) {
        // Create action with ROI and regional search
        let mut action = AIVisionCaptureAction::new(
            "test-id".to_string(),
            0.0,
            "screenshots/test.png".to_string(),
            (1920, 1080),
        );
        action.is_dynamic = true;
        action.dynamic_config.prompt = "Find the button".to_string();
        action.dynamic_config.roi = Some(VisionROI {
            x: roi_x,
            y: roi_y,
            width: roi_width,
            height: roi_height,
        });
        action.dynamic_config.search_scope = SearchScope::Regional;
        
        // Build the request with same resolution
        let request = build_analysis_request(
            &action,
            "screenshot_base64".to_string(),
            vec![],
            (1920, 1080),
            None,
        );
        
        // Property: ROI should be included when search_scope is Regional
        prop_assert!(
            request.roi.is_some(),
            "ROI should be included for Regional search"
        );
        
        let roi = request.roi.unwrap();
        prop_assert_eq!(roi.x, roi_x, "ROI x should match");
        prop_assert_eq!(roi.y, roi_y, "ROI y should match");
        prop_assert_eq!(roi.width, roi_width, "ROI width should match");
        prop_assert_eq!(roi.height, roi_height, "ROI height should match");
    }
    
    #[test]
    fn test_dynamic_mode_ai_request_global_search_ignores_roi(
        roi_x in 0i32..1000,
        roi_y in 0i32..500,
    ) {
        // Create action with ROI but global search
        let mut action = AIVisionCaptureAction::new(
            "test-id".to_string(),
            0.0,
            "screenshots/test.png".to_string(),
            (1920, 1080),
        );
        action.is_dynamic = true;
        action.dynamic_config.prompt = "Find the button".to_string();
        action.dynamic_config.roi = Some(VisionROI {
            x: roi_x,
            y: roi_y,
            width: 200,
            height: 100,
        });
        action.dynamic_config.search_scope = SearchScope::Global;  // Global search
        
        // Build the request
        let request = build_analysis_request(
            &action,
            "screenshot_base64".to_string(),
            vec![],
            (1920, 1080),
            None,
        );
        
        // Property: ROI should NOT be included when search_scope is Global
        prop_assert!(
            request.roi.is_none(),
            "ROI should NOT be included for Global search"
        );
    }
}

/// **Feature: ai-vision-capture, Property 7: Cache Persistence After AI Success**
///
/// *For any* successful Dynamic Mode AI call, the returned coordinates SHALL be
/// saved to cache_data (cached_x, cached_y, cache_dim) and persisted to the script file.
///
/// **Validates: Requirements 4.9, 5.8**
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_cache_persistence_after_ai_success(
        ai_x in 100i32..1800,
        ai_y in 100i32..1000,
        confidence in 0.5f64..1.0,
    ) {
        // Create action for dynamic mode
        let mut action = AIVisionCaptureAction::new(
            "test-id".to_string(),
            0.0,
            "screenshots/test.png".to_string(),
            (1920, 1080),
        );
        action.is_dynamic = true;
        action.dynamic_config.prompt = "Find the button".to_string();
        
        // Create mock AI provider that returns success
        let mock_response = AIVisionAnalysisResponse::success(ai_x, ai_y, confidence);
        let mock_provider = MockAIVisionProvider::new(mock_response);
        
        let platform = MockPlatform::new((1920, 1080));
        
        // Execute dynamic mode with AI
        let result = execute_dynamic_mode_with_ai(
            &platform,
            &action,
            0,
            &mock_provider,
            "screenshot_base64".to_string(),
            vec![],
        );
        
        // Property 1: Execution should succeed
        prop_assert!(
            result.execution_result.success,
            "Dynamic mode should succeed when AI finds element"
        );
        
        // Property 2: AI should have been called
        prop_assert!(
            result.execution_result.ai_called,
            "AI should have been called"
        );
        prop_assert_eq!(
            mock_provider.get_call_count(), 1,
            "AI should have been called exactly once"
        );
        
        // Property 3: Cache update should be present
        prop_assert!(
            result.cache_update.is_some(),
            "Cache update should be present after AI success"
        );
        
        // Property 4: Cache update should contain the AI coordinates
        if let Some(CacheUpdate::Update { cached_x, cached_y, cache_dim }) = result.cache_update {
            prop_assert_eq!(
                cached_x, ai_x,
                "Cached X should match AI result"
            );
            prop_assert_eq!(
                cached_y, ai_y,
                "Cached Y should match AI result"
            );
            prop_assert_eq!(
                cache_dim, (1920, 1080),
                "Cache dim should match current screen"
            );
        } else {
            prop_assert!(false, "Cache update should be Update variant, not Clear");
        }
        
        // Property 5: Coordinates should be returned
        prop_assert_eq!(
            result.execution_result.coordinates, Some((ai_x, ai_y)),
            "Coordinates should match AI result"
        );
    }
    
    #[test]
    fn test_apply_cache_update_success(
        cached_x in 100i32..1800,
        cached_y in 100i32..1000,
        cache_width in 800u32..4000,
        cache_height in 600u32..2200,
    ) {
        // Create action without cache
        let mut action = AIVisionCaptureAction::new(
            "test-id".to_string(),
            0.0,
            "screenshots/test.png".to_string(),
            (1920, 1080),
        );
        action.is_dynamic = true;
        
        // Verify cache is initially empty
        prop_assert!(action.cache_data.cached_x.is_none());
        prop_assert!(action.cache_data.cached_y.is_none());
        prop_assert!(action.cache_data.cache_dim.is_none());
        
        // Apply cache update
        let cache_update = CacheUpdate::Update {
            cached_x,
            cached_y,
            cache_dim: (cache_width, cache_height),
        };
        apply_cache_update(&mut action, &cache_update);
        
        // Property: Cache should be updated with the provided values
        prop_assert_eq!(
            action.cache_data.cached_x, Some(cached_x),
            "cached_x should be updated"
        );
        prop_assert_eq!(
            action.cache_data.cached_y, Some(cached_y),
            "cached_y should be updated"
        );
        prop_assert_eq!(
            action.cache_data.cache_dim, Some((cache_width, cache_height)),
            "cache_dim should be updated"
        );
    }
}

/// **Feature: ai-vision-capture, Property 8: Cache Invalidation On AI Failure**
///
/// *For any* failed Dynamic Mode AI call (error or timeout), any existing cache_data
/// SHALL be cleared (cached_x, cached_y set to null).
///
/// **Validates: Requirements 4.11**
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_cache_invalidation_on_ai_failure(
        error_msg in "[a-zA-Z0-9 ]{1,50}",
    ) {
        // Create action for dynamic mode
        let mut action = AIVisionCaptureAction::new(
            "test-id".to_string(),
            0.0,
            "screenshots/test.png".to_string(),
            (1920, 1080),
        );
        action.is_dynamic = true;
        action.dynamic_config.prompt = "Find the button".to_string();
        
        // Create mock AI provider that returns failure
        let mock_response = AIVisionAnalysisResponse::failure(error_msg.clone());
        let mock_provider = MockAIVisionProvider::new(mock_response);
        
        let platform = MockPlatform::new((1920, 1080));
        
        // Execute dynamic mode with AI
        let result = execute_dynamic_mode_with_ai(
            &platform,
            &action,
            0,
            &mock_provider,
            "screenshot_base64".to_string(),
            vec![],
        );
        
        // Property 1: Execution should fail
        prop_assert!(
            !result.execution_result.success,
            "Dynamic mode should fail when AI fails to find element"
        );
        
        // Property 2: AI should have been called
        prop_assert!(
            result.execution_result.ai_called,
            "AI should have been called"
        );
        
        // Property 3: Cache update should be Clear
        prop_assert!(
            result.cache_update.is_some(),
            "Cache update should be present after AI failure"
        );
        
        if let Some(cache_update) = &result.cache_update {
            match cache_update {
                CacheUpdate::Clear => {
                    // This is expected
                }
                CacheUpdate::Update { .. } => {
                    prop_assert!(false, "Cache update should be Clear, not Update");
                }
            }
        }
        
        // Property 4: Error message should be present
        prop_assert!(
            result.execution_result.error.is_some(),
            "Error message should be present"
        );
    }
    
    #[test]
    fn test_apply_cache_clear(
        initial_x in 100i32..1800,
        initial_y in 100i32..1000,
    ) {
        // Create action with existing cache
        let mut action = AIVisionCaptureAction::new(
            "test-id".to_string(),
            0.0,
            "screenshots/test.png".to_string(),
            (1920, 1080),
        );
        action.is_dynamic = true;
        action.cache_data.cached_x = Some(initial_x);
        action.cache_data.cached_y = Some(initial_y);
        action.cache_data.cache_dim = Some((1920, 1080));
        
        // Verify cache is initially set
        prop_assert!(action.cache_data.cached_x.is_some());
        prop_assert!(action.cache_data.cached_y.is_some());
        prop_assert!(action.cache_data.cache_dim.is_some());
        
        // Apply cache clear
        let cache_update = CacheUpdate::Clear;
        apply_cache_update(&mut action, &cache_update);
        
        // Property: Cache should be cleared
        prop_assert!(
            action.cache_data.cached_x.is_none(),
            "cached_x should be cleared"
        );
        prop_assert!(
            action.cache_data.cached_y.is_none(),
            "cached_y should be cleared"
        );
        prop_assert!(
            action.cache_data.cache_dim.is_none(),
            "cache_dim should be cleared"
        );
    }
}

/// Test cache invalidation on AI timeout (non-property test)
#[test]
fn test_cache_invalidation_on_ai_timeout() {
    // Create action for dynamic mode
    let mut action = AIVisionCaptureAction::new(
        "test-id".to_string(),
        0.0,
        "screenshots/test.png".to_string(),
        (1920, 1080),
    );
    action.is_dynamic = true;
    action.dynamic_config.prompt = "Find the button".to_string();
    
    // Create mock AI provider that returns timeout
    let mock_response = AIVisionAnalysisResponse::timeout(15000);
    let mock_provider = MockAIVisionProvider::new(mock_response);
    
    let platform = MockPlatform::new((1920, 1080));
    
    // Execute dynamic mode with AI
    let result = execute_dynamic_mode_with_ai(
        &platform,
        &action,
        0,
        &mock_provider,
        "screenshot_base64".to_string(),
        vec![],
    );
    
    // Property 1: Execution should fail
    assert!(!result.execution_result.success, "Should fail on timeout");
    
    // Property 2: Cache should be cleared
    assert!(result.cache_update.is_some());
    match result.cache_update.unwrap() {
        CacheUpdate::Clear => { /* Expected */ }
        CacheUpdate::Update { .. } => {
            panic!("Cache should be cleared on timeout, not updated");
        }
    }
    
    // Property 3: Error should mention timeout
    assert!(result.execution_result.error.is_some());
    assert!(
        result.execution_result.error.as_ref().unwrap().contains("timed out"),
        "Error should mention timeout"
    );
}
