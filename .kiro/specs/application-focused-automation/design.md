# Design Document: Application-Focused Automation

## Overview

This document outlines the technical design for the application-focused automation feature in GeniusQA. The feature enables users to register specific applications and run automation scripts that are constrained to operate only within those applications, with automatic pause/resume based on application focus state.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native UI Layer                    │
├─────────────────────────────────────────────────────────────┤
│                    Tauri Bridge Layer                       │
├─────────────────────────────────────────────────────────────┤
│                     Rust Core Layer                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Application     │  │ Focus Monitor   │  │ Playback    │ │
│  │ Registry        │  │ Service         │  │ Controller  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                Platform-Specific Layer                      │
│  ┌─────────────────┐              ┌─────────────────────────┐│
│  │ Windows APIs    │              │ macOS APIs             ││
│  │ - User32        │              │ - Cocoa/AppKit         ││
│  │ - Kernel32      │              │ - Core Graphics        ││
│  └─────────────────┘              └─────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Action → React Native UI → Tauri Commands → Rust Core → Platform APIs
                    ↑                                ↓
            UI Updates ← Event Notifications ← Focus Monitor
```

## Core Components

### 1. Application Registry

**Purpose**: Manages the lifecycle of registered applications and their metadata.

**Location**: `packages/desktop/src-tauri/src/application_registry/`

**Key Structures**:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisteredApplication {
    pub id: String,
    pub name: String,
    pub executable_path: String,
    pub process_name: String,
    pub bundle_id: Option<String>,         // macOS: Bundle Identifier for persistence
    pub process_id: Option<u32>,           // Runtime only - not persisted
    pub window_handle: Option<WindowHandle>, // Runtime only - not persisted
    pub status: ApplicationStatus,
    pub registered_at: DateTime<Utc>,
    pub last_seen: Option<DateTime<Utc>>,
    pub default_focus_strategy: FocusLossStrategy,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FocusLossStrategy {
    AutoPause,      // Default: Pause execution and wait for focus
    StrictError,    // Immediately stop execution and mark as FAILED
    Ignore,         // Log warning but continue execution
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ApplicationStatus {
    Active,
    Inactive,
    NotFound,
    Error(String),
    PermissionDenied,      // macOS: Accessibility permission required
    SecureInputBlocked,    // macOS: Secure input mode active
}

pub struct ApplicationRegistry {
    applications: HashMap<String, RegisteredApplication>,
    storage: Box<dyn ApplicationStorage>,
    platform_detector: Box<dyn PlatformApplicationDetector>,
}
```

**Key Methods**:
- `register_application(app_info: ApplicationInfo) -> Result<String, RegistryError>`
- `unregister_application(app_id: &str) -> Result<(), RegistryError>`
- `get_running_applications() -> Result<Vec<ApplicationInfo>, RegistryError>`
- `update_application_status(app_id: &str) -> Result<ApplicationStatus, RegistryError>`
- `get_registered_applications() -> Vec<RegisteredApplication>`

### 2. Focus Monitor Service

**Purpose**: Continuously monitors application focus state and notifies other components of changes.

**Location**: `packages/desktop/src-tauri/src/focus_monitor/`

**Key Structures**:
```rust
pub struct FocusMonitor {
    target_app_id: Option<String>,
    target_process_id: Option<u32>,
    current_focus_state: Arc<RwLock<FocusState>>,
    event_sender: mpsc::Sender<FocusEvent>,
    monitor_handle: Option<JoinHandle<()>>,
    platform_monitor: Box<dyn PlatformFocusMonitor>,
}

#[derive(Debug, Clone)]
pub struct FocusState {
    pub is_target_process_focused: bool,
    pub focused_process_id: Option<u32>,
    pub focused_window_title: Option<String>,
    pub last_change: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub enum FocusEvent {
    TargetProcessGainedFocus { 
        app_id: String, 
        process_id: u32,
        window_title: String,
        timestamp: DateTime<Utc> 
    },
    TargetProcessLostFocus { 
        app_id: String, 
        process_id: u32,
        new_focused_app: Option<String>,
        timestamp: DateTime<Utc> 
    },
    FocusError { 
        error: String, 
        timestamp: DateTime<Utc> 
    },
}
```

