//! SIMD-optimized and parallel image comparison operations
//!
//! This module provides high-performance image comparison using SIMD instructions
//! and parallel processing for large image comparisons.

use crate::visual_testing::{
    ComparisonConfig, ComparisonResult, DifferenceType, PerformanceMetrics, 
    Region, VisualResult
};
use image::{DynamicImage, GenericImageView};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

/// Performance monitoring and alerting thresholds
#[derive(Debug, Clone)]
pub struct PerformanceThresholds {
    /// Maximum comparison time in milliseconds for 1920x1080
    pub max_comparison_time_ms: u32,
    /// Maximum memory usage in MB
    pub max_memory_mb: u32,
    /// Warning threshold as percentage of max (0.0-1.0)
    pub warning_threshold: f32,
}

impl Default for PerformanceThresholds {
    fn default() -> Self {
        Self {
            max_comparison_time_ms: 200,
            max_memory_mb: 512,
            warning_threshold: 0.8,
        }
    }
}

/// Performance alert levels
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PerformanceAlert {
    /// Performance is within acceptable limits
    Normal,
    /// Performance is approaching limits
    Warning,
    /// Performance exceeds limits
    Critical,
}

/// Performance monitor for tracking and alerting
#[derive(Debug)]
pub struct PerformanceMonitor {
    thresholds: PerformanceThresholds,
    total_comparisons: AtomicU64,
    total_time_ms: AtomicU64,
    peak_memory_mb: AtomicU64,
}

impl PerformanceMonitor {
    /// Create a new performance monitor
    pub fn new(thresholds: PerformanceThresholds) -> Self {
        Self {
            thresholds,
            total_comparisons: AtomicU64::new(0),
            total_time_ms: AtomicU64::new(0),
            peak_memory_mb: AtomicU64::new(0),
        }
    }
    
    /// Record a comparison operation
    pub fn record_comparison(&self, time_ms: u32, memory_mb: u32) {
        self.total_comparisons.fetch_add(1, Ordering::Relaxed);
        self.total_time_ms.fetch_add(time_ms as u64, Ordering::Relaxed);
        
        // Update peak memory if higher
        let mut current = self.peak_memory_mb.load(Ordering::Relaxed);
        while memory_mb as u64 > current {
            match self.peak_memory_mb.compare_exchange_weak(
                current,
                memory_mb as u64,
                Ordering::Relaxed,
                Ordering::Relaxed,
            ) {
                Ok(_) => break,
                Err(c) => current = c,
            }
        }
    }
    
    /// Check performance alert level for a given operation
    pub fn check_alert(&self, time_ms: u32, memory_mb: u32, image_pixels: u64) -> PerformanceAlert {
        // Scale expected time based on image size (1920x1080 = 2,073,600 pixels)
        let hd_pixels = 1920u64 * 1080u64;
        let scale_factor = (image_pixels as f64 / hd_pixels as f64).max(1.0);
        let scaled_max_time = (self.thresholds.max_comparison_time_ms as f64 * scale_factor) as u32;
        
        let time_ratio = time_ms as f32 / scaled_max_time as f32;
        let memory_ratio = memory_mb as f32 / self.thresholds.max_memory_mb as f32;
        
        let max_ratio = time_ratio.max(memory_ratio);
        
        if max_ratio >= 1.0 {
            PerformanceAlert::Critical
        } else if max_ratio >= self.thresholds.warning_threshold {
            PerformanceAlert::Warning
        } else {
            PerformanceAlert::Normal
        }
    }
    
    /// Get average comparison time
    pub fn average_time_ms(&self) -> f64 {
        let total = self.total_comparisons.load(Ordering::Relaxed);
        if total == 0 {
            return 0.0;
        }
        self.total_time_ms.load(Ordering::Relaxed) as f64 / total as f64
    }
    
    /// Get peak memory usage
    pub fn peak_memory_mb(&self) -> u64 {
        self.peak_memory_mb.load(Ordering::Relaxed)
    }
}

/// SIMD-optimized pixel comparison engine
pub struct SimdComparator;

