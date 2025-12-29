//! Automation action validation system
//! 
//! This module provides validation for automation actions to ensure they are
//! constrained to the target application and within valid bounds.

use crate::application_focused_automation::{
    types::{RegisteredApplication, WindowHandle, FocusState},
};
use serde::{Deserialize, Serialize};

/// Represents a coordinate point for validation
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}

/// Represents a rectangular bounds for validation
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Bounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl Bounds {
    /// Create new bounds
    pub fn new(x: i32, y: i32, width: u32, height: u32) -> Self {
        Self { x, y, width, height }
    }

    /// Check if a point is within these bounds
    pub fn contains_point(&self, point: Point) -> bool {
        point.x >= self.x
            && point.y >= self.y
            && point.x < self.x + self.width as i32
            && point.y < self.y + self.height as i32
    }

    /// Check if these bounds are valid (non-negative dimensions)
    pub fn is_valid(&self) -> bool {
        self.width > 0 && self.height > 0
    }
}

/// Types of automation actions that can be validated
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AutomationAction {
    /// Mouse click at specific coordinates
    MouseClick { point: Point },
    /// Mouse move to specific coordinates
    MouseMove { point: Point },
    /// Mouse drag from one point to another
    MouseDrag { from: Point, to: Point },
    /// Keyboard input (no coordinate validation needed)
    KeyboardInput { text: String },
    /// Key press (no coordinate validation needed)
    KeyPress { key: String },
}

impl AutomationAction {
    /// Get all coordinate points that need validation for this action
    pub fn get_coordinate_points(&self) -> Vec<Point> {
        match self {
            AutomationAction::MouseClick { point } => vec![*point],
            AutomationAction::MouseMove { point } => vec![*point],
            AutomationAction::MouseDrag { from, to } => vec![*from, *to],
            AutomationAction::KeyboardInput { .. } => vec![],
            AutomationAction::KeyPress { .. } => vec![],
        }
    }

    /// Check if this action requires coordinate validation
    pub fn requires_coordinate_validation(&self) -> bool {
        !self.get_coordinate_points().is_empty()
    }
}

/// Result of action validation
#[derive(Debug, Clone, PartialEq)]
pub enum ValidationResult {
    /// Action is valid and can be executed
    Valid,
    /// Action is invalid with specific reason
    Invalid(ValidationError),
}

/// Specific validation error types
#[derive(Debug, Clone, PartialEq)]
pub enum ValidationError {
    /// Coordinates are outside application bounds
    CoordinatesOutOfBounds { point: Point, bounds: Bounds },
    /// Application window is not available
    ApplicationWindowUnavailable,
    /// Application is not currently active
    ApplicationNotActive,
    /// Invalid bounds detected
    InvalidBounds(Bounds),
    /// Platform-specific validation error
    PlatformError(String),
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ValidationError::CoordinatesOutOfBounds { point, bounds } => {
                write!(f, "Coordinates ({}, {}) are outside application bounds (x:{}, y:{}, w:{}, h:{})", 
                       point.x, point.y, bounds.x, bounds.y, bounds.width, bounds.height)
            }
            ValidationError::ApplicationWindowUnavailable => {
                write!(f, "Application window is not available for validation")
            }
            ValidationError::ApplicationNotActive => {
                write!(f, "Application is not currently active")
            }
            ValidationError::InvalidBounds(bounds) => {
                write!(f, "Invalid bounds detected: x:{}, y:{}, w:{}, h:{}", 
                       bounds.x, bounds.y, bounds.width, bounds.height)
            }
            ValidationError::PlatformError(msg) => {
                write!(f, "Platform-specific validation error: {}", msg)
            }
        }
    }
}

/// Automation action validator
pub struct ActionValidator {
    /// Current target application for validation
    target_application: Option<RegisteredApplication>,
    /// Current focus state for validation
    current_focus_state: Option<FocusState>,
}

impl ActionValidator {
    /// Create a new action validator
    pub fn new() -> Self {
        Self {
            target_application: None,
            current_focus_state: None,
        }
    }

    /// Set the target application for validation
    pub fn set_target_application(&mut self, app: RegisteredApplication) {
        self.target_application = Some(app);
    }

