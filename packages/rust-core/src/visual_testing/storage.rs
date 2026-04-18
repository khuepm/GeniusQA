//! Storage backend implementations for visual regression testing assets
//! 
//! This module provides flexible storage backends for managing baseline images,
//! test results, and associated metadata with support for local file systems,
//! Git LFS, and cloud storage providers.

use crate::visual_testing::{VisualError, VisualResult};
use image::DynamicImage;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use sha2::{Digest, Sha256};
use std::process::Command;

/// Storage usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageUsage {
    /// Total size in bytes
    pub total_size_bytes: u64,
    /// Number of files
    pub file_count: u64,
    /// Size breakdown by category
    pub category_sizes: HashMap<String, u64>,
    /// Last updated timestamp
    pub last_updated: u64,
}

impl StorageUsage {
    pub fn new() -> Self {
        Self {
            total_size_bytes: 0,
            file_count: 0,
            category_sizes: HashMap::new(),
            last_updated: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        }
    }

    pub fn add_file(&mut self, category: &str, size_bytes: u64) {
        self.total_size_bytes += size_bytes;
        self.file_count += 1;
        *self.category_sizes.entry(category.to_string()).or_insert(0) += size_bytes;
        self.last_updated = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
    }

    pub fn total_size_mb(&self) -> f64 {
        self.total_size_bytes as f64 / (1024.0 * 1024.0)
    }
}

/// Configuration for asset compression
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressionConfig {
    /// Enable PNG optimization
    pub optimize_png: bool,
    /// Convert to WebP for size reduction
    pub use_webp: bool,
    /// Generate thumbnails for UI display
    pub generate_thumbnails: bool,
    /// Thumbnail size (width, height)
    pub thumbnail_size: (u32, u32),
    /// JPEG quality for thumbnails (1-100)
    pub thumbnail_quality: u8,
}

impl Default for CompressionConfig {
    fn default() -> Self {
        Self {
            optimize_png: true,
            use_webp: false, // Disabled by default for compatibility
            generate_thumbnails: true,
            thumbnail_size: (300, 200),
            thumbnail_quality: 85,
        }
    }
}

/// Storage backend trait for different storage implementations
pub trait StorageBackend: Send + Sync {
    /// Save a baseline image
    fn save_baseline(&self, image: &DynamicImage, path: &str) -> VisualResult<String>;
    
    /// Load a baseline image
    fn load_baseline(&self, path: &str) -> VisualResult<DynamicImage>;
    
    /// Save a test result image (actual or diff)
    fn save_result(&self, image: &DynamicImage, path: &str) -> VisualResult<String>;
    
    /// Load a test result image
    fn load_result(&self, path: &str) -> VisualResult<DynamicImage>;
    
    /// Clean up old test results
    fn cleanup_old_results(&self, retention_days: u32) -> VisualResult<()>;
    
    /// Get storage usage statistics
    fn get_storage_usage(&self) -> VisualResult<StorageUsage>;
    
    /// Check if a file exists
    fn exists(&self, path: &str) -> bool;
    
    /// Delete a file
    fn delete(&self, path: &str) -> VisualResult<()>;
    
    /// List files in a directory
    fn list_files(&self, directory: &str) -> VisualResult<Vec<String>>;
    
    /// Get file metadata (size, modified time, etc.)
    fn get_metadata(&self, path: &str) -> VisualResult<FileMetadata>;
}

/// File metadata information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub size_bytes: u64,
    pub modified_time: u64,
    pub checksum: String,
    pub file_type: String,
}

/// Local file system storage implementation
#[derive(Debug, Clone)]
pub struct LocalFileStorage {
    /// Base directory for all storage
    base_path: PathBuf,
    /// Maximum storage size in MB
    max_size_mb: u64,
    /// Compression configuration
    compression_config: CompressionConfig,
}

impl LocalFileStorage {
    /// Create a new local file storage backend
    pub fn new<P: AsRef<Path>>(base_path: P, max_size_mb: u64) -> VisualResult<Self> {
        let base_path = base_path.as_ref().to_path_buf();
        
        // Create base directory if it doesn't exist
        if !base_path.exists() {
            fs::create_dir_all(&base_path).map_err(|e| VisualError::FileSystemError {
                operation: "create_directory".to_string(),
                path: base_path.display().to_string(),
                reason: e.to_string(),
            })?;
        }

        // Create subdirectories
        let subdirs = ["baselines", "results", "thumbnails", "temp"];
        for subdir in &subdirs {
            let dir_path = base_path.join(subdir);
            if !dir_path.exists() {
                fs::create_dir_all(&dir_path).map_err(|e| VisualError::FileSystemError {
                    operation: "create_subdirectory".to_string(),
                    path: dir_path.display().to_string(),
                    reason: e.to_string(),
                })?;
            }
        }

        Ok(Self {
            base_path,
            max_size_mb,
            compression_config: CompressionConfig::default(),
        })
    }

    /// Create with custom compression configuration
    pub fn with_compression_config(mut self, config: CompressionConfig) -> Self {
        self.compression_config = config;
        self
    }

    /// Get the full path for a relative path
    fn get_full_path(&self, relative_path: &str) -> PathBuf {
        self.base_path.join(relative_path)
    }

    /// Calculate SHA256 checksum of an image
    fn calculate_checksum(&self, image: &DynamicImage) -> String {
        let mut hasher = Sha256::new();
        
        // Convert image to bytes for hashing
        let mut bytes = Vec::new();
        if image.write_to(&mut std::io::Cursor::new(&mut bytes), image::ImageFormat::Png).is_ok() {
            hasher.update(&bytes);
        }
        
        format!("{:x}", hasher.finalize())
    }

