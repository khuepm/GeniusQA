//! Image comparison algorithms for visual regression testing

use crate::visual_testing::{
    ComparisonConfig, ComparisonResult, ComparisonMethod, DifferenceType, 
    PerformanceMetrics, VisualError, VisualResult, Region
};
use image::{DynamicImage, ImageBuffer, Rgba, GenericImageView};
use std::time::Instant;

/// Main image comparator engine
pub struct ImageComparator;

impl ImageComparator {
    /// Compare two images using the specified configuration
    pub fn compare(
        baseline: &DynamicImage,
        actual: &DynamicImage,
        config: ComparisonConfig,
    ) -> VisualResult<ComparisonResult> {
        let start_time = Instant::now();
        
        // Validate configuration
        config.validate().map_err(|msg| VisualError::ConfigError { message: msg })?;
        
        // Check dimensions
        if baseline.dimensions() != actual.dimensions() {
            let (baseline_width, baseline_height) = baseline.dimensions();
            let (actual_width, actual_height) = actual.dimensions();
            return Err(VisualError::DimensionMismatch {
                baseline_width,
                baseline_height,
                actual_width,
                actual_height,
            });
        }

        let (width, height) = baseline.dimensions();
        let mut metrics = PerformanceMetrics::default();
        metrics.image_dimensions = (width, height);

        // Apply ROI cropping if specified
        let (baseline_cropped, actual_cropped) = if let Some(roi) = &config.include_roi {
            if !roi.fits_within(width, height) {
                return Err(VisualError::InvalidRegion {
                    x: roi.x,
                    y: roi.y,
                    width: roi.width,
                    height: roi.height,
                });
            }
            
            let baseline_crop = Self::crop_image(baseline, roi)?;
            let actual_crop = Self::crop_image(actual, roi)?;
            (baseline_crop, actual_crop)
        } else {
            (baseline.clone(), actual.clone())
        };

        let preprocessing_time = start_time.elapsed();
        metrics.preprocessing_time_ms = preprocessing_time.as_millis() as u32;

        // Perform comparison based on method
        let comparison_start = Instant::now();
        let mismatch_percentage = match config.method {
            ComparisonMethod::PixelMatch => {
                Self::pixel_match_comparison(&baseline_cropped, &actual_cropped, &config)?
            }
            ComparisonMethod::SSIM => {
                Self::ssim_comparison(&baseline_cropped, &actual_cropped, &config)?
            }
            ComparisonMethod::LayoutAware => {
                Self::layout_aware_comparison(&baseline_cropped, &actual_cropped, &config)?
            }
            ComparisonMethod::Hybrid => {
                // Use SSIM for flexible profiles, LayoutAware for moderate, PixelMatch for strict
                match config.sensitivity_profile {
                    crate::visual_testing::SensitivityProfile::Strict => {
                        Self::pixel_match_comparison(&baseline_cropped, &actual_cropped, &config)?
                    }
                    crate::visual_testing::SensitivityProfile::Moderate => {
                        Self::layout_aware_comparison(&baseline_cropped, &actual_cropped, &config)?
                    }
                    crate::visual_testing::SensitivityProfile::Flexible => {
                        Self::ssim_comparison(&baseline_cropped, &actual_cropped, &config)?
                    }
                }
            }
        };

        let comparison_time = comparison_start.elapsed();
        metrics.comparison_time_ms = comparison_time.as_millis() as u32;

        // Determine if images match
        let is_match = mismatch_percentage <= config.threshold;
        
        // Classify difference type
        let difference_type = if is_match {
            DifferenceType::NoChange
        } else if mismatch_percentage < 0.1 {
            DifferenceType::LayoutShift
        } else {
            DifferenceType::ContentChange
        };

        // Generate diff image if there are differences
        let diff_image_path = if !is_match {
            let postprocessing_start = Instant::now();
            let diff_path = Self::generate_diff_image(&baseline_cropped, &actual_cropped, &config)?;
            let postprocessing_time = postprocessing_start.elapsed();
            metrics.postprocessing_time_ms = postprocessing_time.as_millis() as u32;
            Some(diff_path)
        } else {
            None
        };

        let total_time = start_time.elapsed();
        metrics.capture_time_ms = 0; // This would be set by the caller
        if diff_image_path.is_none() {
            metrics.postprocessing_time_ms = (total_time.as_millis() as u32)
                .saturating_sub(metrics.preprocessing_time_ms)
                .saturating_sub(metrics.comparison_time_ms);
        }

        let mut result = ComparisonResult::new(
            is_match,
            mismatch_percentage,
            difference_type,
            "baseline.png".to_string(), // Placeholder paths
            "actual.png".to_string(),
        ).with_metrics(metrics);

        if let Some(diff_path) = diff_image_path {
            result = result.with_diff_image(diff_path);
        }

        Ok(result)
    }

