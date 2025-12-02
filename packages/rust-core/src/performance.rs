//! Performance monitoring and metrics collection system

use crate::{Result, AutomationError, health::{CoreType, PerformanceMetrics}};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

/// Performance metrics collector for automation operations
#[derive(Debug)]
pub struct PerformanceCollector {
    core_type: CoreType,
    metrics: Arc<RwLock<PerformanceData>>,
    operation_history: Arc<Mutex<VecDeque<OperationMetric>>>,
    max_history_size: usize,
}

/// Internal performance data storage
#[derive(Debug, Clone)]
struct PerformanceData {
    total_operations: u64,
    successful_operations: u64,
    total_execution_time: Duration,
    memory_samples: VecDeque<MemorySample>,
    cpu_samples: VecDeque<CpuSample>,
    last_updated: SystemTime,
}

/// Individual operation performance metric
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationMetric {
    pub operation_type: OperationType,
    pub start_time: SystemTime,
    pub duration: Duration,
    pub success: bool,
    pub memory_before: Option<u64>,
    pub memory_after: Option<u64>,
    pub cpu_usage: Option<f32>,
    pub error_message: Option<String>,
}

/// Types of automation operations being measured
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OperationType {
    Recording,
    Playback,
    MouseMove,
    MouseClick,
    KeyboardInput,
    ScreenCapture,
    ScriptLoad,
    ScriptSave,
}

/// Memory usage sample
#[derive(Debug, Clone)]
struct MemorySample {
    timestamp: SystemTime,
    bytes_used: u64,
}

/// CPU usage sample
#[derive(Debug, Clone)]
struct CpuSample {
    timestamp: SystemTime,
    percentage: f32,
}

/// Performance comparison between cores
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceComparison {
    pub python_metrics: Option<PerformanceMetrics>,
    pub rust_metrics: Option<PerformanceMetrics>,
    pub recommendation: CoreRecommendation,
    pub comparison_details: ComparisonDetails,
}

/// Core recommendation based on performance analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoreRecommendation {
    pub recommended_core: CoreType,
    pub confidence: f32, // 0.0 to 1.0
    pub reasons: Vec<String>,
    pub performance_improvement: Option<f32>, // Percentage improvement
}

/// Detailed performance comparison metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonDetails {
    pub response_time_ratio: f32, // rust_time / python_time
    pub memory_usage_ratio: Option<f32>,
    pub success_rate_difference: f32,
    pub operations_count_difference: i64,
}

/// Performance benchmark suite
pub struct PerformanceBenchmark {
    collectors: HashMap<CoreType, PerformanceCollector>,
    benchmark_results: Vec<BenchmarkResult>,
}

/// Result of a performance benchmark
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub test_name: String,
    pub core_type: CoreType,
    pub execution_time: Duration,
    pub memory_peak: Option<u64>,
    pub success: bool,
    pub timestamp: SystemTime,
}

impl PerformanceCollector {
    /// Create a new performance collector for a specific core
    pub fn new(core_type: CoreType) -> Self {
        Self {
            core_type,
            metrics: Arc::new(RwLock::new(PerformanceData::new())),
            operation_history: Arc::new(Mutex::new(VecDeque::new())),
            max_history_size: 1000, // Keep last 1000 operations
        }
    }

    /// Start measuring an operation
    pub async fn start_operation(&self, operation_type: OperationType) -> OperationMeasurement {
        let memory_before = self.get_current_memory_usage().await;
        
        OperationMeasurement {
            collector: self.clone(),
            operation_type,
            start_time: Instant::now(),
            start_system_time: SystemTime::now(),
            memory_before,
        }
    }

    /// Record the completion of an operation
    pub async fn record_operation(&self, metric: OperationMetric) -> Result<()> {
        // Update aggregated metrics
        {
            let mut metrics = self.metrics.write().await;
            metrics.total_operations += 1;
            if metric.success {
                metrics.successful_operations += 1;
            }
            metrics.total_execution_time += metric.duration;
            metrics.last_updated = SystemTime::now();
        }

        // Add to operation history
        {
            let mut history = self.operation_history.lock()
                .map_err(|_| AutomationError::SystemError {
                    message: "Failed to acquire operation history lock".to_string(),
                })?;
            
            history.push_back(metric);
            
            // Maintain max history size
            while history.len() > self.max_history_size {
                history.pop_front();
            }
        }

        Ok(())
    }

