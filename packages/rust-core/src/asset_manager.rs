//! Asset Manager for AI Vision Capture
//!
//! Manages storage and retrieval of reference images and screenshots
//! for AI Vision Capture actions. Handles cross-platform path normalization
//! and unique filename generation.

use crate::error::{AutomationError, Result};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Asset Manager for handling reference images and screenshots
/// 
/// Provides functionality to:
/// - Save reference images with unique filenames
/// - Load reference images from relative paths
/// - Delete reference images
/// - Normalize paths for cross-platform compatibility
#[derive(Debug, Clone)]
pub struct AssetManager {
    /// Base directory for the script (parent of assets folder)
    script_dir: PathBuf,
    /// Assets subdirectory name
    assets_subdir: String,
}

impl AssetManager {
    /// Create a new AssetManager for a given script patháerul
    /// 
    /// # Arguments
    /// * `script_path` - Path to the script file (e.g., "/path/to/script.json")
    /// 
    /// # Returns
    /// A new AssetManager instance
    pub fn new(script_path: &str) -> Self {
        let script_path = Path::new(script_path);
        let script_dir = script_path
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("."));
        
        AssetManager {
            script_dir,
            assets_subdir: "assets".to_string(),
        }
    }

    /// Get the assets directory path
    /// 
    /// # Returns
    /// The absolute path to the assets directory
    pub fn get_assets_dir(&self) -> PathBuf {
        self.script_dir.join(&self.assets_subdir)
    }


    /// Ensure the assets directory exists
    /// 
    /// # Returns
    /// Ok(()) if directory exists or was created, Err otherwise
    fn ensure_assets_dir(&self) -> Result<()> {
        let assets_dir = self.get_assets_dir();
        if !assets_dir.exists() {
            fs::create_dir_all(&assets_dir).map_err(|e| AutomationError::IoError {
                message: format!("Failed to create assets directory: {}", e),
            })?;
        }
        Ok(())
    }

    /// Save reference image data to the assets folder
    /// 
    /// # Arguments
    /// * `data` - Image data as bytes
    /// * `action_id` - UUID of the action (for unique naming)
    /// * `extension` - File extension (e.g., "png", "jpg")
    /// 
    /// # Returns
    /// Relative path in POSIX format (e.g., "assets/vision_abc123_1702123456789.png")
    /// 
    /// # Requirements
    /// - 5.5: Save to ./assets/ subdirectory relative to script file
    /// - 2.6: Store relative path in action data
    pub fn save_reference_image(&self, data: &[u8], action_id: &str, extension: &str) -> Result<String> {
        self.ensure_assets_dir()?;
        
        let filename = generate_unique_filename(action_id, extension);
        let absolute_path = self.get_assets_dir().join(&filename);
        
        fs::write(&absolute_path, data).map_err(|e| AutomationError::IoError {
            message: format!("Failed to save reference image: {}", e),
        })?;
        
        // Return relative path in POSIX format
        let relative_path = format!("{}/{}", self.assets_subdir, filename);
        Ok(to_posix_path(&relative_path))
    }

    /// Get the absolute path for a relative asset path
    /// 
    /// # Arguments
    /// * `relative_path` - Relative path in POSIX format from script JSON
    /// 
    /// # Returns
    /// Absolute path in OS-native format for file operations
    /// 
    /// # Requirements
    /// - 5.10: Convert POSIX paths to OS-native format for file operations
    pub fn get_asset_path(&self, relative_path: &str) -> PathBuf {
        let native_path = to_native_path(relative_path);
        self.script_dir.join(native_path)
    }

    /// Load reference image data from a relative path
    /// 
    /// # Arguments
    /// * `relative_path` - Relative path in POSIX format from script JSON
    /// 
    /// # Returns
    /// Image data as bytes
    pub fn load_reference_image(&self, relative_path: &str) -> Result<Vec<u8>> {
        let absolute_path = self.get_asset_path(relative_path);
        
        fs::read(&absolute_path).map_err(|e| AutomationError::IoError {
            message: format!("Failed to load reference image '{}': {}", relative_path, e),
        })
    }

    /// Delete a reference image
    /// 
    /// # Arguments
    /// * `relative_path` - Relative path in POSIX format from script JSON
    /// 
    /// # Returns
    /// Ok(()) if deleted successfully, Err otherwise
    pub fn delete_reference_image(&self, relative_path: &str) -> Result<()> {
        let absolute_path = self.get_asset_path(relative_path);
        
        if absolute_path.exists() {
            fs::remove_file(&absolute_path).map_err(|e| AutomationError::IoError {
                message: format!("Failed to delete reference image '{}': {}", relative_path, e),
            })?;
        }
        
        Ok(())
    }

    /// Check if a reference image exists
    /// 
    /// # Arguments
    /// * `relative_path` - Relative path in POSIX format from script JSON
    /// 
    /// # Returns
    /// true if the file exists, false otherwise
    pub fn reference_image_exists(&self, relative_path: &str) -> bool {
        let absolute_path = self.get_asset_path(relative_path);
        absolute_path.exists()
    }
}