    /// Save image with compression and optimization
    fn save_image_optimized(&self, image: &DynamicImage, full_path: &Path) -> VisualResult<String> {
        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).map_err(|e| VisualError::FileSystemError {
                operation: "create_parent_directory".to_string(),
                path: parent.display().to_string(),
                reason: e.to_string(),
            })?;
        }

        // Save the main image
        if self.compression_config.use_webp {
            // Try to save as WebP for better compression
            let webp_path = full_path.with_extension("webp");
            if let Err(_) = image.save(&webp_path) {
                // Fallback to PNG if WebP fails
                image.save(full_path).map_err(|e| VisualError::ImageSaveError {
                    path: full_path.display().to_string(),
                    reason: e.to_string(),
                })?;
            } else {
                return Ok(webp_path.display().to_string());
            }
        } else {
            image.save(full_path).map_err(|e| VisualError::ImageSaveError {
                path: full_path.display().to_string(),
                reason: e.to_string(),
            })?;
        }

        // Generate thumbnail if enabled
        if self.compression_config.generate_thumbnails {
            let thumbnail = image.resize(
                self.compression_config.thumbnail_size.0,
                self.compression_config.thumbnail_size.1,
                image::imageops::FilterType::Lanczos3,
            );

            let thumbnail_path = self.get_thumbnail_path(full_path);
            thumbnail.save(&thumbnail_path).map_err(|e| VisualError::ImageSaveError {
                path: thumbnail_path.display().to_string(),
                reason: e.to_string(),
            })?;
        }

        Ok(full_path.display().to_string())
    }

    /// Get thumbnail path for a given image path
    fn get_thumbnail_path(&self, image_path: &Path) -> PathBuf {
        let filename = image_path.file_stem().unwrap_or_default();
        let extension = image_path.extension().unwrap_or_default();
        
        self.base_path
            .join("thumbnails")
            .join(format!("{}_thumb.{}", filename.to_string_lossy(), extension.to_string_lossy()))
    }

    /// Check storage usage and enforce limits
    fn check_storage_limits(&self) -> VisualResult<()> {
        let usage = self.get_storage_usage()?;
        
        if usage.total_size_mb() > self.max_size_mb as f64 {
            return Err(VisualError::InsufficientMemory {
                required_mb: 0, // We don't know how much more we need
                available_mb: (self.max_size_mb as f64 - usage.total_size_mb()) as u32,
            });
        }
        
        Ok(())
    }

    /// Clean up files older than specified days
    fn cleanup_files_by_age(&self, directory: &Path, retention_days: u32) -> VisualResult<u64> {
        let cutoff_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() - (retention_days as u64 * 24 * 60 * 60);

        let mut cleaned_bytes = 0u64;

        if !directory.exists() {
            return Ok(0);
        }

        let entries = fs::read_dir(directory).map_err(|e| VisualError::FileSystemError {
            operation: "read_directory".to_string(),
            path: directory.display().to_string(),
            reason: e.to_string(),
        })?;

        for entry in entries {
            let entry = entry.map_err(|e| VisualError::FileSystemError {
                operation: "read_directory_entry".to_string(),
                path: directory.display().to_string(),
                reason: e.to_string(),
            })?;

            let path = entry.path();
            
            if path.is_file() {
                let metadata = fs::metadata(&path).map_err(|e| VisualError::FileSystemError {
                    operation: "get_file_metadata".to_string(),
                    path: path.display().to_string(),
                    reason: e.to_string(),
                })?;

                let modified_time = metadata
                    .modified()
                    .unwrap_or(SystemTime::UNIX_EPOCH)
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                if modified_time < cutoff_time {
                    cleaned_bytes += metadata.len();
                    fs::remove_file(&path).map_err(|e| VisualError::FileSystemError {
                        operation: "delete_file".to_string(),
                        path: path.display().to_string(),
                        reason: e.to_string(),
                    })?;
                }
            } else if path.is_dir() {
                // Recursively clean subdirectories
                cleaned_bytes += self.cleanup_files_by_age(&path, retention_days)?;
                
                // Remove empty directories
                if fs::read_dir(&path).map(|mut d| d.next().is_none()).unwrap_or(false) {
                    fs::remove_dir(&path).map_err(|e| VisualError::FileSystemError {
                        operation: "delete_directory".to_string(),
                        path: path.display().to_string(),
                        reason: e.to_string(),
                    })?;
                }
            }
        }

        Ok(cleaned_bytes)
    }
}

impl StorageBackend for LocalFileStorage {
    fn save_baseline(&self, image: &DynamicImage, path: &str) -> VisualResult<String> {
        self.check_storage_limits()?;
        
        let full_path = self.base_path.join("baselines").join(path);
        self.save_image_optimized(image, &full_path)
    }

    fn load_baseline(&self, path: &str) -> VisualResult<DynamicImage> {
        let full_path = self.base_path.join("baselines").join(path);
        
        // Try WebP first if enabled, then fallback to original
        if self.compression_config.use_webp {
            let webp_path = full_path.with_extension("webp");
            if webp_path.exists() {
                return image::open(&webp_path).map_err(|e| VisualError::ImageLoadError {
                    path: webp_path.display().to_string(),
                    reason: e.to_string(),
                });
            }
        }
        
        image::open(&full_path).map_err(|e| VisualError::ImageLoadError {
            path: full_path.display().to_string(),
            reason: e.to_string(),
        })
    }

    fn save_result(&self, image: &DynamicImage, path: &str) -> VisualResult<String> {
        self.check_storage_limits()?;
        
        let full_path = self.base_path.join("results").join(path);
        self.save_image_optimized(image, &full_path)
    }

    fn load_result(&self, path: &str) -> VisualResult<DynamicImage> {
        let full_path = self.base_path.join("results").join(path);
        
        image::open(&full_path).map_err(|e| VisualError::ImageLoadError {
            path: full_path.display().to_string(),
            reason: e.to_string(),
        })
    }

    fn cleanup_old_results(&self, retention_days: u32) -> VisualResult<()> {
        let results_dir = self.base_path.join("results");
        let thumbnails_dir = self.base_path.join("thumbnails");
        let temp_dir = self.base_path.join("temp");

        // Clean up results, thumbnails, and temp files
        self.cleanup_files_by_age(&results_dir, retention_days)?;
        self.cleanup_files_by_age(&thumbnails_dir, retention_days)?;
        self.cleanup_files_by_age(&temp_dir, 1)?; // Clean temp files daily

        Ok(())
    }

    fn get_storage_usage(&self) -> VisualResult<StorageUsage> {
        let mut usage = StorageUsage::new();
        
        let categories = [
            ("baselines", self.base_path.join("baselines")),
            ("results", self.base_path.join("results")),
            ("thumbnails", self.base_path.join("thumbnails")),
            ("temp", self.base_path.join("temp")),
        ];

        for (category, dir_path) in &categories {
            if dir_path.exists() {
                let size = self.calculate_directory_size(dir_path)?;
                usage.category_sizes.insert(category.to_string(), size);
                usage.total_size_bytes += size;
            }
        }

        Ok(usage)
    }

    fn exists(&self, path: &str) -> bool {
        let full_path = self.get_full_path(path);
        full_path.exists()
    }

    fn delete(&self, path: &str) -> VisualResult<()> {
        let full_path = self.get_full_path(path);
        
        if full_path.is_file() {
            fs::remove_file(&full_path).map_err(|e| VisualError::FileSystemError {
                operation: "delete_file".to_string(),
                path: full_path.display().to_string(),
                reason: e.to_string(),
            })?;
        } else if full_path.is_dir() {
            fs::remove_dir_all(&full_path).map_err(|e| VisualError::FileSystemError {
                operation: "delete_directory".to_string(),
                path: full_path.display().to_string(),
                reason: e.to_string(),
            })?;
        }

        Ok(())
    }

    fn list_files(&self, directory: &str) -> VisualResult<Vec<String>> {
        let dir_path = self.get_full_path(directory);
        
        if !dir_path.exists() {
            return Ok(Vec::new());
        }

        let entries = fs::read_dir(&dir_path).map_err(|e| VisualError::FileSystemError {
            operation: "read_directory".to_string(),
            path: dir_path.display().to_string(),
            reason: e.to_string(),
        })?;

        let mut files = Vec::new();
        for entry in entries {
            let entry = entry.map_err(|e| VisualError::FileSystemError {
                operation: "read_directory_entry".to_string(),
                path: dir_path.display().to_string(),
                reason: e.to_string(),
            })?;

            if let Some(filename) = entry.file_name().to_str() {
                files.push(filename.to_string());
            }
        }

        files.sort();
        Ok(files)
    }

