//! HTML report generation for CI environments

use crate::visual_testing::{ComparisonResult, VisualResult, VisualError};
use base64::{Engine as _, engine::general_purpose};
use image::DynamicImage;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// Configuration for HTML report generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HTMLReportConfig {
    /// Whether to embed images as base64 (true for CI, false for local)
    pub embed_images: bool,
    /// Maximum size for embedded thumbnails (pixels)
    pub max_thumbnail_size: u32,
    /// JPEG quality for thumbnails (0-100)
    pub thumbnail_quality: u8,
    /// Include full-size image links
    pub include_full_size_links: bool,
    /// Custom CSS styles
    pub custom_css: Option<String>,
    /// Report title
    pub title: String,
}

impl Default for HTMLReportConfig {
    fn default() -> Self {
        Self {
            embed_images: true,
            max_thumbnail_size: 400,
            thumbnail_quality: 85,
            include_full_size_links: true,
            custom_css: None,
            title: "Visual Regression Test Report".to_string(),
        }
    }
}

/// HTML report generator for visual regression test results
pub struct HTMLReportGenerator {
    config: HTMLReportConfig,
}

impl HTMLReportGenerator {
    /// Create a new HTML report generator
    pub fn new(config: HTMLReportConfig) -> Self {
        Self { config }
    }

    /// Create a generator with default CI-friendly settings
    pub fn for_ci() -> Self {
        Self::new(HTMLReportConfig {
            embed_images: true,
            max_thumbnail_size: 300,
            thumbnail_quality: 80,
            include_full_size_links: true,
            custom_css: None,
            title: "CI Visual Regression Test Report".to_string(),
        })
    }

    /// Create a generator for local development
    pub fn for_local() -> Self {
        Self::new(HTMLReportConfig {
            embed_images: false,
            max_thumbnail_size: 600,
            thumbnail_quality: 95,
            include_full_size_links: true,
            custom_css: None,
            title: "Local Visual Regression Test Report".to_string(),
        })
    }

    /// Generate a complete HTML report from test results
    pub fn generate_report(
        &self,
        results: &[TestResultWithMetadata],
        output_path: &str,
    ) -> VisualResult<()> {
        let html_content = self.generate_html_content(results)?;
        
        // Write HTML file
        std::fs::write(output_path, html_content).map_err(|e| VisualError::IoError {
            message: format!("Failed to write HTML report to {}: {}", output_path, e),
        })?;

        // Copy assets if needed
        if !self.config.embed_images {
            self.copy_image_assets(results, output_path)?;
        }

        Ok(())
    }

    /// Generate HTML content for the report
    pub fn generate_html_content(&self, results: &[TestResultWithMetadata]) -> VisualResult<String> {
        let mut html = String::new();
        
        // HTML header
        html.push_str(&self.generate_html_header());
        
        // Summary section
        html.push_str(&self.generate_summary_section(results));
        
        // Results section
        html.push_str(&self.generate_results_section(results)?);
        
        // HTML footer
        html.push_str(&self.generate_html_footer());
        
        Ok(html)
    }

    /// Generate HTML header with CSS and JavaScript
    fn generate_html_header(&self) -> String {
        format!(
            r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{}</title>
    <style>
        {}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>{}</h1>
            <p class="timestamp">Generated on: {}</p>
        </header>
"#,
            self.config.title,
            self.get_default_css(),
            self.config.title,
            chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
        )
    }

    /// Generate summary section with statistics
    fn generate_summary_section(&self, results: &[TestResultWithMetadata]) -> String {
        let total_tests = results.len();
        let passed_tests = results.iter().filter(|r| r.result.is_match).count();
        let failed_tests = total_tests - passed_tests;
        
        let avg_mismatch = if !results.is_empty() {
            results.iter().map(|r| r.result.mismatch_percentage).sum::<f32>() / results.len() as f32
        } else {
            0.0
        };

        format!(
            r#"        <section class="summary">
            <h2>Test Summary</h2>
            <div class="stats">
                <div class="stat-item passed">
                    <span class="stat-number">{}</span>
                    <span class="stat-label">Passed</span>
                </div>
                <div class="stat-item failed">
                    <span class="stat-number">{}</span>
                    <span class="stat-label">Failed</span>
                </div>
                <div class="stat-item total">
                    <span class="stat-number">{}</span>
                    <span class="stat-label">Total</span>
                </div>
                <div class="stat-item avg-mismatch">
                    <span class="stat-number">{:.2}%</span>
                    <span class="stat-label">Avg Mismatch</span>
                </div>
            </div>
        </section>
"#,
            passed_tests, failed_tests, total_tests, avg_mismatch * 100.0
        )
    }