    /// Get current performance metrics
    pub async fn get_metrics(&self) -> PerformanceMetrics {
        let metrics = self.metrics.read().await;
        let avg_response_time = if metrics.total_operations > 0 {
            metrics.total_execution_time / metrics.total_operations as u32
        } else {
            Duration::from_millis(0)
        };

        let success_rate = if metrics.total_operations > 0 {
            metrics.successful_operations as f32 / metrics.total_operations as f32
        } else {
            1.0
        };

        let memory_usage = self.get_average_memory_usage(&metrics).await;
        let cpu_usage = self.get_average_cpu_usage(&metrics).await;

        PerformanceMetrics {
            avg_response_time,
            memory_usage,
            cpu_usage,
            success_rate,
            operations_count: metrics.total_operations,
        }
    }

    /// Get recent operation history
    pub fn get_operation_history(&self, limit: Option<usize>) -> Result<Vec<OperationMetric>> {
        let history = self.operation_history.lock()
            .map_err(|_| AutomationError::SystemError {
                message: "Failed to acquire operation history lock".to_string(),
            })?;

        let operations: Vec<OperationMetric> = if let Some(limit) = limit {
            history.iter().rev().take(limit).cloned().collect()
        } else {
            history.iter().cloned().collect()
        };

        Ok(operations)
    }

    /// Sample current memory usage
    pub async fn sample_memory(&self) -> Result<()> {
        if let Some(memory_usage) = self.get_current_memory_usage().await {
            let mut metrics = self.metrics.write().await;
            metrics.memory_samples.push_back(MemorySample {
                timestamp: SystemTime::now(),
                bytes_used: memory_usage,
            });

            // Keep only recent samples (last 100)
            while metrics.memory_samples.len() > 100 {
                metrics.memory_samples.pop_front();
            }
        }
        Ok(())
    }

    /// Sample current CPU usage
    pub async fn sample_cpu(&self) -> Result<()> {
        if let Some(cpu_usage) = self.get_current_cpu_usage().await {
            let mut metrics = self.metrics.write().await;
            metrics.cpu_samples.push_back(CpuSample {
                timestamp: SystemTime::now(),
                percentage: cpu_usage,
            });

            // Keep only recent samples (last 100)
            while metrics.cpu_samples.len() > 100 {
                metrics.cpu_samples.pop_front();
            }
        }
        Ok(())
    }

    /// Get current memory usage in bytes
    async fn get_current_memory_usage(&self) -> Option<u64> {
        // Platform-specific memory usage detection
        #[cfg(target_os = "windows")]
        {
            self.get_windows_memory_usage().await
        }

        #[cfg(target_os = "macos")]
        {
            self.get_macos_memory_usage().await
        }

        #[cfg(target_os = "linux")]
        {
            self.get_linux_memory_usage().await
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            None
        }
    }

    /// Get current CPU usage percentage
    async fn get_current_cpu_usage(&self) -> Option<f32> {
        // Platform-specific CPU usage detection
        #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
        {
            // For now, return a placeholder
            // In a real implementation, this would use platform-specific APIs
            Some(0.0)
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            None
        }
    }

    #[cfg(target_os = "windows")]
    async fn get_windows_memory_usage(&self) -> Option<u64> {
        use winapi::um::processthreadsapi::GetCurrentProcess;
        use winapi::um::psapi::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
        use winapi::shared::minwindef::DWORD;

        unsafe {
            let process = GetCurrentProcess();
            let mut pmc: PROCESS_MEMORY_COUNTERS = std::mem::zeroed();
            
            if winapi::um::psapi::GetProcessMemoryInfo(
                process,
                &mut pmc,
                std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as DWORD,
            ) != 0 {
                Some(pmc.WorkingSetSize as u64)
            } else {
                None
            }
        }
    }

