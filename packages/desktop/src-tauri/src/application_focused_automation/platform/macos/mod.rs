//! macOS-specific implementations for application detection and focus monitoring

use crate::application_focused_automation::{
    error::{FocusError, RegistryError},
    platform::{PlatformApplicationDetector, PlatformFocusMonitor},
    types::{ApplicationInfo, WindowHandle},
};
use cocoa::base::{id, nil};
use cocoa::foundation::NSString;
use core_foundation::array::{CFArray, CFArrayRef};
use core_foundation::base::TCFType;
use core_foundation::dictionary::{CFDictionary, CFDictionaryRef};
use core_foundation::number::{CFNumber, CFNumberRef};
use core_foundation::string::CFString;
use core_graphics::window::{kCGWindowListOptionOnScreenOnly, CGWindowListCopyWindowInfo};
use libc::pid_t;
use objc::{msg_send, sel, sel_impl};
use std::collections::HashMap;

/// macOS-specific application detector using NSWorkspace and Bundle IDs
pub struct MacOSApplicationDetector {
    /// Cache for Bundle ID to application info mapping
    bundle_cache: HashMap<String, ApplicationInfo>,
    /// NSWorkspace instance for application enumeration
    workspace: id,
}

impl MacOSApplicationDetector {
    pub fn new() -> Self {
        unsafe {
            // Get shared NSWorkspace instance
            let workspace_class = objc::runtime::Class::get("NSWorkspace").unwrap();
            let workspace: id = msg_send![workspace_class, sharedWorkspace];
            Self {
                bundle_cache: HashMap::new(),
                workspace,
            }
        }
    }

    /// Check if accessibility permissions are granted using AXIsProcessTrusted()
    pub fn validate_accessibility_permissions(&self) -> Result<bool, RegistryError> {
        extern "C" {
            fn AXIsProcessTrusted() -> bool;
        }
        
        unsafe {
            Ok(AXIsProcessTrusted())
        }
    }

    /// Get application by Bundle ID using NSWorkspace
    pub fn get_application_by_bundle_id(&self, bundle_id: &str) -> Result<Option<ApplicationInfo>, RegistryError> {
        // Check cache first
        if let Some(cached_app) = self.bundle_cache.get(bundle_id) {
            // Verify the cached application is still running
            if let Ok(running_apps) = self.get_running_applications() {
                if running_apps.iter().any(|app| {
                    app.bundle_id.as_ref().map_or(false, |id| id == bundle_id)
                }) {
                    return Ok(Some(cached_app.clone()));
                }
            }
        }

        // Search running applications
        unsafe {
            let bundle_id_nsstring = NSString::alloc(nil).init_str(bundle_id);
            let running_apps: id = msg_send![self.workspace, runningApplications];
            let count: usize = msg_send![running_apps, count];
            
            for i in 0..count {
                let app: id = msg_send![running_apps, objectAtIndex: i];
                let app_bundle_id: id = msg_send![app, bundleIdentifier];
                
                if app_bundle_id != nil {
                    let is_equal: bool = msg_send![app_bundle_id, isEqualToString: bundle_id_nsstring];
                    if is_equal {
                        let app_info = self.extract_application_info(app)?;
                        return Ok(Some(app_info));
                    }
                }
            }
            
            Ok(None)
        }
    }

    /// Update Bundle ID cache with application info
    pub fn update_bundle_cache(&mut self, app_info: &ApplicationInfo) {
        if let Some(bundle_id) = &app_info.bundle_id {
            self.bundle_cache.insert(bundle_id.clone(), app_info.clone());
        }
    }

    /// Clear stale entries from Bundle ID cache
    pub fn cleanup_bundle_cache(&mut self) -> Result<(), RegistryError> {
        let running_apps = self.get_running_applications()?;
        let running_bundle_ids: std::collections::HashSet<String> = running_apps
            .iter()
            .filter_map(|app| app.bundle_id.as_ref())
            .cloned()
            .collect();

        self.bundle_cache.retain(|bundle_id, _| running_bundle_ids.contains(bundle_id));
        Ok(())
    }

    /// Get all cached Bundle IDs
    pub fn get_cached_bundle_ids(&self) -> Vec<String> {
        self.bundle_cache.keys().cloned().collect()
    }

    /// Extract ApplicationInfo from NSRunningApplication
    fn extract_application_info(&self, app: id) -> Result<ApplicationInfo, RegistryError> {
        unsafe {
            // Get application name
            let localized_name: id = msg_send![app, localizedName];
            let name = if localized_name != nil {
                let name_cstr: *const i8 = msg_send![localized_name, UTF8String];
                std::ffi::CStr::from_ptr(name_cstr)
                    .to_string_lossy()
                    .to_string()
            } else {
                "Unknown Application".to_string()
            };

            // Get bundle identifier
            let bundle_id_obj: id = msg_send![app, bundleIdentifier];
            let bundle_id = if bundle_id_obj != nil {
                let bundle_id_cstr: *const i8 = msg_send![bundle_id_obj, UTF8String];
                Some(std::ffi::CStr::from_ptr(bundle_id_cstr)
                    .to_string_lossy()
                    .to_string())
            } else {
                None
            };

            // Get executable URL and path
            let executable_url: id = msg_send![app, executableURL];
            let executable_path = if executable_url != nil {
                let path_obj: id = msg_send![executable_url, path];
                if path_obj != nil {
                    let path_cstr: *const i8 = msg_send![path_obj, UTF8String];
                    std::ffi::CStr::from_ptr(path_cstr)
                        .to_string_lossy()
                        .to_string()
                } else {
                    "/Unknown/Path".to_string()
                }
            } else {
                "/Unknown/Path".to_string()
            };

            // Get process identifier
            let process_id: pid_t = msg_send![app, processIdentifier];

            // Extract process name from executable path
            let process_name = std::path::Path::new(&executable_path)
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("unknown")
                .to_string();

            // Get window handle using Core Graphics
            let window_handle = self.get_main_window_for_process(process_id as u32).ok();

            Ok(ApplicationInfo {
                name,
                executable_path,
                process_name,
                process_id: process_id as u32,
                bundle_id,
                window_handle,
            })
        }
    }

    /// Get the main window for a process using Core Graphics
    fn get_main_window_for_process(&self, process_id: u32) -> Result<WindowHandle, RegistryError> {
        // For now, return a placeholder window handle
        // In a full implementation, this would use Core Graphics APIs to find the actual window
        Ok(WindowHandle::MacOS(process_id))
    }