    /// Crop an image to the specified region
    fn crop_image(image: &DynamicImage, region: &Region) -> VisualResult<DynamicImage> {
        let (img_width, img_height) = image.dimensions();
        
        if !region.fits_within(img_width, img_height) {
            return Err(VisualError::InvalidRegion {
                x: region.x,
                y: region.y,
                width: region.width,
                height: region.height,
            });
        }

        Ok(image.crop_imm(region.x, region.y, region.width, region.height))
    }

    /// Basic pixel-by-pixel comparison with optimized performance
    fn pixel_match_comparison(
        baseline: &DynamicImage,
        actual: &DynamicImage,
        config: &ComparisonConfig,
    ) -> VisualResult<f32> {
        let baseline_rgba = baseline.to_rgba8();
        let actual_rgba = actual.to_rgba8();
        
        let (width, height) = baseline.dimensions();
        let total_pixels = (width * height) as u64;
        let mut different_pixels = 0u64;
        let mut counted_pixels = 0u64;

        // Create ignore mask if ignore regions are specified
        let ignore_mask = if !config.ignore_regions.is_empty() {
            Some(Self::create_ignore_mask(width, height, &config.ignore_regions)?)
        } else {
            None
        };

        // Optimized pixel comparison using raw buffer access
        let baseline_buffer = baseline_rgba.as_raw();
        let actual_buffer = actual_rgba.as_raw();
        
        for y in 0..height {
            for x in 0..width {
                // Skip if pixel is in ignore region
                if let Some(ref mask) = ignore_mask {
                    if mask.get_pixel(x, y)[0] > 0 {
                        continue;
                    }
                }

                counted_pixels += 1;
                let pixel_index = ((y * width + x) * 4) as usize;
                
                // Extract RGBA values directly from buffer for performance
                let baseline_r = baseline_buffer[pixel_index];
                let baseline_g = baseline_buffer[pixel_index + 1];
                let baseline_b = baseline_buffer[pixel_index + 2];
                let baseline_a = baseline_buffer[pixel_index + 3];
                
                let actual_r = actual_buffer[pixel_index];
                let actual_g = actual_buffer[pixel_index + 1];
                let actual_b = actual_buffer[pixel_index + 2];
                let actual_a = actual_buffer[pixel_index + 3];

                if !Self::pixels_match_rgba(
                    (baseline_r, baseline_g, baseline_b, baseline_a),
                    (actual_r, actual_g, actual_b, actual_a),
                    config
                ) {
                    different_pixels += 1;
                }
            }
        }

        // Calculate mismatch percentage based on counted pixels (excluding ignored regions)
        let mismatch_percentage = if counted_pixels > 0 {
            different_pixels as f32 / counted_pixels as f32
        } else {
            0.0
        };
        
        Ok(mismatch_percentage)
    }

    /// Check if two pixels match based on configuration (optimized version)
    fn pixels_match_rgba(
        baseline: (u8, u8, u8, u8),
        actual: (u8, u8, u8, u8),
        config: &ComparisonConfig,
    ) -> bool {
        let (br, bg, bb, ba) = baseline;
        let (ar, ag, ab, aa) = actual;
        
        if config.anti_aliasing_tolerance {
            // Allow small differences for anti-aliasing
            let threshold = 10u8;
            
            // Check RGB channels with tolerance
            if br.abs_diff(ar) > threshold ||
               bg.abs_diff(ag) > threshold ||
               bb.abs_diff(ab) > threshold {
                return false;
            }
            
            // Alpha channel should match exactly or both be fully opaque
            ba == aa || (ba >= 250 && aa >= 250)
        } else {
            // Exact match required
            br == ar && bg == ag && bb == ab && ba == aa
        }
    }

    /// Legacy pixel match function for backward compatibility
    fn pixels_match(
        baseline: &Rgba<u8>,
        actual: &Rgba<u8>,
        config: &ComparisonConfig,
    ) -> bool {
        Self::pixels_match_rgba(
            (baseline[0], baseline[1], baseline[2], baseline[3]),
            (actual[0], actual[1], actual[2], actual[3]),
            config
        )
    }

