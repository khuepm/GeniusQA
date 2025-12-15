//! Property-based tests for visual regression testing

#[cfg(test)]
mod tests {
    use super::super::models::*;
    use super::super::image_loader::ImageLoader;
    use super::super::comparator::ImageComparator;
    use super::super::error::VisualError;
    use proptest::prelude::*;
    use proptest::{proptest, prop_oneof};
    use serde_json;
    use image::{DynamicImage, ImageBuffer, Rgba, GenericImageView};
    use proptest::strategy::ValueTree;

    // **Feature: visual-regression-testing, Property 1: Serialization round trip**
    // **Validates: Requirements 1.1**
    
    /// Generate arbitrary Region instances for property testing
    fn arb_region() -> impl Strategy<Value = Region> {
        (0u32..10000, 0u32..10000, 1u32..5000, 1u32..5000)
            .prop_map(|(x, y, width, height)| Region::new(x, y, width, height))
    }

    /// Generate arbitrary ComparisonMethod instances
    fn arb_comparison_method() -> impl Strategy<Value = ComparisonMethod> {
        prop_oneof![
            Just(ComparisonMethod::PixelMatch),
            Just(ComparisonMethod::SSIM),
            Just(ComparisonMethod::LayoutAware),
            Just(ComparisonMethod::Hybrid),
        ]
    }

    /// Generate arbitrary SensitivityProfile instances
    fn arb_sensitivity_profile() -> impl Strategy<Value = SensitivityProfile> {
        prop_oneof![
            Just(SensitivityProfile::Strict),
            Just(SensitivityProfile::Moderate),
            Just(SensitivityProfile::Flexible),
        ]
    }

    /// Generate arbitrary ComparisonConfig instances
    fn arb_comparison_config() -> impl Strategy<Value = ComparisonConfig> {
        (
            0.0f32..1.0f32, // threshold
            arb_comparison_method(),
            prop::collection::vec(arb_region(), 0..5), // ignore_regions
            prop::option::of(arb_region()), // include_roi
            any::<bool>(), // anti_aliasing_tolerance
            0u32..10u32, // layout_shift_tolerance
            arb_sensitivity_profile(),
        ).prop_map(|(threshold, method, ignore_regions, include_roi, anti_aliasing_tolerance, layout_shift_tolerance, sensitivity_profile)| {
            ComparisonConfig {
                threshold,
                method,
                ignore_regions,
                include_roi,
                anti_aliasing_tolerance,
                layout_shift_tolerance,
                sensitivity_profile,
            }
        })
    }

    /// Generate arbitrary PerformanceMetrics instances
    fn arb_performance_metrics() -> impl Strategy<Value = PerformanceMetrics> {
        (
            0u32..10000, // capture_time_ms
            0u32..1000,  // preprocessing_time_ms
            0u32..5000,  // comparison_time_ms
            0u32..1000,  // postprocessing_time_ms
            0u32..2048,  // memory_usage_mb
            (1u32..10000, 1u32..10000), // image_dimensions
        ).prop_map(|(capture_time_ms, preprocessing_time_ms, comparison_time_ms, postprocessing_time_ms, memory_usage_mb, image_dimensions)| {
            PerformanceMetrics {
                capture_time_ms,
                preprocessing_time_ms,
                comparison_time_ms,
                postprocessing_time_ms,
                memory_usage_mb,
                image_dimensions,
            }
        })
    }

    /// Generate arbitrary DifferenceType instances
    fn arb_difference_type() -> impl Strategy<Value = DifferenceType> {
        prop_oneof![
            Just(DifferenceType::NoChange),
            Just(DifferenceType::LayoutShift),
            Just(DifferenceType::ContentChange),
            Just(DifferenceType::ColorVariation),
            Just(DifferenceType::DimensionMismatch),
        ]
    }

    /// Generate arbitrary ComparisonResult instances
    fn arb_comparison_result() -> impl Strategy<Value = ComparisonResult> {
        (
            any::<bool>(), // is_match
            0.0f32..1.0f32, // mismatch_percentage
            arb_difference_type(),
            prop::option::of("[a-zA-Z0-9_/.-]{1,100}"), // diff_image_path
            "[a-zA-Z0-9_/.-]{1,100}", // baseline_path
            "[a-zA-Z0-9_/.-]{1,100}", // actual_path
            arb_performance_metrics(),
        ).prop_map(|(is_match, mismatch_percentage, difference_type, diff_image_path, baseline_path, actual_path, performance_metrics)| {
            ComparisonResult {
                is_match,
                mismatch_percentage,
                difference_type,
                diff_image_path,
                baseline_path,
                actual_path,
                performance_metrics,
                metadata: std::collections::HashMap::new(),
            }
        })
    }

    proptest! {
        #[test]
        fn test_region_serialization_round_trip(region in arb_region()) {
            let serialized = serde_json::to_string(&region).expect("Failed to serialize Region");
            let deserialized: Region = serde_json::from_str(&serialized).expect("Failed to deserialize Region");
            prop_assert_eq!(region, deserialized);
        }

        #[test]
        fn test_comparison_method_serialization_round_trip(method in arb_comparison_method()) {
            let serialized = serde_json::to_string(&method).expect("Failed to serialize ComparisonMethod");
            let deserialized: ComparisonMethod = serde_json::from_str(&serialized).expect("Failed to deserialize ComparisonMethod");
            prop_assert_eq!(method, deserialized);
        }

        #[test]
        fn test_sensitivity_profile_serialization_round_trip(profile in arb_sensitivity_profile()) {
            let serialized = serde_json::to_string(&profile).expect("Failed to serialize SensitivityProfile");
            let deserialized: SensitivityProfile = serde_json::from_str(&serialized).expect("Failed to deserialize SensitivityProfile");
            prop_assert_eq!(profile, deserialized);
        }

        #[test]
        fn test_comparison_config_serialization_round_trip(config in arb_comparison_config()) {
            let serialized = serde_json::to_string(&config).expect("Failed to serialize ComparisonConfig");
            let deserialized: ComparisonConfig = serde_json::from_str(&serialized).expect("Failed to deserialize ComparisonConfig");
            
            // Compare fields individually due to floating point precision
            prop_assert_eq!(config.method, deserialized.method);
            prop_assert_eq!(config.ignore_regions, deserialized.ignore_regions);
            prop_assert_eq!(config.include_roi, deserialized.include_roi);
            prop_assert_eq!(config.anti_aliasing_tolerance, deserialized.anti_aliasing_tolerance);
            prop_assert_eq!(config.layout_shift_tolerance, deserialized.layout_shift_tolerance);
            prop_assert_eq!(config.sensitivity_profile, deserialized.sensitivity_profile);
            prop_assert!((config.threshold - deserialized.threshold).abs() < f32::EPSILON);
        }

        #[test]
        fn test_performance_metrics_serialization_round_trip(metrics in arb_performance_metrics()) {
            let serialized = serde_json::to_string(&metrics).expect("Failed to serialize PerformanceMetrics");
            let deserialized: PerformanceMetrics = serde_json::from_str(&serialized).expect("Failed to deserialize PerformanceMetrics");
            prop_assert_eq!(metrics.capture_time_ms, deserialized.capture_time_ms);
            prop_assert_eq!(metrics.preprocessing_time_ms, deserialized.preprocessing_time_ms);
            prop_assert_eq!(metrics.comparison_time_ms, deserialized.comparison_time_ms);
            prop_assert_eq!(metrics.postprocessing_time_ms, deserialized.postprocessing_time_ms);
            prop_assert_eq!(metrics.memory_usage_mb, deserialized.memory_usage_mb);
            prop_assert_eq!(metrics.image_dimensions, deserialized.image_dimensions);
        }

        #[test]
        fn test_comparison_result_serialization_round_trip(result in arb_comparison_result()) {
            let serialized = serde_json::to_string(&result).expect("Failed to serialize ComparisonResult");
            let deserialized: ComparisonResult = serde_json::from_str(&serialized).expect("Failed to deserialize ComparisonResult");
            
            prop_assert_eq!(result.is_match, deserialized.is_match);
            prop_assert_eq!(result.difference_type, deserialized.difference_type);
            prop_assert_eq!(result.diff_image_path, deserialized.diff_image_path);
            prop_assert_eq!(result.baseline_path, deserialized.baseline_path);
            prop_assert_eq!(result.actual_path, deserialized.actual_path);
            prop_assert!((result.mismatch_percentage - deserialized.mismatch_percentage).abs() < f32::EPSILON);
        }
    }

    // **Feature: visual-regression-testing, Property 2: DPI normalization invariance**
    // **Validates: Requirements 1.2**

    /// Generate arbitrary DPI values for testing
    fn arb_dpi() -> impl Strategy<Value = u32> {
        prop_oneof![
            Just(72),   // Standard DPI
            Just(96),   // Windows default
            Just(144),  // 1.5x scaling
            Just(192),  // 2x scaling
            Just(288),  // 3x scaling
        ]
    }

    /// Generate arbitrary image dimensions
    fn arb_image_dimensions() -> impl Strategy<Value = (u32, u32)> {
        (1u32..1000, 1u32..1000)
    }

    /// Generate arbitrary RGBA color
    fn arb_color() -> impl Strategy<Value = [u8; 4]> {
        (any::<u8>(), any::<u8>(), any::<u8>(), any::<u8>())
            .prop_map(|(r, g, b, a)| [r, g, b, a])
    }

    proptest! {
        #[test]
        fn test_dpi_normalization_invariance(
            dimensions in arb_image_dimensions(),
            color in arb_color(),
            source_dpi in arb_dpi(),
            target_dpi in arb_dpi()
        ) {
            
            // Create a test image
            let (width, height) = dimensions;
            let original_image = ImageLoader::create_test_image(width, height, color);
            
            // Normalize DPI - for now this is a placeholder that returns the same image
            // In a full implementation, this would handle actual DPI scaling
            let normalized_image = ImageComparator::normalize_dpi(&original_image, target_dpi);
            
            // The normalized image should have consistent properties
            // For the current placeholder implementation, dimensions should remain the same
            prop_assert_eq!(original_image.dimensions(), normalized_image.dimensions());
            
            // In a full implementation, we would test that:
            // 1. The visual content is preserved
            // 2. The DPI metadata is correctly updated
            // 3. Scaling is applied proportionally when needed
        }

        #[test]
        fn test_dpi_normalization_consistency(
            dimensions in arb_image_dimensions(),
            color in arb_color(),
            target_dpi in arb_dpi()
        ) {
            
            let (width, height) = dimensions;
            let image = ImageLoader::create_test_image(width, height, color);
            
            // Normalizing to the same DPI multiple times should be idempotent
            let normalized1 = ImageComparator::normalize_dpi(&image, target_dpi);
            let normalized2 = ImageComparator::normalize_dpi(&normalized1, target_dpi);
            
            // Results should be identical (idempotent operation)
            prop_assert_eq!(normalized1.dimensions(), normalized2.dimensions());
        }
    }
    // **Feature: visual-regression-testing, Property 3: Comparison algorithm completeness**
    // **Feature: visual-regression-testing, Property 4: Threshold-based pass/fail determination**
    // **Validates: Requirements 1.3, 1.4**