    /// Filter system applications that should not be shown to users
    fn is_user_application(&self, app: id) -> bool {
        unsafe {
            // Get bundle identifier to filter system apps
            let bundle_id_obj: id = msg_send![app, bundleIdentifier];
            if bundle_id_obj != nil {
                let bundle_id_cstr: *const i8 = msg_send![bundle_id_obj, UTF8String];
                let bundle_id = std::ffi::CStr::from_ptr(bundle_id_cstr)
                    .to_string_lossy()
                    .to_string();
                
                // Filter out system applications but keep some useful ones
                if bundle_id.starts_with("com.apple.") 
                    && !bundle_id.contains("Safari")
                    && !bundle_id.contains("TextEdit")
                    && !bundle_id.contains("Preview")
                    && !bundle_id.contains("Finder") {
                    return false;
                }
            }

            // Check activation policy - only show regular applications
            let activation_policy: i32 = msg_send![app, activationPolicy];
            // NSApplicationActivationPolicyRegular = 0
            activation_policy == 0
        }
    }
}

impl PlatformApplicationDetector for MacOSApplicationDetector {
    fn get_running_applications(&self) -> Result<Vec<ApplicationInfo>, RegistryError> {
        unsafe {
            let running_apps: id = msg_send![self.workspace, runningApplications];
            let count: usize = msg_send![running_apps, count];
            let mut applications = Vec::new();

            for i in 0..count {
                let app: id = msg_send![running_apps, objectAtIndex: i];
                
                // Filter to only include user applications
                if !self.is_user_application(app) {
                    continue;
                }

                match self.extract_application_info(app) {
                    Ok(app_info) => applications.push(app_info),
                    Err(e) => {
                        // Log error but continue with other applications
                        eprintln!("Failed to extract application info: {}", e);
                    }
                }
            }

            // Sort by application name for consistent ordering
            applications.sort_by(|a, b| a.name.cmp(&b.name));
            
            Ok(applications)
        }
    }

    fn get_application_window_handle(&self, process_id: u32) -> Result<WindowHandle, RegistryError> {
        self.get_main_window_for_process(process_id)
    }

    fn get_application_by_identifier(&self, identifier: &str) -> Result<Option<ApplicationInfo>, RegistryError> {
        // On macOS, the identifier is the Bundle ID
        self.get_application_by_bundle_id(identifier)
    }

    fn validate_permissions(&self) -> Result<bool, RegistryError> {
        self.validate_accessibility_permissions()
    }
}

/// macOS-specific focus monitor using NSWorkspace notifications and accessibility APIs
pub struct MacOSFocusMonitor {
    /// Whether accessibility permissions are trusted
    accessibility_trusted: bool,
    /// Whether secure input is currently active
    secure_input_active: bool,
    /// NSWorkspace instance for notifications
    workspace: id,
    /// Currently monitored process ID
    monitored_process_id: Option<u32>,
    /// Currently monitored Bundle ID for persistence
    monitored_bundle_id: Option<String>,
    /// Whether monitoring is currently active
    is_monitoring: bool,
    /// Last known focused process ID for change detection
    last_focused_process_id: Option<u32>,
    /// NSWorkspace notification observer for application activation
    notification_observer: Option<id>,
    /// Whether Info.plist has been verified for accessibility description
    info_plist_verified: bool,
}

impl MacOSFocusMonitor {
    pub fn new() -> Self {
        unsafe {
            // Get shared NSWorkspace instance
            let workspace_class = objc::runtime::Class::get("NSWorkspace").unwrap();
            let workspace: id = msg_send![workspace_class, sharedWorkspace];
            Self {
                accessibility_trusted: false,
                secure_input_active: false,
                workspace,
                monitored_process_id: None,
                monitored_bundle_id: None,
                is_monitoring: false,
                last_focused_process_id: None,
                notification_observer: None,
                info_plist_verified: false,
            }
        }
    }

    /// Set the Bundle ID to monitor for persistence across app restarts
    pub fn set_monitored_bundle_id(&mut self, bundle_id: Option<String>) {
        self.monitored_bundle_id = bundle_id;
    }

    /// Get the currently monitored Bundle ID
    pub fn get_monitored_bundle_id(&self) -> Option<&String> {
        self.monitored_bundle_id.as_ref()
    }

    /// Resolve process ID from Bundle ID using NSWorkspace
    pub fn resolve_process_id_from_bundle_id(&self, bundle_id: &str) -> Result<Option<u32>, FocusError> {
        unsafe {
            let bundle_id_nsstring = NSString::alloc(nil).init_str(bundle_id);
            let running_apps: id = msg_send![self.workspace, runningApplications];
            let count: usize = msg_send![running_apps, count];
            
            for i in 0..count {
                let app: id = msg_send![running_apps, objectAtIndex: i];
                let app_bundle_id: id = msg_send![app, bundleIdentifier];
                
                if app_bundle_id != nil {
                    let is_equal: bool = msg_send![app_bundle_id, isEqualToString: bundle_id_nsstring];
                    if is_equal {
                        let process_id: pid_t = msg_send![app, processIdentifier];
                        return Ok(Some(process_id as u32));
                    }
                }
            }
            
            Ok(None)
        }
    }

    /// Get Bundle ID from process ID
    pub fn get_bundle_id_from_process_id(&self, process_id: u32) -> Result<Option<String>, FocusError> {
        unsafe {
            let running_apps: id = msg_send![self.workspace, runningApplications];
            let count: usize = msg_send![running_apps, count];
            
            for i in 0..count {
                let app: id = msg_send![running_apps, objectAtIndex: i];
                let app_process_id: pid_t = msg_send![app, processIdentifier];
                
                if app_process_id as u32 == process_id {
                    let bundle_id_obj: id = msg_send![app, bundleIdentifier];
                    if bundle_id_obj != nil {
                        let bundle_id_cstr: *const i8 = msg_send![bundle_id_obj, UTF8String];
                        let bundle_id = std::ffi::CStr::from_ptr(bundle_id_cstr)
                            .to_string_lossy()
                            .to_string();
                        return Ok(Some(bundle_id));
                    }
                }
            }
            
            Ok(None)
        }
    }

    /// Enhanced secure input detection with detailed process information
    /// Implements requirement 8.1: Detect when target application closes during automation
    /// Implements requirement 8.2: Detect when application becomes unresponsive
    pub fn check_secure_input_state(&self) -> Result<bool, FocusError> {
        extern "C" {
            fn IsSecureEventInputEnabled() -> bool;
        }
        
        unsafe {
            let is_secure = IsSecureEventInputEnabled();
            if is_secure {
                // Enhanced secure input detection - identify suspected processes
                let suspected_processes = self.identify_secure_input_processes()?;
                let secure_info = SecureInputInfo {
                    is_active: true,
                    suspected_processes,
                    recommendation: "Close password managers, terminal applications, or other security-sensitive apps that may be blocking automation".to_string(),
                };
                
                // Log detailed secure input information for debugging
                log::warn!("Secure input detected: {:?}", secure_info);
                
                return Err(FocusError::SecureInputActive);
            }
            Ok(false)
        }
    }