    /// Create a mask for ignore regions
    fn create_ignore_mask(
        width: u32,
        height: u32,
        ignore_regions: &[Region],
    ) -> VisualResult<ImageBuffer<image::Luma<u8>, Vec<u8>>> {
        let mut mask = ImageBuffer::new(width, height);
        
        for region in ignore_regions {
            if !region.fits_within(width, height) {
                return Err(VisualError::InvalidRegion {
                    x: region.x,
                    y: region.y,
                    width: region.width,
                    height: region.height,
                });
            }

            // Mark ignore region pixels as 255 (ignored)
            for y in region.y..region.y + region.height {
                for x in region.x..region.x + region.width {
                    mask.put_pixel(x, y, image::Luma([255u8]));
                }
            }
        }

        Ok(mask)
    }

    /// Generate a diff image highlighting differences between baseline and actual
    fn generate_diff_image(
        baseline: &DynamicImage,
        actual: &DynamicImage,
        config: &ComparisonConfig,
    ) -> VisualResult<String> {
        let baseline_rgba = baseline.to_rgba8();
        let actual_rgba = actual.to_rgba8();
        let (width, height) = baseline.dimensions();
        
        // Create diff image buffer
        let mut diff_buffer = ImageBuffer::new(width, height);
        
        // Create ignore mask if ignore regions are specified
        let ignore_mask = if !config.ignore_regions.is_empty() {
            Some(Self::create_ignore_mask(width, height, &config.ignore_regions)?)
        } else {
            None
        };

        // Generate diff visualization
        for y in 0..height {
            for x in 0..width {
                let baseline_pixel = baseline_rgba.get_pixel(x, y);
                let actual_pixel = actual_rgba.get_pixel(x, y);
                
                // Check if pixel is in ignore region
                let is_ignored = if let Some(ref mask) = ignore_mask {
                    mask.get_pixel(x, y)[0] > 0
                } else {
                    false
                };

                let diff_pixel = if is_ignored {
                    // Gray out ignored regions
                    Rgba([128u8, 128u8, 128u8, 255u8])
                } else if Self::pixels_match(baseline_pixel, actual_pixel, config) {
                    // Matching pixels: show actual image with reduced opacity
                    let actual = actual_pixel.0;
                    Rgba([
                        (actual[0] as f32 * 0.7) as u8,
                        (actual[1] as f32 * 0.7) as u8,
                        (actual[2] as f32 * 0.7) as u8,
                        255u8,
                    ])
                } else {
                    // Different pixels: highlight in red
                    Rgba([255u8, 0u8, 0u8, 255u8])
                };

                diff_buffer.put_pixel(x, y, diff_pixel);
            }
        }

        // Save diff image to temporary path
        let diff_path = format!("diff_{}_{}.png", 
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        );
        
        let diff_image = DynamicImage::ImageRgba8(diff_buffer);
        diff_image.save(&diff_path)
            .map_err(|e| VisualError::ImageSaveError {
                path: diff_path.clone(),
                reason: e.to_string(),
            })?;

        Ok(diff_path)
    }

    /// Normalize DPI for cross-platform consistency
    pub fn normalize_dpi(image: &DynamicImage, _target_dpi: u32) -> DynamicImage {
        // For now, return the image as-is
        // In a full implementation, this would handle DPI scaling
        image.clone()
    }

    /// Compare with baseline auto-generation support
    /// If baseline_path doesn't exist, creates a new baseline and returns a passing result
    pub fn compare_with_baseline_generation(
        baseline_path: &str,
        actual: &DynamicImage,
        config: ComparisonConfig,
    ) -> VisualResult<ComparisonResult> {
        use std::path::Path;
        
        let baseline_path_obj = Path::new(baseline_path);
        
        // Check if baseline exists
        if !baseline_path_obj.exists() {
            // Auto-generate baseline
            return Self::create_new_baseline(baseline_path, actual, config);
        }
        
        // Load existing baseline
        let baseline = crate::visual_testing::ImageLoader::load_image(baseline_path)?;
        
        // Perform normal comparison
        Self::compare(&baseline, actual, config)
    }
    
