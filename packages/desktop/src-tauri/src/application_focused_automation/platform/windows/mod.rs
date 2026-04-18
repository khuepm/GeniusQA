//! Windows-specific implementations for application detection and focus monitoring

use crate::application_focused_automation::{
    error::{FocusError, RegistryError},
    platform::{PlatformApplicationDetector, PlatformFocusMonitor},
    types::{ApplicationInfo, WindowHandle},
};
use std::collections::HashMap;
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use std::ptr;
use winapi::shared::minwindef::{BOOL, DWORD, FALSE, LPARAM, TRUE};
use winapi::shared::windef::HWND;
use winapi::um::handleapi::CloseHandle;
use winapi::um::processthreadsapi::OpenProcess;
use winapi::um::psapi::{EnumProcesses, GetModuleBaseNameW, GetModuleFileNameExW};
use winapi::um::tlhelp32::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use winapi::um::winnt::{PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
use winapi::um::winuser::{EnumWindows, GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible, UnhookWinEvent};

/// Windows-specific application detector
pub struct WindowsApplicationDetector {
    // Cache for process information to avoid repeated API calls
    process_cache: HashMap<u32, (String, String)>, // pid -> (name, path)
}

impl WindowsApplicationDetector {
    pub fn new() -> Self {
        Self {
            process_cache: HashMap::new(),
        }
    }

    /// Get process name and executable path for a given process ID
    fn get_process_info(&mut self, process_id: u32) -> Option<(String, String)> {
        // Check cache first
        if let Some(info) = self.process_cache.get(&process_id) {
            return Some(info.clone());
        }

        unsafe {
            let process_handle = OpenProcess(
                PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
                FALSE,
                process_id,
            );

            if process_handle.is_null() {
                return None;
            }

            let mut process_name = vec![0u16; 260];
            let mut executable_path = vec![0u16; 260];

            let name_result = GetModuleBaseNameW(
                process_handle,
                ptr::null_mut(),
                process_name.as_mut_ptr(),
                process_name.len() as DWORD,
            );

            let path_result = GetModuleFileNameExW(
                process_handle,
                ptr::null_mut(),
                executable_path.as_mut_ptr(),
                executable_path.len() as DWORD,
            );

            CloseHandle(process_handle);

            if name_result > 0 && path_result > 0 {
                let name = OsString::from_wide(&process_name[..name_result as usize])
                    .to_string_lossy()
                    .to_string();
                let path = OsString::from_wide(&executable_path[..path_result as usize])
                    .to_string_lossy()
                    .to_string();

                let info = (name, path);
                self.process_cache.insert(process_id, info.clone());
                Some(info)
            } else {
                None
            }
        }
    }

    /// Enumerate all running processes using Toolhelp32 API
    fn enumerate_processes(&mut self) -> Result<Vec<u32>, RegistryError> {
        unsafe {
            let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if snapshot == winapi::um::handleapi::INVALID_HANDLE_VALUE {
                return Err(RegistryError::PlatformDetectionError(
                    "Failed to create process snapshot".to_string(),
                ));
            }

            let mut process_entry: PROCESSENTRY32W = std::mem::zeroed();
            process_entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as DWORD;

            let mut process_ids = Vec::new();

            if Process32FirstW(snapshot, &mut process_entry) == TRUE {
                loop {
                    process_ids.push(process_entry.th32ProcessID);

                    if Process32NextW(snapshot, &mut process_entry) == FALSE {
                        break;
                    }
                }
            }

            CloseHandle(snapshot);
            Ok(process_ids)
        }
    }

    /// Get window information for processes that have visible windows
    fn get_windows_for_processes(&self, process_ids: &[u32]) -> HashMap<u32, Vec<HWND>> {
        let mut process_windows: HashMap<u32, Vec<HWND>> = HashMap::new();

        unsafe {
            EnumWindows(Some(enum_windows_proc), &mut process_windows as *mut _ as LPARAM);
        }

        // Filter to only include processes we're interested in
        process_windows
            .into_iter()
            .filter(|(pid, _)| process_ids.contains(pid))
            .collect()
    }
}

/// Callback function for EnumWindows
unsafe extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let process_windows = &mut *(lparam as *mut HashMap<u32, Vec<HWND>>);

    // Only consider visible windows
    if IsWindowVisible(hwnd) == FALSE {
        return TRUE; // Continue enumeration
    }

    // Get window title to filter out system windows
    let mut window_title = vec![0u16; 256];
    let title_len = GetWindowTextW(hwnd, window_title.as_mut_ptr(), window_title.len() as i32);

    if title_len > 0 {
        let mut process_id: DWORD = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);

        if process_id > 0 {
            process_windows
                .entry(process_id)
                .or_insert_with(Vec::new)
                .push(hwnd);
        }
    }

    TRUE // Continue enumeration
}

