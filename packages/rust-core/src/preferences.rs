//! Core preference persistence module
//! 
//! Handles saving and loading user preferences for automation core selection
//! and other persistent settings.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use crate::{Result, AutomationError};

/// Core type selection
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CoreType {
    Python,
    Rust,
}

impl Default for CoreType {
    fn default() -> Self {
        CoreType::Python // Default to Python for backward compatibility
    }
}

/// User preferences for the automation system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    /// Preferred automation core
    pub preferred_core: CoreType,
    
    /// Whether to enable automatic fallback to alternative core
    pub fallback_enabled: bool,
    
    /// Whether to track performance metrics
    pub performance_tracking: bool,
    
    /// Whether to auto-detect available cores on startup
    pub auto_detection: bool,
    
    /// Last successful core used (for fallback purposes)
    pub last_working_core: Option<CoreType>,
    
    /// Timestamp of last preference update
    pub last_updated: chrono::DateTime<chrono::Utc>,
    
    /// User settings that should be preserved during core switching
    pub user_settings: UserSettings,
}

/// User settings that should be preserved during core switching
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSettings {
    /// Playback speed setting (e.g., 0.5, 1.0, 1.5, 2.0, 5.0)
    pub playback_speed: f64,
    
    /// Loop count setting (0 for infinite, positive number for specific count)
    pub loop_count: u32,
    
    /// Currently selected script path
    pub selected_script_path: Option<String>,
    
    /// UI state preferences
    pub ui_state: UIState,
}

/// UI state that should be preserved during core switching
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIState {
    /// Whether visual preview is enabled
    pub show_preview: bool,
    
    /// Preview opacity setting (0.0 to 1.0)
    pub preview_opacity: f64,
    
    /// Last used recording directory
    pub last_recording_directory: Option<String>,
    
    /// Window position and size (for future use)
    pub window_geometry: Option<WindowGeometry>,
}

/// Window geometry for UI state preservation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            playback_speed: 1.0,
            loop_count: 1,
            selected_script_path: None,
            ui_state: UIState::default(),
        }
    }
}

impl Default for UIState {
    fn default() -> Self {
        Self {
            show_preview: false,
            preview_opacity: 0.0,
            last_recording_directory: None,
            window_geometry: None,
        }
    }
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            preferred_core: CoreType::default(),
            fallback_enabled: true,
            performance_tracking: true,
            auto_detection: true,
            last_working_core: None,
            last_updated: chrono::Utc::now(),
            user_settings: UserSettings::default(),
        }
    }
}

/// Preference manager for handling persistence
#[derive(Debug)]
pub struct PreferenceManager {
    pub(crate) preferences_path: PathBuf,
    current_preferences: UserPreferences,
}

impl PreferenceManager {
    /// Create a new preference manager with the specified preferences file path
    pub fn new(preferences_path: PathBuf) -> Result<Self> {
        let current_preferences = if preferences_path.exists() {
            Self::load_from_file(&preferences_path)?
        } else {
            UserPreferences::default()
        };
        
        Ok(Self {
            preferences_path,
            current_preferences,
        })
    }
    
    /// Create a preference manager with default path
    pub fn with_default_path() -> Result<Self> {
        let preferences_dir = Self::get_default_preferences_dir()?;
        fs::create_dir_all(&preferences_dir).map_err(|e| {
            AutomationError::ConfigError { 
                message: format!("Failed to create preferences directory: {}", e) 
            }
        })?;
        
        let preferences_path = preferences_dir.join("preferences.json");
        Self::new(preferences_path)
    }
    
    /// Get the default preferences directory
    fn get_default_preferences_dir() -> Result<PathBuf> {
        let home_dir = dirs::home_dir().ok_or_else(|| {
            AutomationError::ConfigError { 
                message: "Could not determine home directory".to_string() 
            }
        })?;
        
        Ok(home_dir.join(".geniusqa").join("config"))
    }
    
    /// Load preferences from file
    fn load_from_file(path: &Path) -> Result<UserPreferences> {
        let content = fs::read_to_string(path).map_err(|e| {
            AutomationError::ConfigError { 
                message: format!("Failed to read preferences file: {}", e) 
            }
        })?;
        
        let preferences: UserPreferences = serde_json::from_str(&content).map_err(|e| {
            AutomationError::ConfigError { 
                message: format!("Failed to parse preferences file: {}", e) 
            }
        })?;
        
        Ok(preferences)
    }
    
    /// Save preferences to file
    fn save_to_file(&self) -> Result<()> {
        let content = serde_json::to_string_pretty(&self.current_preferences).map_err(|e| {
            AutomationError::ConfigError { 
                message: format!("Failed to serialize preferences: {}", e) 
            }
        })?;
        
        fs::write(&self.preferences_path, content).map_err(|e| {
            AutomationError::ConfigError { 
                message: format!("Failed to write preferences file: {}", e) 
            }
        })?;
        
        Ok(())
    }
    