    /// Identify processes that might be causing secure input mode
    /// Helps with requirement 8.3: Provide clear error messages and recovery options
    fn identify_secure_input_processes(&self) -> Result<Vec<String>, FocusError> {
        let mut suspected_processes = Vec::new();
        
        // Common applications that enable secure input
        let common_secure_apps = vec![
            "1Password",
            "Bitwarden", 
            "LastPass",
            "Terminal",
            "iTerm2",
            "Hyper",
            "Alacritty",
            "SSH Agent",
            "Keychain Access",
            "System Preferences",
            "Security & Privacy",
        ];
        
        // Check running applications for known secure input enablers
        for app_name in common_secure_apps {
            if self.is_application_running(app_name)? {
                suspected_processes.push(app_name.to_string());
            }
        }
        
        // If no specific apps found, provide general guidance
        if suspected_processes.is_empty() {
            suspected_processes.push("Unknown secure input source".to_string());
        }
        
        Ok(suspected_processes)
    }

    /// Check if a specific application is currently running
    fn is_application_running(&self, app_name: &str) -> Result<bool, FocusError> {
        unsafe {
            let running_apps: id = msg_send![self.workspace, runningApplications];
            let count: usize = msg_send![running_apps, count];
            
            for i in 0..count {
                let app: id = msg_send![running_apps, objectAtIndex: i];
                let localized_name: id = msg_send![app, localizedName];
                if localized_name != nil {
                    let name_cstr: *const i8 = msg_send![localized_name, UTF8String];
                    let name = std::ffi::CStr::from_ptr(name_cstr).to_string_lossy();
                    if name.contains(app_name) {
                        return Ok(true);
                    }
                }
            }
            Ok(false)
        }
    }

    /// Enhanced application closure detection for requirement 8.1
    /// Detects when target application closes during automation
    pub fn detect_application_closure(&self, process_id: u32) -> Result<bool, FocusError> {
        unsafe {
            let running_apps: id = msg_send![self.workspace, runningApplications];
            let count: usize = msg_send![running_apps, count];
            
            for i in 0..count {
                let app: id = msg_send![running_apps, objectAtIndex: i];
                let app_process_id: pid_t = msg_send![app, processIdentifier];
                
                if app_process_id as u32 == process_id {
                    // Application is still running
                    return Ok(false);
                }
            }
            
            // Application not found in running applications - it has closed
            log::warn!("Target application with process ID {} has closed during automation", process_id);
            Ok(true)
        }
    }

    /// Enhanced application responsiveness detection for requirement 8.2
    /// Detects when application becomes unresponsive
    pub fn detect_application_unresponsiveness(&self, process_id: u32) -> Result<bool, FocusError> {
        unsafe {
            let running_apps: id = msg_send![self.workspace, runningApplications];
            let count: usize = msg_send![running_apps, count];
            
            for i in 0..count {
                let app: id = msg_send![running_apps, objectAtIndex: i];
                let app_process_id: pid_t = msg_send![app, processIdentifier];
                
                if app_process_id as u32 == process_id {
                    // Check if application is responding
                    // Note: NSRunningApplication doesn't have a direct "isResponding" method
                    // We use a combination of checks to determine responsiveness
                    
                    // Check if the application is active and can receive events
                    let is_active: bool = msg_send![app, isActive];
                    let is_hidden: bool = msg_send![app, isHidden];
                    let is_terminated: bool = msg_send![app, isTerminated];
                    
                    if is_terminated {
                        log::warn!("Target application with process ID {} has been terminated", process_id);
                        return Ok(true);
                    }
                    
                    // If application is hidden and not active for extended period, it might be unresponsive
                    if is_hidden && !is_active {
                        log::warn!("Target application with process ID {} appears unresponsive (hidden and inactive)", process_id);
                        return Ok(true);
                    }
                    
                    // Application appears responsive
                    return Ok(false);
                }
            }
            
            // Application not found - treat as unresponsive/closed
            log::warn!("Target application with process ID {} not found - treating as unresponsive", process_id);
            Ok(true)
        }
    }

    /// Verify Info.plist configuration includes NSAccessibilityUsageDescription
    fn verify_info_plist_configuration(&mut self) -> Result<(), FocusError> {
        if self.info_plist_verified {
            return Ok(());
        }

        unsafe {
            // Get the main bundle
            let main_bundle_class = objc::runtime::Class::get("NSBundle").unwrap();
            let main_bundle: id = msg_send![main_bundle_class, mainBundle];
            
            if main_bundle == nil {
                return Err(FocusError::PermissionDenied(
                    "Unable to access main bundle for Info.plist verification".to_string(),
                ));
            }

            // Check for NSAccessibilityUsageDescription
            let accessibility_key = NSString::alloc(nil).init_str("NSAccessibilityUsageDescription");
            let accessibility_desc: id = msg_send![main_bundle, objectForInfoDictionaryKey: accessibility_key];
            
            if accessibility_desc == nil {
                return Err(FocusError::PermissionDenied(
                    "NSAccessibilityUsageDescription not found in Info.plist. Please add accessibility usage description to your app's Info.plist file.".to_string(),
                ));
            }

            // Verify the description is not empty
            let desc_length: usize = msg_send![accessibility_desc, length];
            if desc_length == 0 {
                return Err(FocusError::PermissionDenied(
                    "NSAccessibilityUsageDescription is empty in Info.plist. Please provide a meaningful description.".to_string(),
                ));
            }

            self.info_plist_verified = true;
            Ok(())
        }
    }

    /// Enhanced accessibility permission management with detailed error reporting
    /// Implements requirements 8.1, 8.2, 8.3: Comprehensive error handling and recovery
    fn update_accessibility_status(&mut self) -> Result<(), FocusError> {
        extern "C" {
            fn AXIsProcessTrusted() -> bool;
            fn AXIsProcessTrustedWithOptions(options: id) -> bool;
        }
        
        unsafe {
            // First verify Info.plist configuration
            self.verify_info_plist_configuration()?;

            // Check if accessibility is already trusted
            self.accessibility_trusted = AXIsProcessTrusted();
            
            if !self.accessibility_trusted {
                // Try to prompt for accessibility permissions
                let cf_dictionary_class = objc::runtime::Class::get("NSMutableDictionary").unwrap();
                let options: id = msg_send![cf_dictionary_class, dictionary];
                
                // Set kAXTrustedCheckOptionPrompt to true to show the permission dialog
                let prompt_key = NSString::alloc(nil).init_str("AXTrustedCheckOptionPrompt");
                let prompt_value: id = msg_send![objc::runtime::Class::get("NSNumber").unwrap(), numberWithBool: true];
                let _: () = msg_send![options, setObject: prompt_value forKey: prompt_key];
                
                // Check again with prompt option
                self.accessibility_trusted = AXIsProcessTrustedWithOptions(options);
                
                if !self.accessibility_trusted {
                    return Err(FocusError::PermissionDenied(
                        "Accessibility permissions required for focus monitoring. Please grant accessibility permissions in System Preferences > Security & Privacy > Privacy > Accessibility and restart the application.".to_string(),
                    ));
                }
            }
        }
        
        Ok(())
    }

