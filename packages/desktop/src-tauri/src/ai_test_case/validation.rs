//! Schema validation for AI Test Case Generator
//!
//! Provides comprehensive validation for test case data structures.
//! Requirements: 5.1, 5.4, 5.5

use crate::ai_test_case::error::{AITestCaseError, Result};
use crate::ai_test_case::models::{TestCase, TestStep};
use serde::{Deserialize, Serialize};

/// Validation result for a single field
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldValidation {
    /// Field name
    pub field: String,
    /// Is the field valid
    pub is_valid: bool,
    /// Error message if invalid
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Overall validation result
/// Requirements: 5.4, 5.5
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    /// Is the test case valid
    pub is_valid: bool,
    /// Field-level validation results
    pub field_validations: Vec<FieldValidation>,
    /// Auto-fix suggestions
    pub auto_fix_suggestions: Vec<String>,
}

impl ValidationResult {
    /// Create a valid result
    pub fn valid() -> Self {
        ValidationResult {
            is_valid: true,
            field_validations: Vec::new(),
            auto_fix_suggestions: Vec::new(),
        }
    }

    /// Create an invalid result with errors
    pub fn invalid(field_validations: Vec<FieldValidation>) -> Self {
        ValidationResult {
            is_valid: false,
            field_validations,
            auto_fix_suggestions: Vec::new(),
        }
    }

    /// Add a field validation error
    pub fn add_error(&mut self, field: impl Into<String>, error: impl Into<String>) {
        self.is_valid = false;
        self.field_validations.push(FieldValidation {
            field: field.into(),
            is_valid: false,
            error: Some(error.into()),
        });
    }

    /// Add an auto-fix suggestion
    pub fn add_suggestion(&mut self, suggestion: impl Into<String>) {
        self.auto_fix_suggestions.push(suggestion.into());
    }

    /// Get all error messages
    pub fn get_errors(&self) -> Vec<String> {
        self.field_validations
            .iter()
            .filter(|v| !v.is_valid)
            .filter_map(|v| v.error.clone())
            .collect()
    }
}

/// Test case validator
/// Requirements: 5.1, 5.4, 5.5
pub struct TestCaseValidator;

impl TestCaseValidator {
    /// Create a new validator
    pub fn new() -> Self {
        TestCaseValidator
    }