    /// Get current preferences
    pub fn get_preferences(&self) -> &UserPreferences {
        &self.current_preferences
    }
    
    /// Set preferred core and persist the change
    pub fn set_preferred_core(&mut self, core_type: CoreType) -> Result<()> {
        self.current_preferences.preferred_core = core_type;
        self.current_preferences.last_updated = chrono::Utc::now();
        self.save_to_file()?;
        Ok(())
    }
    
    /// Update last working core (used for fallback)
    pub fn set_last_working_core(&mut self, core_type: CoreType) -> Result<()> {
        self.current_preferences.last_working_core = Some(core_type);
        self.current_preferences.last_updated = chrono::Utc::now();
        self.save_to_file()?;
        Ok(())
    }
    
    /// Update fallback setting
    pub fn set_fallback_enabled(&mut self, enabled: bool) -> Result<()> {
        self.current_preferences.fallback_enabled = enabled;
        self.current_preferences.last_updated = chrono::Utc::now();
        self.save_to_file()?;
        Ok(())
    }
    
    /// Update performance tracking setting
    pub fn set_performance_tracking(&mut self, enabled: bool) -> Result<()> {
        self.current_preferences.performance_tracking = enabled;
        self.current_preferences.last_updated = chrono::Utc::now();
        self.save_to_file()?;
        Ok(())
    }
    
    /// Update auto detection setting
    pub fn set_auto_detection(&mut self, enabled: bool) -> Result<()> {
        self.current_preferences.auto_detection = enabled;
        self.current_preferences.last_updated = chrono::Utc::now();
        self.save_to_file()?;
        Ok(())
    }
    
    /// Get the preferred core type
    pub fn get_preferred_core(&self) -> CoreType {
        self.current_preferences.preferred_core
    }
    
    /// Get the last working core (for fallback)
    pub fn get_last_working_core(&self) -> Option<CoreType> {
        self.current_preferences.last_working_core
    }
    
    /// Check if fallback is enabled
    pub fn is_fallback_enabled(&self) -> bool {
        self.current_preferences.fallback_enabled
    }
    
    /// Check if performance tracking is enabled
    pub fn is_performance_tracking_enabled(&self) -> bool {
        self.current_preferences.performance_tracking
    }
    
    /// Check if auto detection is enabled
    pub fn is_auto_detection_enabled(&self) -> bool {
        self.current_preferences.auto_detection
    }
    
    /// Get current user settings
    pub fn get_user_settings(&self) -> &UserSettings {
        &self.current_preferences.user_settings
    }
    
    /// Update playback speed setting
    pub fn set_playback_speed(&mut self, speed: f64) -> Result<()> {
        self.current_preferences.user_settings.playback_speed = speed;
        self.current_preferences.last_updated = chrono::Utc::now();
        self.save_to_file()?;
        Ok(())
    }
    
    /// Update loop count setting
    pub fn set_loop_count(&mut self, count: u32) -> Result<()> {
        self.current_preferences.user_settings.loop_count = count;
        self.current_preferences.last_updated = chrono::Utc::now();
        self.save_to_file()?;
        Ok(())
    }
    
    /// Update selected script path
    pub fn set_selected_script_path(&mut self, path: Option<String>) -> Result<()> {
        self.current_preferences.user_settings.selected_script_path = path;
        self.current_preferences.last_updated = chrono::Utc::now();
        self.save_to_file()?;
        Ok(())
    }
    
    /// Update UI state settings
    pub fn set_ui_state(&mut self, ui_state: UIState) -> Result<()> {
        self.current_preferences.user_settings.ui_state = ui_state;
        self.current_preferences.last_updated = chrono::Utc::now();
        self.save_to_file()?;
        Ok(())
    }
    
    /// Update show preview setting
    pub fn set_show_preview(&mut self, show_preview: bool) -> Result<()> {
        self.current_preferences.user_settings.ui_state.show_preview = show_preview;
        self.current_preferences.last_updated = chrono::Utc::now();
        self.save_to_file()?;
        Ok(())
    }
    
    /// Update preview opacity setting
    pub fn set_preview_opacity(&mut self, opacity: f64) -> Result<()> {
        self.current_preferences.user_settings.ui_state.preview_opacity = opacity;
        self.current_preferences.last_updated = chrono::Utc::now();
        self.save_to_file()?;
        Ok(())
    }
    
    /// Update last recording directory
    pub fn set_last_recording_directory(&mut self, directory: Option<String>) -> Result<()> {
        self.current_preferences.user_settings.ui_state.last_recording_directory = directory;
        self.current_preferences.last_updated = chrono::Utc::now();
        self.save_to_file()?;
        Ok(())
    }
    