    fn get_metadata(&self, path: &str) -> VisualResult<FileMetadata> {
        let full_path = self.get_full_path(path);
        
        let metadata = fs::metadata(&full_path).map_err(|e| VisualError::FileSystemError {
            operation: "get_file_metadata".to_string(),
            path: full_path.display().to_string(),
            reason: e.to_string(),
        })?;

        let modified_time = metadata
            .modified()
            .unwrap_or(SystemTime::UNIX_EPOCH)
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Calculate checksum for files
        let checksum = if full_path.is_file() {
            let contents = fs::read(&full_path).map_err(|e| VisualError::FileSystemError {
                operation: "read_file_for_checksum".to_string(),
                path: full_path.display().to_string(),
                reason: e.to_string(),
            })?;
            
            let mut hasher = Sha256::new();
            hasher.update(&contents);
            format!("{:x}", hasher.finalize())
        } else {
            String::new()
        };

        let file_type = full_path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("unknown")
            .to_string();

        Ok(FileMetadata {
            size_bytes: metadata.len(),
            modified_time,
            checksum,
            file_type,
        })
    }
}

impl LocalFileStorage {
    /// Calculate the total size of a directory recursively
    fn calculate_directory_size(&self, dir_path: &Path) -> VisualResult<u64> {
        let mut total_size = 0u64;

        if !dir_path.exists() {
            return Ok(0);
        }

        let entries = fs::read_dir(dir_path).map_err(|e| VisualError::FileSystemError {
            operation: "read_directory_for_size".to_string(),
            path: dir_path.display().to_string(),
            reason: e.to_string(),
        })?;

        for entry in entries {
            let entry = entry.map_err(|e| VisualError::FileSystemError {
                operation: "read_directory_entry_for_size".to_string(),
                path: dir_path.display().to_string(),
                reason: e.to_string(),
            })?;

            let path = entry.path();
            
            if path.is_file() {
                let metadata = fs::metadata(&path).map_err(|e| VisualError::FileSystemError {
                    operation: "get_file_metadata_for_size".to_string(),
                    path: path.display().to_string(),
                    reason: e.to_string(),
                })?;
                total_size += metadata.len();
            } else if path.is_dir() {
                total_size += self.calculate_directory_size(&path)?;
            }
        }

        Ok(total_size)
    }
}

/// Git LFS configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitLFSConfig {
    /// Repository path
    pub repo_path: PathBuf,
    /// LFS track patterns (e.g., "*.png", "*.jpg")
    pub track_patterns: Vec<String>,
    /// Maximum file size for LFS (in MB)
    pub max_file_size_mb: u64,
    /// Enable automatic LFS tracking
    pub auto_track: bool,
}

impl Default for GitLFSConfig {
    fn default() -> Self {
        Self {
            repo_path: PathBuf::from("."),
            track_patterns: vec![
                "*.png".to_string(),
                "*.jpg".to_string(),
                "*.jpeg".to_string(),
                "*.webp".to_string(),
            ],
            max_file_size_mb: 10,
            auto_track: true,
        }
    }
}

/// Git LFS storage backend implementation
/// Note: This implementation only manages LFS-tracked files locally.
/// Git operations (push/pull) remain user responsibility to avoid auth complexity.
#[derive(Debug, Clone)]
pub struct GitLFSStorage {
    /// LFS configuration
    lfs_config: GitLFSConfig,
    /// Local cache storage
    local_cache: LocalFileStorage,
    /// Base path for LFS files
    lfs_path: PathBuf,
}

impl GitLFSStorage {
    /// Create a new Git LFS storage backend
    pub fn new(lfs_config: GitLFSConfig, cache_size_mb: u64) -> VisualResult<Self> {
        // Validate that we're in a git repository
        let repo_path = &lfs_config.repo_path;
        if !repo_path.join(".git").exists() {
            return Err(VisualError::ConfigurationError {
                field: "repo_path".to_string(),
                reason: "Not a git repository".to_string(),
            });
        }

        // Check if Git LFS is installed
        let lfs_check = Command::new("git")
            .args(&["lfs", "version"])
            .current_dir(repo_path)
            .output();

        if lfs_check.is_err() || !lfs_check.unwrap().status.success() {
            return Err(VisualError::ConfigurationError {
                field: "git_lfs".to_string(),
                reason: "Git LFS is not installed or not available".to_string(),
            });
        }

        // Create LFS directory structure
        let lfs_path = repo_path.join("assets").join("baselines");
        if !lfs_path.exists() {
            fs::create_dir_all(&lfs_path).map_err(|e| VisualError::FileSystemError {
                operation: "create_lfs_directory".to_string(),
                path: lfs_path.display().to_string(),
                reason: e.to_string(),
            })?;
        }

        // Create local cache
        let cache_path = repo_path.join(".vrt").join("lfs_cache");
        let local_cache = LocalFileStorage::new(&cache_path, cache_size_mb)?;

        let mut storage = Self {
            lfs_config,
            local_cache,
            lfs_path,
        };

        // Initialize LFS tracking if auto_track is enabled
        if storage.lfs_config.auto_track {
            storage.initialize_lfs_tracking()?;
        }

        Ok(storage)
    }

    /// Initialize Git LFS tracking for specified patterns
    fn initialize_lfs_tracking(&self) -> VisualResult<()> {
        // Check if .gitattributes exists and has our patterns
        let gitattributes_path = self.lfs_config.repo_path.join(".gitattributes");
        let mut existing_content = String::new();
        
        if gitattributes_path.exists() {
            existing_content = fs::read_to_string(&gitattributes_path).map_err(|e| {
                VisualError::FileSystemError {
                    operation: "read_gitattributes".to_string(),
                    path: gitattributes_path.display().to_string(),
                    reason: e.to_string(),
                }
            })?;
        }

        let mut needs_update = false;
        let mut new_content = existing_content.clone();

        // Add LFS tracking patterns if they don't exist
        for pattern in &self.lfs_config.track_patterns {
            let lfs_line = format!("{} filter=lfs diff=lfs merge=lfs -text", pattern);
            if !existing_content.contains(&lfs_line) {
                if !new_content.is_empty() && !new_content.ends_with('\n') {
                    new_content.push('\n');
                }
                new_content.push_str(&format!("# Visual regression testing assets\n{}\n", lfs_line));
                needs_update = true;
            }
        }

        if needs_update {
            fs::write(&gitattributes_path, new_content).map_err(|e| {
                VisualError::FileSystemError {
                    operation: "write_gitattributes".to_string(),
                    path: gitattributes_path.display().to_string(),
                    reason: e.to_string(),
                }
            })?;
        }

        Ok(())
    }

    /// Check if a file should be tracked by LFS based on size and pattern
    fn should_track_with_lfs(&self, file_path: &Path, file_size_bytes: u64) -> bool {
        // Check file size
        let file_size_mb = file_size_bytes as f64 / (1024.0 * 1024.0);
        if file_size_mb < self.lfs_config.max_file_size_mb as f64 {
            return false;
        }

        // Check file pattern
        if let Some(extension) = file_path.extension().and_then(|ext| ext.to_str()) {
            let pattern = format!("*.{}", extension);
            return self.lfs_config.track_patterns.contains(&pattern);
        }

        false
    }

