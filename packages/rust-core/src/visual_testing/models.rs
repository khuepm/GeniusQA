//! Core data models and types for visual regression testing

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents a rectangular region in an image
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct Region {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

impl Region {
    /// Create a new region
    pub fn new(x: u32, y: u32, width: u32, height: u32) -> Self {
        Self { x, y, width, height }
    }

    /// Check if the region is valid (non-zero dimensions)
    pub fn is_valid(&self) -> bool {
        self.width > 0 && self.height > 0
    }

    /// Check if the region fits within the given image dimensions
    pub fn fits_within(&self, image_width: u32, image_height: u32) -> bool {
        self.x + self.width <= image_width && self.y + self.height <= image_height
    }

    /// Get the area of the region
    pub fn area(&self) -> u64 {
        self.width as u64 * self.height as u64
    }
}

/// Comparison methods available for visual regression testing
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum ComparisonMethod {
    /// Strict pixel-by-pixel comparison
    PixelMatch,
    /// Structural Similarity Index
    SSIM,
    /// Smart comparison with shift tolerance
    LayoutAware,
    /// Combination of methods
    Hybrid,
}

impl Default for ComparisonMethod {
    fn default() -> Self {
        ComparisonMethod::PixelMatch
    }
}

/// Sensitivity profiles for comparison tolerance
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum SensitivityProfile {
    /// threshold: 0.001, no tolerance
    Strict,
    /// threshold: 0.01, 1px shift tolerance
    Moderate,
    /// threshold: 0.05, 2px shift tolerance, anti-aliasing
    Flexible,
}

impl Default for SensitivityProfile {
    fn default() -> Self {
        SensitivityProfile::Moderate
    }
}

impl SensitivityProfile {
    /// Get the default threshold for this sensitivity profile
    pub fn default_threshold(&self) -> f32 {
        match self {
            SensitivityProfile::Strict => 0.001,
            SensitivityProfile::Moderate => 0.01,
            SensitivityProfile::Flexible => 0.05,
        }
    }

    /// Get the default layout shift tolerance for this profile
    pub fn default_shift_tolerance(&self) -> u32 {
        match self {
            SensitivityProfile::Strict => 0,
            SensitivityProfile::Moderate => 1,
            SensitivityProfile::Flexible => 2,
        }
    }

    /// Check if anti-aliasing tolerance is enabled for this profile
    pub fn has_anti_aliasing_tolerance(&self) -> bool {
        matches!(self, SensitivityProfile::Flexible)
    }
}

/// Configuration for image comparison operations
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ComparisonConfig {
    /// Threshold for pass/fail determination (0.0 to 1.0)
    pub threshold: f32,
    /// Comparison method to use
    pub method: ComparisonMethod,
    /// Areas to exclude from comparison
    pub ignore_regions: Vec<Region>,
    /// Specific area to compare (None = full image)
    pub include_roi: Option<Region>,
    /// Handle font rendering differences
    pub anti_aliasing_tolerance: bool,
    /// Pixels of acceptable shift (1-2px)
    pub layout_shift_tolerance: u32,
    /// Sensitivity profile
    pub sensitivity_profile: SensitivityProfile,
}

impl Default for ComparisonConfig {
    fn default() -> Self {
        let profile = SensitivityProfile::default();
        Self {
            threshold: profile.default_threshold(),
            method: ComparisonMethod::default(),
            ignore_regions: Vec::new(),
            include_roi: None,
            anti_aliasing_tolerance: profile.has_anti_aliasing_tolerance(),
            layout_shift_tolerance: profile.default_shift_tolerance(),
            sensitivity_profile: profile,
        }
    }
}

impl ComparisonConfig {
    /// Create a new comparison config with the given sensitivity profile
    pub fn with_profile(profile: SensitivityProfile) -> Self {
        Self {
            threshold: profile.default_threshold(),
            method: match profile {
                SensitivityProfile::Strict => ComparisonMethod::PixelMatch,
                SensitivityProfile::Moderate => ComparisonMethod::LayoutAware,
                SensitivityProfile::Flexible => ComparisonMethod::SSIM,
            },
            anti_aliasing_tolerance: profile.has_anti_aliasing_tolerance(),
            layout_shift_tolerance: profile.default_shift_tolerance(),
            sensitivity_profile: profile,
            ..Default::default()
        }
    }

    /// Validate the configuration
    pub fn validate(&self) -> Result<(), String> {
        if self.threshold < 0.0 || self.threshold > 1.0 {
            return Err(format!("Threshold must be between 0.0 and 1.0, got {}", self.threshold));
        }

        for region in &self.ignore_regions {
            if !region.is_valid() {
                return Err(format!("Invalid ignore region: {:?}", region));
            }
        }

        if let Some(roi) = &self.include_roi {
            if !roi.is_valid() {
                return Err(format!("Invalid ROI: {:?}", roi));
            }
        }

        Ok(())
    }
}

/// Types of differences that can be detected
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub enum DifferenceType {
    /// No significant changes detected
    NoChange,
    /// Layout elements shifted position
    LayoutShift,
    /// Content or text changed
    ContentChange,
    /// Color variations detected
    ColorVariation,
    /// Image dimensions don't match
    DimensionMismatch,
}

/// Performance metrics for comparison operations
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PerformanceMetrics {
    /// Time taken to capture screenshot (ms)
    pub capture_time_ms: u32,
    /// Time taken for image preprocessing (ms)
    pub preprocessing_time_ms: u32,
    /// Time taken for actual comparison (ms)
    pub comparison_time_ms: u32,
    /// Time taken for post-processing (diff generation) (ms)
    pub postprocessing_time_ms: u32,
    /// Memory usage during operation (MB)
    pub memory_usage_mb: u32,
    /// Dimensions of processed images
    pub image_dimensions: (u32, u32),
}

impl Default for PerformanceMetrics {
    fn default() -> Self {
        Self {
            capture_time_ms: 0,
            preprocessing_time_ms: 0,
            comparison_time_ms: 0,
            postprocessing_time_ms: 0,
            memory_usage_mb: 0,
            image_dimensions: (0, 0),
        }
    }
}

impl PerformanceMetrics {
    /// Get the total time for the operation
    pub fn total_time_ms(&self) -> u32 {
        self.capture_time_ms + self.preprocessing_time_ms + self.comparison_time_ms + self.postprocessing_time_ms
    }

    /// Check if the operation meets performance requirements
    pub fn meets_performance_requirements(&self) -> bool {
        // For 1920x1080 images, comparison should complete within 200ms
        let (width, height) = self.image_dimensions;
        let pixel_count = width as u64 * height as u64;
        let hd_pixel_count = 1920u64 * 1080u64;
        
        if pixel_count <= hd_pixel_count {
            self.comparison_time_ms <= 200
        } else {
            // Scale requirement based on pixel count
            let scale_factor = pixel_count as f64 / hd_pixel_count as f64;
            let max_time = (200.0 * scale_factor) as u32;
            self.comparison_time_ms <= max_time
        }
    }
}

/// Result of a visual comparison operation
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ComparisonResult {
    /// Whether the images match within the threshold
    pub is_match: bool,
    /// Percentage of pixels that differ (0.0 to 1.0)
    pub mismatch_percentage: f32,
    /// Type of difference detected
    pub difference_type: DifferenceType,
    /// Path to generated diff image (if any)
    pub diff_image_path: Option<String>,
    /// Path to baseline image
    pub baseline_path: String,
    /// Path to actual image
    pub actual_path: String,
    /// Performance metrics for the operation
    pub performance_metrics: PerformanceMetrics,
    /// Additional metadata
    pub metadata: HashMap<String, String>,
}

impl ComparisonResult {
    /// Create a new comparison result
    pub fn new(
        is_match: bool,
        mismatch_percentage: f32,
        difference_type: DifferenceType,
        baseline_path: String,
        actual_path: String,
    ) -> Self {
        Self {
            is_match,
            mismatch_percentage,
            difference_type,
            diff_image_path: None,
            baseline_path,
            actual_path,
            performance_metrics: PerformanceMetrics::default(),
            metadata: HashMap::new(),
        }
    }

    /// Set the diff image path
    pub fn with_diff_image(mut self, path: String) -> Self {
        self.diff_image_path = Some(path);
        self
    }

    /// Set the performance metrics
    pub fn with_metrics(mut self, metrics: PerformanceMetrics) -> Self {
        self.performance_metrics = metrics;
        self
    }

    /// Add metadata
    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }
}