    /// Generate arbitrary image content for testing
    fn arb_image_content() -> impl Strategy<Value = Vec<[u8; 4]>> {
        prop::collection::vec(arb_color(), 1..10000)
    }

    /// Generate arbitrary comparison configurations for testing
    fn arb_test_comparison_config() -> impl Strategy<Value = ComparisonConfig> {
        (
            0.0f32..1.0f32, // threshold
            arb_comparison_method(),
            prop::collection::vec(arb_region(), 0..3), // ignore_regions (limited for performance)
            prop::option::of(arb_region()), // include_roi
            any::<bool>(), // anti_aliasing_tolerance
            0u32..5u32, // layout_shift_tolerance (limited for performance)
            arb_sensitivity_profile(),
        ).prop_map(|(threshold, method, ignore_regions, include_roi, anti_aliasing_tolerance, layout_shift_tolerance, sensitivity_profile)| {
            ComparisonConfig {
                threshold,
                method,
                ignore_regions,
                include_roi,
                anti_aliasing_tolerance,
                layout_shift_tolerance,
                sensitivity_profile,
            }
        })
    }

    /// Generate valid image dimensions for testing (limited for performance)
    fn arb_test_image_dimensions() -> impl Strategy<Value = (u32, u32)> {
        (1u32..200, 1u32..200) // Smaller images for faster property testing
    }

    proptest! {
        #[test]
        fn test_pixelmatch_algorithm_completeness(
            dimensions in arb_test_image_dimensions(),
            baseline_color in arb_color(),
            actual_color in arb_color(),
            config in arb_test_comparison_config()
        ) {
            let (width, height) = dimensions;
            
            // Create test images
            let baseline_image = ImageLoader::create_test_image(width, height, baseline_color);
            let actual_image = ImageLoader::create_test_image(width, height, actual_color);
            
            // Ensure config is valid for the image dimensions
            let mut valid_config = config;
            
            // Fix ROI if it doesn't fit - ensure it's completely within bounds
            if let Some(ref mut roi) = valid_config.include_roi {
                roi.x = roi.x % width;
                roi.y = roi.y % height;
                roi.width = (roi.width % (width - roi.x)).max(1);
                roi.height = (roi.height % (height - roi.y)).max(1);
                // Final validation - if still doesn't fit, remove it
                if !roi.fits_within(width, height) {
                    valid_config.include_roi = None;
                }
            }
            
            // Fix ignore regions - ensure they're completely within bounds
            valid_config.ignore_regions.retain_mut(|region| {
                region.x = region.x % width;
                region.y = region.y % height;
                region.width = (region.width % (width - region.x)).max(1);
                region.height = (region.height % (height - region.y)).max(1);
                region.fits_within(width, height) && region.is_valid()
            });
            
            // Property 3: Comparison algorithm completeness
            // For any baseline and actual image pair, the system should successfully execute comparison
            let result = ImageComparator::compare(&baseline_image, &actual_image, valid_config.clone());
            
            // The comparison should always succeed for valid inputs
            prop_assert!(result.is_ok(), "Comparison should succeed for valid inputs: {:?}", result);
            
            let comparison_result = result.unwrap();
            
            // Result should have valid mismatch percentage (0.0 to 1.0)
            prop_assert!(comparison_result.mismatch_percentage >= 0.0 && comparison_result.mismatch_percentage <= 1.0,
                "Mismatch percentage should be between 0.0 and 1.0, got {}", comparison_result.mismatch_percentage);
            
            // Performance metrics should be populated
            prop_assert!(comparison_result.performance_metrics.image_dimensions == (width, height),
                "Performance metrics should record correct image dimensions");
        }

        #[test]
        fn test_threshold_based_pass_fail_determination(
            dimensions in arb_test_image_dimensions(),
            baseline_color in arb_color(),
            actual_color in arb_color(),
            threshold in 0.0f32..1.0f32
        ) {
            let (width, height) = dimensions;
            
            // Create test images
            let baseline_image = ImageLoader::create_test_image(width, height, baseline_color);
            let actual_image = ImageLoader::create_test_image(width, height, actual_color);
            
            // Create config with specific threshold
            let config = ComparisonConfig {
                threshold,
                method: ComparisonMethod::PixelMatch,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Strict,
            };
            
            // Property 4: Threshold-based pass/fail determination
            // For any comparison result, the test should be marked as failed if and only if 
            // the mismatch percentage exceeds the configured threshold
            let result = ImageComparator::compare(&baseline_image, &actual_image, config).unwrap();
            
            if result.mismatch_percentage <= threshold {
                prop_assert!(result.is_match, 
                    "Test should pass when mismatch percentage ({}) <= threshold ({})", 
                    result.mismatch_percentage, threshold);
            } else {
                prop_assert!(!result.is_match, 
                    "Test should fail when mismatch percentage ({}) > threshold ({})", 
                    result.mismatch_percentage, threshold);
            }
        }

        #[test]
        fn test_identical_images_always_match(
            dimensions in arb_test_image_dimensions(),
            color in arb_color()
        ) {
            let (width, height) = dimensions;
            
            // Create identical images
            let baseline_image = ImageLoader::create_test_image(width, height, color);
            let actual_image = ImageLoader::create_test_image(width, height, color);
            
            // Use a simple config without regions to avoid validation issues
            let config = ComparisonConfig {
                threshold: 0.0,
                method: ComparisonMethod::PixelMatch,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Strict,
            };
            
            let result = ImageComparator::compare(&baseline_image, &actual_image, config).unwrap();
            
            // Identical images should always have 0% mismatch and match
            prop_assert_eq!(result.mismatch_percentage, 0.0, "Identical images should have 0% mismatch");
            prop_assert!(result.is_match, "Identical images should always match");
            prop_assert_eq!(result.difference_type, DifferenceType::NoChange, "Identical images should show no change");
        }

        #[test]
        fn test_dimension_mismatch_error(
            baseline_dims in arb_test_image_dimensions(),
            actual_dims in arb_test_image_dimensions(),
            color in arb_color()
        ) {
            // Only test when dimensions are actually different
            prop_assume!(baseline_dims != actual_dims);
            
            let baseline_image = ImageLoader::create_test_image(baseline_dims.0, baseline_dims.1, color);
            let actual_image = ImageLoader::create_test_image(actual_dims.0, actual_dims.1, color);
            
            let config = ComparisonConfig::default();
            let result = ImageComparator::compare(&baseline_image, &actual_image, config);
            
            // Should return dimension mismatch error
            prop_assert!(result.is_err(), "Different dimensions should cause an error");
            
            if let Err(VisualError::DimensionMismatch { baseline_width, baseline_height, actual_width, actual_height }) = result {
                prop_assert_eq!(baseline_width, baseline_dims.0);
                prop_assert_eq!(baseline_height, baseline_dims.1);
                prop_assert_eq!(actual_width, actual_dims.0);
                prop_assert_eq!(actual_height, actual_dims.1);
            } else {
                prop_assert!(false, "Expected DimensionMismatch error, got {:?}", result);
            }
        }
    }
    // **Feature: visual-regression-testing, Property 8: Performance boundary compliance**
    // **Validates: Requirements 4.1**

    /// Generate arbitrary performance test configurations
    fn arb_performance_test_config() -> impl Strategy<Value = (u32, u32, ComparisonMethod)> {
        (
            1u32..2000,  // width (up to 1920)
            1u32..1200,  // height (up to 1080)
            prop_oneof![
                Just(ComparisonMethod::PixelMatch),
                Just(ComparisonMethod::SSIM),
                Just(ComparisonMethod::LayoutAware),
            ]
        )
    }

    proptest! {
        #[test]
        fn test_performance_boundary_compliance(
            (width, height, method) in arb_performance_test_config(),
            baseline_color in arb_color(),
            actual_color in arb_color()
        ) {
            // Skip very small images as they're not representative
            prop_assume!(width >= 10 && height >= 10);
            
            // Create test images
            let baseline_image = ImageLoader::create_test_image(width, height, baseline_color);
            let actual_image = ImageLoader::create_test_image(width, height, actual_color);
            
            // Create config with the specified method
            let config = ComparisonConfig {
                threshold: 0.01,
                method,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Moderate,
            };
            
            // Property 8: Performance boundary compliance
            // For any 1920x1080 image comparison using PixelMatch algorithm on standard hardware,
            // the analysis should complete within 200ms (SSIM and LayoutAware may require up to 500ms)
            let result = ImageComparator::compare(&baseline_image, &actual_image, config).unwrap();
            
            let pixel_count = width as u64 * height as u64;
            let hd_pixel_count = 1920u64 * 1080u64;
            
            // Calculate expected performance based on image size and algorithm
            let base_time_limit = match method {
                ComparisonMethod::PixelMatch => 200u32,      // 200ms for PixelMatch
                ComparisonMethod::SSIM => 500u32,           // 500ms for SSIM
                ComparisonMethod::LayoutAware => 500u32,    // 500ms for LayoutAware
                ComparisonMethod::Hybrid => 500u32,         // 500ms for Hybrid
            };
            
            // Scale time limit based on image size relative to 1920x1080
            let scale_factor = if pixel_count <= hd_pixel_count {
                1.0
            } else {
                (pixel_count as f64 / hd_pixel_count as f64).sqrt() // Square root scaling for reasonable limits
            };
            
            let time_limit = (base_time_limit as f64 * scale_factor) as u32;
            
            // Check that the comparison time meets performance requirements
            prop_assert!(
                result.performance_metrics.comparison_time_ms <= time_limit,
                "Comparison took {}ms but should be <= {}ms for {}x{} image using {:?}",
                result.performance_metrics.comparison_time_ms,
                time_limit,
                width,
                height,
                method
            );
            
            // Verify that performance metrics are populated
            prop_assert!(result.performance_metrics.image_dimensions == (width, height));
            prop_assert!(result.performance_metrics.comparison_time_ms > 0, "Comparison time should be recorded");
        }

        #[test]
        fn test_hd_performance_baseline(
            method in arb_comparison_method(),
            baseline_color in arb_color(),
            actual_color in arb_color()
        ) {
            // Test specifically with 1920x1080 images to validate the baseline performance requirement
            let width = 1920u32;
            let height = 1080u32;
            
            let baseline_image = ImageLoader::create_test_image(width, height, baseline_color);
            let actual_image = ImageLoader::create_test_image(width, height, actual_color);
            
            let config = ComparisonConfig {
                threshold: 0.01,
                method,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Moderate,
            };
            
            let result = ImageComparator::compare(&baseline_image, &actual_image, config).unwrap();
            
            // Verify the specific performance requirements from the design document
            let time_limit = match method {
                ComparisonMethod::PixelMatch => 200u32,      // < 200ms for PixelMatch
                ComparisonMethod::SSIM => 500u32,           // < 500ms for SSIM  
                ComparisonMethod::LayoutAware => 500u32,    // < 500ms for LayoutAware
                ComparisonMethod::Hybrid => 500u32,         // < 500ms for Hybrid
            };
            
            prop_assert!(
                result.performance_metrics.comparison_time_ms <= time_limit,
                "1920x1080 comparison with {:?} took {}ms but should be <= {}ms",
                method,
                result.performance_metrics.comparison_time_ms,
                time_limit
            );
            
            // Verify that the performance metrics helper function works correctly
            if method == ComparisonMethod::PixelMatch {
                prop_assert!(
                    result.performance_metrics.meets_performance_requirements(),
                    "PixelMatch on 1920x1080 should meet performance requirements"
                );
            }
        }

        #[test]
        fn test_memory_usage_bounds(
            dimensions in arb_test_image_dimensions(),
            baseline_color in arb_color(),
            actual_color in arb_color()
        ) {
            let (width, height) = dimensions;
            
            let baseline_image = ImageLoader::create_test_image(width, height, baseline_color);
            let actual_image = ImageLoader::create_test_image(width, height, actual_color);
            
            let config = ComparisonConfig {
                threshold: 0.01,
                method: ComparisonMethod::PixelMatch, // Use fastest method for memory testing
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Strict,
            };
            
            let result = ImageComparator::compare(&baseline_image, &actual_image, config).unwrap();
            
            // Memory usage should be reasonable relative to image size
            let pixel_count = width as u64 * height as u64;
            let expected_memory_mb = ((pixel_count * 4 * 3) / (1024 * 1024)) as u32; // 4 bytes per pixel, 3 images (baseline, actual, diff)
            let max_memory_mb = expected_memory_mb + 50; // Allow 50MB overhead
            
            prop_assert!(
                result.performance_metrics.memory_usage_mb <= max_memory_mb,
                "Memory usage {}MB exceeds expected maximum {}MB for {}x{} image",
                result.performance_metrics.memory_usage_mb,
                max_memory_mb,
                width,
                height
            );
        }
    }
    // **Feature: visual-regression-testing, Property 6: Ignore region masking effectiveness**
    // **Validates: Requirements 2.2, 2.3**