    /// Get the LFS file path for a given relative path
    fn get_lfs_path(&self, relative_path: &str) -> PathBuf {
        self.lfs_path.join(relative_path)
    }

    /// Get the cache path for a given relative path
    fn get_cache_path(&self, relative_path: &str) -> String {
        format!("lfs_cache/{}", relative_path)
    }

    /// Save file to LFS location and update cache
    fn save_to_lfs(&self, image: &DynamicImage, relative_path: &str) -> VisualResult<String> {
        let lfs_file_path = self.get_lfs_path(relative_path);
        
        // Ensure parent directory exists
        if let Some(parent) = lfs_file_path.parent() {
            fs::create_dir_all(parent).map_err(|e| VisualError::FileSystemError {
                operation: "create_lfs_parent_directory".to_string(),
                path: parent.display().to_string(),
                reason: e.to_string(),
            })?;
        }

        // Save to LFS location
        image.save(&lfs_file_path).map_err(|e| VisualError::ImageSaveError {
            path: lfs_file_path.display().to_string(),
            reason: e.to_string(),
        })?;

        // Also save to local cache for faster access
        let cache_path = self.get_cache_path(relative_path);
        let _ = self.local_cache.save_baseline(image, &cache_path);

        Ok(lfs_file_path.display().to_string())
    }

    /// Load file from cache first, then LFS location
    fn load_from_lfs(&self, relative_path: &str) -> VisualResult<DynamicImage> {
        let cache_path = self.get_cache_path(relative_path);
        
        // Try cache first
        if let Ok(image) = self.local_cache.load_baseline(&cache_path) {
            return Ok(image);
        }

        // Load from LFS location
        let lfs_file_path = self.get_lfs_path(relative_path);
        let image = image::open(&lfs_file_path).map_err(|e| VisualError::ImageLoadError {
            path: lfs_file_path.display().to_string(),
            reason: e.to_string(),
        })?;

        // Update cache for next time
        let _ = self.local_cache.save_baseline(&image, &cache_path);

        Ok(image)
    }

    /// Check if LFS file exists
    fn lfs_file_exists(&self, relative_path: &str) -> bool {
        let lfs_file_path = self.get_lfs_path(relative_path);
        lfs_file_path.exists()
    }

    /// Get LFS file metadata
    fn get_lfs_metadata(&self, relative_path: &str) -> VisualResult<FileMetadata> {
        let lfs_file_path = self.get_lfs_path(relative_path);
        
        let metadata = fs::metadata(&lfs_file_path).map_err(|e| VisualError::FileSystemError {
            operation: "get_lfs_file_metadata".to_string(),
            path: lfs_file_path.display().to_string(),
            reason: e.to_string(),
        })?;

        let modified_time = metadata
            .modified()
            .unwrap_or(SystemTime::UNIX_EPOCH)
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Calculate checksum
        let contents = fs::read(&lfs_file_path).map_err(|e| VisualError::FileSystemError {
            operation: "read_lfs_file_for_checksum".to_string(),
            path: lfs_file_path.display().to_string(),
            reason: e.to_string(),
        })?;
        
        let mut hasher = Sha256::new();
        hasher.update(&contents);
        let checksum = format!("{:x}", hasher.finalize());

        let file_type = lfs_file_path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("unknown")
            .to_string();

        Ok(FileMetadata {
            size_bytes: metadata.len(),
            modified_time,
            checksum,
            file_type,
        })
    }

    /// Migrate files from local storage to LFS
    pub fn migrate_from_local(&self, local_storage: &LocalFileStorage) -> VisualResult<MigrationReport> {
        let mut report = MigrationReport::new();
        
        // Get list of baseline files from local storage
        let baseline_files = local_storage.list_files("baselines")?;
        
        for file_name in baseline_files {
            // Load from local storage
            match local_storage.load_baseline(&file_name) {
                Ok(image) => {
                    // Save to LFS
                    match self.save_baseline(&image, &file_name) {
                        Ok(_) => {
                            report.migrated_files.push(file_name.clone());
                            report.total_migrated_bytes += local_storage
                                .get_metadata(&format!("baselines/{}", file_name))
                                .map(|m| m.size_bytes)
                                .unwrap_or(0);
                        }
                        Err(e) => {
                            report.failed_files.push((file_name.clone(), e.to_string()));
                        }
                    }
                }
                Err(e) => {
                    report.failed_files.push((file_name.clone(), e.to_string()));
                }
            }
        }

        report.migration_completed = true;
        Ok(report)
    }
}

impl StorageBackend for GitLFSStorage {
    fn save_baseline(&self, image: &DynamicImage, path: &str) -> VisualResult<String> {
        self.save_to_lfs(image, path)
    }

    fn load_baseline(&self, path: &str) -> VisualResult<DynamicImage> {
        self.load_from_lfs(path)
    }

    fn save_result(&self, image: &DynamicImage, path: &str) -> VisualResult<String> {
        // Results are typically temporary, so save to local cache only
        let cache_path = format!("results/{}", path);
        self.local_cache.save_result(image, &cache_path)
    }

    fn load_result(&self, path: &str) -> VisualResult<DynamicImage> {
        let cache_path = format!("results/{}", path);
        self.local_cache.load_result(&cache_path)
    }

    fn cleanup_old_results(&self, retention_days: u32) -> VisualResult<()> {
        // Clean up local cache only (LFS baselines are preserved)
        self.local_cache.cleanup_old_results(retention_days)
    }

    fn get_storage_usage(&self) -> VisualResult<StorageUsage> {
        let mut usage = self.local_cache.get_storage_usage()?;
        
        // Add LFS storage usage
        let lfs_size = self.calculate_lfs_directory_size()?;
        usage.total_size_bytes += lfs_size;
        usage.category_sizes.insert("lfs_baselines".to_string(), lfs_size);
        
        Ok(usage)
    }

    fn exists(&self, path: &str) -> bool {
        self.lfs_file_exists(path) || self.local_cache.exists(&self.get_cache_path(path))
    }

    fn delete(&self, path: &str) -> VisualResult<()> {
        let lfs_file_path = self.get_lfs_path(path);
        
        if lfs_file_path.exists() {
            fs::remove_file(&lfs_file_path).map_err(|e| VisualError::FileSystemError {
                operation: "delete_lfs_file".to_string(),
                path: lfs_file_path.display().to_string(),
                reason: e.to_string(),
            })?;
        }

        // Also remove from cache
        let cache_path = self.get_cache_path(path);
        let _ = self.local_cache.delete(&cache_path);

        Ok(())
    }

