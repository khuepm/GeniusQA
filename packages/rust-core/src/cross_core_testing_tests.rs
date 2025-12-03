//! Tests for cross-core testing capabilities

#[cfg(test)]
mod tests {
    use crate::cross_core_testing::*;
    use crate::script::{ScriptData, Action};
    use tokio_test;

    #[test]
    fn test_recording_comparator_equivalent_actions() {
        let action1 = Action::mouse_click(100, 200, "left", 0.5);
        let action2 = Action::mouse_click(100, 200, "left", 0.5);
        
        let comparator = RecordingComparator::new(10.0, 5);
        assert!(comparator.are_actions_equivalent(&action1, &action2));
    }

    #[test]
    fn test_recording_comparator_different_action_types() {
        let action1 = Action::mouse_click(100, 200, "left", 0.5);
        let action2 = Action::mouse_move(100, 200, 0.5);
        
        let comparator = RecordingComparator::new(10.0, 5);
        assert!(!comparator.are_actions_equivalent(&action1, &action2));
    }

    #[test]
    fn test_timing_tolerance() {
        let action1 = Action::mouse_click(100, 200, "left", 0.5);
        let action2 = Action::mouse_click(100, 200, "left", 0.505); // 5ms difference
        
        let comparator = RecordingComparator::new(10.0, 5);
        assert!(comparator.are_actions_equivalent(&action1, &action2));
        
        let comparator_strict = RecordingComparator::new(1.0, 5);
        assert!(!comparator_strict.are_actions_equivalent(&action1, &action2));
    }

    #[test]
    fn test_coordinate_tolerance() {
        let action1 = Action::mouse_click(100, 200, "left", 0.5);
        let action2 = Action::mouse_click(103, 202, "left", 0.5); // Small coordinate difference
        
        let comparator = RecordingComparator::new(10.0, 5);
        assert!(comparator.are_actions_equivalent(&action1, &action2));
        
        let comparator_strict = RecordingComparator::new(10.0, 1);
        assert!(!comparator_strict.are_actions_equivalent(&action1, &action2));
    }

    #[test]
    fn test_script_equivalence() {
        let mut script1 = ScriptData::new("test", "linux");
        script1.add_action(Action::mouse_move(100, 100, 0.0));
        script1.add_action(Action::mouse_click(100, 100, "left", 0.5));

        let mut script2 = ScriptData::new("test", "linux");
        script2.add_action(Action::mouse_move(100, 100, 0.0));
        script2.add_action(Action::mouse_click(100, 100, "left", 0.5));
        
        let comparator = RecordingComparator::new(10.0, 5);
        assert!(comparator.are_scripts_equivalent(&script1, &script2));
    }

    #[test]
    fn test_action_differences() {
        let actions1 = vec![
            Action::mouse_move(100, 100, 0.0),
            Action::mouse_click(100, 100, "left", 0.5),
        ];
        
        let actions2 = vec![
            Action::mouse_move(100, 100, 0.0),
            Action::mouse_click(150, 150, "left", 0.5), // Different coordinates
            Action::key_press("a", 1.0, None), // Extra action
        ];
        
        let comparator = RecordingComparator::new(10.0, 1);
        let differences = comparator.compare_actions(&actions1, &actions2).unwrap();
        
        assert_eq!(differences.len(), 2);
        assert!(matches!(differences[0].difference_type, DifferenceType::CoordinateDifference));
        assert!(matches!(differences[1].difference_type, DifferenceType::Missing));
    }

    #[test]
    fn test_timing_differences() {
        let actions1 = vec![
            Action::mouse_move(100, 100, 0.0),
            Action::mouse_click(100, 100, "left", 0.5),
        ];
        
        let actions2 = vec![
            Action::mouse_move(100, 100, 0.0),
            Action::mouse_click(100, 100, "left", 0.52), // 20ms difference
        ];
        
        let comparator = RecordingComparator::new(10.0, 5);
        let timing_diffs = comparator.compare_timing(&actions1, &actions2).unwrap();
        
        assert_eq!(timing_diffs.len(), 1);
        assert!(timing_diffs[0].tolerance_exceeded);
        assert!((timing_diffs[0].difference_ms - 20.0).abs() < 0.001);
    }

    #[tokio::test]
    async fn test_cross_core_test_suite_creation() {
        let test_suite = CrossCoreTestSuite::new("/path/to/rust/core", "/path/to/python/core");
        assert_eq!(test_suite.rust_core_path(), "/path/to/rust/core");
        assert_eq!(test_suite.python_core_path(), "/path/to/python/core");
        assert_eq!(test_suite.test_scripts().len(), 0);
    }