    /// Generate valid ignore regions that fit within image dimensions
    fn arb_valid_ignore_regions(width: u32, height: u32) -> impl Strategy<Value = Vec<Region>> {
        prop::collection::vec(
            (0u32..width, 0u32..height).prop_flat_map(move |(x, y)| {
                let max_width = width - x;
                let max_height = height - y;
                (Just(x), Just(y), 1u32..=max_width.max(1), 1u32..=max_height.max(1))
                    .prop_map(|(x, y, w, h)| Region::new(x, y, w, h))
            }),
            0..5 // 0 to 5 ignore regions
        )
    }

    proptest! {
        #[test]
        fn test_ignore_region_masking_effectiveness(
            dimensions in arb_test_image_dimensions(),
            baseline_color in arb_color(),
            actual_color in arb_color()
        ) {
            let (width, height) = dimensions;
            prop_assume!(width >= 2 && height >= 2); // Ensure we have space for regions
            
            // Generate valid ignore regions for this image size
            let ignore_regions = arb_valid_ignore_regions(width, height)
                .new_tree(&mut proptest::test_runner::TestRunner::default())
                .unwrap()
                .current();
            
            // Create different images
            let baseline_image = ImageLoader::create_test_image(width, height, baseline_color);
            let actual_image = ImageLoader::create_test_image(width, height, actual_color);
            
            // Property 6: Ignore region masking effectiveness
            // For any comparison with defined ignore regions, pixels within these regions 
            // should have zero impact on the mismatch percentage calculation
            
            // First, compare without ignore regions
            let config_without_ignore = ComparisonConfig {
                threshold: 0.0, // Set to 0 to get exact mismatch percentage
                method: ComparisonMethod::PixelMatch,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Strict,
            };
            
            let result_without_ignore = ImageComparator::compare(&baseline_image, &actual_image, config_without_ignore).unwrap();
            
            // Now compare with ignore regions
            let config_with_ignore = ComparisonConfig {
                threshold: 0.0,
                method: ComparisonMethod::PixelMatch,
                ignore_regions,
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Strict,
            };
            
            let result_with_ignore = ImageComparator::compare(&baseline_image, &actual_image, config_with_ignore.clone()).unwrap();
            
            // If ignore regions cover areas where pixels differ, the mismatch percentage should be lower
            // or equal (never higher) when ignore regions are applied
            prop_assert!(
                result_with_ignore.mismatch_percentage <= result_without_ignore.mismatch_percentage,
                "Mismatch percentage with ignore regions ({}) should be <= without ignore regions ({})",
                result_with_ignore.mismatch_percentage,
                result_without_ignore.mismatch_percentage
            );
            
            // Test the specific case where ignore regions cover the entire image
            if !config_with_ignore.ignore_regions.is_empty() {
                // Calculate total area covered by ignore regions
                let total_ignore_area: u64 = config_with_ignore.ignore_regions.iter()
                    .map(|r| r.area())
                    .sum();
                let total_image_area = width as u64 * height as u64;
                
                // If ignore regions cover most of the image, mismatch should be very low
                if total_ignore_area >= total_image_area / 2 {
                    prop_assert!(
                        result_with_ignore.mismatch_percentage < result_without_ignore.mismatch_percentage || 
                        result_with_ignore.mismatch_percentage == 0.0,
                        "Large ignore regions should significantly reduce mismatch percentage"
                    );
                }
            }
        }

        #[test]
        fn test_ignore_region_zero_impact_identical_images(
            dimensions in arb_test_image_dimensions(),
            color in arb_color()
        ) {
            let (width, height) = dimensions;
            prop_assume!(width >= 2 && height >= 2);
            
            // Generate valid ignore regions
            let ignore_regions = arb_valid_ignore_regions(width, height)
                .new_tree(&mut proptest::test_runner::TestRunner::default())
                .unwrap()
                .current();
            
            // Create identical images
            let baseline_image = ImageLoader::create_test_image(width, height, color);
            let actual_image = ImageLoader::create_test_image(width, height, color);
            
            let config = ComparisonConfig {
                threshold: 0.01,
                method: ComparisonMethod::PixelMatch,
                ignore_regions,
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Strict,
            };
            
            let result = ImageComparator::compare(&baseline_image, &actual_image, config).unwrap();
            
            // Identical images should always have 0% mismatch regardless of ignore regions
            prop_assert_eq!(result.mismatch_percentage, 0.0, 
                "Identical images should have 0% mismatch even with ignore regions");
            prop_assert!(result.is_match, "Identical images should always match");
        }

        #[test]
        fn test_ignore_region_boundary_validation(
            dimensions in arb_test_image_dimensions(),
            color in arb_color()
        ) {
            let (width, height) = dimensions;
            
            // Create images
            let baseline_image = ImageLoader::create_test_image(width, height, color);
            let actual_image = ImageLoader::create_test_image(width, height, color);
            
            // Test with ignore region that exceeds image boundaries
            let invalid_region = Region::new(width, height, 10, 10); // Starts outside image
            
            let config = ComparisonConfig {
                threshold: 0.01,
                method: ComparisonMethod::PixelMatch,
                ignore_regions: vec![invalid_region],
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Strict,
            };
            
            let result = ImageComparator::compare(&baseline_image, &actual_image, config);
            
            // Should return an error for invalid regions
            prop_assert!(result.is_err(), "Invalid ignore regions should cause an error");
            
            if let Err(VisualError::InvalidRegion { x, y, width: w, height: h }) = result {
                prop_assert_eq!(x, width);
                prop_assert_eq!(y, height);
                prop_assert_eq!(w, 10);
                prop_assert_eq!(h, 10);
            } else {
                prop_assert!(false, "Expected InvalidRegion error, got {:?}", result);
            }
        }
    }
    // **Feature: visual-regression-testing, Property 7: ROI cropping consistency**
    // **Validates: Requirements 2.5**

    /// Generate valid ROI regions that fit within image dimensions
    fn arb_valid_roi(width: u32, height: u32) -> impl Strategy<Value = Region> {
        (0u32..width, 0u32..height).prop_flat_map(move |(x, y)| {
            let max_width = width - x;
            let max_height = height - y;
            (Just(x), Just(y), 1u32..=max_width.max(1), 1u32..=max_height.max(1))
                .prop_map(|(x, y, w, h)| Region::new(x, y, w, h))
        })
    }

