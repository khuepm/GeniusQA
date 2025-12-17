//! Asset compression and optimization utilities for visual regression testing
//! 
//! This module provides image compression, optimization, and thumbnail generation
//! capabilities to reduce storage requirements and improve performance.

use crate::visual_testing::{VisualError, VisualResult};
use image::{DynamicImage, ImageFormat, GenericImageView};
use std::io::Cursor;
use sha2::{Digest, Sha256};

/// Image compression quality settings
#[derive(Debug, Clone, Copy)]
pub struct CompressionQuality {
    /// JPEG quality (1-100)
    pub jpeg_quality: u8,
    /// PNG compression level (0-9)
    pub png_compression: u8,
    /// WebP quality (1-100)
    pub webp_quality: f32,
}

impl Default for CompressionQuality {
    fn default() -> Self {
        Self {
            jpeg_quality: 85,
            png_compression: 6,
            webp_quality: 85.0,
        }
    }
}

/// Image optimization settings
#[derive(Debug, Clone)]
pub struct OptimizationSettings {
    /// Target format for optimization
    pub target_format: ImageFormat,
    /// Quality settings
    pub quality: CompressionQuality,
    /// Maximum file size in bytes (0 = no limit)
    pub max_file_size_bytes: u64,
    /// Enable progressive JPEG
    pub progressive_jpeg: bool,
    /// Strip metadata
    pub strip_metadata: bool,
}

impl Default for OptimizationSettings {
    fn default() -> Self {
        Self {
            target_format: ImageFormat::Png,
            quality: CompressionQuality::default(),
            max_file_size_bytes: 0,
            progressive_jpeg: true,
            strip_metadata: true,
        }
    }
}

/// Thumbnail generation settings
#[derive(Debug, Clone)]
pub struct ThumbnailSettings {
    /// Target dimensions (width, height)
    pub dimensions: (u32, u32),
    /// Resampling filter
    pub filter: image::imageops::FilterType,
    /// Output format
    pub format: ImageFormat,
    /// Quality settings
    pub quality: CompressionQuality,
    /// Maintain aspect ratio
    pub maintain_aspect_ratio: bool,
}

impl Default for ThumbnailSettings {
    fn default() -> Self {
        Self {
            dimensions: (300, 200),
            filter: image::imageops::FilterType::Lanczos3,
            format: ImageFormat::Jpeg,
            quality: CompressionQuality::default(),
            maintain_aspect_ratio: true,
        }
    }
}

/// Image compression and optimization utilities
pub struct ImageOptimizer {
    settings: OptimizationSettings,
}

impl ImageOptimizer {
    /// Create a new image optimizer with default settings
    pub fn new() -> Self {
        Self {
            settings: OptimizationSettings::default(),
        }
    }

    /// Create with custom optimization settings
    pub fn with_settings(settings: OptimizationSettings) -> Self {
        Self { settings }
    }

    /// Optimize an image for storage
    pub fn optimize_image(&self, image: &DynamicImage) -> VisualResult<Vec<u8>> {
        let mut output = Vec::new();
        let mut cursor = Cursor::new(&mut output);

        match self.settings.target_format {
            ImageFormat::Png => {
                let encoder = image::codecs::png::PngEncoder::new_with_quality(
                    &mut cursor,
                    image::codecs::png::CompressionType::Default,
                    image::codecs::png::FilterType::Adaptive,
                );
                
                image.write_with_encoder(encoder).map_err(|e| VisualError::ImageSaveError {
                    path: "memory".to_string(),
                    reason: e.to_string(),
                })?;
            }
            ImageFormat::Jpeg => {
                let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
                    &mut cursor,
                    self.settings.quality.jpeg_quality,
                );
                
                image.write_with_encoder(encoder).map_err(|e| VisualError::ImageSaveError {
                    path: "memory".to_string(),
                    reason: e.to_string(),
                })?;
            }
            ImageFormat::WebP => {
                // WebP encoding - use lossless for now as quality API may not be available
                let encoder = image::codecs::webp::WebPEncoder::new_lossless(&mut cursor);
                
                image.write_with_encoder(encoder).map_err(|e| VisualError::ImageSaveError {
                    path: "memory".to_string(),
                    reason: e.to_string(),
                })?;
            }
            _ => {
                // Fallback to PNG for unsupported formats
                image.write_to(&mut cursor, ImageFormat::Png).map_err(|e| VisualError::ImageSaveError {
                    path: "memory".to_string(),
                    reason: e.to_string(),
                })?;
            }
        }