impl PlatformApplicationDetector for WindowsApplicationDetector {
    fn get_running_applications(&self) -> Result<Vec<ApplicationInfo>, RegistryError> {
        let mut detector = WindowsApplicationDetector::new();
        
        // Get all running processes
        let process_ids = detector.enumerate_processes()?;
        
        // Get windows for processes
        let process_windows = detector.get_windows_for_processes(&process_ids);
        
        let mut applications = Vec::new();
        
        for process_id in process_ids {
            // Only include processes that have visible windows
            if !process_windows.contains_key(&process_id) {
                continue;
            }
            
            if let Some((process_name, executable_path)) = detector.get_process_info(process_id) {
                // Filter out system processes and processes without meaningful names
                if process_name.is_empty() 
                    || process_name.starts_with("svchost")
                    || process_name.starts_with("dwm")
                    || process_name.starts_with("winlogon")
                    || process_name.starts_with("csrss")
                    || process_name.starts_with("lsass")
                    || process_name.starts_with("services")
                    || process_name.starts_with("smss")
                    || process_name.starts_with("wininit") {
                    continue;
                }
                
                // Extract application name from process name (remove .exe extension)
                let app_name = if process_name.ends_with(".exe") {
                    process_name[..process_name.len() - 4].to_string()
                } else {
                    process_name.clone()
                };
                
                // Get the main window handle (first visible window)
                let window_handle = process_windows
                    .get(&process_id)
                    .and_then(|windows| windows.first())
                    .map(|&hwnd| WindowHandle::Windows(hwnd as isize));
                
                applications.push(ApplicationInfo {
                    name: app_name,
                    executable_path,
                    process_name,
                    process_id,
                    bundle_id: None, // Windows doesn't use bundle IDs
                    window_handle,
                });
            }
        }
        
        // Sort by application name for consistent ordering
        applications.sort_by(|a, b| a.name.cmp(&b.name));
        
        Ok(applications)
    }

    fn get_application_window_handle(&self, process_id: u32) -> Result<WindowHandle, RegistryError> {
        let process_windows = self.get_windows_for_processes(&[process_id]);
        
        if let Some(windows) = process_windows.get(&process_id) {
            if let Some(&hwnd) = windows.first() {
                return Ok(WindowHandle::Windows(hwnd as isize));
            }
        }
        
        Err(RegistryError::PlatformDetectionError(
            format!("No visible window found for process ID {}", process_id)
        ))
    }

    fn get_application_by_identifier(&self, identifier: &str) -> Result<Option<ApplicationInfo>, RegistryError> {
        // On Windows, the identifier is the executable path
        let applications = self.get_running_applications()?;
        
        for app in applications {
            if app.executable_path == identifier {
                return Ok(Some(app));
            }
        }
        
        Ok(None)
    }

    fn validate_permissions(&self) -> Result<bool, RegistryError> {
        // Windows doesn't require special permissions for basic application enumeration
        // In a full implementation, this might check for UAC elevation if needed
        Ok(true)
    }
}

/// Windows-specific focus monitor
pub struct WindowsFocusMonitor {
    /// Handle to the event hook for focus monitoring
    hook_handle: Option<winapi::shared::windef::HHOOK>,
    /// Process ID being monitored
    monitored_process_id: Option<u32>,
    /// Current focus state
    is_monitoring: bool,
    /// Last known focused process ID for change detection
    last_focused_process_id: Option<u32>,
}

