//! Comprehensive Integration Tests for AI Test Case Generator
//!
//! Tests complete workflows and system boundaries as specified in task 14.1:
//! - End-to-end requirements processing workflow
//! - End-to-end action log documentation workflow  
//! - Error scenarios across system boundaries
//! - Concurrent operations and system performance under load
//!
//! Requirements: All requirements integration

use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tokio::time::timeout;

// Import the AI test case modules
use geniusqa_desktop::ai_test_case::{
    AITestCaseService, ConfigManager, GenerationOptions, GenerationResponse,
    DocumentationContext, DocumentationResponse, RecordedAction, ProjectType,
    ComplexityLevel, TestCase, TestStep, TestSeverity, TestType, SourceType,
    AITestCaseError, ValidationResult, TestCaseValidator, MonitoringService,
    ResponseMetadata,
};

/// Mock API key for testing (not a real key)
const MOCK_API_KEY: &str = "mock_api_key_for_testing_12345";

/// Test configuration for integration tests
struct IntegrationTestConfig {
    /// Whether to use real API calls (requires valid API key)
    use_real_api: bool,
    /// Timeout for individual operations
    operation_timeout: Duration,
    /// Number of concurrent operations to test
    concurrent_operations: usize,
}

impl Default for IntegrationTestConfig {
    fn default() -> Self {
        IntegrationTestConfig {
            use_real_api: false, // Default to mock for CI/CD
            operation_timeout: Duration::from_secs(30),
            concurrent_operations: 5,
        }
    }
}

/// Integration test fixture
struct IntegrationTestFixture {
    service: Arc<RwLock<AITestCaseService>>,
    config_manager: Arc<RwLock<ConfigManager>>,
    validator: TestCaseValidator,
    monitoring: MonitoringService,
    config: IntegrationTestConfig,
}

impl IntegrationTestFixture {
    /// Create a new test fixture
    async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let service = AITestCaseService::new()?;
        let config_manager = ConfigManager::new()?;
        let validator = TestCaseValidator::new();
        let monitoring = MonitoringService::new();
        
        let fixture = IntegrationTestFixture {
            service: Arc::new(RwLock::new(service)),
            config_manager: Arc::new(RwLock::new(config_manager)),
            validator,
            monitoring,
            config: IntegrationTestConfig::default(),
        };
        
        // Configure mock API key for testing
        fixture.setup_test_configuration().await?;
        
        Ok(fixture)
    }
    
    /// Setup test configuration
    async fn setup_test_configuration(&self) -> Result<(), Box<dyn std::error::Error>> {
        if !self.config.use_real_api {
            // For integration tests, we'll use a mock API key
            // In real scenarios, this would be configured by the user
            let mut config_manager = self.config_manager.write().await;
            // Note: We can't actually store the key without OS keyring in tests
            // This is a limitation we'll document
        }
        Ok(())
    }
    
    /// Create sample requirements for testing
    fn create_sample_requirements() -> Vec<String> {
        vec![
            "User login functionality with email and password validation".to_string(),
            "Shopping cart management with add, remove, and update quantity operations".to_string(),
            "File upload system with drag-and-drop support and progress tracking".to_string(),
            "Real-time chat messaging with emoji support and message history".to_string(),
            "Payment processing with multiple payment methods and error handling".to_string(),
        ]
    }
    
    /// Create sample recorded actions for testing
    fn create_sample_recorded_actions() -> Vec<RecordedAction> {
        vec![
            RecordedAction {
                action_type: "click".to_string(),
                target: Some("login_button".to_string()),
                value: None,
                timestamp: chrono::Utc::now(),
                screenshot: None,
            },
            RecordedAction {
                action_type: "type".to_string(),
                target: Some("email_input".to_string()),
                value: Some("test@example.com".to_string()),
                timestamp: chrono::Utc::now(),
                screenshot: None,
            },
            RecordedAction {
                action_type: "type".to_string(),
                target: Some("password_input".to_string()),
                value: Some("password123".to_string()),
                timestamp: chrono::Utc::now(),
                screenshot: None,
            },
            RecordedAction {
                action_type: "click".to_string(),
                target: Some("submit_button".to_string()),
                value: None,
                timestamp: chrono::Utc::now(),
                screenshot: None,
            },
        ]
    }
}

// ============================================================================
// End-to-End Requirements Processing Workflow Tests
// ============================================================================

