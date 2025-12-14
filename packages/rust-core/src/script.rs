//! Script data structures and serialization

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Complete script data structure compatible with Python core
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptData {
    pub version: String,
    pub metadata: ScriptMetadata,
    pub actions: Vec<Action>,
}

/// Metadata about the script
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptMetadata {
    pub created_at: DateTime<Utc>,
    pub duration: f64,
    pub action_count: usize,
    pub core_type: String,
    pub platform: String,
    pub screen_resolution: Option<(u32, u32)>,
    pub additional_data: HashMap<String, serde_json::Value>,
}

/// Individual action within a script
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    #[serde(rename = "type")]
    pub action_type: ActionType,
    pub timestamp: f64,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub button: Option<String>,
    pub key: Option<String>,
    pub text: Option<String>,
    pub modifiers: Option<Vec<String>>,
    pub additional_data: Option<HashMap<String, serde_json::Value>>,
}

/// Types of actions that can be recorded and played back
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActionType {
    MouseMove,
    MouseClick,
    MouseDoubleClick,
    MouseDrag,
    MouseScroll,
    AiVisionCapture,
    KeyPress,
    KeyRelease,
    KeyType,
    Screenshot,
    Wait,
    Custom,
}

impl ScriptData {
    /// Create a new empty script
    pub fn new(core_type: &str, platform: &str) -> Self {
        Self {
            version: "1.0".to_string(),
            metadata: ScriptMetadata {
                created_at: Utc::now(),
                duration: 0.0,
                action_count: 0,
                core_type: core_type.to_string(),
                platform: platform.to_string(),
                screen_resolution: None,
                additional_data: HashMap::new(),
            },
            actions: Vec::new(),
        }
    }

    /// Add an action to the script
    pub fn add_action(&mut self, action: Action) {
        self.actions.push(action);
        self.metadata.action_count = self.actions.len();
        
        // Update duration based on the latest timestamp
        if let Some(last_action) = self.actions.last() {
            self.metadata.duration = last_action.timestamp;
        }
    }

    /// Get the total duration of the script
    pub fn duration(&self) -> f64 {
        self.metadata.duration
    }

    /// Get the number of actions in the script
    pub fn action_count(&self) -> usize {
        self.metadata.action_count
    }

    /// Validate the script format
    pub fn validate(&self) -> crate::Result<()> {
        if self.version.is_empty() {
            return Err(crate::AutomationError::ScriptError {
                message: "Script version cannot be empty".to_string(),
            });
        }

        if self.metadata.core_type.is_empty() {
            return Err(crate::AutomationError::ScriptError {
                message: "Core type cannot be empty".to_string(),
            });
        }

        if self.metadata.platform.is_empty() {
            return Err(crate::AutomationError::ScriptError {
                message: "Platform cannot be empty".to_string(),
            });
        }

        // Validate action timestamps are in order
        let mut last_timestamp = 0.0;
        for action in &self.actions {
            if action.timestamp < last_timestamp {
                return Err(crate::AutomationError::ScriptError {
                    message: "Action timestamps must be in chronological order".to_string(),
                });
            }
            last_timestamp = action.timestamp;
        }

        Ok(())
    }
}

impl Action {
    /// Create a new mouse move action
    pub fn mouse_move(x: i32, y: i32, timestamp: f64) -> Self {
        Self {
            action_type: ActionType::MouseMove,
            timestamp,
            x: Some(x),
            y: Some(y),
            button: None,
            key: None,
            text: None,
            modifiers: None,
            additional_data: None,
        }
    }

    /// Create a new mouse click action
    pub fn mouse_click(x: i32, y: i32, button: &str, timestamp: f64) -> Self {
        Self {
            action_type: ActionType::MouseClick,
            timestamp,
            x: Some(x),
            y: Some(y),
            button: Some(button.to_string()),
            key: None,
            text: None,
            modifiers: None,
            additional_data: None,
        }
    }

    /// Create a new key press action
    pub fn key_press(key: &str, timestamp: f64, modifiers: Option<Vec<String>>) -> Self {
        Self {
            action_type: ActionType::KeyPress,
            timestamp,
            x: None,
            y: None,
            button: None,
            key: Some(key.to_string()),
            text: None,
            modifiers,
            additional_data: None,
        }
    }

    /// Create a new text typing action
    pub fn key_type(text: &str, timestamp: f64) -> Self {
        Self {
            action_type: ActionType::KeyType,
            timestamp,
            x: None,
            y: None,
            button: None,
            key: None,
            text: Some(text.to_string()),
            modifiers: None,
            additional_data: None,
        }
    }
}

// ============================================================================
// AI Vision Capture Types
// ============================================================================

/// Interaction type for AI Vision Capture actions
/// Specifies what action to perform at the detected coordinates
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InteractionType {
    /// Left mouse click (default)
    Click,
    /// Double left mouse click
    Dblclick,
    /// Right mouse click
    Rclick,
    /// Mouse hover without click
    Hover,
}

impl Default for InteractionType {
    fn default() -> Self {
        InteractionType::Click
    }
}

/// Search scope for AI Vision Capture
/// Determines whether to search the full screen or within a defined ROI
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SearchScope {
    /// Search the entire screen
    Global,
    /// Search only within the defined ROI
    Regional,
}

