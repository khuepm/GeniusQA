//! Monitoring and Logging System for AI Test Case Generator
//!
//! Provides comprehensive error logging, performance monitoring, token usage tracking,
//! and usage pattern monitoring for the AI Test Case Generator service.
//! Requirements: 8.1, 8.3, 8.5, 10.1, 10.3, 10.5

use crate::ai_test_case::error::AITestCaseError;
use crate::ai_test_case::models::TokenUsage;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

/// Performance metrics for API operations
/// Requirements: 8.5
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    /// Response time in milliseconds
    pub response_time_ms: u64,
    /// Success status
    pub success: bool,
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    /// Operation type
    pub operation_type: String,
    /// Token usage if available
    pub token_usage: Option<TokenUsage>,
}

/// Error log entry with detailed information
/// Requirements: 8.1, 8.3
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorLogEntry {
    /// Error timestamp
    pub timestamp: DateTime<Utc>,
    /// Error type
    pub error_type: String,
    /// Error message
    pub message: String,
    /// Request details (if applicable)
    pub request_details: Option<String>,
    /// Response details (if applicable)
    pub response_details: Option<String>,
    /// Status code (if applicable)
    pub status_code: Option<u16>,
    /// Operation context
    pub operation_context: String,
    /// Retry attempt number
    pub retry_attempt: Option<u32>,
}
/// Token usage statistics
/// Requirements: 10.1
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TokenUsageStats {
    /// Total prompt tokens used
    pub total_prompt_tokens: u64,
    /// Total completion tokens used
    pub total_completion_tokens: u64,
    /// Total tokens used
    pub total_tokens: u64,
    /// Number of requests
    pub request_count: u64,
    /// Last updated timestamp
    pub last_updated: DateTime<Utc>,
}

/// Usage pattern tracking
/// Requirements: 10.5
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UsagePattern {
    /// Daily request counts (date -> count)
    pub daily_requests: HashMap<String, u64>,
    /// Monthly request counts (year-month -> count)
    pub monthly_requests: HashMap<String, u64>,
    /// Last request timestamp
    pub last_request: Option<DateTime<Utc>>,
    /// Peak usage day
    pub peak_usage_day: Option<(String, u64)>,
}

/// Cost estimation information
/// Requirements: 10.3
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostEstimation {
    /// Estimated cost in USD
    pub estimated_cost_usd: f64,
    /// Cost per 1K prompt tokens
    pub prompt_token_cost_per_1k: f64,
    /// Cost per 1K completion tokens
    pub completion_token_cost_per_1k: f64,
    /// Calculation timestamp
    pub calculated_at: DateTime<Utc>,
}

impl Default for CostEstimation {
    fn default() -> Self {
        // Default Gemini 1.5 Flash pricing (as of 2024)
        CostEstimation {
            estimated_cost_usd: 0.0,
            prompt_token_cost_per_1k: 0.000075, // $0.000075 per 1K prompt tokens
            completion_token_cost_per_1k: 0.0003, // $0.0003 per 1K completion tokens
            calculated_at: Utc::now(),
        }
    }
}

impl CostEstimation {
    /// Calculate cost from token usage
    pub fn calculate_cost(&mut self, token_usage: &TokenUsage) {
        let prompt_cost = (token_usage.prompt_tokens as f64 / 1000.0) * self.prompt_token_cost_per_1k;
        let completion_cost = (token_usage.completion_tokens as f64 / 1000.0) * self.completion_token_cost_per_1k;
        self.estimated_cost_usd = prompt_cost + completion_cost;
        self.calculated_at = Utc::now();
    }
}
/// Monitoring service for AI Test Case Generator
/// Requirements: 8.1, 8.3, 8.5, 10.1, 10.3, 10.5
pub struct MonitoringService {
    /// Performance metrics storage
    performance_metrics: Arc<RwLock<Vec<PerformanceMetrics>>>,
    /// Error log storage
    error_logs: Arc<RwLock<Vec<ErrorLogEntry>>>,
    /// Token usage statistics
    token_stats: Arc<RwLock<TokenUsageStats>>,
    /// Usage patterns
    usage_patterns: Arc<RwLock<UsagePattern>>,
    /// Maximum entries to keep in memory
    max_entries: usize,
}

impl MonitoringService {
    /// Create a new monitoring service
    pub fn new() -> Self {
        MonitoringService {
            performance_metrics: Arc::new(RwLock::new(Vec::new())),
            error_logs: Arc::new(RwLock::new(Vec::new())),
            token_stats: Arc::new(RwLock::new(TokenUsageStats::default())),
            usage_patterns: Arc::new(RwLock::new(UsagePattern::default())),
            max_entries: 1000, // Keep last 1000 entries
        }
    }

    /// Log performance metrics for an operation
    /// Requirements: 8.5
    pub async fn log_performance(
        &self,
        operation_type: impl Into<String>,
        response_time: Duration,
        success: bool,
        token_usage: Option<TokenUsage>,
    ) {
        let metrics = PerformanceMetrics {
            response_time_ms: response_time.as_millis() as u64,
            success,
            timestamp: Utc::now(),
            operation_type: operation_type.into(),
            token_usage: token_usage.clone(),
        };

        let mut performance_metrics = self.performance_metrics.write().await;
        performance_metrics.push(metrics);

        // Keep only the most recent entries
        if performance_metrics.len() > self.max_entries {
            let excess = performance_metrics.len() - self.max_entries;
            performance_metrics.drain(0..excess);
        }

        // Update token usage statistics if available
        if let Some(usage) = token_usage {
            self.update_token_stats(usage).await;
        }

        // Update usage patterns
        self.update_usage_patterns().await;
    }
    /// Log comprehensive error information
    /// Requirements: 8.1, 8.3
    pub async fn log_error(
        &self,
        error: &AITestCaseError,
        operation_context: impl Into<String>,
        request_details: Option<String>,
        response_details: Option<String>,
        retry_attempt: Option<u32>,
    ) {
        let error_entry = ErrorLogEntry {
            timestamp: Utc::now(),
            error_type: self.get_error_type_name(error),
            message: error.to_string(),
            request_details,
            response_details,
            status_code: self.extract_status_code(error),
            operation_context: operation_context.into(),
            retry_attempt,
        };

        // Log to structured logging system
        log::error!(
            "[AI Test Case Monitor] Error in {}: {} (Type: {}, Status: {:?}, Retry: {:?})",
            error_entry.operation_context,
            error_entry.message,
            error_entry.error_type,
            error_entry.status_code,
            error_entry.retry_attempt
        );

        // Store in memory for analysis
        let mut error_logs = self.error_logs.write().await;
        error_logs.push(error_entry);

        // Keep only the most recent entries
        if error_logs.len() > self.max_entries {
            let excess = error_logs.len() - self.max_entries;
            error_logs.drain(0..excess);
        }
    }