    /// Generate results section with individual test results
    fn generate_results_section(&self, results: &[TestResultWithMetadata]) -> VisualResult<String> {
        let mut html = String::from(r#"        <section class="results">
            <h2>Test Results</h2>
"#);

        for (index, result_meta) in results.iter().enumerate() {
            html.push_str(&self.generate_test_result_html(result_meta, index)?);
        }

        html.push_str("        </section>\n");
        Ok(html)
    }

    /// Generate HTML for a single test result
    fn generate_test_result_html(
        &self,
        result_meta: &TestResultWithMetadata,
        index: usize,
    ) -> VisualResult<String> {
        let result = &result_meta.result;
        let status_class = if result.is_match { "passed" } else { "failed" };
        
        let mut html = format!(
            r#"            <div class="test-result {}" id="test-{}">
                <div class="test-header">
                    <h3>{}</h3>
                    <span class="status {}">{}</span>
                </div>
                <div class="test-details">
                    <div class="metrics">
                        <span class="metric">Mismatch: {:.2}%</span>
                        <span class="metric">Type: {:?}</span>
                        <span class="metric">Time: {}ms</span>
                    </div>
"#,
            status_class,
            index,
            result_meta.test_name,
            status_class,
            if result.is_match { "PASSED" } else { "FAILED" },
            result.mismatch_percentage * 100.0,
            result.difference_type,
            result.performance_metrics.total_time_ms()
        );

        // Add image comparison if available
        if !result.is_match || self.config.include_full_size_links {
            html.push_str(&self.generate_image_comparison_html(result)?);
        }

        html.push_str("                </div>\n            </div>\n");
        Ok(html)
    }

    /// Generate image comparison HTML
    fn generate_image_comparison_html(&self, result: &ComparisonResult) -> VisualResult<String> {
        let mut html = String::from(r#"                    <div class="image-comparison">
"#);

        // Baseline image
        html.push_str(&self.generate_image_html(
            &result.baseline_path,
            "Baseline",
            "baseline",
        )?);

        // Actual image
        html.push_str(&self.generate_image_html(
            &result.actual_path,
            "Actual",
            "actual",
        )?);

        // Diff image (if available)
        if let Some(ref diff_path) = result.diff_image_path {
            html.push_str(&self.generate_image_html(
                diff_path,
                "Difference",
                "diff",
            )?);
        }

        html.push_str("                    </div>\n");
        Ok(html)
    }

    /// Generate HTML for a single image
    fn generate_image_html(
        &self,
        image_path: &str,
        label: &str,
        css_class: &str,
    ) -> VisualResult<String> {
        let path = Path::new(image_path);
        
        if !path.exists() {
            return Ok(format!(
                r#"                        <div class="image-container {}">
                            <h4>{}</h4>
                            <p class="error">Image not found: {}</p>
                        </div>
"#,
                css_class, label, image_path
            ));
        }

        let mut html = format!(
            r#"                        <div class="image-container {}">
                            <h4>{}</h4>
"#,
            css_class, label
        );

        if self.config.embed_images {
            // Embed as base64
            let thumbnail_data = self.create_thumbnail_base64(image_path)?;
            html.push_str(&format!(
                r#"                            <img src="data:image/jpeg;base64,{}" alt="{}" class="thumbnail" />
"#,
                thumbnail_data, label
            ));
        } else {
            // Link to external file
            let filename = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown");
            html.push_str(&format!(
                r#"                            <img src="images/{}" alt="{}" class="thumbnail" />
"#,
                filename, label
            ));
        }

        if self.config.include_full_size_links {
            let filename = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown");
            html.push_str(&format!(
                r#"                            <a href="images/{}" target="_blank" class="full-size-link">View Full Size</a>
"#,
                filename
            ));
        }

        html.push_str("                        </div>\n");
        Ok(html)
    }

    /// Create a base64-encoded thumbnail of an image
    fn create_thumbnail_base64(&self, image_path: &str) -> VisualResult<String> {
        // Load the image
        let image = image::open(image_path).map_err(|e| VisualError::ImageLoadError {
            path: image_path.to_string(),
            reason: e.to_string(),
        })?;

        // Resize to thumbnail
        let thumbnail = image.thumbnail(self.config.max_thumbnail_size, self.config.max_thumbnail_size);
        
        // Convert to JPEG bytes
        let mut jpeg_bytes = Vec::new();
        thumbnail
            .write_to(&mut std::io::Cursor::new(&mut jpeg_bytes), image::ImageFormat::Jpeg)
            .map_err(|e| VisualError::ImageSaveError {
                path: "thumbnail".to_string(),
                reason: e.to_string(),
            })?;

        // Encode as base64
        Ok(general_purpose::STANDARD.encode(&jpeg_bytes))
    }

    /// Copy image assets to report directory
    fn copy_image_assets(
        &self,
        results: &[TestResultWithMetadata],
        report_path: &str,
    ) -> VisualResult<()> {
        let report_dir = Path::new(report_path).parent().unwrap_or(Path::new("."));
        let images_dir = report_dir.join("images");
        
        // Create images directory
        std::fs::create_dir_all(&images_dir).map_err(|e| VisualError::IoError {
            message: format!("Failed to create images directory: {}", e),
        })?;

        // Copy all referenced images
        for result_meta in results {
            let result = &result_meta.result;
            
            // Copy baseline
            self.copy_image_file(&result.baseline_path, &images_dir)?;
            
            // Copy actual
            self.copy_image_file(&result.actual_path, &images_dir)?;
            
            // Copy diff if available
            if let Some(ref diff_path) = result.diff_image_path {
                self.copy_image_file(diff_path, &images_dir)?;
            }
        }

        Ok(())
    }

    /// Copy a single image file to the images directory
    fn copy_image_file(&self, src_path: &str, dest_dir: &Path) -> VisualResult<()> {
        let src = Path::new(src_path);
        if !src.exists() {
            return Ok(()); // Skip missing files
        }

        let filename = src.file_name()
            .ok_or_else(|| VisualError::IoError {
                message: format!("Invalid filename: {}", src_path),
            })?;
        
        let dest = dest_dir.join(filename);
        
        std::fs::copy(src, dest).map_err(|e| VisualError::IoError {
            message: format!("Failed to copy image {} to images directory: {}", src_path, e),
        })?;

        Ok(())
    }

    /// Generate HTML footer
    fn generate_html_footer(&self) -> String {
        format!(
            r#"    </div>
    <script>
        {}
    </script>
</body>
</html>"#,
            self.get_default_javascript()
        )
    }

    /// Get default CSS styles
    fn get_default_css(&self) -> String {
        let custom_css = self.config.custom_css.as_deref().unwrap_or("");
        
        format!(
            r#"
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        
        header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        
        header h1 {{
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }}
        
        .timestamp {{
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 0.9em;
        }}
        
        .summary {{
            padding: 30px;
            border-bottom: 1px solid #eee;
        }}
        
        .summary h2 {{
            margin-top: 0;
            color: #444;
        }}
        
        .stats {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }}
        
        .stat-item {{
            text-align: center;
            padding: 20px;
            border-radius: 8px;
            background: #f8f9fa;
        }}
        
        .stat-item.passed {{
            background: #d4edda;
            color: #155724;
        }}
        
        .stat-item.failed {{
            background: #f8d7da;
            color: #721c24;
        }}
        
        .stat-number {{
            display: block;
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }}
        
        .stat-label {{
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        
        .results {{
            padding: 30px;
        }}
        
        .results h2 {{
            margin-top: 0;
            color: #444;
        }}
        
        .test-result {{
            margin-bottom: 30px;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
        }}
        
        .test-result.passed {{
            border-color: #28a745;
        }}
        
        .test-result.failed {{
            border-color: #dc3545;
        }}
        
        .test-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #ddd;
        }}
        
        .test-result.passed .test-header {{
            background: #d4edda;
        }}
        
        .test-result.failed .test-header {{
            background: #f8d7da;
        }}
        
        .test-header h3 {{
            margin: 0;
            font-size: 1.2em;
        }}
        
        .status {{
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
        }}
        
        .status.passed {{
            background: #28a745;
            color: white;
        }}
        
        .status.failed {{
            background: #dc3545;
            color: white;
        }}
        
        .test-details {{
            padding: 20px;
        }}
        
        .metrics {{
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }}
        
        .metric {{
            background: #e9ecef;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 0.9em;
        }}
        
        .image-comparison {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }}
        
        .image-container {{
            text-align: center;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            background: #fafafa;
        }}
        
        .image-container h4 {{
            margin-top: 0;
            margin-bottom: 15px;
            color: #555;
        }}
        
        .thumbnail {{
            max-width: 100%;
            height: auto;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        
        .full-size-link {{
            display: inline-block;
            margin-top: 10px;
            color: #007bff;
            text-decoration: none;
            font-size: 0.9em;
        }}
        
        .full-size-link:hover {{
            text-decoration: underline;
        }}
        
        .error {{
            color: #dc3545;
            font-style: italic;
        }}
        
        @media (max-width: 768px) {{
            .container {{
                margin: 10px;
                border-radius: 0;
            }}
            
            .stats {{
                grid-template-columns: repeat(2, 1fr);
            }}
            
            .image-comparison {{
                grid-template-columns: 1fr;
            }}
            
            .metrics {{
                flex-direction: column;
                gap: 10px;
            }}
        }}
        
        {}
"#,
            custom_css
        )
    }

    /// Get default JavaScript
    fn get_default_javascript(&self) -> String {
        "
        // Simple image viewer functionality
        document.addEventListener('DOMContentLoaded', function() {
            // Add click handlers for thumbnails
            const thumbnails = document.querySelectorAll('.thumbnail');
            thumbnails.forEach(function(thumbnail) {
                thumbnail.style.cursor = 'pointer';
                thumbnail.addEventListener('click', function() {
                    // Simple zoom functionality
                    if (this.style.transform === 'scale(2)') {
                        this.style.transform = 'scale(1)';
                        this.style.zIndex = '1';
                    } else {
                        this.style.transform = 'scale(2)';
                        this.style.zIndex = '1000';
                        this.style.position = 'relative';
                    }
                });
            });
            
            // Add smooth scrolling for internal links
            const links = document.querySelectorAll('a[href^=\"#\"]');
            links.forEach(function(link) {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const target = document.querySelector(this.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                });
            });
        });
        ".to_string()
    }
}

/// Test result with additional metadata for reporting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResultWithMetadata {
    /// The comparison result
    pub result: ComparisonResult,
    /// Test name or identifier
    pub test_name: String,
    /// Test description
    pub description: Option<String>,
    /// Test tags or categories
    pub tags: Vec<String>,
    /// Execution timestamp
    pub timestamp: chrono::DateTime<chrono::Utc>,
    /// Additional metadata
    pub metadata: HashMap<String, String>,
}

