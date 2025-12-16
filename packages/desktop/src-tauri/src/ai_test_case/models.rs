//! Data models for AI Test Case Generator
//!
//! Provides type-safe data structures for test cases, API requests/responses,
//! and generation options.
//! Requirements: 5.1, 5.2, 11.1

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Test case severity levels
/// Requirements: 5.1
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TestSeverity {
    Critical,
    High,
    Medium,
    Low,
}

impl Default for TestSeverity {
    fn default() -> Self {
        TestSeverity::Medium
    }
}

/// Test case types for categorization
/// Requirements: 5.1
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TestType {
    Functional,
    Integration,
    EdgeCase,
    ErrorHandling,
    Performance,
    Security,
    Accessibility,
}

impl Default for TestType {
    fn default() -> Self {
        TestType::Functional
    }
}

/// Source type for test case generation
/// Requirements: 3.1, 3.4
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SourceType {
    Requirements,
    RecordedActions,
    Manual,
}

impl Default for SourceType {
    fn default() -> Self {
        SourceType::Requirements
    }
}

/// Project type for context-aware generation
/// Requirements: 7.1
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ProjectType {
    Web,
    Mobile,
    Api,
    Desktop,
}

impl Default for ProjectType {
    fn default() -> Self {
        ProjectType::Web
    }
}

/// Individual test step within a test case
/// Requirements: 5.2
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TestStep {
    /// Step order (1-based)
    pub order: u32,
    /// Action description
    pub action: String,
    /// Expected outcome (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_outcome: Option<String>,
    /// Additional notes (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

impl TestStep {
    /// Create a new test step
    pub fn new(order: u32, action: impl Into<String>) -> Self {
        TestStep {
            order,
            action: action.into(),
            expected_outcome: None,
            notes: None,
        }
    }

    /// Add expected outcome to the step
    pub fn with_expected_outcome(mut self, outcome: impl Into<String>) -> Self {
        self.expected_outcome = Some(outcome.into());
        self
    }
}

/// Test case metadata
/// Requirements: 3.4
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TestCaseMetadata {
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Generator identifier
    pub generated_by: String,
    /// Source type
    pub source_type: SourceType,
    /// Project type
    pub project_type: ProjectType,
    /// Generation version
    pub generation_version: String,
}

impl Default for TestCaseMetadata {
    fn default() -> Self {
        TestCaseMetadata {
            created_at: Utc::now(),
            generated_by: "ai-gemini".to_string(),
            source_type: SourceType::Requirements,
            project_type: ProjectType::Web,
            generation_version: "1.0.0".to_string(),
        }
    }
}

/// Complete test case structure
/// Requirements: 5.1, 5.2
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TestCase {
    /// Unique identifier
    pub id: String,
    /// Test case title
    pub title: String,
    /// Test case description
    pub description: String,
    /// Preconditions (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preconditions: Option<String>,
    /// Test steps
    pub steps: Vec<TestStep>,
    /// Expected result
    pub expected_result: String,
    /// Severity level
    pub severity: TestSeverity,
    /// Test type
    pub test_type: TestType,
    /// Metadata
    pub metadata: TestCaseMetadata,
}

impl TestCase {
    /// Create a new test case with required fields
    pub fn new(
        id: impl Into<String>,
        title: impl Into<String>,
        description: impl Into<String>,
        expected_result: impl Into<String>,
    ) -> Self {
        TestCase {
            id: id.into(),
            title: title.into(),
            description: description.into(),
            preconditions: None,
            steps: Vec::new(),
            expected_result: expected_result.into(),
            severity: TestSeverity::default(),
            test_type: TestType::default(),
            metadata: TestCaseMetadata::default(),
        }
    }

    /// Add a step to the test case
    pub fn add_step(&mut self, step: TestStep) {
        self.steps.push(step);
    }
}

/// Complexity level for generation
/// Requirements: 9.1
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ComplexityLevel {
    /// 3-5 test cases
    Basic,
    /// 5-10 test cases
    Detailed,
    /// 10-20 test cases
    Comprehensive,
}

impl Default for ComplexityLevel {
    fn default() -> Self {
        ComplexityLevel::Detailed
    }
}

/// Options for test case generation
/// Requirements: 9.1, 9.3
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationOptions {
    /// Project type for context
    pub project_type: ProjectType,
    /// Complexity level
    pub complexity_level: ComplexityLevel,
    /// Include edge cases
    pub include_edge_cases: bool,
    /// Include error scenarios
    pub include_error_scenarios: bool,
    /// Maximum number of test cases
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_test_cases: Option<u32>,
    /// Custom context for generation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_context: Option<String>,
}

impl Default for GenerationOptions {
    fn default() -> Self {
        GenerationOptions {
            project_type: ProjectType::Web,
            complexity_level: ComplexityLevel::Detailed,
            include_edge_cases: true,
            include_error_scenarios: true,
            max_test_cases: None,
            custom_context: None,
        }
    }
}

/// Token usage information from API
/// Requirements: 10.1
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TokenUsage {
    /// Input/prompt tokens
    pub prompt_tokens: u32,
    /// Output/completion tokens
    pub completion_tokens: u32,
    /// Total tokens
    pub total_tokens: u32,
}

/// Response metadata
/// Requirements: 8.5, 10.1
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseMetadata {
    /// Processing time in milliseconds
    pub processing_time_ms: u64,
    /// Token usage (if available)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_usage: Option<TokenUsage>,
    /// API version
    pub api_version: String,
    /// Unique generation ID
    pub generation_id: String,
}

/// Generation response
/// Requirements: 2.5
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationResponse {
    /// Success status
    pub success: bool,
    /// Generated test cases
    pub test_cases: Vec<TestCase>,
    /// Response message
    pub message: String,
    /// Response metadata
    pub metadata: ResponseMetadata,
}

/// Recorded action for documentation generation
/// Requirements: 3.1
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordedAction {
    /// Action type (click, type, scroll, etc.)
    pub action_type: String,
    /// Target element or coordinates
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    /// Action value (text input, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    /// Screenshot reference (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub screenshot: Option<String>,
}

/// Context for documentation generation
/// Requirements: 3.3, 3.4
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationContext {
    /// Script name
    pub script_name: String,
    /// Project type
    pub project_type: ProjectType,
    /// Additional context
    #[serde(skip_serializing_if = "Option::is_none")]
    pub additional_context: Option<String>,
}

/// Documentation response
/// Requirements: 3.4, 3.5
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationResponse {
    /// Success status
    pub success: bool,
    /// Generated title
    pub title: String,
    /// Generated description
    pub description: String,
    /// Generated preconditions
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preconditions: Option<String>,
    /// Generated steps
    pub steps: Vec<TestStep>,
    /// Response message
    pub message: String,
    /// Response metadata
    pub metadata: ResponseMetadata,
}

// ============================================================================
// Gemini API Models
// ============================================================================

/// Gemini API request structure
#[derive(Debug, Serialize)]
pub struct GeminiRequest {
    pub contents: Vec<GeminiContent>,
    #[serde(rename = "generationConfig")]
    pub generation_config: GeminiGenerationConfig,
}

/// Gemini content structure
#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiContent {
    pub parts: Vec<GeminiPart>,
}

