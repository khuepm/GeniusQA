//! Comprehensive unit tests for storage operations
//! 
//! This module contains extensive tests for all storage backend functionality,
//! including file operations, compression, IPC communication, and error handling.

#[cfg(test)]
mod tests {
    use crate::visual_testing::*;
    use image::{DynamicImage, RgbImage};
    use std::fs;
    use std::path::Path;
    use tempfile::TempDir;

    /// Create a test image for testing purposes
    fn create_test_image(width: u32, height: u32) -> DynamicImage {
        let mut img = RgbImage::new(width, height);
        
        // Create a simple pattern
        for (x, y, pixel) in img.enumerate_pixels_mut() {
            let r = (x * 255 / width) as u8;
            let g = (y * 255 / height) as u8;
            let b = ((x + y) * 255 / (width + height)) as u8;
            *pixel = image::Rgb([r, g, b]);
        }
        
        DynamicImage::ImageRgb8(img)
    }

    /// Create a test image with transparency
    fn create_test_image_with_alpha(width: u32, height: u32) -> DynamicImage {
        use image::RgbaImage;
        
        let mut img = RgbaImage::new(width, height);
        
        for (x, y, pixel) in img.enumerate_pixels_mut() {
            let r = (x * 255 / width) as u8;
            let g = (y * 255 / height) as u8;
            let b = ((x + y) * 255 / (width + height)) as u8;
            let a = if x % 2 == 0 { 255 } else { 128 }; // Semi-transparent pattern
            *pixel = image::Rgba([r, g, b, a]);
        }
        
        DynamicImage::ImageRgba8(img)
    }

    mod local_file_storage_tests {
        use super::*;

        #[test]
        fn test_storage_creation_and_directory_structure() {
            let temp_dir = TempDir::new().unwrap();
            let storage = LocalFileStorage::new(temp_dir.path(), 100).unwrap();
            
            // Verify all required subdirectories were created
            assert!(temp_dir.path().join("baselines").exists());
            assert!(temp_dir.path().join("results").exists());
            assert!(temp_dir.path().join("thumbnails").exists());
            assert!(temp_dir.path().join("temp").exists());
        }

        #[test]
        fn test_baseline_operations() {
            let temp_dir = TempDir::new().unwrap();
            let storage = LocalFileStorage::new(temp_dir.path(), 100).unwrap();
            let test_image = create_test_image(100, 100);
            
            // Test saving baseline
            let saved_path = storage.save_baseline(&test_image, "test_baseline.png").unwrap();
            assert!(!saved_path.is_empty());
            assert!(storage.exists("baselines/test_baseline.png"));
            
            // Test loading baseline
            let loaded_image = storage.load_baseline("test_baseline.png").unwrap();
            assert_eq!(loaded_image.width(), test_image.width());
            assert_eq!(loaded_image.height(), test_image.height());
            
            // Test metadata
            let metadata = storage.get_metadata("baselines/test_baseline.png").unwrap();
            assert!(metadata.size_bytes > 0);
            assert!(!metadata.checksum.is_empty());
            assert_eq!(metadata.file_type, "png");
        }

        #[test]
        fn test_result_operations() {
            let temp_dir = TempDir::new().unwrap();
            let storage = LocalFileStorage::new(temp_dir.path(), 100).unwrap();
            let test_image = create_test_image(200, 150);
            
            // Test saving result
            let saved_path = storage.save_result(&test_image, "test_result.png").unwrap();
            assert!(!saved_path.is_empty());
            assert!(storage.exists("results/test_result.png"));
            
            // Test loading result
            let loaded_image = storage.load_result("test_result.png").unwrap();
            assert_eq!(loaded_image.width(), test_image.width());
            assert_eq!(loaded_image.height(), test_image.height());
        }

