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
use super::PlatformAutomation;
use std::collections::HashMap;
use std::ffi::CString;
use std::ptr;

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
                return Err(AutomationError::SystemError {
                    message: "Failed to open X11 display".to_string(),
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
        // Linux automation is ready after construction
        Ok(())
    }
    
    fn check_permissions(&self) -> Result<bool> {
        // On Linux, we generally have permissions if we can open the display
        Ok(!self.display.is_null())
    }
    
    fn request_permissions(&self) -> Result<bool> {
        // Linux doesn't require explicit permission requests for X11 automation
        Ok(true)
    }
    
    fn mouse_move(&self, x: i32, y: i32) -> Result<()> {
        unsafe {
            let root = XDefaultRootWindow(self.display);
            XWarpPointer(self.display, 0, root, 0, 0, 0, 0, x, y);
            XFlush(self.display);
        }
        Ok(())
    }
    
    fn mouse_click(&self, button: &str) -> Result<()> {
        let button_num = match button.to_lowercase().as_str() {
            "left" => Button1,
            "middle" => Button2,
            "right" => Button3,
            _ => return Err(AutomationError::InvalidInput {
                message: format!("Unknown mouse button: {}", button),
            }),
        };
        
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
        let keycode = self.get_keycode(key)?;
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
        unsafe {
            let root = XDefaultRootWindow(self.display);
            let mut root_return = 0;
            let mut child_return = 0;
            let mut root_x = 0;
            let mut root_y = 0;
            let mut win_x = 0;
            let mut win_y = 0;
            let mut mask_return = 0;
            
            XQueryPointer(
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
            
            Ok((root_x, root_y))
        }
    }
    
    fn get_screen_size(&self) -> Result<(u32, u32)> {
        unsafe {
            let screen = x11::xlib::XDefaultScreen(self.display);
            let width = x11::xlib::XDisplayWidth(self.display, screen) as u32;
            let height = x11::xlib::XDisplayHeight(self.display, screen) as u32;
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
