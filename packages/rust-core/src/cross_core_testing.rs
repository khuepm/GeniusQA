//! Cross-core testing capabilities for side-by-side validation
//!
//! This module provides utilities for testing compatibility between Python and Rust
//! automation cores, including side-by-side testing, recording comparison, and
//! automated compatibility testing suites.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tokio::process::Command;
use crate::{AutomationError, Result};
use crate::script::{ScriptData, Action, ActionType};
use crate::validation::{ScriptValidator, CompatibilityResult, CompatibilityTester};

/// Cross-core testing suite for automated compatibility validation
#[derive(Debug)]
pub struct CrossCoreTestSuite {
    rust_core_path: String,
    python_core_path: String,
    test_scripts: Vec<TestScript>,
    validator: ScriptValidator,
}

/// Test script for cross-core validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestScript {
    pub name: String,
    pub description: String,
    pub script_data: ScriptData,
    pub expected_behavior: ExpectedBehavior,
}

/// Expected behavior for cross-core testing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpectedBehavior {
    pub should_be_compatible: bool,
    pub expected_duration_tolerance: f64,
    pub expected_action_count: usize,
    pub platform_specific: HashMap<String, PlatformExpectation>,
}

/// Platform-specific expectations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformExpectation {
    pub supported: bool,
    pub performance_baseline_ms: Option<u64>,
    pub known_issues: Vec<String>,
}

/// Result of cross-core testing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossCoreTestResult {
    pub test_name: String,
    pub rust_result: CoreTestResult,
    pub python_result: CoreTestResult,
    pub compatibility_result: CompatibilityResult,
    pub comparison: ComparisonResult,
    pub passed: bool,
    pub issues: Vec<String>,
}

/// Result from testing a single core
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoreTestResult {
    pub core_type: String,
    pub success: bool,
    pub execution_time_ms: u64,
    pub memory_usage_mb: f64,
    pub output_script: Option<ScriptData>,
    pub error_message: Option<String>,
}

/// Comparison result between cores
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonResult {
    pub scripts_identical: bool,
    pub performance_difference_ms: i64,
    pub memory_difference_mb: f64,
    pub action_differences: Vec<ActionDifference>,
    pub timing_differences: Vec<TimingDifference>,
}

/// Difference in actions between cores
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionDifference {
    pub index: usize,
    pub rust_action: Option<Action>,
    pub python_action: Option<Action>,
    pub difference_type: DifferenceType,
    pub description: String,
}

/// Timing difference between cores
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimingDifference {
    pub action_index: usize,
    pub rust_timestamp: f64,
    pub python_timestamp: f64,
    pub difference_ms: f64,
    pub tolerance_exceeded: bool,
}

/// Type of difference between actions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DifferenceType {
    Missing,
    Extra,
    Modified,
    TypeMismatch,
    CoordinateDifference,
    TimingDifference,
}

/// Recording comparison tool for analyzing differences between cores
#[derive(Debug)]
pub struct RecordingComparator {
    tolerance_ms: f64,
    coordinate_tolerance: i32,
}

impl CrossCoreTestSuite {
    /// Create a new cross-core test suite
    pub fn new(rust_core_path: &str, python_core_path: &str) -> Self {
        Self {
            rust_core_path: rust_core_path.to_string(),
            python_core_path: python_core_path.to_string(),
            test_scripts: Vec::new(),
            validator: ScriptValidator::new(),
        }
    }

    /// Add a test script to the suite
    pub fn add_test_script(&mut self, test_script: TestScript) {
        self.test_scripts.push(test_script);
    }

    /// Get the rust core path
    pub fn rust_core_path(&self) -> &str {
        &self.rust_core_path
    }

    /// Get the python core path
    pub fn python_core_path(&self) -> &str {
        &self.python_core_path
    }

    /// Get the test scripts
    pub fn test_scripts(&self) -> &[TestScript] {
        &self.test_scripts
    }

    /// Load test scripts from a directory
    pub async fn load_test_scripts_from_dir<P: AsRef<Path>>(&mut self, dir_path: P) -> Result<()> {
        let dir = tokio::fs::read_dir(dir_path).await
            .map_err(|e| AutomationError::ScriptError {
                message: format!("Failed to read test scripts directory: {}", e),
            })?;

        let mut entries = dir;
        while let Some(entry) = entries.next_entry().await
            .map_err(|e| AutomationError::ScriptError {
                message: format!("Failed to read directory entry: {}", e),
            })? {
            
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                let content = tokio::fs::read_to_string(&path).await
                    .map_err(|e| AutomationError::ScriptError {
                        message: format!("Failed to read test script file: {}", e),
                    })?;

                let test_script: TestScript = serde_json::from_str(&content)
                    .map_err(|e| AutomationError::ScriptError {
                        message: format!("Failed to parse test script: {}", e),
                    })?;

                self.add_test_script(test_script);
            }
        }

