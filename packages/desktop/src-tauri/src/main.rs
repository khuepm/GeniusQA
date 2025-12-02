// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod core_router;
mod python_process;

use core_router::{AutomationCommand, CoreRouter, CoreStatus, CoreType, PerformanceComparison};
use python_process::PythonProcessManager;
use rust_automation_core::preferences::UserSettings;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

// Core router state wrapper
struct CoreRouterState {
    router: CoreRouter,
}

// Monitor state wrapper
struct MonitorState {
    monitor: rust_automation_core::CoreMonitor,
}

// Response types
#[derive(Debug, Serialize, Deserialize)]
struct RecordingResult {
    #[serde(rename = "scriptPath")]
    script_path: Option<String>,
    #[serde(rename = "actionCount")]
    action_count: Option<i32>,
    duration: Option<f64>,
    #[serde(rename = "screenshotCount")]
    screenshot_count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ScriptInfo {
    path: String,
    filename: String,
    created_at: String,
    duration: f64,
    action_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct PerformanceMetricsResponse {
    #[serde(rename = "coreType")]
    core_type: String,
    #[serde(rename = "lastOperationTime")]
    last_operation_time: f64,
    #[serde(rename = "memoryUsage")]
    memory_usage: f64,
    #[serde(rename = "cpuUsage")]
    cpu_usage: f64,
    #[serde(rename = "operationCount")]
    operation_count: u64,
    #[serde(rename = "errorRate")]
    error_rate: f32,
}

// Core management commands
#[tauri::command]
async fn select_core(
    core_router: State<'_, CoreRouterState>,
    core_type: String,
) -> Result<(), String> {
    let core_type = match core_type.as_str() {
        "python" => CoreType::Python,
        "rust" => CoreType::Rust,
        _ => return Err(format!("Invalid core type: {}", core_type)),
    };

    core_router.router.select_core(core_type)
}

#[tauri::command]
async fn get_available_cores(
    core_router: State<'_, CoreRouterState>,
) -> Result<Vec<String>, String> {
    let cores = core_router.router.get_available_cores();
    let core_strings: Vec<String> = cores
        .into_iter()
        .map(|core| match core {
            CoreType::Python => "python".to_string(),
            CoreType::Rust => "rust".to_string(),
        })
        .collect();
    Ok(core_strings)
}

#[tauri::command]
async fn get_core_status(
    core_router: State<'_, CoreRouterState>,
) -> Result<CoreStatus, String> {
    Ok(core_router.router.get_core_status())
}

#[tauri::command]
async fn get_core_performance_metrics(
    core_router: State<'_, CoreRouterState>,
) -> Result<Vec<PerformanceMetricsResponse>, String> {
    let metrics_map = core_router.router.get_performance_metrics().await;
    
    let metrics_vec: Vec<PerformanceMetricsResponse> = metrics_map
        .into_iter()
        .map(|(core_type, metrics)| PerformanceMetricsResponse {
            core_type: match core_type {
                CoreType::Python => "python".to_string(),
                CoreType::Rust => "rust".to_string(),
            },
            last_operation_time: metrics.avg_response_time.as_millis() as f64,
            memory_usage: 0.0, // TODO: Implement memory tracking
            cpu_usage: 0.0,    // TODO: Implement CPU tracking
            operation_count: metrics.total_operations,
            error_rate: 1.0 - metrics.success_rate,
        })
        .collect();
    
    Ok(metrics_vec)
}

#[tauri::command]
async fn get_performance_comparison(
    core_router: State<'_, CoreRouterState>,
) -> Result<PerformanceComparison, String> {
    Ok(core_router.router.get_performance_comparison().await)
}

// Settings management commands
#[tauri::command]
async fn get_user_settings(
    core_router: State<'_, CoreRouterState>,
) -> Result<Option<UserSettings>, String> {
    Ok(core_router.router.get_user_settings())
}

#[tauri::command]
async fn update_user_settings(
    core_router: State<'_, CoreRouterState>,
    settings: UserSettings,
) -> Result<(), String> {
    core_router.router.update_user_settings(settings)
}

#[tauri::command]
async fn set_playback_speed(
    core_router: State<'_, CoreRouterState>,
    speed: f64,
) -> Result<(), String> {
    core_router.router.set_playback_speed(speed)
}

#[tauri::command]
async fn set_loop_count(
    core_router: State<'_, CoreRouterState>,
    count: u32,
) -> Result<(), String> {
    core_router.router.set_loop_count(count)
}

#[tauri::command]
async fn set_selected_script_path(
    core_router: State<'_, CoreRouterState>,
    path: Option<String>,
) -> Result<(), String> {
    core_router.router.set_selected_script_path(path)
}

#[tauri::command]
async fn set_show_preview(
    core_router: State<'_, CoreRouterState>,
    show_preview: bool,
) -> Result<(), String> {
    core_router.router.set_show_preview(show_preview)
}

#[tauri::command]
async fn set_preview_opacity(
    core_router: State<'_, CoreRouterState>,
    opacity: f64,
) -> Result<(), String> {
    core_router.router.set_preview_opacity(opacity)
}

// Automation commands (now routed through CoreRouter)
#[tauri::command]
async fn start_recording(
    core_router: State<'_, CoreRouterState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let start_time = std::time::Instant::now();
    let active_core = core_router.router.get_core_status().active_core;
    
    let response = core_router.router.route_command(
        AutomationCommand::StartRecording,
        &app_handle,
    ).await;

    let operation_duration = start_time.elapsed();
    let success = response.is_ok() && 
        response.as_ref().unwrap().get("success").and_then(|s| s.as_bool()) == Some(true);

    // Update performance metrics
    core_router.router.update_performance_metrics(
        active_core,
        operation_duration,
        success,
    ).await;

    match response {
        Ok(resp) => {
            // Check if successful
            if resp.get("success").and_then(|s| s.as_bool()) == Some(true) {
                Ok(())
            } else {
                let error = resp
                    .get("error")
                    .and_then(|e| e.as_str())
                    .unwrap_or("Unknown error");
                Err(error.to_string())
            }
        }
        Err(e) => Err(e)
    }
}

#[tauri::command]
async fn stop_recording(
    core_router: State<'_, CoreRouterState>,
    app_handle: tauri::AppHandle,
) -> Result<RecordingResult, String> {
    let start_time = std::time::Instant::now();
    let active_core = core_router.router.get_core_status().active_core;
    
    let response = core_router.router.route_command(
        AutomationCommand::StopRecording,
        &app_handle,
    ).await;

    let operation_duration = start_time.elapsed();
    let success = response.is_ok() && 
        response.as_ref().unwrap().get("success").and_then(|s| s.as_bool()) == Some(true);

    // Update performance metrics
    core_router.router.update_performance_metrics(
        active_core,
        operation_duration,
        success,
    ).await;

    match response {
        Ok(resp) => {
            // Check if successful
            if resp.get("success").and_then(|s| s.as_bool()) == Some(true) {
                let data = resp.get("data").ok_or("Missing data in response")?;
                
                let result = RecordingResult {
                    script_path: data.get("scriptPath").and_then(|s| s.as_str()).map(String::from),
                    action_count: data.get("actionCount").and_then(|n| n.as_i64()).map(|n| n as i32),
                    duration: data.get("duration").and_then(|n| n.as_f64()),
                    screenshot_count: data.get("screenshotCount").and_then(|n| n.as_i64()).map(|n| n as i32),
                };
                
                Ok(result)
            } else {
                let error = resp
                    .get("error")
                    .and_then(|e| e.as_str())
                    .unwrap_or("Unknown error");
                Err(error.to_string())
            }
        }
        Err(e) => Err(e)
    }
}

#[tauri::command]
async fn start_playback(
    core_router: State<'_, CoreRouterState>,
    app_handle: tauri::AppHandle,
    script_path: Option<String>,
    speed: Option<f64>,
    loop_count: Option<i32>,
) -> Result<(), String> {
    let start_time = std::time::Instant::now();
    let active_core = core_router.router.get_core_status().active_core;
    
    let response = core_router.router.route_command(
        AutomationCommand::StartPlayback {
            script_path,
            speed,
            loop_count,
        },
        &app_handle,
    ).await;

    let operation_duration = start_time.elapsed();
    let success = response.is_ok() && 
        response.as_ref().unwrap().get("success").and_then(|s| s.as_bool()) == Some(true);

    // Update performance metrics
    core_router.router.update_performance_metrics(
        active_core,
        operation_duration,
        success,
    ).await;

    match response {
        Ok(resp) => {
            // Check if successful
            if resp.get("success").and_then(|s| s.as_bool()) == Some(true) {
                Ok(())
            } else {
                let error = resp
                    .get("error")
                    .and_then(|e| e.as_str())
                    .unwrap_or("Unknown error");
                Err(error.to_string())
            }
        }
        Err(e) => Err(e)
    }
}

#[tauri::command]
async fn stop_playback(
    core_router: State<'_, CoreRouterState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let start_time = std::time::Instant::now();
    let active_core = core_router.router.get_core_status().active_core;
    
    let response = core_router.router.route_command(
        AutomationCommand::StopPlayback,
        &app_handle,
    ).await;

    let operation_duration = start_time.elapsed();
    let success = response.is_ok() && 
        response.as_ref().unwrap().get("success").and_then(|s| s.as_bool()) == Some(true);

    // Update performance metrics
    core_router.router.update_performance_metrics(
        active_core,
        operation_duration,
        success,
    ).await;

    match response {
        Ok(resp) => {
            // Check if successful
            if resp.get("success").and_then(|s| s.as_bool()) == Some(true) {
                Ok(())
            } else {
                let error = resp
                    .get("error")
                    .and_then(|e| e.as_str())
                    .unwrap_or("Unknown error");
                Err(error.to_string())
            }
        }
        Err(e) => Err(e)
    }
}

#[tauri::command]
async fn pause_playback(
    core_router: State<'_, CoreRouterState>,
    app_handle: tauri::AppHandle,
) -> Result<bool, String> {
    let start_time = std::time::Instant::now();
    let active_core = core_router.router.get_core_status().active_core;
    
    let response = core_router.router.route_command(
        AutomationCommand::PausePlayback,
        &app_handle,
    ).await;

    let operation_duration = start_time.elapsed();
    let success = response.is_ok() && 
        response.as_ref().unwrap().get("success").and_then(|s| s.as_bool()) == Some(true);

    // Update performance metrics
    core_router.router.update_performance_metrics(
        active_core,
        operation_duration,
        success,
    ).await;

    match response {
        Ok(resp) => {
            // Check if successful
            if resp.get("success").and_then(|s| s.as_bool()) == Some(true) {
                let data = resp.get("data").ok_or("Missing data in response")?;
                let is_paused = data
                    .get("isPaused")
                    .and_then(|b| b.as_bool())
                    .unwrap_or(false);
                Ok(is_paused)
            } else {
                let error = resp
                    .get("error")
                    .and_then(|e| e.as_str())
                    .unwrap_or("Unknown error");
                Err(error.to_string())
            }
        }
        Err(e) => Err(e)
    }
}

#[tauri::command]
async fn check_recordings(
    core_router: State<'_, CoreRouterState>,
    app_handle: tauri::AppHandle,
) -> Result<bool, String> {
    let response = core_router.router.route_command(
        AutomationCommand::CheckRecordings,
        &app_handle,
    ).await?;

    // Check if successful
    if response.get("success").and_then(|s| s.as_bool()) == Some(true) {
        let data = response.get("data").ok_or("Missing data in response")?;
        let has_recordings = data
            .get("hasRecordings")
            .and_then(|b| b.as_bool())
            .unwrap_or(false);
        Ok(has_recordings)
    } else {
        let error = response
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("Unknown error");
        Err(error.to_string())
    }
}

#[tauri::command]
async fn get_latest(
    core_router: State<'_, CoreRouterState>,
    app_handle: tauri::AppHandle,
) -> Result<Option<String>, String> {
    let response = core_router.router.route_command(
        AutomationCommand::GetLatest,
        &app_handle,
    ).await?;

    // Check if successful
    if response.get("success").and_then(|s| s.as_bool()) == Some(true) {
        let data = response.get("data").ok_or("Missing data in response")?;
        let script_path = data
            .get("scriptPath")
            .and_then(|s| s.as_str())
            .map(String::from);
        Ok(script_path)
    } else {
        let error = response
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("Unknown error");
        Err(error.to_string())
    }
}

#[tauri::command]
async fn list_scripts(
    core_router: State<'_, CoreRouterState>,
    app_handle: tauri::AppHandle,
) -> Result<Vec<ScriptInfo>, String> {
    let response = core_router.router.route_command(
        AutomationCommand::ListScripts,
        &app_handle,
    ).await?;

    // Check if successful
    if response.get("success").and_then(|s| s.as_bool()) == Some(true) {
        let data = response.get("data").ok_or("Missing data in response")?;
        let scripts_array = data
            .get("scripts")
            .and_then(|s| s.as_array())
            .ok_or("Missing scripts array")?;

        let scripts: Vec<ScriptInfo> = scripts_array
            .iter()
            .filter_map(|s| serde_json::from_value(s.clone()).ok())
            .collect();

        Ok(scripts)
    } else {
        let error = response
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("Unknown error");
        Err(error.to_string())
    }
}

#[tauri::command]
async fn load_script(
    core_router: State<'_, CoreRouterState>,
    app_handle: tauri::AppHandle,
    script_path: String,
) -> Result<serde_json::Value, String> {
    let response = core_router.router.route_command(
        AutomationCommand::LoadScript { path: script_path },
        &app_handle,
    ).await?;

    // Check if successful
    if response.get("success").and_then(|s| s.as_bool()) == Some(true) {
        let data = response.get("data").ok_or("Missing data in response")?;
        let script = data.get("script").ok_or("Missing script in response")?;
        Ok(script.clone())
    } else {
        let error = response
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("Unknown error");
        Err(error.to_string())
    }
}

#[tauri::command]
async fn save_script(
    core_router: State<'_, CoreRouterState>,
    app_handle: tauri::AppHandle,
    script_path: String,
    script_data: serde_json::Value,
) -> Result<String, String> {
    let response = core_router.router.route_command(
        AutomationCommand::SaveScript {
            path: script_path,
            data: script_data,
        },
        &app_handle,
    ).await?;

    // Check if successful
    if response.get("success").and_then(|s| s.as_bool()) == Some(true) {
        let data = response.get("data").ok_or("Missing data in response")?;
        let saved_path = data
            .get("scriptPath")
            .and_then(|s| s.as_str())
            .ok_or("Missing scriptPath in response")?;
        Ok(saved_path.to_string())
    } else {
        let error = response
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("Unknown error");
        Err(error.to_string())
    }
}

#[tauri::command]
async fn delete_script(
    core_router: State<'_, CoreRouterState>,
    app_handle: tauri::AppHandle,
    script_path: String,
) -> Result<String, String> {
    let response = core_router.router.route_command(
        AutomationCommand::DeleteScript { path: script_path },
        &app_handle,
    ).await?;

    // Check if successful
    if response.get("success").and_then(|s| s.as_bool()) == Some(true) {
        let data = response.get("data").ok_or("Missing data in response")?;
        let deleted_path = data
            .get("deleted")
            .and_then(|s| s.as_str())
            .ok_or("Missing deleted path in response")?;
        Ok(deleted_path.to_string())
    } else {
        let error = response
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("Unknown error");
        Err(error.to_string())
    }
}

// Monitoring commands
#[tauri::command]
async fn get_health_status(
    monitor: State<'_, MonitorState>,
) -> Result<std::collections::HashMap<String, rust_automation_core::CoreHealthInfo>, String> {
    let health_status = monitor.monitor.get_health_status().await;
    
    // Convert CoreType keys to strings for JSON serialization
    let mut result = std::collections::HashMap::new();
    for (core_type, health_info) in health_status {
        let key = match core_type {
            rust_automation_core::logging::CoreType::Python => "python".to_string(),
            rust_automation_core::logging::CoreType::Rust => "rust".to_string(),
        };
        result.insert(key, health_info);
    }
    
    Ok(result)
}

#[tauri::command]
async fn get_active_alerts(
    monitor: State<'_, MonitorState>,
) -> Result<Vec<rust_automation_core::Alert>, String> {
    Ok(monitor.monitor.get_active_alerts().await)
}

#[tauri::command]
async fn get_alert_history(
    monitor: State<'_, MonitorState>,
    limit: Option<usize>,
) -> Result<Vec<rust_automation_core::Alert>, String> {
    Ok(monitor.monitor.get_alert_history(limit))
}

#[tauri::command]
async fn resolve_alert(
    monitor: State<'_, MonitorState>,
    alert_id: String,
) -> Result<(), String> {
    monitor.monitor.resolve_alert(&alert_id).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_monitoring_stats(
    monitor: State<'_, MonitorState>,
) -> Result<rust_automation_core::monitoring::MonitoringStats, String> {
    Ok(monitor.monitor.get_monitoring_stats().await)
}

fn main() {
    // Initialize logging system
    if let Err(e) = init_logging() {
        eprintln!("Failed to initialize logging: {}", e);
    }

    // Initialize monitoring system
    let monitoring_config = rust_automation_core::MonitoringConfig::default();
    let core_monitor = rust_automation_core::CoreMonitor::new(monitoring_config);
    
    // Start monitoring in background
    let monitor_clone = core_monitor.clone();
    tokio::spawn(async move {
        if let Err(e) = monitor_clone.start_monitoring().await {
            log::error!("Failed to start core monitoring: {}", e);
        }
    });

    let python_manager = Arc::new(PythonProcessManager::new());
    let core_router = CoreRouter::new(python_manager);
    
    // Initialize preferences
    if let Err(e) = core_router.initialize_preferences() {
        eprintln!("Warning: Failed to initialize preferences: {}", e);
    }
    
    let core_router_state = CoreRouterState { router: core_router };
    let monitor_state = MonitorState { monitor: core_monitor };

    tauri::Builder::default()
        .manage(core_router_state)
        .manage(monitor_state)
        .invoke_handler(tauri::generate_handler![
            // Core management commands
            select_core,
            get_available_cores,
            get_core_status,
            get_core_performance_metrics,
            get_performance_comparison,
            // Settings management commands
            get_user_settings,
            update_user_settings,
            set_playback_speed,
            set_loop_count,
            set_selected_script_path,
            set_show_preview,
            set_preview_opacity,
            // Monitoring commands
            get_health_status,
            get_active_alerts,
            get_alert_history,
            resolve_alert,
            get_monitoring_stats,
            // Automation commands (routed through CoreRouter)
            start_recording,
            stop_recording,
            start_playback,
            stop_playback,
            pause_playback,
            check_recordings,
            get_latest,
            list_scripts,
            load_script,
            save_script,
            delete_script,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Initialize the logging system
fn init_logging() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize Rust core logging
    let logging_config = rust_automation_core::LoggingConfig::default();
    rust_automation_core::init_logger(logging_config)?;

    // Initialize tracing for Tauri backend
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_target(true)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .init();

    log::info!("Logging system initialized successfully");
    Ok(())
}