**Key Methods**:
- `start_monitoring(app_id: String, process_id: u32) -> Result<(), FocusError>`
- `stop_monitoring() -> Result<(), FocusError>`
- `get_current_focus_state() -> FocusState`
- `subscribe_to_events() -> mpsc::Receiver<FocusEvent>`

### 3. Playback Controller

**Purpose**: Manages automation script execution with focus-aware pause/resume functionality.

**Location**: `packages/desktop/src-tauri/src/playback_controller/`

**Key Structures**:
```rust
pub struct PlaybackController {
    current_session: Option<PlaybackSession>,
    focus_event_receiver: mpsc::Receiver<FocusEvent>,
    automation_engine: Box<dyn AutomationEngine>,
    notification_service: Arc<NotificationService>,
}

#[derive(Debug, Clone)]
pub struct PlaybackSession {
    pub id: String,
    pub target_app_id: String,
    pub target_process_id: u32,
    pub script: AutomationScript,
    pub state: PlaybackState,
    pub focus_strategy: FocusLossStrategy,
    pub current_step: usize,
    pub started_at: DateTime<Utc>,
    pub paused_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum PlaybackState {
    Running,
    Paused(PauseReason),
    Completed,
    Failed(String),
    Aborted(String),
}

#[derive(Debug, Clone, PartialEq)]
pub enum PauseReason {
    FocusLost,
    UserRequested,
    ApplicationError,
    ValidationFailed,
}
```

**Key Methods**:
- `start_playback(app_id: String, script: AutomationScript, focus_strategy: FocusLossStrategy) -> Result<String, PlaybackError>`
- `pause_playback(reason: PauseReason) -> Result<(), PlaybackError>`
- `resume_playback() -> Result<(), PlaybackError>`
- `abort_playback(reason: String) -> Result<(), PlaybackError>`
- `stop_playback() -> Result<(), PlaybackError>`
- `get_playback_status() -> Option<PlaybackSession>`

### 4. Platform-Specific Implementations

#### Windows Implementation

**Location**: `packages/desktop/src-tauri/src/platform/windows/`

**Key APIs Used**:
- `User32.dll`: Window enumeration, focus detection, window management
- `Kernel32.dll`: Process information, handle management
- `Psapi.dll`: Process and module information

**Key Structures**:
```rust
pub struct WindowsApplicationDetector {
    // Windows-specific implementation
}

pub struct WindowsFocusMonitor {
    hook_handle: Option<HHOOK>,
    target_hwnd: Option<HWND>,
}

impl PlatformApplicationDetector for WindowsApplicationDetector {
    fn get_running_applications(&self) -> Result<Vec<ApplicationInfo>, DetectorError>;
    fn get_application_window_handle(&self, process_id: u32) -> Result<WindowHandle, DetectorError>;
}

impl PlatformFocusMonitor for WindowsFocusMonitor {
    fn start_monitoring(&mut self, process_id: u32) -> Result<(), FocusError>;
    fn stop_monitoring(&mut self) -> Result<(), FocusError>;
    fn is_process_focused(&self, process_id: u32) -> Result<bool, FocusError>;
    fn get_focused_process_id(&self) -> Result<Option<u32>, FocusError>;
}
```

#### macOS Implementation

**Location**: `packages/desktop/src-tauri/src/platform/macos/`

**Key APIs Used**:
- `NSWorkspace`: Application enumeration and focus notifications
- `Accessibility API`: Application interaction and permission management
- `Core Graphics`: Window information and coordinate handling
- `Bundle Identifier`: Persistent application identification

**Key Structures**:
```rust
pub struct MacOSApplicationDetector {
    workspace: NSWorkspace,
    // Uses Bundle Identifier for persistent app identification
}

pub struct MacOSFocusMonitor {
    observer: Option<NSWorkspaceNotificationObserver>,
    target_bundle_id: Option<String>,
    accessibility_trusted: bool,
    secure_input_active: bool,
}

impl PlatformApplicationDetector for MacOSApplicationDetector {
    fn get_running_applications(&self) -> Result<Vec<ApplicationInfo>, DetectorError>;
    fn get_application_by_bundle_id(&self, bundle_id: &str) -> Result<Option<ApplicationInfo>, DetectorError>;
    fn validate_accessibility_permissions(&self) -> Result<bool, DetectorError>;
}

impl PlatformFocusMonitor for MacOSFocusMonitor {
    fn start_monitoring(&mut self, process_id: u32) -> Result<(), FocusError>;
    fn stop_monitoring(&mut self) -> Result<(), FocusError>;
    fn is_process_focused(&self, process_id: u32) -> Result<bool, FocusError>;
    fn get_focused_process_id(&self) -> Result<Option<u32>, FocusError>;
    fn check_secure_input_state(&self) -> Result<bool, FocusError>;
}
```

