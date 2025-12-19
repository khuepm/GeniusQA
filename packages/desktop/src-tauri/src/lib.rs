//! GeniusQA Desktop Library
//!
//! This library exposes the core functionality of the GeniusQA Desktop application
//! for use in integration tests and other library consumers.

pub mod ai_test_case;
pub mod core_router;
pub mod python_process;

// Re-export commonly used types for convenience
pub use ai_test_case::{
    AITestCaseService, ConfigManager, GenerationOptions, GenerationResponse,
    DocumentationContext, DocumentationResponse, RecordedAction, ProjectType,
    ComplexityLevel, TestCase, TestStep, TestSeverity, TestType, SourceType,
    AITestCaseError, ValidationResult, TestCaseValidator, MonitoringService,
    AIServiceState,
};