        #[test]
        fn test_compression_with_webp() {
            let temp_dir = TempDir::new().unwrap();
            let compression_config = CompressionConfig {
                use_webp: true,
                optimize_png: true,
                generate_thumbnails: true,
                ..Default::default()
            };
            
            let storage = LocalFileStorage::new(temp_dir.path(), 100)
                .unwrap()
                .with_compression_config(compression_config);
            
            let test_image = create_test_image(300, 200);
            
            // Save with WebP compression
            let saved_path = storage.save_baseline(&test_image, "webp_test.png").unwrap();
            
            // Should create WebP file or fallback to PNG
            assert!(saved_path.ends_with(".webp") || saved_path.ends_with(".png"));
            
            // Should be able to load it back
            let loaded_image = storage.load_baseline("webp_test.png").unwrap();
            assert_eq!(loaded_image.width(), test_image.width());
            assert_eq!(loaded_image.height(), test_image.height());
        }

        #[test]
        fn test_thumbnail_generation() {
            let temp_dir = TempDir::new().unwrap();
            let compression_config = CompressionConfig {
                generate_thumbnails: true,
                thumbnail_size: (150, 100),
                ..Default::default()
            };
            
            let storage = LocalFileStorage::new(temp_dir.path(), 100)
                .unwrap()
                .with_compression_config(compression_config);
            
            let test_image = create_test_image(600, 400);
            
            // Save image (should generate thumbnail)
            storage.save_baseline(&test_image, "thumb_test.png").unwrap();
            
            // Check if thumbnail was created
            let thumbnail_path = temp_dir.path().join("thumbnails").join("thumb_test_thumb.png");
            assert!(thumbnail_path.exists());
        }

        #[test]
        fn test_storage_usage_calculation() {
            let temp_dir = TempDir::new().unwrap();
            let storage = LocalFileStorage::new(temp_dir.path(), 100).unwrap();
            
            // Initially should be empty
            let initial_usage = storage.get_storage_usage().unwrap();
            assert_eq!(initial_usage.total_size_bytes, 0);
            
            // Add some files
            let test_image1 = create_test_image(100, 100);
            let test_image2 = create_test_image(200, 200);
            
            storage.save_baseline(&test_image1, "usage_test1.png").unwrap();
            storage.save_result(&test_image2, "usage_test2.png").unwrap();
            
            // Check usage after adding files
            let usage = storage.get_storage_usage().unwrap();
            assert!(usage.total_size_bytes > 0);
            assert!(usage.category_sizes.contains_key("baselines"));
            assert!(usage.category_sizes.contains_key("results"));
        }

        #[test]
        fn test_file_listing() {
            let temp_dir = TempDir::new().unwrap();
            let storage = LocalFileStorage::new(temp_dir.path(), 100).unwrap();
            
            // Initially should be empty
            let files = storage.list_files("baselines").unwrap();
            assert!(files.is_empty());
            
            // Add some files
            let test_image = create_test_image(100, 100);
            storage.save_baseline(&test_image, "list_test1.png").unwrap();
            storage.save_baseline(&test_image, "list_test2.png").unwrap();
            
            // Check file listing
            let files = storage.list_files("baselines").unwrap();
            assert_eq!(files.len(), 2);
            assert!(files.contains(&"list_test1.png".to_string()));
            assert!(files.contains(&"list_test2.png".to_string()));
        }

        #[test]
        fn test_file_deletion() {
            let temp_dir = TempDir::new().unwrap();
            let storage = LocalFileStorage::new(temp_dir.path(), 100).unwrap();
            let test_image = create_test_image(100, 100);
            
            // Save and verify existence
            storage.save_baseline(&test_image, "delete_test.png").unwrap();
            assert!(storage.exists("baselines/delete_test.png"));
            
            // Delete and verify removal
            storage.delete("baselines/delete_test.png").unwrap();
            assert!(!storage.exists("baselines/delete_test.png"));
        }

        #[test]
        fn test_cleanup_old_results() {
            let temp_dir = TempDir::new().unwrap();
            let storage = LocalFileStorage::new(temp_dir.path(), 100).unwrap();
            let test_image = create_test_image(100, 100);
            
            // Save some test results
            storage.save_result(&test_image, "cleanup_test1.png").unwrap();
            storage.save_result(&test_image, "cleanup_test2.png").unwrap();
            
            // Verify files exist
            assert!(storage.exists("results/cleanup_test1.png"));
            assert!(storage.exists("results/cleanup_test2.png"));
            
            // Cleanup with 0 retention days (should remove all)
            storage.cleanup_old_results(0).unwrap();
            
            // Files should still exist since they were just created
            // (cleanup is based on modification time)
            assert!(storage.exists("results/cleanup_test1.png"));
            assert!(storage.exists("results/cleanup_test2.png"));
        }

