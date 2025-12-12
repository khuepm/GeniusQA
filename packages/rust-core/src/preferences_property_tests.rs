//! Property-based tests for core preference persistence
//! 
//! **Feature: rust-automation-core, Property 1: Core preference persistence**
//! **Validates: Requirements 1.2**

use crate::preferences::{PreferenceManager, CoreType, UserSettings, UIState, WindowGeometry};
use proptest::prelude::*;
use tempfile::TempDir;

/// Generate arbitrary CoreType values for property testing
impl Arbitrary for CoreType {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;
    
    fn arbitrary_with(_args: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            Just(CoreType::Python),
            Just(CoreType::Rust),
        ].boxed()
    }
}

/// Generate arbitrary WindowGeometry values for property testing
impl Arbitrary for WindowGeometry {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;
    
    fn arbitrary_with(_args: Self::Parameters) -> Self::Strategy {
        (
            -1000..2000i32,  // x position
            -1000..2000i32,  // y position
            100..3000u32,    // width
            100..2000u32,    // height
        ).prop_map(|(x, y, width, height)| WindowGeometry { x, y, width, height }).boxed()
    }
}

/// Generate arbitrary UIState values for property testing
impl Arbitrary for UIState {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;
    
    fn arbitrary_with(_args: Self::Parameters) -> Self::Strategy {
        (
            any::<bool>(),                                    // show_preview
            0.0..1.0f64,                                     // preview_opacity
            prop::option::of("[a-zA-Z0-9/._-]{1,100}"),      // last_recording_directory
            prop::option::of(any::<WindowGeometry>()),       // window_geometry
        ).prop_map(|(show_preview, preview_opacity, last_recording_directory, window_geometry)| {
            UIState {
                show_preview,
                preview_opacity,
                last_recording_directory,
                window_geometry,
            }
        }).boxed()
    }
}

/// Generate arbitrary UserSettings values for property testing
impl Arbitrary for UserSettings {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;
    
    fn arbitrary_with(_args: Self::Parameters) -> Self::Strategy {
        (
            0.1..10.0f64,                                    // playback_speed (reasonable range)
            0..100u32,                                       // loop_count
            prop::option::of("[a-zA-Z0-9/._-]{1,100}"),      // selected_script_path
            any::<UIState>(),                                // ui_state
        ).prop_map(|(playback_speed, loop_count, selected_script_path, ui_state)| {
            UserSettings {
                playback_speed,
                loop_count,
                selected_script_path,
                ui_state,
            }
        }).boxed()
    }
}

/// Create a temporary preference manager for testing
fn create_temp_preference_manager() -> (PreferenceManager, TempDir) {
    let temp_dir = TempDir::new().unwrap();
    let preferences_path = temp_dir.path().join("preferences.json");
    let manager = PreferenceManager::new(preferences_path).unwrap();
    (manager, temp_dir)
}

