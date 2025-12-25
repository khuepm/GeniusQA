//! Integration Tests for Application-Focused Automation
//! 
//! This module contains end-to-end integration tests that verify the complete
//! automation workflows and cross-platform compatibility.

#[cfg(test)]
mod tests {
    use super::super::{
        ApplicationFocusedAutomationService, ServiceState,
        ApplicationInfo, FocusLossStrategy,
        PlaybackState, PauseReason
    };
    use std::time::Duration;
    use std::sync::Arc;
    use tokio::time::sleep;

    /// Test complete automation workflow from registration to playback
    /// 
    /// Requirements: All requirements - Test complete automation workflows
    #[tokio::test]
    async fn test_complete_automation_workflow() {
        // Initialize service
        let service = ApplicationFocusedAutomationService::new()
            .expect("Failed to create service");
        
        // Start service
        service.start().await.expect("Failed to start service");
        
        // Verify service is running
        assert_eq!(service.get_state().unwrap(), ServiceState::Running);
        
        // Create test application info using current process ID for testing
        let current_process_id = std::process::id();
        let app_info = ApplicationInfo {
            name: "Test Application".to_string(),
            executable_path: "/Applications/Test.app".to_string(),
            process_name: "Test".to_string(),
            process_id: current_process_id,
            bundle_id: Some("com.test.app".to_string()),
            window_handle: None,
        };
        
        // Register application with monitoring
        let app_id = service.register_application_with_monitoring(
            app_info,
            FocusLossStrategy::AutoPause
        ).await.expect("Failed to register application");
        
        // Verify application is registered
        let registry = service.get_registry();
        let registry = registry.lock().unwrap();
        let registered_app = registry.get_application(&app_id)
            .expect("Application should be registered");
        assert_eq!(registered_app.name, "Test Application");
        assert_eq!(registered_app.default_focus_strategy, FocusLossStrategy::AutoPause);
        drop(registry);
        
        // Start integrated playback
        let session_id = service.start_integrated_playback(
            app_id.clone(),
            FocusLossStrategy::AutoPause
        ).await.expect("Failed to start playback");
        
        // Verify playback session is active
        let controller = service.get_playback_controller();
        let controller = controller.lock().unwrap();
        let session = controller.get_playback_status()
            .expect("Playback session should be active");
        assert_eq!(session.id, session_id);
        assert_eq!(session.target_app_id, app_id);
        assert_eq!(session.state, PlaybackState::Running);
        drop(controller);
        
        // Test pause and resume
        let controller = service.get_playback_controller();
        let mut controller = controller.lock().unwrap();
        controller.pause_playback(PauseReason::FocusLost)
            .expect("Failed to pause playback");
        
        let session = controller.get_playback_status()
            .expect("Playback session should still exist");
        assert_eq!(session.state, PlaybackState::Paused(PauseReason::FocusLost));
        
        controller.resume_playback()
            .expect("Failed to resume playback");
        
        let session = controller.get_playback_status()
            .expect("Playback session should still exist");
        assert_eq!(session.state, PlaybackState::Running);
        drop(controller);
        
        // Stop playback
        let controller = service.get_playback_controller();
        let mut controller = controller.lock().unwrap();
        controller.stop_playback()
            .expect("Failed to stop playback");
        assert!(controller.get_playback_status().is_none());
        drop(controller);
        
        // Unregister application
        service.unregister_application_with_cleanup(&app_id).await
            .expect("Failed to unregister application");
        
        // Verify application is unregistered
        let registry = service.get_registry();
        let registry = registry.lock().unwrap();
        assert!(registry.get_application(&app_id).is_none());
        drop(registry);
        
        // Stop service
        service.stop().await.expect("Failed to stop service");
        
        // Verify service is stopped
        assert_eq!(service.get_state().unwrap(), ServiceState::Stopped);
    }