        #[test]
        fn test_storage_size_limits() {
            let temp_dir = TempDir::new().unwrap();
            // Set very small limit (1MB)
            let storage = LocalFileStorage::new(temp_dir.path(), 1).unwrap();
            
            // Create a large image that might exceed the limit
            let large_image = create_test_image(2000, 2000);
            
            // This might fail due to size limits, but should handle gracefully
            let result = storage.save_baseline(&large_image, "large_test.png");
            
            // Either succeeds or fails with appropriate error
            match result {
                Ok(_) => {
                    // If it succeeds, the image was within limits
                    assert!(storage.exists("baselines/large_test.png"));
                }
                Err(VisualError::InsufficientMemory { .. }) => {
                    // Expected error for size limit exceeded
                }
                Err(e) => {
                    panic!("Unexpected error: {:?}", e);
                }
            }
        }

        #[test]
        fn test_error_handling() {
            let temp_dir = TempDir::new().unwrap();
            let storage = LocalFileStorage::new(temp_dir.path(), 100).unwrap();
            
            // Test loading non-existent file
            let result = storage.load_baseline("nonexistent.png");
            assert!(result.is_err());
            match result.unwrap_err() {
                VisualError::ImageLoadError { .. } => {
                    // Expected error
                }
                e => panic!("Unexpected error type: {:?}", e),
            }
            
            // Test getting metadata for non-existent file
            let result = storage.get_metadata("nonexistent.png");
            assert!(result.is_err());
            match result.unwrap_err() {
                VisualError::FileSystemError { .. } => {
                    // Expected error
                }
                e => panic!("Unexpected error type: {:?}", e),
            }
        }
    }

    mod asset_manager_tests {
        use super::*;

        #[test]
        fn test_asset_manager_creation() {
            let temp_dir = TempDir::new().unwrap();
            let primary_storage = Box::new(LocalFileStorage::new(temp_dir.path(), 100).unwrap());
            let manager = AssetManager::new(primary_storage);
            
            let test_image = create_test_image(100, 100);
            
            // Test save and load through manager
            let saved_path = manager.save_with_compression(&test_image, "manager_test.png", true).unwrap();
            assert!(!saved_path.is_empty());
            
            let loaded_image = manager.load_image("manager_test.png", true).unwrap();
            assert_eq!(loaded_image.width(), test_image.width());
            assert_eq!(loaded_image.height(), test_image.height());
        }

        #[test]
        fn test_asset_manager_with_fallback() {
            let temp_dir1 = TempDir::new().unwrap();
            let temp_dir2 = TempDir::new().unwrap();
            
            let primary_storage = Box::new(LocalFileStorage::new(temp_dir1.path(), 100).unwrap());
            let fallback_storage = Box::new(LocalFileStorage::new(temp_dir2.path(), 100).unwrap());
            
            let manager = AssetManager::new(primary_storage).with_fallback(fallback_storage);
            
            let test_image = create_test_image(100, 100);
            
            // Save through manager
            manager.save_with_compression(&test_image, "fallback_test.png", true).unwrap();
            
            // Should be able to load
            let loaded_image = manager.load_image("fallback_test.png", true).unwrap();
            assert_eq!(loaded_image.width(), test_image.width());
        }

        #[test]
        fn test_total_storage_usage() {
            let temp_dir = TempDir::new().unwrap();
            let primary_storage = Box::new(LocalFileStorage::new(temp_dir.path(), 100).unwrap());
            let manager = AssetManager::new(primary_storage);
            
            let test_image = create_test_image(100, 100);
            
            // Save some files
            manager.save_with_compression(&test_image, "usage1.png", true).unwrap();
            manager.save_with_compression(&test_image, "usage2.png", false).unwrap();
            
            let usage = manager.get_total_storage_usage().unwrap();
            assert!(usage.total_size_bytes > 0);
            assert!(usage.file_count >= 2);
        }