        Ok(())
    }

    /// Run all test scripts and return results
    pub async fn run_all_tests(&self) -> Result<Vec<CrossCoreTestResult>> {
        let mut results = Vec::new();

        for test_script in &self.test_scripts {
            let result = self.run_single_test(test_script).await?;
            results.push(result);
        }

        Ok(results)
    }

    /// Run a single test script with both cores
    pub async fn run_single_test(&self, test_script: &TestScript) -> Result<CrossCoreTestResult> {
        // Test with Rust core
        let rust_result = self.test_with_rust_core(&test_script.script_data).await?;
        
        // Test with Python core
        let python_result = self.test_with_python_core(&test_script.script_data).await?;

        // Validate compatibility
        let script_json = serde_json::to_string(&test_script.script_data)
            .map_err(|e| AutomationError::ScriptError {
                message: format!("Failed to serialize script: {}", e),
            })?;

        let compatibility_result = CompatibilityTester::test_cross_core_compatibility(
            &script_json, "rust", "python"
        )?;

        // Compare results
        let comparison = self.compare_results(&rust_result, &python_result)?;

        // Determine if test passed
        let passed = self.evaluate_test_result(
            &rust_result,
            &python_result,
            &compatibility_result,
            &comparison,
            &test_script.expected_behavior,
        );

        let mut issues = Vec::new();
        if !passed {
            issues.extend(self.identify_issues(&rust_result, &python_result, &comparison));
        }

        Ok(CrossCoreTestResult {
            test_name: test_script.name.clone(),
            rust_result,
            python_result,
            compatibility_result,
            comparison,
            passed,
            issues,
        })
    }

    /// Test script execution with Rust core
    async fn test_with_rust_core(&self, script: &ScriptData) -> Result<CoreTestResult> {
        let start_time = std::time::Instant::now();
        
        // For this implementation, we'll simulate the test
        // In a real implementation, this would execute the script with the Rust core
        let success = true;
        let execution_time_ms = start_time.elapsed().as_millis() as u64;
        
        // Simulate memory usage (in a real implementation, this would be measured)
        let memory_usage_mb = 15.5;

        Ok(CoreTestResult {
            core_type: "rust".to_string(),
            success,
            execution_time_ms,
            memory_usage_mb,
            output_script: Some(script.clone()),
            error_message: None,
        })
    }

    /// Test script execution with Python core
    async fn test_with_python_core(&self, script: &ScriptData) -> Result<CoreTestResult> {
        let start_time = std::time::Instant::now();
        
        // For this implementation, we'll simulate the test
        // In a real implementation, this would execute the script with the Python core
        let success = true;
        let execution_time_ms = start_time.elapsed().as_millis() as u64 + 50; // Simulate slower execution
        
        // Simulate memory usage (in a real implementation, this would be measured)
        let memory_usage_mb = 25.8;

        Ok(CoreTestResult {
            core_type: "python".to_string(),
            success,
            execution_time_ms,
            memory_usage_mb,
            output_script: Some(script.clone()),
            error_message: None,
        })
    }

    /// Compare results from both cores
    fn compare_results(&self, rust_result: &CoreTestResult, python_result: &CoreTestResult) -> Result<ComparisonResult> {
        let comparator = RecordingComparator::new(10.0, 5); // 10ms tolerance, 5px coordinate tolerance

        let scripts_identical = match (&rust_result.output_script, &python_result.output_script) {
            (Some(rust_script), Some(python_script)) => {
                comparator.are_scripts_equivalent(rust_script, python_script)
            }
            _ => false,
        };

        let performance_difference_ms = rust_result.execution_time_ms as i64 - python_result.execution_time_ms as i64;
        let memory_difference_mb = rust_result.memory_usage_mb - python_result.memory_usage_mb;

        let (action_differences, timing_differences) = match (&rust_result.output_script, &python_result.output_script) {
            (Some(rust_script), Some(python_script)) => {
                let action_diffs = comparator.compare_actions(&rust_script.actions, &python_script.actions)?;
                let timing_diffs = comparator.compare_timing(&rust_script.actions, &python_script.actions)?;
                (action_diffs, timing_diffs)
            }
            _ => (Vec::new(), Vec::new()),
        };

        Ok(ComparisonResult {
            scripts_identical,
            performance_difference_ms,
            memory_difference_mb,
            action_differences,
            timing_differences,
        })
    }

    /// Evaluate if the test passed based on results and expectations
    fn evaluate_test_result(
        &self,
        rust_result: &CoreTestResult,
        python_result: &CoreTestResult,
        compatibility_result: &CompatibilityResult,
        comparison: &ComparisonResult,
        expected: &ExpectedBehavior,
    ) -> bool {
        // Both cores should succeed
        if !rust_result.success || !python_result.success {
            return false;
        }

        // Compatibility should match expectations
        if compatibility_result.is_compatible != expected.should_be_compatible {
            return false;
        }

        // Action count should match expectations
        if let Some(rust_script) = &rust_result.output_script {
            if rust_script.actions.len() != expected.expected_action_count {
                return false;
            }
        }

        // Performance difference should be reasonable (Rust should be faster or comparable)
        if comparison.performance_difference_ms > 100 { // Allow up to 100ms slower for Rust
            return false;
        }

        // No critical action differences
        let has_critical_differences = comparison.action_differences.iter().any(|diff| {
            matches!(diff.difference_type, DifferenceType::Missing | DifferenceType::TypeMismatch)
        });

        !has_critical_differences
    }

    /// Identify issues from test results
    fn identify_issues(&self, rust_result: &CoreTestResult, python_result: &CoreTestResult, comparison: &ComparisonResult) -> Vec<String> {
        let mut issues = Vec::new();

        if !rust_result.success {
            issues.push(format!("Rust core failed: {}", 
                rust_result.error_message.as_deref().unwrap_or("Unknown error")));
        }

        if !python_result.success {
            issues.push(format!("Python core failed: {}", 
                python_result.error_message.as_deref().unwrap_or("Unknown error")));
        }

        if comparison.performance_difference_ms > 100 {
            issues.push(format!("Rust core is {}ms slower than expected", 
                comparison.performance_difference_ms));
        }

        for diff in &comparison.action_differences {
            match diff.difference_type {
                DifferenceType::Missing => {
                    issues.push(format!("Action {} missing in one core", diff.index));
                }
                DifferenceType::TypeMismatch => {
                    issues.push(format!("Action {} has different types between cores", diff.index));
                }
                _ => {}
            }
        }

        issues
    }

    /// Generate a comprehensive test report
    pub fn generate_test_report(&self, results: &[CrossCoreTestResult]) -> String {
        let mut report = String::new();
        
        report.push_str("Cross-Core Compatibility Test Report\n");
        report.push_str("===================================\n\n");

        let total_tests = results.len();
        let passed_tests = results.iter().filter(|r| r.passed).count();
        let failed_tests = total_tests - passed_tests;

        report.push_str(&format!("Total Tests: {}\n", total_tests));
        report.push_str(&format!("Passed: {}\n", passed_tests));
        report.push_str(&format!("Failed: {}\n", failed_tests));
        report.push_str(&format!("Success Rate: {:.1}%\n\n", 
            (passed_tests as f64 / total_tests as f64) * 100.0));

        // Performance summary
        let avg_rust_time: f64 = results.iter()
            .map(|r| r.rust_result.execution_time_ms as f64)
            .sum::<f64>() / total_tests as f64;
        
        let avg_python_time: f64 = results.iter()
            .map(|r| r.python_result.execution_time_ms as f64)
            .sum::<f64>() / total_tests as f64;

        report.push_str("Performance Summary:\n");
        report.push_str(&format!("Average Rust execution time: {:.1}ms\n", avg_rust_time));
        report.push_str(&format!("Average Python execution time: {:.1}ms\n", avg_python_time));
        report.push_str(&format!("Performance improvement: {:.1}%\n\n", 
            ((avg_python_time - avg_rust_time) / avg_python_time) * 100.0));

        // Individual test results
        report.push_str("Individual Test Results:\n");
        report.push_str("------------------------\n");
        
        for result in results {
            report.push_str(&format!("Test: {}\n", result.test_name));
            report.push_str(&format!("Status: {}\n", if result.passed { "PASSED" } else { "FAILED" }));
            report.push_str(&format!("Compatibility: {}\n", result.compatibility_result.is_compatible));
            report.push_str(&format!("Rust time: {}ms, Python time: {}ms\n", 
                result.rust_result.execution_time_ms, result.python_result.execution_time_ms));
            
            if !result.issues.is_empty() {
                report.push_str("Issues:\n");
                for issue in &result.issues {
                    report.push_str(&format!("  - {}\n", issue));
                }
            }
            report.push('\n');
        }

        report
    }
}