        // Check file size limit
        if self.settings.max_file_size_bytes > 0 && output.len() as u64 > self.settings.max_file_size_bytes {
            return Err(VisualError::ConfigError {
                message: format!(
                    "Optimized image size ({} bytes) exceeds limit ({} bytes)",
                    output.len(),
                    self.settings.max_file_size_bytes
                ),
            });
        }

        Ok(output)
    }

    /// Get the best format for a given image based on content analysis
    pub fn suggest_optimal_format(&self, image: &DynamicImage) -> ImageFormat {
        // Analyze image characteristics to suggest best format
        let (width, height) = (image.width(), image.height());
        let pixel_count = width as u64 * height as u64;

        // Check if image has transparency
        let has_transparency = match image {
            DynamicImage::ImageRgba8(_) | DynamicImage::ImageRgba16(_) | DynamicImage::ImageRgba32F(_) => {
                // Check if any pixel has alpha < 255
                image.pixels().any(|(_, _, pixel)| pixel.0[3] < 255)
            }
            _ => false,
        };

        // Suggest format based on characteristics
        if has_transparency {
            ImageFormat::Png // PNG for transparency
        } else if pixel_count > 1_000_000 {
            ImageFormat::WebP // WebP for large images
        } else {
            ImageFormat::Jpeg // JPEG for photos without transparency
        }
    }

    /// Estimate compression ratio for different formats
    pub fn estimate_compression_ratios(&self, image: &DynamicImage) -> VisualResult<CompressionEstimate> {
        let original_size = self.estimate_uncompressed_size(image);
        
        // Test compression with different formats
        let png_optimizer = ImageOptimizer::with_settings(OptimizationSettings {
            target_format: ImageFormat::Png,
            ..self.settings.clone()
        });
        
        let jpeg_optimizer = ImageOptimizer::with_settings(OptimizationSettings {
            target_format: ImageFormat::Jpeg,
            ..self.settings.clone()
        });
        
        let webp_optimizer = ImageOptimizer::with_settings(OptimizationSettings {
            target_format: ImageFormat::WebP,
            ..self.settings.clone()
        });

        let png_size = png_optimizer.optimize_image(image)?.len() as u64;
        let jpeg_size = jpeg_optimizer.optimize_image(image)?.len() as u64;
        let webp_size = webp_optimizer.optimize_image(image)?.len() as u64;

        Ok(CompressionEstimate {
            original_size,
            png_size,
            jpeg_size,
            webp_size,
        })
    }

    /// Estimate uncompressed image size
    fn estimate_uncompressed_size(&self, image: &DynamicImage) -> u64 {
        let (width, height) = (image.width(), image.height());
        let channels = match image.color() {
            image::ColorType::L8 => 1,
            image::ColorType::La8 => 2,
            image::ColorType::Rgb8 => 3,
            image::ColorType::Rgba8 => 4,
            image::ColorType::L16 => 2,
            image::ColorType::La16 => 4,
            image::ColorType::Rgb16 => 6,
            image::ColorType::Rgba16 => 8,
            image::ColorType::Rgb32F => 12,
            image::ColorType::Rgba32F => 16,
            _ => 4, // Default to RGBA
        };
        
        width as u64 * height as u64 * channels
    }
}