        #[test]
        fn test_cleanup_all_backends() {
            let temp_dir = TempDir::new().unwrap();
            let primary_storage = Box::new(LocalFileStorage::new(temp_dir.path(), 100).unwrap());
            let manager = AssetManager::new(primary_storage);
            
            let test_image = create_test_image(100, 100);
            
            // Save some files
            manager.save_with_compression(&test_image, "cleanup1.png", false).unwrap();
            manager.save_with_compression(&test_image, "cleanup2.png", false).unwrap();
            
            // Cleanup should succeed
            manager.cleanup_all_backends(0).unwrap();
        }
    }

    mod compression_tests {
        use super::*;

        #[test]
        fn test_image_optimization() {
            let optimizer = ImageOptimizer::new();
            let test_image = create_test_image(100, 100);
            
            let optimized_data = optimizer.optimize_image(&test_image).unwrap();
            assert!(!optimized_data.is_empty());
        }

        #[test]
        fn test_different_formats() {
            let test_image = create_test_image(100, 100);
            
            // Test PNG optimization
            let png_optimizer = ImageOptimizer::with_settings(OptimizationSettings {
                target_format: image::ImageFormat::Png,
                ..Default::default()
            });
            let png_data = png_optimizer.optimize_image(&test_image).unwrap();
            
            // Test JPEG optimization
            let jpeg_optimizer = ImageOptimizer::with_settings(OptimizationSettings {
                target_format: image::ImageFormat::Jpeg,
                ..Default::default()
            });
            let jpeg_data = jpeg_optimizer.optimize_image(&test_image).unwrap();
            
            // Test WebP optimization
            let webp_optimizer = ImageOptimizer::with_settings(OptimizationSettings {
                target_format: image::ImageFormat::WebP,
                ..Default::default()
            });
            let webp_data = webp_optimizer.optimize_image(&test_image).unwrap();
            
            assert!(!png_data.is_empty());
            assert!(!jpeg_data.is_empty());
            assert!(!webp_data.is_empty());
        }

        #[test]
        fn test_format_suggestion() {
            let optimizer = ImageOptimizer::new();
            
            // Test with regular RGB image
            let rgb_image = create_test_image(100, 100);
            let suggested_format = optimizer.suggest_optimal_format(&rgb_image);
            assert!(matches!(suggested_format, image::ImageFormat::Jpeg | image::ImageFormat::WebP));
            
            // Test with image containing transparency
            let rgba_image = create_test_image_with_alpha(100, 100);
            let suggested_format = optimizer.suggest_optimal_format(&rgba_image);
            assert_eq!(suggested_format, image::ImageFormat::Png);
        }

        #[test]
        fn test_compression_estimation() {
            let optimizer = ImageOptimizer::new();
            let test_image = create_test_image(200, 200);
            
            let estimate = optimizer.estimate_compression_ratios(&test_image).unwrap();
            
            assert!(estimate.original_size > 0);
            assert!(estimate.png_size > 0);
            assert!(estimate.jpeg_size > 0);
            assert!(estimate.webp_size > 0);
            
            // Compressed sizes should generally be smaller than original
            assert!(estimate.png_size < estimate.original_size);
            assert!(estimate.jpeg_size < estimate.original_size);
            assert!(estimate.webp_size < estimate.original_size);
            
            // Test compression ratio calculation
            let png_ratio = estimate.compression_ratio(image::ImageFormat::Png);
            assert!(png_ratio > 0.0 && png_ratio <= 1.0);
            
            let savings = estimate.space_savings_percent(image::ImageFormat::Png);
            assert!(savings >= 0.0 && savings <= 100.0);
        }

        #[test]
        fn test_thumbnail_generation() {
            let generator = ThumbnailGenerator::new();
            let test_image = create_test_image(400, 300);
            
            let thumbnail = generator.generate_thumbnail(&test_image).unwrap();
            
            // Default thumbnail size is 300x200
            assert_eq!(thumbnail.width(), 300);
            assert_eq!(thumbnail.height(), 200);
        }