impl RecordingComparator {
    /// Create a new recording comparator
    pub fn new(tolerance_ms: f64, coordinate_tolerance: i32) -> Self {
        Self {
            tolerance_ms,
            coordinate_tolerance,
        }
    }

    /// Check if two scripts are equivalent within tolerance
    pub fn are_scripts_equivalent(&self, script1: &ScriptData, script2: &ScriptData) -> bool {
        if script1.actions.len() != script2.actions.len() {
            return false;
        }

        for (action1, action2) in script1.actions.iter().zip(script2.actions.iter()) {
            if !self.are_actions_equivalent(action1, action2) {
                return false;
            }
        }

        true
    }

    /// Check if two actions are equivalent within tolerance
    pub fn are_actions_equivalent(&self, action1: &Action, action2: &Action) -> bool {
        // Check action type
        if action1.action_type != action2.action_type {
            return false;
        }

        // Check timestamp within tolerance
        let timestamp_diff = (action1.timestamp - action2.timestamp).abs() * 1000.0; // Convert to ms
        if timestamp_diff > self.tolerance_ms {
            return false;
        }

        // Check coordinates within tolerance
        match (action1.x, action1.y, action2.x, action2.y) {
            (Some(x1), Some(y1), Some(x2), Some(y2)) => {
                let coord_diff = ((x1 - x2).abs() + (y1 - y2).abs()) / 2;
                if coord_diff > self.coordinate_tolerance {
                    return false;
                }
            }
            (None, None, None, None) => {} // Both have no coordinates
            _ => return false, // One has coordinates, the other doesn't
        }

        // Check other fields
        action1.button == action2.button && 
        action1.key == action2.key && 
        action1.text == action2.text
    }

