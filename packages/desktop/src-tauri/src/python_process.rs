use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::Manager;

// Python process manager to maintain a single long-lived Python process
#[derive(Debug)]
pub struct PythonProcessManager {
    process: Arc<Mutex<Option<PythonProcess>>>,
}

struct PythonProcess {
    _child: Child,
    stdin: Arc<Mutex<ChildStdin>>,
    stdout_reader: Arc<Mutex<BufReader<ChildStdout>>>,
    _stderr_thread: thread::JoinHandle<()>,
}

impl std::fmt::Debug for PythonProcess {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PythonProcess")
            .field("child_id", &self._child.id())
            .finish()
    }
}

impl PythonProcessManager {
    pub fn new() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
        }
    }

    pub fn ensure_process_running(&self, app_handle: tauri::AppHandle) -> Result<(), String> {
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

    pub fn send_command(&self, command: &str, params: serde_json::Value, app_handle: &tauri::AppHandle) -> Result<serde_json::Value, String> {
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

    /// Check if the Python process is healthy and responsive
    pub fn is_healthy(&self) -> bool {
        let process_guard = self.process.lock().unwrap();
        process_guard.is_some()
    }
}