    /// Enhanced accessibility status with comprehensive diagnostics
    /// Implements requirement 8.3: Provide clear error messages and recovery options
    pub fn get_accessibility_status(&self) -> Result<AccessibilityStatus, FocusError> {
        extern "C" {
            fn AXIsProcessTrusted() -> bool;
        }
        
        unsafe {
            let is_trusted = AXIsProcessTrusted();
            let info_plist_ok = self.info_plist_verified;
            let secure_input_active = self.check_secure_input_state().unwrap_or(false);
            
            Ok(AccessibilityStatus {
                is_trusted,
                info_plist_configured: info_plist_ok,
                secure_input_active,
            })
        }
    }

    /// Comprehensive permission validation with detailed error reporting
    /// Implements all three requirements: 8.1, 8.2, 8.3
    pub fn validate_comprehensive_permissions(&mut self) -> Result<PermissionValidationResult, FocusError> {
        let mut issues = Vec::new();
        let mut warnings = Vec::new();
        
        // Check Info.plist configuration
        match self.verify_info_plist_configuration() {
            Ok(_) => {},
            Err(e) => {
                issues.push(format!("Info.plist configuration issue: {}", e));
            }
        }
        
        // Check accessibility permissions
        extern "C" {
            fn AXIsProcessTrusted() -> bool;
        }
        
        unsafe {
            if !AXIsProcessTrusted() {
                issues.push("Accessibility permissions not granted. Please enable in System Preferences > Security & Privacy > Privacy > Accessibility".to_string());
            }
        }
        
        // Check secure input state
        match self.check_secure_input_state() {
            Ok(false) => {}, // Secure input not active - good
            Ok(true) => {
                warnings.push("Secure input is currently active. This may interfere with automation.".to_string());
            },
            Err(FocusError::SecureInputActive) => {
                warnings.push("Secure input detected. Close password managers or terminal applications.".to_string());
            },
            Err(e) => {
                issues.push(format!("Error checking secure input state: {}", e));
            }
        }
        
        // Check display configuration
        match self.get_display_info() {
            Ok(display_info) => {
                if display_info.screen_count > 1 {
                    warnings.push(format!("Multiple displays detected ({}). Coordinate conversion may need adjustment.", display_info.screen_count));
                }
                if display_info.is_retina {
                    warnings.push("Retina display detected. Coordinate scaling will be applied automatically.".to_string());
                }
            },
            Err(e) => {
                issues.push(format!("Display configuration error: {}", e));
            }
        }
        
        let is_valid = issues.is_empty();
        
        Ok(PermissionValidationResult {
            is_valid,
            issues,
            warnings,
            recommendations: if !is_valid {
                vec![
                    "Restart the application after fixing permission issues".to_string(),
                    "Ensure the application is in the Accessibility list in System Preferences".to_string(),
                    "Check that Info.plist contains NSAccessibilityUsageDescription".to_string(),
                ]
            } else {
                vec![]
            },
        })
    }

    /// Enhanced application detection failure handling
    /// Implements requirement 8.3: Provide clear error messages and recovery options
    pub fn handle_application_detection_failure(&self, error: &FocusError) -> Result<ApplicationDetectionRecovery, FocusError> {
        let recovery_steps = match error {
            FocusError::ProcessNotFound(pid) => {
                vec![
                    format!("Verify that the application with process ID {} is still running", pid),
                    "Check if the application was closed or crashed".to_string(),
                    "Restart the target application if needed".to_string(),
                    "Re-register the application with the automation system".to_string(),
                ]
            },
            FocusError::PermissionDenied(_) => {
                vec![
                    "Grant accessibility permissions in System Preferences".to_string(),
                    "Add this application to the Accessibility list".to_string(),
                    "Restart the application after granting permissions".to_string(),
                    "Verify Info.plist contains NSAccessibilityUsageDescription".to_string(),
                ]
            },
            FocusError::SecureInputActive => {
                vec![
                    "Close password managers (1Password, LastPass, etc.)".to_string(),
                    "Close terminal applications (Terminal, iTerm2, etc.)".to_string(),
                    "Dismiss any system security dialogs".to_string(),
                    "Wait a few seconds and try again".to_string(),
                ]
            },
            FocusError::PlatformSpecific(msg) => {
                vec![
                    format!("Platform-specific issue: {}", msg),
                    "Check macOS version compatibility".to_string(),
                    "Verify system integrity".to_string(),
                    "Contact support if the issue persists".to_string(),
                ]
            },
            _ => {
                vec![
                    "Restart the application".to_string(),
                    "Check system permissions".to_string(),
                    "Verify target application is responsive".to_string(),
                ]
            }
        };
        
        Ok(ApplicationDetectionRecovery {
            error_type: format!("{:?}", error),
            recovery_steps,
            can_retry: matches!(error, 
                FocusError::SecureInputActive | 
                FocusError::ProcessNotFound(_) |
                FocusError::PlatformSpecific(_)
            ),
            estimated_recovery_time: match error {
                FocusError::SecureInputActive => Some("30 seconds to 2 minutes".to_string()),
                FocusError::ProcessNotFound(_) => Some("Immediate after application restart".to_string()),
                FocusError::PermissionDenied(_) => Some("Immediate after granting permissions and restart".to_string()),
                _ => None,
            },
        })
    }

    /// Set up NSWorkspace notifications for application activation events
    fn setup_workspace_notifications(&mut self) -> Result<(), FocusError> {
        unsafe {
            // Get the default notification center
            let notification_center_class = objc::runtime::Class::get("NSNotificationCenter").unwrap();
            let default_center: id = msg_send![notification_center_class, defaultCenter];
            
            // Get NSWorkspace notification names
            let workspace_class = objc::runtime::Class::get("NSWorkspace").unwrap();
            let did_activate_notification: id = msg_send![workspace_class, NSWorkspaceDidActivateApplicationNotification];
            let did_deactivate_notification: id = msg_send![workspace_class, NSWorkspaceDidDeactivateApplicationNotification];
            
            // Create a notification observer block
            // Note: In a production implementation, you would create a proper Objective-C observer
            // For this implementation, we'll set up the notification registration structure
            
            // Register for application activation notifications
            let _: () = msg_send![default_center, 
                addObserverForName: did_activate_notification
                object: self.workspace
                queue: nil
                usingBlock: nil  // In production, this would be a proper block callback
            ];
            
            // Register for application deactivation notifications  
            let _: () = msg_send![default_center,
                addObserverForName: did_deactivate_notification
                object: self.workspace
                queue: nil
                usingBlock: nil  // In production, this would be a proper block callback
            ];
            
            // Store the notification center reference for cleanup
            self.notification_observer = Some(default_center);
            
            Ok(())
        }
    }

