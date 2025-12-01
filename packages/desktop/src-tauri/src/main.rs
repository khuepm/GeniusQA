// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStderr, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{Manager, State};

// Python process manager to maintain a single long-lived Python process
struct PythonProcessManager {
    process: Arc<Mutex<Option<PythonProcess>>>,
}

struct PythonProcess {
    _child: Child,
    stdin: Arc<Mutex<ChildStdin>>,
    stdout_reader: Arc<Mutex<BufReader<ChildStdout>>>,
    _stderr_thread: thread::JoinHandle<()>,
}

impl PythonProcessManager {
    fn new() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
        }
    }

    fn ensure_process_running(&self, app_handle: tauri::AppHandle) -> Result<(), String> {
        let mut process_guard = self.process.lock().unwrap();
        
        if process_guard.is_none() {
            // Spawn new Python process
            let python_process = Self::spawn_python_process(app_handle)?;
            *process_guard = Some(python_process);
        }
        
        Ok(())
    }

    fn spawn_python_process(app_handle: tauri::AppHandle) -> Result<PythonProcess, String> {
        // Determine Python command (try python3 first, then python)
        let python_cmd = if cfg!(target_os = "windows") {
            "python"
        } else {
            "python3"
        };

        // Get the path to the Python core package
        // In development, it's at packages/python-core
        // In production, it should be bundled with the app
        let python_core_path = if cfg!(debug_assertions) {
            // Development mode - use relative path
            std::env::current_dir()
                .map_err(|e| format!("Failed to get current directory: {}", e))?
                .join("../../python-core/src")
        } else {
            // Production mode - use bundled resources
            app_handle
                .path_resolver()
                .resource_dir()
                .ok_or_else(|| "Failed to resolve resource directory".to_string())?
                .join("python-core/src")
        };

        // Spawn Python process with stdin/stdout/stderr pipes
        let mut child = Command::new(python_cmd)
            .arg("-u") // Unbuffered output
            .arg("__main__.py")
            .current_dir(&python_core_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn Python process: {}. Make sure Python 3.9+ is installed.", e))?;

        // Take ownership of stdin, stdout, and stderr
        let stdin = child.stdin.take().ok_or("Failed to get stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to get stderr")?;
        
        let stdin = Arc::new(Mutex::new(stdin));
        let stdout_reader = Arc::new(Mutex::new(BufReader::new(stdout)));

        // Spawn a thread to read and log stderr
        let stderr_thread = thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    eprintln!("[Python stderr] {}", line);
                }
            }
        });

        Ok(PythonProcess { 
            _child: child,
            stdin,
            stdout_reader,
            _stderr_thread: stderr_thread,
        })
    }

    fn send_command(&self, command: &str, params: serde_json::Value, app_handle: &tauri::AppHandle) -> Result<serde_json::Value, String> {
        let process_guard = self.process.lock().unwrap();
        
        let process = process_guard
            .as_ref()
            .ok_or_else(|| "Python process not running".to_string())?;

        // Create command message
        let message = serde_json::json!({
            "command": command,
            "params": params
        });

        // Send command to Python stdin
        let mut stdin = process.stdin.lock().unwrap();
        let message_str = serde_json::to_string(&message)
            .map_err(|e| format!("Failed to serialize command: {}", e))?;

        writeln!(stdin, "{}", message_str)
            .map_err(|e| format!("Failed to write to Python stdin: {}", e))?;

        stdin
            .flush()
            .map_err(|e| format!("Failed to flush Python stdin: {}", e))?;

        drop(stdin);

        // Read response from Python stdout
        let mut stdout_reader = process.stdout_reader.lock().unwrap();
        let mut response_line = String::new();

        // Read lines until we get a response (not an event)
        loop {
            response_line.clear();
            stdout_reader
                .read_line(&mut response_line)
                .map_err(|e| format!("Failed to read from Python stdout: {}", e))?;

            if response_line.is_empty() {
                return Err("Python process closed stdout".to_string());
            }

            // Try to parse the line
            let parsed: serde_json::Value = serde_json::from_str(&response_line)
                .map_err(|e| format!("Failed to parse Python output: {}", e))?;

            // Log the parsed message for debugging
            eprintln!("[Python stdout] {}", response_line.trim());

            // Check if this is an event or a response
            if let Some(event_type) = parsed.get("type").and_then(|t| t.as_str()) {
                // This is an event, emit it to frontend
                if let Some(data) = parsed.get("data") {
                    let _ = app_handle.emit_all(event_type, data);
                }
                continue;
            } else if parsed.get("success").is_some() {
                // This is a response
                return Ok(parsed);
            } else {
                return Err(format!("Unexpected message format: {}", response_line));
            }
        }
    }
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

// Tauri commands
#[tauri::command]
async fn start_recording(
    process_manager: State<'_, PythonProcessManager>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Ensure Python process is running
    process_manager.ensure_process_running(app_handle.clone())?;

    // Send start_recording command
    let response = process_manager.send_command("start_recording", serde_json::json!({}), &app_handle)?;

    // Check if successful
    if response.get("success").and_then(|s| s.as_bool()) == Some(true) {
        Ok(())
    } else {
        let error = response
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("Unknown error");
        Err(error.to_string())
    }
}