    fn list_files(&self, directory: &str) -> VisualResult<Vec<String>> {
        let lfs_dir_path = self.lfs_path.join(directory);
        
        if !lfs_dir_path.exists() {
            return Ok(Vec::new());
        }

        let entries = fs::read_dir(&lfs_dir_path).map_err(|e| VisualError::FileSystemError {
            operation: "read_lfs_directory".to_string(),
            path: lfs_dir_path.display().to_string(),
            reason: e.to_string(),
        })?;

        let mut files = Vec::new();
        for entry in entries {
            let entry = entry.map_err(|e| VisualError::FileSystemError {
                operation: "read_lfs_directory_entry".to_string(),
                path: lfs_dir_path.display().to_string(),
                reason: e.to_string(),
            })?;

            if entry.path().is_file() {
                if let Some(filename) = entry.file_name().to_str() {
                    files.push(filename.to_string());
                }
            }
        }

        files.sort();
        Ok(files)
    }

    fn get_metadata(&self, path: &str) -> VisualResult<FileMetadata> {
        self.get_lfs_metadata(path)
    }
}

impl GitLFSStorage {
    /// Calculate the total size of LFS directory
    fn calculate_lfs_directory_size(&self) -> VisualResult<u64> {
        let mut total_size = 0u64;

        if !self.lfs_path.exists() {
            return Ok(0);
        }

        let entries = fs::read_dir(&self.lfs_path).map_err(|e| VisualError::FileSystemError {
            operation: "read_lfs_directory_for_size".to_string(),
            path: self.lfs_path.display().to_string(),
            reason: e.to_string(),
        })?;

        for entry in entries {
            let entry = entry.map_err(|e| VisualError::FileSystemError {
                operation: "read_lfs_directory_entry_for_size".to_string(),
                path: self.lfs_path.display().to_string(),
                reason: e.to_string(),
            })?;

            let path = entry.path();
            
            if path.is_file() {
                let metadata = fs::metadata(&path).map_err(|e| VisualError::FileSystemError {
                    operation: "get_lfs_file_metadata_for_size".to_string(),
                    path: path.display().to_string(),
                    reason: e.to_string(),
                })?;
                total_size += metadata.len();
            } else if path.is_dir() {
                // Recursively calculate subdirectory sizes
                total_size += self.calculate_subdirectory_size(&path)?;
            }
        }

        Ok(total_size)
    }

    /// Calculate size of a subdirectory recursively
    fn calculate_subdirectory_size(&self, dir_path: &Path) -> VisualResult<u64> {
        let mut total_size = 0u64;

        let entries = fs::read_dir(dir_path).map_err(|e| VisualError::FileSystemError {
            operation: "read_subdirectory_for_size".to_string(),
            path: dir_path.display().to_string(),
            reason: e.to_string(),
        })?;

        for entry in entries {
            let entry = entry.map_err(|e| VisualError::FileSystemError {
                operation: "read_subdirectory_entry_for_size".to_string(),
                path: dir_path.display().to_string(),
                reason: e.to_string(),
            })?;

            let path = entry.path();
            
            if path.is_file() {
                let metadata = fs::metadata(&path).map_err(|e| VisualError::FileSystemError {
                    operation: "get_subdirectory_file_metadata_for_size".to_string(),
                    path: path.display().to_string(),
                    reason: e.to_string(),
                })?;
                total_size += metadata.len();
            } else if path.is_dir() {
                total_size += self.calculate_subdirectory_size(&path)?;
            }
        }

        Ok(total_size)
    }
}

/// Cloud storage provider enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CloudProvider {
    AWS,
    MinIO,
    // Future: GCP, Azure, etc.
}

/// Cloud storage credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudCredentials {
    pub access_key_id: String,
    pub secret_access_key: String,
    pub region: String,
    pub endpoint_url: Option<String>, // For MinIO or custom S3-compatible services
}

/// Cloud storage configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudStorageConfig {
    pub provider: CloudProvider,
    pub bucket_name: String,
    pub credentials: CloudCredentials,
    pub prefix: String, // Path prefix for all files
    pub enable_encryption: bool,
    pub multipart_threshold_mb: u64, // Files larger than this use multipart upload
}

/// Cloud storage backend implementation
#[derive(Debug)]
pub struct CloudStorage {
    config: CloudStorageConfig,
    local_cache: LocalFileStorage,
    s3_client: Option<aws_sdk_s3::Client>,
}

impl CloudStorage {
    /// Create a new cloud storage backend
    pub async fn new(config: CloudStorageConfig, cache_size_mb: u64) -> VisualResult<Self> {
        // Create local cache
        let cache_path = PathBuf::from(".vrt").join("cloud_cache");
        let local_cache = LocalFileStorage::new(&cache_path, cache_size_mb)?;

        let mut storage = Self {
            config,
            local_cache,
            s3_client: None,
        };

        // Initialize S3 client
        storage.initialize_s3_client().await?;

        Ok(storage)
    }

    /// Initialize S3 client based on provider
    async fn initialize_s3_client(&mut self) -> VisualResult<()> {
        use aws_config::BehaviorVersion;
        use aws_credential_types::Credentials;
        
        let credentials = Credentials::new(
            &self.config.credentials.access_key_id,
            &self.config.credentials.secret_access_key,
            None,
            None,
            "visual-regression-testing",
        );

        let mut config_builder = aws_config::defaults(BehaviorVersion::latest())
            .credentials_provider(credentials)
            .region(aws_config::Region::new(self.config.credentials.region.clone()));

        // Set custom endpoint for MinIO or other S3-compatible services
        if let Some(endpoint_url) = &self.config.credentials.endpoint_url {
            config_builder = config_builder.endpoint_url(endpoint_url);
        }

        let aws_config = config_builder.load().await;
        self.s3_client = Some(aws_sdk_s3::Client::new(&aws_config));

        Ok(())
    }

    /// Get S3 key for a given path
    fn get_s3_key(&self, path: &str) -> String {
        if self.config.prefix.is_empty() {
            path.to_string()
        } else {
            format!("{}/{}", self.config.prefix, path)
        }
    }

    /// Get cache path for a given S3 key
    fn get_cache_path(&self, path: &str) -> String {
        format!("cloud_cache/{}", path)
    }

    /// Upload image to S3
    async fn upload_to_s3(&self, image: &DynamicImage, s3_key: &str) -> VisualResult<String> {
        let client = self.s3_client.as_ref().ok_or_else(|| VisualError::ConfigurationError {
            field: "s3_client".to_string(),
            reason: "S3 client not initialized".to_string(),
        })?;

        // Convert image to bytes
        let mut image_bytes = Vec::new();
        image.write_to(&mut std::io::Cursor::new(&mut image_bytes), image::ImageFormat::Png)
            .map_err(|e| VisualError::ImageSaveError {
                path: s3_key.to_string(),
                reason: e.to_string(),
            })?;

        // Upload to S3
        let put_object = client
            .put_object()
            .bucket(&self.config.bucket_name)
            .key(s3_key)
            .body(aws_sdk_s3::primitives::ByteStream::from(image_bytes))
            .content_type("image/png");

        let put_object = if self.config.enable_encryption {
            put_object.server_side_encryption(aws_sdk_s3::types::ServerSideEncryption::Aes256)
        } else {
            put_object
        };

        put_object.send().await.map_err(|e| VisualError::NetworkError {
            operation: "s3_upload".to_string(),
            reason: e.to_string(),
        })?;

        Ok(format!("s3://{}/{}", self.config.bucket_name, s3_key))
    }