**macOS-Specific Considerations**:

1. **Accessibility Permissions (TCC)**:
   - Check `AXIsProcessTrusted()` at startup
   - Guide users to System Settings → Privacy & Security → Accessibility
   - Graceful degradation when permissions are denied

2. **Bundle Identifier Usage**:
   - Store `bundle_id` instead of file paths for persistence
   - Handle app relocations and updates seamlessly
   - Use `NSRunningApplication.bundleIdentifier` for identification

3. **Event-Driven Focus Detection**:
   - Use `NSWorkspaceDidActivateApplicationNotification` instead of polling
   - Significantly reduces CPU usage and battery consumption
   - Immediate notification when applications gain focus

4. **Secure Input Handling**:
   - Monitor `IsSecureEventInputEnabled()` state
   - Pause automation when secure input is active (password fields, sudo)
   - Notify users when automation is blocked by secure input

5. **Retina Display Coordinate Handling**:
   - Convert between logical points and physical pixels
   - Handle scaling factors (1x, 2x, 3x) for accurate coordinate validation
   - Use `NSScreen.backingScaleFactor` for proper coordinate conversion
```

## Data Flow

### Application Registration Flow

```
1. User clicks "Add Application"
2. UI calls get_running_applications()
3. ApplicationRegistry queries PlatformApplicationDetector
4. Platform APIs return running application list
5. UI displays applications to user
6. User selects application
7. UI calls register_application()
8. ApplicationRegistry stores application data
9. ApplicationStorage persists to disk
10. UI updates with registered application
```

### Focus Monitoring Flow

```
1. User starts automation on registered app
2. ApplicationRegistry resolves current process_id for app
3. PlaybackController calls FocusMonitor.start_monitoring(process_id)
4. FocusMonitor sets up platform-specific event hooks (primary)
5. FocusMonitor starts fallback polling thread (100ms backup)
6. On focus change, platform hooks trigger immediately
7. FocusMonitor validates focus using process ID comparison
8. FocusMonitor sends FocusEvent with detailed information
9. PlaybackController receives event and applies focus strategy:
   - Auto-Pause: Pause and wait for focus return
   - Strict Error: Abort immediately with error report
   - Ignore: Log warning and continue
10. NotificationService shows appropriate user notification
11. UI updates focus state indicator
```

**Process-Based Focus Detection Logic**:
```rust
// Improved focus detection that handles popups and dialogs
fn is_application_process_focused(target_process_id: u32) -> Result<bool, FocusError> {
    let focused_window = get_foreground_window()?;
    let focused_process_id = get_window_process_id(focused_window)?;
    
    // Valid if the focused window belongs to the target process
    // This handles main windows, popups, dialogs, etc.
    Ok(target_process_id == focused_process_id)
}
```

### Automation Execution Flow

```
1. User starts automation script with selected focus strategy
2. PlaybackController validates target application is running
3. PlaybackController gets current process_id from ApplicationRegistry
4. PlaybackController starts FocusMonitor with process_id
5. PlaybackController begins script execution
6. For each automation step:
   a. Validate target process is focused (if strategy requires)
   b. Validate action coordinates are within process windows
   c. Execute action via AutomationEngine
   d. Handle focus events based on strategy:
      - Auto-Pause: Pause on focus loss, resume on focus gain
      - Strict Error: Abort immediately on focus loss
      - Ignore: Continue with warning on focus loss
   e. Continue to next step or handle errors