impl TestResultWithMetadata {
    /// Create a new test result with metadata
    pub fn new(result: ComparisonResult, test_name: String) -> Self {
        Self {
            result,
            test_name,
            description: None,
            tags: Vec::new(),
            timestamp: chrono::Utc::now(),
            metadata: HashMap::new(),
        }
    }

    /// Add a description to the test result
    pub fn with_description(mut self, description: String) -> Self {
        self.description = Some(description);
        self
    }

    /// Add tags to the test result
    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.tags = tags;
        self
    }

    /// Add metadata to the test result
    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::visual_testing::{DifferenceType, PerformanceMetrics};
    use tempfile::tempdir;

    #[test]
    fn test_html_report_generation() {
        let config = HTMLReportConfig::default();
        let generator = HTMLReportGenerator::new(config);
        
        // Create test results
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
    fn test_ci_vs_local_config() {
        let ci_generator = HTMLReportGenerator::for_ci();
        let local_generator = HTMLReportGenerator::for_local();
        
        assert!(ci_generator.config.embed_images);
        assert!(!local_generator.config.embed_images);
        
        assert_eq!(ci_generator.config.max_thumbnail_size, 300);
        assert_eq!(local_generator.config.max_thumbnail_size, 600);
    }

    #[test]
    fn test_summary_statistics() {
        let generator = HTMLReportGenerator::for_ci();
        
        // Create mixed results
        let passed_result = ComparisonResult::new(
            true, 0.0, DifferenceType::NoChange,
            "baseline1.png".to_string(), "actual1.png".to_string()
        );
        let failed_result = ComparisonResult::new(
            false, 0.2, DifferenceType::ContentChange,
            "baseline2.png".to_string(), "actual2.png".to_string()
        );
        
        let results = vec![
            TestResultWithMetadata::new(passed_result, "test1".to_string()),
            TestResultWithMetadata::new(failed_result, "test2".to_string()),
        ];
        
        let summary = generator.generate_summary_section(&results);
        
        assert!(summary.contains("1")); // 1 passed
        assert!(summary.contains("1")); // 1 failed  
        assert!(summary.contains("2")); // 2 total
        assert!(summary.contains("10.00%")); // Average mismatch (0.0 + 0.2) / 2 * 100
    }

    #[test]
    fn test_report_file_generation() {
        let dir = tempdir().unwrap();
        let report_path = dir.path().join("report.html");
        
        let generator = HTMLReportGenerator::for_local();
        
        let result = ComparisonResult::new(
            true, 0.0, DifferenceType::NoChange,
            "baseline.png".to_string(), "actual.png".to_string()
        );
        let test_result = TestResultWithMetadata::new(result, "test_example".to_string());
        let results = vec![test_result];
        
        // Generate report
        generator.generate_report(&results, report_path.to_str().unwrap()).unwrap();
        
        // Verify file was created
        assert!(report_path.exists());
        
        // Verify content
        let content = std::fs::read_to_string(&report_path).unwrap();
        assert!(content.contains("test_example"));
        assert!(content.contains("PASSED"));
    }
}
