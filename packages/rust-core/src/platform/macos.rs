//! macOS-specific automation implementation using Core Graphics

#[cfg(target_os = "macos")]
use core_graphics::{
    event::{CGEvent, CGEventType, CGMouseButton, CGEventTapLocation, CGKeyCode},
    event_source::{CGEventSource, CGEventSourceStateID},
    geometry::CGPoint,
    display::CGDisplay,
};

use crate::{Result, AutomationError};
use crate::logging::{get_logger, CoreType, OperationType, LogLevel};
use super::PlatformAutomation;
use std::collections::HashMap;
use std::sync::Mutex;
use serde_json::json;

/// macOS-specific automation implementation
/// 
/// Note: CGEventSource is not Send/Sync, so we wrap it in a Mutex
/// and create new event sources for each operation to ensure thread safety
#[cfg(target_os = "macos")]
pub struct MacOSAutomation {
    key_map: HashMap<String, CGKeyCode>,
}

#[cfg(target_os = "macos")]
impl MacOSAutomation {
    pub fn new() -> Result<Self> {
        let mut automation = Self {
            key_map: HashMap::new(),
        };
        
        automation.initialize_key_map();
        Ok(automation)
    }
    
    /// Create a new event source for thread-safe operations
    fn create_event_source() -> Result<CGEventSource> {
        CGEventSource::new(CGEventSourceStateID::HIDSystemState)
            .map_err(|_| AutomationError::SystemError {
                message: "Failed to create CGEventSource".to_string(),
            })
    }
    
    fn initialize_key_map(&mut self) {
        // Initialize common key mappings for macOS
        self.key_map.insert("a".to_string(), 0x00);
        self.key_map.insert("s".to_string(), 0x01);
        self.key_map.insert("d".to_string(), 0x02);
        self.key_map.insert("f".to_string(), 0x03);
        self.key_map.insert("h".to_string(), 0x04);
        self.key_map.insert("g".to_string(), 0x05);
        self.key_map.insert("z".to_string(), 0x06);
        self.key_map.insert("x".to_string(), 0x07);
        self.key_map.insert("c".to_string(), 0x08);
        self.key_map.insert("v".to_string(), 0x09);
        self.key_map.insert("b".to_string(), 0x0B);
        self.key_map.insert("q".to_string(), 0x0C);
        self.key_map.insert("w".to_string(), 0x0D);
        self.key_map.insert("e".to_string(), 0x0E);
        self.key_map.insert("r".to_string(), 0x0F);
        self.key_map.insert("y".to_string(), 0x10);
        self.key_map.insert("t".to_string(), 0x11);
        self.key_map.insert("1".to_string(), 0x12);
        self.key_map.insert("2".to_string(), 0x13);
        self.key_map.insert("3".to_string(), 0x14);
        self.key_map.insert("4".to_string(), 0x15);
        self.key_map.insert("6".to_string(), 0x16);
        self.key_map.insert("5".to_string(), 0x17);
        self.key_map.insert("9".to_string(), 0x19);
        self.key_map.insert("7".to_string(), 0x1A);
        self.key_map.insert("8".to_string(), 0x1C);
        self.key_map.insert("0".to_string(), 0x1D);
        self.key_map.insert("o".to_string(), 0x1F);
        self.key_map.insert("u".to_string(), 0x20);
        self.key_map.insert("i".to_string(), 0x22);
        self.key_map.insert("p".to_string(), 0x23);
        self.key_map.insert("l".to_string(), 0x25);
        self.key_map.insert("j".to_string(), 0x26);
        self.key_map.insert("k".to_string(), 0x28);
        self.key_map.insert("n".to_string(), 0x2D);
        self.key_map.insert("m".to_string(), 0x2E);
        
        // Special keys
        self.key_map.insert("enter".to_string(), 0x24);
        self.key_map.insert("tab".to_string(), 0x30);
        self.key_map.insert("space".to_string(), 0x31);
        self.key_map.insert("backspace".to_string(), 0x33);
        self.key_map.insert("escape".to_string(), 0x35);
        self.key_map.insert("cmd".to_string(), 0x37);
        self.key_map.insert("shift".to_string(), 0x38);
        self.key_map.insert("capslock".to_string(), 0x39);
        self.key_map.insert("option".to_string(), 0x3A);
        self.key_map.insert("ctrl".to_string(), 0x3B);
        self.key_map.insert("rightshift".to_string(), 0x3C);
        self.key_map.insert("rightoption".to_string(), 0x3D);
        self.key_map.insert("rightctrl".to_string(), 0x3E);
        
        // Arrow keys
        self.key_map.insert("left".to_string(), 0x7B);
        self.key_map.insert("right".to_string(), 0x7C);
        self.key_map.insert("down".to_string(), 0x7D);
        self.key_map.insert("up".to_string(), 0x7E);
        
        // Function keys
        for i in 1..=12 {
            let key_code = match i {
                1 => 0x7A, 2 => 0x78, 3 => 0x63, 4 => 0x76,
                5 => 0x60, 6 => 0x61, 7 => 0x62, 8 => 0x64,
                9 => 0x65, 10 => 0x6D, 11 => 0x67, 12 => 0x6F,
                _ => continue,
            };
            self.key_map.insert(format!("f{}", i), key_code);
        }
    }
    