    #[cfg(target_os = "macos")]
    async fn get_macos_memory_usage(&self) -> Option<u64> {
        // Use mach API to get memory usage
        // For now, return None - would need mach bindings
        None
    }

    #[cfg(target_os = "linux")]
    async fn get_linux_memory_usage(&self) -> Option<u64> {
        use tokio::fs;
        
        // Read from /proc/self/status
        if let Ok(status) = fs::read_to_string("/proc/self/status").await {
            for line in status.lines() {
                if line.starts_with("VmRSS:") {
                    if let Some(kb_str) = line.split_whitespace().nth(1) {
                        if let Ok(kb) = kb_str.parse::<u64>() {
                            return Some(kb * 1024); // Convert KB to bytes
                        }
                    }
                }
            }
        }
        None
    }

    async fn get_average_memory_usage(&self, metrics: &PerformanceData) -> Option<u64> {
        if metrics.memory_samples.is_empty() {
            return None;
        }

        let total: u64 = metrics.memory_samples.iter()
            .map(|sample| sample.bytes_used)
            .sum();
        
        Some(total / metrics.memory_samples.len() as u64)
    }

    async fn get_average_cpu_usage(&self, metrics: &PerformanceData) -> Option<f32> {
        if metrics.cpu_samples.is_empty() {
            return None;
        }

        let total: f32 = metrics.cpu_samples.iter()
            .map(|sample| sample.percentage)
            .sum();
        
        Some(total / metrics.cpu_samples.len() as f32)
    }
}

impl Clone for PerformanceCollector {
    fn clone(&self) -> Self {
        Self {
            core_type: self.core_type.clone(),
            metrics: Arc::clone(&self.metrics),
            operation_history: Arc::clone(&self.operation_history),
            max_history_size: self.max_history_size,
        }
    }
}

impl PerformanceData {
    fn new() -> Self {
        Self {
            total_operations: 0,
            successful_operations: 0,
            total_execution_time: Duration::from_millis(0),
            memory_samples: VecDeque::new(),
            cpu_samples: VecDeque::new(),
            last_updated: SystemTime::now(),
        }
    }
}

/// RAII guard for measuring operation performance
pub struct OperationMeasurement {
    collector: PerformanceCollector,
    operation_type: OperationType,
    start_time: Instant,
    start_system_time: SystemTime,
    memory_before: Option<u64>,
}

impl OperationMeasurement {
    /// Complete the measurement with success status
    pub async fn complete(self, success: bool) -> Result<()> {
        self.complete_with_error(success, None).await
    }

    /// Complete the measurement with optional error message
    pub async fn complete_with_error(self, success: bool, error_message: Option<String>) -> Result<()> {
        let duration = self.start_time.elapsed();
        let memory_after = self.collector.get_current_memory_usage().await;
        let cpu_usage = self.collector.get_current_cpu_usage().await;

        let metric = OperationMetric {
            operation_type: self.operation_type,
            start_time: self.start_system_time,
            duration,
            success,
            memory_before: self.memory_before,
            memory_after,
            cpu_usage,
            error_message,
        };

        self.collector.record_operation(metric).await
    }
}

impl PerformanceBenchmark {
    /// Create a new performance benchmark suite
    pub fn new() -> Self {
        Self {
            collectors: HashMap::new(),
            benchmark_results: Vec::new(),
        }
    }

    /// Add a performance collector for a core
    pub fn add_collector(&mut self, core_type: CoreType, collector: PerformanceCollector) {
        self.collectors.insert(core_type, collector);
    }