/// Compression ratio estimates for different formats
#[derive(Debug, Clone)]
pub struct CompressionEstimate {
    pub original_size: u64,
    pub png_size: u64,
    pub jpeg_size: u64,
    pub webp_size: u64,
}

impl CompressionEstimate {
    /// Get the best format based on file size
    pub fn best_format(&self) -> ImageFormat {
        let sizes = [
            (ImageFormat::Png, self.png_size),
            (ImageFormat::Jpeg, self.jpeg_size),
            (ImageFormat::WebP, self.webp_size),
        ];
        
        sizes.iter()
            .min_by_key(|(_, size)| *size)
            .map(|(format, _)| *format)
            .unwrap_or(ImageFormat::Png)
    }

    /// Get compression ratio for a specific format
    pub fn compression_ratio(&self, format: ImageFormat) -> f64 {
        let compressed_size = match format {
            ImageFormat::Png => self.png_size,
            ImageFormat::Jpeg => self.jpeg_size,
            ImageFormat::WebP => self.webp_size,
            _ => self.original_size,
        };
        
        if self.original_size > 0 {
            compressed_size as f64 / self.original_size as f64
        } else {
            1.0
        }
    }

    /// Get space savings percentage
    pub fn space_savings_percent(&self, format: ImageFormat) -> f64 {
        (1.0 - self.compression_ratio(format)) * 100.0
    }
}

/// Thumbnail generator
pub struct ThumbnailGenerator {
    settings: ThumbnailSettings,
}

impl ThumbnailGenerator {
    /// Create a new thumbnail generator with default settings
    pub fn new() -> Self {
        Self {
            settings: ThumbnailSettings::default(),
        }
    }

    /// Create with custom thumbnail settings
    pub fn with_settings(settings: ThumbnailSettings) -> Self {
        Self { settings }
    }

    /// Generate a thumbnail from an image
    pub fn generate_thumbnail(&self, image: &DynamicImage) -> VisualResult<DynamicImage> {
        let (target_width, target_height) = self.settings.dimensions;
        
        let thumbnail = if self.settings.maintain_aspect_ratio {
            // Calculate dimensions maintaining aspect ratio
            let (orig_width, orig_height) = (image.width(), image.height());
            let aspect_ratio = orig_width as f64 / orig_height as f64;
            let target_aspect_ratio = target_width as f64 / target_height as f64;
            
            let (new_width, new_height) = if aspect_ratio > target_aspect_ratio {
                // Image is wider than target
                (target_width, (target_width as f64 / aspect_ratio) as u32)
            } else {
                // Image is taller than target
                ((target_height as f64 * aspect_ratio) as u32, target_height)
            };
            
            image.resize(new_width, new_height, self.settings.filter)
        } else {
            // Stretch to exact dimensions
            image.resize_exact(target_width, target_height, self.settings.filter)
        };

        Ok(thumbnail)
    }