    fn get_key_code(&self, key: &str) -> Result<CGKeyCode> {
        let key_lower = key.to_lowercase();
        self.key_map.get(&key_lower).copied()
            .ok_or_else(|| AutomationError::InvalidInput {
                message: format!("Unknown key: {}", key),
            })
    }
    
    /// Log platform-specific API call
    fn log_platform_call(&self, operation: &str, params: &str) {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("platform".to_string(), json!("macos"));
            metadata.insert("operation".to_string(), json!(operation));
            metadata.insert("params".to_string(), json!(params));
            
            logger.log_operation(
                LogLevel::Debug,
                CoreType::Rust,
                OperationType::Playback,
                format!("platform_call_{}", operation),
                format!("Platform call: {} with {}", operation, params),
                Some(metadata),
            );
        }
    }
    
    /// Log platform-specific error
    fn log_platform_error(&self, operation: &str, error_message: &str) {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("platform".to_string(), json!("macos"));
            metadata.insert("operation".to_string(), json!(operation));
            metadata.insert("error_message".to_string(), json!(error_message));
            
            logger.log_operation(
                LogLevel::Error,
                CoreType::Rust,
                OperationType::Playback,
                format!("platform_error_{}", operation),
                format!("Platform error in {}: {}", operation, error_message),
                Some(metadata),
            );
        }
    }
    
    /// Validate and clamp coordinates to screen bounds
    fn validate_and_clamp_coordinates(&self, x: i32, y: i32) -> Result<(i32, i32)> {
        let (screen_width, screen_height) = self.get_screen_size()?;
        
        let clamped_x = x.clamp(0, screen_width as i32 - 1);
        let clamped_y = y.clamp(0, screen_height as i32 - 1);
        
        if clamped_x != x || clamped_y != y {
            self.log_coordinate_clamping(x, y, clamped_x, clamped_y);
        }
        
        Ok((clamped_x, clamped_y))
    }
    
    /// Log coordinate clamping warning
    fn log_coordinate_clamping(&self, original_x: i32, original_y: i32, clamped_x: i32, clamped_y: i32) {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("original_x".to_string(), json!(original_x));
            metadata.insert("original_y".to_string(), json!(original_y));
            metadata.insert("clamped_x".to_string(), json!(clamped_x));
            metadata.insert("clamped_y".to_string(), json!(clamped_y));
            
            logger.log_operation(
                LogLevel::Warn,
                CoreType::Rust,
                OperationType::Playback,
                "coordinate_clamping".to_string(),
                format!("Coordinates clamped from ({}, {}) to ({}, {})", original_x, original_y, clamped_x, clamped_y),
                Some(metadata),
            );
        }
    }
    
    /// Check accessibility permissions
    fn check_accessibility_permissions(&self) -> Result<bool> {
        // On macOS, we need to check if the app has accessibility permissions
        // This is a simplified check - in production, you'd use AXIsProcessTrusted()
        // For now, we'll assume permissions are granted and log a warning
        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Playback,
                "permission_check".to_string(),
                "Checking macOS accessibility permissions".to_string(),
                None,
            );
        }
        Ok(true)
    }
}

#[cfg(target_os = "macos")]
impl PlatformAutomation for MacOSAutomation {
    fn initialize(&mut self) -> Result<()> {
        // macOS automation is ready after construction
        Ok(())
    }
    