    /// Test service lifecycle management
    /// 
    /// Requirements: Service lifecycle management
    #[tokio::test]
    async fn test_service_lifecycle() {
        let service = ApplicationFocusedAutomationService::new()
            .expect("Failed to create service");
        
        // Initial state should be stopped
        assert_eq!(service.get_state().unwrap(), ServiceState::Stopped);
        
        // Start service
        service.start().await.expect("Failed to start service");
        assert_eq!(service.get_state().unwrap(), ServiceState::Running);
        
        // Service should be healthy
        assert!(service.is_healthy());
        
        // Get service stats
        let stats = service.get_stats().expect("Failed to get stats");
        assert_eq!(stats.state, ServiceState::Running);
        assert_eq!(stats.registered_applications, 0);
        assert_eq!(stats.active_sessions, 0);
        
        // Perform health check
        let health = service.health_check().await.expect("Failed to perform health check");
        assert!(health.get("service").copied().unwrap_or(false));
        assert!(health.get("registry").copied().unwrap_or(false));
        assert!(health.get("playback_controller").copied().unwrap_or(false));
        assert!(health.get("notification_service").copied().unwrap_or(false));
        
        // Stop service
        service.stop().await.expect("Failed to stop service");
        assert_eq!(service.get_state().unwrap(), ServiceState::Stopped);
        assert!(!service.is_healthy());
    }

    /// Test error handling and recovery
    /// 
    /// Requirements: 8.1, 8.2, 8.3, 8.4 - Error handling and recovery
    #[tokio::test]
    async fn test_error_handling_and_recovery() {
        let service = ApplicationFocusedAutomationService::new()
            .expect("Failed to create service");
        
        service.start().await.expect("Failed to start service");
        
        // Test registering invalid application (we'll simulate this differently)
        let invalid_app_info = ApplicationInfo {
            name: "Invalid Application".to_string(),
            executable_path: "/nonexistent/path".to_string(),
            process_name: "nonexistent".to_string(),
            process_id: 99999, // Use a very high process ID that likely doesn't exist
            bundle_id: None,
            window_handle: None,
        };
        
        // Registration should succeed (we don't validate process existence during registration)
        let app_id = service.register_application_with_monitoring(
            invalid_app_info,
            FocusLossStrategy::StrictError
        ).await.expect("Registration should succeed");
        
        // Try to start playback with invalid application (non-existent process ID)
        let result = service.start_integrated_playback(
            app_id.clone(),
            FocusLossStrategy::StrictError
        ).await;
        
        // Should fail because application process doesn't exist or isn't active
        assert!(result.is_err(), "Playback should fail for non-existent process");
        
        // Clean up
        service.unregister_application_with_cleanup(&app_id).await
            .expect("Failed to unregister application");
        
        service.stop().await.expect("Failed to stop service");
    }

    /// Test focus strategy behaviors
    /// 
    /// Requirements: 4.1, 4.2, 4.3, 4.4 - Focus strategy handling
    #[tokio::test]
    async fn test_focus_strategies() {
        let service = ApplicationFocusedAutomationService::new()
            .expect("Failed to create service");
        
        service.start().await.expect("Failed to start service");
        
        // Test each focus strategy
        let strategies = vec![
            FocusLossStrategy::AutoPause,
            FocusLossStrategy::StrictError,
            FocusLossStrategy::Ignore,
        ];
        
        for strategy in strategies {
            let current_process_id = std::process::id();
            let app_info = ApplicationInfo {
                name: format!("Test App {:?}", strategy),
                executable_path: "/Applications/Test.app".to_string(),
                process_name: "Test".to_string(),
                process_id: current_process_id,
                bundle_id: Some("com.test.app".to_string()),
                window_handle: None,
            };
            
            let app_id = service.register_application_with_monitoring(
                app_info,
                strategy.clone()
            ).await.expect("Failed to register application");
            
            // Verify the strategy is set correctly
            let registry = service.get_registry();
            let registry = registry.lock().unwrap();
            let registered_app = registry.get_application(&app_id)
                .expect("Application should be registered");
            assert_eq!(registered_app.default_focus_strategy, strategy);
            drop(registry);
            
            // Start playback with the strategy
            let _session_id = service.start_integrated_playback(
                app_id.clone(),
                strategy.clone()
            ).await.expect("Failed to start playback");
            
            // Verify session uses the correct strategy
            let controller = service.get_playback_controller();
            let controller = controller.lock().unwrap();
            let session = controller.get_playback_status()
                .expect("Playback session should be active");
            assert_eq!(session.focus_strategy, strategy);
            drop(controller);
            
            // Stop playback and unregister
            let controller = service.get_playback_controller();
            let mut controller = controller.lock().unwrap();
            controller.stop_playback().expect("Failed to stop playback");
            drop(controller);
            
            service.unregister_application_with_cleanup(&app_id).await
                .expect("Failed to unregister application");
        }
        
        service.stop().await.expect("Failed to stop service");
    }