    /// Update entire user settings (for bulk updates during core switching)
    pub fn update_user_settings(&mut self, settings: UserSettings) -> Result<()> {
        self.current_preferences.user_settings = settings;
        self.current_preferences.last_updated = chrono::Utc::now();
        self.save_to_file()?;
        Ok(())
    }
    
    /// Create a backup of current settings (for rollback purposes)
    pub fn backup_settings(&self) -> UserSettings {
        self.current_preferences.user_settings.clone()
    }
    
    /// Restore settings from backup
    pub fn restore_settings(&mut self, backup: UserSettings) -> Result<()> {
        self.current_preferences.user_settings = backup;
        self.current_preferences.last_updated = chrono::Utc::now();
        self.save_to_file()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    fn create_temp_preference_manager() -> (PreferenceManager, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let preferences_path = temp_dir.path().join("preferences.json");
        let manager = PreferenceManager::new(preferences_path).unwrap();
        (manager, temp_dir)
    }
    
    #[test]
    fn test_default_preferences() {
        let (manager, _temp_dir) = create_temp_preference_manager();
        let prefs = manager.get_preferences();
        
        assert_eq!(prefs.preferred_core, CoreType::Python);
        assert!(prefs.fallback_enabled);
        assert!(prefs.performance_tracking);
        assert!(prefs.auto_detection);
        assert_eq!(prefs.last_working_core, None);
        
        // Test default user settings
        assert_eq!(prefs.user_settings.playback_speed, 1.0);
        assert_eq!(prefs.user_settings.loop_count, 1);
        assert_eq!(prefs.user_settings.selected_script_path, None);
        assert!(!prefs.user_settings.ui_state.show_preview);
        assert_eq!(prefs.user_settings.ui_state.preview_opacity, 0.0);
    }
    
    #[test]
    fn test_set_preferred_core() {
        let (mut manager, _temp_dir) = create_temp_preference_manager();
        
        manager.set_preferred_core(CoreType::Rust).unwrap();
        assert_eq!(manager.get_preferred_core(), CoreType::Rust);
    }
    
    #[test]
    fn test_persistence() {
        let temp_dir = TempDir::new().unwrap();
        let preferences_path = temp_dir.path().join("preferences.json");
        
        // Create manager and set preferences
        {
            let mut manager = PreferenceManager::new(preferences_path.clone()).unwrap();
            manager.set_preferred_core(CoreType::Rust).unwrap();
            manager.set_fallback_enabled(false).unwrap();
            manager.set_playback_speed(2.0).unwrap();
            manager.set_loop_count(5).unwrap();
        }
        
        // Create new manager and verify persistence
        {
            let manager = PreferenceManager::new(preferences_path).unwrap();
            assert_eq!(manager.get_preferred_core(), CoreType::Rust);
            assert!(!manager.is_fallback_enabled());
            assert_eq!(manager.get_user_settings().playback_speed, 2.0);
            assert_eq!(manager.get_user_settings().loop_count, 5);
        }
    }
    
    #[test]
    fn test_user_settings_preservation() {
        let (mut manager, _temp_dir) = create_temp_preference_manager();
        
        // Set various user settings
        manager.set_playback_speed(1.5).unwrap();
        manager.set_loop_count(3).unwrap();
        manager.set_selected_script_path(Some("/path/to/script.json".to_string())).unwrap();
        manager.set_show_preview(true).unwrap();
        manager.set_preview_opacity(0.8).unwrap();
        
        // Verify settings are preserved
        let settings = manager.get_user_settings();
        assert_eq!(settings.playback_speed, 1.5);
        assert_eq!(settings.loop_count, 3);
        assert_eq!(settings.selected_script_path, Some("/path/to/script.json".to_string()));
        assert!(settings.ui_state.show_preview);
        assert_eq!(settings.ui_state.preview_opacity, 0.8);
    }
    
    #[test]
    fn test_settings_backup_and_restore() {
        let (mut manager, _temp_dir) = create_temp_preference_manager();
        
        // Set initial settings
        manager.set_playback_speed(2.0).unwrap();
        manager.set_loop_count(5).unwrap();
        
        // Create backup
        let backup = manager.backup_settings();
        
        // Change settings
        manager.set_playback_speed(0.5).unwrap();
        manager.set_loop_count(1).unwrap();
        
        // Verify changes
        assert_eq!(manager.get_user_settings().playback_speed, 0.5);
        assert_eq!(manager.get_user_settings().loop_count, 1);
        
        // Restore from backup
        manager.restore_settings(backup).unwrap();
        
        // Verify restoration
        assert_eq!(manager.get_user_settings().playback_speed, 2.0);
        assert_eq!(manager.get_user_settings().loop_count, 5);
    }
}
