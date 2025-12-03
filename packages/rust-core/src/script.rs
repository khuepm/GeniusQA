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