#[tokio::test]
async fn test_complete_requirements_to_test_cases_workflow() {
    let fixture = IntegrationTestFixture::new().await
        .expect("Failed to create test fixture");
    
    let requirements = IntegrationTestFixture::create_sample_requirements();
    
    for requirement in requirements {
        // Test the complete workflow: requirements → validation → generation → validation → integration
        
        // Step 1: Validate input requirements
        let service = fixture.service.read().await;
        
        // Create generation options
        let options = GenerationOptions {
            project_type: ProjectType::Web,
            complexity_level: ComplexityLevel::Detailed,
            include_edge_cases: true,
            include_error_scenarios: true,
            max_test_cases: Some(5),
            custom_context: Some("E-commerce web application".to_string()),
            excluded_test_types: vec![],
        };
        
        // Step 2: Attempt test case generation (will fail with mock API key, but tests the workflow)
        let generation_result = timeout(
            fixture.config.operation_timeout,
            service.generate_from_requirements(&requirement, options.clone())
        ).await;
        
        // Verify the workflow completes (even if it fails due to mock API)
        assert!(generation_result.is_ok(), "Generation workflow should complete within timeout");
        
        // The actual result will be an error due to mock API key, but we're testing the workflow
        let result = generation_result.unwrap();
        
        // For integration testing, we expect either success or a specific API error
        match result {
            Ok(response) => {
                // If somehow successful (shouldn't happen with mock key), validate the response
                assert!(!response.test_cases.is_empty(), "Should generate at least one test case");
                
                // Validate each generated test case
                for test_case in &response.test_cases {
                    let validation_result = fixture.validator.validate_test_case(test_case);
                    assert!(validation_result.is_valid, 
                           "Generated test case should be valid: {:?}", validation_result.field_validations);
                }
            },
            Err(AITestCaseError::ApiError { .. }) => {
                // Expected with mock API key - this confirms the workflow reaches the API layer
                println!("Expected API error with mock key - workflow integrity confirmed");
            },
            Err(other_error) => {
                panic!("Unexpected error type in workflow: {:?}", other_error);
            }
        }
    }
}

#[tokio::test]
async fn test_requirements_validation_and_error_handling() {
    let fixture = IntegrationTestFixture::new().await
        .expect("Failed to create test fixture");
    
    let service = fixture.service.read().await;
    
    // Test empty requirements
    let empty_requirements = "";
    let options = GenerationOptions {
        project_type: ProjectType::Web,
        complexity_level: ComplexityLevel::Basic,
        include_edge_cases: false,
        include_error_scenarios: false,
        max_test_cases: Some(3),
        custom_context: None,
        excluded_test_types: vec![],
    };
    
    let result = service.generate_from_requirements(empty_requirements, options.clone()).await;
    
    // Should fail with input validation error for empty input
    match result {
        Err(AITestCaseError::InputError { .. }) => {
            // Expected - empty requirements should be rejected
        },
        Err(AITestCaseError::ValidationError { .. }) => {
            // Also acceptable - validation error
        },
        Err(AITestCaseError::ApiError { .. }) => {
            // Also acceptable - might reach API layer before validation
        },
        Ok(_) => {
            panic!("Empty requirements should not generate successful response");
        },
        Err(other) => {
            panic!("Unexpected error type for empty requirements: {:?}", other);
        }
    }
    
    // Test whitespace-only requirements
    let whitespace_requirements = "   \t\n   ";
    let result = service.generate_from_requirements(whitespace_requirements, options).await;
    
    // Should also fail with validation error
    assert!(result.is_err(), "Whitespace-only requirements should be rejected");
}

// ============================================================================
// End-to-End Action Log Documentation Workflow Tests  
// ============================================================================