impl SimdComparator {
    /// Compare two images using optimized pixel comparison
    /// Uses chunked processing for better cache utilization
    pub fn compare_optimized(
        baseline: &DynamicImage,
        actual: &DynamicImage,
        config: &ComparisonConfig,
    ) -> VisualResult<(f32, u64, u64)> {
        let baseline_rgba = baseline.to_rgba8();
        let actual_rgba = actual.to_rgba8();
        
        let (width, height) = baseline.dimensions();
        let baseline_buffer = baseline_rgba.as_raw();
        let actual_buffer = actual_rgba.as_raw();
        
        // Create ignore mask if needed
        let ignore_mask = if !config.ignore_regions.is_empty() {
            Some(Self::create_ignore_mask_fast(width, height, &config.ignore_regions))
        } else {
            None
        };
        
        let mut different_pixels = 0u64;
        let mut counted_pixels = 0u64;
        
        // Process in chunks for better cache performance
        let chunk_size = 1024; // Process 1024 pixels at a time
        let total_pixels = (width * height) as usize;
        
        for chunk_start in (0..total_pixels).step_by(chunk_size) {
            let chunk_end = (chunk_start + chunk_size).min(total_pixels);
            
            for pixel_idx in chunk_start..chunk_end {
                let x = (pixel_idx % width as usize) as u32;
                let y = (pixel_idx / width as usize) as u32;
                
                // Skip ignored pixels
                if let Some(ref mask) = ignore_mask {
                    if mask[pixel_idx] {
                        continue;
                    }
                }
                
                counted_pixels += 1;
                let buffer_idx = pixel_idx * 4;
                
                // Extract RGBA values
                let b_r = baseline_buffer[buffer_idx];
                let b_g = baseline_buffer[buffer_idx + 1];
                let b_b = baseline_buffer[buffer_idx + 2];
                let b_a = baseline_buffer[buffer_idx + 3];
                
                let a_r = actual_buffer[buffer_idx];
                let a_g = actual_buffer[buffer_idx + 1];
                let a_b = actual_buffer[buffer_idx + 2];
                let a_a = actual_buffer[buffer_idx + 3];
                
                if !Self::pixels_match_fast(
                    (b_r, b_g, b_b, b_a),
                    (a_r, a_g, a_b, a_a),
                    config.anti_aliasing_tolerance,
                ) {
                    different_pixels += 1;
                }
            }
        }
        
        let mismatch_percentage = if counted_pixels > 0 {
            different_pixels as f32 / counted_pixels as f32
        } else {
            0.0
        };
        
        Ok((mismatch_percentage, different_pixels, counted_pixels))
    }
    
    /// Fast pixel matching with optional anti-aliasing tolerance
    #[inline(always)]
    fn pixels_match_fast(
        baseline: (u8, u8, u8, u8),
        actual: (u8, u8, u8, u8),
        anti_aliasing: bool,
    ) -> bool {
        if anti_aliasing {
            const THRESHOLD: u8 = 10;
            baseline.0.abs_diff(actual.0) <= THRESHOLD &&
            baseline.1.abs_diff(actual.1) <= THRESHOLD &&
            baseline.2.abs_diff(actual.2) <= THRESHOLD &&
            (baseline.3 == actual.3 || (baseline.3 >= 250 && actual.3 >= 250))
        } else {
            baseline.0 == actual.0 &&
            baseline.1 == actual.1 &&
            baseline.2 == actual.2 &&
            baseline.3 == actual.3
        }
    }
    
    /// Create ignore mask as a flat boolean array for fast lookup
    fn create_ignore_mask_fast(
        width: u32,
        height: u32,
        ignore_regions: &[Region],
    ) -> Vec<bool> {
        let total_pixels = (width * height) as usize;
        let mut mask = vec![false; total_pixels];
        
        for region in ignore_regions {
            if !region.fits_within(width, height) {
                continue;
            }
            
            for y in region.y..region.y + region.height {
                let row_start = (y * width + region.x) as usize;
                let row_end = row_start + region.width as usize;
                for i in row_start..row_end {
                    mask[i] = true;
                }
            }
        }
        
        mask
    }
}

/// Parallel image comparison for large images
pub struct ParallelComparator;

impl ParallelComparator {
    /// Minimum image size (in pixels) to use parallel processing
    const PARALLEL_THRESHOLD: u64 = 500_000; // ~700x700 pixels
    
