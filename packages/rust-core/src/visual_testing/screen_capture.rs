//! Screen capture functionality with stability checks and retry logic

use crate::visual_testing::{VisualError, VisualResult};
use image::{DynamicImage, GenericImageView};
use std::time::{Duration, Instant};

/// Configuration for screen capture operations
#[derive(Debug, Clone)]
pub struct CaptureConfig {
    /// Maximum number of retry attempts
    pub max_retries: u32,
    /// Timeout for each capture attempt (ms)
    pub capture_timeout_ms: u32,
    /// Delay between retry attempts (ms)
    pub retry_delay_ms: u32,
    /// Time to wait for screen stability (ms)
    pub stability_wait_ms: u32,
    /// Enable screen stability detection
    pub enable_stability_check: bool,
}

impl Default for CaptureConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            capture_timeout_ms: 5000,
            retry_delay_ms: 500,
            stability_wait_ms: 100,
            enable_stability_check: true,
        }
    }
}

/// Result of a screen capture operation
#[derive(Debug, Clone)]
pub struct CaptureResult {
    /// The captured image
    pub image: DynamicImage,
    /// Number of attempts made
    pub attempts_made: u32,
    /// Total time taken for capture (ms)
    pub total_time_ms: u32,
    /// Whether stability check was performed
    pub stability_checked: bool,
}

/// Screen capture engine with retry logic and stability checks
pub struct ScreenCapture;

impl ScreenCapture {
    /// Capture a screenshot with retry logic and stability checks
    pub fn capture_with_retry(config: CaptureConfig) -> VisualResult<CaptureResult> {
        let start_time = Instant::now();
        let mut attempts = 0;
        let mut last_error = None;

        while attempts < config.max_retries {
            attempts += 1;

            match Self::attempt_capture(&config) {
                Ok(image) => {
                    let total_time = start_time.elapsed().as_millis() as u32;
                    return Ok(CaptureResult {
                        image,
                        attempts_made: attempts,
                        total_time_ms: total_time,
                        stability_checked: config.enable_stability_check,
                    });
                }
                Err(error) => {
                    last_error = Some(error);
                    
                    // If this isn't the last attempt, wait before retrying
                    if attempts < config.max_retries {
                        std::thread::sleep(Duration::from_millis(config.retry_delay_ms as u64));
                    }
                }
            }
        }

        // All attempts failed, return the last error
        Err(last_error.unwrap_or_else(|| VisualError::IoError {
            message: "Screen capture failed after all retry attempts".to_string(),
        }))
    }

    /// Attempt a single screen capture
    fn attempt_capture(config: &CaptureConfig) -> VisualResult<DynamicImage> {
        let capture_start = Instant::now();

        // Wait for screen stability if enabled
        if config.enable_stability_check {
            Self::wait_for_stability(config.stability_wait_ms)?;
        }

        // Simulate screen capture - in a real implementation this would use platform-specific APIs
        // For now, we'll create a test image to simulate capture
        let image = Self::simulate_screen_capture()?;

        // Check if capture timed out
        let elapsed = capture_start.elapsed().as_millis() as u32;
        if elapsed > config.capture_timeout_ms {
            return Err(VisualError::ComparisonTimeout {
                timeout_ms: config.capture_timeout_ms,
            });
        }

        Ok(image)
    }

    /// Wait for screen stability before capture
    fn wait_for_stability(stability_wait_ms: u32) -> VisualResult<()> {
        // In a real implementation, this would:
        // 1. Take multiple quick screenshots
        // 2. Compare them to detect if the screen is changing
        // 3. Wait until the screen is stable
        
        // For now, just wait the specified time
        std::thread::sleep(Duration::from_millis(stability_wait_ms as u64));
        Ok(())
    }

    /// Simulate screen capture for testing purposes
    /// In a real implementation, this would use platform-specific screen capture APIs
    fn simulate_screen_capture() -> VisualResult<DynamicImage> {
        // Create a simple test image to simulate screen capture
        use image::{ImageBuffer, Rgba};
        
        let width = 1920u32;
        let height = 1080u32;
        
        // Create a gradient image to simulate screen content
        let mut img_buffer = ImageBuffer::new(width, height);
        
        for (x, y, pixel) in img_buffer.enumerate_pixels_mut() {
            let r = (x * 255 / width) as u8;
            let g = (y * 255 / height) as u8;
            let b = ((x + y) * 255 / (width + height)) as u8;
            *pixel = Rgba([r, g, b, 255]);
        }
        
        Ok(DynamicImage::ImageRgba8(img_buffer))
    }