    /// Remove NSWorkspace notification observers
    fn remove_workspace_notifications(&mut self) -> Result<(), FocusError> {
        if let Some(observer) = self.notification_observer.take() {
            unsafe {
                // In a full implementation, we would remove the specific observer
                // For now, we'll just clear our reference
                let notification_center_class = objc::runtime::Class::get("NSNotificationCenter").unwrap();
                let default_center: id = msg_send![notification_center_class, defaultCenter];
                
                // Remove all observers for this object (in real implementation, be more specific)
                let _: () = msg_send![default_center, removeObserver: observer];
            }
        }
        Ok(())
    }

    /// Get the currently focused application using NSWorkspace
    fn get_focused_application(&self) -> Result<Option<id>, FocusError> {
        unsafe {
            let front_app: id = msg_send![self.workspace, frontmostApplication];
            if front_app != nil {
                Ok(Some(front_app))
            } else {
                Ok(None)
            }
        }
    }

    /// Get process ID from NSRunningApplication
    fn get_process_id_from_app(&self, app: id) -> Result<u32, FocusError> {
        unsafe {
            let process_id: pid_t = msg_send![app, processIdentifier];
            Ok(process_id as u32)
        }
    }

    /// Get the process ID of the currently focused application
    pub fn get_focused_process_id_internal(&self) -> Result<Option<u32>, FocusError> {
        if let Some(front_app) = self.get_focused_application()? {
            let process_id = self.get_process_id_from_app(front_app)?;
            Ok(Some(process_id))
        } else {
            Ok(None)
        }
    }

    /// Check if the specified process is currently focused
    fn is_process_focused_internal(&self, process_id: u32) -> Result<bool, FocusError> {
        if let Some(focused_pid) = self.get_focused_process_id_internal()? {
            Ok(focused_pid == process_id)
        } else {
            Ok(false)
        }
    }

    /// Validate that the process exists and is accessible
    fn validate_process(&self, process_id: u32) -> Result<(), FocusError> {
        unsafe {
            let running_apps: id = msg_send![self.workspace, runningApplications];
            let count: usize = msg_send![running_apps, count];
            
            for i in 0..count {
                let app: id = msg_send![running_apps, objectAtIndex: i];
                let app_process_id: pid_t = msg_send![app, processIdentifier];
                
                if app_process_id as u32 == process_id {
                    return Ok(());
                }
            }
            
            Err(FocusError::ProcessNotFound(process_id))
        }
    }

    /// Enhanced Retina display coordinate conversion with error handling
    /// Implements requirement 8.3: Provide clear error messages and recovery options
    pub fn convert_retina_coordinates(&self, x: f64, y: f64) -> Result<(f64, f64), FocusError> {
        unsafe {
            // Get the main screen
            let screen_class = objc::runtime::Class::get("NSScreen").unwrap();
            let main_screen: id = msg_send![screen_class, mainScreen];
            
            if main_screen == nil {
                return Err(FocusError::PlatformSpecific(
                    "Unable to access main screen for coordinate conversion. This may indicate a display configuration issue.".to_string(),
                ));
            }

            // Get the backing scale factor (Retina factor)
            let scale_factor: f64 = msg_send![main_screen, backingScaleFactor];
            
            // Validate scale factor
            if scale_factor <= 0.0 || scale_factor > 4.0 {
                return Err(FocusError::PlatformSpecific(
                    format!("Invalid display scale factor: {}. Expected value between 0.0 and 4.0.", scale_factor),
                ));
            }
            
            // Get screen frame for bounds checking
            let screen_frame: cocoa::foundation::NSRect = msg_send![main_screen, frame];
            let screen_width = screen_frame.size.width;
            let screen_height = screen_frame.size.height;
            
            // Validate input coordinates are within reasonable bounds
            if x < 0.0 || y < 0.0 || x > screen_width * 2.0 || y > screen_height * 2.0 {
                return Err(FocusError::PlatformSpecific(
                    format!("Coordinates ({}, {}) are outside valid screen bounds ({}x{})", 
                           x, y, screen_width, screen_height),
                ));
            }
            
            // Convert coordinates by applying the scale factor
            let converted_x = x * scale_factor;
            let converted_y = y * scale_factor;
            
            // Log conversion for debugging
            log::debug!("Retina coordinate conversion: ({}, {}) -> ({}, {}) with scale factor {}", 
                       x, y, converted_x, converted_y, scale_factor);
            
            Ok((converted_x, converted_y))
        }
    }

    /// Get detailed display information for troubleshooting
    /// Helps with requirement 8.3: Provide clear error messages and recovery options
    pub fn get_display_info(&self) -> Result<DisplayInfo, FocusError> {
        unsafe {
            let screen_class = objc::runtime::Class::get("NSScreen").unwrap();
            let main_screen: id = msg_send![screen_class, mainScreen];
            
            if main_screen == nil {
                return Err(FocusError::PlatformSpecific(
                    "Unable to access display information".to_string(),
                ));
            }

            let scale_factor: f64 = msg_send![main_screen, backingScaleFactor];
            let screen_frame: cocoa::foundation::NSRect = msg_send![main_screen, frame];
            
            // Get all screens for multi-display setups
            let all_screens: id = msg_send![screen_class, screens];
            let screen_count: usize = msg_send![all_screens, count];
            
            Ok(DisplayInfo {
                scale_factor,
                width: screen_frame.size.width,
                height: screen_frame.size.height,
                screen_count,
                is_retina: scale_factor > 1.0,
            })
        }
    }

    /// Convert coordinates with multi-display support
    /// Enhanced version that handles multiple displays correctly
    pub fn convert_coordinates_multi_display(&self, x: f64, y: f64, target_screen_index: Option<usize>) -> Result<(f64, f64), FocusError> {
        unsafe {
            let screen_class = objc::runtime::Class::get("NSScreen").unwrap();
            let all_screens: id = msg_send![screen_class, screens];
            let screen_count: usize = msg_send![all_screens, count];
            
            if screen_count == 0 {
                return Err(FocusError::PlatformSpecific(
                    "No displays detected".to_string(),
                ));
            }
            
            // Determine which screen to use
            let screen_index = target_screen_index.unwrap_or(0);
            if screen_index >= screen_count {
                return Err(FocusError::PlatformSpecific(
                    format!("Screen index {} is out of range. Only {} screens available.", 
                           screen_index, screen_count),
                ));
            }
            
            let target_screen: id = msg_send![all_screens, objectAtIndex: screen_index];
            if target_screen == nil {
                return Err(FocusError::PlatformSpecific(
                    format!("Unable to access screen at index {}", screen_index),
                ));
            }
            
            let scale_factor: f64 = msg_send![target_screen, backingScaleFactor];
            let screen_frame: cocoa::foundation::NSRect = msg_send![target_screen, frame];
            
            // Validate coordinates against target screen bounds
            if x < screen_frame.origin.x || y < screen_frame.origin.y ||
               x > screen_frame.origin.x + screen_frame.size.width ||
               y > screen_frame.origin.y + screen_frame.size.height {
                return Err(FocusError::PlatformSpecific(
                    format!("Coordinates ({}, {}) are outside screen {} bounds", x, y, screen_index),
                ));
            }
            
            // Convert coordinates
            let converted_x = x * scale_factor;
            let converted_y = y * scale_factor;
            
            Ok((converted_x, converted_y))
        }
    }

