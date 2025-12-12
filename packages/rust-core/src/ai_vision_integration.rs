//! AI Vision Integration Module
//!
//! This module provides integration between the Rust player and the TypeScript
//! AI Vision Service for Dynamic Mode execution of AI Vision Capture actions.
//!
//! The integration uses a callback-based approach where the Rust player can
//! request AI analysis and receive results asynchronously.
//!
//! Requirements: 4.6, 4.7, 4.8, 4.9, 4.10, 4.11

use crate::script::{AIVisionCaptureAction, VisionROI, SearchScope};
use serde::{Deserialize, Serialize};


/// Default timeout for AI analysis requests (15 seconds)
/// Requirements: 4.10
pub const DEFAULT_AI_TIMEOUT_MS: u64 = 15000;

/// Request structure for AI Vision analysis
/// Requirements: 4.6, 4.8
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIVisionAnalysisRequest {
    /// Base64 encoded screenshot of the current screen
    pub screenshot: String,
    /// User prompt describing the target element
    pub prompt: String,
    /// Base64 encoded reference images for visual matching
    pub reference_images: Vec<String>,
    /// Region of Interest for regional search (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub roi: Option<VisionROI>,
    /// Search scope: global or regional
    pub search_scope: SearchScope,
    /// Timeout in milliseconds
    pub timeout_ms: u64,
}

/// Response structure from AI Vision analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIVisionAnalysisResponse {
    /// Whether the analysis was successful
    pub success: bool,
    /// X coordinate of the found element (if successful)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x: Option<i32>,
    /// Y coordinate of the found element (if successful)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y: Option<i32>,
    /// Confidence score (0.0 to 1.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,
    /// Error message if analysis failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl AIVisionAnalysisResponse {
    /// Create a successful response
    pub fn success(x: i32, y: i32, confidence: f64) -> Self {
        Self {
            success: true,
            x: Some(x),
            y: Some(y),
            confidence: Some(confidence),
            error: None,
        }
    }

    /// Create a failure response
    pub fn failure(error: String) -> Self {
        Self {
            success: false,
            x: None,
            y: None,
            confidence: None,
            error: Some(error),
        }
    }

    /// Create a timeout response
    pub fn timeout(timeout_ms: u64) -> Self {
        Self {
            success: false,
            x: None,
            y: None,
            confidence: None,
            error: Some(format!("AI analysis timed out after {}ms", timeout_ms)),
        }
    }
}

/// Trait for AI Vision analysis providers
/// This allows for different implementations (IPC, HTTP, mock for testing)
pub trait AIVisionProvider: Send + Sync {
    /// Analyze a screenshot to find a UI element
    /// Returns the analysis result or an error
    fn analyze(&self, request: AIVisionAnalysisRequest) -> Result<AIVisionAnalysisResponse, String>;
}

/// Build an AI Vision analysis request from an action and screenshot
/// Requirements: 4.6, 4.7, 4.8
pub fn build_analysis_request(
    action: &AIVisionCaptureAction,
    screenshot_base64: String,
    reference_images_base64: Vec<String>,
    current_screen_dim: (u32, u32),
    timeout_ms: Option<u64>,
) -> AIVisionAnalysisRequest {
    let timeout = timeout_ms.unwrap_or(DEFAULT_AI_TIMEOUT_MS);
    
    // Handle ROI scaling if needed (Requirement 4.7)
    let scaled_roi = if let Some(ref roi) = action.dynamic_config.roi {
        if action.dynamic_config.search_scope == SearchScope::Regional {
            // Scale ROI if resolution differs
            let recorded_dim = action.static_data.screen_dim;
            if recorded_dim != current_screen_dim {
                Some(crate::player::scale_roi(roi, recorded_dim, current_screen_dim))
            } else {
                Some(roi.clone())
            }
        } else {
            None // Global search ignores ROI
        }
    } else {
        None
    };

    AIVisionAnalysisRequest {
        screenshot: screenshot_base64,
        prompt: action.dynamic_config.prompt.clone(),
        reference_images: reference_images_base64,
        roi: scaled_roi,
        search_scope: action.dynamic_config.search_scope.clone(),
        timeout_ms: timeout,
    }
}

/// Result of Dynamic Mode execution including cache update information
#[derive(Debug, Clone)]
pub struct DynamicModeResult {
    /// Whether the execution was successful
    pub success: bool,
    /// The coordinates found by AI (if successful)
    pub coordinates: Option<(i32, i32)>,
    /// Whether the cache should be updated
    pub should_update_cache: bool,
    /// Screen dimensions for cache (if updating)
    pub cache_screen_dim: Option<(u32, u32)>,
    /// Error message if failed
    pub error: Option<String>,
}