    #[tokio::test]
    async fn test_add_test_script() {
        let mut test_suite = CrossCoreTestSuite::new("/path/to/rust/core", "/path/to/python/core");
        
        let script_data = crate::cross_core_testing::create_mouse_movement_script();
        let expected_behavior = ExpectedBehavior {
            should_be_compatible: true,
            expected_duration_tolerance: 0.1,
            expected_action_count: 3,
            platform_specific: std::collections::HashMap::new(),
        };
        
        let test_script = TestScript {
            name: "test_script".to_string(),
            description: "A test script for testing".to_string(),
            script_data,
            expected_behavior,
        };
        
        test_suite.add_test_script(test_script);
        assert_eq!(test_suite.test_scripts().len(), 1);
        assert_eq!(test_suite.test_scripts()[0].name, "test_script");
    }

    #[tokio::test]
    async fn test_run_single_test() {
        let test_suite = CrossCoreTestSuite::new("/path/to/rust/core", "/path/to/python/core");
        
        let script_data = crate::cross_core_testing::create_mouse_movement_script();
        let expected_behavior = ExpectedBehavior {
            should_be_compatible: true,
            expected_duration_tolerance: 0.1,
            expected_action_count: 3,
            platform_specific: std::collections::HashMap::new(),
        };
        
        let test_script = TestScript {
            name: "test_script".to_string(),
            description: "A test script for testing".to_string(),
            script_data,
            expected_behavior,
        };
        
        let result = test_suite.run_single_test(&test_script).await.unwrap();
        
        assert_eq!(result.test_name, "test_script");
        assert!(result.rust_result.success);
        assert!(result.python_result.success);
        assert!(result.compatibility_result.is_compatible);
        assert!(result.passed);
    }

    #[tokio::test]
    async fn test_run_all_tests() {
        let mut test_suite = CrossCoreTestSuite::new("/path/to/rust/core", "/path/to/python/core");
        
        let script_data = crate::cross_core_testing::create_mouse_movement_script();
        let expected_behavior = ExpectedBehavior {
            should_be_compatible: true,
            expected_duration_tolerance: 0.1,
            expected_action_count: 3,
            platform_specific: std::collections::HashMap::new(),
        };
        
        let test_script = TestScript {
            name: "test_script".to_string(),
            description: "A test script for testing".to_string(),
            script_data,
            expected_behavior,
        };
        
        test_suite.add_test_script(test_script);
        
        let results = test_suite.run_all_tests().await.unwrap();
        
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].test_name, "test_script");
        assert!(results[0].passed);
    }

    #[test]
    fn test_generate_test_report() {
        let test_suite = CrossCoreTestSuite::new("/path/to/rust/core", "/path/to/python/core");
        
        // Create a mock result
        let rust_result = CoreTestResult {
            core_type: "rust".to_string(),
            success: true,
            execution_time_ms: 50,
            memory_usage_mb: 15.5,
            output_script: Some(crate::cross_core_testing::create_mouse_movement_script()),
            error_message: None,
        };
        
        let python_result = CoreTestResult {
            core_type: "python".to_string(),
            success: true,
            execution_time_ms: 80,
            memory_usage_mb: 25.8,
            output_script: Some(crate::cross_core_testing::create_mouse_movement_script()),
            error_message: None,
        };
        
        let comparison = ComparisonResult {
            scripts_identical: true,
            performance_difference_ms: -30,
            memory_difference_mb: -10.3,
            action_differences: Vec::new(),
            timing_differences: Vec::new(),
        };
        
        let compatibility_result = crate::validation::CompatibilityResult {
            is_compatible: true,
            version: "1.0".to_string(),
            core_type: "test".to_string(),
            issues: Vec::new(),
            warnings: Vec::new(),
        };
        
        let result = CrossCoreTestResult {
            test_name: "test_script".to_string(),
            rust_result,
            python_result,
            compatibility_result,
            comparison,
            passed: true,
            issues: Vec::new(),
        };
        
        let report = test_suite.generate_test_report(&[result]);
        
        assert!(report.contains("Cross-Core Compatibility Test Report"));
        assert!(report.contains("Total Tests: 1"));
        assert!(report.contains("Passed: 1"));
        assert!(report.contains("test_script"));
        assert!(report.contains("PASSED"));
    }

    #[test]
    fn test_create_default_test_scripts() {
        let scripts = create_default_test_scripts();
        
        assert_eq!(scripts.len(), 3);
        assert!(scripts.iter().any(|s| s.name == "basic_mouse_movement"));
        assert!(scripts.iter().any(|s| s.name == "keyboard_input"));
        assert!(scripts.iter().any(|s| s.name == "mixed_interactions"));
        
        // Verify all scripts have valid structure
        for script in &scripts {
            assert!(!script.name.is_empty());
            assert!(!script.description.is_empty());
            assert!(!script.script_data.actions.is_empty());
        }
    }
}