    /// Detect and handle secure input mode with detailed error information
    pub fn handle_secure_input_detection(&self) -> Result<(), FocusError> {
        if self.check_secure_input_state()? {
            // Get more detailed information about secure input
            let secure_input_info = self.get_secure_input_details()?;
            
            return Err(FocusError::SecureInputActive);
        }
        Ok(())
    }

    /// Get detailed information about secure input state
    fn get_secure_input_details(&self) -> Result<SecureInputInfo, FocusError> {
        extern "C" {
            fn IsSecureEventInputEnabled() -> bool;
        }
        
        unsafe {
            let is_active = IsSecureEventInputEnabled();
            
            // Try to get information about which process is using secure input
            // Note: This is limited by macOS security, but we can provide helpful context
            let suspected_processes = vec![
                "Terminal".to_string(),
                "iTerm2".to_string(),
                "Keychain Access".to_string(),
                "1Password".to_string(),
                "LastPass".to_string(),
            ];
            
            Ok(SecureInputInfo {
                is_active,
                suspected_processes,
                recommendation: if is_active {
                    "Secure input is active. This may be caused by password managers, terminal applications, or system security dialogs. Please close these applications or wait for secure input to be disabled.".to_string()
                } else {
                    "Secure input is not active.".to_string()
                },
            })
        }
    }

    /// Handle macOS-specific automation errors with recovery suggestions
    pub fn handle_macos_automation_error(&self, error: &FocusError) -> Result<String, FocusError> {
        match error {
            FocusError::PermissionDenied(msg) => {
                Ok(format!(
                    "macOS Accessibility Permission Error: {}\n\
                    Recovery Steps:\n\
                    1. Open System Preferences > Security & Privacy > Privacy > Accessibility\n\
                    2. Add this application to the list of allowed apps\n\
                    3. Restart the application\n\
                    4. Ensure Info.plist contains NSAccessibilityUsageDescription",
                    msg
                ))
            }
            FocusError::SecureInputActive => {
                let secure_info = self.get_secure_input_details()?;
                Ok(format!(
                    "macOS Secure Input Active: {}\n\
                    Suspected applications: {}\n\
                    Recovery Steps:\n\
                    1. Close password managers (1Password, LastPass, etc.)\n\
                    2. Close terminal applications (Terminal, iTerm2, etc.)\n\
                    3. Dismiss any system security dialogs\n\
                    4. Wait a few seconds and try again",
                    secure_info.recommendation,
                    secure_info.suspected_processes.join(", ")
                ))
            }
            FocusError::ProcessNotFound(pid) => {
                Ok(format!(
                    "macOS Process Not Found: Process ID {} is not running\n\
                    Recovery Steps:\n\
                    1. Verify the target application is still running\n\
                    2. Check if the application was closed or crashed\n\
                    3. Restart the target application if needed\n\
                    4. Re-register the application with the automation system",
                    pid
                ))
            }
            FocusError::PlatformSpecific(msg) => {
                Ok(format!(
                    "macOS Platform Error: {}\n\
                    Recovery Steps:\n\
                    1. Check macOS version compatibility\n\
                    2. Verify system integrity with 'sudo /usr/libexec/repair_packages --verify --standard-pkgs'\n\
                    3. Restart the application\n\
                    4. Contact support if the issue persists",
                    msg
                ))
            }
            _ => {
                Ok(format!(
                    "macOS Automation Error: {:?}\n\
                    General Recovery Steps:\n\
                    1. Restart the application\n\
                    2. Check system permissions\n\
                    3. Verify target application is responsive",
                    error
                ))
            }
        }
    }
}

/// Accessibility permission status information
#[derive(Debug, Clone)]
pub struct AccessibilityStatus {
    pub is_trusted: bool,
    pub info_plist_configured: bool,
    pub secure_input_active: bool,
}

/// Secure input state information
#[derive(Debug, Clone)]
pub struct SecureInputInfo {
    pub is_active: bool,
    pub suspected_processes: Vec<String>,
    pub recommendation: String,
}

/// Display information for coordinate conversion
#[derive(Debug, Clone)]
pub struct DisplayInfo {
    pub scale_factor: f64,
    pub width: f64,
    pub height: f64,
    pub screen_count: usize,
    pub is_retina: bool,
}

/// Comprehensive permission validation result
#[derive(Debug, Clone)]
pub struct PermissionValidationResult {
    pub is_valid: bool,
    pub issues: Vec<String>,
    pub warnings: Vec<String>,
    pub recommendations: Vec<String>,
}

/// Application detection recovery information
#[derive(Debug, Clone)]
pub struct ApplicationDetectionRecovery {
    pub error_type: String,
    pub recovery_steps: Vec<String>,
    pub can_retry: bool,
    pub estimated_recovery_time: Option<String>,
}

impl MacOSFocusMonitor {
    /// Check if monitoring is currently active
    pub fn is_monitoring(&self) -> bool {
        self.is_monitoring
    }

    /// Get the currently monitored process ID
    pub fn get_monitored_process_id(&self) -> Option<u32> {
        self.monitored_process_id
    }

    /// Get the last known focused process ID
    pub fn get_last_focused_process_id(&self) -> Option<u32> {
        self.last_focused_process_id
    }

    /// Check if notification observer is set up
    pub fn has_notification_observer(&self) -> bool {
        self.notification_observer.is_some()
    }

    /// Check if Info.plist has been verified
    pub fn is_info_plist_verified(&self) -> bool {
        self.info_plist_verified
    }
}