/// Gemini part structure
#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiPart {
    pub text: String,
}

/// Gemini generation configuration
#[derive(Debug, Serialize)]
pub struct GeminiGenerationConfig {
    pub temperature: f32,
    #[serde(rename = "responseMimeType")]
    pub response_mime_type: String,
    #[serde(rename = "maxOutputTokens")]
    pub max_output_tokens: u32,
}

impl Default for GeminiGenerationConfig {
    fn default() -> Self {
        GeminiGenerationConfig {
            temperature: 0.7,
            response_mime_type: "application/json".to_string(),
            max_output_tokens: 8192,
        }
    }
}

/// Gemini API response structure
#[derive(Debug, Deserialize)]
pub struct GeminiResponse {
    pub candidates: Option<Vec<GeminiCandidate>>,
    #[serde(rename = "usageMetadata")]
    pub usage_metadata: Option<GeminiUsageMetadata>,
    pub error: Option<GeminiError>,
}

/// Gemini candidate structure
#[derive(Debug, Deserialize)]
pub struct GeminiCandidate {
    pub content: GeminiContent,
    #[serde(rename = "finishReason")]
    pub finish_reason: Option<String>,
}

/// Gemini usage metadata
#[derive(Debug, Deserialize)]
pub struct GeminiUsageMetadata {
    #[serde(rename = "promptTokenCount")]
    pub prompt_token_count: u32,
    #[serde(rename = "candidatesTokenCount")]
    pub candidates_token_count: Option<u32>,
    #[serde(rename = "totalTokenCount")]
    pub total_token_count: u32,
}

/// Gemini error structure
#[derive(Debug, Deserialize)]
pub struct GeminiError {
    pub code: Option<i32>,
    pub message: String,
    pub status: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn test_test_case_creation() {
        let tc = TestCase::new("TC001", "Login Test", "Test user login", "User logged in");
        assert_eq!(tc.id, "TC001");
        assert_eq!(tc.title, "Login Test");
        assert!(tc.steps.is_empty());
    }

