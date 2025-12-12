//! Linux-specific automation implementation using X11

#[cfg(target_os = "linux")]
use x11::{
    xlib::{
        Display, XOpenDisplay, XCloseDisplay, XDefaultRootWindow, XQueryPointer,
        XWarpPointer, XFlush, XSendEvent, XButtonEvent, XKeyEvent, XMotionEvent,
        ButtonPress, ButtonRelease, KeyPress, KeyRelease, MotionNotify,
        Button1, Button2, Button3, Button4, Button5, False, True,
        CurrentTime, PointerMotionMask, ButtonPressMask, ButtonReleaseMask,
    },
    xtest::{XTestFakeButtonEvent, XTestFakeKeyEvent, XTestFakeMotionEvent},
    keysym::{XK_Return, XK_space, XK_Tab, XK_Escape, XK_BackSpace, XK_Delete},
};

use crate::{Result, AutomationError};
use crate::logging::{get_logger, CoreType, OperationType, LogLevel};
use super::PlatformAutomation;
use std::collections::HashMap;
use std::ffi::CString;
use std::ptr;
use serde_json::json;

/// Linux-specific automation implementation
#[cfg(target_os = "linux")]
pub struct LinuxAutomation {
    display: *mut Display,
    key_map: HashMap<String, u32>,
}

#[cfg(target_os = "linux")]
impl LinuxAutomation {
    pub fn new() -> Result<Self> {
        unsafe {
            let display_name = CString::new(":0").unwrap();
            let display = XOpenDisplay(display_name.as_ptr());
            
            if display.is_null() {
                let display_env = std::env::var("DISPLAY").unwrap_or_else(|_| "not set".to_string());
                let wayland_env = std::env::var("WAYLAND_DISPLAY").unwrap_or_else(|_| "not set".to_string());
                
                let error_message = format!(
                    "Failed to open X11 display.\n\
                    DISPLAY environment variable: {}\n\
                    WAYLAND_DISPLAY environment variable: {}\n\n\
                    Troubleshooting:\n\
                    1. Ensure X11 server is running\n\
                    2. Check DISPLAY is set correctly (usually :0 or :1)\n\
                    3. Verify you have permission to access the display\n\
                    4. If using Wayland, ensure XWayland is installed and running\n\
                    5. Try running: xhost +local: (to grant local access)",
                    display_env, wayland_env
                );
                
                return Err(AutomationError::SystemError {
                    message: error_message,
                });
            }
            
            let mut automation = Self {
                display,
                key_map: HashMap::new(),
            };
            
            automation.initialize_key_map();
            Ok(automation)
        }
    }
    
    fn initialize_key_map(&mut self) {
        // Initialize common key mappings for X11
        // These are X11 keysyms converted to keycodes
        self.key_map.insert("enter".to_string(), 36);
        self.key_map.insert("space".to_string(), 65);
        self.key_map.insert("tab".to_string(), 23);
        self.key_map.insert("escape".to_string(), 9);
        self.key_map.insert("backspace".to_string(), 22);
        self.key_map.insert("delete".to_string(), 119);
        self.key_map.insert("home".to_string(), 110);
        self.key_map.insert("end".to_string(), 115);
        self.key_map.insert("pageup".to_string(), 112);
        self.key_map.insert("pagedown".to_string(), 117);
        self.key_map.insert("up".to_string(), 111);
        self.key_map.insert("down".to_string(), 116);
        self.key_map.insert("left".to_string(), 113);
        self.key_map.insert("right".to_string(), 114);
        self.key_map.insert("shift".to_string(), 50);
        self.key_map.insert("ctrl".to_string(), 37);
        self.key_map.insert("alt".to_string(), 64);
        
        // Function keys
        for i in 1..=12 {
            self.key_map.insert(format!("f{}", i), 67 + i - 1);
        }
        
        // Number keys
        for i in 0..=9 {
            let keycode = if i == 0 { 19 } else { 10 + i - 1 };
            self.key_map.insert(i.to_string(), keycode);
        }
        
        // Letter keys (QWERTY layout)
        let letters = [
            ("a", 38), ("b", 56), ("c", 54), ("d", 40), ("e", 26),
            ("f", 41), ("g", 42), ("h", 43), ("i", 31), ("j", 44),
            ("k", 45), ("l", 46), ("m", 58), ("n", 57), ("o", 32),
            ("p", 33), ("q", 24), ("r", 27), ("s", 39), ("t", 28),
            ("u", 30), ("v", 55), ("w", 25), ("x", 53), ("y", 29),
            ("z", 52),
        ];
        
        for (letter, keycode) in letters.iter() {
            self.key_map.insert(letter.to_string(), *keycode);
        }
    }
    