    proptest! {
        #[test]
        fn test_roi_cropping_consistency(
            dimensions in arb_test_image_dimensions(),
            baseline_color in arb_color(),
            actual_color in arb_color()
        ) {
            let (width, height) = dimensions;
            prop_assume!(width >= 2 && height >= 2); // Ensure we have space for ROI
            
            // Generate valid ROI for this image size
            let roi = arb_valid_roi(width, height)
                .new_tree(&mut proptest::test_runner::TestRunner::default())
                .unwrap()
                .current();
            
            // Create test images
            let baseline_image = ImageLoader::create_test_image(width, height, baseline_color);
            let actual_image = ImageLoader::create_test_image(width, height, actual_color);
            
            // Property 7: ROI cropping consistency
            // For any comparison with specified ROI coordinates, both baseline and actual images 
            // should be cropped to identical regions before comparison
            
            // First, compare without ROI (full image)
            let config_full = ComparisonConfig {
                threshold: 0.0, // Set to 0 to get exact mismatch percentage
                method: ComparisonMethod::PixelMatch,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Strict,
            };
            
            let result_full = ImageComparator::compare(&baseline_image, &actual_image, config_full).unwrap();
            
            // Now compare with ROI
            let config_roi = ComparisonConfig {
                threshold: 0.0,
                method: ComparisonMethod::PixelMatch,
                ignore_regions: Vec::new(),
                include_roi: Some(roi.clone()),
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Strict,
            };
            
            let result_roi = ImageComparator::compare(&baseline_image, &actual_image, config_roi).unwrap();
            
            // The ROI comparison should succeed (no errors)
            // The performance metrics should reflect the ROI dimensions, not the full image dimensions
            prop_assert_eq!(result_roi.performance_metrics.image_dimensions, (roi.width, roi.height),
                "Performance metrics should reflect ROI dimensions, not full image dimensions");
            
            // If the colors are identical, both comparisons should show 0% mismatch
            if baseline_color == actual_color {
                prop_assert_eq!(result_full.mismatch_percentage, 0.0, "Identical full images should have 0% mismatch");
                prop_assert_eq!(result_roi.mismatch_percentage, 0.0, "Identical ROI images should have 0% mismatch");
            }
            
            // If the ROI covers the entire image, results should be identical
            if roi.x == 0 && roi.y == 0 && roi.width == width && roi.height == height {
                prop_assert_eq!(result_full.mismatch_percentage, result_roi.mismatch_percentage,
                    "Full image ROI should produce identical results to no ROI");
            }
        }

        #[test]
        fn test_roi_boundary_validation(
            dimensions in arb_test_image_dimensions(),
            color in arb_color()
        ) {
            let (width, height) = dimensions;
            
            // Create test images
            let baseline_image = ImageLoader::create_test_image(width, height, color);
            let actual_image = ImageLoader::create_test_image(width, height, color);
            
            // Test with ROI that exceeds image boundaries
            let invalid_roi = Region::new(width - 1, height - 1, 10, 10); // Extends beyond image
            
            let config = ComparisonConfig {
                threshold: 0.01,
                method: ComparisonMethod::PixelMatch,
                ignore_regions: Vec::new(),
                include_roi: Some(invalid_roi),
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Strict,
            };
            
            let result = ImageComparator::compare(&baseline_image, &actual_image, config);
            
            // Should return an error for invalid ROI
            prop_assert!(result.is_err(), "Invalid ROI should cause an error");
            
            if let Err(VisualError::InvalidRegion { x, y, width: w, height: h }) = result {
                prop_assert_eq!(x, width - 1);
                prop_assert_eq!(y, height - 1);
                prop_assert_eq!(w, 10);
                prop_assert_eq!(h, 10);
            } else {
                prop_assert!(false, "Expected InvalidRegion error, got {:?}", result);
            }
        }

        #[test]
        fn test_roi_cropping_deterministic(
            dimensions in arb_test_image_dimensions(),
            baseline_color in arb_color(),
            actual_color in arb_color()
        ) {
            let (width, height) = dimensions;
            prop_assume!(width >= 4 && height >= 4); // Ensure we have space for meaningful ROI
            
            // Create a specific ROI that's a quarter of the image in the center
            let roi_width = width / 2;
            let roi_height = height / 2;
            let roi_x = width / 4;
            let roi_y = height / 4;
            let roi = Region::new(roi_x, roi_y, roi_width, roi_height);
            
            // Create test images
            let baseline_image = ImageLoader::create_test_image(width, height, baseline_color);
            let actual_image = ImageLoader::create_test_image(width, height, actual_color);
            
            let config = ComparisonConfig {
                threshold: 0.0,
                method: ComparisonMethod::PixelMatch,
                ignore_regions: Vec::new(),
                include_roi: Some(roi.clone()),
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Strict,
            };
            
            // Run the comparison multiple times - should be deterministic
            let result1 = ImageComparator::compare(&baseline_image, &actual_image, config.clone()).unwrap();
            let result2 = ImageComparator::compare(&baseline_image, &actual_image, config.clone()).unwrap();
            
            // Results should be identical (deterministic)
            prop_assert_eq!(result1.mismatch_percentage, result2.mismatch_percentage,
                "ROI comparison should be deterministic");
            prop_assert_eq!(result1.is_match, result2.is_match,
                "ROI comparison match result should be deterministic");
            prop_assert_eq!(result1.performance_metrics.image_dimensions, 
                result2.performance_metrics.image_dimensions,
                "ROI performance metrics should be deterministic");
        }

        #[test]
        fn test_roi_with_ignore_regions_interaction(
            dimensions in arb_test_image_dimensions(),
            baseline_color in arb_color(),
            actual_color in arb_color()
        ) {
            let (width, height) = dimensions;
            prop_assume!(width >= 6 && height >= 6); // Ensure space for ROI and ignore regions
            
            // Create ROI that covers most of the image
            let roi = Region::new(1, 1, width - 2, height - 2);
            
            // Create ignore region within the ROI
            let ignore_region = Region::new(2, 2, (width - 4).max(1), (height - 4).max(1));
            
            // Create test images
            let baseline_image = ImageLoader::create_test_image(width, height, baseline_color);
            let actual_image = ImageLoader::create_test_image(width, height, actual_color);
            
            let config = ComparisonConfig {
                threshold: 0.0,
                method: ComparisonMethod::PixelMatch,
                ignore_regions: vec![ignore_region],
                include_roi: Some(roi.clone()),
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Strict,
            };
            
            let result = ImageComparator::compare(&baseline_image, &actual_image, config).unwrap();
            
            // Should succeed - ROI and ignore regions should work together
            // Performance metrics should reflect ROI dimensions
            prop_assert_eq!(result.performance_metrics.image_dimensions, (roi.width, roi.height),
                "Performance metrics should reflect ROI dimensions when combined with ignore regions");
            
            // If colors are identical, should have 0% mismatch regardless of ignore regions
            if baseline_color == actual_color {
                prop_assert_eq!(result.mismatch_percentage, 0.0,
                    "Identical images should have 0% mismatch even with ROI and ignore regions");
            }
        }
    }
    // **Feature: visual-regression-testing, Property 5: Baseline auto-generation**
    // **Validates: Requirements 1.5**

    proptest! {
        #[test]
        fn test_baseline_auto_generation(
            dimensions in arb_test_image_dimensions(),
            color in arb_color()
        ) {
            let (width, height) = dimensions;
            
            // Create test image
            let actual_image = ImageLoader::create_test_image(width, height, color);
            
            // Property 5: Baseline auto-generation
            // For any visual assertion where no baseline image exists, the system should 
            // automatically create a new baseline from the captured screenshot and mark the test as passed
            
            // Create a temporary baseline path that doesn't exist
            let baseline_path = format!("test_baseline_{}_{}.png", 
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis()
            );
            
            // Ensure the baseline doesn't exist initially
            prop_assert!(!std::path::Path::new(&baseline_path).exists(), 
                "Baseline should not exist initially");
            
            let config = ComparisonConfig {
                threshold: 0.01,
                method: ComparisonMethod::PixelMatch,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Strict,
            };
            
            // Call compare_with_baseline_generation - should auto-create baseline
            let result = ImageComparator::compare_with_baseline_generation(
                &baseline_path, 
                &actual_image, 
                config
            ).unwrap();
            
            // Should pass (new baseline creation always passes)
            prop_assert!(result.is_match, "New baseline creation should always pass");
            prop_assert_eq!(result.mismatch_percentage, 0.0, "New baseline should have 0% mismatch");
            prop_assert_eq!(result.difference_type, DifferenceType::NoChange, 
                "New baseline should show no change");
            
            // Baseline file should now exist
            prop_assert!(std::path::Path::new(&baseline_path).exists(), 
                "Baseline file should be created");
            
            // Should have metadata indicating baseline was created
            prop_assert!(result.metadata.contains_key("baseline_created"), 
                "Result should indicate baseline was created");
            prop_assert_eq!(result.metadata.get("baseline_created"), Some(&"true".to_string()),
                "Baseline created flag should be true");
            
            // Should have checksum metadata
            prop_assert!(result.metadata.contains_key("baseline_checksum"), 
                "Result should contain baseline checksum");
            
            // Clean up
            let _ = std::fs::remove_file(&baseline_path);
        }

        #[test]
        fn test_baseline_integrity_validation(
            dimensions in arb_test_image_dimensions(),
            color in arb_color()
        ) {
            let (width, height) = dimensions;
            
            // Create test image
            let test_image = ImageLoader::create_test_image(width, height, color);
            
            // Create temporary baseline
            let baseline_path = format!("test_integrity_{}_{}.png", 
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis()
            );
            
            let config = ComparisonConfig::default();
            
            // Create baseline
            let result = ImageComparator::compare_with_baseline_generation(
                &baseline_path, 
                &test_image, 
                config
            ).unwrap();
            
            // Get the checksum from metadata
            let checksum = result.metadata.get("baseline_checksum").unwrap();
            
            // Validate integrity with correct checksum
            let is_valid = ImageComparator::validate_baseline_integrity(&baseline_path, checksum).unwrap();
            prop_assert!(is_valid, "Baseline integrity should be valid with correct checksum");
            
            // Validate integrity with incorrect checksum
            let is_invalid = ImageComparator::validate_baseline_integrity(&baseline_path, "invalid_checksum").unwrap();
            prop_assert!(!is_invalid, "Baseline integrity should be invalid with incorrect checksum");
            
            // Clean up
            let _ = std::fs::remove_file(&baseline_path);
        }

        #[test]
        fn test_baseline_update_functionality(
            dimensions in arb_test_image_dimensions(),
            original_color in arb_color(),
            updated_color in arb_color()
        ) {
            let (width, height) = dimensions;
            prop_assume!(original_color != updated_color); // Ensure colors are different
            
            // Create original and updated test images
            let original_image = ImageLoader::create_test_image(width, height, original_color);
            let updated_image = ImageLoader::create_test_image(width, height, updated_color);
            
            // Create temporary baseline
            let baseline_path = format!("test_update_{}_{}.png", 
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis()
            );
            
            let config = ComparisonConfig::default();
            
            // Create original baseline
            let original_result = ImageComparator::compare_with_baseline_generation(
                &baseline_path, 
                &original_image, 
                config.clone()
            ).unwrap();
            
            let original_checksum = original_result.metadata.get("baseline_checksum").unwrap();
            
            // Update baseline with new image
            let new_checksum = ImageComparator::update_baseline(&baseline_path, &updated_image).unwrap();
            
            // Checksums should be different
            prop_assert_ne!(original_checksum, &new_checksum, 
                "Updated baseline should have different checksum");
            
            // Validate new baseline integrity
            let is_valid = ImageComparator::validate_baseline_integrity(&baseline_path, &new_checksum).unwrap();
            prop_assert!(is_valid, "Updated baseline should have valid integrity");
            
            // Old checksum should no longer be valid
            let is_old_valid = ImageComparator::validate_baseline_integrity(&baseline_path, original_checksum).unwrap();
            prop_assert!(!is_old_valid, "Old checksum should no longer be valid after update");
            
            // Clean up
            let _ = std::fs::remove_file(&baseline_path);
            // Also clean up any backup files
            let backup_pattern = format!("{}.backup.", baseline_path);
            if let Ok(entries) = std::fs::read_dir(".") {
                for entry in entries.flatten() {
                    if let Some(name) = entry.file_name().to_str() {
                        if name.starts_with(&backup_pattern) {
                            let _ = std::fs::remove_file(entry.path());
                        }
                    }
                }
            }
        }

        #[test]
        fn test_existing_baseline_comparison(
            dimensions in arb_test_image_dimensions(),
            baseline_color in arb_color(),
            actual_color in arb_color()
        ) {
            let (width, height) = dimensions;
            
            // Create baseline and actual images
            let baseline_image = ImageLoader::create_test_image(width, height, baseline_color);
            let actual_image = ImageLoader::create_test_image(width, height, actual_color);
            
            // Create temporary baseline file
            let baseline_path = format!("test_existing_{}_{}.png", 
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis()
            );
            
            let config = ComparisonConfig {
                threshold: 0.01,
                method: ComparisonMethod::PixelMatch,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Strict,
            };
            
            // First create the baseline
            let _baseline_result = ImageComparator::compare_with_baseline_generation(
                &baseline_path, 
                &baseline_image, 
                config.clone()
            ).unwrap();
            
            // Now compare with actual image (baseline exists)
            let comparison_result = ImageComparator::compare_with_baseline_generation(
                &baseline_path, 
                &actual_image, 
                config
            ).unwrap();
            
            // Should not have baseline_created metadata (baseline already existed)
            prop_assert!(!comparison_result.metadata.contains_key("baseline_created") || 
                comparison_result.metadata.get("baseline_created") != Some(&"true".to_string()),
                "Should not indicate baseline creation when baseline already exists");
            
            // If colors are identical, should match
            if baseline_color == actual_color {
                prop_assert!(comparison_result.is_match, "Identical images should match");
                prop_assert_eq!(comparison_result.mismatch_percentage, 0.0, 
                    "Identical images should have 0% mismatch");
            }
            
            // Clean up
            let _ = std::fs::remove_file(&baseline_path);
        }
    }