7. Complete successfully or handle failures appropriately
```

## User Interface Design

### Application Management Screen

**Location**: `packages/desktop/src/screens/ApplicationManagement.tsx`

**Components**:
- `ApplicationList`: Shows registered applications with status
- `AddApplicationModal`: Displays running applications for selection
- `ApplicationCard`: Individual application display with actions
- `StatusIndicator`: Visual focus state indicator

**Key Features**:
- Real-time status updates
- Add/remove applications
- Focus state visualization
- Error state handling

### Automation Control Panel

**Location**: `packages/desktop/src/components/AutomationControl.tsx`

**Components**:
- `PlaybackControls`: Start/pause/stop buttons
- `FocusIndicator`: Shows current focus state
- `ProgressDisplay`: Shows automation progress
- `NotificationArea`: Displays focus-related notifications

## Error Handling Strategy

### Error Categories

1. **Application Detection Errors**
   - Application not found
   - Permission denied (macOS Accessibility)
   - Platform API failures
   - Bundle ID resolution failures (macOS)

2. **Focus Monitoring Errors**
   - Window handle invalid
   - Platform hook failures
   - Monitoring thread crashes
   - Secure input mode blocking (macOS)
   - Accessibility permission revoked (macOS)

3. **Playback Errors**
   - Target application closed
   - Validation failures
   - Automation engine errors
   - Coordinate conversion errors (macOS Retina)
   - Focus strategy violations

### Error Recovery Mechanisms

1. **Graceful Degradation**: Continue with reduced functionality when possible
2. **Automatic Retry**: Retry failed operations with exponential backoff
3. **User Notification**: Clear error messages with recovery suggestions
4. **State Preservation**: Save automation progress before handling errors
5. **Fallback Options**: Alternative approaches when primary methods fail

## Performance Considerations

### Focus Monitoring Optimization

- **Polling Interval**: 100ms balance between responsiveness and CPU usage
- **Event-Driven Updates**: Use platform hooks when available
- **Efficient Window Queries**: Cache window handles and minimize API calls
- **Background Thread**: Separate thread for monitoring to avoid UI blocking

### Memory Management

- **Application Registry**: Limit registered applications to prevent memory bloat
- **Event Cleanup**: Properly dispose of platform hooks and observers
- **Cache Management**: Implement LRU cache for frequently accessed data

## Security Considerations

### Application Access Control

- **Permission Validation**: Verify user has permission to access target applications
- **Process Isolation**: Ensure automation cannot escape target application boundaries
- **Privilege Escalation**: Handle cases where target apps require elevated permissions

### Data Protection

- **Sensitive Information**: Avoid logging sensitive application data
- **Secure Storage**: Encrypt stored application registry data
- **API Security**: Validate all inputs to prevent injection attacks

## Testing Strategy

### Unit Tests

- **Component Isolation**: Test each component independently
- **Mock Platform APIs**: Use mocks for platform-specific functionality
- **Error Scenarios**: Test all error conditions and recovery paths

### Integration Tests

- **Cross-Platform**: Test on both Windows and macOS
- **Real Applications**: Test with actual applications in controlled environment
- **Focus Transitions**: Test rapid focus changes and edge cases

### Performance Tests

- **Resource Usage**: Monitor CPU and memory usage during monitoring
- **Responsiveness**: Measure focus detection latency
- **Stress Testing**: Test with multiple registered applications

## Implementation Phases

### Phase 1: Core Infrastructure
- Application Registry implementation
- Basic platform detection
- Data persistence layer

### Phase 2: Focus Monitoring
- Platform-specific focus detection
- Event system implementation
- Background monitoring service

### Phase 3: Playback Integration
- Focus-aware playback controller
- Automation validation
- Error handling and recovery

### Phase 4: User Interface
- Application management screens
- Focus state visualization
- User notifications

### Phase 5: Polish and Optimization
- Performance optimization
- Cross-platform testing
- User experience refinements

## Configuration

### Settings Structure

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ApplicationFocusConfig {
    pub focus_check_interval_ms: u64,
    pub max_registered_applications: usize,
    pub auto_resume_delay_ms: u64,
    pub notification_timeout_ms: u64,
    pub enable_focus_notifications: bool,
    pub strict_window_validation: bool,
    pub default_focus_strategy: FocusLossStrategy,
    pub use_event_hooks: bool,
    pub fallback_polling_enabled: bool,
}
```

### Default Configuration

```json
{
  "focus_check_interval_ms": 100,
  "max_registered_applications": 50,
  "auto_resume_delay_ms": 500,
  "notification_timeout_ms": 5000,
  "enable_focus_notifications": true,
  "strict_window_validation": true,
  "default_focus_strategy": "AutoPause",
  "use_event_hooks": true,
  "fallback_polling_enabled": true
}
```

## Platform-Specific Considerations

### macOS Critical Requirements

