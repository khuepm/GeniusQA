// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai_test_case;
mod application_focused_automation;
mod core_router;
mod python_process;

use core_router::{AutomationCommand, CoreRouter, CoreStatus, CoreType, PerformanceComparison};
use python_process::PythonProcessManager;
use rust_automation_core::preferences::UserSettings;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::path::Path;
use tauri::{State, Manager, WindowBuilder, WindowUrl};

// Application-focused automation imports
use application_focused_automation::{
    ApplicationFocusedAutomationService, ServiceState,
    ApplicationRegistry, FocusMonitor, PlaybackController,
};
use application_focused_automation::types::{
    RegisteredApplication, ApplicationInfo, FocusLossStrategy, ApplicationStatus, 
    FocusEvent, PlaybackState, PauseReason, AutomationProgressSnapshot, 
    ErrorRecoveryStrategy, WarningEntry, FocusErrorReport
};

// Core router state wrapper
struct CoreRouterState {
    router: CoreRouter,
}

// Monitor state wrapper
struct MonitorState {
    monitor: rust_automation_core::CoreMonitor,
}

// Application-focused automation state wrapper
struct ApplicationFocusedAutomationState {
    service: Arc<ApplicationFocusedAutomationService>,
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

#[tauri::command]
async fn reveal_in_finder(script_path: String) -> Result<(), String> {
    let path = Path::new(&script_path);
    if !path.exists() {
        return Err(format!("File not found: {}", script_path));
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let status = Command::new("open")
            .args(["-R", &script_path])
            .status()
            .map_err(|e| format!("Failed to run open: {}", e))?;

        if status.success() {
            return Ok(());
        }
        return Err(format!("Failed to reveal file in Finder: exit code {:?}", status.code()));
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let status = Command::new("explorer")
            .args(["/select,", &script_path])
            .status()
            .map_err(|e| format!("Failed to run explorer: {}", e))?;

        if status.success() {
            return Ok(());
        }
        return Err(format!("Failed to reveal file in Explorer: exit code {:?}", status.code()));
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        use std::process::Command;
        let folder = path
            .parent()
            .ok_or_else(|| format!("Failed to get parent folder for: {}", script_path))?;
        let status = Command::new("xdg-open")
            .arg(folder)
            .status()
            .map_err(|e| format!("Failed to run xdg-open: {}", e))?;

        if status.success() {
            return Ok(());
        }
        return Err(format!("Failed to open folder: exit code {:?}", status.code()));
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

// ============================================================================
// Application-Focused Automation Commands
// Requirements: 1.1, 1.2, 2.1, 2.2, 4.1, 5.5
// ============================================================================

/// Get list of currently running applications available for registration
/// 
/// Requirements: 1.1 - Display list of currently running applications
#[tauri::command]
async fn get_running_applications() -> Result<Vec<ApplicationInfo>, String> {
    log::info!("[App Focus] Getting list of running applications");
    
    // TODO: This will be implemented with platform-specific code
    // For now, return a placeholder implementation
    #[cfg(target_os = "windows")]
    {
        get_running_applications_windows().await
    }
    #[cfg(target_os = "macos")]
    {
        get_running_applications_macos().await
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err("Unsupported platform for application detection".to_string())
    }
}

/// Register an application for focused automation
/// 
/// Requirements: 1.2, 1.3, 1.6 - Register application with process information and default focus strategy
#[tauri::command]
async fn register_application(
    service_state: State<'_, ApplicationFocusedAutomationState>,
    app_info: ApplicationInfo,
    default_focus_strategy: Option<FocusLossStrategy>,
) -> Result<String, String> {
    log::info!("[App Focus] Registering application: {}", app_info.name);
    
    let strategy = default_focus_strategy.unwrap_or(FocusLossStrategy::AutoPause);
    let app_id = service_state.service.register_application_with_monitoring(app_info, strategy).await
        .map_err(|e| format!("Failed to register application: {}", e))?;
    
    log::info!("[App Focus] Successfully registered application with ID: {}", app_id);
    Ok(app_id)
}

/// Unregister an application from focused automation
/// 
/// Requirements: 2.2 - Remove application from registry
#[tauri::command]
async fn unregister_application(
    service_state: State<'_, ApplicationFocusedAutomationState>,
    app_id: String,
) -> Result<(), String> {
    log::info!("[App Focus] Unregistering application: {}", app_id);
    
    service_state.service.unregister_application_with_cleanup(&app_id).await
        .map_err(|e| format!("Failed to unregister application: {}", e))?;
    
    log::info!("[App Focus] Successfully unregistered application: {}", app_id);
    Ok(())
}

/// Get all registered applications
/// 
/// Requirements: 2.1 - Show all registered applications with status
#[tauri::command]
async fn get_registered_applications(
    service_state: State<'_, ApplicationFocusedAutomationState>,
) -> Result<Vec<RegisteredApplication>, String> {
    log::info!("[App Focus] Getting registered applications");
    
    let registry = service_state.service.get_registry();
    let registry = registry.lock().map_err(|e| format!("Failed to lock registry: {}", e))?;
    
    let applications = registry.get_registered_applications();
    log::info!("[App Focus] Found {} registered applications", applications.len());
    
    Ok(applications)
}

/// Get a specific registered application by ID
/// 
/// Requirements: 2.1 - Get application details
#[tauri::command]
async fn get_application(
    service_state: State<'_, ApplicationFocusedAutomationState>,
    app_id: String,
) -> Result<Option<RegisteredApplication>, String> {
    log::info!("[App Focus] Getting application: {}", app_id);
    
    let registry = service_state.service.get_registry();
    let registry = registry.lock().map_err(|e| format!("Failed to lock registry: {}", e))?;
    
    let application = registry.get_application(&app_id).cloned();
    Ok(application)
}

/// Update application status
/// 
/// Requirements: 2.3, 2.4 - Update application status and detect inactive applications
#[tauri::command]
async fn update_application_status(
    service_state: State<'_, ApplicationFocusedAutomationState>,
    app_id: String,
    status: ApplicationStatus,
) -> Result<(), String> {
    log::info!("[App Focus] Updating application status: {} -> {:?}", app_id, status);
    
    let registry = service_state.service.get_registry();
    let mut registry = registry.lock().map_err(|e| format!("Failed to lock registry: {}", e))?;
    
    registry.update_application_status(&app_id, status)
        .map_err(|e| format!("Failed to update application status: {}", e))?;
    
    log::info!("[App Focus] Successfully updated application status");
    Ok(())
}

/// Validate application for automation
/// 
/// Requirements: 2.5 - Validate that registered applications still exist before allowing automation
#[tauri::command]
async fn validate_application_for_automation(
    service_state: State<'_, ApplicationFocusedAutomationState>,
    app_id: String,
) -> Result<bool, String> {
    log::info!("[App Focus] Validating application for automation: {}", app_id);
    
    let registry = service_state.service.get_registry();
    let registry = registry.lock().map_err(|e| format!("Failed to lock registry: {}", e))?;
    
    let is_valid = registry.validate_application_for_automation(&app_id)
        .map_err(|e| format!("Failed to validate application: {}", e))?;
    
    log::info!("[App Focus] Application validation result: {}", is_valid);
    Ok(is_valid)
}

/// Start focus monitoring for a specific application
/// 
/// Requirements: 3.1, 3.2, 3.3 - Monitor application focus and notify on changes
#[tauri::command]
async fn start_focus_monitoring(
    service_state: State<'_, ApplicationFocusedAutomationState>,
    app_id: String,
    process_id: u32,
) -> Result<(), String> {
    log::info!("[App Focus] Starting focus monitoring for app: {} (PID: {})", app_id, process_id);
    
    // Check if monitoring is already active for this app
    if let Ok(true) = service_state.service.get_focus_monitor(&app_id) {
        log::info!("[App Focus] Focus monitoring already active for app: {}", app_id);
        return Ok(());
    }
    
    // Start monitoring through the service (this will be handled by register_application_with_monitoring)
    log::info!("[App Focus] Focus monitoring managed by service for app: {}", app_id);
    Ok(())
}

/// Stop focus monitoring
/// 
/// Requirements: 3.1 - Stop monitoring when no longer needed
#[tauri::command]
async fn stop_focus_monitoring(
    service_state: State<'_, ApplicationFocusedAutomationState>,
) -> Result<(), String> {
    log::info!("[App Focus] Stopping focus monitoring");
    
    // Focus monitoring is managed by the service and will be stopped
    // when applications are unregistered or service is stopped
    log::info!("[App Focus] Focus monitoring managed by service");
    Ok(())
}

/// Get current focus state
/// 
/// Requirements: 3.5 - Get current focus state information
#[tauri::command]
async fn get_focus_state(
    service_state: State<'_, ApplicationFocusedAutomationState>,
    app_id: Option<String>,
) -> Result<Option<serde_json::Value>, String> {
    log::debug!("[App Focus] Getting current focus state");
    
    if let Some(app_id) = app_id {
        if let Ok(true) = service_state.service.get_focus_monitor(&app_id) {
            // For now, return a placeholder focus state since we changed the API
            let focus_state_json = serde_json::json!({
                "is_target_process_focused": false,
                "focused_process_id": null,
                "focused_window_title": null,
                "last_change": chrono::Utc::now().to_rfc3339(),
                "target_app_id": app_id,
                "target_process_id": null
            });
            
            Ok(Some(focus_state_json))
        } else {
            Ok(None)
        }
    } else {
        Ok(None)
    }
}

/// Start focused automation playback
/// 
/// Requirements: 4.1, 4.2, 4.3, 4.4 - Start playback with configurable focus strategy
#[tauri::command]
async fn start_focused_playback(
    service_state: State<'_, ApplicationFocusedAutomationState>,
    app_id: String,
    focus_strategy: FocusLossStrategy,
) -> Result<String, String> {
    log::info!("[App Focus] Starting focused playback for app: {} with strategy: {:?}", 
              app_id, focus_strategy);
    
    let session_id = service_state.service.start_integrated_playback(app_id.clone(), focus_strategy).await
        .map_err(|e| format!("Failed to start playback: {}", e))?;
    
    log::info!("[App Focus] Focused playback started with session ID: {}", session_id);
    Ok(session_id)
}

/// Pause focused automation playback
/// 
/// Requirements: 4.2, 4.5 - Pause automation and display notification
#[tauri::command]
async fn pause_focused_playback(
    service_state: State<'_, ApplicationFocusedAutomationState>,
    reason: PauseReason,
) -> Result<(), String> {
    log::info!("[App Focus] Pausing focused playback due to: {:?}", reason);
    
    let controller = service_state.service.get_playback_controller();
    let mut controller = controller.lock().map_err(|e| format!("Failed to lock controller: {}", e))?;
    
    controller.pause_playback(reason)
        .map_err(|e| format!("Failed to pause playback: {}", e))?;
    
    log::info!("[App Focus] Focused playback paused successfully");
    Ok(())
}

/// Resume focused automation playback
/// 
/// Requirements: 4.6, 4.7, 4.8 - Resume automation when focus returns
#[tauri::command]
async fn resume_focused_playback(
    service_state: State<'_, ApplicationFocusedAutomationState>,
) -> Result<(), String> {
    log::info!("[App Focus] Resuming focused playback");
    
    let controller = service_state.service.get_playback_controller();
    let mut controller = controller.lock().map_err(|e| format!("Failed to lock controller: {}", e))?;
    
    controller.resume_playback()
        .map_err(|e| format!("Failed to resume playback: {}", e))?;
    
    log::info!("[App Focus] Focused playback resumed successfully");
    Ok(())
}

/// Stop focused automation playback
/// 
/// Requirements: 4.1 - Stop automation session
#[tauri::command]
async fn stop_focused_playback(
    service_state: State<'_, ApplicationFocusedAutomationState>,
) -> Result<(), String> {
    log::info!("[App Focus] Stopping focused playback");
    
    let controller = service_state.service.get_playback_controller();
    let mut controller = controller.lock().map_err(|e| format!("Failed to lock controller: {}", e))?;
    
    controller.stop_playback()
        .map_err(|e| format!("Failed to stop playback: {}", e))?;
    
    log::info!("[App Focus] Focused playback stopped successfully");
    Ok(())
}

/// Get playback session status
/// 
/// Requirements: 4.8 - Maintain automation state during focus transitions
#[tauri::command]
async fn get_playback_status(
    service_state: State<'_, ApplicationFocusedAutomationState>,
) -> Result<Option<serde_json::Value>, String> {
    log::debug!("[App Focus] Getting playback status");
    
    let controller = service_state.service.get_playback_controller();
    let controller = controller.lock().map_err(|e| format!("Failed to lock controller: {}", e))?;
    
    if let Some(session) = controller.get_playback_status() {
        let status_json = serde_json::json!({
            "id": session.id,
            "target_app_id": session.target_app_id,
            "target_process_id": session.target_process_id,
            "state": session.state,
            "focus_strategy": session.focus_strategy,
            "current_step": session.current_step,
            "started_at": session.started_at.to_rfc3339(),
            "paused_at": session.paused_at.map(|t| t.to_rfc3339()),
            "resumed_at": session.resumed_at.map(|t| t.to_rfc3339()),
            "total_pause_duration": session.total_pause_duration.num_seconds()
        });
        
        Ok(Some(status_json))
    } else {
        Ok(None)
    }
}

/// Get session statistics
/// 
/// Requirements: 4.8 - Provide session information
#[tauri::command]
async fn get_session_stats(
    service_state: State<'_, ApplicationFocusedAutomationState>,
) -> Result<Option<serde_json::Value>, String> {
    log::debug!("[App Focus] Getting session statistics");
    
    let controller = service_state.service.get_playback_controller();
    let controller = controller.lock().map_err(|e| format!("Failed to lock controller: {}", e))?;
    
    if let Some(stats) = controller.get_session_stats() {
        let stats_json = serde_json::json!({
            "session_id": stats.session_id,
            "total_duration": stats.total_duration.num_seconds(),
            "active_duration": stats.active_duration.num_seconds(),
            "pause_duration": stats.pause_duration.num_seconds(),
            "current_step": stats.current_step,
            "focus_strategy": stats.focus_strategy,
            "state": stats.state
        });
        
        Ok(Some(stats_json))
    } else {
        Ok(None)
    }
}

/// Save automation progress for recovery
/// 
/// Requirements: 8.5 - Save current progress and state
#[tauri::command]
async fn save_automation_progress(
    service_state: State<'_, ApplicationFocusedAutomationState>,
) -> Result<serde_json::Value, String> {
    log::info!("[App Focus] Saving automation progress");
    
    let controller = service_state.service.get_playback_controller();
    let controller = controller.lock().map_err(|e| format!("Failed to lock controller: {}", e))?;
    
    let snapshot = controller.save_automation_progress()
        .map_err(|e| format!("Failed to save progress: {}", e))?;
    
    let snapshot_json = serde_json::json!({
        "snapshot_id": snapshot.snapshot_id,
        "session_id": snapshot.session_id,
        "target_app_id": snapshot.target_app_id,
        "target_process_id": snapshot.target_process_id,
        "current_step": snapshot.current_step,
        "session_state": snapshot.session_state,
        "focus_strategy": snapshot.focus_strategy,
        "started_at": snapshot.started_at.to_rfc3339(),
        "saved_at": snapshot.saved_at.to_rfc3339(),
        "error_context": snapshot.error_context
    });
    
    log::info!("[App Focus] Automation progress saved with snapshot ID: {}", snapshot.snapshot_id);
    Ok(snapshot_json)
}

/// Get available recovery options
/// 
/// Requirements: 8.5 - Provide recovery options during errors
#[tauri::command]
async fn get_recovery_options(
    service_state: State<'_, ApplicationFocusedAutomationState>,
) -> Result<Vec<serde_json::Value>, String> {
    log::info!("[App Focus] Getting recovery options");
    
    let controller = service_state.service.get_playback_controller();
    let controller = controller.lock().map_err(|e| format!("Failed to lock controller: {}", e))?;
    
    let options = controller.get_recovery_options()
        .map_err(|e| format!("Failed to get recovery options: {}", e))?;
    
    let options_json: Vec<serde_json::Value> = options.into_iter().map(|option| {
        serde_json::json!({
            "strategy": option,
            "description": option.description(),
            "requires_user_interaction": option.requires_user_interaction(),
            "preserves_progress": option.preserves_progress()
        })
    }).collect();
    
    log::info!("[App Focus] Found {} recovery options", options_json.len());
    Ok(options_json)
}

// ============================================================================
// Real-Time Status Updates Commands
// Requirements: 5.5 - Event streaming for focus state changes
// ============================================================================

/// Subscribe to real-time focus state updates
/// 
/// Requirements: 5.5 - Implement status broadcasting to frontend
#[tauri::command]
async fn subscribe_to_focus_updates(
    service_state: State<'_, ApplicationFocusedAutomationState>,
    app_handle: tauri::AppHandle,
    app_id: String,
) -> Result<(), String> {
    log::info!("[App Focus] Subscribing to real-time focus updates for app: {}", app_id);
    
    // Get the current focus state from the service
    let focus_state = service_state.service.get_focus_state(&app_id)
        .map_err(|e| format!("Failed to get focus state: {}", e))?;
    
    if let Some(focus_state) = focus_state {
        // Emit initial focus state
        let focus_state_json = serde_json::json!({
            "type": "focus_state_update",
            "data": {
                "is_target_process_focused": focus_state.is_target_process_focused,
                "focused_process_id": focus_state.focused_process_id,
                "focused_window_title": focus_state.focused_window_title,
                "last_change": focus_state.last_change.to_rfc3339(),
                "target_app_id": app_id,
                "target_process_id": focus_state.focused_process_id
            }
        });
            
        app_handle.emit_all("focus_state_update", focus_state_json)
            .map_err(|e| format!("Failed to emit focus state update: {}", e))?;
        
        log::info!("[App Focus] Successfully subscribed to focus updates and emitted initial state");
        Ok(())
    } else {
        // Emit a default focus state if no monitor is active
        let focus_state_json = serde_json::json!({
            "type": "focus_state_update",
            "data": {
                "is_target_process_focused": false,
                "focused_process_id": null,
                "focused_window_title": null,
                "last_change": chrono::Utc::now().to_rfc3339(),
                "target_app_id": app_id,
                "target_process_id": null
            }
        });
            
        app_handle.emit_all("focus_state_update", focus_state_json)
            .map_err(|e| format!("Failed to emit focus state update: {}", e))?;
        
        log::info!("[App Focus] Successfully subscribed to focus updates with default state");
        Ok(())
    }
}

/// Unsubscribe from real-time focus state updates
/// 
/// Requirements: 5.5 - Allow unsubscribing from updates
#[tauri::command]
async fn unsubscribe_from_focus_updates() -> Result<(), String> {
    log::info!("[App Focus] Unsubscribing from real-time focus updates");
    
    // In a full implementation, we would stop the event broadcasting
    // For now, we just log the unsubscription
    log::info!("[App Focus] Successfully unsubscribed from focus updates");
    Ok(())
}

/// Subscribe to real-time playback status updates
/// 
/// Requirements: 5.5 - Implement status broadcasting for playback state
#[tauri::command]
async fn subscribe_to_playback_updates(
    service_state: State<'_, ApplicationFocusedAutomationState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    log::info!("[App Focus] Subscribing to real-time playback updates");
    
    let controller = service_state.service.get_playback_controller();
    let controller = controller.lock().map_err(|e| format!("Failed to lock controller: {}", e))?;
    
    if controller.has_active_session() {
        // Emit initial playback status
        if let Some(session) = controller.get_playback_status() {
            let status_json = serde_json::json!({
                "type": "playback_status_update",
                "data": {
                    "id": session.id,
                    "target_app_id": session.target_app_id,
                    "target_process_id": session.target_process_id,
                    "state": session.state,
                    "focus_strategy": session.focus_strategy,
                    "current_step": session.current_step,
                    "started_at": session.started_at.to_rfc3339(),
                    "paused_at": session.paused_at.map(|t| t.to_rfc3339()),
                    "resumed_at": session.resumed_at.map(|t| t.to_rfc3339()),
                    "total_pause_duration": session.total_pause_duration.num_seconds()
                }
            });
            
            app_handle.emit_all("playback_status_update", status_json)
                .map_err(|e| format!("Failed to emit playback status update: {}", e))?;
        }
        
        log::info!("[App Focus] Successfully subscribed to playback updates with active session");
        Ok(())
    } else {
        // Emit a null status to indicate no active session
        let status_json = serde_json::json!({
            "type": "playback_status_update",
            "data": null
        });
        
        app_handle.emit_all("playback_status_update", status_json)
            .map_err(|e| format!("Failed to emit playback status update: {}", e))?;
        
        log::info!("[App Focus] Successfully subscribed to playback updates with no active session");
        Ok(())
    }
}

/// Unsubscribe from real-time playback status updates
/// 
/// Requirements: 5.5 - Allow unsubscribing from playback updates
#[tauri::command]
async fn unsubscribe_from_playback_updates() -> Result<(), String> {
    log::info!("[App Focus] Unsubscribing from real-time playback updates");
    
    // In a full implementation, we would stop the event broadcasting
    // For now, we just log the unsubscription
    log::info!("[App Focus] Successfully unsubscribed from playback updates");
    Ok(())
}

/// Broadcast focus event to frontend
/// 
/// Requirements: 5.5 - Real-time event streaming
#[tauri::command]
async fn broadcast_focus_event(
    app_handle: tauri::AppHandle,
    event_type: String,
    event_data: serde_json::Value,
) -> Result<(), String> {
    log::debug!("[App Focus] Broadcasting focus event: {}", event_type);
    
    let event_payload = serde_json::json!({
        "type": event_type,
        "data": event_data,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    app_handle.emit_all("focus_event", event_payload)
        .map_err(|e| format!("Failed to broadcast focus event: {}", e))?;
    
    Ok(())
}

/// Get real-time status summary
/// 
/// Requirements: 5.5 - Provide comprehensive status information
#[tauri::command]
async fn get_realtime_status_summary(
    service_state: State<'_, ApplicationFocusedAutomationState>,
) -> Result<serde_json::Value, String> {
    log::debug!("[App Focus] Getting real-time status summary");
    
    // Get service stats
    let service_stats = service_state.service.get_stats().map_err(|e| format!("Failed to get service stats: {}", e))?;
    
    // Get registry status
    let registry_status = {
        let registry = service_state.service.get_registry();
        let registry = registry.lock().map_err(|e| format!("Failed to lock registry: {}", e))?;
        let applications = registry.get_registered_applications();
        serde_json::json!({
            "total_applications": applications.len(),
            "active_applications": applications.iter().filter(|app| app.status == ApplicationStatus::Active).count(),
            "inactive_applications": applications.iter().filter(|app| app.status == ApplicationStatus::Inactive).count()
        })
    };
    
    // Get focus monitor status (aggregate from all monitors)
    let focus_status = serde_json::json!({
        "is_monitoring": service_stats.registered_applications > 0,
        "total_monitors": service_stats.registered_applications,
        "service_state": service_stats.state
    });
    
    // Get playback controller status
    let playback_status = {
        let controller = service_state.service.get_playback_controller();
        let controller = controller.lock().map_err(|e| format!("Failed to lock controller: {}", e))?;
        if let Some(session) = controller.get_playback_status() {
            serde_json::json!({
                "has_active_session": true,
                "session_id": session.id,
                "target_app_id": session.target_app_id,
                "state": session.state,
                "focus_strategy": session.focus_strategy,
                "current_step": session.current_step
            })
        } else {
            serde_json::json!({
                "has_active_session": false,
                "session_id": null,
                "target_app_id": null,
                "state": null,
                "focus_strategy": null,
                "current_step": null
            })
        }
    };
    
    let summary = serde_json::json!({
        "service": {
            "state": service_stats.state,
            "uptime_seconds": service_stats.uptime_seconds,
            "total_focus_events": service_stats.total_focus_events,
            "total_playback_sessions": service_stats.total_playback_sessions,
            "last_error": service_stats.last_error
        },
        "registry": registry_status,
        "focus_monitor": focus_status,
        "playback_controller": playback_status,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    Ok(summary)
}

/// Get service health status
/// 
/// Requirements: Service lifecycle management
#[tauri::command]
async fn get_service_health(
    service_state: State<'_, ApplicationFocusedAutomationState>,
) -> Result<serde_json::Value, String> {
    log::debug!("[App Focus] Getting service health status");
    
    let health = service_state.service.health_check().await.map_err(|e| format!("Failed to perform health check: {}", e))?;
    let is_healthy = service_state.service.is_healthy();
    let state = service_state.service.get_state().map_err(|e| format!("Failed to get service state: {}", e))?;
    
    let health_json = serde_json::json!({
        "is_healthy": is_healthy,
        "state": state,
        "components": health,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    Ok(health_json)
}

/// Get service statistics
/// 
/// Requirements: Service lifecycle management
#[tauri::command]
async fn get_service_stats(
    service_state: State<'_, ApplicationFocusedAutomationState>,
) -> Result<serde_json::Value, String> {
    log::debug!("[App Focus] Getting service statistics");
    
    let stats = service_state.service.get_stats().map_err(|e| format!("Failed to get service stats: {}", e))?;
    
    let stats_json = serde_json::json!({
        "state": stats.state,
        "uptime_seconds": stats.uptime_seconds,
        "registered_applications": stats.registered_applications,
        "active_sessions": stats.active_sessions,
        "total_focus_events": stats.total_focus_events,
        "total_playback_sessions": stats.total_playback_sessions,
        "last_error": stats.last_error,
        "started_at": stats.started_at.map(|t| t.to_rfc3339())
    });
    
    Ok(stats_json)
}

/// Restart the service
/// 
/// Requirements: Service lifecycle management
#[tauri::command]
async fn restart_service(
    service_state: State<'_, ApplicationFocusedAutomationState>,
) -> Result<(), String> {
    log::info!("[App Focus] Restarting Application-Focused Automation service");
    
    // Stop the service
    service_state.service.stop().await.map_err(|e| format!("Failed to stop service: {}", e))?;
    
    // Start the service
    service_state.service.start().await.map_err(|e| format!("Failed to start service: {}", e))?;
    
    log::info!("[App Focus] Service restarted successfully");
    Ok(())
}

/// Update application focus configuration
/// 
/// Requirements: Configuration management for onboarding
#[tauri::command]
async fn update_application_focus_config(
    service_state: State<'_, ApplicationFocusedAutomationState>,
    config: serde_json::Value,
) -> Result<(), String> {
    log::info!("[App Focus] Updating application focus configuration");
    
    // For now, just log the configuration update
    // In a full implementation, this would update the service configuration
    log::info!("[App Focus] Configuration update: {:?}", config);
    
    // TODO: Implement actual configuration update
    // This would involve updating the ApplicationFocusConfig and persisting it
    
    Ok(())
}

/// Open system settings for accessibility permissions (macOS)
/// 
/// Requirements: Platform-specific permission guidance
#[cfg(target_os = "macos")]
#[tauri::command]
async fn open_accessibility_settings() -> Result<(), String> {
    use std::process::Command;
    
    log::info!("[App Focus] Opening macOS accessibility settings");
    
    let output = Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .output()
        .map_err(|e| format!("Failed to open accessibility settings: {}", e))?;
    
    if !output.status.success() {
        return Err("Failed to open accessibility settings".to_string());
    }
    
    Ok(())
}

/// Open system settings (MacOS)
/// 
/// Requirements: Platform-specific permission guidance
#[cfg(target_os = "macos")]
#[tauri::command]
async fn open_system_settings() -> Result<(), String> {
    use std::process::Command;
    
    log::info!("[App Focus] Opening macOS system settings");
    
    // Open the main System Settings/Preferences window
    let output = Command::new("open")
        .arg("x-apple.systempreferences:")
        .output()
        .map_err(|e| format!("Failed to open system settings: {}", e))?;
    
    if !output.status.success() {
        return Err("Failed to open system settings".to_string());
    }
    
    Ok(())
}

/// Open system settings (Windows)
/// 
/// Requirements: Platform-specific permission guidance
#[cfg(target_os = "windows")]
#[tauri::command]
async fn open_system_settings() -> Result<(), String> {
    use std::process::Command;
    
    log::info!("[App Focus] Opening Windows system settings");
    
    let output = Command::new("ms-settings:")
        .output()
        .map_err(|e| format!("Failed to open system settings: {}", e))?;
    
    if !output.status.success() {
        return Err("Failed to open system settings".to_string());
    }
    
    Ok(())
}

/// Fallback for other platforms
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
#[tauri::command]
async fn open_accessibility_settings() -> Result<(), String> {
    log::warn!("[App Focus] Opening accessibility settings not supported on this platform");
    Err("Opening accessibility settings not supported on this platform".to_string())
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
#[tauri::command]
async fn open_system_settings() -> Result<(), String> {
    log::warn!("[App Focus] Opening system settings not supported on this platform");
    Err("Opening system settings not supported on this platform".to_string())
}

// Platform-specific helper functions (placeholders for now)

#[cfg(target_os = "windows")]
async fn get_running_applications_windows() -> Result<Vec<ApplicationInfo>, String> {
    // TODO: Implement Windows-specific application enumeration
    log::warn!("[App Focus] Windows application enumeration not yet implemented");
    Ok(vec![
        ApplicationInfo {
            name: "Notepad".to_string(),
            executable_path: "C:\\Windows\\System32\\notepad.exe".to_string(),
            process_name: "notepad.exe".to_string(),
            process_id: 1234,
            bundle_id: None,
            window_handle: None,
        }
    ])
}

#[cfg(target_os = "macos")]

//TODO: This feature not working well, need to fix
async fn get_running_applications_macos() -> Result<Vec<ApplicationInfo>, String> {
    use application_focused_automation::MacOSApplicationDetector;
    use application_focused_automation::platform::PlatformApplicationDetector;

    let detector = MacOSApplicationDetector::new();
    detector.get_running_applications()
        .map_err(|e| format!("Failed to get running applications: {:?}", e))
}

// ============================================================================
// AI Vision Capture Commands
// Requirements: 1.1, 3.3, 4.9
// ============================================================================

/// AI Vision Request structure for analyze_vision command
#[derive(Debug, Serialize, Deserialize)]
struct AIVisionRequest {
    screenshot: String,
    prompt: String,
    reference_images: Vec<String>,
    roi: Option<VisionROI>,
}

/// Vision Region of Interest
#[derive(Debug, Serialize, Deserialize)]
struct VisionROI {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

/// AI Vision Response structure
#[derive(Debug, Serialize, Deserialize)]
struct AIVisionResponse {
    success: bool,
    x: Option<i32>,
    y: Option<i32>,
    confidence: Option<f64>,
    error: Option<String>,
}

/// Cache data for vision actions
#[derive(Debug, Serialize, Deserialize)]
struct CacheData {
    cached_x: Option<i32>,
    cached_y: Option<i32>,
    cache_dim: Option<[i32; 2]>,
}

/// Capture a vision marker during recording
/// 
/// This command is a placeholder that returns an error since vision marker
/// capture is handled by the Rust recorder module directly via hotkey detection.
/// The UI should not call this directly during recording.
/// 
/// Requirements: 1.1, 1.2, 1.4
#[tauri::command]
async fn capture_vision_marker() -> Result<serde_json::Value, String> {
    // Vision marker capture is handled by the recorder module via hotkey
    // This command is provided for manual triggering from UI if needed
    Err("Vision marker capture is handled automatically by the recorder via Cmd+F6/Ctrl+F6 hotkey. Use the hotkey during recording to capture vision markers.".to_string())
}

/// Analyze a screenshot using AI Vision service
/// 
/// This command is a placeholder - the actual AI analysis is performed
/// by the frontend AIVisionService since it requires API key management
/// and network calls that are better handled in the frontend.
/// 
/// Requirements: 3.3, 4.6, 4.8, 4.10
#[tauri::command]
async fn analyze_vision(request: AIVisionRequest) -> Result<AIVisionResponse, String> {
    // AI analysis is performed by the frontend AIVisionService
    // This command exists for potential future backend AI integration
    log::info!(
        "[AI Vision] analyze_vision called with prompt: {}",
        request.prompt.chars().take(50).collect::<String>()
    );
    
    // Return error indicating frontend should handle this
    Ok(AIVisionResponse {
        success: false,
        x: None,
        y: None,
        confidence: None,
        error: Some("AI analysis should be performed via frontend AIVisionService. This backend command is reserved for future use.".to_string()),
    })
}

/// Update vision cache data in a script file
/// 
/// Persists cache_data (cached_x, cached_y, cache_dim) for an ai_vision_capture
/// action to the script file.
/// 
/// Requirements: 4.9, 5.8
#[tauri::command]
async fn update_vision_cache(
    script_path: String,
    action_id: String,
    cache_data: CacheData,
) -> Result<(), String> {
    log::info!(
        "[AI Vision] update_vision_cache called for action {} in {}",
        action_id,
        script_path
    );
    
    // Read the script file
    let script_content = std::fs::read_to_string(&script_path)
        .map_err(|e| format!("Failed to read script file: {}", e))?;
    
    // Parse as JSON
    let mut script: serde_json::Value = serde_json::from_str(&script_content)
        .map_err(|e| format!("Failed to parse script JSON: {}", e))?;
    
    // Find and update the action with matching ID
    let actions = script
        .get_mut("actions")
        .and_then(|a| a.as_array_mut())
        .ok_or("Script does not contain actions array")?;
    
    let mut found = false;
    for action in actions.iter_mut() {
        if action.get("id").and_then(|id| id.as_str()) == Some(&action_id) {
            if action.get("type").and_then(|t| t.as_str()) == Some("ai_vision_capture") {
                // Update cache_data
                action["cache_data"] = serde_json::json!({
                    "cached_x": cache_data.cached_x,
                    "cached_y": cache_data.cached_y,
                    "cache_dim": cache_data.cache_dim,
                });
                found = true;
                log::info!(
                    "[AI Vision] Updated cache_data for action {}: cached_x={:?}, cached_y={:?}",
                    action_id,
                    cache_data.cached_x,
                    cache_data.cached_y
                );
                break;
            }
        }
    }
    
    if !found {
        return Err(format!(
            "Action with ID {} not found or is not an ai_vision_capture action",
            action_id
        ));
    }
    
    // Write back to file
    let updated_content = serde_json::to_string_pretty(&script)
        .map_err(|e| format!("Failed to serialize script: {}", e))?;
    
    std::fs::write(&script_path, updated_content)
        .map_err(|e| format!("Failed to write script file: {}", e))?;
    
    log::info!("[AI Vision] Successfully updated vision cache in {}", script_path);
    Ok(())
}

/// Get current screen dimensions
/// 
/// Returns the current screen width and height as [width, height].
/// 
/// Requirements: 4.4, 4.5
#[tauri::command]
async fn get_screen_dimensions() -> Result<[i32; 2], String> {
    // Use platform automation to get screen dimensions
    use rust_automation_core::platform::create_platform_automation;
    
    let platform = create_platform_automation()
        .map_err(|e| format!("Failed to create platform automation: {}", e))?;
    
    match platform.get_screen_size() {
        Ok((width, height)) => {
            log::info!("[AI Vision] Screen dimensions: {}x{}", width, height);
            Ok([width as i32, height as i32])
        }
        Err(e) => {
            log::error!("[AI Vision] Failed to get screen dimensions: {}", e);
            Err(format!("Failed to get screen dimensions: {}", e))
        }
    }
}

/// Capture current screen screenshot
/// 
/// Captures a screenshot of the current screen and returns it as base64.
/// 
/// Requirements: 4.6
#[tauri::command]
async fn capture_screenshot() -> Result<String, String> {
    // Use platform automation to capture screenshot
    use rust_automation_core::platform::create_platform_automation;
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    
    let platform = create_platform_automation()
        .map_err(|e| format!("Failed to create platform automation: {}", e))?;
    
    match platform.take_screenshot() {
        Ok(screenshot_data) => {
            log::info!("[AI Vision] Screenshot captured successfully ({} bytes)", screenshot_data.len());
            Ok(STANDARD.encode(&screenshot_data))
        }
        Err(e) => {
            let err_string = format!("{}", e);

            #[cfg(target_os = "macos")]
            {
                let lower = err_string.to_lowercase();
                if lower.contains("not yet implemented") || lower.contains("not implemented") {
                    match capture_screenshot_macos_fallback() {
                        Ok(bytes) => {
                            log::info!("[AI Vision] Screenshot captured via macOS fallback ({} bytes)", bytes.len());
                            return Ok(STANDARD.encode(&bytes));
                        }
                        Err(fallback_err) => {
                            log::error!("[AI Vision] macOS screenshot fallback failed: {}", fallback_err);
                        }
                    }
                }
            }

            log::error!("[AI Vision] Failed to capture screenshot: {}", err_string);
            Err(format!("Failed to capture screenshot: {}", err_string))
        }
    }
}

#[cfg(target_os = "macos")]
fn capture_screenshot_macos_fallback() -> Result<Vec<u8>, String> {
    use std::process::Command;
    use std::time::{SystemTime, UNIX_EPOCH};

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Failed to read system time: {}", e))?
        .as_nanos();

    let path = std::env::temp_dir().join(format!(
        "geniusqa_screenshot_{}_{}.png",
        std::process::id(),
        nanos
    ));

    let path_str = path
        .to_str()
        .ok_or_else(|| "Failed to build temp screenshot path".to_string())?
        .to_string();

    let status = Command::new("screencapture")
        .args(["-x", "-t", "png", &path_str])
        .status()
        .map_err(|e| format!("Failed to run screencapture: {}", e))?;

    if !status.success() {
        return Err(format!("screencapture failed with status: {}", status));
    }

    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read screenshot file: {}", e))?;
    let _ = std::fs::remove_file(&path);
    Ok(bytes)
}

/// Save an asset file (e.g., reference image)
/// 
/// Saves binary data (base64 encoded) to the specified path.
/// Creates parent directories if they don't exist.
/// 
/// Requirements: 5.5, 2.6
#[tauri::command]
async fn save_asset(asset_path: String, base64_data: String) -> Result<(), String> {
    log::info!("[Asset Manager] Saving asset to: {}", asset_path);
    
    // Decode base64
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let data = STANDARD.decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64 data: {}", e))?;
    
    // Create parent directories if needed
    if let Some(parent) = Path::new(&asset_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create asset directory: {}", e))?;
    }
    
    // Write file
    std::fs::write(&asset_path, data)
        .map_err(|e| format!("Failed to write asset file: {}", e))?;
    
    log::info!("[Asset Manager] Asset saved successfully: {}", asset_path);
    Ok(())
}

/// Load an asset file (e.g., reference image)
/// 
/// Loads binary data from the specified path and returns it as base64.
/// 
/// Requirements: 5.10
#[tauri::command]
async fn load_asset(asset_path: String) -> Result<String, String> {
    log::info!("[Asset Manager] Loading asset from: {}", asset_path);
    
    // Read file
    let data = std::fs::read(&asset_path)
        .map_err(|e| format!("Failed to read asset file: {}", e))?;
    
    // Encode to base64
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let base64_data = STANDARD.encode(&data);
    
    log::info!("[Asset Manager] Asset loaded successfully: {}", asset_path);
    Ok(base64_data)
}

/// Delete an asset file (e.g., reference image)
/// 
/// Permanently deletes the asset file at the specified path.
/// 
/// Requirements: 2.6
#[tauri::command]
async fn delete_asset(asset_path: String) -> Result<(), String> {
    log::info!("[Asset Manager] Deleting asset: {}", asset_path);
    
    // Delete file
    std::fs::remove_file(&asset_path)
        .map_err(|e| format!("Failed to delete asset file: {}", e))?;
    
    log::info!("[Asset Manager] Asset deleted successfully: {}", asset_path);
    Ok(())
}

// ============================================================================
// Click Cursor Overlay Window Commands
// ============================================================================

/// HTML content for the overlay window
const OVERLAY_HTML: &str = r#"
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; }
    html, body { width: 100vw; height: 100vh; background: transparent; overflow: hidden; }
    .cursor { position: absolute; transform: translate(-50%, -50%); pointer-events: none; }
    .cursor img { width: 48px; height: 48px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
    .ripple { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 20px; height: 20px; border-radius: 50%; border: 2px solid rgba(66,133,244,0.8);
      background: rgba(66,133,244,0.2); animation: ripple 0.6s ease-out forwards; }
    @keyframes ripple { to { width: 80px; height: 80px; opacity: 0; } }
    @keyframes fadeout { to { opacity: 0; } }
  </style>
</head>
<body>
  <div id="c"></div>
  <script>
    const { listen } = window.__TAURI__.event;
    listen('show_cursor', e => {
      const d = document.createElement('div');
      d.className = 'cursor';
      d.style.left = e.payload.x + 'px';
      d.style.top = e.payload.y + 'px';
      d.innerHTML = '<img src="https://raw.githubusercontent.com/nickvdyck/cursor-icons/master/icons/cursor-48.png"><div class="ripple"></div>';
      document.getElementById('c').appendChild(d);
      setTimeout(() => d.style.animation = 'fadeout 0.3s forwards', 500);
      setTimeout(() => d.remove(), 800);
    });
  </script>
</body>
</html>
"#;

/// Create a fullscreen transparent overlay window for showing click cursors
#[tauri::command]
async fn create_click_overlay(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Check if overlay already exists
    if app_handle.get_window("click_overlay").is_some() {
        log::info!("[Click Overlay] Overlay window already exists");
        return Ok(());
    }

    log::info!("[Click Overlay] Creating fullscreen overlay window...");

    // Use data URL for the overlay content
    let data_url = format!("data:text/html,{}", urlencoding::encode(OVERLAY_HTML));

    // Create a new fullscreen, click-through window
    // Note: transparent windows need special handling per platform
    let overlay_window = WindowBuilder::new(
        &app_handle,
        "click_overlay",
        WindowUrl::External(data_url.parse().unwrap())
    )
    .title("Click Overlay")
    .fullscreen(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .focused(false)
    .build()
    .map_err(|e| format!("Failed to create overlay window: {}", e))?;

    // On macOS, set the window to ignore mouse events
    #[cfg(target_os = "macos")]
    {
        use cocoa::appkit::NSWindow;
        use cocoa::base::id;
        
        if let Ok(ns_window) = overlay_window.ns_window() {
            unsafe {
                let ns_win: id = ns_window as id;
                ns_win.setIgnoresMouseEvents_(true);
            }
        }
    }

    log::info!("[Click Overlay] Overlay window created successfully");
    Ok(())
}

/// Close the click overlay window
#[tauri::command]
async fn close_click_overlay(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_window("click_overlay") {
        log::info!("[Click Overlay] Closing overlay window...");
        window.close().map_err(|e| format!("Failed to close overlay window: {}", e))?;
        log::info!("[Click Overlay] Overlay window closed");
    }
    Ok(())
}

/// Show a click cursor at the specified position
#[tauri::command]
async fn show_click_cursor(app_handle: tauri::AppHandle, x: i32, y: i32, button: String) -> Result<(), String> {
    if let Some(window) = app_handle.get_window("click_overlay") {
        // Emit event to the overlay window
        window.emit("show_cursor", serde_json::json!({
            "x": x,
            "y": y,
            "button": button
        })).map_err(|e| format!("Failed to emit show_cursor event: {}", e))?;
    }
    Ok(())
}

// Platform and permission commands
#[tauri::command]
async fn get_platform_info() -> Result<String, String> {
    Ok(std::env::consts::OS.to_string())
}

#[cfg(target_os = "macos")]
#[tauri::command]
async fn check_accessibility_permissions() -> Result<bool, String> {
    use std::process::Command;
    
    // Check if accessibility permissions are granted using AppleScript
    let output = Command::new("osascript")
        .arg("-e")
        .arg("tell application \"System Events\" to return true")
        .output()
        .map_err(|e| format!("Failed to check accessibility permissions: {}", e))?;
    
    Ok(output.status.success())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
async fn check_accessibility_permissions() -> Result<bool, String> {
    // On non-macOS platforms, assume permissions are available
    Ok(true)
}

#[cfg(target_os = "macos")]
#[tauri::command]
async fn request_accessibility_permissions() -> Result<(), String> {
    use std::process::Command;
    
    // Open System Settings to Privacy & Security > Accessibility
    let _ = Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .spawn()
        .map_err(|e| format!("Failed to open system settings: {}", e))?;
    
    Ok(())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
async fn request_accessibility_permissions() -> Result<(), String> {
    // On non-macOS platforms, no action needed
    Ok(())
}

fn main() {
    // Initialize logging system
    if let Err(e) = init_logging() {
        eprintln!("Failed to initialize logging: {}", e);
    }

    // Initialize monitoring system
    let monitoring_config = rust_automation_core::MonitoringConfig::default();
    let core_monitor = rust_automation_core::CoreMonitor::new(monitoring_config);

    let python_manager = Arc::new(PythonProcessManager::new());
    let core_router = CoreRouter::new(python_manager);
    
    // Initialize preferences
    if let Err(e) = core_router.initialize_preferences() {
        eprintln!("Warning: Failed to initialize preferences: {}", e);
    }
    
    let core_router_state = CoreRouterState { router: core_router };
    let monitor_state = MonitorState { monitor: core_monitor.clone() };

    // Initialize AI Test Case service
    let ai_service_state = match ai_test_case::AIServiceState::new() {
        Ok(state) => state,
        Err(e) => {
            eprintln!("Warning: Failed to initialize AI Test Case service: {}", e);
            // Create a minimal state that will return errors for all operations
            ai_test_case::AIServiceState::new().unwrap_or_else(|_| {
                panic!("Failed to create AI service state")
            })
        }
    };

    // Initialize Application-Focused Automation service
    let application_focused_automation_service = match ApplicationFocusedAutomationService::new() {
        Ok(service) => service,
        Err(e) => {
            eprintln!("Warning: Failed to initialize Application-Focused Automation service: {}", e);
            // Create a default service that will return errors for operations
            ApplicationFocusedAutomationService::default()
        }
    };
    
    let application_focused_automation_state = ApplicationFocusedAutomationState {
        service: Arc::new(application_focused_automation_service),
    };

    tauri::Builder::default()
        .manage(core_router_state)
        .manage(monitor_state)
        .manage(ai_service_state)
        .manage(application_focused_automation_state)
        .setup(move |app| {
            let app_handle = app.handle();
            
            // Start monitoring in background after Tauri runtime is initialized
            tauri::async_runtime::spawn(async move {
                if let Err(e) = core_monitor.start_monitoring().await {
                    log::error!("Failed to start core monitoring: {}", e);
                }
            });
            
            // Start Application-Focused Automation service
            let app_handle_clone = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                // Get the service from app state
                if let Some(service_state) = app_handle_clone.try_state::<ApplicationFocusedAutomationState>() {
                    // Set the app handle for real-time events
                    if let Err(e) = service_state.service.set_app_handle(app_handle_clone.clone()) {
                        log::error!("Failed to set app handle for Application-Focused Automation service: {}", e);
                    }
                    
                    if let Err(e) = service_state.service.start().await {
                        log::error!("Failed to start Application-Focused Automation service: {}", e);
                    } else {
                        log::info!("Application-Focused Automation service started successfully");
                    }
                }
            });
            
            Ok(())
        })
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
            reveal_in_finder,
            // Application-Focused Automation commands
            get_running_applications,
            register_application,
            unregister_application,
            get_registered_applications,
            get_application,
            update_application_status,
            validate_application_for_automation,
            start_focus_monitoring,
            stop_focus_monitoring,
            get_focus_state,
            start_focused_playback,
            pause_focused_playback,
            resume_focused_playback,
            stop_focused_playback,
            get_playback_status,
            get_session_stats,
            save_automation_progress,
            get_recovery_options,
            // Real-time status update commands
            subscribe_to_focus_updates,
            unsubscribe_from_focus_updates,
            subscribe_to_playback_updates,
            unsubscribe_from_playback_updates,
            broadcast_focus_event,
            get_realtime_status_summary,
            // Service management commands
            get_service_health,
            get_service_stats,
            restart_service,
            update_application_focus_config,
            open_accessibility_settings,
            open_system_settings,
            // AI Vision Capture commands
            capture_vision_marker,
            analyze_vision,
            update_vision_cache,
            get_screen_dimensions,
            capture_screenshot,
            // Asset management commands
            save_asset,
            load_asset,
            delete_asset,
            // Click overlay commands
            create_click_overlay,
            close_click_overlay,
            show_click_cursor,
            // AI Test Case Generator commands
            ai_test_case::commands::generate_test_cases_from_requirements,
            ai_test_case::commands::generate_documentation_from_actions,
            ai_test_case::commands::configure_api_key,
            ai_test_case::commands::validate_api_key,
            ai_test_case::commands::check_api_key_configured,
            ai_test_case::commands::remove_api_key,
            ai_test_case::commands::get_generation_preferences,
            ai_test_case::commands::update_generation_preferences,
            ai_test_case::commands::reset_generation_preferences,
            // AI Test Case Monitoring commands
            ai_test_case::commands::get_performance_stats,
            ai_test_case::commands::get_token_usage_stats,
            ai_test_case::commands::get_usage_patterns,
            ai_test_case::commands::calculate_cost_estimation,
            ai_test_case::commands::get_recent_errors,
            // Platform and permission commands
            get_platform_info,
            check_accessibility_permissions,
            request_accessibility_permissions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Initialize the logging system
fn init_logging() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing for Tauri backend (only once)
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"))
        )
        .with_target(true)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .try_init()
        .ok(); // Ignore error if already initialized

    // Initialize Rust core logging (without tracing subscriber)
    let logging_config = rust_automation_core::LoggingConfig::default();
    rust_automation_core::init_logger(logging_config)?;

    log::info!("Logging system initialized successfully");
    Ok(())
}