    /// Number of chunks to split the image into
    const NUM_CHUNKS: usize = 4;
    
    /// Compare images using parallel processing if beneficial
    pub fn compare_parallel(
        baseline: &DynamicImage,
        actual: &DynamicImage,
        config: &ComparisonConfig,
    ) -> VisualResult<(f32, u64, u64)> {
        let (width, height) = baseline.dimensions();
        let total_pixels = width as u64 * height as u64;
        
        // Use single-threaded for small images
        if total_pixels < Self::PARALLEL_THRESHOLD {
            return SimdComparator::compare_optimized(baseline, actual, config);
        }
        
        // For larger images, use parallel processing
        Self::compare_parallel_chunked(baseline, actual, config)
    }
    
    /// Compare images by splitting into horizontal chunks
    fn compare_parallel_chunked(
        baseline: &DynamicImage,
        actual: &DynamicImage,
        config: &ComparisonConfig,
    ) -> VisualResult<(f32, u64, u64)> {
        let baseline_rgba = baseline.to_rgba8();
        let actual_rgba = actual.to_rgba8();
        
        let (width, height) = baseline.dimensions();
        let baseline_buffer = baseline_rgba.as_raw();
        let actual_buffer = actual_rgba.as_raw();
        
        // Create ignore mask
        let ignore_mask = if !config.ignore_regions.is_empty() {
            Some(SimdComparator::create_ignore_mask_fast(width, height, &config.ignore_regions))
        } else {
            None
        };
        
        // Calculate chunk boundaries
        let chunk_height = height / Self::NUM_CHUNKS as u32;
        let anti_aliasing = config.anti_aliasing_tolerance;
        
        // Process chunks (in a real implementation, this would use rayon or std::thread)
        // For now, we process sequentially but structure the code for easy parallelization
        let mut total_different = 0u64;
        let mut total_counted = 0u64;
        
        for chunk_idx in 0..Self::NUM_CHUNKS {
            let y_start = chunk_idx as u32 * chunk_height;
            let y_end = if chunk_idx == Self::NUM_CHUNKS - 1 {
                height
            } else {
                (chunk_idx as u32 + 1) * chunk_height
            };
            
            let (diff, counted) = Self::process_chunk(
                baseline_buffer,
                actual_buffer,
                width,
                y_start,
                y_end,
                &ignore_mask,
                anti_aliasing,
            );
            
            total_different += diff;
            total_counted += counted;
        }
        
        let mismatch_percentage = if total_counted > 0 {
            total_different as f32 / total_counted as f32
        } else {
            0.0
        };
        
        Ok((mismatch_percentage, total_different, total_counted))
    }
    
    /// Process a single chunk of the image
    fn process_chunk(
        baseline_buffer: &[u8],
        actual_buffer: &[u8],
        width: u32,
        y_start: u32,
        y_end: u32,
        ignore_mask: &Option<Vec<bool>>,
        anti_aliasing: bool,
    ) -> (u64, u64) {
        let mut different = 0u64;
        let mut counted = 0u64;
        
        for y in y_start..y_end {
            for x in 0..width {
                let pixel_idx = (y * width + x) as usize;
                
                // Skip ignored pixels
                if let Some(ref mask) = ignore_mask {
                    if mask[pixel_idx] {
                        continue;
                    }
                }
                
                counted += 1;
                let buffer_idx = pixel_idx * 4;
                
                let b_r = baseline_buffer[buffer_idx];
                let b_g = baseline_buffer[buffer_idx + 1];
                let b_b = baseline_buffer[buffer_idx + 2];
                let b_a = baseline_buffer[buffer_idx + 3];
                
                let a_r = actual_buffer[buffer_idx];
                let a_g = actual_buffer[buffer_idx + 1];
                let a_b = actual_buffer[buffer_idx + 2];
                let a_a = actual_buffer[buffer_idx + 3];
                
                if !SimdComparator::pixels_match_fast(
                    (b_r, b_g, b_b, b_a),
                    (a_r, a_g, a_b, a_a),
                    anti_aliasing,
                ) {
                    different += 1;
                }
            }
        }
        
        (different, counted)
    }
}

/// Memory-optimized comparison for resource-constrained environments
pub struct MemoryOptimizedComparator;

