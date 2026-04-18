//! Cross-platform rendering support and platform detection
//!
//! This module provides platform-specific tolerance adjustments, color profile
//! normalization, and automatic configuration for cross-platform visual testing.

use serde::{Deserialize, Serialize};
use std::env;

/// Supported operating system platforms
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Platform {
    Windows,
    MacOS,
    Linux,
    Unknown,
}

impl Platform {
    /// Detect the current platform
    pub fn detect() -> Self {
        #[cfg(target_os = "windows")]
        return Platform::Windows;
        
        #[cfg(target_os = "macos")]
        return Platform::MacOS;
        
        #[cfg(target_os = "linux")]
        return Platform::Linux;
        
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        return Platform::Unknown;
    }
    
    /// Get platform name as string
    pub fn name(&self) -> &'static str {
        match self {
            Platform::Windows => "windows",
            Platform::MacOS => "macos",
            Platform::Linux => "linux",
            Platform::Unknown => "unknown",
        }
    }
}

/// Platform-specific rendering configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformConfig {
    /// Current platform
    pub platform: Platform,
    /// Default DPI scaling factor
    pub default_dpi_scale: f32,
    /// Anti-aliasing tolerance for font rendering
    pub font_aa_tolerance: u8,
    /// Color profile tolerance (0-255)
    pub color_tolerance: u8,
    /// Layout shift tolerance in pixels
    pub layout_shift_tolerance: u32,
    /// Whether running in CI environment
    pub is_ci_environment: bool,
    /// Docker container detection
    pub is_docker: bool,
}

impl Default for PlatformConfig {
    fn default() -> Self {
        Self::detect()
    }
}

impl PlatformConfig {
    /// Detect and create platform configuration
    pub fn detect() -> Self {
        let platform = Platform::detect();
        let is_ci = Self::detect_ci_environment();
        let is_docker = Self::detect_docker();
        
        let (default_dpi_scale, font_aa_tolerance, color_tolerance, layout_shift_tolerance) = 
            match platform {
                Platform::Windows => (1.0, 15, 5, 1),
                Platform::MacOS => (2.0, 10, 3, 1),  // Retina displays
                Platform::Linux => (1.0, 20, 8, 2),  // More tolerance for varied configs
                Platform::Unknown => (1.0, 20, 10, 2),
            };
        
        // Increase tolerances for CI environments
        let (font_aa_tolerance, color_tolerance, layout_shift_tolerance) = if is_ci || is_docker {
            (font_aa_tolerance + 5, color_tolerance + 3, layout_shift_tolerance + 1)
        } else {
            (font_aa_tolerance, color_tolerance, layout_shift_tolerance)
        };
        
        Self {
            platform,
            default_dpi_scale,
            font_aa_tolerance,
            color_tolerance,
            layout_shift_tolerance,
            is_ci_environment: is_ci,
            is_docker,
        }
    }
    
    /// Detect if running in a CI environment
    fn detect_ci_environment() -> bool {
        // Check common CI environment variables
        env::var("CI").is_ok() ||
        env::var("CONTINUOUS_INTEGRATION").is_ok() ||
        env::var("GITHUB_ACTIONS").is_ok() ||
        env::var("GITLAB_CI").is_ok() ||
        env::var("JENKINS_URL").is_ok() ||
        env::var("TRAVIS").is_ok() ||
        env::var("CIRCLECI").is_ok() ||
        env::var("BUILDKITE").is_ok() ||
        env::var("AZURE_PIPELINES").is_ok() ||
        env::var("TF_BUILD").is_ok()
    }
    
    /// Detect if running inside a Docker container
    fn detect_docker() -> bool {
        // Check for Docker-specific files
        std::path::Path::new("/.dockerenv").exists() ||
        std::fs::read_to_string("/proc/1/cgroup")
            .map(|s| s.contains("docker") || s.contains("containerd"))
            .unwrap_or(false)
    }
    
    /// Get adjusted threshold based on platform
    pub fn adjust_threshold(&self, base_threshold: f32) -> f32 {
        let multiplier = match self.platform {
            Platform::Windows => 1.0,
            Platform::MacOS => 1.0,
            Platform::Linux => 1.2,  // Slightly more tolerant
            Platform::Unknown => 1.5,
        };
        
        let ci_multiplier = if self.is_ci_environment || self.is_docker {
            1.2  // 20% more tolerant in CI
        } else {
            1.0
        };
        
        (base_threshold * multiplier * ci_multiplier).min(1.0)
    }
}

/// Color profile for cross-platform normalization
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ColorProfile {
    SRGB,
    DisplayP3,
    AdobeRGB,
    Unknown,
}

impl Default for ColorProfile {
    fn default() -> Self {
        ColorProfile::SRGB
    }
}

/// Color normalization utilities
pub struct ColorNormalizer;

impl ColorNormalizer {
    /// Normalize RGB values from source to target color profile
    /// For now, this is a simplified implementation that handles common cases
    pub fn normalize_rgb(
        r: u8, g: u8, b: u8,
        _source: ColorProfile,
        _target: ColorProfile,
    ) -> (u8, u8, u8) {
        // Simplified normalization - in production, would use ICC profiles
        // For now, return unchanged as most displays use sRGB
        (r, g, b)
    }
    