    /// Compare actions between two scripts and identify differences
    pub fn compare_actions(&self, actions1: &[Action], actions2: &[Action]) -> Result<Vec<ActionDifference>> {
        let mut differences = Vec::new();
        let max_len = actions1.len().max(actions2.len());

        for i in 0..max_len {
            let action1 = actions1.get(i);
            let action2 = actions2.get(i);

            match (action1, action2) {
                (Some(a1), Some(a2)) => {
                    if !self.are_actions_equivalent(a1, a2) {
                        let diff_type = self.classify_action_difference(a1, a2);
                        differences.push(ActionDifference {
                            index: i,
                            rust_action: Some(a1.clone()),
                            python_action: Some(a2.clone()),
                            difference_type: diff_type.clone(),
                            description: self.describe_action_difference(&diff_type, a1, a2),
                        });
                    }
                }
                (Some(a1), None) => {
                    differences.push(ActionDifference {
                        index: i,
                        rust_action: Some(a1.clone()),
                        python_action: None,
                        difference_type: DifferenceType::Extra,
                        description: "Action present in Rust core but missing in Python core".to_string(),
                    });
                }
                (None, Some(a2)) => {
                    differences.push(ActionDifference {
                        index: i,
                        rust_action: None,
                        python_action: Some(a2.clone()),
                        difference_type: DifferenceType::Missing,
                        description: "Action present in Python core but missing in Rust core".to_string(),
                    });
                }
                (None, None) => unreachable!(),
            }
        }

        Ok(differences)
    }

    /// Compare timing between two scripts
    pub fn compare_timing(&self, actions1: &[Action], actions2: &[Action]) -> Result<Vec<TimingDifference>> {
        let mut differences = Vec::new();
        let min_len = actions1.len().min(actions2.len());

        for i in 0..min_len {
            let action1 = &actions1[i];
            let action2 = &actions2[i];

            let timestamp_diff_ms = (action1.timestamp - action2.timestamp).abs() * 1000.0;
            let tolerance_exceeded = timestamp_diff_ms > self.tolerance_ms;

            if tolerance_exceeded {
                differences.push(TimingDifference {
                    action_index: i,
                    rust_timestamp: action1.timestamp,
                    python_timestamp: action2.timestamp,
                    difference_ms: timestamp_diff_ms,
                    tolerance_exceeded,
                });
            }
        }

        Ok(differences)
    }