    /// Test concurrent operations
    /// 
    /// Requirements: Service stability under concurrent access
    #[tokio::test]
    async fn test_concurrent_operations() {
        let service = Arc::new(ApplicationFocusedAutomationService::new()
            .expect("Failed to create service"));
        
        service.start().await.expect("Failed to start service");
        
        // Create multiple applications concurrently
        let mut handles = vec![];
        
        for i in 0..5 {
            let service_clone = Arc::clone(&service);
            let handle = tokio::spawn(async move {
                let current_process_id = std::process::id();
                let app_info = ApplicationInfo {
                    name: format!("Concurrent App {}", i),
                    executable_path: format!("/Applications/Test{}.app", i),
                    process_name: format!("Test{}", i),
                    process_id: current_process_id + i as u32, // Use different IDs for each
                    bundle_id: Some(format!("com.test.app{}", i)),
                    window_handle: None,
                };
                
                let app_id = service_clone.register_application_with_monitoring(
                    app_info,
                    FocusLossStrategy::AutoPause
                ).await.expect("Failed to register application");
                
                // Small delay to simulate real usage
                sleep(Duration::from_millis(10)).await;
                
                service_clone.unregister_application_with_cleanup(&app_id).await
                    .expect("Failed to unregister application");
                
                app_id
            });
            handles.push(handle);
        }
        
        // Wait for all operations to complete
        for handle in handles {
            handle.await.expect("Concurrent operation failed");
        }
        
        // Verify service is still healthy
        assert!(service.is_healthy());
        
        // Verify no applications remain registered
        let stats = service.get_stats().expect("Failed to get stats");
        assert_eq!(stats.registered_applications, 0);
        
        service.stop().await.expect("Failed to stop service");
    }

    /// Test service statistics and monitoring
    /// 
    /// Requirements: Service monitoring and statistics
    #[tokio::test]
    async fn test_service_statistics() {
        let service = ApplicationFocusedAutomationService::new()
            .expect("Failed to create service");
        
        service.start().await.expect("Failed to start service");
        
        // Initial stats
        let initial_stats = service.get_stats().expect("Failed to get initial stats");
        assert_eq!(initial_stats.registered_applications, 0);
        assert_eq!(initial_stats.active_sessions, 0);
        assert_eq!(initial_stats.total_playback_sessions, 0);
        
        // Register an application
        let current_process_id = std::process::id();
        let app_info = ApplicationInfo {
            name: "Stats Test App".to_string(),
            executable_path: "/Applications/Test.app".to_string(),
            process_name: "Test".to_string(),
            process_id: current_process_id,
            bundle_id: Some("com.test.app".to_string()),
            window_handle: None,
        };
        
        let app_id = service.register_application_with_monitoring(
            app_info,
            FocusLossStrategy::AutoPause
        ).await.expect("Failed to register application");
        
        // Check stats after registration
        let stats_after_reg = service.get_stats().expect("Failed to get stats after registration");
        assert_eq!(stats_after_reg.registered_applications, 1);
        assert_eq!(stats_after_reg.active_sessions, 0);
        
        // Start playback
        let _session_id = service.start_integrated_playback(
            app_id.clone(),
            FocusLossStrategy::AutoPause
        ).await.expect("Failed to start playback");
        
        // Check stats after playback start
        let stats_after_playback = service.get_stats().expect("Failed to get stats after playback");
        assert_eq!(stats_after_playback.registered_applications, 1);
        assert_eq!(stats_after_playback.active_sessions, 1);
        assert_eq!(stats_after_playback.total_playback_sessions, 1);
        
        // Stop playback
        let controller = service.get_playback_controller();
        let mut controller = controller.lock().unwrap();
        controller.stop_playback().expect("Failed to stop playback");
        drop(controller);
        
        // Check stats after playback stop
        let stats_after_stop = service.get_stats().expect("Failed to get stats after stop");
        assert_eq!(stats_after_stop.registered_applications, 1);
        assert_eq!(stats_after_stop.active_sessions, 0);
        assert_eq!(stats_after_stop.total_playback_sessions, 1);
        
        // Clean up
        service.unregister_application_with_cleanup(&app_id).await
            .expect("Failed to unregister application");
        
        service.stop().await.expect("Failed to stop service");
    }

