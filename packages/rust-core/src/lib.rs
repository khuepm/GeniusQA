//! Rust Automation Core
//! 
//! High-performance automation library for GeniusQA Desktop providing
//! cross-platform mouse, keyboard, and screen automation capabilities.

pub mod automation;
pub mod error;
pub mod platform;
pub mod recorder;
pub mod player;
pub mod script;
pub mod config;
pub mod preferences;
pub mod health;
pub mod fallback;
pub mod error_reporting;
pub mod performance;
pub mod validation;
pub mod cross_core_testing;
pub mod logging;
pub mod monitoring;
pub mod debug;

#[cfg(test)]
mod preferences_property_tests;

#[cfg(test)]
mod recording_property_tests;

#[cfg(test)]
mod performance_property_tests;

#[cfg(test)]
mod validation_tests;

#[cfg(test)]
mod cross_core_testing_tests;

#[cfg(test)]
mod validation_property_tests;

#[cfg(test)]
mod permission_property_tests;

pub use automation::{AutomationCore, AutomationCommand, CommandResult};
pub use error::{AutomationError, Result, ErrorInfo, ErrorSeverity};
pub use config::AutomationConfig;
pub use script::{ScriptData, Action, ActionType};
pub use preferences::{PreferenceManager, UserPreferences};
pub use health::{CoreHealthChecker, CoreHealth, PerformanceMetrics};
pub use fallback::{FallbackManager, FallbackConfig, FallbackResult};
pub use error_reporting::{CrossCoreErrorReporter, ErrorReport, SuggestedAction, ActionType as ErrorActionType};
pub use performance::{PerformanceCollector, PerformanceManager, PerformanceComparison, CoreRecommendation, OperationType, OperationMetric, BenchmarkResult};
pub use validation::{ScriptValidator, ScriptMigrator, CompatibilityTester, CompatibilityResult, CompatibilityIssue, IssueSeverity};
pub use cross_core_testing::{CrossCoreTestSuite, TestScript, CrossCoreTestResult, RecordingComparator, create_default_test_scripts};
pub use logging::{AutomationLogger, LoggingConfig, LogEntry, LogLevel, OperationType as LogOperationType, CoreType as LogCoreType, PerformanceReport, init_logger, get_logger};
pub use monitoring::{CoreMonitor, MonitoringConfig, HealthStatus, CoreHealthInfo, Alert, AlertType, MonitoringMetrics, HealthCheckResult};

/// Re-export commonly used types
pub mod prelude {
    pub use crate::{
        AutomationCore,
        AutomationCommand,
        CommandResult,
        AutomationError,
        Result,
        ErrorInfo,
        ErrorSeverity,
        AutomationConfig,
        ScriptData,
        Action,
        ActionType,
        PreferenceManager,
        UserPreferences,
        CoreHealthChecker,
        CoreHealth,
        PerformanceMetrics,
        FallbackManager,
        FallbackConfig,
        FallbackResult,
        CrossCoreErrorReporter,
        ErrorReport,
        SuggestedAction,
        PerformanceCollector,
        PerformanceManager,
        PerformanceComparison,
        CoreRecommendation,
        OperationType,
        OperationMetric,
        BenchmarkResult,
        ScriptValidator,
        ScriptMigrator,
        CompatibilityTester,
        CompatibilityResult,
        CompatibilityIssue,
        IssueSeverity,
        CrossCoreTestSuite,
        TestScript,
        CrossCoreTestResult,
        RecordingComparator,
        create_default_test_scripts,
        AutomationLogger,
        LoggingConfig,
        LogEntry,
        LogLevel,
        logging::OperationType as LogOperationType,
        logging::CoreType as LogCoreType,
        PerformanceReport,
        init_logger,
        get_logger,
        CoreMonitor,
        MonitoringConfig,
        HealthStatus,
        CoreHealthInfo,
        Alert,
        AlertType,
        MonitoringMetrics,
        HealthCheckResult,
    };
    pub use crate::health::CoreType;
}