    /// Validate a single test case
    /// Requirements: 5.1, 5.4
    pub fn validate_test_case(&self, test_case: &TestCase) -> ValidationResult {
        let mut result = ValidationResult::valid();

        // Validate required fields
        // Requirements: 5.1 - id, title, description, steps, expected_result, severity

        // Validate ID
        if test_case.id.is_empty() {
            result.add_error("id", "Test case ID is required");
            result.add_suggestion("Generate a unique ID using UUID");
        } else if test_case.id.len() > 50 {
            result.add_error("id", "Test case ID exceeds maximum length of 50 characters");
            result.add_suggestion("Use a shorter ID format");
        }

        // Validate title
        if test_case.title.is_empty() {
            result.add_error("title", "Test case title is required");
            result.add_suggestion("Add a descriptive title");
        } else if test_case.title.len() > 200 {
            result.add_error("title", "Test case title exceeds maximum length of 200 characters");
            result.add_suggestion("Truncate title to 200 characters");
        } else if test_case.title.trim().is_empty() {
            result.add_error("title", "Test case title cannot be only whitespace");
            result.add_suggestion("Add meaningful title content");
        }

        // Validate description
        if test_case.description.is_empty() {
            result.add_error("description", "Test case description is required");
            result.add_suggestion("Add a detailed description");
        } else if test_case.description.len() > 1000 {
            result.add_error("description", "Test case description exceeds maximum length of 1000 characters");
            result.add_suggestion("Truncate description to 1000 characters");
        } else if test_case.description.trim().is_empty() {
            result.add_error("description", "Test case description cannot be only whitespace");
            result.add_suggestion("Add meaningful description content");
        }

        // Validate preconditions (optional but if present, must be valid)
        if let Some(ref preconditions) = test_case.preconditions {
            if preconditions.trim().is_empty() {
                result.add_error("preconditions", "Preconditions cannot be only whitespace");
                result.add_suggestion("Remove empty preconditions or add content");
            } else if preconditions.len() > 500 {
                result.add_error("preconditions", "Preconditions exceed maximum length of 500 characters");
                result.add_suggestion("Truncate preconditions to 500 characters");
            }
        }

        // Validate steps
        if test_case.steps.is_empty() {
            result.add_error("steps", "Test case must have at least one step");
            result.add_suggestion("Add at least one test step");
        } else if test_case.steps.len() > 50 {
            result.add_error("steps", "Test case has too many steps (maximum 50)");
            result.add_suggestion("Consider breaking into multiple test cases");
        } else {
            // Validate each step
            for (i, step) in test_case.steps.iter().enumerate() {
                let step_result = self.validate_test_step(step, i);
                if !step_result.is_valid {
                    for validation in step_result.field_validations {
                        result.field_validations.push(validation);
                    }
                    result.is_valid = false;
                }
            }

            // Check step ordering
            let mut expected_order = 1;
            for (i, step) in test_case.steps.iter().enumerate() {
                if step.order != expected_order {
                    result.add_error(
                        format!("steps[{}].order", i),
                        format!("Step order should be {} but found {}", expected_order, step.order),
                    );
                    result.add_suggestion("Re-number steps sequentially starting from 1");
                }
                expected_order += 1;
            }

            // Check for duplicate step orders
            let mut orders = std::collections::HashSet::new();
            for (i, step) in test_case.steps.iter().enumerate() {
                if !orders.insert(step.order) {
                    result.add_error(
                        format!("steps[{}].order", i),
                        format!("Duplicate step order: {}", step.order),
                    );
                    result.add_suggestion("Ensure all step orders are unique");
                }
            }
        }

        // Validate expected_result
        if test_case.expected_result.is_empty() {
            result.add_error("expected_result", "Expected result is required");
            result.add_suggestion("Add expected result description");
        } else if test_case.expected_result.len() > 500 {
            result.add_error("expected_result", "Expected result exceeds maximum length of 500 characters");
            result.add_suggestion("Truncate expected result to 500 characters");
        } else if test_case.expected_result.trim().is_empty() {
            result.add_error("expected_result", "Expected result cannot be only whitespace");
            result.add_suggestion("Add meaningful expected result content");
        }

        // Validate metadata fields
        if test_case.metadata.generated_by.is_empty() {
            result.add_error("metadata.generated_by", "Generated by field is required");
            result.add_suggestion("Set generated_by to appropriate value");
        }

        if test_case.metadata.generation_version.is_empty() {
            result.add_error("metadata.generation_version", "Generation version is required");
            result.add_suggestion("Set generation_version to current version");
        }

        result
    }

    /// Validate a single test step
    /// Requirements: 5.2
    pub fn validate_test_step(&self, step: &TestStep, index: usize) -> ValidationResult {
        let mut result = ValidationResult::valid();

        // Validate order
        if step.order == 0 {
            result.add_error(
                format!("steps[{}].order", index),
                "Step order must be greater than 0",
            );
            result.add_suggestion("Set step order to a positive number");
        }

        // Validate action
        if step.action.is_empty() {
            result.add_error(
                format!("steps[{}].action", index),
                "Step action is required",
            );
            result.add_suggestion("Add action description for the step");
        } else if step.action.trim().is_empty() {
            result.add_error(
                format!("steps[{}].action", index),
                "Step action cannot be only whitespace",
            );
            result.add_suggestion("Add meaningful action content");
        } else if step.action.len() > 500 {
            result.add_error(
                format!("steps[{}].action", index),
                "Step action exceeds maximum length of 500 characters",
            );
            result.add_suggestion("Truncate action description");
        }

        // Validate expected_outcome (optional but if present, must be valid)
        if let Some(ref outcome) = step.expected_outcome {
            if outcome.trim().is_empty() {
                result.add_error(
                    format!("steps[{}].expected_outcome", index),
                    "Expected outcome cannot be only whitespace",
                );
                result.add_suggestion("Remove empty expected outcome or add content");
            } else if outcome.len() > 300 {
                result.add_error(
                    format!("steps[{}].expected_outcome", index),
                    "Expected outcome exceeds maximum length of 300 characters",
                );
                result.add_suggestion("Truncate expected outcome");
            }
        }

        // Validate notes (optional but if present, must be valid)
        if let Some(ref notes) = step.notes {
            if notes.trim().is_empty() {
                result.add_error(
                    format!("steps[{}].notes", index),
                    "Notes cannot be only whitespace",
                );
                result.add_suggestion("Remove empty notes or add content");
            } else if notes.len() > 200 {
                result.add_error(
                    format!("steps[{}].notes", index),
                    "Notes exceed maximum length of 200 characters",
                );
                result.add_suggestion("Truncate notes");
            }
        }

        result
    }