    #[test]
    fn test_test_step_creation() {
        let step = TestStep::new(1, "Click login button")
            .with_expected_outcome("Login form appears");
        assert_eq!(step.order, 1);
        assert_eq!(step.action, "Click login button");
        assert_eq!(step.expected_outcome, Some("Login form appears".to_string()));
    }

    #[test]
    fn test_serialization_roundtrip() {
        let tc = TestCase::new("TC001", "Test", "Description", "Expected");
        let json = serde_json::to_string(&tc).unwrap();
        let deserialized: TestCase = serde_json::from_str(&json).unwrap();
        assert_eq!(tc.id, deserialized.id);
        assert_eq!(tc.title, deserialized.title);
    }

    // Property test generators
    prop_compose! {
        fn arb_test_step()(
            order in 1u32..100,
            action in "[a-zA-Z0-9 ]{1,100}",
            expected_outcome in prop::option::of("[a-zA-Z0-9 ]{1,100}"),
            notes in prop::option::of("[a-zA-Z0-9 ]{1,100}")
        ) -> TestStep {
            TestStep {
                order,
                action,
                expected_outcome,
                notes,
            }
        }
    }

    prop_compose! {
        fn arb_test_case()(
            id in "[a-zA-Z0-9]{1,20}",
            title in "[a-zA-Z0-9 ]{1,100}",
            description in "[a-zA-Z0-9 ]{1,200}",
            preconditions in prop::option::of("[a-zA-Z0-9 ]{1,100}"),
            steps in prop::collection::vec(arb_test_step(), 0..10),
            expected_result in "[a-zA-Z0-9 ]{1,100}",
            severity in prop::sample::select(vec![
                TestSeverity::Critical,
                TestSeverity::High,
                TestSeverity::Medium,
                TestSeverity::Low
            ]),
            test_type in prop::sample::select(vec![
                TestType::Functional,
                TestType::Integration,
                TestType::EdgeCase,
                TestType::ErrorHandling,
                TestType::Performance,
                TestType::Security,
                TestType::Accessibility
            ])
        ) -> TestCase {
            TestCase {
                id,
                title,
                description,
                preconditions,
                steps,
                expected_result,
                severity,
                test_type,
                metadata: TestCaseMetadata::default(),
            }
        }
    }