/// Configuration for performance requirements
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PerformanceConfig {
    /// Maximum time allowed for comparison (ms)
    pub max_comparison_time_ms: u32,
    /// Maximum memory usage allowed (MB)
    pub max_memory_usage_mb: u32,
    /// Enable parallel processing
    pub enable_parallel_processing: bool,
}

impl Default for PerformanceConfig {
    fn default() -> Self {
        Self {
            max_comparison_time_ms: 200, // 200ms for 1920x1080
            max_memory_usage_mb: 512,    // 512MB memory limit
            enable_parallel_processing: true,
        }
    }
}

/// Configuration for visual test execution
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VisualTestConfig {
    /// Unique identifier for the test action
    pub action_id: String,
    /// Path to baseline image
    pub baseline_path: String,
    /// Comparison configuration
    pub comparison: ComparisonConfig,
    /// Performance requirements
    pub performance: PerformanceConfig,
}

impl VisualTestConfig {
    /// Create a new visual test configuration
    pub fn new(action_id: String, baseline_path: String) -> Self {
        Self {
            action_id,
            baseline_path,
            comparison: ComparisonConfig::default(),
            performance: PerformanceConfig::default(),
        }
    }

    /// Validate the entire configuration
    pub fn validate(&self) -> Result<(), String> {
        if self.action_id.is_empty() {
            return Err("Action ID cannot be empty".to_string());
        }

        if self.baseline_path.is_empty() {
            return Err("Baseline path cannot be empty".to_string());
        }

        self.comparison.validate()?;

        Ok(())
    }
}