// ============================================================================
// Path Normalization Functions (Cross-Platform)
// ============================================================================

/// Convert any path to POSIX format (forward slashes)
/// 
/// This function normalizes paths for storage in script JSON files,
/// ensuring consistent path format across all operating systems.
/// 
/// # Arguments
/// * `path` - Path string that may contain backslashes (Windows) or forward slashes
/// 
/// # Returns
/// Path string with all backslashes converted to forward slashes
/// 
/// # Requirements
/// - 5.9: Normalize all paths to POSIX format for storage
/// 
/// # Examples
/// ```
/// use rust_automation_core::asset_manager::to_posix_path;
/// 
/// assert_eq!(to_posix_path("assets\\image.png"), "assets/image.png");
/// assert_eq!(to_posix_path("assets/image.png"), "assets/image.png");
/// assert_eq!(to_posix_path("path\\to\\file.png"), "path/to/file.png");
/// ```
pub fn to_posix_path(path: &str) -> String {
    path.replace('\\', "/")
}

/// Convert POSIX path to OS-native format
/// 
/// This function converts paths from script JSON (POSIX format) to
/// the native format for the current operating system.
/// 
/// # Arguments
/// * `posix_path` - Path string in POSIX format (forward slashes)
/// 
/// # Returns
/// Path string in OS-native format (backslashes on Windows, forward slashes elsewhere)
/// 
/// # Requirements
/// - 5.10: Convert POSIX paths to OS-native format for file operations
/// 
/// # Examples
/// ```
/// use rust_automation_core::asset_manager::to_native_path;
/// 
/// // On Unix-like systems:
/// // assert_eq!(to_native_path("assets/image.png"), "assets/image.png");
/// 
/// // On Windows:
/// // assert_eq!(to_native_path("assets/image.png"), "assets\\image.png");
/// ```
pub fn to_native_path(posix_path: &str) -> String {
    #[cfg(windows)]
    {
        posix_path.replace('/', "\\")
    }
    #[cfg(not(windows))]
    {
        posix_path.to_string()
    }
}

/// Generate a unique filename for reference images
/// 
/// Creates a filename using the pattern: vision_{action_id}_{timestamp}.{ext}
/// This ensures no filename collisions even when multiple images are saved
/// for the same action.
/// 
/// # Arguments
/// * `action_id` - UUID of the action
/// * `extension` - File extension (e.g., "png", "jpg")
/// 
/// # Returns
/// Unique filename string
/// 
/// # Requirements
/// - 5.11: Generate unique filename using pattern vision_{action_id}_{timestamp}.{ext}
/// 
/// # Examples
/// ```
/// use rust_automation_core::asset_manager::generate_unique_filename;
/// 
/// let filename = generate_unique_filename("abc123", "png");
/// assert!(filename.starts_with("vision_abc123_"));
/// assert!(filename.ends_with(".png"));
/// ```
pub fn generate_unique_filename(action_id: &str, extension: &str) -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    
    // Sanitize action_id to remove any characters that might cause issues
    let safe_action_id: String = action_id
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    
    // Sanitize extension to remove leading dot if present
    let safe_extension = extension.trim_start_matches('.');
    
    format!("vision_{}_{}.{}", safe_action_id, timestamp, safe_extension)
}