    /// Download image from S3
    async fn download_from_s3(&self, s3_key: &str) -> VisualResult<DynamicImage> {
        let client = self.s3_client.as_ref().ok_or_else(|| VisualError::ConfigurationError {
            field: "s3_client".to_string(),
            reason: "S3 client not initialized".to_string(),
        })?;

        // Download from S3
        let get_object = client
            .get_object()
            .bucket(&self.config.bucket_name)
            .key(s3_key)
            .send()
            .await
            .map_err(|e| VisualError::NetworkError {
                operation: "s3_download".to_string(),
                reason: e.to_string(),
            })?;

        // Convert bytes to image
        let body_bytes = get_object.body.collect().await.map_err(|e| VisualError::NetworkError {
            operation: "s3_download_body".to_string(),
            reason: e.to_string(),
        })?;

        let image = image::load_from_memory(&body_bytes.into_bytes()).map_err(|e| VisualError::ImageLoadError {
            path: s3_key.to_string(),
            reason: e.to_string(),
        })?;

        Ok(image)
    }

    /// Check if S3 object exists
    async fn s3_object_exists(&self, s3_key: &str) -> bool {
        let client = match self.s3_client.as_ref() {
            Some(client) => client,
            None => return false,
        };

        client
            .head_object()
            .bucket(&self.config.bucket_name)
            .key(s3_key)
            .send()
            .await
            .is_ok()
    }

    /// Save image with cloud storage and local cache
    async fn save_to_cloud(&self, image: &DynamicImage, path: &str, is_baseline: bool) -> VisualResult<String> {
        let s3_key = self.get_s3_key(path);
        
        // Upload to S3
        let s3_url = self.upload_to_s3(image, &s3_key).await?;

        // Also save to local cache for faster access
        let cache_path = self.get_cache_path(path);
        if is_baseline {
            let _ = self.local_cache.save_baseline(image, &cache_path);
        } else {
            let _ = self.local_cache.save_result(image, &cache_path);
        }

        Ok(s3_url)
    }

    /// Load image from cache first, then S3
    async fn load_from_cloud(&self, path: &str, is_baseline: bool) -> VisualResult<DynamicImage> {
        let cache_path = self.get_cache_path(path);
        
        // Try cache first
        let cache_result = if is_baseline {
            self.local_cache.load_baseline(&cache_path)
        } else {
            self.local_cache.load_result(&cache_path)
        };

        if let Ok(image) = cache_result {
            return Ok(image);
        }

        // Load from S3
        let s3_key = self.get_s3_key(path);
        let image = self.download_from_s3(&s3_key).await?;

        // Update cache for next time
        if is_baseline {
            let _ = self.local_cache.save_baseline(&image, &cache_path);
        } else {
            let _ = self.local_cache.save_result(&image, &cache_path);
        }

        Ok(image)
    }

    /// Migrate files from local storage to cloud
    pub async fn migrate_from_local(&self, local_storage: &LocalFileStorage) -> VisualResult<MigrationReport> {
        let mut report = MigrationReport::new();
        
        // Get list of baseline files from local storage
        let baseline_files = local_storage.list_files("baselines")?;
        
        for file_name in baseline_files {
            // Load from local storage
            match local_storage.load_baseline(&file_name) {
                Ok(image) => {
                    // Save to cloud
                    match self.save_to_cloud(&image, &file_name, true).await {
                        Ok(_) => {
                            report.migrated_files.push(file_name.clone());
                            report.total_migrated_bytes += local_storage
                                .get_metadata(&format!("baselines/{}", file_name))
                                .map(|m| m.size_bytes)
                                .unwrap_or(0);
                        }
                        Err(e) => {
                            report.failed_files.push((file_name.clone(), e.to_string()));
                        }
                    }
                }
                Err(e) => {
                    report.failed_files.push((file_name.clone(), e.to_string()));
                }
            }
        }

        report.migration_completed = true;
        Ok(report)
    }
}

impl StorageBackend for CloudStorage {
    fn save_baseline(&self, image: &DynamicImage, path: &str) -> VisualResult<String> {
        // Use tokio::task::block_in_place to run async code in sync context
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                self.save_to_cloud(image, path, true).await
            })
        })
    }

    fn load_baseline(&self, path: &str) -> VisualResult<DynamicImage> {
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                self.load_from_cloud(path, true).await
            })
        })
    }

    fn save_result(&self, image: &DynamicImage, path: &str) -> VisualResult<String> {
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                self.save_to_cloud(image, path, false).await
            })
        })
    }

    fn load_result(&self, path: &str) -> VisualResult<DynamicImage> {
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                self.load_from_cloud(path, false).await
            })
        })
    }

    fn cleanup_old_results(&self, retention_days: u32) -> VisualResult<()> {
        // Clean up local cache only (cloud storage cleanup would require listing and deleting objects)
        self.local_cache.cleanup_old_results(retention_days)
    }

    fn get_storage_usage(&self) -> VisualResult<StorageUsage> {
        // For now, return local cache usage only
        // In a full implementation, we'd query S3 for bucket usage
        let mut usage = self.local_cache.get_storage_usage()?;
        usage.category_sizes.insert("cloud_cache".to_string(), usage.total_size_bytes);
        Ok(usage)
    }

    fn exists(&self, path: &str) -> bool {
        // Check cache first, then S3
        let cache_path = self.get_cache_path(path);
        if self.local_cache.exists(&cache_path) {
            return true;
        }

        // Check S3 (this is expensive, so we rely on cache mostly)
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                let s3_key = self.get_s3_key(path);
                self.s3_object_exists(&s3_key).await
            })
        })
    }

    fn delete(&self, path: &str) -> VisualResult<()> {
        // Delete from cache
        let cache_path = self.get_cache_path(path);
        let _ = self.local_cache.delete(&cache_path);

        // Delete from S3
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                let client = self.s3_client.as_ref().ok_or_else(|| VisualError::ConfigurationError {
                    field: "s3_client".to_string(),
                    reason: "S3 client not initialized".to_string(),
                })?;

                let s3_key = self.get_s3_key(path);
                client
                    .delete_object()
                    .bucket(&self.config.bucket_name)
                    .key(&s3_key)
                    .send()
                    .await
                    .map_err(|e| VisualError::NetworkError {
                        operation: "s3_delete".to_string(),
                        reason: e.to_string(),
                    })?;

                Ok(())
            })
        })
    }

    fn list_files(&self, directory: &str) -> VisualResult<Vec<String>> {
        // For simplicity, return cached files only
        // In a full implementation, we'd list S3 objects with the directory prefix
        self.local_cache.list_files(&format!("cloud_cache/{}", directory))
    }

    fn get_metadata(&self, path: &str) -> VisualResult<FileMetadata> {
        // Try cache first
        let cache_path = self.get_cache_path(path);
        if let Ok(metadata) = self.local_cache.get_metadata(&cache_path) {
            return Ok(metadata);
        }

        // Get metadata from S3
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                let client = self.s3_client.as_ref().ok_or_else(|| VisualError::ConfigurationError {
                    field: "s3_client".to_string(),
                    reason: "S3 client not initialized".to_string(),
                })?;

                let s3_key = self.get_s3_key(path);
                let head_object = client
                    .head_object()
                    .bucket(&self.config.bucket_name)
                    .key(&s3_key)
                    .send()
                    .await
                    .map_err(|e| VisualError::NetworkError {
                        operation: "s3_head_object".to_string(),
                        reason: e.to_string(),
                    })?;

                let size_bytes = head_object.content_length().unwrap_or(0) as u64;
                let modified_time = head_object
                    .last_modified()
                    .map(|dt| dt.secs() as u64)
                    .unwrap_or(0);

                let checksum = head_object
                    .e_tag()
                    .unwrap_or("unknown")
                    .trim_matches('"')
                    .to_string();

                let file_type = Path::new(path)
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                Ok(FileMetadata {
                    size_bytes,
                    modified_time,
                    checksum,
                    file_type,
                })
            })
        })
    }
}