    fn get_keycode(&self, key: &str) -> Result<u32> {
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
            metadata.insert("platform".to_string(), json!("linux"));
            metadata.insert("operation".to_string(), json!(operation));
            metadata.insert("params".to_string(), json!(params));
            metadata.insert("display_server".to_string(), json!(self.detect_display_server()));
            
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
            metadata.insert("platform".to_string(), json!("linux"));
            metadata.insert("operation".to_string(), json!(operation));
            metadata.insert("error_message".to_string(), json!(error_message));
            metadata.insert("display_server".to_string(), json!(self.detect_display_server()));
            
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
    
    /// Detect display server (X11 or Wayland)
    fn detect_display_server(&self) -> String {
        if std::env::var("WAYLAND_DISPLAY").is_ok() {
            "wayland".to_string()
        } else if std::env::var("DISPLAY").is_ok() {
            "x11".to_string()
        } else {
            "unknown".to_string()
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
}

#[cfg(target_os = "linux")]
impl Drop for LinuxAutomation {
    fn drop(&mut self) {
        unsafe {
            if !self.display.is_null() {
                XCloseDisplay(self.display);
            }
        }
    }
}

#[cfg(target_os = "linux")]
impl PlatformAutomation for LinuxAutomation {
    fn initialize(&mut self) -> Result<()> {
        // Check display server
        let display_server = self.detect_display_server();
        
        if let Some(logger) = get_logger() {
            let mut metadata = HashMap::new();
            metadata.insert("display_server".to_string(), json!(display_server));
            metadata.insert("display_env".to_string(), json!(std::env::var("DISPLAY").unwrap_or_default()));
            metadata.insert("wayland_display_env".to_string(), json!(std::env::var("WAYLAND_DISPLAY").unwrap_or_default()));
            
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Playback,
                "linux_init".to_string(),
                format!("Initializing Linux automation with display server: {}", display_server),
                Some(metadata),
            );
        }
        
        if display_server == "unknown" {
            let setup_instructions = self.get_display_server_setup_instructions();
            return Err(AutomationError::SystemError {
                message: format!(
                    "No display server detected. Please ensure DISPLAY or WAYLAND_DISPLAY environment variable is set.\n\n{}",
                    setup_instructions
                ),
            });
        }
        
        if display_server == "wayland" {
            if let Some(logger) = get_logger() {
                logger.log_operation(
                    LogLevel::Warn,
                    CoreType::Rust,
                    OperationType::Playback,
                    "wayland_warning".to_string(),
                    "Wayland detected. X11 automation may not work correctly. Consider using XWayland or switching to X11.".to_string(),
                    None,
                );
            }
        }
        
        Ok(())
    }
    
    /// Get setup instructions for missing display server
    fn get_display_server_setup_instructions(&self) -> String {
        let mut instructions = String::from("Display Server Setup Instructions:\n\n");
        
        instructions.push_str("For X11:\n");
        instructions.push_str("  1. Ensure X11 is installed and running\n");
        instructions.push_str("  2. Set the DISPLAY environment variable:\n");
        instructions.push_str("     export DISPLAY=:0\n");
        instructions.push_str("  3. Verify X11 is running:\n");
        instructions.push_str("     echo $DISPLAY\n");
        instructions.push_str("     xdpyinfo (should show display information)\n\n");
        
        instructions.push_str("For Wayland with XWayland:\n");
        instructions.push_str("  1. Ensure XWayland is installed\n");
        instructions.push_str("  2. XWayland should automatically set DISPLAY\n");
        instructions.push_str("  3. Verify with: echo $DISPLAY\n\n");
        
        instructions.push_str("Common Linux Distributions:\n");
        instructions.push_str("  Ubuntu/Debian: sudo apt-get install xorg xserver-xorg\n");
        instructions.push_str("  Fedora/RHEL: sudo dnf install xorg-x11-server-Xorg\n");
        instructions.push_str("  Arch: sudo pacman -S xorg-server\n\n");
        
        instructions.push_str("If running in a headless environment:\n");
        instructions.push_str("  Consider using Xvfb (X Virtual Framebuffer):\n");
        instructions.push_str("  1. Install: sudo apt-get install xvfb (Ubuntu/Debian)\n");
        instructions.push_str("  2. Start: Xvfb :99 -screen 0 1024x768x24 &\n");
        instructions.push_str("  3. Set: export DISPLAY=:99\n");
        
        instructions
    }
    
    fn check_permissions(&self) -> Result<bool> {
        // On Linux, we generally have permissions if we can open the display
        if self.display.is_null() {
            if let Some(logger) = get_logger() {
                logger.log_operation(
                    LogLevel::Error,
                    CoreType::Rust,
                    OperationType::Playback,
                    "display_error".to_string(),
                    format!("Failed to open X11 display. Display server: {}. Please ensure X11 is running and DISPLAY is set correctly.", self.detect_display_server()),
                    None,
                );
            }
            return Ok(false);
        }
        Ok(true)
    }
    
    fn request_permissions(&self) -> Result<bool> {
        // Linux doesn't require explicit permission requests for X11 automation
        if let Some(logger) = get_logger() {
            logger.log_operation(
                LogLevel::Info,
                CoreType::Rust,
                OperationType::Playback,
                "permission_check".to_string(),
                "Linux X11 automation does not require explicit permissions.".to_string(),
                None,
            );
        }
        Ok(true)
    }
    
    fn mouse_move(&self, x: i32, y: i32) -> Result<()> {
        // Validate and clamp coordinates
        let (clamped_x, clamped_y) = self.validate_and_clamp_coordinates(x, y)?;
        
        // Log the operation
        self.log_platform_call("XWarpPointer", &format!("x={}, y={}", clamped_x, clamped_y));
        
        unsafe {
            let root = XDefaultRootWindow(self.display);
            if root == 0 {
                self.log_platform_error("XDefaultRootWindow", "Failed to get root window");
                return Err(AutomationError::SystemError {
                    message: "Failed to get root window. Display connection may be invalid.".to_string(),
                });
            }
            
            XWarpPointer(self.display, 0, root, 0, 0, 0, 0, clamped_x, clamped_y);
            XFlush(self.display);
        }
        
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
        
        let button_num = match button.to_lowercase().as_str() {
            "left" => Button1,
            "middle" => Button2,
            "right" => Button3,
            _ => return Err(AutomationError::InvalidInput {
                message: format!("Unknown mouse button: {}", button),
            }),
        };
        
        // Log the operation
        self.log_platform_call("XTestFakeButtonEvent", &format!("button={}", button));
        
        unsafe {
            // Press
            XTestFakeButtonEvent(self.display, button_num, True, CurrentTime);
            XFlush(self.display);
            
            // Release
            XTestFakeButtonEvent(self.display, button_num, False, CurrentTime);
            XFlush(self.display);
        }
        
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
        let button_num = match button.to_lowercase().as_str() {
            "left" => Button1,
            "middle" => Button2,
            "right" => Button3,
            _ => return Err(AutomationError::InvalidInput {
                message: format!("Unknown mouse button: {}", button),
            }),
        };
        
        unsafe {
            // Move to start position
            self.mouse_move(from_x, from_y)?;
            
            // Press button
            XTestFakeButtonEvent(self.display, button_num, True, CurrentTime);
            XFlush(self.display);
            
            // Move to end position
            self.mouse_move(to_x, to_y)?;
            
            // Release button
            XTestFakeButtonEvent(self.display, button_num, False, CurrentTime);
            XFlush(self.display);
        }
        
        Ok(())
    }
    
    fn mouse_scroll(&self, _x: i32, _y: i32, _delta_x: i32, delta_y: i32) -> Result<()> {
        unsafe {
            let button = if delta_y > 0 { Button4 } else { Button5 };
            let scroll_count = delta_y.abs();
            
            for _ in 0..scroll_count {
                XTestFakeButtonEvent(self.display, button, True, CurrentTime);
                XTestFakeButtonEvent(self.display, button, False, CurrentTime);
            }
            
            XFlush(self.display);
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
        
        let keycode = self.get_keycode(key)?;
        
        // Log the operation
        self.log_platform_call("XTestFakeKeyEvent", &format!("key={}, keycode={}, down=true", key, keycode));
        
        unsafe {
            XTestFakeKeyEvent(self.display, keycode, True, CurrentTime);
            XFlush(self.display);
        }
        Ok(())
    }
    
    fn key_release(&self, key: &str) -> Result<()> {
        let keycode = self.get_keycode(key)?;
        unsafe {
            XTestFakeKeyEvent(self.display, keycode, False, CurrentTime);
            XFlush(self.display);
        }
        Ok(())
    }
    
    fn key_type(&self, text: &str) -> Result<()> {
        for ch in text.chars() {
            if ch.is_ascii_alphanumeric() || ch.is_ascii_punctuation() || ch == ' ' {
                let key = ch.to_string();
                self.key_press(&key)?;
                self.key_release(&key)?;
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
        self.log_platform_call("XQueryPointer", "");
        
        unsafe {
            let root = XDefaultRootWindow(self.display);
            if root == 0 {
                self.log_platform_error("XDefaultRootWindow", "Failed to get root window");
                return Err(AutomationError::SystemError {
                    message: "Failed to get root window. Display connection may be invalid.".to_string(),
                });
            }
            
            let mut root_return = 0;
            let mut child_return = 0;
            let mut root_x = 0;
            let mut root_y = 0;
            let mut win_x = 0;
            let mut win_y = 0;
            let mut mask_return = 0;
            
            let result = XQueryPointer(
                self.display,
                root,
                &mut root_return,
                &mut child_return,
                &mut root_x,
                &mut root_y,
                &mut win_x,
                &mut win_y,
                &mut mask_return,
            );
            
            if result == 0 {
                self.log_platform_error("XQueryPointer", "Failed to query pointer position");
                return Err(AutomationError::SystemError {
                    message: "Failed to query pointer position. Display connection may be invalid.".to_string(),
                });
            }
            
            Ok((root_x, root_y))
        }
    }
    
    fn get_screen_size(&self) -> Result<(u32, u32)> {
        self.log_platform_call("XDisplayWidth/XDisplayHeight", "");
        
        unsafe {
            let screen = x11::xlib::XDefaultScreen(self.display);
            let width = x11::xlib::XDisplayWidth(self.display, screen) as u32;
            let height = x11::xlib::XDisplayHeight(self.display, screen) as u32;
            
            if width == 0 || height == 0 {
                self.log_platform_error("XDisplayWidth/XDisplayHeight", "Invalid screen dimensions");
                return Err(AutomationError::SystemError {
                    message: "Failed to get valid screen dimensions. Display connection may be invalid.".to_string(),
                });
            }
            
            Ok((width, height))
        }
    }
    
    fn take_screenshot(&self) -> Result<Vec<u8>> {
        // Placeholder implementation - would need XGetImage
        Err(AutomationError::SystemError {
            message: "Screenshot functionality not yet implemented".to_string(),
        })
    }
    
    fn platform_name(&self) -> &'static str {
        "linux"
    }
}

#[cfg(not(target_os = "linux"))]
pub struct LinuxAutomation;

#[cfg(not(target_os = "linux"))]
impl LinuxAutomation {
    pub fn new() -> Result<Self> {
        Err(AutomationError::UnsupportedPlatform {
            platform: "Linux automation on non-Linux platform".to_string(),
        })
    }
}