    /// Run a benchmark test for a specific core
    pub async fn run_benchmark(&mut self, core_type: &CoreType, test_name: String) -> Result<BenchmarkResult> {
        let collector = self.collectors.get(core_type)
            .ok_or_else(|| AutomationError::SystemError {
                message: format!("No collector found for core type: {}", core_type),
            })?;

        let measurement = collector.start_operation(OperationType::Recording).await;
        let start_time = Instant::now();
        let memory_before = collector.get_current_memory_usage().await;

        // Simulate benchmark operation
        tokio::time::sleep(Duration::from_millis(100)).await;

        let execution_time = start_time.elapsed();
        let memory_after = collector.get_current_memory_usage().await;
        let memory_peak = memory_after.or(memory_before);

        measurement.complete(true).await?;

        let result = BenchmarkResult {
            test_name,
            core_type: core_type.clone(),
            execution_time,
            memory_peak,
            success: true,
            timestamp: SystemTime::now(),
        };

        self.benchmark_results.push(result.clone());
        Ok(result)
    }

    /// Compare performance between cores
    pub async fn compare_cores(&self) -> Result<PerformanceComparison> {
        let python_metrics = if let Some(collector) = self.collectors.get(&CoreType::Python) {
            Some(collector.get_metrics().await)
        } else {
            None
        };

        let rust_metrics = if let Some(collector) = self.collectors.get(&CoreType::Rust) {
            Some(collector.get_metrics().await)
        } else {
            None
        };

        let recommendation = self.generate_recommendation(&python_metrics, &rust_metrics);
        let comparison_details = self.calculate_comparison_details(&python_metrics, &rust_metrics);

        Ok(PerformanceComparison {
            python_metrics,
            rust_metrics,
            recommendation,
            comparison_details,
        })
    }

    fn generate_recommendation(
        &self,
        python_metrics: &Option<PerformanceMetrics>,
        rust_metrics: &Option<PerformanceMetrics>,
    ) -> CoreRecommendation {
        match (python_metrics, rust_metrics) {
            (Some(python), Some(rust)) => {
                let mut reasons = Vec::new();
                let mut rust_score = 0.0f32;
                let mut python_score = 0.0f32;

                // Compare response times
                if rust.avg_response_time < python.avg_response_time {
                    rust_score += 0.3;
                    reasons.push("Rust core has faster response times".to_string());
                } else {
                    python_score += 0.3;
                    reasons.push("Python core has faster response times".to_string());
                }

                // Compare success rates
                if rust.success_rate > python.success_rate {
                    rust_score += 0.3;
                    reasons.push("Rust core has higher success rate".to_string());
                } else {
                    python_score += 0.3;
                    reasons.push("Python core has higher success rate".to_string());
                }

                // Compare memory usage (lower is better)
                match (rust.memory_usage, python.memory_usage) {
                    (Some(rust_mem), Some(python_mem)) => {
                        if rust_mem < python_mem {
                            rust_score += 0.2;
                            reasons.push("Rust core uses less memory".to_string());
                        } else {
                            python_score += 0.2;
                            reasons.push("Python core uses less memory".to_string());
                        }
                    }
                    _ => {}
                }

                // Experience factor (more operations = more reliable)
                if rust.operations_count > python.operations_count {
                    rust_score += 0.2;
                } else {
                    python_score += 0.2;
                }

                let recommended_core = if rust_score > python_score {
                    CoreType::Rust
                } else {
                    CoreType::Python
                };

                let confidence = (rust_score - python_score).abs().max(0.5);
                let performance_improvement = if rust_score > python_score {
                    Some((rust_score - python_score) * 100.0)
                } else {
                    Some((python_score - rust_score) * 100.0)
                };

                CoreRecommendation {
                    recommended_core,
                    confidence,
                    reasons,
                    performance_improvement,
                }
            }
            (Some(_), None) => CoreRecommendation {
                recommended_core: CoreType::Python,
                confidence: 1.0,
                reasons: vec!["Rust core is not available".to_string()],
                performance_improvement: None,
            },
            (None, Some(_)) => CoreRecommendation {
                recommended_core: CoreType::Rust,
                confidence: 1.0,
                reasons: vec!["Python core is not available".to_string()],
                performance_improvement: None,
            },
            (None, None) => CoreRecommendation {
                recommended_core: CoreType::Python, // Default fallback
                confidence: 0.0,
                reasons: vec!["No performance data available for either core".to_string()],
                performance_improvement: None,
            },
        }
    }

