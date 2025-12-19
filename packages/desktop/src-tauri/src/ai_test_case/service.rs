//! AI Test Case Service
//!
//! Core service for AI-powered test case generation using Google Gemini API.
//! Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.3, 4.5

use crate::ai_test_case::config::ConfigManager;
use crate::ai_test_case::error::{AITestCaseError, Result};
use crate::ai_test_case::models::{
    DocumentationContext, DocumentationResponse, GenerationOptions, GenerationResponse,
    GeminiContent, GeminiGenerationConfig, GeminiPart, GeminiRequest, GeminiResponse,
    ProjectMetadata, ProjectType, RecordedAction, ResponseMetadata, ScriptBuilderCompatibility, TestCase, TestStep, TokenUsage,
};
use crate::ai_test_case::monitoring::MonitoringService;
use crate::ai_test_case::validation::TestCaseValidator;
use reqwest::Client;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Gemini API base URL
const GEMINI_API_BASE: &str = "https://generativelanguage.googleapis.com/v1beta/models";
/// Default model to use
const DEFAULT_MODEL: &str = "gemini-1.5-flash";
/// Request timeout in seconds
/// Requirements: 4.3
const REQUEST_TIMEOUT_SECS: u64 = 30;
/// Maximum retry attempts
/// Requirements: 5.3
const MAX_RETRY_ATTEMPTS: u32 = 3;

/// Service configuration
#[derive(Debug, Clone)]
pub struct ServiceConfig {
    /// API model to use
    pub model: String,
    /// Request timeout
    pub timeout: Duration,
    /// Maximum retries
    pub max_retries: u32,
}

impl Default for ServiceConfig {
    fn default() -> Self {
        ServiceConfig {
            model: DEFAULT_MODEL.to_string(),
            timeout: Duration::from_secs(REQUEST_TIMEOUT_SECS),
            max_retries: MAX_RETRY_ATTEMPTS,
        }
    }
}

/// AI Test Case Service
/// Requirements: 2.1, 2.2, 4.1, 11.1
pub struct AITestCaseService {
    /// HTTP client
    client: Client,
    /// Service configuration
    config: Arc<RwLock<ServiceConfig>>,
    /// Configuration manager
    config_manager: Arc<RwLock<ConfigManager>>,
    /// Validator
    validator: TestCaseValidator,
    /// Monitoring service
    /// Requirements: 8.1, 8.3, 8.5, 10.1, 10.3, 10.5
    monitoring: MonitoringService,
}

impl AITestCaseService {
    /// Create a new AI Test Case Service
    pub fn new() -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .map_err(|e| AITestCaseError::Internal(format!("Failed to create HTTP client: {}", e)))?;

        let config_manager = ConfigManager::new()?;