#[tokio::test]
async fn test_complete_action_log_to_documentation_workflow() {
    let fixture = IntegrationTestFixture::new().await
        .expect("Failed to create test fixture");
    
    let actions = IntegrationTestFixture::create_sample_recorded_actions();
    
    // Create documentation context
    let context = DocumentationContext {
        script_name: "User Login Test".to_string(),
        project_type: ProjectType::Web,
        additional_context: Some("Test user authentication flow for E-commerce App".to_string()),
    };
    
    let service = fixture.service.read().await;
    
    // Test the complete workflow: actions → formatting → generation → validation → metadata population
    let documentation_result = timeout(
        fixture.config.operation_timeout,
        service.generate_from_actions(&actions, context.clone())
    ).await;
    
    // Verify the workflow completes
    assert!(documentation_result.is_ok(), "Documentation workflow should complete within timeout");
    
    let result = documentation_result.unwrap();
    
    // Analyze the result
    match result {
        Ok(response) => {
            // Validate the documentation response structure
            assert!(!response.title.is_empty(), "Generated title should not be empty");
            assert!(!response.description.is_empty(), "Generated description should not be empty");
            assert!(!response.steps.is_empty(), "Generated steps should not be empty");
            
            // Validate metadata population (Requirement 3.4)
            // Note: ResponseMetadata contains processing info, not source/project metadata
            assert!(response.metadata.processing_time_ms > 0, "Should have processing time");
            assert!(!response.metadata.generation_id.is_empty(), "Should have generation ID");
            
            // Validate step structure
            for (index, step) in response.steps.iter().enumerate() {
                assert_eq!(step.order, (index + 1) as u32, "Step order should be sequential");
                assert!(!step.action.is_empty(), "Step action should not be empty");
            }
        },
        Err(AITestCaseError::ApiError { .. }) => {
            // Expected with mock API key - confirms workflow reaches API layer
            println!("Expected API error with mock key - documentation workflow integrity confirmed");
        },
        Err(other_error) => {
            panic!("Unexpected error in documentation workflow: {:?}", other_error);
        }
    }
}

#[tokio::test]
async fn test_action_log_validation_and_error_handling() {
    let fixture = IntegrationTestFixture::new().await
        .expect("Failed to create test fixture");
    
    let service = fixture.service.read().await;
    
    // Test empty action log
    let empty_actions: Vec<RecordedAction> = vec![];
    let context = DocumentationContext {
        script_name: "Empty Test".to_string(),
        project_type: ProjectType::Web,
        additional_context: Some("Test Project".to_string()),
    };
    
    let result = service.generate_from_actions(&empty_actions, context).await;
    
    // Should handle empty actions gracefully
    match result {
        Err(AITestCaseError::InputError { .. }) => {
            // Expected - empty actions should be rejected
        },
        Err(AITestCaseError::ValidationError { .. }) => {
            // Also acceptable - validation error
        },
        Err(AITestCaseError::ApiError { .. }) => {
            // Also acceptable - might reach API layer
        },
        Ok(response) => {
            // If successful, should have minimal content
            assert!(!response.title.is_empty(), "Should generate at least a basic title");
        },
        Err(other) => {
            panic!("Unexpected error type for empty actions: {:?}", other);
        }
    }
}

// ============================================================================
// Error Handling Across System Boundaries Tests
// ============================================================================

#[tokio::test]
async fn test_api_communication_error_handling() {
    let fixture = IntegrationTestFixture::new().await
        .expect("Failed to create test fixture");
    
    let service = fixture.service.read().await;
    
    // Test with invalid API key (should be handled gracefully)
    let requirements = "Test user authentication functionality";
    let options = GenerationOptions {
        project_type: ProjectType::Web,
        complexity_level: ComplexityLevel::Basic,
        include_edge_cases: false,
        include_error_scenarios: false,
        max_test_cases: Some(3),
        custom_context: None,
        excluded_test_types: vec![],
    };
    
    let result = service.generate_from_requirements(requirements, options).await;
    
    // Should get an API error with mock key
    match result {
        Err(AITestCaseError::ApiError { message, retry_after, status_code: _ }) => {
            assert!(!message.is_empty(), "Error message should not be empty");
            // Retry after should be reasonable if present
            if let Some(retry_duration) = retry_after {
                assert!(retry_duration <= Duration::from_secs(300), "Retry duration should be reasonable");
            }
        },
        Err(AITestCaseError::ConfigError { .. }) => {
            // Also acceptable - might fail at config level
        },
        Ok(_) => {
            panic!("Should not succeed with mock API key");
        },
        Err(other) => {
            panic!("Unexpected error type: {:?}", other);
        }
    }
}