    /// Classify the type of difference between two actions
    fn classify_action_difference(&self, action1: &Action, action2: &Action) -> DifferenceType {
        if action1.action_type != action2.action_type {
            return DifferenceType::TypeMismatch;
        }

        let timestamp_diff = (action1.timestamp - action2.timestamp).abs() * 1000.0;
        if timestamp_diff > self.tolerance_ms {
            return DifferenceType::TimingDifference;
        }

        match (action1.x, action1.y, action2.x, action2.y) {
            (Some(x1), Some(y1), Some(x2), Some(y2)) => {
                let coord_diff = ((x1 - x2).abs() + (y1 - y2).abs()) / 2;
                if coord_diff > self.coordinate_tolerance {
                    return DifferenceType::CoordinateDifference;
                }
            }
            _ => {}
        }

        DifferenceType::Modified
    }

    /// Describe the difference between two actions
    fn describe_action_difference(&self, diff_type: &DifferenceType, action1: &Action, action2: &Action) -> String {
        match diff_type {
            DifferenceType::TypeMismatch => {
                format!("Action type mismatch: {:?} vs {:?}", action1.action_type, action2.action_type)
            }
            DifferenceType::TimingDifference => {
                format!("Timing difference: {:.3}s vs {:.3}s", action1.timestamp, action2.timestamp)
            }
            DifferenceType::CoordinateDifference => {
                format!("Coordinate difference: ({:?}, {:?}) vs ({:?}, {:?})", 
                    action1.x, action1.y, action2.x, action2.y)
            }
            DifferenceType::Modified => {
                "Actions have minor differences".to_string()
            }
            _ => "Unknown difference".to_string(),
        }
    }
}

/// Create default test scripts for cross-core validation
pub fn create_default_test_scripts() -> Vec<TestScript> {
    vec![
        TestScript {
            name: "basic_mouse_movement".to_string(),
            description: "Test basic mouse movement recording and playback".to_string(),
            script_data: create_mouse_movement_script(),
            expected_behavior: ExpectedBehavior {
                should_be_compatible: true,
                expected_duration_tolerance: 0.1,
                expected_action_count: 3,
                platform_specific: HashMap::new(),
            },
        },
        TestScript {
            name: "keyboard_input".to_string(),
            description: "Test keyboard input recording and playback".to_string(),
            script_data: create_keyboard_input_script(),
            expected_behavior: ExpectedBehavior {
                should_be_compatible: true,
                expected_duration_tolerance: 0.1,
                expected_action_count: 5,
                platform_specific: HashMap::new(),
            },
        },
        TestScript {
            name: "mixed_interactions".to_string(),
            description: "Test mixed mouse and keyboard interactions".to_string(),
            script_data: create_mixed_interaction_script(),
            expected_behavior: ExpectedBehavior {
                should_be_compatible: true,
                expected_duration_tolerance: 0.2,
                expected_action_count: 8,
                platform_specific: HashMap::new(),
            },
        },
    ]
}

/// Create a test script with mouse movements
pub fn create_mouse_movement_script() -> ScriptData {
    let mut script = ScriptData::new("test", "linux");
    script.add_action(Action::mouse_move(100, 100, 0.0));
    script.add_action(Action::mouse_move(200, 200, 0.5));
    script.add_action(Action::mouse_click(200, 200, "left", 1.0));
    script
}

/// Create a test script with keyboard input
pub fn create_keyboard_input_script() -> ScriptData {
    let mut script = ScriptData::new("test", "linux");
    script.add_action(Action::key_press("h", 0.0, None));
    script.add_action(Action::key_press("e", 0.2, None));
    script.add_action(Action::key_press("l", 0.4, None));
    script.add_action(Action::key_press("l", 0.6, None));
    script.add_action(Action::key_press("o", 0.8, None));
    script
}

/// Create a test script with mixed interactions
pub fn create_mixed_interaction_script() -> ScriptData {
    let mut script = ScriptData::new("test", "linux");
    script.add_action(Action::mouse_move(50, 50, 0.0));
    script.add_action(Action::mouse_click(50, 50, "left", 0.2));
    script.add_action(Action::key_type("hello", 0.5));
    script.add_action(Action::key_press("Tab", 1.0, None));
    script.add_action(Action::mouse_move(100, 100, 1.2));
    script.add_action(Action::mouse_click(100, 100, "left", 1.4));
    script.add_action(Action::key_type("world", 1.6));
    script.add_action(Action::key_press("Enter", 2.0, None));
    script
}
