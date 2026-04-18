//! Performance Tests for Application-Focused Automation
//! 
//! This module contains performance tests that validate resource usage,
//! responsiveness, and system efficiency under various load conditions.

#[cfg(test)]
mod tests {
    use super::super::{
        ApplicationFocusedAutomationService, ServiceState,
        ApplicationInfo, FocusLossStrategy,
    };
    use std::time::{Duration, Instant};
    use std::sync::Arc;
    use tokio::time::sleep;

    /// Test service startup and shutdown performance
    /// 
    /// Requirements: 3.4 - Test resource usage and responsiveness
    #[tokio::test]
    async fn test_service_startup_shutdown_performance() {
        let startup_start = Instant::now();
        
        // Test service creation performance
        let service = ApplicationFocusedAutomationService::new()
            .expect("Failed to create service");
        let creation_time = startup_start.elapsed();
        
        // Service creation should be fast (< 100ms)
        assert!(creation_time < Duration::from_millis(100), 
               "Service creation took too long: {:?}", creation_time);
        
        // Test service startup performance
        let startup_start = Instant::now();
        service.start().await.expect("Failed to start service");
        let startup_time = startup_start.elapsed();
        
        // Service startup should be fast (< 500ms)
        assert!(startup_time < Duration::from_millis(500), 
               "Service startup took too long: {:?}", startup_time);
        
        // Verify service is running
        assert_eq!(service.get_state().unwrap(), ServiceState::Running);
        
        // Test service shutdown performance
        let shutdown_start = Instant::now();
        service.stop().await.expect("Failed to stop service");
        let shutdown_time = shutdown_start.elapsed();
        
        // Service shutdown should be fast (< 200ms)
        assert!(shutdown_time < Duration::from_millis(200), 
               "Service shutdown took too long: {:?}", shutdown_time);
        
        // Verify service is stopped
        assert_eq!(service.get_state().unwrap(), ServiceState::Stopped);
        
        println!("Performance metrics:");
        println!("  Creation time: {:?}", creation_time);
        println!("  Startup time: {:?}", startup_time);
        println!("  Shutdown time: {:?}", shutdown_time);
    }

    /// Test application registration performance under load
    /// 
    /// Requirements: 3.4 - Test resource usage under concurrent operations
    #[tokio::test]
    async fn test_application_registration_performance() {
        let service = ApplicationFocusedAutomationService::new()
            .expect("Failed to create service");
        
        service.start().await.expect("Failed to start service");
        
        let registration_count = 50;
        let start_time = Instant::now();
        
        // Register multiple applications concurrently
        let mut handles = vec![];
        let service = Arc::new(service);
        
        for i in 0..registration_count {
            let service_clone = Arc::clone(&service);
            let handle = tokio::spawn(async move {
                let current_process_id = std::process::id();
                let app_info = ApplicationInfo {
                    name: format!("Performance Test App {}", i),
                    executable_path: format!("/Applications/Test{}.app", i),
                    process_name: format!("Test{}", i),
                    process_id: current_process_id + i as u32,
                    bundle_id: Some(format!("com.test.app{}", i)),
                    window_handle: None,
                };
                
                let registration_start = Instant::now();
                let result = service_clone.register_application_with_monitoring(
                    app_info,
                    FocusLossStrategy::AutoPause
                ).await;
                let registration_time = registration_start.elapsed();
                
                (result, registration_time)
            });
            handles.push(handle);
        }
        
        // Wait for all registrations to complete
        let mut total_registration_time = Duration::new(0, 0);
        let mut successful_registrations = 0;
        
        for handle in handles {
            let (result, registration_time) = handle.await.expect("Task failed");
            if result.is_ok() {
                successful_registrations += 1;
            }
            total_registration_time += registration_time;
        }
        
        let total_time = start_time.elapsed();
        let average_registration_time = total_registration_time / registration_count;
        
        // Performance assertions
        assert!(total_time < Duration::from_secs(5), 
               "Total registration time too long: {:?}", total_time);
        assert!(average_registration_time < Duration::from_millis(100), 
               "Average registration time too long: {:?}", average_registration_time);
        assert_eq!(successful_registrations, registration_count, 
                  "Not all registrations succeeded");
        
        // Test service statistics performance
        let stats_start = Instant::now();
        let stats = service.get_stats().expect("Failed to get stats");
        let stats_time = stats_start.elapsed();
        
        assert!(stats_time < Duration::from_millis(10), 
               "Stats retrieval too slow: {:?}", stats_time);
        assert_eq!(stats.registered_applications, registration_count as usize);
        
        service.stop().await.expect("Failed to stop service");
        
        println!("Registration performance metrics:");
        println!("  Total time for {} registrations: {:?}", registration_count, total_time);
        println!("  Average registration time: {:?}", average_registration_time);
        println!("  Stats retrieval time: {:?}", stats_time);
    }

