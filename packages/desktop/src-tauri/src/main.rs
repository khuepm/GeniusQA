// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod core_router;
mod python_process;

use core_router::{AutomationCommand, CoreRouter, CoreStatus, CoreType, PerformanceComparison};
use python_process::PythonProcessManager;
use rust_automation_core::preferences::UserSettings;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::path::Path;
use tauri::{State, Manager, WindowBuilder, WindowUrl};

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
            log::error!("[AI Vision] Failed to capture screenshot: {}", e);
            Err(format!("Failed to capture screenshot: {}", e))
        }
    }
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

    tauri::Builder::default()
        .manage(core_router_state)
        .manage(monitor_state)
        .setup(move |_app| {
            // Start monitoring in background after Tauri runtime is initialized
            tauri::async_runtime::spawn(async move {
                if let Err(e) = core_monitor.start_monitoring().await {
                    log::error!("Failed to start core monitoring: {}", e);
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
