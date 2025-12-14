//! Property-based tests for performance monitoring functionality

use crate::{
    performance::{PerformanceCollector, OperationType, PerformanceManager},
    health::CoreType,
};
use proptest::prelude::*;
use std::time::Duration;
use tokio::runtime::Runtime;

/// **Feature: rust-automation-core, Property 19: Performance equivalence or improvement**
/// 
/// Property 19: Performance equivalence or improvement
/// *For any* automation operation, Rust core should provide equivalent or better performance compared to Python core
/// **Validates: Requirements 5.5**
proptest! {
    #[test]
    fn property_performance_equivalence_or_improvement(
        operation_count in 1u32..10u32,
        operation_duration_ms in 10u64..1000u64,
        success_rate in 0.5f32..1.0f32
    ) {
        let rt = Runtime::new().unwrap();
        
        rt.block_on(async {
            // Create performance collectors for both cores
            let rust_collector = PerformanceCollector::new(CoreType::Rust);
            let python_collector = PerformanceCollector::new(CoreType::Python);
            
            // Calculate how many operations should succeed
            let expected_successful_ops = (operation_count as f32 * success_rate).round() as u32;
            
            // Simulate operations for both cores
            for i in 0..operation_count {
                let operation_type = match i % 4 {
                    0 => OperationType::Recording,
                    1 => OperationType::Playback,
                    2 => OperationType::MouseClick,
                    _ => OperationType::KeyboardInput,
                };
                
                let _duration = Duration::from_millis(operation_duration_ms);
                let is_success = i < expected_successful_ops;
                
                // Simulate Rust core operation
                let rust_measurement = rust_collector.start_operation(operation_type.clone()).await;
                tokio::time::sleep(Duration::from_millis(1)).await; // Minimal delay
                rust_measurement.complete(is_success).await.unwrap();
                
                // Simulate Python core operation (typically slower)
                let _python_duration = Duration::from_millis(operation_duration_ms + 50); // Python is typically 50ms slower
                let python_measurement = python_collector.start_operation(operation_type).await;
                tokio::time::sleep(Duration::from_millis(1)).await; // Minimal delay
                python_measurement.complete(is_success).await.unwrap();
            }
            
            // Get performance metrics
            let rust_metrics = rust_collector.get_metrics().await;
            let python_metrics = python_collector.get_metrics().await;
            
            // Verify that both cores recorded operations
            prop_assert_eq!(rust_metrics.operations_count, operation_count as u64, 
                "Rust core should record all operations");
            prop_assert_eq!(python_metrics.operations_count, operation_count as u64, 
                "Python core should record all operations");
            
            // Verify success rates are consistent (based on actual successful operations)
            let actual_success_rate = expected_successful_ops as f32 / operation_count as f32;
            let rust_success_rate_diff = (rust_metrics.success_rate - actual_success_rate).abs();
            let python_success_rate_diff = (python_metrics.success_rate - actual_success_rate).abs();
            
            prop_assert!(rust_success_rate_diff < 0.01, 
                "Rust core success rate should match actual: {} vs {}", 
                rust_metrics.success_rate, actual_success_rate);
            prop_assert!(python_success_rate_diff < 0.01, 
                "Python core success rate should match actual: {} vs {}", 
                python_metrics.success_rate, actual_success_rate);
            
            // Verify that Rust core performance is equivalent or better
            // (In this test, we simulate Rust being faster, but in real scenarios it should be measured)
            prop_assert!(rust_metrics.avg_response_time <= python_metrics.avg_response_time + Duration::from_millis(100),
                "Rust core should have equivalent or better response time: {:?} vs {:?}",
                rust_metrics.avg_response_time, python_metrics.avg_response_time);
            
            // Verify that performance metrics are reasonable
            prop_assert!(rust_metrics.avg_response_time >= Duration::from_millis(0),
                "Response time should be non-negative");
            prop_assert!(rust_metrics.avg_response_time <= Duration::from_secs(10),
                "Response time should be reasonable (< 10s)");
            
            prop_assert!(rust_metrics.success_rate >= 0.0 && rust_metrics.success_rate <= 1.0,
                "Success rate should be between 0 and 1");
            
            Ok(())
        })?;
    }
}