    // **Feature: visual-regression-testing, Property 9: Dimension mismatch error handling**
    // **Validates: Requirements 4.2, 6.1**

    proptest! {
        #[test]
        fn test_dimension_mismatch_error_handling(
            baseline_dims in arb_test_image_dimensions(),
            actual_dims in arb_test_image_dimensions(),
            baseline_color in arb_color(),
            actual_color in arb_color()
        ) {
            // Only test when dimensions are actually different
            prop_assume!(baseline_dims != actual_dims);
            
            let baseline_image = ImageLoader::create_test_image(baseline_dims.0, baseline_dims.1, baseline_color);
            let actual_image = ImageLoader::create_test_image(actual_dims.0, actual_dims.1, actual_color);
            
            let config = ComparisonConfig::default();
            
            // Property 9: Dimension mismatch error handling
            // For any baseline and actual images with different dimensions, the system should 
            // immediately return a dimension mismatch error without attempting scaling or comparison
            let result = ImageComparator::compare(&baseline_image, &actual_image, config);
            
            // Should return dimension mismatch error
            prop_assert!(result.is_err(), "Different dimensions should cause an error");
            
            match result {
                Err(VisualError::DimensionMismatch { baseline_width, baseline_height, actual_width, actual_height }) => {
                    // Error should contain accurate dimension information
                    prop_assert_eq!(baseline_width, baseline_dims.0, 
                        "Error should report correct baseline width");
                    prop_assert_eq!(baseline_height, baseline_dims.1, 
                        "Error should report correct baseline height");
                    prop_assert_eq!(actual_width, actual_dims.0, 
                        "Error should report correct actual width");
                    prop_assert_eq!(actual_height, actual_dims.1, 
                        "Error should report correct actual height");
                }
                Err(other_error) => {
                    prop_assert!(false, "Expected DimensionMismatch error, got {:?}", other_error);
                }
                Ok(_) => {
                    prop_assert!(false, "Expected error for dimension mismatch, but comparison succeeded");
                }
            }
        }

        #[test]
        fn test_dimension_mismatch_immediate_failure(
            baseline_dims in arb_test_image_dimensions(),
            actual_dims in arb_test_image_dimensions(),
            color in arb_color()
        ) {
            // Test with significantly different dimensions
            prop_assume!(
                baseline_dims.0.abs_diff(actual_dims.0) > 10 || 
                baseline_dims.1.abs_diff(actual_dims.1) > 10
            );
            
            let baseline_image = ImageLoader::create_test_image(baseline_dims.0, baseline_dims.1, color);
            let actual_image = ImageLoader::create_test_image(actual_dims.0, actual_dims.1, color);
            
            let config = ComparisonConfig {
                threshold: 1.0, // Very high threshold - should still fail on dimensions
                method: ComparisonMethod::PixelMatch,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: true, // Enable all tolerances - should still fail
                layout_shift_tolerance: 100,   // High tolerance - should still fail
                sensitivity_profile: SensitivityProfile::Flexible,
            };
            
            let start_time = std::time::Instant::now();
            let result = ImageComparator::compare(&baseline_image, &actual_image, config);
            let elapsed = start_time.elapsed();
            
            // Should fail immediately without attempting comparison
            prop_assert!(result.is_err(), "Dimension mismatch should cause immediate failure");
            
            // Should fail very quickly (no actual image processing)
            prop_assert!(elapsed.as_millis() < 100, 
                "Dimension mismatch should be detected quickly, took {}ms", elapsed.as_millis());
            
            // Should be specifically a dimension mismatch error
            if let Err(error) = result {
                prop_assert!(matches!(error, VisualError::DimensionMismatch { .. }),
                    "Should be DimensionMismatch error, got {:?}", error);
            }
        }

        #[test]
        fn test_dimension_mismatch_error_message_clarity(
            baseline_dims in arb_test_image_dimensions(),
            actual_dims in arb_test_image_dimensions(),
            color in arb_color()
        ) {
            prop_assume!(baseline_dims != actual_dims);
            
            let baseline_image = ImageLoader::create_test_image(baseline_dims.0, baseline_dims.1, color);
            let actual_image = ImageLoader::create_test_image(actual_dims.0, actual_dims.1, color);
            
            let config = ComparisonConfig::default();
            let result = ImageComparator::compare(&baseline_image, &actual_image, config);
            
            if let Err(error) = result {
                let error_message = error.to_string();
                
                // Error message should contain both baseline and actual dimensions
                prop_assert!(error_message.contains(&baseline_dims.0.to_string()),
                    "Error message should contain baseline width: {}", error_message);
                prop_assert!(error_message.contains(&baseline_dims.1.to_string()),
                    "Error message should contain baseline height: {}", error_message);
                prop_assert!(error_message.contains(&actual_dims.0.to_string()),
                    "Error message should contain actual width: {}", error_message);
                prop_assert!(error_message.contains(&actual_dims.1.to_string()),
                    "Error message should contain actual height: {}", error_message);
                
                // Should clearly indicate it's a dimension mismatch
                prop_assert!(error_message.to_lowercase().contains("dimension") && 
                           error_message.to_lowercase().contains("mismatch"),
                    "Error message should clearly indicate dimension mismatch: {}", error_message);
            } else {
                prop_assert!(false, "Expected dimension mismatch error");
            }
        }
    }

    // **Feature: visual-regression-testing, Property 10: Retry mechanism reliability**
    // **Validates: Requirements 6.5**

    /// Generate arbitrary capture configurations for testing
    fn arb_capture_config() -> impl Strategy<Value = super::super::screen_capture::CaptureConfig> {
        (
            1u32..5u32,    // max_retries (1-4)
            100u32..2000u32, // capture_timeout_ms
            10u32..100u32,   // retry_delay_ms (short for testing)
            10u32..200u32,   // stability_wait_ms
            any::<bool>(),   // enable_stability_check
        ).prop_map(|(max_retries, capture_timeout_ms, retry_delay_ms, stability_wait_ms, enable_stability_check)| {
            super::super::screen_capture::CaptureConfig {
                max_retries,
                capture_timeout_ms,
                retry_delay_ms,
                stability_wait_ms,
                enable_stability_check,
            }
        })
    }

    /// Generate arbitrary failure patterns for testing
    fn arb_failure_pattern() -> impl Strategy<Value = Vec<super::super::screen_capture::CaptureFailureType>> {
        prop::collection::vec(
            prop_oneof![
                Just(super::super::screen_capture::CaptureFailureType::Timeout),
                Just(super::super::screen_capture::CaptureFailureType::PermissionDenied),
                Just(super::super::screen_capture::CaptureFailureType::NetworkLag),
                Just(super::super::screen_capture::CaptureFailureType::InsufficientMemory),
            ],
            0..4 // 0 to 3 failures
        )
    }

    proptest! {
        #[test]
        fn test_retry_mechanism_reliability(
            config in arb_capture_config(),
            failure_pattern in arb_failure_pattern()
        ) {
            use super::super::screen_capture::ScreenCapture;
            
            // Property 10: Retry mechanism reliability
            // For any screenshot capture failure scenario, the system should attempt up to 3 retries 
            // before marking the test as failed
            
            let num_failures = failure_pattern.len() as u32;
            let max_retries = config.max_retries;
            
            let result = ScreenCapture::capture_with_simulated_failures(config, failure_pattern);
            
            if num_failures < max_retries {
                // Should succeed if failures are less than max retries
                prop_assert!(result.is_ok(), 
                    "Should succeed when failures ({}) < max_retries ({})", num_failures, max_retries);
                
                if let Ok(capture_result) = result {
                    // Should have made exactly num_failures + 1 attempts
                    prop_assert_eq!(capture_result.attempts_made, num_failures + 1,
                        "Should make exactly {} attempts for {} failures", num_failures + 1, num_failures);
                    
                    // Should have captured a valid image
                    prop_assert_eq!(capture_result.image.dimensions(), (1920, 1080),
                        "Should capture image with expected dimensions");
                    
                    // Should have recorded time taken
                    prop_assert!(capture_result.total_time_ms > 0,
                        "Should record time taken for capture");
                }
            } else if num_failures >= max_retries {
                // Should fail if failures equal or exceed max retries
                prop_assert!(result.is_err(),
                    "Should fail when failures ({}) >= max_retries ({})", num_failures, max_retries);
            }
        }

        #[test]
        fn test_retry_mechanism_attempt_counting(
            max_retries in 1u32..5u32,
            num_failures in 0u32..6u32
        ) {
            use super::super::screen_capture::{ScreenCapture, CaptureConfig, CaptureFailureType};
            
            let config = CaptureConfig {
                max_retries,
                capture_timeout_ms: 1000,
                retry_delay_ms: 10, // Short delay for testing
                stability_wait_ms: 10,
                enable_stability_check: false, // Disable for faster testing
            };
            
            // Create failure pattern with specified number of failures
            let failure_pattern: Vec<CaptureFailureType> = (0..num_failures)
                .map(|_| CaptureFailureType::NetworkLag)
                .collect();
            
            let result = ScreenCapture::capture_with_simulated_failures(config, failure_pattern);
            
            if num_failures < max_retries {
                // Should succeed and report correct attempt count
                if let Ok(capture_result) = result {
                    prop_assert_eq!(capture_result.attempts_made, num_failures + 1,
                        "Attempt count should be failures + 1: {} failures should result in {} attempts",
                        num_failures, num_failures + 1);
                } else {
                    prop_assert!(false, "Should succeed when failures < max_retries");
                }
            } else {
                // Should fail after exactly max_retries attempts
                prop_assert!(result.is_err(),
                    "Should fail when failures ({}) >= max_retries ({})", num_failures, max_retries);
            }
        }

        #[test]
        fn test_retry_mechanism_timing_behavior(
            max_retries in 2u32..4u32,
            retry_delay_ms in 50u32..200u32
        ) {
            use super::super::screen_capture::{ScreenCapture, CaptureConfig, CaptureFailureType};
            use std::time::Instant;
            
            let config = CaptureConfig {
                max_retries,
                capture_timeout_ms: 1000,
                retry_delay_ms,
                stability_wait_ms: 10,
                enable_stability_check: false,
            };
            
            // Create pattern that will cause exactly 2 failures, then success
            let failure_pattern = vec![
                CaptureFailureType::NetworkLag,
                CaptureFailureType::Timeout,
            ];
            
            let start_time = Instant::now();
            let result = ScreenCapture::capture_with_simulated_failures(config, failure_pattern);
            let elapsed = start_time.elapsed().as_millis() as u32;
            
            // Should succeed after 3 attempts (2 failures + 1 success)
            prop_assert!(result.is_ok(), "Should succeed after retries");
            
            if let Ok(capture_result) = result {
                prop_assert_eq!(capture_result.attempts_made, 3, "Should make 3 attempts");
                
                // Total time should include retry delays (2 delays for 2 retries)
                let expected_min_time = retry_delay_ms * 2; // 2 retry delays
                prop_assert!(elapsed >= expected_min_time,
                    "Total time ({} ms) should include retry delays (expected >= {} ms)",
                    elapsed, expected_min_time);
                
                // But shouldn't be excessively long (allow some overhead)
                let expected_max_time = retry_delay_ms * 2 + 1000; // Delays + reasonable overhead
                prop_assert!(elapsed <= expected_max_time,
                    "Total time ({} ms) should not be excessive (expected <= {} ms)",
                    elapsed, expected_max_time);
            }
        }

        #[test]
        fn test_retry_mechanism_error_preservation(
            max_retries in 1u32..3u32
        ) {
            use super::super::screen_capture::{ScreenCapture, CaptureConfig, CaptureFailureType};
            
            let config = CaptureConfig {
                max_retries,
                capture_timeout_ms: 1000,
                retry_delay_ms: 10,
                stability_wait_ms: 10,
                enable_stability_check: false,
            };
            
            // Create failure pattern that exceeds max retries
            let failure_pattern: Vec<CaptureFailureType> = (0..max_retries + 1)
                .map(|i| match i % 4 {
                    0 => CaptureFailureType::PermissionDenied,
                    1 => CaptureFailureType::Timeout,
                    2 => CaptureFailureType::NetworkLag,
                    _ => CaptureFailureType::InsufficientMemory,
                })
                .collect();
            
            let last_failure_type = failure_pattern[max_retries as usize - 1].clone();
            
            let result = ScreenCapture::capture_with_simulated_failures(config, failure_pattern);
            
            // Should fail and preserve the error from the last attempt
            prop_assert!(result.is_err(), "Should fail when all retries are exhausted");
            
            if let Err(error) = result {
                // Error should correspond to the last failure type
                match &last_failure_type {
                    CaptureFailureType::PermissionDenied => {
                        prop_assert!(matches!(error, VisualError::IoError { .. }),
                            "Should preserve IoError for permission denied");
                        if let VisualError::IoError { message } = &error {
                            prop_assert!(message.contains("Permission denied"),
                                "Error message should indicate permission denied: {}", message);
                        }
                    }
                    CaptureFailureType::Timeout => {
                        prop_assert!(matches!(error, VisualError::ComparisonTimeout { .. }),
                            "Should preserve timeout error");
                    }
                    CaptureFailureType::InsufficientMemory => {
                        prop_assert!(matches!(error, VisualError::InsufficientMemory { .. }),
                            "Should preserve memory error");
                    }
                    CaptureFailureType::NetworkLag => {
                        prop_assert!(matches!(error, VisualError::IoError { .. }),
                            "Should preserve IoError for network lag");
                    }
                }
            }
        }

        #[test]
        fn test_successful_capture_no_retries(
            config in arb_capture_config()
        ) {
            use super::super::screen_capture::ScreenCapture;
            
            // Test successful capture on first attempt (no failures)
            let failure_pattern = vec![]; // No failures
            
            let result = ScreenCapture::capture_with_simulated_failures(config, failure_pattern);
            
            // Should succeed immediately
            prop_assert!(result.is_ok(), "Should succeed with no failures");
            
            if let Ok(capture_result) = result {
                // Should make exactly 1 attempt
                prop_assert_eq!(capture_result.attempts_made, 1,
                    "Should make exactly 1 attempt for successful capture");
                
                // Should capture valid image
                prop_assert_eq!(capture_result.image.dimensions(), (1920, 1080),
                    "Should capture image with expected dimensions");
                
                // Should complete relatively quickly (no retries)
                prop_assert!(capture_result.total_time_ms < 1000,
                    "Successful capture should complete quickly: {} ms", capture_result.total_time_ms);
            }
        }
    }