    /// Simulate a capture failure for testing
    pub fn simulate_capture_failure(failure_type: CaptureFailureType) -> VisualResult<DynamicImage> {
        match failure_type {
            CaptureFailureType::Timeout => Err(VisualError::ComparisonTimeout {
                timeout_ms: 5000,
            }),
            CaptureFailureType::PermissionDenied => Err(VisualError::IoError {
                message: "Permission denied for screen capture".to_string(),
            }),
            CaptureFailureType::NetworkLag => Err(VisualError::IoError {
                message: "Network lag caused incomplete image loading".to_string(),
            }),
            CaptureFailureType::InsufficientMemory => Err(VisualError::InsufficientMemory {
                required_mb: 100,
                available_mb: 50,
            }),
        }
    }

    /// Enhanced capture with failure simulation for testing
    pub fn capture_with_simulated_failures(
        config: CaptureConfig,
        failure_pattern: Vec<CaptureFailureType>,
    ) -> VisualResult<CaptureResult> {
        let start_time = Instant::now();
        let mut attempts = 0;
        let mut last_error = None;

        while attempts < config.max_retries {
            attempts += 1;

            // Check if we should simulate a failure for this attempt
            let should_fail = if (attempts as usize) <= failure_pattern.len() {
                failure_pattern.get((attempts - 1) as usize).is_some()
            } else {
                false
            };

            let result = if should_fail {
                let failure_type = failure_pattern[(attempts - 1) as usize].clone();
                Self::simulate_capture_failure(failure_type)
            } else {
                Self::attempt_capture(&config)
            };

            match result {
                Ok(image) => {
                    let total_time = start_time.elapsed().as_millis() as u32;
                    return Ok(CaptureResult {
                        image,
                        attempts_made: attempts,
                        total_time_ms: total_time,
                        stability_checked: config.enable_stability_check,
                    });
                }
                Err(error) => {
                    last_error = Some(error);
                    
                    // If this isn't the last attempt, wait before retrying
                    if attempts < config.max_retries {
                        std::thread::sleep(Duration::from_millis(config.retry_delay_ms as u64));
                    }
                }
            }
        }

        // All attempts failed
        Err(last_error.unwrap_or_else(|| VisualError::IoError {
            message: "Screen capture failed after all retry attempts".to_string(),
        }))
    }
}

/// Types of capture failures for testing
#[derive(Debug, Clone)]
pub enum CaptureFailureType {
    Timeout,
    PermissionDenied,
    NetworkLag,
    InsufficientMemory,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_successful_capture() {
        let config = CaptureConfig::default();
        let result = ScreenCapture::capture_with_retry(config).unwrap();
        
        assert_eq!(result.attempts_made, 1);
        assert!(result.total_time_ms > 0);
        assert_eq!(result.image.dimensions(), (1920, 1080));
    }

    #[test]
    fn test_retry_on_failure() {
        let config = CaptureConfig {
            max_retries: 3,
            retry_delay_ms: 10, // Short delay for testing
            ..Default::default()
        };

        // Simulate failures on first 2 attempts, success on 3rd
        let failure_pattern = vec![
            CaptureFailureType::NetworkLag,
            CaptureFailureType::Timeout,
        ];

        let result = ScreenCapture::capture_with_simulated_failures(config, failure_pattern).unwrap();
        
        assert_eq!(result.attempts_made, 3);
        assert!(result.total_time_ms > 0);
    }

    #[test]
    fn test_max_retries_exceeded() {
        let config = CaptureConfig {
            max_retries: 2,
            retry_delay_ms: 10,
            ..Default::default()
        };

        // Simulate failures on all attempts
        let failure_pattern = vec![
            CaptureFailureType::PermissionDenied,
            CaptureFailureType::PermissionDenied,
            CaptureFailureType::PermissionDenied, // This won't be reached due to max_retries=2
        ];

        let result = ScreenCapture::capture_with_simulated_failures(config, failure_pattern);
        
        assert!(result.is_err());
        if let Err(VisualError::IoError { message }) = result {
            assert!(message.contains("Permission denied"));
        } else {
            panic!("Expected IoError with permission denied message");
        }
    }
}