    /// Generate thumbnail and encode to bytes
    pub fn generate_thumbnail_bytes(&self, image: &DynamicImage) -> VisualResult<Vec<u8>> {
        let thumbnail = self.generate_thumbnail(image)?;
        
        let mut output = Vec::new();
        let mut cursor = Cursor::new(&mut output);

        match self.settings.format {
            ImageFormat::Jpeg => {
                let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
                    &mut cursor,
                    self.settings.quality.jpeg_quality,
                );
                
                thumbnail.write_with_encoder(encoder).map_err(|e| VisualError::ImageSaveError {
                    path: "thumbnail".to_string(),
                    reason: e.to_string(),
                })?;
            }
            ImageFormat::Png => {
                thumbnail.write_to(&mut cursor, ImageFormat::Png).map_err(|e| VisualError::ImageSaveError {
                    path: "thumbnail".to_string(),
                    reason: e.to_string(),
                })?;
            }
            ImageFormat::WebP => {
                let encoder = image::codecs::webp::WebPEncoder::new_lossless(&mut cursor);
                
                thumbnail.write_with_encoder(encoder).map_err(|e| VisualError::ImageSaveError {
                    path: "thumbnail".to_string(),
                    reason: e.to_string(),
                })?;
            }
            _ => {
                // Fallback to JPEG
                let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
                    &mut cursor,
                    self.settings.quality.jpeg_quality,
                );
                
                thumbnail.write_with_encoder(encoder).map_err(|e| VisualError::ImageSaveError {
                    path: "thumbnail".to_string(),
                    reason: e.to_string(),
                })?;
            }
        }

        Ok(output)
    }

    /// Generate multiple thumbnail sizes
    pub fn generate_multiple_thumbnails(&self, image: &DynamicImage, sizes: &[(u32, u32)]) -> VisualResult<Vec<DynamicImage>> {
        let mut thumbnails = Vec::new();
        
        for &(width, height) in sizes {
            let thumbnail_settings = ThumbnailSettings {
                dimensions: (width, height),
                ..self.settings.clone()
            };
            
            let generator = ThumbnailGenerator::with_settings(thumbnail_settings);
            let thumbnail = generator.generate_thumbnail(image)?;
            thumbnails.push(thumbnail);
        }
        
        Ok(thumbnails)
    }
}

/// File integrity validation utilities
pub struct IntegrityValidator;

impl IntegrityValidator {
    /// Calculate SHA256 checksum of image data
    pub fn calculate_image_checksum(image: &DynamicImage) -> VisualResult<String> {
        let mut hasher = Sha256::new();
        
        // Convert image to consistent format for hashing
        let mut bytes = Vec::new();
        image.write_to(&mut Cursor::new(&mut bytes), ImageFormat::Png)
            .map_err(|e| VisualError::ImageSaveError {
                path: "checksum_calculation".to_string(),
                reason: e.to_string(),
            })?;
        
        hasher.update(&bytes);
        Ok(format!("{:x}", hasher.finalize()))
    }

    /// Calculate SHA256 checksum of raw bytes
    pub fn calculate_bytes_checksum(data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        format!("{:x}", hasher.finalize())
    }

    /// Verify image integrity against checksum
    pub fn verify_image_integrity(image: &DynamicImage, expected_checksum: &str) -> VisualResult<bool> {
        let actual_checksum = Self::calculate_image_checksum(image)?;
        Ok(actual_checksum == expected_checksum)
    }

    /// Verify file integrity against checksum
    pub fn verify_file_integrity(file_data: &[u8], expected_checksum: &str) -> bool {
        let actual_checksum = Self::calculate_bytes_checksum(file_data);
        actual_checksum == expected_checksum
    }
}

/// Batch processing utilities for multiple images
pub struct BatchProcessor {
    optimizer: ImageOptimizer,
    thumbnail_generator: ThumbnailGenerator,
}

impl BatchProcessor {
    /// Create a new batch processor
    pub fn new(
        optimization_settings: OptimizationSettings,
        thumbnail_settings: ThumbnailSettings,
    ) -> Self {
        Self {
            optimizer: ImageOptimizer::with_settings(optimization_settings),
            thumbnail_generator: ThumbnailGenerator::with_settings(thumbnail_settings),
        }
    }

    /// Process multiple images with optimization and thumbnail generation
    pub fn process_images(&self, images: &[DynamicImage]) -> VisualResult<Vec<ProcessedImage>> {
        let mut results = Vec::new();
        
        for (index, image) in images.iter().enumerate() {
            let optimized_data = self.optimizer.optimize_image(image)?;
            let thumbnail = self.thumbnail_generator.generate_thumbnail(image)?;
            let thumbnail_data = self.thumbnail_generator.generate_thumbnail_bytes(image)?;
            
            let checksum = IntegrityValidator::calculate_image_checksum(image)?;
            
            results.push(ProcessedImage {
                index,
                original_size: self.optimizer.estimate_uncompressed_size(image),
                optimized_data,
                thumbnail,
                thumbnail_data,
                checksum,
            });
        }
        
        Ok(results)
    }