impl DynamicModeResult {
    /// Create a successful result that should update cache
    /// Requirements: 4.9
    pub fn success_with_cache(x: i32, y: i32, screen_dim: (u32, u32)) -> Self {
        Self {
            success: true,
            coordinates: Some((x, y)),
            should_update_cache: true,
            cache_screen_dim: Some(screen_dim),
            error: None,
        }
    }

    /// Create a failure result that should clear cache
    /// Requirements: 4.11
    pub fn failure_clear_cache(error: String) -> Self {
        Self {
            success: false,
            coordinates: None,
            should_update_cache: true, // We need to clear the cache
            cache_screen_dim: None,
            error: Some(error),
        }
    }
}

/// Mock AI Vision provider for testing
#[cfg(test)]
pub struct MockAIVisionProvider {
    /// Response to return for all requests
    pub response: AIVisionAnalysisResponse,
    /// Number of times analyze was called
    pub call_count: std::sync::atomic::AtomicUsize,
}

#[cfg(test)]
impl MockAIVisionProvider {
    pub fn new(response: AIVisionAnalysisResponse) -> Self {
        Self {
            response,
            call_count: std::sync::atomic::AtomicUsize::new(0),
        }
    }

    pub fn get_call_count(&self) -> usize {
        self.call_count.load(std::sync::atomic::Ordering::Relaxed)
    }
}