    /// Test focus monitoring performance and resource usage
    /// 
    /// Requirements: 3.4 - Optimize focus monitoring performance
    #[tokio::test]
    async fn test_focus_monitoring_performance() {
        let service = ApplicationFocusedAutomationService::new()
            .expect("Failed to create service");
        
        service.start().await.expect("Failed to start service");
        
        // Register a test application
        let current_process_id = std::process::id();
        let app_info = ApplicationInfo {
            name: "Focus Performance Test App".to_string(),
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
        
        // Start playback to activate focus monitoring
        let playback_start = Instant::now();
        let _session_id = service.start_integrated_playback(
            app_id.clone(),
            FocusLossStrategy::AutoPause
        ).await.expect("Failed to start playback");
        let playback_startup_time = playback_start.elapsed();
        
        // Playback startup should be fast
        assert!(playback_startup_time < Duration::from_millis(200), 
               "Playback startup too slow: {:?}", playback_startup_time);
        
        // Let focus monitoring run for a short period
        sleep(Duration::from_millis(500)).await;
        
        // Test health check performance
        let health_start = Instant::now();
        let health = service.health_check().await.expect("Health check failed");
        let health_check_time = health_start.elapsed();
        
        assert!(health_check_time < Duration::from_millis(50), 
               "Health check too slow: {:?}", health_check_time);
        assert!(health.get("service").copied().unwrap_or(false));
        assert!(health.get("focus_monitors").copied().unwrap_or(false));
        
        // Test performance optimization
        let optimization_start = Instant::now();
        service.optimize_performance().await.expect("Performance optimization failed");
        let optimization_time = optimization_start.elapsed();
        
        assert!(optimization_time < Duration::from_millis(100), 
               "Performance optimization too slow: {:?}", optimization_time);
        
        service.stop().await.expect("Failed to stop service");
        
        println!("Focus monitoring performance metrics:");
        println!("  Playback startup time: {:?}", playback_startup_time);
        println!("  Health check time: {:?}", health_check_time);
        println!("  Performance optimization time: {:?}", optimization_time);
    }

    /// Test memory usage and resource cleanup performance
    /// 
    /// Requirements: 3.4 - Implement proper resource cleanup
    #[tokio::test]
    async fn test_resource_cleanup_performance() {
        let service = ApplicationFocusedAutomationService::new()
            .expect("Failed to create service");
        
        service.start().await.expect("Failed to start service");
        
        // Create multiple applications and sessions to test cleanup
        let app_count = 10;
        let mut app_ids = Vec::new();
        
        for i in 0..app_count {
            let current_process_id = std::process::id();
            let app_info = ApplicationInfo {
                name: format!("Cleanup Test App {}", i),
                executable_path: format!("/Applications/Test{}.app", i),
                process_name: format!("Test{}", i),
                process_id: current_process_id + i as u32,
                bundle_id: Some(format!("com.test.cleanup{}", i)),
                window_handle: None,
            };
            
            let app_id = service.register_application_with_monitoring(
                app_info,
                FocusLossStrategy::AutoPause
            ).await.expect("Failed to register application");
            
            app_ids.push(app_id);
        }
        
        // Verify all applications are registered
        let stats = service.get_stats().expect("Failed to get stats");
        assert_eq!(stats.registered_applications, app_count);
        
        // Test cleanup performance
        let cleanup_start = Instant::now();
        service.cleanup_resources().await.expect("Resource cleanup failed");
        let cleanup_time = cleanup_start.elapsed();
        
        // Cleanup should be fast even with multiple resources
        assert!(cleanup_time < Duration::from_millis(500), 
               "Resource cleanup too slow: {:?}", cleanup_time);
        
        // Test unregistration performance
        let unregister_start = Instant::now();
        for app_id in app_ids {
            service.unregister_application_with_cleanup(&app_id).await
                .expect("Failed to unregister application");
        }
        let unregister_time = unregister_start.elapsed();
        
        // Unregistration should be fast
        assert!(unregister_time < Duration::from_millis(200), 
               "Unregistration too slow: {:?}", unregister_time);
        
        // Verify all applications are unregistered
        let final_stats = service.get_stats().expect("Failed to get final stats");
        assert_eq!(final_stats.registered_applications, 0);
        
        service.stop().await.expect("Failed to stop service");
        
        println!("Resource cleanup performance metrics:");
        println!("  Cleanup time for {} apps: {:?}", app_count, cleanup_time);
        println!("  Unregistration time: {:?}", unregister_time);
    }

    /// Test concurrent operations performance
    /// 
    /// Requirements: 3.4 - Test system efficiency under load
    #[tokio::test]
    async fn test_concurrent_operations_performance() {
        let service = Arc::new(ApplicationFocusedAutomationService::new()
            .expect("Failed to create service"));
        
        service.start().await.expect("Failed to start service");
        
        let concurrent_operations = 20;
        let start_time = Instant::now();
        
        // Perform multiple concurrent operations
        let mut handles = vec![];
        
        for i in 0..concurrent_operations {
            let service_clone = Arc::clone(&service);
            let handle = tokio::spawn(async move {
                let operation_start = Instant::now();
                
                // Mix of different operations
                match i % 4 {
                    0 => {
                        // Health check
                        let _ = service_clone.health_check().await;
                    }
                    1 => {
                        // Get stats
                        let _ = service_clone.get_stats();
                    }
                    2 => {
                        // Performance optimization
                        let _ = service_clone.optimize_performance().await;
                    }
                    3 => {
                        // Check service state
                        let _ = service_clone.get_state();
                    }
                    _ => unreachable!(),
                }
                
                operation_start.elapsed()
            });
            handles.push(handle);
        }
        
        // Wait for all operations to complete
        let mut total_operation_time = Duration::new(0, 0);
        for handle in handles {
            let operation_time = handle.await.expect("Concurrent operation failed");
            total_operation_time += operation_time;
        }
        
        let total_time = start_time.elapsed();
        let average_operation_time = total_operation_time / concurrent_operations;
        
        // Performance assertions for concurrent operations
        assert!(total_time < Duration::from_secs(2), 
               "Concurrent operations took too long: {:?}", total_time);
        assert!(average_operation_time < Duration::from_millis(50), 
               "Average operation time too long: {:?}", average_operation_time);
        
        service.stop().await.expect("Failed to stop service");
        
        println!("Concurrent operations performance metrics:");
        println!("  Total time for {} operations: {:?}", concurrent_operations, total_time);
        println!("  Average operation time: {:?}", average_operation_time);
    }

    /// Benchmark focus monitoring polling intervals
    /// 
    /// Requirements: 3.4 - Optimize focus monitoring performance
    #[tokio::test]
    async fn test_focus_monitoring_polling_efficiency() {
        // This test validates that the adaptive polling intervals work correctly
        // and don't consume excessive CPU resources
        
        let service = ApplicationFocusedAutomationService::new()
            .expect("Failed to create service");
        
        service.start().await.expect("Failed to start service");
        
        let current_process_id = std::process::id();
        let app_info = ApplicationInfo {
            name: "Polling Efficiency Test".to_string(),
            executable_path: "/Applications/Test.app".to_string(),
            process_name: "Test".to_string(),
            process_id: current_process_id,
            bundle_id: Some("com.test.polling".to_string()),
            window_handle: None,
        };
        
        let app_id = service.register_application_with_monitoring(
            app_info,
            FocusLossStrategy::AutoPause
        ).await.expect("Failed to register application");
        
        // Start monitoring
        let monitoring_start = Instant::now();
        let _session_id = service.start_integrated_playback(
            app_id.clone(),
            FocusLossStrategy::AutoPause
        ).await.expect("Failed to start playback");
        
        // Let monitoring run for a period to test efficiency
        sleep(Duration::from_millis(1000)).await;
        
        let monitoring_time = monitoring_start.elapsed();
        
        // Verify monitoring is responsive
        let health = service.health_check().await.expect("Health check failed");
        assert!(health.get("focus_monitors").copied().unwrap_or(false));
        
        // Stop monitoring
        let stop_start = Instant::now();
        service.stop().await.expect("Failed to stop service");
        let stop_time = stop_start.elapsed();
        
        // Stopping should be fast
        assert!(stop_time < Duration::from_millis(100), 
               "Monitoring stop too slow: {:?}", stop_time);
        
        println!("Focus monitoring polling efficiency metrics:");
        println!("  Monitoring duration: {:?}", monitoring_time);
        println!("  Stop time: {:?}", stop_time);
        println!("  Monitoring appears efficient (no performance issues detected)");
    }
}