    // **Feature: ai-test-case-generator, Property 4: JSON Schema Enforcement**
    // **Validates: Requirements 5.1, 5.4**
    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]
        
        #[test]
        fn property_json_schema_enforcement(test_case in arb_test_case()) {
            // Serialize the test case to JSON
            let json_result = serde_json::to_string(&test_case);
            prop_assert!(json_result.is_ok(), "Test case should serialize to JSON");
            
            let json_str = json_result.unwrap();
            
            // Parse back to ensure it's valid JSON
            let parsed_json: serde_json::Value = serde_json::from_str(&json_str)
                .expect("Generated JSON should be valid");
            
            // Verify all required fields are present in the JSON
            prop_assert!(parsed_json.get("id").is_some(), "JSON must contain 'id' field");
            prop_assert!(parsed_json.get("title").is_some(), "JSON must contain 'title' field");
            prop_assert!(parsed_json.get("description").is_some(), "JSON must contain 'description' field");
            prop_assert!(parsed_json.get("steps").is_some(), "JSON must contain 'steps' field");
            prop_assert!(parsed_json.get("expected_result").is_some(), "JSON must contain 'expected_result' field");
            prop_assert!(parsed_json.get("severity").is_some(), "JSON must contain 'severity' field");
            prop_assert!(parsed_json.get("test_type").is_some(), "JSON must contain 'test_type' field");
            prop_assert!(parsed_json.get("metadata").is_some(), "JSON must contain 'metadata' field");
            
            // Verify field types
            prop_assert!(parsed_json["id"].is_string(), "'id' field must be string");
            prop_assert!(parsed_json["title"].is_string(), "'title' field must be string");
            prop_assert!(parsed_json["description"].is_string(), "'description' field must be string");
            prop_assert!(parsed_json["steps"].is_array(), "'steps' field must be array");
            prop_assert!(parsed_json["expected_result"].is_string(), "'expected_result' field must be string");
            prop_assert!(parsed_json["severity"].is_string(), "'severity' field must be string");
            prop_assert!(parsed_json["test_type"].is_string(), "'test_type' field must be string");
            prop_assert!(parsed_json["metadata"].is_object(), "'metadata' field must be object");
            
            // Verify steps array structure
            if let Some(steps_array) = parsed_json["steps"].as_array() {
                for step in steps_array {
                    prop_assert!(step.get("order").is_some(), "Each step must have 'order' field");
                    prop_assert!(step.get("action").is_some(), "Each step must have 'action' field");
                    prop_assert!(step["order"].is_number(), "Step 'order' must be number");
                    prop_assert!(step["action"].is_string(), "Step 'action' must be string");
                }
            }
            
            // Deserialize back to TestCase to ensure round-trip consistency
            let deserialized_result: Result<TestCase, _> = serde_json::from_str(&json_str);
            prop_assert!(deserialized_result.is_ok(), "JSON should deserialize back to TestCase");
            
            let deserialized = deserialized_result.unwrap();
            
            // Verify essential fields are preserved
            prop_assert_eq!(test_case.id, deserialized.id);
            prop_assert_eq!(test_case.title, deserialized.title);
            prop_assert_eq!(test_case.description, deserialized.description);
            prop_assert_eq!(test_case.expected_result, deserialized.expected_result);
            prop_assert_eq!(test_case.severity, deserialized.severity);
            prop_assert_eq!(test_case.test_type, deserialized.test_type);
            prop_assert_eq!(test_case.steps.len(), deserialized.steps.len());
        }

        // **Feature: ai-test-case-generator, Property 10: Test Step Structure Consistency**
        // **Validates: Requirements 5.2**
        #[test]
        fn property_test_step_structure_consistency(steps in prop::collection::vec(arb_test_step(), 1..20)) {
            // Verify each step has the required structure
            for step in &steps {
                // Required fields must be present and valid
                prop_assert!(step.order > 0, "Step order must be positive");
                prop_assert!(!step.action.is_empty(), "Step action must not be empty");
                
                // Optional fields should be properly typed when present
                if let Some(ref outcome) = step.expected_outcome {
                    prop_assert!(!outcome.is_empty(), "Expected outcome, if present, must not be empty");
                }
                
                if let Some(ref notes) = step.notes {
                    prop_assert!(!notes.is_empty(), "Notes, if present, must not be empty");
                }
            }
            
            // Test serialization consistency
            let json_result = serde_json::to_string(&steps);
            prop_assert!(json_result.is_ok(), "Steps should serialize to JSON");
            
            let json_str = json_result.unwrap();
            let parsed_json: serde_json::Value = serde_json::from_str(&json_str)
                .expect("Generated JSON should be valid");
            
            // Verify JSON structure
            prop_assert!(parsed_json.is_array(), "Steps JSON should be an array");
            
            if let Some(steps_array) = parsed_json.as_array() {
                prop_assert_eq!(steps_array.len(), steps.len(), "JSON array length should match original");
                
                for (i, step_json) in steps_array.iter().enumerate() {
                    // Verify required fields are present
                    prop_assert!(step_json.get("order").is_some(), "Step {} must have 'order' field", i);
                    prop_assert!(step_json.get("action").is_some(), "Step {} must have 'action' field", i);
                    
                    // Verify field types
                    prop_assert!(step_json["order"].is_number(), "Step {} 'order' must be number", i);
                    prop_assert!(step_json["action"].is_string(), "Step {} 'action' must be string", i);
                    
                    // Verify optional fields are properly handled
                    if step_json.get("expected_outcome").is_some() {
                        prop_assert!(step_json["expected_outcome"].is_string(), 
                                   "Step {} 'expected_outcome' must be string when present", i);
                    }
                    
                    if step_json.get("notes").is_some() {
                        prop_assert!(step_json["notes"].is_string(), 
                                   "Step {} 'notes' must be string when present", i);
                    }
                }
            }
            
            // Test deserialization round-trip
            let deserialized_result: Result<Vec<TestStep>, _> = serde_json::from_str(&json_str);
            prop_assert!(deserialized_result.is_ok(), "JSON should deserialize back to Vec<TestStep>");
            
            let deserialized = deserialized_result.unwrap();
            prop_assert_eq!(steps.len(), deserialized.len(), "Deserialized length should match original");
            
            // Verify each step is preserved correctly
            for (original, deserialized) in steps.iter().zip(deserialized.iter()) {
                prop_assert_eq!(original.order, deserialized.order, "Step order should be preserved");
                prop_assert_eq!(&original.action, &deserialized.action, "Step action should be preserved");
                prop_assert_eq!(&original.expected_outcome, &deserialized.expected_outcome, 
                              "Step expected_outcome should be preserved");
                prop_assert_eq!(&original.notes, &deserialized.notes, "Step notes should be preserved");
            }
        }
    }
}