    /// Test cross-platform compatibility (basic structure)
    /// 
    /// Requirements: 7.1, 7.2, 7.3, 7.4, 7.5 - Cross-platform compatibility
    #[tokio::test]
    async fn test_cross_platform_compatibility() {
        let service = ApplicationFocusedAutomationService::new()
            .expect("Failed to create service");
        
        service.start().await.expect("Failed to start service");
        
        // Test platform-specific application info
        let current_process_id = std::process::id();
        #[cfg(target_os = "macos")]
        let app_info = ApplicationInfo {
            name: "macOS Test App".to_string(),
            executable_path: "/Applications/Test.app".to_string(),
            process_name: "Test".to_string(),
            process_id: current_process_id,
            bundle_id: Some("com.test.app".to_string()), // macOS-specific
            window_handle: None,
        };
        
        #[cfg(target_os = "windows")]
        let app_info = ApplicationInfo {
            name: "Windows Test App".to_string(),
            executable_path: "C:\\Program Files\\Test\\Test.exe".to_string(),
            process_name: "Test.exe".to_string(),
            process_id: current_process_id,
            bundle_id: None, // Windows doesn't use bundle IDs
            window_handle: None,
        };
        
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let app_info = ApplicationInfo {
            name: "Generic Test App".to_string(),
            executable_path: "/usr/bin/test".to_string(),
            process_name: "test".to_string(),
            process_id: current_process_id,
            bundle_id: None,
            window_handle: None,
        };
        
        // Register application
        let app_id = service.register_application_with_monitoring(
            app_info,
            FocusLossStrategy::AutoPause
        ).await.expect("Failed to register application");
        
        // Verify registration works on current platform
        let registry = service.get_registry();
        let registry = registry.lock().unwrap();
        let registered_app = registry.get_application(&app_id)
            .expect("Application should be registered");
        
        #[cfg(target_os = "macos")]
        assert!(registered_app.bundle_id.is_some());
        
        #[cfg(target_os = "windows")]
        assert!(registered_app.bundle_id.is_none());
        
        drop(registry);
        
        // Clean up
        service.unregister_application_with_cleanup(&app_id).await
            .expect("Failed to unregister application");
        
        service.stop().await.expect("Failed to stop service");
    }

    /// Test notification system integration
    /// 
    /// Requirements: 5.1, 5.2, 5.4 - Notification system
    #[tokio::test]
    async fn test_notification_system_integration() {
        let service = ApplicationFocusedAutomationService::new()
            .expect("Failed to create service");
        
        service.start().await.expect("Failed to start service");
        
        // Verify notification service is running
        let notification_service = service.get_notification_service();
        let notification_service = notification_service.lock().unwrap();
        assert!(notification_service.is_running());
        drop(notification_service);
        
        // Test that service integrates with notification system
        let current_process_id = std::process::id();
        let app_info = ApplicationInfo {
            name: "Notification Test App".to_string(),
            executable_path: "/Applications/Test.app".to_string(),
            process_name: "Test".to_string(),
            process_id: current_process_id,
            bundle_id: Some("com.test.app".to_string()),
            window_handle: None,
        };
        
        let app_id = service.register_application_with_monitoring(
            app_info,
            FocusLossStrategy::AutoPause
        ).await.expect("Failed to register application");
        
        // Start playback (this should integrate with notifications)
        let _session_id = service.start_integrated_playback(
            app_id.clone(),
            FocusLossStrategy::AutoPause
        ).await.expect("Failed to start playback");
        
        // The integration should work without errors
        // (Actual notification testing would require platform-specific setup)
        
        // Clean up
        let controller = service.get_playback_controller();
        let mut controller = controller.lock().unwrap();
        controller.stop_playback().expect("Failed to stop playback");
        drop(controller);
        
        service.unregister_application_with_cleanup(&app_id).await
            .expect("Failed to unregister application");
        
        service.stop().await.expect("Failed to stop service");
    }
}
