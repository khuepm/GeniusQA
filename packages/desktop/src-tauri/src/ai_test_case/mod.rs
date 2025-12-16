//! AI Test Case Generator Module
//!
//! This module provides AI-powered test case generation using Google Gemini API.
//! It supports two primary workflows:
//! 1. Generating test cases from requirement descriptions
//! 2. Converting recorded automation logs into human-readable test documentation
//!
//! Requirements: 1.1, 4.1, 11.1, 11.2

pub mod commands;
pub mod config;
pub mod error;
pub mod models;
pub mod monitoring;
pub mod service;
pub mod validation;

// Re-export main types for convenience
pub use commands::AIServiceState;
pub use config::{ConfigManager, GenerationPreferences};
pub use error::{AITestCaseError, Result};
pub use models::{
    ComplexityLevel, DocumentationContext, DocumentationResponse, GenerationOptions, 
    GenerationResponse, ProjectType, RecordedAction, ResponseMetadata, SourceType, 
    TestCase, TestCaseMetadata, TestSeverity, TestStep, TestType, TokenUsage,
};
pub use monitoring::{
    CostEstimation, ErrorLogEntry, MonitoringService, PerformanceMetrics, 
    PerformanceStats, TokenUsageStats, UsagePattern,
};
pub use service::AITestCaseService;
pub use validation::{TestCaseValidator, ValidationResult};