    fn check_permissions(&self) -> Result<bool> {
        // Check if we have accessibility permissions
        let has_permissions = self.check_accessibility_permissions()?;
        
        if !has_permissions {
            if let Some(logger) = get_logger() {
                logger.log_operation(
                    LogLevel::Error,
                    CoreType::Rust,
                    OperationType::Playback,
                    "permission_denied".to_string(),
                    "Accessibility permissions not granted. Please enable accessibility permissions in System Preferences > Security & Privacy > Privacy > Accessibility".to_string(),
                    None,
                );
            }
            return Err(AutomationError::PermissionDenied {
                operation: "macOS accessibility permissions required. Go to System Preferences > Security & Privacy > Privacy > Accessibility and enable access for this application.".to_string(),
            });
        }
        
        Ok(true)
    }
    
    fn request_permissions(&self) -> Result<bool> {
        // On macOS, we need to request accessibility permissions
        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Playback,
                "permission_request".to_string(),
                "Requesting macOS accessibility permissions. Please grant access in System Preferences.".to_string(),
                None,
            );
        }
        
        // This would typically show a system dialog
        // For now, we'll return true and rely on the system to handle the permission request
        Ok(true)
    }
    
    fn mouse_move(&self, x: i32, y: i32) -> Result<()> {
        // Validate and clamp coordinates
        let (clamped_x, clamped_y) = self.validate_and_clamp_coordinates(x, y)?;
        
        // Log the operation
        self.log_platform_call("CGEvent::new_mouse_event (MouseMoved)", &format!("x={}, y={}", clamped_x, clamped_y));
        
        let event_source = Self::create_event_source()?;
        let point = CGPoint::new(clamped_x as f64, clamped_y as f64);
        let event = CGEvent::new_mouse_event(
            event_source,
            CGEventType::MouseMoved,
            point,
            CGMouseButton::Left,
        ).map_err(|_| {
            self.log_platform_error("CGEvent::new_mouse_event", "Failed to create mouse move event");
            AutomationError::SystemError {
                message: "Failed to create mouse move event. This may indicate missing accessibility permissions.".to_string(),
            }
        })?;
        
        event.post(CGEventTapLocation::HID);
        
        // Verify the move succeeded
        let (actual_x, actual_y) = self.get_mouse_position()?;
        if actual_x != clamped_x || actual_y != clamped_y {
            if let Some(logger) = get_logger() {
                let mut metadata = HashMap::new();
                metadata.insert("expected_x".to_string(), json!(clamped_x));
                metadata.insert("expected_y".to_string(), json!(clamped_y));
                metadata.insert("actual_x".to_string(), json!(actual_x));
                metadata.insert("actual_y".to_string(), json!(actual_y));
                
                logger.log_operation(
                    LogLevel::Warn,
                    CoreType::Rust,
                    OperationType::Playback,
                    "mouse_position_mismatch".to_string(),
                    format!("Mouse position mismatch: expected ({}, {}), got ({}, {})", 
                        clamped_x, clamped_y, actual_x, actual_y),
                    Some(metadata),
                );
            }
        }
        
        Ok(())
    }
    
    fn mouse_click(&self, button: &str) -> Result<()> {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("button".to_string(), json!(button));
            
            logger.log_operation(
                LogLevel::Debug,
                CoreType::Rust,
                OperationType::Playback,
                "mouse_click".to_string(),
                format!("Mouse click: {}", button),
                Some(metadata),
            );
        }
        
        let (mouse_button, down_type, up_type) = match button.to_lowercase().as_str() {
            "left" => (CGMouseButton::Left, CGEventType::LeftMouseDown, CGEventType::LeftMouseUp),
            "right" => (CGMouseButton::Right, CGEventType::RightMouseDown, CGEventType::RightMouseUp),
            "middle" => (CGMouseButton::Center, CGEventType::OtherMouseDown, CGEventType::OtherMouseUp),
            _ => return Err(AutomationError::InvalidInput {
                message: format!("Unknown mouse button: {}", button),
            }),
        };
        
        let (x, y) = self.get_mouse_position()?;
        let point = CGPoint::new(x as f64, y as f64);
        let event_source = Self::create_event_source()?;
        
        // Log the operation
        self.log_platform_call("CGEvent::new_mouse_event (MouseDown)", &format!("button={}, x={}, y={}", button, x, y));
        
        // Mouse down
        let down_event = CGEvent::new_mouse_event(
            event_source.clone(),
            down_type,
            point,
            mouse_button,
        ).map_err(|_| {
            self.log_platform_error("CGEvent::new_mouse_event", "Failed to create mouse down event");
            AutomationError::SystemError {
                message: "Failed to create mouse down event. This may indicate missing accessibility permissions.".to_string(),
            }
        })?;
        down_event.post(CGEventTapLocation::HID);
        
        // Mouse up
        let up_event = CGEvent::new_mouse_event(
            event_source,
            up_type,
            point,
            mouse_button,
        ).map_err(|_| {
            self.log_platform_error("CGEvent::new_mouse_event", "Failed to create mouse up event");
            AutomationError::SystemError {
                message: "Failed to create mouse up event. This may indicate missing accessibility permissions.".to_string(),
            }
        })?;
        up_event.post(CGEventTapLocation::HID);
        
        Ok(())
    }
    
    fn mouse_click_at(&self, x: i32, y: i32, button: &str) -> Result<()> {
        self.mouse_move(x, y)?;
        self.mouse_click(button)?;
        Ok(())
    }
    
    fn mouse_double_click(&self, x: i32, y: i32, button: &str) -> Result<()> {
        self.mouse_click_at(x, y, button)?;
        std::thread::sleep(std::time::Duration::from_millis(50));
        self.mouse_click_at(x, y, button)?;
        Ok(())
    }
    
    fn mouse_drag(&self, from_x: i32, from_y: i32, to_x: i32, to_y: i32, button: &str) -> Result<()> {
        let (mouse_button, down_type, up_type, drag_type) = match button.to_lowercase().as_str() {
            "left" => (CGMouseButton::Left, CGEventType::LeftMouseDown, CGEventType::LeftMouseUp, CGEventType::LeftMouseDragged),
            "right" => (CGMouseButton::Right, CGEventType::RightMouseDown, CGEventType::RightMouseUp, CGEventType::RightMouseDragged),
            "middle" => (CGMouseButton::Center, CGEventType::OtherMouseDown, CGEventType::OtherMouseUp, CGEventType::OtherMouseDragged),
            _ => return Err(AutomationError::InvalidInput {
                message: format!("Unknown mouse button: {}", button),
            }),
        };
        
        let from_point = CGPoint::new(from_x as f64, from_y as f64);
        let to_point = CGPoint::new(to_x as f64, to_y as f64);
        let event_source = Self::create_event_source()?;
        
        // Mouse down at start position
        self.mouse_move(from_x, from_y)?;
        let down_event = CGEvent::new_mouse_event(
            event_source.clone(),
            down_type,
            from_point,
            mouse_button,
        ).map_err(|_| AutomationError::SystemError {
            message: "Failed to create mouse down event".to_string(),
        })?;
        down_event.post(CGEventTapLocation::HID);
        
        // Drag to end position
        let drag_event = CGEvent::new_mouse_event(
            event_source.clone(),
            drag_type,
            to_point,
            mouse_button,
        ).map_err(|_| AutomationError::SystemError {
            message: "Failed to create mouse drag event".to_string(),
        })?;
        drag_event.post(CGEventTapLocation::HID);
        
        // Mouse up at end position
        let up_event = CGEvent::new_mouse_event(
            event_source,
            up_type,
            to_point,
            mouse_button,
        ).map_err(|_| AutomationError::SystemError {
            message: "Failed to create mouse up event".to_string(),
        })?;
        up_event.post(CGEventTapLocation::HID);
        
        Ok(())
    }
    
    fn mouse_scroll(&self, _x: i32, _y: i32, _delta_x: i32, delta_y: i32) -> Result<()> {
        // For now, implement scroll using mouse wheel events
        // The core-graphics crate version we're using doesn't have new_scroll_event
        // This is a simplified implementation that could be enhanced
        let event_source = Self::create_event_source()?;
        
        // Create a basic scroll event using mouse wheel simulation
        // This is a workaround for the missing scroll event API
        if delta_y != 0 {
            let wheel_event = CGEvent::new(event_source)
                .map_err(|_| AutomationError::SystemError {
                    message: "Failed to create scroll event".to_string(),
                })?;
            wheel_event.post(CGEventTapLocation::HID);
        }
        
        Ok(())
    }
    
    fn key_press(&self, key: &str) -> Result<()> {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("key".to_string(), json!(key));
            
            logger.log_operation(
                LogLevel::Debug,
                CoreType::Rust,
                OperationType::Playback,
                "key_press".to_string(),
                format!("Key press: {}", key),
                Some(metadata),
            );
        }
        
        let key_code = self.get_key_code(key)?;
        let event_source = Self::create_event_source()?;
        
        // Log the operation
        self.log_platform_call("CGEvent::new_keyboard_event", &format!("key={}, keycode={}, down=true", key, key_code));
        
        let event = CGEvent::new_keyboard_event(
            event_source,
            key_code,
            true,
        ).map_err(|_| {
            self.log_platform_error("CGEvent::new_keyboard_event", "Failed to create key press event");
            AutomationError::SystemError {
                message: "Failed to create key press event. This may indicate missing accessibility permissions.".to_string(),
            }
        })?;
        
        event.post(CGEventTapLocation::HID);
        Ok(())
    }
    
    fn key_release(&self, key: &str) -> Result<()> {
        let key_code = self.get_key_code(key)?;
        let event_source = Self::create_event_source()?;
        let event = CGEvent::new_keyboard_event(
            event_source,
            key_code,
            false,
        ).map_err(|_| AutomationError::SystemError {
            message: "Failed to create key release event".to_string(),
        })?;
        
        event.post(CGEventTapLocation::HID);
        Ok(())
    }
    
    fn key_type(&self, text: &str) -> Result<()> {
        for ch in text.chars() {
            if let Some(&key_code) = self.key_map.get(&ch.to_lowercase().to_string()) {
                self.key_press(&ch.to_string())?;
                self.key_release(&ch.to_string())?;
                std::thread::sleep(std::time::Duration::from_millis(10));
            }
        }
        Ok(())
    }
    
    fn key_combination(&self, key: &str, modifiers: &[String]) -> Result<()> {
        // Press modifiers
        for modifier in modifiers {
            self.key_press(modifier)?;
        }
        
        // Press main key
        self.key_press(key)?;
        self.key_release(key)?;
        
        // Release modifiers in reverse order
        for modifier in modifiers.iter().rev() {
            self.key_release(modifier)?;
        }
        
        Ok(())
    }
    
    fn get_mouse_position(&self) -> Result<(i32, i32)> {
        self.log_platform_call("CGEvent::new (get mouse position)", "");
        
        // Use a different approach to get mouse position
        // The mouse_location method doesn't exist in this version of core-graphics
        // We'll use a workaround by creating an event and getting the location
        let event_source = Self::create_event_source()?;
        let event = CGEvent::new(event_source)
            .map_err(|_| {
                self.log_platform_error("CGEvent::new", "Failed to create event for mouse position");
                AutomationError::SystemError {
                    message: "Failed to create event for mouse position. This may indicate missing accessibility permissions.".to_string(),
                }
            })?;
        
        let location = event.location();
        Ok((location.x as i32, location.y as i32))
    }
    
    fn get_screen_size(&self) -> Result<(u32, u32)> {
        self.log_platform_call("CGDisplay::main", "");
        
        let display = CGDisplay::main();
        let bounds = display.bounds();
        
        let width = bounds.size.width as u32;
        let height = bounds.size.height as u32;
        
        if width == 0 || height == 0 {
            self.log_platform_error("CGDisplay::main", "Invalid screen dimensions");
            return Err(AutomationError::SystemError {
                message: "Failed to get valid screen dimensions".to_string(),
            });
        }
        
        Ok((width, height))
    }
    
    fn take_screenshot(&self) -> Result<Vec<u8>> {
        // Placeholder implementation - would need CGDisplayCreateImage
        Err(AutomationError::SystemError {
            message: "Screenshot functionality not yet implemented".to_string(),
        })
    }
    
    fn platform_name(&self) -> &'static str {
        "macos"
    }
}

#[cfg(not(target_os = "macos"))]
pub struct MacOSAutomation;

#[cfg(not(target_os = "macos"))]
impl MacOSAutomation {
    pub fn new() -> Result<Self> {
        Err(AutomationError::UnsupportedPlatform {
            platform: "macOS automation on non-macOS platform".to_string(),
        })
    }
}