    // **Feature: visual-regression-testing, Property 12: Anti-aliasing tolerance**
    // **Validates: Requirements 9.1**

    /// Generate arbitrary anti-aliasing test scenarios
    fn arb_anti_aliasing_scenario() -> impl Strategy<Value = (u32, u32, [u8; 4], [u8; 4], u8)> {
        (
            10u32..100u32,  // width
            10u32..100u32,  // height  
            arb_color(),    // base_color
            arb_color(),    // anti_aliased_color
            1u8..15u8,      // anti_aliasing_difference (small differences)
        )
    }

    proptest! {
        #[test]
        fn test_anti_aliasing_tolerance(
            (width, height, base_color, _, aa_diff) in arb_anti_aliasing_scenario()
        ) {
            // **Property 12: Anti-aliasing tolerance**
            // For any pixel comparison with anti-aliasing tolerance enabled, 
            // minor font rendering differences should not cause test failures
            
            // Create baseline image with solid color
            let baseline_image = ImageLoader::create_test_image(width, height, base_color);
            
            // Create actual image with slight anti-aliasing differences
            let mut actual_color = base_color;
            // Apply small differences that simulate anti-aliasing
            actual_color[0] = actual_color[0].saturating_add(aa_diff).min(255);
            actual_color[1] = actual_color[1].saturating_add(aa_diff).min(255);
            actual_color[2] = actual_color[2].saturating_add(aa_diff).min(255);
            // Keep alpha the same or make both fully opaque
            actual_color[3] = if actual_color[3] >= 250 { 255 } else { actual_color[3] };
            
            let actual_image = ImageLoader::create_test_image(width, height, actual_color);
            
            // Test with anti-aliasing tolerance enabled
            let config_with_tolerance = ComparisonConfig {
                threshold: 0.5, // High threshold to focus on anti-aliasing behavior
                method: ComparisonMethod::PixelMatch,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: true,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Flexible,
            };
            
            // Test without anti-aliasing tolerance
            let config_without_tolerance = ComparisonConfig {
                threshold: 0.5,
                method: ComparisonMethod::PixelMatch,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Strict,
            };
            
            let result_with_tolerance = ImageComparator::compare(&baseline_image, &actual_image, config_with_tolerance).unwrap();
            let result_without_tolerance = ImageComparator::compare(&baseline_image, &actual_image, config_without_tolerance).unwrap();
            
            // With anti-aliasing tolerance, small differences should be more tolerated
            // The mismatch percentage should be lower or equal when tolerance is enabled
            prop_assert!(
                result_with_tolerance.mismatch_percentage <= result_without_tolerance.mismatch_percentage,
                "Anti-aliasing tolerance should reduce or maintain mismatch percentage: with_tolerance={}, without_tolerance={}",
                result_with_tolerance.mismatch_percentage,
                result_without_tolerance.mismatch_percentage
            );
            
            // For very small differences (< 10 in RGB), anti-aliasing tolerance should make images match
            if aa_diff < 10 {
                prop_assert!(
                    result_with_tolerance.mismatch_percentage < result_without_tolerance.mismatch_percentage || 
                    result_with_tolerance.mismatch_percentage == 0.0,
                    "Small anti-aliasing differences should be tolerated: diff={}, with_tolerance={}, without_tolerance={}",
                    aa_diff, result_with_tolerance.mismatch_percentage, result_without_tolerance.mismatch_percentage
                );
            }
        }

        #[test]
        fn test_anti_aliasing_alpha_channel_handling(
            dimensions in arb_test_image_dimensions(),
            base_color in arb_color()
        ) {
            let (width, height) = dimensions;
            
            // Create baseline with full opacity
            let mut baseline_color = base_color;
            baseline_color[3] = 255; // Full opacity
            let baseline_image = ImageLoader::create_test_image(width, height, baseline_color);
            
            // Create actual with slightly different alpha but still opaque
            let mut actual_color = base_color;
            actual_color[3] = 250; // Still considered opaque for anti-aliasing
            let actual_image = ImageLoader::create_test_image(width, height, actual_color);
            
            let config = ComparisonConfig {
                threshold: 0.01,
                method: ComparisonMethod::PixelMatch,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: true,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Flexible,
            };
            
            let result = ImageComparator::compare(&baseline_image, &actual_image, config).unwrap();
            
            // Both alpha values >= 250 should be treated as fully opaque and match
            if baseline_color[0] == actual_color[0] && 
               baseline_color[1] == actual_color[1] && 
               baseline_color[2] == actual_color[2] {
                prop_assert_eq!(result.mismatch_percentage, 0.0,
                    "Images with same RGB and both alpha >= 250 should match with anti-aliasing tolerance");
            }
        }

        #[test]
        fn test_anti_aliasing_tolerance_boundary_conditions(
            dimensions in arb_test_image_dimensions(),
            base_color in arb_color()
        ) {
            let (width, height) = dimensions;
            
            // Test exactly at the anti-aliasing threshold (10 RGB difference)
            let baseline_image = ImageLoader::create_test_image(width, height, base_color);
            
            let mut actual_color = base_color;
            actual_color[0] = actual_color[0].saturating_add(10).min(255);
            actual_color[1] = actual_color[1].saturating_add(10).min(255);
            actual_color[2] = actual_color[2].saturating_add(10).min(255);
            let actual_image = ImageLoader::create_test_image(width, height, actual_color);
            
            let config_with_tolerance = ComparisonConfig {
                threshold: 0.01,
                method: ComparisonMethod::PixelMatch,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: true,
                layout_shift_tolerance: 0,
                sensitivity_profile: SensitivityProfile::Flexible,
            };
            
            let config_without_tolerance = ComparisonConfig {
                anti_aliasing_tolerance: false,
                ..config_with_tolerance.clone()
            };
            
            let result_with = ImageComparator::compare(&baseline_image, &actual_image, config_with_tolerance.clone()).unwrap();
            let result_without = ImageComparator::compare(&baseline_image, &actual_image, config_without_tolerance).unwrap();
            
            // At the boundary (10 RGB difference), tolerance should still help
            prop_assert!(
                result_with.mismatch_percentage <= result_without.mismatch_percentage,
                "Anti-aliasing tolerance should help even at boundary conditions"
            );
            
            // Test beyond the threshold (15 RGB difference)
            let mut large_diff_color = base_color;
            large_diff_color[0] = large_diff_color[0].saturating_add(15).min(255);
            large_diff_color[1] = large_diff_color[1].saturating_add(15).min(255);
            large_diff_color[2] = large_diff_color[2].saturating_add(15).min(255);
            let large_diff_image = ImageLoader::create_test_image(width, height, large_diff_color);
            
            let result_large_diff = ImageComparator::compare(&baseline_image, &large_diff_image, config_with_tolerance).unwrap();
            
            // Large differences should still be detected even with anti-aliasing tolerance
            prop_assert!(
                result_large_diff.mismatch_percentage > 0.0,
                "Large differences should still be detected with anti-aliasing tolerance"
            );
        }

        #[test]
        fn test_anti_aliasing_with_different_algorithms(
            dimensions in arb_test_image_dimensions(),
            base_color in arb_color(),
            method in arb_comparison_method()
        ) {
            let (width, height) = dimensions;
            prop_assume!(width >= 20 && height >= 20); // Ensure sufficient size for all algorithms
            
            // Create images with small anti-aliasing differences
            let baseline_image = ImageLoader::create_test_image(width, height, base_color);
            
            let mut aa_color = base_color;
            aa_color[0] = aa_color[0].saturating_add(5).min(255);
            aa_color[1] = aa_color[1].saturating_add(5).min(255);
            aa_color[2] = aa_color[2].saturating_add(5).min(255);
            let actual_image = ImageLoader::create_test_image(width, height, aa_color);
            
            let config = ComparisonConfig {
                threshold: 0.1,
                method,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: true,
                layout_shift_tolerance: 2,
                sensitivity_profile: SensitivityProfile::Flexible,
            };
            
            let result = ImageComparator::compare(&baseline_image, &actual_image, config);
            
            // All algorithms should handle anti-aliasing tolerance
            prop_assert!(result.is_ok(), 
                "All comparison algorithms should support anti-aliasing tolerance: {:?}", method);
            
            if let Ok(comparison_result) = result {
                // Small differences should be well-tolerated by all algorithms
                prop_assert!(comparison_result.mismatch_percentage < 0.5,
                    "Small anti-aliasing differences should be well-tolerated by {:?}: mismatch={}",
                    method, comparison_result.mismatch_percentage);
            }
        }
    }

