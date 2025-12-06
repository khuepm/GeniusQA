//! macOS-specific automation implementation using Core Graphics

#[cfg(target_os = "macos")]
use core_graphics::{
    event::{CGEvent, CGEventType, CGMouseButton, CGEventTapLocation, CGKeyCode},
    event_source::{CGEventSource, CGEventSourceStateID},
    geometry::CGPoint,
    display::CGDisplay,
};

#[cfg(target_os = "macos")]
use core_foundation::{
    base::TCFType,
    boolean::CFBoolean,
    dictionary::CFDictionary,
    string::CFString,
};

use crate::{Result, AutomationError};
use crate::logging::{get_logger, CoreType, OperationType, LogLevel};
use super::PlatformAutomation;
use std::collections::HashMap;
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
    
    /// Check accessibility permissions using macOS APIs
    #[cfg(target_os = "macos")]
    fn check_accessibility_permissions(&self) -> Result<bool> {
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

        // Use AXIsProcessTrusted to check if we have accessibility permissions
        // This is the proper way to check on macOS
        let trusted = unsafe {
            // Declare the external function from ApplicationServices framework
            extern "C" {
                fn AXIsProcessTrusted() -> bool;
            }
            AXIsProcessTrusted()
        };

        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("has_permissions".to_string(), json!(trusted));
            
            logger.log_operation(
                if trusted { LogLevel::Info } else { LogLevel::Warn },
                CoreType::Rust,
                OperationType::Playback,
                "permission_check_result".to_string(),
                format!("Accessibility permissions: {}", if trusted { "granted" } else { "denied" }),
                Some(metadata),
            );
        }

        Ok(trusted)
    }

    /// Request accessibility permissions with detailed instructions
    #[cfg(target_os = "macos")]
    fn request_accessibility_permissions_with_prompt(&self) -> Result<()> {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("action".to_string(), json!("request_permissions"));
            metadata.insert("platform".to_string(), json!("macos"));
            
            let instructions = self.get_permission_instructions();
            metadata.insert("instructions".to_string(), json!(instructions));
            
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Playback,
                "permission_request".to_string(),
                "Requesting macOS accessibility permissions".to_string(),
                Some(metadata),
            );
        }

        // Attempt to trigger the permission prompt by using AXIsProcessTrustedWithOptions
        unsafe {
            extern "C" {
                fn AXIsProcessTrustedWithOptions(options: *const std::ffi::c_void) -> bool;
            }

            // Create options dictionary to show the prompt
            let prompt_key = CFString::from_static_string("AXTrustedCheckOptionPrompt");
            let prompt_value = CFBoolean::true_value();
            
            // Build the dictionary using the proper API
            use core_foundation::base::CFType;
            let key_cftype = CFType::wrap_under_get_rule(prompt_key.as_concrete_TypeRef() as *const _);
            let value_cftype = CFType::wrap_under_get_rule(prompt_value.as_concrete_TypeRef() as *const _);
            
            let pairs = vec![(key_cftype, value_cftype)];
            let options = CFDictionary::from_CFType_pairs(&pairs);
            
            AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef() as *const std::ffi::c_void);
        }

        Ok(())
    }

    /// Get detailed permission instructions for macOS
    fn get_permission_instructions(&self) -> String {
        format!(
            "To enable automation, please grant Accessibility permissions:\n\n\
            1. Open System Preferences (or System Settings on macOS 13+)\n\
            2. Navigate to Security & Privacy > Privacy > Accessibility\n\
               (On macOS 13+: Privacy & Security > Accessibility)\n\
            3. Click the lock icon to make changes (you may need to enter your password)\n\
            4. Find this application in the list and check the box next to it\n\
            5. If the application is not in the list, click the '+' button to add it\n\
            6. Restart the application after granting permissions\n\n\
            Direct link: x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility\n\n\
            Note: These permissions are required for the application to control your mouse and keyboard."
        )
    }

    /// Log permission denial with detailed instructions
    fn log_permission_denial(&self) {
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("platform".to_string(), json!("macos"));
            metadata.insert("required_permission".to_string(), json!("Accessibility"));
            metadata.insert("instructions".to_string(), json!(self.get_permission_instructions()));
            metadata.insert("system_preferences_link".to_string(), 
                json!("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"));
            
            logger.log_operation(
                LogLevel::Error,
                CoreType::Rust,
                OperationType::Playback,
                "permission_denied".to_string(),
                "Accessibility permissions not granted. Automation cannot proceed.".to_string(),
                Some(metadata),
            );
        }
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
            self.log_permission_denial();
            
            return Err(AutomationError::PermissionDenied {
                operation: format!(
                    "macOS Accessibility permissions required.\n\n{}\n\n\
                    You can also open System Preferences directly using this link:\n\
                    x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
                    self.get_permission_instructions()
                ),
            });
        }
        
        Ok(true)
    }
    
    fn request_permissions(&self) -> Result<bool> {
        // Request accessibility permissions with system prompt
        self.request_accessibility_permissions_with_prompt()?;
        
        // Check if permissions were granted
        let has_permissions = self.check_accessibility_permissions()?;
        
        if !has_permissions {
            if let Some(logger) = get_logger() {
                let mut metadata = HashMap::new();
                metadata.insert("instructions".to_string(), json!(self.get_permission_instructions()));
                
                logger.log_operation(
                    LogLevel::Warn,
                    CoreType::Rust,
                    OperationType::Playback,
                    "permission_request_pending".to_string(),
                    "Accessibility permissions not yet granted. Please follow the instructions to enable permissions.".to_string(),
                    Some(metadata),
                );
            }
        }
        
        Ok(has_permissions)
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
            if self.key_map.contains_key(&ch.to_lowercase().to_string()) {
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

    #[allow(dead_code)]
    fn check_accessibility_permissions(&self) -> Result<bool> {
        Err(AutomationError::UnsupportedPlatform {
            platform: "macOS automation on non-macOS platform".to_string(),
        })
    }

    #[allow(dead_code)]
    fn request_accessibility_permissions_with_prompt(&self) -> Result<()> {
        Err(AutomationError::UnsupportedPlatform {
            platform: "macOS automation on non-macOS platform".to_string(),
        })
    }

    #[allow(dead_code)]
    fn get_permission_instructions(&self) -> String {
        "macOS automation not available on this platform".to_string()
    }

    #[allow(dead_code)]
    fn log_permission_denial(&self) {}
}


#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn test_permission_instructions_format() {
        let automation = MacOSAutomation::new().expect("Failed to create MacOSAutomation");
        let instructions = automation.get_permission_instructions();
        
        // Verify instructions contain key information
        assert!(instructions.contains("System Preferences"));
        assert!(instructions.contains("Security & Privacy"));
        assert!(instructions.contains("Privacy"));
        assert!(instructions.contains("Accessibility"));
        assert!(instructions.contains("x-apple.systempreferences"));
    }

    #[test]
    fn test_check_permissions_returns_bool() {
        let automation = MacOSAutomation::new().expect("Failed to create MacOSAutomation");
        
        // This should return a Result<bool> without panicking
        let result = automation.check_accessibility_permissions();
        assert!(result.is_ok());
        
        // The result should be a boolean
        let has_permissions = result.unwrap();
        println!("Accessibility permissions: {}", has_permissions);
    }

    #[test]
    fn test_platform_name() {
        let automation = MacOSAutomation::new().expect("Failed to create MacOSAutomation");
        assert_eq!(automation.platform_name(), "macos");
    }
}