/// Validate that a path is safe (no directory traversal attacks)
/// 
/// # Arguments
/// * `path` - Path to validate
/// 
/// # Returns
/// true if the path is safe, false if it contains suspicious patterns
pub fn is_safe_path(path: &str) -> bool {
    // Check for directory traversal attempts
    !path.contains("..") && 
    !path.starts_with('/') && 
    !path.starts_with('\\') &&
    !path.contains("://")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_to_posix_path_converts_backslashes() {
        assert_eq!(to_posix_path("assets\\image.png"), "assets/image.png");
        assert_eq!(to_posix_path("path\\to\\file.png"), "path/to/file.png");
        assert_eq!(to_posix_path("a\\b\\c\\d.txt"), "a/b/c/d.txt");
    }

    #[test]
    fn test_to_posix_path_preserves_forward_slashes() {
        assert_eq!(to_posix_path("assets/image.png"), "assets/image.png");
        assert_eq!(to_posix_path("path/to/file.png"), "path/to/file.png");
    }

    #[test]
    fn test_to_posix_path_handles_mixed_slashes() {
        assert_eq!(to_posix_path("assets\\sub/image.png"), "assets/sub/image.png");
        assert_eq!(to_posix_path("path/to\\file.png"), "path/to/file.png");
    }

    #[test]
    fn test_to_posix_path_handles_empty_string() {
        assert_eq!(to_posix_path(""), "");
    }

    #[test]
    fn test_generate_unique_filename_format() {
        let filename = generate_unique_filename("abc123", "png");
        assert!(filename.starts_with("vision_abc123_"));
        assert!(filename.ends_with(".png"));
    }

    #[test]
    fn test_generate_unique_filename_sanitizes_extension() {
        let filename = generate_unique_filename("test", ".png");
        assert!(filename.ends_with(".png"));
        assert!(!filename.ends_with("..png"));
    }

    #[test]
    fn test_generate_unique_filename_sanitizes_action_id() {
        let filename = generate_unique_filename("test/../bad", "png");
        assert!(!filename.contains(".."));
        assert!(!filename.contains("/"));
    }

    #[test]
    fn test_generate_unique_filename_uniqueness() {
        let filename1 = generate_unique_filename("test", "png");
        // Small delay to ensure different timestamp
        std::thread::sleep(std::time::Duration::from_millis(2));
        let filename2 = generate_unique_filename("test", "png");
        
        // Filenames should be different due to timestamp
        assert_ne!(filename1, filename2);
    }

    #[test]
    fn test_is_safe_path() {
        assert!(is_safe_path("assets/image.png"));
        assert!(is_safe_path("assets\\image.png"));
        assert!(is_safe_path("image.png"));
        
        assert!(!is_safe_path("../image.png"));
        assert!(!is_safe_path("assets/../image.png"));
        assert!(!is_safe_path("/etc/passwd"));
        assert!(!is_safe_path("\\etc\\passwd"));
        assert!(!is_safe_path("file://image.png"));
    }

    #[test]
    fn test_asset_manager_new() {
        let manager = AssetManager::new("/path/to/script.json");
        assert_eq!(manager.script_dir, PathBuf::from("/path/to"));
        assert_eq!(manager.assets_subdir, "assets");
    }

    #[test]
    fn test_asset_manager_get_assets_dir() {
        let manager = AssetManager::new("/path/to/script.json");
        assert_eq!(manager.get_assets_dir(), PathBuf::from("/path/to/assets"));
    }

    #[test]
    fn test_asset_manager_save_and_load() {
        let temp_dir = TempDir::new().unwrap();
        let script_path = temp_dir.path().join("script.json");
        let manager = AssetManager::new(script_path.to_str().unwrap());
        
        // Save an image
        let test_data = b"test image data";
        let relative_path = manager.save_reference_image(test_data, "test-action", "png").unwrap();
        
        // Verify path format
        assert!(relative_path.starts_with("assets/"));
        assert!(relative_path.contains("vision_test-action_"));
        assert!(relative_path.ends_with(".png"));
        
        // Load the image back
        let loaded_data = manager.load_reference_image(&relative_path).unwrap();
        assert_eq!(loaded_data, test_data);
    }

    #[test]
    fn test_asset_manager_delete() {
        let temp_dir = TempDir::new().unwrap();
        let script_path = temp_dir.path().join("script.json");
        let manager = AssetManager::new(script_path.to_str().unwrap());
        
        // Save an image
        let test_data = b"test image data";
        let relative_path = manager.save_reference_image(test_data, "test-action", "png").unwrap();
        
        // Verify it exists
        assert!(manager.reference_image_exists(&relative_path));
        
        // Delete it
        manager.delete_reference_image(&relative_path).unwrap();
        
        // Verify it's gone
        assert!(!manager.reference_image_exists(&relative_path));
    }

    #[test]
    fn test_asset_manager_get_asset_path() {
        let manager = AssetManager::new("/path/to/script.json");
        let absolute_path = manager.get_asset_path("assets/image.png");
        
        #[cfg(not(windows))]
        assert_eq!(absolute_path, PathBuf::from("/path/to/assets/image.png"));
    }
}