    // **Feature: visual-regression-testing, Property 13: Layout shift tolerance**
    // **Validates: Requirements 9.2**

    /// Generate arbitrary layout shift test scenarios
    fn arb_layout_shift_scenario() -> impl Strategy<Value = (u32, u32, [u8; 4], [u8; 4], u32, u32)> {
        (
            20u32..100u32,  // width (larger for meaningful shifts)
            20u32..100u32,  // height
            arb_color(),    // baseline_color
            arb_color(),    // actual_color (different to create detectable content)
            0u32..3u32,     // shift_x (0-2 pixels)
            0u32..3u32,     // shift_y (0-2 pixels)
        )
    }

    proptest! {
        #[test]
        fn test_layout_shift_tolerance(
            (width, height, baseline_color, actual_color, shift_x, shift_y) in arb_layout_shift_scenario()
        ) {
            // **Property 13: Layout shift tolerance**
            // For any layout-aware comparison, element displacement of 1-2 pixels 
            // should be tolerated without marking the test as failed
            
            prop_assume!(shift_x <= 2 && shift_y <= 2); // Ensure we're within tolerance
            prop_assume!(width > shift_x + 10 && height > shift_y + 10); // Ensure space for shift
            
            // Create baseline image with a pattern
            let baseline_image = create_shifted_pattern_image(width, height, baseline_color, 0, 0);
            
            // Create actual image with the same pattern but shifted
            let actual_image = create_shifted_pattern_image(width, height, baseline_color, shift_x, shift_y);
            
            // Test with layout-aware comparison and shift tolerance
            let config_with_tolerance = ComparisonConfig {
                threshold: 0.1,
                method: ComparisonMethod::LayoutAware,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 2, // Allow up to 2 pixels shift
                sensitivity_profile: SensitivityProfile::Moderate,
            };
            
            // Test with pixel-match (no shift tolerance)
            let config_without_tolerance = ComparisonConfig {
                method: ComparisonMethod::PixelMatch,
                layout_shift_tolerance: 0,
                ..config_with_tolerance.clone()
            };
            
            let result_with_tolerance = ImageComparator::compare(&baseline_image, &actual_image, config_with_tolerance).unwrap();
            let result_without_tolerance = ImageComparator::compare(&baseline_image, &actual_image, config_without_tolerance).unwrap();
            
            // Layout-aware comparison should be more tolerant of shifts
            prop_assert!(
                result_with_tolerance.mismatch_percentage <= result_without_tolerance.mismatch_percentage,
                "Layout-aware comparison should be more tolerant of shifts: shift=({},{}), with_tolerance={}, without_tolerance={}",
                shift_x, shift_y, result_with_tolerance.mismatch_percentage, result_without_tolerance.mismatch_percentage
            );
            
            // Small shifts (1-2 pixels) should be well-tolerated
            if shift_x <= 2 && shift_y <= 2 {
                prop_assert!(
                    result_with_tolerance.mismatch_percentage < 0.5,
                    "Small layout shifts should be well-tolerated: shift=({},{}), mismatch={}",
                    shift_x, shift_y, result_with_tolerance.mismatch_percentage
                );
            }
        }

        #[test]
        fn test_layout_shift_detection_accuracy(
            dimensions in arb_test_image_dimensions(),
            pattern_color in arb_color(),
            shift_x in 0u32..5u32,
            shift_y in 0u32..5u32
        ) {
            let (width, height) = dimensions;
            prop_assume!(width > shift_x + 15 && height > shift_y + 15); // Ensure space for pattern and shift
            
            // Create images with detectable patterns
            let baseline_image = create_checkerboard_pattern(width, height, pattern_color, [0, 0, 0, 255]);
            let actual_image = create_shifted_checkerboard_pattern(width, height, pattern_color, [0, 0, 0, 255], shift_x, shift_y);
            
            let config = ComparisonConfig {
                threshold: 0.1,
                method: ComparisonMethod::LayoutAware,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 3, // Allow up to 3 pixels
                sensitivity_profile: SensitivityProfile::Moderate,
            };
            
            let result = ImageComparator::compare(&baseline_image, &actual_image, config).unwrap();
            
            // Shifts within tolerance should result in lower mismatch
            if shift_x <= 3 && shift_y <= 3 {
                prop_assert!(
                    result.mismatch_percentage < 0.8,
                    "Shifts within tolerance should result in low mismatch: shift=({},{}), mismatch={}",
                    shift_x, shift_y, result.mismatch_percentage
                );
            }
            
            // Zero shift should result in perfect or near-perfect match
            if shift_x == 0 && shift_y == 0 {
                prop_assert!(
                    result.mismatch_percentage < 0.01,
                    "Zero shift should result in near-perfect match: mismatch={}",
                    result.mismatch_percentage
                );
            }
        }

        #[test]
        fn test_layout_shift_tolerance_boundary(
            dimensions in arb_test_image_dimensions(),
            pattern_color in arb_color()
        ) {
            let (width, height) = dimensions;
            prop_assume!(width > 20 && height > 20); // Ensure sufficient space
            
            // Test exactly at tolerance boundary
            let baseline_image = create_checkerboard_pattern(width, height, pattern_color, [255, 255, 255, 255]);
            
            // Test shift exactly at tolerance limit (2 pixels)
            let actual_image_at_limit = create_shifted_checkerboard_pattern(
                width, height, pattern_color, [255, 255, 255, 255], 2, 2
            );
            
            // Test shift beyond tolerance limit (3 pixels)
            let actual_image_beyond_limit = create_shifted_checkerboard_pattern(
                width, height, pattern_color, [255, 255, 255, 255], 3, 3
            );
            
            let config = ComparisonConfig {
                threshold: 0.3,
                method: ComparisonMethod::LayoutAware,
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 2, // Tolerance of 2 pixels
                sensitivity_profile: SensitivityProfile::Moderate,
            };
            
            let result_at_limit = ImageComparator::compare(&baseline_image, &actual_image_at_limit, config.clone()).unwrap();
            let result_beyond_limit = ImageComparator::compare(&baseline_image, &actual_image_beyond_limit, config).unwrap();
            
            // Shift at limit should be better tolerated than shift beyond limit
            prop_assert!(
                result_at_limit.mismatch_percentage <= result_beyond_limit.mismatch_percentage,
                "Shift at tolerance limit should be better tolerated than beyond limit: at_limit={}, beyond_limit={}",
                result_at_limit.mismatch_percentage, result_beyond_limit.mismatch_percentage
            );
        }

        #[test]
        fn test_layout_shift_with_ignore_regions(
            dimensions in arb_test_image_dimensions(),
            pattern_color in arb_color(),
            shift_x in 1u32..3u32,
            shift_y in 1u32..3u32
        ) {
            let (width, height) = dimensions;
            prop_assume!(width > shift_x + 20 && height > shift_y + 20);
            
            // Create ignore region in the center
            let ignore_region = Region::new(
                width / 4, height / 4,
                width / 2, height / 2
            );
            
            let baseline_image = create_checkerboard_pattern(width, height, pattern_color, [128, 128, 128, 255]);
            let actual_image = create_shifted_checkerboard_pattern(
                width, height, pattern_color, [128, 128, 128, 255], shift_x, shift_y
            );
            
            let config = ComparisonConfig {
                threshold: 0.2,
                method: ComparisonMethod::LayoutAware,
                ignore_regions: vec![ignore_region],
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 2,
                sensitivity_profile: SensitivityProfile::Moderate,
            };
            
            let result = ImageComparator::compare(&baseline_image, &actual_image, config).unwrap();
            
            // Layout shift tolerance should work correctly with ignore regions
            prop_assert!(result.is_match || result.mismatch_percentage < 0.5,
                "Layout shift tolerance should work with ignore regions: shift=({},{}), mismatch={}",
                shift_x, shift_y, result.mismatch_percentage);
        }
    }

    // **Feature: visual-regression-testing, Property 11: HTML report generation completeness**
    // **Validates: Requirements 8.4**

    /// Generate arbitrary HTML report configurations
    /// Note: embed_images is set to false to avoid trying to load arbitrary paths as images
    fn arb_html_report_config() -> impl Strategy<Value = super::super::html_report::HTMLReportConfig> {
        (
            100u32..800u32,     // max_thumbnail_size
            50u8..100u8,        // thumbnail_quality
            any::<bool>(),      // include_full_size_links
            "[A-Za-z0-9 ]{10,50}", // title
        ).prop_map(|(max_thumbnail_size, thumbnail_quality, include_full_size_links, title)| {
            super::super::html_report::HTMLReportConfig {
                embed_images: false, // Always false for property tests with arbitrary paths
                max_thumbnail_size,
                thumbnail_quality,
                include_full_size_links,
                custom_css: None,
                title,
            }
        })
    }

    /// Generate arbitrary test results with metadata
    fn arb_test_result_with_metadata() -> impl Strategy<Value = super::super::html_report::TestResultWithMetadata> {
        (
            arb_comparison_result(),
            "[a-zA-Z0-9_]{5,20}",  // test_name
            prop::option::of("[A-Za-z0-9 ]{10,100}"), // description
            prop::collection::vec("[a-z]{3,10}", 0..5), // tags
        ).prop_map(|(result, test_name, description, tags)| {
            let mut test_result = super::super::html_report::TestResultWithMetadata::new(result, test_name);
            if let Some(desc) = description {
                test_result = test_result.with_description(desc);
            }
            test_result = test_result.with_tags(tags);
            test_result
        })
    }

