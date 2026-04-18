//! Performance benchmark tests for visual regression testing
//!
//! This module provides standardized performance tests to validate
//! performance requirements across different image sizes and algorithms.

use crate::visual_testing::{
    ComparisonConfig, ComparisonMethod, SensitivityProfile, Region,
    ImageComparator, AdaptiveComparator, SimdComparator, ParallelComparator,
    MemoryOptimizedComparator, PerformanceMonitor, PerformanceThresholds,
    PerformanceAlert,
};
use image::{DynamicImage, ImageBuffer, Rgba, GenericImageView};
use std::time::{Duration, Instant};

/// Standard image sizes for benchmarking
#[derive(Debug, Clone, Copy)]
pub struct BenchmarkImageSize {
    pub name: &'static str,
    pub width: u32,
    pub height: u32,
}

impl BenchmarkImageSize {
    pub const SMALL: Self = Self { name: "small", width: 640, height: 480 };
    pub const HD: Self = Self { name: "hd", width: 1920, height: 1080 };
    pub const FULL_HD: Self = Self { name: "full_hd", width: 1920, height: 1080 };
    pub const QHD: Self = Self { name: "qhd", width: 2560, height: 1440 };
    pub const UHD_4K: Self = Self { name: "4k", width: 3840, height: 2160 };
    
    pub fn pixel_count(&self) -> u64 {
        self.width as u64 * self.height as u64
    }
}

/// Performance requirements based on image size
#[derive(Debug, Clone)]
pub struct PerformanceRequirement {
    pub image_size: BenchmarkImageSize,
    pub max_pixelmatch_ms: u32,
    pub max_ssim_ms: u32,
    pub max_layout_aware_ms: u32,
    pub max_memory_mb: u32,
}

impl PerformanceRequirement {
    /// Get requirements for HD (1920x1080) images
    pub fn hd() -> Self {
        Self {
            image_size: BenchmarkImageSize::HD,
            max_pixelmatch_ms: 200,
            max_ssim_ms: 500,
            max_layout_aware_ms: 500,
            max_memory_mb: 100,
        }
    }
    
    /// Get requirements for 4K images (scaled from HD)
    pub fn uhd_4k() -> Self {
        // 4K has 4x the pixels of HD, so allow 4x the time
        Self {
            image_size: BenchmarkImageSize::UHD_4K,
            max_pixelmatch_ms: 800,
            max_ssim_ms: 2000,
            max_layout_aware_ms: 2000,
            max_memory_mb: 400,
        }
    }
    
    /// Scale requirements based on pixel count relative to HD
    pub fn for_size(size: BenchmarkImageSize) -> Self {
        let hd_pixels = BenchmarkImageSize::HD.pixel_count() as f64;
        let target_pixels = size.pixel_count() as f64;
        let scale = (target_pixels / hd_pixels).max(1.0);
        
        let hd_req = Self::hd();
        
        Self {
            image_size: size,
            max_pixelmatch_ms: (hd_req.max_pixelmatch_ms as f64 * scale) as u32,
            max_ssim_ms: (hd_req.max_ssim_ms as f64 * scale) as u32,
            max_layout_aware_ms: (hd_req.max_layout_aware_ms as f64 * scale) as u32,
            max_memory_mb: (hd_req.max_memory_mb as f64 * scale) as u32,
        }
    }
}

/// Benchmark result for a single test
#[derive(Debug, Clone)]
pub struct BenchmarkResult {
    pub test_name: String,
    pub image_size: BenchmarkImageSize,
    pub algorithm: ComparisonMethod,
    pub duration_ms: u32,
    pub memory_mb: u32,
    pub passed: bool,
    pub iterations: u32,
    pub avg_duration_ms: f64,
    pub min_duration_ms: u32,
    pub max_duration_ms: u32,
}

/// Generate a test image with specified characteristics
fn generate_test_image(width: u32, height: u32, seed: u8) -> DynamicImage {
    let mut buffer = ImageBuffer::new(width, height);
    
    for y in 0..height {
        for x in 0..width {
            // Create a pattern based on position and seed
            let r = ((x as u16 + seed as u16) % 256) as u8;
            let g = ((y as u16 + seed as u16) % 256) as u8;
            let b = (((x + y) as u16 + seed as u16) % 256) as u8;
            buffer.put_pixel(x, y, Rgba([r, g, b, 255]));
        }
    }
    
    DynamicImage::ImageRgba8(buffer)
}