proptest! {
    /// **Feature: rust-automation-core, Property 1: Core preference persistence**
    /// **Validates: Requirements 1.2**
    /// 
    /// Property: For any core selection made by the user, the system should persist 
    /// this preference and use it consistently for all subsequent automation operations until changed.
    /// 
    /// This test verifies that:
    /// 1. When a user selects a core type, it is immediately persisted
    /// 2. The preference survives across different PreferenceManager instances (simulating app restarts)
    /// 3. The persisted preference is used consistently until explicitly changed
    /// 4. Multiple preference changes are handled correctly
    #[test]
    fn property_core_preference_persistence(
        initial_core in any::<CoreType>(),
        subsequent_cores in prop::collection::vec(any::<CoreType>(), 0..10)
    ) {
        let temp_dir = TempDir::new().unwrap();
        let preferences_path = temp_dir.path().join("preferences.json");
        
        // Test 1: Initial core selection persistence
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            
            // Set the initial core preference
            manager.set_preferred_core(initial_core).unwrap();
            
            // Verify it's immediately available
            prop_assert_eq!(manager.get_preferred_core(), initial_core);
        }
        
        // Test 2: Preference survives across manager instances (simulating app restart)
        {
            let manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            
            // Verify the preference was persisted and loaded correctly
            prop_assert_eq!(manager.get_preferred_core(), initial_core);
        }
        
        // Test 3: Multiple preference changes are handled correctly
        let mut expected_core = initial_core;
        for &new_core in &subsequent_cores {
            {
                let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
                
                // Change the preference
                manager.set_preferred_core(new_core).unwrap();
                expected_core = new_core;
                
                // Verify immediate consistency
                prop_assert_eq!(manager.get_preferred_core(), expected_core);
            }
            
            // Verify persistence across restart
            {
                let manager = PreferenceManager::new(preferences_path.clone()).unwrap();
                prop_assert_eq!(manager.get_preferred_core(), expected_core);
            }
        }
        
        // Test 4: Final verification - the last set preference should be active
        {
            let manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            prop_assert_eq!(manager.get_preferred_core(), expected_core);
        }
    }
    
    /// **Feature: rust-automation-core, Property 1: Core preference persistence (Consistency)**
    /// **Validates: Requirements 1.2**
    /// 
    /// Property: The system should use the persisted preference consistently across 
    /// multiple operations without the preference changing unexpectedly.
    /// 
    /// This test verifies that:
    /// 1. Reading the preference multiple times returns the same value
    /// 2. The preference doesn't change unless explicitly set
    /// 3. Concurrent access (simulated) maintains consistency
    #[test]
    fn property_core_preference_consistency(
        core_type in any::<CoreType>(),
        read_count in 1..100usize
    ) {
        let (mut manager, _temp_dir) = create_temp_preference_manager();
        
        // Set the preference
        manager.set_preferred_core(core_type).unwrap();
        
        // Read the preference multiple times and verify consistency
        for _ in 0..read_count {
            prop_assert_eq!(manager.get_preferred_core(), core_type);
        }
        
        // Verify that the preference file contains the correct value
        let preferences_path = manager.preferences_path.clone();
        let new_manager = PreferenceManager::new(preferences_path).unwrap();
        prop_assert_eq!(new_manager.get_preferred_core(), core_type);
    }
    
    /// **Feature: rust-automation-core, Property 1: Core preference persistence (Fallback)**
    /// **Validates: Requirements 1.2**
    /// 
    /// Property: The last working core preference should be maintained separately 
    /// from the preferred core and should persist correctly.
    #[test]
    fn property_last_working_core_persistence(
        preferred_core in any::<CoreType>(),
        working_core in any::<CoreType>()
    ) {
        let temp_dir = TempDir::new().unwrap();
        let preferences_path = temp_dir.path().join("preferences.json");
        
        // Set both preferred and last working core
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.set_preferred_core(preferred_core).unwrap();
            manager.set_last_working_core(working_core).unwrap();
            
            // Verify both are set correctly
            prop_assert_eq!(manager.get_preferred_core(), preferred_core);
            prop_assert_eq!(manager.get_last_working_core(), Some(working_core));
        }
        
        // Verify persistence across restart
        {
            let manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            prop_assert_eq!(manager.get_preferred_core(), preferred_core);
            prop_assert_eq!(manager.get_last_working_core(), Some(working_core));
        }
    }
    
    /// **Feature: rust-automation-core, Property 1: Core preference persistence (Settings)**
    /// **Validates: Requirements 1.2**
    /// 
    /// Property: All preference settings (not just core type) should persist correctly.
    #[test]
    fn property_all_preferences_persistence(
        core_type in any::<CoreType>(),
        fallback_enabled in any::<bool>(),
        performance_tracking in any::<bool>(),
        auto_detection in any::<bool>()
    ) {
        let temp_dir = TempDir::new().unwrap();
        let preferences_path = temp_dir.path().join("preferences.json");
        
        // Set all preferences
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.set_preferred_core(core_type).unwrap();
            manager.set_fallback_enabled(fallback_enabled).unwrap();
            manager.set_performance_tracking(performance_tracking).unwrap();
            manager.set_auto_detection(auto_detection).unwrap();
            
            // Verify all are set correctly
            prop_assert_eq!(manager.get_preferred_core(), core_type);
            prop_assert_eq!(manager.is_fallback_enabled(), fallback_enabled);
            prop_assert_eq!(manager.is_performance_tracking_enabled(), performance_tracking);
            prop_assert_eq!(manager.is_auto_detection_enabled(), auto_detection);
        }
        
        // Verify all persist across restart
        {
            let manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            prop_assert_eq!(manager.get_preferred_core(), core_type);
            prop_assert_eq!(manager.is_fallback_enabled(), fallback_enabled);
            prop_assert_eq!(manager.is_performance_tracking_enabled(), performance_tracking);
            prop_assert_eq!(manager.is_auto_detection_enabled(), auto_detection);
        }
    }
    
    /// **Feature: rust-automation-core, Property 1: Core preference persistence (User Settings)**
    /// **Validates: Requirements 1.2**
    /// 
    /// Property: User settings (playback speed, loop count, script selection, UI state) 
    /// should persist correctly across application restarts and core switches.
    #[test]
    fn property_user_settings_persistence(
        user_settings in any::<UserSettings>()
    ) {
        let temp_dir = TempDir::new().unwrap();
        let preferences_path = temp_dir.path().join("preferences.json");
        
        // Set user settings
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.update_user_settings(user_settings.clone()).unwrap();
            
            // Verify settings are immediately available
            let retrieved_settings = manager.get_user_settings();
            // Use tolerance for floating point comparisons due to JSON serialization precision
            prop_assert!((retrieved_settings.playback_speed - user_settings.playback_speed).abs() < 0.0001);
            prop_assert_eq!(retrieved_settings.loop_count, user_settings.loop_count);
            prop_assert_eq!(&retrieved_settings.selected_script_path, &user_settings.selected_script_path);
            prop_assert_eq!(retrieved_settings.ui_state.show_preview, user_settings.ui_state.show_preview);
            prop_assert!((retrieved_settings.ui_state.preview_opacity - user_settings.ui_state.preview_opacity).abs() < 0.0001);
        }
        
        // Verify persistence across restart
        {
            let manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            let retrieved_settings = manager.get_user_settings();
            
            // Use tolerance for floating point comparisons due to JSON serialization precision
            prop_assert!((retrieved_settings.playback_speed - user_settings.playback_speed).abs() < 0.0001);
            prop_assert_eq!(retrieved_settings.loop_count, user_settings.loop_count);
            prop_assert_eq!(&retrieved_settings.selected_script_path, &user_settings.selected_script_path);
            prop_assert_eq!(retrieved_settings.ui_state.show_preview, user_settings.ui_state.show_preview);
            prop_assert!((retrieved_settings.ui_state.preview_opacity - user_settings.ui_state.preview_opacity).abs() < 0.0001);
            prop_assert_eq!(&retrieved_settings.ui_state.last_recording_directory, &user_settings.ui_state.last_recording_directory);
        }
    }
    
    /// **Feature: rust-automation-core, Property 1: Core preference persistence (Individual Settings)**
    /// **Validates: Requirements 1.2**
    /// 
    /// Property: Individual user setting updates should persist correctly without affecting other settings.
    #[test]
    fn property_individual_settings_persistence(
        initial_settings in any::<UserSettings>(),
        new_speed in 0.1..10.0f64,
        new_loop_count in 0..100u32,
        new_script_path in prop::option::of("[a-zA-Z0-9/._-]{1,100}"),
        new_show_preview in any::<bool>(),
        new_opacity in 0.0..1.0f64
    ) {
        let temp_dir = TempDir::new().unwrap();
        let preferences_path = temp_dir.path().join("preferences.json");
        
        // Set initial settings
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.update_user_settings(initial_settings.clone()).unwrap();
        }
        
        // Update playback speed and verify other settings are preserved
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.set_playback_speed(new_speed).unwrap();
            
            let settings = manager.get_user_settings();
            prop_assert!((settings.playback_speed - new_speed).abs() < 0.0001);
            prop_assert_eq!(settings.loop_count, initial_settings.loop_count);
            prop_assert_eq!(&settings.selected_script_path, &initial_settings.selected_script_path);
        }
        
        // Update loop count and verify other settings are preserved
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.set_loop_count(new_loop_count).unwrap();
            
            let settings = manager.get_user_settings();
            prop_assert!((settings.playback_speed - new_speed).abs() < 0.0001); // Should still be the updated value
            prop_assert_eq!(settings.loop_count, new_loop_count);
            prop_assert_eq!(&settings.selected_script_path, &initial_settings.selected_script_path);
        }
        
        // Update script path and verify other settings are preserved
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.set_selected_script_path(new_script_path.clone()).unwrap();
            
            let settings = manager.get_user_settings();
            prop_assert!((settings.playback_speed - new_speed).abs() < 0.0001);
            prop_assert_eq!(settings.loop_count, new_loop_count);
            prop_assert_eq!(&settings.selected_script_path, &new_script_path);
        }
        
        // Update UI settings and verify other settings are preserved
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.set_show_preview(new_show_preview).unwrap();
            manager.set_preview_opacity(new_opacity).unwrap();
            
            let settings = manager.get_user_settings();
            prop_assert!((settings.playback_speed - new_speed).abs() < 0.0001);
            prop_assert_eq!(settings.loop_count, new_loop_count);
            prop_assert_eq!(&settings.selected_script_path, &new_script_path);
            prop_assert_eq!(settings.ui_state.show_preview, new_show_preview);
            prop_assert!((settings.ui_state.preview_opacity - new_opacity).abs() < 0.0001);
        }
        
        // Verify all changes persist across restart
        {
            let manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            let settings = manager.get_user_settings();
            
            prop_assert!((settings.playback_speed - new_speed).abs() < 0.0001);
            prop_assert_eq!(settings.loop_count, new_loop_count);
            prop_assert_eq!(&settings.selected_script_path, &new_script_path);
            prop_assert_eq!(settings.ui_state.show_preview, new_show_preview);
            prop_assert!((settings.ui_state.preview_opacity - new_opacity).abs() < 0.0001);
        }
    }
    
    /// **Feature: rust-automation-core, Property 1: Core preference persistence (Backup/Restore)**
    /// **Validates: Requirements 1.2**
    /// 
    /// Property: Settings backup and restore functionality should work correctly,
    /// preserving all user settings exactly.
    #[test]
    fn property_settings_backup_restore(
        original_settings in any::<UserSettings>(),
        modified_settings in any::<UserSettings>()
    ) {
        let (mut manager, _temp_dir) = create_temp_preference_manager();
        
        // Set original settings
        manager.update_user_settings(original_settings.clone()).unwrap();
        
        // Create backup
        let backup = manager.backup_settings();
        
        // Verify backup matches original
        prop_assert_eq!(backup.playback_speed, original_settings.playback_speed);
        prop_assert_eq!(backup.loop_count, original_settings.loop_count);
        prop_assert_eq!(&backup.selected_script_path, &original_settings.selected_script_path);
        prop_assert_eq!(backup.ui_state.show_preview, original_settings.ui_state.show_preview);
        
        // Modify settings
        manager.update_user_settings(modified_settings.clone()).unwrap();
        
        // Verify settings changed
        let current_settings = manager.get_user_settings();
        prop_assert_eq!(current_settings.playback_speed, modified_settings.playback_speed);
        prop_assert_eq!(current_settings.loop_count, modified_settings.loop_count);
        
        // Restore from backup
        manager.restore_settings(backup.clone()).unwrap();
        
        // Verify restoration
        let restored_settings = manager.get_user_settings();
        prop_assert_eq!(restored_settings.playback_speed, original_settings.playback_speed);
        prop_assert_eq!(restored_settings.loop_count, original_settings.loop_count);
        prop_assert_eq!(&restored_settings.selected_script_path, &original_settings.selected_script_path);
        prop_assert_eq!(restored_settings.ui_state.show_preview, original_settings.ui_state.show_preview);
        prop_assert!((restored_settings.ui_state.preview_opacity - original_settings.ui_state.preview_opacity).abs() < 0.001);
    }
    
    /// **Feature: rust-automation-core, Property 24: User preference preservation during migration**
    /// **Validates: Requirements 7.4**
    /// 
    /// Property: For any core switching operation, all user preferences for playback speed, 
    /// looping, and other settings should be preserved.
    /// 
    /// This test verifies that:
    /// 1. When switching from one core to another, all user settings remain unchanged
    /// 2. Playback speed, loop count, script selection, and UI state are preserved
    /// 3. Settings persist across the core switch operation
    /// 4. Multiple core switches preserve settings correctly
    #[test]
    fn property_user_preference_preservation_during_migration(
        initial_core in any::<CoreType>(),
        target_cores in prop::collection::vec(any::<CoreType>(), 1..10),
        user_settings in any::<UserSettings>()
    ) {
        let temp_dir = TempDir::new().unwrap();
        let preferences_path = temp_dir.path().join("preferences.json");
        
        // Set initial core and user settings
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.set_preferred_core(initial_core).unwrap();
            manager.update_user_settings(user_settings.clone()).unwrap();
            
            // Verify initial state
            prop_assert_eq!(manager.get_preferred_core(), initial_core);
            let settings = manager.get_user_settings();
            prop_assert!((settings.playback_speed - user_settings.playback_speed).abs() < 0.0001);
            prop_assert_eq!(settings.loop_count, user_settings.loop_count);
            prop_assert_eq!(&settings.selected_script_path, &user_settings.selected_script_path);
        }
        
        // Perform multiple core switches and verify settings are preserved
        for &target_core in &target_cores {
            {
                let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
                
                // Switch core
                manager.set_preferred_core(target_core).unwrap();
                
                // Verify core changed
                prop_assert_eq!(manager.get_preferred_core(), target_core);
                
                // Verify user settings are preserved
                let settings = manager.get_user_settings();
                prop_assert!(
                    (settings.playback_speed - user_settings.playback_speed).abs() < 0.0001,
                    "Playback speed changed during core switch: expected {}, got {}",
                    user_settings.playback_speed,
                    settings.playback_speed
                );
                prop_assert_eq!(
                    settings.loop_count,
                    user_settings.loop_count,
                    "Loop count changed during core switch"
                );
                prop_assert_eq!(
                    &settings.selected_script_path,
                    &user_settings.selected_script_path,
                    "Script path changed during core switch"
                );
                prop_assert_eq!(
                    settings.ui_state.show_preview,
                    user_settings.ui_state.show_preview,
                    "Show preview setting changed during core switch"
                );
                prop_assert!(
                    (settings.ui_state.preview_opacity - user_settings.ui_state.preview_opacity).abs() < 0.0001,
                    "Preview opacity changed during core switch"
                );
                prop_assert_eq!(
                    &settings.ui_state.last_recording_directory,
                    &user_settings.ui_state.last_recording_directory,
                    "Last recording directory changed during core switch"
                );
            }
            
            // Verify persistence across restart after core switch
            {
                let manager = PreferenceManager::new(preferences_path.clone()).unwrap();
                
                // Verify core is still the target core
                prop_assert_eq!(manager.get_preferred_core(), target_core);
                
                // Verify user settings are still preserved
                let settings = manager.get_user_settings();
                prop_assert!((settings.playback_speed - user_settings.playback_speed).abs() < 0.0001);
                prop_assert_eq!(settings.loop_count, user_settings.loop_count);
                prop_assert_eq!(&settings.selected_script_path, &user_settings.selected_script_path);
                prop_assert_eq!(settings.ui_state.show_preview, user_settings.ui_state.show_preview);
                prop_assert!((settings.ui_state.preview_opacity - user_settings.ui_state.preview_opacity).abs() < 0.0001);
            }
        }
    }
    
    /// **Feature: rust-automation-core, Property 24: User preference preservation during migration (Individual Settings)**
    /// **Validates: Requirements 7.4**
    /// 
    /// Property: For any core switching operation, individual user settings should be preserved
    /// independently, even when only some settings are modified before the switch.
    #[test]
    fn property_individual_settings_preservation_during_migration(
        initial_core in any::<CoreType>(),
        target_core in any::<CoreType>(),
        playback_speed in 0.1..10.0f64,
        loop_count in 0..100u32,
        script_path in prop::option::of("[a-zA-Z0-9/._-]{1,100}"),
        show_preview in any::<bool>(),
        preview_opacity in 0.0..1.0f64
    ) {
        let temp_dir = TempDir::new().unwrap();
        let preferences_path = temp_dir.path().join("preferences.json");
        
        // Set initial core and individual settings
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.set_preferred_core(initial_core).unwrap();
            manager.set_playback_speed(playback_speed).unwrap();
            manager.set_loop_count(loop_count).unwrap();
            manager.set_selected_script_path(script_path.clone()).unwrap();
            manager.set_show_preview(show_preview).unwrap();
            manager.set_preview_opacity(preview_opacity).unwrap();
        }
        
        // Switch core
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.set_preferred_core(target_core).unwrap();
            
            // Verify core changed
            prop_assert_eq!(manager.get_preferred_core(), target_core);
            
            // Verify all individual settings are preserved
            let settings = manager.get_user_settings();
            prop_assert!(
                (settings.playback_speed - playback_speed).abs() < 0.0001,
                "Playback speed not preserved during core switch"
            );
            prop_assert_eq!(settings.loop_count, loop_count, "Loop count not preserved");
            prop_assert_eq!(&settings.selected_script_path, &script_path, "Script path not preserved");
            prop_assert_eq!(settings.ui_state.show_preview, show_preview, "Show preview not preserved");
            prop_assert!(
                (settings.ui_state.preview_opacity - preview_opacity).abs() < 0.0001,
                "Preview opacity not preserved"
            );
        }
        
        // Verify persistence after restart
        {
            let manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            
            prop_assert_eq!(manager.get_preferred_core(), target_core);
            let settings = manager.get_user_settings();
            prop_assert!((settings.playback_speed - playback_speed).abs() < 0.0001);
            prop_assert_eq!(settings.loop_count, loop_count);
            prop_assert_eq!(&settings.selected_script_path, &script_path);
            prop_assert_eq!(settings.ui_state.show_preview, show_preview);
            prop_assert!((settings.ui_state.preview_opacity - preview_opacity).abs() < 0.0001);
        }
    }
    
    /// **Feature: rust-automation-core, Property 24: User preference preservation during migration (Rapid Switching)**
    /// **Validates: Requirements 7.4**
    /// 
    /// Property: For any sequence of rapid core switches, user settings should remain
    /// consistent and not be corrupted or lost.
    #[test]
    fn property_settings_preservation_during_rapid_switching(
        core_sequence in prop::collection::vec(any::<CoreType>(), 5..20),
        user_settings in any::<UserSettings>()
    ) {
        let temp_dir = TempDir::new().unwrap();
        let preferences_path = temp_dir.path().join("preferences.json");
        
        // Set initial user settings
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.update_user_settings(user_settings.clone()).unwrap();
        }
        
        // Perform rapid core switches
        for &core_type in &core_sequence {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.set_preferred_core(core_type).unwrap();
            
            // Verify settings are preserved after each switch
            let settings = manager.get_user_settings();
            prop_assert!(
                (settings.playback_speed - user_settings.playback_speed).abs() < 0.0001,
                "Settings corrupted during rapid switching"
            );
            prop_assert_eq!(settings.loop_count, user_settings.loop_count);
            prop_assert_eq!(&settings.selected_script_path, &user_settings.selected_script_path);
        }
        
        // Final verification after all switches
        {
            let manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            let settings = manager.get_user_settings();
            
            prop_assert!((settings.playback_speed - user_settings.playback_speed).abs() < 0.0001);
            prop_assert_eq!(settings.loop_count, user_settings.loop_count);
            prop_assert_eq!(&settings.selected_script_path, &user_settings.selected_script_path);
            prop_assert_eq!(settings.ui_state.show_preview, user_settings.ui_state.show_preview);
            prop_assert!((settings.ui_state.preview_opacity - user_settings.ui_state.preview_opacity).abs() < 0.0001);
        }
    }
    
    /// **Feature: rust-automation-core, Property 24: User preference preservation during migration (UI State)**
    /// **Validates: Requirements 7.4**
    /// 
    /// Property: For any core switching operation, UI state (window geometry, preview settings,
    /// last directories) should be preserved completely.
    #[test]
    fn property_ui_state_preservation_during_migration(
        initial_core in any::<CoreType>(),
        target_core in any::<CoreType>(),
        ui_state in any::<UIState>()
    ) {
        let temp_dir = TempDir::new().unwrap();
        let preferences_path = temp_dir.path().join("preferences.json");
        
        // Set initial core and UI state
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.set_preferred_core(initial_core).unwrap();
            manager.set_ui_state(ui_state.clone()).unwrap();
        }
        
        // Switch core
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.set_preferred_core(target_core).unwrap();
            
            // Verify UI state is preserved
            let settings = manager.get_user_settings();
            prop_assert_eq!(settings.ui_state.show_preview, ui_state.show_preview);
            prop_assert!((settings.ui_state.preview_opacity - ui_state.preview_opacity).abs() < 0.0001);
            prop_assert_eq!(&settings.ui_state.last_recording_directory, &ui_state.last_recording_directory);
            
            // Verify window geometry if present
            if let Some(ref expected_geometry) = ui_state.window_geometry {
                let actual_geometry = settings.ui_state.window_geometry.as_ref()
                    .expect("Window geometry should be preserved");
                prop_assert_eq!(actual_geometry.x, expected_geometry.x);
                prop_assert_eq!(actual_geometry.y, expected_geometry.y);
                prop_assert_eq!(actual_geometry.width, expected_geometry.width);
                prop_assert_eq!(actual_geometry.height, expected_geometry.height);
            }
        }
        
        // Verify persistence after restart
        {
            let manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            let settings = manager.get_user_settings();
            
            prop_assert_eq!(settings.ui_state.show_preview, ui_state.show_preview);
            prop_assert!((settings.ui_state.preview_opacity - ui_state.preview_opacity).abs() < 0.0001);
            prop_assert_eq!(&settings.ui_state.last_recording_directory, &ui_state.last_recording_directory);
        }
    }
    
    /// **Feature: rust-automation-core, Property 24: User preference preservation during migration (Concurrent Modifications)**
    /// **Validates: Requirements 7.4**
    /// 
    /// Property: When core switching and settings updates happen in sequence,
    /// the final state should reflect all changes correctly without data loss.
    #[test]
    fn property_settings_preservation_with_concurrent_modifications(
        initial_core in any::<CoreType>(),
        target_core in any::<CoreType>(),
        initial_settings in any::<UserSettings>(),
        modified_speed in 0.1..10.0f64,
        modified_loop_count in 0..100u32
    ) {
        let temp_dir = TempDir::new().unwrap();
        let preferences_path = temp_dir.path().join("preferences.json");
        
        // Set initial state
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.set_preferred_core(initial_core).unwrap();
            manager.update_user_settings(initial_settings.clone()).unwrap();
        }
        
        // Modify settings, then switch core
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.set_playback_speed(modified_speed).unwrap();
            manager.set_loop_count(modified_loop_count).unwrap();
            manager.set_preferred_core(target_core).unwrap();
            
            // Verify both core change and settings modifications are preserved
            prop_assert_eq!(manager.get_preferred_core(), target_core);
            let settings = manager.get_user_settings();
            prop_assert!((settings.playback_speed - modified_speed).abs() < 0.0001);
            prop_assert_eq!(settings.loop_count, modified_loop_count);
            // Other settings should remain from initial_settings
            prop_assert_eq!(&settings.selected_script_path, &initial_settings.selected_script_path);
        }
        
        // Verify persistence
        {
            let manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            prop_assert_eq!(manager.get_preferred_core(), target_core);
            let settings = manager.get_user_settings();
            prop_assert!((settings.playback_speed - modified_speed).abs() < 0.0001);
            prop_assert_eq!(settings.loop_count, modified_loop_count);
            prop_assert_eq!(&settings.selected_script_path, &initial_settings.selected_script_path);
        }
    }
}

#[cfg(test)]
mod unit_tests {
    use super::*;
    
    #[test]
    fn test_property_test_setup() {
        // Verify that our test setup works correctly
        let (manager, _temp_dir) = create_temp_preference_manager();
        
        // Default should be Python core
        assert_eq!(manager.get_preferred_core(), CoreType::Python);
        
        // Should be able to create multiple managers
        let (manager2, _temp_dir2) = create_temp_preference_manager();
        assert_eq!(manager2.get_preferred_core(), CoreType::Python);
    }
    
    #[test]
    fn test_core_type_arbitrary() {
        // Test that our Arbitrary implementation for CoreType works
        let strategy = any::<CoreType>();
        let mut runner = proptest::test_runner::TestRunner::default();
        
        // Generate a few values to ensure it works
        for _ in 0..10 {
            let value = strategy.new_tree(&mut runner).unwrap().current();
            // Should be either Python or Rust
            assert!(matches!(value, CoreType::Python | CoreType::Rust));
        }
    }
}