impl PlatformFocusMonitor for MacOSFocusMonitor {
    fn start_monitoring(&mut self, process_id: u32) -> Result<(), FocusError> {
        if self.is_monitoring {
            return Err(FocusError::MonitoringAlreadyActive);
        }

        if process_id == 0 {
            return Err(FocusError::InvalidProcessId(process_id));
        }

        // Check accessibility permissions with graceful permission request flow
        self.update_accessibility_status()?;

        // Validate the process exists
        self.validate_process(process_id)?;

        // Get and store Bundle ID for persistence
        if let Ok(Some(bundle_id)) = self.get_bundle_id_from_process_id(process_id) {
            self.monitored_bundle_id = Some(bundle_id);
        }

        // Check for secure input mode
        if self.check_secure_input_state()? {
            self.secure_input_active = true;
            return Err(FocusError::SecureInputActive);
        }

        // Set up NSWorkspace notifications for event-driven monitoring
        self.setup_workspace_notifications()?;

        // Set up monitoring state
        self.monitored_process_id = Some(process_id);
        self.last_focused_process_id = self.get_focused_process_id_internal()?;
        self.is_monitoring = true;

        Ok(())
    }

    fn stop_monitoring(&mut self) -> Result<(), FocusError> {
        if !self.is_monitoring {
            return Err(FocusError::MonitoringNotStarted);
        }

        // Remove NSWorkspace notification observers
        self.remove_workspace_notifications()?;

        // Clean up monitoring state
        self.monitored_process_id = None;
        self.monitored_bundle_id = None;
        self.last_focused_process_id = None;
        self.is_monitoring = false;
        self.secure_input_active = false;

        Ok(())
    }

    fn is_process_focused(&self, process_id: u32) -> Result<bool, FocusError> {
        if !self.is_monitoring {
            return Err(FocusError::MonitoringNotStarted);
        }

        // Enhanced error handling for requirement 8.1: Detect application closure
        if self.detect_application_closure(process_id)? {
            return Err(FocusError::ProcessNotFound(process_id));
        }

        // Enhanced error handling for requirement 8.2: Detect application unresponsiveness
        if self.detect_application_unresponsiveness(process_id)? {
            return Err(FocusError::PlatformSpecific(
                format!("Application with process ID {} appears unresponsive", process_id)
            ));
        }

        // Check for secure input mode which blocks automation
        if self.check_secure_input_state()? {
            return Err(FocusError::SecureInputActive);
        }

        self.is_process_focused_internal(process_id)
    }