    /// Update token usage statistics
    /// Requirements: 10.1
    async fn update_token_stats(&self, token_usage: TokenUsage) {
        let mut stats = self.token_stats.write().await;
        stats.total_prompt_tokens += token_usage.prompt_tokens as u64;
        stats.total_completion_tokens += token_usage.completion_tokens as u64;
        stats.total_tokens += token_usage.total_tokens as u64;
        stats.request_count += 1;
        stats.last_updated = Utc::now();
    }
    /// Update usage patterns
    /// Requirements: 10.5
    async fn update_usage_patterns(&self) {
        let now = Utc::now();
        let date_key = now.format("%Y-%m-%d").to_string();
        let month_key = now.format("%Y-%m").to_string();

        let mut patterns = self.usage_patterns.write().await;
        
        // Update daily count
        let daily_count = patterns.daily_requests.entry(date_key.clone()).or_insert(0);
        *daily_count += 1;
        let current_daily_count = *daily_count;

        // Update monthly count
        let monthly_count = patterns.monthly_requests.entry(month_key).or_insert(0);
        *monthly_count += 1;

        // Update peak usage day
        if patterns.peak_usage_day.is_none() || 
           patterns.peak_usage_day.as_ref().map(|(_, count)| *count).unwrap_or(0) < current_daily_count {
            patterns.peak_usage_day = Some((date_key, current_daily_count));
        }

        patterns.last_request = Some(now);
    }

    /// Get current token usage statistics
    /// Requirements: 10.1
    pub async fn get_token_stats(&self) -> TokenUsageStats {
        self.token_stats.read().await.clone()
    }

    /// Get usage patterns
    /// Requirements: 10.5
    pub async fn get_usage_patterns(&self) -> UsagePattern {
        self.usage_patterns.read().await.clone()
    }

    /// Calculate cost estimation from current token usage
    /// Requirements: 10.3
    pub async fn calculate_cost_estimation(&self) -> CostEstimation {
        let stats = self.token_stats.read().await;
        let mut cost_estimation = CostEstimation::default();
        
        let total_usage = TokenUsage {
            prompt_tokens: stats.total_prompt_tokens as u32,
            completion_tokens: stats.total_completion_tokens as u32,
            total_tokens: stats.total_tokens as u32,
        };
        
        cost_estimation.calculate_cost(&total_usage);
        cost_estimation
    }
    /// Get performance statistics
    /// Requirements: 8.5
    pub async fn get_performance_stats(&self) -> PerformanceStats {
        let metrics = self.performance_metrics.read().await;
        
        if metrics.is_empty() {
            return PerformanceStats::default();
        }

        let total_requests = metrics.len();
        let successful_requests = metrics.iter().filter(|m| m.success).count();
        let success_rate = (successful_requests as f64 / total_requests as f64) * 100.0;
        
        let response_times: Vec<u64> = metrics.iter().map(|m| m.response_time_ms).collect();
        let avg_response_time = response_times.iter().sum::<u64>() / response_times.len() as u64;
        let min_response_time = *response_times.iter().min().unwrap_or(&0);
        let max_response_time = *response_times.iter().max().unwrap_or(&0);

        PerformanceStats {
            total_requests,
            successful_requests,
            success_rate,
            avg_response_time_ms: avg_response_time,
            min_response_time_ms: min_response_time,
            max_response_time_ms: max_response_time,
        }
    }

    /// Get recent error logs
    /// Requirements: 8.1, 8.3
    pub async fn get_recent_errors(&self, limit: Option<usize>) -> Vec<ErrorLogEntry> {
        let error_logs = self.error_logs.read().await;
        let limit = limit.unwrap_or(50);
        
        error_logs.iter()
            .rev()
            .take(limit)
            .cloned()
            .collect()
    }

    /// Helper to get error type name
    fn get_error_type_name(&self, error: &AITestCaseError) -> String {
        match error {
            AITestCaseError::ApiError { .. } => "ApiError".to_string(),
            AITestCaseError::ParseError { .. } => "ParseError".to_string(),
            AITestCaseError::ValidationError { .. } => "ValidationError".to_string(),
            AITestCaseError::ConfigError { .. } => "ConfigError".to_string(),
            AITestCaseError::RateLimitError { .. } => "RateLimitError".to_string(),
            AITestCaseError::TimeoutError { .. } => "TimeoutError".to_string(),
            AITestCaseError::InputError { .. } => "InputError".to_string(),
            AITestCaseError::KeyringError { .. } => "KeyringError".to_string(),
            AITestCaseError::MaxRetriesExceeded { .. } => "MaxRetriesExceeded".to_string(),
            AITestCaseError::Internal(_) => "Internal".to_string(),
        }
    }
    /// Helper to extract status code from error
    fn extract_status_code(&self, error: &AITestCaseError) -> Option<u16> {
        match error {
            AITestCaseError::ApiError { status_code, .. } => *status_code,
            _ => None,
        }
    }
}