    /// Validate multiple test cases
    pub fn validate_test_cases(&self, test_cases: &[TestCase]) -> Vec<ValidationResult> {
        test_cases
            .iter()
            .map(|tc| self.validate_test_case(tc))
            .collect()
    }

    /// Attempt to auto-fix common issues in a test case
    /// Requirements: 5.5
    pub fn auto_fix_test_case(&self, test_case: &mut TestCase) -> Vec<String> {
        let mut fixes = Vec::new();

        // Fix empty ID
        if test_case.id.is_empty() {
            test_case.id = uuid::Uuid::new_v4().to_string();
            fixes.push("Generated unique ID".to_string());
        }

        // Fix empty title
        if test_case.title.is_empty() {
            test_case.title = "Untitled Test Case".to_string();
            fixes.push("Added default title".to_string());
        }

        // Fix empty description
        if test_case.description.is_empty() {
            test_case.description = "Test case description".to_string();
            fixes.push("Added default description".to_string());
        }

        // Fix empty expected result
        if test_case.expected_result.is_empty() {
            test_case.expected_result = "Expected result not specified".to_string();
            fixes.push("Added default expected result".to_string());
        }

        // Fix step ordering
        let mut needs_reorder = false;
        for (i, step) in test_case.steps.iter().enumerate() {
            if step.order != (i + 1) as u32 {
                needs_reorder = true;
                break;
            }
        }

        if needs_reorder {
            for (i, step) in test_case.steps.iter_mut().enumerate() {
                step.order = (i + 1) as u32;
            }
            fixes.push("Re-numbered steps sequentially".to_string());
        }

        // Fix empty step actions
        for (i, step) in test_case.steps.iter_mut().enumerate() {
            if step.action.is_empty() {
                step.action = format!("Step {} action", i + 1);
                fixes.push(format!("Added default action for step {}", i + 1));
            }
        }

        // Truncate overly long title
        if test_case.title.len() > 200 {
            test_case.title = test_case.title.chars().take(197).collect::<String>() + "...";
            fixes.push("Truncated title to 200 characters".to_string());
        }

        // Truncate overly long description
        if test_case.description.len() > 1000 {
            test_case.description = test_case.description.chars().take(997).collect::<String>() + "...";
            fixes.push("Truncated description to 1000 characters".to_string());
        }

        // Truncate overly long expected result
        if test_case.expected_result.len() > 500 {
            test_case.expected_result = test_case.expected_result.chars().take(497).collect::<String>() + "...";
            fixes.push("Truncated expected result to 500 characters".to_string());
        }

        fixes
    }