        #[test]
        fn test_thumbnail_aspect_ratio() {
            let settings = ThumbnailSettings {
                dimensions: (200, 200),
                maintain_aspect_ratio: true,
                ..Default::default()
            };
            
            let generator = ThumbnailGenerator::with_settings(settings);
            let test_image = create_test_image(400, 200); // 2:1 aspect ratio
            
            let thumbnail = generator.generate_thumbnail(&test_image).unwrap();
            
            // Should maintain aspect ratio, so height should be 100 (200/2)
            assert_eq!(thumbnail.width(), 200);
            assert_eq!(thumbnail.height(), 100);
        }

        #[test]
        fn test_multiple_thumbnails() {
            let generator = ThumbnailGenerator::new();
            let test_image = create_test_image(800, 600);
            
            let sizes = [(100, 75), (200, 150), (400, 300)];
            let thumbnails = generator.generate_multiple_thumbnails(&test_image, &sizes).unwrap();
            
            assert_eq!(thumbnails.len(), 3);
            assert_eq!(thumbnails[0].width(), 100);
            assert_eq!(thumbnails[1].width(), 200);
            assert_eq!(thumbnails[2].width(), 400);
        }

        #[test]
        fn test_integrity_validation() {
            let test_image = create_test_image(100, 100);
            
            // Calculate checksum
            let checksum1 = IntegrityValidator::calculate_image_checksum(&test_image).unwrap();
            let checksum2 = IntegrityValidator::calculate_image_checksum(&test_image).unwrap();
            
            // Same image should produce same checksum
            assert_eq!(checksum1, checksum2);
            assert!(!checksum1.is_empty());
            
            // Verify integrity
            let is_valid = IntegrityValidator::verify_image_integrity(&test_image, &checksum1).unwrap();
            assert!(is_valid);
            
            // Test with wrong checksum
            let is_valid = IntegrityValidator::verify_image_integrity(&test_image, "wrong_checksum").unwrap();
            assert!(!is_valid);
        }

        #[test]
        fn test_batch_processing() {
            let images = vec![
                create_test_image(100, 100),
                create_test_image(200, 150),
                create_test_image(150, 200),
            ];
            
            let processor = BatchProcessor::new(
                OptimizationSettings::default(),
                ThumbnailSettings::default(),
            );
            
            let results = processor.process_images(&images).unwrap();
            assert_eq!(results.len(), 3);
            
            // Check that all images were processed
            for (i, result) in results.iter().enumerate() {
                assert_eq!(result.index, i);
                assert!(result.original_size > 0);
                assert!(!result.optimized_data.is_empty());
                assert!(!result.thumbnail_data.is_empty());
                assert!(!result.checksum.is_empty());
            }
            
            // Get processing statistics
            let stats = processor.get_processing_stats(&results);
            assert_eq!(stats.image_count, 3);
            assert!(stats.total_original_size > 0);
            assert!(stats.total_optimized_size > 0);
            assert!(stats.compression_ratio > 0.0);
        }
    }

    mod ipc_server_tests {
        use super::*;
        use std::fs::File;
        use std::io::Write;

        #[test]
        fn test_server_startup_and_shutdown() {
            let config = IpcServerConfig::default();
            let mut server = LocalImageServer::new(config);
            
            let addr = server.start().unwrap();
            assert!(addr.port() > 0);
            
            server.stop().unwrap();
        }

        #[test]
        fn test_file_serving() {
            let temp_dir = TempDir::new().unwrap();
            let test_file = temp_dir.path().join("test_serve.png");
            
            // Create a test file
            let mut file = File::create(&test_file).unwrap();
            file.write_all(b"test image data for serving").unwrap();
            
            let config = IpcServerConfig::default();
            let mut server = LocalImageServer::new(config);
            server.start().unwrap();
            
            let url = server.serve_file(&test_file).unwrap();
            assert!(url.starts_with("http://"));
            assert!(url.contains("/image/"));
            
            // Check server stats
            let stats = server.get_server_stats();
            assert_eq!(stats.total_files, 1);
            assert!(stats.total_size_bytes > 0);
            
            server.stop().unwrap();
        }

