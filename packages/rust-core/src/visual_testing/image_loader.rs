//! Image loading and validation utilities for visual regression testing

use crate::visual_testing::{VisualError, VisualResult};
use image::{DynamicImage, ImageFormat, GenericImageView};
use std::path::Path;

/// Image loader with validation and format support
pub struct ImageLoader;

impl ImageLoader {
    /// Load an image from a file path with validation
    pub fn load_image<P: AsRef<Path>>(path: P) -> VisualResult<DynamicImage> {
        let path = path.as_ref();
        let path_str = path.to_string_lossy().to_string();

        // Check if file exists
        if !path.exists() {
            return Err(VisualError::ImageLoadError {
                path: path_str,
                reason: "File does not exist".to_string(),
            });
        }

        // Validate file extension
        Self::validate_image_format(&path_str)?;

        // Load the image
        match image::open(path) {
            Ok(img) => {
                // Validate image dimensions
                let (width, height) = img.dimensions();
                if width == 0 || height == 0 {
                    return Err(VisualError::ImageLoadError {
                        path: path_str,
                        reason: "Image has zero dimensions".to_string(),
                    });
                }

                Ok(img)
            }
            Err(e) => Err(VisualError::ImageLoadError {
                path: path_str,
                reason: e.to_string(),
            }),
        }
    }