    /// Attempt to auto-repair malformed JSON data
    /// Requirements: 5.3, 5.5
    pub fn auto_repair_json(&self, json_str: &str) -> Result<String> {
        // First, try to parse as-is
        if serde_json::from_str::<serde_json::Value>(json_str).is_ok() {
            return Ok(json_str.to_string());
        }

        let mut repaired = json_str.to_string();
        let mut fixes = Vec::new();

        // Common JSON repair strategies
        
        // 1. Fix missing quotes around field names
        if !repaired.contains("\"id\"") && repaired.contains("id:") {
            repaired = repaired.replace("id:", "\"id\":");
            fixes.push("Added quotes around 'id' field");
        }
        if !repaired.contains("\"title\"") && repaired.contains("title:") {
            repaired = repaired.replace("title:", "\"title\":");
            fixes.push("Added quotes around 'title' field");
        }
        if !repaired.contains("\"description\"") && repaired.contains("description:") {
            repaired = repaired.replace("description:", "\"description\":");
            fixes.push("Added quotes around 'description' field");
        }
        if !repaired.contains("\"steps\"") && repaired.contains("steps:") {
            repaired = repaired.replace("steps:", "\"steps\":");
            fixes.push("Added quotes around 'steps' field");
        }
        if !repaired.contains("\"expected_result\"") && repaired.contains("expected_result:") {
            repaired = repaired.replace("expected_result:", "\"expected_result\":");
            fixes.push("Added quotes around 'expected_result' field");
        }

        // 2. Fix trailing commas
        repaired = repaired.replace(",}", "}");
        repaired = repaired.replace(",]", "]");
        if repaired != json_str {
            fixes.push("Removed trailing commas");
        }

        // 3. Fix single quotes to double quotes
        if repaired.contains("'") {
            // Simple replacement - this could be more sophisticated
            repaired = repaired.replace("'", "\"");
            fixes.push("Converted single quotes to double quotes");
        }

        // 4. Ensure proper array/object structure
        if !repaired.trim().starts_with('{') && !repaired.trim().starts_with('[') {
            repaired = format!("{{{}}}", repaired);
            fixes.push("Wrapped content in object braces");
        }

        // 5. Try to fix missing closing braces/brackets
        let open_braces = repaired.matches('{').count();
        let close_braces = repaired.matches('}').count();
        if open_braces > close_braces {
            for _ in 0..(open_braces - close_braces) {
                repaired.push('}');
            }
            fixes.push("Added missing closing braces");
        }

        let open_brackets = repaired.matches('[').count();
        let close_brackets = repaired.matches(']').count();
        if open_brackets > close_brackets {
            for _ in 0..(open_brackets - close_brackets) {
                repaired.push(']');
            }
            fixes.push("Added missing closing brackets");
        }

        // Validate the repaired JSON
        if serde_json::from_str::<serde_json::Value>(&repaired).is_ok() {
            log::info!("JSON auto-repair successful: {}", fixes.join(", "));
            Ok(repaired)
        } else {
            Err(AITestCaseError::parse_error(
                format!("Auto-repair failed after attempting: {}", fixes.join(", ")),
                json_str.to_string(),
            ))
        }
    }

    /// Validate and auto-fix a test case from JSON
    /// Requirements: 5.3, 5.4, 5.5
    pub fn validate_and_fix_from_json(&self, json_str: &str) -> Result<(TestCase, Vec<String>)> {
        // First attempt to repair the JSON
        let repaired_json = self.auto_repair_json(json_str)?;
        
        // Try to deserialize to TestCase
        let mut test_case: TestCase = serde_json::from_str(&repaired_json)
            .map_err(|e| AITestCaseError::parse_error(e.to_string(), repaired_json.clone()))?;

        // Validate the test case
        let validation_result = self.validate_test_case(&test_case);
        
        let mut all_fixes = Vec::new();
        
        // If validation fails, attempt auto-fix
        if !validation_result.is_valid {
            let auto_fixes = self.auto_fix_test_case(&mut test_case);
            all_fixes.extend(auto_fixes);
            
            // Re-validate after fixes
            let final_validation = self.validate_test_case(&test_case);
            if !final_validation.is_valid {
                return Err(AITestCaseError::validation_error(
                    "test_case",
                    format!("Validation failed even after auto-fix: {}", 
                           final_validation.get_errors().join(", "))
                ));
            }
        }

        Ok((test_case, all_fixes))
    }

    /// Validate input requirements text
    /// Requirements: 2.1
    pub fn validate_requirements_input(&self, input: &str) -> Result<()> {
        // Check for empty input
        if input.is_empty() {
            return Err(AITestCaseError::input_error("Requirements input cannot be empty"));
        }

        // Check for whitespace-only input
        if input.trim().is_empty() {
            return Err(AITestCaseError::input_error(
                "Requirements input cannot contain only whitespace",
            ));
        }

        // Check for minimum meaningful content (at least 10 characters after trimming)
        if input.trim().len() < 10 {
            return Err(AITestCaseError::input_error(
                "Requirements input must contain meaningful content (at least 10 characters)",
            ));
        }

        Ok(())
    }
}