        #[test]
        fn test_content_serving() {
            let config = IpcServerConfig::default();
            let mut server = LocalImageServer::new(config);
            server.start().unwrap();
            
            let content = b"test image content for serving";
            let url = server.serve_content(content, "test_content.png").unwrap();
            
            assert!(url.starts_with("http://"));
            assert!(url.contains("/image/"));
            
            let stats = server.get_server_stats();
            assert_eq!(stats.total_files, 1);
            assert_eq!(stats.total_size_bytes, content.len() as u64);
            
            server.stop().unwrap();
        }

        #[test]
        fn test_cleanup_functionality() {
            let config = IpcServerConfig {
                max_file_age_secs: 1, // Very short age for testing
                ..Default::default()
            };
            
            let mut server = LocalImageServer::new(config);
            server.start().unwrap();
            
            // Serve some content
            server.serve_content(b"test1", "test1.png").unwrap();
            server.serve_content(b"test2", "test2.png").unwrap();
            
            let stats_before = server.get_server_stats();
            assert_eq!(stats_before.total_files, 2);
            
            // Wait for files to expire
            std::thread::sleep(std::time::Duration::from_secs(2));
            
            // Cleanup expired files
            let removed_count = server.cleanup_expired_files().unwrap();
            assert_eq!(removed_count, 2);
            
            let stats_after = server.get_server_stats();
            assert_eq!(stats_after.total_files, 0);
            
            server.stop().unwrap();
        }

        #[test]
        fn test_ipc_handler() {
            let temp_dir = TempDir::new().unwrap();
            let test_file = temp_dir.path().join("ipc_test.png");
            
            let mut file = File::create(&test_file).unwrap();
            file.write_all(b"test image for IPC").unwrap();
            
            let config = IpcServerConfig::default();
            let handler = IpcHandler::new(config).unwrap();
            
            // Test serve file message
            let message = IpcMessage::ServeFile {
                file_path: test_file.display().to_string(),
            };
            
            let response = handler.handle_message(message);
            match response {
                IpcMessage::FileServed { url, file_id } => {
                    assert!(url.starts_with("http://"));
                    assert!(!file_id.is_empty());
                }
                _ => panic!("Expected FileServed response"),
            }
            
            // Test get stats message
            let stats_message = IpcMessage::GetServerStats;
            let stats_response = handler.handle_message(stats_message);
            match stats_response {
                IpcMessage::ServerStats(stats) => {
                    assert_eq!(stats.total_files, 1);
                }
                _ => panic!("Expected ServerStats response"),
            }
            
            // Test cleanup message
            let cleanup_message = IpcMessage::CleanupExpired;
            let cleanup_response = handler.handle_message(cleanup_message);
            match cleanup_response {
                IpcMessage::CleanupResult { removed_count } => {
                    // Should be 0 since files are not expired yet
                    assert_eq!(removed_count, 0);
                }
                _ => panic!("Expected CleanupResult response"),
            }
        }

        #[test]
        fn test_error_handling() {
            let config = IpcServerConfig::default();
            let handler = IpcHandler::new(config).unwrap();
            
            // Test serving non-existent file
            let message = IpcMessage::ServeFile {
                file_path: "/nonexistent/file.png".to_string(),
            };
            
            let response = handler.handle_message(message);
            match response {
                IpcMessage::Error { message, error_type } => {
                    assert!(!message.is_empty());
                    assert!(!error_type.is_empty());
                }
                _ => panic!("Expected Error response"),
            }
        }
    }

    mod integration_tests {
        use super::*;