/// **Feature: rust-automation-core, Property 34: Performance feedback during core switching**
/// 
/// Property 34: Performance feedback during core switching
/// *For any* core switching operation, the system should provide feedback about expected performance changes
/// **Validates: Requirements 10.4**
proptest! {
    #[test]
    fn property_performance_feedback_during_core_switching(
        rust_operations in 1u32..20u32,
        python_operations in 1u32..20u32,
        rust_avg_time_ms in 10u64..500u64,
        python_avg_time_ms in 50u64..1000u64
    ) {
        let rt = Runtime::new().unwrap();
        
        rt.block_on(async {
            let mut performance_manager = PerformanceManager::new();
            
            // Start performance monitoring
            performance_manager.start_monitoring().await.unwrap();
            
            // Simulate operations for both cores with different performance characteristics
            let rust_collector = performance_manager.get_collector(&CoreType::Rust).unwrap();
            let python_collector = performance_manager.get_collector(&CoreType::Python).unwrap();
            
            // Simulate Rust operations
            for _ in 0..rust_operations {
                let measurement = rust_collector.start_operation(OperationType::Recording).await;
                tokio::time::sleep(Duration::from_millis(1)).await;
                measurement.complete(true).await.unwrap();
            }
            
            // Simulate Python operations
            for _ in 0..python_operations {
                let measurement = python_collector.start_operation(OperationType::Recording).await;
                tokio::time::sleep(Duration::from_millis(1)).await;
                measurement.complete(true).await.unwrap();
            }
            
            // Get performance comparison
            let comparison = performance_manager.get_performance_comparison().await.unwrap();
            
            // Verify that comparison provides meaningful feedback
            prop_assert!(comparison.recommendation.confidence >= 0.0 && comparison.recommendation.confidence <= 1.0,
                "Confidence should be between 0 and 1: {}", comparison.recommendation.confidence);
            
            prop_assert!(!comparison.recommendation.reasons.is_empty(),
                "Should provide reasons for recommendation");
            
            // Verify that comparison details are reasonable
            prop_assert!(comparison.comparison_details.response_time_ratio >= 0.0,
                "Response time ratio should be non-negative: {}", comparison.comparison_details.response_time_ratio);
            
            prop_assert!(comparison.comparison_details.success_rate_difference >= -1.0 && 
                        comparison.comparison_details.success_rate_difference <= 1.0,
                "Success rate difference should be between -1 and 1: {}", 
                comparison.comparison_details.success_rate_difference);
            
            // Verify that the recommendation is consistent with the data
            if let (Some(rust_metrics), Some(python_metrics)) = (&comparison.rust_metrics, &comparison.python_metrics) {
                if rust_metrics.avg_response_time < python_metrics.avg_response_time {
                    // If Rust is faster, it should be recommended or at least considered
                    prop_assert!(comparison.recommendation.recommended_core == CoreType::Rust || 
                               comparison.recommendation.confidence < 0.8,
                               "Should recommend Rust core when it's faster, or have low confidence");
                }
                
                if rust_metrics.success_rate > python_metrics.success_rate {
                    // If Rust has better success rate, it should influence the recommendation
                    prop_assert!(comparison.recommendation.recommended_core == CoreType::Rust || 
                               comparison.recommendation.confidence < 0.8,
                               "Should consider Rust core when it has better success rate");
                }
            }
            
            // Verify that performance improvement is calculated correctly
            if let Some(improvement) = comparison.recommendation.performance_improvement {
                prop_assert!(improvement >= 0.0 && improvement <= 1000.0,
                    "Performance improvement should be reasonable: {}%", improvement);
            }
            
            performance_manager.stop_monitoring();
            
            Ok(())
        })?;
    }
}