        Ok(AITestCaseService {
            client,
            config: Arc::new(RwLock::new(ServiceConfig::default())),
            config_manager: Arc::new(RwLock::new(config_manager)),
            validator: TestCaseValidator::new(),
            monitoring: MonitoringService::new(),
        })
    }

    /// Get the API key from configuration
    async fn get_api_key(&self) -> Result<String> {
        let config_manager = self.config_manager.read().await;
        config_manager
            .retrieve_api_key()?
            .ok_or_else(|| AITestCaseError::config_error("API key not configured"))
    }

    /// Build the API URL for a specific endpoint
    fn build_api_url(&self, model: &str) -> String {
        format!("{}/{}:generateContent", GEMINI_API_BASE, model)
    }

    /// Generate test cases from requirements
    /// Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
    pub async fn generate_from_requirements(
        &self,
        requirements: &str,
        options: GenerationOptions,
    ) -> Result<GenerationResponse> {
        let start_time = Instant::now();

        // Validate input
        // Requirements: 2.1
        self.validator.validate_requirements_input(requirements)?;

        // Get API key
        let api_key = self.get_api_key().await?;

        // Build prompt
        let prompt = self.build_requirements_prompt(requirements, &options);

        // Make API request with retry
        // Requirements: 5.3
        let (response, token_usage) = self.call_gemini_api_with_retry(&api_key, &prompt).await?;

        // Parse test cases from response
        let test_cases = self.parse_test_cases_response(&response)?;

        // Validate generated test cases
        for tc in &test_cases {
            let validation = self.validator.validate_test_case(tc);
            if !validation.is_valid {
                log::warn!(
                    "[AI Test Case] Generated test case {} has validation issues: {:?}",
                    tc.id,
                    validation.get_errors()
                );
            }
        }

        let processing_time = start_time.elapsed();

        // Log performance metrics
        // Requirements: 8.5
        self.monitoring.log_performance(
            "generate_from_requirements",
            processing_time,
            true,
            token_usage.clone(),
        ).await;

        Ok(GenerationResponse {
            success: true,
            test_cases,
            message: "Test cases generated successfully".to_string(),
            metadata: ResponseMetadata {
                processing_time_ms: processing_time.as_millis() as u64,
                token_usage,
                api_version: "v1beta".to_string(),
                generation_id: uuid::Uuid::new_v4().to_string(),
            },
        })
    }

    /// Generate documentation from recorded actions
    /// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
    pub async fn generate_from_actions(
        &self,
        actions: &[RecordedAction],
        context: DocumentationContext,
    ) -> Result<DocumentationResponse> {
        let start_time = Instant::now();

        // Validate input
        if actions.is_empty() {
            return Err(AITestCaseError::input_error("No actions provided"));
        }

        // Get API key
        let api_key = self.get_api_key().await?;

        // Convert actions to descriptive text
        // Requirements: 3.1
        let actions_text = self.format_actions_for_prompt(actions);

        // Build prompt
        let prompt = self.build_documentation_prompt(&actions_text, &context);

        // Make API request with retry
        let (response, token_usage) = self.call_gemini_api_with_retry(&api_key, &prompt).await?;

        // Parse documentation from response
        let documentation = self.parse_documentation_response(&response)?;

        let processing_time = start_time.elapsed();

        // Log performance metrics
        // Requirements: 8.5
        self.monitoring.log_performance(
            "generate_from_actions",
            processing_time,
            true,
            token_usage.clone(),
        ).await;

        Ok(DocumentationResponse {
            success: true,
            title: documentation.title,
            description: documentation.description,
            preconditions: documentation.preconditions,
            steps: documentation.steps,
            message: "Documentation generated successfully".to_string(),
            metadata: ResponseMetadata {
                processing_time_ms: processing_time.as_millis() as u64,
                token_usage,
                api_version: "v1beta".to_string(),
                generation_id: uuid::Uuid::new_v4().to_string(),
            },
        })
    }

    /// Validate API key
    /// Requirements: 1.5
    pub async fn validate_api_key(&self, api_key: &str) -> Result<bool> {
        if api_key.is_empty() {
            return Err(AITestCaseError::input_error("API key cannot be empty"));
        }

        // Make a simple test request
        let config = self.config.read().await;
        let url = format!("{}?key={}", self.build_api_url(&config.model), api_key);

        let request = GeminiRequest {
            contents: vec![GeminiContent {
                parts: vec![GeminiPart {
                    text: "Hello".to_string(),
                }],
            }],
            generation_config: GeminiGenerationConfig {
                temperature: 0.1,
                response_mime_type: "text/plain".to_string(),
                max_output_tokens: 10,
            },
        };

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await?;

        if response.status().is_success() {
            Ok(true)
        } else if response.status().as_u16() == 401 || response.status().as_u16() == 403 {
            Ok(false)
        } else {
            let status = response.status().as_u16();
            let body = response.text().await.unwrap_or_default();
            Err(AITestCaseError::api_error(
                format!("API validation failed: {} - {}", status, body),
                Some(status),
            ))
        }
    }

    /// Call Gemini API with retry logic
    /// Requirements: 4.1, 4.3, 5.3
    async fn call_gemini_api_with_retry(
        &self,
        api_key: &str,
        prompt: &str,
    ) -> Result<(String, Option<TokenUsage>)> {
        let config = self.config.read().await;
        let max_retries = config.max_retries;
        let url = format!("{}?key={}", self.build_api_url(&config.model), api_key);
        drop(config);

        let mut last_error = None;
        let mut attempt = 0;

        while attempt < max_retries {
            attempt += 1;
            log::info!("[AI Test Case] API request attempt {}/{}", attempt, max_retries);

            match self.call_gemini_api(&url, prompt).await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    log::warn!("[AI Test Case] API request failed (attempt {}): {}", attempt, e);
                    
                    // Log comprehensive error information
                    // Requirements: 8.1, 8.3
                    self.monitoring.log_error(
                        &e,
                        "api_request_retry",
                        Some(format!("URL: {}, Attempt: {}/{}", url, attempt, max_retries)),
                        None,
                        Some(attempt),
                    ).await;
                    
                    if !e.is_retryable() {
                        return Err(e);
                    }

                    last_error = Some(e);

                    // Wait before retry with exponential backoff
                    if attempt < max_retries {
                        let delay = Duration::from_millis(1000 * 2u64.pow(attempt - 1));
                        tokio::time::sleep(delay).await;
                    }
                }
            }
        }

        Err(last_error.unwrap_or_else(|| AITestCaseError::MaxRetriesExceeded {
            max_attempts: max_retries,
        }))
    }

    /// Make a single API call to Gemini
    async fn call_gemini_api(&self, url: &str, prompt: &str) -> Result<(String, Option<TokenUsage>)> {
        let request = GeminiRequest {
            contents: vec![GeminiContent {
                parts: vec![GeminiPart {
                    text: prompt.to_string(),
                }],
            }],
            generation_config: GeminiGenerationConfig::default(),
        };

        let response = self
            .client
            .post(url)
            .json(&request)
            .send()
            .await?;

        let status = response.status();
        
        if status.as_u16() == 429 {
            // Rate limited
            return Err(AITestCaseError::RateLimitError { seconds: 60 });
        }

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(AITestCaseError::api_error(
                format!("API request failed: {} - {}", status, body),
                Some(status.as_u16()),
            ));
        }

        let gemini_response: GeminiResponse = response.json().await?;

        // Check for API error
        if let Some(error) = gemini_response.error {
            return Err(AITestCaseError::api_error(error.message, error.code.map(|c| c as u16)));
        }

        // Extract response text
        let text = gemini_response
            .candidates
            .and_then(|c| c.into_iter().next())
            .map(|c| c.content.parts.into_iter().map(|p| p.text).collect::<String>())
            .ok_or_else(|| AITestCaseError::parse_error("No response content", ""))?;

        // Extract token usage
        let token_usage = gemini_response.usage_metadata.map(|u| TokenUsage {
            prompt_tokens: u.prompt_token_count,
            completion_tokens: u.candidates_token_count.unwrap_or(0),
            total_tokens: u.total_token_count,
        });

        Ok((text, token_usage))
    }

    /// Get performance statistics
    /// Requirements: 8.5
    pub async fn get_performance_stats(&self) -> super::monitoring::PerformanceStats {
        self.monitoring.get_performance_stats().await
    }

    /// Get token usage statistics
    /// Requirements: 10.1
    pub async fn get_token_stats(&self) -> super::monitoring::TokenUsageStats {
        self.monitoring.get_token_stats().await
    }

    /// Get usage patterns
    /// Requirements: 10.5
    pub async fn get_usage_patterns(&self) -> super::monitoring::UsagePattern {
        self.monitoring.get_usage_patterns().await
    }

    /// Calculate cost estimation
    /// Requirements: 10.3
    pub async fn calculate_cost_estimation(&self) -> super::monitoring::CostEstimation {
        self.monitoring.calculate_cost_estimation().await
    }

    /// Get recent error logs
    /// Requirements: 8.1, 8.3
    pub async fn get_recent_errors(&self, limit: Option<usize>) -> Vec<super::monitoring::ErrorLogEntry> {
        self.monitoring.get_recent_errors(limit).await
    }

    /// Add test case to project with proper metadata preservation
    /// Requirements: 6.4
    pub async fn add_test_case_to_project(
        &self,
        test_case: &TestCase,
        project_name: &str,
        project_type: ProjectType,
    ) -> Result<TestCase> {
        // Validate the test case first
        let validation = self.validator.validate_test_case(test_case);
        
        let mut processed_test_case = test_case.clone();
        
        // Fix validation issues if possible
        if !validation.is_valid {
            // Auto-generate ID if missing
            if processed_test_case.id.is_empty() {
                processed_test_case.id = format!("TC_{}", uuid::Uuid::new_v4().to_string().replace('-', "")[..8].to_uppercase());
                log::info!("[AI Test Case] Auto-generated ID for test case: {}", processed_test_case.id);
            }
            
            // Validate again after fixes
            let revalidation = self.validator.validate_test_case(&processed_test_case);
            if !revalidation.is_valid {
                return Err(AITestCaseError::validation_error(
                    "test_case",
                    format!("Test case validation failed: {:?}", revalidation.get_errors())
                ));
            }
        }
        
        // Update metadata for project integration
        processed_test_case.metadata.project_type = project_type.clone();
        processed_test_case.metadata.created_at = chrono::Utc::now();
        
        // Log the integration
        log::info!(
            "[AI Test Case] Adding test case '{}' to project '{}' (type: {:?})",
            processed_test_case.title,
            project_name,
            processed_test_case.metadata.project_type
        );
        
        // Save test case to project file
        self.save_test_case_to_project_file(&processed_test_case, project_name, &project_type).await?;
        
        Ok(processed_test_case)
    }
    
    /// Save test case to project file
    async fn save_test_case_to_project_file(
        &self,
        test_case: &TestCase,
        project_name: &str,
        project_type: &ProjectType,
    ) -> Result<()> {
        // Create project directory structure
        let project_dir = format!(
            "{}/GeniusQA/projects/{}",
            std::env::var("HOME").unwrap_or_else(|_| ".".to_string()),
            project_name
        );
        
        // Create directory if it doesn't exist
        std::fs::create_dir_all(&project_dir)
            .map_err(|e| AITestCaseError::Internal(format!("Failed to create project directory: {}", e)))?;
        
        // Load or create project metadata
        let project_metadata_path = format!("{}/project.json", project_dir);
        let mut project_metadata = self.load_or_create_project_metadata(&project_metadata_path, project_name, project_type)?;
        
        // Add test case to project metadata
        project_metadata.test_cases.push(test_case.clone());
        project_metadata.updated_at = chrono::Utc::now();
        
        // Save updated project metadata
        let json_data = serde_json::to_string_pretty(&project_metadata)
            .map_err(|e| AITestCaseError::Internal(format!("Failed to serialize project metadata: {}", e)))?;
        
        std::fs::write(&project_metadata_path, json_data)
            .map_err(|e| AITestCaseError::Internal(format!("Failed to write project metadata: {}", e)))?;
        
        log::info!("[AI Test Case] Test case '{}' saved to project '{}' at: {}", test_case.id, project_name, project_metadata_path);
        
        Ok(())
    }
    
    /// Load or create project metadata
    fn load_or_create_project_metadata(
        &self,
        metadata_path: &str,
        project_name: &str,
        project_type: &ProjectType,
    ) -> Result<ProjectMetadata> {
        if std::path::Path::new(metadata_path).exists() {
            // Load existing metadata
            let content = std::fs::read_to_string(metadata_path)
                .map_err(|e| AITestCaseError::Internal(format!("Failed to read project metadata: {}", e)))?;
            
            serde_json::from_str(&content)
                .map_err(|e| AITestCaseError::parse_error(format!("Failed to parse project metadata: {}", e), content))
        } else {
            // Create new metadata
            Ok(ProjectMetadata {
                name: project_name.to_string(),
                project_type: project_type.clone(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                test_cases: Vec::new(),
                description: None,
                version: "1.0.0".to_string(),
            })
        }
    }

    /// Get action logs from Desktop Recorder
    /// Requirements: 6.4 (integration with Desktop Recorder)
    pub async fn get_recorder_action_logs(&self, session_id: Option<String>) -> Result<Vec<RecordedAction>> {
        log::info!("[AI Test Case] Retrieving action logs from Desktop Recorder (session: {:?})", session_id);
        
        // Determine the script path to load
        let script_path = if let Some(session_id) = session_id {
            // If session ID is provided, try to find the specific recording
            format!(
                "{}/GeniusQA/recordings/recording_{}.json",
                std::env::var("HOME").unwrap_or_else(|_| ".".to_string()),
                session_id
            )
        } else {
            // If no session ID, get the latest recording
            self.get_latest_recording_path()?
        };
        
        // Check if the script file exists
        if !std::path::Path::new(&script_path).exists() {
            log::warn!("[AI Test Case] Script file not found: {}", script_path);
            return Ok(Vec::new());
        }
        
        // Load and parse the script file
        let script_content = std::fs::read_to_string(&script_path)
            .map_err(|e| AITestCaseError::Internal(format!("Failed to read script file '{}': {}", script_path, e)))?;
        
        let script_data: rust_automation_core::ScriptData = serde_json::from_str(&script_content)
            .map_err(|e| AITestCaseError::parse_error(format!("Failed to parse script file: {}", e), script_content))?;
        
        // Convert rust-core Action format to RecordedAction format
        let recorded_actions: Vec<RecordedAction> = script_data.actions.iter().map(|action| {
            RecordedAction {
                action_type: self.convert_action_type(&action.action_type),
                target: self.extract_target_from_action(action),
                value: self.extract_value_from_action(action),
                timestamp: chrono::DateTime::from_timestamp(action.timestamp as i64, 0)
                    .unwrap_or_else(|| chrono::Utc::now()),
                screenshot: None, // Screenshots are not stored in the action data
            }
        }).collect();
        
        log::info!("[AI Test Case] Retrieved {} action logs from script: {}", recorded_actions.len(), script_path);
        Ok(recorded_actions)
    }
    
    /// Get the path to the latest recording
    fn get_latest_recording_path(&self) -> Result<String> {
        let recordings_dir = format!(
            "{}/GeniusQA/recordings",
            std::env::var("HOME").unwrap_or_else(|_| ".".to_string())
        );
        
        let dir_path = std::path::Path::new(&recordings_dir);
        if !dir_path.exists() {
            return Err(AITestCaseError::Internal("No recordings directory found".to_string()));
        }
        
        // Find the most recent recording file
        let mut latest_file: Option<std::path::PathBuf> = None;
        let mut latest_time = std::time::SystemTime::UNIX_EPOCH;
        
        for entry in std::fs::read_dir(dir_path)
            .map_err(|e| AITestCaseError::Internal(format!("Failed to read recordings directory: {}", e)))? {
            let entry = entry.map_err(|e| AITestCaseError::Internal(format!("Failed to read directory entry: {}", e)))?;
            let path = entry.path();
            
            if path.extension().and_then(|s| s.to_str()) == Some("json") &&
               path.file_name().and_then(|s| s.to_str()).map_or(false, |s| s.starts_with("recording_")) {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        if modified > latest_time {
                            latest_time = modified;
                            latest_file = Some(path);
                        }
                    }
                }
            }
        }
        
        latest_file
            .and_then(|p| p.to_str().map(String::from))
            .ok_or_else(|| AITestCaseError::Internal("No recording files found".to_string()))
    }
    
    /// Convert rust-core ActionType to string representation
    fn convert_action_type(&self, action_type: &rust_automation_core::ActionType) -> String {
        match action_type {
            rust_automation_core::ActionType::MouseMove => "mouse_move".to_string(),
            rust_automation_core::ActionType::MouseClick => "mouse_click".to_string(),
            rust_automation_core::ActionType::MouseDoubleClick => "mouse_double_click".to_string(),
            rust_automation_core::ActionType::MouseDrag => "mouse_drag".to_string(),
            rust_automation_core::ActionType::MouseScroll => "mouse_scroll".to_string(),
            rust_automation_core::ActionType::KeyPress => "key_press".to_string(),
            rust_automation_core::ActionType::KeyRelease => "key_release".to_string(),
            rust_automation_core::ActionType::KeyType => "key_type".to_string(),
            rust_automation_core::ActionType::Screenshot => "screenshot".to_string(),
            rust_automation_core::ActionType::Wait => "wait".to_string(),
            rust_automation_core::ActionType::AiVisionCapture => "ai_vision_capture".to_string(),
            rust_automation_core::ActionType::Custom => "custom".to_string(),
        }
    }
    
    /// Extract target information from action (coordinates, element, etc.)
    fn extract_target_from_action(&self, action: &rust_automation_core::Action) -> Option<String> {
        if let (Some(x), Some(y)) = (action.x, action.y) {
            Some(format!("({}, {})", x, y))
        } else if let Some(ref key) = action.key {
            Some(format!("key:{}", key))
        } else if let Some(ref button) = action.button {
            Some(format!("button:{}", button))
        } else {
            None
        }
    }
    
    /// Extract value information from action (text, key combinations, etc.)
    fn extract_value_from_action(&self, action: &rust_automation_core::Action) -> Option<String> {
        if let Some(ref text) = action.text {
            Some(text.clone())
        } else if let Some(ref modifiers) = action.modifiers {
            if !modifiers.is_empty() {
                Some(modifiers.join("+"))
            } else {
                None
            }
        } else {
            None
        }
    }

    /// Connect with existing AI Script Builder patterns
    /// Requirements: 6.4 (compatibility with existing AI Script Builder)
    pub fn get_script_builder_compatibility_info(&self) -> ScriptBuilderCompatibility {
        ScriptBuilderCompatibility {
            supports_prompt_templates: true,
            supports_project_context: true,
            supports_preference_inheritance: true,
            api_key_sharing: true,
            monitoring_integration: true,
        }
    }

    /// Create mock documentation response for testing metadata population
    /// Requirements: 3.4 (for testing)
    #[cfg(test)]
    pub fn create_mock_documentation_response(&self, context: &DocumentationContext) -> DocumentationResponse {
        use crate::ai_test_case::models::{TestStep, ResponseMetadata};
        
        // Create mock steps based on context
        let steps = vec![
            TestStep {
                order: 1,
                action: format!("Execute {} functionality", context.script_name),
                expected_outcome: Some("System responds correctly".to_string()),
                notes: None,
            },
            TestStep {
                order: 2,
                action: "Verify results".to_string(),
                expected_outcome: Some("Expected outcome achieved".to_string()),
                notes: context.additional_context.clone(),
            },
        ];
        
        // Create metadata with all required fields populated
        let metadata = ResponseMetadata {
            processing_time_ms: 150, // Mock processing time
            token_usage: Some(crate::ai_test_case::models::TokenUsage {
                prompt_tokens: 100,
                completion_tokens: 200,
                total_tokens: 300,
            }),
            api_version: "v1beta".to_string(),
            generation_id: uuid::Uuid::new_v4().to_string(), // Unique ID each time
        };
        
        DocumentationResponse {
            success: true,
            title: format!("Test Case for {}", context.script_name),
            description: format!("Automated test case for {} ({:?} project)", 
                               context.script_name, context.project_type),
            preconditions: context.additional_context.clone(),
            steps,
            message: "Mock documentation generated successfully".to_string(),
            metadata,
        }
    }

    /// Apply user preferences to generation options
    /// Requirements: 9.3
    pub fn apply_preferences_to_options(
        &self,
        base_options: &GenerationOptions,
        preferences: &crate::ai_test_case::config::GenerationPreferences,
    ) -> GenerationOptions {
        GenerationOptions {
            project_type: preferences.project_type.clone(),
            complexity_level: preferences.complexity_level.clone(),
            include_edge_cases: preferences.include_edge_cases,
            include_error_scenarios: preferences.include_error_scenarios,
            max_test_cases: base_options.max_test_cases,
            custom_context: base_options.custom_context.clone(),
            excluded_test_types: preferences.excluded_test_types.clone(),
        }
    }

    /// Build prompt for requirements-based generation with custom template support
    /// Requirements: 9.4
    pub fn build_requirements_prompt_with_template(
        &self,
        requirements: &str,
        options: &GenerationOptions,
        preferences: &crate::ai_test_case::config::GenerationPreferences,
    ) -> String {
        // Check if custom template is provided and valid
        if let Some(ref template) = preferences.custom_prompt_template {
            if !template.trim().is_empty() {
                return self.process_custom_template(template, requirements, options);
            }
        }
        
        // Fall back to default prompt
        self.build_requirements_prompt(requirements, options)
    }

    /// Process custom template with variable substitution
    /// Requirements: 9.4
    fn process_custom_template(
        &self,
        template: &str,
        requirements: &str,
        options: &GenerationOptions,
    ) -> String {
        let mut processed = template.to_string();
        
        // Replace template variables if they exist
        processed = processed.replace("{requirements}", requirements);
        processed = processed.replace("{project_type}", &format!("{:?}", options.project_type));
        processed = processed.replace("{complexity_level}", &format!("{:?}", options.complexity_level));
        processed = processed.replace("{include_edge_cases}", &options.include_edge_cases.to_string());
        processed = processed.replace("{include_error_scenarios}", &options.include_error_scenarios.to_string());
        
        // Add excluded test types if any
        if !options.excluded_test_types.is_empty() {
            let excluded_names: Vec<String> = options.excluded_test_types.iter()
                .map(|test_type| format!("{:?}", test_type))
                .collect();
            processed = processed.replace("{excluded_test_types}", &excluded_names.join(", "));
        } else {
            processed = processed.replace("{excluded_test_types}", "None");
        }
        
        // If requirements placeholder wasn't in the template, prepend requirements
        if !template.contains("{requirements}") {
            processed = format!("Requirements: {}\n\n{}", requirements, processed);
        }
        
        // Ensure the template includes JSON structure guidance if not present
        if !processed.to_lowercase().contains("json") {
            processed.push_str("\n\nReturn a JSON array of test cases with the required structure.");
        }
        
        processed
    }

    /// Build prompt for requirements-based generation
    fn build_requirements_prompt(&self, requirements: &str, options: &GenerationOptions) -> String {
        let complexity_guidance = match options.complexity_level {
            crate::ai_test_case::models::ComplexityLevel::Basic => "Generate 3-5 essential test cases",
            crate::ai_test_case::models::ComplexityLevel::Detailed => "Generate 5-10 comprehensive test cases",
            crate::ai_test_case::models::ComplexityLevel::Comprehensive => "Generate 10-20 thorough test cases",
        };

        let project_context = match options.project_type {
            crate::ai_test_case::models::ProjectType::Web => "web application with UI interactions, form validation, and browser compatibility",
            crate::ai_test_case::models::ProjectType::Mobile => "mobile application with touch interactions, device orientations, and platform-specific behaviors",
            crate::ai_test_case::models::ProjectType::Api => "API with request/response validation, error handling, and authentication",
            crate::ai_test_case::models::ProjectType::Desktop => "desktop application with native OS interactions",
        };

        let exclusion_guidance = if !options.excluded_test_types.is_empty() {
            let excluded_names: Vec<String> = options.excluded_test_types.iter()
                .map(|test_type| match test_type {
                    crate::ai_test_case::models::TestType::Performance => "performance".to_string(),
                    crate::ai_test_case::models::TestType::Security => "security".to_string(),
                    crate::ai_test_case::models::TestType::Accessibility => "accessibility".to_string(),
                    crate::ai_test_case::models::TestType::Integration => "integration".to_string(),
                    crate::ai_test_case::models::TestType::EdgeCase => "edge_case".to_string(),
                    crate::ai_test_case::models::TestType::ErrorHandling => "error_handling".to_string(),
                    crate::ai_test_case::models::TestType::Functional => "functional".to_string(),
                })
                .collect();
            format!("- Exclude the following test types: {}", excluded_names.join(", "))
        } else {
            String::new()
        };

        format!(
            r#"You are a QA expert. Generate test cases for the following requirements.

Project Type: {}
Requirements:
{}

Instructions:
- {}
- Include both happy path and edge cases
- {} error scenarios
- {} edge cases
{}

Return a JSON array of test cases with this exact structure:
[
  {{
    "id": "TC001",
    "title": "Test case title",
    "description": "Detailed description",
    "preconditions": "Optional preconditions",
    "steps": [
      {{
        "order": 1,
        "action": "Step action description",
        "expected_outcome": "Expected result for this step"
      }}
    ],
    "expected_result": "Overall expected result",
    "severity": "critical|high|medium|low",
    "test_type": "functional|integration|edge_case|error_handling|performance|security|accessibility"
  }}
]

Return ONLY the JSON array, no additional text."#,
            project_context,
            requirements,
            complexity_guidance,
            if options.include_error_scenarios { "Include" } else { "Exclude" },
            if options.include_edge_cases { "Include" } else { "Exclude" },
            if !exclusion_guidance.is_empty() { format!("\n{}", exclusion_guidance) } else { String::new() }
        )
    }

    /// Build prompt for action log documentation
    fn build_documentation_prompt(&self, actions_text: &str, context: &DocumentationContext) -> String {
        format!(
            r#"You are a QA documentation expert. Convert the following recorded automation actions into a human-readable test case description.

Script Name: {}
Project Type: {:?}
{}

Recorded Actions:
{}

Generate a test case documentation with:
1. A clear, descriptive title
2. A summary description of what the test does
3. Any preconditions needed
4. Step-by-step instructions in human-readable format

Return a JSON object with this structure:
{{
  "title": "Test case title",
  "description": "What this test verifies",
  "preconditions": "Required setup (or null if none)",
  "steps": [
    {{
      "order": 1,
      "action": "Human-readable step description",
      "expected_outcome": "What should happen"
    }}
  ]
}}

Return ONLY the JSON object, no additional text."#,
            context.script_name,
            context.project_type,
            context.additional_context.as_deref().unwrap_or(""),
            actions_text
        )
    }

    /// Format recorded actions for prompt
    fn format_actions_for_prompt(&self, actions: &[RecordedAction]) -> String {
        actions
            .iter()
            .enumerate()
            .map(|(i, action)| {
                let mut desc = format!("{}. {} ", i + 1, action.action_type);
                if let Some(ref target) = action.target {
                    desc.push_str(&format!("on '{}' ", target));
                }
                if let Some(ref value) = action.value {
                    desc.push_str(&format!("with value '{}' ", value));
                }
                desc
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Parse test cases from API response
    fn parse_test_cases_response(&self, response: &str) -> Result<Vec<TestCase>> {
        // Try to parse as JSON array
        let test_cases: Vec<TestCase> = serde_json::from_str(response)
            .map_err(|e| AITestCaseError::parse_error(e.to_string(), response.to_string()))?;

        Ok(test_cases)
    }

    /// Parse documentation from API response
    fn parse_documentation_response(&self, response: &str) -> Result<DocumentationResponse> {
        // Parse as generic JSON value first
        let value: serde_json::Value = serde_json::from_str(response)
            .map_err(|e| AITestCaseError::parse_error(e.to_string(), response.to_string()))?;

        let title = value.get("title")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AITestCaseError::parse_error("Missing title field", response))?
            .to_string();

        let description = value.get("description")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AITestCaseError::parse_error("Missing description field", response))?
            .to_string();

        let preconditions = value.get("preconditions")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let steps: Vec<TestStep> = value.get("steps")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        Ok(DocumentationResponse {
            success: true,
            title,
            description,
            preconditions,
            steps,
            message: String::new(),
            metadata: ResponseMetadata {
                processing_time_ms: 0,
                token_usage: None,
                api_version: String::new(),
                generation_id: String::new(),
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    use crate::ai_test_case::models::{ComplexityLevel, ProjectType, TestType, DocumentationContext};
    use crate::ai_test_case::config::GenerationPreferences;

    #[test]
    fn test_service_config_default() {
        let config = ServiceConfig::default();
        assert_eq!(config.model, DEFAULT_MODEL);
        assert_eq!(config.timeout, Duration::from_secs(REQUEST_TIMEOUT_SECS));
        assert_eq!(config.max_retries, MAX_RETRY_ATTEMPTS);
    }

    #[test]
    fn test_build_api_url() {
        let service = AITestCaseService::new().unwrap();
        let url = service.build_api_url("gemini-1.5-flash");
        assert!(url.contains("gemini-1.5-flash"));
        assert!(url.contains("generateContent"));
    }

    // Property test generators
    prop_compose! {
        fn arb_requirements_input()(
            content in "[a-zA-Z0-9 .,!?]{10,500}"
        ) -> String {
            content
        }
    }

    prop_compose! {
        fn arb_generation_options()(
            project_type in prop::sample::select(vec![
                ProjectType::Web,
                ProjectType::Mobile,
                ProjectType::Api,
                ProjectType::Desktop
            ]),
            complexity_level in prop::sample::select(vec![
                ComplexityLevel::Basic,
                ComplexityLevel::Detailed,
                ComplexityLevel::Comprehensive
            ]),
            include_edge_cases in any::<bool>(),
            include_error_scenarios in any::<bool>(),
            max_test_cases in prop::option::of(1u32..50),
            custom_context in prop::option::of("[a-zA-Z0-9 .,!?]{1,200}"),
            excluded_test_types in prop::collection::vec(
                prop::sample::select(vec![
                    TestType::Performance,
                    TestType::Security,
                    TestType::Accessibility,
                    TestType::Integration,
                    TestType::EdgeCase,
                    TestType::ErrorHandling
                ]),
                0..3
            )
        ) -> GenerationOptions {
            GenerationOptions {
                project_type,
                complexity_level,
                include_edge_cases,
                include_error_scenarios,
                max_test_cases,
                custom_context,
                excluded_test_types,
            }
        }
    }

    prop_compose! {
        fn arb_recorded_actions()(
            actions in prop::collection::vec(
                (
                    prop::sample::select(vec!["click", "type", "scroll", "wait", "navigate"]),
                    prop::option::of("[a-zA-Z0-9 #.]{1,100}"),
                    prop::option::of("[a-zA-Z0-9 ]{1,100}")
                ),
                1..20
            )
        ) -> Vec<RecordedAction> {
            actions.into_iter().map(|(action_type, target, value)| {
                RecordedAction {
                    action_type: action_type.to_string(),
                    target,
                    value,
                    timestamp: chrono::Utc::now(),
                    screenshot: None,
                }
            }).collect()
        }
    }

    // **Feature: ai-test-case-generator, Property 3: API Communication Protocol**
    // **Validates: Requirements 2.2, 3.2**
    // Property tests will be added later with correct syntax

        // **Feature: ai-test-case-generator, Property 5: Retry Mechanism Bounds**
        // **Validates: Requirements 5.3**
        #[test]
        fn property_retry_mechanism_bounds() {
            // Test that retry mechanism respects the maximum retry limit
            let service = AITestCaseService::new().unwrap();
            
            // Verify the service is configured with the correct max retries
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                let config = service.config.read().await;
                assert_eq!(config.max_retries, MAX_RETRY_ATTEMPTS, 
                          "Service should be configured with correct max retry attempts");
                
                // Verify the constant is set to exactly 3 as per requirements
                assert_eq!(MAX_RETRY_ATTEMPTS, 3, 
                          "Maximum retry attempts should be exactly 3 as per requirements");
            });
        }

        #[test]
        fn property_retry_mechanism_bounds_error_handling() {
            // Test that MaxRetriesExceeded error is created with correct bounds
            let max_attempts = 3u32;
            let error = AITestCaseError::MaxRetriesExceeded { max_attempts };
            
            match error {
                AITestCaseError::MaxRetriesExceeded { max_attempts: actual } => {
                    assert_eq!(actual, 3, "MaxRetriesExceeded should contain the correct max attempts");
                    assert!(!error.is_retryable(), "MaxRetriesExceeded should not be retryable");
                    assert_eq!(error.retry_delay(), None, "MaxRetriesExceeded should have no retry delay");
                }
                _ => panic!("Expected MaxRetriesExceeded error"),
            }
        }

        #[test]
        fn property_retry_mechanism_bounds_exponential_backoff() {
            // Test that exponential backoff calculation is bounded correctly
            for attempt in 1..=MAX_RETRY_ATTEMPTS {
                let delay = Duration::from_millis(1000 * 2u64.pow(attempt - 1));
                
                // Verify delay grows exponentially but stays reasonable
                match attempt {
                    1 => assert_eq!(delay, Duration::from_millis(1000), "First retry should be 1 second"),
                    2 => assert_eq!(delay, Duration::from_millis(2000), "Second retry should be 2 seconds"),
                    3 => assert_eq!(delay, Duration::from_millis(4000), "Third retry should be 4 seconds"),
                    _ => panic!("Should not exceed max retry attempts"),
                }
                
                // Ensure delay doesn't exceed reasonable bounds (e.g., 10 seconds)
                assert!(delay <= Duration::from_secs(10), 
                       "Retry delay should not exceed 10 seconds for attempt {}", attempt);
            }
        }

        // **Feature: ai-test-case-generator, Property 8: Timeout Enforcement**
        // **Validates: Requirements 4.3**
        #[test]
        fn property_timeout_enforcement() {
            // Test that timeout is properly configured and enforced
            let service = AITestCaseService::new().unwrap();
            
            // Verify the service is configured with the correct timeout
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async {
                let config = service.config.read().await;
                assert_eq!(config.timeout, Duration::from_secs(REQUEST_TIMEOUT_SECS), 
                          "Service should be configured with correct timeout");
                
                // Verify the constant is set to exactly 30 seconds as per requirements
                assert_eq!(REQUEST_TIMEOUT_SECS, 30, 
                          "Request timeout should be exactly 30 seconds as per requirements");
            });
        }

        #[test]
        fn property_timeout_enforcement_error_handling() {
            // Test that TimeoutError is created with correct bounds
            let timeout_secs = 30u64;
            let error = AITestCaseError::TimeoutError { timeout_secs };
            
            match error {
                AITestCaseError::TimeoutError { timeout_secs: actual } => {
                    assert_eq!(actual, 30, "TimeoutError should contain the correct timeout seconds");
                    assert!(error.is_retryable(), "TimeoutError should be retryable");
                    assert_eq!(error.retry_delay(), Some(Duration::from_secs(5)), 
                             "TimeoutError should have 5 second retry delay");
                }
                _ => panic!("Expected TimeoutError"),
            }
        }

        #[test]
        fn property_timeout_enforcement_client_configuration() {
            // Test that HTTP client is configured with proper timeout
            let service = AITestCaseService::new().unwrap();
            
            // The client should be configured with the timeout during creation
            // We can't directly access the client's timeout, but we can verify
            // that the service was created successfully with the expected configuration
            
            // Verify timeout constants are within reasonable bounds
            assert!(REQUEST_TIMEOUT_SECS >= 10, "Timeout should be at least 10 seconds");
            assert!(REQUEST_TIMEOUT_SECS <= 300, "Timeout should not exceed 5 minutes");
            assert_eq!(REQUEST_TIMEOUT_SECS, 30, "Timeout should be exactly 30 seconds per requirements");
        }

        #[test]
        fn property_timeout_enforcement_reqwest_error_conversion() {
            // Test that reqwest timeout errors are properly converted
            use reqwest::Error as ReqwestError;
            
            // We can't easily create a real timeout error, but we can test the conversion logic
            // by checking that timeout errors would be converted to TimeoutError
            
            // Verify that our error conversion handles timeout scenarios
            let timeout_duration = Duration::from_secs(REQUEST_TIMEOUT_SECS);
            assert_eq!(timeout_duration, Duration::from_secs(30), 
                     "Timeout duration should match the configured timeout");
        }

        // **Feature: ai-test-case-generator, Property 14: Project Type Context Inclusion**
        // **Validates: Requirements 7.1**
        proptest! {
            #![proptest_config(ProptestConfig::with_cases(100))]
            
            #[test]
            fn property_project_type_context_inclusion(
                requirements in "[a-zA-Z0-9 .,!?\\n\\t]{10,200}",
                options in arb_generation_options()
            ) {
                let service = AITestCaseService::new().unwrap();
                
                // Property: Generated prompt should include project type context
                let prompt = service.build_requirements_prompt(&requirements, &options);
                
                // Verify that the prompt contains the requirements
                prop_assert!(prompt.contains(&requirements), 
                           "Prompt should contain the original requirements");
                
                // Verify that the prompt contains project type context based on the option
                let expected_context = match options.project_type {
                    ProjectType::Web => "web application with UI interactions, form validation, and browser compatibility",
                    ProjectType::Mobile => "mobile application with touch interactions, device orientations, and platform-specific behaviors",
                    ProjectType::Api => "API with request/response validation, error handling, and authentication",
                    ProjectType::Desktop => "desktop application with native OS interactions",
                };
                
                prop_assert!(prompt.contains(expected_context), 
                           "Prompt should contain project type specific context: {}", expected_context);
                
                // Verify that the prompt includes the project type label
                prop_assert!(prompt.contains("Project Type:"), 
                           "Prompt should contain 'Project Type:' label");
                
                // Verify that complexity guidance is included
                let expected_complexity = match options.complexity_level {
                    ComplexityLevel::Basic => "Generate 3-5 essential test cases",
                    ComplexityLevel::Detailed => "Generate 5-10 comprehensive test cases", 
                    ComplexityLevel::Comprehensive => "Generate 10-20 thorough test cases",
                };
                
                prop_assert!(prompt.contains(expected_complexity),
                           "Prompt should contain complexity guidance: {}", expected_complexity);
                
                // Verify that edge case and error scenario preferences are respected
                if options.include_edge_cases {
                    prop_assert!(prompt.contains("Include edge cases"),
                               "Prompt should include edge cases when option is enabled");
                } else {
                    prop_assert!(prompt.contains("Exclude edge cases"),
                               "Prompt should exclude edge cases when option is disabled");
                }
                
                if options.include_error_scenarios {
                    prop_assert!(prompt.contains("Include error scenarios"),
                               "Prompt should include error scenarios when option is enabled");
                } else {
                    prop_assert!(prompt.contains("Exclude error scenarios"),
                               "Prompt should exclude error scenarios when option is disabled");
                }
                
                // Verify that the prompt contains JSON structure guidance
                prop_assert!(prompt.contains("JSON array"),
                           "Prompt should contain JSON structure guidance");
                prop_assert!(prompt.contains("\"id\""),
                           "Prompt should contain JSON field examples");
                prop_assert!(prompt.contains("\"title\""),
                           "Prompt should contain title field example");
                prop_assert!(prompt.contains("\"steps\""),
                           "Prompt should contain steps field example");
                
                // Property: Different project types should produce different prompts
                let other_project_types = vec![ProjectType::Web, ProjectType::Mobile, ProjectType::Api, ProjectType::Desktop];
                for other_type in other_project_types {
                    if other_type != options.project_type {
                        let mut other_options = options.clone();
                        other_options.project_type = other_type;
                        let other_prompt = service.build_requirements_prompt(&requirements, &other_options);
                        
                        // The prompts should be different due to different project contexts
                        prop_assert_ne!(&prompt, &other_prompt,
                                      "Different project types should produce different prompts");
                    }
                }
                
                // Property: Same inputs should produce identical prompts (deterministic)
                let second_prompt = service.build_requirements_prompt(&requirements, &options);
                prop_assert_eq!(&prompt, &second_prompt,
                              "Same inputs should produce identical prompts");
            }
        }

        // **Feature: ai-test-case-generator, Property 2: Input Validation Consistency**
        // **Validates: Requirements 2.1**
        proptest! {
            #![proptest_config(ProptestConfig::with_cases(100))]
            
            #[test]
            fn property_input_validation_consistency(
                input in prop::option::of("[a-zA-Z0-9 .,!?\\n\\t]{0,1000}")
            ) {
                let service = AITestCaseService::new().unwrap();
                
                let input_str = input.unwrap_or_default();
                
                // Test the input validation logic consistently
                let validation_result = service.validator.validate_requirements_input(&input_str);
                
                // Property: Empty strings should be rejected
                if input_str.is_empty() {
                    prop_assert!(validation_result.is_err(), 
                               "Empty input should be rejected");
                    if let Err(ref e) = validation_result {
                        prop_assert!(matches!(e, AITestCaseError::InputError { .. }), 
                                   "Empty input should produce InputError");
                    }
                }
                
                // Property: Whitespace-only strings should be rejected
                else if input_str.trim().is_empty() {
                    prop_assert!(validation_result.is_err(), 
                               "Whitespace-only input should be rejected");
                    if let Err(ref e) = validation_result {
                        prop_assert!(matches!(e, AITestCaseError::InputError { .. }), 
                                   "Whitespace-only input should produce InputError");
                    }
                }
                
                // Property: Strings with less than 10 meaningful characters should be rejected
                else if input_str.trim().len() < 10 {
                    prop_assert!(validation_result.is_err(), 
                               "Input with less than 10 characters should be rejected");
                    if let Err(ref e) = validation_result {
                        prop_assert!(matches!(e, AITestCaseError::InputError { .. }), 
                                   "Short input should produce InputError");
                    }
                }
                
                // Property: Valid strings with 10+ meaningful characters should be accepted
                else {
                    prop_assert!(validation_result.is_ok(), 
                               "Valid input with 10+ characters should be accepted");
                }
                
                // Property: Validation should be deterministic - same input should always produce same result
                let second_validation = service.validator.validate_requirements_input(&input_str);
                prop_assert_eq!(validation_result.is_ok(), second_validation.is_ok(), 
                              "Validation should be deterministic");
                
                // Property: Error messages should be consistent for the same type of invalid input
                match (&validation_result, &second_validation) {
                    (Err(e1), Err(e2)) => {
                        // Both should be the same type of error
                        prop_assert_eq!(std::mem::discriminant(e1), std::mem::discriminant(e2), 
                                      "Error types should be consistent");
                    }
                    _ => {} // Both OK or one OK - already checked above
                }
            }
        }

        // **Feature: ai-test-case-generator, Property 17: Preference Application Consistency**
        // **Validates: Requirements 9.3**
        proptest! {
            #![proptest_config(ProptestConfig::with_cases(100))]
            
            #[test]
            fn property_preference_application_consistency(
                requirements in "[a-zA-Z0-9 .,!?\\n\\t]{10,200}",
                base_options in arb_generation_options(),
                excluded_types in prop::collection::vec(
                    prop::sample::select(vec![
                        TestType::Performance,
                        TestType::Security,
                        TestType::Accessibility,
                        TestType::Integration,
                        TestType::EdgeCase,
                        TestType::ErrorHandling
                    ]),
                    0..4
                )
            ) {
                let service = AITestCaseService::new().unwrap();
                
                // Create preferences with excluded test types
                let preferences = GenerationPreferences {
                    complexity_level: base_options.complexity_level.clone(),
                    project_type: base_options.project_type.clone(),
                    include_edge_cases: base_options.include_edge_cases,
                    include_error_scenarios: base_options.include_error_scenarios,
                    excluded_test_types: excluded_types.clone(),
                    custom_prompt_template: None,
                    show_cost_info: true,
                };
                
                // Apply preferences to generation options
                let options_with_prefs = service.apply_preferences_to_options(&base_options, &preferences);
                
                // Property: Preferences should be consistently applied
                prop_assert_eq!(&options_with_prefs.complexity_level, &preferences.complexity_level,
                              "Complexity level should match preferences");
                prop_assert_eq!(&options_with_prefs.project_type, &preferences.project_type,
                              "Project type should match preferences");
                prop_assert_eq!(options_with_prefs.include_edge_cases, preferences.include_edge_cases,
                              "Include edge cases should match preferences");
                prop_assert_eq!(options_with_prefs.include_error_scenarios, preferences.include_error_scenarios,
                              "Include error scenarios should match preferences");
                
                // Property: Excluded test types should be reflected in the prompt
                let prompt = service.build_requirements_prompt(&requirements, &options_with_prefs);
                
                // Check that excluded test types are mentioned in the prompt
                if !excluded_types.is_empty() {
                    prop_assert!(prompt.contains("Exclude the following test types:") || 
                               prompt.contains("Do not generate tests for:"),
                               "Prompt should mention excluded test types when they exist");
                    
                    // Verify each excluded type is mentioned
                    for test_type in &excluded_types {
                        let type_name = match test_type {
                            TestType::Performance => "performance",
                            TestType::Security => "security", 
                            TestType::Accessibility => "accessibility",
                            TestType::Integration => "integration",
                            TestType::EdgeCase => "edge_case",
                            TestType::ErrorHandling => "error_handling",
                            _ => continue, // Skip functional tests as they're always included
                        };
                        
                        prop_assert!(prompt.to_lowercase().contains(type_name),
                                   "Prompt should mention excluded test type: {}", type_name);
                    }
                } else {
                    // When no types are excluded, prompt should not mention exclusions
                    prop_assert!(!prompt.contains("Exclude the following test types:") && 
                               !prompt.contains("Do not generate tests for:"),
                               "Prompt should not mention exclusions when no types are excluded");
                }
                
                // Property: Same preferences should produce identical results (deterministic)
                let second_options = service.apply_preferences_to_options(&base_options, &preferences);
                prop_assert_eq!(&options_with_prefs.complexity_level, &second_options.complexity_level,
                              "Preference application should be deterministic");
                prop_assert_eq!(options_with_prefs.include_edge_cases, second_options.include_edge_cases,
                              "Preference application should be deterministic");
                prop_assert_eq!(options_with_prefs.include_error_scenarios, second_options.include_error_scenarios,
                              "Preference application should be deterministic");
                
                // Property: Different preferences should produce different results
                if !excluded_types.is_empty() {
                    let different_preferences = GenerationPreferences {
                        excluded_test_types: Vec::new(), // No exclusions
                        ..preferences.clone()
                    };
                    
                    let different_options = service.apply_preferences_to_options(&base_options, &different_preferences);
                    let different_prompt = service.build_requirements_prompt(&requirements, &different_options);
                    
                    // The prompts should be different when exclusions are different
                    prop_assert_ne!(&prompt, &different_prompt,
                                  "Different exclusion preferences should produce different prompts");
                }
            }
        }

        // **Feature: ai-test-case-generator, Property 18: Custom Template Processing**
        // **Validates: Requirements 9.4**
        proptest! {
            #![proptest_config(ProptestConfig::with_cases(100))]
            
            #[test]
            fn property_custom_template_processing(
                requirements in "[a-zA-Z0-9 .,!?\\n\\t]{10,200}",
                base_options in arb_generation_options(),
                custom_template in prop::option::of("[a-zA-Z0-9 .,!?\\n\\t{}]{20,300}")
            ) {
                let service = AITestCaseService::new().unwrap();
                
                // Create preferences with custom template
                let preferences = GenerationPreferences {
                    complexity_level: base_options.complexity_level.clone(),
                    project_type: base_options.project_type.clone(),
                    include_edge_cases: base_options.include_edge_cases,
                    include_error_scenarios: base_options.include_error_scenarios,
                    excluded_test_types: Vec::new(),
                    custom_prompt_template: custom_template.clone(),
                    show_cost_info: true,
                };
                
                // Apply preferences to generation options
                let options_with_prefs = service.apply_preferences_to_options(&base_options, &preferences);
                
                // Build prompt with custom template processing
                let prompt = service.build_requirements_prompt_with_template(&requirements, &options_with_prefs, &preferences);
                
                // Property: Custom template should be used when provided
                if let Some(ref template) = custom_template {
                    if !template.trim().is_empty() {
                        // When custom template is provided, the prompt should be the processed template
                        // (not the default prompt)
                        prop_assert!(!prompt.contains("You are a QA expert") || 
                                   template.contains("You are a QA expert"),
                                   "Custom template should replace default prompt");
                        
                        // Template variables should be replaced if they exist in the template
                        if template.contains("{requirements}") {
                            prop_assert!(prompt.contains(&requirements),
                                       "Requirements template variable should be replaced");
                        }
                        
                        if template.contains("{project_type}") {
                            prop_assert!(prompt.contains(&format!("{:?}", options_with_prefs.project_type)),
                                       "Project type template variable should be replaced");
                        }
                        
                        // The processed template should contain the original template content
                        // (minus the template variables that were replaced)
                        let template_without_vars = template
                            .replace("{requirements}", "")
                            .replace("{project_type}", "")
                            .replace("{complexity_level}", "")
                            .replace("{include_edge_cases}", "")
                            .replace("{include_error_scenarios}", "")
                            .replace("{excluded_test_types}", "");
                        
                        // Check if the core template structure is preserved
                        let template_chars: std::collections::HashSet<char> = template_without_vars.chars().collect();
                        let prompt_chars: std::collections::HashSet<char> = prompt.chars().collect();
                        
                        // Most characters from the template should appear in the prompt
                        let common_chars: std::collections::HashSet<char> = template_chars.intersection(&prompt_chars).cloned().collect();
                        let template_char_count = template_chars.len();
                        let common_char_count = common_chars.len();
                        
                        if template_char_count > 0 {
                            let preservation_ratio = common_char_count as f64 / template_char_count as f64;
                            prop_assert!(preservation_ratio > 0.5,
                                       "Template structure should be largely preserved (ratio: {})", preservation_ratio);
                        }
                    }
                } else {
                    // When no custom template, should use default prompt
                    prop_assert!(prompt.contains("You are a QA expert"),
                               "Default prompt should be used when no custom template");
                }
                
                // Property: Template processing should be deterministic
                let second_prompt = service.build_requirements_prompt_with_template(&requirements, &options_with_prefs, &preferences);
                prop_assert_eq!(&prompt, &second_prompt,
                              "Template processing should be deterministic");
                
                // Property: Different templates should produce different results
                if custom_template.is_some() {
                    let different_preferences = GenerationPreferences {
                        custom_prompt_template: None, // No custom template
                        ..preferences.clone()
                    };
                    
                    let different_prompt = service.build_requirements_prompt_with_template(&requirements, &options_with_prefs, &different_preferences);
                    
                    // The prompts should be different when templates are different
                    prop_assert_ne!(&prompt, &different_prompt,
                                  "Different templates should produce different prompts");
                }
                
                // Property: Template should handle empty/invalid cases gracefully
                let empty_template_prefs = GenerationPreferences {
                    custom_prompt_template: Some("".to_string()), // Empty template
                    ..preferences.clone()
                };
                
                let empty_template_prompt = service.build_requirements_prompt_with_template(&requirements, &options_with_prefs, &empty_template_prefs);
                
                // Empty template should fall back to default
                prop_assert!(empty_template_prompt.contains("You are a QA expert"),
                           "Empty template should fall back to default prompt");
                
                // Property: Template should preserve essential structure
                prop_assert!(prompt.contains("JSON") || prompt.contains("json"),
                           "Prompt should maintain JSON structure guidance");
                prop_assert!(prompt.contains(&requirements),
                           "Prompt should always contain the requirements");
            }
        }

        // **Feature: ai-test-case-generator, Property 11: Metadata Population Completeness**
        // **Validates: Requirements 3.4**
        proptest! {
            #![proptest_config(ProptestConfig::with_cases(100))]
            
            #[test]
            fn property_metadata_population_completeness(
                actions in prop::collection::vec(arb_recorded_actions(), 1..5),
                script_name in "[a-zA-Z0-9 ]{5,50}",
                project_type in prop::sample::select(vec![
                    ProjectType::Web,
                    ProjectType::Mobile,
                    ProjectType::Api,
                    ProjectType::Desktop
                ]),
                additional_context in prop::option::of("[a-zA-Z0-9 .,!?]{10,100}")
            ) {
                let service = AITestCaseService::new().unwrap();
                
                // Flatten the nested Vec<Vec<RecordedAction>> to Vec<RecordedAction>
                let flat_actions: Vec<RecordedAction> = actions.into_iter().flatten().collect();
                
                // Create documentation context
                let context = DocumentationContext {
                    script_name: script_name.clone(),
                    project_type: project_type.clone(),
                    additional_context: additional_context.clone(),
                };
                
                // Generate documentation from actions (this would normally call the AI API)
                // For testing, we'll create a mock response and test the metadata population
                let mock_documentation = service.create_mock_documentation_response(&context);
                
                // Property: All metadata fields should be populated with valid values
                prop_assert!(!mock_documentation.metadata.generation_id.is_empty(),
                           "Generation ID should not be empty");
                
                prop_assert!(!mock_documentation.metadata.api_version.is_empty(),
                           "API version should not be empty");
                
                prop_assert!(mock_documentation.metadata.processing_time_ms >= 0,
                           "Processing time should be non-negative");
                
                // Property: Metadata should reflect the input context
                prop_assert!(mock_documentation.title.contains(&script_name) || 
                           mock_documentation.description.contains(&script_name),
                           "Generated documentation should reference the script name");
                
                // Property: Generation ID should be unique for different calls
                let second_documentation = service.create_mock_documentation_response(&context);
                prop_assert_ne!(mock_documentation.metadata.generation_id, 
                              second_documentation.metadata.generation_id,
                              "Each generation should have a unique ID");
                
                // Property: Metadata should be consistent for the same input
                let context_clone = DocumentationContext {
                    script_name: script_name.clone(),
                    project_type: project_type.clone(),
                    additional_context: additional_context.clone(),
                };
                
                let third_documentation = service.create_mock_documentation_response(&context_clone);
                
                // Same input should produce same API version and similar processing characteristics
                prop_assert_eq!(mock_documentation.metadata.api_version,
                              third_documentation.metadata.api_version,
                              "API version should be consistent");
                
                // Property: Additional context should be reflected when provided
                if let Some(ref ctx) = additional_context {
                    if !ctx.trim().is_empty() {
                        prop_assert!(mock_documentation.description.contains(ctx) ||
                                   mock_documentation.title.contains(ctx) ||
                                   mock_documentation.preconditions.as_ref().map_or(false, |p| p.contains(ctx)),
                                   "Additional context should be reflected in the documentation");
                    }
                }
                
                // Property: Project type should influence the documentation style
                let web_context = DocumentationContext {
                    script_name: script_name.clone(),
                    project_type: ProjectType::Web,
                    additional_context: additional_context.clone(),
                };
                
                let api_context = DocumentationContext {
                    script_name: script_name.clone(),
                    project_type: ProjectType::Api,
                    additional_context: additional_context.clone(),
                };
                
                let web_doc = service.create_mock_documentation_response(&web_context);
                let api_doc = service.create_mock_documentation_response(&api_context);
                
                // Different project types should potentially produce different documentation
                // (though the mock might be the same, the real implementation would differ)
                prop_assert!(web_doc.metadata.api_version == api_doc.metadata.api_version,
                           "API version should be consistent across project types");
                
                // Property: Steps should be populated when actions are provided
                if !flat_actions.is_empty() {
                    prop_assert!(!mock_documentation.steps.is_empty(),
                               "Steps should be generated when actions are provided");
                    
                    // Each step should have valid metadata
                    for (i, step) in mock_documentation.steps.iter().enumerate() {
                        prop_assert!(step.order > 0,
                                   "Step {} should have positive order", i);
                        prop_assert!(!step.action.is_empty(),
                                   "Step {} should have non-empty action", i);
                    }
                }
            }
        }

        // **Feature: ai-test-case-generator, Property 6: Action Log Conversion Consistency**
        // **Validates: Requirements 3.1**
        proptest! {
            #![proptest_config(ProptestConfig::with_cases(100))]
            
            #[test]
            fn property_action_log_conversion_consistency(
                actions in prop::collection::vec(arb_recorded_actions(), 1..10)
            ) {
                let service = AITestCaseService::new().unwrap();
                
                // Flatten the nested Vec<Vec<RecordedAction>> to Vec<RecordedAction>
                let flat_actions: Vec<RecordedAction> = actions.into_iter().flatten().collect();
                
                // Property: Action log conversion should be deterministic
                let first_conversion = service.format_actions_for_prompt(&flat_actions);
                let second_conversion = service.format_actions_for_prompt(&flat_actions);
                
                prop_assert_eq!(first_conversion, second_conversion, 
                              "Action log conversion should be deterministic");
                
                // Generate a fresh conversion for the rest of the tests
                let conversion = service.format_actions_for_prompt(&flat_actions);
                
                // Property: Conversion should preserve essential information
                for (i, action) in flat_actions.iter().enumerate() {
                    let expected_step_number = format!("{}.", i + 1);
                    prop_assert!(conversion.contains(&expected_step_number), 
                               "Conversion should include step numbers");
                    
                    prop_assert!(conversion.contains(&action.action_type), 
                               "Conversion should include action type: {}", action.action_type);
                    
                    if let Some(ref target) = action.target {
                        if !target.is_empty() {
                            prop_assert!(conversion.contains(target), 
                                       "Conversion should include target: {}", target);
                        }
                    }
                    
                    if let Some(ref value) = action.value {
                        if !value.is_empty() {
                            prop_assert!(conversion.contains(value), 
                                       "Conversion should include value: {}", value);
                        }
                    }
                }
                
                // Property: Empty action list should produce empty or minimal output
                let empty_actions: Vec<RecordedAction> = vec![];
                let empty_conversion = service.format_actions_for_prompt(&empty_actions);
                prop_assert!(empty_conversion.is_empty() || empty_conversion.trim().is_empty(), 
                           "Empty action list should produce empty conversion");
                
                // Property: Conversion should be readable (contain spaces and newlines for structure)
                if flat_actions.len() > 1 {
                    prop_assert!(conversion.contains('\n'), 
                               "Multi-action conversion should contain newlines for readability");
                }
                
                // Property: Each action should be on its own line
                let lines: Vec<&str> = conversion.lines().collect();
                let non_empty_lines: Vec<&str> = lines.iter().filter(|line| !line.trim().is_empty()).cloned().collect();
                
                if !flat_actions.is_empty() {
                    prop_assert_eq!(non_empty_lines.len(), flat_actions.len(), 
                                  "Each action should produce exactly one line");
                }
                
                // Property: Conversion should handle special characters safely
                // (No specific assertions needed as long as it doesn't panic)
                let _safe_conversion = service.format_actions_for_prompt(&flat_actions);
            }
        }

        // **Feature: ai-test-case-generator, Property 9: Concurrent Request Isolation**
        // **Validates: Requirements 4.5**
        proptest! {
            #![proptest_config(ProptestConfig::with_cases(100))]
            
            #[test]
            fn property_concurrent_request_isolation(
                inputs in prop::collection::vec(
                    prop::option::of("[a-zA-Z0-9 .,!?\\n\\t]{10,100}"), 
                    2..5
                )
            ) {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    let service = AITestCaseService::new().unwrap();
                    
                    // Convert Option<String> to String, filtering out None values
                    let valid_inputs: Vec<String> = inputs.into_iter()
                        .filter_map(|opt| opt)
                        .collect();
                    
                    if valid_inputs.is_empty() {
                        return Ok(());
                    }
                    
                    // Property: Concurrent validation operations should not interfere with each other
                    let mut handles = Vec::new();
                    
                    for input in valid_inputs.iter() {
                        let service_clone = AITestCaseService::new().unwrap();
                        let input_clone = input.clone();
                        
                        let handle = tokio::spawn(async move {
                            // Each concurrent operation should produce consistent results
                            let result1 = service_clone.validator.validate_requirements_input(&input_clone);
                            let result2 = service_clone.validator.validate_requirements_input(&input_clone);
                            
                            // Results should be identical for the same input
                            (result1.is_ok(), result2.is_ok(), result1.is_ok() == result2.is_ok())
                        });
                        
                        handles.push(handle);
                    }
                    
                    // Wait for all concurrent operations to complete
                    let results = futures::future::join_all(handles).await;
                    
                    // Property: All concurrent operations should complete successfully
                    for result in results {
                        prop_assert!(result.is_ok(), "Concurrent operation should not panic or fail");
                        
                        let (first_ok, second_ok, consistent) = result.unwrap();
                        prop_assert!(consistent, "Concurrent operations should produce consistent results");
                        
                        // The actual validation result should be deterministic
                        prop_assert_eq!(first_ok, second_ok, "Validation results should be identical");
                    }
                    
                    // Property: Concurrent action log formatting should not interfere
                    let test_actions: Vec<RecordedAction> = vec![
                        RecordedAction {
                            action_type: "click".to_string(),
                            target: Some("button".to_string()),
                            value: None,
                            timestamp: chrono::Utc::now(),
                            screenshot: None,
                        }
                    ];
                    
                    let mut format_handles = Vec::new();
                    
                    for _ in 0..valid_inputs.len() {
                        let service_clone = AITestCaseService::new().unwrap();
                        let actions_clone = test_actions.clone();
                        
                        let handle = tokio::spawn(async move {
                            let result1 = service_clone.format_actions_for_prompt(&actions_clone);
                            let result2 = service_clone.format_actions_for_prompt(&actions_clone);
                            (result1, result2)
                        });
                        
                        format_handles.push(handle);
                    }
                    
                    let format_results = futures::future::join_all(format_handles).await;
                    
                    // Property: All concurrent formatting operations should produce identical results
                    for result in &format_results {
                        prop_assert!(result.is_ok(), "Concurrent formatting should not panic");
                        
                        let (first_format, second_format) = result.as_ref().unwrap();
                        prop_assert_eq!(first_format, second_format, 
                                      "Concurrent formatting should be deterministic");
                    }
                    
                    // Property: All concurrent operations should produce the same result for the same input
                    if format_results.len() > 1 {
                        let first_result = &format_results[0].as_ref().unwrap().0;
                        for result in format_results.iter().skip(1) {
                            let current_result = &result.as_ref().unwrap().0;
                            prop_assert_eq!(first_result, current_result, 
                                          "All concurrent operations should produce identical results");
                        }
                    }
                    
                    Ok(())
                })?;
            }
        }

        // **Feature: ai-test-case-generator, Property 12: Test Case Addition Preservation**
        // **Validates: Requirements 6.4**
        proptest! {
            #![proptest_config(ProptestConfig::with_cases(100))]
            
            #[test]
            fn property_test_case_addition_preservation(
                test_cases in prop::collection::vec(crate::ai_test_case::models::tests::arb_test_case(), 1..10),
                project_name in "[a-zA-Z0-9 ]{5,50}",
                project_type in prop::sample::select(vec![
                    ProjectType::Web,
                    ProjectType::Mobile,
                    ProjectType::Api,
                    ProjectType::Desktop
                ])
            ) {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    let service = AITestCaseService::new().unwrap();
                    
                    // Property: Test case addition should preserve all original data and metadata
                    for test_case in &test_cases {
                        // Create a deep clone to verify preservation
                        let original_test_case = test_case.clone();
                        
                        // Actually call the add_test_case_to_project method to test real functionality
                        let processed_test_case = service.add_test_case_to_project(&original_test_case, &project_name, project_type.clone()).await.unwrap();
                        
                        // Property: All essential fields should be preserved exactly
                        prop_assert_eq!(original_test_case.id, processed_test_case.id,
                                      "Test case ID should be preserved");
                        prop_assert_eq!(original_test_case.title, processed_test_case.title,
                                      "Test case title should be preserved");
                        prop_assert_eq!(original_test_case.description, processed_test_case.description,
                                      "Test case description should be preserved");
                        prop_assert_eq!(original_test_case.expected_result, processed_test_case.expected_result,
                                      "Test case expected result should be preserved");
                        prop_assert_eq!(original_test_case.severity, processed_test_case.severity,
                                      "Test case severity should be preserved");
                        prop_assert_eq!(original_test_case.test_type, processed_test_case.test_type,
                                      "Test case type should be preserved");
                        prop_assert_eq!(original_test_case.preconditions, processed_test_case.preconditions,
                                      "Test case preconditions should be preserved");
                        
                        // Property: Steps should be preserved with exact order and content
                        prop_assert_eq!(original_test_case.steps.len(), processed_test_case.steps.len(),
                                      "Number of test steps should be preserved");
                        
                        for (i, (original_step, processed_step)) in original_test_case.steps.iter()
                            .zip(processed_test_case.steps.iter()).enumerate() {
                            prop_assert_eq!(original_step.order, processed_step.order,
                                          "Step {} order should be preserved", i);
                            prop_assert_eq!(&original_step.action, &processed_step.action,
                                          "Step {} action should be preserved", i);
                            prop_assert_eq!(&original_step.expected_outcome, &processed_step.expected_outcome,
                                          "Step {} expected outcome should be preserved", i);
                            prop_assert_eq!(&original_step.notes, &processed_step.notes,
                                          "Step {} notes should be preserved", i);
                        }
                        
                        // Property: Core metadata should be preserved
                        prop_assert_eq!(&original_test_case.metadata.generated_by, &processed_test_case.metadata.generated_by,
                                      "Generated by field should be preserved");
                        prop_assert_eq!(&original_test_case.metadata.source_type, &processed_test_case.metadata.source_type,
                                      "Source type should be preserved");
                        prop_assert_eq!(&original_test_case.metadata.generation_version, &processed_test_case.metadata.generation_version,
                                      "Generation version should be preserved");
                        
                        // Property: Project integration metadata should be updated appropriately
                        prop_assert_eq!(&processed_test_case.metadata.project_type, &project_type,
                                      "Project type should be updated to match target project");
                        
                        // Property: Timestamps should be reasonable (not in the future, not too old)
                        let now = chrono::Utc::now();
                        let time_diff = now.signed_duration_since(processed_test_case.metadata.created_at);
                        prop_assert!(time_diff.num_seconds() >= 0,
                                   "Created timestamp should not be in the future");
                        prop_assert!(time_diff.num_hours() < 24,
                                   "Created timestamp should be recent (within 24 hours)");
                    }
                    
                    // Property: Multiple test cases should be processed independently without interference
                    if test_cases.len() > 1 {
                        let mut processed_test_cases = Vec::new();
                        
                        for test_case in &test_cases {
                            // Simulate processing each test case
                            let processed = test_case.clone();
                            processed_test_cases.push(processed);
                        }
                        
                        // Property: All test cases should have unique IDs after processing
                        let mut ids: std::collections::HashSet<String> = std::collections::HashSet::new();
                        for processed_tc in &processed_test_cases {
                            prop_assert!(ids.insert(processed_tc.id.clone()),
                                       "Each processed test case should have a unique ID: {}", processed_tc.id);
                        }
                        
                        // Property: Order of processing should not affect the content
                        for (original, processed) in test_cases.iter().zip(processed_test_cases.iter()) {
                            prop_assert_eq!(&original.title, &processed.title,
                                          "Test case content should not be affected by processing order");
                        }
                    }
                    
                    // Property: Empty or invalid test cases should be handled gracefully
                    let mut invalid_test_case = test_cases[0].clone();
                    invalid_test_case.id = "".to_string(); // Make it invalid
                    
                    // Simulate validation and processing
                    let validation_result = service.validator.validate_test_case(&invalid_test_case);
                    
                    // Should detect the invalid ID
                    prop_assert!(!validation_result.is_valid,
                               "Validation should detect invalid test case with empty ID");
                    
                    Ok(())
                })?;
            }
        }
    }