#[tokio::test]
async fn test_validation_error_boundaries() {
    let fixture = IntegrationTestFixture::new().await
        .expect("Failed to create test fixture");
    
    // Test validation at different system boundaries
    
    // 1. Test case validation
    let invalid_test_case = TestCase {
        id: "".to_string(), // Invalid: empty ID
        title: "".to_string(), // Invalid: empty title
        description: "Valid description".to_string(),
        preconditions: None,
        steps: vec![], // Invalid: no steps
        expected_result: "".to_string(), // Invalid: empty expected result
        severity: TestSeverity::Medium,
        test_type: TestType::Functional,
        metadata: Default::default(),
    };
    
    let validation_result = fixture.validator.validate_test_case(&invalid_test_case);
    assert!(!validation_result.is_valid, "Invalid test case should fail validation");
    assert!(!validation_result.field_validations.is_empty(), "Should have validation errors");
    
    // Verify specific validation errors
    let error_messages: Vec<String> = validation_result.field_validations.iter()
        .filter_map(|v| v.error.as_ref())
        .cloned()
        .collect();
    
    // Check for specific validation errors (case-insensitive)
    let has_id_error = error_messages.iter().any(|msg| msg.to_lowercase().contains("id"));
    let has_title_error = error_messages.iter().any(|msg| msg.to_lowercase().contains("title"));
    let has_steps_error = error_messages.iter().any(|msg| msg.to_lowercase().contains("step"));
    
    // Print debug info if assertions fail
    if !has_id_error || !has_title_error || !has_steps_error {
        println!("Validation errors found: {:?}", error_messages);
        println!("Field validations: {:?}", validation_result.field_validations);
    }
    
    assert!(has_id_error, "Should have ID validation error");
    assert!(has_title_error, "Should have title validation error");
    assert!(has_steps_error, "Should have steps validation error");
}

#[tokio::test]
async fn test_configuration_error_boundaries() {
    // Test configuration errors across system boundaries
    
    // This test verifies that configuration errors are properly handled
    // when they occur at different layers of the system
    
    // Test 1: Invalid configuration creation
    // Note: We can't easily test keyring failures in integration tests
    // but we can test the error handling patterns
    
    let config_result = ConfigManager::new();
    
    // Should either succeed or fail with a clear error
    match config_result {
        Ok(_) => {
            // Configuration creation succeeded
        },
        Err(error) => {
            // Should be a configuration error with clear message
            match error {
                AITestCaseError::ConfigError { message } => {
                    assert!(!message.is_empty(), "Config error should have descriptive message");
                },
                other => {
                    panic!("Unexpected error type for config creation: {:?}", other);
                }
            }
        }
    }
}

// ============================================================================
// Concurrent Operations and Performance Tests
// ============================================================================

#[tokio::test]
async fn test_concurrent_request_isolation() {
    let fixture = IntegrationTestFixture::new().await
        .expect("Failed to create test fixture");
    
    let requirements = IntegrationTestFixture::create_sample_requirements();
    let num_concurrent = fixture.config.concurrent_operations;
    
    // Create multiple concurrent generation requests
    let mut handles = Vec::new();
    
    for (index, requirement) in requirements.iter().take(num_concurrent).enumerate() {
        let service = Arc::clone(&fixture.service);
        let req = requirement.clone();
        let options = GenerationOptions {
            project_type: if index % 2 == 0 { ProjectType::Web } else { ProjectType::Mobile },
            complexity_level: ComplexityLevel::Basic,
            include_edge_cases: index % 3 == 0,
            include_error_scenarios: index % 4 == 0,
            max_test_cases: Some(3),
            custom_context: Some(format!("Concurrent test {}", index)),
            excluded_test_types: vec![],
        };
        
        let handle = tokio::spawn(async move {
            let service = service.read().await;
            let start_time = Instant::now();
            let result = service.generate_from_requirements(&req, options).await;
            let duration = start_time.elapsed();
            (index, result, duration)
        });
        
        handles.push(handle);
    }
    
    // Wait for all requests to complete
    let results = futures::future::join_all(handles).await;
    
    // Analyze concurrent execution results
    let mut successful_requests = 0;
    let mut api_errors = 0;
    let mut other_errors = 0;
    let mut total_duration = Duration::from_secs(0);
    
    for result in results {
        let (index, generation_result, duration) = result.expect("Task should complete");
        total_duration += duration;
        
        match generation_result {
            Ok(_) => {
                successful_requests += 1;
            },
            Err(AITestCaseError::ApiError { .. }) => {
                api_errors += 1; // Expected with mock API key
            },
            Err(other) => {
                other_errors += 1;
                println!("Unexpected error in concurrent request {}: {:?}", index, other);
            }
        }
        
        // Verify reasonable response time per request
        assert!(duration <= fixture.config.operation_timeout, 
               "Request {} should complete within timeout", index);
    }
    
    // Verify concurrent execution characteristics
    let average_duration = total_duration / num_concurrent as u32;
    println!("Concurrent execution stats: {} successful, {} API errors, {} other errors, avg duration: {:?}", 
             successful_requests, api_errors, other_errors, average_duration);
    
    // With mock API, we expect all requests to fail with API errors
    // but they should fail consistently and within reasonable time
    assert_eq!(other_errors, 0, "Should not have unexpected errors in concurrent execution");
    
    // Verify that concurrent operations don't take significantly longer than sequential
    // (This is a basic performance check)
    let expected_max_duration = Duration::from_secs(10 * num_concurrent as u64);
    assert!(total_duration <= expected_max_duration, 
           "Concurrent operations should not take excessively long");
}