    fn calculate_comparison_details(
        &self,
        python_metrics: &Option<PerformanceMetrics>,
        rust_metrics: &Option<PerformanceMetrics>,
    ) -> ComparisonDetails {
        match (python_metrics, rust_metrics) {
            (Some(python), Some(rust)) => {
                let response_time_ratio = if python.avg_response_time.as_millis() > 0 {
                    rust.avg_response_time.as_millis() as f32 / python.avg_response_time.as_millis() as f32
                } else {
                    1.0
                };

                let memory_usage_ratio = match (rust.memory_usage, python.memory_usage) {
                    (Some(rust_mem), Some(python_mem)) if python_mem > 0 => {
                        Some(rust_mem as f32 / python_mem as f32)
                    }
                    _ => None,
                };

                let success_rate_difference = rust.success_rate - python.success_rate;
                let operations_count_difference = rust.operations_count as i64 - python.operations_count as i64;

                ComparisonDetails {
                    response_time_ratio,
                    memory_usage_ratio,
                    success_rate_difference,
                    operations_count_difference,
                }
            }
            _ => ComparisonDetails {
                response_time_ratio: 1.0,
                memory_usage_ratio: None,
                success_rate_difference: 0.0,
                operations_count_difference: 0,
            },
        }
    }

    /// Get benchmark results for a specific core
    pub fn get_benchmark_results(&self, core_type: &CoreType) -> Vec<&BenchmarkResult> {
        self.benchmark_results
            .iter()
            .filter(|result| &result.core_type == core_type)
            .collect()
    }

    /// Get all benchmark results
    pub fn get_all_benchmark_results(&self) -> &[BenchmarkResult] {
        &self.benchmark_results
    }
}

impl Default for PerformanceBenchmark {
    fn default() -> Self {
        Self::new()
    }
}

/// Performance monitoring manager that coordinates all performance collection
pub struct PerformanceManager {
    collectors: HashMap<CoreType, PerformanceCollector>,
    benchmark: PerformanceBenchmark,
    monitoring_active: bool,
}

impl PerformanceManager {
    /// Create a new performance manager
    pub fn new() -> Self {
        let mut collectors = HashMap::new();
        collectors.insert(CoreType::Python, PerformanceCollector::new(CoreType::Python));
        collectors.insert(CoreType::Rust, PerformanceCollector::new(CoreType::Rust));

        let mut benchmark = PerformanceBenchmark::new();
        for (core_type, collector) in &collectors {
            benchmark.add_collector(core_type.clone(), collector.clone());
        }

        Self {
            collectors,
            benchmark,
            monitoring_active: false,
        }
    }

    /// Get performance collector for a specific core
    pub fn get_collector(&self, core_type: &CoreType) -> Option<&PerformanceCollector> {
        self.collectors.get(core_type)
    }

    /// Start performance monitoring
    pub async fn start_monitoring(&mut self) -> Result<()> {
        if self.monitoring_active {
            return Ok(());
        }

        self.monitoring_active = true;

        // Start periodic sampling for all collectors
        for collector in self.collectors.values() {
            let collector_clone = collector.clone();
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(Duration::from_secs(5));
                loop {
                    interval.tick().await;
                    let _ = collector_clone.sample_memory().await;
                    let _ = collector_clone.sample_cpu().await;
                }
            });
        }

        Ok(())
    }

    /// Stop performance monitoring
    pub fn stop_monitoring(&mut self) {
        self.monitoring_active = false;
    }

    /// Get performance comparison between cores
    pub async fn get_performance_comparison(&self) -> Result<PerformanceComparison> {
        self.benchmark.compare_cores().await
    }

    /// Run performance benchmarks
    pub async fn run_benchmarks(&mut self) -> Result<Vec<BenchmarkResult>> {
        let mut results = Vec::new();

        for core_type in [CoreType::Python, CoreType::Rust] {
            if self.collectors.contains_key(&core_type) {
                let result = self.benchmark.run_benchmark(&core_type, "Basic Operation Test".to_string()).await?;
                results.push(result);
            }
        }

        Ok(results)
    }
}

impl Default for PerformanceManager {
    fn default() -> Self {
        Self::new()
    }
}