    /// Apply gamma correction for cross-platform consistency
    pub fn apply_gamma_correction(value: u8, gamma: f32) -> u8 {
        let normalized = value as f32 / 255.0;
        let corrected = normalized.powf(gamma);
        (corrected * 255.0).round().clamp(0.0, 255.0) as u8
    }
    
    /// Check if two colors match within platform tolerance
    pub fn colors_match_with_tolerance(
        c1: (u8, u8, u8),
        c2: (u8, u8, u8),
        tolerance: u8,
    ) -> bool {
        c1.0.abs_diff(c2.0) <= tolerance &&
        c1.1.abs_diff(c2.1) <= tolerance &&
        c1.2.abs_diff(c2.2) <= tolerance
    }
}

/// DPI normalization utilities
pub struct DpiNormalizer;

impl DpiNormalizer {
    /// Calculate target dimensions after DPI normalization
    pub fn calculate_normalized_dimensions(
        width: u32,
        height: u32,
        source_dpi: f32,
        target_dpi: f32,
    ) -> (u32, u32) {
        if source_dpi == target_dpi || source_dpi <= 0.0 || target_dpi <= 0.0 {
            return (width, height);
        }
        
        let scale = target_dpi / source_dpi;
        let new_width = (width as f32 * scale).round() as u32;
        let new_height = (height as f32 * scale).round() as u32;
        
        (new_width.max(1), new_height.max(1))
    }
    
    /// Get the system DPI scale factor
    pub fn get_system_dpi_scale() -> f32 {
        // Platform-specific DPI detection
        #[cfg(target_os = "macos")]
        {
            // macOS typically uses 2x for Retina displays
            2.0
        }
        
        #[cfg(target_os = "windows")]
        {
            // Windows default is 96 DPI (1.0 scale)
            // Would need Windows API calls for actual value
            1.0
        }
        
        #[cfg(target_os = "linux")]
        {
            // Linux varies widely, default to 1.0
            1.0
        }
        
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            1.0
        }
    }
}

/// Docker/CI environment standardization configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CiEnvironmentConfig {
    /// Use headless rendering
    pub headless: bool,
    /// Virtual display resolution
    pub virtual_display_resolution: (u32, u32),
    /// Virtual display DPI
    pub virtual_display_dpi: u32,
    /// Font rendering mode
    pub font_rendering: FontRenderingMode,
    /// Color depth
    pub color_depth: u8,
}

impl Default for CiEnvironmentConfig {
    fn default() -> Self {
        Self {
            headless: true,
            virtual_display_resolution: (1920, 1080),
            virtual_display_dpi: 96,
            font_rendering: FontRenderingMode::Grayscale,
            color_depth: 24,
        }
    }
}

/// Font rendering modes for CI standardization
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FontRenderingMode {
    /// No anti-aliasing
    None,
    /// Grayscale anti-aliasing
    Grayscale,
    /// Subpixel anti-aliasing (ClearType on Windows)
    Subpixel,
}

impl Default for FontRenderingMode {
    fn default() -> Self {
        FontRenderingMode::Grayscale
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_platform_detection() {
        let platform = Platform::detect();
        // Should detect one of the known platforms
        assert!(matches!(
            platform,
            Platform::Windows | Platform::MacOS | Platform::Linux | Platform::Unknown
        ));
    }
    
    #[test]
    fn test_platform_config_detection() {
        let config = PlatformConfig::detect();
        assert!(config.default_dpi_scale > 0.0);
        assert!(config.font_aa_tolerance > 0);
    }
    
    #[test]
    fn test_color_tolerance_matching() {
        assert!(ColorNormalizer::colors_match_with_tolerance(
            (100, 100, 100),
            (105, 100, 100),
            5
        ));
        
        assert!(!ColorNormalizer::colors_match_with_tolerance(
            (100, 100, 100),
            (110, 100, 100),
            5
        ));
    }
    
    #[test]
    fn test_dpi_normalization() {
        let (w, h) = DpiNormalizer::calculate_normalized_dimensions(
            1920, 1080, 2.0, 1.0
        );
        assert_eq!(w, 960);
        assert_eq!(h, 540);
        
        // Same DPI should return same dimensions
        let (w2, h2) = DpiNormalizer::calculate_normalized_dimensions(
            1920, 1080, 1.0, 1.0
        );
        assert_eq!(w2, 1920);
        assert_eq!(h2, 1080);
    }
    
    #[test]
    fn test_threshold_adjustment() {
        let config = PlatformConfig {
            platform: Platform::Linux,
            default_dpi_scale: 1.0,
            font_aa_tolerance: 20,
            color_tolerance: 8,
            layout_shift_tolerance: 2,
            is_ci_environment: false,
            is_docker: false,
        };
        
        let adjusted = config.adjust_threshold(0.01);
        assert!(adjusted >= 0.01);  // Should be at least base threshold
        assert!(adjusted <= 1.0);   // Should not exceed 1.0
    }
}
