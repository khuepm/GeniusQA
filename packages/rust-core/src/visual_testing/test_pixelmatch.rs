//! Simple test for PixelMatch implementation

#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::visual_testing::{
        ImageComparator, ComparisonConfig, ComparisonMethod, SensitivityProfile,
        ImageLoader
    };

    #[test]
    fn test_pixelmatch_identical_images() {
        // Create two identical test images
        let image1 = ImageLoader::create_test_image(100, 100, [255, 0, 0, 255]); // Red
        let image2 = ImageLoader::create_test_image(100, 100, [255, 0, 0, 255]); // Red
        
        let config = ComparisonConfig::default();
        
        let result = ImageComparator::compare(&image1, &image2, config).unwrap();
        
        assert!(result.is_match);
        assert_eq!(result.mismatch_percentage, 0.0);
    }

    #[test]
    fn test_pixelmatch_different_images() {
        // Create two different test images
        let image1 = ImageLoader::create_test_image(100, 100, [255, 0, 0, 255]); // Red
        let image2 = ImageLoader::create_test_image(100, 100, [0, 255, 0, 255]); // Green
        
        let config = ComparisonConfig::default();
        
        let result = ImageComparator::compare(&image1, &image2, config).unwrap();
        
        assert!(!result.is_match);
        assert_eq!(result.mismatch_percentage, 1.0); // 100% different
    }

    #[test]
    fn test_pixelmatch_with_threshold() {
        // Create images with small differences
        let image1 = ImageLoader::create_test_image(100, 100, [255, 0, 0, 255]); // Red
        let image2 = ImageLoader::create_test_image(100, 100, [0, 255, 0, 255]); // Green
        
        let mut config = ComparisonConfig::default();
        config.threshold = 0.5; // 50% threshold
        
        let result = ImageComparator::compare(&image1, &image2, config).unwrap();
        
        assert!(!result.is_match); // Still fails because 100% > 50%
        assert_eq!(result.mismatch_percentage, 1.0);
    }

    #[test]
    fn test_pixelmatch_performance_metrics() {
        let image1 = ImageLoader::create_test_image(100, 100, [255, 0, 0, 255]);
        let image2 = ImageLoader::create_test_image(100, 100, [255, 0, 0, 255]);
        
        let config = ComparisonConfig::default();
        
        let result = ImageComparator::compare(&image1, &image2, config).unwrap();
        
        // Check that performance metrics are recorded
        assert!(result.performance_metrics.comparison_time_ms > 0);
        assert_eq!(result.performance_metrics.image_dimensions, (100, 100));
    }

    #[test]
    fn test_pixelmatch_dimension_mismatch() {
        let image1 = ImageLoader::create_test_image(100, 100, [255, 0, 0, 255]);
        let image2 = ImageLoader::create_test_image(200, 100, [255, 0, 0, 255]);
        
        let config = ComparisonConfig::default();
        
        let result = ImageComparator::compare(&image1, &image2, config);
        
        assert!(result.is_err());
        match result.unwrap_err() {
            VisualError::DimensionMismatch { baseline_width, baseline_height, actual_width, actual_height } => {
                assert_eq!(baseline_width, 100);
                assert_eq!(baseline_height, 100);
                assert_eq!(actual_width, 200);
                assert_eq!(actual_height, 100);
            }
            _ => panic!("Expected DimensionMismatch error"),
        }
    }

    #[test]
    fn test_pixelmatch_with_anti_aliasing_tolerance() {
        let image1 = ImageLoader::create_test_image(100, 100, [255, 0, 0, 255]);
        let image2 = ImageLoader::create_test_image(100, 100, [250, 5, 5, 255]); // Slightly different
        
        let mut config = ComparisonConfig::default();
        config.anti_aliasing_tolerance = true;
        
        let result = ImageComparator::compare(&image1, &image2, config).unwrap();
        
        // With anti-aliasing tolerance, small differences should be ignored
        assert!(result.is_match);
        assert_eq!(result.mismatch_percentage, 0.0);
    }
}