#[cfg(test)]
impl AIVisionProvider for MockAIVisionProvider {
    fn analyze(&self, _request: AIVisionAnalysisRequest) -> Result<AIVisionAnalysisResponse, String> {
        self.call_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        Ok(self.response.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analysis_response_success() {
        let response = AIVisionAnalysisResponse::success(100, 200, 0.95);
        assert!(response.success);
        assert_eq!(response.x, Some(100));
        assert_eq!(response.y, Some(200));
        assert_eq!(response.confidence, Some(0.95));
        assert!(response.error.is_none());
    }

    #[test]
    fn test_analysis_response_failure() {
        let response = AIVisionAnalysisResponse::failure("Element not found".to_string());
        assert!(!response.success);
        assert!(response.x.is_none());
        assert!(response.y.is_none());
        assert_eq!(response.error, Some("Element not found".to_string()));
    }

    #[test]
    fn test_analysis_response_timeout() {
        let response = AIVisionAnalysisResponse::timeout(15000);
        assert!(!response.success);
        assert!(response.error.unwrap().contains("timed out"));
    }

    #[test]
    fn test_dynamic_mode_result_success() {
        let result = DynamicModeResult::success_with_cache(100, 200, (1920, 1080));
        assert!(result.success);
        assert_eq!(result.coordinates, Some((100, 200)));
        assert!(result.should_update_cache);
        assert_eq!(result.cache_screen_dim, Some((1920, 1080)));
    }

    #[test]
    fn test_dynamic_mode_result_failure() {
        let result = DynamicModeResult::failure_clear_cache("AI timeout".to_string());
        assert!(!result.success);
        assert!(result.coordinates.is_none());
        assert!(result.should_update_cache); // Should clear cache
        assert!(result.cache_screen_dim.is_none());
    }
}


// ============================================================================
// Cache Update Functions
// ============================================================================

/// Apply a cache update to an AI Vision Capture action
/// Requirements: 4.9, 5.8
pub fn apply_cache_update(
    action: &mut crate::script::AIVisionCaptureAction,
    cache_update: &crate::player::CacheUpdate,
) {
    match cache_update {
        crate::player::CacheUpdate::Update { cached_x, cached_y, cache_dim } => {
            // Update cache with new coordinates (Requirement 4.9)
            action.cache_data.cached_x = Some(*cached_x);
            action.cache_data.cached_y = Some(*cached_y);
            action.cache_data.cache_dim = Some(*cache_dim);
        }
        crate::player::CacheUpdate::Clear => {
            // Clear cache (Requirement 4.11)
            action.cache_data.cached_x = None;
            action.cache_data.cached_y = None;
            action.cache_data.cache_dim = None;
        }
    }
}

/// Update the script file with the modified action's cache data
/// Requirements: 4.9, 5.8
/// 
/// This function reads the script file, updates the specific action's cache_data,
/// and writes the modified script back to the file.
/// 
/// # Arguments
/// * `script_path` - Path to the script file
/// * `action_id` - ID of the action to update
/// * `cache_update` - The cache update to apply
/// 
/// # Returns
/// Result indicating success or error message
pub fn persist_cache_update(
    script_path: &str,
    action_id: &str,
    cache_update: &crate::player::CacheUpdate,
) -> Result<(), String> {
    use std::fs;
    
    // Read the script file
    let script_content = fs::read_to_string(script_path)
        .map_err(|e| format!("Failed to read script file: {}", e))?;
    
    // Parse as JSON
    let mut script_json: serde_json::Value = serde_json::from_str(&script_content)
        .map_err(|e| format!("Failed to parse script JSON: {}", e))?;
    
    // Find and update the action
    if let Some(actions) = script_json.get_mut("actions").and_then(|a| a.as_array_mut()) {
        for action in actions.iter_mut() {
            // Check if this is the action we're looking for
            if action.get("id").and_then(|id| id.as_str()) == Some(action_id) {
                // Check if this is an ai_vision_capture action
                if action.get("type").and_then(|t| t.as_str()) == Some("ai_vision_capture") {
                    // Update cache_data based on the cache update type
                    match cache_update {
                        crate::player::CacheUpdate::Update { cached_x, cached_y, cache_dim } => {
                            // Create or update cache_data object
                            let cache_data = serde_json::json!({
                                "cached_x": cached_x,
                                "cached_y": cached_y,
                                "cache_dim": [cache_dim.0, cache_dim.1]
                            });
                            action["cache_data"] = cache_data;
                        }
                        crate::player::CacheUpdate::Clear => {
                            // Clear cache_data
                            let cache_data = serde_json::json!({
                                "cached_x": null,
                                "cached_y": null,
                                "cache_dim": null
                            });
                            action["cache_data"] = cache_data;
                        }
                    }
                    
                    // Write the updated script back to file
                    let updated_content = serde_json::to_string_pretty(&script_json)
                        .map_err(|e| format!("Failed to serialize script JSON: {}", e))?;
                    
                    fs::write(script_path, updated_content)
                        .map_err(|e| format!("Failed to write script file: {}", e))?;
                    
                    return Ok(());
                }
            }
        }
    }
    
    Err(format!("Action with id '{}' not found in script", action_id))
}

#[cfg(test)]
mod cache_tests {
    use super::*;
    use crate::script::{AIVisionCaptureAction, StaticData, DynamicConfig, CacheData, InteractionType, SearchScope};
    use crate::player::CacheUpdate;

    fn create_test_action() -> AIVisionCaptureAction {
        AIVisionCaptureAction {
            action_type: "ai_vision_capture".to_string(),
            id: "test-action-123".to_string(),
            timestamp: 1.0,
            is_dynamic: true,
            interaction: InteractionType::Click,
            static_data: StaticData {
                original_screenshot: "screenshots/test.png".to_string(),
                saved_x: None,
                saved_y: None,
                screen_dim: (1920, 1080),
            },
            dynamic_config: DynamicConfig {
                prompt: "Click the button".to_string(),
                reference_images: vec![],
                roi: None,
                search_scope: SearchScope::Global,
            },
            cache_data: CacheData {
                cached_x: None,
                cached_y: None,
                cache_dim: None,
            },
        }
    }

    #[test]
    fn test_apply_cache_update_success() {
        let mut action = create_test_action();
        let cache_update = CacheUpdate::Update {
            cached_x: 500,
            cached_y: 300,
            cache_dim: (1920, 1080),
        };
        
        apply_cache_update(&mut action, &cache_update);
        
        assert_eq!(action.cache_data.cached_x, Some(500));
        assert_eq!(action.cache_data.cached_y, Some(300));
        assert_eq!(action.cache_data.cache_dim, Some((1920, 1080)));
    }

    #[test]
    fn test_apply_cache_update_clear() {
        let mut action = create_test_action();
        // First set some cache data
        action.cache_data.cached_x = Some(100);
        action.cache_data.cached_y = Some(200);
        action.cache_data.cache_dim = Some((1920, 1080));
        
        let cache_update = CacheUpdate::Clear;
        
        apply_cache_update(&mut action, &cache_update);
        
        assert_eq!(action.cache_data.cached_x, None);
        assert_eq!(action.cache_data.cached_y, None);
        assert_eq!(action.cache_data.cache_dim, None);
    }
}