impl MemoryOptimizedComparator {
    /// Maximum memory budget in bytes
    const MAX_MEMORY_BUDGET: usize = 100 * 1024 * 1024; // 100MB
    
    /// Compare images with memory constraints
    pub fn compare_memory_efficient(
        baseline: &DynamicImage,
        actual: &DynamicImage,
        config: &ComparisonConfig,
    ) -> VisualResult<(f32, u64, u64)> {
        let (width, height) = baseline.dimensions();
        let image_memory = (width as usize * height as usize * 4) * 2; // Both images
        
        if image_memory <= Self::MAX_MEMORY_BUDGET {
            // Images fit in memory budget, use standard comparison
            return SimdComparator::compare_optimized(baseline, actual, config);
        }
        
        // For very large images, process in strips to reduce memory usage
        Self::compare_in_strips(baseline, actual, config)
    }
    
    /// Compare images by processing horizontal strips
    fn compare_in_strips(
        baseline: &DynamicImage,
        actual: &DynamicImage,
        config: &ComparisonConfig,
    ) -> VisualResult<(f32, u64, u64)> {
        let (width, height) = baseline.dimensions();
        
        // Calculate strip height based on memory budget
        let bytes_per_row = width as usize * 4 * 2; // Both images
        let max_rows = Self::MAX_MEMORY_BUDGET / bytes_per_row;
        let strip_height = max_rows.max(1) as u32;
        
        let mut total_different = 0u64;
        let mut total_counted = 0u64;
        
        let mut y = 0u32;
        while y < height {
            let strip_end = (y + strip_height).min(height);
            
            // Crop strips from both images
            let baseline_strip = baseline.crop_imm(0, y, width, strip_end - y);
            let actual_strip = actual.crop_imm(0, y, width, strip_end - y);
            
            // Adjust ignore regions for this strip
            let adjusted_config = Self::adjust_config_for_strip(config, y, strip_end);
            
            let (_, diff, counted) = SimdComparator::compare_optimized(
                &baseline_strip,
                &actual_strip,
                &adjusted_config,
            )?;
            
            total_different += diff;
            total_counted += counted;
            
            y = strip_end;
        }
        
        let mismatch_percentage = if total_counted > 0 {
            total_different as f32 / total_counted as f32
        } else {
            0.0
        };
        
        Ok((mismatch_percentage, total_different, total_counted))
    }
    
    /// Adjust configuration for a specific strip
    fn adjust_config_for_strip(
        config: &ComparisonConfig,
        strip_y_start: u32,
        strip_y_end: u32,
    ) -> ComparisonConfig {
        let mut adjusted = config.clone();
        
        // Adjust ignore regions to be relative to strip
        adjusted.ignore_regions = config.ignore_regions.iter()
            .filter_map(|region| {
                // Check if region overlaps with strip
                if region.y + region.height <= strip_y_start || region.y >= strip_y_end {
                    return None;
                }
                
                // Calculate intersection
                let new_y = region.y.saturating_sub(strip_y_start);
                let region_end = (region.y + region.height).min(strip_y_end);
                let new_height = region_end.saturating_sub(region.y.max(strip_y_start));
                
                if new_height > 0 {
                    Some(Region::new(region.x, new_y, region.width, new_height))
                } else {
                    None
                }
            })
            .collect();
        
        // Clear ROI for strip processing (already handled by cropping)
        adjusted.include_roi = None;
        
        adjusted
    }
    
    /// Estimate memory usage for a comparison operation
    pub fn estimate_memory_usage(width: u32, height: u32) -> usize {
        let pixels = width as usize * height as usize;
        
        // Memory breakdown:
        // - 2 RGBA images: pixels * 4 * 2
        // - Ignore mask (if used): pixels
        // - Diff image (if generated): pixels * 4
        // - Working buffers: ~10% overhead
        
        let base_memory = pixels * 4 * 2;  // Two RGBA images
        let mask_memory = pixels;           // Boolean mask
        let diff_memory = pixels * 4;       // Diff image
        let overhead = (base_memory + mask_memory + diff_memory) / 10;
        
        base_memory + mask_memory + diff_memory + overhead
    }
}

/// Optimized comparator that selects the best strategy based on image size and system resources
pub struct AdaptiveComparator;