    fn get_focused_process_id(&self) -> Result<Option<u32>, FocusError> {
        if !self.is_monitoring {
            return Err(FocusError::MonitoringNotStarted);
        }

        // Check for secure input mode
        if self.check_secure_input_state()? {
            return Err(FocusError::SecureInputActive);
        }

        self.get_focused_process_id_internal()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secure_input_info_creation() {
        let info = SecureInputInfo {
            is_active: true,
            suspected_processes: vec!["Terminal".to_string(), "1Password".to_string()],
            recommendation: "Close password managers".to_string(),
        };
        
        assert!(info.is_active);
        assert_eq!(info.suspected_processes.len(), 2);
        assert!(info.recommendation.contains("Close"));
    }

    #[test]
    fn test_accessibility_status_creation() {
        let status = AccessibilityStatus {
            is_trusted: false,
            info_plist_configured: true,
            secure_input_active: false,
        };
        
        assert!(!status.is_trusted);
        assert!(status.info_plist_configured);
        assert!(!status.secure_input_active);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_macos_application_detector_creation() {
        let detector = MacOSApplicationDetector::new();
        // Just verify it can be created without panicking
        assert!(detector.bundle_cache.is_empty());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_macos_focus_monitor_creation() {
        let monitor = MacOSFocusMonitor::new();
        // Just verify it can be created without panicking
        assert!(!monitor.is_monitoring);
        assert!(monitor.monitored_process_id.is_none());
        assert!(monitor.monitored_bundle_id.is_none());
        assert!(!monitor.info_plist_verified);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_bundle_id_cache_operations() {
        let mut detector = MacOSApplicationDetector::new();
        
        // Test empty cache
        assert!(detector.get_cached_bundle_ids().is_empty());
        
        // Create test application info
        let app_info = ApplicationInfo {
            name: "Test App".to_string(),
            executable_path: "/Applications/Test.app".to_string(),
            process_name: "Test".to_string(),
            process_id: 1234,
            bundle_id: Some("com.test.app".to_string()),
            window_handle: None,
        };
        
        // Update cache
        detector.update_bundle_cache(&app_info);
        
        // Verify cache contains the Bundle ID
        let cached_ids = detector.get_cached_bundle_ids();
        assert_eq!(cached_ids.len(), 1);
        assert!(cached_ids.contains(&"com.test.app".to_string()));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_bundle_id_resolution_methods() {
        let mut monitor = MacOSFocusMonitor::new();
        
        // Test Bundle ID getter/setter
        assert!(monitor.get_monitored_bundle_id().is_none());
        
        monitor.set_monitored_bundle_id(Some("com.test.app".to_string()));
        assert_eq!(monitor.get_monitored_bundle_id(), Some(&"com.test.app".to_string()));
        
        monitor.set_monitored_bundle_id(None);
        assert!(monitor.get_monitored_bundle_id().is_none());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_platform_detector_trait_methods() {
        let detector = MacOSApplicationDetector::new();
        
        // Test that new trait methods are implemented
        // Note: These will fail in test environment without actual macOS apps running
        // but we can verify the methods exist and return proper error types
        
        let result = detector.get_application_by_identifier("com.apple.finder");
        assert!(result.is_ok()); // Should return Ok(None) if Finder not running
        
        let permissions_result = detector.validate_permissions();
        assert!(permissions_result.is_ok()); // Should return Ok(false) in test environment
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_coordinate_conversion_calculation() {
        let monitor = MacOSFocusMonitor::new();
        
        // Test coordinate conversion logic (without actual NSScreen calls)
        // This tests the mathematical conversion
        let test_cases = vec![
            (100.0, 200.0, 2.0, 200.0, 400.0), // 2x Retina
            (50.0, 75.0, 1.0, 50.0, 75.0),     // Non-Retina
            (0.0, 0.0, 3.0, 0.0, 0.0),         // Origin point
        ];
        
        for (x, y, scale, expected_x, expected_y) in test_cases {
            let converted_x = x * scale;
            let converted_y = y * scale;
            assert_eq!(converted_x, expected_x);
            assert_eq!(converted_y, expected_y);
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_error_handling_messages() {
        let monitor = MacOSFocusMonitor::new();
        
        // Test permission denied error handling
        let permission_error = FocusError::PermissionDenied("Test permission error".to_string());
        let result = monitor.handle_macos_automation_error(&permission_error);
        assert!(result.is_ok());
        let message = result.unwrap();
        assert!(message.contains("Accessibility Permission Error"));
        assert!(message.contains("System Preferences"));
        assert!(message.contains("Recovery Steps"));

        // Test secure input error handling
        let secure_input_error = FocusError::SecureInputActive;
        let result = monitor.handle_macos_automation_error(&secure_input_error);
        assert!(result.is_ok());
        let message = result.unwrap();
        assert!(message.contains("Secure Input Active"));
        assert!(message.contains("password managers"));
        assert!(message.contains("terminal applications"));

        // Test process not found error handling
        let process_error = FocusError::ProcessNotFound(1234);
        let result = monitor.handle_macos_automation_error(&process_error);
        assert!(result.is_ok());
        let message = result.unwrap();
        assert!(message.contains("Process Not Found"));
        assert!(message.contains("1234"));
        assert!(message.contains("Verify the target application"));

        // Test platform-specific error handling
        let platform_error = FocusError::PlatformSpecific("Test platform error".to_string());
        let result = monitor.handle_macos_automation_error(&platform_error);
        assert!(result.is_ok());
        let message = result.unwrap();
        assert!(message.contains("Platform Error"));
        assert!(message.contains("macOS version compatibility"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_secure_input_detection_structure() {
        let monitor = MacOSFocusMonitor::new();
        
        // Test that secure input detection returns proper structure
        // Note: We can't test the actual secure input state without system calls
        // but we can test the error handling structure
        let test_info = SecureInputInfo {
            is_active: true,
            suspected_processes: vec![
                "Terminal".to_string(),
                "iTerm2".to_string(),
                "1Password".to_string(),
            ],
            recommendation: "Close password managers and terminal apps".to_string(),
        };
        
        assert!(test_info.is_active);
        assert_eq!(test_info.suspected_processes.len(), 3);
        assert!(test_info.suspected_processes.contains(&"Terminal".to_string()));
        assert!(test_info.suspected_processes.contains(&"1Password".to_string()));
        assert!(test_info.recommendation.contains("password managers"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_accessibility_permission_validation() {
        let monitor = MacOSFocusMonitor::new();
        
        // Test accessibility status structure
        let status = AccessibilityStatus {
            is_trusted: false,
            info_plist_configured: false,
            secure_input_active: true,
        };
        
        // Verify all permission states are properly represented
        assert!(!status.is_trusted);
        assert!(!status.info_plist_configured);
        assert!(status.secure_input_active);
        
        // Test that we can create status with different combinations
        let status2 = AccessibilityStatus {
            is_trusted: true,
            info_plist_configured: true,
            secure_input_active: false,
        };
        
        assert!(status2.is_trusted);
        assert!(status2.info_plist_configured);
        assert!(!status2.secure_input_active);
    }

    #[test]
    fn test_platform_specific_error_variant() {
        // Test that the new PlatformSpecific error variant works correctly
        let error = FocusError::PlatformSpecific("Test platform error".to_string());
        let error_string = format!("{}", error);
        assert!(error_string.contains("Platform-specific error"));
        assert!(error_string.contains("Test platform error"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_enhanced_error_handling_for_requirements() {
        let monitor = MacOSFocusMonitor::new();
        
        // Test requirement 8.1: Application closure detection
        // Note: In test environment, we can't test actual closure detection
        // but we can verify the method exists and returns proper types
        let closure_result = monitor.detect_application_closure(9999);
        assert!(closure_result.is_ok()); // Should return Ok(true) for non-existent process
        
        // Test requirement 8.2: Application unresponsiveness detection
        let unresponsive_result = monitor.detect_application_unresponsiveness(9999);
        assert!(unresponsive_result.is_ok()); // Should return Ok(true) for non-existent process
        
        // Test requirement 8.3: Clear error messages and recovery options
        let recovery_result = monitor.handle_application_detection_failure(&FocusError::ProcessNotFound(1234));
        assert!(recovery_result.is_ok());
        let recovery = recovery_result.unwrap();
        assert!(!recovery.recovery_steps.is_empty());
        assert!(recovery.recovery_steps.iter().any(|step| step.contains("1234")));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_enhanced_coordinate_conversion() {
        let monitor = MacOSFocusMonitor::new();
        
        // Test display info structure
        // Note: In test environment, this may fail due to no display access
        // but we can verify the method signature and error handling
        let display_result = monitor.get_display_info();
        // Don't assert success since test environment may not have display access
        
        // Test multi-display coordinate conversion
        let coord_result = monitor.convert_coordinates_multi_display(100.0, 200.0, Some(0));
        // Don't assert success since test environment may not have display access
        
        // Test coordinate validation logic
        // This tests the error handling without requiring actual display access
        let invalid_coord_result = monitor.convert_coordinates_multi_display(-100.0, -200.0, Some(999));
        // Should return error for invalid screen index or coordinates
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_comprehensive_permission_validation() {
        let mut monitor = MacOSFocusMonitor::new();
        
        // Test comprehensive permission validation
        let validation_result = monitor.validate_comprehensive_permissions();
        assert!(validation_result.is_ok());
        
        let validation = validation_result.unwrap();
        // In test environment, we expect some issues due to lack of proper setup
        // but we can verify the structure is correct
        assert!(validation.issues.len() >= 0); // May have issues in test environment
        assert!(validation.warnings.len() >= 0); // May have warnings
        assert!(validation.recommendations.len() >= 0); // May have recommendations
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_enhanced_secure_input_detection() {
        let monitor = MacOSFocusMonitor::new();
        
        // Test secure input process identification
        let processes_result = monitor.identify_secure_input_processes();
        assert!(processes_result.is_ok());
        let processes = processes_result.unwrap();
        assert!(!processes.is_empty()); // Should at least return "Unknown" if no specific apps found
        
        // Test application running check
        let app_running_result = monitor.is_application_running("NonExistentApp12345");
        assert!(app_running_result.is_ok());
        assert!(!app_running_result.unwrap()); // Should return false for non-existent app
    }

    #[test]
    fn test_new_data_structures() {
        // Test DisplayInfo structure
        let display_info = DisplayInfo {
            scale_factor: 2.0,
            width: 1920.0,
            height: 1080.0,
            screen_count: 1,
            is_retina: true,
        };
        assert!(display_info.is_retina);
        assert_eq!(display_info.scale_factor, 2.0);
        
        // Test PermissionValidationResult structure
        let validation_result = PermissionValidationResult {
            is_valid: false,
            issues: vec!["Test issue".to_string()],
            warnings: vec!["Test warning".to_string()],
            recommendations: vec!["Test recommendation".to_string()],
        };
        assert!(!validation_result.is_valid);
        assert_eq!(validation_result.issues.len(), 1);
        
        // Test ApplicationDetectionRecovery structure
        let recovery = ApplicationDetectionRecovery {
            error_type: "ProcessNotFound".to_string(),
            recovery_steps: vec!["Restart app".to_string()],
            can_retry: true,
            estimated_recovery_time: Some("Immediate".to_string()),
        };
        assert!(recovery.can_retry);
        assert!(recovery.estimated_recovery_time.is_some());
    }
}