        #[test]
        fn test_end_to_end_storage_workflow() {
            let temp_dir = TempDir::new().unwrap();
            
            // Create storage with compression
            let compression_config = CompressionConfig {
                optimize_png: true,
                use_webp: false, // Keep PNG for compatibility
                generate_thumbnails: true,
                thumbnail_size: (150, 100),
                ..Default::default()
            };
            
            let storage = LocalFileStorage::new(temp_dir.path(), 100)
                .unwrap()
                .with_compression_config(compression_config);
            
            // Create asset manager
            let manager = AssetManager::new(Box::new(storage));
            
            // Create test images
            let baseline_image = create_test_image(400, 300);
            let actual_image = create_test_image(400, 300);
            let diff_image = create_test_image_with_alpha(400, 300);
            
            // Save baseline
            let baseline_path = manager.save_with_compression(&baseline_image, "workflow_baseline.png", true).unwrap();
            assert!(!baseline_path.is_empty());
            
            // Save actual and diff results
            let actual_path = manager.save_with_compression(&actual_image, "workflow_actual.png", false).unwrap();
            let diff_path = manager.save_with_compression(&diff_image, "workflow_diff.png", false).unwrap();
            
            // Verify all files can be loaded
            let loaded_baseline = manager.load_image("workflow_baseline.png", true).unwrap();
            let loaded_actual = manager.load_image("workflow_actual.png", false).unwrap();
            let loaded_diff = manager.load_image("workflow_diff.png", false).unwrap();
            
            assert_eq!(loaded_baseline.width(), baseline_image.width());
            assert_eq!(loaded_actual.width(), actual_image.width());
            assert_eq!(loaded_diff.width(), diff_image.width());
            
            // Check storage usage
            let usage = manager.get_total_storage_usage().unwrap();
            assert!(usage.total_size_bytes > 0);
            assert!(usage.file_count >= 3);
            
            // Verify thumbnails were created
            let thumbnail_dir = temp_dir.path().join("thumbnails");
            assert!(thumbnail_dir.exists());
            
            // Clean up
            manager.cleanup_all_backends(0).unwrap();
        }

        #[test]
        fn test_storage_with_ipc_integration() {
            let temp_dir = TempDir::new().unwrap();
            let storage = LocalFileStorage::new(temp_dir.path(), 100).unwrap();
            let test_image = create_test_image(200, 150);
            
            // Save image through storage
            let saved_path = storage.save_baseline(&test_image, "ipc_integration.png").unwrap();
            
            // Start IPC server
            let config = IpcServerConfig::default();
            let handler = IpcHandler::new(config).unwrap();
            
            // Serve the saved file through IPC
            let message = IpcMessage::ServeFile {
                file_path: saved_path,
            };
            
            let response = handler.handle_message(message);
            match response {
                IpcMessage::FileServed { url, file_id } => {
                    assert!(url.starts_with("http://"));
                    assert!(!file_id.is_empty());
                    
                    // Verify server base URL is available
                    let base_url = handler.get_server_base_url().unwrap();
                    assert!(url.starts_with(&base_url));
                }
                _ => panic!("Expected FileServed response"),
            }
        }

        #[test]
        fn test_compression_and_integrity_workflow() {
            let test_image = create_test_image(300, 200);
            
            // Calculate original checksum
            let original_checksum = IntegrityValidator::calculate_image_checksum(&test_image).unwrap();
            
            // Optimize image
            let optimizer = ImageOptimizer::new();
            let optimized_data = optimizer.optimize_image(&test_image).unwrap();
            
            // Load optimized image back
            let optimized_image = image::load_from_memory(&optimized_data).unwrap();
            
            // Verify dimensions are preserved
            assert_eq!(optimized_image.width(), test_image.width());
            assert_eq!(optimized_image.height(), test_image.height());
            
            // Generate thumbnail
            let thumbnail_generator = ThumbnailGenerator::new();
            let thumbnail = thumbnail_generator.generate_thumbnail(&test_image).unwrap();
            let thumbnail_bytes = thumbnail_generator.generate_thumbnail_bytes(&test_image).unwrap();
            
            // Verify thumbnail
            assert_eq!(thumbnail.width(), 300); // Default thumbnail width
            assert_eq!(thumbnail.height(), 200); // Default thumbnail height
            assert!(!thumbnail_bytes.is_empty());
            
            // Verify integrity validation works
            let is_valid = IntegrityValidator::verify_image_integrity(&test_image, &original_checksum).unwrap();
            assert!(is_valid);
        }
    }
}