/// Generate a slightly different image for comparison testing
fn generate_modified_image(width: u32, height: u32, seed: u8, diff_percentage: f32) -> DynamicImage {
    let mut buffer = ImageBuffer::new(width, height);
    let diff_threshold = (width * height) as f32 * diff_percentage;
    let mut diff_count = 0.0f32;
    
    for y in 0..height {
        for x in 0..width {
            let r = ((x as u16 + seed as u16) % 256) as u8;
            let g = ((y as u16 + seed as u16) % 256) as u8;
            let b = (((x + y) as u16 + seed as u16) % 256) as u8;
            
            // Modify some pixels
            let (r, g, b) = if diff_count < diff_threshold && (x + y) % 100 == 0 {
                diff_count += 1.0;
                (r.wrapping_add(50), g.wrapping_add(50), b.wrapping_add(50))
            } else {
                (r, g, b)
            };
            
            buffer.put_pixel(x, y, Rgba([r, g, b, 255]));
        }
    }
    
    DynamicImage::ImageRgba8(buffer)
}

/// Run a single benchmark iteration
fn run_benchmark_iteration(
    baseline: &DynamicImage,
    actual: &DynamicImage,
    config: &ComparisonConfig,
) -> (u32, u32) {
    let start = Instant::now();
    
    let _ = ImageComparator::compare(baseline, actual, config.clone());
    
    let duration = start.elapsed();
    let duration_ms = duration.as_millis() as u32;
    
    // Estimate memory usage
    let (width, height) = baseline.dimensions();
    let memory_mb = MemoryOptimizedComparator::estimate_memory_usage(width, height) / (1024 * 1024);
    
    (duration_ms, memory_mb as u32)
}

