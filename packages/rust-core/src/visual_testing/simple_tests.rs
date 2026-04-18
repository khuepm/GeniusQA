//! Simple tests for visual regression testing functionality

#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::visual_testing::{
        ImageComparator, ComparisonConfig, ComparisonMethod, SensitivityProfile,
        ImageLoader, HTMLReportGenerator, HTMLReportConfig, TestResultWithMetadata,
        DifferenceType, PerformanceMetrics
    };

    #[test]
    fn test_ssim_algorithm_basic() {
        // Create two identical test images
        let width = 100u32;
        let height = 100u32;
        let color = [128, 128, 128, 255];
        
        let baseline_image = ImageLoader::create_test_image(width, height, color);
        let actual_image = ImageLoader::create_test_image(width, height, color);
        
        let config = ComparisonConfig {
            threshold: 0.01,
            method: ComparisonMethod::SSIM,
            ignore_regions: Vec::new(),
            include_roi: None,
            anti_aliasing_tolerance: false,
            layout_shift_tolerance: 0,
            sensitivity_profile: SensitivityProfile::Flexible,
        };
        
        let result = ImageComparator::compare(&baseline_image, &actual_image, config).unwrap();
        
        // Identical images should have 0% mismatch with SSIM
        assert_eq!(result.mismatch_percentage, 0.0);
        assert!(result.is_match);
        assert_eq!(result.difference_type, DifferenceType::NoChange);
    }

    #[test]
    fn test_layout_aware_algorithm_basic() {
        // Create two identical test images
        let width = 100u32;
        let height = 100u32;
        let color = [200, 100, 50, 255];
        
        let baseline_image = ImageLoader::create_test_image(width, height, color);
        let actual_image = ImageLoader::create_test_image(width, height, color);
        
        let config = ComparisonConfig {
            threshold: 0.01,
            method: ComparisonMethod::LayoutAware,
            ignore_regions: Vec::new(),
            include_roi: None,
            anti_aliasing_tolerance: false,
            layout_shift_tolerance: 2,
            sensitivity_profile: SensitivityProfile::Moderate,
        };
        
        let result = ImageComparator::compare(&baseline_image, &actual_image, config).unwrap();
        
        // Identical images should have 0% mismatch with LayoutAware
        assert_eq!(result.mismatch_percentage, 0.0);
        assert!(result.is_match);
        assert_eq!(result.difference_type, DifferenceType::NoChange);
    }

    #[test]
    fn test_anti_aliasing_tolerance() {
        let width = 50u32;
        let height = 50u32;
        let base_color = [100, 100, 100, 255];
        
        // Create baseline image
        let baseline_image = ImageLoader::create_test_image(width, height, base_color);
        
        // Create actual image with slight anti-aliasing differences (5 RGB difference)
        let mut aa_color = base_color;
        aa_color[0] = aa_color[0].saturating_add(5);
        aa_color[1] = aa_color[1].saturating_add(5);
        aa_color[2] = aa_color[2].saturating_add(5);
        let actual_image = ImageLoader::create_test_image(width, height, aa_color);
        
        // Test with anti-aliasing tolerance enabled
        let config_with_tolerance = ComparisonConfig {
            threshold: 0.5,
            method: ComparisonMethod::PixelMatch,
            ignore_regions: Vec::new(),
            include_roi: None,
            anti_aliasing_tolerance: true,
            layout_shift_tolerance: 0,
            sensitivity_profile: SensitivityProfile::Flexible,
        };
        
        // Test without anti-aliasing tolerance
        let config_without_tolerance = ComparisonConfig {
            anti_aliasing_tolerance: false,
            ..config_with_tolerance.clone()
        };
        
        let result_with_tolerance = ImageComparator::compare(&baseline_image, &actual_image, config_with_tolerance).unwrap();
        let result_without_tolerance = ImageComparator::compare(&baseline_image, &actual_image, config_without_tolerance).unwrap();
        
        // With anti-aliasing tolerance, small differences should be more tolerated
        assert!(result_with_tolerance.mismatch_percentage <= result_without_tolerance.mismatch_percentage);
    }

    #[test]
    fn test_html_report_generation() {
        let config = HTMLReportConfig::default();
        let generator = HTMLReportGenerator::new(config);
        
        // Create test result
        let result = ComparisonResult::new(
            false,
            0.15,
            DifferenceType::ContentChange,
            "baseline.png".to_string(),
            "actual.png".to_string(),
        ).with_metrics(PerformanceMetrics {
            capture_time_ms: 50,
            preprocessing_time_ms: 10,
            comparison_time_ms: 100,
            postprocessing_time_ms: 20,
            memory_usage_mb: 64,
            image_dimensions: (1920, 1080),
        });
        
        let test_result = TestResultWithMetadata::new(result, "test_login_page".to_string())
            .with_description("Test login page visual appearance".to_string())
            .with_tags(vec!["ui".to_string(), "login".to_string()]);
        
        let results = vec![test_result];
        
        // Generate HTML content
        let html_content = generator.generate_html_content(&results).unwrap();
        
        // Verify HTML contains expected elements
        assert!(html_content.contains("<!DOCTYPE html>"));
        assert!(html_content.contains("Visual Regression Test Report"));
        assert!(html_content.contains("test_login_page"));
        assert!(html_content.contains("FAILED"));
        assert!(html_content.contains("15.00%")); // Mismatch percentage
        assert!(html_content.contains("ContentChange"));
    }

    #[test]
    fn test_comparison_method_selection() {
        let width = 50u32;
        let height = 50u32;
        let color = [150, 150, 150, 255];
        
        let baseline_image = ImageLoader::create_test_image(width, height, color);
        let actual_image = ImageLoader::create_test_image(width, height, color);
        
        // Test all comparison methods with identical images
        let methods = vec![
            ComparisonMethod::PixelMatch,
            ComparisonMethod::SSIM,
            ComparisonMethod::LayoutAware,
            ComparisonMethod::Hybrid,
        ];
        
        for method in methods {
            let config = ComparisonConfig {
                threshold: 0.01,
                method: method.clone(),
                ignore_regions: Vec::new(),
                include_roi: None,
                anti_aliasing_tolerance: false,
                layout_shift_tolerance: 1,
                sensitivity_profile: SensitivityProfile::Moderate,
            };
            
            let result = ImageComparator::compare(&baseline_image, &actual_image, config).unwrap();
            
            // All methods should detect identical images correctly
            assert_eq!(result.mismatch_percentage, 0.0, "Method {:?} failed on identical images", method);
            assert!(result.is_match, "Method {:?} should match identical images", method);
        }
    }

    #[test]
    fn test_performance_metrics() {
        let width = 200u32;
        let height = 200u32;
        let color = [75, 150, 225, 255];
        
        let baseline_image = ImageLoader::create_test_image(width, height, color);
        let actual_image = ImageLoader::create_test_image(width, height, color);
        
        let config = ComparisonConfig {
            threshold: 0.01,
            method: ComparisonMethod::PixelMatch,
            ignore_regions: Vec::new(),
            include_roi: None,
            anti_aliasing_tolerance: false,
            layout_shift_tolerance: 0,
            sensitivity_profile: SensitivityProfile::Strict,
        };
        
        let result = ImageComparator::compare(&baseline_image, &actual_image, config).unwrap();
        
        // Performance metrics should be populated
        assert_eq!(result.performance_metrics.image_dimensions, (width, height));
        assert!(result.performance_metrics.comparison_time_ms > 0);
        
        // For this small image, should meet performance requirements
        assert!(result.performance_metrics.meets_performance_requirements());
    }

    #[test]
    fn test_dimension_mismatch_error() {
        let baseline_image = ImageLoader::create_test_image(100, 100, [255, 0, 0, 255]);
        let actual_image = ImageLoader::create_test_image(200, 100, [0, 255, 0, 255]);
        
        let config = ComparisonConfig::default();
        let result = ImageComparator::compare(&baseline_image, &actual_image, config);
        
        // Should return dimension mismatch error
        assert!(result.is_err());
        
        if let Err(VisualError::DimensionMismatch { baseline_width, baseline_height, actual_width, actual_height }) = result {
            assert_eq!(baseline_width, 100);
            assert_eq!(baseline_height, 100);
            assert_eq!(actual_width, 200);
            assert_eq!(actual_height, 100);
        } else {
            panic!("Expected DimensionMismatch error, got {:?}", result);
        }
    }

    #[test]
    fn test_baseline_auto_generation() {
        let width = 50u32;
        let height = 50u32;
        let color = [200, 200, 200, 255];
        
        let actual_image = ImageLoader::create_test_image(width, height, color);
        
        // Create a temporary baseline path that doesn't exist
        let baseline_path = format!("test_baseline_{}.png", 
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        );
        
        // Ensure the baseline doesn't exist initially
        assert!(!std::path::Path::new(&baseline_path).exists());
        
        let config = ComparisonConfig::default();
        
        // Call compare_with_baseline_generation - should auto-create baseline
        let result = ImageComparator::compare_with_baseline_generation(
            &baseline_path, 
            &actual_image, 
            config
        ).unwrap();
        
        // Should pass (new baseline creation always passes)
        assert!(result.is_match);
        assert_eq!(result.mismatch_percentage, 0.0);
        assert_eq!(result.difference_type, DifferenceType::NoChange);
        
        // Baseline file should now exist
        assert!(std::path::Path::new(&baseline_path).exists());
        
        // Should have metadata indicating baseline was created
        assert!(result.metadata.contains_key("baseline_created"));
        assert_eq!(result.metadata.get("baseline_created"), Some(&"true".to_string()));
        
        // Clean up
        let _ = std::fs::remove_file(&baseline_path);
    }
}
