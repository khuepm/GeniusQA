//! Platform-specific automation implementations

#[cfg(windows)]
pub mod windows;

#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "linux")]
pub mod linux;



use crate::{Result, AutomationError};

/// Trait for platform-specific automation implementations
pub trait PlatformAutomation: Send + Sync {
    /// Initialize the platform automation system
    fn initialize(&mut self) -> Result<()>;
    
    /// Check if the platform has required permissions
    fn check_permissions(&self) -> Result<bool>;
    
    /// Request permissions if needed (may show system dialogs)
    fn request_permissions(&self) -> Result<bool>;
    
    /// Move mouse to specified coordinates
    fn mouse_move(&self, x: i32, y: i32) -> Result<()>;
    
    /// Click mouse button at current position
    fn mouse_click(&self, button: &str) -> Result<()>;
    
    /// Click mouse button at specified coordinates
    fn mouse_click_at(&self, x: i32, y: i32, button: &str) -> Result<()>;
    
    /// Double-click mouse button at specified coordinates
    fn mouse_double_click(&self, x: i32, y: i32, button: &str) -> Result<()>;
    
    /// Drag mouse from one position to another
    fn mouse_drag(&self, from_x: i32, from_y: i32, to_x: i32, to_y: i32, button: &str) -> Result<()>;
    
    /// Scroll mouse wheel
    fn mouse_scroll(&self, x: i32, y: i32, delta_x: i32, delta_y: i32) -> Result<()>;
    
    /// Press a key
    fn key_press(&self, key: &str) -> Result<()>;
    
    /// Release a key
    fn key_release(&self, key: &str) -> Result<()>;
    
    /// Type text
    fn key_type(&self, text: &str) -> Result<()>;
    
    /// Press key combination with modifiers
    fn key_combination(&self, key: &str, modifiers: &[String]) -> Result<()>;
    
    /// Get current mouse position
    fn get_mouse_position(&self) -> Result<(i32, i32)>;
    
    /// Get screen dimensions
    fn get_screen_size(&self) -> Result<(u32, u32)>;
    
    /// Take a screenshot and return image data
    fn take_screenshot(&self) -> Result<Vec<u8>>;
    
    /// Get platform name
    fn platform_name(&self) -> &'static str;
}

/// Create platform-specific automation instance
pub fn create_platform_automation() -> Result<Box<dyn PlatformAutomation>> {
    #[cfg(windows)]
    {
        Ok(Box::new(windows::WindowsAutomation::new()?))
    }
    
    #[cfg(target_os = "macos")]
    {
        Ok(Box::new(macos::MacOSAutomation::new()?))
    }
    
    #[cfg(target_os = "linux")]
    {
        Ok(Box::new(linux::LinuxAutomation::new()?))
    }
    
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    {
        Err(AutomationError::UnsupportedPlatform {
            platform: std::env::consts::OS.to_string(),
        })
    }
}