/// Run benchmark with multiple iterations
fn run_benchmark(
    test_name: &str,
    size: BenchmarkImageSize,
    algorithm: ComparisonMethod,
    iterations: u32,
) -> BenchmarkResult {
    let baseline = generate_test_image(size.width, size.height, 42);
    let actual = generate_modified_image(size.width, size.height, 42, 0.01);
    
    let config = ComparisonConfig {
        threshold: 0.05,
        method: algorithm.clone(),
        ignore_regions: vec![],
        include_roi: None,
        anti_aliasing_tolerance: false,
        layout_shift_tolerance: 0,
        sensitivity_profile: SensitivityProfile::Moderate,
    };
    
    let mut durations = Vec::with_capacity(iterations as usize);
    let mut total_memory = 0u32;
    
    // Warm-up run
    let _ = run_benchmark_iteration(&baseline, &actual, &config);
    
    // Actual benchmark runs
    for _ in 0..iterations {
        let (duration_ms, memory_mb) = run_benchmark_iteration(&baseline, &actual, &config);
        durations.push(duration_ms);
        total_memory = total_memory.max(memory_mb);
    }
    
    let total_duration: u32 = durations.iter().sum();
    let avg_duration = total_duration as f64 / iterations as f64;
    let min_duration = *durations.iter().min().unwrap_or(&0);
    let max_duration = *durations.iter().max().unwrap_or(&0);
    
    // Check against requirements
    let requirements = PerformanceRequirement::for_size(size);
    let max_allowed = match algorithm {
        ComparisonMethod::PixelMatch => requirements.max_pixelmatch_ms,
        ComparisonMethod::SSIM => requirements.max_ssim_ms,
        ComparisonMethod::LayoutAware => requirements.max_layout_aware_ms,
        ComparisonMethod::Hybrid => requirements.max_pixelmatch_ms,
    };
    
    let passed = avg_duration <= max_allowed as f64 && total_memory <= requirements.max_memory_mb;
    
    BenchmarkResult {
        test_name: test_name.to_string(),
        image_size: size,
        algorithm,
        duration_ms: avg_duration as u32,
        memory_mb: total_memory,
        passed,
        iterations,
        avg_duration_ms: avg_duration,
        min_duration_ms: min_duration,
        max_duration_ms: max_duration,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    /// Test PixelMatch performance on HD images
    /// **Validates: Requirements 4.1**
    #[test]
    fn test_pixelmatch_hd_performance() {
        let result = run_benchmark(
            "pixelmatch_hd",
            BenchmarkImageSize::HD,
            ComparisonMethod::PixelMatch,
            3,
        );
        
        println!("PixelMatch HD Performance:");
        println!("  Average: {:.2}ms", result.avg_duration_ms);
        println!("  Min: {}ms, Max: {}ms", result.min_duration_ms, result.max_duration_ms);
        println!("  Memory: {}MB", result.memory_mb);
        println!("  Passed: {}", result.passed);
        
        // Requirement 4.1: < 200ms for 1920x1080
        assert!(
            result.avg_duration_ms <= 200.0,
            "PixelMatch HD should complete in < 200ms, got {:.2}ms",
            result.avg_duration_ms
        );
    }
    
    /// Test SSIM performance on HD images
    /// **Validates: Requirements 4.1**
    #[test]
    fn test_ssim_hd_performance() {
        let result = run_benchmark(
            "ssim_hd",
            BenchmarkImageSize::HD,
            ComparisonMethod::SSIM,
            3,
        );
        
        println!("SSIM HD Performance:");
        println!("  Average: {:.2}ms", result.avg_duration_ms);
        println!("  Min: {}ms, Max: {}ms", result.min_duration_ms, result.max_duration_ms);
        println!("  Memory: {}MB", result.memory_mb);
        println!("  Passed: {}", result.passed);
        
        // SSIM is allowed up to 500ms for HD
        assert!(
            result.avg_duration_ms <= 500.0,
            "SSIM HD should complete in < 500ms, got {:.2}ms",
            result.avg_duration_ms
        );
    }
    
    /// Test LayoutAware performance on HD images
    /// **Validates: Requirements 4.1**
    #[test]
    fn test_layout_aware_hd_performance() {
        let result = run_benchmark(
            "layout_aware_hd",
            BenchmarkImageSize::HD,
            ComparisonMethod::LayoutAware,
            3,
        );
        
        println!("LayoutAware HD Performance:");
        println!("  Average: {:.2}ms", result.avg_duration_ms);
        println!("  Min: {}ms, Max: {}ms", result.min_duration_ms, result.max_duration_ms);
        println!("  Memory: {}MB", result.memory_mb);
        println!("  Passed: {}", result.passed);
        
        // LayoutAware is allowed up to 500ms for HD
        assert!(
            result.avg_duration_ms <= 500.0,
            "LayoutAware HD should complete in < 500ms, got {:.2}ms",
            result.avg_duration_ms
        );
    }
    
    /// Test memory efficiency for HD images
    /// **Validates: Requirements 4.3**
    #[test]
    fn test_memory_efficiency_hd() {
        let size = BenchmarkImageSize::HD;
        let estimated_memory = MemoryOptimizedComparator::estimate_memory_usage(size.width, size.height);
        let memory_mb = estimated_memory / (1024 * 1024);
        
        println!("Memory Estimation for HD:");
        println!("  Estimated: {}MB", memory_mb);
        
        // Should be under 100MB for HD images
        assert!(
            memory_mb <= 100,
            "HD image comparison should use < 100MB, estimated {}MB",
            memory_mb
        );
    }
    
    /// Test performance scaling with image size
    /// **Validates: Requirements 4.4**
    #[test]
    fn test_performance_scaling() {
        let sizes = [
            BenchmarkImageSize::SMALL,
            BenchmarkImageSize::HD,
        ];
        
        let mut results = Vec::new();
        
        for size in &sizes {
            let result = run_benchmark(
                &format!("pixelmatch_{}", size.name),
                *size,
                ComparisonMethod::PixelMatch,
                2,
            );
            results.push(result);
        }
        
        println!("Performance Scaling:");
        for result in &results {
            println!(
                "  {}: {:.2}ms ({} pixels)",
                result.image_size.name,
                result.avg_duration_ms,
                result.image_size.pixel_count()
            );
        }
        
        // Verify that performance scales roughly linearly with pixel count
        if results.len() >= 2 {
            let small = &results[0];
            let hd = &results[1];
            
            let pixel_ratio = hd.image_size.pixel_count() as f64 / small.image_size.pixel_count() as f64;
            let time_ratio = hd.avg_duration_ms / small.avg_duration_ms.max(1.0);
            
            // Time should scale at most 2x the pixel ratio (allowing for overhead)
            assert!(
                time_ratio <= pixel_ratio * 2.0,
                "Performance should scale roughly linearly. Pixel ratio: {:.2}, Time ratio: {:.2}",
                pixel_ratio,
                time_ratio
            );
        }
    }
    
    /// Test performance with ignore regions
    /// **Validates: Requirements 4.4**
    #[test]
    fn test_performance_with_ignore_regions() {
        let size = BenchmarkImageSize::HD;
        let baseline = generate_test_image(size.width, size.height, 42);
        let actual = generate_modified_image(size.width, size.height, 42, 0.01);
        
        // Config without ignore regions
        let config_no_ignore = ComparisonConfig {
            threshold: 0.05,
            method: ComparisonMethod::PixelMatch,
            ignore_regions: vec![],
            include_roi: None,
            anti_aliasing_tolerance: false,
            layout_shift_tolerance: 0,
            sensitivity_profile: SensitivityProfile::Moderate,
        };
        
        // Config with ignore regions
        let config_with_ignore = ComparisonConfig {
            threshold: 0.05,
            method: ComparisonMethod::PixelMatch,
            ignore_regions: vec![
                Region::new(100, 100, 200, 200),
                Region::new(500, 500, 300, 300),
                Region::new(1000, 500, 400, 400),
            ],
            include_roi: None,
            anti_aliasing_tolerance: false,
            layout_shift_tolerance: 0,
            sensitivity_profile: SensitivityProfile::Moderate,
        };
        
        let (time_no_ignore, _) = run_benchmark_iteration(&baseline, &actual, &config_no_ignore);
        let (time_with_ignore, _) = run_benchmark_iteration(&baseline, &actual, &config_with_ignore);
        
        println!("Ignore Region Performance Impact:");
        println!("  Without ignore regions: {}ms", time_no_ignore);
        println!("  With ignore regions: {}ms", time_with_ignore);
        
        // Adding ignore regions should not significantly increase time (< 50% overhead)
        let overhead_ratio = time_with_ignore as f64 / time_no_ignore.max(1) as f64;
        assert!(
            overhead_ratio <= 1.5,
            "Ignore regions should add < 50% overhead, got {:.2}x",
            overhead_ratio
        );
    }
    
    /// Test adaptive comparator selection
    /// **Validates: Requirements 4.1, 4.3**
    #[test]
    fn test_adaptive_comparator() {
        let monitor = PerformanceMonitor::new(PerformanceThresholds::default());
        
        let size = BenchmarkImageSize::HD;
        let baseline = generate_test_image(size.width, size.height, 42);
        let actual = generate_modified_image(size.width, size.height, 42, 0.01);
        
        let config = ComparisonConfig::default();
        
        let start = Instant::now();
        let result = AdaptiveComparator::compare(&baseline, &actual, &config, Some(&monitor));
        let duration = start.elapsed();
        
        assert!(result.is_ok(), "Adaptive comparison should succeed");
        
        let result = result.unwrap();
        println!("Adaptive Comparator Result:");
        println!("  Duration: {:?}", duration);
        println!("  Match: {}", result.is_match);
        println!("  Mismatch: {:.4}%", result.mismatch_percentage * 100.0);
        
        // Check performance alert
        let alert = monitor.check_alert(
            duration.as_millis() as u32,
            result.performance_metrics.memory_usage_mb,
            size.pixel_count(),
        );
        
        assert_eq!(
            alert,
            PerformanceAlert::Normal,
            "HD comparison should have normal performance"
        );
    }
    
    /// Test consistent performance across multiple runs
    /// **Validates: Requirements 4.4**
    #[test]
    fn test_consistent_performance() {
        let size = BenchmarkImageSize::HD;
        let baseline = generate_test_image(size.width, size.height, 42);
        let actual = generate_modified_image(size.width, size.height, 42, 0.01);
        
        let config = ComparisonConfig {
            threshold: 0.05,
            method: ComparisonMethod::PixelMatch,
            ignore_regions: vec![],
            include_roi: None,
            anti_aliasing_tolerance: false,
            layout_shift_tolerance: 0,
            sensitivity_profile: SensitivityProfile::Moderate,
        };
        
        let mut durations = Vec::new();
        
        // Run multiple times
        for _ in 0..5 {
            let (duration_ms, _) = run_benchmark_iteration(&baseline, &actual, &config);
            durations.push(duration_ms);
        }
        
        let avg: f64 = durations.iter().map(|&d| d as f64).sum::<f64>() / durations.len() as f64;
        let variance: f64 = durations.iter()
            .map(|&d| (d as f64 - avg).powi(2))
            .sum::<f64>() / durations.len() as f64;
        let std_dev = variance.sqrt();
        let coefficient_of_variation = std_dev / avg;
        
        println!("Performance Consistency:");
        println!("  Durations: {:?}", durations);
        println!("  Average: {:.2}ms", avg);
        println!("  Std Dev: {:.2}ms", std_dev);
        println!("  CV: {:.2}%", coefficient_of_variation * 100.0);
        
        // Coefficient of variation should be < 50% for consistent performance
        assert!(
            coefficient_of_variation <= 0.5,
            "Performance should be consistent (CV < 50%), got {:.2}%",
            coefficient_of_variation * 100.0
        );
    }
    
    /// Test small image performance
    /// **Validates: Requirements 4.1**
    #[test]
    fn test_small_image_performance() {
        let result = run_benchmark(
            "pixelmatch_small",
            BenchmarkImageSize::SMALL,
            ComparisonMethod::PixelMatch,
            5,
        );
        
        println!("Small Image Performance:");
        println!("  Average: {:.2}ms", result.avg_duration_ms);
        
        // Small images should be very fast (< 50ms)
        assert!(
            result.avg_duration_ms <= 50.0,
            "Small image comparison should complete in < 50ms, got {:.2}ms",
            result.avg_duration_ms
        );
    }
}