    /// Save an image to a file path
    pub fn save_image<P: AsRef<Path>>(
        image: &DynamicImage,
        path: P,
        format: ImageFormat,
    ) -> VisualResult<()> {
        let path = path.as_ref();
        let path_str = path.to_string_lossy().to_string();

        // Create parent directory if it doesn't exist
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent).map_err(|e| VisualError::ImageSaveError {
                    path: path_str.clone(),
                    reason: format!("Failed to create directory: {}", e),
                })?;
            }
        }

        // Save the image
        image.save_with_format(path, format).map_err(|e| VisualError::ImageSaveError {
            path: path_str,
            reason: e.to_string(),
        })?;

        Ok(())
    }

    /// Validate that the file format is supported
    fn validate_image_format(path: &str) -> VisualResult<()> {
        let path_lower = path.to_lowercase();
        
        if path_lower.ends_with(".png") 
            || path_lower.ends_with(".jpg") 
            || path_lower.ends_with(".jpeg") 
            || path_lower.ends_with(".webp") {
            Ok(())
        } else {
            let extension = Path::new(path)
                .extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or("unknown");
            
            Err(VisualError::UnsupportedFormat {
                format: extension.to_string(),
            })
        }
    }

    /// Get the appropriate image format from file extension
    pub fn get_format_from_path<P: AsRef<Path>>(path: P) -> VisualResult<ImageFormat> {
        let path = path.as_ref();
        let path_str = path.to_string_lossy().to_lowercase();

        if path_str.ends_with(".png") {
            Ok(ImageFormat::Png)
        } else if path_str.ends_with(".jpg") || path_str.ends_with(".jpeg") {
            Ok(ImageFormat::Jpeg)
        } else if path_str.ends_with(".webp") {
            Ok(ImageFormat::WebP)
        } else {
            let extension = path
                .extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or("unknown");
            
            Err(VisualError::UnsupportedFormat {
                format: extension.to_string(),
            })
        }
    }

    /// Validate image dimensions for comparison
    pub fn validate_dimensions(
        baseline: &DynamicImage,
        actual: &DynamicImage,
    ) -> VisualResult<()> {
        let baseline_dims = baseline.dimensions();
        let actual_dims = actual.dimensions();

        if baseline_dims != actual_dims {
            return Err(VisualError::DimensionMismatch {
                baseline_width: baseline_dims.0,
                baseline_height: baseline_dims.1,
                actual_width: actual_dims.0,
                actual_height: actual_dims.1,
            });
        }

        Ok(())
    }

    /// Create a test image for testing purposes
    pub fn create_test_image(width: u32, height: u32, color: [u8; 4]) -> DynamicImage {
        use image::{ImageBuffer, Rgba};
        
        let img = ImageBuffer::from_fn(width, height, |_x, _y| {
            Rgba(color)
        });
        
        DynamicImage::ImageRgba8(img)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::fs;

    #[test]
    fn test_validate_image_format_valid() {
        assert!(ImageLoader::validate_image_format("test.png").is_ok());
        assert!(ImageLoader::validate_image_format("test.jpg").is_ok());
        assert!(ImageLoader::validate_image_format("test.jpeg").is_ok());
        assert!(ImageLoader::validate_image_format("test.webp").is_ok());
        assert!(ImageLoader::validate_image_format("TEST.PNG").is_ok()); // Case insensitive
    }

    #[test]
    fn test_validate_image_format_invalid() {
        let result = ImageLoader::validate_image_format("test.gif");
        assert!(result.is_err());
        if let Err(VisualError::UnsupportedFormat { format }) = result {
            assert_eq!(format, "gif");
        } else {
            panic!("Expected UnsupportedFormat error");
        }
    }

    #[test]
    fn test_get_format_from_path() {
        assert_eq!(ImageLoader::get_format_from_path("test.png").unwrap(), ImageFormat::Png);
        assert_eq!(ImageLoader::get_format_from_path("test.jpg").unwrap(), ImageFormat::Jpeg);
        assert_eq!(ImageLoader::get_format_from_path("test.jpeg").unwrap(), ImageFormat::Jpeg);
        assert_eq!(ImageLoader::get_format_from_path("test.webp").unwrap(), ImageFormat::WebP);
    }

    #[test]
    fn test_load_image_nonexistent_file() {
        let result = ImageLoader::load_image("nonexistent.png");
        assert!(result.is_err());
        if let Err(VisualError::ImageLoadError { path, reason }) = result {
            assert_eq!(path, "nonexistent.png");
            assert!(reason.contains("File does not exist"));
        } else {
            panic!("Expected ImageLoadError");
        }
    }

    #[test]
    fn test_create_test_image() {
        let img = ImageLoader::create_test_image(100, 100, [255, 0, 0, 255]); // Red image
        assert_eq!(img.dimensions(), (100, 100));
    }

    #[test]
    fn test_validate_dimensions_match() {
        let img1 = ImageLoader::create_test_image(100, 100, [255, 0, 0, 255]);
        let img2 = ImageLoader::create_test_image(100, 100, [0, 255, 0, 255]);
        
        assert!(ImageLoader::validate_dimensions(&img1, &img2).is_ok());
    }

    #[test]
    fn test_validate_dimensions_mismatch() {
        let img1 = ImageLoader::create_test_image(100, 100, [255, 0, 0, 255]);
        let img2 = ImageLoader::create_test_image(200, 100, [0, 255, 0, 255]);
        
        let result = ImageLoader::validate_dimensions(&img1, &img2);
        assert!(result.is_err());
        if let Err(VisualError::DimensionMismatch { baseline_width, baseline_height, actual_width, actual_height }) = result {
            assert_eq!(baseline_width, 100);
            assert_eq!(baseline_height, 100);
            assert_eq!(actual_width, 200);
            assert_eq!(actual_height, 100);
        } else {
            panic!("Expected DimensionMismatch error");
        }
    }

    #[test]
    fn test_save_and_load_image() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.png");
        
        // Create a test image
        let original_img = ImageLoader::create_test_image(50, 50, [128, 128, 128, 255]);
        
        // Save the image
        let result = ImageLoader::save_image(&original_img, &file_path, ImageFormat::Png);
        assert!(result.is_ok());
        
        // Verify file exists
        assert!(file_path.exists());
        
        // Load the image back
        let loaded_img = ImageLoader::load_image(&file_path).unwrap();
        assert_eq!(loaded_img.dimensions(), (50, 50));
    }
}