impl Default for SearchScope {
    fn default() -> Self {
        SearchScope::Global
    }
}

/// Region of Interest for AI Vision Capture
/// Defines a rectangular area on the screen for targeted searching
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VisionROI {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Static data captured during recording
/// Contains the original screenshot and coordinates saved during editing
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StaticData {
    /// Path to the original screenshot captured during recording
    pub original_screenshot: String,
    /// X coordinate saved during editing (null if not yet analyzed)
    pub saved_x: Option<i32>,
    /// Y coordinate saved during editing (null if not yet analyzed)
    pub saved_y: Option<i32>,
    /// Screen dimensions at the time of recording [width, height]
    pub screen_dim: (u32, u32),
}

/// Dynamic configuration for AI-based element finding
/// Contains prompt, reference images, and search settings
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DynamicConfig {
    /// User prompt describing the target element
    pub prompt: String,
    /// Paths to reference images for visual matching
    pub reference_images: Vec<String>,
    /// Region of Interest for targeted searching (optional)
    pub roi: Option<VisionROI>,
    /// Search scope: global (full screen) or regional (within ROI)
    pub search_scope: SearchScope,
}

impl Default for DynamicConfig {
    fn default() -> Self {
        DynamicConfig {
            prompt: String::new(),
            reference_images: Vec::new(),
            roi: None,
            search_scope: SearchScope::Global,
        }
    }
}

/// Cache data for storing successful AI detection results
/// Allows subsequent playbacks to skip AI calls when coordinates are cached
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CacheData {
    /// Cached X coordinate from successful AI detection
    pub cached_x: Option<i32>,
    /// Cached Y coordinate from successful AI detection
    pub cached_y: Option<i32>,
    /// Screen dimensions when cache was created [width, height]
    pub cache_dim: Option<(u32, u32)>,
}

impl Default for CacheData {
    fn default() -> Self {
        CacheData {
            cached_x: None,
            cached_y: None,
            cache_dim: None,
        }
    }
}

/// AI Vision Capture Action
/// A special action type that uses AI to find UI elements on screen
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AIVisionCaptureAction {
    /// Action type identifier (always "ai_vision_capture")
    #[serde(rename = "type")]
    pub action_type: String,
    /// Unique identifier for this action
    pub id: String,
    /// Timestamp when this action was recorded
    pub timestamp: f64,
    /// Whether to use dynamic (AI) mode during playback
    pub is_dynamic: bool,
    /// Type of interaction to perform at the detected coordinates
    pub interaction: InteractionType,
    /// Static data from recording and editing
    pub static_data: StaticData,
    /// Dynamic configuration for AI-based detection
    pub dynamic_config: DynamicConfig,
    /// Cached coordinates from previous successful AI detection
    pub cache_data: CacheData,
}

impl AIVisionCaptureAction {
    /// Create a new AI Vision Capture action with default values
    pub fn new(
        id: String,
        timestamp: f64,
        original_screenshot: String,
        screen_dim: (u32, u32),
    ) -> Self {
        AIVisionCaptureAction {
            action_type: "ai_vision_capture".to_string(),
            id,
            timestamp,
            is_dynamic: false, // Default to Static Mode (Requirement 3.1)
            interaction: InteractionType::default(),
            static_data: StaticData {
                original_screenshot,
                saved_x: None,
                saved_y: None,
                screen_dim,
            },
            dynamic_config: DynamicConfig::default(),
            cache_data: CacheData::default(),
        }
    }

    /// Check if this action has valid static coordinates
    pub fn has_static_coordinates(&self) -> bool {
        self.static_data.saved_x.is_some() && self.static_data.saved_y.is_some()
    }

    /// Check if this action has valid cached coordinates
    pub fn has_cached_coordinates(&self) -> bool {
        self.cache_data.cached_x.is_some() && self.cache_data.cached_y.is_some()
    }

    /// Get the execution mode for this action
    pub fn get_execution_mode(&self) -> AIVisionExecutionMode {
        if !self.is_dynamic && self.has_static_coordinates() {
            AIVisionExecutionMode::Static
        } else if self.is_dynamic && self.has_cached_coordinates() {
            AIVisionExecutionMode::Cached
        } else if self.is_dynamic {
            AIVisionExecutionMode::Dynamic
        } else {
            AIVisionExecutionMode::Skip
        }
    }

    /// Update cache with new coordinates from successful AI detection
    pub fn update_cache(&mut self, x: i32, y: i32, screen_dim: (u32, u32)) {
        self.cache_data.cached_x = Some(x);
        self.cache_data.cached_y = Some(y);
        self.cache_data.cache_dim = Some(screen_dim);
    }

    /// Clear cache data (used when AI detection fails)
    pub fn clear_cache(&mut self) {
        self.cache_data.cached_x = None;
        self.cache_data.cached_y = None;
        self.cache_data.cache_dim = None;
    }
}

/// Execution mode for AI Vision Capture actions
#[derive(Debug, Clone, PartialEq)]
pub enum AIVisionExecutionMode {
    /// Use saved static coordinates (0 token cost)
    Static,
    /// Use cached coordinates from previous AI detection (0 token cost)
    Cached,
    /// Call AI service to find element (token cost)
    Dynamic,
    /// Skip execution (missing coordinates in static mode)
    Skip,
}