#### 1. Accessibility Permissions (TCC - Transparency, Consent, and Control)

**Challenge**: macOS requires explicit user consent for applications to monitor other applications or send input events.

**Implementation Requirements**:
- Check `AXIsProcessTrusted()` at application startup
- Display permission request UI if not granted
- Provide clear instructions for enabling accessibility permissions
- Gracefully handle permission denial with informative error messages
- Re-check permissions when focus monitoring starts

**User Experience Flow**:
```
1. User attempts to start focus monitoring
2. System checks accessibility permissions
3. If denied: Show permission guide with System Settings path
4. If granted: Proceed with monitoring setup
5. Monitor permission changes during runtime
```

#### 2. Bundle Identifier Strategy

**Challenge**: macOS applications can be moved, renamed, or updated, making file paths unreliable.

**Solution**: Use Bundle Identifiers as primary application identification:
- Store `bundle_id` (e.g., `com.google.Chrome`) instead of file paths
- Bundle IDs remain constant across app updates and relocations
- Fall back to process name matching if Bundle ID unavailable
- Handle cases where multiple versions of same app are installed

#### 3. Event-Driven Focus Detection

**Optimization**: Use NSWorkspace notifications instead of polling:
- Subscribe to `NSWorkspaceDidActivateApplicationNotification`
- Immediate notification when applications gain focus
- Significantly reduces CPU usage and battery consumption
- Maintain polling as fallback for reliability

#### 4. Secure Input Mode Handling

**Challenge**: macOS enables "Secure Input" when password fields are active, blocking automation.

**Detection and Response**:
- Monitor `IsSecureEventInputEnabled()` state
- Automatically pause automation when secure input is detected
- Display clear notification explaining the pause
- Resume automatically when secure input is disabled
- Log secure input events for debugging

#### 5. Retina Display Coordinate Handling

**Challenge**: macOS uses logical points vs physical pixels on high-DPI displays.

**Coordinate Conversion Requirements**:
- Use `NSScreen.backingScaleFactor` to get display scaling
- Convert coordinates between logical and physical spaces
- Validate click coordinates account for scaling factors
- Handle multi-monitor setups with different scaling factors

### Windows Specific Considerations

#### 1. Window Handle Management
- Use `SetWinEventHook` for efficient focus change detection
- Handle window handle invalidation on application restart
- Manage hook cleanup to prevent memory leaks

#### 2. Process and Thread Identification
- Use `GetWindowThreadProcessId` for accurate process mapping
- Handle elevated privilege applications appropriately
- Manage UAC (User Account Control) interactions

## Technical Improvements and Solutions

### 1. WindowHandle Storage Issue Resolution

**Problem**: Window handles (HWND on Windows) are temporary identifiers that become invalid when applications restart.

**Solution**: 
- Store only permanent identifiers (`executable_path`, `process_name`) in persistent storage
- Resolve `process_id` and `window_handle` at runtime by scanning running processes
- Implement automatic re-detection when applications restart
- Use process-based focus detection instead of window-specific detection

### 2. Popup and Dialog Support

**Problem**: Applications often show popups, dialogs, or child windows that steal focus from the main window but are part of the same application.

**Solution**:
- Use Process ID (PID) based focus detection instead of specific window handles
- Any window belonging to the target process is considered "in focus"
- This naturally handles main windows, popups, dialogs, and child windows
- Maintains automation flow when legitimate application dialogs appear

### 3. Event-Driven vs Polling Strategy

**Problem**: Continuous polling (100ms) consumes CPU resources unnecessarily.

**Solution**:
- **Primary**: Use platform-specific event hooks for immediate notifications
  - Windows: `SetWinEventHook` for focus change events
  - macOS: `AXObserver` for accessibility notifications
- **Fallback**: Maintain 100ms polling as backup for reliability
- **Hybrid**: Combine both approaches for maximum responsiveness and reliability

### 4. Flexible Focus Loss Handling

**Problem**: Different automation scenarios require different responses to focus loss.

**Solution**:
- **Auto-Pause (Default)**: Traditional behavior - pause and wait for focus return
- **Strict Error**: Fail immediately for critical test scenarios requiring strict focus
- **Ignore**: Continue execution for background-capable operations with warnings
- Per-application and per-session configuration options

This design provides a robust, cross-platform solution for application-focused automation that meets all the requirements while maintaining good performance and user experience.