impl WindowsFocusMonitor {
    pub fn new() -> Self {
        Self {
            hook_handle: None,
            monitored_process_id: None,
            is_monitoring: false,
            last_focused_process_id: None,
        }
    }

    /// Get the process ID of the currently focused window
    fn get_foreground_process_id() -> Option<u32> {
        unsafe {
            let foreground_window = winapi::um::winuser::GetForegroundWindow();
            if foreground_window.is_null() {
                return None;
            }

            let mut process_id: DWORD = 0;
            winapi::um::winuser::GetWindowThreadProcessId(foreground_window, &mut process_id);
            
            if process_id > 0 {
                Some(process_id)
            } else {
                None
            }
        }
    }

    /// Get the title of the currently focused window
    fn get_foreground_window_title() -> Option<String> {
        unsafe {
            let foreground_window = winapi::um::winuser::GetForegroundWindow();
            if foreground_window.is_null() {
                return None;
            }

            let mut window_title = vec![0u16; 256];
            let title_len = winapi::um::winuser::GetWindowTextW(
                foreground_window,
                window_title.as_mut_ptr(),
                window_title.len() as i32,
            );

            if title_len > 0 {
                let title = OsString::from_wide(&window_title[..title_len as usize])
                    .to_string_lossy()
                    .to_string();
                Some(title)
            } else {
                None
            }
        }
    }

    /// Check if focus has changed since last check
    fn has_focus_changed(&mut self) -> bool {
        let current_focused = Self::get_foreground_process_id();
        let changed = current_focused != self.last_focused_process_id;
        self.last_focused_process_id = current_focused;
        changed
    }

    /// Check if the monitored process is currently focused
    fn check_monitored_process_focus(&self) -> bool {
        if let Some(monitored_pid) = self.monitored_process_id {
            if let Some(focused_pid) = Self::get_foreground_process_id() {
                return focused_pid == monitored_pid;
            }
        }
        false
    }
}

impl PlatformFocusMonitor for WindowsFocusMonitor {
    fn start_monitoring(&mut self, process_id: u32) -> Result<(), FocusError> {
        if self.is_monitoring {
            return Err(FocusError::MonitoringAlreadyActive);
        }

        if process_id == 0 {
            return Err(FocusError::InvalidProcessId(process_id));
        }

        // Verify the process exists and has a window
        let detector = WindowsApplicationDetector::new();
        let process_windows = detector.get_windows_for_processes(&[process_id]);
        if !process_windows.contains_key(&process_id) {
            return Err(FocusError::ProcessNotFound(process_id));
        }

        // For this implementation, we'll use polling-based monitoring
        // SetWinEventHook would be more efficient but requires complex callback handling
        self.monitored_process_id = Some(process_id);
        self.last_focused_process_id = Self::get_foreground_process_id();
        self.is_monitoring = true;

        Ok(())
    }

    fn stop_monitoring(&mut self) -> Result<(), FocusError> {
        if !self.is_monitoring {
            return Err(FocusError::MonitoringNotStarted);
        }

        if let Some(hook) = self.hook_handle.take() {
            unsafe {
                winapi::um::winuser::UnhookWinEvent(hook);
            }
        }
        
        self.monitored_process_id = None;
        self.last_focused_process_id = None;
        self.is_monitoring = false;
        
        Ok(())
    }

    fn is_process_focused(&self, process_id: u32) -> Result<bool, FocusError> {
        if !self.is_monitoring {
            return Err(FocusError::MonitoringNotStarted);
        }

        if let Some(focused_pid) = Self::get_foreground_process_id() {
            Ok(focused_pid == process_id)
        } else {
            // No window is focused
            Ok(false)
        }
    }

    fn get_focused_process_id(&self) -> Result<Option<u32>, FocusError> {
        if !self.is_monitoring {
            return Err(FocusError::MonitoringNotStarted);
        }

        Ok(Self::get_foreground_process_id())
    }
}