#[tauri::command]
async fn stop_recording(
    process_manager: State<'_, PythonProcessManager>,
    app_handle: tauri::AppHandle,
) -> Result<RecordingResult, String> {
    // Send stop_recording command
    let response = process_manager.send_command("stop_recording", serde_json::json!({}), &app_handle)?;

    // Check if successful
    if response.get("success").and_then(|s| s.as_bool()) == Some(true) {
        let data = response.get("data").ok_or("Missing data in response")?;
        
        let result = RecordingResult {
            script_path: data.get("scriptPath").and_then(|s| s.as_str()).map(String::from),
            action_count: data.get("actionCount").and_then(|n| n.as_i64()).map(|n| n as i32),
            duration: data.get("duration").and_then(|n| n.as_f64()),
            screenshot_count: data.get("screenshotCount").and_then(|n| n.as_i64()).map(|n| n as i32),
        };
        
        Ok(result)
    } else {
        let error = response
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("Unknown error");
        Err(error.to_string())
    }
}

#[tauri::command]
async fn start_playback(
    process_manager: State<'_, PythonProcessManager>,
    app_handle: tauri::AppHandle,
    script_path: Option<String>,
    speed: Option<f64>,
    loop_count: Option<i32>,
) -> Result<(), String> {
    // Ensure Python process is running
    process_manager.ensure_process_running(app_handle.clone())?;

    // Build params
    let mut params = serde_json::Map::new();
    if let Some(path) = script_path {
        params.insert("scriptPath".to_string(), serde_json::Value::String(path));
    }
    if let Some(s) = speed {
        params.insert("speed".to_string(), serde_json::json!(s));
    }
    if let Some(lc) = loop_count {
        params.insert("loopCount".to_string(), serde_json::json!(lc));
    }

    // Send start_playback command
    let response = process_manager.send_command("start_playback", serde_json::Value::Object(params), &app_handle)?;

    // Check if successful
    if response.get("success").and_then(|s| s.as_bool()) == Some(true) {
        Ok(())
    } else {
        let error = response
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("Unknown error");
        Err(error.to_string())
    }
}

#[tauri::command]
async fn stop_playback(
    process_manager: State<'_, PythonProcessManager>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Send stop_playback command
    let response = process_manager.send_command("stop_playback", serde_json::json!({}), &app_handle)?;

    // Check if successful
    if response.get("success").and_then(|s| s.as_bool()) == Some(true) {
        Ok(())
    } else {
        let error = response
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("Unknown error");
        Err(error.to_string())
    }
}

#[tauri::command]
async fn pause_playback(
    process_manager: State<'_, PythonProcessManager>,
    app_handle: tauri::AppHandle,
) -> Result<bool, String> {
    // Send pause_playback command
    let response = process_manager.send_command("pause_playback", serde_json::json!({}), &app_handle)?;

    // Check if successful
    if response.get("success").and_then(|s| s.as_bool()) == Some(true) {
        let data = response.get("data").ok_or("Missing data in response")?;
        let is_paused = data
            .get("isPaused")
            .and_then(|b| b.as_bool())
            .unwrap_or(false);
        Ok(is_paused)
    } else {
        let error = response
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("Unknown error");
        Err(error.to_string())
    }
}

#[tauri::command]
async fn check_recordings(
    process_manager: State<'_, PythonProcessManager>,
    app_handle: tauri::AppHandle,
) -> Result<bool, String> {
    // Ensure Python process is running
    process_manager.ensure_process_running(app_handle.clone())?;

    // Send check_recordings command
    let response = process_manager.send_command("check_recordings", serde_json::json!({}), &app_handle)?;

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
    process_manager: State<'_, PythonProcessManager>,
    app_handle: tauri::AppHandle,
) -> Result<Option<String>, String> {
    // Ensure Python process is running
    process_manager.ensure_process_running(app_handle.clone())?;

    // Send get_latest command
    let response = process_manager.send_command("get_latest", serde_json::json!({}), &app_handle)?;

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
    process_manager: State<'_, PythonProcessManager>,
    app_handle: tauri::AppHandle,
) -> Result<Vec<ScriptInfo>, String> {
    // Ensure Python process is running
    process_manager.ensure_process_running(app_handle.clone())?;

    // Send list_scripts command
    let response = process_manager.send_command("list_scripts", serde_json::json!({}), &app_handle)?;

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
    process_manager: State<'_, PythonProcessManager>,
    app_handle: tauri::AppHandle,
    script_path: String,
) -> Result<serde_json::Value, String> {
    // Ensure Python process is running
    process_manager.ensure_process_running(app_handle.clone())?;

    // Send load_script command
    let params = serde_json::json!({
        "scriptPath": script_path
    });
    let response = process_manager.send_command("load_script", params, &app_handle)?;

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
    process_manager: State<'_, PythonProcessManager>,
    app_handle: tauri::AppHandle,
    script_path: String,
    script_data: serde_json::Value,
) -> Result<String, String> {
    // Ensure Python process is running
    process_manager.ensure_process_running(app_handle.clone())?;

    // Send save_script command
    let params = serde_json::json!({
        "scriptPath": script_path,
        "scriptData": script_data
    });
    let response = process_manager.send_command("save_script", params, &app_handle)?;

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
    process_manager: State<'_, PythonProcessManager>,
    app_handle: tauri::AppHandle,
    script_path: String,
) -> Result<String, String> {
    // Ensure Python process is running
    process_manager.ensure_process_running(app_handle.clone())?;

    // Send delete_script command
    let params = serde_json::json!({
        "scriptPath": script_path
    });
    let response = process_manager.send_command("delete_script", params, &app_handle)?;

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

fn main() {
    let process_manager = PythonProcessManager::new();

    tauri::Builder::default()
        .manage(process_manager)
        .invoke_handler(tauri::generate_handler![
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