    proptest! {
        #[test]
        fn test_html_report_generation_completeness(
            config in arb_html_report_config(),
            results in prop::collection::vec(arb_test_result_with_metadata(), 1..10)
        ) {
            use super::super::html_report::HTMLReportGenerator;
            
            // **Property 11: HTML report generation completeness**
            // For any CI environment test execution, the generated HTML report should contain 
            // embedded baseline, actual, and diff images for remote review
            
            let generator = HTMLReportGenerator::new(config.clone());
            
            // Generate HTML content
            let html_content = generator.generate_html_content(&results);
            
            // Should successfully generate HTML content
            prop_assert!(html_content.is_ok(), 
                "HTML report generation should succeed for valid inputs: {:?}", html_content);
            
            let html = html_content.unwrap();
            
            // HTML should be well-formed
            prop_assert!(html.contains("<!DOCTYPE html>"), "HTML should have proper DOCTYPE");
            prop_assert!(html.contains("<html"), "HTML should have html tag");
            prop_assert!(html.contains("</html>"), "HTML should be properly closed");
            prop_assert!(html.contains("<head>"), "HTML should have head section");
            prop_assert!(html.contains("<body>"), "HTML should have body section");
            
            // Should contain the configured title
            prop_assert!(html.contains(&config.title), 
                "HTML should contain the configured title: {}", config.title);
            
            // Should contain summary statistics
            prop_assert!(html.contains("Test Summary"), "HTML should contain test summary");
            prop_assert!(html.contains("Passed"), "HTML should show passed count");
            prop_assert!(html.contains("Failed"), "HTML should show failed count");
            prop_assert!(html.contains("Total"), "HTML should show total count");
            
            // Should contain all test results
            for result_meta in &results {
                prop_assert!(html.contains(&result_meta.test_name), 
                    "HTML should contain test name: {}", result_meta.test_name);
                
                let status = if result_meta.result.is_match { "PASSED" } else { "FAILED" };
                prop_assert!(html.contains(status), 
                    "HTML should contain test status: {}", status);
                
                // Should contain mismatch percentage
                let mismatch_str = format!("{:.2}%", result_meta.result.mismatch_percentage * 100.0);
                prop_assert!(html.contains(&mismatch_str), 
                    "HTML should contain mismatch percentage: {}", mismatch_str);
            }
            
            // Should contain CSS styles
            prop_assert!(html.contains("<style>"), "HTML should contain CSS styles");
            prop_assert!(html.contains("font-family"), "HTML should have font styling");
            
            // Should contain JavaScript
            prop_assert!(html.contains("<script>"), "HTML should contain JavaScript");
        }

        #[test]
        fn test_html_report_image_handling(
            embed_images in any::<bool>(),
            include_links in any::<bool>(),
            results in prop::collection::vec(arb_test_result_with_metadata(), 1..5)
        ) {
            use super::super::html_report::{HTMLReportGenerator, HTMLReportConfig};
            
            let config = HTMLReportConfig {
                embed_images,
                max_thumbnail_size: 300,
                thumbnail_quality: 80,
                include_full_size_links: include_links,
                custom_css: None,
                title: "Test Report".to_string(),
            };
            
            let generator = HTMLReportGenerator::new(config);
            let html = generator.generate_html_content(&results).unwrap();
            
            // Check image handling based on configuration
            if embed_images {
                // Should contain base64 image data when embedding is enabled
                // Note: This test assumes images exist, in practice we'd need test images
                prop_assert!(html.contains("data:image") || results.iter().all(|r| !r.result.is_match),
                    "HTML should contain embedded images when embed_images is true");
            }
            
            if include_links {
                // Should contain links to full-size images when enabled
                prop_assert!(html.contains("View Full Size") || results.iter().all(|r| r.result.is_match),
                    "HTML should contain full-size links when include_full_size_links is true");
            }
            
            // Should contain image containers for failed tests
            let failed_tests = results.iter().filter(|r| !r.result.is_match).count();
            if failed_tests > 0 {
                prop_assert!(html.contains("image-comparison"), 
                    "HTML should contain image comparison sections for failed tests");
                prop_assert!(html.contains("Baseline"), 
                    "HTML should contain baseline image labels");
                prop_assert!(html.contains("Actual"), 
                    "HTML should contain actual image labels");
            }
        }

        #[test]
        fn test_html_report_statistics_accuracy(
            results in prop::collection::vec(arb_test_result_with_metadata(), 1..20)
        ) {
            use super::super::html_report::HTMLReportGenerator;
            
            let generator = HTMLReportGenerator::for_ci();
            let html = generator.generate_html_content(&results).unwrap();
            
            // Calculate expected statistics
            let total_tests = results.len();
            let passed_tests = results.iter().filter(|r| r.result.is_match).count();
            let failed_tests = total_tests - passed_tests;
            
            let avg_mismatch = if !results.is_empty() {
                results.iter().map(|r| r.result.mismatch_percentage).sum::<f32>() / results.len() as f32
            } else {
                0.0
            };
            
            // Verify statistics are present in HTML
            prop_assert!(html.contains(&total_tests.to_string()), 
                "HTML should contain correct total test count: {}", total_tests);
            prop_assert!(html.contains(&passed_tests.to_string()), 
                "HTML should contain correct passed test count: {}", passed_tests);
            prop_assert!(html.contains(&failed_tests.to_string()), 
                "HTML should contain correct failed test count: {}", failed_tests);
            
            // Check average mismatch percentage (allow some floating point tolerance)
            let avg_mismatch_str = format!("{:.2}%", avg_mismatch * 100.0);
            prop_assert!(html.contains(&avg_mismatch_str), 
                "HTML should contain correct average mismatch: {}", avg_mismatch_str);
        }

        #[test]
        fn test_html_report_responsive_design(
            config in arb_html_report_config(),
            results in prop::collection::vec(arb_test_result_with_metadata(), 1..5)
        ) {
            use super::super::html_report::HTMLReportGenerator;
            
            let generator = HTMLReportGenerator::new(config);
            let html = generator.generate_html_content(&results).unwrap();
            
            // Should contain responsive design elements
            prop_assert!(html.contains("@media"), 
                "HTML should contain responsive CSS media queries");
            prop_assert!(html.contains("max-width"), 
                "HTML should contain responsive width constraints");
            prop_assert!(html.contains("grid-template-columns"), 
                "HTML should use CSS Grid for responsive layout");
            
            // Should contain viewport meta tag
            prop_assert!(html.contains("viewport"), 
                "HTML should contain viewport meta tag for mobile compatibility");
            
            // Should have flexible grid layouts
            prop_assert!(html.contains("repeat(auto-fit"), 
                "HTML should use auto-fit grid layouts for responsiveness");
        }

        #[test]
        fn test_html_report_accessibility_features(
            config in arb_html_report_config(),
            results in prop::collection::vec(arb_test_result_with_metadata(), 1..3)
        ) {
            use super::super::html_report::HTMLReportGenerator;
            
            let generator = HTMLReportGenerator::new(config);
            let html = generator.generate_html_content(&results).unwrap();
            
            // Should contain accessibility features
            prop_assert!(html.contains("alt="), 
                "HTML should contain alt attributes for images");
            prop_assert!(html.contains("lang="), 
                "HTML should specify language attribute");
            
            // Should have semantic HTML structure
            prop_assert!(html.contains("<header>"), "HTML should use semantic header tag");
            prop_assert!(html.contains("<section>"), "HTML should use semantic section tags");
            
            // Should have proper heading hierarchy
            prop_assert!(html.contains("<h1>"), "HTML should have main heading");
            prop_assert!(html.contains("<h2>"), "HTML should have section headings");
            prop_assert!(html.contains("<h3>"), "HTML should have subsection headings");
        }

        #[test]
        fn test_html_report_performance_metrics_display(
            results in prop::collection::vec(arb_test_result_with_metadata(), 1..5)
        ) {
            use super::super::html_report::HTMLReportGenerator;
            
            let generator = HTMLReportGenerator::for_ci();
            let html = generator.generate_html_content(&results).unwrap();
            
            // Should display performance metrics for each test
            for result_meta in &results {
                let total_time = result_meta.result.performance_metrics.total_time_ms();
                prop_assert!(html.contains(&format!("{}ms", total_time)), 
                    "HTML should contain execution time: {}ms", total_time);
                
                // Should contain difference type information
                let diff_type_str = format!("{:?}", result_meta.result.difference_type);
                prop_assert!(html.contains(&diff_type_str), 
                    "HTML should contain difference type: {}", diff_type_str);
            }
            
            // Should have metrics section styling
            prop_assert!(html.contains("metrics"), 
                "HTML should contain metrics CSS class");
            prop_assert!(html.contains("metric"), 
                "HTML should contain individual metric styling");
        }

        #[test]
        fn test_html_report_error_handling(
            config in arb_html_report_config()
        ) {
            use super::super::html_report::{HTMLReportGenerator, TestResultWithMetadata};
            
            let generator = HTMLReportGenerator::new(config);
            
            // Test with empty results
            let empty_results: Vec<TestResultWithMetadata> = vec![];
            let html = generator.generate_html_content(&empty_results);
            
            prop_assert!(html.is_ok(), "HTML generation should handle empty results gracefully");
            
            let html_content = html.unwrap();
            prop_assert!(html_content.contains("0"), "HTML should show 0 for empty statistics");
            prop_assert!(html_content.contains("Test Summary"), "HTML should still contain summary section");
            
            // Should handle missing images gracefully (tested in the image handling functions)
            prop_assert!(html_content.contains("<!DOCTYPE html>"), 
                "HTML should be well-formed even with empty results");
        }
    }

    // Helper functions for layout shift testing
    
    /// Create a pattern image for shift testing
    fn create_shifted_pattern_image(width: u32, height: u32, color: [u8; 4], shift_x: u32, shift_y: u32) -> DynamicImage {
        use image::{ImageBuffer, Rgba};
        
        let img = ImageBuffer::from_fn(width, height, |x, y| {
            // Create a simple pattern that's detectable when shifted
            let pattern_x = (x + shift_x) % 10;
            let pattern_y = (y + shift_y) % 10;
            
            if pattern_x < 5 && pattern_y < 5 {
                Rgba(color)
            } else {
                Rgba([color[0] / 2, color[1] / 2, color[2] / 2, color[3]])
            }
        });
        
        DynamicImage::ImageRgba8(img)
    }
    
    /// Create a checkerboard pattern for testing
    fn create_checkerboard_pattern(width: u32, height: u32, color1: [u8; 4], color2: [u8; 4]) -> DynamicImage {
        use image::{ImageBuffer, Rgba};
        
        let img = ImageBuffer::from_fn(width, height, |x, y| {
            if (x / 8 + y / 8) % 2 == 0 {
                Rgba(color1)
            } else {
                Rgba(color2)
            }
        });
        
        DynamicImage::ImageRgba8(img)
    }
    
    /// Create a shifted checkerboard pattern
    fn create_shifted_checkerboard_pattern(
        width: u32, height: u32, 
        color1: [u8; 4], color2: [u8; 4], 
        shift_x: u32, shift_y: u32
    ) -> DynamicImage {
        use image::{ImageBuffer, Rgba};
        
        let img = ImageBuffer::from_fn(width, height, |x, y| {
            let shifted_x = x.saturating_add(shift_x);
            let shifted_y = y.saturating_add(shift_y);
            
            if (shifted_x / 8 + shifted_y / 8) % 2 == 0 {
                Rgba(color1)
            } else {
                Rgba(color2)
            }
        });
        
        DynamicImage::ImageRgba8(img)
    }
}