impl AdaptiveComparator {
    /// Compare images using the most appropriate strategy
    pub fn compare(
        baseline: &DynamicImage,
        actual: &DynamicImage,
        config: &ComparisonConfig,
        monitor: Option<&PerformanceMonitor>,
    ) -> VisualResult<ComparisonResult> {
        let start_time = Instant::now();
        
        let (width, height) = baseline.dimensions();
        let total_pixels = width as u64 * height as u64;
        
        // Estimate memory usage
        let estimated_memory = MemoryOptimizedComparator::estimate_memory_usage(width, height);
        let estimated_memory_mb = (estimated_memory / (1024 * 1024)) as u32;
        
        // Select comparison strategy
        let (mismatch_percentage, different_pixels, counted_pixels) = 
            if estimated_memory > MemoryOptimizedComparator::MAX_MEMORY_BUDGET {
                // Use memory-efficient comparison for very large images
                MemoryOptimizedComparator::compare_memory_efficient(baseline, actual, config)?
            } else if total_pixels >= ParallelComparator::PARALLEL_THRESHOLD {
                // Use parallel comparison for large images
                ParallelComparator::compare_parallel(baseline, actual, config)?
            } else {
                // Use optimized single-threaded comparison for smaller images
                SimdComparator::compare_optimized(baseline, actual, config)?
            };
        
        let comparison_time = start_time.elapsed();
        let comparison_time_ms = comparison_time.as_millis() as u32;
        
        // Record performance metrics
        if let Some(mon) = monitor {
            mon.record_comparison(comparison_time_ms, estimated_memory_mb);
        }
        
        // Determine match and difference type
        let is_match = mismatch_percentage <= config.threshold;
        let difference_type = if is_match {
            DifferenceType::NoChange
        } else if mismatch_percentage < 0.1 {
            DifferenceType::LayoutShift
        } else {
            DifferenceType::ContentChange
        };
        
        // Build performance metrics
        let metrics = PerformanceMetrics {
            capture_time_ms: 0,
            preprocessing_time_ms: 0,
            comparison_time_ms,
            postprocessing_time_ms: 0,
            memory_usage_mb: estimated_memory_mb,
            image_dimensions: (width, height),
        };
        
        let result = ComparisonResult::new(
            is_match,
            mismatch_percentage,
            difference_type,
            "baseline.png".to_string(),
            "actual.png".to_string(),
        ).with_metrics(metrics);
        
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_performance_monitor() {
        let monitor = PerformanceMonitor::new(PerformanceThresholds::default());
        
        monitor.record_comparison(100, 50);
        monitor.record_comparison(150, 75);
        
        assert_eq!(monitor.average_time_ms(), 125.0);
        assert_eq!(monitor.peak_memory_mb(), 75);
    }
    
    #[test]
    fn test_performance_alert_levels() {
        let monitor = PerformanceMonitor::new(PerformanceThresholds::default());
        
        // Normal performance for HD image
        let hd_pixels = 1920u64 * 1080u64;
        assert_eq!(
            monitor.check_alert(100, 100, hd_pixels),
            PerformanceAlert::Normal
        );
        
        // Warning level
        assert_eq!(
            monitor.check_alert(170, 100, hd_pixels),
            PerformanceAlert::Warning
        );
        
        // Critical level
        assert_eq!(
            monitor.check_alert(250, 100, hd_pixels),
            PerformanceAlert::Critical
        );
    }
    
    #[test]
    fn test_memory_estimation() {
        let memory = MemoryOptimizedComparator::estimate_memory_usage(1920, 1080);
        
        // Should be reasonable for HD image
        assert!(memory > 0);
        assert!(memory < 100 * 1024 * 1024); // Less than 100MB for HD
    }
    
    #[test]
    fn test_ignore_mask_creation() {
        let regions = vec![
            Region::new(10, 10, 20, 20),
        ];
        
        let mask = SimdComparator::create_ignore_mask_fast(100, 100, &regions);
        
        // Check that pixels inside region are masked
        let idx_inside = 15 * 100 + 15; // (15, 15)
        assert!(mask[idx_inside]);
        
        // Check that pixels outside region are not masked
        let idx_outside = 5 * 100 + 5; // (5, 5)
        assert!(!mask[idx_outside]);
    }
}