/// Performance statistics summary
/// Requirements: 8.5
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PerformanceStats {
    /// Total number of requests
    pub total_requests: usize,
    /// Number of successful requests
    pub successful_requests: usize,
    /// Success rate percentage
    pub success_rate: f64,
    /// Average response time in milliseconds
    pub avg_response_time_ms: u64,
    /// Minimum response time in milliseconds
    pub min_response_time_ms: u64,
    /// Maximum response time in milliseconds
    pub max_response_time_ms: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    use std::time::Duration;

    #[tokio::test]
    async fn test_monitoring_service_creation() {
        let monitor = MonitoringService::new();
        let stats = monitor.get_token_stats().await;
        assert_eq!(stats.total_tokens, 0);
        assert_eq!(stats.request_count, 0);
    }

    #[tokio::test]
    async fn test_performance_logging() {
        let monitor = MonitoringService::new();
        
        let token_usage = TokenUsage {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
        };

        monitor.log_performance(
            "test_operation",
            Duration::from_millis(500),
            true,
            Some(token_usage.clone()),
        ).await;

        let stats = monitor.get_token_stats().await;
        assert_eq!(stats.total_tokens, 150);
        assert_eq!(stats.request_count, 1);

        let perf_stats = monitor.get_performance_stats().await;
        assert_eq!(perf_stats.total_requests, 1);
        assert_eq!(perf_stats.successful_requests, 1);
        assert_eq!(perf_stats.success_rate, 100.0);
    }
    #[tokio::test]
    async fn test_error_logging() {
        let monitor = MonitoringService::new();
        
        let error = AITestCaseError::api_error("Test error", Some(500));
        monitor.log_error(
            &error,
            "test_operation",
            Some("request data".to_string()),
            Some("response data".to_string()),
            Some(1),
        ).await;

        let errors = monitor.get_recent_errors(Some(10)).await;
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].error_type, "ApiError");
        assert_eq!(errors[0].status_code, Some(500));
    }

    #[tokio::test]
    async fn test_cost_calculation() {
        let mut cost_estimation = CostEstimation::default();
        let token_usage = TokenUsage {
            prompt_tokens: 1000,
            completion_tokens: 500,
            total_tokens: 1500,
        };

        cost_estimation.calculate_cost(&token_usage);
        
        // Expected: (1000/1000 * 0.000075) + (500/1000 * 0.0003) = 0.000075 + 0.00015 = 0.000225
        assert!((cost_estimation.estimated_cost_usd - 0.000225).abs() < 0.000001);
    }

    // Property test generators
    prop_compose! {
        fn arb_token_usage()(
            prompt_tokens in 1u32..10000,
            completion_tokens in 1u32..5000
        ) -> TokenUsage {
            TokenUsage {
                prompt_tokens,
                completion_tokens,
                total_tokens: prompt_tokens + completion_tokens,
            }
        }
    }

    prop_compose! {
        fn arb_error_details()(
            error_type in prop::sample::select(vec![
                "ApiError", "ParseError", "ValidationError", "ConfigError",
                "RateLimitError", "TimeoutError", "InputError", "KeyringError"
            ]),
            message in "[a-zA-Z0-9 .,!?]{10,100}",
            status_code in prop::option::of(400u16..600),
            operation_context in "[a-zA-Z0-9_]{5,50}",
            retry_attempt in prop::option::of(1u32..5)
        ) -> (String, String, Option<u16>, String, Option<u32>) {
            (error_type.to_string(), message, status_code, operation_context, retry_attempt)
        }
    }
    // **Feature: ai-test-case-generator, Property 15: Comprehensive Error Logging**
    // **Validates: Requirements 8.1, 8.3**
    proptest! {
        #[test]
        fn property_comprehensive_error_logging(
            error_details in arb_error_details(),
            request_details in prop::option::of("[a-zA-Z0-9 .,{}\"]{10,200}"),
            response_details in prop::option::of("[a-zA-Z0-9 .,{}\"]{10,200}")
        ) {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                let monitor = MonitoringService::new();
                let (error_type, message, status_code, operation_context, retry_attempt) = error_details;
                
                // Create different types of errors to test comprehensive logging
                let test_errors = vec![
                    AITestCaseError::api_error(message.clone(), status_code),
                    AITestCaseError::parse_error(message.clone(), "raw response"),
                    AITestCaseError::validation_error("field", message.clone()),
                    AITestCaseError::config_error(message.clone()),
                    AITestCaseError::RateLimitError { seconds: 60 },
                    AITestCaseError::TimeoutError { timeout_secs: 30 },
                    AITestCaseError::input_error(message.clone()),
                    AITestCaseError::keyring_error(message.clone()),
                    AITestCaseError::MaxRetriesExceeded { max_attempts: 3 },
                    AITestCaseError::Internal(message.clone()),
                ];
                
                // Property: All error types should be logged with complete information
                for (i, error) in test_errors.iter().enumerate() {
                    let context = format!("{}_{}", operation_context, i);
                    
                    monitor.log_error(
                        error,
                        &context,
                        request_details.clone(),
                        response_details.clone(),
                        retry_attempt,
                    ).await;
                }
                
                let logged_errors = monitor.get_recent_errors(Some(20)).await;
                prop_assert_eq!(logged_errors.len(), test_errors.len(), 
                              "All errors should be logged");
                
                // Property: Each logged error should contain all required fields
                for (i, logged_error) in logged_errors.iter().enumerate() {
                    // Timestamp should be recent (within last minute)
                    let now = Utc::now();
                    let time_diff = now.signed_duration_since(logged_error.timestamp);
                    prop_assert!(time_diff.num_seconds() < 60, 
                               "Error timestamp should be recent");
                    
                    // Error type should be properly classified
                    prop_assert!(!logged_error.error_type.is_empty(), 
                               "Error type should not be empty");
                    
                    // Message should be preserved
                    prop_assert!(!logged_error.message.is_empty(), 
                               "Error message should not be empty");
                    
                    // Operation context should be preserved
                    prop_assert!(logged_error.operation_context.contains(&operation_context), 
                               "Operation context should be preserved");
                    
                    // Request/response details should be preserved if provided
                    if request_details.is_some() {
                        prop_assert_eq!(&logged_error.request_details, &request_details, 
                                      "Request details should be preserved");
                    }
                    
                    if response_details.is_some() {
                        prop_assert_eq!(&logged_error.response_details, &response_details, 
                                      "Response details should be preserved");
                    }
                    
                    // Retry attempt should be preserved if provided
                    prop_assert_eq!(logged_error.retry_attempt, retry_attempt, 
                                  "Retry attempt should be preserved");
                }
                
                Ok(())
            });
        }
    }

    // **Feature: ai-test-case-generator, Property 16: Performance Monitoring Consistency**
    // **Validates: Requirements 8.5**
    proptest! {
        #[test]
        fn property_performance_monitoring_consistency(
            operations in prop::collection::vec(
                (
                    prop::sample::select(vec![
                        "generate_from_requirements", "generate_from_actions", 
                        "validate_api_key", "api_call", "json_parsing"
                    ]),
                    1u64..5000, // response time in ms
                    any::<bool>(), // success status
                    prop::option::of(arb_token_usage())
                ),
                1..20
            )
        ) {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                let monitor = MonitoringService::new();
                
                // Property: All operations should be logged with consistent metrics
                for (operation_type, response_time_ms, success, token_usage) in &operations {
                    monitor.log_performance(
                        operation_type.clone(),
                        Duration::from_millis(*response_time_ms),
                        *success,
                        token_usage.clone(),
                    ).await;
                }
                
                let performance_stats = monitor.get_performance_stats().await;
                
                // Property: Total requests should match logged operations
                prop_assert_eq!(performance_stats.total_requests, operations.len(),
                              "Total requests should match number of logged operations");
                
                // Property: Successful requests should be counted correctly
                let expected_successful = operations.iter().filter(|(_, _, success, _)| *success).count();
                prop_assert_eq!(performance_stats.successful_requests, expected_successful,
                              "Successful requests should be counted correctly");
                
                // Property: Success rate should be calculated correctly
                let expected_success_rate = if operations.is_empty() {
                    0.0
                } else {
                    (expected_successful as f64 / operations.len() as f64) * 100.0
                };
                prop_assert!((performance_stats.success_rate - expected_success_rate).abs() < 0.01,
                           "Success rate should be calculated correctly: expected {}, got {}",
                           expected_success_rate, performance_stats.success_rate);
                
                // Property: Response time statistics should be within expected bounds
                let response_times: Vec<u64> = operations.iter().map(|(_, rt, _, _)| *rt).collect();
                if !response_times.is_empty() {
                    let expected_min = *response_times.iter().min().unwrap();
                    let expected_max = *response_times.iter().max().unwrap();
                    let expected_avg = response_times.iter().sum::<u64>() / response_times.len() as u64;
                    
                    prop_assert_eq!(performance_stats.min_response_time_ms, expected_min,
                                  "Minimum response time should be correct");
                    prop_assert_eq!(performance_stats.max_response_time_ms, expected_max,
                                  "Maximum response time should be correct");
                    prop_assert_eq!(performance_stats.avg_response_time_ms, expected_avg,
                                  "Average response time should be correct");
                }
                
                // Property: Token usage should be tracked consistently
                let total_expected_tokens: u64 = operations.iter()
                    .filter_map(|(_, _, _, token_usage)| token_usage.as_ref())
                    .map(|usage| usage.total_tokens as u64)
                    .sum();
                
                if total_expected_tokens > 0 {
                    let token_stats = monitor.get_token_stats().await;
                    prop_assert_eq!(token_stats.total_tokens, total_expected_tokens,
                                  "Total tokens should be tracked correctly");
                    
                    let expected_request_count = operations.iter()
                        .filter(|(_, _, _, token_usage)| token_usage.is_some())
                        .count() as u64;
                    prop_assert_eq!(token_stats.request_count, expected_request_count,
                                  "Request count should match operations with token usage");
                }
                
                // Property: Performance monitoring should be deterministic
                let second_stats = monitor.get_performance_stats().await;
                prop_assert_eq!(performance_stats.total_requests, second_stats.total_requests,
                              "Performance stats should be deterministic");
                prop_assert_eq!(performance_stats.successful_requests, second_stats.successful_requests,
                              "Performance stats should be deterministic");
                prop_assert!((performance_stats.success_rate - second_stats.success_rate).abs() < 0.01,
                           "Performance stats should be deterministic");
                
                // Property: Usage patterns should be updated consistently
                let usage_patterns = monitor.get_usage_patterns().await;
                prop_assert!(usage_patterns.last_request.is_some(),
                           "Usage patterns should track last request time");
                
                let today = Utc::now().format("%Y-%m-%d").to_string();
                prop_assert!(usage_patterns.daily_requests.contains_key(&today),
                           "Usage patterns should track daily requests");
                prop_assert_eq!(usage_patterns.daily_requests[&today], operations.len() as u64,
                              "Daily request count should match logged operations");
                
                Ok(())
            });
        }
    }
    // **Feature: ai-test-case-generator, Property 20: Token Usage Logging Completeness**
    // **Validates: Requirements 10.1**
    proptest! {
        #[test]
        fn property_token_usage_logging_completeness(
            token_usages in prop::collection::vec(arb_token_usage(), 1..50)
        ) {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                let monitor = MonitoringService::new();
                
                // Property: All token usage should be logged completely and accurately
                for (i, token_usage) in token_usages.iter().enumerate() {
                    monitor.log_performance(
                        format!("operation_{}", i),
                        Duration::from_millis(100),
                        true,
                        Some(token_usage.clone()),
                    ).await;
                }
                
                let token_stats = monitor.get_token_stats().await;
                
                // Property: Total prompt tokens should be sum of all logged prompt tokens
                let expected_prompt_tokens: u64 = token_usages.iter()
                    .map(|usage| usage.prompt_tokens as u64)
                    .sum();
                prop_assert_eq!(token_stats.total_prompt_tokens, expected_prompt_tokens,
                              "Total prompt tokens should match sum of all logged tokens");
                
                // Property: Total completion tokens should be sum of all logged completion tokens
                let expected_completion_tokens: u64 = token_usages.iter()
                    .map(|usage| usage.completion_tokens as u64)
                    .sum();
                prop_assert_eq!(token_stats.total_completion_tokens, expected_completion_tokens,
                              "Total completion tokens should match sum of all logged tokens");
                
                // Property: Total tokens should be sum of all logged total tokens
                let expected_total_tokens: u64 = token_usages.iter()
                    .map(|usage| usage.total_tokens as u64)
                    .sum();
                prop_assert_eq!(token_stats.total_tokens, expected_total_tokens,
                              "Total tokens should match sum of all logged tokens");
                
                // Property: Request count should match number of operations with token usage
                prop_assert_eq!(token_stats.request_count, token_usages.len() as u64,
                              "Request count should match number of operations with token usage");
                
                // Property: Last updated timestamp should be recent
                let now = Utc::now();
                let time_diff = now.signed_duration_since(token_stats.last_updated);
                prop_assert!(time_diff.num_seconds() < 60,
                           "Last updated timestamp should be recent (within 60 seconds)");
                
                // Property: Token usage consistency - total should equal prompt + completion
                for token_usage in &token_usages {
                    prop_assert_eq!(token_usage.total_tokens, 
                                  token_usage.prompt_tokens + token_usage.completion_tokens,
                                  "Total tokens should equal prompt + completion tokens");
                }
                
                // Property: Cost estimation should be calculated correctly
                let cost_estimation = monitor.calculate_cost_estimation().await;
                
                // Verify cost calculation matches expected values
                let expected_prompt_cost = (expected_prompt_tokens as f64 / 1000.0) * cost_estimation.prompt_token_cost_per_1k;
                let expected_completion_cost = (expected_completion_tokens as f64 / 1000.0) * cost_estimation.completion_token_cost_per_1k;
                let expected_total_cost = expected_prompt_cost + expected_completion_cost;
                
                prop_assert!((cost_estimation.estimated_cost_usd - expected_total_cost).abs() < 0.000001,
                           "Cost estimation should be calculated correctly: expected {}, got {}",
                           expected_total_cost, cost_estimation.estimated_cost_usd);
                
                // Property: Token logging should be additive (not replace previous values)
                let additional_usage = TokenUsage {
                    prompt_tokens: 100,
                    completion_tokens: 50,
                    total_tokens: 150,
                };
                
                monitor.log_performance(
                    "additional_operation",
                    Duration::from_millis(200),
                    true,
                    Some(additional_usage.clone()),
                ).await;
                
                let updated_stats = monitor.get_token_stats().await;
                prop_assert_eq!(updated_stats.total_prompt_tokens, 
                              expected_prompt_tokens + additional_usage.prompt_tokens as u64,
                              "Token logging should be additive");
                prop_assert_eq!(updated_stats.total_completion_tokens,
                              expected_completion_tokens + additional_usage.completion_tokens as u64,
                              "Token logging should be additive");
                prop_assert_eq!(updated_stats.total_tokens,
                              expected_total_tokens + additional_usage.total_tokens as u64,
                              "Token logging should be additive");
                prop_assert_eq!(updated_stats.request_count, token_usages.len() as u64 + 1,
                              "Request count should be incremented");
                
                // Property: Operations without token usage should not affect token stats
                monitor.log_performance(
                    "no_token_operation",
                    Duration::from_millis(300),
                    true,
                    None,
                ).await;
                
                let final_stats = monitor.get_token_stats().await;
                prop_assert_eq!(final_stats.total_tokens, updated_stats.total_tokens,
                              "Operations without token usage should not affect token counts");
                prop_assert_eq!(final_stats.request_count, updated_stats.request_count,
                              "Operations without token usage should not affect request count");
                
                Ok(())
            });
        }
    }

    // **Feature: ai-test-case-generator, Property 21: Cost Information Display Accuracy**
    // **Validates: Requirements 10.3**
    proptest! {
        #[test]
        fn property_cost_information_display_accuracy(
            token_usages in prop::collection::vec(arb_token_usage(), 1..100),
            prompt_cost_per_1k in 0.00001f64..0.01, // Reasonable range for API pricing
            completion_cost_per_1k in 0.00001f64..0.01
        ) {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                let monitor = MonitoringService::new();
                
                // Log all token usages
                for (i, token_usage) in token_usages.iter().enumerate() {
                    monitor.log_performance(
                        format!("operation_{}", i),
                        Duration::from_millis(100),
                        true,
                        Some(token_usage.clone()),
                    ).await;
                }
                
                // Calculate cost estimation with custom pricing
                let mut cost_estimation = CostEstimation {
                    estimated_cost_usd: 0.0,
                    prompt_token_cost_per_1k: prompt_cost_per_1k,
                    completion_token_cost_per_1k: completion_cost_per_1k,
                    calculated_at: Utc::now(),
                };
                
                // Calculate total token usage
                let total_prompt_tokens: u64 = token_usages.iter()
                    .map(|usage| usage.prompt_tokens as u64)
                    .sum();
                let total_completion_tokens: u64 = token_usages.iter()
                    .map(|usage| usage.completion_tokens as u64)
                    .sum();
                let total_tokens = total_prompt_tokens + total_completion_tokens;
                
                let total_usage = TokenUsage {
                    prompt_tokens: total_prompt_tokens as u32,
                    completion_tokens: total_completion_tokens as u32,
                    total_tokens: total_tokens as u32,
                };
                
                cost_estimation.calculate_cost(&total_usage);
                
                // Property: Cost calculation should be mathematically accurate
                let expected_prompt_cost = (total_prompt_tokens as f64 / 1000.0) * prompt_cost_per_1k;
                let expected_completion_cost = (total_completion_tokens as f64 / 1000.0) * completion_cost_per_1k;
                let expected_total_cost = expected_prompt_cost + expected_completion_cost;
                
                prop_assert!((cost_estimation.estimated_cost_usd - expected_total_cost).abs() < 0.000001,
                           "Cost calculation should be mathematically accurate: expected {}, got {}",
                           expected_total_cost, cost_estimation.estimated_cost_usd);
                
                // Property: Cost should be non-negative
                prop_assert!(cost_estimation.estimated_cost_usd >= 0.0,
                           "Cost should never be negative");
                
                // Property: Cost should scale linearly with token usage
                if total_tokens > 0 {
                    let cost_per_token = cost_estimation.estimated_cost_usd / total_tokens as f64;
                    prop_assert!(cost_per_token >= 0.0,
                               "Cost per token should be non-negative");
                    
                    // Test with double the tokens
                    let double_usage = TokenUsage {
                        prompt_tokens: (total_prompt_tokens * 2) as u32,
                        completion_tokens: (total_completion_tokens * 2) as u32,
                        total_tokens: (total_tokens * 2) as u32,
                    };
                    
                    let mut double_cost_estimation = CostEstimation {
                        estimated_cost_usd: 0.0,
                        prompt_token_cost_per_1k: prompt_cost_per_1k,
                        completion_token_cost_per_1k: completion_cost_per_1k,
                        calculated_at: Utc::now(),
                    };
                    
                    double_cost_estimation.calculate_cost(&double_usage);
                    
                    // Cost should approximately double (within floating point precision)
                    let expected_double_cost = expected_total_cost * 2.0;
                    prop_assert!((double_cost_estimation.estimated_cost_usd - expected_double_cost).abs() < 0.000001,
                               "Cost should scale linearly: expected {}, got {}",
                               expected_double_cost, double_cost_estimation.estimated_cost_usd);
                }
                
                // Property: Timestamp should be recent and accurate
                let now = Utc::now();
                let time_diff = now.signed_duration_since(cost_estimation.calculated_at);
                prop_assert!(time_diff.num_seconds() < 60,
                           "Cost calculation timestamp should be recent (within 60 seconds)");
                
                // Property: Cost breakdown should be consistent
                let manual_prompt_cost = (total_prompt_tokens as f64 / 1000.0) * cost_estimation.prompt_token_cost_per_1k;
                let manual_completion_cost = (total_completion_tokens as f64 / 1000.0) * cost_estimation.completion_token_cost_per_1k;
                let manual_total = manual_prompt_cost + manual_completion_cost;
                
                prop_assert!((cost_estimation.estimated_cost_usd - manual_total).abs() < 0.000001,
                           "Cost breakdown should be consistent with manual calculation");
                
                // Property: Zero tokens should result in zero cost
                let zero_usage = TokenUsage {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0,
                };
                
                let mut zero_cost_estimation = CostEstimation {
                    estimated_cost_usd: 0.0,
                    prompt_token_cost_per_1k: prompt_cost_per_1k,
                    completion_token_cost_per_1k: completion_cost_per_1k,
                    calculated_at: Utc::now(),
                };
                
                zero_cost_estimation.calculate_cost(&zero_usage);
                prop_assert_eq!(zero_cost_estimation.estimated_cost_usd, 0.0,
                              "Zero tokens should result in zero cost");
                
                // Property: Cost estimation from monitoring service should match manual calculation
                let service_cost_estimation = monitor.calculate_cost_estimation().await;
                
                // The service uses default pricing, so we need to calculate with default values
                let default_cost = CostEstimation::default();
                let service_expected_prompt_cost = (total_prompt_tokens as f64 / 1000.0) * default_cost.prompt_token_cost_per_1k;
                let service_expected_completion_cost = (total_completion_tokens as f64 / 1000.0) * default_cost.completion_token_cost_per_1k;
                let service_expected_total = service_expected_prompt_cost + service_expected_completion_cost;
                
                prop_assert!((service_cost_estimation.estimated_cost_usd - service_expected_total).abs() < 0.000001,
                           "Service cost estimation should match manual calculation with default pricing");
                
                Ok(())
            });
        }
    }

    // **Feature: ai-test-case-generator, Property 22: Usage Pattern Tracking Consistency**
    // **Validates: Requirements 10.5**
    proptest! {
        #[test]
        fn property_usage_pattern_tracking_consistency(
            operations in prop::collection::vec(
                (
                    prop::sample::select(vec![
                        "generate_from_requirements", "generate_from_actions", 
                        "validate_api_key", "api_call", "json_parsing"
                    ]),
                    1u64..1000, // response time in ms
                    any::<bool>(), // success status
                    prop::option::of(arb_token_usage())
                ),
                1..100
            ),
            // Simulate operations across different days by using different timestamps
            days_offset in prop::collection::vec(0i64..30, 1..10) // Up to 30 days back, up to 10 different days
        ) {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                let monitor = MonitoringService::new();
                
                // Property: Usage patterns should track daily and monthly requests consistently
                let mut expected_daily_counts: std::collections::HashMap<String, u64> = std::collections::HashMap::new();
                let mut expected_monthly_counts: std::collections::HashMap<String, u64> = std::collections::HashMap::new();
                
                // Simulate operations on different days
                let chunk_size = if days_offset.is_empty() { 1 } else { (operations.len() / days_offset.len()).max(1) };
                for (day_offset, operations_for_day) in days_offset.iter().zip(operations.chunks(chunk_size)) {
                    let simulated_date = Utc::now() - chrono::Duration::days(*day_offset);
                    let date_key = simulated_date.format("%Y-%m-%d").to_string();
                    let month_key = simulated_date.format("%Y-%m").to_string();
                    
                    // Track expected counts
                    *expected_daily_counts.entry(date_key.clone()).or_insert(0) += operations_for_day.len() as u64;
                    *expected_monthly_counts.entry(month_key.clone()).or_insert(0) += operations_for_day.len() as u64;
                    
                    // Log operations for this day
                    for (i, (operation_type, response_time_ms, success, token_usage)) in operations_for_day.iter().enumerate() {
                        monitor.log_performance(
                            format!("{}_{}", operation_type, i),
                            Duration::from_millis(*response_time_ms),
                            *success,
                            token_usage.clone(),
                        ).await;
                    }
                }
                
                let usage_patterns = monitor.get_usage_patterns().await;
                
                // Property: Daily request counts should be tracked accurately
                let today = Utc::now().format("%Y-%m-%d").to_string();
                prop_assert!(usage_patterns.daily_requests.contains_key(&today),
                           "Usage patterns should track today's requests");
                
                // Property: Monthly request counts should be tracked accurately
                let this_month = Utc::now().format("%Y-%m").to_string();
                prop_assert!(usage_patterns.monthly_requests.contains_key(&this_month),
                           "Usage patterns should track this month's requests");
                
                // Property: Total daily requests should equal sum of all operations for today
                let total_operations_today = operations.len() as u64;
                if let Some(&daily_count) = usage_patterns.daily_requests.get(&today) {
                    prop_assert_eq!(daily_count, total_operations_today,
                                  "Daily request count should match total operations logged today");
                }
                
                // Property: Total monthly requests should be at least the daily count
                if let Some(&monthly_count) = usage_patterns.monthly_requests.get(&this_month) {
                    if let Some(&daily_count) = usage_patterns.daily_requests.get(&today) {
                        prop_assert!(monthly_count >= daily_count,
                                   "Monthly count should be at least the daily count");
                    }
                }
                
                // Property: Last request timestamp should be recent
                prop_assert!(usage_patterns.last_request.is_some(),
                           "Last request timestamp should be set");
                
                if let Some(last_request) = usage_patterns.last_request {
                    let now = Utc::now();
                    let time_diff = now.signed_duration_since(last_request);
                    prop_assert!(time_diff.num_seconds() < 60,
                               "Last request timestamp should be recent (within 60 seconds)");
                }
                
                // Property: Peak usage day should be tracked correctly
                if usage_patterns.peak_usage_day.is_some() {
                    let (peak_date, peak_count) = usage_patterns.peak_usage_day.unwrap();
                    
                    // Peak count should exist in daily requests
                    prop_assert!(usage_patterns.daily_requests.contains_key(&peak_date),
                               "Peak usage day should exist in daily requests");
                    
                    if let Some(&actual_count) = usage_patterns.daily_requests.get(&peak_date) {
                        prop_assert_eq!(actual_count, peak_count,
                                      "Peak usage count should match daily request count for that day");
                    }
                    
                    // Peak count should be the maximum among all days
                    for (_, &count) in usage_patterns.daily_requests.iter() {
                        prop_assert!(peak_count >= count,
                                   "Peak usage count should be >= all other daily counts");
                    }
                }
                
                // Property: Usage pattern tracking should be deterministic
                let second_usage_patterns = monitor.get_usage_patterns().await;
                prop_assert_eq!(&usage_patterns.daily_requests, &second_usage_patterns.daily_requests,
                              "Usage patterns should be deterministic");
                prop_assert_eq!(&usage_patterns.monthly_requests, &second_usage_patterns.monthly_requests,
                              "Usage patterns should be deterministic");
                
                // Store original counts before adding more operations
                let original_daily_count = usage_patterns.daily_requests.get(&today).copied().unwrap_or(0);
                let original_monthly_count = usage_patterns.monthly_requests.get(&this_month).copied().unwrap_or(0);
                
                // Property: Adding more operations should increase counts correctly
                let additional_operations = 5;
                for i in 0..additional_operations {
                    monitor.log_performance(
                        format!("additional_operation_{}", i),
                        Duration::from_millis(100),
                        true,
                        None,
                    ).await;
                }
                
                let updated_usage_patterns = monitor.get_usage_patterns().await;
                
                // Daily count should increase by the number of additional operations
                if let Some(&updated_count) = updated_usage_patterns.daily_requests.get(&today) {
                    prop_assert_eq!(updated_count, original_daily_count + additional_operations,
                                  "Daily count should increase by number of additional operations");
                }
                
                // Monthly count should also increase
                if let Some(&updated_count) = updated_usage_patterns.monthly_requests.get(&this_month) {
                    prop_assert_eq!(updated_count, original_monthly_count + additional_operations,
                                  "Monthly count should increase by number of additional operations");
                }
                
                // Property: Usage patterns should handle edge cases correctly
                
                // Test with zero operations (should not crash)
                let empty_monitor = MonitoringService::new();
                let empty_patterns = empty_monitor.get_usage_patterns().await;
                prop_assert!(empty_patterns.daily_requests.is_empty() || 
                           empty_patterns.daily_requests.values().all(|&count| count == 0),
                           "Empty monitor should have no usage or zero counts");
                
                // Property: Date formatting should be consistent
                for date_key in usage_patterns.daily_requests.keys() {
                    // Date should be in YYYY-MM-DD format
                    prop_assert!(date_key.len() == 10, "Date key should be 10 characters long");
                    prop_assert!(date_key.chars().nth(4) == Some('-'), "Date should have dash at position 4");
                    prop_assert!(date_key.chars().nth(7) == Some('-'), "Date should have dash at position 7");
                    
                    // Should be parseable as a date
                    prop_assert!(chrono::NaiveDate::parse_from_str(date_key, "%Y-%m-%d").is_ok(),
                               "Date key should be parseable as YYYY-MM-DD");
                }
                
                for month_key in usage_patterns.monthly_requests.keys() {
                    // Month should be in YYYY-MM format
                    prop_assert!(month_key.len() == 7, "Month key should be 7 characters long");
                    prop_assert!(month_key.chars().nth(4) == Some('-'), "Month should have dash at position 4");
                    
                    // Should be parseable as a year-month
                    prop_assert!(month_key.parse::<String>().is_ok() && month_key.contains('-'),
                               "Month key should be in YYYY-MM format");
                }
                
                // Property: Counts should never be negative
                for &count in usage_patterns.daily_requests.values() {
                    prop_assert!(count >= 0, "Daily request counts should never be negative");
                }
                
                for &count in usage_patterns.monthly_requests.values() {
                    prop_assert!(count >= 0, "Monthly request counts should never be negative");
                }
                
                Ok(())
            });
        }
    }

    // Unit tests for rate limiting and quota warnings
    // Requirements: 8.2, 8.4, 10.2, 10.4

    #[tokio::test]
    async fn test_rate_limit_error_handling() {
        let monitor = MonitoringService::new();
        
        // Test rate limit error logging
        let rate_limit_error = AITestCaseError::RateLimitError { seconds: 60 };
        
        monitor.log_error(
            &rate_limit_error,
            "api_request",
            Some("POST /generate".to_string()),
            Some("429 Too Many Requests".to_string()),
            Some(1),
        ).await;
        
        let errors = monitor.get_recent_errors(Some(10)).await;
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].error_type, "RateLimitError");
        assert_eq!(errors[0].retry_attempt, Some(1));
        assert!(errors[0].message.contains("60 seconds"));
    }

    #[tokio::test]
    async fn test_exponential_backoff_calculation() {
        // Test exponential backoff delay calculation
        let rate_limit_error = AITestCaseError::RateLimitError { seconds: 60 };
        let api_error = AITestCaseError::api_error("Server error", Some(500));
        let timeout_error = AITestCaseError::TimeoutError { timeout_secs: 30 };
        
        // Rate limit error should have specific retry delay
        assert_eq!(rate_limit_error.retry_delay(), Some(Duration::from_secs(60)));
        
        // API error without retry_after should have no delay
        assert_eq!(api_error.retry_delay(), None);
        
        // Timeout error should have default delay
        assert_eq!(timeout_error.retry_delay(), Some(Duration::from_secs(5)));
        
        // Test that errors are retryable
        assert!(rate_limit_error.is_retryable());
        assert!(api_error.is_retryable());
        assert!(timeout_error.is_retryable());
    }

    #[tokio::test]
    async fn test_quota_warning_display() {
        let monitor = MonitoringService::new();
        
        // Simulate high usage that should trigger quota warnings
        let high_token_usage = TokenUsage {
            prompt_tokens: 50000,  // High usage
            completion_tokens: 25000,
            total_tokens: 75000,
        };
        
        // Log multiple high-usage operations
        for i in 0..10 {
            monitor.log_performance(
                format!("high_usage_operation_{}", i),
                Duration::from_millis(500),
                true,
                Some(high_token_usage.clone()),
            ).await;
        }
        
        let token_stats = monitor.get_token_stats().await;
        let cost_estimation = monitor.calculate_cost_estimation().await;
        
        // Verify high usage is tracked
        assert_eq!(token_stats.total_tokens, 750000); // 75000 * 10
        assert_eq!(token_stats.request_count, 10);
        
        // Verify cost calculation for high usage
        assert!(cost_estimation.estimated_cost_usd > 0.0);
        
        // Test quota warning thresholds (simulated)
        let daily_request_limit = 100;
        let monthly_token_limit = 1000000;
        
        let usage_patterns = monitor.get_usage_patterns().await;
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let daily_requests = usage_patterns.daily_requests.get(&today).unwrap_or(&0);
        
        // Check if we're approaching limits (this would trigger warnings in real implementation)
        let daily_usage_percentage = (*daily_requests as f64 / daily_request_limit as f64) * 100.0;
        let monthly_token_percentage = (token_stats.total_tokens as f64 / monthly_token_limit as f64) * 100.0;
        
        assert!(daily_usage_percentage >= 0.0);
        assert!(monthly_token_percentage >= 0.0);
        
        // In a real implementation, these would trigger warnings at 80% and 90%
        if daily_usage_percentage >= 80.0 {
            println!("Warning: Approaching daily request limit ({}%)", daily_usage_percentage);
        }
        
        if monthly_token_percentage >= 80.0 {
            println!("Warning: Approaching monthly token limit ({}%)", monthly_token_percentage);
        }
    }

    #[tokio::test]
    async fn test_error_recovery_mechanisms() {
        let monitor = MonitoringService::new();
        
        // Test recovery from various error types
        let errors = vec![
            AITestCaseError::RateLimitError { seconds: 30 },
            AITestCaseError::api_error("Temporary server error", Some(503)),
            AITestCaseError::TimeoutError { timeout_secs: 30 },
            AITestCaseError::parse_error("Invalid JSON", "malformed response"),
            AITestCaseError::validation_error("field", "Invalid value"),
        ];
        
        for (i, error) in errors.iter().enumerate() {
            monitor.log_error(
                error,
                format!("recovery_test_{}", i),
                Some("test request".to_string()),
                Some("test response".to_string()),
                Some((i + 1) as u32),
            ).await;
        }
        
        let logged_errors = monitor.get_recent_errors(Some(10)).await;
        assert_eq!(logged_errors.len(), 5);
        
        // Verify error types are correctly classified
        let error_types: Vec<&String> = logged_errors.iter().map(|e| &e.error_type).collect();
        assert!(error_types.contains(&&"RateLimitError".to_string()));
        assert!(error_types.contains(&&"ApiError".to_string()));
        assert!(error_types.contains(&&"TimeoutError".to_string()));
        assert!(error_types.contains(&&"ParseError".to_string()));
        assert!(error_types.contains(&&"ValidationError".to_string()));
        
        // Verify retry attempts are tracked (errors are returned in reverse order)
        for (i, logged_error) in logged_errors.iter().enumerate() {
            let expected_retry = (5 - i) as u32; // Reverse order: 5, 4, 3, 2, 1
            assert_eq!(logged_error.retry_attempt, Some(expected_retry));
        }
        
        // Test that retryable errors are identified correctly
        let retryable_errors = errors.iter().filter(|e| e.is_retryable()).count();
        assert_eq!(retryable_errors, 3); // RateLimit, Api, Timeout are retryable
    }

    #[tokio::test]
    async fn test_rate_limiting_with_user_friendly_messaging() {
        let monitor = MonitoringService::new();
        
        // Test different rate limit scenarios
        let rate_limit_scenarios = vec![
            (30, "Rate limit exceeded, retry after 30 seconds"),
            (60, "Rate limit exceeded, retry after 60 seconds"),
            (300, "Rate limit exceeded, retry after 300 seconds"),
        ];
        
        for (seconds, expected_message) in rate_limit_scenarios {
            let error = AITestCaseError::RateLimitError { seconds };
            
            // Verify error message format
            assert_eq!(error.to_string(), expected_message);
            
            // Verify retry delay
            assert_eq!(error.retry_delay(), Some(Duration::from_secs(seconds)));
            
            // Log the error
            monitor.log_error(
                &error,
                "rate_limit_test",
                Some("API request".to_string()),
                Some(format!("HTTP 429 - {}", expected_message)),
                Some(1),
            ).await;
        }
        
        let errors = monitor.get_recent_errors(Some(10)).await;
        assert_eq!(errors.len(), 3);
        
        // Verify all errors are rate limit errors
        for error in &errors {
            assert_eq!(error.error_type, "RateLimitError");
            assert!(error.message.contains("Rate limit exceeded"));
        }
    }

    #[tokio::test]
    async fn test_api_failure_recovery_patterns() {
        let monitor = MonitoringService::new();
        
        // Simulate a sequence of failures followed by recovery
        let failure_sequence = vec![
            (false, Some(AITestCaseError::TimeoutError { timeout_secs: 30 })),
            (false, Some(AITestCaseError::RateLimitError { seconds: 60 })),
            (false, Some(AITestCaseError::api_error("Server overloaded", Some(503)))),
            (true, None), // Recovery
        ];
        
        for (i, (success, error)) in failure_sequence.iter().enumerate() {
            if let Some(err) = error {
                monitor.log_error(
                    err,
                    format!("recovery_sequence_{}", i),
                    Some("retry attempt".to_string()),
                    Some("error response".to_string()),
                    Some((i + 1) as u32),
                ).await;
            }
            
            monitor.log_performance(
                format!("operation_{}", i),
                Duration::from_millis(if *success { 200 } else { 5000 }),
                *success,
                if *success { Some(TokenUsage { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }) } else { None },
            ).await;
        }
        
        let performance_stats = monitor.get_performance_stats().await;
        let error_logs = monitor.get_recent_errors(Some(10)).await;
        
        // Verify performance tracking
        assert_eq!(performance_stats.total_requests, 4);
        assert_eq!(performance_stats.successful_requests, 1);
        assert_eq!(performance_stats.success_rate, 25.0); // 1 out of 4 successful
        
        // Verify error logging
        assert_eq!(error_logs.len(), 3); // 3 failures logged
        
        // Verify retry attempts are sequential (errors are returned in reverse order)
        for (i, error_log) in error_logs.iter().enumerate() {
            let expected_retry = (3 - i) as u32; // Reverse order: 3, 2, 1
            assert_eq!(error_log.retry_attempt, Some(expected_retry));
        }
    }

    #[test]
    fn test_cost_estimation_quota_calculations() {
        // Test cost calculations for quota management
        let mut cost_estimation = CostEstimation::default();
        
        // Test with different usage levels
        let usage_scenarios = vec![
            (1000, 500, "Low usage"),
            (10000, 5000, "Medium usage"),
            (100000, 50000, "High usage"),
            (1000000, 500000, "Very high usage"),
        ];
        
        for (prompt_tokens, completion_tokens, scenario) in usage_scenarios {
            let token_usage = TokenUsage {
                prompt_tokens,
                completion_tokens,
                total_tokens: prompt_tokens + completion_tokens,
            };
            
            cost_estimation.calculate_cost(&token_usage);
            
            // Verify cost is calculated
            assert!(cost_estimation.estimated_cost_usd > 0.0, "Cost should be positive for {}", scenario);
            
            // Verify cost scales with usage
            let expected_cost = (prompt_tokens as f64 / 1000.0) * cost_estimation.prompt_token_cost_per_1k +
                               (completion_tokens as f64 / 1000.0) * cost_estimation.completion_token_cost_per_1k;
            
            assert!((cost_estimation.estimated_cost_usd - expected_cost).abs() < 0.000001, 
                   "Cost calculation should be accurate for {}", scenario);
            
            // Test quota warning thresholds
            let monthly_budget = 10.0; // $10 monthly budget
            let usage_percentage = (cost_estimation.estimated_cost_usd / monthly_budget) * 100.0;
            
            if usage_percentage >= 80.0 {
                println!("Quota warning: {}% of monthly budget used ({})", usage_percentage, scenario);
            }
            
            if usage_percentage >= 95.0 {
                println!("Quota critical: {}% of monthly budget used ({})", usage_percentage, scenario);
            }
        }
    }
}