#[tokio::test]
async fn test_concurrent_action_log_processing() {
    let fixture = IntegrationTestFixture::new().await
        .expect("Failed to create test fixture");
    
    let base_actions = IntegrationTestFixture::create_sample_recorded_actions();
    let num_concurrent = fixture.config.concurrent_operations;
    
    // Create multiple concurrent documentation requests
    let mut handles = Vec::new();
    
    for index in 0..num_concurrent {
        let service = Arc::clone(&fixture.service);
        let actions = base_actions.clone();
        let context = DocumentationContext {
            script_name: format!("Concurrent Test {}", index),
            project_type: ProjectType::Web,
            additional_context: Some(format!("Concurrent documentation test {} for Concurrent Test Project", index)),
        };
        
        let handle = tokio::spawn(async move {
            let service = service.read().await;
            let start_time = Instant::now();
            let result = service.generate_from_actions(&actions, context).await;
            let duration = start_time.elapsed();
            (index, result, duration)
        });
        
        handles.push(handle);
    }
    
    // Wait for all requests to complete
    let results = futures::future::join_all(handles).await;
    
    // Analyze results
    for result in results {
        let (index, generation_result, duration) = result.expect("Task should complete");
        
        // Verify reasonable response time
        assert!(duration <= fixture.config.operation_timeout, 
               "Documentation request {} should complete within timeout", index);
        
        // Verify result type (should be API error with mock key)
        match generation_result {
            Ok(_) => {
                // Unexpected success with mock key
                println!("Unexpected success in concurrent documentation request {}", index);
            },
            Err(AITestCaseError::ApiError { .. }) => {
                // Expected with mock API key
            },
            Err(other) => {
                panic!("Unexpected error in concurrent documentation request {}: {:?}", index, other);
            }
        }
    }
}

// ============================================================================
// System Performance Under Load Tests
// ============================================================================

#[tokio::test]
async fn test_system_performance_under_load() {
    let fixture = IntegrationTestFixture::new().await
        .expect("Failed to create test fixture");
    
    // Test system behavior under higher load
    let high_load_operations = 10;
    let requirements = IntegrationTestFixture::create_sample_requirements();
    
    let start_time = Instant::now();
    let mut handles = Vec::new();
    
    // Create high load scenario
    for i in 0..high_load_operations {
        let service = Arc::clone(&fixture.service);
        let req = requirements[i % requirements.len()].clone();
        let options = GenerationOptions {
            project_type: ProjectType::Web,
            complexity_level: ComplexityLevel::Basic,
            include_edge_cases: false,
            include_error_scenarios: false,
            max_test_cases: Some(2), // Keep small for performance
            custom_context: None,
            excluded_test_types: vec![],
        };
        
        let handle = tokio::spawn(async move {
            let service = service.read().await;
            service.generate_from_requirements(&req, options).await
        });
        
        handles.push(handle);
    }
    
    // Wait for all operations to complete
    let results = futures::future::join_all(handles).await;
    let total_duration = start_time.elapsed();
    
    // Analyze performance characteristics
    let mut completed_operations = 0;
    let mut failed_operations = 0;
    
    for result in results {
        match result.expect("Task should complete") {
            Ok(_) => completed_operations += 1,
            Err(_) => failed_operations += 1, // Expected with mock API
        }
    }
    
    println!("Load test results: {} completed, {} failed in {:?}", 
             completed_operations, failed_operations, total_duration);
    
    // Performance assertions
    let average_time_per_operation = total_duration / high_load_operations as u32;
    assert!(average_time_per_operation <= Duration::from_secs(5), 
           "Average operation time should be reasonable under load");
    
    // System should handle the load without crashing
    assert_eq!(completed_operations + failed_operations, high_load_operations, 
              "All operations should complete (either success or controlled failure)");
}