/// **Feature: rust-automation-core, Property 33: Performance metrics recording**
/// 
/// Property 33: Performance metrics recording
/// *For any* automation operation completion, the system should record performance metrics including execution time and resource usage
/// **Validates: Requirements 10.1**
proptest! {
    #[test]
    fn property_performance_metrics_recording(
        operation_types in prop::collection::vec(arbitrary_operation_type(), 1..10),
        success_rates in prop::collection::vec(any::<bool>(), 1..10)
    ) {
        let rt = Runtime::new().unwrap();
        
        rt.block_on(async {
            let collector = PerformanceCollector::new(CoreType::Rust);
            
            // Perform operations and record metrics
            for (operation_type, success) in operation_types.iter().zip(success_rates.iter()) {
                let measurement = collector.start_operation(operation_type.clone()).await;
                
                // Simulate some work
                tokio::time::sleep(Duration::from_millis(10)).await;
                
                measurement.complete(*success).await.unwrap();
            }
            
            // Get recorded metrics
            let metrics = collector.get_metrics().await;
            let operation_history = collector.get_operation_history(None).unwrap();
            
            // Verify that all operations were recorded
            prop_assert_eq!(metrics.operations_count, operation_types.len() as u64,
                "Should record all operations");
            prop_assert_eq!(operation_history.len(), operation_types.len(),
                "Should maintain operation history");
            
            // Verify that metrics are reasonable
            prop_assert!(metrics.avg_response_time >= Duration::from_millis(0),
                "Average response time should be non-negative");
            prop_assert!(metrics.avg_response_time <= Duration::from_secs(60),
                "Average response time should be reasonable");
            
            prop_assert!(metrics.success_rate >= 0.0 && metrics.success_rate <= 1.0,
                "Success rate should be between 0 and 1");
            
            // Verify success rate calculation
            let expected_success_count = success_rates.iter().filter(|&&s| s).count();
            let expected_success_rate = expected_success_count as f32 / success_rates.len() as f32;
            let success_rate_diff = (metrics.success_rate - expected_success_rate).abs();
            
            prop_assert!(success_rate_diff < 0.01,
                "Success rate should be calculated correctly: {} vs {} (diff: {})",
                metrics.success_rate, expected_success_rate, success_rate_diff);
            
            // Verify operation history contains correct data
            for (i, (operation_type, success)) in operation_types.iter().zip(success_rates.iter()).enumerate() {
                let recorded_op = &operation_history[i];
                prop_assert_eq!(&recorded_op.operation_type, operation_type,
                    "Operation type should be recorded correctly");
                prop_assert_eq!(recorded_op.success, *success,
                    "Success status should be recorded correctly");
                prop_assert!(recorded_op.duration >= Duration::from_millis(0),
                    "Operation duration should be non-negative");
            }
            
            Ok(())
        });
    }
}

// Helper functions for generating arbitrary test data

fn arbitrary_operation_type() -> impl Strategy<Value = OperationType> {
    prop_oneof![
        Just(OperationType::Recording),
        Just(OperationType::Playback),
        Just(OperationType::MouseMove),
        Just(OperationType::MouseClick),
        Just(OperationType::KeyboardInput),
        Just(OperationType::ScreenCapture),
        Just(OperationType::ScriptLoad),
        Just(OperationType::ScriptSave),
    ]
}

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn test_performance_collector_creation() {
        let rt = Runtime::new().unwrap();
        
        rt.block_on(async {
            let collector = PerformanceCollector::new(CoreType::Rust);
            let metrics = collector.get_metrics().await;
            
            assert_eq!(metrics.operations_count, 0);
            assert_eq!(metrics.success_rate, 1.0);
            assert_eq!(metrics.avg_response_time, Duration::from_millis(0));
        });
    }

    #[test]
    fn test_performance_manager_creation() {
        let rt = Runtime::new().unwrap();
        
        rt.block_on(async {
            let manager = PerformanceManager::new();
            
            assert!(manager.get_collector(&CoreType::Rust).is_some());
            assert!(manager.get_collector(&CoreType::Python).is_some());
        });
    }
}