    /// Clear the target application
    pub fn clear_target_application(&mut self) {
        self.target_application = None;
    }

    /// Set the current focus state for validation
    pub fn set_focus_state(&mut self, focus_state: FocusState) {
        self.current_focus_state = Some(focus_state);
    }

    /// Clear the focus state
    pub fn clear_focus_state(&mut self) {
        self.current_focus_state = None;
    }

    /// Validate an automation action against the target application
    pub fn validate_action(&self, action: &AutomationAction) -> ValidationResult {
        // Check if we have a target application
        let app = match &self.target_application {
            Some(app) => app,
            None => return ValidationResult::Invalid(ValidationError::ApplicationWindowUnavailable),
        };

        // Check if application is active
        if !matches!(app.status, crate::application_focused_automation::types::ApplicationStatus::Active) {
            return ValidationResult::Invalid(ValidationError::ApplicationNotActive);
        }

        // Check focus state before executing actions (Requirement 6.3)
        if let Some(focus_state) = &self.current_focus_state {
            if !focus_state.is_target_process_focused {
                return ValidationResult::Invalid(ValidationError::ApplicationNotActive);
            }
        }

        // If action doesn't require coordinate validation, it's valid
        if !action.requires_coordinate_validation() {
            return ValidationResult::Valid;
        }

        // Get application window bounds
        let bounds = match self.get_application_bounds(app) {
            Ok(bounds) => bounds,
            Err(error) => return ValidationResult::Invalid(error),
        };

        // Validate all coordinate points
        for point in action.get_coordinate_points() {
            if !bounds.contains_point(point) {
                return ValidationResult::Invalid(ValidationError::CoordinatesOutOfBounds { point, bounds });
            }
        }

        ValidationResult::Valid
    }

    /// Get the bounds of the target application window
    fn get_application_bounds(&self, app: &RegisteredApplication) -> Result<Bounds, ValidationError> {
        match &app.window_handle {
            Some(handle) => self.get_window_bounds(handle),
            None => Err(ValidationError::ApplicationWindowUnavailable),
        }
    }

    /// Get bounds for a specific window handle (platform-specific)
    fn get_window_bounds(&self, handle: &WindowHandle) -> Result<Bounds, ValidationError> {
        match handle {
            #[cfg(target_os = "windows")]
            WindowHandle::Windows(hwnd) => self.get_windows_window_bounds(*hwnd),
            #[cfg(target_os = "macos")]
            WindowHandle::MacOS(window_id) => self.get_macos_window_bounds(*window_id),
            #[cfg(not(any(target_os = "windows", target_os = "macos")))]
            WindowHandle::Unsupported => Err(ValidationError::PlatformError("Unsupported platform".to_string())),
        }
    }

    /// Get window bounds on Windows platform
    #[cfg(target_os = "windows")]
    fn get_windows_window_bounds(&self, hwnd: isize) -> Result<Bounds, ValidationError> {
        use winapi::um::winuser::{GetWindowRect, IsWindow};
        use winapi::shared::windef::RECT;
        use std::mem;

        // Validate window handle
        if unsafe { IsWindow(hwnd as *mut _) } == 0 {
            return Err(ValidationError::ApplicationWindowUnavailable);
        }

        let mut rect: RECT = unsafe { mem::zeroed() };
        let result = unsafe { GetWindowRect(hwnd as *mut _, &mut rect) };

        if result == 0 {
            return Err(ValidationError::PlatformError("Failed to get window bounds".to_string()));
        }

        let bounds = Bounds::new(
            rect.left,
            rect.top,
            (rect.right - rect.left) as u32,
            (rect.bottom - rect.top) as u32,
        );

        if !bounds.is_valid() {
            return Err(ValidationError::InvalidBounds(bounds));
        }

        Ok(bounds)
    }