    /// Get processing statistics
    pub fn get_processing_stats(&self, results: &[ProcessedImage]) -> ProcessingStats {
        let total_original_size: u64 = results.iter().map(|r| r.original_size).sum();
        let total_optimized_size: u64 = results.iter().map(|r| r.optimized_data.len() as u64).sum();
        let total_thumbnail_size: u64 = results.iter().map(|r| r.thumbnail_data.len() as u64).sum();
        
        let compression_ratio = if total_original_size > 0 {
            total_optimized_size as f64 / total_original_size as f64
        } else {
            1.0
        };
        
        ProcessingStats {
            image_count: results.len(),
            total_original_size,
            total_optimized_size,
            total_thumbnail_size,
            compression_ratio,
            space_savings_percent: (1.0 - compression_ratio) * 100.0,
        }
    }
}

/// Result of processing a single image
#[derive(Debug, Clone)]
pub struct ProcessedImage {
    pub index: usize,
    pub original_size: u64,
    pub optimized_data: Vec<u8>,
    pub thumbnail: DynamicImage,
    pub thumbnail_data: Vec<u8>,
    pub checksum: String,
}

/// Statistics for batch processing operations
#[derive(Debug, Clone)]
pub struct ProcessingStats {
    pub image_count: usize,
    pub total_original_size: u64,
    pub total_optimized_size: u64,
    pub total_thumbnail_size: u64,
    pub compression_ratio: f64,
    pub space_savings_percent: f64,
}

impl ProcessingStats {
    /// Get total size in MB
    pub fn total_size_mb(&self) -> f64 {
        (self.total_optimized_size + self.total_thumbnail_size) as f64 / (1024.0 * 1024.0)
    }

    /// Get average compression ratio
    pub fn average_compression_ratio(&self) -> f64 {
        self.compression_ratio
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_image() -> DynamicImage {
        DynamicImage::new_rgb8(100, 100)
    }

    #[test]
    fn test_image_optimization() {
        let optimizer = ImageOptimizer::new();
        let test_image = create_test_image();
        
        let optimized_data = optimizer.optimize_image(&test_image).unwrap();
        assert!(!optimized_data.is_empty());
    }

    #[test]
    fn test_thumbnail_generation() {
        let generator = ThumbnailGenerator::new();
        let test_image = create_test_image();
        
        let thumbnail = generator.generate_thumbnail(&test_image).unwrap();
        assert_eq!(thumbnail.width(), 300);
        assert_eq!(thumbnail.height(), 200);
    }

    #[test]
    fn test_checksum_calculation() {
        let test_image = create_test_image();
        let checksum1 = IntegrityValidator::calculate_image_checksum(&test_image).unwrap();
        let checksum2 = IntegrityValidator::calculate_image_checksum(&test_image).unwrap();
        
        assert_eq!(checksum1, checksum2);
        assert!(!checksum1.is_empty());
    }

    #[test]
    fn test_compression_estimation() {
        let optimizer = ImageOptimizer::new();
        let test_image = create_test_image();
        
        let estimate = optimizer.estimate_compression_ratios(&test_image).unwrap();
        assert!(estimate.original_size > 0);
        assert!(estimate.png_size > 0);
        assert!(estimate.jpeg_size > 0);
        assert!(estimate.webp_size > 0);
    }

    #[test]
    fn test_batch_processing() {
        let images = vec![create_test_image(), create_test_image()];
        let processor = BatchProcessor::new(
            OptimizationSettings::default(),
            ThumbnailSettings::default(),
        );
        
        let results = processor.process_images(&images).unwrap();
        assert_eq!(results.len(), 2);
        
        let stats = processor.get_processing_stats(&results);
        assert_eq!(stats.image_count, 2);
        assert!(stats.total_original_size > 0);
    }
}
