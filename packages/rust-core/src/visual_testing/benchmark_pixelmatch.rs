//! Performance benchmark for PixelMatch implementation

#[cfg(test)]
mod benchmarks {
    use super::super::*;
    use crate::visual_testing::{
        ImageComparator, ComparisonConfig, ComparisonMethod, SensitivityProfile,
        ImageLoader
    };
    use std::time::Instant;

    #[test]
    fn benchmark_pixelmatch_1920x1080() {
        // Create 1920x1080 test images (HD resolution)
        let image1 = ImageLoader::create_test_image(1920, 1080, [255, 0, 0, 255]); // Red
        let image2 = ImageLoader::create_test_image(1920, 1080, [255, 0, 0, 255]); // Red (identical)
        
        let config = ComparisonConfig::default();
        
        let start = Instant::now();
        let result = ImageComparator::compare(&image1, &image2, config).unwrap();
        let duration = start.elapsed();
        
        println!("PixelMatch 1920x1080 comparison took: {:?}", duration);
        println!("Performance metrics: {:?}", result.performance_metrics);
        
        // Verify the performance requirement (< 200ms for 1920x1080)
        assert!(result.performance_metrics.comparison_time_ms <= 200, 
            "Comparison took {}ms, expected <= 200ms", result.performance_metrics.comparison_time_ms);
        
        assert!(result.is_match);
        assert_eq!(result.mismatch_percentage, 0.0);
    }

    #[test]
    fn benchmark_pixelmatch_different_images() {
        // Create 1920x1080 test images with differences
        let image1 = ImageLoader::create_test_image(1920, 1080, [255, 0, 0, 255]); // Red
        let image2 = ImageLoader::create_test_image(1920, 1080, [0, 255, 0, 255]); // Green
        
        let config = ComparisonConfig::default();
        
        let start = Instant::now();
        let result = ImageComparator::compare(&image1, &image2, config).unwrap();
        let duration = start.elapsed();
        
        println!("PixelMatch 1920x1080 different images comparison took: {:?}", duration);
        println!("Performance metrics: {:?}", result.performance_metrics);
        
        // Verify the performance requirement
        assert!(result.performance_metrics.comparison_time_ms <= 200, 
            "Comparison took {}ms, expected <= 200ms", result.performance_metrics.comparison_time_ms);
        
        assert!(!result.is_match);
        assert_eq!(result.mismatch_percentage, 1.0);
    }

    #[test]
    fn benchmark_pixelmatch_smaller_images() {
        // Test with smaller images for baseline
        let image1 = ImageLoader::create_test_image(800, 600, [255, 0, 0, 255]);
        let image2 = ImageLoader::create_test_image(800, 600, [255, 0, 0, 255]);
        
        let config = ComparisonConfig::default();
        
        let start = Instant::now();
        let result = ImageComparator::compare(&image1, &image2, config).unwrap();
        let duration = start.elapsed();
        
        println!("PixelMatch 800x600 comparison took: {:?}", duration);
        println!("Performance metrics: {:?}", result.performance_metrics);
        
        // Should be much faster for smaller images
        assert!(result.performance_metrics.comparison_time_ms <= 50, 
            "Comparison took {}ms, expected <= 50ms for smaller images", result.performance_metrics.comparison_time_ms);
        
        assert!(result.is_match);
    }

    #[test]
    fn test_diff_image_generation() {
        // Test diff image generation
        let image1 = ImageLoader::create_test_image(100, 100, [255, 0, 0, 255]); // Red
        let image2 = ImageLoader::create_test_image(100, 100, [0, 255, 0, 255]); // Green
        
        let config = ComparisonConfig::default();
        
        let result = ImageComparator::compare(&image1, &image2, config).unwrap();
        
        // Should generate a diff image for different images
        assert!(result.diff_image_path.is_some());
        assert!(!result.is_match);
        
        println!("Diff image generated at: {:?}", result.diff_image_path);
    }

    #[test]
    fn test_no_diff_for_identical_images() {
        // Test that no diff is generated for identical images
        let image1 = ImageLoader::create_test_image(100, 100, [255, 0, 0, 255]);
        let image2 = ImageLoader::create_test_image(100, 100, [255, 0, 0, 255]);
        
        let config = ComparisonConfig::default();
        
        let result = ImageComparator::compare(&image1, &image2, config).unwrap();
        
        // Should not generate a diff image for identical images
        assert!(result.diff_image_path.is_none());
        assert!(result.is_match);
    }
}