    /// Get window bounds on macOS platform
    #[cfg(target_os = "macos")]
    fn get_macos_window_bounds(&self, window_id: u32) -> Result<Bounds, ValidationError> {
        // For now, return a placeholder implementation
        // In a real implementation, this would use Core Graphics APIs
        // to get window bounds from the window ID
        
        // Placeholder bounds - in real implementation this would query the actual window
        let bounds = Bounds::new(0, 0, 1920, 1080);
        
        if !bounds.is_valid() {
            return Err(ValidationError::InvalidBounds(bounds));
        }

        Ok(bounds)
    }
}

impl Default for ActionValidator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application_focused_automation::types::{ApplicationStatus, RegisteredApplication};
    use chrono::Utc;

    fn create_test_app() -> RegisteredApplication {
        RegisteredApplication {
            id: "test-app".to_string(),
            name: "Test App".to_string(),
            executable_path: "/test/app".to_string(),
            process_name: "test_app".to_string(),
            bundle_id: None,
            process_id: Some(1234),
            window_handle: Some(WindowHandle::MacOS(1)),
            status: ApplicationStatus::Active,
            registered_at: Utc::now(),
            last_seen: Some(Utc::now()),
            default_focus_strategy: crate::application_focused_automation::types::FocusLossStrategy::AutoPause,
        }
    }

    #[test]
    fn test_bounds_contains_point() {
        let bounds = Bounds::new(10, 20, 100, 200);
        
        // Point inside bounds
        assert!(bounds.contains_point(Point { x: 50, y: 100 }));
        
        // Point on boundary (should be inside)
        assert!(bounds.contains_point(Point { x: 10, y: 20 }));
        
        // Point outside bounds
        assert!(!bounds.contains_point(Point { x: 5, y: 15 }));
        assert!(!bounds.contains_point(Point { x: 150, y: 250 }));
    }

    #[test]
    fn test_bounds_is_valid() {
        assert!(Bounds::new(0, 0, 100, 100).is_valid());
        assert!(!Bounds::new(0, 0, 0, 100).is_valid());
        assert!(!Bounds::new(0, 0, 100, 0).is_valid());
    }

    #[test]
    fn test_automation_action_coordinate_points() {
        let click = AutomationAction::MouseClick { point: Point { x: 10, y: 20 } };
        assert_eq!(click.get_coordinate_points(), vec![Point { x: 10, y: 20 }]);
        assert!(click.requires_coordinate_validation());

        let drag = AutomationAction::MouseDrag { 
            from: Point { x: 10, y: 20 }, 
            to: Point { x: 30, y: 40 } 
        };
        assert_eq!(drag.get_coordinate_points(), vec![Point { x: 10, y: 20 }, Point { x: 30, y: 40 }]);
        assert!(drag.requires_coordinate_validation());

        let keyboard = AutomationAction::KeyboardInput { text: "hello".to_string() };
        assert_eq!(keyboard.get_coordinate_points(), vec![]);
        assert!(!keyboard.requires_coordinate_validation());
    }

    #[test]
    fn test_validator_no_target_application() {
        let validator = ActionValidator::new();
        let action = AutomationAction::MouseClick { point: Point { x: 10, y: 20 } };
        
        match validator.validate_action(&action) {
            ValidationResult::Invalid(ValidationError::ApplicationWindowUnavailable) => {},
            other => panic!("Expected ApplicationWindowUnavailable, got {:?}", other),
        }
    }

    #[test]
    fn test_validator_inactive_application() {
        let mut validator = ActionValidator::new();
        let mut app = create_test_app();
        app.status = ApplicationStatus::Inactive;
        validator.set_target_application(app);
        
        let action = AutomationAction::MouseClick { point: Point { x: 10, y: 20 } };
        
        match validator.validate_action(&action) {
            ValidationResult::Invalid(ValidationError::ApplicationNotActive) => {},
            other => panic!("Expected ApplicationNotActive, got {:?}", other),
        }
    }

    #[test]
    fn test_validator_keyboard_action_always_valid() {
        let mut validator = ActionValidator::new();
        let app = create_test_app();
        validator.set_target_application(app);
        
        let action = AutomationAction::KeyboardInput { text: "hello".to_string() };
        
        match validator.validate_action(&action) {
            ValidationResult::Valid => {},
            other => panic!("Expected Valid, got {:?}", other),
        }
    }
}