    /// Create a new baseline image and return a passing result
    fn create_new_baseline(
        baseline_path: &str,
        actual: &DynamicImage,
        config: ComparisonConfig,
    ) -> VisualResult<ComparisonResult> {
        use std::path::Path;
        
        // Create directory if it doesn't exist
        if let Some(parent) = Path::new(baseline_path).parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent).map_err(|e| VisualError::IoError {
                    message: format!("Failed to create baseline directory: {}", e),
                })?;
            }
        }
        
        // Save the actual image as the new baseline
        let format = crate::visual_testing::ImageLoader::get_format_from_path(baseline_path)?;
        crate::visual_testing::ImageLoader::save_image(actual, baseline_path, format)?;
        
        // Calculate checksum for integrity validation
        let checksum = Self::calculate_image_checksum(actual)?;
        
        // Create a passing result for new baseline
        let mut result = ComparisonResult::new(
            true, // is_match = true for new baselines
            0.0,  // mismatch_percentage = 0 for new baselines
            DifferenceType::NoChange,
            baseline_path.to_string(),
            baseline_path.to_string(), // actual_path same as baseline for new baselines
        );
        
        // Add metadata about baseline creation
        result = result
            .with_metadata("baseline_created".to_string(), "true".to_string())
            .with_metadata("baseline_checksum".to_string(), checksum)
            .with_metadata("creation_timestamp".to_string(), 
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
                    .to_string());
        
        Ok(result)
    }
    
    /// Calculate checksum for baseline integrity validation
    fn calculate_image_checksum(image: &DynamicImage) -> VisualResult<String> {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let rgba_image = image.to_rgba8();
        let mut hasher = DefaultHasher::new();
        
        // Hash image dimensions and pixel data
        image.dimensions().hash(&mut hasher);
        rgba_image.as_raw().hash(&mut hasher);
        
        Ok(format!("{:x}", hasher.finish()))
    }
    
    /// Validate baseline integrity using checksum
    pub fn validate_baseline_integrity(
        baseline_path: &str,
        expected_checksum: &str,
    ) -> VisualResult<bool> {
        let baseline = crate::visual_testing::ImageLoader::load_image(baseline_path)?;
        let actual_checksum = Self::calculate_image_checksum(&baseline)?;
        Ok(actual_checksum == expected_checksum)
    }
    
    /// Update an existing baseline with a new image (for approved changes)
    pub fn update_baseline(
        baseline_path: &str,
        new_baseline: &DynamicImage,
    ) -> VisualResult<String> {
        use std::path::Path;
        
        // Create backup of existing baseline if it exists
        let baseline_path_obj = Path::new(baseline_path);
        if baseline_path_obj.exists() {
            let backup_path = format!("{}.backup.{}", 
                baseline_path,
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
            );
            std::fs::copy(baseline_path, &backup_path).map_err(|e| VisualError::FileSystemError {
                operation: "backup creation".to_string(),
                path: backup_path,
                reason: e.to_string(),
            })?;
        }
        
        // Save the new baseline
        let format = crate::visual_testing::ImageLoader::get_format_from_path(baseline_path)?;
        crate::visual_testing::ImageLoader::save_image(new_baseline, baseline_path, format)?;
        
        // Return new checksum
        Self::calculate_image_checksum(new_baseline)
    }

    /// Handle dimension mismatch with detailed error information
    pub fn handle_dimension_mismatch(
        baseline_dims: (u32, u32),
        actual_dims: (u32, u32),
        context: &str,
    ) -> VisualError {
        VisualError::DimensionMismatch {
            baseline_width: baseline_dims.0,
            baseline_height: baseline_dims.1,
            actual_width: actual_dims.0,
            actual_height: actual_dims.1,
        }
    }

    /// Handle file I/O errors with context
    pub fn handle_io_error(operation: &str, path: &str, error: std::io::Error) -> VisualError {
        VisualError::FileSystemError {
            operation: operation.to_string(),
            path: path.to_string(),
            reason: error.to_string(),
        }
    }

    /// Graceful error handling for comparison operations
    pub fn safe_compare(
        baseline: &DynamicImage,
        actual: &DynamicImage,
        config: ComparisonConfig,
    ) -> VisualResult<ComparisonResult> {
        // Validate inputs first
        if let Err(validation_error) = Self::validate_comparison_inputs(baseline, actual, &config) {
            return Err(validation_error);
        }

        // Attempt comparison with error recovery
        match Self::compare(baseline, actual, config.clone()) {
            Ok(result) => Ok(result),
            Err(VisualError::DimensionMismatch { .. }) => {
                // Try to provide helpful suggestions for dimension mismatches
                let baseline_dims = baseline.dimensions();
                let actual_dims = actual.dimensions();
                
                // Check if it's a minor difference that could be auto-corrected
                let width_diff = baseline_dims.0.abs_diff(actual_dims.0);
                let height_diff = baseline_dims.1.abs_diff(actual_dims.1);
                
                if width_diff <= 10 && height_diff <= 10 {
                    // Minor difference - suggest retry or auto-crop
                    Err(VisualError::ConfigError {
                        message: format!(
                            "Minor dimension difference detected ({}x{} vs {}x{}). Consider using auto-crop or retrying capture.",
                            baseline_dims.0, baseline_dims.1, actual_dims.0, actual_dims.1
                        ),
                    })
                } else {
                    // Major difference - return original error
                    Err(Self::handle_dimension_mismatch(baseline_dims, actual_dims, "comparison"))
                }
            }
            Err(other_error) => Err(other_error),
        }
    }

    /// Validate comparison inputs
    fn validate_comparison_inputs(
        baseline: &DynamicImage,
        actual: &DynamicImage,
        config: &ComparisonConfig,
    ) -> VisualResult<()> {
        // Validate image dimensions are reasonable
        let baseline_dims = baseline.dimensions();
        let actual_dims = actual.dimensions();
        
        if baseline_dims.0 == 0 || baseline_dims.1 == 0 {
            return Err(VisualError::ConfigError {
                message: "Baseline image has zero dimensions".to_string(),
            });
        }
        
        if actual_dims.0 == 0 || actual_dims.1 == 0 {
            return Err(VisualError::ConfigError {
                message: "Actual image has zero dimensions".to_string(),
            });
        }

        // Validate configuration
        config.validate().map_err(|msg| VisualError::ConfigError { message: msg })?;

        // Check for extremely large images that might cause memory issues
        let baseline_pixels = baseline_dims.0 as u64 * baseline_dims.1 as u64;
        let actual_pixels = actual_dims.0 as u64 * actual_dims.1 as u64;
        let max_pixels = 50_000_000u64; // ~50 megapixels

        if baseline_pixels > max_pixels || actual_pixels > max_pixels {
            return Err(VisualError::InsufficientMemory {
                required_mb: ((baseline_pixels.max(actual_pixels) * 4) / (1024 * 1024)) as u32,
                available_mb: 512, // Placeholder - in real implementation would check actual memory
            });
        }

        Ok(())
    }

    /// Retry comparison with exponential backoff
    pub fn compare_with_retry(
        baseline: &DynamicImage,
        actual: &DynamicImage,
        config: ComparisonConfig,
        max_retries: u32,
    ) -> VisualResult<ComparisonResult> {
        let mut attempts = 0;
        let mut last_error = None;

        while attempts < max_retries {
            attempts += 1;

            match Self::safe_compare(baseline, actual, config.clone()) {
                Ok(result) => return Ok(result),
                Err(error) => {
                    last_error = Some(error.clone());
                    
                    // Don't retry for certain types of errors
                    match error {
                        VisualError::DimensionMismatch { .. } |
                        VisualError::UnsupportedFormat { .. } |
                        VisualError::ConfigError { .. } => {
                            // These errors won't be fixed by retrying
                            return Err(error);
                        }
                        _ => {
                            // Retry for other errors (I/O, memory, etc.)
                            if attempts < max_retries {
                                // Exponential backoff: 100ms, 200ms, 400ms, etc.
                                let delay_ms = 100u64 * (2u64.pow(attempts - 1));
                                std::thread::sleep(std::time::Duration::from_millis(delay_ms));
                            }
                        }
                    }
                }
            }
        }

        // All retries failed
        Err(VisualError::RetryLimitExceeded { max_retries })
    }

    /// Capture screen and compare with baseline in one operation
    pub fn capture_and_compare(
        baseline_path: &str,
        config: ComparisonConfig,
        capture_config: Option<crate::visual_testing::CaptureConfig>,
    ) -> VisualResult<ComparisonResult> {
        use crate::visual_testing::ScreenCapture;
        
        // Use default capture config if none provided
        let capture_config = capture_config.unwrap_or_default();
        
        // Capture screenshot with retry logic
        let capture_result = ScreenCapture::capture_with_retry(capture_config)
            .map_err(|e| VisualError::ScreenCaptureError {
                attempts: 3, // Default max retries
                reason: e.to_string(),
            })?;
        
        // Compare with baseline (auto-generate if needed)
        Self::compare_with_baseline_generation(baseline_path, &capture_result.image, config)
    }

    /// SSIM (Structural Similarity Index) comparison algorithm
    /// Provides perceptually-aware image comparison that's more tolerant to minor variations
    fn ssim_comparison(
        baseline: &DynamicImage,
        actual: &DynamicImage,
        config: &ComparisonConfig,
    ) -> VisualResult<f32> {
        let baseline_rgba = baseline.to_rgba8();
        let actual_rgba = actual.to_rgba8();
        
        let (width, height) = baseline.dimensions();
        
        // Create ignore mask if ignore regions are specified
        let ignore_mask = if !config.ignore_regions.is_empty() {
            Some(Self::create_ignore_mask(width, height, &config.ignore_regions)?)
        } else {
            None
        };

        // Convert to grayscale for SSIM calculation (more efficient and standard)
        let baseline_gray = Self::rgba_to_grayscale(&baseline_rgba);
        let actual_gray = Self::rgba_to_grayscale(&actual_rgba);
        
        // Calculate SSIM using sliding window approach
        let window_size = 11u32; // Standard SSIM window size
        let k1 = 0.01f64;
        let k2 = 0.03f64;
        let l = 255.0f64; // Dynamic range for 8-bit images
        let c1 = (k1 * l).powi(2);
        let c2 = (k2 * l).powi(2);
        
        let mut ssim_sum = 0.0f64;
        let mut window_count = 0u64;
        let mut ignored_windows = 0u64;
        
        // Slide window across image
        for y in 0..=(height.saturating_sub(window_size)) {
            for x in 0..=(width.saturating_sub(window_size)) {
                // Check if window overlaps with ignore regions
                if let Some(ref mask) = ignore_mask {
                    if Self::window_overlaps_ignore_region(x, y, window_size, mask) {
                        ignored_windows += 1;
                        continue;
                    }
                }
                
                let ssim_value = Self::calculate_ssim_window(
                    &baseline_gray, &actual_gray, 
                    x, y, window_size, width, height,
                    c1, c2
                );
                
                ssim_sum += ssim_value;
                window_count += 1;
            }
        }
        
        if window_count == 0 {
            // All windows were ignored - treat as perfect match
            return Ok(0.0);
        }
        
        // Calculate average SSIM
        let mean_ssim = ssim_sum / window_count as f64;
        
        // Convert SSIM to mismatch percentage
        // SSIM ranges from -1 to 1, where 1 is perfect match
        // We want 0% mismatch for SSIM = 1, and 100% mismatch for SSIM = -1
        let mismatch_percentage = ((1.0 - mean_ssim) / 2.0).max(0.0).min(1.0) as f32;
        
        Ok(mismatch_percentage)
    }
    
    /// Convert RGBA image to grayscale for SSIM calculation
    fn rgba_to_grayscale(rgba_image: &image::ImageBuffer<image::Rgba<u8>, Vec<u8>>) -> Vec<f64> {
        rgba_image.pixels()
            .map(|pixel| {
                let r = pixel[0] as f64;
                let g = pixel[1] as f64;
                let b = pixel[2] as f64;
                // Standard luminance formula
                0.299 * r + 0.587 * g + 0.114 * b
            })
            .collect()
    }
    
    /// Check if a window overlaps with any ignore region
    fn window_overlaps_ignore_region(
        x: u32, y: u32, window_size: u32,
        ignore_mask: &image::ImageBuffer<image::Luma<u8>, Vec<u8>>
    ) -> bool {
        for wy in y..y + window_size {
            for wx in x..x + window_size {
                if ignore_mask.get_pixel(wx, wy)[0] > 0 {
                    return true;
                }
            }
        }
        false
    }
    
    /// Calculate SSIM for a single window
    fn calculate_ssim_window(
        baseline_gray: &[f64], actual_gray: &[f64],
        x: u32, y: u32, window_size: u32, 
        image_width: u32, _image_height: u32,
        c1: f64, c2: f64
    ) -> f64 {
        let mut baseline_values = Vec::new();
        let mut actual_values = Vec::new();
        
        // Extract window pixels
        for wy in y..y + window_size {
            for wx in x..x + window_size {
                let idx = (wy * image_width + wx) as usize;
                baseline_values.push(baseline_gray[idx]);
                actual_values.push(actual_gray[idx]);
            }
        }
        
        // Calculate means
        let mu1 = baseline_values.iter().sum::<f64>() / baseline_values.len() as f64;
        let mu2 = actual_values.iter().sum::<f64>() / actual_values.len() as f64;
        
        // Calculate variances and covariance
        let mut sigma1_sq = 0.0f64;
        let mut sigma2_sq = 0.0f64;
        let mut sigma12 = 0.0f64;
        
        for i in 0..baseline_values.len() {
            let diff1 = baseline_values[i] - mu1;
            let diff2 = actual_values[i] - mu2;
            
            sigma1_sq += diff1 * diff1;
            sigma2_sq += diff2 * diff2;
            sigma12 += diff1 * diff2;
        }
        
        let n = baseline_values.len() as f64;
        sigma1_sq /= n - 1.0;
        sigma2_sq /= n - 1.0;
        sigma12 /= n - 1.0;
        
        // Calculate SSIM
        let numerator = (2.0 * mu1 * mu2 + c1) * (2.0 * sigma12 + c2);
        let denominator = (mu1 * mu1 + mu2 * mu2 + c1) * (sigma1_sq + sigma2_sq + c2);
        
        if denominator == 0.0 {
            1.0 // Perfect match if both windows are uniform
        } else {
            numerator / denominator
        }
    }

    /// Layout-aware comparison algorithm with shift tolerance
    /// Detects and tolerates small layout shifts while identifying content changes
    fn layout_aware_comparison(
        baseline: &DynamicImage,
        actual: &DynamicImage,
        config: &ComparisonConfig,
    ) -> VisualResult<f32> {
        let baseline_rgba = baseline.to_rgba8();
        let actual_rgba = actual.to_rgba8();
        
        let (width, height) = baseline.dimensions();
        let shift_tolerance = config.layout_shift_tolerance;
        
        // Create ignore mask if ignore regions are specified
        let ignore_mask = if !config.ignore_regions.is_empty() {
            Some(Self::create_ignore_mask(width, height, &config.ignore_regions)?)
        } else {
            None
        };

        // Phase 1: Edge detection for structural analysis
        let baseline_edges = Self::detect_edges(&baseline_rgba, width, height);
        let actual_edges = Self::detect_edges(&actual_rgba, width, height);
        
        // Phase 2: Downscale analysis for initial alignment check
        let scale_factor = 4u32; // 4x downscale for performance
        let downscaled_baseline = Self::downscale_image(&baseline_rgba, width, height, scale_factor);
        let downscaled_actual = Self::downscale_image(&actual_rgba, width, height, scale_factor);
        
        // Phase 3: Detect potential shifts using edge correlation
        let shift_vector = Self::detect_layout_shift(
            &baseline_edges, &actual_edges, 
            &downscaled_baseline, &downscaled_actual,
            width, height, shift_tolerance
        );
        
        // Phase 4: Full resolution comparison with shift compensation
        let mut different_pixels = 0u64;
        let mut total_pixels = 0u64;
        
        for y in 0..height {
            for x in 0..width {
                // Skip if pixel is in ignore region
                if let Some(ref mask) = ignore_mask {
                    if mask.get_pixel(x, y)[0] > 0 {
                        continue;
                    }
                }
                
                total_pixels += 1;
                
                let baseline_pixel = baseline_rgba.get_pixel(x, y);
                
                // Try to find matching pixel within shift tolerance
                let mut found_match = false;
                
                for dy in -(shift_tolerance as i32)..=(shift_tolerance as i32) {
                    for dx in -(shift_tolerance as i32)..=(shift_tolerance as i32) {
                        let shifted_x = (x as i32 + dx + shift_vector.0) as u32;
                        let shifted_y = (y as i32 + dy + shift_vector.1) as u32;
                        
                        if shifted_x < width && shifted_y < height {
                            let actual_pixel = actual_rgba.get_pixel(shifted_x, shifted_y);
                            
                            if Self::pixels_match(baseline_pixel, actual_pixel, config) {
                                found_match = true;
                                break;
                            }
                        }
                    }
                    if found_match { break; }
                }
                
                if !found_match {
                    different_pixels += 1;
                }
            }
        }
        
        let mismatch_percentage = if total_pixels > 0 {
            different_pixels as f32 / total_pixels as f32
        } else {
            0.0
        };
        
        Ok(mismatch_percentage)
    }
    
    /// Simple edge detection using Sobel operator
    fn detect_edges(
        image: &image::ImageBuffer<image::Rgba<u8>, Vec<u8>>,
        width: u32, height: u32
    ) -> Vec<f32> {
        let mut edges = vec![0.0f32; (width * height) as usize];
        
        // Convert to grayscale first
        let gray: Vec<f32> = image.pixels()
            .map(|pixel| {
                let r = pixel[0] as f32;
                let g = pixel[1] as f32;
                let b = pixel[2] as f32;
                0.299 * r + 0.587 * g + 0.114 * b
            })
            .collect();
        
        // Sobel kernels
        let sobel_x = [-1.0, 0.0, 1.0, -2.0, 0.0, 2.0, -1.0, 0.0, 1.0];
        let sobel_y = [-1.0, -2.0, -1.0, 0.0, 0.0, 0.0, 1.0, 2.0, 1.0];
        
        for y in 1..height-1 {
            for x in 1..width-1 {
                let mut gx = 0.0f32;
                let mut gy = 0.0f32;
                
                for ky in 0..3 {
                    for kx in 0..3 {
                        let px = x + kx - 1;
                        let py = y + ky - 1;
                        let idx = (py * width + px) as usize;
                        let kernel_idx = (ky * 3 + kx) as usize;
                        
                        gx += gray[idx] * sobel_x[kernel_idx];
                        gy += gray[idx] * sobel_y[kernel_idx];
                    }
                }
                
                let magnitude = (gx * gx + gy * gy).sqrt();
                edges[(y * width + x) as usize] = magnitude;
            }
        }
        
        edges
    }
    
    /// Downscale image for faster initial analysis
    fn downscale_image(
        image: &image::ImageBuffer<image::Rgba<u8>, Vec<u8>>,
        width: u32, height: u32,
        scale_factor: u32
    ) -> Vec<[u8; 4]> {
        let new_width = width / scale_factor;
        let new_height = height / scale_factor;
        let mut downscaled = Vec::new();
        
        for y in 0..new_height {
            for x in 0..new_width {
                // Sample from the center of each block
                let src_x = x * scale_factor + scale_factor / 2;
                let src_y = y * scale_factor + scale_factor / 2;
                
                if src_x < width && src_y < height {
                    let pixel = image.get_pixel(src_x, src_y);
                    downscaled.push([pixel[0], pixel[1], pixel[2], pixel[3]]);
                } else {
                    downscaled.push([0, 0, 0, 0]);
                }
            }
        }
        
        downscaled
    }
    
    /// Detect layout shift using edge correlation and downscaled comparison
    fn detect_layout_shift(
        baseline_edges: &[f32], actual_edges: &[f32],
        _downscaled_baseline: &[[u8; 4]], _downscaled_actual: &[[u8; 4]],
        width: u32, height: u32,
        max_shift: u32
    ) -> (i32, i32) {
        let mut best_correlation = -1.0f32;
        let mut best_shift = (0i32, 0i32);
        
        // Search for best shift within tolerance
        for dy in -(max_shift as i32)..=(max_shift as i32) {
            for dx in -(max_shift as i32)..=(max_shift as i32) {
                let correlation = Self::calculate_edge_correlation(
                    baseline_edges, actual_edges, 
                    width, height, dx, dy
                );
                
                if correlation > best_correlation {
                    best_correlation = correlation;
                    best_shift = (dx, dy);
                }
            }
        }
        
        // Only return shift if correlation is significantly better than no shift
        let no_shift_correlation = Self::calculate_edge_correlation(
            baseline_edges, actual_edges, width, height, 0, 0
        );
        
        if best_correlation > no_shift_correlation + 0.1 {
            best_shift
        } else {
            (0, 0)
        }
    }
    
    /// Calculate correlation between edge maps with given shift
    fn calculate_edge_correlation(
        baseline_edges: &[f32], actual_edges: &[f32],
        width: u32, height: u32,
        shift_x: i32, shift_y: i32
    ) -> f32 {
        let mut correlation = 0.0f32;
        let mut count = 0u32;
        
        for y in 0..height {
            for x in 0..width {
                let shifted_x = x as i32 + shift_x;
                let shifted_y = y as i32 + shift_y;
                
                if shifted_x >= 0 && shifted_x < width as i32 && 
                   shifted_y >= 0 && shifted_y < height as i32 {
                    let baseline_idx = (y * width + x) as usize;
                    let actual_idx = (shifted_y as u32 * width + shifted_x as u32) as usize;
                    
                    correlation += baseline_edges[baseline_idx] * actual_edges[actual_idx];
                    count += 1;
                }
            }
        }
        
        if count > 0 {
            correlation / count as f32
        } else {
            0.0
        }
    }

    /// Enhanced error recovery for common issues
    pub fn recover_from_error(
        error: &VisualError,
        baseline: &DynamicImage,
        actual: &DynamicImage,
        config: &ComparisonConfig,
    ) -> Option<VisualResult<ComparisonResult>> {
        match error {
            VisualError::DimensionMismatch { baseline_width, baseline_height, actual_width, actual_height } => {
                // Try auto-cropping for minor differences
                let width_diff = baseline_width.abs_diff(*actual_width);
                let height_diff = baseline_height.abs_diff(*actual_height);
                
                if width_diff <= 5 && height_diff <= 5 {
                    // Attempt auto-crop to smaller dimensions
                    let crop_width = (*baseline_width).min(*actual_width);
                    let crop_height = (*baseline_height).min(*actual_height);
                    
                    if crop_width > 0 && crop_height > 0 {
                        let crop_region = Region::new(0, 0, crop_width, crop_height);
                        
                        if let (Ok(baseline_cropped), Ok(actual_cropped)) = (
                            Self::crop_image(baseline, &crop_region),
                            Self::crop_image(actual, &crop_region)
                        ) {
                            return Some(Self::compare(&baseline_cropped, &actual_cropped, config.clone()));
                        }
                    }
                }
                None
            }
            _ => None, // No recovery available for other error types
        }
    }
}