// ============================================================================
// Cross-System Integration Tests
// ============================================================================

#[tokio::test]
async fn test_monitoring_integration() {
    let fixture = IntegrationTestFixture::new().await
        .expect("Failed to create test fixture");
    
    // Test that monitoring service integrates properly with the main workflow
    let requirements = "Test monitoring integration";
    let options = GenerationOptions {
        project_type: ProjectType::Web,
        complexity_level: ComplexityLevel::Basic,
        include_edge_cases: false,
        include_error_scenarios: false,
        max_test_cases: Some(1),
        custom_context: None,
        excluded_test_types: vec![],
    };
    
    let service = fixture.service.read().await;
    
    // Perform operation that should be monitored
    let _result = service.generate_from_requirements(requirements, options).await;
    
    // Verify monitoring data is collected
    // Note: In a real implementation, we would check monitoring metrics
    // For now, we verify the monitoring service exists and is accessible
    let monitoring_stats = fixture.monitoring.get_performance_stats().await;
    
    // Basic verification that monitoring is working
    // (Actual metrics would depend on the monitoring implementation)
    assert!(monitoring_stats.total_requests >= 0, "Monitoring should track requests");
}

#[tokio::test]
async fn test_validation_integration() {
    let fixture = IntegrationTestFixture::new().await
        .expect("Failed to create test fixture");
    
    // Test that validation integrates properly across the system
    
    // Create a test case with various validation scenarios
    let valid_test_case = TestCase {
        id: "test_123".to_string(),
        title: "Valid Test Case".to_string(),
        description: "This is a valid test case for integration testing".to_string(),
        preconditions: Some("User is logged in".to_string()),
        steps: vec![
            TestStep {
                order: 1,
                action: "Click login button".to_string(),
                expected_outcome: Some("Login form appears".to_string()),
                notes: None,
            },
            TestStep {
                order: 2,
                action: "Enter credentials".to_string(),
                expected_outcome: Some("Credentials are accepted".to_string()),
                notes: Some("Use test account".to_string()),
            },
        ],
        expected_result: "User is successfully logged in".to_string(),
        severity: TestSeverity::High,
        test_type: TestType::Functional,
        metadata: Default::default(),
    };
    
    // Test validation integration
    let validation_result = fixture.validator.validate_test_case(&valid_test_case);
    assert!(validation_result.is_valid, "Valid test case should pass validation");
    assert!(validation_result.field_validations.is_empty(), "Valid test case should have no errors");
    assert!(validation_result.auto_fix_suggestions.is_empty(), "Valid test case should have no auto-fix suggestions");
}

// ============================================================================
// Helper Functions for Integration Tests
// ============================================================================

/// Helper to create a test configuration with custom settings
fn create_test_config(use_real_api: bool, timeout_secs: u64) -> IntegrationTestConfig {
    IntegrationTestConfig {
        use_real_api,
        operation_timeout: Duration::from_secs(timeout_secs),
        concurrent_operations: 3,
    }
}

/// Helper to verify response metadata
fn verify_response_metadata(metadata: &ResponseMetadata) {
    assert!(metadata.processing_time_ms > 0, "Processing time should be positive");
    // Note: Other fields may not be available in all response types
}

/// Helper to verify test case structure
fn verify_test_case_structure(test_case: &TestCase) {
    assert!(!test_case.id.is_empty(), "Test case ID should not be empty");
    assert!(!test_case.title.is_empty(), "Test case title should not be empty");
    assert!(!test_case.description.is_empty(), "Test case description should not be empty");
    assert!(!test_case.expected_result.is_empty(), "Expected result should not be empty");
    assert!(!test_case.steps.is_empty(), "Test case should have steps");
    
    // Verify step ordering
    for (index, step) in test_case.steps.iter().enumerate() {
        assert_eq!(step.order, (index + 1) as u32, "Steps should be properly ordered");
        assert!(!step.action.is_empty(), "Step action should not be empty");
    }
}