impl Default for TestCaseValidator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_test_case::models::{TestCaseMetadata, TestSeverity, TestType};

    fn create_valid_test_case() -> TestCase {
        TestCase {
            id: "TC001".to_string(),
            title: "Valid Test Case".to_string(),
            description: "A valid test case description".to_string(),
            preconditions: None,
            steps: vec![
                TestStep {
                    order: 1,
                    action: "Step 1 action".to_string(),
                    expected_outcome: Some("Expected outcome".to_string()),
                    notes: None,
                },
            ],
            expected_result: "Expected result".to_string(),
            severity: TestSeverity::Medium,
            test_type: TestType::Functional,
            metadata: TestCaseMetadata::default(),
        }
    }

    fn create_minimal_test_case() -> TestCase {
        TestCase {
            id: "TC001".to_string(),
            title: "Test".to_string(),
            description: "Description".to_string(),
            preconditions: None,
            steps: vec![
                TestStep {
                    order: 1,
                    action: "Action".to_string(),
                    expected_outcome: None,
                    notes: None,
                },
            ],
            expected_result: "Result".to_string(),
            severity: TestSeverity::Medium,
            test_type: TestType::Functional,
            metadata: TestCaseMetadata::default(),
        }
    }

    // ============================================================================
    // Basic Validation Tests
    // ============================================================================

    #[test]
    fn test_valid_test_case() {
        let validator = TestCaseValidator::new();
        let tc = create_valid_test_case();
        let result = validator.validate_test_case(&tc);
        assert!(result.is_valid, "Valid test case should pass validation");
        assert!(result.field_validations.is_empty());
    }

    #[test]
    fn test_minimal_valid_test_case() {
        let validator = TestCaseValidator::new();
        let tc = create_minimal_test_case();
        let result = validator.validate_test_case(&tc);
        assert!(result.is_valid, "Minimal valid test case should pass validation");
    }

    // ============================================================================
    // Missing Required Fields Tests
    // ============================================================================

    #[test]
    fn test_missing_id() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.id = String::new();
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("ID") && e.contains("required")));
    }

    #[test]
    fn test_missing_title() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.title = String::new();
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("title") && e.contains("required")));
    }

    #[test]
    fn test_missing_description() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.description = String::new();
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("description") && e.contains("required")));
    }

    #[test]
    fn test_missing_expected_result() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.expected_result = String::new();
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("Expected result") && e.contains("required")));
    }

    #[test]
    fn test_missing_steps() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.steps = Vec::new();
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("step") && e.contains("at least one")));
    }

    // ============================================================================
    // Whitespace-Only Fields Tests
    // ============================================================================

    #[test]
    fn test_whitespace_only_title() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.title = "   \t\n   ".to_string();
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("title") && e.contains("whitespace")));
    }

    #[test]
    fn test_whitespace_only_description() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.description = "   \t\n   ".to_string();
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("description") && e.contains("whitespace")));
    }

    #[test]
    fn test_whitespace_only_expected_result() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.expected_result = "   \t\n   ".to_string();
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("Expected result") && e.contains("whitespace")));
    }

    #[test]
    fn test_whitespace_only_preconditions() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.preconditions = Some("   \t\n   ".to_string());
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("Preconditions") && e.contains("whitespace")));
    }

    // ============================================================================
    // Field Length Validation Tests
    // ============================================================================

    #[test]
    fn test_overly_long_id() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.id = "a".repeat(51); // Exceeds 50 character limit
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("ID") && e.contains("maximum length")));
    }

    #[test]
    fn test_overly_long_title() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.title = "a".repeat(201); // Exceeds 200 character limit
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("title") && e.contains("maximum length")));
    }

    #[test]
    fn test_overly_long_description() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.description = "a".repeat(1001); // Exceeds 1000 character limit
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("description") && e.contains("maximum length")));
    }

    #[test]
    fn test_overly_long_expected_result() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.expected_result = "a".repeat(501); // Exceeds 500 character limit
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("Expected result") && e.contains("maximum length")));
    }

    #[test]
    fn test_overly_long_preconditions() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.preconditions = Some("a".repeat(501)); // Exceeds 500 character limit
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("Preconditions") && e.contains("maximum length")));
    }

    #[test]
    fn test_too_many_steps() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.steps = (1..=51).map(|i| TestStep {
            order: i,
            action: format!("Step {} action", i),
            expected_outcome: None,
            notes: None,
        }).collect(); // Exceeds 50 step limit
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("too many steps")));
    }

    // ============================================================================
    // Step Validation Tests
    // ============================================================================

    #[test]
    fn test_step_zero_order() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.steps[0].order = 0;
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("order") && e.contains("greater than 0")));
    }

    #[test]
    fn test_step_empty_action() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.steps[0].action = String::new();
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("action") && e.contains("required")));
    }

    #[test]
    fn test_step_whitespace_only_action() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.steps[0].action = "   \t\n   ".to_string();
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("action") && e.contains("whitespace")));
    }

    #[test]
    fn test_step_overly_long_action() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.steps[0].action = "a".repeat(501); // Exceeds 500 character limit
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("action") && e.contains("maximum length")));
    }

    #[test]
    fn test_step_whitespace_only_expected_outcome() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.steps[0].expected_outcome = Some("   \t\n   ".to_string());
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("Expected outcome") && e.contains("whitespace")));
    }

    #[test]
    fn test_step_overly_long_expected_outcome() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.steps[0].expected_outcome = Some("a".repeat(301)); // Exceeds 300 character limit
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("Expected outcome") && e.contains("maximum length")));
    }

    #[test]
    fn test_step_whitespace_only_notes() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.steps[0].notes = Some("   \t\n   ".to_string());
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("Notes") && e.contains("whitespace")));
    }

    #[test]
    fn test_step_overly_long_notes() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.steps[0].notes = Some("a".repeat(201)); // Exceeds 200 character limit
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("Notes") && e.contains("maximum length")));
    }

    #[test]
    fn test_incorrect_step_ordering() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.steps = vec![
            TestStep { order: 1, action: "First".to_string(), expected_outcome: None, notes: None },
            TestStep { order: 3, action: "Third".to_string(), expected_outcome: None, notes: None }, // Should be 2
            TestStep { order: 2, action: "Second".to_string(), expected_outcome: None, notes: None }, // Should be 3
        ];
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("order") && e.contains("should be")));
    }

    #[test]
    fn test_duplicate_step_orders() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.steps = vec![
            TestStep { order: 1, action: "First".to_string(), expected_outcome: None, notes: None },
            TestStep { order: 1, action: "Also First".to_string(), expected_outcome: None, notes: None }, // Duplicate order
        ];
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("Duplicate step order")));
    }

    // ============================================================================
    // Metadata Validation Tests
    // ============================================================================

    #[test]
    fn test_empty_generated_by() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.metadata.generated_by = String::new();
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("Generated by") && e.contains("required")));
    }

    #[test]
    fn test_empty_generation_version() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.metadata.generation_version = String::new();
        let result = validator.validate_test_case(&tc);
        assert!(!result.is_valid);
        assert!(result.get_errors().iter().any(|e| e.contains("Generation version") && e.contains("required")));
    }

    // ============================================================================
    // Auto-Fix Tests
    // ============================================================================

    #[test]
    fn test_auto_fix_empty_id() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.id = String::new();
        let fixes = validator.auto_fix_test_case(&mut tc);
        assert!(!tc.id.is_empty(), "ID should be generated");
        assert!(fixes.iter().any(|f| f.contains("ID")));
    }

    #[test]
    fn test_auto_fix_empty_title() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.title = String::new();
        let fixes = validator.auto_fix_test_case(&mut tc);
        assert_eq!(tc.title, "Untitled Test Case");
        assert!(fixes.iter().any(|f| f.contains("title")));
    }

    #[test]
    fn test_auto_fix_empty_description() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.description = String::new();
        let fixes = validator.auto_fix_test_case(&mut tc);
        assert_eq!(tc.description, "Test case description");
        assert!(fixes.iter().any(|f| f.contains("description")));
    }

    #[test]
    fn test_auto_fix_empty_expected_result() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.expected_result = String::new();
        let fixes = validator.auto_fix_test_case(&mut tc);
        assert_eq!(tc.expected_result, "Expected result not specified");
        assert!(fixes.iter().any(|f| f.contains("expected result")));
    }

    #[test]
    fn test_auto_fix_step_ordering() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.steps = vec![
            TestStep { order: 5, action: "First".to_string(), expected_outcome: None, notes: None },
            TestStep { order: 10, action: "Second".to_string(), expected_outcome: None, notes: None },
        ];
        let fixes = validator.auto_fix_test_case(&mut tc);
        assert_eq!(tc.steps[0].order, 1);
        assert_eq!(tc.steps[1].order, 2);
        assert!(fixes.iter().any(|f| f.contains("Re-numbered")));
    }

    #[test]
    fn test_auto_fix_empty_step_actions() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.steps = vec![
            TestStep { order: 1, action: String::new(), expected_outcome: None, notes: None },
            TestStep { order: 2, action: String::new(), expected_outcome: None, notes: None },
        ];
        let fixes = validator.auto_fix_test_case(&mut tc);
        assert_eq!(tc.steps[0].action, "Step 1 action");
        assert_eq!(tc.steps[1].action, "Step 2 action");
        assert!(fixes.iter().any(|f| f.contains("default action")));
    }

    #[test]
    fn test_auto_fix_truncate_long_fields() {
        let validator = TestCaseValidator::new();
        let mut tc = create_valid_test_case();
        tc.title = "a".repeat(250);
        tc.description = "b".repeat(1100);
        tc.expected_result = "c".repeat(600);
        
        let fixes = validator.auto_fix_test_case(&mut tc);
        
        assert!(tc.title.len() <= 200);
        assert!(tc.title.ends_with("..."));
        assert!(tc.description.len() <= 1000);
        assert!(tc.description.ends_with("..."));
        assert!(tc.expected_result.len() <= 500);
        assert!(tc.expected_result.ends_with("..."));
        
        assert!(fixes.iter().any(|f| f.contains("Truncated title")));
        assert!(fixes.iter().any(|f| f.contains("Truncated description")));
        assert!(fixes.iter().any(|f| f.contains("Truncated expected result")));
    }

    // ============================================================================
    // JSON Auto-Repair Tests
    // ============================================================================

    #[test]
    fn test_auto_repair_valid_json() {
        let validator = TestCaseValidator::new();
        let valid_json = r#"{"id": "TC001", "title": "Test"}"#;
        let result = validator.auto_repair_json(valid_json);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), valid_json);
    }

    #[test]
    fn test_auto_repair_missing_quotes() {
        let validator = TestCaseValidator::new();
        let malformed_json = r#"{id: "TC001", title: "Test"}"#;
        let result = validator.auto_repair_json(malformed_json);
        assert!(result.is_ok());
        let repaired = result.unwrap();
        assert!(repaired.contains(r#""id":"#));
        assert!(repaired.contains(r#""title":"#));
    }

    #[test]
    fn test_auto_repair_trailing_commas() {
        let validator = TestCaseValidator::new();
        let malformed_json = r#"{"id": "TC001", "title": "Test",}"#;
        let result = validator.auto_repair_json(malformed_json);
        assert!(result.is_ok());
        let repaired = result.unwrap();
        assert!(!repaired.contains(",}"));
    }

    #[test]
    fn test_auto_repair_single_quotes() {
        let validator = TestCaseValidator::new();
        let malformed_json = r#"{'id': 'TC001', 'title': 'Test'}"#;
        let result = validator.auto_repair_json(malformed_json);
        assert!(result.is_ok());
        let repaired = result.unwrap();
        assert!(!repaired.contains("'"));
        assert!(repaired.contains(r#""id""#));
    }

    #[test]
    fn test_auto_repair_missing_braces() {
        let validator = TestCaseValidator::new();
        let malformed_json = r#""id": "TC001", "title": "Test""#;
        let result = validator.auto_repair_json(malformed_json);
        assert!(result.is_ok());
        let repaired = result.unwrap();
        assert!(repaired.starts_with('{'));
        assert!(repaired.ends_with('}'));
    }

    #[test]
    fn test_auto_repair_missing_closing_braces() {
        let validator = TestCaseValidator::new();
        let malformed_json = r#"{"id": "TC001", "title": "Test""#;
        let result = validator.auto_repair_json(malformed_json);
        assert!(result.is_ok());
        let repaired = result.unwrap();
        // Should add missing closing braces and brackets
        assert_eq!(repaired.matches('{').count(), repaired.matches('}').count());
        assert_eq!(repaired.matches('[').count(), repaired.matches(']').count());
    }

    #[test]
    fn test_auto_repair_unfixable_json() {
        let validator = TestCaseValidator::new();
        let malformed_json = r#"completely invalid json content $$$ {{{"#;
        let result = validator.auto_repair_json(malformed_json);
        assert!(result.is_err());
        if let Err(AITestCaseError::ParseError { details, .. }) = result {
            assert!(details.contains("Auto-repair failed"));
        } else {
            panic!("Expected ParseError");
        }
    }

    // ============================================================================
    // Validate and Fix from JSON Tests
    // ============================================================================

    #[test]
    fn test_validate_and_fix_from_valid_json() {
        let validator = TestCaseValidator::new();
        let tc = create_valid_test_case();
        let json = serde_json::to_string(&tc).unwrap();
        
        let result = validator.validate_and_fix_from_json(&json);
        assert!(result.is_ok());
        let (fixed_tc, fixes) = result.unwrap();
        assert_eq!(tc.id, fixed_tc.id);
        assert!(fixes.is_empty()); // No fixes needed for valid test case
    }

    #[test]
    fn test_validate_and_fix_from_malformed_json() {
        let validator = TestCaseValidator::new();
        let malformed_json = r#"{
            "id": "",
            "title": "Test Case",
            "description": "Description",
            "steps": [{"order": 0, "action": ""}],
            "expected_result": "Result",
            "severity": "medium",
            "test_type": "functional",
            "metadata": {
                "created_at": "2023-01-01T00:00:00Z",
                "generated_by": "ai-gemini",
                "source_type": "requirements",
                "project_type": "web",
                "generation_version": "1.0.0"
            }
        }"#;
        
        let result = validator.validate_and_fix_from_json(malformed_json);
        assert!(result.is_ok());
        let (fixed_tc, fixes) = result.unwrap();
        
        // Should have fixed empty ID and step issues
        assert!(!fixed_tc.id.is_empty());
        assert_eq!(fixed_tc.steps[0].order, 1);
        assert!(!fixed_tc.steps[0].action.is_empty());
        assert!(!fixes.is_empty());
    }

    // ============================================================================
    // Requirements Input Validation Tests
    // ============================================================================

    #[test]
    fn test_validate_requirements_input_valid() {
        let validator = TestCaseValidator::new();
        assert!(validator.validate_requirements_input("Valid requirements text with enough content").is_ok());
    }

    #[test]
    fn test_validate_requirements_input_empty() {
        let validator = TestCaseValidator::new();
        let result = validator.validate_requirements_input("");
        assert!(result.is_err());
        if let Err(AITestCaseError::InputError { message }) = result {
            assert!(message.contains("cannot be empty"));
        } else {
            panic!("Expected InputError");
        }
    }

    #[test]
    fn test_validate_requirements_input_whitespace_only() {
        let validator = TestCaseValidator::new();
        let result = validator.validate_requirements_input("   \t\n   ");
        assert!(result.is_err());
        if let Err(AITestCaseError::InputError { message }) = result {
            assert!(message.contains("whitespace"));
        } else {
            panic!("Expected InputError");
        }
    }

    #[test]
    fn test_validate_requirements_input_too_short() {
        let validator = TestCaseValidator::new();
        let result = validator.validate_requirements_input("short");
        assert!(result.is_err());
        if let Err(AITestCaseError::InputError { message }) = result {
            assert!(message.contains("meaningful content"));
        } else {
            panic!("Expected InputError");
        }
    }

    // ============================================================================
    // Multiple Test Cases Validation Tests
    // ============================================================================

    #[test]
    fn test_validate_multiple_test_cases() {
        let validator = TestCaseValidator::new();
        let test_cases = vec![
            create_valid_test_case(),
            create_minimal_test_case(),
        ];
        
        let results = validator.validate_test_cases(&test_cases);
        assert_eq!(results.len(), 2);
        assert!(results[0].is_valid);
        assert!(results[1].is_valid);
    }

    #[test]
    fn test_validate_multiple_test_cases_with_errors() {
        let validator = TestCaseValidator::new();
        let mut invalid_tc = create_valid_test_case();
        invalid_tc.id = String::new();
        invalid_tc.title = String::new();
        
        let test_cases = vec![
            create_valid_test_case(),
            invalid_tc,
        ];
        
        let results = validator.validate_test_cases(&test_cases);
        assert_eq!(results.len(), 2);
        assert!(results[0].is_valid);
        assert!(!results[1].is_valid);
        assert!(!results[1].get_errors().is_empty());
    }
}