/// Migration report for storage backend transitions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationReport {
    pub migration_completed: bool,
    pub migrated_files: Vec<String>,
    pub failed_files: Vec<(String, String)>, // (filename, error)
    pub total_migrated_bytes: u64,
    pub migration_start_time: u64,
    pub migration_end_time: Option<u64>,
}

impl MigrationReport {
    pub fn new() -> Self {
        Self {
            migration_completed: false,
            migrated_files: Vec::new(),
            failed_files: Vec::new(),
            total_migrated_bytes: 0,
            migration_start_time: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            migration_end_time: None,
        }
    }

    pub fn complete(&mut self) {
        self.migration_completed = true;
        self.migration_end_time = Some(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        );
    }

    pub fn success_rate(&self) -> f64 {
        let total_files = self.migrated_files.len() + self.failed_files.len();
        if total_files == 0 {
            return 1.0;
        }
        self.migrated_files.len() as f64 / total_files as f64
    }

    pub fn total_migrated_mb(&self) -> f64 {
        self.total_migrated_bytes as f64 / (1024.0 * 1024.0)
    }
}

/// Asset manager that coordinates multiple storage backends
pub struct AssetManager {
    /// Primary storage backend
    primary_backend: Box<dyn StorageBackend>,
    /// Optional fallback backend
    fallback_backend: Option<Box<dyn StorageBackend>>,
    /// Compression configuration
    compression_config: CompressionConfig,
}

impl AssetManager {
    /// Create a new asset manager with a primary backend
    pub fn new(primary_backend: Box<dyn StorageBackend>) -> Self {
        Self {
            primary_backend,
            fallback_backend: None,
            compression_config: CompressionConfig::default(),
        }
    }

    /// Add a fallback backend
    pub fn with_fallback(mut self, fallback_backend: Box<dyn StorageBackend>) -> Self {
        self.fallback_backend = Some(fallback_backend);
        self
    }

    /// Set compression configuration
    pub fn with_compression_config(mut self, config: CompressionConfig) -> Self {
        self.compression_config = config;
        self
    }

    /// Switch to a new primary backend with migration
    pub fn migrate_to_backend(&mut self, new_backend: Box<dyn StorageBackend>) -> VisualResult<MigrationReport> {
        let mut report = MigrationReport::new();
        
        // Get list of baseline files from current primary backend
        let baseline_files = self.primary_backend.list_files("baselines")?;
        
        for file_name in baseline_files {
            // Load from current backend
            match self.primary_backend.load_baseline(&file_name) {
                Ok(image) => {
                    // Save to new backend
                    match new_backend.save_baseline(&image, &file_name) {
                        Ok(_) => {
                            report.migrated_files.push(file_name.clone());
                            if let Ok(metadata) = self.primary_backend.get_metadata(&format!("baselines/{}", file_name)) {
                                report.total_migrated_bytes += metadata.size_bytes;
                            }
                        }
                        Err(e) => {
                            report.failed_files.push((file_name.clone(), e.to_string()));
                        }
                    }
                }
                Err(e) => {
                    report.failed_files.push((file_name.clone(), e.to_string()));
                }
            }
        }

        // If migration was successful, switch backends
        if report.failed_files.is_empty() {
            self.fallback_backend = Some(std::mem::replace(&mut self.primary_backend, new_backend));
            report.complete();
        }

        Ok(report)
    }

    /// Save image with compression and optimization
    pub fn save_with_compression(&self, image: &DynamicImage, path: &str, is_baseline: bool) -> VisualResult<String> {
        let result = if is_baseline {
            self.primary_backend.save_baseline(image, path)
        } else {
            self.primary_backend.save_result(image, path)
        };

        // Try fallback if primary fails
        if result.is_err() && self.fallback_backend.is_some() {
            let fallback = self.fallback_backend.as_ref().unwrap();
            if is_baseline {
                fallback.save_baseline(image, path)
            } else {
                fallback.save_result(image, path)
            }
        } else {
            result
        }
    }

    /// Load image with fallback support
    pub fn load_image(&self, path: &str, is_baseline: bool) -> VisualResult<DynamicImage> {
        let result = if is_baseline {
            self.primary_backend.load_baseline(path)
        } else {
            self.primary_backend.load_result(path)
        };

        // Try fallback if primary fails
        if result.is_err() && self.fallback_backend.is_some() {
            let fallback = self.fallback_backend.as_ref().unwrap();
            if is_baseline {
                fallback.load_baseline(path)
            } else {
                fallback.load_result(path)
            }
        } else {
            result
        }
    }

    /// Get combined storage usage from all backends
    pub fn get_total_storage_usage(&self) -> VisualResult<StorageUsage> {
        let mut total_usage = self.primary_backend.get_storage_usage()?;

        if let Some(fallback) = &self.fallback_backend {
            let fallback_usage = fallback.get_storage_usage()?;
            total_usage.total_size_bytes += fallback_usage.total_size_bytes;
            total_usage.file_count += fallback_usage.file_count;
            
            // Merge category sizes
            for (category, size) in fallback_usage.category_sizes {
                *total_usage.category_sizes.entry(category).or_insert(0) += size;
            }
        }

        Ok(total_usage)
    }

    /// Clean up old results from all backends
    pub fn cleanup_all_backends(&self, retention_days: u32) -> VisualResult<()> {
        self.primary_backend.cleanup_old_results(retention_days)?;
        
        if let Some(fallback) = &self.fallback_backend {
            fallback.cleanup_old_results(retention_days)?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_image() -> DynamicImage {
        DynamicImage::new_rgb8(100, 100)
    }

    #[test]
    fn test_local_storage_creation() {
        let temp_dir = TempDir::new().unwrap();
        let storage = LocalFileStorage::new(temp_dir.path(), 100).unwrap();
        
        // Check that subdirectories were created
        assert!(temp_dir.path().join("baselines").exists());
        assert!(temp_dir.path().join("results").exists());
        assert!(temp_dir.path().join("thumbnails").exists());
        assert!(temp_dir.path().join("temp").exists());
    }

    #[test]
    fn test_baseline_save_and_load() {
        let temp_dir = TempDir::new().unwrap();
        let storage = LocalFileStorage::new(temp_dir.path(), 100).unwrap();
        let test_image = create_test_image();
        
        // Save baseline
        let saved_path = storage.save_baseline(&test_image, "test_baseline.png").unwrap();
        assert!(!saved_path.is_empty());
        
        // Load baseline
        let loaded_image = storage.load_baseline("test_baseline.png").unwrap();
        assert_eq!(loaded_image.width(), test_image.width());
        assert_eq!(loaded_image.height(), test_image.height());
    }

    #[test]
    fn test_result_save_and_load() {
        let temp_dir = TempDir::new().unwrap();
        let storage = LocalFileStorage::new(temp_dir.path(), 100).unwrap();
        let test_image = create_test_image();
        
        // Save result
        let saved_path = storage.save_result(&test_image, "test_result.png").unwrap();
        assert!(!saved_path.is_empty());
        
        // Load result
        let loaded_image = storage.load_result("test_result.png").unwrap();
        assert_eq!(loaded_image.width(), test_image.width());
        assert_eq!(loaded_image.height(), test_image.height());
    }

    #[test]
    fn test_storage_usage() {
        let temp_dir = TempDir::new().unwrap();
        let storage = LocalFileStorage::new(temp_dir.path(), 100).unwrap();
        let test_image = create_test_image();
        
        // Save some files
        storage.save_baseline(&test_image, "baseline1.png").unwrap();
        storage.save_result(&test_image, "result1.png").unwrap();
        
        let usage = storage.get_storage_usage().unwrap();
        assert!(usage.total_size_bytes > 0);
        assert!(usage.file_count >= 2); // At least baseline and result
    }

    #[test]
    fn test_file_operations() {
        let temp_dir = TempDir::new().unwrap();
        let storage = LocalFileStorage::new(temp_dir.path(), 100).unwrap();
        let test_image = create_test_image();
        
        // Save and check existence
        storage.save_baseline(&test_image, "test.png").unwrap();
        assert!(storage.exists("baselines/test.png"));
        
        // Get metadata
        let metadata = storage.get_metadata("baselines/test.png").unwrap();
        assert!(metadata.size_bytes > 0);
        assert!(!metadata.checksum.is_empty());
        
        // Delete and check
        storage.delete("baselines/test.png").unwrap();
        assert!(!storage.exists("baselines/test.png"));
    }

    #[test]
    fn test_asset_manager() {
        let temp_dir = TempDir::new().unwrap();
        let primary_storage = Box::new(LocalFileStorage::new(temp_dir.path(), 100).unwrap());
        let manager = AssetManager::new(primary_storage);
        
        let test_image = create_test_image();
        
        // Test save and load through manager
        let saved_path = manager.save_with_compression(&test_image, "test.png", true).unwrap();
        assert!(!saved_path.is_empty());
        
        let loaded_image = manager.load_image("test.png", true).unwrap();
        assert_eq!(loaded_image.width(), test_image.width());
        assert_eq!(loaded_image.height(), test_image.height());
    }

    #[test]
    fn test_git_lfs_config() {
        let config = GitLFSConfig::default();
        assert_eq!(config.repo_path, PathBuf::from("."));
        assert!(config.track_patterns.contains(&"*.png".to_string()));
        assert!(config.track_patterns.contains(&"*.jpg".to_string()));
        assert_eq!(config.max_file_size_mb, 10);
        assert!(config.auto_track);
    }

    #[test]
    fn test_git_lfs_storage_creation_without_git() {
        let temp_dir = TempDir::new().unwrap();
        let lfs_config = GitLFSConfig {
            repo_path: temp_dir.path().to_path_buf(),
            ..GitLFSConfig::default()
        };
        
        // Should fail because it's not a git repository
        let result = GitLFSStorage::new(lfs_config, 100);
        assert!(result.is_err());
        
        if let Err(VisualError::ConfigurationError { field, reason }) = result {
            assert_eq!(field, "repo_path");
            assert!(reason.contains("Not a git repository"));
        } else {
            panic!("Expected ConfigurationError");
        }
    }

    #[test]
    fn test_migration_report() {
        let mut report = MigrationReport::new();
        assert!(!report.migration_completed);
        assert_eq!(report.migrated_files.len(), 0);
        assert_eq!(report.failed_files.len(), 0);
        assert_eq!(report.success_rate(), 1.0);
        
        report.migrated_files.push("file1.png".to_string());
        report.failed_files.push(("file2.png".to_string(), "error".to_string()));
        assert_eq!(report.success_rate(), 0.5);
        
        report.complete();
        assert!(report.migration_completed);
        assert!(report.migration_end_time.is_some());
    }

    #[test]
    fn test_cloud_storage_config() {
        let credentials = CloudCredentials {
            access_key_id: "test_key".to_string(),
            secret_access_key: "test_secret".to_string(),
            region: "us-east-1".to_string(),
            endpoint_url: Some("http://localhost:9000".to_string()),
        };
        
        let config = CloudStorageConfig {
            provider: CloudProvider::MinIO,
            bucket_name: "test-bucket".to_string(),
            credentials,
            prefix: "vrt".to_string(),
            enable_encryption: false,
            multipart_threshold_mb: 100,
        };
        
        assert!(matches!(config.provider, CloudProvider::MinIO));
        assert_eq!(config.bucket_name, "test-bucket");
        assert_eq!(config.prefix, "vrt");
        assert!(!config.enable_encryption);
    }

    #[tokio::test]
    async fn test_cloud_storage_creation_with_invalid_credentials() {
        let credentials = CloudCredentials {
            access_key_id: "invalid_key".to_string(),
            secret_access_key: "invalid_secret".to_string(),
            region: "us-east-1".to_string(),
            endpoint_url: Some("http://invalid-endpoint:9000".to_string()),
        };
        
        let config = CloudStorageConfig {
            provider: CloudProvider::MinIO,
            bucket_name: "test-bucket".to_string(),
            credentials,
            prefix: "vrt".to_string(),
            enable_encryption: false,
            multipart_threshold_mb: 100,
        };
        
        // Should create successfully (credentials are not validated during creation)
        let result = CloudStorage::new(config, 100).await;
        assert!(result.is_ok());
    }

    #[test]
    fn test_asset_manager_migration() {
        let temp_dir1 = TempDir::new().unwrap();
        let temp_dir2 = TempDir::new().unwrap();
        
        let primary_storage = Box::new(LocalFileStorage::new(temp_dir1.path(), 100).unwrap());
        let mut manager = AssetManager::new(primary_storage);
        
        let test_image = create_test_image();
        
        // Save image to primary backend
        manager.save_with_compression(&test_image, "test.png", true).unwrap();
        
        // Create new backend for migration
        let new_backend = Box::new(LocalFileStorage::new(temp_dir2.path(), 100).unwrap());
        
        // Migrate to new backend
        let report = manager.migrate_to_backend(new_backend).unwrap();
        
        assert!(report.migration_completed);
        assert_eq!(report.migrated_files.len(), 1);
        assert_eq!(report.failed_files.len(), 0);
        assert!(report.total_migrated_bytes > 0);
        
        // Verify image can be loaded from new backend
        let loaded_image = manager.load_image("test.png", true).unwrap();
        assert_eq!(loaded_image.width(), test_image.width());
        assert_eq!(loaded_image.height(), test_image.height());
    }
}
